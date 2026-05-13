/**
 * Why:
 *   This file is meant to support the project execution workflow by allowing users to 
 *   finish each of their projects in chunk which we call milestones that serves as the 
 *   checkpoints to progress through.
 *
 * What:
 *   It defines the protected routes that fetch to list milestones, create them, update
 *   them, delete them as well as marking their status as completed for milestones owned
 *   by the user.
 *
 * Where used:
 *   It is mounted under '/api' in server.js
 *   It is called by vertical-prototype/js/goal-detail.js
 *
 * Notes:
 *   - It expects an authenticated session
 *   - Owenership is verified/enforced by joining Milestones -> Projects -> Goals -> user
 *   - The table it touches: 
 *        Milestones, 
 *        Projects, 
 *        Goals
 *   - Log activity occurs here
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');
const { logActivity } = require('../services/activityLog');

const router = express.Router();

router.get('/projects/:projectId/milestones', requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const [rows] = await db.getPool().query(
      `SELECT m.milestone_id, m.project_id, m.title, m.description, m.target_date, m.is_completed, m.completed_at, m.created_at, m.updated_at
       FROM Milestones m
       JOIN Projects p ON p.project_id = m.project_id
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE m.project_id = ? AND g.user_id = ?
       ORDER BY m.target_date IS NULL, m.target_date ASC, m.created_at ASC`,
      [projectId, req.session.userId]
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/projects/:projectId/milestones', requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { title, description, target_date } = req.body || {};
    if (!projectId || !title) return res.status(400).json({ success: false, error: 'projectId and title required' });
    const [projects] = await db.getPool().query(
      `SELECT p.project_id FROM Projects p
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE p.project_id = ? AND g.user_id = ?`,
      [projectId, req.session.userId]
    );
    if (!projects.length) return res.status(404).json({ success: false, error: 'Project not found' });
    const [result] = await db.getPool().query(
      `INSERT INTO Milestones (project_id, title, description, target_date, is_completed)
       VALUES (?, ?, ?, ?, 0)`,
      [projectId, String(title).trim(), description || null, target_date || null]
    );
    res.status(201).json({ success: true, milestone_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/milestones/:id/completion', requireAuth, async (req, res) => {
  try {
    const milestoneId = Number(req.params.id);
    const isCompleted = Boolean((req.body || {}).is_completed);
    if (!milestoneId) return res.status(400).json({ success: false, error: 'Invalid milestone id' });
    const [result] = await db.getPool().query(
      `UPDATE Milestones m
       JOIN Projects p ON p.project_id = m.project_id
       JOIN Goals g ON g.goal_id = p.goal_id
       SET m.is_completed = ?, m.completed_at = IF(? = 1, CURRENT_TIMESTAMP, NULL), m.updated_at = CURRENT_TIMESTAMP
       WHERE m.milestone_id = ? AND g.user_id = ?`,
      [isCompleted ? 1 : 0, isCompleted ? 1 : 0, milestoneId, req.session.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Milestone not found' });
    if (isCompleted) {
      await logActivity({
        userId: req.session.userId,
        actionType: 'milestone_completed',
        entityType: 'milestone',
        entityId: milestoneId
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/milestones/:id', requireAuth, async (req, res) => {
  try {
    const milestoneId = Number(req.params.id);
    const { title, description, target_date } = req.body || {};
    if (!milestoneId || !title) return res.status(400).json({ success: false, error: 'milestone id and title required' });
    const [result] = await db.getPool().query(
      `UPDATE Milestones m
       JOIN Projects p ON p.project_id = m.project_id
       JOIN Goals g ON g.goal_id = p.goal_id
       SET m.title = ?, m.description = ?, m.target_date = ?, m.updated_at = CURRENT_TIMESTAMP
       WHERE m.milestone_id = ? AND g.user_id = ?`,
      [String(title).trim(), description || null, target_date || null, milestoneId, req.session.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Milestone not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/milestones/:id', requireAuth, async (req, res) => {
  try {
    const milestoneId = Number(req.params.id);
    if (!milestoneId) return res.status(400).json({ success: false, error: 'Invalid milestone id' });
    const [result] = await db.getPool().query(
      `DELETE m FROM Milestones m
       JOIN Projects p ON p.project_id = m.project_id
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE m.milestone_id = ? AND g.user_id = ?`,
      [milestoneId, req.session.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Milestone not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
