# Backend Testing

## How to run

MongoDB must be running locally. Tests use a **separate** database (`MONGODB_URI_TEST`, default
`mongodb://127.0.0.1:27017/airbnb_soa_test`) that is wiped before each test and dropped afterwards.
A safety check in `tests/helpers.js` refuses to run if the database name does not contain "test".

```bash
cd backend
npm test                 # all tests
npm run test:coverage    # with coverage report (coverage/ folder, git-ignored)
```

`npm test` runs Jest through `node --experimental-vm-modules`. This is required because MongoDB Node.js
driver 7.x loads Node's `os` module with a dynamic `import()`, which Jest's sandbox only allows with that
flag. Without it every database connection inside Jest fails with
*"Missing required sub-document 'driver' in the client metadata document"*.
This only affects tests; `npm start` and `npm run seed` do not need the flag. Node prints an
`ExperimentalWarning` about VM modules; it is harmless.

## Tools

- **Jest 30**: test runner and assertions
- **Supertest 7**: sends real HTTP requests to the Express app (no port needed)
- Real local **MongoDB 9.0.4** (not mocks), so indexes, validation and the unique-index conflict guard are actually exercised

## Results (executed 2026-11-11 on Windows 11, Node.js 26.13.0, MongoDB 9.0.4)

```
Test Suites: 5 passed, 5 total
Tests:       111 passed, 111 total
```

| Suite | Tests | Passed |
|---|---|---|
| `tests/booking.test.js` | 41 | 41 |
| `tests/search.test.js` | 25 | 25 |
| `tests/availability.test.js` | 20 | 20 |
| `tests/listing.test.js` | 13 | 13 |
| `tests/app.test.js` | 12 | 12 |
| **Total** | **111** | **111** |

Coverage (`npm run test:coverage`):

| Statements | Branches | Functions | Lines |
|---|---|---|---|
| 95.8 % | 88.36 % | 94.52 % | 96.76 % |

All four service folders have ≥ 90 % statement coverage; the availability service and all controllers are at 100 %.
Uncovered lines are mainly defensive branches (e.g. MongoDB network-error mapping, environment fallbacks).

### History

The first run failed **111/111** because of the driver/Jest dynamic-import issue described above
(not an application bug). After adding `--experimental-vm-modules` to the test script, all 111 passed.
No application code had to change.

## What is tested

| Requirement | Where | Examples of cases |
|---|---|---|
| Listing retrieval | `listing.test.js` | empty DB, all fields present, pagination, `limit` capped at 50, invalid `page` |
| Individual listing | `listing.test.js` | found, 404 unknown ID, 400 malformed ID |
| Listing creation | `listing.test.js` | 201 created; 400 with field list for missing/invalid fields |
| Search & filters | `search.test.js` | city (case-insensitive, whole name), partial location, min/max price, property type, guests, amenities, combined filters, sorting, pagination |
| Empty results | `search.test.js` | `city=Tokyo` → 200 with `data: []` |
| Search + availability | `search.test.js` | listing booked on requested dates is excluded; same listing returns after check-out day |
| Search validation | `search.test.js` | 9 invalid query cases (negative price, min > max, `guests=0`, bad type/sort, half a date range, repeated param); all errors returned together |
| Injection safety | `search.test.js` | `location=.*` is treated as text and matches nothing |
| Availability checking | `availability.test.js` | 5 overlap shapes → unavailable; same-day check-in/check-out allowed both ways |
| Cancelled bookings | `availability.test.js`, `booking.test.js` | cancelling frees the dates; cancelled bookings ignored in overlap checks |
| Missing listings | all | 404 for listings that do not exist (listing, availability, booking) |
| Valid booking | `booking.test.js` | 201, status Pending, nights = 4, total = 4 × 120.5 = 482, night docs created |
| Price integrity | `booking.test.js` | client-sent `totalPrice`/`bookingStatus` ignored |
| Invalid bookings | `booking.test.js` | all six missing fields reported; bad email, short name, 0 / 1.5 / "2" guests, malformed ID, malformed JSON, array body |
| Invalid date ranges | `booking.test.js`, `availability.test.js` | check-out before check-in, 0 nights, past check-in, impossible date, timestamp instead of date, > 30 nights |
| Guest capacity | `booking.test.js` | 4 guests on a 3-guest listing → 400 `GUEST_CAPACITY_EXCEEDED`, nothing stored |
| Booking conflicts | `booking.test.js` | identical dates (duplicate), overlap at start / end, inside, surrounding → 409, database unchanged |
| **Concurrency** | `booking.test.js` | **15 simultaneous identical requests → exactly 1 × 201 and 14 × 409**; two simultaneous partially-overlapping requests → one 201, one 409; three simultaneous back-to-back requests → all 201 |
| Status transitions | `booking.test.js` | Pending→Confirmed→Cancelled; Cancelled cannot change (409); invalid target status (400) |
| Error handling | `app.test.js` | JSON 404 for unknown routes, no stack traces, 413 for oversized body |
| Security/CORS | `app.test.js` | helmet headers, no `X-Powered-By`, allowed origin, preflight, blocked origin → 403 |
| Health | `app.test.js` | 200 when connected; 503 after disconnecting the database |
| Date utilities | `app.test.js` | leap years, invalid dates, night counting across a daylight-saving change |

## Manual verification performed

With the seeded development database and `npm start`:

- `GET /health` → 200, `database: connected`
- `GET /api/search?city=london&maxPrice=150&guests=2` → 200, Shoreditch Loft
- `GET /api/availability` for 19–22 Nov against a 18–21 Nov booking → `available: false`
- same listing 21–23 Nov → `available: true` (check-in on previous check-out day)
- `POST /api/bookings` → 201 (total 580 for 4 nights × 145); overlapping request → 409; invalid body → 400 with 3 field errors; 5 guests on a 2-guest listing → 400
- `NODE_ENV=production` start → Apache-format logs, health 200

The JSON responses in `API_DOCUMENTATION.md` were copied from these runs.

## Not covered by automated tests

- Real load/peak-traffic behaviour (Member 3's load testing).
- Behaviour across process crashes between reserving nights and saving a booking (see report limitations).
- Deployed (AWS) environment.
