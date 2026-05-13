/**
 * Why:
 *   This file is needed so students can record their reflective planning in a journal
 *   style notes that can also connect to their goals, projects and milestone.
 *
 * What:
 *   It defines the essential routes that deal with listing all the previous reflections,
 *   creating new ones, and deleting them. As well as allowing users to connect them to
 *   their goals.
 *
 * Where used:
 *   It is mounted under '/api/ in server.js
 *   It is called by vertical-prototype/js/reflections.js
 *
 * Notes:
 *   - It expects an authenticated session
 *   - The table it touches: 
 *        Reflections, 
 *        Goals, 
 *        Projects.
 *        Milestones,
 *        ReflectionGoals,
 *        ReflectionProjects,
 *        ReflectionMilestones.
 *   - It validates the goal/project attributed to the reflection belongs to the user
 *     themselves
 *   - Log activity occurs here when a new reflection is made
 * 
 * TODO:
 *   - The interface that enables the user to choose which goals or projects to link each
 *     of their reflection is based on id they have to input, but it should list out all 
 *     their goals and projects so its easy for them to link it
 *   - Also add a way to link to their milestone as well in addition to their goals and 
 *     projects
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');
const { logActivity } = require('../services/activityLog');

const router = express.Router();

// ------------------------------
function parseIdArray(value) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );
}

async function getOwnedGoalIds(pool, userId, goalIds) {
  if (goalIds.length === 0) return [];

  const [rows] = await pool.query(
    `SELECT goal_id
     FROM Goals
     WHERE user_id = ?
       AND goal_id IN (${goalIds.map(() => '?').join(',')})`,
    [userId, ...goalIds]
  );

  return rows.map((row) => row.goal_id);
}

async function getOwnedProjectIds(pool, userId, projectIds) {
  if (projectIds.length === 0) return [];

  const [rows] = await pool.query(
    `SELECT p.project_id
     FROM Projects p
     JOIN Goals g ON g.goal_id = p.goal_id
     WHERE g.user_id = ?
       AND p.project_id IN (${projectIds.map(() => '?').join(',')})`,
    [userId, ...projectIds]
  );

  return rows.map((row) => row.project_id);
}

async function getOwnedMilestoneIds(pool, userId, milestoneIds) {
  if (milestoneIds.length === 0) return [];

  const [rows] = await pool.query(
    `SELECT m.milestone_id
     FROM Milestones m
     JOIN Projects p ON p.project_id = m.project_id
     JOIN Goals g ON g.goal_id = p.goal_id
     WHERE g.user_id = ?
       AND m.milestone_id IN (${milestoneIds.map(() => '?').join(',')})`,
    [userId, ...milestoneIds]
  );

  return rows.map((row) => row.milestone_id);
}

function ownsAllRequestedIds(requested, owned) {
  if (requested.length !== owned.length) return false;
  const ownedSet = new Set(owned);
  return requested.every((id) => ownedSet.has(id));
}

async function insertReflectionLinks(conn, reflectionId, goalIds, projectIds, milestoneIds) {
  for (const goalId of goalIds) {
    await conn.query(
      `INSERT IGNORE INTO ReflectionGoals (reflection_id, goal_id)
       VALUES (?, ?)`,
      [reflectionId, goalId]
    );
  }

  for (const projectId of projectIds) {
    await conn.query(
      `INSERT IGNORE INTO ReflectionProjects (reflection_id, project_id)
       VALUES (?, ?)`,
      [reflectionId, projectId]
    );
  }

  for (const milestoneId of milestoneIds) {
    await conn.query(
      `INSERT IGNORE INTO ReflectionMilestones (reflection_id, milestone_id)
       VALUES (?, ?)`,
      [reflectionId, milestoneId]
    );
  }
}
// ------------------------------

async function assertGoalOwned(pool, userId, goalId) {
  if (!goalId) return true;
  const [g] = await pool.query('SELECT goal_id FROM Goals WHERE goal_id = ? AND user_id = ?', [
    goalId,
    userId
  ]);
  return g.length > 0;
}

async function assertProjectOwned(pool, userId, projectId) {
  if (!projectId) return true;
  const [p] = await pool.query(
    `SELECT p.project_id FROM Projects p
     JOIN Goals g ON g.goal_id = p.goal_id
     WHERE p.project_id = ? AND g.user_id = ?`,
    [projectId, userId]
  );
  return p.length > 0;
}

// --------------------------------------
router.get('/reflections/link-options', requireAuth, async (req, res) => {
  try {
    const pool = db.getPool();
    const userId = req.session.userId;

    const [goals] = await pool.query(
      `SELECT goal_id, title, category, status, target_date
       FROM Goals
       WHERE user_id = ? AND template_kind = 'none'
       ORDER BY updated_at DESC`,
      [userId]
    );

    const [projects] = await pool.query(
      `SELECT p.project_id, p.goal_id, p.title, p.description
       FROM Projects p
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE g.user_id = ?
       ORDER BY p.updated_at DESC`,
      [userId]
    );

    const [milestones] = await pool.query(
      `SELECT m.milestone_id, m.project_id, m.title, m.target_date, m.is_completed
       FROM Milestones m
       JOIN Projects p ON p.project_id = m.project_id
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE g.user_id = ?
       ORDER BY m.target_date IS NULL, m.target_date ASC, m.created_at ASC`,
      [userId]
    );

    const milestonesByProject = new Map();
    for (const milestone of milestones) {
      const list = milestonesByProject.get(milestone.project_id) || [];
      list.push(milestone);
      milestonesByProject.set(milestone.project_id, list);
    }

    const projectsByGoal = new Map();
    for (const project of projects) {
      const list = projectsByGoal.get(project.goal_id) || [];
      list.push({
        ...project,
        milestones: milestonesByProject.get(project.project_id) || []
      });
      projectsByGoal.set(project.goal_id, list);
    }

    const results = goals.map((goal) => ({
      ...goal,
      projects: projectsByGoal.get(goal.goal_id) || []
    }));

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// --------------------------------------

router.get('/reflections', requireAuth, async (req, res) => {
  try {
    const pool = db.getPool();

    const [rows] = await pool.query(
      `SELECT reflection_id, user_id, body, goal_id, project_id, created_at, updated_at
       FROM Reflections
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.session.userId]
    );

    const reflectionIds = rows.map((row) => row.reflection_id);

    if (reflectionIds.length === 0) {
      return res.json({ success: true, results: [] });
    }

    const placeholders = reflectionIds.map(() => '?').join(',');

    const [goalLinks] = await pool.query(
      `SELECT rg.reflection_id, g.goal_id, g.title
       FROM ReflectionGoals rg
       JOIN Goals g ON g.goal_id = rg.goal_id
       WHERE rg.reflection_id IN (${placeholders})
       ORDER BY g.title ASC`,
      reflectionIds
    );

    const [projectLinks] = await pool.query(
      `SELECT rp.reflection_id, p.project_id, p.goal_id, p.title
       FROM ReflectionProjects rp
       JOIN Projects p ON p.project_id = rp.project_id
       WHERE rp.reflection_id IN (${placeholders})
       ORDER BY p.title ASC`,
      reflectionIds
    );

    const [milestoneLinks] = await pool.query(
      `SELECT rm.reflection_id, m.milestone_id, m.project_id, m.title
       FROM ReflectionMilestones rm
       JOIN Milestones m ON m.milestone_id = rm.milestone_id
       WHERE rm.reflection_id IN (${placeholders})
       ORDER BY m.title ASC`,
      reflectionIds
    );

    const goalsByReflection = new Map();
    const projectsByReflection = new Map();
    const milestonesByReflection = new Map();

    for (const row of goalLinks) {
      const list = goalsByReflection.get(row.reflection_id) || [];
      list.push({ goal_id: row.goal_id, title: row.title });
      goalsByReflection.set(row.reflection_id, list);
    }

    for (const row of projectLinks) {
      const list = projectsByReflection.get(row.reflection_id) || [];
      list.push({ project_id: row.project_id, goal_id: row.goal_id, title: row.title });
      projectsByReflection.set(row.reflection_id, list);
    }

    for (const row of milestoneLinks) {
      const list = milestonesByReflection.get(row.reflection_id) || [];
      list.push({ milestone_id: row.milestone_id, project_id: row.project_id, title: row.title });
      milestonesByReflection.set(row.reflection_id, list);
    }

    const results = rows.map((row) => ({
      ...row,
      linked_goals: goalsByReflection.get(row.reflection_id) || [],
      linked_projects: projectsByReflection.get(row.reflection_id) || [],
      linked_milestones: milestonesByReflection.get(row.reflection_id) || []
    }));

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reflections', requireAuth, async (req, res) => {
  const conn = await db.getPool().getConnection();

  try {
    const { body } = req.body || {};
    const text = body != null ? String(body).trim() : '';

    if (text.length < 1) {
      return res.status(400).json({ success: false, error: 'Reflection entry is required.' });
    }

    const goalIds = parseIdArray(req.body.goal_ids);
    const projectIds = parseIdArray(req.body.project_ids);
    const milestoneIds = parseIdArray(req.body.milestone_ids);

    const ownedGoalIds = await getOwnedGoalIds(conn, req.session.userId, goalIds);
    const ownedProjectIds = await getOwnedProjectIds(conn, req.session.userId, projectIds);
    const ownedMilestoneIds = await getOwnedMilestoneIds(conn, req.session.userId, milestoneIds);

    if (!ownsAllRequestedIds(goalIds, ownedGoalIds)) {
      return res.status(404).json({ success: false, error: 'One or more selected goals were not found.' });
    }

    if (!ownsAllRequestedIds(projectIds, ownedProjectIds)) {
      return res.status(404).json({ success: false, error: 'One or more selected projects were not found.' });
    }

    if (!ownsAllRequestedIds(milestoneIds, ownedMilestoneIds)) {
      return res.status(404).json({ success: false, error: 'One or more selected milestones were not found.' });
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO Reflections (user_id, body, goal_id, project_id)
       VALUES (?, ?, ?, ?)`,
      [
        req.session.userId,
        text,
        goalIds.length > 0 ? goalIds[0] : null,
        projectIds.length > 0 ? projectIds[0] : null
      ]
    );

    const reflectionId = result.insertId;

    await insertReflectionLinks(conn, reflectionId, goalIds, projectIds, milestoneIds);

    await conn.commit();

    await logActivity({
      userId: req.session.userId,
      actionType: 'reflection_created',
      entityType: 'reflection',
      entityId: reflectionId,
      detail: {
        linked_goals: goalIds.length,
        linked_projects: projectIds.length,
        linked_milestones: milestoneIds.length
      }
    });

    res.status(201).json({ success: true, reflection_id: reflectionId });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // ignore rollback failure
    }

    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

router.put('/reflections/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { body, goal_id: gid, project_id: pid } = req.body || {};
    const text = body != null ? String(body).trim() : '';
    if (!id || text.length < 1) {
      return res.status(400).json({ success: false, error: 'Invalid reflection or empty body' });
    }
    const goalId = gid != null && gid !== '' ? Number(gid) : null;
    const projectId = pid != null && pid !== '' ? Number(pid) : null;

    const pool = db.getPool();
    if (!(await assertGoalOwned(pool, req.session.userId, goalId))) {
      return res.status(404).json({ success: false, error: 'Goal not found' });
    }
    if (!(await assertProjectOwned(pool, req.session.userId, projectId))) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const [result] = await pool.query(
      `UPDATE Reflections SET body = ?, goal_id = ?, project_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE reflection_id = ? AND user_id = ?`,
      [text, goalId, projectId, id, req.session.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Reflection not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/reflections/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });
    const [result] = await db.getPool().query(
      'DELETE FROM Reflections WHERE reflection_id = ? AND user_id = ?',
      [id, req.session.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Reflection not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
