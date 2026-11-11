/**
 * LISTING SERVICE
 * Owns the Listing collection: reading listings and storing new ones.
 * Other services ask this service for listing data instead of querying
 * the collection themselves.
 */
const { Listing } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { assertObjectId } = require('../../utils/validateObjectId');
const { buildMeta } = require('../../utils/pagination');

async function getListings({ page, limit, skip }) {
  const [items, total] = await Promise.all([
    Listing.find().sort({ createdAt: -1, _id: 1 }).skip(skip).limit(limit).lean(),
    Listing.countDocuments(),
  ]);
  return { items, meta: buildMeta({ page, limit }, total) };
}

async function getListingById(id, field = 'id') {
  assertObjectId(id, field);
  const listing = await Listing.findById(id).lean();
  if (!listing) throw ApiError.notFound(`Listing ${id} not found`);
  return listing;
}

const WRITABLE_FIELDS = [
  'title', 'description', 'propertyType', 'location', 'city', 'state', 'country',
  'pricePerNight', 'maxGuests', 'bedrooms', 'bathrooms', 'amenities', 'imageUrls', 'rating',
];

/** Create a listing. Mongoose schema rules do the field validation. */
async function createListing(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.badRequest('Request body must be a JSON object');
  }
  const data = {};
  for (const field of WRITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  const listing = await Listing.create(data);
  return listing.toObject();
}

module.exports = { getListings, getListingById, createListing };
