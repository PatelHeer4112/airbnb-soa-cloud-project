export function calendarEvent(booking, url) {
  const clean = (value) =>
    String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const day = (value) => value.replaceAll("-", "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Airbnb student project//Stay itinerary//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${clean(booking._id)}@airbnb-student-project`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${day(booking.checkInDate)}`,
    `DTEND;VALUE=DATE:${day(booking.checkOutDate)}`,
    `SUMMARY:${clean(booking.listing?.title || "Your stay")}`,
    `LOCATION:${clean([booking.listing?.city, booking.listing?.country].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${clean(`Booking ${booking._id}. Status: ${booking.bookingStatus}. Check-in and check-out times must be agreed with the property.`)}`,
    `URL:${clean(url)}`,
    `STATUS:${booking.bookingStatus === "Confirmed" ? "CONFIRMED" : booking.bookingStatus === "Cancelled" ? "CANCELLED" : "TENTATIVE"}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadItinerary(booking) {
  const blob = new Blob([calendarEvent(booking, location.href)], {
    type: "text/calendar;charset=utf-8",
  });
  const href = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = href;
  link.download = `stay-${booking._id}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
