const mongoose = require('mongoose');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { Listing, Booking, BookedNight } = require('../src/models');
const { addDays, todayUtc, toDateString } = require('../src/utils/dates');

if (!/test/i.test(new URL(config.mongoUri).pathname)) {
  // Safety net: never let tests wipe a non-test database.
  throw new Error(`Refusing to run tests against non-test database: ${config.mongoUri}`);
}

async function setupDB() {
  await connectDB();
}

async function clearDB() {
  await Promise.all([Listing.deleteMany({}), Booking.deleteMany({}), BookedNight.deleteMany({})]);
}

async function teardownDB() {
  await mongoose.connection.dropDatabase();
  await disconnectDB();
}

/** A date string N days from today, e.g. day(5) -> "2026-11-16". */
function day(offset) {
  return toDateString(addDays(todayUtc(), offset));
}

const baseListing = {
  title: 'Test Loft',
  description: 'A listing used in automated tests',
  propertyType: 'Loft',
  location: 'Shoreditch',
  city: 'London',
  state: 'England',
  country: 'United Kingdom',
  pricePerNight: 100,
  maxGuests: 2,
  bedrooms: 1,
  bathrooms: 1,
  amenities: ['Wi-Fi', 'Kitchen'],
  rating: 4.5,
};

async function createListing(overrides = {}) {
  const listing = await Listing.create({ ...baseListing, ...overrides });
  return listing.toObject();
}

function bookingBody(listingId, overrides = {}) {
  return {
    listingId: String(listingId),
    guestName: 'Test Guest',
    guestEmail: 'guest@example.com',
    numberOfGuests: 2,
    checkInDate: day(10),
    checkOutDate: day(13),
    ...overrides,
  };
}

module.exports = { setupDB, clearDB, teardownDB, day, createListing, bookingBody, baseListing };
