import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../src/api.js";
test("transient booking failures retry using the same key and payload", async () => {
  const requests = [];
  const api = createApi("", async (_, options) => {
    requests.push(options);
    return requests.length === 1
      ? {
          ok: false,
          status: 503,
          json: async () => ({
            success: false,
            error: { code: "DATABASE_UNAVAILABLE" },
          }),
        }
      : {
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: { _id: "a" } }),
        };
  });
  const result = await api.book(
    { guestName: "Example" },
    "stable-test-key-0001",
  );
  assert.equal(result.data._id, "a");
  assert.equal(requests.length, 2);
  assert.equal(
    requests[0].headers["Idempotency-Key"],
    requests[1].headers["Idempotency-Key"],
  );
  assert.equal(requests[0].body, requests[1].body);
});
test("a long Retry-After is respected by stopping automatic retries", async () => {
  let count = 0;
  const api = createApi("", async () => {
    count++;
    return {
      ok: false,
      status: 429,
      headers: { get: () => "120" },
      json: async () => ({ success: false }),
    };
  });
  await assert.rejects(api.book({}, "stable-test-key-0003"));
  assert.equal(count, 1);
});

test("conflicts and writes without a key are not automatically retried", async () => {
  for (const [status, key] of [
    [409, "stable-test-key-0002"],
    [503, undefined],
  ]) {
    let count = 0;
    const api = createApi("", async () => {
      count++;
      return { ok: false, status, json: async () => ({ success: false }) };
    });
    await assert.rejects(api.book({}, key));
    assert.equal(count, 1);
  }
});
