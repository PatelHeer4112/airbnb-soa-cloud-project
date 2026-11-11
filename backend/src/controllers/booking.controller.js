const bookingService = require('../services/booking/booking.service');
const { validateCreateBooking, validateStatusUpdate } = require('../validators/booking.validator');
const { sendSuccess } = require('../utils/response');

async function createBooking(req, res) {
  const input = validateCreateBooking(req.body);
  const booking = await bookingService.createBooking(input);
  sendSuccess(res, booking, { status: 201 });
}

async function getBookingById(req, res) {
  const booking = await bookingService.getBookingById(req.params.id);
  sendSuccess(res, booking);
}

async function updateBookingStatus(req, res) {
  const status = validateStatusUpdate(req.body);
  const booking = await bookingService.updateBookingStatus(req.params.id, status);
  sendSuccess(res, booking);
}

module.exports = { createBooking, getBookingById, updateBookingStatus };
