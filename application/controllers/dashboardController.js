/**
 * Why:
 *   This is needed so we have a very clear centralized loading of data
 *   for the dashboard. Also in the case we need this logic to be usable 
 *   accross different parts of our program.
 *
 * What:
 *   It gets the goals, projects, milestones, and resources it saved for 
 *   a specified user from the database and returns them as single data objects.
 *
 * Where used:
 *   It is imported by routes/dashboard.js for its GET route
 *
 * Notes:
 *   - It expects the user it goes is authenticated
 *   - The table it touchess: 
 *         Goals, 
 *         Projects, 
 *         Milestones, 
 *         Bookmarks, 
 *         Resources.
 */

const db = require('../db/connection');

async function loadDashboardData(userId) {
  const pool = db.getPool();

  const [goals] = await pool.query(
    `SELECT goal_id, title, description, category, target_date, status, updated_at
     FROM Goals
     WHERE user_id = ? AND template_kind = 'none'
     ORDER BY updated_at DESC`,
    [userId]
  );
  const [projects] = await pool.query(
    `SELECT p.project_id, p.goal_id, p.title, p.description, p.updated_at
     FROM Projects p
     JOIN Goals g ON g.goal_id = p.goal_id
     WHERE g.user_id = ? AND g.template_kind = 'none'
     ORDER BY p.updated_at DESC`,
    [userId]
  );
  const [milestones] = await pool.query(
    `SELECT m.milestone_id, m.project_id, m.title, m.target_date, m.is_completed, m.updated_at
     FROM Milestones m
     JOIN Projects p ON p.project_id = m.project_id
     JOIN Goals g ON g.goal_id = p.goal_id
     WHERE g.user_id = ? AND g.template_kind = 'none'
     ORDER BY m.target_date IS NULL, m.target_date ASC`,
    [userId]
  );
  const [savedResources] = await pool.query(
    `SELECT r.resource_id, r.title, r.description, r.url, r.cost, b.created_at AS bookmarked_at
     FROM Bookmarks b
     JOIN Resources r ON r.resource_id = b.resource_id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC`,
    [userId]
  );

  return { goals, projects, milestones, savedResources };
}

module.exports = { loadDashboardData };
