# Airbnb SOA – Backend

Node.js + Express + MongoDB backend with four services: **Listing**, **Search**, **Availability** and **Booking**.

## Prerequisites (all free, local)

| Software | Tested version | Install (Windows) |
|---|---|---|
| Node.js | 26.13.0 (≥ 20 required) | `winget install OpenJS.NodeJS.LTS` or <https://nodejs.org> |
| MongoDB Community Server | 9.0.4 (≥ 6.0) | `winget install MongoDB.Server` or <https://www.mongodb.com/try/download/community> |

The MongoDB installer registers a Windows service called **MongoDB** that starts automatically and listens on
`127.0.0.1:27017`. Check it with `Get-Service MongoDB` (PowerShell). On macOS/Linux, start `mongod` with your package manager's service.

## Setup

```bash
cd backend
npm install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
npm run seed                # creates indexes, loads 20 listings + 5 bookings (deletes existing data in that DB)
npm run dev                 # development server with auto-reload on http://localhost:5000
```

Open <http://localhost:5000/health>; it should report `"database":"connected"`.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Production start (`node src/server.js`) |
| `npm run dev` | Development start with nodemon |
| `npm run seed` | Reset the database in `MONGODB_URI` and load sample data |
| `npm test` | Run 111 Jest/Supertest tests against `MONGODB_URI_TEST` |
| `npm run test:coverage` | Tests plus coverage report |

## Environment variables

See [`.env.example`](.env.example): `NODE_ENV`, `PORT`, `MONGODB_URI`, `MONGODB_URI_TEST`, `CORS_ORIGIN`.
Never commit `.env`.

## Endpoints

| Method | Path | Service |
|---|---|---|
| GET | `/health` | – |
| GET | `/api/listings` | Listing |
| GET | `/api/listings/:id` | Listing |
| POST | `/api/listings` | Listing |
| GET | `/api/search` | Search |
| GET | `/api/availability` | Availability |
| GET | `/api/availability/:listingId/bookings` | Availability |
| POST | `/api/bookings` | Booking |
| GET | `/api/bookings/:id` | Booking |
| PATCH | `/api/bookings/:id/status` | Booking |

## Documentation

| Document | For |
|---|---|
| [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | Every endpoint, parameters, real request/response examples, errors |
| [docs/postman_collection.json](docs/postman_collection.json) | Import into Postman |
| [docs/FRONTEND_INTEGRATION_GUIDE.md](docs/FRONTEND_INTEGRATION_GUIDE.md) | Member 2 – frontend |
| [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | Member 3 – deployment, cost warnings |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | SOA design, diagrams, conflict prevention |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Collections, fields, indexes, seed data |
| [docs/TESTING.md](docs/TESTING.md) | How to test and actual results |
| [docs/BACKEND_REPORT_SECTION.md](docs/BACKEND_REPORT_SECTION.md) | Member 1 report section, limitations, future work |
| [docs/VIVA_QUESTIONS.md](docs/VIVA_QUESTIONS.md) | Viva preparation |

## Troubleshooting

| Problem | Fix |
|---|---|
| `[db] could not connect ... ECONNREFUSED` | MongoDB isn't running: `Start-Service MongoDB` (admin PowerShell) |
| `EADDRINUSE :5000` | Another process uses the port; change `PORT` in `.env` |
| Browser shows CORS error / API returns 403 `CORS_FORBIDDEN` | Add your frontend URL to `CORS_ORIGIN` and restart |
| Tests fail with "Missing required sub-document 'driver'" | Run tests with `npm test` (it adds `--experimental-vm-modules`), not bare `npx jest` |
