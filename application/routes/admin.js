/**
 * Admin-only: site stats, user directory, role changes, user removal.
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { logActivity } = require('../services/activityLog');

const router = express.Router();

const ROLES = new Set(['student', 'faculty', 'staff', 'admin']);

router.get('/admin/stats', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const pool = db.getPool();
    const [[{ c: totalUsers }]] = await pool.query('SELECT COUNT(*) AS c FROM Users');
    const [[{ c: totalResources }]] = await pool.query('SELECT COUNT(*) AS c FROM Resources');
    const [[{ c: pendingApprovals }]] = await pool.query(
      "SELECT COUNT(*) AS c FROM Resources WHERE moderation_status = 'pending'"
    );
    res.json({
      success: true,
      totalUsers: Number(totalUsers) || 0,
      totalResources: Number(totalResources) || 0,
      pendingApprovals: Number(pendingApprovals) || 0
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.getPool().query(
      `SELECT user_id, email, username, role, created_at
       FROM Users
       ORDER BY created_at ASC`
    );
    const users = rows.map((r) => ({
      user_id: r.user_id,
      email: r.email,
      username: r.username,
      name: r.username,
      role: r.role || 'student',
      created_at: r.created_at
    }));
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/admin/users/:userId/role', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const uid = parseInt(req.params.userId, 10);
    if (Number.isNaN(uid) || uid < 1) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }
    if (uid === req.session.userId) {
      return res.status(400).json({ success: false, error: 'Cannot change your own role here' });
    }
    const role = (req.body && req.body.role != null && String(req.body.role).toLowerCase()) || '';
    if (!ROLES.has(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const [result] = await db
      .getPool()
      .query('UPDATE Users SET role = ? WHERE user_id = ?', [role, uid]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    await logActivity({
      userId: req.session.userId,
      actionType: 'user_role_changed',
      entityType: 'user',
      entityId: uid,
      detail: { role }
    });
    res.json({ success: true, user_id: uid, role });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/admin/users/:userId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const uid = parseInt(req.params.userId, 10);
    if (Number.isNaN(uid) || uid < 1) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }
    if (uid === req.session.userId) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    const [result] = await db.getPool().query('DELETE FROM Users WHERE user_id = ?', [uid]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    await logActivity({
      userId: req.session.userId,
      actionType: 'user_deleted',
      entityType: 'user',
      entityId: uid
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({ success: false, error: 'User cannot be removed while related data still exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
