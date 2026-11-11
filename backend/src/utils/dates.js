/**
 * Date helpers. Bookings work with whole calendar days in UTC.
 * A date such as "2026-12-24" is stored as 2026-12-24T00:00:00.000Z.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a strict YYYY-MM-DD string to a UTC-midnight Date, or return null. */
function parseDateOnly(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject impossible dates such as 2026-02-30 (JavaScript would roll them over).
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function nightsBetween(checkIn, checkOut) {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
}

/** Every night of a stay: [checkIn, checkOut). The check-out day is not a night. */
function eachNight(checkIn, checkOut) {
  const nights = [];
  for (let t = checkIn.getTime(); t < checkOut.getTime(); t += MS_PER_DAY) {
    nights.push(new Date(t));
  }
  return nights;
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

module.exports = {
  MS_PER_DAY,
  parseDateOnly,
  todayUtc,
  addDays,
  nightsBetween,
  eachNight,
  toDateString,
};
