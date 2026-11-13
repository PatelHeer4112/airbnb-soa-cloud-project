import "./style.css";
import "./airbnb.css";
import "./experience.css";
import { icon } from "./icons.js";
import {
  stayCard,
  selectionButton,
  bindCollections,
  syncSelections,
  collectionPage,
  toast,
} from "./collections.js";
import { mountCalendar } from "./calendar.js";
import { downloadItinerary } from "./itinerary.js";
import { createApi } from "./api.js";
import { mountDiscovery } from "./discovery.js";
import { hostPage } from "./host.js";
import {
  today,
  nights,
  dateError,
  escapeHtml as e,
  imageUrl,
} from "./validation.js";

const api = createApi(import.meta.env.VITE_API_URL || "http://localhost:5000");
const main = document.querySelector("main");
let routeVersion = 0;
let pendingSection;
let disposeDiscovery;
let searchController;
const price = (value) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
// The API has no currency field. Show its numeric prices without inventing a currency.
const date = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const img = (url, title, cls = "") =>
  `<img class="${cls}" src="${e(imageUrl(url) || "/images/property-placeholder.svg")}" alt="${e(title)}" loading="lazy" referrerpolicy="no-referrer">`;
const notice = (message) =>
  `<div class="notice" role="alert">${e(message)}</div>`;
