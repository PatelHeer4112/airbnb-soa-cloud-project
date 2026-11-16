const memory = new Map();
// Persist only random request IDs and a one-way payload digest, never guest text.
export async function bookingRequestKey(payload) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const fingerprint = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const name = `airbnb-booking-intent-${fingerprint}`;
  if (memory.has(name)) return memory.get(name);
  let key;
  try {
    key = sessionStorage.getItem(name);
  } catch {}
  key ||= crypto.randomUUID();
  memory.set(name, key);
  try {
    sessionStorage.setItem(name, key);
  } catch {}
  return key;
}
