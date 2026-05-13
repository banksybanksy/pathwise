/**
 * Why:
 *   This file is needed so elevated actions to faculty/staff is either 
 *   restricted or allowed depending on the role.
 *
 * What:
 *   The express middleware gets teh current user role from the database
 *   and only gives the user a priviledged access if the role is in the 
 *   allowed list.
 *
 * Where used:
 *   This file is used by routes that require role verification/autherization
 *   such as faculty/staff metadata updates (the AI-tag)
 *
 * Notes:
 *   - This should only run after the session middleware is run
 *   - Also, it requires the re.session.userId to be valid/present
 *   - The table it touches: 
 *        Users
 *   
 */

const db = require('../db/connection');

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.session || req.session.userId == null) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
      const [rows] = await db.getPool().query('SELECT role FROM Users WHERE user_id = ? LIMIT 1', [
        req.session.userId
      ]);
      if (!rows.length) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
      }
      const role = rows[0].role || 'student';
      req.userRole = role;
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, error: 'This action requires elevated permissions.' });
      }
      next();
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
}

module.exports = { requireRole };
