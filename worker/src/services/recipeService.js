// Recipe service: CRUD for daily/weekly recipes, snapshots, rollback
import { generateToken } from '../utils/crypto.js';
import { getISOWeek, getWeekDateRange, parseYearWeek, formatDate } from '../utils/dateUtils.js';
import { RECIPE_TYPES, MEDIA_TYPES } from '../utils/constants.js';

const CACHE_TTL = 3600; // 60 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Fetch all media rows for a recipe, ordered by type then order_num
async function getMediaForRecipe(db, recipeId) {
  const result = await db.prepare(
    'SELECT * FROM recipe_media WHERE recipe_id = ? ORDER BY media_type, order_num, created_at'
  ).bind(recipeId).all();
  return result.results || [];
}

// Map raw media rows into the API shape (split images / videos)
function formatDailyRecipe(recipe, mediaList) {
  const images = mediaList
    .filter((m) => m.media_type === MEDIA_TYPES.IMAGE)
    .map((m) => ({
      id: m.id,
      title: m.title,
      dishName: m.dish_name,
      r2Key: m.r2_key,
      filename: m.filename,
      order: m.order_num,
    }));
  const videos = mediaList
    .filter((m) => m.media_type === MEDIA_TYPES.VIDEO)
    .map((m) => ({
      id: m.id,
      title: m.title,
      r2Key: m.r2_key,
      filename: m.filename,
      order: m.order_num,
    }));
  return {
    id: recipe.id,
    date: recipe.date,
    notes: recipe.notes,
    version: recipe.version,
    createdBy: recipe.created_by,
    createdAt: recipe.created_at,
    updatedAt: recipe.updated_at,
    images,
    videos,
  };
}

// Weekly recipes only have images (no videos, no dishName)
function formatWeeklyRecipe(recipe, mediaList) {
  const images = mediaList
    .filter((m) => m.media_type === MEDIA_TYPES.IMAGE)
    .map((m) => ({
      id: m.id,
      title: m.title,
      r2Key: m.r2_key,
      filename: m.filename,
      order: m.order_num,
    }));
  return {
    id: recipe.id,
    yearWeek: recipe.year_week,
    year: recipe.year,
    weekNumber: recipe.week_number,
    startDate: recipe.start_date,
    endDate: recipe.end_date,
    notes: recipe.notes,
    version: recipe.version,
    createdBy: recipe.created_by,
    createdAt: recipe.created_at,
    updatedAt: recipe.updated_at,
    images,
  };
}

// Insert media rows for a recipe. Videos are only for daily recipes.
async function insertMedia(db, recipeId, recipeType, images, videos) {
  if (Array.isArray(images)) {
    for (const img of images) {
      if (!img || !img.r2Key || !img.filename) continue;
      const id = generateToken();
      await db.prepare(
        `INSERT INTO recipe_media (id, recipe_id, recipe_type, media_type, dish_name, title, r2_key, filename, order_num)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        recipeId,
        recipeType,
        MEDIA_TYPES.IMAGE,
        recipeType === RECIPE_TYPES.DAILY ? (img.dishName || null) : null,
        img.title || null,
        img.r2Key,
        img.filename,
        img.order || 1
      ).run();
    }
  }
  // Only daily recipes support videos
  if (recipeType === RECIPE_TYPES.DAILY && Array.isArray(videos)) {
    for (const vid of videos) {
      if (!vid || !vid.r2Key || !vid.filename) continue;
      const id = generateToken();
      await db.prepare(
        `INSERT INTO recipe_media (id, recipe_id, recipe_type, media_type, dish_name, title, r2_key, filename, order_num)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        recipeId,
        recipeType,
        MEDIA_TYPES.VIDEO,
        null, // videos never have dish_name
        vid.title || null,
        vid.r2Key,
        vid.filename,
        vid.order || 1
      ).run();
    }
  }
}

// Invalidate KV cache for a recipe
async function invalidateRecipeCache(env, recipeType, schoolId, key) {
  if (!env.CACHE) return;
  await env.CACHE.delete(`recipe:${recipeType}:${schoolId}:${key}`);
}

// Read-through KV cache for a single recipe
async function getCachedRecipe(env, recipeType, schoolId, key, loader) {
  const cacheKey = `recipe:${recipeType}:${schoolId}:${key}`;
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // cache failure is non-fatal
    }
  }
  const recipe = await loader();
  if (recipe && env.CACHE) {
    try {
      await env.CACHE.put(cacheKey, JSON.stringify(recipe), { expirationTtl: CACHE_TTL });
    } catch {
      // cache failure is non-fatal
    }
  }
  return recipe;
}

// ---------------------------------------------------------------------------
// Daily recipes
// ---------------------------------------------------------------------------

// Get a daily recipe (with images and videos)
export async function getDailyRecipe(date, schoolId, env) {
  return getCachedRecipe(env, RECIPE_TYPES.DAILY, schoolId, date, async () => {
    const db = env.DB;
    const recipe = await db.prepare(
      'SELECT * FROM daily_recipes WHERE date = ? AND school_id = ?'
    ).bind(date, schoolId).first();
    if (!recipe) return null;
    const mediaList = await getMediaForRecipe(db, recipe.id);
    return formatDailyRecipe(recipe, mediaList);
  });
}

