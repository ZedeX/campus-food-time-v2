// Main Worker entry point
// Routes all requests to appropriate handlers

import { authRoutes } from './routes/auth.js';
import { recipeRoutes } from './routes/recipes.js';
import { uploadRoutes } from './routes/upload.js';
import { mediaRoutes } from './routes/media.js';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';
import { error, ERROR_CODES } from './utils/response.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // CORS headers for API responses
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-Match',
      };

      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // Route matching
      const route = matchRoute(method, path);
      if (!route) {
        // Serve static files from frontend assets
        if (env.ASSETS) {
          const assetResponse = await env.ASSETS.fetch(request);
          if (assetResponse.status !== 404) {
            return assetResponse;
          }
        }
        return new Response('Not Found', { status: 404 });
      }

      const { handler, params } = route;
      const response = await handler(request, env, ctx, params);

      // Add CORS headers to response
      const newHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders)) {
        newHeaders.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err) {
      console.error('Unhandled error:', err);
      return error(ERROR_CODES.SYSTEM_ERROR, 500);
    }
  },
};

// Simple route matcher
function matchRoute(method, path) {
  const routes = [
    // Auth routes
    { method: 'POST', pattern: '/auth/teacher/login', handler: authRoutes.teacherLogin },
    { method: 'POST', pattern: '/auth/parent/login', handler: authRoutes.parentLogin },
    { method: 'POST', pattern: '/auth/parent/register', handler: authRoutes.parentRegister },
    { method: 'POST', pattern: '/auth/admin/login', handler: authRoutes.adminLogin },
    { method: 'POST', pattern: '/auth/logout', handler: authRoutes.logout },
    { method: 'GET', pattern: '/auth/check', handler: authRoutes.check },

    // User routes
    { method: 'GET', pattern: '/api/user/profile', handler: authRoutes.getProfile },
    { method: 'PUT', pattern: '/api/user/password', handler: authRoutes.changePassword },

    // Recipe routes
    { method: 'GET', pattern: '/api/recipes/daily/current', handler: recipeRoutes.getCurrentDaily },
    { method: 'GET', pattern: '/api/recipes/daily/date-range', handler: recipeRoutes.getDailyDateRange },
    { method: 'GET', pattern: '/api/recipes/daily/:date', handler: recipeRoutes.getDaily },
    { method: 'PUT', pattern: '/api/recipes/daily/:date', handler: recipeRoutes.putDaily },
    { method: 'GET', pattern: '/api/recipes/weekly/current', handler: recipeRoutes.getCurrentWeekly },
    { method: 'GET', pattern: '/api/recipes/weekly/week-range', handler: recipeRoutes.getWeeklyRange },
    { method: 'GET', pattern: '/api/recipes/weekly/:yearWeek', handler: recipeRoutes.getWeekly },
    { method: 'PUT', pattern: '/api/recipes/weekly/:yearWeek', handler: recipeRoutes.putWeekly },

    // Upload routes
    { method: 'POST', pattern: '/api/upload/presign', handler: uploadRoutes.presign },
    { method: 'POST', pattern: '/api/upload/direct', handler: uploadRoutes.direct },

    // Media routes
    { method: 'GET', pattern: '/media/:id', handler: mediaRoutes.getMedia },

    // Public routes
    { method: 'GET', pattern: '/api/classes', handler: publicRoutes.getClasses },
    { method: 'GET', pattern: '/api/schools', handler: publicRoutes.getSchools },
    { method: 'GET', pattern: '/api/config', handler: publicRoutes.getConfig },

    // Admin routes
    { method: 'GET', pattern: '/admin/api/recipes/daily', handler: adminRoutes.listDaily },
    { method: 'PUT', pattern: '/admin/api/recipes/daily/:id', handler: adminRoutes.updateDaily },
    { method: 'DELETE', pattern: '/admin/api/recipes/daily/:id', handler: adminRoutes.deleteDaily },
    { method: 'GET', pattern: '/admin/api/recipes/daily/:id/history', handler: adminRoutes.dailyHistory },
    { method: 'POST', pattern: '/admin/api/recipes/daily/:id/rollback', handler: adminRoutes.dailyRollback },
    { method: 'GET', pattern: '/admin/api/recipes/weekly', handler: adminRoutes.listWeekly },
    { method: 'PUT', pattern: '/admin/api/recipes/weekly/:id', handler: adminRoutes.updateWeekly },
    { method: 'DELETE', pattern: '/admin/api/recipes/weekly/:id', handler: adminRoutes.deleteWeekly },
    { method: 'GET', pattern: '/admin/api/recipes/weekly/:id/history', handler: adminRoutes.weeklyHistory },
    { method: 'POST', pattern: '/admin/api/recipes/weekly/:id/rollback', handler: adminRoutes.weeklyRollback },

    { method: 'GET', pattern: '/admin/api/teachers', handler: adminRoutes.listTeachers },
    { method: 'POST', pattern: '/admin/api/teachers', handler: adminRoutes.createTeacher },
    { method: 'PUT', pattern: '/admin/api/teachers/:id', handler: adminRoutes.updateTeacher },
    { method: 'DELETE', pattern: '/admin/api/teachers/:id', handler: adminRoutes.deleteTeacher },

    { method: 'GET', pattern: '/admin/api/parents', handler: adminRoutes.listParents },
    { method: 'PUT', pattern: '/admin/api/parents/:id', handler: adminRoutes.updateParent },
    { method: 'DELETE', pattern: '/admin/api/parents/:id', handler: adminRoutes.deleteParent },

    { method: 'GET', pattern: '/admin/api/classes', handler: adminRoutes.listClasses },
    { method: 'POST', pattern: '/admin/api/classes', handler: adminRoutes.createClass },
    { method: 'PUT', pattern: '/admin/api/classes/:id', handler: adminRoutes.updateClass },
    { method: 'DELETE', pattern: '/admin/api/classes/:id', handler: adminRoutes.deleteClass },

    { method: 'GET', pattern: '/admin/api/students', handler: adminRoutes.listStudents },
    { method: 'POST', pattern: '/admin/api/students', handler: adminRoutes.createStudent },
    { method: 'POST', pattern: '/admin/api/students/import', handler: adminRoutes.importStudents },
    { method: 'PUT', pattern: '/admin/api/students/:id', handler: adminRoutes.updateStudent },
    { method: 'DELETE', pattern: '/admin/api/students/:id', handler: adminRoutes.deleteStudent },

    { method: 'GET', pattern: '/admin/api/semesters', handler: adminRoutes.listSemesters },
    { method: 'PUT', pattern: '/admin/api/semesters/:id', handler: adminRoutes.saveSemester },

    { method: 'GET', pattern: '/admin/api/logs/teacher', handler: adminRoutes.teacherLogs },
    { method: 'GET', pattern: '/admin/api/logs/admin', handler: adminRoutes.adminLogs },

    { method: 'GET', pattern: '/admin/api/statistics/recipes', handler: adminRoutes.recipeStatistics },

    { method: 'POST', pattern: '/admin/api/archive/create', handler: adminRoutes.createArchive },
    { method: 'GET', pattern: '/admin/api/archive/list', handler: adminRoutes.listArchives },
    { method: 'GET', pattern: '/admin/api/archive/:id', handler: adminRoutes.getArchive },
    { method: 'GET', pattern: '/admin/api/archive/:id/download', handler: adminRoutes.downloadArchive },
    { method: 'DELETE', pattern: '/admin/api/archive/:id', handler: adminRoutes.deleteArchive },

    { method: 'POST', pattern: '/admin/api/orphan-cleanup', handler: adminRoutes.orphanCleanup },
  ];

  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchPattern(route.pattern, path);
    if (params !== null) {
      return { handler: route.handler, params };
    }
  }
  return null;
}

// Match URL pattern with :param support
function matchPattern(pattern, path) {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}
