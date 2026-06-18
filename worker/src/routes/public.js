// Public routes: no auth required
import { success, error, ERROR_CODES } from '../utils/response.js';

// Convert snake_case key to camelCase
function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export const publicRoutes = {
  // GET /api/classes — list visible classes only
  async getClasses(request, env) {
    try {
      const result = await env.DB.prepare(
        'SELECT id, name, grade, class_number, school_id FROM classes WHERE visible = 1 ORDER BY grade, class_number'
      ).all();
      const data = (result.results || []).map((c) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        classNumber: c.class_number,
        schoolId: c.school_id,
      }));
      return success(data);
    } catch (err) {
      console.error('getClasses error:', err);
      return error(ERROR_CODES.SYSTEM_ERROR, 500);
    }
  },

  // GET /api/schools — list all schools
  async getSchools(request, env) {
    try {
      const result = await env.DB.prepare('SELECT id, name FROM schools ORDER BY id').all();
      const data = (result.results || []).map((s) => ({ id: s.id, name: s.name }));
      return success(data);
    } catch (err) {
      console.error('getSchools error:', err);
      return error(ERROR_CODES.SYSTEM_ERROR, 500);
    }
  },

  // GET /api/config — return all config items as a camelCase object
  async getConfig(request, env) {
    try {
      const result = await env.DB.prepare('SELECT key, value FROM config').all();
      const config = {};
      for (const row of result.results || []) {
        config[snakeToCamel(row.key)] = row.value;
      }
      return success(config);
    } catch (err) {
      console.error('getConfig error:', err);
      return error(ERROR_CODES.SYSTEM_ERROR, 500);
    }
  },
};
