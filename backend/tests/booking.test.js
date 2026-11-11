const request = require('supertest');
const createApp = require('../src/app');
const { Booking, BookedNight } = require('../src/models');
const { setupDB, clearDB, teardownDB, createListing, day, bookingBody } = require('./helpers');

const app = createApp();

beforeAll(setupDB);
afterAll(teardownDB);

let listing;

beforeEach(async () => {
  await clearDB();
  listing = await createListing({ pricePerNight: 120.5, maxGuests: 3 });
});

const book = (overrides) => request(app).post('/api/bookings').send(bookingBody(listing._id, overrides));

describe('Booking Service - POST /api/bookings (valid requests)', () => {
  test('creates a Pending booking and calculates the total price from the nights', async () => {
    const res = await book({ checkInDate: day(10), checkOutDate: day(14), numberOfGuests: 3 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      listingId: String(listing._id),
      guestName: 'Test Guest',
      guestEmail: 'guest@example.com',
      checkInDate: day(10),
      checkOutDate: day(14),
      numberOfGuests: 3,
      numberOfNights: 4,
      pricePerNight: 120.5,
      totalPrice: 482,
      bookingStatus: 'Pending',
    });
    expect(res.body.data.listing.title).toBe('Test Loft');
    expect(await BookedNight.countDocuments({ bookingId: res.body.data._id })).toBe(4);
  });

  test('ignores a client-supplied price or status', async () => {
    const res = await book({ totalPrice: 1, pricePerNight: 1, bookingStatus: 'Confirmed' });
    expect(res.status).toBe(201);
    expect(res.body.data.totalPrice).toBe(361.5);
    expect(res.body.data.bookingStatus).toBe('Pending');
  });

  test('normalises guest name and email', async () => {
    const res = await book({ guestName: '  Ada Lovelace ', guestEmail: ' Ada@Example.COM ' });
    expect(res.status).toBe(201);
    expect(res.body.data.guestName).toBe('Ada Lovelace');
    expect(res.body.data.guestEmail).toBe('ada@example.com');
  });

  test('allows back-to-back bookings (check-out day = next check-in day)', async () => {
    expect((await book({ checkInDate: day(10), checkOutDate: day(12) })).status).toBe(201);
    expect((await book({ checkInDate: day(12), checkOutDate: day(14) })).status).toBe(201);
    expect((await book({ checkInDate: day(8), checkOutDate: day(10) })).status).toBe(201);
  });
});

