const ApiError = require('../utils/ApiError');

/** Catch-all for routes that do not exist. */
function notFound(req, res, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

module.exports = notFound;
