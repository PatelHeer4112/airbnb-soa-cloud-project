// Optional real integration verification using Member 1's unchanged backend,
// an isolated ephemeral MongoDB process, Vite, and Chromium. No existing DB is used.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { createApi } from "../src/api.js";

if (!process.argv[2])
  throw Error(
    "Usage: node scripts/check-live-integration.mjs <backend-directory>",
  );
const backend = resolve(process.argv[2]);
const backendRequire = createRequire(join(backend, "package.json"));
const { MongoMemoryServer } = backendRequire("mongodb-memory-server");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let mongo, db, server, vite, browser;
try {
  mongo = await MongoMemoryServer.create({
    instance: { dbName: "airbnb_frontend_integration_test" },
  });
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI_TEST = mongo.getUri();
  process.env.CORS_ORIGIN = "http://127.0.0.1:5179";
  db = backendRequire(join(backend, "src/config/db.js"));
  await db.connectDB();
  const { Listing, Booking, BookedNight } = backendRequire(
    join(backend, "src/models/index.js"),
  );
  const seeds = backendRequire(join(backend, "scripts/seedData.js"));
  await Listing.insertMany(seeds);
  const app = backendRequire(join(backend, "src/app.js"))();
  server = await new Promise((done) => {
    const instance = app.listen(0, "127.0.0.1", () => done(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = createApi(base);
  const { data: listings } = await api.search({
    location: "London",
    guests: 2,
    amenities: "Wi-Fi",
    limit: 8,
  });
  assert.equal(listings.length, 2);
  const selected = listings.find((l) => l.title.includes("Shoreditch"));
  assert.ok(selected);
  console.log(
    "PASS real MongoDB seed, search, amenities and listing serialization",
  );
  vite = await createServer({
    configFile: false,
    root,
    define: { "import.meta.env.VITE_API_URL": JSON.stringify(base) },
    server: { host: "127.0.0.1", port: 5179, strictPort: true },
  });
  await vite.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const shift = (days) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const checkIn = shift(5),
    checkOut = shift(7);
  await page.goto("http://127.0.0.1:5179");
  await page.getByLabel("Where to?").fill("London");
  await page.getByRole("button", { name: "Search stays" }).click();
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: selected.title }) })
    .click();
  await page.getByLabel("Check-in", { exact: true }).fill(checkIn);
  await page.getByLabel("Check-out", { exact: true }).fill(checkOut);
  await page.getByRole("button", { name: "Check availability" }).click();
  await page.getByText("These dates are available.").waitFor();
  await page.getByLabel("Guests", { exact: true }).fill("2");
  await page.getByLabel("Full name").fill("Integration Guest");
  await page.getByLabel("Email address").fill("integration@example.com");
  await page.getByRole("button", { name: "Request to book" }).click();
  await page
    .getByRole("heading", { name: "A good stay starts here." })
    .waitFor();
  const id = await page
    .getByLabel("Booking reference", { exact: true })
    .inputValue();
  const stored = await Booking.findById(id).lean();
  assert.equal(stored.guestEmail, "integration@example.com");
  assert.equal(stored.totalPrice, selected.pricePerNight * 2);
  assert.equal(stored.bookingStatus, "Pending");
  assert.equal(await BookedNight.countDocuments({ bookingId: id }), 2);
  console.log(
    "PASS real browser booking persisted with server price and reserved nights",
  );
  const draft = {
    listingId: selected._id,
    guestName: "Conflict Guest",
    guestEmail: "conflict@example.com",
    numberOfGuests: 2,
    checkInDate: checkIn,
    checkOutDate: checkOut,
  };
  await assert.rejects(
    api.book(draft),
    (error) => error.status === 409 && error.code === "BOOKING_CONFLICT",
  );
  console.log("PASS real overlapping booking rejected with HTTP 409");
  await page.reload();
  await page.getByText("Pending", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Cancel this booking" }).click();
  await page.getByRole("button", { name: "Yes, cancel booking" }).click();
  await page.getByRole("heading", { name: "Until next time." }).waitFor();
  assert.equal((await Booking.findById(id).lean()).bookingStatus, "Cancelled");
  assert.equal(await BookedNight.countDocuments({ bookingId: id }), 0);
  assert.equal(
    (await api.availability(selected._id, checkIn, checkOut)).data.available,
    true,
  );
  console.log(
    "PASS real browser reload, cancellation and availability release",
  );
  const results = await Promise.allSettled([api.book(draft), api.book(draft)]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason.code === "BOOKING_CONFLICT",
    ).length,
    1,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS concurrent identical booking requests: one accepted, one conflict",
  );
  console.log(
    "Live integration passed. Temporary MongoDB data will be discarded.",
  );
} finally {
  await browser?.close();
  await vite?.close();
  if (server) await new Promise((done) => server.close(done));
  await db?.disconnectDB();
  await mongo?.stop();
}
