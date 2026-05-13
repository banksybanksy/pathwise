const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

function resolveRange(range) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  if (range === 'weekly') {
    start.setDate(start.getDate() - 7);
  } else if (range === 'monthly') {
    start.setMonth(start.getMonth() - 1);
  } else if (range === 'semester') {
    start.setMonth(start.getMonth() - 4);
  } else {
    return null;
  }
  return { start, end };
}

router.get('/reports/summary', requireAuth, async (req, res) => {
  try {
    const range = String(req.query.range || 'weekly').toLowerCase();
    const window = resolveRange(range);
    if (!window) {
      return res.status(400).json({ error: 'Validation failed', details: ['range must be weekly, monthly, or semester'] });
    }
    const pool = db.getPool();
    const userId = req.session.userId;
    const from = window.start.toISOString().slice(0, 19).replace('T', ' ');
    const to = window.end.toISOString().slice(0, 19).replace('T', ' ');

    const [[goalAgg]] = await pool.query(
      `SELECT
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedGoals,
         SUM(CASE WHEN status IN ('active', 'paused') THEN 1 ELSE 0 END) AS activeGoals
       FROM Goals
       WHERE user_id = ?
         AND updated_at BETWEEN ? AND ?`,
      [userId, from, to]
    );

    const [[milestoneAgg]] = await pool.query(
      `SELECT
         SUM(CASE WHEN m.is_completed = 1 THEN 1 ELSE 0 END) AS completedMilestones,
         SUM(CASE WHEN m.is_completed = 0 THEN 1 ELSE 0 END) AS pendingMilestones
       FROM Milestones m
       JOIN Projects p ON p.project_id = m.project_id
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE g.user_id = ?
         AND m.updated_at BETWEEN ? AND ?`,
      [userId, from, to]
    );

    const [[reflections]] = await pool.query(
      `SELECT COUNT(*) AS reflectionsCount
       FROM Reflections
       WHERE user_id = ?
         AND created_at BETWEEN ? AND ?`,
      [userId, from, to]
    );

    const [[saved]] = await pool.query(
      `SELECT COUNT(*) AS resourcesSaved
       FROM Bookmarks
       WHERE user_id = ?
         AND created_at BETWEEN ? AND ?`,
      [userId, from, to]
    );

    const [[activity]] = await pool.query(
      `SELECT COUNT(*) AS activityCount
       FROM ActivityLogs
       WHERE user_id = ?
         AND created_at BETWEEN ? AND ?`,
      [userId, from, to]
    );

    const [recentHighlights] = await pool.query(
      `SELECT action_type, entity_type, entity_id, detail, created_at
       FROM ActivityLogs
       WHERE user_id = ?
         AND created_at BETWEEN ? AND ?
       ORDER BY created_at DESC
       LIMIT 8`,
      [userId, from, to]
    );

    res.json({
      success: true,
      range,
      from,
      to,
      completedGoals: Number(goalAgg?.completedGoals || 0),
      activeGoals: Number(goalAgg?.activeGoals || 0),
      completedMilestones: Number(milestoneAgg?.completedMilestones || 0),
      pendingMilestones: Number(milestoneAgg?.pendingMilestones || 0),
      reflectionsCount: Number(reflections?.reflectionsCount || 0),
      resourcesSaved: Number(saved?.resourcesSaved || 0),
      activityCount: Number(activity?.activityCount || 0),
      recentHighlights
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