function showError(error, target) {
  if (!target?.isConnected) return;
  target.innerHTML =
    notice(error.message) +
    (error.details?.some((d) => d.field)
      ? `<ul class="field-errors">${error.details
          .filter((d) => d.field)
          .map((d) => `<li>${e(d.message)}</li>`)
          .join("")}</ul>`
      : "");
}
const input = (label, name, type = "text", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" ${extra}></label>`;
const dateInputs = (start = "", end = "") =>
  input(
    "Check-in",
    "checkIn",
    "date",
    `min="${today()}" value="${e(start)}" required`,
  ) +
  input(
    "Check-out",
    "checkOut",
    "date",
    `min="${today()}" value="${e(end)}" required`,
  );
function loading() {
  main.innerHTML =
    '<div class="page-message" role="status"><span class="spinner"></span> Finding your next escape…</div>';
}

function home() {
  disposeDiscovery?.();
  const filters = new URLSearchParams(location.hash.split("?")[1] || "");
  try {
    sessionStorage.setItem("stay-results", location.hash || "#/");
  } catch {}
  main.innerHTML = `<div id="discovery-page"><section class="hero"><div class="hero-copy"><span class="eyebrow">A LITTLE FURTHER FROM THE EVERYDAY</span><h1>Somewhere new.<br><em>Something you.</em></h1><p>Remarkable places. Your favourite people.<br> Find a stay that makes the whole trip.</p><a class="text-link" href="#stays" id="discover">Let the journey begin <span aria-hidden="true">&#8599;</span></a></div><div class="hero-footnote"><span>&#10023; A world of places to call home</span><span>EXPLORE MORE. FEEL AT HOME.</span></div></section>
  <form id="search" class="search-bar" aria-label="Search accommodations"><input type="hidden" name="city" value="${e(filters.get("city") || "")}"><datalist id="destination-suggestions"></datalist>${input("Where to?", "location", "search", `list="destination-suggestions" autocomplete="off" maxlength="100" placeholder="Anywhere: city, region, country" value="${e(filters.get("location") || "")}"`)}${input("Check-in", "checkIn", "date", `min="${today()}" value="${e(filters.get("checkIn") || "")}"`)}${input("Check-out", "checkOut", "date", `min="${today()}" value="${e(filters.get("checkOut") || "")}"`)}${input("Who’s coming?", "guests", "number", `min="1" max="20" placeholder="Add guests" value="${e(filters.get("guests") || "")}"`)}<button class="primary" type="submit">${icon("search")} Search stays</button></form>
  <section class="journey-strip content-width" aria-label="Plan your stay"><div>${icon("search")}<span><strong>Find your kind of place</strong><small>Search by destination, dates, and comforts.</small></span></div><div>${icon("heart")}<span><strong>Keep the ones you love</strong><small>Save favourites and compare the details.</small></span></div><div>${icon("calendar")}<span><strong>Make it a date</strong><small>Check availability and request your stay.</small></span></div></section><section id="getaways" class="destinations content-width"><div class="section-heading"><div><span class="eyebrow">A LITTLE INSPIRATION FOR YOUR NEXT TRIP</span><h2>Explore destinations</h2></div><p>Real places from the current listing inventory.</p></div><div class="discovery-controls"><p id="inventory-summary" role="status">Loading places from the API...</p><button type="button" class="secondary" id="refresh-inventory">Refresh places</button></div><div class="destination-grid" id="destination-inventory"><p>Discovering destinations...</p></div><button class="secondary more-destinations" id="more-destinations" type="button" hidden>Explore all destinations</button></section>
  <section id="stays" class="collection"><div class="section-heading"><div><span class="eyebrow">A PLACE FOR EVERY KIND OF TRAVELLER</span><h2>Find a place to call your own.</h2></div><p>Your dates. Your people. Your perfect escape.</p></div><div class="category-row" role="group" aria-label="Property type"><button type="button" data-type="" class="category">${icon("grid")} <span>All stays</span></button></div>
  <form id="filters" class="filters" aria-label="Filter accommodations"><label>Country<select name="country" aria-label="Country"><option value="">All countries</option>${filters.get("country") ? `<option selected>${e(filters.get("country"))}</option>` : ""}</select></label>${input("Min. nightly price", "minPrice", "number", `min="0" placeholder="Any" value="${e(filters.get("minPrice") || "")}"`)}${input("Max. nightly price", "maxPrice", "number", `min="0" placeholder="Any" value="${e(filters.get("maxPrice") || "")}"`)}<label>Sort by<select name="sort"><option value="newest">Newest stays</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="rating_desc">Top rated</option></select></label><button class="secondary">Apply filters</button><button class="plain" type="button" id="reset">Clear all</button></form><details class="amenity-filters" ${filters.get("amenities") ? "open" : ""}><summary>${icon("compare")} Make room for your must-haves <span id="amenity-count"></span></summary><div class="amenity-options">${(
    filters.get("amenities") || ""
  )
    .split(",")
    .filter(Boolean)
    .map(
      (a) =>
        `<label><input type="checkbox" name="amenity" value="${e(a)}" ${(filters.get("amenities") || "").split(",").includes(a) ? "checked" : ""}>${e(a)}</label>`,
    )
    .join(
      "",
    )}</div></details><div id="active-filters" class="active-filters"></div><div id="search-error"></div><div id="results" aria-live="polite"></div></section><section class="bottom-note"><div><span class="eyebrow">TRADE THE EVERYDAY FOR SOMETHING NEW</span><h2>Great getaways.<br>Even better memories.</h2><p>From a city hideaway to a quiet escape,<br>find a little space for your next adventure.</p><a class="primary" href="#stays">Find your next stay &#8599;</a></div></section><section class="about-travel content-width"><span class="eyebrow">THE WORLD IS WAITING</span><h2>About Airbnb</h2><p>Inspired by the joy of discovering somewhere new. Explore holiday homes, find the little comforts you love, and send a booking request in just a few steps. Whether you are chasing city lights or a quieter pace, your next chapter starts with a place to stay.</p><a class="text-link" href="#/booking">Already planning a trip? Find your booking &#8599;</a><p><a class="primary" href="#/host">Have a place to share? List your space</a></p></section></div>`;
  document.querySelector("#discover").onclick = (event) => {
    event.preventDefault();
    document.querySelector("#stays").scrollIntoView({ behavior: "smooth" });
  };
  document.querySelector(".bottom-note a").onclick =
    document.querySelector("#discover").onclick;
  document.querySelector('[name="sort"]').value =
    filters.get("sort") || "newest";
  let propertyType = filters.get("propertyType") || "";
  const update = () => {
    const values = {
      ...Object.fromEntries(new FormData(document.querySelector("#search"))),
      ...Object.fromEntries(new FormData(document.querySelector("#filters"))),
      propertyType,
      amenities: [...document.querySelectorAll('[name="amenity"]:checked')]
        .map((el) => el.value)
        .join(","),
    };
    const message =
      values.checkIn || values.checkOut
        ? dateError(values.checkIn, values.checkOut)
        : "";
    const error =
      message ||
      (values.minPrice &&
      values.maxPrice &&
      Number(values.minPrice) > Number(values.maxPrice)
        ? "Minimum price cannot exceed maximum price."
        : "");
    document.querySelector("#search-error").innerHTML = error
      ? notice(error)
      : "";
    if (error) return;
    const query = new URLSearchParams(
      Object.entries(values).filter(([, v]) => v !== ""),
    ).toString();
    history.replaceState(null, "", `#/?${query}`);
    try {
      sessionStorage.setItem("stay-results", location.hash);
    } catch {}
    loadResults(values, 1);
    document
      .querySelector("#stays")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  };
  for (const form of document.querySelectorAll("#search, #filters"))
    form.onsubmit = (event) => {
      event.preventDefault();
      update();
    };
  document.querySelector('#search [name="location"]').oninput = () => {
    document.querySelector('#search [name="city"]').value = "";
  };
  document.querySelector('[name="country"]').onchange = () => {
    document.querySelector('#search [name="city"]').value = "";
    update();
  };
  disposeDiscovery = mountDiscovery({
    api,
    root: document.querySelector("#discovery-page"),
    filters,
    onSearch: update,
    onType: (value) => {
      propertyType = value;
      update();
    },
    onDestination: (destination) => {
      document.querySelector('#search [name="location"]').value =
        destination.city;
      document.querySelector('#search [name="city"]').value = destination.city;
      document.querySelector('[name="country"]').value = destination.country;
      update();
    },
  });
  document.querySelector("#reset").onclick = () => {
    history.replaceState(null, "", "#/");
    home();
  };
  loadResults(Object.fromEntries(filters), Number(filters.get("page")) || 1);
  syncSelections();
}

async function loadResults(filters, page) {
  searchController?.abort();
  searchController = new AbortController();
  const target = document.querySelector("#results");
  target.innerHTML = `<div class="results-heading"><p role="status">Looking for lovely places…</p></div><div class="grid">${Array.from({ length: 8 }, () => '<div class="skeleton"><div></div><p></p><p></p></div>').join("")}</div>`;
  try {
    const { data, meta } = await api.search(
      { ...filters, page, limit: 8 },
      searchController.signal,
    );
    if (!target.isConnected) return;
    target.innerHTML =
      `<div class="results-heading"><p><strong>${meta.total}</strong> ${meta.total === 1 ? "place" : "places"} to make yourself at home</p><span>Thoughtful spaces. Memorable stays.</span></div>` +
      (data.length
        ? `<div class="grid">${data.map(stayCard).join("")}</div><div class="pagination"><button class="secondary" id="prev" ${page <= 1 ? "disabled" : ""}>← Previous</button><span>Page ${meta.page} of ${meta.totalPages}</span><button class="secondary" id="next" ${page >= meta.totalPages ? "disabled" : ""}>Next →</button></div><p class="price-note">Prices are shown as supplied by the property. Currency is not specified by the booking service.</p>`
        : '<div class="empty"><span>⌂</span><h3>No stays found. A fresh start?</h3><p>Try another destination, wider dates, or fewer filters.</p><button class="secondary" id="empty-reset">Clear filters</button></div>');
    syncSelections();
    const chosen = Object.entries(filters).filter(
      ([key, value]) => value && !["page", "limit", "sort"].includes(key),
    );
    const chips = document.querySelector("#active-filters");
    if (chips)
      chips.innerHTML = chosen
        .map(
          ([key, value]) =>
            `<span>${e(key === "propertyType" ? value : key === "guests" ? value + " guests" : key === "amenities" ? value.replaceAll(",", " + ") : key === "minPrice" ? "From " + value : key === "maxPrice" ? "Up to " + value : value)}</span>`,
        )
        .join("");
    const count = document.querySelector("#amenity-count");
    if (count)
      count.textContent = filters.amenities
        ? `(${filters.amenities.split(",").length})`
        : "";
    const go = (p) => {
      const params = new URLSearchParams(location.hash.split("?")[1]);
      params.set("page", p);
      history.replaceState(null, "", `#/?${params}`);
      loadResults(filters, p);
      document.querySelector("#stays").scrollIntoView();
    };
    document
      .querySelector("#prev")
      ?.addEventListener("click", () => go(page - 1));
    document
      .querySelector("#next")
      ?.addEventListener("click", () => go(page + 1));
    document
      .querySelector("#empty-reset")
      ?.addEventListener("click", () =>
        document.querySelector("#reset").click(),
      );
  } catch (error) {
    if (error.name === "AbortError" || !target.isConnected) return;
    showError(error, target);
    const b = document.createElement("button");
    b.className = "secondary";
    b.textContent = "Try again";
    b.onclick = () => loadResults(filters, page);
    target.append(b);
  }
}

async function listing(id, version) {
  const { data: l } = await api.listing(id);
  if (version !== routeVersion) return;
  let savedSearch = "";
  try {
    savedSearch = sessionStorage.getItem("stay-search") || "";
  } catch {}
  const params = new URLSearchParams(savedSearch);
  let backToResults = "#/";
  try {
    const previous = sessionStorage.getItem("stay-results");
    if (previous?.startsWith("#/")) backToResults = previous;
  } catch {}
  main.innerHTML = `<section class="detail"><a class="text-link" href="${e(backToResults)}">← Back to all stays</a><div class="detail-toolbar"><span>${icon("pin")} YOUR NEXT CHANGE OF SCENERY</span><div>${selectionButton("saved", l)}${selectionButton("compare", l)}<button class="selection-button" id="share-stay" type="button">${icon("arrow")} Share stay</button></div></div><div class="detail-heading"><span class="eyebrow">YOUR NEXT CHANGE OF SCENERY</span><h1>${e(l.title)}</h1><p>★ ${e(l.rating)} · ${e(l.location)}, ${e(l.city)}, ${e(l.country)}</p></div><div class="gallery" aria-label="Property photos">${(l
    .imageUrls?.length
    ? l.imageUrls
    : [""]
  )
    .slice(0, 6)
    .map(
      (url, i) =>
        `<button type="button" class="gallery-photo" data-photo="${i}" aria-label="Open property photo ${i + 1}">${img(url, l.title)}<span>${icon("search")} View photo</span></button>`,
    )
    .join(
      "",
    )}</div><div class="detail-layout"><div><span class="eyebrow">MAKE YOURSELF AT HOME</span><h2>${e(l.propertyType)} in ${e(l.city)}</h2><p class="facts">${e(l.maxGuests)} guests <span>·</span> ${e(l.bedrooms)} bedrooms <span>·</span> ${e(l.bathrooms)} bathrooms</p><hr><h3>A little about this place</h3><p class="description">${e(l.description)}</p><hr><h3>The little comforts</h3><ul class="amenities">${(l.amenities || []).map((a) => `<li>✓ ${e(a)}</li>`).join("")}</ul><hr><h3>Plan your dates</h3><p>Stays can be up to 30 nights. A previous guest’s check-out day is available for a new check-in.</p><div id="booking-calendar" class="booking-calendar"></div><div id="booked-ranges" aria-live="polite">Loading reserved dates…</div></div><aside class="booking-panel"><div class="panel-price"><strong>${price(l.pricePerNight)}</strong> / night</div><p class="panel-subtitle">A little room for your next adventure.</p><div class="booking-steps"><span class="current">1 Dates</span><span>2 Your details</span><span>3 Request</span></div><form id="reserve"> <div class="two-col">${dateInputs(params.get("checkIn") || "", params.get("checkOut") || "")}</div>${input("Guests", "numberOfGuests", "number", `value="${Math.max(1, Math.min(l.maxGuests, Number(params.get("guests")) || 1))}" min="1" max="${l.maxGuests}" required`)}<button class="secondary full" type="button" id="check">Check availability</button><div id="availability" aria-live="polite"></div><hr>${input("Full name", "guestName", "text", 'autocomplete="name" minlength="2" maxlength="100" required placeholder="Your full name"')}${input("Email address", "guestEmail", "email", 'autocomplete="email" maxlength="254" required placeholder="you@example.com"')}<div id="estimate" class="estimate"></div><div id="booking-error" tabindex="-1"></div><button class="primary full" id="reserve-button">Request to book ↗</button><p class="small">No payment is collected. Your request is saved with a Pending status.</p></form></aside></div></section>`;
  syncSelections();
  document.querySelector("#share-stay").onclick = () =>
    copyText(location.href, "Stay link copied.");
  const lightbox = document.createElement("dialog");
  lightbox.className = "photo-lightbox";
  lightbox.innerHTML =
    '<button class="secondary" type="button" aria-label="Close photo">Close &times;</button><div></div>';
  document.querySelector(".detail").append(lightbox);
  lightbox.querySelector("button").onclick = () => lightbox.close();
  document.querySelectorAll("[data-photo]").forEach(
    (button) =>
      (button.onclick = () => {
        lightbox.querySelector("div").innerHTML = img(
          l.imageUrls?.[Number(button.dataset.photo)],
          l.title,
        );
        lightbox.showModal();
      }),
  );
  const loadRanges = () =>
    api
      .ranges(id)
      .then(({ data }) => {
        if (version !== routeVersion) return;
        mountCalendar(
          document.querySelector("#booking-calendar"),
          data.bookedRanges,
          document.querySelector("#reserve"),
        );
        document.querySelector("#booked-ranges").innerHTML = data.bookedRanges
          .length
          ? `<details class="reserved-details"><summary>View ${data.bookedRanges.length} upcoming reservations</summary><ul class="ranges">${data.bookedRanges.map((r) => `<li>${date(r.checkInDate)} &rarr; ${date(r.checkOutDate)} <span>${e(r.bookingStatus)}</span></li>`).join("")}</ul></details>`
          : '<p class="success">No upcoming reservations yet.</p>';
      })
      .catch((error) => {
        if (version === routeVersion) {
          const target = document.querySelector("#booked-ranges");
          showError(error, target);
          const retry = document.createElement("button");
          retry.className = "secondary";
          retry.textContent = "Reload calendar";
          retry.onclick = loadRanges;
          target.append(retry);
        }
      });
  loadRanges();
  const form = document.querySelector("#reserve");
  let checking = false;
  const values = () => Object.fromEntries(new FormData(form));
  form.oninput = () => {
    const v = values();
    document
      .querySelectorAll("#reserve [aria-invalid]")
      .forEach((el) => el.removeAttribute("aria-invalid"));
    document.querySelector("#availability").textContent = "";
    const n = nights(v.checkIn, v.checkOut);
    document.querySelector("#estimate").innerHTML = !dateError(
      v.checkIn,
      v.checkOut,
    )
      ? `<div><span>${price(l.pricePerNight)} &times; ${n} nights</span><strong>${price(Math.round(n * l.pricePerNight * 100) / 100)}</strong></div><div><span>Estimated total</span><strong>${price(Math.round(n * l.pricePerNight * 100) / 100)}</strong></div><small>Final total is calculated by the booking service. No payment is collected.</small>`
      : "<p>Choose dates to see your stay estimate.</p>";
  };
  form.dispatchEvent(new Event("input"));
  document.querySelector("#check").onclick = async () => {
    if (checking) return;
    const v = values();
    const target = document.querySelector("#availability");
    const error = dateError(v.checkIn, v.checkOut);
    if (error) {
      target.innerHTML = notice(error);
      return;
    }
    checking = true;
    const button = document.querySelector("#check");
    button.disabled = true;
    target.textContent = "Checking your dates…";
    try {
      const { data } = await api.availability(id, v.checkIn, v.checkOut);
      const current = values();
      if (current.checkIn !== v.checkIn || current.checkOut !== v.checkOut)
        return;
      target.innerHTML = data.available
        ? '<p class="success">✓ These dates are available.</p>'
        : notice(
            "These dates are already reserved. Please choose another stay.",
          );
    } catch (err) {
      showError(err, target);
    } finally {
      checking = false;
      button.disabled = false;
    }
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const v = values();
    const target = document.querySelector("#booking-error");
    const error = dateError(v.checkIn, v.checkOut);
    if (error) {
      target.innerHTML = notice(error);
      target.focus();
      return;
    }
    const button = document.querySelector("#reserve-button");
    button.disabled = true;
    button.textContent = "Sending your request…";
    target.innerHTML = "";
    try {
      const { data } = await api.book({
        listingId: id,
        guestName: v.guestName.trim(),
        guestEmail: v.guestEmail.trim(),
        numberOfGuests: Number(v.numberOfGuests),
        checkInDate: v.checkIn,
        checkOutDate: v.checkOut,
      });
      if (version === routeVersion) location.hash = `/booking/${data._id}`;
    } catch (err) {
      if (version !== routeVersion) return;
      showError(err, target);
      (err.details || []).forEach((detail) => {
        const field =
          form.elements[
            detail.field === "checkInDate"
              ? "checkIn"
              : detail.field === "checkOutDate"
                ? "checkOut"
                : detail.field
          ];
        if (field) {
          field.setAttribute("aria-invalid", "true");
          field.setAttribute("aria-describedby", "booking-error");
        }
      });
      target.focus();
      if (err.code === "BOOKING_CONFLICT") loadRanges();
    } finally {
      button.disabled = false;
      button.textContent = "Request to book ↗";
    }
  };
}

function lookup() {
  main.innerHTML = `<section class="lookup"><span class="eyebrow">YOUR NEXT CHAPTER</span><h1>A stay to look<br><em>forward to.</em></h1><p>Enter the booking reference from your request to view its details.</p><form id="lookup">${input("Booking reference", "reference", "text", 'required pattern="[a-fA-F0-9]{24}" title="Enter the 24-character booking reference" placeholder="Your 24-character reference"')}<button class="primary full">Find my booking ↗</button></form></section>`;
  document.querySelector("#lookup").onsubmit = (event) => {
    event.preventDefault();
    location.hash = `/booking/${new FormData(event.target).get("reference").trim()}`;
  };
}
async function booking(id, version) {
  const { data: b } = await api.booking(id);
  if (version !== routeVersion) return;
  main.innerHTML = `<section class="confirmation"><div class="confirmation-icon">${b.bookingStatus === "Cancelled" ? "−" : "✓"}</div><span class="eyebrow">${b.bookingStatus === "Cancelled" ? "BOOKING CANCELLED" : "YOUR REQUEST IS SAVED"}</span><h1>${b.bookingStatus === "Cancelled" ? "Until next time." : "A good stay starts here."}</h1><p>${b.bookingStatus === "Pending" ? "Your booking is pending confirmation. No payment has been collected." : b.bookingStatus === "Confirmed" ? "Your booking has been confirmed." : "These dates have been released."}</p><div class="confirmation-card">${img(b.listing?.imageUrls?.[0], b.listing?.title || "Your stay")}<div><span class="status">${e(b.bookingStatus)}</span><h2>${e(b.listing?.title || "Your stay")}</h2><p>${e(b.listing?.city)}, ${e(b.listing?.country)}</p><dl><div><dt>Check-in</dt><dd>${date(b.checkInDate)}</dd></div><div><dt>Check-out</dt><dd>${date(b.checkOutDate)}</dd></div><div><dt>Guests</dt><dd>${e(b.numberOfGuests)}</dd></div><div><dt>Total · ${e(b.numberOfNights)} nights</dt><dd>${price(b.totalPrice)}</dd></div></dl><p>Guest: ${e(b.guestName)} · ${e(b.guestEmail)}</p><label>Save your booking reference<input readonly aria-label="Booking reference" value="${e(b._id)}"></label><p class="small">Save this page’s URL or reference to revisit your booking.</p></div></div><div id="cancel-error"></div><div class="itinerary-tools"><button class="secondary" id="copy-reference" type="button">Copy reference</button><button class="secondary" id="print-booking" type="button">Print itinerary</button>${b.bookingStatus !== "Cancelled" ? '<button class="secondary" id="calendar-download" type="button">Add to calendar</button>' : ""}</div><div class="confirmation-actions"><a class="primary" href="#/">Explore more stays ↗</a>${b.bookingStatus !== "Cancelled" ? '<button class="plain" id="cancel">Cancel this booking</button>' : ""}</div><dialog id="cancel-dialog"><h2>Cancel your stay?</h2><p>Your reserved dates will be released.</p><div class="confirmation-actions"><button class="secondary" id="keep">Keep booking</button><button class="primary" id="confirm-cancel">Yes, cancel booking</button></div></dialog></section>`;
  document.querySelector("#copy-reference").onclick = () =>
    copyText(b._id, "Booking reference copied.");
  document.querySelector("#print-booking").onclick = () => window.print();
  document
    .querySelector("#calendar-download")
    ?.addEventListener("click", () => downloadItinerary(b));
  const dialog = document.querySelector("#cancel-dialog");
  document
    .querySelector("#cancel")
    ?.addEventListener("click", () => dialog.showModal());
  document.querySelector("#keep").onclick = () => dialog.close();
  document.querySelector("#confirm-cancel").onclick = async (event) => {
    event.target.disabled = true;
    try {
      await api.cancel(id);
      dialog.close();
      await booking(id, version);
    } catch (error) {
      dialog.close();
      showError(error, document.querySelector("#cancel-error"));
      event.target.disabled = false;
    }
  };
}

async function route() {
  const previous = document.querySelector("#search");
  if (previous) {
    try {
      sessionStorage.setItem(
        "stay-search",
        new URLSearchParams(new FormData(previous)).toString(),
      );
    } catch {}
  }
  disposeDiscovery?.();
  const version = ++routeVersion;
  document.body.classList.toggle(
    "home-page",
    !location.hash.slice(1).split("?")[0] ||
      location.hash.slice(1).split("?")[0] === "/",
  );
  closeMenu();
  searchController?.abort();
  loading();
  window.scrollTo(0, 0);
  const [path] = location.hash.slice(1).split("?");
  try {
    if (!path || path === "/") {
      home();
      if (pendingSection) {
        document.getElementById(pendingSection)?.scrollIntoView();
        pendingSection = null;
      }
    } else if (path === "/host")
      hostPage(api, main, () => version === routeVersion);
    else if (path === "/saved" || path === "/compare")
      await collectionPage(
        path.slice(1),
        api,
        main,
        () => version === routeVersion,
      );
    else if (path.startsWith("/listing/"))
      await listing(path.split("/")[2], version);
    else if (path.startsWith("/booking/"))
      await booking(path.split("/")[2], version);
    else if (path === "/booking") lookup();
    else
      main.innerHTML =
        '<div class="page-message"><h1>This page wandered off.</h1><a href="#/">Back to all stays</a></div>';
    if (version !== routeVersion) return;
    syncSelections();
    if (path && path !== "/") main.focus({ preventScroll: true });
  } catch (error) {
    if (version === routeVersion) {
      main.innerHTML = `<section class="page-message"><h1>We couldn’t find your stay.</h1>${notice(error.message)}<a class="secondary" href="#/">Back to all stays</a></section>`;
    }
  }
}
function closeMenu() {
  document.querySelector("header").classList.remove("menu-open");
  document.querySelector(".menu-toggle").setAttribute("aria-expanded", "false");
  document
    .querySelector(".menu-toggle")
    .setAttribute("aria-label", "Open navigation");
}
document.querySelector(".menu-toggle").onclick = () => {
  const open = document.querySelector("header").classList.toggle("menu-open");
  document
    .querySelector(".menu-toggle")
    .setAttribute("aria-expanded", String(open));
  document
    .querySelector(".menu-toggle")
    .setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
};
document.querySelector("nav").addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  closeMenu();
  if (link.dataset.section) {
    event.preventDefault();
    const section = document.getElementById(link.dataset.section);
    if (section) section.scrollIntoView({ behavior: "smooth" });
    else {
      pendingSection = link.dataset.section;
      location.hash = "/";
    }
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});
async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    toast(
      "Copy is unavailable here. Select and copy the reference or URL manually.",
    );
  }
}
window.addEventListener("stay-selection-change", (event) => {
  if (
    (location.hash === "#/saved" && event.detail === "saved") ||
    (location.hash === "#/compare" && event.detail === "compare")
  ) {
    const version = routeVersion;
    collectionPage(
      location.hash.slice(2),
      api,
      main,
      () => version === routeVersion,
    );
  }
});
window.addEventListener("hashchange", route);
document.addEventListener(
  "error",
  (event) => {
    if (event.target instanceof HTMLImageElement) {
      if (event.target.dataset.fallback) return;
      event.target.dataset.fallback = "true";
      event.target.classList.add("image-unavailable");
      event.target.alt = "Property photo unavailable";
      event.target.src = "/images/property-placeholder.svg";
    }
  },
  true,
);
bindCollections();
route();
