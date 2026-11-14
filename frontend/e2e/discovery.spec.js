import { test, expect } from "./fixtures.js";
import AxeBuilder from "@axe-core/playwright";
const base = {
  _id: "a".repeat(24),
  title: "A test stay",
  description: "A place for a memorable getaway.",
  city: "London",
  country: "United Kingdom",
  location: "Central",
  propertyType: "Apartment",
  pricePerNight: 120,
  maxGuests: 2,
  bedrooms: 1,
  bathrooms: 1,
  rating: 4.6,
  amenities: ["Wi-Fi"],
  imageUrls: [],
};

test("discovery fetches subsequent inventory pages instead of limiting places to its first page", async ({
  page,
}) => {
  const data = Array.from({ length: 51 }, (_, i) => ({
    ...base,
    _id: i.toString(16).padStart(24, "0"),
    city: i === 50 ? "Beyond page fifty" : `City ${i}`,
    amenities: i === 50 ? ["Sauna"] : ["Wi-Fi"],
  }));
  const pages = [];
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const current = Number(url.searchParams.get("page") || 1);
    if (url.pathname === "/api/listings") {
      pages.push(current);
      return route.fulfill({
        json: {
          success: true,
          data: data.slice((current - 1) * 50, current * 50),
          meta: { page: current, total: 51, totalPages: 2 },
        },
      });
    }
    return route.fulfill({
      json: {
        success: true,
        data: data.slice(0, 8),
        meta: { page: 1, total: 51, totalPages: 7 },
      },
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#inventory-summary")).toContainText(
    "51 destinations",
  );
  await page
    .getByRole("button", { name: "Explore all 51 destinations" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Explore Beyond page fifty, United Kingdom",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText("Make room for your must-haves").click();
  await expect(
    page.getByRole("checkbox", { name: "Sauna", exact: true }),
  ).toBeVisible();
  expect(pages).toEqual([1, 2]);
});

test("publishing in a new city makes the stay discoverable and searchable without changing code", async ({
  page,
}) => {
  const inventory = [base];
  const createdId = "b".repeat(24);
  let posted;
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() === "POST") {
      posted = request.postDataJSON();
      const created = { ...posted, _id: createdId, rating: 0 };
      inventory.push(created);
      return route.fulfill({
        status: 201,
        json: { success: true, data: created },
      });
    }
    if (url.pathname === "/api/listings" || url.pathname === "/api/search") {
      const location = url.searchParams.get("location");
      const data = location
        ? inventory.filter((l) => l.city === location)
        : inventory;
      return route.fulfill({
        json: {
          success: true,
          data,
          meta: { total: data.length, totalPages: 1, page: 1 },
        },
      });
    }
    if (url.pathname.endsWith("/bookings"))
      return route.fulfill({
        json: { success: true, data: { bookedRanges: [] } },
      });
    return route.fulfill({
      json: {
        success: true,
        data: inventory.find((l) => l._id === url.pathname.split("/").pop()),
      },
    });
  });
  await page.goto("/#/host", { waitUntil: "domcontentloaded" });
  await page
    .getByLabel("Listing title", { exact: true })
    .fill("Kyoto garden retreat");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A peaceful garden retreat near the old town.");
  await page.getByLabel("City", { exact: true }).fill("Kyoto");
  await page.getByLabel("Country", { exact: true }).fill("Japan");
  await page.getByLabel("Neighbourhood / area").fill("Gion");
  await page.getByLabel("Price per night").fill("95");
  await page.getByLabel("Amenities (comma separated)").fill("Wi-Fi, Sauna");
  await page.getByRole("checkbox").check();
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.getByRole("button", { name: "Publish stay", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Kyoto garden retreat",
  );
  expect(posted.pricePerNight).toBe(95);
  expect(posted.maxGuests).toBe(2);
  expect(posted.amenities).toEqual(["Wi-Fi", "Sauna"]);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Explore Kyoto, Japan", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore Kyoto, Japan", exact: true })
    .click();
  await expect(page).toHaveURL(/city=Kyoto/);
  await expect(page).toHaveURL(/country=Japan/);
  await expect(
    page.getByRole("heading", { name: "Kyoto garden retreat", exact: true }),
  ).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Country", { exact: true })).toHaveValue(
    "Japan",
  );
});