describe('Booking Service - POST /api/bookings (invalid requests)', () => {
  test('reports every missing field', async () => {
    const res = await request(app).post('/api/bookings').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(
      ['checkInDate', 'checkOutDate', 'guestEmail', 'guestName', 'listingId', 'numberOfGuests'].sort()
    );
  });

  test.each([
    ['invalid email', { guestEmail: 'not-an-email' }, 'guestEmail'],
    ['one-letter name', { guestName: 'A' }, 'guestName'],
    ['non-string name', { guestName: 42 }, 'guestName'],
    ['zero guests', { numberOfGuests: 0 }, 'numberOfGuests'],
    ['fractional guests', { numberOfGuests: 1.5 }, 'numberOfGuests'],
    ['guests as text', { numberOfGuests: '2' }, 'numberOfGuests'],
    ['malformed listing ID', { listingId: '123' }, 'listingId'],
  ])('rejects %s', async (_label, overrides, field) => {
    const res = await book(overrides);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain(field);
  });

  test.each([
    ['check-out before check-in', () => ({ checkInDate: day(12), checkOutDate: day(10) })],
    ['zero-night stay', () => ({ checkInDate: day(12), checkOutDate: day(12) })],
    ['check-in in the past', () => ({ checkInDate: day(-1), checkOutDate: day(2) })],
    ['invalid calendar date', () => ({ checkInDate: '2030-13-01', checkOutDate: '2030-13-03' })],
    ['date with time component', () => ({ checkInDate: `${day(5)}T10:00:00Z`, checkOutDate: day(7) })],
    ['stay over 30 nights', () => ({ checkInDate: day(1), checkOutDate: day(35) })],
  ])('rejects invalid date range: %s', async (_label, dates) => {
    const res = await book(dates());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects more guests than the listing allows', async () => {
    const res = await book({ numberOfGuests: 4 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('GUEST_CAPACITY_EXCEEDED');
    expect(await Booking.countDocuments()).toBe(0);
  });

  test('returns 404 when the listing does not exist', async () => {
    const res = await request(app).post('/api/bookings').send(bookingBody('507f1f77bcf86cd799439011'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('returns 400 for malformed JSON', async () => {
    const res = await request(app).post('/api/bookings').set('Content-Type', 'application/json').send('{"listingId": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  test('rejects a JSON array body', async () => {
    const res = await request(app).post('/api/bookings').send([1, 2]);
    expect(res.status).toBe(400);
  });
});

describe('Booking Service - conflict prevention', () => {
  beforeEach(async () => {
    const res = await book({ checkInDate: day(10), checkOutDate: day(13) });
    expect(res.status).toBe(201);
  });

  test.each([
    ['identical dates (duplicate booking)', 10, 13],
    ['partial overlap at the start', 8, 11],
    ['partial overlap at the end', 12, 16],
    ['inside the existing stay', 11, 12],
    ['surrounding the existing stay', 9, 14],
  ])('returns 409 for %s', async (_label, from, to) => {
    const res = await book({ checkInDate: day(from), checkOutDate: day(to), guestEmail: 'other@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_CONFLICT');
    expect(res.body.error.details).toEqual([{ checkInDate: day(10), checkOutDate: day(13) }]);
    expect(await Booking.countDocuments()).toBe(1);
    expect(await BookedNight.countDocuments()).toBe(3);
  });

  test('a cancelled booking frees its dates for a new booking', async () => {
    const existing = await Booking.findOne();
    const cancel = await request(app).patch(`/api/bookings/${existing._id}/status`).send({ bookingStatus: 'Cancelled' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.bookingStatus).toBe('Cancelled');
    expect(await BookedNight.countDocuments({ bookingId: existing._id })).toBe(0);

    const res = await book({ checkInDate: day(10), checkOutDate: day(13) });
    expect(res.status).toBe(201);
  });
});

describe('Booking Service - concurrent requests', () => {
  test('only one of many simultaneous requests for the same dates succeeds', async () => {
    const attempts = 15;
    const responses = await Promise.all(
      Array.from({ length: attempts }, (_, i) => book({ guestEmail: `racer${i}@example.com` }))
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(attempts - 1);
    expect(await Booking.countDocuments()).toBe(1);
    expect(await BookedNight.countDocuments()).toBe(3);
  });

  test('simultaneous partially-overlapping requests cannot both succeed', async () => {
    const [a, b] = await Promise.all([
      book({ checkInDate: day(10), checkOutDate: day(13) }),
      book({ checkInDate: day(12), checkOutDate: day(15) }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await Booking.countDocuments()).toBe(1);
  });

  test('simultaneous non-overlapping requests all succeed', async () => {
    const responses = await Promise.all([
      book({ checkInDate: day(10), checkOutDate: day(12) }),
      book({ checkInDate: day(12), checkOutDate: day(14) }),
      book({ checkInDate: day(14), checkOutDate: day(16) }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
  });
});

describe('Booking Service - GET /api/bookings/:id', () => {
  test('returns the booking with listing summary', async () => {
    const created = await book();
    const res = await request(app).get(`/api/bookings/${created.body.data._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ _id: created.body.data._id, totalPrice: 361.5, bookingStatus: 'Pending' });
    expect(res.body.data.listing).toMatchObject({ title: 'Test Loft', city: 'London' });
  });

  test('returns 404 for an unknown booking', async () => {
    const res = await request(app).get('/api/bookings/507f1f77bcf86cd799439011');
    expect(res.status).toBe(404);
  });

  test('returns 400 for a malformed booking ID', async () => {
    const res = await request(app).get('/api/bookings/abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });
});

describe('Booking Service - PATCH /api/bookings/:id/status', () => {
  let bookingId;
  beforeEach(async () => {
    bookingId = (await book()).body.data._id;
  });

  const setStatus = (status, id = bookingId) =>
    request(app).patch(`/api/bookings/${id}/status`).send({ bookingStatus: status });

  test('Pending -> Confirmed -> Cancelled', async () => {
    const confirmed = await setStatus('Confirmed');
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.bookingStatus).toBe('Confirmed');
    const cancelled = await setStatus('Cancelled');
    expect(cancelled.body.data.bookingStatus).toBe('Cancelled');
  });

  test('a confirmed booking still blocks its dates', async () => {
    await setStatus('Confirmed');
    expect((await book({ guestEmail: 'x@example.com' })).status).toBe(409);
  });

  test('a cancelled booking cannot be confirmed or cancelled again', async () => {
    await setStatus('Cancelled');
    for (const status of ['Confirmed', 'Cancelled']) {
      const res = await setStatus(status);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    }
  });

  test.each(['Pending', 'Done', undefined])('rejects target status %s', async (status) => {
    const res = await setStatus(status);
    expect(res.status).toBe(400);
  });

  test('returns 404 for an unknown booking', async () => {
    const res = await setStatus('Cancelled', '507f1f77bcf86cd799439011');
    expect(res.status).toBe(404);
  });
});
