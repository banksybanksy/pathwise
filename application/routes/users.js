/**
 * Why:
 *   This file is meant to help with user lookup in the messaging page so a logged in 
 *   user can locate another verified user by their username (or through their email).
 *
 * What:
 *   It defines a very simple search route that returns matching user based on the give
 *   request. Its lightweight and protected.
 *
 * Where used:
 *   It is mounted under '/api' in server.js
 *   Its called by vertical-prototype/js/messages.js
 *
 * Notes:
 *   - It expects an authenticated session
 *   - Table it touches: 
 *       Users
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/users/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim().slice(0, 50);
    if (q.length < 2) {
      return res.json({ success: true, results: [] });
    }
    const like = `%${q}%`;
    const [rows] = await db.getPool().query(
      `SELECT user_id, username FROM Users
       WHERE user_id != ? AND (username LIKE ? OR email LIKE ?)
       ORDER BY username ASC
       LIMIT 15`,
      [req.session.userId, like, like]
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
