const ApiError = require('../utils/ApiError');
const { parseDateOnly, todayUtc, nightsBetween } = require('../utils/dates');

const MAX_NIGHTS = 30;

/**
 * Validate a check-in / check-out pair given as "YYYY-MM-DD" strings.
 * Rules: both required, real calendar dates, check-in not in the past,
 * check-out after check-in, stay no longer than MAX_NIGHTS.
 * Returns { checkIn, checkOut, nights } as UTC-midnight Dates.
 */
function validateDateRange(checkInRaw, checkOutRaw, names = { in: 'checkInDate', out: 'checkOutDate' }) {
  const errors = [];
  const checkIn = parseDateOnly(checkInRaw);
  const checkOut = parseDateOnly(checkOutRaw);

  if (checkInRaw === undefined || checkInRaw === '') {
    errors.push({ field: names.in, message: `${names.in} is required` });
  } else if (!checkIn) {
    errors.push({ field: names.in, message: `${names.in} must be a valid date in YYYY-MM-DD format` });
  }
  if (checkOutRaw === undefined || checkOutRaw === '') {
    errors.push({ field: names.out, message: `${names.out} is required` });
  } else if (!checkOut) {
    errors.push({ field: names.out, message: `${names.out} must be a valid date in YYYY-MM-DD format` });
  }

  if (checkIn && checkIn < todayUtc()) {
    errors.push({ field: names.in, message: `${names.in} cannot be in the past` });
  }
  if (checkIn && checkOut) {
    if (checkOut <= checkIn) {
      errors.push({ field: names.out, message: `${names.out} must be after ${names.in}` });
    } else if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) {
      errors.push({ field: names.out, message: `A stay cannot be longer than ${MAX_NIGHTS} nights` });
    }
  }

  if (errors.length) throw ApiError.badRequest('Invalid date range', errors);
  return { checkIn, checkOut, nights: nightsBetween(checkIn, checkOut) };
}

module.exports = { validateDateRange, MAX_NIGHTS };
