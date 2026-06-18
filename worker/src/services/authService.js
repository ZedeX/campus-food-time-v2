// Authentication service: login, register, session management
import { encryptPassword, decryptPassword, verifyPassword, generateToken, generateUserId } from '../utils/crypto.js';
import { isValidPhone, isValidIdNumber, getIdParts } from '../utils/dateUtils.js';
import { ERROR_CODES, USER_TYPES, LOG_ACTIONS } from '../utils/constants.js';
import { maskPhone } from '../utils/response.js';

const SESSION_EXPIRY_DAYS = 30;
const SESSION_EXPIRY_SECONDS = SESSION_EXPIRY_DAYS * 24 * 60 * 60;

// Teacher login
export async function teacherLogin(phone, password, env) {
  const db = env.DB;
  
  // Check rate limiting
  const lockStatus = await checkLock(env, `login:${phone}`);
  if (lockStatus.locked) {
    return { error: ERROR_CODES.ACCOUNT_LOCKED };
  }

  // Find teacher by phone
  const teacher = await db.prepare(
    'SELECT * FROM users WHERE phone = ? AND type = ? AND status = ?'
  ).bind(phone, USER_TYPES.TEACHER, 'active').first();

  if (!teacher) {
    await recordFailedLogin(env, `login:${phone}`);
    return { error: ERROR_CODES.USER_NOT_FOUND };
  }

  // Verify password
  const secret = env.JWT_SECRET || 'default-secret';
  if (!verifyPassword(password, teacher.password, secret)) {
    await recordFailedLogin(env, `login:${phone}`);
    return { error: ERROR_CODES.PASSWORD_ERROR };
  }

  // Clear failed attempts
  await clearFailedLogin(env, `login:${phone}`);

  // Create session (single device: delete old, insert new)
  const sessionToken = generateToken();
  const sessionId = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_SECONDS * 1000).toISOString();

  await db.prepare(
    'DELETE FROM sessions WHERE user_id = ?'
  ).bind(teacher.id).run();

  await db.prepare(
    'INSERT INTO sessions (id, user_id, session_token, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, teacher.id, sessionToken, expiresAt).run();

  // Log
  await logOperation(db, teacher.id, USER_TYPES.TEACHER, teacher.name, LOG_ACTIONS.LOGIN, null, 'success');

  return {
    user: {
      id: teacher.id,
      name: teacher.name,
      phone: maskPhone(teacher.phone),
      schoolId: teacher.school_id,
    },
    token: sessionToken,
  };
}

