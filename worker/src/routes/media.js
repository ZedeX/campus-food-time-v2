// Media routes: proxy R2 files through Worker with auth and share-token support
import { success, error, unauthorized, ERROR_CODES } from '../utils/response.js';
import { verifySession } from '../services/authService.js';
import { generateToken } from '../utils/crypto.js';
import { USER_TYPES } from '../utils/constants.js';

const SHARE_TOKEN_TTL = 3600; // 1 hour

// Extension to Content-Type mapping
const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

// Determine Content-Type from a filename
function contentTypeFromFilename(filename) {
  if (!filename) return 'application/octet-stream';
  const ext = filename.split('.').pop()?.toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

// Create a temporary share token for a media file (stored in KV, 1h expiry)
export async function createShareToken(mediaId, env) {
  if (!env.CACHE) return null;
  const token = generateToken();
  await env.CACHE.put(`share:${token}`, mediaId, { expirationTtl: SHARE_TOKEN_TTL });
  return token;
}

// Verify a share token against KV; returns the mediaId if valid
async function verifyShareToken(token, env) {
  if (!env.CACHE || !token) return null;
  const mediaId = await env.CACHE.get(`share:${token}`);
  return mediaId || null;
}

export const mediaRoutes = {
  // GET /media/:id — stream a media file from R2
  // Auth: logged-in teacher/parent/admin, OR valid ?token=<shareToken>
  async getMedia(request, env, ctx, params) {
    const { id } = params;
    if (!id) {
      return error(ERROR_CODES.MISSING_PARAMS);
    }

    const url = new URL(request.url);
    const shareToken = url.searchParams.get('token');

    let authorizedMediaId = null;

    // Path A: share token verification (no login required)
    if (shareToken) {
      const tokenMediaId = await verifyShareToken(shareToken, env);
      if (!tokenMediaId) {
        return unauthorized(ERROR_CODES.TOKEN_INVALID);
      }
      // Token must match the requested media id
      if (tokenMediaId !== id) {
        return unauthorized(ERROR_CODES.TOKEN_INVALID);
      }
      authorizedMediaId = id;
    } else {
      // Path B: session verification
      const user = await verifySession(request, env);
      if (!user) {
        return unauthorized();
      }
      if (
        user.type !== USER_TYPES.TEACHER &&
        user.type !== USER_TYPES.PARENT &&
        user.type !== USER_TYPES.ADMIN
      ) {
        return unauthorized(ERROR_CODES.PERMISSION_DENIED);
      }
      authorizedMediaId = id;
    }

    // Look up the media record in D1 to get the R2 key
    const media = await env.DB.prepare(
      'SELECT r2_key, filename FROM recipe_media WHERE id = ?'
    ).bind(authorizedMediaId).first();

    if (!media || !media.r2_key) {
      return error(ERROR_CODES.RECIPE_NOT_FOUND, 404);
    }

    // Fetch the object from R2
    let r2Object;
    try {
      r2Object = await env.BUCKET.get(media.r2_key);
    } catch (err) {
      console.error('R2 get error:', err);
      return error(ERROR_CODES.SYSTEM_ERROR, 500);
    }

    if (!r2Object) {
      return error(ERROR_CODES.RECIPE_NOT_FOUND, 404);
    }

    // Determine Content-Type: prefer R2 stored metadata, fall back to filename
    const contentType =
      r2Object.httpMetadata?.contentType || contentTypeFromFilename(media.filename);

    // Stream the file back to the client
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', String(r2Object.size));
    headers.set('Cache-Control', 'private, max-age=3600');
    // Allow inline display (images/videos in browser)
    headers.set('Content-Disposition', `inline; filename="${media.filename || 'media'}"`);

    return new Response(r2Object.body, { status: 200, headers });
  },
};
