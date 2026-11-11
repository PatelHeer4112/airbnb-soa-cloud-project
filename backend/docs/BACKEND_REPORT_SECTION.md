# Backend and Service-Oriented Architecture (Member 1)

*Report section for the Cloud Computing project "Airbnb – Service-Oriented Architecture and Holiday Traffic Spikes".*

## 1. Role and scope

Member 1 designed and implemented the backend: the service architecture, the MongoDB data model,
four REST services (Listing, Search, Availability, Booking), validation and error handling,
booking-conflict prevention, automated tests and the API documentation used by the frontend (Member 2)
and for deployment (Member 3). All development and testing was done locally, with no cloud spend.

## 2. Technology choices

| Choice | Reason |
|---|---|
| Node.js + Express 5 | Lightweight, non-blocking I/O suits an API that mostly waits on the database; Express 5 forwards async errors to one handler |
| MongoDB + Mongoose 9 | Listings are document-shaped (arrays of amenities and images); schema validation and indexes are declared in one place |
| Jest + Supertest | Tests send real HTTP requests to the app and use a real database, so indexes and constraints are tested too |
| Local MongoDB Community Server | Free; no cloud account needed for development |

## 3. Architecture

The backend follows a service-oriented design. Each business capability is a separate service module
with its own folder, functions and data ownership:

- **Listing Service**: owns the `listings` collection; returns listings (paginated) and single listings; creates listings.
- **Search Service**: builds filtered, sorted, paginated queries (city, location text, price range, property type,
  guest capacity, amenities, and optionally dates).
- **Availability Service**: decides whether a listing is free for a date range and returns booked ranges.
- **Booking Service**: owns `bookings` and `bookednights`; validates, prices, reserves and stores bookings; confirms and cancels them.

Services collaborate only through each other's functions: Search asks Availability which listings are booked;
Booking asks Listing for the price and capacity, and Availability for conflicts. A router (`/api/...`) acts as a
single entry point, similar to an API gateway, and a central error handler gives every service the same response
contract (`{ success, data, meta }` or `{ success: false, error: { code, message, details } }`).
The architecture diagram is in `docs/ARCHITECTURE.md`.

All services currently run in **one Node.js process** sharing one database. This is a deliberate trade-off.
It is cheaper and simpler to deploy and demonstrate than four separate deployments, while the code boundaries
still allow a service to be extracted later, for example to scale Search separately during a holiday peak.
Because the process is stateless, horizontal scaling (more copies behind a load balancer) needs no code changes.

## 4. Data model

Three collections: `listings` (accommodation details, with indexes on city+price, type+price and capacity),
`bookings` (guest, dates, nights, a snapshot of the nightly price, total price, status) and `bookednights`
(one document per reserved night, with a unique index on listing+night). Full details are in `docs/DATABASE_SCHEMA.md`.
A seed script loads 20 realistic listings in 16 cities and 5 bookings, created through the Booking Service itself.

## 5. Key design problem: preventing double bookings

**Rule.** Two stays conflict when `existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn`.
Stays are treated as half-open intervals, so one guest can check in on the day another checks out.
Only Pending and Confirmed bookings count.

**Problem.** Checking that rule with a query and then inserting the booking is a *check-then-act* race.
Under a traffic spike, two requests for the same dates can both see "free" before either saves.

**Options considered.**
1. *Multi-document transactions*: correct, but MongoDB only supports them on replica sets.
   The free local server is standalone, and transactions add retry logic and cost.
2. *Locking the listing document* (a "lock" flag set with an atomic update): works, but needs lock
   expiry handling if a request crashes, and serialises all bookings for a listing.
3. **One document per booked night with a unique index (chosen).** The service inserts a
   `{listingId, night}` document for every night of the stay. MongoDB's unique index guarantees that only one
   document per listing-night can exist, so the database itself decides the winner atomically. The losing request
   removes any nights it inserted and returns HTTP 409. Cancelling deletes the nights, freeing the dates.

The readable overlap query still runs first, because it catches nearly all conflicts and supplies the
conflicting dates for the error message. The unique index is the final guarantee.

