/**
 * BOOKING SERVICE
 * Creates and manages bookings. Before accepting a booking it:
 *   1. validates the request (validators/booking.validator.js),
 *   2. loads the listing through the Listing Service,
 *   3. checks guest capacity,
 *   4. asks the Availability Service for overlapping bookings,
 *   5. atomically reserves each night (unique index on BookedNight),
 *   6. stores the booking with a server-calculated price.
 *
 * Step 5 is what makes concurrent requests safe: if two requests race
 * past step 4, only one can insert the night documents; the other gets a
 * duplicate-key error from MongoDB and receives 409 Conflict.
 */
const mongoose = require('mongoose');
const { Booking, BookedNight } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { assertObjectId } = require('../../utils/validateObjectId');
const { eachNight, toDateString } = require('../../utils/dates');
const listingService = require('../listing/listing.service');
const availabilityService = require('../availability/availability.service');

function isDuplicateKeyError(err) {
  return err && (err.code === 11000 || (Array.isArray(err.writeErrors) && err.writeErrors.some((e) => e.code === 11000)));
}

function conflictError(conflicts = []) {
  return ApiError.conflict(
    'The listing is not available for the selected dates',
    conflicts.map((b) => ({
      checkInDate: toDateString(b.checkInDate),
      checkOutDate: toDateString(b.checkOutDate),
    }))
  );
}

/** Shape a booking document for API responses (dates as YYYY-MM-DD). */
function formatBooking(booking, listing) {
  const out = {
    _id: booking._id,
    listingId: booking.listingId,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    checkInDate: toDateString(booking.checkInDate),
    checkOutDate: toDateString(booking.checkOutDate),
    numberOfGuests: booking.numberOfGuests,
    numberOfNights: booking.numberOfNights,
    pricePerNight: booking.pricePerNight,
    totalPrice: booking.totalPrice,
    bookingStatus: booking.bookingStatus,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
  if (listing) {
    out.listing = {
      _id: listing._id,
      title: listing.title,
      city: listing.city,
      country: listing.country,
      imageUrls: listing.imageUrls,
    };
  }
  return out;
}

/** Atomically claim every night of the stay, or none of them. */
async function reserveNights(listingId, bookingId, checkIn, checkOut) {
  const docs = eachNight(checkIn, checkOut).map((night) => ({ listingId, night, bookingId }));
  try {
    await BookedNight.insertMany(docs, { ordered: true });
  } catch (err) {
    // Undo any nights this request managed to insert before the failure.
    await BookedNight.deleteMany({ bookingId });
    if (isDuplicateKeyError(err)) {
      const conflicts = await availabilityService.findOverlappingBookings(listingId, checkIn, checkOut);
      throw conflictError(conflicts);
    }
    throw err;
  }
}

async function releaseNights(bookingId) {
  await BookedNight.deleteMany({ bookingId });
}

async function createBooking(input) {
  const { listingId, guestName, guestEmail, numberOfGuests, checkIn, checkOut, nights } = input;

  const listing = await listingService.getListingById(listingId, 'listingId');

  if (numberOfGuests > listing.maxGuests) {
    throw new ApiError(400, 'GUEST_CAPACITY_EXCEEDED', `This listing allows at most ${listing.maxGuests} guests`, [
      { field: 'numberOfGuests', message: `numberOfGuests cannot exceed ${listing.maxGuests}` },
    ]);
  }

  // Fast, readable check first: most conflicts are caught here.
  const conflicts = await availabilityService.findOverlappingBookings(listingId, checkIn, checkOut);
  if (conflicts.length) throw conflictError(conflicts);

  // Race-safe check: the unique index decides who wins.
  const bookingId = new mongoose.Types.ObjectId();
  await reserveNights(listing._id, bookingId, checkIn, checkOut);

  try {
    const booking = await Booking.create({
      _id: bookingId,
      listingId: listing._id,
      guestName,
      guestEmail,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      numberOfGuests,
      numberOfNights: nights,
      pricePerNight: listing.pricePerNight,
      totalPrice: Math.round(listing.pricePerNight * nights * 100) / 100,
      bookingStatus: 'Pending',
    });
    return formatBooking(booking, listing);
  } catch (err) {
    await releaseNights(bookingId);
    throw err;
  }
}

async function getBookingById(id) {
  assertObjectId(id, 'id');
  const booking = await Booking.findById(id).lean();
  if (!booking) throw ApiError.notFound(`Booking ${id} not found`);
  const listing = await listingService.getListingById(String(booking.listingId)).catch(() => null);
  return formatBooking(booking, listing);
}

// Which statuses each target status may be reached from.
const ALLOWED_FROM = {
  Confirmed: ['Pending'],
  Cancelled: ['Pending', 'Confirmed'],
};

/**
 * Change a booking's status. The status condition is part of the update
 * filter, so two simultaneous updates cannot both apply.
 */
async function updateBookingStatus(id, newStatus) {
  assertObjectId(id, 'id');
  const updated = await Booking.findOneAndUpdate(
    { _id: id, bookingStatus: { $in: ALLOWED_FROM[newStatus] } },
    { $set: { bookingStatus: newStatus } },
    { returnDocument: 'after', runValidators: true }
  ).lean();

  if (!updated) {
    const existing = await Booking.findById(id).select('bookingStatus').lean();
    if (!existing) throw ApiError.notFound(`Booking ${id} not found`);
    throw new ApiError(
      409,
      'INVALID_STATUS_TRANSITION',
      `Cannot change booking status from ${existing.bookingStatus} to ${newStatus}`
    );
  }

  if (newStatus === 'Cancelled') await releaseNights(updated._id);

  const listing = await listingService.getListingById(String(updated.listingId)).catch(() => null);
  return formatBooking(updated, listing);
}

module.exports = { createBooking, getBookingById, updateBookingStatus, formatBooking };
