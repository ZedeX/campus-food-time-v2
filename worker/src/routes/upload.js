// Upload routes: presign (generate R2 key) and direct (write file to R2)
import { success, error, unauthorized, forbidden, ERROR_CODES } from '../utils/response.js';
import { verifySession } from '../services/authService.js';
import { generateToken } from '../utils/crypto.js';
import { getISOWeek, getWeekDateRange, parseYearWeek, isValidDate, isValidYearWeek } from '../utils/dateUtils.js';
import { USER_TYPES } from '../utils/constants.js';

// Max upload size: 100 MB (matches PRD video limit)
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

// Map MIME type to file extension
const EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

// Determine media type (image/video) from MIME type
function mediaTypeFromMime(fileType) {
  if (!fileType) return null;
  if (fileType.startsWith('image/')) return 'image';
  if (fileType.startsWith('video/')) return 'video';
  return null;
}

// Pad a number to 2 digits
function pad2(n) {
  return String(n).padStart(2, '0');
}

// Build the R2 object key for a daily recipe file
// Images: YYYY-MM/YYYY-MM-DD-NN.ext  (NN starts at 01)
// Videos: YYYY-MM/YYYY-MM-DD-NN.ext  (NN starts at 10)
function buildDailyKey(date, order, mediaType, ext) {
  const month = date.slice(0, 7); // YYYY-MM
  const seq = pad2(mediaType === 'video' ? 10 + (order - 1) : order);
  return `${month}/${date}-${seq}.${ext}`;
}

// Build the R2 object key for a weekly recipe image
// Format: YYYY-MM/YYYY-WNN-NN.ext  (month = Monday of that week)
function buildWeeklyKey(yearWeek, order, ext) {
  const parsed = parseYearWeek(yearWeek);
  if (!parsed) return null;
  const { startDate } = getWeekDateRange(parsed.year, parsed.weekNumber);
  const month = startDate.slice(0, 7); // month of the Monday
  const seq = pad2(order);
  return `${month}/${yearWeek}-${seq}.${ext}`;
}

// Verify the caller is a teacher
async function verifyTeacher(request, env) {
  const user = await verifySession(request, env);
  if (!user) return { error: unauthorized() };
  if (user.type !== USER_TYPES.TEACHER) {
    return { error: forbidden() };
  }
  return { user };
}

export const uploadRoutes = {
  // POST /api/upload/presign
  // Body: { fileType, date, order, type: "daily"|"weekly" }
  // Returns: { fileKey, uploadUrl }
  async presign(request, env) {
    const auth = await verifyTeacher(request, env);
    if (auth.error) return auth.error;

    let body;
    try {
      body = await request.json();
    } catch {
      return error(ERROR_CODES.MISSING_PARAMS);
    }

    if (!body || !body.fileType || !body.type || body.order === undefined) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }

    const mediaType = mediaTypeFromMime(body.fileType);
    if (!mediaType) {
      return error(ERROR_CODES.INVALID_FILE_TYPE);
    }

    const ext = EXTENSION_MAP[body.fileType.toLowerCase()];
    if (!ext) {
      return error(ERROR_CODES.INVALID_FILE_TYPE);
    }

    const order = parseInt(body.order, 10);
    if (isNaN(order) || order < 1) {
      return error(ERROR_CODES.INVALID_PARAMS);
    }

    let fileKey = null;

    if (body.type === 'daily') {
      // Weekly recipes don't support videos
      const date = body.date;
      if (!date || !isValidDate(date)) {
        return error(ERROR_CODES.INVALID_FORMAT);
      }
      fileKey = buildDailyKey(date, order, mediaType, ext);
    } else if (body.type === 'weekly') {
      if (mediaType !== 'image') {
        return error(ERROR_CODES.INVALID_FILE_TYPE);
      }
      // Accept either yearWeek or date (derive week from date)
      let yearWeek = body.yearWeek;
      if (!yearWeek && body.date) {
        if (!isValidDate(body.date)) {
          return error(ERROR_CODES.INVALID_FORMAT);
        }
        yearWeek = getISOWeek(body.date).yearWeek;
      }
      if (!yearWeek || !isValidYearWeek(yearWeek)) {
        return error(ERROR_CODES.INVALID_FORMAT);
      }
      fileKey = buildWeeklyKey(yearWeek, order, ext);
    } else {
      return error(ERROR_CODES.INVALID_PARAMS);
    }

    return success({ fileKey, uploadUrl: '/api/upload/direct' }, 'OK');
  },

  // POST /api/upload/direct?key=<fileKey>
  // Body: raw binary file content
  // Returns: { fileKey }
  async direct(request, env) {
    const auth = await verifyTeacher(request, env);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const fileKey = url.searchParams.get('key');
    if (!fileKey) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }

    // Basic key format validation to prevent path traversal
    if (fileKey.includes('..') || fileKey.startsWith('/')) {
      return error(ERROR_CODES.INVALID_PARAMS);
    }

    // Enforce size limit via Content-Length header
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_UPLOAD_BYTES) {
      return error(ERROR_CODES.FILE_TOO_LARGE);
    }

    // Read binary body
    let body;
    try {
      body = await request.arrayBuffer();
    } catch {
      return error(ERROR_CODES.FILE_UPLOAD_FAILED);
    }

    if (!body || body.byteLength === 0) {
      return error(ERROR_CODES.FILE_UPLOAD_FAILED);
    }

    if (body.byteLength > MAX_UPLOAD_BYTES) {
      return error(ERROR_CODES.FILE_TOO_LARGE);
    }

    // Determine content type from request header, fall back to octet-stream
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

    try {
      await env.BUCKET.put(fileKey, body, {
        httpMetadata: { contentType },
      });
    } catch (err) {
      console.error('R2 put error:', err);
      return error(ERROR_CODES.FILE_UPLOAD_FAILED, 500);
    }

    return success({ fileKey }, '上传成功');
  },
};
