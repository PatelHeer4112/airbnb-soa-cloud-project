# Backend Viva Preparation – Questions and Answers

## Architecture

**1. What is Service-Oriented Architecture and how does your backend use it?**
SOA structures a system as services, each owning one business capability and talking to others through
well-defined interfaces. The backend has four services (Listing, Search, Availability, Booking), each in its own
folder with its own functions and data ownership. They call each other only through those functions; for example,
Booking calls `listingService.getListingById()` instead of querying the listings collection directly.

**2. Are these really separate services if they run in one process?**
They are separate in code and responsibility, but deployed together; this is often called a *modular monolith*.
I chose that because one deployment is cheaper and simpler for a student project. The boundaries mean any service
could be moved into its own process later, with an HTTP call replacing the function call.

**3. What is the difference between SOA and microservices?**
Both split systems into services. Microservices are a finer-grained style where each service is deployed
independently and usually has its own database. Classic SOA often shares infrastructure (like an enterprise
service bus or shared database). My design shares one database and one process, so it is closer to SOA than to microservices.

**4. Which services depend on which?**
Search → Availability (to exclude booked listings). Booking → Listing (price, capacity) and Availability (conflicts).
Availability → Listing (to check the listing exists). Listing depends on nothing.

**5. What does each layer do?**
Routes map URLs to controllers. Controllers translate HTTP into function calls and format responses.
Validators check input. Services hold business rules. Models define schemas and indexes. Middleware handles
cross-cutting concerns (CORS, security headers, errors).

**6. Why is `app.js` separate from `server.js`?**
`app.js` builds the Express app without listening on a port, so Supertest can test it directly.
`server.js` connects to MongoDB, starts listening and handles shutdown signals.

## Booking logic

**7. What is your overlap rule?**
A new stay conflicts with an existing active booking when `existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn`.

**8. Why can a guest check in on the day another checks out?**
Stays are half-open intervals [checkIn, checkOut). The check-out day is not a night. With check-out 21 Nov and a new
check-in 21 Nov: is `existing.checkOut (21) > new.checkIn (21)`? No, so there is no conflict.

**9. How do you prevent double bookings when two requests arrive at the same time?**
Each booking inserts one `bookednights` document per night, and there is a unique index on `{listingId, night}`.
MongoDB guarantees only one such document can exist, so only the first request succeeds. The other gets a
duplicate-key error (E11000), deletes any nights it inserted, and returns 409. A test fires 15 identical requests
simultaneously and exactly one succeeds.

**10. Why not just check availability and then insert?**
That is a race condition (check-then-act). Both requests can run the check before either inserts, so both see the dates as free.

**11. Why not use MongoDB transactions?**
Multi-document transactions only work on a replica set or sharded cluster. The local free MongoDB server is standalone.
The unique-index method works on any MongoDB deployment, and it is simpler.

**12. Then why keep the overlap query at all?**
It catches almost every conflict cheaply and returns the conflicting dates for a helpful error message.
The unique index is the safety net for the rare race.

**13. What happens to the dates when a booking is cancelled?**
The status update sets `Cancelled`, and the service deletes that booking's night documents, so the dates can be booked
again. Cancelled bookings are also excluded from the overlap query.

**14. How is the total price calculated? Can a user change it?**
`totalPrice = listing.pricePerNight × numberOfNights`, computed on the server. Any price or status sent by the client is ignored.
The nightly price is copied into the booking so later price changes do not affect existing bookings.

**15. What statuses exist and what transitions are allowed?**
Pending (on creation) → Confirmed, Pending → Cancelled, Confirmed → Cancelled. Cancelled is final.
The update is atomic (`findOneAndUpdate` filtered on the allowed current status), so concurrent updates cannot both apply.

**16. Are there weaknesses in your conflict prevention?**
If the server crashed after inserting nights but before inserting the booking, those nights would stay blocked.
A clean-up job could remove nights whose booking doesn't exist. Transactions on a replica set would remove this window completely.

## Database

