import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchInventory, inventoryFacets } from "../src/discovery.js";
import { createApi } from "../src/api.js";

test("inventory follows pagination beyond 50 records and removes duplicate IDs", async () => {
  const calls = [];
  const api = {
    listings: async (page) => {
      calls.push(page);
      return {
        data:
          page === 1 ? [{ _id: "first" }] : [{ _id: "first" }, { _id: "last" }],
        meta: { totalPages: 2 },
      };
    },
  };
  assert.deepEqual(
    (await fetchInventory(api)).map((l) => l._id),
    ["first", "last"],
  );
  assert.deepEqual(calls, [1, 2]);
});
test("facets reflect new cities, same-name cities in different countries, types and amenities", () => {
  const data = [
    {
      city: "New Place",
      country: "Country A",
      pricePerNight: 180,
      propertyType: "Loft",
      amenities: ["Sauna"],
      imageUrls: [],
    },
    {
      city: "New Place",
      country: "Country A",
      pricePerNight: 90,
      propertyType: "Cabin",
      amenities: ["Kitchen"],
      imageUrls: [],
    },
    {
      city: "New Place",
      country: "Country B",
      pricePerNight: 60,
      propertyType: "Loft",
      amenities: ["Sauna"],
      imageUrls: [],
    },
  ];
  const facets = inventoryFacets(data);
  assert.equal(facets.destinations.length, 2);
  assert.equal(facets.destinations[0].count, 2);
  assert.equal(facets.destinations[0].minPrice, 90);
  assert.deepEqual(facets.types, ["Cabin", "Loft"]);
  assert.deepEqual(facets.amenities, ["Kitchen", "Sauna"]);
});
test("listing publication uses the existing backend create-listing route", async () => {
  const payload = {
    title: "A new stay",
    city: "Kyoto",
    maxGuests: 2,
    pricePerNight: 95,
  };
  const api = createApi("http://localhost:5000", async (url, options) => {
    assert.equal(url, "http://localhost:5000/api/listings");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), payload);
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: { ...payload, _id: "a".repeat(24) },
      }),
    };
  });
  assert.equal((await api.createListing(payload)).data.city, "Kyoto");
});
