# Frontend Integration Guide (for Member 2)

This guide is everything you need to build the UI against the backend.
Full endpoint reference: [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

## 1. Run the backend locally

Requirements: Node.js 20+ and MongoDB Community Server running locally (see `backend/README.md`).

```bash
cd backend
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
npm run seed              # loads 20 sample listings + 5 bookings
npm run dev               # http://localhost:5000
```

Check it works: open <http://localhost:5000/health>, which should show `"database":"connected"`.

## 2. CORS

The backend accepts browser requests from the origins in `CORS_ORIGIN` in `backend/.env`.
Defaults: `http://localhost:3000` (Create React App / Next.js) and `http://localhost:5173` (Vite).
If your dev server uses a different port, add it (comma-separated) and restart the backend.
Requests from other origins get `403 CORS_FORBIDDEN`.

## 3. Configure the API base URL

Keep the URL in an environment variable so Member 3 can point it at the deployed backend.

```js
// Vite: .env → VITE_API_URL=http://localhost:5000
// CRA:  .env → REACT_APP_API_URL=http://localhost:5000
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```

## 4. A small API client

Every response has `success`. On success read `data` (and `meta` for lists);
on failure read `error.code`, `error.message` and optional `error.details`.

```js
// src/api.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message || 'Request failed');
    this.status = status;            // HTTP status, e.g. 409
    this.code = error?.code;         // e.g. "BOOKING_CONFLICT"
    this.details = error?.details || [];
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) throw new ApiError(res.status, body.error);
  return body; // { success, data, meta? }
}

const qs = (params) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();

export const api = {
  getListings: (page = 1, limit = 12) => request(`/api/listings?${qs({ page, limit })}`),
  getListing: (id) => request(`/api/listings/${id}`),
  search: (filters) => request(`/api/search?${qs(filters)}`),
  checkAvailability: (listingId, checkIn, checkOut) =>
    request(`/api/availability?${qs({ listingId, checkIn, checkOut })}`),
  getBookedRanges: (listingId) => request(`/api/availability/${listingId}/bookings`),
  createBooking: (booking) => request('/api/bookings', { method: 'POST', body: JSON.stringify(booking) }),
  getBooking: (id) => request(`/api/bookings/${id}`),
  cancelBooking: (id) =>
    request(`/api/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ bookingStatus: 'Cancelled' }) }),
};
```

## 5. Screen-by-screen

### Home / listing grid

```js
const { data: listings, meta } = await api.getListings(page);
// meta = { page, limit, total, totalPages } → build pagination controls
```

Card fields: `imageUrls[0]`, `title`, `city`, `country`, `propertyType`, `pricePerNight`, `rating`, `maxGuests`.

### Search page

```js
const { data, meta } = await api.search({
  city: 'London',          // exact city (case-insensitive)
  location: '',            // or free text: matches area, city, state, country
  minPrice: 50,
  maxPrice: 200,
  propertyType: 'Apartment',
  guests: 2,
  checkIn: '2026-12-20',   // optional, send both or neither
  checkOut: '2026-12-23',
  sort: 'price_asc',       // newest | price_asc | price_desc | rating_desc
  page: 1,
});
if (data.length === 0) showEmptyState(); // no results is 200 with [], not an error
```

Property types for a dropdown: `Apartment, House, Villa, Cabin, Cottage, Studio, Loft, Guesthouse`.

### Listing details page

```js
const { data: listing } = await api.getListing(id);           // 404 → show "listing not found"
const { data: cal } = await api.getBookedRanges(id);          // grey out booked dates
// cal.bookedRanges = [{ checkInDate, checkOutDate, bookingStatus }]
// Nights from checkInDate up to the day BEFORE checkOutDate are taken.
// checkOutDate itself is free for a new check-in.
```

Before showing the booking form's price, you can check the chosen dates:

```js
const { data } = await api.checkAvailability(id, checkIn, checkOut);
if (!data.available) showMessage('Those dates are already booked');
// data.numberOfNights × listing.pricePerNight = estimated total
```

### Booking form

```js
try {
  const { data: booking } = await api.createBooking({
    listingId,
    guestName,
    guestEmail,
    numberOfGuests: Number(guests),   // must be a number, not a string
    checkInDate,                      // 'YYYY-MM-DD' – <input type="date"> already uses this format
    checkOutDate,
  });
  navigate(`/bookings/${booking._id}`);  // show booking.totalPrice, booking.bookingStatus
} catch (err) {
  if (err.code === 'VALIDATION_ERROR' || err.code === 'GUEST_CAPACITY_EXCEEDED') {
    // err.details = [{ field: 'guestEmail', message: '...' }, ...] → show under each input
  } else if (err.code === 'BOOKING_CONFLICT') {
    // Someone else has these dates. err.details lists the booked ranges.
  } else if (err.status === 404) {
    // listing no longer exists
  } else {
    // network or server problem → generic message
  }
}
```

Do **not** send `totalPrice` or `bookingStatus`; the server calculates them and ignores client values.

### Booking confirmation page

`GET /api/bookings/:id` returns the booking plus `listing: { _id, title, city, country, imageUrls }`,
so the page does not need a second request.

## 6. Form validation rules to mirror in the UI

| Field | Rule |
|---|---|
| guestName | 2–100 characters |
| guestEmail | valid email |
| numberOfGuests | whole number, 1 … `listing.maxGuests` |
| checkInDate | today or later (UTC) |
| checkOutDate | after check-in, at most 30 nights later |

The server enforces all of these anyway; client-side checks just give faster feedback.

## 7. Dates and time zones

Send and receive plain `YYYY-MM-DD` strings. Avoid `new Date('2026-12-22')` for display because browsers
treat it as UTC and may show the previous day in some time zones. Display the string directly or format it
with `toLocaleDateString(undefined, { timeZone: 'UTC' })`.

## 8. Testing without the frontend

Import `docs/postman_collection.json` into Postman to try every request.
