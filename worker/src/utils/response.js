import { ERROR_CODES, ERROR_MESSAGES } from './constants.js';

// Re-export ERROR_CODES so route files can import all response helpers from one module
export { ERROR_CODES };

// Success response
export function success(data = null, message = '操作成功') {
  return Response.json({ code: 0, message, data }, { status: 200 });
}

// Error response
export function error(code, status = 400, extra = null) {
  const errInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.SYSTEM_ERROR];
  const body = { code, message: errInfo.message, userMessage: errInfo.userMessage };
  if (extra) body.data = extra;
  return Response.json(body, { status });
}

// Unauthorized response
export function unauthorized(code = ERROR_CODES.UNAUTHORIZED) {
  return error(code, 401);
}

// Forbidden response
export function forbidden() {
  return error(ERROR_CODES.PERMISSION_DENIED, 403);
}

// Not found response
export function notFound(code = ERROR_CODES.RECIPE_NOT_FOUND) {
  return error(code, 404);
}

// Conflict response (version conflict)
export function conflict(code = ERROR_CODES.VERSION_CONFLICT) {
  return error(code, 409);
}

// Internal server error
export function serverError(message = null) {
  return Response.json(
    { code: ERROR_CODES.SYSTEM_ERROR, message: message || '系统错误', userMessage: '系统繁忙，请稍后重试' },
    { status: 500 }
  );
}

// Parse JSON body from request
export async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Validate required fields
export function validateRequired(data, fields) {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      return { valid: false, field, code: ERROR_CODES.MISSING_PARAMS };
    }
  }
  return { valid: true };
}

// Mask phone number for display
export function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}
