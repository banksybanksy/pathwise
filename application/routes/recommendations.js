/**
 * Why:
 *   This file exists so users can discover resources like templates and normal readable
 *   informations without having to search for them through a personalized system where
 *   it figures out resources related to their goals, and profile.
 *
 * What:
 *   It defines the routes that that derive tokens (keywords) from a user goals and tries
 *   to text match with public resources, which then spits out a score. If not sucessful,
 *   it recommends random public resources that are not saved by the current user.
 *
 * Where used:
 *   It is mounted under '/api' in server.js
 *   It is called by vertical-prototype/app.js
 *
 * Notes:
 *   - It expects an authenticated session
 *   - The table it touches: 
 *        Goals, 
 *        Projects, 
 *        Resources, 
 *        Bookmarks.
 *   - It uses a simple heuristic matching instead of AI based analysis, although
 *     if enough time to spare we can implement a very simple version of it
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

function tokenize(values, max = 12) {
  const terms = new Set();
  for (const value of values) {
    if (!value) continue;
    const tokens = String(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length > 2);
    for (const t of tokens) {
      terms.add(t);
      if (terms.size >= max) return Array.from(terms);
    }
  }
  return Array.from(terms);
}

function buildScoreParts({ goalTitleTerms, goalDescTerms, projectTitleTerms, projectDescTerms }) {
  const weightedGroups = [
    { terms: goalTitleTerms, titleWeight: 2000, descWeight: 1000 },
    { terms: goalDescTerms, titleWeight: 200, descWeight: 100 },
    { terms: projectTitleTerms, titleWeight: 20, descWeight: 10 },
    { terms: projectDescTerms, titleWeight: 2, descWeight: 1 }
  ];

  const scoreParts = [];
  const scoreParams = [];
  for (const group of weightedGroups) {
    for (const term of group.terms) {
      const like = `%${term}%`;
      scoreParts.push(
        `(CASE WHEN r.title LIKE ? THEN ${group.titleWeight} ELSE 0 END + CASE WHEN r.description LIKE ? THEN ${group.descWeight} ELSE 0 END)`
      );
      scoreParams.push(like, like);
    }
  }
  return { scoreParts, scoreParams };
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Browse-page recommendations:
 * 1) If user has current goals/projects, rank resources by text similarity.
 * 2) Otherwise return random unsaved resources.
 */
