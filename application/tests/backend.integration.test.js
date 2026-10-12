const request = require('supertest');

jest.mock('../db/connection', () => {
  const query = jest.fn(async (sql) => {
    if (typeof sql === 'string' && sql.includes('FROM Resources r')) {
      return [[{ id: 1, content_type: 'resource', title: 'Public Resource', description: 'test', is_ai_enabled: 0 }]];
    }
    if (typeof sql === 'string' && sql.includes('FROM CommunityTemplates')) {
      return [[{ template_id: 1, title: 'Template A', description: 'desc' }]];
    }
    if (typeof sql === 'string' && sql.includes('FROM Workflows')) {
      return [[{ workflow_id: 1, title: 'Workflow A', description: 'desc' }]];
    }
    return [[]];
  });
  return {
    getPool: () => ({ query }),
    testConnection: async () => ({ ok: true, message: 'ok' }),
    getResourcesSample: async () => []
  };
});

const app = require('../server');

describe('Pathwise API smoke integration', () => {
  test('guest can search public discovery content', async () => {
    const res = await request(app).get('/api/search?q=test');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  test('shares endpoint requires auth', async () => {
    const res = await request(app).get('/api/shares/received');
    expect(res.statusCode).toBe(401);
  });

  test('goal attachments endpoint requires auth', async () => {
    const res = await request(app).get('/api/goals/1/attachments');
    expect(res.statusCode).toBe(401);
  });

  test('template recommendations endpoint requires auth', async () => {
    const res = await request(app).get('/api/template-recommendations');
    expect(res.statusCode).toBe(401);
  });

  test('ai token balance endpoint requires auth', async () => {
    const res = await request(app).get('/api/ai-tokens/balance');
    expect(res.statusCode).toBe(401);
  });

  test('ai draft endpoint requires auth', async () => {
    const res = await request(app).post('/api/ai/goal-plan-draft').send({});
    expect(res.statusCode).toBe(401);
  });

  test('preview recommendations endpoint requires auth', async () => {
    const res = await request(app).post('/api/recommendations/preview').send({});
    expect(res.statusCode).toBe(401);
  });

  test('ai save endpoint requires auth', async () => {
    const res = await request(app).post('/api/ai/goal-plan/save').send({});
    expect(res.statusCode).toBe(401);
  });

  test('frontend pages are served from vertical-prototype', async () => {
    const res = await request(app).get('/vertical-prototype/landing.html');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  test('server source and config files are not served', async () => {
    for (const file of ['/server.js', '/package.json', '/db/connection.js', '/db/migrations/masterMigration.sql']) {
      const res = await request(app).get(file);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('/vertical-prototype/404.html');
    }
  });

  test('/about redirects to the landing page', async () => {
    const res = await request(app).get('/about');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/vertical-prototype/landing.html');
  });

  test('unexpected API errors do not leak internal details', async () => {
    const db = require('../db/connection');
    db.getPool().query.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:3306'));
    const res = await request(app).get('/api/resources/1');
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
  });
});
