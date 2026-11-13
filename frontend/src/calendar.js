import { today, dateError } from "./validation.js";
import { icon } from "./icons.js";

export const reservedNight = (day, ranges) =>
  ranges.some((range) => day >= range.checkInDate && day < range.checkOutDate);
export const overlapsStay = (start, end, ranges) =>
  ranges.some((range) => start < range.checkOutDate && end > range.checkInDate);

export function mountCalendar(target, ranges, form) {
  const initial = form.elements.checkIn.value || today();
  let month = new Date(`${initial.slice(0, 7)}-01T00:00:00Z`);
  const minimum = today().slice(0, 7);
  let start = form.elements.checkIn.value;
  let end = form.elements.checkOut.value;
  let message = "";
  function draw() {
    const year = month.getUTCFullYear(),
      m = month.getUTCMonth();
    const offset = (new Date(Date.UTC(year, m, 1)).getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    const title = month.toLocaleDateString(undefined, {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    });
    target.innerHTML = `<div class="calendar-title"><div>${icon("calendar")}<strong>${title}</strong></div><div><button type="button" class="calendar-nav" data-month="-1" aria-label="Previous month" ${month.toISOString().slice(0, 7) <= minimum ? "disabled" : ""}>&larr;</button><button type="button" class="calendar-nav" data-month="1" aria-label="Next month">&rarr;</button></div></div><div class="calendar-grid">${["M", "T", "W", "T", "F", "S", "S"].map((day) => `<span class="weekday" aria-hidden="true">${day}</span>`).join("")}${"<span></span>".repeat(offset)}${Array.from(
      { length: count },
      (_, i) => {
        const day = `${year}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
        const booked = reservedNight(day, ranges),
          past = day < today();
        // An occupied day may still be selected as check-out; no occupied nights may be included.
        const departure =
          !!start &&
          !end &&
          day > start &&
          !dateError(start, day) &&
          !overlapsStay(start, day, ranges);
        const disabled = past || (booked && !departure);
        return `<button type="button" data-day="${day}" aria-label="${day}${booked ? " reserved" : ""}" aria-pressed="${day === start || day === end}" ${disabled ? "disabled" : ""} class="calendar-day ${booked ? "reserved" : ""} ${day === start || day === end ? "selected" : ""} ${start && end && day > start && day < end ? "in-range" : ""}">${i + 1}</button>`;
      },
    ).join(
      "",
    )}</div><div class="calendar-legend"><span><i></i> Available</span><span><i class="reserved"></i> Reserved night</span><button type="button" class="plain" data-clear-dates>Clear dates</button></div><p class="calendar-instruction" role="status">${message || (!start ? "Choose your check-in date." : !end ? "Now choose check-out. Maximum stay: 30 nights." : "Your dates are selected. Check live availability before booking.")}</p>`;
  }
  target.onclick = (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.month) {
      month = new Date(
        Date.UTC(
          month.getUTCFullYear(),
          month.getUTCMonth() + Number(button.dataset.month),
          1,
        ),
      );
      draw();
      return;
    }
    if (button.hasAttribute("data-clear-dates")) {
      start = "";
      end = "";
      message = "";
    } else if (button.dataset.day) {
      const day = button.dataset.day;
      message = "";
      if (!start || end || day <= start) {
        start = day;
        end = "";
      } else {
        message =
          dateError(start, day) ||
          (overlapsStay(start, day, ranges)
            ? "Those nights overlap a reservation. Choose another check-in."
            : "");
        if (!message) end = day;
      }
    } else return;
    form.elements.checkIn.value = start;
    form.elements.checkOut.value = end;
    form.dispatchEvent(new Event("input", { bubbles: true }));
    draw();
  };
  const sync = () => {
    start = form.elements.checkIn.value;
    end = form.elements.checkOut.value;
    message = "";
    if (start) month = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
    draw();
  };
  form.elements.checkIn.addEventListener("change", sync);
  form.elements.checkOut.addEventListener("change", sync);
  draw();
}
