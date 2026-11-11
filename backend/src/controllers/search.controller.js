const searchService = require('../services/search/search.service');
const { validateSearchQuery } = require('../validators/search.validator');
const { getPagination } = require('../utils/pagination');
const { sendSuccess } = require('../utils/response');

async function search(req, res) {
  const criteria = validateSearchQuery(req.query);
  const pagination = getPagination(req.query);
  const { items, meta } = await searchService.searchListings(criteria, pagination);
  sendSuccess(res, items, { meta });
}

module.exports = { search };
