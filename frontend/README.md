# Frontend — Member 2

Responsive Airbnb accommodation UI, built with JavaScript, CSS, and Vite. Uses the existing backend APIs; no mock bookings or fallback listing data are shown in the application.

## Run locally

Requires Node.js 20.19+ or 22.12+. The backend is maintained separately on [feature/member1-backend](https://github.com/PatelHeer4112/airbnb-soa-cloud-project/tree/feature/member1-backend). Start MongoDB and follow that branch's backend/README.md in a separate checkout to install, seed, and start the API on port 5000. This frontend branch intentionally contains no backend source. In a second terminal:

```powershell
cd frontend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

Open http://localhost:5173. On macOS/Linux use `npm` instead of `npm.cmd`. The `.cmd` command works around PowerShell restrictions on unsigned `npm.ps1` scripts. The fixed port matches the backend's default CORS configuration.

## Features and API integration

- Destination, dates, guests, property type, nightly price range, amenities, sorting, and pagination: `GET /api/search`.
- Shareable listing routes, enlarged photo viewer, amenities, and capacity: `GET /api/listings/:id`.
- Interactive month calendar, reserved nights, same-day turnover, and live availability check: `GET /api/availability/:id/bookings`, `GET /api/availability`.
- Validated booking request with name, email, guest count and dates: `POST /api/bookings`. Server calculates the price and status and checks for conflicts atomically.
- Booking reference lookup and persistent confirmation URL: `GET /api/bookings/:id`.
- Cancellation with confirmation dialog: `PATCH /api/bookings/:id/status`.
- Browser-local saved-stay collection and side-by-side comparison for up to three properties. Only property IDs persist; no guest details are stored.
- Copy a reference, print an itinerary, and export an all-day `.ics` event. Pending requests are marked tentative.
- Live price estimate, field validation feedback, offline notice, and return to the previous search results.
- Loading, empty, unavailable image, network failure, validation, and booking conflict states. Keyboard navigation, labelled inputs, skip link, live status regions, and responsive layouts.

URLs use hash routing, so static hosts need no SPA rewrite rules. Search filters persist in the URL; selected dates and guest count carry into the booking form in the current browser tab. Booking references and guest details are not saved in browser storage.

## Check and build

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

Tests cover calendar boundaries, safe rendering, URL encoding, booking payloads, conflicts, and network errors. Browser tests are in `e2e/` and use mocked API responses, independently of MongoDB:

```powershell
npx.cmd playwright install chromium
npx.cmd playwright test
```

## Deployment handoff — Member 3

Set `VITE_API_URL` to the backend's public HTTPS origin **before** building (no `/api` suffix). This is a public build-time value, never a secret. Run `npm ci` and `npm run build` in `frontend/`, then host `frontend/dist/` using your agreed static hosting setup. Add the frontend's exact HTTPS origin to the backend `CORS_ORIGIN` and restart the backend. Verify search, detail, availability, a booking and cancellation against the deployed API. No AWS resources are created by this branch.

## Member 1 API compatibility check

Fetched `feature/member1-backend` on 12 November 2026 and checked commit `512b4a840f266efe031ed6397241c17eb2cb410e` in a separate Git worktree. All 12 HTTP contract checks passed using this frontend's API client against the backend's real Express app, routes, request validators, booking response formatter, error middleware, and CORS settings. No frontend API changes were required.

Covered search filters and pagination, listing details, reserved ranges, availability, booking creation and reference lookup, cancellation, validation errors, date boundaries, conflict handling, allowed frontend origin, and POST/PATCH preflight requests. Database-facing service operations were stubbed: these results verify the HTTP contract, not MongoDB persistence, concurrent reservations, or deployed integration.

To repeat against a separate backend checkout, install that backend's dependencies with `npm.cmd ci`, then run from `frontend/`:

```powershell
node scripts/check-backend-contract.mjs C:\path\to\separate-checkout\backend
```

The check starts a temporary server on a free local port and closes it afterward. It does not connect to, seed, or modify MongoDB. Backend source stays out of this frontend branch. For browser use, start Member 1's real backend with MongoDB and set `VITE_API_URL` to its origin; the backend's default CORS configuration already permits `http://localhost:5173`.

## Limitations

The backend currently has no authentication, payment, or specified currency. The UI reports real Pending/Confirmed/Cancelled status and does not claim a payment or email was sent. Prices use the API's numerical units without adding a currency symbol. Public deployment needs an agreed access-control plan; a booking reference currently retrieves guest details. Seeded property photos are placeholders; the homepage bundles the original TravelTrove photography locally and typography uses Google Fonts with local fallback fonts.

## Manual user-flow checklist

Validation on 13-14 November 2026: 9 unit/API tests and 13 browser tests passed, covering booking, collections, comparison limits, amenities, calendar boundaries, photo viewing, itinerary export, responsive layouts, and automated WCAG checks on the principal screens. The `e2e/` suite uses mocked API responses. The separate live-integration check below also passed with Member 1's real backend and isolated MongoDB. AWS deployment and cloud-load measurements remain Member 3's work.

1. Browse and paginate the seeded stays; search London and combine a property type, guests, prices and sort. Refresh and confirm filters persist.
2. Try no matching destination, a stopped API, and retry after restoring it.
3. Open a listing, inspect amenities and reserved ranges, choose valid dates and check availability.
4. Try missing email, excess guests, past dates, reversed dates, and a stay over 30 nights.
5. Submit a valid request; verify the real reference, server-calculated total and Pending status. Reload its URL and look it up by reference.
6. Try the same dates again and verify the conflict message. Cancel the original booking and verify those dates become available again.
7. Check the workflow at mobile width and using keyboard-only navigation.

## Visual reference

The design is adapted from the user-provided [TravelTrove repository](https://github.com/Rutvigit/TravelTrove), reference commit `3f925a6a902585fa0df9c64c625e01be3cc9810f`. Local photographs in `public/images/` come from that project: `blog2.jpg` (hero), `Destination6.png`, `Destination14.png`, `Destination15.png` (destination searches), and `share.png` (getaway banner). The photo hero, rounded search, coral palette, Poppins typography, destination grid and about section follow the original design. The original registration and hosting-income buttons are replaced with working search and booking navigation appropriate to this backend. Destination images are inspiration; listing photos and prices still come from the API.

## Live integration with a real database

`check-live-integration.mjs` runs the actual frontend in Chromium against Member 1's unchanged Express app and real MongoDB in a temporary local process. It inserts only into its own ephemeral test database and discards that database on completion. The team's normal database is never used.

Requirements: a separate backend checkout with dependencies installed, plus `mongodb-memory-server` installed there using `npm.cmd install --no-save --package-lock=false mongodb-memory-server`. Its first run downloads a MongoDB binary. In the frontend, install Chromium using `npx.cmd playwright install chromium`. Port 5179 must be free.

```powershell
node scripts/check-live-integration.mjs C:\path\to\separate-checkout\backend
```

Verified on 13 November 2026 against backend commit `512b4a8`:

- Real seeded listing search, amenity filtering, and serialization.
- Browser booking persisted with the server-calculated price and reserved-night documents.
- Overlapping request rejected with HTTP 409.
- Booking survives reload; cancellation updates MongoDB and releases the reserved nights.
- Two simultaneous identical requests produce exactly one booking and one conflict.

## Demonstration sequence

1. Start Member 1's backend and MongoDB in its own checkout. Run the frontend on port 5173.
2. Search London with two guests, combine price/type/amenity filters, and explain the `/api/search` query.
3. Save stays and compare their rates, capacity and amenities. Refresh to demonstrate browser-local persistence.
4. Open a property, enlarge a photo, select calendar dates and check availability. Explain why check-out is exclusive and why the server rechecks conflicts.
5. Submit a request. Show the real Pending status, server total and reference, then print or download the itinerary.
6. Refresh and reopen the reference. Cancel the booking and verify that its dates become available. Demonstrate invalid inputs or a booking conflict without losing form values.
7. Resize to mobile and explain retry behaviour, accessibility checks and the limitations below.

## Frontend structure

- `main.js`: routing, discovery, listing details and booking screens.
- `api.js`: configurable HTTP client and consistent API errors.
- `collections.js` and `preferences.js`: saved stays, comparison and resilient identifier storage.
- `calendar.js`: reserved-night display and date selection; the backend remains authoritative.
- `itinerary.js`: calendar export without guest email.
- `icons.js`: inline SVG icons, with no icon CDN dependency.
- CSS: base layout, Airbnb theme and enhanced interaction styles. Run `npm.cmd run format` to format the source.

Saved stays are local to one browser. Account sync, sign-in, payments, email delivery and map coordinates are future improvements requiring backend support. Automated accessibility checks supplement keyboard and visual review; they do not establish full accessibility conformance.

## Continuous checks

`.github/workflows/frontend.yml` runs formatting, unit tests, the production build, and Chromium workflows/accessibility checks on frontend pushes and pull requests. It requires no application secrets and does not deploy anything. Use the Actions tab for the remote run status; local verification does not imply the remote workflow has completed.
