const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/requireAuth');
const {
  TOKEN_COST_PER_SAVE,
  validateGoalInput,
  validateQuestionnaire,
  mapPreset,
  generateDraftWithGemini,
  validateSavePayload
} = require('../services/aiGoalPlan');
const { fetchPreviewRecommendations } = require('../services/previewRecommendations');

const router = express.Router();

const MOCK_PACKS = {
  pack_3: { tokens: 3, price: '$2.99' },
  pack_5: { tokens: 5, price: '$3.89' },
  pack_10: { tokens: 10, price: '$5.99' }
};

router.get('/ai-tokens/balance', requireAuth, async (req, res) => {
  try {
    const pool = db.getPool();
    const [[row]] = await pool.query('SELECT ai_goal_tokens FROM Users WHERE user_id = ? LIMIT 1', [req.session.userId]);
    if (!row) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, balance: Number(row.ai_goal_tokens) || 0, token_cost_per_save: TOKEN_COST_PER_SAVE });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/ai-tokens/purchase', requireAuth, async (req, res) => {
  try {
    const packId = String((req.body || {}).pack_id || '').trim();
    const pack = MOCK_PACKS[packId];
    if (!pack) {
      return res.status(400).json({ success: false, error: 'Invalid token pack selected' });
    }
    const pool = db.getPool();
    await pool.query('UPDATE Users SET ai_goal_tokens = ai_goal_tokens + ? WHERE user_id = ?', [
      pack.tokens,
      req.session.userId
    ]);
    const [[row]] = await pool.query('SELECT ai_goal_tokens FROM Users WHERE user_id = ? LIMIT 1', [req.session.userId]);
    console.log('[ai-tokens] mock purchase', { userId: req.session.userId, packId, tokens: pack.tokens });
    return res.json({
      success: true,
      added_tokens: pack.tokens,
      price_label: pack.price,
      balance: Number(row.ai_goal_tokens) || 0
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/ai/goal-plan-draft', requireAuth, async (req, res) => {
  try {
    const goal = validateGoalInput((req.body || {}).goal || {});
    const answers = validateQuestionnaire((req.body || {}).questionnaire || {});
    const preset = mapPreset(answers);
    console.log('[ai-goal] draft start', { userId: req.session.userId, preset });
    const draft = await generateDraftWithGemini(goal, answers, preset);
    console.log('[ai-goal] draft success', { userId: req.session.userId, projectCount: draft.projects.length });
    return res.json({ success: true, draft, preset, token_cost_per_save: TOKEN_COST_PER_SAVE });
  } catch (err) {
    console.log('[ai-goal] draft failed', { userId: req.session.userId, message: err.message });
    return res.status(400).json({ success: false, error: 'ai_generation_failed', details: err.message });
  }
});

router.post('/recommendations/preview', requireAuth, async (req, res) => {
  try {
    const goal = validateGoalInput((req.body || {}).goal || {});
    const draft = (req.body || {}).draft || {};
    const requestedLimit = Number((req.body || {}).limit);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 10)) : 3;
    const rows = await fetchPreviewRecommendations({
      userId: req.session.userId,
      goal,
      draft,
      limit
    });
    console.log('[ai-goal] preview recommendations', { userId: req.session.userId, count: rows.length, limit });
    return res.json({ success: true, results: rows });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || 'Invalid request' });
  }
});

router.post('/ai/goal-plan/save', requireAuth, async (req, res) => {
  const connection = await db.getPool().getConnection();
  try {
    const payload = validateSavePayload(req.body || {});
    await connection.beginTransaction();

    const [[userRow]] = await connection.query(
      'SELECT ai_goal_tokens FROM Users WHERE user_id = ? LIMIT 1 FOR UPDATE',
      [req.session.userId]
    );
    if (!userRow) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const balance = Number(userRow.ai_goal_tokens) || 0;
    if (balance < TOKEN_COST_PER_SAVE) {
      await connection.rollback();
      return res.status(403).json({ success: false, error: 'insufficient_tokens', balance });
    }

    const [goalInsert] = await connection.query(
      `INSERT INTO Goals (user_id, title, description, category, target_date, status, template_kind, template_copied_count)
       VALUES (?, ?, ?, ?, ?, 'active', 'none', 0)`,
      [
        req.session.userId,
        payload.goal.title,
        payload.goal.description,
        payload.goal.category,
        payload.goal.target_date
      ]
    );
    const goalId = goalInsert.insertId;

    for (const project of payload.draft.projects) {
      const [projectInsert] = await connection.query(
        'INSERT INTO Projects (goal_id, title, description) VALUES (?, ?, ?)',
        [goalId, project.title, project.description]
      );
      const projectId = projectInsert.insertId;

      for (const milestone of project.milestones) {
        await connection.query(
          `INSERT INTO Milestones (project_id, title, description, target_date, is_completed)
           VALUES (?, ?, ?, ?, 0)`,
          [projectId, milestone.title, milestone.description, milestone.target_date]
        );
      }
    }

    if (payload.selectedResourceIds.length > 0) {
      const placeholders = payload.selectedResourceIds.map(() => '?').join(',');
      const [resourceRows] = await connection.query(
        `SELECT resource_id
         FROM Resources
         WHERE resource_id IN (${placeholders})
           AND (visibility = 'public' OR submitted_by = ?)
           AND moderation_status = 'approved'`,
        [...payload.selectedResourceIds, req.session.userId]
      );
      const allowedIds = resourceRows.map((row) => Number(row.resource_id));
      for (const resourceId of allowedIds) {
        await connection.query('INSERT IGNORE INTO GoalResources (goal_id, resource_id) VALUES (?, ?)', [goalId, resourceId]);
      }
    }

    await connection.query('UPDATE Users SET ai_goal_tokens = ai_goal_tokens - ? WHERE user_id = ?', [
      TOKEN_COST_PER_SAVE,
      req.session.userId
    ]);
    const [[updatedUser]] = await connection.query('SELECT ai_goal_tokens FROM Users WHERE user_id = ? LIMIT 1', [
      req.session.userId
    ]);

    await connection.commit();
    console.log('[ai-goal] save success', { userId: req.session.userId, goalId, tokenSpent: TOKEN_COST_PER_SAVE });
    return res.status(201).json({
      success: true,
      goal_id: goalId,
      balance: Number(updatedUser.ai_goal_tokens) || 0,
      token_spent: TOKEN_COST_PER_SAVE
    });
  } catch (err) {
    await connection.rollback();
    console.log('[ai-goal] save failed', { userId: req.session.userId, message: err.message });
    if (err.message && err.message.toLowerCase().includes('goal title')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

module.exports = router;
