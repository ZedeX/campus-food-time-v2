// Auth routes
import { success, error, parseBody, unauthorized, ERROR_CODES } from '../utils/response.js';
import { teacherLogin, parentLogin, parentRegister, adminLogin, verifySession, logout } from '../services/authService.js';
import { encryptPassword, verifyPassword } from '../utils/crypto.js';
import { isValidPhone } from '../utils/dateUtils.js';

export const authRoutes = {
  async teacherLogin(request, env) {
    const body = await parseBody(request);
    if (!body || !body.phone || !body.password) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }
    if (!isValidPhone(body.phone)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }
    const result = await teacherLogin(body.phone, body.password, env);
    if (result.error) {
      return error(result.error, 401);
    }
    return success(result, '登录成功');
  },

  async parentLogin(request, env) {
    const body = await parseBody(request);
    if (!body || !body.phone || !body.password) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }
    if (!isValidPhone(body.phone)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }
    const result = await parentLogin(body.phone, body.password, env);
    if (result.error) {
      return error(result.error, 401);
    }
    return success(result, '登录成功');
  },

  async parentRegister(request, env) {
    const body = await parseBody(request);
    if (!body || !body.phone || !body.password || !body.studentName || !body.classId) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }
    const result = await parentRegister(body, env);
    if (result.error) {
      return error(result.error);
    }
    return success(result, '注册成功');
  },

  async adminLogin(request, env) {
    const body = await parseBody(request);
    if (!body || !body.username || !body.password) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }
    const result = await adminLogin(body.username, body.password, env);
    if (result.error) {
      return error(result.error, 401);
    }
    return success(result, '登录成功');
  },

  async logout(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return success(null, '已安全退出');
    }
    const token = authHeader.slice(7);
    await logout(token, env);
    return success(null, '已安全退出');
  },

  async check(request, env) {
    const user = await verifySession(request, env);
    if (!user) {
      return unauthorized();
    }
    return success({ user: { id: user.id, type: user.type, name: user.name, schoolId: user.schoolId } });
  },

  async getProfile(request, env) {
    const user = await verifySession(request, env);
    if (!user) return unauthorized();
    return success({ id: user.id, type: user.type, name: user.name, phone: user.phone, schoolId: user.schoolId });
  },

  async changePassword(request, env) {
    const user = await verifySession(request, env);
    if (!user) return unauthorized();
    const body = await parseBody(request);
    if (!body || !body.oldPassword || !body.newPassword) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }
    const db = env.DB;
    const secret = env.JWT_SECRET || 'default-secret';
    const userRow = await db.prepare('SELECT password FROM users WHERE id = ?').bind(user.id).first();
    if (!userRow) return error(ERROR_CODES.USER_NOT_FOUND);
    if (!verifyPassword(body.oldPassword, userRow.password, secret)) {
      return error(ERROR_CODES.PASSWORD_ERROR);
    }
    const newEncrypted = encryptPassword(body.newPassword, secret);
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').bind(newEncrypted, user.id).run();
    return success(null, '密码修改成功');
  },
};
