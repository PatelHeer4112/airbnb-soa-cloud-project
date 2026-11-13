# Airbnb frontend - Member 2

Responsive Airbnb-inspired accommodation search and booking interface, compatible with Member 1's Listing, Search, Availability, and Booking APIs.

Features include saved stays, side-by-side comparison, amenity filters, reserved-date calendar, photo viewer, live booking estimates, and printable/calendar itineraries.

This branch contains only the frontend and its documentation. Backend source and setup instructions are maintained on [feature/member1-backend](https://github.com/PatelHeer4112/airbnb-soa-cloud-project/tree/feature/member1-backend).

## Run the frontend

```powershell
cd frontend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

Open http://localhost:5173. Start the backend and MongoDB from a separate checkout; the default API origin is http://localhost:5000. Configure VITE_API_URL for another backend origin.

See [frontend/README.md](frontend/README.md) for API integration, tests, and deployment instructions.

## Integrating with the shared project

The backend folder was removed from this branch at the user's request. When bringing this frontend into a branch containing the backend, copy or selectively merge frontend/ and the relevant frontend documentation; exclude this branch's backend deletion so Member 1's source is retained.

## Verification

Unit tests, browser workflows, automated accessibility checks, backend HTTP contract checks, and isolated real-MongoDB integration verify the frontend. Live checks cover booking persistence, conflicts, cancellation and concurrent reservations. See [frontend/README.md](frontend/README.md) for commands and practical limits. This branch creates no cloud resources and claims no AWS performance results.

Discovery options are derived from all pages of the listing API, not a fixed destination list. List your space publishes through Member 1's existing API. See the detailed dynamic-discovery checklist and the temporary manual-demo backend command in [frontend/README.md](frontend/README.md).
