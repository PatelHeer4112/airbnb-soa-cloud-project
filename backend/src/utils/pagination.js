const ApiError = require('./ApiError');

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function parsePositiveInt(value, name) {
  if (value === undefined || value === '') return undefined;
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) {
    throw ApiError.badRequest(`${name} must be a positive integer`, [
      { field: name, message: `${name} must be a positive integer` },
    ]);
  }
  return Number(value);
}

/** Read ?page and ?limit from the query string with safe defaults and a hard cap. */
function getPagination(query) {
  const page = parsePositiveInt(query.page, 'page') || 1;
  const requested = parsePositiveInt(query.limit, 'limit') || DEFAULT_LIMIT;
  const limit = Math.min(requested, MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

function buildMeta({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

module.exports = { getPagination, buildMeta, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT };
