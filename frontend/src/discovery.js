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
  const countryKeys = new Set();
  const keyFor = (value) => String(value).trim().toLowerCase();
  const types = new Set(),
    amenities = new Set(),
    countries = new Set();
  for (const listing of listings) {
    const key = JSON.stringify([keyFor(listing.city), keyFor(listing.country)]);
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
    if (!countryKeys.has(keyFor(listing.country))) {
      countries.add(listing.country);
      countryKeys.add(keyFor(listing.country));
    }
    for (const amenity of listing.amenities || []) amenities.add(amenity);
  }
  const alphabetical = (values) =>
    [...values].sort((a, b) => a.localeCompare(b));
  const countryNames = new Map(
    [...countries].map((country) => [keyFor(country), country]),
  );
  return {
    locations: listings.map((listing) => ({
      city: listing.city,
      country: countryNames.get(keyFor(listing.country)),
      location: listing.location || "",
      state: listing.state || "",
    })),
    destinations: [...destinations.values()]
      .map((destination) => ({
        ...destination,
        country: countryNames.get(keyFor(destination.country)),
      }))
      .sort(
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

export function resolveDestination(text, facets, preferredCountry = "") {
  const normalize = (value) =>
    String(value || "")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  const query = normalize(text);
  if (!query || !facets) return null;
  const country = facets.countries.find((value) => normalize(value) === query);
  if (country) return { city: "", country, location: country };
  let matches = facets.destinations.filter(
    (d) =>
      normalize(d.city) === query ||
      normalize(`${d.city}, ${d.country}`) === query,
  );
  if (matches.length > 1 && preferredCountry)
    matches = matches.filter(
      (d) => normalize(d.country) === normalize(preferredCountry),
    );
  if (matches.length === 1)
    return {
      city: matches[0].city,
      country: matches[0].country,
      location: matches[0].city,
    };
  if (matches.length > 1) return { ambiguous: true };
  const areaCountries = [
    ...new Set(
      (facets.locations || [])
        .filter((d) =>
          [d.location, d.state].some((value) => normalize(value) === query),
        )
        .map((d) => d.country),
    ),
  ];
  return areaCountries.length === 1
    ? { city: "", country: areaCountries[0], location: text.trim() }
    : null;
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
    facets,
    inventory = [];
  let pending;
  function updatePriceGuidance() {
    const hint = root.querySelector("#price-guidance");
    if (!hint || !facets) return;
    const text = root.querySelector('#search [name="location"]').value.trim();
    const country = root.querySelector('[name="country"]').value;
    const destination = resolveDestination(text, facets, country);
    const query = (
      destination && !destination.ambiguous ? destination.location : text
    ).toLowerCase();
    const city = root.querySelector('#search [name="city"]').value;
    const prices = inventory
      .filter(
        (listing) =>
          (!country ||
            listing.country.toLowerCase() === country.toLowerCase()) &&
          (!city || listing.city.toLowerCase() === city.toLowerCase()) &&
          (!query ||
            [
              listing.city,
              listing.country,
              listing.state,
              listing.location,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(query),
            )),
      )
      .map((listing) => Number(listing.pricePerNight))
      .filter(Number.isFinite);
    if (!prices.length) {
      hint.textContent =
        "No listings for this destination. Try another city or country.";
      return;
    }
    const min = Math.min(...prices),
      max = Math.max(...prices);
    const minimum = root.querySelector('[name="minPrice"]').value;
    const maximum = root.querySelector('[name="maxPrice"]').value;
    hint.textContent = `Listed nightly rates for this destination: ${min.toLocaleString()}–${max.toLocaleString()} (before dates and other filters). Prices use the listing’s units; no currency conversion is applied.`;
    if (
      (minimum !== "" && Number(minimum) > max) ||
      (maximum !== "" && Number(maximum) < min)
    )
      hint.textContent +=
        " Your price limits exclude every listed stay here. Adjust them or remove price limits.";
  }
  root.addEventListener("input", updatePriceGuidance, {
    signal: controller.signal,
  });
  root.addEventListener("change", updatePriceGuidance, {
    signal: controller.signal,
  });
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
      inventory = listings;
      facets = inventoryFacets(listings);
      drawDestinations();
      root.querySelector("#destination-suggestions").innerHTML =
        facets.destinations
          .map(
            (d) =>
              `<option value="${e(`${d.city}, ${d.country}`)}">${d.count} stays</option>`,
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
      updatePriceGuidance();
    } catch (error) {
      if (error.name !== "AbortError" && root.isConnected)
        root.querySelector("#inventory-summary").textContent =
          `${error.message} Use Refresh places to retry.`;
    } finally {
      if (root.isConnected) button.disabled = false;
    }
  }
  root.querySelector("#refresh-inventory").onclick = () => {
    pending = refresh();
    onSearch();
  };
  pending = refresh();
  const dispose = () => controller.abort();
  dispose.resolveLocation = async (text, country) => {
    await pending;
    return resolveDestination(text, facets, country);
  };
  return dispose;
}