// Parent register
export async function parentRegister({ phone, password, studentName, studentIdNumber, classId }, env) {
  const db = env.DB;

  // Validate phone
  if (!isValidPhone(phone)) {
    return { error: ERROR_CODES.INVALID_FORMAT };
  }

  // Check phone uniqueness
  const existing = await db.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first();
  if (existing) {
    return { error: ERROR_CODES.PHONE_EXISTS };
  }

  // Verify student info
  const student = await db.prepare(
    'SELECT * FROM students WHERE name = ? AND class_id = ?'
  ).bind(studentName, classId).first();

  if (!student) {
    return { error: ERROR_CODES.STUDENT_NOT_FOUND };
  }

  // Verify ID number if student has one
  if (student.id_prefix && student.id_suffix) {
    const parts = getIdParts(studentIdNumber);
    if (parts.prefix !== student.id_prefix || parts.suffix !== student.id_suffix) {
      return { error: ERROR_CODES.STUDENT_NOT_FOUND };
    }
  }

  // Create parent user
  const userId = generateUserId('parent');
  const secret = env.JWT_SECRET || 'default-secret';
  const encryptedPassword = encryptPassword(password, secret);

  await db.prepare(
    'INSERT INTO users (id, type, phone, password, name, school_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, USER_TYPES.PARENT, phone, encryptedPassword, phone, student.school_id).run();

  // Create parent-student relation
  const relationId = generateToken();
  await db.prepare(
    'INSERT INTO parent_student_relations (id, parent_user_id, student_id, relation) VALUES (?, ?, ?, ?)'
  ).bind(relationId, userId, student.id, body.relation || null).run();

  // Create session
  const sessionToken = generateToken();
  const sessionId = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_SECONDS * 1000).toISOString();

  await db.prepare(
    'INSERT INTO sessions (id, user_id, session_token, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, userId, sessionToken, expiresAt).run();

  // Get class name for response
  const classInfo = await db.prepare('SELECT name FROM classes WHERE id = ?').bind(classId).first();

  return {
    user: {
      id: userId,
      phone: maskPhone(phone),
      studentName: studentName,
      className: classInfo?.name || '',
      schoolId: student.school_id,
    },
    token: sessionToken,
  };
}

// Parent login
export async function parentLogin(phone, password, env) {
  const db = env.DB;

  const lockStatus = await checkLock(env, `login:${phone}`);
  if (lockStatus.locked) {
    return { error: ERROR_CODES.ACCOUNT_LOCKED };
  }

  const parent = await db.prepare(
    'SELECT * FROM users WHERE phone = ? AND type = ? AND status = ?'
  ).bind(phone, USER_TYPES.PARENT, 'active').first();

  if (!parent) {
    await recordFailedLogin(env, `login:${phone}`);
    return { error: ERROR_CODES.USER_NOT_FOUND };
  }

  const secret = env.JWT_SECRET || 'default-secret';
  if (!verifyPassword(password, parent.password, secret)) {
    await recordFailedLogin(env, `login:${phone}`);
    return { error: ERROR_CODES.PASSWORD_ERROR };
  }

  await clearFailedLogin(env, `login:${phone}`);

  // Single device login
  const sessionToken = generateToken();
  const sessionId = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_SECONDS * 1000).toISOString();

  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(parent.id).run();
  await db.prepare(
    'INSERT INTO sessions (id, user_id, session_token, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, parent.id, sessionToken, expiresAt).run();

  // Get student info
  const relations = await db.prepare(
    `SELECT r.*, s.name as student_name, c.name as class_name 
     FROM parent_student_relations r 
     JOIN students s ON r.student_id = s.id 
     JOIN classes c ON s.class_id = c.id 
     WHERE r.parent_user_id = ?`
  ).bind(parent.id).all();

  await logOperation(db, parent.id, USER_TYPES.PARENT, parent.name, LOG_ACTIONS.LOGIN, null, 'success');

  return {
    user: {
      id: parent.id,
      phone: maskPhone(parent.phone),
      students: relations.results?.map(r => ({ name: r.student_name, className: r.class_name })) || [],
      schoolId: parent.school_id,
    },
    token: sessionToken,
  };
}

// Admin login
export async function adminLogin(username, password, env) {
  const db = env.DB;

  const lockStatus = await checkLock(env, `admin:${username}`);
  if (lockStatus.locked) {
    return { error: ERROR_CODES.ACCOUNT_LOCKED };
  }

  // Check debug admin account via env vars
  const adminUser = env.ADMIN_USERNAME || 'zx';
  const adminPass = env.ADMIN_PASSWORD || '1qaz!QAZ';

  if (username !== adminUser || password !== adminPass) {
    await recordFailedLogin(env, `admin:${username}`);
    return { error: ERROR_CODES.PASSWORD_ERROR };
  }

  await clearFailedLogin(env, `admin:${username}`);

  // Create admin session
  const sessionToken = generateToken();
  const sessionId = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_SECONDS * 1000).toISOString();

  // Use fixed admin ID
  const adminId = 'admin_001';
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(adminId).run();
  await db.prepare(
    'INSERT INTO sessions (id, user_id, session_token, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, adminId, sessionToken, expiresAt).run();

  await logOperation(db, adminId, USER_TYPES.ADMIN, '管理员', LOG_ACTIONS.LOGIN, null, 'success');

  return {
    user: { id: adminId, name: '管理员', type: USER_TYPES.ADMIN },
    token: sessionToken,
  };
}

// Verify session and get user
export async function verifySession(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const db = env.DB;

  // Check token blacklist in KV
  if (env.CACHE) {
    const blacklisted = await env.CACHE.get(`blacklist:${token}`);
    if (blacklisted) return null;
  }

  // Admin sessions don't have a users table row — check directly
  let session;
  if (token.startsWith('admin_')) {
    // Fallback: this shouldn't happen, but handle gracefully
    return null;
  }

  session = await db.prepare(
    `SELECT s.*, u.type, u.name, u.school_id, u.status, u.phone
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.session_token = ? AND s.expires_at > datetime("now")`
  ).bind(token).first();

  // If not found in users JOIN, check if this is an admin session
  if (!session) {
    const adminSession = await db.prepare(
      `SELECT s.* FROM sessions s WHERE s.session_token = ? AND s.expires_at > datetime("now")`
    ).bind(token).first();
    if (adminSession && adminSession.user_id === 'admin_001') {
      // Sliding expiry
      const newExpiry = new Date(Date.now() + SESSION_EXPIRY_SECONDS * 1000).toISOString();
      await db.prepare(
        'UPDATE sessions SET expires_at = ?, last_accessed = datetime("now") WHERE session_token = ?'
      ).bind(newExpiry, token).run();
      return {
        id: 'admin_001',
        type: 'admin',
        name: '管理员',
        schoolId: 1,
        phone: null,
        token,
      };
    }
    return null;
  }

  if (session.status === 'disabled') {
    return null;
  }

  // Sliding expiry: update last accessed and expiry
  const newExpiry = new Date(Date.now() + SESSION_EXPIRY_SECONDS * 1000).toISOString();
  await db.prepare(
    'UPDATE sessions SET expires_at = ?, last_accessed = datetime("now") WHERE session_token = ?'
  ).bind(newExpiry, token).run();

  return {
    id: session.user_id,
    type: session.type,
    name: session.name,
    schoolId: session.school_id,
    phone: session.phone,
    token,
  };
}

// Logout
export async function logout(token, env) {
  const db = env.DB;
  
  // Add to blacklist in KV (TTL = remaining session time)
  if (env.CACHE) {
    await env.CACHE.put(`blacklist:${token}`, '1', { expirationTtl: SESSION_EXPIRY_SECONDS });
  }

  // Delete from D1
  await db.prepare('DELETE FROM sessions WHERE session_token = ?').bind(token).run();

  return { success: true };
}

// Rate limiting helpers using KV
async function checkLock(env, key) {
  if (!env.CACHE) return { locked: false };
  const attempts = await env.CACHE.get(`fail:${key}`);
  if (!attempts) return { locked: false };
  const count = parseInt(attempts);
  if (count >= 20) return { locked: true }; // IP-level lock
  if (count >= 5) return { locked: true }; // account-level lock
  return { locked: false };
}

async function recordFailedLogin(env, key) {
  if (!env.CACHE) return;
  const current = await env.CACHE.get(`fail:${key}`);
  const count = current ? parseInt(current) + 1 : 1;
  const ttl = count >= 5 ? 900 : 3600; // 15 min lock after 5 fails, 1 hour cleanup otherwise
  await env.CACHE.put(`fail:${key}`, String(count), { expirationTtl: ttl });
}

async function clearFailedLogin(env, key) {
  if (!env.CACHE) return;
  await env.CACHE.delete(`fail:${key}`);
}

// Log operation
export async function logOperation(db, userId, userType, userName, action, target, result, details = null) {
  const logId = generateToken();
  await db.prepare(
    'INSERT INTO operation_logs (id, user_id, user_type, user_name, action, target, result, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(logId, userId, userType, userName, action, target, result, details).run();
}
