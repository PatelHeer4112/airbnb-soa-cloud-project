import { test, expect } from "./fixtures.js";
const id = "a".repeat(24);
const listing = {
  _id: id,
  title: "Sample Shoreditch Loft",
  city: "London",
  country: "United Kingdom",
  location: "Shoreditch",
  propertyType: "Loft",
  description: "A bright loft for a city getaway.",
  pricePerNight: 145,
  maxGuests: 2,
  bedrooms: 1,
  bathrooms: 1,
  rating: 4.7,
  amenities: ["Wi-Fi"],
  imageUrls: [
    "https://picsum.photos/seed/shoreditch-loft-1/800/600",
    "https://picsum.photos/seed/shoreditch-loft-2/800/600",
  ],
};
test("bundled HD photos render on cards, destination tiles, details and enlargement", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (["/api/listings", "/api/search"].includes(url.pathname))
      return route.fulfill({
        json: {
          success: true,
          data: [listing],
          meta: { page: 1, total: 1, totalPages: 1 },
        },
      });
    if (url.pathname.endsWith("/bookings"))
      return route.fulfill({
        json: { success: true, data: { bookedRanges: [] } },
      });
    return route.fulfill({ json: { success: true, data: listing } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const card = page.locator(".stay-card img");
  await expect(card).toHaveAttribute("src", "/images/stays/loft-1920.webp");
  await expect(card).toHaveAttribute("srcset", /640w/);
  await expect(page.locator(".destination-card img")).toHaveAttribute(
    "src",
    "/images/stays/loft-1920.webp",
  );
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: listing.title }) })
    .click();
  await expect(
    page.getByText("Illustrative sample photography.", { exact: false }),
  ).toBeVisible();
  const photo = page.locator(".gallery-photo img").first();
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await page
    .getByRole("button", { name: "Open property photo 1", exact: true })
    .click();
  const full = page.getByRole("dialog").getByRole("img");
  await expect(full).toHaveAttribute("src", "/images/stays/loft-1920.webp");
  await expect
    .poll(() => full.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: "test-results/hd-listing-gallery.png",
    fullPage: true,
  });
});
