const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

const VALID_TYPES = new Set(['resource', 'template', 'workflow', 'goal_template']);

async function itemExists(pool, itemType, itemId, senderUserId) {
  if (itemType === 'resource') {
    const [rows] = await pool.query(
      `SELECT resource_id AS id
       FROM Resources
       WHERE resource_id = ?
         AND (
           (visibility = 'public' AND moderation_status = 'approved')
           OR submitted_by = ?
         ) LIMIT 1`,
      [itemId, senderUserId]
    );
    return rows.length > 0;
  }
  if (itemType === 'template') {
    const [rows] = await pool.query(
      `SELECT template_id AS id
       FROM CommunityTemplates
       WHERE template_id = ? AND (is_public = 1 OR created_by = ?) LIMIT 1`,
      [itemId, senderUserId]
    );
    return rows.length > 0;
  }
  if (itemType === 'goal_template') {
    const [rows] = await pool.query(
      `SELECT goal_id AS id FROM Goals
       WHERE goal_id = ? AND (
         template_kind = 'published'
         OR (user_id = ? AND template_kind IN ('draft','published'))
       ) LIMIT 1`,
      [itemId, senderUserId]
    );
    return rows.length > 0;
  }
  if (itemType === 'workflow') {
    const [rows] = await pool.query(
      `SELECT workflow_id AS id
       FROM Workflows
       WHERE workflow_id = ? AND (is_public = 1 OR created_by = ?) LIMIT 1`,
      [itemId, senderUserId]
    );
    return rows.length > 0;
  }
  return false;
}

router.post('/shares', requireAuth, async (req, res) => {
  try {
    const senderUserId = req.session.userId;
    const recipientUserId = Number(req.body?.recipientUserId);
    const itemType = String(req.body?.itemType || '').toLowerCase();
    const itemId = Number(req.body?.itemId);
    const message = req.body?.message ? String(req.body.message).trim().slice(0, 500) : null;

    if (!recipientUserId || !itemId || !VALID_TYPES.has(itemType)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['recipientUserId, itemType(resource|template|workflow|goal_template), and itemId are required']
      });
    }
    if (recipientUserId === senderUserId) {
      return res.status(400).json({ error: 'Validation failed', details: ['cannot share to self'] });
    }

    const pool = db.getPool();
    const [[recipient]] = await pool.query('SELECT user_id FROM Users WHERE user_id = ? LIMIT 1', [recipientUserId]);
    if (!recipient) return res.status(404).json({ error: 'Recipient user not found' });

    const exists = await itemExists(pool, itemType, itemId, senderUserId);
    if (!exists) return res.status(404).json({ error: 'Shared item not found or not authorized' });

    const [result] = await pool.query(
      `INSERT INTO Shares (sender_user_id, recipient_user_id, item_type, item_id, message)
       VALUES (?, ?, ?, ?, ?)`,
      [senderUserId, recipientUserId, itemType, itemId, message]
    );
    res.status(201).json({ success: true, share_id: result.insertId });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/shares/received', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.getPool().query(
      `SELECT s.share_id, s.item_type, s.item_id, s.message, s.created_at,
              u.user_id AS sender_user_id, u.username AS sender_username
       FROM Shares s
       JOIN Users u ON u.user_id = s.sender_user_id
       WHERE s.recipient_user_id = ?
       ORDER BY s.created_at DESC`,
      [req.session.userId]
    );
    res.json({ success: true, results: rows });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/shares/sent', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.getPool().query(
      `SELECT s.share_id, s.item_type, s.item_id, s.message, s.created_at,
              u.user_id AS recipient_user_id, u.username AS recipient_username
       FROM Shares s
       JOIN Users u ON u.user_id = s.recipient_user_id
       WHERE s.sender_user_id = ?
       ORDER BY s.created_at DESC`,
      [req.session.userId]
    );
    res.json({ success: true, results: rows });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
