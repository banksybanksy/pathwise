/**
 * Why:
 *   In constrast to requireRole, this middleware is meant to protect routes
 *   so whatever they are accessing is only accessable by logged-in users. 
 *   Also it requires an active session with a userId that are set by 
 *   either 'POST /api/login or POST /api/register'
 *
 * What:
 *   This middleware file basically checks for a active session with userId
 *   and prevents an unauthenticated requests from passing by sending 401 JSON.
 *
 * Where used:
 *   This is file is imported/used by routes such as goals, projects, milestones,
 *   bookmarks, profile, reflections, messages, and dashboard that need to check
 *   if the user is authenticated before those services can be allowed to be used.
 *
 * Notes:
 *   - This file basically assumes that the express session is configured in
 *     server.js
 *   - Since it does not load any data, it doesn't touch the database.
 *     It only checks if the session exists.
 *  
 */

function requireAuth(req, res, next) {
  if (!req.session || req.session.userId == null) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  next();
}

module.exports = { requireAuth };
