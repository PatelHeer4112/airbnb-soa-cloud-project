# Frontend — Member 2

Responsive Airbnb-inspired accommodation UI, built with JavaScript, CSS, and Vite. Uses the existing backend APIs; no mock bookings or fallback listing data are shown in the application.

## Run locally

Requires Node.js 20.19+ or 22.12+. Start MongoDB and follow `../backend/README.md` to install, seed, and start the API on port 5000. In a second terminal:

```powershell
cd frontend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

Open http://localhost:5173. On macOS/Linux use `npm` instead of `npm.cmd`. The `.cmd` command works around PowerShell restrictions on unsigned `npm.ps1` scripts. The fixed port matches the backend's default CORS configuration.

## Features and API integration

- Destination, dates, guests, property type, nightly price range, sorting, and pagination: `GET /api/search`.
- Shareable listing routes, photos, amenities, and capacity: `GET /api/listings/:id`.
- Upcoming reserved dates and explicit availability check: `GET /api/availability/:id/bookings`, `GET /api/availability`.
- Validated booking request with name, email, guest count and dates: `POST /api/bookings`. Server calculates the price and status and checks for conflicts atomically.
- Booking reference lookup and persistent confirmation URL: `GET /api/bookings/:id`.
- Cancellation with confirmation dialog: `PATCH /api/bookings/:id/status`.
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

## Limitations

The backend currently has no authentication, payment, or specified currency. The UI reports real Pending/Confirmed/Cancelled status and does not claim a payment or email was sent. Prices use the API's numerical units without adding a currency symbol. Public deployment needs an agreed access-control plan; a booking reference currently retrieves guest details. Seeded property photos are placeholders; the homepage uses an external Unsplash photograph and typography uses Google Fonts with local fallback fonts.

## Manual user-flow checklist

Validation on 12 November 2026: production build passed; 5 API/validation tests and 4 Chromium browser tests passed, including a 390px mobile viewport. `npm audit` reported 0 vulnerabilities. Browser tests use mocked HTTP responses; live backend/MongoDB integration and AWS deployment were not executed on this machine.

1. Browse and paginate the seeded stays; search London and combine a property type, guests, prices and sort. Refresh and confirm filters persist.
2. Try no matching destination, a stopped API, and retry after restoring it.
3. Open a listing, inspect amenities and reserved ranges, choose valid dates and check availability.
4. Try missing email, excess guests, past dates, reversed dates, and a stay over 30 nights.
5. Submit a valid request; verify the real reference, server-calculated total and Pending status. Reload its URL and look it up by reference.
6. Try the same dates again and verify the conflict message. Cancel the original booking and verify those dates become available again.
7. Check the workflow at mobile width and using keyboard-only navigation.
