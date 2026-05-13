const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/workflows/public', async (_req, res) => {
  try {
    const [rows] = await db.getPool().query(
      `SELECT w.workflow_id, w.title, w.description, w.category, w.skill_area, w.steps, w.is_ai_enabled, w.created_at,
              u.username AS author
       FROM Workflows w
       LEFT JOIN Users u ON u.user_id = w.created_by
       WHERE w.is_public = 1 AND w.is_published = 1
       ORDER BY w.created_at DESC`
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/community/workflows', async (_req, res) => {
  try {
    const [rows] = await db.getPool().query(
      `SELECT w.workflow_id, w.title, w.description, w.category, w.skill_area, w.steps, w.is_ai_enabled, w.created_at,
              u.username AS author
       FROM Workflows w
       LEFT JOIN Users u ON u.user_id = w.created_by
       WHERE w.is_public = 1 AND w.is_published = 1
       ORDER BY w.created_at DESC`
    );
    res.json({ success: true, results: rows });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/workflows', requireAuth, async (req, res) => {
  try {
    const { title, description, category, skill_area, steps, is_public, is_ai_enabled } = req.body || {};
    const titleStr = String(title || '').trim();
    const stepsStr = String(steps || '').trim();
    if (titleStr.length < 3) {
      return res.status(400).json({ error: 'Validation failed', details: ['title must be at least 3 chars'] });
    }
    if (stepsStr.length < 5) {
      return res.status(400).json({ error: 'Validation failed', details: ['steps must be at least 5 chars'] });
    }
    const [result] = await db.getPool().query(
      `INSERT INTO Workflows
       (title, description, category, skill_area, steps, is_public, is_published, is_ai_enabled, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        titleStr,
        description ? String(description).trim() : null,
        category ? String(category).trim().toLowerCase() : null,
        skill_area ? String(skill_area).trim().toLowerCase() : null,
        stepsStr,
        is_public ? 1 : 0,
        is_ai_enabled ? 1 : 0,
        req.session.userId
      ]
    );
    res.status(201).json({ success: true, workflow_id: result.insertId });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