// Create or update a daily recipe with optimistic locking.
// Returns { id, version } on success or { error: 'VERSION_CONFLICT', currentVersion } on mismatch.
export async function putDailyRecipe(date, schoolId, userId, data, env) {
  const db = env.DB;
  const recipeId = `daily_${schoolId}_${date}`;

  const existing = await db.prepare(
    'SELECT * FROM daily_recipes WHERE date = ? AND school_id = ?'
  ).bind(date, schoolId).first();

  if (existing) {
    // Optimistic lock check
    if (data.version === undefined || data.version !== existing.version) {
      return { error: 'VERSION_CONFLICT', currentVersion: existing.version };
    }

    // Snapshot current state before mutating
    await createSnapshot(existing.id, RECIPE_TYPES.DAILY, userId, env);

    const newVersion = existing.version + 1;

    // Replace media
    await db.prepare('DELETE FROM recipe_media WHERE recipe_id = ?').bind(existing.id).run();
    await insertMedia(db, existing.id, RECIPE_TYPES.DAILY, data.images, data.videos);

    // Update recipe row
    await db.prepare(
      'UPDATE daily_recipes SET notes = ?, version = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(data.notes || null, newVersion, existing.id).run();

    await invalidateRecipeCache(env, RECIPE_TYPES.DAILY, schoolId, date);

    return { id: existing.id, version: newVersion };
  }

  // Create new recipe
  await db.prepare(
    `INSERT INTO daily_recipes (id, date, school_id, notes, version, created_by)
     VALUES (?, ?, ?, ?, 1, ?)`
  ).bind(recipeId, date, schoolId, data.notes || null, userId).run();

  await insertMedia(db, recipeId, RECIPE_TYPES.DAILY, data.images, data.videos);

  await invalidateRecipeCache(env, RECIPE_TYPES.DAILY, schoolId, date);

  return { id: recipeId, version: 1 };
}

// List daily recipes within a date range (inclusive)
export async function getDailyRecipeRange(startDate, endDate, schoolId, env) {
  const db = env.DB;
  const result = await db.prepare(
    'SELECT * FROM daily_recipes WHERE school_id = ? AND date >= ? AND date <= ? ORDER BY date DESC'
  ).bind(schoolId, startDate, endDate).all();

  const recipes = result.results || [];
  const list = [];
  for (const recipe of recipes) {
    const mediaList = await getMediaForRecipe(db, recipe.id);
    list.push(formatDailyRecipe(recipe, mediaList));
  }
  return list;
}

// ---------------------------------------------------------------------------
// Weekly recipes
// ---------------------------------------------------------------------------

// Get a weekly recipe (images only)
export async function getWeeklyRecipe(yearWeek, schoolId, env) {
  return getCachedRecipe(env, RECIPE_TYPES.WEEKLY, schoolId, yearWeek, async () => {
    const db = env.DB;
    const recipe = await db.prepare(
      'SELECT * FROM weekly_recipes WHERE year_week = ? AND school_id = ?'
    ).bind(yearWeek, schoolId).first();
    if (!recipe) return null;
    const mediaList = await getMediaForRecipe(db, recipe.id);
    return formatWeeklyRecipe(recipe, mediaList);
  });
}

// Create or update a weekly recipe with optimistic locking
export async function putWeeklyRecipe(yearWeek, schoolId, userId, data, env) {
  const db = env.DB;
  const parsed = parseYearWeek(yearWeek);
  if (!parsed) return { error: 'INVALID_FORMAT' };
  const { year, weekNumber } = parsed;
  const { startDate, endDate } = getWeekDateRange(year, weekNumber);
  const recipeId = `weekly_${schoolId}_${yearWeek}`;

  const existing = await db.prepare(
    'SELECT * FROM weekly_recipes WHERE year_week = ? AND school_id = ?'
  ).bind(yearWeek, schoolId).first();

  if (existing) {
    if (data.version === undefined || data.version !== existing.version) {
      return { error: 'VERSION_CONFLICT', currentVersion: existing.version };
    }

    await createSnapshot(existing.id, RECIPE_TYPES.WEEKLY, userId, env);

    const newVersion = existing.version + 1;

    await db.prepare('DELETE FROM recipe_media WHERE recipe_id = ?').bind(existing.id).run();
    await insertMedia(db, existing.id, RECIPE_TYPES.WEEKLY, data.images, null);

    await db.prepare(
      'UPDATE weekly_recipes SET notes = ?, version = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(data.notes || null, newVersion, existing.id).run();

    await invalidateRecipeCache(env, RECIPE_TYPES.WEEKLY, schoolId, yearWeek);

    return { id: existing.id, version: newVersion };
  }

  await db.prepare(
    `INSERT INTO weekly_recipes (id, year_week, year, week_number, start_date, end_date, school_id, notes, version, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).bind(recipeId, yearWeek, year, weekNumber, startDate, endDate, schoolId, data.notes || null, userId).run();

  await insertMedia(db, recipeId, RECIPE_TYPES.WEEKLY, data.images, null);

  await invalidateRecipeCache(env, RECIPE_TYPES.WEEKLY, schoolId, yearWeek);

  return { id: recipeId, version: 1 };
}

// List weekly recipes within a yearWeek range (inclusive)
export async function getWeeklyRecipeRange(startWeek, endWeek, schoolId, env) {
  const db = env.DB;
  const result = await db.prepare(
    'SELECT * FROM weekly_recipes WHERE school_id = ? AND year_week >= ? AND year_week <= ? ORDER BY year_week DESC'
  ).bind(schoolId, startWeek, endWeek).all();

  const recipes = result.results || [];
  const list = [];
  for (const recipe of recipes) {
    const mediaList = await getMediaForRecipe(db, recipe.id);
    list.push(formatWeeklyRecipe(recipe, mediaList));
  }
  return list;
}

// ---------------------------------------------------------------------------
// Snapshots & history
// ---------------------------------------------------------------------------

// Create a snapshot of the current recipe state (recipe + media) as JSON
export async function createSnapshot(recipeId, recipeType, userId, env) {
  const db = env.DB;

  let recipe;
  if (recipeType === RECIPE_TYPES.DAILY) {
    recipe = await db.prepare('SELECT * FROM daily_recipes WHERE id = ?').bind(recipeId).first();
  } else if (recipeType === RECIPE_TYPES.WEEKLY) {
    recipe = await db.prepare('SELECT * FROM weekly_recipes WHERE id = ?').bind(recipeId).first();
  }
  if (!recipe) return null;

  const mediaList = await getMediaForRecipe(db, recipeId);

  const snapshotData = JSON.stringify({
    recipe,
    media: mediaList,
  });

  const snapshotId = generateToken();
  await db.prepare(
    `INSERT INTO recipe_snapshots (id, recipe_id, recipe_type, version, snapshot_data, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(snapshotId, recipeId, recipeType, recipe.version, snapshotData, userId).run();

  return { snapshotId, version: recipe.version };
}

// Get snapshot history for a recipe (newest first)
export async function getRecipeHistory(recipeId, env) {
  const db = env.DB;
  const result = await db.prepare(
    `SELECT id, recipe_id, recipe_type, version, is_pinned, created_at, created_by
     FROM recipe_snapshots
     WHERE recipe_id = ?
     ORDER BY version DESC`
  ).bind(recipeId).all();
  return result.results || [];
}

// Rollback a recipe to a specific snapshot version.
// 1. Snapshot the current state (so rollback itself can be undone)
// 2. Restore recipe + media from the target snapshot
// 3. Bump version to current + 1
export async function rollbackRecipe(recipeId, version, env, userId = 'system') {
  const db = env.DB;

  const snapshot = await db.prepare(
    'SELECT * FROM recipe_snapshots WHERE recipe_id = ? AND version = ?'
  ).bind(recipeId, version).first();
  if (!snapshot) return { error: 'SNAPSHOT_NOT_FOUND' };

  const recipeType = snapshot.recipe_type;

  // Load current recipe to determine new version
  let current;
  if (recipeType === RECIPE_TYPES.DAILY) {
    current = await db.prepare('SELECT * FROM daily_recipes WHERE id = ?').bind(recipeId).first();
  } else {
    current = await db.prepare('SELECT * FROM weekly_recipes WHERE id = ?').bind(recipeId).first();
  }
  if (!current) return { error: 'RECIPE_NOT_FOUND' };

  // Snapshot current state before rollback
  await createSnapshot(recipeId, recipeType, userId, env);

  const newVersion = current.version + 1;
  const data = JSON.parse(snapshot.snapshot_data);
  const { recipe: snapRecipe, media: snapMedia } = data;

  // Restore recipe fields
  if (recipeType === RECIPE_TYPES.DAILY) {
    await db.prepare(
      'UPDATE daily_recipes SET notes = ?, version = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(snapRecipe.notes, newVersion, recipeId).run();
  } else {
    await db.prepare(
      'UPDATE weekly_recipes SET notes = ?, version = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(snapRecipe.notes, newVersion, recipeId).run();
  }

  // Restore media
  await db.prepare('DELETE FROM recipe_media WHERE recipe_id = ?').bind(recipeId).run();
  for (const m of snapMedia) {
    const newId = generateToken();
    await db.prepare(
      `INSERT INTO recipe_media (id, recipe_id, recipe_type, media_type, dish_name, title, r2_key, filename, order_num)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      newId,
      recipeId,
      m.recipe_type,
      m.media_type,
      m.dish_name,
      m.title,
      m.r2_key,
      m.filename,
      m.order_num
    ).run();
  }

  // Invalidate cache
  if (recipeType === RECIPE_TYPES.DAILY) {
    await invalidateRecipeCache(env, RECIPE_TYPES.DAILY, current.school_id, current.date);
  } else {
    await invalidateRecipeCache(env, RECIPE_TYPES.WEEKLY, current.school_id, current.year_week);
  }

  return { id: recipeId, version: newVersion };
}
