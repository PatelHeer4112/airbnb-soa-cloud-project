import { test } from "node:test";
import assert from "node:assert/strict";
import { dateError, nights, escapeHtml, imageUrl } from "../src/validation.js";
import { createApi } from "../src/api.js";

test("stay dates allow same-day turnover and 30 nights, reject invalid or longer stays", () => {
  assert.equal(dateError("2099-01-01", "2099-01-31"), "");
  assert.match(dateError("2099-01-01", "2099-02-01"), /30 nights/);
  assert.match(dateError("2099-01-01", "2099-01-01"), /after/);
  assert.match(dateError("2099-02-29", "2099-03-02"), /valid/);
  assert.match(dateError("2020-01-01", "2020-01-02"), /today/);
  assert.match(dateError("", "2099-01-02"), /both/);
  assert.equal(nights("2099-01-31", "2099-02-02"), 2);
});
test("API values cannot inject markup or executable image URLs", () => {
  assert.equal(escapeHtml('<script>"&'), "&lt;script&gt;&quot;&amp;");
  assert.equal(imageUrl("javascript:alert(1)"), "");
  assert.equal(
    imageUrl("https://example.com/a.jpg"),
    "https://example.com/a.jpg",
  );
});
test("search preserves and encodes filters, excludes empty fields", async () => {
  let called;
  const api = createApi("https://api.example.com/", async (url) => {
    called = url;
    return {
      ok: true,
      json: async () => ({ success: true, data: [], meta: { total: 0 } }),
    };
  });
  await api.search({
    location: "King's Cross & London",
    guests: 2,
    minPrice: 0,
    checkIn: "",
  });
  const url = new URL(called);
  assert.equal(url.pathname, "/api/search");
  assert.equal(url.searchParams.get("location"), "King's Cross & London");
  assert.equal(url.searchParams.get("minPrice"), "0");
  assert.equal(url.searchParams.has("checkIn"), false);
});
test("booking sends the backend contract and propagates conflict details", async () => {
  const booking = {
    listingId: "a".repeat(24),
    guestName: "Test Guest",
    guestEmail: "guest@example.com",
    numberOfGuests: 2,
    checkInDate: "2099-01-01",
    checkOutDate: "2099-01-02",
  };
  const api = createApi("http://localhost:5000", async (url, options) => {
    assert.equal(url, "http://localhost:5000/api/bookings");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), booking);
    return {
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: {
          code: "BOOKING_CONFLICT",
          message: "Dates taken",
          details: [{ checkInDate: "2099-01-01" }],
        },
      }),
    };
  });
  await assert.rejects(
    api.book(booking),
    (error) =>
      error.status === 409 &&
      error.code === "BOOKING_CONFLICT" &&
      error.details.length === 1,
  );
});
test("network failures and malformed success responses are reported", async () => {
  await assert.rejects(
    createApi("", async () => {
      throw new TypeError("offline");
    }).listing("id"),
    /could not reach/,
  );
  await assert.rejects(
    createApi("", async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw Error();
      },
    })).listing("id"),
    /could not be completed/,
  );
});
