// Real Member 1 backend + isolated, temporary MongoDB for manual browser testing.
// Backend source stays in a separate checkout; no regular database is accessed.
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

if (!process.argv[2])
  throw Error("Usage: npm run demo:backend -- <separate-backend-directory>");
const backend = resolve(process.argv[2]);
const requireBackend = createRequire(join(backend, "package.json"));
let mongo, db, server;
try {
  const { MongoMemoryServer } = requireBackend("mongodb-memory-server");
  mongo = await MongoMemoryServer.create({
    instance: { dbName: "airbnb_manual_demo_test" },
  });
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI_TEST = mongo.getUri();
  process.env.CORS_ORIGIN = "http://localhost:5173,http://127.0.0.1:5173";
  db = requireBackend(join(backend, "src/config/db.js"));
  await db.connectDB();
  const { Listing } = requireBackend(join(backend, "src/models/index.js"));
  const listings = await Listing.insertMany(
    requireBackend(join(backend, "scripts/seedData.js")),
  );
  const bookingService = requireBackend(
    join(backend, "src/services/booking/booking.service.js"),
  );
  const { validateCreateBooking } = requireBackend(
    join(backend, "src/validators/booking.validator.js"),
  );
  const day = (offset) =>
    new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  await bookingService.createBooking(
    validateCreateBooking({
      listingId: String(listings[0]._id),
      guestName: "Demo Guest",
      guestEmail: "demo@example.com",
      numberOfGuests: 1,
      checkInDate: day(7),
      checkOutDate: day(10),
    }),
  );
  const app = requireBackend(join(backend, "src/app.js"))();
  server = await new Promise((done, reject) => {
    const instance = app.listen(5000, () => done(instance));
    instance.on("error", reject);
  });
  console.log("\nReal Member 1 backend ready: http://localhost:5000");
  console.log(
    `Loaded ${listings.length} sample stays and one demo reservation.`,
  );
  console.log(
    "Open the frontend at http://localhost:5173 in another terminal.",
  );
  console.log(
    "TEMPORARY DEMO: newly published stays and bookings are discarded when this process stops.",
  );
  console.log("Keep this terminal open. Press Ctrl+C to stop cleanly.\n");
  if (process.argv.includes("--check")) {
    const health = await fetch("http://localhost:5000/health").then((res) =>
      res.json(),
    );
    const inventory = await fetch(
      "http://localhost:5000/api/listings?limit=50",
    ).then((res) => res.json());
    assert.equal(health.success, true);
    assert.equal(inventory.meta.total, listings.length);
    console.log(
      "PASS manual-demo startup, real API health and seeded inventory. Shutting down smoke check.",
    );
  } else
    await new Promise((done) => {
      process.once("SIGINT", done);
      process.once("SIGTERM", done);
    });
} catch (error) {
  console.error(
    error.code === "EADDRINUSE"
      ? "Port 5000 is already in use. Use the existing backend, or stop it in its terminal before starting this demo."
      : error.message,
  );
  process.exitCode = 1;
} finally {
  if (server) await new Promise((done) => server.close(done));
  await db?.disconnectDB();
  await mongo?.stop();
}
