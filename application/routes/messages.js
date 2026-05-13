/**
 * Why:
 *   This file is meant to enable communication between registered users in-site without 
 *   having to go to a different platform to communicate to one another.
 *
 * What:
 *   It defines routes that allows users to view their inbox, loading a messaging thread
 *   between them and someone else and as well as sending new messages.
 *
 * Where used:
 *   It is mounted under '/api' in server.js.
 *   It is called by vertical-prototype/js/messages.js
 *
 * Notes:
 *   - It expects an authenticated session
 *   - The table it touches: 
 *        Messages, 
 *        Users
 *   - Upon a thread being opened, its marked as read
 * 
 * TODO:
 *   - Maybe we improve the interface, it could be better if we format it as a typcial
 *     familiar messaging layout 
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/messages/inbox', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.getPool().query(
      `SELECT m.message_id, m.from_user_id, m.to_user_id, m.body, m.read_at, m.created_at,
              u.username AS from_username
       FROM Messages m
       JOIN Users u ON u.user_id = m.from_user_id
       WHERE m.to_user_id = ?
       ORDER BY m.created_at DESC`,
      [req.session.userId]
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/messages/thread/:otherUserId', requireAuth, async (req, res) => {
  try {
    const other = Number(req.params.otherUserId);
    if (!other || other === req.session.userId) {
      return res.status(400).json({ success: false, error: 'Invalid user' });
    }
    const me = req.session.userId;
    const [rows] = await db.getPool().query(
      `SELECT message_id, from_user_id, to_user_id, body, read_at, created_at
       FROM Messages
       WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
       ORDER BY created_at ASC`,
      [me, other, other, me]
    );
    await db.getPool().query(
      `UPDATE Messages SET read_at = CURRENT_TIMESTAMP
       WHERE to_user_id = ? AND from_user_id = ? AND read_at IS NULL`,
      [me, other]
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/messages', requireAuth, async (req, res) => {
  try {
    const { to_user_id: toRaw, body } = req.body || {};
    const toId = parseInt(toRaw, 10);
    const text = body != null ? String(body).trim() : '';
    if (Number.isNaN(toId) || toId < 1 || toId === req.session.userId) {
      return res.status(400).json({ success: false, error: 'to_user_id required' });
    }
    if (text.length < 1) {
      return res.status(400).json({ success: false, error: 'body is required' });
    }
    const pool = db.getPool();
    const [u] = await pool.query('SELECT user_id FROM Users WHERE user_id = ? LIMIT 1', [toId]);
    if (!u.length) return res.status(404).json({ success: false, error: 'Recipient not found' });

    const [result] = await pool.query(
      `INSERT INTO Messages (from_user_id, to_user_id, body) VALUES (?, ?, ?)`,
      [req.session.userId, toId, text]
    );
    res.status(201).json({ success: true, message_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
