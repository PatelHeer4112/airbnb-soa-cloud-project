const { assertObjectId } = require('../utils/validateObjectId');
const { validateDateRange } = require('./common');

/** Validate GET /api/availability?listingId=&checkIn=&checkOut= */
function validateAvailabilityQuery(query) {
  assertObjectId(query.listingId, 'listingId');
  const { checkIn, checkOut, nights } = validateDateRange(query.checkIn, query.checkOut, {
    in: 'checkIn',
    out: 'checkOut',
  });
  return { listingId: query.listingId, checkIn, checkOut, nights };
}

module.exports = { validateAvailabilityQuery };
