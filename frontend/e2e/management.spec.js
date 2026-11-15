import { test, expect } from "./fixtures.js";
import AxeBuilder from "@axe-core/playwright";
const id = "a".repeat(24),
  key = "test-management-code-32-characters-long";
const listing = {
  _id: id,
  title: "A stay for management tests",
  city: "Paris",
  country: "France",
  location: "Montmartre",
  propertyType: "Apartment",
  description: "A quiet city retreat.",
  maxGuests: 2,
  bedrooms: 1,
  bathrooms: 1,
  pricePerNight: 100,
  rating: 4.6,
  amenities: [],
  imageUrls: [],
};
test("searching a typed city or country automatically selects its country", async ({
  page,
}) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [listing],
        meta: { total: 1, page: 1, totalPages: 1 },
      },
    }),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Where to?").fill("paris");
  await page.getByRole("button", { name: "Search stays" }).click();
  await expect(page.getByLabel("Country", { exact: true })).toHaveValue(
    "France",
  );
  await expect(page).toHaveURL(/country=France/);
  await page.getByLabel("Where to?").fill("France");
  await page.getByRole("button", { name: "Search stays" }).click();
  await expect(page.getByLabel("Country", { exact: true })).toHaveValue(
    "France",
  );
});
test("authorized manager accepts a real request state and the guest refresh sees the decision", async ({
  page,
}) => {
  let bookingStatus = "Pending";
  const booking = () => ({
    _id: id,
    listing,
    guestName: "Test Guest",
    guestEmail: "test@example.com",
    numberOfGuests: 2,
    numberOfNights: 2,
    checkInDate: "2099-01-01",
    checkOutDate: "2099-01-03",
    totalPrice: 200,
    bookingStatus,
  });
  await page.route("**/api/**", (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname.startsWith("/api/admin/")) {
      if (req.headers().authorization !== `Bearer ${key}`)
        return route.fulfill({
          status: 401,
          json: {
            success: false,
            error: { message: "A valid management code is required" },
          },
        });
      if (req.method() === "PATCH") {
        bookingStatus = req.postDataJSON().bookingStatus;
        return route.fulfill({ json: { success: true, data: booking() } });
      }
      const status = url.searchParams.get("status");
      const data = !status || status === bookingStatus ? [booking()] : [];
      return route.fulfill({
        json: {
          success: true,
          data,
          meta: {
            total: data.length,
            totalPages: data.length ? 1 : 0,
            page: 1,
          },
        },
      });
    }
    return route.fulfill({ json: { success: true, data: booking() } });
  });
  await page.goto("/#/manage", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Management access code").fill(key);
  await page.getByRole("button", { name: "Open booking manager" }).click();
  await expect(
    page.getByRole("heading", { name: listing.title }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Accept request", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm decision" }).click();
  await expect(
    page.getByRole("heading", { name: "No bookings in this view." }),
  ).toBeVisible();
  await page.getByLabel("Booking status").selectOption("Confirmed");
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View booking", exact: true }).click();
  await expect(
    page.getByText("Your booking has been confirmed.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.values({ ...localStorage, ...sessionStorage }).some((value) =>
        value.includes("test-management-code"),
      ),
    ),
  ).toBe(false);
  await page.goto("/#/manage", { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Management access code")).toBeVisible();
});
