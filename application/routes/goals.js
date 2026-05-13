/**
 * Why:
 *   This file is meant to handle the major goal planning process, which is the core
 *   feature our platform, Pathwise is trying to solve and stand out as.
 *
 * What:
 *   It defines the CRUD (create, read, update, delete) routes for Goals, goal overview, 
 *   goal detail, goal hub, and status marker (done, paused, or in-progress) as well as 
 *   the goal material attachement behavior.
 *
 * Where used:
 *   It is mounted under '/api' in server.js
 *   It is called by vertical-prototype/js/goals.js and js/goal-detail.js.
 *
 * Notes:
 *   - All routes require an authenticated session.
 *   - Ownership is enforced by matching goal.user_id to req.session.userId.
 *   - Touches tables: Goals, Projects, Milestones, GoalResources.
 *   - Also logs activity for goal creation.
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');
const { logActivity } = require('../services/activityLog');

const router = express.Router();

function validStatus(value) {
  return ['active', 'paused', 'completed'].includes(value);
}

router.get('/goals-overview', requireAuth, async (req, res) => {
  try {
    const pool = db.getPool();
    const userId = req.session.userId;
    const [goals] = await pool.query(
      `SELECT goal_id, user_id, title, description, category, target_date, status, template_kind, template_copied_count, created_at, updated_at
       FROM Goals
       WHERE user_id = ? AND template_kind = 'none'
       ORDER BY updated_at DESC`,
      [userId]
    );

    const [projectCounts] = await pool.query(
      `SELECT g.goal_id, COUNT(p.project_id) AS project_count
       FROM Goals g
       LEFT JOIN Projects p ON p.goal_id = g.goal_id
       WHERE g.user_id = ?
       GROUP BY g.goal_id`,
      [userId]
    );

    const [milestoneCounts] = await pool.query(
      `SELECT g.goal_id,
              COUNT(m.milestone_id) AS milestone_total,
              SUM(CASE WHEN m.is_completed = 1 THEN 1 ELSE 0 END) AS milestone_done
       FROM Goals g
       LEFT JOIN Projects p ON p.goal_id = g.goal_id
       LEFT JOIN Milestones m ON m.project_id = p.project_id
       WHERE g.user_id = ?
       GROUP BY g.goal_id`,
      [userId]
    );

    const projectMap = new Map(projectCounts.map((r) => [r.goal_id, Number(r.project_count) || 0]));
    const milestoneMap = new Map(
      milestoneCounts.map((r) => [
        r.goal_id,
        {
          total: Number(r.milestone_total) || 0,
          done: Number(r.milestone_done) || 0
        }
      ])
    );

    const results = goals.map((g) => {
      const m = milestoneMap.get(g.goal_id) || { total: 0, done: 0 };
      const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
      return {
        ...g,
        project_count: projectMap.get(g.goal_id) || 0,
        milestone_total: m.total,
        milestone_done: m.done,
        completion_pct: pct
      };
    });

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/goals', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.getPool().query(
      `SELECT goal_id, user_id, title, description, category, target_date, status, template_kind, template_copied_count, created_at, updated_at
       FROM Goals
       WHERE user_id = ? AND template_kind = 'none'
       ORDER BY updated_at DESC`,
      [req.session.userId]
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/goals/:id', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    if (!goalId) return res.status(400).json({ success: false, error: 'Invalid goal id' });
    const [rows] = await db.getPool().query(
      `SELECT goal_id, user_id, title, description, category, target_date, status, template_kind, template_copied_count, created_at, updated_at
       FROM Goals
       WHERE goal_id = ? AND user_id = ?
       LIMIT 1`,
      [goalId, req.session.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Goal not found' });
    res.json({ success: true, goal: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/goals/:id/hub', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    if (!goalId) return res.status(400).json({ success: false, error: 'Invalid goal id' });
    const userId = req.session.userId;
    const pool = db.getPool();

    const [goalRows] = await pool.query(
      `SELECT goal_id, user_id, title, description, category, target_date, status, template_kind, template_copied_count, created_at, updated_at
       FROM Goals
       WHERE goal_id = ? AND user_id = ?
       LIMIT 1`,
      [goalId, userId]
    );
    if (!goalRows.length) return res.status(404).json({ success: false, error: 'Goal not found' });

    const goal = goalRows[0];
    const [projects] = await pool.query(
      `SELECT p.project_id, p.goal_id, p.title, p.description, p.created_at, p.updated_at
       FROM Projects p
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE p.goal_id = ? AND g.user_id = ?
       ORDER BY p.updated_at DESC`,
      [goalId, userId]
    );

    const projectIds = projects.map((p) => p.project_id);
    let milestones = [];
    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => '?').join(',');
      const [rows] = await pool.query(
        `SELECT milestone_id, project_id, title, description, target_date, is_completed, completed_at, created_at, updated_at
         FROM Milestones
         WHERE project_id IN (${placeholders})
         ORDER BY target_date IS NULL, target_date ASC, created_at ASC`,
        projectIds
      );
      milestones = rows;
    }

    const milestoneByProject = new Map();
    for (const m of milestones) {
      const arr = milestoneByProject.get(m.project_id) || [];
      arr.push(m);
      milestoneByProject.set(m.project_id, arr);
    }

    const projectsWithMilestones = projects.map((p) => {
      const list = milestoneByProject.get(p.project_id) || [];
      const done = list.filter((m) => m.is_completed).length;
      const total = list.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return {
        ...p,
        milestones: list,
        stats: { milestone_total: total, milestone_done: done, completion_pct: pct }
      };
    });

    const milestoneTotal = milestones.length;
    const milestoneDone = milestones.filter((m) => m.is_completed).length;
    const completionPct = milestoneTotal > 0 ? Math.round((milestoneDone / milestoneTotal) * 100) : 0;

    res.json({
      success: true,
      goal,
      projects: projectsWithMilestones,
      stats: {
        project_count: projects.length,
        milestone_total: milestoneTotal,
        milestone_done: milestoneDone,
        completion_pct: completionPct
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/goals', requireAuth, async (req, res) => {
  try {
    const { title, description, category, target_date } = req.body || {};
    if (!title || String(title).trim().length < 2) {
      return res.status(400).json({ success: false, error: 'title is required (min 2 chars)' });
    }
    const [result] = await db.getPool().query(
      `INSERT INTO Goals (user_id, title, description, category, target_date, status, template_kind, template_copied_count)
       VALUES (?, ?, ?, ?, ?, 'active', 'none', 0)`,
      [req.session.userId, String(title).trim(), description || null, category || null, target_date || null]
    );
    const goalId = result.insertId;
    await logActivity({
      userId: req.session.userId,
      actionType: 'goal_created',
      entityType: 'goal',
      entityId: goalId,
      detail: { title: String(title).trim() }
    });
    res.status(201).json({ success: true, goal_id: goalId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/goals/:id', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const { title, description, category, target_date } = req.body || {};
    if (!goalId) return res.status(400).json({ success: false, error: 'Invalid goal id' });
    if (!title || String(title).trim().length < 2) {
      return res.status(400).json({ success: false, error: 'title is required (min 2 chars)' });
    }
    const [result] = await db.getPool().query(
      `UPDATE Goals
       SET title = ?, description = ?, category = ?, target_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE goal_id = ? AND user_id = ?`,
      [String(title).trim(), description || null, category || null, target_date || null, goalId, req.session.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Goal not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/goals/:id/status', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const { status } = req.body || {};
    if (!goalId) return res.status(400).json({ success: false, error: 'Invalid goal id' });
    if (!validStatus(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
    const pool = db.getPool();
    const [prevRows] = await pool.query(
      `SELECT status FROM Goals WHERE goal_id = ? AND user_id = ? LIMIT 1`,
      [goalId, req.session.userId]
    );
    if (!prevRows.length) return res.status(404).json({ success: false, error: 'Goal not found' });
    const prevStatus = prevRows[0].status;

    const [result] = await pool.query(
      `UPDATE Goals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE goal_id = ? AND user_id = ?`,
      [status, goalId, req.session.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Goal not found' });

    if (status === 'completed' && prevStatus !== 'completed') {
      await logActivity({
        userId: req.session.userId,
        actionType: 'goal_completed',
        entityType: 'goal',
        entityId: goalId
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/goals/:id', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    if (!goalId) return res.status(400).json({ success: false, error: 'Invalid goal id' });
    const [result] = await db.getPool().query('DELETE FROM Goals WHERE goal_id = ? AND user_id = ?', [
      goalId,
      req.session.userId
    ]);
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Goal not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/goals/:id/resources', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const resourceId = Number((req.body || {}).resource_id);

    if (!goalId || !resourceId) return res.status(400).json({ success: false, error: 'goal id and resource_id required' });

    const [resources] = await db.getPool().query(
      `SELECT resource_id FROM Resources
       WHERE resource_id = ?
         AND (
           (visibility = 'public' AND moderation_status = 'approved')
           OR submitted_by = ?
         )
       LIMIT 1`,
      [resourceId, req.session.userId]
    );
    if (!resources.length) {
      return res.status(404).json({ success: false, error: 'Resource not found or not attachable' });
    }

    const [goals] = await db.getPool().query('SELECT goal_id FROM Goals WHERE goal_id = ? AND user_id = ?', [
      goalId,
      req.session.userId
    ]);
    if (!goals.length) return res.status(404).json({ success: false, error: 'Goal not found' });

    await db.getPool().query('INSERT IGNORE INTO GoalResources (goal_id, resource_id) VALUES (?, ?)', [goalId, resourceId]);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/goals/:goalId/resources/:resourceId', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.goalId);
    const resourceId = Number(req.params.resourceId);
    if (!goalId || !resourceId) {
      return res.status(400).json({ success: false, error: 'goal id and resource_id required' });
    }
    const pool = db.getPool();
    const [result] = await pool.query(
      `DELETE gr FROM GoalResources gr
       JOIN Goals g ON g.goal_id = gr.goal_id
       WHERE gr.goal_id = ? AND gr.resource_id = ? AND g.user_id = ?`,
      [goalId, resourceId, req.session.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Attachment not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/goals/:id/templates', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const templateId = Number((req.body || {}).template_id);
    if (!goalId || !templateId) {
      return res.status(400).json({ error: 'Validation failed', details: ['goal id and template_id required'] });
    }
    const pool = db.getPool();
    const [[goal]] = await pool.query('SELECT goal_id FROM Goals WHERE goal_id = ? AND user_id = ? LIMIT 1', [
      goalId,
      req.session.userId
    ]);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const [[template]] = await pool.query(
      'SELECT template_id FROM CommunityTemplates WHERE template_id = ? AND is_public = 1 LIMIT 1',
      [templateId]
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });
    await pool.query(`INSERT IGNORE INTO GoalTemplateLinks (goal_id, template_id) VALUES (?, ?)`, [goalId, templateId]);
    res.status(201).json({ success: true });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/goals/:id/workflows', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const workflowId = Number((req.body || {}).workflow_id);
    if (!goalId || !workflowId) {
      return res.status(400).json({ error: 'Validation failed', details: ['goal id and workflow_id required'] });
    }
    const pool = db.getPool();
    const [[goal]] = await pool.query('SELECT goal_id FROM Goals WHERE goal_id = ? AND user_id = ? LIMIT 1', [
      goalId,
      req.session.userId
    ]);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const [[workflow]] = await pool.query(
      'SELECT workflow_id FROM Workflows WHERE workflow_id = ? AND (is_public = 1 OR created_by = ?) LIMIT 1',
      [workflowId, req.session.userId]
    );
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    await pool.query(`INSERT IGNORE INTO GoalWorkflowLinks (goal_id, workflow_id) VALUES (?, ?)`, [goalId, workflowId]);
    res.status(201).json({ success: true });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/goals/:goalId/attachments', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.goalId);
    if (!goalId) return res.status(400).json({ error: 'Validation failed', details: ['Invalid goal id'] });
    const pool = db.getPool();
    const [[goal]] = await pool.query('SELECT goal_id FROM Goals WHERE goal_id = ? AND user_id = ? LIMIT 1', [
      goalId,
      req.session.userId
    ]);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const [resources] = await pool.query(
      `SELECT r.resource_id AS id, 'resource' AS type, r.title, r.description, c.category_name AS category,
              r.is_ai_enabled AS ai_enabled, r.image_path AS image, r.url, gr.created_at AS attachedAt
       FROM GoalResources gr
       JOIN Resources r ON r.resource_id = gr.resource_id
       LEFT JOIN Categories c ON c.category_id = r.category_id
       WHERE gr.goal_id = ?`,
      [goalId]
    );
    const [resourceTags] = await pool.query(
      `SELECT gr.resource_id, t.tag_name
       FROM GoalResources gr
       JOIN ResourceTags rt ON rt.resource_id = gr.resource_id
       JOIN Tags t ON t.tag_id = rt.tag_id
       WHERE gr.goal_id = ?`,
      [goalId]
    );
    const tagsByResource = new Map();
    for (const row of resourceTags) {
      const list = tagsByResource.get(row.resource_id) || [];
      list.push(row.tag_name);
      tagsByResource.set(row.resource_id, list);
    }
    for (const item of resources) {
      item.tags = tagsByResource.get(item.id) || [];
    }

    const [templates] = await pool.query(
      `SELECT t.template_id AS id, 'template' AS type, t.title, t.description, t.category,
              0 AS ai_enabled, NULL AS image, NULL AS url, gl.created_at AS attachedAt
       FROM GoalTemplateLinks gl
       JOIN CommunityTemplates t ON t.template_id = gl.template_id
       WHERE gl.goal_id = ?`,
      [goalId]
    );
    for (const item of templates) item.tags = [];

    const [workflows] = await pool.query(
      `SELECT w.workflow_id AS id, 'workflow' AS type, w.title, w.description, w.category,
              w.is_ai_enabled AS ai_enabled, NULL AS image, NULL AS url, gw.created_at AS attachedAt
       FROM GoalWorkflowLinks gw
       JOIN Workflows w ON w.workflow_id = gw.workflow_id
       WHERE gw.goal_id = ?`,
      [goalId]
    );
    for (const item of workflows) item.tags = [];

    res.json({ success: true, results: [...resources, ...templates, ...workflows] });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
