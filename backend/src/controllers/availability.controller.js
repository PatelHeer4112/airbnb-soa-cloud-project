const availabilityService = require('../services/availability/availability.service');
const { validateAvailabilityQuery } = require('../validators/availability.validator');
const { sendSuccess } = require('../utils/response');

async function checkAvailability(req, res) {
  const query = validateAvailabilityQuery(req.query);
  const result = await availabilityService.checkAvailability(query);
  sendSuccess(res, result);
}

async function getActiveBookings(req, res) {
  const result = await availabilityService.getActiveBookings(req.params.listingId);
  sendSuccess(res, result);
}

module.exports = { checkAvailability, getActiveBookings };
