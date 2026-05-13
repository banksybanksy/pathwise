const db = require('../db/connection');

function tokenize(values, max = 14) {
  const tokens = new Set();
  for (const value of values) {
    if (!value) continue;
    const words = String(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3);
    for (const word of words) {
      tokens.add(word);
      if (tokens.size >= max) {
        return Array.from(tokens);
      }
    }
  }
  return Array.from(tokens);
}

async function fetchPreviewRecommendations({ userId, goal, draft, limit }) {
  const pool = db.getPool();
  const terms = tokenize(
    [
      goal && goal.title,
      goal && goal.description,
      draft && draft.plan_summary,
      ...(Array.isArray(draft && draft.projects)
        ? draft.projects.flatMap((project) => [
            project.title,
            project.description,
            ...(Array.isArray(project.milestones)
              ? project.milestones.flatMap((milestone) => [milestone.title, milestone.description])
              : [])
          ])
        : [])
    ],
    18
  );

  if (!terms.length) {
    const [fallbackRows] = await pool.query(
      `SELECT r.resource_id, r.title, r.description, r.url, r.image_path, r.cost, r.is_ai_enabled, c.category_name
       FROM Resources r
       LEFT JOIN Categories c ON c.category_id = r.category_id
       WHERE r.visibility = 'public'
         AND r.moderation_status = 'approved'
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [Math.max(1, Math.min(Number(limit) || 3, 10))]
    );
    return fallbackRows;
  }

  const scoreParts = [];
  const scoreParams = [];
  for (const term of terms) {
    const like = `%${term}%`;
    scoreParts.push(
      `(CASE WHEN r.title LIKE ? THEN 40 ELSE 0 END + CASE WHEN r.description LIKE ? THEN 18 ELSE 0 END)`
    );
    scoreParams.push(like, like);
  }
  const scoreExpr = scoreParts.join(' + ');
  const sql = `SELECT
      r.resource_id, r.title, r.description, r.url, r.image_path, r.cost, r.is_ai_enabled,
      c.category_name,
      (${scoreExpr}) AS score
    FROM Resources r
    LEFT JOIN Categories c ON c.category_id = r.category_id
    WHERE r.visibility = 'public'
      AND r.moderation_status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM Bookmarks b
        WHERE b.user_id = ?
          AND b.resource_id = r.resource_id
      )
    HAVING score > 0
    ORDER BY score DESC, r.created_at DESC
    LIMIT ?`;

  const [rows] = await pool.query(sql, [...scoreParams, userId, Math.max(1, Math.min(Number(limit) || 3, 10))]);
  return rows;
}

module.exports = { fetchPreviewRecommendations };
