/**
 * AVAILABILITY SERVICE
 * Answers "is this listing free for these dates?".
 *
 * Overlap rule (half-open intervals, check-out day is free):
 *   existing.checkIn < new.checkOut  AND  existing.checkOut > new.checkIn
 * Only active bookings (Pending, Confirmed) count; Cancelled ones are ignored.
 */
const { Booking } = require('../../models');
const { ACTIVE_STATUSES } = require('../../models/Booking');
const listingService = require('../listing/listing.service');
const { toDateString, todayUtc } = require('../../utils/dates');

function overlapFilter(checkIn, checkOut) {
  return {
    bookingStatus: { $in: ACTIVE_STATUSES },
    checkInDate: { $lt: checkOut },
    checkOutDate: { $gt: checkIn },
  };
}

/** Active bookings on one listing that overlap the requested stay. */
async function findOverlappingBookings(listingId, checkIn, checkOut) {
  return Booking.find({ listingId, ...overlapFilter(checkIn, checkOut) })
    .sort({ checkInDate: 1 })
    .select('checkInDate checkOutDate bookingStatus')
    .lean();
}

/** Full availability answer for GET /api/availability. */
async function checkAvailability({ listingId, checkIn, checkOut, nights }) {
  await listingService.getListingById(listingId, 'listingId'); // 404 if the listing does not exist
  const conflicts = await findOverlappingBookings(listingId, checkIn, checkOut);
  return {
    listingId,
    checkIn: toDateString(checkIn),
    checkOut: toDateString(checkOut),
    numberOfNights: nights,
    available: conflicts.length === 0,
    conflictingBookings: conflicts.map((b) => ({
      checkInDate: toDateString(b.checkInDate),
      checkOutDate: toDateString(b.checkOutDate),
      bookingStatus: b.bookingStatus,
    })),
  };
}

/**
 * Upcoming active bookings for a listing (for calendars in the frontend).
 * Guest details are deliberately not returned.
 */
async function getActiveBookings(listingId) {
  await listingService.getListingById(listingId, 'listingId');
  const bookings = await Booking.find({
    listingId,
    bookingStatus: { $in: ACTIVE_STATUSES },
    checkOutDate: { $gt: todayUtc() },
  })
    .sort({ checkInDate: 1 })
    .select('checkInDate checkOutDate bookingStatus')
    .lean();

  return {
    listingId,
    bookedRanges: bookings.map((b) => ({
      checkInDate: toDateString(b.checkInDate),
      checkOutDate: toDateString(b.checkOutDate),
      bookingStatus: b.bookingStatus,
    })),
  };
}

/** IDs of every listing that is NOT free for the whole stay (used by the Search Service). */
async function getUnavailableListingIds(checkIn, checkOut) {
  return Booking.distinct('listingId', overlapFilter(checkIn, checkOut));
}

module.exports = {
  overlapFilter,
  findOverlappingBookings,
  checkAvailability,
  getActiveBookings,
  getUnavailableListingIds,
};
