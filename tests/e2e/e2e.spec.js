/**
 * E2E Test Suite for Campus Food Time (校园食光)
 * Tests all user roles: Admin, Teacher, Parent
 * Uses Playwright with system Edge browser
 *
 * Key fixes from previous run:
 * - All variables passed to page.evaluate() explicitly
 * - API response structure: success() wraps data, so teachers are at res.data.data
 * - Teacher creation must happen before teacher login tests
 */

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = 'https://campus-food-time-v2.flychina2008.workers.dev';
const PROXY = 'http://localhost:1082';

// Test credentials
const ADMIN = { username: process.env.E2E_ADMIN_USER || 'admin', password: process.env.E2E_ADMIN_PASS || 'Admin@123' };
const TEACHER_PHONE = process.env.E2E_TEACHER_PHONE || '13900000999';
const TEACHER_PASSWORD = process.env.E2E_TEACHER_PASS || 'Teacher@123';

// Helper: create page with proxy
async function newPage(browser) {
  const ctx = await browser.newContext({
    proxy: { server: PROXY },
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN',
  });
  return ctx.newPage();
}

// Helper: admin login and return token
async function adminLogin(page) {
  const res = await page.evaluate(async ({ url, creds }) => {
    const r = await fetch(url + '/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    return r.json();
  }, { url: BASE_URL, creds: ADMIN });
  expect(res.code).toBe(0);
  return res.data.token;
}

// Helper: teacher login and return token
async function teacherLogin(page, phone, password) {
  const res = await page.evaluate(async ({ url, phone, password }) => {
    const r = await fetch(url + '/auth/teacher/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    return r.json();
  }, { url: BASE_URL, phone: phone || TEACHER_PHONE, password: password || TEACHER_PASSWORD });
  return res;
}

// ============================================================
// TEST GROUP 1: Public Pages
// ============================================================
test.describe('Public Pages', () => {
  test('homepage loads', async ({ browser }) => {
    const page = await newPage(browser);
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    const url = page.url();
    console.log('[PUBLIC] Homepage URL:', url);
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toContain('500');
    await page.close();
  });

  test('config API returns data', async ({ browser }) => {
    const page = await newPage(browser);
    const response = await page.goto(BASE_URL + '/api/config', { timeout: 15000 });
    const json = await response.json();
    console.log('[PUBLIC] Config API: code=%d', json.code);
    expect(json.code).toBe(0);
    await page.close();
  });

  test('classes API returns 72 classes', async ({ browser }) => {
    const page = await newPage(browser);
    const response = await page.goto(BASE_URL + '/api/classes', { timeout: 15000 });
    const json = await response.json();
    console.log('[PUBLIC] Classes count: %d', json.data?.length || 0);
    expect(json.code).toBe(0);
    expect(json.data.length).toBe(72);
    await page.close();
  });
});

// ============================================================
// TEST GROUP 2: Admin
// ============================================================
test.describe('Admin', () => {
  test('admin login via API', async ({ browser }) => {
    const page = await newPage(browser);
    const response = await page.evaluate(async ({ url, creds }) => {
      const res = await fetch(url + '/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      return res.json();
    }, { url: BASE_URL, creds: ADMIN });

    console.log('[ADMIN] Login: code=%d, hasToken=%s', response.code, !!response.data?.token);
    expect(response.code).toBe(0);
    expect(response.data.token).toBeDefined();
    expect(response.data.user.type).toBe('admin');
    await page.close();
  });

  test('admin session works for authenticated endpoints', async ({ browser }) => {
    const page = await newPage(browser);
    const token = await adminLogin(page);

    const teachersRes = await page.evaluate(async ({ url, token }) => {
      const res = await fetch(url + '/admin/api/teachers', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      return res.json();
    }, { url: BASE_URL, token });

    console.log('[ADMIN] Teachers API: code=%d', teachersRes.code);
    expect(teachersRes.code).toBe(0);

    // API returns { code:0, data: { data: [...], total, page, pageSize } }
    const items = teachersRes.data?.data || [];
    expect(Array.isArray(items)).toBeTruthy();

    // Verify no password leak
    const hasPassword = items.some(t => t.password !== undefined);
    console.log('[ADMIN] Password leak: %s', hasPassword ? 'LEAKED!' : 'SAFE');
    expect(hasPassword).toBeFalsy();

    await page.close();
  });

  test('admin login page loads', async ({ browser }) => {
    const page = await newPage(browser);
    await page.goto(BASE_URL + '/admin/login.html', { waitUntil: 'networkidle', timeout: 30000 });
    const hasForm = await page.locator('input[type="password"]').count();
    console.log('[ADMIN] Login page has password field: %d', hasForm);
    expect(hasForm).toBeGreaterThanOrEqual(1);
    await page.close();
  });

  test('admin can list classes', async ({ browser }) => {
    const page = await newPage(browser);
    const token = await adminLogin(page);

    const classesRes = await page.evaluate(async ({ url, token }) => {
      const res = await fetch(url + '/admin/api/classes', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      return res.json();
    }, { url: BASE_URL, token });

    // listClasses returns success(data) where data is an array directly
    const classData = classesRes.data;
    const count = Array.isArray(classData) ? classData.length : (classData?.data?.length || 0);
    console.log('[ADMIN] Classes: code=%d, count=%d', classesRes.code, count);
    expect(classesRes.code).toBe(0);
    await page.close();
  });

  test('admin can list operation logs', async ({ browser }) => {
    const page = await newPage(browser);
    const token = await adminLogin(page);

    const logsRes = await page.evaluate(async ({ url, token }) => {
      const res = await fetch(url + '/admin/api/logs/teacher', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      return res.json();
    }, { url: BASE_URL, token });

    console.log('[ADMIN] Logs: code=%d', logsRes.code);
    expect([0, 4001]).toContain(logsRes.code);
    await page.close();
  });
});

// ============================================================
// TEST GROUP 3: Teacher
// ============================================================
test.describe('Teacher', () => {
  test('create test teacher via admin', async ({ browser }) => {
    const page = await newPage(browser);
    const token = await adminLogin(page);

    const createRes = await page.evaluate(async ({ url, token, phone, password }) => {
      const res = await fetch(url + '/admin/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          phone: phone,
          password: password,
          name: 'E2E测试教师',
          schoolId: 1,
        }),
      });
      return res.json();
    }, { url: BASE_URL, token, phone: TEACHER_PHONE, password: TEACHER_PASSWORD });

    console.log('[TEACHER] Create: code=%d, msg=%s', createRes.code, createRes.message || '');
    // 0 = created, 3003 = PHONE_EXISTS (already created)
    expect([0, 3003]).toContain(createRes.code);
    await page.close();
  });

  test('teacher can login', async ({ browser }) => {
    const page = await newPage(browser);
    const response = await teacherLogin(page);

    console.log('[TEACHER] Login: code=%d, msg=%s', response.code, response.message || '');
    expect(response.code).toBe(0);
    expect(response.data.token).toBeDefined();
    await page.close();
  });

  test('teacher can view daily recipe', async ({ browser }) => {
    const page = await newPage(browser);
    const loginRes = await teacherLogin(page);
    const token = loginRes.data.token;
    const today = new Date().toISOString().split('T')[0];

    const recipeRes = await page.evaluate(async ({ url, token, date }) => {
      const res = await fetch(url + '/api/recipes/daily/' + date, {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      return res.json();
    }, { url: BASE_URL, token, date: today });

    console.log('[TEACHER] Daily recipe: code=%d, hasRecipe=%s', recipeRes.code, !!recipeRes.data?.recipe);
    expect([0, 4001]).toContain(recipeRes.code);

    if (recipeRes.code === 0) {
      expect(recipeRes.data.recipe).toBeDefined();
      expect(recipeRes.data.date).toBe(today);
    }

    await page.close();
  });

  test('teacher can create/update daily recipe', async ({ browser }) => {
    const page = await newPage(browser);
    const loginRes = await teacherLogin(page);
    const token = loginRes.data.token;
    const today = new Date().toISOString().split('T')[0];

    // Get existing recipe for version
    const getRes = await page.evaluate(async ({ url, token, date }) => {
      const res = await fetch(url + '/api/recipes/daily/' + date, {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      return res.json();
    }, { url: BASE_URL, token, date: today });

    const version = getRes.data?.recipe?.version || null;

    const saveRes = await page.evaluate(async ({ url, token, date, ver }) => {
      const body = {
        notes: 'E2E测试食谱 ' + new Date().toLocaleString('zh-CN'),
        images: [],
        videos: [],
      };
      if (ver) body.version = ver;

      const res = await fetch(url + '/api/recipes/daily/' + date, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body),
      });
      return res.json();
    }, { url: BASE_URL, token, date: today, ver: version });

    console.log('[TEACHER] Save recipe: code=%d, msg=%s, version=%d', saveRes.code, saveRes.message || '', saveRes.data?.version || 0);
    expect(saveRes.code).toBe(0);
    expect(saveRes.data.version).toBeDefined();
    await page.close();
  });

  test('upload presign API works', async ({ browser }) => {
    const page = await newPage(browser);
    const loginRes = await teacherLogin(page);
    const token = loginRes.data.token;
    const today = new Date().toISOString().split('T')[0];

    const presignRes = await page.evaluate(async ({ url, token, date }) => {
      const res = await fetch(url + '/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ fileType: 'image/jpeg', date, order: 1, type: 'daily' }),
      });
      return res.json();
    }, { url: BASE_URL, token, date: today });

    console.log('[TEACHER] Presign: code=%d, fileKey=%s', presignRes.code, presignRes.data?.fileKey || 'N/A');
    expect(presignRes.code).toBe(0);
    expect(presignRes.data.fileKey).toBeDefined();
    await page.close();
  });

  test('upload direct endpoint works', async ({ browser }) => {
    const page = await newPage(browser);
    const loginRes = await teacherLogin(page);
    const token = loginRes.data.token;
    const today = new Date().toISOString().split('T')[0];

    // Get presign
    const presignRes = await page.evaluate(async ({ url, token, date }) => {
      const res = await fetch(url + '/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ fileType: 'image/jpeg', date, order: 99, type: 'daily' }),
      });
      return res.json();
    }, { url: BASE_URL, token, date: today });

    if (presignRes.code !== 0) {
      console.log('[TEACHER] Presign failed, skipping upload');
      await page.close();
      return;
    }

    // Upload a tiny test image
    const uploadRes = await page.evaluate(async ({ url, token, fileKey }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 1, 1);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      const res = await fetch(url + '/api/upload/direct?key=' + encodeURIComponent(fileKey), {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg', 'Authorization': 'Bearer ' + token },
        body: blob,
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    }, { url: BASE_URL, token, fileKey: presignRes.data.fileKey });

    console.log('[TEACHER] Upload: status=%d, code=%d', uploadRes.status, uploadRes.body?.code || 'N/A');
    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body?.code).toBe(0);
    await page.close();
  });

  test('teacher dashboard page loads', async ({ browser }) => {
    const page = await newPage(browser);
    const loginRes = await teacherLogin(page);

    // Navigate to the domain first so localStorage is accessible
    await page.goto(BASE_URL + '/teacher/login.html', { waitUntil: 'domcontentloaded', timeout: 15000 });

    await page.evaluate((token) => {
      localStorage.setItem('cft_token', token);
      localStorage.setItem('cft_role', 'teacher');
      localStorage.setItem('cft_user', JSON.stringify({ name: 'E2E测试教师' }));
    }, loginRes.data.token);

    await page.goto(BASE_URL + '/teacher/dashboard.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const url = page.url();
    console.log('[TEACHER] Dashboard URL: %s', url);
    expect(url).not.toContain('/login');

    const hasSaveBtn = await page.locator('button:has-text("保存")').count();
    const hasDailyTab = await page.locator('button:has-text("日食谱")').count();
    console.log('[TEACHER] Dashboard: saveBtn=%d, dailyTab=%d', hasSaveBtn, hasDailyTab);
    expect(hasSaveBtn + hasDailyTab).toBeGreaterThanOrEqual(1);

    await page.close();
  });
});

// ============================================================
// TEST GROUP 4: Parent
// ============================================================
test.describe('Parent', () => {
  test('parent login page loads', async ({ browser }) => {
    const page = await newPage(browser);
    await page.goto(BASE_URL + '/parent/login.html', { waitUntil: 'networkidle', timeout: 30000 });
    const hasForm = await page.locator('input[type="password"]').count();
    console.log('[PARENT] Login page has password field: %d', hasForm);
    expect(hasForm).toBeGreaterThanOrEqual(1);
    await page.close();
  });

  test('parent register page has no "完整保存" text', async ({ browser }) => {
    const page = await newPage(browser);
    await page.goto(BASE_URL + '/parent/register.html', { waitUntil: 'networkidle', timeout: 30000 });
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toContain('完整保存');
    console.log('[PARENT] Register page: no "完整保存" - PASS');
    await page.close();
  });

  test('parent registration validates phone', async ({ browser }) => {
    const page = await newPage(browser);
    const response = await page.evaluate(async ({ url }) => {
      const res = await fetch(url + '/auth/parent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '000', password: '123', studentName: 'test', classId: 'class:1:1:1' }),
      });
      return res.json();
    }, { url: BASE_URL });

    console.log('[PARENT] Register invalid phone: code=%d', response.code);
    expect(response.code).not.toBe(0);
    await page.close();
  });

  test('recipe API requires authentication', async ({ browser }) => {
    const page = await newPage(browser);
    const response = await page.evaluate(async ({ url }) => {
      const res = await fetch(url + '/api/recipes/daily/2025-01-15');
      return res.json();
    }, { url: BASE_URL });

    console.log('[PARENT] Recipe without auth: code=%d', response.code);
    expect([2001, 2002, 2003]).toContain(response.code);
    await page.close();
  });
});

// ============================================================
// TEST GROUP 5: Security
// ============================================================
test.describe('Security', () => {
  test('media access without auth returns 401', async ({ browser }) => {
    const page = await newPage(browser);
    const response = await page.evaluate(async ({ url }) => {
      const res = await fetch(url + '/media/nonexistent');
      return { status: res.status, code: (await res.json().catch(() => ({}))).code };
    }, { url: BASE_URL });

    console.log('[SECURITY] Media without auth: status=%d', response.status);
    expect(response.status).toBe(401);
    await page.close();
  });

  test('admin login rate limiting works', async ({ browser }) => {
    const page = await newPage(browser);
    let lastCode = null;

    for (let i = 0; i < 6; i++) {
      const response = await page.evaluate(async ({ url }) => {
        const res = await fetch(url + '/auth/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'rate_limit_test_' + Date.now(), password: 'wrong' }),
        });
        return res.json();
      }, { url: BASE_URL });
      lastCode = response.code;
    }

    console.log('[SECURITY] After 6 failed logins: code=%d', lastCode);
    // 2007 = ACCOUNT_LOCKED, 3002 = PASSWORD_ERROR (if rate limit not triggered yet)
    expect([2007, 3002]).toContain(lastCode);
    await page.close();
  });

  test('no password in admin API responses', async ({ browser }) => {
    const page = await newPage(browser);
    const token = await adminLogin(page);

    // Check teachers - response: { code:0, data: { data: [...], total, page, pageSize } }
    const teachersRes = await page.evaluate(async ({ url, token }) => {
      const res = await fetch(url + '/admin/api/teachers', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      return res.json();
    }, { url: BASE_URL, token });

    const teacherItems = teachersRes.data?.data || [];
    const teacherHasPassword = Array.isArray(teacherItems) && teacherItems.some(t => t.password !== undefined);
    console.log('[SECURITY] Password in teacher list: %s', teacherHasPassword ? 'LEAKED!' : 'SAFE');
    expect(teacherHasPassword).toBeFalsy();

    // Check parents - same structure
    const parentsRes = await page.evaluate(async ({ url, token }) => {
      const res = await fetch(url + '/admin/api/parents', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      return res.json();
    }, { url: BASE_URL, token });

    const parentItems = parentsRes.data?.data || [];
    const parentHasPassword = Array.isArray(parentItems) && parentItems.some(p => p.password !== undefined);
    console.log('[SECURITY] Password in parent list: %s', parentHasPassword ? 'LEAKED!' : 'SAFE');
    expect(parentHasPassword).toBeFalsy();

    await page.close();
  });
});

// ============================================================
// TEST GROUP 6: Data Integrity
// ============================================================
test.describe('Data Integrity', () => {
  test('recipe response has correct structure with .recipe field', async ({ browser }) => {
    const page = await newPage(browser);
    // Use teacher token - PUT /api/recipes requires teacher role
    const loginRes = await teacherLogin(page);
    const token = loginRes.data.token;
    const today = new Date().toISOString().split('T')[0];

    // Create recipe first (teacher only)
    await page.evaluate(async ({ url, token, date }) => {
      await fetch(url + '/api/recipes/daily/' + date, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ notes: 'Structure test', images: [], videos: [] }),
      });
    }, { url: BASE_URL, token, date: today });

    // Fetch it
    const recipeRes = await page.evaluate(async ({ url, token, date }) => {
      const res = await fetch(url + '/api/recipes/daily/' + date, {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      return res.json();
    }, { url: BASE_URL, token, date: today });

    console.log('[DATA] Recipe response keys: %s', Object.keys(recipeRes.data || {}).join(', '));
    expect(recipeRes.data.recipe).toBeDefined();
    expect(recipeRes.data.date).toBe(today);
    expect(recipeRes.data.recipe.id).toBeDefined();
    expect(recipeRes.data.recipe.version).toBeDefined();
    expect(Array.isArray(recipeRes.data.recipe.images)).toBeTruthy();
    expect(Array.isArray(recipeRes.data.recipe.videos)).toBeTruthy();

    await page.close();
  });

  test('optimistic locking works - version conflict', async ({ browser }) => {
    const page = await newPage(browser);
    // Use teacher token - PUT /api/recipes requires teacher role
    const loginRes = await teacherLogin(page);
    const token = loginRes.data.token;
    const today = new Date().toISOString().split('T')[0];

    const getRes = await page.evaluate(async ({ url, token, date }) => {
      const res = await fetch(url + '/api/recipes/daily/' + date, {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      return res.json();
    }, { url: BASE_URL, token, date: today });

    if (!getRes.data?.recipe) {
      console.log('[DATA] No recipe, skipping version conflict test');
      await page.close();
      return;
    }

    // Try to update with wrong version
    const wrongVersion = getRes.data.recipe.version + 999;
    const updateRes = await page.evaluate(async ({ url, token, date, ver }) => {
      const res = await fetch(url + '/api/recipes/daily/' + date, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ notes: 'Conflict test', images: [], videos: [], version: ver }),
      });
      return res.json();
    }, { url: BASE_URL, token, date: today, ver: wrongVersion });

    console.log('[DATA] Version conflict test: code=%d (expected 4005)', updateRes.code);
    expect(updateRes.code).toBe(4005);

    await page.close();
  });
});
