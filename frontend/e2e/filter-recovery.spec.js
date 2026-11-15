import { test, expect } from "./fixtures.js";

const stays = [
  {
    _id: "a".repeat(24),
    title: "Barcelona apartment",
    city: "Barcelona",
    country: "Spain",
    pricePerNight: 150,
  },
  {
    _id: "b".repeat(24),
    title: "Barcelona villa",
    city: "Barcelona",
    country: "Spain",
    pricePerNight: 420,
  },
  {
    _id: "c".repeat(24),
    title: "Paris apartment",
    city: "Paris",
    country: "France",
    pricePerNight: 100,
  },
].map((stay) => ({
  ...stay,
  location: stay.city,
  propertyType: "Apartment",
  maxGuests: 4,
  bedrooms: 1,
  bathrooms: 1,
  rating: 4.5,
  amenities: ["Wi-Fi"],
  imageUrls: [],
}));

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url()),
      p = url.searchParams;
    const data = stays.filter(
      (stay) =>
        !url.pathname.endsWith("/search") ||
        ((!p.get("country") || p.get("country") === stay.country) &&
          (!p.get("city") || p.get("city") === stay.city) &&
          (!p.get("location") ||
            [stay.city, stay.country].some((value) =>
              value.toLowerCase().includes(p.get("location").toLowerCase()),
            )) &&
          (!p.get("minPrice") ||
            stay.pricePerNight >= Number(p.get("minPrice"))) &&
          (!p.get("maxPrice") ||
            stay.pricePerNight <= Number(p.get("maxPrice")))),
    );
    return route.fulfill({
      json: {
        success: true,
        data,
        meta: { total: data.length, page: 1, totalPages: 1 },
      },
    });
  });
});

test("out-of-range prices explain the inventory and can be removed without losing trip details", async ({
  page,
}) => {
  await page.goto(
    "/#/?location=Barcelona&city=Barcelona&country=Spain&checkIn=2099-01-01&checkOut=2099-01-03&guests=2&minPrice=10000&maxPrice=20000",
  );
  await expect(page.locator("#price-guidance")).toContainText("150");
  await expect(page.locator("#price-guidance")).toContainText("420");
  await expect(page.locator("#price-guidance")).toContainText(
    "price limits exclude every listed stay",
  );
  await expect(
    page.getByRole("heading", { name: "No stays found. A fresh start?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove price limits" }).click();
  await expect(page.locator("#results .stay-card")).toHaveCount(2);
  await expect(page).not.toHaveURL(/minPrice|maxPrice/);
  await expect(page.getByLabel("Check-in", { exact: true })).toHaveValue(
    "2099-01-01",
  );
  await expect(page.getByLabel("Country", { exact: true })).toHaveValue(
    "Spain",
  );
  await expect(page.locator("#active-filters")).toContainText("2 guests");
  await expect(
    page.locator("#active-filters").getByText("Barcelona", { exact: true }),
  ).toHaveCount(1);
  await page.getByLabel("Min. nightly price").fill("100");
  await page.getByLabel("Max. nightly price").fill("200");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator("#results")).toContainText("Barcelona apartment");
  await expect(page.locator("#results")).not.toContainText("Barcelona villa");
});

test("changing country clears a conflicting previous city and free-text location", async ({
  page,
}) => {
  await page.goto("/#/?location=Barcelona&city=Barcelona&country=Spain");
  await expect(
    page.getByLabel("Country", { exact: true }).locator("option"),
  ).toHaveCount(3);
  await page.getByLabel("Country", { exact: true }).selectOption("France");
  await expect(page.getByLabel("Where to?")).toHaveValue("");
  await expect(page.locator("#results")).toContainText("Paris apartment");
  await expect(page).not.toHaveURL(/city=|location=/);
  await expect(page.locator("#price-guidance")).toContainText("100");
});
