import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreferences } from "../src/preferences.js";
import { reservedNight, overlapsStay } from "../src/calendar.js";
import { calendarEvent } from "../src/itinerary.js";

const ids = ["a", "b", "c", "d"].map((char) => char.repeat(24));
test("saved stays persist only identifiers and comparison is limited to three", () => {
  let value;
  const storage = {
    getItem: () => value,
    setItem: (_, updated) => {
      value = updated;
    },
  };
  const prefs = createPreferences(storage);
  prefs.toggle("saved", ids[0]);
  for (const id of ids.slice(0, 3)) prefs.toggle("compare", id);
  assert.throws(() => prefs.toggle("compare", ids[3]), /up to 3/);
  assert.equal(createPreferences(storage).has("saved", ids[0]), true);
  assert.deepEqual(JSON.parse(value), {
    saved: [ids[0]],
    compare: ids.slice(0, 3),
  });
  prefs.toggle("compare", ids[0]);
  prefs.toggle("compare", ids[3]);
  assert.deepEqual(prefs.ids("compare"), [ids[1], ids[2], ids[3]]);
});
test("corrupt or blocked browser storage does not break saved stays", () => {
  const bad = createPreferences({
    getItem: () => "{bad",
    setItem: () => {
      throw Error("blocked");
    },
  });
  assert.equal(bad.toggle("saved", ids[0]), true);
  assert.equal(bad.has("saved", ids[0]), true);
  const clean = createPreferences({
    getItem: () =>
      JSON.stringify({ saved: [ids[0], ids[0], "<script>"], compare: ids }),
  });
  assert.deepEqual(clean.ids("saved"), [ids[0]]);
  assert.equal(clean.ids("compare").length, 3);
  assert.throws(() => clean.toggle("saved", "<script>"), /Invalid/);
});
test("calendar respects half-open booked intervals and checks every intervening night", () => {
  const ranges = [{ checkInDate: "2099-01-10", checkOutDate: "2099-01-13" }];
  assert.equal(reservedNight("2099-01-10", ranges), true);
  assert.equal(reservedNight("2099-01-13", ranges), false);
  assert.equal(overlapsStay("2099-01-08", "2099-01-10", ranges), false);
  assert.equal(overlapsStay("2099-01-13", "2099-01-15", ranges), false);
  assert.equal(overlapsStay("2099-01-08", "2099-01-15", ranges), true);
});
test("calendar export uses exclusive dates, tentative status and escapes injected lines", () => {
  const output = calendarEvent(
    {
      _id: ids[0],
      checkInDate: "2099-01-08",
      checkOutDate: "2099-01-10",
      bookingStatus: "Pending",
      listing: {
        title: "A quiet stay\nBEGIN:VEVENT",
        city: "Paris",
        country: "France",
      },
    },
    "https://example.com/#/booking/id",
  );
  assert.ok(output.includes("DTSTART;VALUE=DATE:20990108\r\n"));
  assert.ok(output.includes("DTEND;VALUE=DATE:20990110\r\n"));
  assert.ok(output.includes("STATUS:TENTATIVE\r\n"));
  assert.equal(output.split("\r\nBEGIN:VEVENT").length, 2);
  assert.ok(output.includes("Paris\\, France"));
});
