/**
 * Why:
 *   We need a way to get all the nessarcy information about a specific 
 *   user. Having a reusable model file like this simplifies and removes
 *   any duplicated logic on attaining user info. All the commonly used logic 
 *   for user operations are here.
 *
 * What:
 *   What this file provides is a very simple and small data access helper for
 *   attaining Users table records.
 *
 * Where used:
 *   This file is referenced/imported anywhere where a user lookup by id is needed
 *
 * Notes:
 *   - This is a very small model layer.
 *   - The table it touches: 
 *        Users.
 */

const db = require('../db/connection');

async function findById(userId) {
  const [rows] = await db.getPool().query(
    'SELECT user_id, email, username, role, created_at FROM Users WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

module.exports = { findById };
