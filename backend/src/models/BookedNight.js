const mongoose = require('mongoose');

/**
 * One document per (listing, night) that is held by an active booking.
 *
 * The UNIQUE index on { listingId, night } is the concurrency guard:
 * MongoDB itself refuses a second document for the same listing and night,
 * so two simultaneous requests for overlapping dates cannot both succeed.
 * This works on a single local MongoDB server, which does not support
 * multi-document transactions (those need a replica set).
 */
const bookedNightSchema = new mongoose.Schema(
  {
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    night: { type: Date, required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  },
  { versionKey: false }
);

bookedNightSchema.index({ listingId: 1, night: 1 }, { unique: true });
bookedNightSchema.index({ bookingId: 1 });

module.exports = mongoose.model('BookedNight', bookedNightSchema);
