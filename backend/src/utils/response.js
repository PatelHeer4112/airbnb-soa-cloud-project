/**
 * Every successful response uses the same envelope:
 *   { success: true, data: ..., meta?: ... }
 * Errors (see middleware/errorHandler.js) use:
 *   { success: false, error: { code, message, details? } }
 */
function sendSuccess(res, data, { status = 200, meta } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

module.exports = { sendSuccess };
