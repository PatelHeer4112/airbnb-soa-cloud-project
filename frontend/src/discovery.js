import { escapeHtml as e, imageUrl } from "./validation.js";
import { icon } from "./icons.js";
import { photoAttributes } from "./photos.js";

export async function fetchInventory(api, signal) {
  const first = await api.listings(1, 50, signal);
  const pages = Number(first.meta?.totalPages) || 1;
  const listings = [...first.data];
  for (let page = 2; page <= pages; page++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const next = await api.listings(page, 50, signal);
    listings.push(...next.data);
  }
  return [
    ...new Map(listings.map((listing) => [listing._id, listing])).values(),
  ];
}

export function inventoryFacets(listings) {
  const destinations = new Map();
  const types = new Set(),
    amenities = new Set(),
    countries = new Set();
  for (const listing of listings) {
    const key = JSON.stringify([listing.city, listing.country]);
    const existing = destinations.get(key);
    if (existing) {
      existing.count++;
      existing.minPrice = Math.min(existing.minPrice, listing.pricePerNight);
    } else
      destinations.set(key, {
        city: listing.city,
        country: listing.country,
        count: 1,
        minPrice: listing.pricePerNight,
        image: listing.imageUrls?.[0],
      });
    types.add(listing.propertyType);
    countries.add(listing.country);
    for (const amenity of listing.amenities || []) amenities.add(amenity);
  }
  const alphabetical = (values) =>
    [...values].sort((a, b) => a.localeCompare(b));
  return {
    destinations: [...destinations.values()].sort(
      (a, b) =>
        b.count - a.count ||
        a.city.localeCompare(b.city) ||
        a.country.localeCompare(b.country),
    ),
    types: alphabetical(types),
    amenities: alphabetical(amenities),
    countries: alphabetical(countries),
  };
}

export function mountDiscovery({
  api,
  root,
  onSearch,
  onType,
  onDestination,
  filters,
}) {
  const controller = new AbortController();
  const selectedAmenities = new Set(
    (filters.get("amenities") || "").split(",").filter(Boolean),
  );
  let expanded = false,
    facets;
  const grid = root.querySelector("#destination-inventory");
  const options = root.querySelector(".amenity-options");
  function drawDestinations() {
    const places = expanded
      ? facets.destinations
      : facets.destinations.slice(0, 6);
    grid.innerHTML = places
      .map(
        (d, index) =>
          `<button class="destination-card" type="button" data-destination-index="${index}" aria-label="Explore ${e(d.city)}, ${e(d.country)}"><img src="${e(imageUrl(d.image) || "/images/property-placeholder.svg")}" alt="" ${photoAttributes(d.image, "(max-width: 760px) 90vw, 33vw")} loading="lazy"><span class="destination-overlay"><small>${e(d.country)}</small><strong>${e(d.city)}</strong><span>${d.count} ${d.count === 1 ? "stay" : "stays"} &middot; from ${Number(d.minPrice).toLocaleString()} / night</span></span><span class="destination-arrow" aria-hidden="true">&#8599;</span></button>`,
      )
      .join("");
    root.querySelector("#more-destinations").hidden =
      facets.destinations.length <= 6;
    root.querySelector("#more-destinations").textContent = expanded
      ? "Show fewer destinations"
      : `Explore all ${facets.destinations.length} destinations`;
    root.querySelector("#inventory-summary").textContent =
      `${facets.destinations.length} destinations available in the current inventory. Refresh to see new stays.`;
    if (!places.length)
      grid.innerHTML =
        '<div class="empty"><h3>Your next destination starts here.</h3><p>No stays have been listed yet.</p><a class="primary" href="#/host">List the first stay</a></div>';
  }
  grid.onclick = (event) => {
    const button = event.target.closest("[data-destination-index]");
    if (button)
      onDestination(
        facets.destinations[Number(button.dataset.destinationIndex)],
      );
  };
  root.querySelector("#more-destinations").onclick = () => {
    expanded = !expanded;
    drawDestinations();
  };
  options.onchange = () => {
    selectedAmenities.clear();
    root
      .querySelectorAll('[name="amenity"]:checked')
      .forEach((el) => selectedAmenities.add(el.value));
    onSearch();
  };
  root.querySelector(".category-row").onclick = (event) => {
    const button = event.target.closest("[data-type]");
    if (!button) return;
    root.querySelectorAll("[data-type]").forEach((el) => {
      el.classList.toggle("active", el === button);
      el.setAttribute("aria-pressed", String(el === button));
    });
    onType(button.dataset.type);
  };
  async function refresh() {
    const button = root.querySelector("#refresh-inventory");
    button.disabled = true;
    root.querySelector("#inventory-summary").textContent =
      "Loading destinations and filters from the listing API...";
    try {
      const listings = await fetchInventory(api, controller.signal);
      if (!root.isConnected) return;
      facets = inventoryFacets(listings);
      drawDestinations();
      root.querySelector("#destination-suggestions").innerHTML =
        facets.destinations
          .map(
            (d) =>
              `<option value="${e(d.city)}">${e(d.country)} &middot; ${d.count} stays</option>`,
          )
          .join("");
      const selectedType =
        root.querySelector('[data-type][aria-pressed="true"]')?.dataset.type ||
        filters.get("propertyType") ||
        "";
      root.querySelector(".category-row").innerHTML = [
        "",
        ...new Set([...facets.types, ...(selectedType ? [selectedType] : [])]),
      ]
        .map(
          (type) =>
            `<button type="button" class="category ${type === selectedType ? "active" : ""}" data-type="${e(type)}" aria-pressed="${type === selectedType}">${icon(type ? "home" : "grid")}<span>${e(type || "All stays")}</span></button>`,
        )
        .join("");
      options.innerHTML =
        [...new Set([...facets.amenities, ...selectedAmenities])]
          .map(
            (a) =>
              `<label><input type="checkbox" name="amenity" value="${e(a)}" ${selectedAmenities.has(a) ? "checked" : ""}>${e(a)}</label>`,
          )
          .join("") || "<p>No amenities listed yet.</p>";
      const country = root.querySelector('[name="country"]');
      const currentCountry = country.value;
      country.innerHTML =
        '<option value="">All countries</option>' +
        [
          ...new Set([
            ...facets.countries,
            ...(currentCountry ? [currentCountry] : []),
          ]),
        ]
          .map((c) => `<option value="${e(c)}">${e(c)}</option>`)
          .join("");
      country.value = currentCountry;
    } catch (error) {
      if (error.name !== "AbortError" && root.isConnected)
        root.querySelector("#inventory-summary").textContent =
          `${error.message} Use Refresh places to retry.`;
    } finally {
      if (root.isConnected) button.disabled = false;
    }
  }
  root.querySelector("#refresh-inventory").onclick = () => {
    refresh();
    onSearch();
  };
  refresh();
  return () => controller.abort();
}
