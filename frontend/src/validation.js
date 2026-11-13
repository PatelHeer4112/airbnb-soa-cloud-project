export const today = () => new Date().toISOString().slice(0, 10);
export const nights = (start, end) =>
  (Date.parse(end) - Date.parse(start)) / 86400000;
export function dateError(start, end) {
  if (!start || !end) return "Choose both check-in and check-out dates.";
  const valid = (s) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (!valid(start) || !valid(end)) return "Choose valid calendar dates.";
  if (start < today()) return "Check-in must be today or later.";
  if (nights(start, end) < 1) return "Check-out must be after check-in.";
  if (nights(start, end) > 30) return "Choose a stay of 30 nights or fewer.";
  return "";
}
export const escapeHtml = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export function imageUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
