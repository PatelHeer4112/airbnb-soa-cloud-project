const request = require('supertest');
const createApp = require('../src/app');
const { setupDB, clearDB, teardownDB, createListing, day, bookingBody } = require('./helpers');

const app = createApp();

beforeAll(setupDB);
afterAll(teardownDB);

let shoreditch;
let greenwich;
let paris;

beforeEach(async () => {
  await clearDB();
  shoreditch = await createListing({ title: 'Shoreditch Loft', city: 'London', location: 'Shoreditch', propertyType: 'Loft', pricePerNight: 145, maxGuests: 2, amenities: ['Wi-Fi', 'Kitchen'], rating: 4.7 });
  greenwich = await createListing({ title: 'Greenwich House', city: 'London', location: 'Greenwich', propertyType: 'House', pricePerNight: 260, maxGuests: 6, amenities: ['Wi-Fi', 'Garden'], rating: 4.8 });
  await createListing({ title: 'Kings Cross Studio', city: 'London', location: "King's Cross", propertyType: 'Studio', pricePerNight: 95, maxGuests: 1, amenities: ['Wi-Fi'], rating: 4.2 });
  paris = await createListing({ title: 'Montmartre Flat', city: 'Paris', location: 'Montmartre', state: 'Ile-de-France', country: 'France', propertyType: 'Apartment', pricePerNight: 175, maxGuests: 3, amenities: ['Wi-Fi', 'Balcony'], rating: 4.6 });
});

const titles = (res) => res.body.data.map((l) => l.title).sort();

describe('Search Service - GET /api/search', () => {
  test('without filters returns every listing', async () => {
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(4);
  });

  test('filters by city, case-insensitively', async () => {
    const res = await request(app).get('/api/search?city=lOnDoN');
    expect(titles(res)).toEqual(['Greenwich House', 'Kings Cross Studio', 'Shoreditch Loft']);
  });

  test('city must match the whole name, not part of it', async () => {
    const res = await request(app).get('/api/search?city=Lon');
    expect(res.body.data).toEqual([]);
  });

  test('filters by partial location across area, city, state and country', async () => {
    expect(titles(await request(app).get('/api/search?location=shore'))).toEqual(['Shoreditch Loft']);
    expect(titles(await request(app).get('/api/search?location=france'))).toEqual(['Montmartre Flat']);
  });

  test('filters by minimum and maximum price (inclusive)', async () => {
    const res = await request(app).get('/api/search?minPrice=145&maxPrice=175');
    expect(titles(res)).toEqual(['Montmartre Flat', 'Shoreditch Loft']);
  });

  test('filters by property type, case-insensitively', async () => {
    const res = await request(app).get('/api/search?propertyType=house');
    expect(titles(res)).toEqual(['Greenwich House']);
  });

  test('filters by guest capacity', async () => {
    const res = await request(app).get('/api/search?guests=3');
    expect(titles(res)).toEqual(['Greenwich House', 'Montmartre Flat']);
  });

  test('filters by amenities (all must be present)', async () => {
    const res = await request(app).get('/api/search?amenities=wi-fi,kitchen');
    expect(titles(res)).toEqual(['Shoreditch Loft']);
  });

  test('combines multiple filters', async () => {
    const res = await request(app).get('/api/search?city=London&maxPrice=200&guests=2&propertyType=Loft');
    expect(titles(res)).toEqual(['Shoreditch Loft']);
  });

  test('returns an empty array (not an error) when nothing matches', async () => {
    const res = await request(app).get('/api/search?city=Tokyo');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
  });

  test('sorts by price ascending and descending', async () => {
    const asc = await request(app).get('/api/search?sort=price_asc');
    const desc = await request(app).get('/api/search?sort=price_desc');
    expect(asc.body.data.map((l) => l.pricePerNight)).toEqual([95, 145, 175, 260]);
    expect(desc.body.data.map((l) => l.pricePerNight)).toEqual([260, 175, 145, 95]);
  });

  test('paginates search results', async () => {
    const res = await request(app).get('/api/search?city=London&limit=2&page=2&sort=price_asc');
    expect(res.body.data.map((l) => l.pricePerNight)).toEqual([260]);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  test('treats regex characters in input as plain text', async () => {
    const res = await request(app).get(`/api/search?location=${encodeURIComponent('.*')}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('excludes listings already booked for the requested dates', async () => {
    const booked = await request(app).post('/api/bookings').send(bookingBody(shoreditch._id, { checkInDate: day(10), checkOutDate: day(13) }));
    expect(booked.status).toBe(201);

    const overlapping = await request(app).get(`/api/search?city=London&checkIn=${day(11)}&checkOut=${day(12)}`);
    expect(titles(overlapping)).toEqual(['Greenwich House', 'Kings Cross Studio']);

    const afterwards = await request(app).get(`/api/search?city=London&checkIn=${day(13)}&checkOut=${day(15)}`);
    expect(titles(afterwards)).toContain('Shoreditch Loft');
  });

  test.each([
    ['minPrice=-1', 'minPrice'],
    ['maxPrice=abc', 'maxPrice'],
    ['minPrice=300&maxPrice=100', 'minPrice'],
    ['guests=0', 'guests'],
    ['guests=two', 'guests'],
    ['propertyType=Castle', 'propertyType'],
    ['sort=cheapest', 'sort'],
    ['checkIn=2030-01-05', 'checkOut'],
    ['city=a&city=b', 'city'],
  ])('rejects invalid query %s', async (qs, field) => {
    const res = await request(app).get(`/api/search?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(field);
  });

  test('reports all invalid fields at once', async () => {
    const res = await request(app).get('/api/search?minPrice=-1&guests=0');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['guests', 'minPrice']);
  });

  // Keep references used so linters don't complain.
  test('fixtures were created', () => {
    expect(greenwich._id).toBeDefined();
    expect(paris._id).toBeDefined();
  });
});
