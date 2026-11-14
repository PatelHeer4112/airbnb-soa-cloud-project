import { preferences } from "./preferences.js";
import { escapeHtml as e, imageUrl } from "./validation.js";
import { icon } from "./icons.js";
import { photoAttributes } from "./photos.js";

const price = (value) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
export const selectionButton = (key, listing, cls = "") =>
  `<button type="button" class="selection-button ${cls}" data-selection="${key}" data-id="${e(listing._id)}" data-title="${e(listing.title)}" aria-label="${key === "saved" ? "Save" : "Compare"} ${e(listing.title)}" aria-pressed="${preferences.has(key, listing._id)}">${icon(key === "saved" ? "heart" : "compare")}<span>${key === "saved" ? "Save" : "Compare"}</span></button>`;

export function stayCard(listing) {
  const l = listing;
  return `<article class="stay-card"><div class="card-visual"><a href="#/listing/${e(l._id)}" tabindex="-1" aria-hidden="true"><div class="card-image"><img src="${e(imageUrl(l.imageUrls?.[0]) || "/images/property-placeholder.svg")}" ${photoAttributes(l.imageUrls?.[0])} alt="" loading="lazy" referrerpolicy="no-referrer"><span class="type-pill">${e(l.propertyType)}</span></div></a>${selectionButton("saved", l, "card-save")}</div><a class="card-content" href="#/listing/${e(l._id)}"><div class="card-location"><strong>${e(l.city)}, ${e(l.country)}</strong><span>${icon("star")} ${e(l.rating)}</span></div><h3>${e(l.title)}</h3><p>${e(l.maxGuests)} guests &middot; ${e(l.bedrooms)} bedrooms &middot; ${e(l.bathrooms)} baths</p><div class="card-price"><strong>${price(l.pricePerNight)}</strong><span> / night</span><span class="card-arrow">${icon("arrow")}</span></div></a><div class="card-bottom">${selectionButton("compare", l)}<span>View stay ${icon("arrow")}</span></div></article>`;
}

export function toast(message) {
  const target = document.querySelector("#toast");
  target.textContent = message;
  target.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => target.classList.remove("visible"), 4000);
}

export function syncSelections() {
  document
    .querySelectorAll("[data-selection]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(preferences.has(button.dataset.selection, button.dataset.id)),
      ),
    );
  document
    .querySelectorAll("[data-saved-count]")
    .forEach(
      (el) => (el.textContent = String(preferences.ids("saved").length)),
    );
  const count = preferences.ids("compare").length;
  const rail = document.querySelector("#compare-rail");
  rail.hidden = count === 0 || location.hash.startsWith("#/compare");
  rail.innerHTML = `<span>${icon("compare")}<strong>${count} of 3 stays</strong><span>Find your best fit.</span></span><a class="primary" href="#/compare">Compare stays ${icon("arrow")}</a>`;
}

export function bindCollections() {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div id="toast" class="toast" role="status" aria-live="polite"></div><aside id="compare-rail" class="compare-rail" aria-label="Stay comparison" hidden></aside><div id="offline-notice" class="offline-notice" role="status" hidden>You are offline. Reconnect to search or manage a booking.</div>',
  );
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-selection]");
    if (!button) return;
    try {
      const active = preferences.toggle(
        button.dataset.selection,
        button.dataset.id,
      );
      syncSelections();
      toast(
        `${active ? "Added to" : "Removed from"} ${button.dataset.selection === "saved" ? "saved stays" : "comparison"}.`,
      );
      window.dispatchEvent(
        new CustomEvent("stay-selection-change", {
          detail: button.dataset.selection,
        }),
      );
    } catch (error) {
      toast(error.message);
    }
  });
  const online = () => {
    document.querySelector("#offline-notice").hidden = navigator.onLine;
  };
  window.addEventListener("online", online);
  window.addEventListener("offline", online);
  online();
  syncSelections();
}

export async function collectionPage(kind, api, main, isCurrent) {
  const compare = kind === "compare";
  const ids = preferences.ids(compare ? "compare" : "saved");
  main.innerHTML = `<section class="personal-collection content-width"><a class="text-link" href="#/">&larr; Back to exploring</a><div class="personal-heading"><span class="eyebrow">${compare ? "A LITTLE CLARITY FOR YOUR NEXT CHAPTER" : "YOUR PLACES, ALL IN ONE PLACE"}</span><h1>${compare ? "Find your perfect fit." : "A collection of possibilities."}</h1><p>${compare ? "Compare up to three stays, side by side. The small details make all the difference." : "The stays you love, ready when you are. Saved on this browser, without an account."}</p></div><div id="collection-content" aria-live="polite"><p>Loading your stays&hellip;</p></div></section>`;
  const target = document.querySelector("#collection-content");
  if (!ids.length) {
    target.innerHTML = `<div class="empty collection-empty">${icon(compare ? "compare" : "heart")}<h2>${compare ? "A great stay deserves a little consideration." : "Your next favourite is out there."}</h2><p>${compare ? "Select Compare on a listing card to build your shortlist." : "Tap the heart on a stay to keep it in your collection."}</p><a href="#/" class="primary">Explore stays ${icon("arrow")}</a></div>`;
    syncSelections();
    return;
  }
  const results = await Promise.allSettled(ids.map((id) => api.listing(id)));
  if (!isCurrent() || !target.isConnected) return;
  const listings = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value.data);
  const failed = results.filter((r) => r.status === "rejected");
  const warning = failed.length
    ? `<div class="notice" role="alert">${failed.length} ${failed.length === 1 ? "stay could" : "stays could"} not be loaded. Your selections are kept. <button type="button" class="plain" id="retry-collection">Try again</button></div>`
    : "";
  if (!compare)
    target.innerHTML =
      warning + `<div class="grid">${listings.map(stayCard).join("")}</div>`;
  else {
    const row = (title, render) =>
      `<tr><th scope="row">${title}</th>${listings.map((l) => `<td>${render(l)}</td>`).join("")}</tr>`;
    target.innerHTML =
      warning +
      (listings.length
        ? `<div class="comparison-scroll" tabindex="0" role="region" aria-label="Stay comparison table"><table class="comparison-table"><caption>Compare selected accommodations</caption><thead><tr><th scope="col">The details</th>${listings.map((l) => `<th scope="col"><img src="${e(imageUrl(l.imageUrls?.[0]) || "/images/property-placeholder.svg")}" alt="" loading="lazy"><a href="#/listing/${e(l._id)}">${e(l.title)}</a>${selectionButton("compare", l)}</th>`).join("")}</tr></thead><tbody>${row("Location", (l) => `${e(l.city)}, ${e(l.country)}`)}${row("Per night", (l) => `<strong class="compare-price">${price(l.pricePerNight)}</strong>`)}${row("Property", (l) => e(l.propertyType))}${row("Guests", (l) => e(l.maxGuests))}${row("Bedrooms / baths", (l) => `${e(l.bedrooms)} / ${e(l.bathrooms)}`)}${row("Rating", (l) => `${icon("star")} ${e(l.rating)} / 5`)}${row("Amenities", (l) => `<div class="compare-amenities">${l.amenities.map((a) => `<span>${e(a)}</span>`).join("")}</div>`)}${row("Your next step", (l) => `<a class="primary" href="#/listing/${e(l._id)}">View stay ${icon("arrow")}</a>`)}</tbody></table></div><p class="price-note">Nightly rates are supplied by each property. The API does not specify currency.</p>`
        : "");
  }
  document
    .querySelector("#retry-collection")
    ?.addEventListener("click", () =>
      collectionPage(kind, api, main, isCurrent),
    );
  syncSelections();
}