router.get('/recommendations', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 4, 24);
    const pool = db.getPool();
    const userId = req.session.userId;

    const [goalRows] = await pool.query(
      `SELECT goal_id, title, description
       FROM Goals
       WHERE user_id = ? AND status IN ('active', 'paused') AND template_kind = 'none'
       ORDER BY updated_at DESC`,
      [userId]
    );

    const [projectRows] = await pool.query(
      `SELECT p.goal_id, p.title, p.description
       FROM Projects p
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE g.user_id = ? AND g.status IN ('active', 'paused') AND g.template_kind = 'none'`,
      [userId]
    );

    // No current goals/projects: return random unsaved resources.
    if (goalRows.length === 0 && projectRows.length === 0) {
      const [fallback] = await pool.query(
        `SELECT resource_id, title, description, url, category_id, image_path, cost, is_ai_enabled
         FROM Resources r
         WHERE r.visibility = 'public'
           AND r.moderation_status = 'approved'
           AND NOT EXISTS (
             SELECT 1
             FROM Bookmarks b
             WHERE b.user_id = ?
               AND b.resource_id = r.resource_id
           )
         ORDER BY RAND()
         LIMIT ?`,
        [userId, limit]
      );
      return res.json({ success: true, results: fallback, strategy: 'random_unsaved' });
    }

    const projectsByGoal = new Map();
    for (const p of projectRows) {
      const list = projectsByGoal.get(p.goal_id) || [];
      list.push(p);
      projectsByGoal.set(p.goal_id, list);
    }

    const candidateMap = new Map();
    const goalsToEvaluate = goalRows;

    for (const goal of goalsToEvaluate) {
      const relatedProjects = projectsByGoal.get(goal.goal_id) || [];

      const goalTitleTerms = tokenize([goal.title], 14);
      const goalDescTerms = tokenize([goal.description], 12);
      const projectTitleTerms = tokenize(relatedProjects.map((p) => p.title), 10);
      const projectDescTerms = tokenize(relatedProjects.map((p) => p.description), 8);

      const { scoreParts, scoreParams } = buildScoreParts({
        goalTitleTerms,
        goalDescTerms,
        projectTitleTerms,
        projectDescTerms
      });

      if (scoreParts.length === 0) continue;

      const scoreExpr = scoreParts.join(' + ');
      const params = [...scoreParams];

      // Recommendations should not show already bookmarked resources by the user,
      // becuase its not new content
      const sql = `SELECT
                    r.resource_id, r.title, r.description, r.url, r.category_id, r.image_path, r.cost, r.is_ai_enabled,
                    (${scoreExpr}) AS score
                  FROM Resources r
                  WHERE r.visibility = 'public'
                    AND r.moderation_status = 'approved'
                    AND NOT EXISTS (
                      SELECT 1
                      FROM Bookmarks b
                      WHERE b.user_id = ?
                        AND b.resource_id = r.resource_id
                    )
                  HAVING score > 0
                  ORDER BY score DESC
                  LIMIT 20`;

      const [candidates] = await pool.query(sql, [...params, userId]);
      
      for (const candidate of candidates) {
        const existing = candidateMap.get(candidate.resource_id);
        if (!existing || Number(candidate.score) > Number(existing.score)) {
          candidateMap.set(candidate.resource_id, candidate);
        } else if (existing && Number(candidate.score) === Number(existing.score) && Math.random() < 0.5) {
          // Random tie-break across equal-score candidates.
          candidateMap.set(candidate.resource_id, candidate);
        }
      }
    }

    const grouped = new Map();
    for (const row of candidateMap.values()) {
      const key = Number(row.score) || 0;
      const list = grouped.get(key) || [];
      list.push(row);
      grouped.set(key, list);
    }
    const sortedScores = Array.from(grouped.keys()).sort((a, b) => b - a);
    const matched = [];
    for (const score of sortedScores) {
      matched.push(...shuffle(grouped.get(score)));
    }

    let selected = matched.slice(0, limit);
    const selectedIds = new Set(selected.map((r) => r.resource_id));

    // If user has goals/projects but no matching recs, fallback to random unsaved.
    if (selected.length === 0) {
      const [fallback] = await pool.query(
        `SELECT resource_id, title, description, url, category_id, image_path, cost, is_ai_enabled
         FROM Resources r
         WHERE r.visibility = 'public'
           AND r.moderation_status = 'approved'
           AND NOT EXISTS (
             SELECT 1
             FROM Bookmarks b
             WHERE b.user_id = ?
               AND b.resource_id = r.resource_id
           )
         ORDER BY RAND()
         LIMIT ?`,
        [userId, limit]
      );
      return res.json({ success: true, results: fallback, strategy: 'random_unsaved_no_matches' });
    }

    if (selected.length < limit) {
      const needed = limit - selected.length;
      const params = [userId];
      let sql = `SELECT r.resource_id, r.title, r.description, r.url, r.category_id, r.image_path, r.cost, r.is_ai_enabled
                 FROM Resources r
                 WHERE r.visibility = 'public'
                   AND r.moderation_status = 'approved'
                   AND NOT EXISTS (
                     SELECT 1
                     FROM Bookmarks b
                     WHERE b.user_id = ?
                       AND b.resource_id = r.resource_id
                   )`;

      if (selectedIds.size > 0) {
        sql += ` AND r.resource_id NOT IN (${Array.from(selectedIds).map(() => '?').join(',')})`;
        params.push(...Array.from(selectedIds));
      }
      sql += ' ORDER BY RAND() LIMIT ?';
      params.push(needed);

      const [extras] = await pool.query(sql, params);
      for (const row of extras) {
        selected.push(row);
        selectedIds.add(row.resource_id);
      }
    }

    res.json({ success: true, results: selected, strategy: 'goal_project_matches_plus_random_fill' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/template-recommendations', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 4, 24);
    const pool = db.getPool();
    const userId = req.session.userId;

    const [goalRows] = await pool.query(
      `SELECT title, description FROM Goals WHERE user_id = ? AND status IN ('active', 'paused') AND template_kind = 'none'`,
      [userId]
    );
    const [projectRows] = await pool.query(
      `SELECT p.title, p.description
       FROM Projects p
       JOIN Goals g ON g.goal_id = p.goal_id
       WHERE g.user_id = ? AND g.status IN ('active', 'paused') AND g.template_kind = 'none'`,
      [userId]
    );
    const [savedRows] = await pool.query(
      `SELECT r.title, r.description
       FROM Bookmarks b
       JOIN Resources r ON r.resource_id = b.resource_id
       WHERE b.user_id = ?`,
      [userId]
    );

    const savedTerms = tokenize(savedRows.flatMap((r) => [r.title, r.description]), 18);
    const goalTerms = tokenize(goalRows.flatMap((r) => [r.title, r.description]), 12);
    const projectTerms = tokenize(projectRows.flatMap((r) => [r.title, r.description]), 8);

    const weightedGroups = [
      { terms: savedTerms, titleWeight: 1200, bodyWeight: 800 },
      { terms: goalTerms, titleWeight: 180, bodyWeight: 90 },
      { terms: projectTerms, titleWeight: 20, bodyWeight: 10 }
    ];

    const scoreParts = [];
    const params = [];
    for (const group of weightedGroups) {
      for (const term of group.terms) {
        const like = `%${term}%`;
        scoreParts.push(
          `(CASE WHEN g.title LIKE ? THEN ${group.titleWeight} ELSE 0 END +
            CASE WHEN g.description LIKE ? THEN ${group.bodyWeight} ELSE 0 END +
            CASE WHEN (SELECT GROUP_CONCAT(p.title SEPARATOR ' ') FROM Projects p WHERE p.goal_id = g.goal_id) LIKE ? THEN ${group.bodyWeight} ELSE 0 END)`
        );
        params.push(like, like, like);
      }
    }

    if (!scoreParts.length) {
      const [fallback] = await pool.query(
        `SELECT g.goal_id AS template_id, g.goal_id, g.title, g.description, g.category,
                '' AS workflow_steps, g.template_copied_count AS copied_count, g.created_at
         FROM Goals g
         WHERE g.template_kind = 'published'
         ORDER BY RAND()
         LIMIT ?`,
        [limit]
      );
      return res.json({ success: true, results: fallback, strategy: 'random_public_templates' });
    }

    const scoreExpr = scoreParts.join(' + ');
    const [rows] = await pool.query(
      `SELECT g.goal_id AS template_id, g.goal_id, g.title, g.description, g.category,
              '' AS workflow_steps, g.template_copied_count AS copied_count, g.created_at,
              (${scoreExpr}) AS score
       FROM Goals g
       WHERE g.template_kind = 'published'
       HAVING score > 0
       ORDER BY score DESC, g.template_copied_count DESC, g.created_at DESC
       LIMIT ?`,
      [...params, limit]
    );
    if (!rows.length) {
      const [fallback] = await pool.query(
        `SELECT g.goal_id AS template_id, g.goal_id, g.title, g.description, g.category,
                '' AS workflow_steps, g.template_copied_count AS copied_count, g.created_at
         FROM Goals g
         WHERE g.template_kind = 'published'
         ORDER BY RAND()
         LIMIT ?`,
        [limit]
      );
      return res.json({ success: true, results: fallback, strategy: 'random_public_templates_no_match' });
    }
    res.json({ success: true, results: rows, strategy: 'saved_goal_project_weighted' });
  } catch (_err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
