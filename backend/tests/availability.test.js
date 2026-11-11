const request = require('supertest');
const createApp = require('../src/app');
const { setupDB, clearDB, teardownDB, createListing, day, bookingBody } = require('./helpers');

const app = createApp();

beforeAll(setupDB);
afterAll(teardownDB);

let listing;

beforeEach(async () => {
  await clearDB();
  listing = await createListing({ maxGuests: 4 });
  // Existing booking: nights of day 10, 11 and 12 (checks out on day 13).
  const res = await request(app).post('/api/bookings').send(bookingBody(listing._id, { checkInDate: day(10), checkOutDate: day(13) }));
  expect(res.status).toBe(201);
});

const check = (checkIn, checkOut, id = listing._id) =>
  request(app).get(`/api/availability?listingId=${id}&checkIn=${checkIn}&checkOut=${checkOut}`);

describe('Availability Service - GET /api/availability', () => {
  test.each([
    ['exactly the same dates', 10, 13],
    ['starts before and ends inside', 8, 11],
    ['starts inside and ends after', 12, 15],
    ['fully inside', 11, 12],
    ['fully surrounds', 9, 14],
  ])('reports unavailable when the stay %s', async (_label, from, to) => {
    const res = await check(day(from), day(to));
    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
    expect(res.body.data.conflictingBookings).toEqual([
      { checkInDate: day(10), checkOutDate: day(13), bookingStatus: 'Pending' },
    ]);
  });

  test('allows checking in on the day the previous guest checks out', async () => {
    const res = await check(day(13), day(15));
    expect(res.body.data).toEqual({
      listingId: String(listing._id),
      checkIn: day(13),
      checkOut: day(15),
      numberOfNights: 2,
      available: true,
      conflictingBookings: [],
    });
  });

  test('allows checking out on the day the next guest checks in', async () => {
    const res = await check(day(7), day(10));
    expect(res.body.data.available).toBe(true);
  });

  test('ignores cancelled bookings', async () => {
    const bookings = await request(app).get(`/api/availability/${listing._id}/bookings`);
    expect(bookings.body.data.bookedRanges).toHaveLength(1);

    // Find the booking ID via the conflict response, then cancel it.
    const { Booking } = require('../src/models');
    const existing = await Booking.findOne({ listingId: listing._id });
    const cancel = await request(app).patch(`/api/bookings/${existing._id}/status`).send({ bookingStatus: 'Cancelled' });
    expect(cancel.status).toBe(200);

    const res = await check(day(10), day(13));
    expect(res.body.data.available).toBe(true);
  });

  test('does not consider bookings on other listings', async () => {
    const other = await createListing({ title: 'Other' });
    const res = await check(day(10), day(13), other._id);
    expect(res.body.data.available).toBe(true);
  });

  test('returns 404 for a listing that does not exist', async () => {
    const res = await check(day(10), day(13), '507f1f77bcf86cd799439011');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('returns 400 for a malformed listing ID', async () => {
    const res = await check(day(10), day(13), 'xyz');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });

  test.each([
    ['check-out before check-in', () => [day(12), day(10)]],
    ['same check-in and check-out', () => [day(12), day(12)]],
    ['check-in in the past', () => [day(-2), day(3)]],
    ['impossible calendar date', () => ['2030-02-30', '2030-03-02']],
    ['wrong format', () => ['12/10/2030', '15/10/2030']],
    ['stay longer than 30 nights', () => [day(1), day(40)]],
  ])('returns 400 for %s', async (_label, dates) => {
    const [from, to] = dates();
    const res = await check(from, to);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when parameters are missing', async () => {
    const res = await request(app).get(`/api/availability?listingId=${listing._id}`);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['checkIn', 'checkOut']);
  });
});

describe('Availability Service - GET /api/availability/:listingId/bookings', () => {
  test('returns active booked ranges without guest details', async () => {
    const res = await request(app).get(`/api/availability/${listing._id}/bookings`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      listingId: String(listing._id),
      bookedRanges: [{ checkInDate: day(10), checkOutDate: day(13), bookingStatus: 'Pending' }],
    });
    expect(JSON.stringify(res.body)).not.toContain('guest@example.com');
  });

  test('returns 404 for an unknown listing', async () => {
    const res = await request(app).get('/api/availability/507f1f77bcf86cd799439011/bookings');
    expect(res.status).toBe(404);
  });
});
