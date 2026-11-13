import { escapeHtml as e } from "./validation.js";
const types = [
  "Apartment",
  "House",
  "Villa",
  "Cabin",
  "Cottage",
  "Studio",
  "Loft",
  "Guesthouse",
];
const field = (label, name, extra = "") =>
  `<label>${label}<input name="${name}" ${extra} required></label>`;
export function hostPage(api, main, isCurrent) {
  main.innerHTML = `<section class="host-page content-width"><a class="text-link" href="#/">&larr; Back to exploring</a><div class="personal-heading"><span class="eyebrow">MAKE ROOM FOR SOMETHING NEW</span><h1>Share your space.</h1><p>Create a real listing through the backend API. Once published, it becomes discoverable by destination, dates, guests and amenities.</p></div><div class="host-layout"><form id="host-form"><fieldset><legend>1. The place</legend>${field("Listing title", "title", 'maxlength="120" placeholder="A bright apartment near the old town"')}<label>Description<textarea name="description" maxlength="2000" minlength="10" required rows="5"></textarea></label><label>Property type<select name="propertyType">${types.map((t) => `<option>${t}</option>`).join("")}</select></label></fieldset><fieldset><legend>2. The location</legend><div class="two-col">${field("City", "city", 'maxlength="80"')}${field("Country", "country", 'maxlength="80"')}</div>${field("Neighbourhood / area", "location", 'maxlength="120"')}<label>State / region (optional)<input name="state" maxlength="80"></label></fieldset><fieldset><legend>3. Comforts and nightly rate</legend><div class="two-col">${field("Price per night", "pricePerNight", 'type="number" min="1" step="0.01"')}${field("Maximum guests", "maxGuests", 'type="number" min="1" max="20" value="2"')}${field("Bedrooms", "bedrooms", 'type="number" min="0" max="50" value="1"')}${field("Bathrooms", "bathrooms", 'type="number" min="0" max="50" step="0.5" value="1"')}</div><label>Amenities (comma separated)<input name="amenities" maxlength="1000" placeholder="Wi-Fi, Kitchen, Garden"></label><label>Photo URLs (optional, one HTTPS URL per line)<textarea name="photos" maxlength="4000" rows="3" placeholder="https://example.com/property.jpg"></textarea></label><p class="small">Use photos you have permission to publish. A neutral placeholder is shown when no photo is supplied. Currency is not specified by the backend.</p></fieldset><label class="host-consent"><input name="permission" type="checkbox" required>I have permission to list this property and publish these details.</label><div id="host-error" tabindex="-1"></div><button class="primary full" id="publish-stay">Publish stay</button></form><aside class="host-guidance"><span class="eyebrow">FROM YOUR SPACE TO THEIR NEXT STAY</span><h2>Good details make great first impressions.</h2><p>Use a clear title, an accurate location, and amenities guests can rely on.</p><ol><li>Describe the actual space.</li><li>Set a nightly rate and guest capacity.</li><li>Publish and view your live listing.</li></ol><p>This student project has no account authentication or host verification. Use sample listings for demonstrations; publishing does not mean a property has been verified.</p></aside></div></section>`;
  const form = main.querySelector("#host-form");
  form.onsubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const target = main.querySelector("#host-error"),
      button = main.querySelector("#publish-stay");
    target.innerHTML = "";
    const photos = values.photos
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      for (const photo of photos)
        if (new URL(photo).protocol !== "https:") throw Error();
    } catch {
      target.innerHTML =
        '<div class="notice" role="alert">Use complete HTTPS photo URLs, one per line, or leave photos empty.</div>';
      target.focus();
      return;
    }
    const payload = Object.fromEntries(
      [
        "title",
        "description",
        "city",
        "country",
        "location",
        "state",
        "propertyType",
      ].map((key) => [key, values[key].trim()]),
    );
    for (const key of ["pricePerNight", "maxGuests", "bedrooms", "bathrooms"])
      payload[key] = Number(values[key]);
    payload.amenities = [
      ...new Set(
        values.amenities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    payload.imageUrls = photos;
    button.disabled = true;
    button.textContent = "Publishing your stay...";
    try {
      const { data } = await api.createListing(payload);
      if (isCurrent()) location.hash = `/listing/${data._id}`;
    } catch (error) {
      if (isCurrent()) {
        target.innerHTML = `<div class="notice" role="alert">${e(error.message)}</div>${error.details?.length ? `<ul>${error.details.map((d) => `<li>${e(d.message)}</li>`).join("")}</ul>` : ""}`;
        target.focus();
      }
    } finally {
      button.disabled = false;
      button.textContent = "Publish stay";
    }
  };
}
