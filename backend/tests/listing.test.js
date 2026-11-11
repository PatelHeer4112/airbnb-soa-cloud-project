const request = require('supertest');
const createApp = require('../src/app');
const { setupDB, clearDB, teardownDB, createListing, baseListing } = require('./helpers');

const app = createApp();

beforeAll(setupDB);
beforeEach(clearDB);
afterAll(teardownDB);

describe('Listing Service - GET /api/listings', () => {
  test('returns an empty list with pagination meta when there are no listings', async () => {
    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  test('returns all listings with their fields', async () => {
    await createListing({ title: 'A' });
    await createListing({ title: 'B' });
    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    const listing = res.body.data[0];
    for (const field of ['_id', 'title', 'propertyType', 'city', 'pricePerNight', 'maxGuests', 'amenities', 'createdAt', 'updatedAt']) {
      expect(listing).toHaveProperty(field);
    }
  });

  test('paginates results', async () => {
    for (let i = 0; i < 5; i += 1) await createListing({ title: `Listing ${i}` });
    const page1 = await request(app).get('/api/listings?page=1&limit=2');
    const page3 = await request(app).get('/api/listings?page=3&limit=2');
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(page3.body.data).toHaveLength(1);
    const ids = new Set([...page1.body.data, ...page3.body.data].map((l) => l._id));
    expect(ids.size).toBe(3);
  });

  test('caps limit at 50', async () => {
    const res = await request(app).get('/api/listings?limit=500');
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(50);
  });

  test.each(['0', '-1', 'abc', '1.5'])('rejects invalid page value %s', async (page) => {
    const res = await request(app).get(`/api/listings?page=${page}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Listing Service - GET /api/listings/:id', () => {
  test('returns a single listing', async () => {
    const listing = await createListing();
    const res = await request(app).get(`/api/listings/${listing._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Test Loft');
    expect(res.body.data._id).toBe(String(listing._id));
  });

  test('returns 404 for a well-formed ID that does not exist', async () => {
    const res = await request(app).get('/api/listings/507f1f77bcf86cd799439011');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Listing 507f1f77bcf86cd799439011 not found' },
    });
  });

  test('returns 400 for a malformed ID', async () => {
    const res = await request(app).get('/api/listings/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });
});

describe('Listing Service - POST /api/listings', () => {
  test('creates a listing', async () => {
    const res = await request(app).post('/api/listings').send({ ...baseListing, title: 'New place' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('New place');
    expect(res.body.data._id).toBeDefined();
  });

  test('rejects a listing with missing and invalid fields', async () => {
    const res = await request(app)
      .post('/api/listings')
      .send({ title: 'Incomplete', propertyType: 'Castle', pricePerNight: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['propertyType', 'pricePerNight', 'city', 'maxGuests']));
  });
});
