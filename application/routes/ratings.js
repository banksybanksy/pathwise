/**
 * Why:
 *   This file helps users to be able to rate materials whether that be resources or 
 *   templates. So pathwise can priortize on showing the high quality portions first and
 *   imporve on material selection confidence.
 *
 * What:
 *   It defines the routes for submitting rating for both templates and resources as well
 *   fetching the ratings to perform rating statstics for each. The user has to be logged
 *   in to be able to do so in the first place.
 *
 * Where used:
 *   It is mounted under '/api' in server.js
 *   it is called by vertical-prototype/resource.js
 *
 * Notes:
 *   - POST expects an authenticated session; 
 *     GET simply doesn't.
 *   - The table it touches: 
 *        ResourceRatings, 
 *        Resources
 *   - The staring system is from 1-5 although we can make out of 10 for more precise
 *     stastical computation to differentiate quality among all materials.
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.post('/resources/:id/rating', requireAuth, async (req, res) => {
  try {
    const resourceId = parseInt(req.params.id, 10);
    const stars = parseInt((req.body || {}).stars, 10);
    if (Number.isNaN(resourceId) || resourceId < 1) {
      return res.status(400).json({ success: false, error: 'Invalid resource id' });
    }
    if (Number.isNaN(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ success: false, error: 'stars must be 1–5' });
    }
    const pool = db.getPool();
    const [exists] = await pool.query('SELECT resource_id FROM Resources WHERE resource_id = ? LIMIT 1', [
      resourceId
    ]);
    if (!exists.length) return res.status(404).json({ success: false, error: 'Resource not found' });

    await pool.query(
      `INSERT INTO ResourceRatings (user_id, resource_id, stars)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stars = VALUES(stars), updated_at = CURRENT_TIMESTAMP`,
      [req.session.userId, resourceId, stars]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/resources/:id/ratings', async (req, res) => {
  try {
    const resourceId = parseInt(req.params.id, 10);
    if (Number.isNaN(resourceId) || resourceId < 1) {
      return res.status(400).json({ success: false, error: 'Invalid resource id' });
    }
    const [agg] = await db.getPool().query(
      `SELECT AVG(stars) AS avg_stars, COUNT(*) AS count FROM ResourceRatings WHERE resource_id = ?`,
      [resourceId]
    );
    const row = agg[0] || {};
    res.json({
      success: true,
      avg_stars: row.avg_stars != null ? Number(row.avg_stars) : null,
      count: row.count != null ? Number(row.count) : 0
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/goals/:id/template-rating', requireAuth, async (req, res) => {
  try {
    const templateGoalId = parseInt(req.params.id, 10);
    const stars = parseInt((req.body || {}).stars, 10);
    if (Number.isNaN(templateGoalId) || templateGoalId < 1) {
      return res.status(400).json({ success: false, error: 'Invalid goal template id' });
    }
    if (Number.isNaN(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ success: false, error: 'stars must be 1–5' });
    }
    const pool = db.getPool();
    const [[g]] = await pool.query(
      `SELECT goal_id FROM Goals WHERE goal_id = ? AND template_kind = 'published' LIMIT 1`,
      [templateGoalId]
    );
    if (!g) return res.status(404).json({ success: false, error: 'Published template not found' });

    await pool.query(
      `INSERT INTO GoalTemplateRatings (user_id, template_goal_id, stars)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stars = VALUES(stars), updated_at = CURRENT_TIMESTAMP`,
      [req.session.userId, templateGoalId, stars]
    );
    res.json({ success: true });
  } catch (err) {
    if (String(err.message || '').includes('GoalTemplateRatings')) {
      return res.status(500).json({ success: false, error: 'Template ratings require migration 011' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/goals/:id/template-ratings', async (req, res) => {
  try {
    const templateGoalId = parseInt(req.params.id, 10);
    if (Number.isNaN(templateGoalId) || templateGoalId < 1) {
      return res.status(400).json({ success: false, error: 'Invalid goal template id' });
    }
    const [agg] = await db.getPool().query(
      `SELECT AVG(stars) AS avg_stars, COUNT(*) AS count FROM GoalTemplateRatings WHERE template_goal_id = ?`,
      [templateGoalId]
    );
    const row = agg[0] || {};
    res.json({
      success: true,
      avg_stars: row.avg_stars != null ? Number(row.avg_stars) : null,
      count: row.count != null ? Number(row.count) : 0
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
