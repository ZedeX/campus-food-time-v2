// Admin routes: all endpoints require admin session
import { success, error, parseBody, unauthorized, forbidden, notFound, conflict, ERROR_CODES } from '../utils/response.js';
import { verifySession, logOperation } from '../services/authService.js';
import { generateToken, generateUserId, encryptPassword, decryptPassword } from '../utils/crypto.js';
import { isValidPhone, getISOWeek, getWeekDateRange, parseYearWeek, normalizeDishName, getIdParts } from '../utils/dateUtils.js';
import { USER_TYPES, LOG_ACTIONS } from '../utils/constants.js';
import * as recipeService from '../services/recipeService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Verify the caller is an admin; returns { user } or { error }
async function requireAdmin(request, env) {
  const user = await verifySession(request, env);
  if (!user) return { error: unauthorized() };
  if (user.type !== USER_TYPES.ADMIN) return { error: forbidden() };
  return { user };
}

// Convert snake_case key to camelCase
function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// Convert a row object's keys to camelCase
function toCamelCase(obj) {
  if (!obj) return null;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
}

// Parse page/pageSize from query string, returns { page, pageSize, offset }
function parsePagination(url) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.max(1, Math.min(200, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

// Get secret for password encryption/decryption
function getSecret(env) {
  return env.JWT_SECRET || 'default-secret';
}

// Format a daily recipe row for admin list view
function formatDailyRow(row, mediaCount) {
  return {
    id: row.id,
    date: row.date,
    schoolId: row.school_id,
    notes: row.notes,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mediaCount,
  };
}

// Format a weekly recipe row for admin list view
function formatWeeklyRow(row, mediaCount) {
  return {
    id: row.id,
    yearWeek: row.year_week,
    year: row.year,
    weekNumber: row.week_number,
    startDate: row.start_date,
    endDate: row.end_date,
    schoolId: row.school_id,
    notes: row.notes,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mediaCount,
  };
}

// Count media for a recipe
async function countMedia(db, recipeId) {
  const r = await db.prepare('SELECT COUNT(*) as c FROM recipe_media WHERE recipe_id = ?').bind(recipeId).first();
  return r ? r.c : 0;
}

// ---------------------------------------------------------------------------
// Recipe management — Daily
// ---------------------------------------------------------------------------

async function listDaily(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(url);
    const schoolId = url.searchParams.get('schoolId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const conditions = [];
    const values = [];
    if (schoolId) {
      conditions.push('school_id = ?');
      values.push(parseInt(schoolId, 10));
    }
    if (startDate) {
      conditions.push('date >= ?');
      values.push(startDate);
    }
    if (endDate) {
      conditions.push('date <= ?');
      values.push(endDate);
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM daily_recipes ${where}`).bind(...values).first();
    const total = countResult ? countResult.total : 0;

    const result = await env.DB.prepare(
      `SELECT * FROM daily_recipes ${where} ORDER BY date DESC LIMIT ? OFFSET ?`
    ).bind(...values, pageSize, offset).all();

    const rows = result.results || [];
    const data = [];
    for (const row of rows) {
      const mediaCount = await countMedia(env.DB, row.id);
      data.push(formatDailyRow(row, mediaCount));
    }

    return success({ data, total, page, pageSize });
  } catch (err) {
    console.error('listDaily error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function updateDaily(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const body = await parseBody(request);
    if (!body) return error(ERROR_CODES.MISSING_PARAMS);

    const existing = await env.DB.prepare('SELECT * FROM daily_recipes WHERE id = ?').bind(id).first();
    if (!existing) return notFound(ERROR_CODES.RECIPE_NOT_FOUND);

    // Snapshot current state before admin edit
    await recipeService.createSnapshot(id, 'daily', auth.user.id, env);

    const newVersion = existing.version + 1;
    await env.DB.prepare(
      'UPDATE daily_recipes SET notes = ?, version = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(body.notes ?? existing.notes, newVersion, id).run();

    // Invalidate cache
    if (env.CACHE) {
      await env.CACHE.delete(`recipe:daily:${existing.school_id}:${existing.date}`);
    }

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.UPDATE_RECIPE, id, 'success');
    return success({ id, version: newVersion }, '更新成功');
  } catch (err) {
    console.error('updateDaily error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function deleteDaily(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const existing = await env.DB.prepare('SELECT * FROM daily_recipes WHERE id = ?').bind(id).first();
    if (!existing) return notFound(ERROR_CODES.RECIPE_NOT_FOUND);

    // Delete recipe record (cascade removes media + snapshots); R2 files are preserved
    await env.DB.prepare('DELETE FROM daily_recipes WHERE id = ?').bind(id).run();

    if (env.CACHE) {
      await env.CACHE.delete(`recipe:daily:${existing.school_id}:${existing.date}`);
    }

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.DELETE_RECIPE, id, 'success');
    return success(null, '删除成功');
  } catch (err) {
    console.error('deleteDaily error:', err);
    return error(ERROR_CODES.RECIPE_DELETE_FAILED, 500);
  }
}

async function dailyHistory(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const history = await recipeService.getRecipeHistory(id, env);
    const data = history.map((h) => ({
      id: h.id,
      version: h.version,
      createdAt: h.created_at,
      createdBy: h.created_by,
      isPinned: h.is_pinned,
    }));
    return success(data);
  } catch (err) {
    console.error('dailyHistory error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function dailyRollback(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const body = await parseBody(request);
    if (!body || body.version === undefined) return error(ERROR_CODES.MISSING_PARAMS);

    const result = await recipeService.rollbackRecipe(id, body.version, env, auth.user.id);
    if (result.error === 'SNAPSHOT_NOT_FOUND') return notFound(ERROR_CODES.RECIPE_NOT_FOUND);
    if (result.error === 'RECIPE_NOT_FOUND') return notFound(ERROR_CODES.RECIPE_NOT_FOUND);

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.ROLLBACK_RECIPE, id, 'success');
    return success(result, '回滚成功');
  } catch (err) {
    console.error('dailyRollback error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

// ---------------------------------------------------------------------------
// Recipe management — Weekly
// ---------------------------------------------------------------------------

async function listWeekly(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(url);
    const schoolId = url.searchParams.get('schoolId');
    const startWeek = url.searchParams.get('startWeek');
    const endWeek = url.searchParams.get('endWeek');

    const conditions = [];
    const values = [];
    if (schoolId) {
      conditions.push('school_id = ?');
      values.push(parseInt(schoolId, 10));
    }
    if (startWeek) {
      conditions.push('year_week >= ?');
      values.push(startWeek);
    }
    if (endWeek) {
      conditions.push('year_week <= ?');
      values.push(endWeek);
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM weekly_recipes ${where}`).bind(...values).first();
    const total = countResult ? countResult.total : 0;

    const result = await env.DB.prepare(
      `SELECT * FROM weekly_recipes ${where} ORDER BY year_week DESC LIMIT ? OFFSET ?`
    ).bind(...values, pageSize, offset).all();

    const rows = result.results || [];
    const data = [];
    for (const row of rows) {
      const mediaCount = await countMedia(env.DB, row.id);
      data.push(formatWeeklyRow(row, mediaCount));
    }

    return success({ data, total, page, pageSize });
  } catch (err) {
    console.error('listWeekly error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function updateWeekly(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const body = await parseBody(request);
    if (!body) return error(ERROR_CODES.MISSING_PARAMS);

    const existing = await env.DB.prepare('SELECT * FROM weekly_recipes WHERE id = ?').bind(id).first();
    if (!existing) return notFound(ERROR_CODES.RECIPE_NOT_FOUND);

    await recipeService.createSnapshot(id, 'weekly', auth.user.id, env);

    const newVersion = existing.version + 1;
    await env.DB.prepare(
      'UPDATE weekly_recipes SET notes = ?, version = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(body.notes ?? existing.notes, newVersion, id).run();

    if (env.CACHE) {
      await env.CACHE.delete(`recipe:weekly:${existing.school_id}:${existing.year_week}`);
    }

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.UPDATE_RECIPE, id, 'success');
    return success({ id, version: newVersion }, '更新成功');
  } catch (err) {
    console.error('updateWeekly error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function deleteWeekly(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const existing = await env.DB.prepare('SELECT * FROM weekly_recipes WHERE id = ?').bind(id).first();
    if (!existing) return notFound(ERROR_CODES.RECIPE_NOT_FOUND);

    await env.DB.prepare('DELETE FROM weekly_recipes WHERE id = ?').bind(id).run();

    if (env.CACHE) {
      await env.CACHE.delete(`recipe:weekly:${existing.school_id}:${existing.year_week}`);
    }

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.DELETE_RECIPE, id, 'success');
    return success(null, '删除成功');
  } catch (err) {
    console.error('deleteWeekly error:', err);
    return error(ERROR_CODES.RECIPE_DELETE_FAILED, 500);
  }
}

async function weeklyHistory(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const history = await recipeService.getRecipeHistory(id, env);
    const data = history.map((h) => ({
      id: h.id,
      version: h.version,
      createdAt: h.created_at,
      createdBy: h.created_by,
      isPinned: h.is_pinned,
    }));
    return success(data);
  } catch (err) {
    console.error('weeklyHistory error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function weeklyRollback(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const body = await parseBody(request);
    if (!body || body.version === undefined) return error(ERROR_CODES.MISSING_PARAMS);

    const result = await recipeService.rollbackRecipe(id, body.version, env, auth.user.id);
    if (result.error === 'SNAPSHOT_NOT_FOUND') return notFound(ERROR_CODES.RECIPE_NOT_FOUND);
    if (result.error === 'RECIPE_NOT_FOUND') return notFound(ERROR_CODES.RECIPE_NOT_FOUND);

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.ROLLBACK_RECIPE, id, 'success');
    return success(result, '回滚成功');
  } catch (err) {
    console.error('weeklyRollback error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

// ---------------------------------------------------------------------------
// Teacher account management
// ---------------------------------------------------------------------------

async function listTeachers(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(url);
    const schoolId = url.searchParams.get('schoolId');
    const keyword = url.searchParams.get('keyword');

    const conditions = ["type = 'teacher'"];
    const values = [];
    if (schoolId) {
      conditions.push('school_id = ?');
      values.push(parseInt(schoolId, 10));
    }
    if (keyword) {
      conditions.push('(name LIKE ? OR phone LIKE ?)');
      values.push(`%${keyword}%`, `%${keyword}%`);
    }
    const where = 'WHERE ' + conditions.join(' AND ');

    const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM users ${where}`).bind(...values).first();
    const total = countResult ? countResult.total : 0;

    const result = await env.DB.prepare(
      `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...values, pageSize, offset).all();

    const secret = getSecret(env);
    const data = (result.results || []).map((t) => ({
      id: t.id,
      type: t.type,
      phone: t.phone,
      password: decryptPassword(t.password, secret),
      name: t.name,
      schoolId: t.school_id,
      status: t.status,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return success({ data, total, page, pageSize });
  } catch (err) {
    console.error('listTeachers error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function createTeacher(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const body = await parseBody(request);
    if (!body || !body.phone || !body.password || !body.name) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }
    if (!isValidPhone(body.phone)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }

    // Check phone uniqueness
    const existing = await env.DB.prepare('SELECT id FROM users WHERE phone = ?').bind(body.phone).first();
    if (existing) return error(ERROR_CODES.PHONE_EXISTS);

    const userId = generateUserId('teacher');
    const encrypted = encryptPassword(body.password, getSecret(env));
    const schoolId = body.schoolId || 1;

    await env.DB.prepare(
      'INSERT INTO users (id, type, phone, password, name, school_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, USER_TYPES.TEACHER, body.phone, encrypted, body.name, schoolId).run();

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.CREATE_USER, userId, 'success', JSON.stringify({ phone: body.phone, name: body.name }));
    return success({ id: userId, phone: body.phone, name: body.name, schoolId }, '创建成功');
  } catch (err) {
    console.error('createTeacher error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function updateTeacher(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const body = await parseBody(request);
    if (!body) return error(ERROR_CODES.MISSING_PARAMS);

    const existing = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND type = ?').bind(id, USER_TYPES.TEACHER).first();
    if (!existing) return notFound(ERROR_CODES.USER_NOT_FOUND);

    const phone = body.phone || existing.phone;
    const name = body.name || existing.name;
    const schoolId = body.schoolId !== undefined ? body.schoolId : existing.school_id;
    const status = body.status || existing.status;

    // If phone changed, check uniqueness
    if (phone !== existing.phone) {
      if (!isValidPhone(phone)) return error(ERROR_CODES.INVALID_FORMAT);
      const dup = await env.DB.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').bind(phone, id).first();
      if (dup) return error(ERROR_CODES.PHONE_EXISTS);
    }

    // If password provided, re-encrypt; otherwise keep existing
    let password = existing.password;
    if (body.password) {
      password = encryptPassword(body.password, getSecret(env));
    }

    await env.DB.prepare(
      'UPDATE users SET phone = ?, password = ?, name = ?, school_id = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(phone, password, name, schoolId, status, id).run();

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.UPDATE_USER, id, 'success');
    return success({ id }, '更新成功');
  } catch (err) {
    console.error('updateTeacher error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function deleteTeacher(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const existing = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND type = ?').bind(id, USER_TYPES.TEACHER).first();
    if (!existing) return notFound(ERROR_CODES.USER_NOT_FOUND);

    // Check if teacher has recipes (foreign key constraint)
    const recipeCount = await env.DB.prepare('SELECT COUNT(*) as c FROM daily_recipes WHERE created_by = ?').bind(id).first();
    if (recipeCount && recipeCount.c > 0) {
      return error(ERROR_CODES.SYSTEM_ERROR, 400, { hint: '该教师有创建的食谱记录，无法删除' });
    }

    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.DELETE_USER, id, 'success');
    return success(null, '删除成功');
  } catch (err) {
    console.error('deleteTeacher error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

// ---------------------------------------------------------------------------
// Parent account management
// ---------------------------------------------------------------------------

async function listParents(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(url);
    const keyword = url.searchParams.get('keyword');

    const conditions = ["type = 'parent'"];
    const values = [];
    if (keyword) {
      conditions.push('(name LIKE ? OR phone LIKE ?)');
      values.push(`%${keyword}%`, `%${keyword}%`);
    }
    const where = 'WHERE ' + conditions.join(' AND ');

    const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM users ${where}`).bind(...values).first();
    const total = countResult ? countResult.total : 0;

    const result = await env.DB.prepare(
      `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...values, pageSize, offset).all();

    const secret = getSecret(env);
    const parents = result.results || [];
    const data = [];

    for (const p of parents) {
      // Fetch student relations
      const relResult = await env.DB.prepare(
        `SELECT r.relation, s.name as student_name, s.id as student_id, c.name as class_name
         FROM parent_student_relations r
         JOIN students s ON r.student_id = s.id
         JOIN classes c ON s.class_id = c.id
         WHERE r.parent_user_id = ?`
      ).bind(p.id).all();

      data.push({
        id: p.id,
        type: p.type,
        phone: p.phone,
        password: decryptPassword(p.password, secret),
        name: p.name,
        schoolId: p.school_id,
        status: p.status,
        students: (relResult.results || []).map((r) => ({
          studentId: r.student_id,
          studentName: r.student_name,
          className: r.class_name,
          relation: r.relation,
        })),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      });
    }

    return success({ data, total, page, pageSize });
  } catch (err) {
    console.error('listParents error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function updateParent(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const body = await parseBody(request);
    if (!body) return error(ERROR_CODES.MISSING_PARAMS);

    const existing = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND type = ?').bind(id, USER_TYPES.PARENT).first();
    if (!existing) return notFound(ERROR_CODES.USER_NOT_FOUND);

    const phone = body.phone || existing.phone;
    const name = body.name || existing.name;
    const status = body.status || existing.status;

    if (phone !== existing.phone) {
      if (!isValidPhone(phone)) return error(ERROR_CODES.INVALID_FORMAT);
      const dup = await env.DB.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').bind(phone, id).first();
      if (dup) return error(ERROR_CODES.PHONE_EXISTS);
    }

    let password = existing.password;
    if (body.password) {
      password = encryptPassword(body.password, getSecret(env));
    }

    await env.DB.prepare(
      'UPDATE users SET phone = ?, password = ?, name = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(phone, password, name, status, id).run();

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.UPDATE_USER, id, 'success');
    return success({ id }, '更新成功');
  } catch (err) {
    console.error('updateParent error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function deleteParent(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const existing = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND type = ?').bind(id, USER_TYPES.PARENT).first();
    if (!existing) return notFound(ERROR_CODES.USER_NOT_FOUND);

    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.DELETE_USER, id, 'success');
    return success(null, '删除成功');
  } catch (err) {
    console.error('deleteParent error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

// ---------------------------------------------------------------------------
// Class management
// ---------------------------------------------------------------------------

async function listClasses(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId');

    const conditions = [];
    const values = [];
    if (schoolId) {
      conditions.push('school_id = ?');
      values.push(parseInt(schoolId, 10));
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await env.DB.prepare(
      `SELECT * FROM classes ${where} ORDER BY grade, class_number`
    ).bind(...values).all();

    const data = (result.results || []).map((c) => ({
      id: c.id,
      name: c.name,
      grade: c.grade,
      classNumber: c.class_number,
      schoolId: c.school_id,
      visible: c.visible,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return success(data);
  } catch (err) {
    console.error('listClasses error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function createClass(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const body = await parseBody(request);
    if (!body || !body.name || body.grade === undefined || body.classNumber === undefined) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }

    const schoolId = body.schoolId || 1;
    const classId = `class:${schoolId}:${body.grade}:${body.classNumber}`;

    // Check if class already exists
    const existing = await env.DB.prepare('SELECT id FROM classes WHERE id = ?').bind(classId).first();
    if (existing) return error(ERROR_CODES.RECIPE_ALREADY_EXISTS);

    const visible = body.visible !== undefined ? (body.visible ? 1 : 0) : 1;

    await env.DB.prepare(
      'INSERT INTO classes (id, name, grade, class_number, school_id, visible) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(classId, body.name, body.grade, body.classNumber, schoolId, visible).run();

    return success({ id: classId }, '创建成功');
  } catch (err) {
    console.error('createClass error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function updateClass(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const body = await parseBody(request);
    if (!body) return error(ERROR_CODES.MISSING_PARAMS);

    const existing = await env.DB.prepare('SELECT * FROM classes WHERE id = ?').bind(id).first();
    if (!existing) return notFound(ERROR_CODES.CLASS_NOT_FOUND);

    const name = body.name || existing.name;
    const grade = body.grade !== undefined ? body.grade : existing.grade;
    const classNumber = body.classNumber !== undefined ? body.classNumber : existing.class_number;
    const visible = body.visible !== undefined ? (body.visible ? 1 : 0) : existing.visible;

    await env.DB.prepare(
      'UPDATE classes SET name = ?, grade = ?, class_number = ?, visible = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(name, grade, classNumber, visible, id).run();

    return success({ id }, '更新成功');
  } catch (err) {
    console.error('updateClass error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function deleteClass(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const existing = await env.DB.prepare('SELECT * FROM classes WHERE id = ?').bind(id).first();
    if (!existing) return notFound(ERROR_CODES.CLASS_NOT_FOUND);

    // Check if class has students
    const studentCount = await env.DB.prepare('SELECT COUNT(*) as c FROM students WHERE class_id = ?').bind(id).first();
    if (studentCount && studentCount.c > 0) {
      return error(ERROR_CODES.SYSTEM_ERROR, 400, { hint: '该班级有学生记录，无法删除' });
    }

    await env.DB.prepare('DELETE FROM classes WHERE id = ?').bind(id).run();
    return success(null, '删除成功');
  } catch (err) {
    console.error('deleteClass error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

// ---------------------------------------------------------------------------
// Student management
// ---------------------------------------------------------------------------

async function listStudents(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(url);
    const classId = url.searchParams.get('classId');
    const keyword = url.searchParams.get('keyword');

    const conditions = [];
    const values = [];
    if (classId) {
      conditions.push('s.class_id = ?');
      values.push(classId);
    }
    if (keyword) {
      conditions.push('s.name LIKE ?');
      values.push(`%${keyword}%`);
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM students s ${where}`
    ).bind(...values).first();
    const total = countResult ? countResult.total : 0;

    const result = await env.DB.prepare(
      `SELECT s.*, c.name as class_name, c.grade, c.class_number
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...values, pageSize, offset).all();

    const data = (result.results || []).map((s) => ({
      id: s.id,
      name: s.name,
      classId: s.class_id,
      className: s.class_name,
      grade: s.grade,
      classNumber: s.class_number,
      schoolId: s.school_id,
      idPrefix: s.id_prefix,
      idSuffix: s.id_suffix,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return success({ data, total, page, pageSize });
  } catch (err) {
    console.error('listStudents error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function createStudent(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const body = await parseBody(request);
    if (!body || !body.name || !body.classId) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }

    // Verify class exists
    const classInfo = await env.DB.prepare('SELECT school_id FROM classes WHERE id = ?').bind(body.classId).first();
    if (!classInfo) return notFound(ERROR_CODES.CLASS_NOT_FOUND);

    const studentId = generateUserId('student');
    const schoolId = classInfo.school_id;

    let idPrefix = null;
    let idSuffix = null;
    let idNumber = null;
    if (body.idNumber) {
      idNumber = body.idNumber;
      const parts = getIdParts(body.idNumber);
      idPrefix = parts.prefix;
      idSuffix = parts.suffix;
    }

    await env.DB.prepare(
      'INSERT INTO students (id, name, class_id, school_id, id_number, id_prefix, id_suffix) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, body.name, body.classId, schoolId, idNumber, idPrefix, idSuffix).run();

    return success({ id: studentId }, '创建成功');
  } catch (err) {
    console.error('createStudent error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function importStudents(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    // Accept CSV as raw text body or JSON with csv field
    let csv = '';
    const contentType = request.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const body = await parseBody(request);
      csv = body?.csv || '';
    } else {
      csv = await request.text();
    }

    if (!csv) return error(ERROR_CODES.MISSING_PARAMS);

    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return error(ERROR_CODES.MISSING_PARAMS);

    // Detect and skip header
    const firstLine = lines[0].toLowerCase();
    let startIdx = 0;
    if (firstLine.includes('name') && firstLine.includes('classid')) {
      startIdx = 1;
    }

    const results = { total: 0, success: 0, failed: 0, errors: [] };

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(',').map((s) => s.trim());
      if (parts.length < 2) {
        results.failed++;
        results.errors.push(`第 ${i + 1} 行: 格式错误`);
        continue;
      }

      const [name, classId, idNumber] = parts;
      if (!name || !classId) {
        results.failed++;
        results.errors.push(`第 ${i + 1} 行: 缺少姓名或班级ID`);
        continue;
      }

      try {
        const classInfo = await env.DB.prepare('SELECT school_id FROM classes WHERE id = ?').bind(classId).first();
        if (!classInfo) {
          results.failed++;
          results.errors.push(`第 ${i + 1} 行: 班级 ${classId} 不存在`);
          continue;
        }

        const studentId = generateUserId('student');
        let idPrefix = null;
        let idSuffix = null;
        if (idNumber) {
          const parts2 = getIdParts(idNumber);
          idPrefix = parts2.prefix;
          idSuffix = parts2.suffix;
        }

        await env.DB.prepare(
          'INSERT INTO students (id, name, class_id, school_id, id_number, id_prefix, id_suffix) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(studentId, name, classId, classInfo.school_id, idNumber || null, idPrefix, idSuffix).run();

        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push(`第 ${i + 1} 行: ${e.message}`);
      }
      results.total++;
    }

    return success(results, `导入完成: 成功 ${results.success} / 失败 ${results.failed}`);
  } catch (err) {
    console.error('importStudents error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function updateStudent(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const body = await parseBody(request);
    if (!body) return error(ERROR_CODES.MISSING_PARAMS);

    const existing = await env.DB.prepare('SELECT * FROM students WHERE id = ?').bind(id).first();
    if (!existing) return notFound(ERROR_CODES.STUDENT_NOT_FOUND);

    const name = body.name || existing.name;
    const classId = body.classId || existing.class_id;

    let idNumber = existing.id_number;
    let idPrefix = existing.id_prefix;
    let idSuffix = existing.id_suffix;
    if (body.idNumber !== undefined) {
      if (body.idNumber) {
        idNumber = body.idNumber;
        const parts = getIdParts(body.idNumber);
        idPrefix = parts.prefix;
        idSuffix = parts.suffix;
      } else {
        idNumber = null;
        idPrefix = null;
        idSuffix = null;
      }
    }

    await env.DB.prepare(
      'UPDATE students SET name = ?, class_id = ?, id_number = ?, id_prefix = ?, id_suffix = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(name, classId, idNumber, idPrefix, idSuffix, id).run();

    return success({ id }, '更新成功');
  } catch (err) {
    console.error('updateStudent error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function deleteStudent(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const existing = await env.DB.prepare('SELECT * FROM students WHERE id = ?').bind(id).first();
    if (!existing) return notFound(ERROR_CODES.STUDENT_NOT_FOUND);

    await env.DB.prepare('DELETE FROM students WHERE id = ?').bind(id).run();
    return success(null, '删除成功');
  } catch (err) {
    console.error('deleteStudent error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

// ---------------------------------------------------------------------------
// Semester management
// ---------------------------------------------------------------------------

async function listSemesters(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId');

    const conditions = [];
    const values = [];
    if (schoolId) {
      conditions.push('school_id = ?');
      values.push(parseInt(schoolId, 10));
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await env.DB.prepare(
      `SELECT * FROM semesters ${where} ORDER BY start_date DESC`
    ).bind(...values).all();

    const data = (result.results || []).map((s) => ({
      id: s.id,
      name: s.name,
      startDate: s.start_date,
      endDate: s.end_date,
      isActive: s.is_active,
      schoolId: s.school_id,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return success(data);
  } catch (err) {
    console.error('listSemesters error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function saveSemester(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const body = await parseBody(request);
    if (!body || !body.name || !body.startDate || !body.endDate) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }

    const schoolId = body.schoolId || 1;
    const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : 0;

    // Check date overlap with other semesters in the same school
    const overlap = await env.DB.prepare(
      `SELECT id FROM semesters
       WHERE school_id = ? AND id != ?
         AND start_date <= ? AND end_date >= ?`
    ).bind(schoolId, id, body.endDate, body.startDate).first();
    if (overlap) {
      return error(ERROR_CODES.VERSION_CONFLICT, 409, { hint: '学期日期与已有学期重叠' });
    }

    const existing = await env.DB.prepare('SELECT id FROM semesters WHERE id = ?').bind(id).first();
    if (existing) {
      await env.DB.prepare(
        'UPDATE semesters SET name = ?, start_date = ?, end_date = ?, is_active = ?, school_id = ?, updated_at = datetime("now") WHERE id = ?'
      ).bind(body.name, body.startDate, body.endDate, isActive, schoolId, id).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO semesters (id, name, start_date, end_date, is_active, school_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, body.name, body.startDate, body.endDate, isActive, schoolId).run();
    }

    // If this semester is active, deactivate others in the same school
    if (isActive) {
      await env.DB.prepare(
        'UPDATE semesters SET is_active = 0 WHERE school_id = ? AND id != ?'
      ).bind(schoolId, id).run();
    }

    return success({ id }, '保存成功');
  } catch (err) {
    console.error('saveSemester error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

// ---------------------------------------------------------------------------
// Operation logs
// ---------------------------------------------------------------------------

async function teacherLogs(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(url);
    const teacherId = url.searchParams.get('teacherId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const action = url.searchParams.get('action');

    const conditions = ["user_type = 'teacher'"];
    const values = [];
    if (teacherId) {
      conditions.push('user_id = ?');
      values.push(teacherId);
    }
    if (startDate) {
      conditions.push('created_at >= ?');
      values.push(startDate);
    }
    if (endDate) {
      conditions.push('created_at <= ?');
      values.push(endDate + ' 23:59:59');
    }
    if (action) {
      conditions.push('action = ?');
      values.push(action);
    }
    const where = 'WHERE ' + conditions.join(' AND ');

    const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM operation_logs ${where}`).bind(...values).first();
    const total = countResult ? countResult.total : 0;

    const result = await env.DB.prepare(
      `SELECT * FROM operation_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...values, pageSize, offset).all();

    const data = (result.results || []).map(toCamelCase);

    return success({ data, total, page, pageSize });
  } catch (err) {
    console.error('teacherLogs error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function adminLogs(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const action = url.searchParams.get('action');

    const conditions = ["user_type = 'admin'"];
    const values = [];
    if (startDate) {
      conditions.push('created_at >= ?');
      values.push(startDate);
    }
    if (endDate) {
      conditions.push('created_at <= ?');
      values.push(endDate + ' 23:59:59');
    }
    if (action) {
      conditions.push('action = ?');
      values.push(action);
    }
    const where = 'WHERE ' + conditions.join(' AND ');

    const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM operation_logs ${where}`).bind(...values).first();
    const total = countResult ? countResult.total : 0;

    const result = await env.DB.prepare(
      `SELECT * FROM operation_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...values, pageSize, offset).all();

    const data = (result.results || []).map(toCamelCase);

    return success({ data, total, page, pageSize });
  } catch (err) {
    console.error('adminLogs error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

async function recipeStatistics(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId');
    const semesterId = url.searchParams.get('semesterId');

    const conditions = [
      "rm.recipe_type = 'daily'",
      'rm.dish_name IS NOT NULL',
      'rm.dish_name != ?',
    ];
    const values = [''];
    if (schoolId) {
      conditions.push('dr.school_id = ?');
      values.push(parseInt(schoolId, 10));
    }
    if (semesterId) {
      conditions.push('s.id = ?');
      values.push(semesterId);
    }
    const where = 'WHERE ' + conditions.join(' AND ');

    const result = await env.DB.prepare(
      `SELECT
         COALESCE(da.canonical_name, rm.dish_name) as dish_name,
         s.id as semester_id,
         s.name as semester_name,
         COUNT(*) as count
       FROM recipe_media rm
       JOIN daily_recipes dr ON rm.recipe_id = dr.id
       JOIN semesters s ON dr.date >= s.start_date AND dr.date <= s.end_date AND dr.school_id = s.school_id
       LEFT JOIN dish_aliases da ON rm.dish_name = da.alias_name
       ${where}
       GROUP BY dish_name, s.id, s.name
       ORDER BY dish_name, s.start_date`
    ).bind(...values).all();

    const data = (result.results || []).map((r) => ({
      dishName: normalizeDishName(r.dish_name),
      semesterId: r.semester_id,
      semesterName: r.semester_name,
      count: r.count,
    }));

    return success(data);
  } catch (err) {
    console.error('recipeStatistics error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

// ---------------------------------------------------------------------------
// Archives
// ---------------------------------------------------------------------------

// Background task: generate metadata JSON and store in R2, then update archive status
async function processArchive(archiveId, semesterId, schoolId, userId, env) {
  const db = env.DB;
  try {
    const semester = await db.prepare('SELECT * FROM semesters WHERE id = ?').bind(semesterId).first();
    if (!semester) {
      await db.prepare("UPDATE archives SET status = 'failed' WHERE id = ?").bind(archiveId).run();
      return;
    }

    // Fetch daily recipes in semester range
    const dailyResult = await db.prepare(
      'SELECT * FROM daily_recipes WHERE school_id = ? AND date >= ? AND date <= ? ORDER BY date'
    ).bind(schoolId, semester.start_date, semester.end_date).all();
    const dailyRecipes = dailyResult.results || [];

    // Fetch weekly recipes in semester range (by start_date)
    const weeklyResult = await db.prepare(
      'SELECT * FROM weekly_recipes WHERE school_id = ? AND start_date >= ? AND end_date <= ? ORDER BY year_week'
    ).bind(schoolId, semester.start_date, semester.end_date).all();
    const weeklyRecipes = weeklyResult.results || [];

    // Fetch media for all recipes
    const recipeIds = [...dailyRecipes.map((r) => r.id), ...weeklyRecipes.map((r) => r.id)];
    const mediaList = [];
    if (recipeIds.length > 0) {
      // D1 doesn't support IN with array binding directly; query in chunks
      const chunkSize = 100;
      for (let i = 0; i < recipeIds.length; i += chunkSize) {
        const chunk = recipeIds.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => '?').join(',');
        const mediaResult = await db.prepare(
          `SELECT * FROM recipe_media WHERE recipe_id IN (${placeholders}) ORDER BY recipe_id, media_type, order_num`
        ).bind(...chunk).all();
        mediaList.push(...(mediaResult.results || []));
      }
    }

    const metadata = {
      archiveId,
      semester: {
        id: semester.id,
        name: semester.name,
        startDate: semester.start_date,
        endDate: semester.end_date,
      },
      schoolId,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      dailyRecipes: dailyRecipes.map((r) => ({
        id: r.id,
        date: r.date,
        notes: r.notes,
        version: r.version,
      })),
      weeklyRecipes: weeklyRecipes.map((r) => ({
        id: r.id,
        yearWeek: r.year_week,
        startDate: r.start_date,
        endDate: r.end_date,
        notes: r.notes,
        version: r.version,
      })),
      media: mediaList.map((m) => ({
        id: m.id,
        recipeId: m.recipe_id,
        recipeType: m.recipe_type,
        mediaType: m.media_type,
        dishName: m.dish_name,
        title: m.title,
        r2Key: m.r2_key,
        filename: m.filename,
      })),
      stats: {
        dailyCount: dailyRecipes.length,
        weeklyCount: weeklyRecipes.length,
        mediaCount: mediaList.length,
      },
    };

    const metadataKey = `archives/${archiveId}/metadata.json`;
    const jsonBody = JSON.stringify(metadata, null, 2);

    await env.BUCKET.put(metadataKey, jsonBody, {
      httpMetadata: { contentType: 'application/json' },
    });

    await db.prepare(
      `UPDATE archives SET status = 'completed', metadata_url = ?, recipe_count_daily = ?, recipe_count_weekly = ?, file_size = ? WHERE id = ?`
    ).bind(metadataKey, dailyRecipes.length, weeklyRecipes.length, jsonBody.length, archiveId).run();
  } catch (err) {
    console.error('processArchive error:', err);
    try {
      await db.prepare("UPDATE archives SET status = 'failed' WHERE id = ?").bind(archiveId).run();
    } catch {}
  }
}

async function createArchive(request, env, ctx) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const body = await parseBody(request);
    if (!body || !body.semesterId) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }

    const schoolId = body.schoolId || 1;
    const semester = await env.DB.prepare('SELECT * FROM semesters WHERE id = ?').bind(body.semesterId).first();
    if (!semester) return notFound(ERROR_CODES.SEMESTER_NOT_FOUND);

    const archiveId = generateToken();

    await env.DB.prepare(
      `INSERT INTO archives (id, semester_id, semester_name, start_date, end_date, school_id, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'processing', ?)`
    ).bind(archiveId, semester.id, semester.name, semester.start_date, semester.end_date, schoolId, auth.user.id).run();

    // Schedule background processing
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(processArchive(archiveId, body.semesterId, schoolId, auth.user.id, env));
    } else {
      // Fallback: process synchronously
      await processArchive(archiveId, body.semesterId, schoolId, auth.user.id, env);
    }

    await logOperation(env.DB, auth.user.id, USER_TYPES.ADMIN, auth.user.name, LOG_ACTIONS.ARCHIVE_CREATE, archiveId, 'success');

    return success({ archiveId, status: 'processing' }, '归档创建中');
  } catch (err) {
    console.error('createArchive error:', err);
    return error(ERROR_CODES.ARCHIVE_CREATE_FAILED, 500);
  }
}

async function listArchives(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(url);
    const schoolId = url.searchParams.get('schoolId');

    const conditions = [];
    const values = [];
    if (schoolId) {
      conditions.push('school_id = ?');
      values.push(parseInt(schoolId, 10));
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM archives ${where}`).bind(...values).first();
    const total = countResult ? countResult.total : 0;

    const result = await env.DB.prepare(
      `SELECT * FROM archives ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...values, pageSize, offset).all();

    const data = (result.results || []).map((a) => ({
      id: a.id,
      semesterId: a.semester_id,
      semesterName: a.semester_name,
      startDate: a.start_date,
      endDate: a.end_date,
      schoolId: a.school_id,
      status: a.status,
      metadataUrl: a.metadata_url,
      mediaZipUrl: a.media_zip_url,
      fileSize: a.file_size,
      recipeCountDaily: a.recipe_count_daily,
      recipeCountWeekly: a.recipe_count_weekly,
      createdAt: a.created_at,
      createdBy: a.created_by,
    }));

    return success({ data, total, page, pageSize });
  } catch (err) {
    console.error('listArchives error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function getArchive(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const archive = await env.DB.prepare('SELECT * FROM archives WHERE id = ?').bind(id).first();
    if (!archive) return notFound(ERROR_CODES.ARCHIVE_NOT_FOUND);

    const data = {
      id: archive.id,
      semesterId: archive.semester_id,
      semesterName: archive.semester_name,
      startDate: archive.start_date,
      endDate: archive.end_date,
      schoolId: archive.school_id,
      status: archive.status,
      metadataUrl: archive.metadata_url,
      mediaZipUrl: archive.media_zip_url,
      fileSize: archive.file_size,
      recipeCountDaily: archive.recipe_count_daily,
      recipeCountWeekly: archive.recipe_count_weekly,
      createdAt: archive.created_at,
      createdBy: archive.created_by,
      downloadUrl: archive.status === 'completed' ? `/admin/api/archive/${id}/download` : null,
    };

    return success(data);
  } catch (err) {
    console.error('getArchive error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function downloadArchive(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const archive = await env.DB.prepare('SELECT * FROM archives WHERE id = ?').bind(id).first();
    if (!archive) return notFound(ERROR_CODES.ARCHIVE_NOT_FOUND);
    if (archive.status !== 'completed' || !archive.metadata_url) {
      return error(ERROR_CODES.ARCHIVE_NOT_FOUND, 400, { hint: '归档尚未完成' });
    }

    const r2Object = await env.BUCKET.get(archive.metadata_url);
    if (!r2Object) return notFound(ERROR_CODES.ARCHIVE_NOT_FOUND);

    const headers = new Headers();
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Content-Disposition', `attachment; filename="archive-${id}.json"`);
    headers.set('Content-Length', String(r2Object.size));

    return new Response(r2Object.body, { status: 200, headers });
  } catch (err) {
    console.error('downloadArchive error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

async function deleteArchive(request, env, ctx, params) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    const archive = await env.DB.prepare('SELECT * FROM archives WHERE id = ?').bind(id).first();
    if (!archive) return notFound(ERROR_CODES.ARCHIVE_NOT_FOUND);

    // Delete R2 objects (metadata + zip if exists)
    if (archive.metadata_url) {
      try { await env.BUCKET.delete(archive.metadata_url); } catch {}
    }
    if (archive.media_zip_url) {
      try { await env.BUCKET.delete(archive.media_zip_url); } catch {}
    }

    await env.DB.prepare('DELETE FROM archives WHERE id = ?').bind(id).run();

    return success(null, '删除成功');
  } catch (err) {
    console.error('deleteArchive error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

// ---------------------------------------------------------------------------
// Orphan file cleanup
// ---------------------------------------------------------------------------

async function orphanCleanup(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  try {
    const body = await parseBody(request);
    const confirm = body?.confirm === true;

    // 1. Collect all referenced R2 keys from recipe_media
    const mediaResult = await env.DB.prepare('SELECT r2_key FROM recipe_media').all();
    const referencedKeys = new Set();
    for (const m of mediaResult.results || []) {
      if (m.r2_key) referencedKeys.add(m.r2_key);
    }

    // 2. Collect R2 keys from recipe_snapshots (parse JSON)
    const snapshotResult = await env.DB.prepare('SELECT snapshot_data FROM recipe_snapshots').all();
    for (const snap of snapshotResult.results || []) {
      try {
        const data = JSON.parse(snap.snapshot_data);
        for (const m of data.media || []) {
          if (m.r2_key) referencedKeys.add(m.r2_key);
        }
      } catch {}
    }

    // 3. List all R2 objects (paginated)
    const orphans = [];
    let cursor;
    do {
      const listed = await env.BUCKET.list({ cursor });
      for (const obj of listed.objects || []) {
        if (!referencedKeys.has(obj.key)) {
          // Skip archive metadata files
          if (obj.key.startsWith('archives/')) continue;
          orphans.push({ key: obj.key, size: obj.size });
        }
      }
      cursor = listed.truncated ? listed.cursor : null;
    } while (cursor);

    // 4. If confirm, delete orphans
    let deleted = 0;
    let failed = 0;
    if (confirm) {
      for (const orphan of orphans) {
        try {
          await env.BUCKET.delete(orphan.key);
          deleted++;
        } catch {
          failed++;
        }
      }
    }

    await logOperation(
      env.DB,
      auth.user.id,
      USER_TYPES.ADMIN,
      auth.user.name,
      LOG_ACTIONS.ORPHAN_CLEANUP,
      null,
      'success',
      JSON.stringify({ orphanCount: orphans.length, confirmed: confirm, deleted, failed })
    );

    return success({
      orphanCount: orphans.length,
      orphans: orphans.slice(0, 200), // cap returned list
      confirmed: confirm,
      deleted,
      failed,
    });
  } catch (err) {
    console.error('orphanCleanup error:', err);
    return error(ERROR_CODES.SYSTEM_ERROR, 500);
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const adminRoutes = {
  // Daily recipes
  listDaily,
  updateDaily,
  deleteDaily,
  dailyHistory,
  dailyRollback,

  // Weekly recipes
  listWeekly,
  updateWeekly,
  deleteWeekly,
  weeklyHistory,
  weeklyRollback,

  // Teachers
  listTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,

  // Parents
  listParents,
  updateParent,
  deleteParent,

  // Classes
  listClasses,
  createClass,
  updateClass,
  deleteClass,

  // Students
  listStudents,
  createStudent,
  importStudents,
  updateStudent,
  deleteStudent,

  // Semesters
  listSemesters,
  saveSemester,

  // Logs
  teacherLogs,
  adminLogs,

  // Statistics
  recipeStatistics,

  // Archives
  createArchive,
  listArchives,
  getArchive,
  downloadArchive,
  deleteArchive,

  // Orphan cleanup
  orphanCleanup,
};
