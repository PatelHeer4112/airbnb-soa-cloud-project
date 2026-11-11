const mongoose = require('mongoose');

const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Cancelled'];
// Bookings in these statuses hold the dates; Cancelled bookings release them.
const ACTIVE_STATUSES = ['Pending', 'Confirmed'];

const bookingSchema = new mongoose.Schema(
  {
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    guestName: { type: String, required: [true, 'guestName is required'], trim: true, minlength: 2, maxlength: 100 },
    guestEmail: {
      type: String,
      required: [true, 'guestEmail is required'],
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'guestEmail must be a valid email address'],
    },
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    numberOfGuests: { type: Number, required: true, min: 1 },
    numberOfNights: { type: Number, required: true, min: 1 },
    // Copied from the listing at booking time so later price changes don't alter the booking.
    pricePerNight: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    bookingStatus: { type: String, enum: BOOKING_STATUSES, default: 'Pending' },
  },
  { timestamps: true, versionKey: false }
);

bookingSchema.pre('validate', function checkDates() {
  if (this.checkInDate && this.checkOutDate && this.checkOutDate <= this.checkInDate) {
    this.invalidate('checkOutDate', 'checkOutDate must be after checkInDate');
  }
});

// Supports the overlap query used by the Availability Service.
bookingSchema.index({ listingId: 1, bookingStatus: 1, checkInDate: 1, checkOutDate: 1 });
bookingSchema.index({ guestEmail: 1, createdAt: -1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
module.exports.ACTIVE_STATUSES = ACTIVE_STATUSES;
