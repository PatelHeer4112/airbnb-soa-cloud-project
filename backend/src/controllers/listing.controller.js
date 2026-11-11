const listingService = require('../services/listing/listing.service');
const { getPagination } = require('../utils/pagination');
const { sendSuccess } = require('../utils/response');

async function getListings(req, res) {
  const { items, meta } = await listingService.getListings(getPagination(req.query));
  sendSuccess(res, items, { meta });
}

async function getListingById(req, res) {
  const listing = await listingService.getListingById(req.params.id);
  sendSuccess(res, listing);
}

async function createListing(req, res) {
  const listing = await listingService.createListing(req.body);
  sendSuccess(res, listing, { status: 201 });
}

module.exports = { getListings, getListingById, createListing };
