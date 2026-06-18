// Recipe routes: daily and weekly recipe CRUD endpoints
import { success, error, parseBody, unauthorized, forbidden, conflict, ERROR_CODES } from '../utils/response.js';
import { verifySession } from '../services/authService.js';
import * as recipeService from '../services/recipeService.js';
import { isValidDate, isValidYearWeek, todayBeijing, getISOWeek } from '../utils/dateUtils.js';
import { USER_TYPES } from '../utils/constants.js';

// Verify the caller is logged in as teacher or parent (for GET access)
async function verifyReader(request, env) {
  const user = await verifySession(request, env);
  if (!user) return { error: unauthorized() };
  if (user.type !== USER_TYPES.TEACHER && user.type !== USER_TYPES.PARENT && user.type !== USER_TYPES.ADMIN) {
    return { error: forbidden() };
  }
  return { user };
}

// Verify the caller is a teacher (for PUT access)
async function verifyTeacher(request, env) {
  const user = await verifySession(request, env);
  if (!user) return { error: unauthorized() };
  if (user.type !== USER_TYPES.TEACHER) {
    return { error: forbidden() };
  }
  return { user };
}

export const recipeRoutes = {
  // GET /api/recipes/daily/current — today's recipe (teacher/parent)
  async getCurrentDaily(request, env) {
    const auth = await verifyReader(request, env);
    if (auth.error) return auth.error;

    const date = todayBeijing();
    const recipe = await recipeService.getDailyRecipe(date, auth.user.schoolId, env);
    return success({ date, recipe });
  },

  // GET /api/recipes/daily/:date — recipe for a specific date
  async getDaily(request, env, ctx, params) {
    const auth = await verifyReader(request, env);
    if (auth.error) return auth.error;

    const { date } = params;
    if (!isValidDate(date)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }

    const recipe = await recipeService.getDailyRecipe(date, auth.user.schoolId, env);
    return success({ date, recipe });
  },

  // GET /api/recipes/daily/date-range?startDate=&endDate= — list recipes in range
  async getDailyDateRange(request, env) {
    const auth = await verifyReader(request, env);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    if (!startDate || !endDate) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }
    if (startDate > endDate) {
      return error(ERROR_CODES.INVALID_PARAMS);
    }

    const list = await recipeService.getDailyRecipeRange(startDate, endDate, auth.user.schoolId, env);
    return success({ list });
  },

  // PUT /api/recipes/daily/:date — create or update daily recipe (teacher only)
  async putDaily(request, env, ctx, params) {
    const auth = await verifyTeacher(request, env);
    if (auth.error) return auth.error;

    const { date } = params;
    if (!isValidDate(date)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }

    const body = await parseBody(request);
    if (!body) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }

    // Basic validation: images and videos must be arrays if present
    if (body.images !== undefined && !Array.isArray(body.images)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }
    if (body.videos !== undefined && !Array.isArray(body.videos)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }

    try {
      const result = await recipeService.putDailyRecipe(date, auth.user.schoolId, auth.user.id, body, env);
      if (result.error === 'VERSION_CONFLICT') {
        return conflict(ERROR_CODES.VERSION_CONFLICT);
      }
      return success(result, '保存成功');
    } catch (err) {
      console.error('putDaily error:', err);
      return error(ERROR_CODES.RECIPE_SAVE_FAILED, 500);
    }
  },

  // GET /api/recipes/weekly/current — current week's recipe
  async getCurrentWeekly(request, env) {
    const auth = await verifyReader(request, env);
    if (auth.error) return auth.error;

    const today = todayBeijing();
    const { yearWeek } = getISOWeek(today);
    const recipe = await recipeService.getWeeklyRecipe(yearWeek, auth.user.schoolId, env);
    return success({ yearWeek, recipe });
  },

  // GET /api/recipes/weekly/:yearWeek — recipe for a specific ISO week
  async getWeekly(request, env, ctx, params) {
    const auth = await verifyReader(request, env);
    if (auth.error) return auth.error;

    const { yearWeek } = params;
    if (!isValidYearWeek(yearWeek)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }

    const recipe = await recipeService.getWeeklyRecipe(yearWeek, auth.user.schoolId, env);
    return success({ yearWeek, recipe });
  },

  // GET /api/recipes/weekly/week-range?startWeek=&endWeek= — list weekly recipes in range
  async getWeeklyRange(request, env) {
    const auth = await verifyReader(request, env);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const startWeek = url.searchParams.get('startWeek');
    const endWeek = url.searchParams.get('endWeek');
    if (!startWeek || !endWeek) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }
    if (!isValidYearWeek(startWeek) || !isValidYearWeek(endWeek)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }
    if (startWeek > endWeek) {
      return error(ERROR_CODES.INVALID_PARAMS);
    }

    const list = await recipeService.getWeeklyRecipeRange(startWeek, endWeek, auth.user.schoolId, env);
    return success({ list });
  },

  // PUT /api/recipes/weekly/:yearWeek — create or update weekly recipe (teacher only)
  async putWeekly(request, env, ctx, params) {
    const auth = await verifyTeacher(request, env);
    if (auth.error) return auth.error;

    const { yearWeek } = params;
    if (!isValidYearWeek(yearWeek)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }

    const body = await parseBody(request);
    if (!body) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }

    if (body.images !== undefined && !Array.isArray(body.images)) {
      return error(ERROR_CODES.INVALID_FORMAT);
    }

    try {
      const result = await recipeService.putWeeklyRecipe(yearWeek, auth.user.schoolId, auth.user.id, body, env);
      if (result.error === 'VERSION_CONFLICT') {
        return conflict(ERROR_CODES.VERSION_CONFLICT);
      }
      if (result.error === 'INVALID_FORMAT') {
        return error(ERROR_CODES.INVALID_FORMAT);
      }
      return success(result, '保存成功');
    } catch (err) {
      console.error('putWeekly error:', err);
      return error(ERROR_CODES.RECIPE_SAVE_FAILED, 500);
    }
  },
};
