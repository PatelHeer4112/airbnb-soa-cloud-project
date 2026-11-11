const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');

/**
 * Central error handler. Converts every error into the standard JSON shape
 * and never leaks stack traces or internal messages to clients.
 */
// Express identifies error handlers by their four arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (error instanceof mongoose.Error.CastError) {
    error = new ApiError(400, 'INVALID_ID', `Invalid value for ${error.path}`);
  } else if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((e) => ({ field: e.path, message: e.message }));
    error = ApiError.badRequest('Validation failed', details);
  } else if (error.type === 'entity.parse.failed') {
    error = new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  } else if (error.type === 'entity.too.large') {
    error = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  } else if (error.message === 'Not allowed by CORS') {
    error = new ApiError(403, 'CORS_FORBIDDEN', 'Origin not allowed');
  } else if (
    ['MongoServerSelectionError', 'MongoNetworkError', 'MongoNotConnectedError'].includes(error.name)
  ) {
    error = new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database is temporarily unavailable');
  }

  if (!(error instanceof ApiError)) {
    // Log the real problem on the server, but send only a generic message.
    if (!config.isTest) console.error('[unhandled error]', err);
    error = new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }

  const body = { success: false, error: { code: error.code, message: error.message } };
  if (error.details) body.error.details = error.details;
  res.status(error.statusCode).json(body);
}

module.exports = errorHandler;
