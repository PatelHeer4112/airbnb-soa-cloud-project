# API Documentation – Airbnb SOA Backend

Base URL (local development): `http://localhost:5000`
All endpoints accept and return JSON. Dates are calendar dates in `YYYY-MM-DD` format (UTC).

> The response examples below were captured from the running backend on 2026-11-11 against the seeded database.
> MongoDB IDs change every time you run `npm run seed`; use `GET /api/listings` to get current IDs.

## Contents

1. [Response format](#1-response-format)
2. [Error codes](#2-error-codes)
3. [Health](#3-health)
4. [Listing Service](#4-listing-service)
5. [Search Service](#5-search-service)
6. [Availability Service](#6-availability-service)
7. [Booking Service](#7-booking-service)
8. [Endpoint summary](#8-endpoint-summary)

---

## 1. Response format

Every response uses one of two envelopes.

**Success**

```json
{
  "success": true,
  "data": { "...": "object or array" },
  "meta": { "page": 1, "limit": 10, "total": 20, "totalPages": 2 }
}
```

`meta` is present only on paginated list endpoints (`/api/listings`, `/api/search`).

**Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid booking request",
    "details": [{ "field": "guestEmail", "message": "guestEmail must be a valid email address" }]
  }
}
```

`details` is optional. For validation errors it lists **every** invalid field, so a form can show all errors at once.
Stack traces and internal error messages are never returned.

### Pagination

| Query param | Default | Rules |
|---|---|---|
| `page` | `1` | positive integer |
| `limit` | `10` | positive integer; values above `50` are capped at `50` |

---

## 2. Error codes

| HTTP | `error.code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing or invalid fields, query parameters or dates |
| 400 | `INVALID_ID` | An ID is not a 24-character hexadecimal MongoDB ObjectId |
| 400 | `INVALID_JSON` | Request body is not valid JSON |
| 400 | `GUEST_CAPACITY_EXCEEDED` | `numberOfGuests` is above the listing's `maxGuests` |
| 403 | `CORS_FORBIDDEN` | Browser request from an origin not in `CORS_ORIGIN` |
| 404 | `NOT_FOUND` | Listing or booking does not exist |
| 404 | `ROUTE_NOT_FOUND` | Unknown URL or HTTP method |
| 409 | `BOOKING_CONFLICT` | Dates overlap an active (Pending/Confirmed) booking |
| 409 | `INVALID_STATUS_TRANSITION` | e.g. confirming a cancelled booking |
| 413 | `PAYLOAD_TOO_LARGE` | Request body above 10 KB |
| 500 | `INTERNAL_ERROR` | Unexpected server error (details logged server-side only) |
| 503 | `DATABASE_UNAVAILABLE` | MongoDB cannot be reached |

### Date rules (bookings, availability, search)

- Format must be exactly `YYYY-MM-DD` and a real calendar date (`2027-02-29` is rejected).
- Check-in cannot be in the past (compared with today's date in UTC).
- Check-out must be after check-in (minimum 1 night).
- Maximum stay: 30 nights.
- **Overlap rule:** an existing booking conflicts when
  `existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn`.
  So a guest may check in on the same day another guest checks out.
- Only `Pending` and `Confirmed` bookings block dates. `Cancelled` bookings are ignored.

---

## 3. Health

### `GET /health` (alias `GET /api/health`)

Used by load balancers and monitoring. Returns `503` if the database is disconnected.

**200 OK**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "uptimeSeconds": 3,
    "timestamp": "2026-11-11T06:44:33.972Z"
  }
}
```

**503 Service Unavailable**: `"success": false`, `"status": "degraded"`, `"database": "disconnected"`.

---

## 4. Listing Service

### Listing object

| Field | Type | Notes |
|---|---|---|
| `_id` | string | MongoDB ObjectId |
| `title` | string | required, max 120 |
| `description` | string | required, max 2000 |
| `propertyType` | string | one of `Apartment, House, Villa, Cabin, Cottage, Studio, Loft, Guesthouse` |
| `location` | string | neighbourhood/area, e.g. `Shoreditch` |
| `city`, `state`, `country` | string | `state` optional |
| `pricePerNight` | number | ≥ 1 |
| `maxGuests` | integer | 1–20 |
| `bedrooms`, `bathrooms` | number | ≥ 0 |
| `amenities` | string[] | e.g. `["Wi-Fi","Kitchen"]` |
| `imageUrls` | string[] | |
| `rating` | number | 0–5 |
| `createdAt`, `updatedAt` | ISO date-time | set automatically |

### `GET /api/listings`

Returns all listings, newest first, paginated.

| Query | Required | Description |
|---|---|---|
| `page` | no | page number (default 1) |
| `limit` | no | items per page (default 10, max 50) |

**Example:** `GET /api/listings?page=1&limit=2`

**200 OK**

```json
{
  "success": true,
  "data": [ { "_id": "6af40ec480417cc5220e03d8", "title": "Compact Studio by King's Cross", "...": "..." } ],
  "meta": { "page": 1, "limit": 2, "total": 20, "totalPages": 10 }
}
```

**Errors:** `400 VALIDATION_ERROR` when `page`/`limit` is not a positive integer.

### `GET /api/listings/:id`

**200 OK**

```json
{
  "success": true,
  "data": {
    "_id": "6af40ec480417cc5220e03d6",
    "title": "Bright Shoreditch Loft near Brick Lane",
    "description": "Open-plan loft with exposed brick, fast Wi-Fi and a short walk to markets, cafes and the Overground.",
    "propertyType": "Loft",
    "location": "Shoreditch",
    "city": "London",
    "state": "England",
    "country": "United Kingdom",
    "pricePerNight": 145,
    "maxGuests": 2,
    "bedrooms": 1,
    "bathrooms": 1,
    "amenities": ["Wi-Fi", "Kitchen", "Washer", "Heating", "Workspace"],
    "imageUrls": [
      "https://picsum.photos/seed/shoreditch-loft-1/800/600",
      "https://picsum.photos/seed/shoreditch-loft-2/800/600"
    ],
    "rating": 4.7,
    "createdAt": "2026-11-11T06:44:20.538Z",
    "updatedAt": "2026-11-11T06:44:20.538Z"
  }
}
```

**Errors**

```json
// 400 – GET /api/listings/abc
{ "success": false, "error": { "code": "INVALID_ID", "message": "id is not a valid ID",
  "details": [{ "field": "id", "message": "id must be a 24-character hexadecimal ID" }] } }

// 404 – valid ID format but no such listing
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Listing 507f1f77bcf86cd799439011 not found" } }
```

### `POST /api/listings`

Creates a listing (for admins and demos; there is no authentication yet, see Limitations in the report).
Body: any listing fields from the table above. Unknown fields are ignored.

```json
{
  "title": "Riverside Flat",
  "description": "Two-bed flat by the Thames",
  "propertyType": "Apartment",
  "location": "Southbank",
  "city": "London",
  "state": "England",
  "country": "United Kingdom",
  "pricePerNight": 180,
  "maxGuests": 4,
  "bedrooms": 2,
  "bathrooms": 1,
  "amenities": ["Wi-Fi", "Kitchen"],
  "imageUrls": [],
  "rating": 0
}
```

**201 Created**: `{ "success": true, "data": { ...listing with _id } }`
**400 VALIDATION_ERROR**: `details` lists each invalid or missing field.

---

## 5. Search Service

### `GET /api/search`

All parameters are optional and can be combined. With no parameters it returns every listing.
If nothing matches, it returns **200** with `"data": []` (not 404).

| Query | Type | Behaviour |
|---|---|---|
| `city` | string | exact city name, case-insensitive (`london` matches `London`, `Lon` does not) |
| `location` | string | partial, case-insensitive match on location, city, state **or** country |
| `country` | string | exact country name, case-insensitive |
| `minPrice` | number ≥ 0 | `pricePerNight >= minPrice` |
| `maxPrice` | number ≥ 0 | `pricePerNight <= maxPrice`; must be ≥ `minPrice` |
| `propertyType` | string | one of the property types, case-insensitive |
| `guests` | integer ≥ 1 | listings with `maxGuests >= guests` |
| `amenities` | comma list | listing must have **all** of them, e.g. `Wi-Fi,Kitchen` |
| `checkIn`, `checkOut` | `YYYY-MM-DD` | both together; excludes listings booked for any of those nights |
| `sort` | string | `newest` (default), `price_asc`, `price_desc`, `rating_desc` |
| `page`, `limit` | integer | pagination |

User text is matched literally: regex characters such as `.*` are escaped.

**Example:** `GET /api/search?city=London&maxPrice=200&guests=2&limit=1`

**200 OK**

```json
{
  "success": true,
  "data": [
    {
      "_id": "6af40ec480417cc5220e03d6",
      "title": "Bright Shoreditch Loft near Brick Lane",
      "propertyType": "Loft",
      "city": "London",
      "pricePerNight": 145,
      "maxGuests": 2,
      "...": "all listing fields"
    }
  ],
  "meta": { "page": 1, "limit": 1, "total": 1, "totalPages": 1 }
}
```

**Example with dates:** `GET /api/search?city=Paris&checkIn=2026-12-20&checkOut=2026-12-23`

**400 VALIDATION_ERROR** (`GET /api/search?minPrice=500&maxPrice=100`)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid search parameters",
    "details": [{ "field": "minPrice", "message": "minPrice cannot be greater than maxPrice" }]
  }
}
```

Other 400 cases: negative or non-numeric price, `guests=0`, unknown `propertyType` or `sort`,
only one of `checkIn`/`checkOut`, a repeated parameter such as `?city=a&city=b`.

---

## 6. Availability Service

### `GET /api/availability`

| Query | Required | Description |
|---|---|---|
| `listingId` | yes | listing ObjectId |
| `checkIn` | yes | `YYYY-MM-DD` |
| `checkOut` | yes | `YYYY-MM-DD` |

**Example (overlapping):** `GET /api/availability?listingId=6af40ec480417cc5220e03d6&checkIn=2026-11-19&checkOut=2026-11-22`

```json
{
  "success": true,
  "data": {
    "listingId": "6af40ec480417cc5220e03d6",
    "checkIn": "2026-11-19",
    "checkOut": "2026-11-22",
    "numberOfNights": 3,
    "available": false,
    "conflictingBookings": [
      { "checkInDate": "2026-11-18", "checkOutDate": "2026-11-21", "bookingStatus": "Confirmed" }
    ]
  }
}
```

**Example (check in on the previous guest's check-out day):** `...&checkIn=2026-11-21&checkOut=2026-11-23`

```json
{
  "success": true,
  "data": {
    "listingId": "6af40ec480417cc5220e03d6",
    "checkIn": "2026-11-21",
    "checkOut": "2026-11-23",
    "numberOfNights": 2,
    "available": true,
    "conflictingBookings": []
  }
}
```

**Errors:** `400 INVALID_ID` (bad listingId), `400 VALIDATION_ERROR` (missing or invalid dates),
`404 NOT_FOUND` (listing does not exist).

### `GET /api/availability/:listingId/bookings`

Upcoming active booked date ranges for a listing, for drawing a calendar. Guest names and emails are **not** returned.

```json
{
  "success": true,
  "data": {
    "listingId": "6af40ec480417cc5220e03d6",
    "bookedRanges": [
      { "checkInDate": "2026-11-18", "checkOutDate": "2026-11-21", "bookingStatus": "Confirmed" },
      { "checkInDate": "2026-12-22", "checkOutDate": "2026-12-26", "bookingStatus": "Pending" }
    ]
  }
}
```

`checkOutDate` is the departure day; that day is free for a new check-in.

**Errors:** `400 INVALID_ID`, `404 NOT_FOUND`.

---

## 7. Booking Service

### Booking object

| Field | Type | Notes |
|---|---|---|
| `_id` | string | booking ID (show it to the guest as their reference) |
| `listingId` | string | |
| `guestName` | string | 2–100 characters, trimmed |
| `guestEmail` | string | valid email, stored lower-case |
| `checkInDate`, `checkOutDate` | `YYYY-MM-DD` | |
| `numberOfGuests` | integer | 1 to the listing's `maxGuests` |
| `numberOfNights` | integer | calculated by the server |
| `pricePerNight` | number | copied from the listing at booking time |
| `totalPrice` | number | `pricePerNight × numberOfNights`, calculated by the server |
| `bookingStatus` | string | `Pending` → `Confirmed` → `Cancelled` |
| `listing` | object | summary: `_id, title, city, country, imageUrls` |
| `createdAt`, `updatedAt` | ISO date-time | |

### `POST /api/bookings`

**Request body** (all fields required; any `totalPrice`, `pricePerNight` or `bookingStatus` sent by the client is ignored)

```json
{
  "listingId": "6af40ec480417cc5220e03d6",
  "guestName": "Priya Shah",
  "guestEmail": "priya@example.com",
  "numberOfGuests": 2,
  "checkInDate": "2026-12-22",
  "checkOutDate": "2026-12-26"
}
```

`numberOfGuests` must be a JSON number (`2`), not a string (`"2"`).

**201 Created**

```json
{
  "success": true,
  "data": {
    "_id": "6af41277b2ba6a02647b29c9",
    "listingId": "6af40ec480417cc5220e03d6",
    "guestName": "Priya Shah",
    "guestEmail": "priya@example.com",
    "checkInDate": "2026-12-22",
    "checkOutDate": "2026-12-26",
    "numberOfGuests": 2,
    "numberOfNights": 4,
    "pricePerNight": 145,
    "totalPrice": 580,
    "bookingStatus": "Pending",
    "createdAt": "2026-11-11T07:00:07.111Z",
    "updatedAt": "2026-11-11T07:00:07.111Z",
    "listing": {
      "_id": "6af40ec480417cc5220e03d6",
      "title": "Bright Shoreditch Loft near Brick Lane",
      "city": "London",
      "country": "United Kingdom",
      "imageUrls": ["https://picsum.photos/seed/shoreditch-loft-1/800/600", "https://picsum.photos/seed/shoreditch-loft-2/800/600"]
    }
  }
}
```

**409 Conflict**: overlapping dates (Tom tries 24–27 Dec after Priya booked 22–26 Dec)

```json
{
  "success": false,
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "The listing is not available for the selected dates",
    "details": [{ "checkInDate": "2026-12-22", "checkOutDate": "2026-12-26" }]
  }
}
```

**400 Bad Request**: several invalid fields at once

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid booking request",
    "details": [
      { "field": "guestName", "message": "guestName must be between 2 and 100 characters" },
      { "field": "guestEmail", "message": "guestEmail must be a valid email address" },
      { "field": "checkOutDate", "message": "checkOutDate must be after checkInDate" }
    ]
  }
}
```

**400 Bad Request**: too many guests

```json
{
  "success": false,
  "error": {
    "code": "GUEST_CAPACITY_EXCEEDED",
    "message": "This listing allows at most 2 guests",
    "details": [{ "field": "numberOfGuests", "message": "numberOfGuests cannot exceed 2" }]
  }
}
```

**404 NOT_FOUND**: listing does not exist. **400 INVALID_JSON**: malformed body.

### `GET /api/bookings/:id`

Returns the booking object above. **Errors:** `400 INVALID_ID`, `404 NOT_FOUND`.

### `PATCH /api/bookings/:id/status`

Confirms or cancels a booking.

```json
{ "bookingStatus": "Confirmed" }
```

| From | To `Confirmed` | To `Cancelled` |
|---|---|---|
| Pending | allowed | allowed |
| Confirmed | 409 | allowed |
| Cancelled | 409 | 409 |

Cancelling releases the dates immediately so they can be booked again.

**200 OK**: updated booking object.
**Errors:** `400 VALIDATION_ERROR` (status not `Confirmed`/`Cancelled`), `400 INVALID_ID`, `404 NOT_FOUND`,
`409 INVALID_STATUS_TRANSITION`:

```json
{ "success": false, "error": { "code": "INVALID_STATUS_TRANSITION",
  "message": "Cannot change booking status from Cancelled to Confirmed" } }
```

---

## 8. Endpoint summary

| Method | Path | Service | Success |
|---|---|---|---|
| GET | `/health`, `/api/health` | – | 200 / 503 |
| GET | `/api/listings` | Listing | 200 |
| GET | `/api/listings/:id` | Listing | 200 |
| POST | `/api/listings` | Listing | 201 |
| GET | `/api/search` | Search | 200 |
| GET | `/api/availability` | Availability | 200 |
| GET | `/api/availability/:listingId/bookings` | Availability | 200 |
| POST | `/api/bookings` | Booking | 201 |
| GET | `/api/bookings/:id` | Booking | 200 |
| PATCH | `/api/bookings/:id/status` | Booking | 200 |

A Postman collection with all of these requests is in [`postman_collection.json`](postman_collection.json)
(Postman → Import → File). Set the collection variables `baseUrl`, `listingId` and `bookingId`.
