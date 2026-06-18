// Integration tests for Campus Food Time Worker
// Uses @cloudflare/vitest-pool-workers for real Workers environment testing

import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Initialize database with schema and seed data
async function initDatabase() {
  const schemaPath = resolve(process.cwd(), 'worker/src/db/0001_initial_schema.sql');
  const seedPath = resolve(process.cwd(), 'worker/src/db/seed.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  const seed = readFileSync(seedPath, 'utf-8');

  // Execute schema statements
  for (const stmt of schema.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'))) {
    try { await env.DB.prepare(stmt).run(); } catch (e) { if (!e.message.includes('already exists')) console.error('Schema:', e.message); }
  }
  // Execute seed statements
  for (const stmt of seed.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'))) {
    try { await env.DB.prepare(stmt).run(); } catch (e) { if (!e.message.includes('UNIQUE')) console.error('Seed:', e.message); }
  }
}

// Helper: make API request
async function api(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);
  const response = await SELF.fetch(`http://localhost${path}`, init);
  return { status: response.status, body: await response.json() };
}

// Run setup before all tests
beforeAll(async () => { await initDatabase(); });

describe('Auth System', () => {
  it('should reject login without credentials', async () => {
    const res = await api('POST', '/auth/teacher/login');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(1002);
  });

  it('should reject invalid phone format', async () => {
    const res = await api('POST', '/auth/teacher/login', { phone: '123', password: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(1003);
  });

  it('should reject non-existent user', async () => {
    const res = await api('POST', '/auth/teacher/login', { phone: '13900000000', password: 'test123' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(3001);
  });

  it('should login admin with correct credentials', async () => {
    const res = await api('POST', '/auth/admin/login', { username: 'zx', password: '1qaz!QAZ' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.name).toBe('管理员');
  });

  it('should reject admin with wrong password', async () => {
    const res = await api('POST', '/auth/admin/login', { username: 'zx', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(3002);
  });
});

describe('Public API', () => {
  it('should get classes list', async () => {
    const res = await api('GET', '/api/classes');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('should get schools list', async () => {
    const res = await api('GET', '/api/schools');
    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toBe('上海星河湾双语学校');
  });

  it('should get config', async () => {
    const res = await api('GET', '/api/config');
    expect(res.status).toBe(200);
    expect(res.body.data.schoolName).toBe('上海星河湾双语学校');
  });
});

describe('Recipe CRUD', () => {
  let teacherToken;

  beforeAll(async () => {
    // Create a teacher via admin
    const adminLogin = await api('POST', '/auth/admin/login', { username: 'zx', password: '1qaz!QAZ' });
    const adminToken = adminLogin.body.data.token;

    await api('POST', '/admin/api/teachers', {
      phone: '13800138000', password: 'teacher123', name: '测试老师', schoolId: 1,
    }, adminToken);

    const teacherLogin = await api('POST', '/auth/teacher/login', {
      phone: '13800138000', password: 'teacher123',
    });
    teacherToken = teacherLogin.body.data.token;
  });

  it('should require auth for recipe PUT', async () => {
    const res = await api('PUT', '/api/recipes/daily/2025-10-26', { images: [], videos: [], notes: 'test', version: 1 });
    expect(res.status).toBe(401);
  });

  it('should create daily recipe', async () => {
    const res = await api('PUT', '/api/recipes/daily/2025-10-26', {
      images: [{ title: '全盘营养餐', dishName: '红烧肉', r2Key: '2025-10/2025-10-26-01.jpg', filename: '2025-10-26-01.jpg', order: 1 }],
      videos: [],
      notes: '今日特色',
      version: 1,
    }, teacherToken);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.id).toBe('daily_1_20251026');
  });

  it('should get daily recipe', async () => {
    const res = await api('GET', '/api/recipes/daily/2025-10-26', null, teacherToken);
    expect(res.status).toBe(200);
    expect(res.body.data.date).toBe('2025-10-26');
    expect(res.body.data.images).toHaveLength(1);
    expect(res.body.data.images[0].dishName).toBe('红烧肉');
  });

  it('should return not found for empty date', async () => {
    const res = await api('GET', '/api/recipes/daily/2025-12-25', null, teacherToken);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(4001);
  });
});

describe('Date/Week Utilities (ISO 8601)', () => {
  it('2025-12-29 should be 2026-W01', async () => {
    const { getISOWeek } = await import('../worker/src/utils/dateUtils.js');
    const result = getISOWeek('2025-12-29');
    expect(result.year).toBe(2026);
    expect(result.weekNumber).toBe(1);
    expect(result.yearWeek).toBe('2026-W01');
  });

  it('2024-12-30 should be 2025-W01', async () => {
    const { getISOWeek } = await import('../worker/src/utils/dateUtils.js');
    const result = getISOWeek('2024-12-30');
    expect(result.year).toBe(2025);
    expect(result.weekNumber).toBe(1);
  });

  it('2026-01-05 should be 2026-W02', async () => {
    const { getISOWeek } = await import('../worker/src/utils/dateUtils.js');
    const result = getISOWeek('2026-01-05');
    expect(result.year).toBe(2026);
    expect(result.weekNumber).toBe(2);
  });
});
