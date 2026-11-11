const ApiError = require('../utils/ApiError');
const { BOOKING_STATUSES } = require('../models/Booking');
const { validateDateRange } = require('./common');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Validate the body of POST /api/bookings.
 * Collects every problem so the frontend can show all field errors at once.
 */
function validateCreateBooking(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.badRequest('Request body must be a JSON object');
  }
  const errors = [];

  const { listingId, guestName, guestEmail, numberOfGuests, checkInDate, checkOutDate } = body;

  if (listingId === undefined || listingId === '') {
    errors.push({ field: 'listingId', message: 'listingId is required' });
  } else if (typeof listingId !== 'string' || !OBJECT_ID.test(listingId)) {
    errors.push({ field: 'listingId', message: 'listingId must be a 24-character hexadecimal ID' });
  }

  const name = typeof guestName === 'string' ? guestName.trim() : '';
  if (!name) {
    errors.push({ field: 'guestName', message: 'guestName is required' });
  } else if (name.length < 2 || name.length > 100) {
    errors.push({ field: 'guestName', message: 'guestName must be between 2 and 100 characters' });
  }

  const email = typeof guestEmail === 'string' ? guestEmail.trim().toLowerCase() : '';
  if (!email) {
    errors.push({ field: 'guestEmail', message: 'guestEmail is required' });
  } else if (email.length > 254 || !EMAIL.test(email)) {
    errors.push({ field: 'guestEmail', message: 'guestEmail must be a valid email address' });
  }

  if (numberOfGuests === undefined || numberOfGuests === null || numberOfGuests === '') {
    errors.push({ field: 'numberOfGuests', message: 'numberOfGuests is required' });
  } else if (!Number.isInteger(numberOfGuests) || numberOfGuests < 1) {
    errors.push({ field: 'numberOfGuests', message: 'numberOfGuests must be a positive whole number' });
  }

  let range;
  try {
    range = validateDateRange(checkInDate, checkOutDate);
  } catch (err) {
    errors.push(...(err.details || []));
  }

  if (errors.length) throw ApiError.badRequest('Invalid booking request', errors);

  return {
    listingId,
    guestName: name,
    guestEmail: email,
    numberOfGuests,
    checkIn: range.checkIn,
    checkOut: range.checkOut,
    nights: range.nights,
  };
}

/** Validate the body of PATCH /api/bookings/:id/status */
function validateStatusUpdate(body) {
  const status = body && body.bookingStatus;
  if (!BOOKING_STATUSES.includes(status) || status === 'Pending') {
    throw ApiError.badRequest('Invalid status update', [
      { field: 'bookingStatus', message: 'bookingStatus must be either Confirmed or Cancelled' },
    ]);
  }
  return status;
}

module.exports = { validateCreateBooking, validateStatusUpdate };
