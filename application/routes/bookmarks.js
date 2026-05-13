/**
 * Why:
 *   This file is meant to support the workflow for saved resources where users can 
 *   Bookmark useful materials and come later to access them through mainly the bookmarks
 *   page although they can also do so through their profile and dashbaord.
 *
 * What:
 *   It defines the routes for fetching user's saved resources, adding new ones, or even
 *   removing them by dropping them. The user needs to be logged in to save resources
 *   so they can be attached to a user.
 *
 * Where used:
 *   - It is mounted under '/api' in server.js.
 *   - It is called by vertical-prototype/js/bookmarks.js, 
 *     resource.js (to bookmark a material), 
 *     profile.js (so the bookmarked materials can be shown),
 *     and dashboard.js (same as in profile.js).
 *
 * Notes:
 *   - It expects an authenticated session
 *   - The table it touches: 
 *        Bookmarks, 
 *        Resources.
 *   - Log activity occurs here when a resource is saved (newly)
 *   - In POST body: { resource_id, action?: 'add' | 'remove' } the default action is add
 *     so a material is bookmarked before it can be removed
 *   - Aliases: GET/POST /saved-resources (They are same thing).
 *     Bookmarked are those that are saved resources and vice-versa
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');
const { logActivity } = require('../services/activityLog');

const router = express.Router();

async function listSavedResources(req, res) {
  try {
    const pool = db.getPool();
    const [rows] = await pool.query(
      `SELECT r.resource_id, r.title, r.description, r.url, r.category_id, r.image_path, r.cost,
              b.created_at AS bookmarked_at
       FROM Bookmarks b
       JOIN Resources r ON r.resource_id = b.resource_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [req.session.userId]
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function mutateSavedResource(req, res) {
  try {
    const { resource_id: ridRaw, action } = req.body || {};
    const resourceId = parseInt(ridRaw, 10);
    if (Number.isNaN(resourceId) || resourceId < 1) {
      return res.status(400).json({ success: false, error: 'resource_id is required' });
    }

    const act = action === 'remove' || action === 'unsave' || action === 'delete' ? 'remove' : 'add';

    const pool = db.getPool();
    const [exists] = await pool.query('SELECT resource_id FROM Resources WHERE resource_id = ? LIMIT 1', [
      resourceId
    ]);
    if (!exists.length) {
      return res.status(404).json({ success: false, error: 'Resource not found' });
    }

    if (act === 'remove') {
      await pool.query('DELETE FROM Bookmarks WHERE user_id = ? AND resource_id = ?', [
        req.session.userId,
        resourceId
      ]);
      return res.json({ success: true, saved: false });
    }

    const [ins] = await pool.query('INSERT IGNORE INTO Bookmarks (user_id, resource_id) VALUES (?, ?)', [
      req.session.userId,
      resourceId
    ]);
    if (ins.affectedRows > 0) {
      await logActivity({
        userId: req.session.userId,
        actionType: 'resource_saved',
        entityType: 'resource',
        entityId: resourceId
      });
    }
    res.json({ success: true, saved: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

router.get('/bookmarks', requireAuth, listSavedResources);
router.post('/bookmarks', requireAuth, mutateSavedResource);
router.get('/saved-resources', requireAuth, listSavedResources);
router.post('/saved-resources', requireAuth, mutateSavedResource);

module.exports = router;
