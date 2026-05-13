/**
 * Why:
 *   This file is meant to support the middle layer between Goal and Milestone structure
 *   that will be used throughout the platform planning workflow
 *
 * What:
 *   It defines the routes for listing the projects for specific goal, creating new 
 *   projects, updating them, and deleting them. There is also a route for users to be 
 *   able to attach materials to their projects.
 *
 * Where used:
 *   It is mounted under '/api' in server.js
 *   It is called by vertical-prototype/js/goal-detail.js
 *
 * Notes:
 *   - It expects an authenticated session
 *   - Owenership is verified/enforced by joining Projects -> Goals -> user.
 *   - The table it touches: 
 *        Projects, 
 *        Goals, 
 *        ProjectResources.
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/goals/:goalId/projects', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.goalId);
    const [rows] = await db.getPool().query(
      `SELECT p.project_id, p.goal_id, p.title, p.description, p.created_at, p.updated_at
       FROM Projects p
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE p.goal_id = ? AND g.user_id = ?
       ORDER BY p.updated_at DESC`,
      [goalId, req.session.userId]
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/goals/:goalId/projects', requireAuth, async (req, res) => {
  try {
    const goalId = Number(req.params.goalId);
    const { title, description } = req.body || {};
    if (!goalId || !title) return res.status(400).json({ success: false, error: 'goalId and title required' });
    const [goals] = await db.getPool().query('SELECT goal_id FROM Goals WHERE goal_id = ? AND user_id = ?', [
      goalId,
      req.session.userId
    ]);
    if (!goals.length) return res.status(404).json({ success: false, error: 'Goal not found' });
    const [result] = await db.getPool().query(
      'INSERT INTO Projects (goal_id, title, description) VALUES (?, ?, ?)',
      [goalId, String(title).trim(), description || null]
    );
    res.status(201).json({ success: true, project_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/projects/:id', requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const { title, description } = req.body || {};
    if (!projectId || !title) return res.status(400).json({ success: false, error: 'projectId and title required' });
    const [result] = await db.getPool().query(
      `UPDATE Projects p
       JOIN Goals g ON g.goal_id = p.goal_id
       SET p.title = ?, p.description = ?, p.updated_at = CURRENT_TIMESTAMP
       WHERE p.project_id = ? AND g.user_id = ?`,
      [String(title).trim(), description || null, projectId, req.session.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/projects/:id', requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    if (!projectId) return res.status(400).json({ success: false, error: 'Invalid project id' });
    const [result] = await db.getPool().query(
      `DELETE p FROM Projects p
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE p.project_id = ? AND g.user_id = ?`,
      [projectId, req.session.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/projects/:id/resources', requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const resourceId = Number((req.body || {}).resource_id);

    if (!projectId || !resourceId) {
      return res.status(400).json(
        { 
          success: false, 
          error: 'project id and resource_id required' 
        }
      );
    }

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
      return res.status(404).json({
        success: false,
        error: 'Resource not found or not attachable'
      });
    }

    const [projects] = await db.getPool().query(
      `SELECT p.project_id
       FROM Projects p JOIN Goals g ON g.goal_id = p.goal_id
       WHERE p.project_id = ? AND g.user_id = ?`,
      [projectId, req.session.userId]
    );

    if (!projects.length) {
      return res.status(404).json(
        { 
          success: false, 
          error: 'Project not found' 
        }
      );
    }

    await db.getPool().query('INSERT IGNORE INTO ProjectResources (project_id, resource_id) VALUES (?, ?)', [projectId, resourceId]);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/projects/:id/workflows', requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const workflowId = Number((req.body || {}).workflow_id);
    if (!projectId || !workflowId) {
      return res.status(400).json({ error: 'Validation failed', details: ['project id and workflow_id required'] });
    }
    const pool = db.getPool();
    const [[project]] = await pool.query(
      `SELECT p.project_id
       FROM Projects p
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE p.project_id = ? AND g.user_id = ?
       LIMIT 1`,
      [projectId, req.session.userId]
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const [[workflow]] = await pool.query(
      `SELECT workflow_id
       FROM Workflows
       WHERE workflow_id = ? AND (is_public = 1 OR created_by = ?)
       LIMIT 1`,
      [workflowId, req.session.userId]
    );
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    await pool.query('INSERT IGNORE INTO ProjectWorkflowLinks (project_id, workflow_id) VALUES (?, ?)', [projectId, workflowId]);
    res.status(201).json({ success: true });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/projects/:projectId/attachments', requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: 'Validation failed', details: ['Invalid project id'] });
    const pool = db.getPool();
    const [[project]] = await pool.query(
      `SELECT p.project_id
       FROM Projects p
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE p.project_id = ? AND g.user_id = ?
       LIMIT 1`,
      [projectId, req.session.userId]
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [resources] = await pool.query(
      `SELECT r.resource_id AS id, 'resource' AS type, r.title, r.description, c.category_name AS category,
              r.is_ai_enabled AS ai_enabled, r.image_path AS image, r.url, pr.created_at AS attachedAt
       FROM ProjectResources pr
       JOIN Resources r ON r.resource_id = pr.resource_id
       LEFT JOIN Categories c ON c.category_id = r.category_id
       WHERE pr.project_id = ?`,
      [projectId]
    );
    for (const r of resources) r.tags = [];

    const [workflows] = await pool.query(
      `SELECT w.workflow_id AS id, 'workflow' AS type, w.title, w.description, w.category,
              w.is_ai_enabled AS ai_enabled, NULL AS image, NULL AS url, pw.created_at AS attachedAt
       FROM ProjectWorkflowLinks pw
       JOIN Workflows w ON w.workflow_id = pw.workflow_id
       WHERE pw.project_id = ?`,
      [projectId]
    );
    for (const w of workflows) w.tags = [];

    res.json({ success: true, results: [...resources, ...workflows] });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
