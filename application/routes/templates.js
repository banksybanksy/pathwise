const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

async function ensureGoalOwned(pool, goalId, userId) {
  const [[goal]] = await pool.query('SELECT goal_id FROM Goals WHERE goal_id = ? AND user_id = ? LIMIT 1', [
    goalId,
    userId
  ]);
  return goal;
}

/** Legacy simple workflow templates (CommunityTemplates) */
router.get('/templates/public', async (req, res) => {
  try {
    const [rows] = await db.getPool().query(
      `SELECT t.template_id, t.title, t.description, t.category, t.workflow_steps, t.created_at,
              u.username AS author
       FROM CommunityTemplates t
       LEFT JOIN Users u ON u.user_id = t.created_by
       WHERE t.is_public = 1
       ORDER BY t.created_at DESC`
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/community/templates', async (req, res) => {
  try {
    const [rows] = await db.getPool().query(
      `SELECT t.template_id, t.title, t.description, t.category, t.skill_area, t.workflow_steps, t.created_at,
              u.username AS author
       FROM CommunityTemplates t
       LEFT JOIN Users u ON u.user_id = t.created_by
       WHERE t.is_public = 1 AND t.is_published = 1
       ORDER BY t.copied_count DESC, t.created_at DESC`
    );
    res.json({ success: true, results: rows });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/templates', requireAuth, async (req, res) => {
  try {
    const { title, description, category, workflow_steps } = req.body || {};
    const titleStr = String(title || '').trim();
    const stepsStr = String(workflow_steps || '').trim();
    const descStr = String(description || '').trim();
    const catStr = String(category || '').trim().toLowerCase();

    if (titleStr.length < 3 || titleStr.length > 255) {
      return res.status(400).json({ success: false, error: 'Title must be between 3 and 255 characters.' });
    }
    if (stepsStr.length < 10) {
      return res.status(400).json({ success: false, error: 'Workflow steps must be at least 10 characters.' });
    }

    const [result] = await db.getPool().query(
      `INSERT INTO CommunityTemplates (title, description, category, workflow_steps, is_public, created_by)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [titleStr, descStr || null, catStr || null, stepsStr, req.session.userId]
    );

    res.status(201).json({ success: true, template_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Logged-in user's draft / published goal-templates they own */
router.get('/goal-templates/mine', requireAuth, async (req, res) => {
  try {
    const state = String(req.query.state || 'all').toLowerCase();
    const pool = db.getPool();
    let where = 'g.user_id = ? AND g.template_kind IN (\'draft\',\'published\')';
    const params = [req.session.userId];
    if (state === 'draft') where += " AND g.template_kind = 'draft'";
    if (state === 'published') where += " AND g.template_kind = 'published'";
    const [rows] = await pool.query(
      `SELECT g.goal_id, g.title, g.description, g.category, g.template_kind, g.template_copied_count, g.updated_at
       FROM Goals g
       WHERE ${where}
       ORDER BY g.updated_at DESC`,
      params
    );
    res.json({ success: true, results: rows });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Create a new goal marked as template draft (same structure as a normal goal) */
router.post('/goal-templates', requireAuth, async (req, res) => {
  try {
    const title = String((req.body || {}).title || '').trim();
    const description = (req.body || {}).description != null ? String(req.body.description).trim() : '';
    const category = (req.body || {}).category != null ? String(req.body.category).trim() : '';
    if (title.length < 2) {
      return res.status(400).json({ error: 'Validation failed', details: ['title is required (min 2 chars)'] });
    }
    const pool = db.getPool();
    const [result] = await pool.query(
      `INSERT INTO Goals (user_id, title, description, category, target_date, status, template_kind, template_copied_count)
       VALUES (?, ?, ?, ?, NULL, 'active', 'draft', 0)`,
      [req.session.userId, title, description || null, category || null]
    );
    res.status(201).json({ success: true, goal_id: result.insertId });
  } catch (err) {
    if (String(err.message || '').includes('template_kind')) {
      return res.status(500).json({
        error: 'Database not migrated',
        details: ['Run migration 011_goal_templates_as_goals.sql']
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** List published goal templates (logged-in users) */
router.get('/goal-templates', requireAuth, async (_req, res) => {
  try {
    const [rows] = await db.getPool().query(
      `SELECT g.goal_id, g.title, g.description, g.category, g.template_copied_count, g.created_at, g.updated_at,
              u.username AS author,
              (SELECT AVG(r.stars) FROM GoalTemplateRatings r WHERE r.template_goal_id = g.goal_id) AS avg_rating,
              (SELECT COUNT(*) FROM GoalTemplateRatings r2 WHERE r2.template_goal_id = g.goal_id) AS rating_count
       FROM Goals g
       JOIN Users u ON u.user_id = g.user_id
       WHERE g.template_kind = 'published'
       ORDER BY g.template_copied_count DESC, g.updated_at DESC`
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    if (String(err.message || '').includes('GoalTemplateRatings') || String(err.message || '').includes('template_kind')) {
      return res.status(500).json({
        error: 'Database not migrated',
        details: ['Run migration 011_goal_templates_as_goals.sql']
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Single template (published for anyone logged in, or draft owned by you) */
router.get('/goal-templates/:id', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    if (!goalId) return res.status(400).json({ error: 'Invalid template id' });
    const pool = db.getPool();
    const userId = req.session.userId;
    const [[goal]] = await pool.query(
      `SELECT g.goal_id, g.user_id, g.title, g.description, g.category, g.target_date, g.status, g.template_kind,
              g.template_copied_count, g.created_at, g.updated_at, u.username AS author
       FROM Goals g
       JOIN Users u ON u.user_id = g.user_id
       WHERE g.goal_id = ?
         AND (
           g.template_kind = 'published'
           OR (g.user_id = ? AND g.template_kind IN ('draft','published'))
         )
       LIMIT 1`,
      [goalId, userId]
    );
    if (!goal) return res.status(404).json({ error: 'Template not found' });

    const [projects] = await pool.query(
      `SELECT project_id, goal_id, title, description, created_at, updated_at
       FROM Projects WHERE goal_id = ? ORDER BY project_id ASC`,
      [goalId]
    );
    const projectIds = projects.map((p) => p.project_id);
    let milestones = [];
    let projectResources = [];
    if (projectIds.length) {
      const ph = projectIds.map(() => '?').join(',');
      const [mRows] = await pool.query(
        `SELECT milestone_id, project_id, title, description, target_date, is_completed, completed_at, created_at, updated_at
         FROM Milestones WHERE project_id IN (${ph}) ORDER BY target_date IS NULL, target_date ASC, milestone_id ASC`,
        projectIds
      );
      milestones = mRows;
      const [prRows] = await pool.query(
        `SELECT project_id, resource_id FROM ProjectResources WHERE project_id IN (${ph})`,
        projectIds
      );
      projectResources = prRows;
    }
    const [goalResources] = await pool.query(
      `SELECT gr.resource_id, r.title, r.description, r.url, r.image_path, r.category_id, r.is_ai_enabled
       FROM GoalResources gr
       JOIN Resources r ON r.resource_id = gr.resource_id
       WHERE gr.goal_id = ?`,
      [goalId]
    );

    const [[ratingAgg]] = await pool.query(
      `SELECT AVG(stars) AS avg_rating, COUNT(*) AS rating_count FROM GoalTemplateRatings WHERE template_goal_id = ?`,
      [goalId]
    );

    res.json({
      success: true,
      goal,
      projects,
      milestones,
      projectResources,
      goalResources,
      avg_rating: ratingAgg && ratingAgg.avg_rating != null ? Number(ratingAgg.avg_rating) : null,
      rating_count: ratingAgg ? Number(ratingAgg.rating_count) || 0 : 0
    });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/goal-templates/:goalId/publish', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.goalId);
    if (!goalId) return res.status(400).json({ error: 'Invalid goal id' });
    const pool = db.getPool();
    const [[row]] = await pool.query(
      `SELECT goal_id, template_kind FROM Goals WHERE goal_id = ? AND user_id = ? LIMIT 1`,
      [goalId, req.session.userId]
    );
    if (!row) return res.status(404).json({ error: 'Goal not found' });
    if (row.template_kind !== 'draft') {
      return res.status(400).json({ error: 'Only draft templates can be published' });
    }
    await pool.query(
      `UPDATE Goals SET template_kind = 'published', updated_at = CURRENT_TIMESTAMP WHERE goal_id = ?`,
      [goalId]
    );
    res.json({ success: true });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Copy a published goal-template into the current user's goals (personal goal) */
router.post('/goal-templates/:goalId/import', requireAuth, async (req, res) => {
  const pool = db.getPool();
  const conn = await pool.getConnection();
  try {
    const sourceGoalId = Number(req.params.goalId);
    if (!sourceGoalId) return res.status(400).json({ error: 'Invalid goal id' });

    const [[src]] = await pool.query(
      `SELECT goal_id, title, description, category, template_kind FROM Goals WHERE goal_id = ? LIMIT 1`,
      [sourceGoalId]
    );
    if (!src || src.template_kind !== 'published') {
      return res.status(404).json({ error: 'Published template not found' });
    }

    const [projects] = await pool.query(
      `SELECT project_id, title, description FROM Projects WHERE goal_id = ? ORDER BY project_id ASC`,
      [sourceGoalId]
    );
    const projectIds = projects.map((p) => p.project_id);
    let milestones = [];
    let projectResources = [];
    if (projectIds.length) {
      const ph = projectIds.map(() => '?').join(',');
      const [mRows] = await pool.query(
        `SELECT project_id, title, description, target_date FROM Milestones WHERE project_id IN (${ph})`,
        projectIds
      );
      milestones = mRows;
      const [prRows] = await pool.query(
        `SELECT project_id, resource_id FROM ProjectResources WHERE project_id IN (${ph})`,
        projectIds
      );
      projectResources = prRows;
    }
    const [goalResources] = await pool.query(
      `SELECT resource_id FROM GoalResources WHERE goal_id = ?`,
      [sourceGoalId]
    );

    await conn.beginTransaction();
    const [goalInsert] = await conn.query(
      `INSERT INTO Goals (user_id, title, description, category, target_date, status, template_kind, template_copied_count)
       VALUES (?, ?, ?, ?, NULL, 'active', 'none', 0)`,
      [req.session.userId, src.title, src.description || null, src.category || null]
    );
    const newGoalId = goalInsert.insertId;

    for (const row of goalResources) {
      await conn.query(`INSERT IGNORE INTO GoalResources (goal_id, resource_id) VALUES (?, ?)`, [newGoalId, row.resource_id]);
    }

    const idMap = new Map();
    for (const p of projects) {
      const [pIns] = await conn.query(
        `INSERT INTO Projects (goal_id, title, description) VALUES (?, ?, ?)`,
        [newGoalId, p.title, p.description || null]
      );
      idMap.set(p.project_id, pIns.insertId);
    }
    for (const m of milestones) {
      const newPid = idMap.get(m.project_id);
      if (!newPid) continue;
      await conn.query(
        `INSERT INTO Milestones (project_id, title, description, target_date, is_completed)
         VALUES (?, ?, ?, ?, 0)`,
        [newPid, m.title, m.description || null, m.target_date || null]
      );
    }
    for (const pr of projectResources) {
      const newPid = idMap.get(pr.project_id);
      if (!newPid) continue;
      await conn.query(`INSERT IGNORE INTO ProjectResources (project_id, resource_id) VALUES (?, ?)`, [
        newPid,
        pr.resource_id
      ]);
    }

    await conn.query(
      `UPDATE Goals SET template_copied_count = template_copied_count + 1 WHERE goal_id = ?`,
      [sourceGoalId]
    );
    await conn.commit();
    res.status(201).json({ success: true, goal_id: newGoalId });
  } catch (_err) {
    try {
      await conn.rollback();
    } catch (_) {
      // ignore
    }
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

module.exports = router;
