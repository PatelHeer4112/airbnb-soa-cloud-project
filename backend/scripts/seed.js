/**
 * Database initialisation and seeding.
 *
 *   npm run seed
 *
 * - Creates collections and indexes.
 * - Replaces ALL listings, bookings and booked nights with sample data.
 * - Creates sample bookings through the Booking Service (so the same
 *   validation and night-reservation logic is used), with dates relative
 *   to today so they are always in the future.
 *
 * Refuses to run when NODE_ENV=production unless --force is given.
 */
const config = require('../src/config/env');
const { connectDB, disconnectDB, describeUri } = require('../src/config/db');
const { Listing, Booking, BookedNight } = require('../src/models');
const bookingService = require('../src/services/booking/booking.service');
const { addDays, todayUtc, nightsBetween } = require('../src/utils/dates');
const listings = require('./seedData');

async function seed() {
  if (config.isProduction && !process.argv.includes('--force')) {
    console.error('Refusing to seed a production database. Re-run with --force if you are sure.');
    process.exit(1);
  }

  await connectDB();
  console.log(`[seed] connected to ${describeUri()}`);

  await Promise.all([Listing.deleteMany({}), Booking.deleteMany({}), BookedNight.deleteMany({})]);
  console.log('[seed] cleared listings, bookings and booked nights');

  const created = await Listing.insertMany(listings);
  console.log(`[seed] inserted ${created.length} listings`);

  const byTitle = (part) => created.find((l) => l.title.includes(part));
  const today = todayUtc();
  const stay = (listing, startOffset, nights, guest, guests) => {
    const checkIn = addDays(today, startOffset);
    const checkOut = addDays(checkIn, nights);
    return bookingService.createBooking({
      listingId: String(listing._id),
      guestName: guest.name,
      guestEmail: guest.email,
      numberOfGuests: guests,
      checkIn,
      checkOut,
      nights: nightsBetween(checkIn, checkOut),
    });
  };

  const b1 = await stay(byTitle('Shoreditch'), 7, 3, { name: 'Alice Brown', email: 'alice@example.com' }, 2);
  const b2 = await stay(byTitle('Greenwich'), 14, 5, { name: 'Raj Mehta', email: 'raj@example.com' }, 5);
  const b3 = await stay(byTitle('Montmartre'), 10, 4, { name: 'Sofia Rossi', email: 'sofia@example.com' }, 2);
  const b4 = await stay(byTitle('Goa'), 30, 7, { name: 'Daniel Kim', email: 'daniel@example.com' }, 6);
  const b5 = await stay(byTitle('Shoreditch'), 20, 2, { name: 'Emma Wilson', email: 'emma@example.com' }, 1);

  await bookingService.updateBookingStatus(String(b1._id), 'Confirmed');
  await bookingService.updateBookingStatus(String(b2._id), 'Confirmed');
  await bookingService.updateBookingStatus(String(b4._id), 'Confirmed');
  await bookingService.updateBookingStatus(String(b5._id), 'Cancelled');
  console.log('[seed] inserted 5 bookings (3 Confirmed, 1 Pending, 1 Cancelled)');

  console.log('\nSample IDs for manual testing:');
  console.log(`  Listing (Shoreditch Loft): ${byTitle('Shoreditch')._id}`);
  console.log(`  Booking (Confirmed):       ${b1._id}  ${b1.checkInDate} -> ${b1.checkOutDate}`);
  console.log(`  Booking (Pending):         ${b3._id}`);
  console.log(`  Booking (Cancelled):       ${b5._id}`);

  await disconnectDB();
  console.log('\n[seed] done');
}

seed().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
