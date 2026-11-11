/**
 * SEARCH SERVICE
 * Turns validated search criteria into a MongoDB query over listings.
 * When dates are supplied it asks the Availability Service which listings
 * are already booked and excludes them (service composition).
 */
const { Listing } = require('../../models');
const availabilityService = require('../availability/availability.service');
const { buildMeta } = require('../../utils/pagination');

const SORTS = {
  newest: { createdAt: -1, _id: 1 },
  price_asc: { pricePerNight: 1, _id: 1 },
  price_desc: { pricePerNight: -1, _id: 1 },
  rating_desc: { rating: -1, _id: 1 },
};

/** Escape user text so it is matched literally, never run as a regular expression. */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function buildFilter(criteria) {
  const filter = {};

  if (criteria.city) {
    // Whole-word, case-insensitive city match: "london" matches "London".
    filter.city = new RegExp(`^${escapeRegex(criteria.city)}$`, 'i');
  }
  if (criteria.country) {
    filter.country = new RegExp(`^${escapeRegex(criteria.country)}$`, 'i');
  }
  if (criteria.location) {
    // Free-text location: partial match on area, city, state or country.
    const re = new RegExp(escapeRegex(criteria.location), 'i');
    filter.$or = [{ location: re }, { city: re }, { state: re }, { country: re }];
  }
  if (criteria.minPrice !== undefined || criteria.maxPrice !== undefined) {
    filter.pricePerNight = {};
    if (criteria.minPrice !== undefined) filter.pricePerNight.$gte = criteria.minPrice;
    if (criteria.maxPrice !== undefined) filter.pricePerNight.$lte = criteria.maxPrice;
  }
  if (criteria.propertyType) filter.propertyType = criteria.propertyType;
  if (criteria.guests) filter.maxGuests = { $gte: criteria.guests };
  if (criteria.amenities && criteria.amenities.length) {
    filter.amenities = {
      $all: criteria.amenities.map((a) => new RegExp(`^${escapeRegex(a)}$`, 'i')),
    };
  }
  if (criteria.checkIn && criteria.checkOut) {
    const bookedIds = await availabilityService.getUnavailableListingIds(criteria.checkIn, criteria.checkOut);
    if (bookedIds.length) filter._id = { $nin: bookedIds };
  }
  return filter;
}

async function searchListings(criteria, { page, limit, skip }) {
  const filter = await buildFilter(criteria);
  const sort = SORTS[criteria.sort || 'newest'];
  const [items, total] = await Promise.all([
    Listing.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Listing.countDocuments(filter),
  ]);
  return { items, meta: buildMeta({ page, limit }, total) };
}

module.exports = { searchListings, buildFilter, escapeRegex };
