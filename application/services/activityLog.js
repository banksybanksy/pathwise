/**
 * Why:
 *   This file is meant to record user activity within the platforms accross important 
 *   pages without us having to insert a duplicated logic in the route files.
 *
 * What:
 *   It takes in the action, entity, the id of the user as well as details to update their
 *   activity log and then export them.
 *
 * Where used:
 *   It is called by the routes we decided were meaningful enough to track such as goals, 
 *   bookmarks, milestones and the reflection although we can add more such as messages 
 *   and others.
 *
 * Notes:
 *   - Failures are intentionally logged
 *   - The table it touches: 
 *        ActivityLogs
 *   - This helps the routes remain consistent and clear
 */

const db = require('../db/connection');

async function logActivity({ userId, actionType, entityType = null, entityId = null, detail = null }) {
  try {
    const pool = db.getPool();
    const detailStr =
      detail == null ? null : typeof detail === 'string' ? detail : JSON.stringify(detail);
    await pool.query(
      `INSERT INTO ActivityLogs (user_id, action_type, entity_type, entity_id, detail)
       VALUES (?, ?, ?, ?, ?)`,
      [userId || null, actionType, entityType, entityId, detailStr]
    );
  } catch (err) {
    console.warn('[activityLog]', err.message);
  }
}

module.exports = { logActivity };
