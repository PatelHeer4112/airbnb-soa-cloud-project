import { test, expect } from "./fixtures.js";
const id = "a".repeat(24),
  second = "b".repeat(24);
const london = {
  _id: id,
  title: "London regression stay",
  city: "London",
  country: "United Kingdom",
  location: "Central",
  propertyType: "Apartment",
  pricePerNight: 120,
  maxGuests: 2,
  bedrooms: 1,
  bathrooms: 1,
  rating: 4.7,
  amenities: ["Wi-Fi"],
  imageUrls: [],
};
const paris = {
  ...london,
  _id: second,
  title: "Paris regression stay",
  city: "Paris",
  country: "France",
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    let data;
    if (url.pathname === "/api/listings") data = [london, paris];
    else if (url.pathname === "/api/search")
      data = [Number(url.searchParams.get("page")) === 2 ? paris : london];
    else if (url.pathname.endsWith("/bookings")) data = { bookedRanges: [] };
    else data = url.pathname.endsWith(second) ? paris : london;
    return route.fulfill({
      json: {
        success: true,
        data,
        meta: {
          page: Number(url.searchParams.get("page") || 1),
          total: 16,
          totalPages: url.pathname === "/api/listings" ? 1 : 2,
        },
      },
    });
  });
});

test("skip link focuses content without navigating to a nonexistent route", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  await page.getByRole("link", { name: "Skip to content" }).press("Enter");
  await expect(page).not.toHaveURL(/#main$/);
  await expect(page.locator("#main")).toBeFocused();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Somewhere new.",
  );
});

test("typing a new destination clears the previous destination automatic country", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", {
      name: "Explore London, United Kingdom",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Country", { exact: true })).toHaveValue(
    "United Kingdom",
  );
  await page.getByLabel("Where to?").fill("Paris");
  await page.getByRole("button", { name: "Search stays" }).click();
  const query = new URLSearchParams(new URL(page.url()).hash.split("?")[1]);
  expect(query.get("location")).toBe("Paris");
  expect(query.get("country")).toBe("France");
  expect(query.get("city")).toBe("Paris");
});

test("back to results returns to the same paginated result page", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Next", exact: false }).click();
  await expect(page).toHaveURL(/page=2/);
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: paris.title }) })
    .click();
  await page.getByRole("link", { name: "Back to all stays" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("heading", { name: paris.title })).toBeVisible();
});

test("a failed responsive image loads the placeholder instead of retrying broken srcset", async ({
  page,
}) => {
  const photoListing = {
    ...london,
    imageUrls: ["https://picsum.photos/seed/shoreditch-loft-1/800/600"],
  };
  await page.route(`**/api/listings/${id}`, (route) =>
    route.fulfill({ json: { success: true, data: photoListing } }),
  );
  await page.route("**/images/stays/**", (route) => route.abort());
  await page.goto(`/#/listing/${id}`, { waitUntil: "domcontentloaded" });
  const image = page.locator(".gallery-photo img").first();
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute(
    "src",
    "/images/property-placeholder.svg",
  );
  await expect
    .poll(() =>
      image.evaluate(
        (im) =>
          im.complete &&
          im.naturalWidth > 0 &&
          im.currentSrc.endsWith("/images/property-placeholder.svg"),
      ),
    )
    .toBe(true);
});

test("a deleted saved property can be removed while temporary failures retain selections", async ({
  page,
}) => {
  await page.addInitScript(
    (id) =>
      localStorage.setItem(
        "airbnb-stay-preferences-v1",
        JSON.stringify({ saved: [id], compare: [] }),
      ),
    id,
  );
  let status = 503;
  await page.route(`**/api/listings/${id}`, (route) =>
    route.fulfill({
      status,
      json: {
        success: false,
        error: {
          code: status === 404 ? "NOT_FOUND" : "DATABASE_UNAVAILABLE",
          message: "Unable to load this stay",
        },
      },
    }),
  );
  await page.goto("/#/saved", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove unavailable stays" }),
  ).toHaveCount(0);
  status = 404;
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("button", { name: "Remove unavailable stays" }).click();
  await expect(
    page.getByRole("heading", { name: "Your next favourite is out there." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("airbnb-stay-preferences-v1")).saved,
    ),
  ).toEqual([]);
});