**17. Why MongoDB?**
Listings naturally fit documents (nested arrays like amenities and images), the schema can evolve easily, and Mongoose
gives validation and indexes. It also has a free local server and a free hosted tier (Atlas M0) for later.

**18. What indexes did you create and why?**
Listings: city+price, propertyType+price, maxGuests, createdAt, matching common search filters. Bookings:
listingId+status+dates for the overlap query. BookedNights: unique listingId+night for conflict prevention, and bookingId for cancellation.

**19. How are listings and bookings related?**
`bookings.listingId` stores the listing's ObjectId (a reference). MongoDB doesn't enforce foreign keys, so the Booking
Service checks that the listing exists first.

**20. Why store dates as UTC midnight?**
Booking is about calendar days, not moments. Using UTC midnight avoids time-zone and daylight-saving bugs: a test checks
that a stay across the UK clock change still counts 3 nights.

## API, validation and security

**21. What does a typical response look like?**
Success: `{ success: true, data, meta? }`. Error: `{ success: false, error: { code, message, details? } }`.
The same shape everywhere makes the frontend simpler.

**22. Which HTTP status codes do you use?**
200 OK, 201 Created, 400 validation/invalid ID, 403 CORS, 404 not found, 409 conflict, 413 body too large,
500 unexpected, 503 database down.

**23. Why 409 for a booking conflict?**
The request is valid, but it conflicts with the current state of the resource (dates already taken). That is what 409 Conflict means.

**24. Why does search return 200 with an empty array instead of 404?**
The search itself succeeded; it found zero results. 404 means the requested resource (URL) doesn't exist.

**25. How do you prevent NoSQL or regex injection?**
IDs must be 24-hex strings. Query parameters must be single strings (arrays are rejected). Search text is regex-escaped.
Only whitelisted fields are written, and Mongoose `strictQuery` is enabled.

**26. How do you protect credentials?**
All configuration comes from environment variables (`.env`, which is git-ignored). Only `.env.example` with placeholder
local values is committed. Logs print the database host and name, never the password.

**27. What does CORS do here?**
Browsers block cross-origin requests unless the server allows them. The backend allows only origins listed in `CORS_ORIGIN`
(the frontend dev servers by default); other origins get 403.

**28. Why don't errors show stack traces?**
Stack traces reveal file paths and library versions that help attackers. The error handler logs the real error on the
server and sends only a generic message for unexpected errors.

## Testing

**29. How did you test the backend?**
111 Jest + Supertest tests against a real local test database. They cover every endpoint, validation, conflicts,
concurrency, cancellation, CORS and error handling. All pass, with 95.8% statement coverage.

**30. Why a real database instead of mocks?**
The most important guarantee, the unique index, lives in the database. Mocks would not prove it works.

**31. What problem did you hit during testing?**
Every test initially failed to connect: MongoDB driver 7 uses a dynamic `import()` that Jest blocks by default, so the
connection handshake was sent without driver metadata. Running Jest with `--experimental-vm-modules` fixed it.

## Cloud and scaling

**32. How is the backend prepared for AWS?**
Configurable port and DB URI through environment variables, `npm start` production command, `/health` endpoint for load balancers,
graceful SIGTERM shutdown, `trust proxy` for running behind a load balancer, and a stateless process that can be scaled horizontally.

**33. How would the system handle a holiday traffic spike?**
Run more copies of the stateless API behind a load balancer (horizontal scaling). Conflict safety still holds because it is enforced
by the shared database, not by process memory. The database then becomes the bottleneck; read-heavy search traffic could be cached
or served from read replicas.

**34. Is the AWS Free Tier free?**
Not guaranteed. Free offers depend on account age and have limits. Public IPv4 addresses, load balancers, NAT gateways, data transfer
and leftover storage can be charged. Budgets and alerts must be set up, and resources deleted afterwards.

**35. What would you improve with more time?**
Authentication and roles, payment integration, separate deployment per service, caching and rate limiting,
a clean-up job (or transactions) for the crash window, and an OpenAPI specification.
