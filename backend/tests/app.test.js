const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const { setupDB, teardownDB } = require('./helpers');
const { parseDateOnly, nightsBetween, eachNight } = require('../src/utils/dates');

const app = createApp();

beforeAll(setupDB);
afterAll(teardownDB);

describe('Health check', () => {
  test('GET /health reports the database as connected', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'connected' });
  });

  test('GET /api/health is an alias', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});

describe('Error handling and security headers', () => {
  test('unknown routes return a JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'ROUTE_NOT_FOUND', message: 'Route GET /api/does-not-exist not found' },
    });
  });

  test('errors never include stack traces', async () => {
    const res = await request(app).get('/api/listings/bad-id');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
    expect(res.body.error.stack).toBeUndefined();
  });

  test('X-Powered-By is removed and helmet headers are set', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('oversized request bodies are rejected with 413', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .send({ guestName: 'x'.repeat(20000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('CORS', () => {
  test('allows a configured frontend origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('answers preflight requests', async () => {
    const res = await request(app)
      .options('/api/bookings')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  test('rejects an unknown origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_FORBIDDEN');
  });
});

describe('Database unavailable', () => {
  test('health check returns 503 when MongoDB is disconnected', async () => {
    await mongoose.disconnect();
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.data.database).toBe('disconnected');
    await setupDB();
  });
});

describe('Date utilities', () => {
  test('parseDateOnly accepts real dates and rejects invalid ones', () => {
    expect(parseDateOnly('2028-02-29').toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(parseDateOnly('2027-02-29')).toBeNull();
    expect(parseDateOnly('2027-1-5')).toBeNull();
    expect(parseDateOnly(20270105)).toBeNull();
  });

  test('nightsBetween and eachNight treat check-out day as not a night', () => {
    const a = parseDateOnly('2027-03-27');
    const b = parseDateOnly('2027-03-30'); // spans the UK clock change; UTC is unaffected
    expect(nightsBetween(a, b)).toBe(3);
    expect(eachNight(a, b).map((d) => d.toISOString().slice(0, 10))).toEqual(['2027-03-27', '2027-03-28', '2027-03-29']);
  });
});
