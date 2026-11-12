# Airbnb frontend - Member 2

Responsive Airbnb-inspired accommodation search and booking interface, compatible with Member 1's Listing, Search, Availability, and Booking APIs.

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
