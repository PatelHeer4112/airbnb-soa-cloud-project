# Frontend — Member 2

Responsive Airbnb accommodation UI, built with JavaScript, CSS, and Vite. Uses the existing backend APIs; no mock bookings or fallback listing data are shown in the application.

## Run locally

For a quick manual demonstration without installing MongoDB as a Windows service, run the real backend from its separate checkout with a temporary database:

```powershell
npm.cmd run demo:backend -- "C:\Users\HP\OneDrive\Desktop\airbnb-cloud-project\member1-api-check\backend"
```

Keep that terminal open. In another terminal, run `npm.cmd run dev` from this frontend folder, or use the existing server at http://localhost:5173 if it is already running. The demo API is http://localhost:5000 and `/health` should report `database: connected`. This uses Member 1's actual backend code and 20 seed listings, not mocked frontend data. New stays and bookings survive browser refresh but are discarded when the demo-backend process stops. It requires `mongodb-memory-server` in the separate backend checkout, as described under live integration below. Use the normal MongoDB setup below for persistent data.

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
- API-driven destinations, countries, autocomplete suggestions, property types and amenities: fetches every page of `GET /api/listings`, including inventory beyond the first 50 records. Destination counts and minimum nightly prices are derived from those listings. Refresh places reloads the data; Explore all destinations expands the complete destination list. Free-text search is not restricted to the suggestions.
- List your space: validated property form sends `POST /api/listings`. A successful listing opens its detail page and appears in discovery and search when returning home. Country and city filters distinguish same-name cities in different countries. This is a demo creation flow; the backend has no host authentication or listing update/delete routes.
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

Validation on 13-14 November 2026: 12 unit/API tests and 15 browser tests passed, covering booking, collections, comparison limits, amenities, calendar boundaries, photo viewing, itinerary export, responsive layouts, and automated WCAG checks on the principal screens. The `e2e/` suite uses mocked API responses. The separate live-integration check below also passed with Member 1's real backend and isolated MongoDB. AWS deployment and cloud-load measurements remain Member 3's work.

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
- Real browser listing creation in a new city, verified in MongoDB and then found through dynamic discovery and search.
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

## Detailed dynamic discovery check

1. Start `demo:backend` in one terminal and the frontend in another. Keep both running. Open `/health` on port 5000 and the site on port 5173.
2. Open browser developer tools, Network, Fetch/XHR. Refresh. Inspect `GET /api/listings?page=1&limit=50` and `GET /api/search`. Destination cards, counts, starting prices, filters and suggestions reflect this inventory; they are not a fixed list of cities.
3. Expand Explore all destinations. Search any city, country or area in the inventory, or type a different place to see the empty state. Combine Country, guests, date range, property type, price, amenities and sort.
4. Select List your space. Publish a sample property in a new city, such as Kyoto, Japan, with a title, description, neighbourhood, nightly rate 95, two guests, one bedroom, one bathroom, and amenities `Wi-Fi, Sauna`. Photos are optional. Confirm permission to publish the sample data.
5. Inspect `POST /api/listings`: expect 201 and an actual listing ID. Check the detail page matches the response. Return home and expand all destinations. The new city, country and Sauna option should appear without code changes. If another person added the stay while your homepage was open, use Refresh places.
6. Click the new destination and verify `city=Kyoto` and `country=Japan` in the search request. Refresh the browser to confirm the filters and property remain. Only expect destinations where properties exist; the backend is a listing inventory, not a worldwide geography service.
7. Choose future dates, check availability and book. A two-night stay at 95 should return a server total of 190 and Pending status. Save the reference, reload, and look it up again. Try overlapping dates: expect 409. Cancel and confirm availability returns.
8. Test saved stays, a three-property comparison, photo viewer, printing and calendar download. Test missing fields, reversed dates, over 30 nights, excessive guests, no matches and an unavailable backend.
9. Check mobile navigation and layouts at 320, 390, 768 and 1440 pixels. Use Tab/Enter/Escape for keyboard checks. The new publishing form should fit the screen too.
10. Run `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run test:e2e`. Run the separate live-integration script for real database verification. The automated live check shuts down its own backend afterward; it does not replace the long-running manual demo.

For a production-scale inventory, Member 1 should expose server-side destination/facet endpoints; the current compatible frontend derives discovery options by paginating the existing listing API. Destination photos come from actual listing image URLs; missing images show a neutral placeholder. No worldwide inventory, verified photography, host identity, payment collection or email delivery is fabricated.

## Continuous checks

`.github/workflows/frontend.yml` runs formatting, unit tests, the production build, and Chromium workflows/accessibility checks on frontend pushes and pull requests. It requires no application secrets and does not deploy anything. Use the Actions tab for the remote run status; local verification does not imply the remote workflow has completed.
