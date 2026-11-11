const ApiError = require('../utils/ApiError');
const { PROPERTY_TYPES } = require('../models/Listing');
const { validateDateRange } = require('./common');

const SORT_OPTIONS = ['newest', 'price_asc', 'price_desc', 'rating_desc'];

function optionalString(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null; // e.g. ?city=a&city=b arrives as an array
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Validate and normalise the query string for GET /api/search.
 * Returns a clean criteria object; throws 400 with field-level details.
 */
function validateSearchQuery(query) {
  const errors = [];
  const criteria = {};

  for (const field of ['city', 'location', 'country']) {
    const value = optionalString(query[field]);
    if (value === null || (value && value.length > 100)) {
      errors.push({ field, message: `${field} must be a single text value of at most 100 characters` });
    } else if (value) {
      criteria[field] = value;
    }
  }

  for (const field of ['minPrice', 'maxPrice']) {
    const raw = optionalString(query[field]);
    if (raw === undefined) continue;
    const num = Number(raw);
    if (raw === null || !Number.isFinite(num) || num < 0) {
      errors.push({ field, message: `${field} must be a number greater than or equal to 0` });
    } else {
      criteria[field] = num;
    }
  }
  if (criteria.minPrice !== undefined && criteria.maxPrice !== undefined && criteria.minPrice > criteria.maxPrice) {
    errors.push({ field: 'minPrice', message: 'minPrice cannot be greater than maxPrice' });
  }

  const propertyType = optionalString(query.propertyType);
  if (propertyType !== undefined) {
    const match = propertyType && PROPERTY_TYPES.find((t) => t.toLowerCase() === propertyType.toLowerCase());
    if (!match) {
      errors.push({ field: 'propertyType', message: `propertyType must be one of: ${PROPERTY_TYPES.join(', ')}` });
    } else {
      criteria.propertyType = match;
    }
  }

  const guests = optionalString(query.guests);
  if (guests !== undefined) {
    if (guests === null || !/^\d+$/.test(guests) || Number(guests) < 1) {
      errors.push({ field: 'guests', message: 'guests must be a positive integer' });
    } else {
      criteria.guests = Number(guests);
    }
  }

  const amenities = optionalString(query.amenities);
  if (amenities === null) {
    errors.push({ field: 'amenities', message: 'amenities must be a comma-separated list' });
  } else if (amenities) {
    criteria.amenities = amenities.split(',').map((a) => a.trim()).filter(Boolean);
  }

  const sort = optionalString(query.sort);
  if (sort !== undefined) {
    if (!SORT_OPTIONS.includes(sort)) {
      errors.push({ field: 'sort', message: `sort must be one of: ${SORT_OPTIONS.join(', ')}` });
    } else {
      criteria.sort = sort;
    }
  }

  // Optional date filter: only return listings free for the whole stay.
  const checkIn = optionalString(query.checkIn);
  const checkOut = optionalString(query.checkOut);
  if (checkIn !== undefined || checkOut !== undefined) {
    try {
      const range = validateDateRange(checkIn, checkOut, { in: 'checkIn', out: 'checkOut' });
      criteria.checkIn = range.checkIn;
      criteria.checkOut = range.checkOut;
    } catch (err) {
      errors.push(...(err.details || []));
    }
  }

  if (errors.length) throw ApiError.badRequest('Invalid search parameters', errors);
  return criteria;
}

module.exports = { validateSearchQuery, SORT_OPTIONS };
