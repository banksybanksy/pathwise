/**
 * Why:
 *   This is the starting main entry into our Pathwise application
 *
 * What:
 *   It helps with setting up environment, express middleware/sessions, the API routes, 
 *   handle database endpoints, search operations, initial file(s) serving and overall other
 *   important setups.
 *
 * Where used:
 *   Since this is the main backend entry point, this file is called by 'npm start' and
 *   'node server.js', which headstarts the backend and serve the frontend.
 *
 * Notes:
 *   - This file will mount all the needed route modules under '/api'
 *   - It will also serve the frontend files we have from 'vertical-prototype/'
 *   - To make super simple, we use express-session to help with verification/auth
 *   - Will use db/connection.js to access our database (MySQL)
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db/connection');

const authRoutes = require('./routes/auth');
const bookmarkRoutes = require('./routes/bookmarks');
const resourceRoutes = require('./routes/resources');
const goalsRoutes = require('./routes/goals');
const projectsRoutes = require('./routes/projects');
const milestonesRoutes = require('./routes/milestones');
const dashboardRoutes = require('./routes/dashboard');
const profileRoutes = require('./routes/profile');
const reflectionsRoutes = require('./routes/reflections');
const activityRoutes = require('./routes/activity');
const messagesRoutes = require('./routes/messages');
const recommendationsRoutes = require('./routes/recommendations');
const aiGoalsRoutes = require('./routes/aiGoals');
const ratingsRoutes = require('./routes/ratings');
const usersRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
// Mount the reports router so the dashboard/reporting API is reachable during the final demo.
const reportsRoutes = require('./routes/reports');
const templatesRoutes = require('./routes/templates');
const workflowsRoutes = require('./routes/workflows');
const sharesRoutes = require('./routes/shares');

const app = express();
const PORT = process.env.PORT || 3000;

/** Cached flags so /api/search does not 500 when incremental migrations are missing. */
const searchSchemaCache = {
  checkedAt: 0,
  ttlMs: 60_000,
  goalTemplateSearch: false,
  resourcesSkillArea: false,
  communityTemplateSkillArea: false,
  workflowsSkillArea: false
};

async function refreshSearchSchemaFlags(pool) {
  const now = Date.now();
  if (searchSchemaCache.checkedAt > 0 && now - searchSchemaCache.checkedAt < searchSchemaCache.ttlMs) {
    return;
  }
  searchSchemaCache.checkedAt = now;
  try {
    const [[row]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Goals' AND COLUMN_NAME = 'template_kind') AS goals_tpl,
        (SELECT COUNT(*) FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GoalTemplateRatings') AS gtr_tbl,
        (SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Resources' AND COLUMN_NAME = 'skill_area') AS res_skill,
        (SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CommunityTemplates' AND COLUMN_NAME = 'skill_area') AS ct_skill,
        (SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Workflows' AND COLUMN_NAME = 'skill_area') AS wf_skill`
    );
    searchSchemaCache.goalTemplateSearch =
      Number(row.goals_tpl) > 0 && Number(row.gtr_tbl) > 0;
    searchSchemaCache.resourcesSkillArea = Number(row.res_skill) > 0;
    searchSchemaCache.communityTemplateSkillArea = Number(row.ct_skill) > 0;
    searchSchemaCache.workflowsSkillArea = Number(row.wf_skill) > 0;
  } catch (e) {
    console.warn('[search] schema probe failed:', e.message);
    searchSchemaCache.goalTemplateSearch = false;
    searchSchemaCache.resourcesSkillArea = false;
    searchSchemaCache.communityTemplateSkillArea = false;
    searchSchemaCache.workflowsSkillArea = false;
  }
}

app.set('trust proxy', 1);

app.use(express.json());

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 16) {
  console.warn('[session] SESSION_SECRET missing or short; set a long random value in .env for production.');
}

app.use(
  session({
    secret: sessionSecret || 'pathwise-dev-only-not-for-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.COOKIE_SECURE === 'true'
    }
  })
);

// API routes (before static so /api/* is never treated as a static file)
app.use('/api', authRoutes);
app.use('/api', bookmarkRoutes);
app.use('/api', resourceRoutes);
app.use('/api', goalsRoutes);
app.use('/api', projectsRoutes);
app.use('/api', milestonesRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', profileRoutes);
app.use('/api', reflectionsRoutes);
app.use('/api', activityRoutes);
app.use('/api', messagesRoutes);
app.use('/api', recommendationsRoutes);
app.use('/api', aiGoalsRoutes);
app.use('/api', ratingsRoutes);
app.use('/api', usersRoutes);
app.use('/api', adminRoutes);
// Keep the reports endpoints under /api so the frontend can call /api/reports/summary.
app.use('/api', reportsRoutes);
app.use('/api', templatesRoutes);
app.use('/api', workflowsRoutes);
app.use('/api', sharesRoutes);

// GET /api/db-test - simple DB test
app.get('/api/db-test', async (req, res) => {
  try {
    const connectionTest = await db.testConnection();
    if (!connectionTest.ok) {
      return res.status(503).json({
        success: false,
        error: 'Database connection failed',
        details: connectionTest.error || connectionTest.message
      });
    }
    const sample = await db.getResourcesSample();
    res.json({ success: true, database: connectionTest.message, resourcesSample: sample });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/search?q=...&category=...&tags=1,2&cost=free|paid&type=resource|template|workflow
app.get('/api/search', async (req, res) => {
  try {
    const pool = db.getPool();
    await refreshSearchSchemaFlags(pool);
    const q        = (req.query.q        || '').trim();
    const category = (req.query.category || '').trim();
    const skillArea = (req.query.skill_area || '').trim();
    const contentType = (req.query.type || req.query.content_type || '').trim().toLowerCase();
    const tagsParam = (req.query.tags || '').trim();
    const cost = (req.query.cost || '').trim();
    const aiRaw = (req.query.ai ?? req.query.is_ai_enabled ?? '').toString().trim().toLowerCase();
    const aiOnly = aiRaw === '1' || aiRaw === 'true' || aiRaw === 'yes';
    const userId = req.session && req.session.userId != null ? req.session.userId : null;

    const params = [];

    const wherePieces = [];
    const resourceVisibility = [];
    resourceVisibility.push(`r.visibility = 'public'`);
    if (userId != null) {
      resourceVisibility.push('r.submitted_by = ?');
      params.push(userId);
    }
    wherePieces.push(`(${resourceVisibility.join(' OR ')})`);
    wherePieces.push("r.moderation_status = 'approved'");

    if (q && !/^[a-z0-9 ]{1,40}$/i.test(q)) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be 1-40 characters and use only letters, numbers, and spaces'
      });
    }

    if (q) {
      wherePieces.push('(r.title LIKE ? OR r.description LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term);
    }
    if (category) {
      wherePieces.push('r.category_id = ?');
      params.push(category);
    }
    if (skillArea && searchSchemaCache.resourcesSkillArea) {
      wherePieces.push('r.skill_area = ?');
      params.push(skillArea.toLowerCase());
    }

    if (tagsParam) {
      const rawTags = tagsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const tagIds = rawTags
        .map((s) => parseInt(s, 10))
        .filter((n) => !Number.isNaN(n) && n > 0);

      const tagSlugs = rawTags
        .filter((s) => Number.isNaN(parseInt(s, 10)))
        .map((s) => s.toLowerCase());

      if (tagIds.length > 0 || tagSlugs.length > 0) {
        const tagFilters = [];

        if (tagIds.length > 0) {
          tagFilters.push(`tag_id IN (${tagIds.map(() => '?').join(',')})`);
          params.push(...tagIds);
        }

        if (tagSlugs.length > 0) {
          tagFilters.push(
            `LOWER(REPLACE(tag_name, ' ', '-')) IN (${tagSlugs.map(() => '?').join(',')})`
          );
          params.push(...tagSlugs);
        }

        wherePieces.push(`r.resource_id IN (
          SELECT resource_id
          FROM ResourceTags
          WHERE tag_id IN (
            SELECT tag_id
            FROM Tags
            WHERE ${tagFilters.join(' OR ')}
          )
        )`);
      }
    }

    if (cost && cost !== 'all') {
      wherePieces.push('r.cost = ?');
      params.push(cost);
    }

    if (aiOnly) {
      wherePieces.push('r.is_ai_enabled = 1');
    }

    const includeResources = !contentType || contentType === 'resource';
    const includeLegacyTemplates = !contentType || contentType === 'template';
    const includeGoalTemplates =
      searchSchemaCache.goalTemplateSearch &&
      (!contentType || contentType === 'template' || contentType === 'goal_template');
    const includeWorkflows = !contentType || contentType === 'workflow';

    const unions = [];
    const unionParams = [];

    if (includeResources) {
      // Align string collations with other UNION branches (Goals/Templates/Workflows use unicode_ci).
      const rc = 'utf8mb4_unicode_ci';
      unions.push(`SELECT
          r.resource_id AS id,
          'resource' AS content_type,
          r.title COLLATE ${rc} AS title,
          r.description COLLATE ${rc} AS description,
          r.url COLLATE ${rc} AS url,
          r.category_id,
          r.image_path COLLATE ${rc} AS image_path,
          r.cost COLLATE ${rc} AS cost,
          r.is_ai_enabled,
          COALESCE(AVG(rr.stars), 0) AS avg_rating
        FROM Resources r
        LEFT JOIN ResourceRatings rr ON rr.resource_id = r.resource_id
        WHERE ${wherePieces.join(' AND ')}
        GROUP BY r.resource_id`);
      unionParams.push(...params);
    }

    const templateWhere = [`t.is_public = 1`];
    const templateParams = [];
    if (q) {
      templateWhere.push('(t.title LIKE ? OR t.description LIKE ? OR t.workflow_steps LIKE ?)');
      const term = `%${q}%`;
      templateParams.push(term, term, term);
    }
    if (category) {
      templateWhere.push('t.category = ?');
      templateParams.push(category.toLowerCase());
    }
    if (skillArea && searchSchemaCache.communityTemplateSkillArea) {
      templateWhere.push('t.skill_area = ?');
      templateParams.push(skillArea.toLowerCase());
    }
    if (includeLegacyTemplates) {
      unions.push(`SELECT
          t.template_id AS id,
          'template' AS content_type,
          t.title, t.description, NULL AS url, NULL AS category_id, NULL AS image_path,
          NULL AS cost, 0 AS is_ai_enabled, 0 AS avg_rating
        FROM CommunityTemplates t
        WHERE ${templateWhere.join(' AND ')}`);
      unionParams.push(...templateParams);
    }

    if (includeGoalTemplates) {
      const goalTplWhere = [`g.template_kind = 'published'`];
      const goalTplParams = [];
      if (q) {
        goalTplWhere.push('(g.title LIKE ? OR g.description LIKE ?)');
        const term = `%${q}%`;
        goalTplParams.push(term, term);
      }
      if (category) {
        goalTplWhere.push('LOWER(g.category) = ?');
        goalTplParams.push(category.toLowerCase());
      }
      if (skillArea) {
        goalTplWhere.push('LOWER(g.category) = ?');
        goalTplParams.push(skillArea.toLowerCase());
      }
      unions.push(`SELECT
          g.goal_id AS id,
          'goal_template' AS content_type,
          g.title, g.description, NULL AS url, NULL AS category_id, NULL AS image_path,
          NULL AS cost, 0 AS is_ai_enabled,
          COALESCE(tr.avg_stars, 0) AS avg_rating
        FROM Goals g
        LEFT JOIN (
          SELECT template_goal_id, AVG(stars) AS avg_stars
          FROM GoalTemplateRatings
          GROUP BY template_goal_id
        ) tr ON tr.template_goal_id = g.goal_id
        WHERE ${goalTplWhere.join(' AND ')}`);
      unionParams.push(...goalTplParams);
    }

    const workflowWhere = [`w.is_public = 1`, `w.is_published = 1`];
    const workflowParams = [];
    if (q) {
      workflowWhere.push('(w.title LIKE ? OR w.description LIKE ? OR w.steps LIKE ?)');
      const term = `%${q}%`;
      workflowParams.push(term, term, term);
    }
    if (category) {
      workflowWhere.push('w.category = ?');
      workflowParams.push(category.toLowerCase());
    }
    if (skillArea && searchSchemaCache.workflowsSkillArea) {
      workflowWhere.push('w.skill_area = ?');
      workflowParams.push(skillArea.toLowerCase());
    }
    if (aiOnly) {
      workflowWhere.push('w.is_ai_enabled = 1');
    }
    if (includeWorkflows) {
      unions.push(`SELECT
          w.workflow_id AS id,
          'workflow' AS content_type,
          w.title, w.description, NULL AS url, NULL AS category_id, NULL AS image_path,
          NULL AS cost, w.is_ai_enabled, 0 AS avg_rating
        FROM Workflows w
        WHERE ${workflowWhere.join(' AND ')}`);
      unionParams.push(...workflowParams);
    }

    if (unions.length === 0) return res.json({ success: true, results: [] });

    const sql = `${unions.join(' UNION ALL ')} ORDER BY title`;
    const [rows] = await pool.query(sql, unionParams);
    res.json({ success: true, results: rows });
  } catch (err) {
    console.error('[search]', err.code || '', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Explicit entry points before the broader static file handler.
app.get('/', (req, res) => {
  res.redirect('/vertical-prototype/landing.html');
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Static files (HTML, CSS, etc.) from application directory
app.use(express.static(path.join(__dirname)));

// 404 catch-all — must come after static middleware and all routes.
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error:
        'API route not found. Stop and restart the Node server (npm start in application/) so new routes load, then try again.'
    });
  }
  res.redirect('/vertical-prototype/404.html');
});

// Centralized error payload for async/validation middleware.
app.use((err, _req, res, _next) => {
  if (!err) return res.status(500).json({ error: 'Internal server error' });
  const status = err.statusCode || err.status || 500;
  const payload = {
    error: err.message || 'Internal server error'
  };
  if (Array.isArray(err.details) && err.details.length > 0) {
    payload.details = err.details;
  }
  if (status >= 500) return res.status(status).json({ error: 'Internal server error' });
  return res.status(status).json(payload);
});

// Start server and run startup DB check (errors logged, server does not crash)
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`Pathwise server listening on port ${PORT}`);
    try {
      const connectionTest = await db.testConnection();
      if (connectionTest.ok) {
        console.log('[startup]', connectionTest.message);
        const sample = await db.getResourcesSample();
        console.log('[startup] Resources sample count:', sample.length);
      } else {
        console.error('[startup] DB connection failed:', connectionTest.error || connectionTest.message);
      }
    } catch (e) {
      console.error('[startup] Could not read Resources:', e.message);
    }
  });
}

module.exports = app;
