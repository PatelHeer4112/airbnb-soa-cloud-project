import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../src/api.js";
import { inventoryFacets } from "../src/discovery.js";

test("search requests keep their timeout when a cancellation signal is supplied", async (t) => {
  const timeout = new AbortController(),
    navigation = new AbortController();
  t.mock.method(AbortSignal, "timeout", () => timeout.signal);
  let signal;
  const api = createApi("", async (_, options) => {
    signal = options.signal;
    return { ok: true, json: async () => ({ success: true, data: [] }) };
  });
  await api.search({}, navigation.signal);
  timeout.abort(new DOMException("Timed out", "TimeoutError"));
  assert.equal(signal.aborted, true);
});
test("timeouts have a useful error code while user cancellation remains an abort", async (t) => {
  const timeout = new AbortController();
  t.mock.method(AbortSignal, "timeout", () => timeout.signal);
  const api = createApi(
    "",
    (_, options) =>
      new Promise((_, reject) => {
        options.signal.addEventListener(
          "abort",
          () => reject(options.signal.reason),
          { once: true },
        );
      }),
  );
  const request = api.search({}, new AbortController().signal);
  timeout.abort(new DOMException("Timed out", "TimeoutError"));
  await assert.rejects(
    request,
    (error) => error.code === "REQUEST_TIMEOUT" && error.status === 0,
  );
});
test("discovery groups case-insensitive city and country names like backend search", () => {
  const base = {
    propertyType: "Apartment",
    amenities: ["Wi-Fi"],
    imageUrls: [],
    pricePerNight: 100,
  };
  const result = inventoryFacets([
    { ...base, city: "London", country: "United Kingdom" },
    { ...base, city: "london", country: "united kingdom", pricePerNight: 80 },
  ]);
  assert.equal(result.destinations.length, 1);
  assert.equal(result.destinations[0].count, 2);
  assert.equal(result.destinations[0].minPrice, 80);
  assert.equal(result.countries.length, 1);
});

test("explicitly cancelled requests stay distinguishable from service failures", async () => {
  const navigation = new AbortController();
  const api = createApi(
    "",
    (_, options) =>
      new Promise((_, reject) =>
        options.signal.addEventListener(
          "abort",
          () => reject(options.signal.reason),
          { once: true },
        ),
      ),
  );
  const request = api.search({}, navigation.signal);
  navigation.abort();
  await assert.rejects(request, (error) => error.name === "AbortError");
});

test("every destination country has a selectable canonical dropdown value", () => {
  const base = {
    propertyType: "Apartment",
    amenities: [],
    imageUrls: [],
    pricePerNight: 100,
  };
  const facets = inventoryFacets([
    { ...base, city: "London", country: "United Kingdom" },
    { ...base, city: "Liverpool", country: "united kingdom" },
  ]);
  assert.equal(facets.countries.length, 1);
  assert.ok(
    facets.destinations.every((destination) =>
      facets.countries.includes(destination.country),
    ),
  );
});
