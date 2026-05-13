/**
 * Why:
 *   Unlike activityLog.js, this file is meant to retrieve user activity so it can be
 *   be exposed on their profile that basically show a lightweight audit trail of what
 *   they have done (really only on meaningful changes)
 *
 * What:
 *   It defines the toute that simply returns ActivityLogs for the current user in the
 *   order the activities occured. We also added result limit just so not all activity are
 *   shown to not mess up user exprience
 *
 * Where used:
 *   It is mounted under '/api' in server.js
 *   It is called by vertical-prototype/js/profile.js for the Recent activity section only
 *
 * Notes:
 *   - It expects an authenticated session
 *   - The table it touches: 
 *        ActivityLogs.
 *   - Like mentioned above, we limit the response server-side as to not output long
 *     activity trails
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/activity', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const [rows] = await db.getPool().query(
      `SELECT log_id, action_type, entity_type, entity_id, detail, created_at
       FROM ActivityLogs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [req.session.userId, limit]
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