**Evidence.** An automated test fires 15 identical booking requests simultaneously; exactly one returns 201
and fourteen return 409, with one booking and three night documents in the database. A second test shows two
simultaneous *partially* overlapping requests cannot both succeed, and a third shows back-to-back requests
all succeed.

Status changes use a conditional atomic update (`findOneAndUpdate` filtered on the allowed current status),
so two simultaneous cancellations or confirmations cannot both apply.

## 6. Validation, errors and security

- Every input is validated before reaching the database. Validators collect **all** field errors and return them together.
- Dates must be strict `YYYY-MM-DD` calendar dates; check-in cannot be in the past; stays are 1–30 nights.
- Price and status are always computed by the server; client-supplied values are ignored.
- IDs are validated before querying; search text is regex-escaped (prevents regex injection and expensive patterns);
  only whitelisted fields are written; `strictQuery` is enabled.
- One central error handler maps errors to consistent codes (400/404/409/413/503/500) and never returns stack traces.
- `helmet` security headers, CORS allow-list from configuration, 10 KB body limit, pagination limit capped at 50.
- Configuration (port, database URI, CORS origins) comes from environment variables; `.env` is git-ignored.
- `/health` reports database connectivity (503 when down) for load balancers; SIGTERM triggers graceful shutdown.

## 7. Testing

111 automated tests in 5 suites, all passing (executed 2026-11-11, Node.js 26.13.0, MongoDB 9.0.4).
Statement coverage is 95.8%. They cover listing retrieval, search filters and empty results, availability edge cases,
valid and invalid bookings, date-range validation, guest capacity, conflicts, concurrency, cancellation,
missing resources, CORS, health and error handling. See `docs/TESTING.md`.

An integration issue was found and fixed during testing. MongoDB driver 7 loads a Node module with a dynamic
`import()`, which Jest's sandbox blocks by default, so every test initially failed to connect.
Enabling Node's `--experimental-vm-modules` flag for the test command fixed it without application changes.

## 8. Support for the other team members

- **Member 2 (frontend):** `API_DOCUMENTATION.md` with real request/response examples, a frontend integration guide with a
  ready-made `fetch` client and error-handling patterns, a Postman collection, and CORS defaults for React/Vite dev servers.
- **Member 3 (deployment and load testing):** `DEPLOYMENT_GUIDE.md` with start command, environment variables, health check,
  measured memory use (~82 MB idle), database options and AWS cost warnings. Nothing was deployed by Member 1.

## 9. Limitations

1. **Single deployable.** Services are separated in code, not in separate processes, so they cannot yet be scaled
   or deployed independently.
2. **No authentication or authorisation.** Anyone who can reach the API can create listings, view a booking by ID, or
   confirm/cancel it. Booking IDs are hard to guess (ObjectIds) but are not secret tokens.
3. **Crash window.** If the process crashes after reserving nights but before saving the booking, those nights stay
   reserved with no booking. This would need a periodic clean-up job (find `bookednights` whose `bookingId` has no booking).
4. **No payment step**: `Pending` → `Confirmed` is a manual status change.
5. **City and location search use case-insensitive regular expressions**, which cannot fully use indexes. This is fine for
   hundreds of listings but would be slow for millions; a text or Atlas Search index would be needed.
6. **Dates are UTC calendar days**; listing-local time zones and check-in times are not modelled.
7. **No rate limiting or caching**, intentionally left out so Member 3's load tests measure the raw service.
8. Performance figures here are from a laptop, not from the cloud environment.

## 10. Future improvements

- Split services into separate deployables (containers) with an API gateway, and scale Search independently at peak times.
- Add JWT authentication and roles (guest, host, admin); let guests list "my bookings".
- Add payment integration (sandbox mode) that moves bookings from Pending to Confirmed, and auto-expire unpaid Pending bookings.
- Use a MongoDB replica set and transactions, or a clean-up job, to close the crash window.
- Cache popular search results (e.g. in-memory or Redis) and add rate limiting before production use.
- Add Atlas Search or a text index for fuzzy location search; add geospatial search ("near me").
- Add structured logging, request IDs and metrics for observability during load tests.
- Add an OpenAPI (Swagger) specification generated from the validators.
