const KEY = "airbnb-stay-preferences-v1";
const validId = (value) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export function createPreferences(storage) {
  let data = { saved: [], compare: [] };
  try {
    const stored = JSON.parse(storage.getItem(KEY));
    for (const key of ["saved", "compare"]) {
      if (Array.isArray(stored?.[key]))
        data[key] = [...new Set(stored[key].filter(validId))].slice(
          0,
          key === "compare" ? 3 : 100,
        );
    }
  } catch {
    /* Storage can be disabled or contain old data. Browsing still works. */
  }
  return {
    ids: (key) => [...data[key]],
    has: (key, id) => data[key].includes(id),
    toggle(key, id) {
      if (!["saved", "compare"].includes(key) || !validId(id))
        throw new Error("Invalid stay selection.");
      const exists = data[key].includes(id);
      if (!exists && data[key].length >= (key === "compare" ? 3 : 100))
        throw new Error(
          key === "compare"
            ? "Compare up to 3 stays. Remove one to add another."
            : "Your saved collection is full. Remove a stay first.",
        );
      data[key] = exists
        ? data[key].filter((value) => value !== id)
        : [...data[key], id];
      try {
        storage.setItem(KEY, JSON.stringify(data));
      } catch {
        /* Keep session-only selections if storage is unavailable. */
      }
      return !exists;
    },
  };
}

let storage;
try {
  storage = globalThis.localStorage;
} catch {
  storage = null;
}
export const preferences = createPreferences(storage);
