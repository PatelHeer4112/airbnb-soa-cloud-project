// Run against a separately checked-out backend; never copies backend source here.
// Real HTTP app, routes, validators, response formatting and CORS; stubbed storage services.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { createApi } from '../src/api.js';

if (!process.argv[2]) throw Error('Usage: node scripts/check-backend-contract.mjs <absolute-backend-directory>');
process.env.NODE_ENV = 'test';
const backend = resolve(process.argv[2]);
const requireBackend = createRequire(join(backend, 'package.json'));
const backendModule = (path) => requireBackend(join(backend, 'src', path));
const listingService = backendModule('services/listing/listing.service.js');
const searchService = backendModule('services/search/search.service.js');
const availabilityService = backendModule('services/availability/availability.service.js');
const bookingService = backendModule('services/booking/booking.service.js');
const ApiError = backendModule('utils/ApiError.js');
const id = 'a'.repeat(24), bookingId = 'b'.repeat(24);
const listing = { _id: id, title: 'Contract check stay', city: 'London', country: 'United Kingdom', location: 'Greenwich', propertyType: 'Cottage', pricePerNight: 120, maxGuests: 4, bedrooms: 2, bathrooms: 1, rating: 4.8, amenities: ['Wi-Fi'], imageUrls: [] };
const draft = { listingId: id, guestName: ' Test Guest ', guestEmail: 'TEST@example.com', numberOfGuests: 2, checkInDate: '2099-01-01', checkOutDate: '2099-01-03' };
let stored, conflict = false;
const checks = [];
async function check(name, fn) { await fn(); checks.push(name); console.log(`PASS ${name}`); }

listingService.getListingById = async (requested) => { assert.equal(requested, id); return listing; };
searchService.searchListings = async (criteria, pagination) => {
  assert.equal(criteria.location, 'London'); assert.equal(criteria.guests, 2);
  assert.equal(criteria.propertyType, 'Cottage'); assert.equal(criteria.sort, 'price_asc');
  assert.equal(criteria.minPrice, 0); assert.equal(criteria.maxPrice, 200);
  assert.equal(criteria.checkIn.toISOString().slice(0, 10), draft.checkInDate);
  assert.equal(pagination.limit, 8);
  return { items: [listing], meta: { page: 1, limit: 8, total: 1, totalPages: 1 } };
};
availabilityService.getActiveBookings = async (requested) => ({ listingId: requested, bookedRanges: [] });
availabilityService.checkAvailability = async (input) => {
  assert.equal(input.listingId, id); assert.equal(input.nights, 2);
  return { listingId: id, available: true, numberOfNights: input.nights };
};
bookingService.createBooking = async (input) => {
  if (conflict) throw ApiError.conflict('The listing is not available for the selected dates', [{ checkInDate: draft.checkInDate, checkOutDate: draft.checkOutDate }]);
  assert.equal(input.guestName, 'Test Guest'); assert.equal(input.guestEmail, 'test@example.com');
  assert.equal(input.numberOfGuests, 2); assert.equal(input.nights, 2);
  stored = bookingService.formatBooking({ _id: bookingId, ...input, checkInDate: input.checkIn, checkOutDate: input.checkOut, numberOfNights: input.nights, pricePerNight: 120, totalPrice: 240, bookingStatus: 'Pending' }, listing);
  return stored;
};
bookingService.getBookingById = async (requested) => { assert.equal(requested, bookingId); return stored; };
bookingService.updateBookingStatus = async (requested, status) => { assert.equal(requested, bookingId); assert.equal(status, 'Cancelled'); return { ...stored, bookingStatus: status }; };
const app = backendModule('app.js')();
const server = await new Promise((done) => { const server = app.listen(0, '127.0.0.1', () => done(server)); });
const base = `http://127.0.0.1:${server.address().port}`;
const api = createApi(base);
try {
  await check('search filters, dates, pagination and response envelope', async () => {
    const body = await api.search({ location: 'London', guests: 2, propertyType: 'Cottage', minPrice: 0, maxPrice: 200, sort: 'price_asc', page: 1, limit: 8, checkIn: draft.checkInDate, checkOut: draft.checkOutDate });
    assert.equal(body.data[0]._id, id); assert.equal(body.meta.totalPages, 1);
  });
  await check('listing details endpoint and fields', async () => assert.deepEqual((await api.listing(id)).data, listing));
  await check('reserved date ranges endpoint', async () => assert.deepEqual((await api.ranges(id)).data.bookedRanges, []));
  await check('availability query field names and date validation', async () => assert.equal((await api.availability(id, draft.checkInDate, draft.checkOutDate)).data.available, true));
  await check('booking payload accepted and real backend formatter matches UI', async () => {
    const { data } = await api.book(draft); assert.equal(data._id, bookingId); assert.equal(data.totalPrice, 240);
    assert.equal(data.bookingStatus, 'Pending'); assert.equal(data.checkInDate, draft.checkInDate); assert.equal(data.listing.title, listing.title);
  });
  await check('booking reference lookup', async () => assert.equal((await api.booking(bookingId)).data._id, bookingId));
  await check('cancellation payload accepted by backend status validator', async () => assert.equal((await api.cancel(bookingId)).data.bookingStatus, 'Cancelled'));
  await check('field validation errors reach frontend client', async () => {
    await assert.rejects(api.book({ ...draft, numberOfGuests: '2', guestEmail: 'invalid' }), error => error.status === 400 && error.code === 'VALIDATION_ERROR' && error.details.some(d => d.field === 'guestEmail') && error.details.some(d => d.field === 'numberOfGuests'));
  });
  await check('30-night limit and reversed date rejection', async () => {
    for (const end of ['2099-01-01', '2099-02-10']) await assert.rejects(api.availability(id, draft.checkInDate, end), error => error.status === 400 && error.code === 'VALIDATION_ERROR');
  });
  await check('booking conflict response reaches frontend with details', async () => { conflict = true; await assert.rejects(api.book(draft), error => error.status === 409 && error.code === 'BOOKING_CONFLICT' && error.details.length === 1); });
  await check('frontend development origin allowed by CORS', async () => {
    const response = await fetch(`${base}/api/listings/${id}`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });
  await check('booking and cancellation CORS preflight allowed', async () => {
    for (const method of ['POST', 'PATCH']) {
      const response = await fetch(`${base}/api/bookings`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'content-type' } });
      assert.equal(response.status, 204); assert.ok(response.headers.get('access-control-allow-methods').includes(method));
    }
  });
  console.log(`\n${checks.length} backend HTTP contract checks passed. Database services were stubbed; MongoDB persistence was not tested.`);
} finally { await new Promise((done) => server.close(done)); }
