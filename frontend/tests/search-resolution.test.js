import { test } from "node:test";
import assert from "node:assert/strict";
import { inventoryFacets, resolveDestination } from "../src/discovery.js";
const base = { propertyType: "Apartment", pricePerNight: 100, amenities: [] };
const facets = inventoryFacets([
  {
    ...base,
    city: "Paris",
    country: "France",
    location: "Montmartre",
    state: "Ile-de-France",
  },
  {
    ...base,
    city: "London",
    country: "United Kingdom",
    location: "Shoreditch",
  },
  { ...base, city: "Springfield", country: "United States" },
  { ...base, city: "Springfield", country: "Canada" },
]);
test("city, country and neighbourhood input resolve to a canonical country", () => {
  assert.deepEqual(resolveDestination(" paris ", facets), {
    city: "Paris",
    country: "France",
    location: "Paris",
  });
  assert.deepEqual(resolveDestination("Paris, France", facets), {
    city: "Paris",
    country: "France",
    location: "Paris",
  });
  assert.equal(resolveDestination("france", facets).country, "France");
  assert.equal(resolveDestination("Montmartre", facets).country, "France");
  assert.equal(resolveDestination("A place not in inventory", facets), null);
});
test("ambiguous city names require a country instead of an arbitrary guess", () => {
  assert.equal(resolveDestination("Springfield", facets).ambiguous, true);
  assert.equal(
    resolveDestination("Springfield, Canada", facets).country,
    "Canada",
  );
  assert.equal(
    resolveDestination("Springfield", facets, "United States").country,
    "United States",
  );
});
