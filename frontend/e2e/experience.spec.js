import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

const ids = ["a", "b", "c", "d"].map((char) => char.repeat(24));
const titles = [
  "Quiet garden cottage",
  "A city loft for two",
  "A place by the water",
  "A bright weekend retreat",
];
const listings = ids.map((_id, i) => ({
  _id,
  title: titles[i],
  city: ["London", "Paris", "Goa", "Lisbon"][i],
  country: ["United Kingdom", "France", "India", "Portugal"][i],
  location: "Central",
  description:
    "A thoughtful place to pause, explore and make yourself at home.",
  propertyType: ["Cottage", "Loft", "Villa", "Studio"][i],
  pricePerNight: 120 + 30 * i,
  maxGuests: 4,
  bedrooms: 2,
  bathrooms: 1,
  rating: 4.8,
  amenities: ["Wi-Fi", "Kitchen", "Workspace"],
  imageUrls: ["/images/Destination14.png"],
}));
const day = (offset) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    let data;
    if (url.pathname === "/api/search")
      return route.fulfill({
        json: {
          success: true,
          data: listings,
          meta: { page: 1, total: 4, totalPages: 1 },
        },
      });
    if (url.pathname.startsWith("/api/listings/"))
      data = listings.find((l) => l._id === url.pathname.split("/").pop());
    else if (url.pathname.endsWith("/bookings"))
      data = {
        bookedRanges: [
          {
            checkInDate: day(4),
            checkOutDate: day(6),
            bookingStatus: "Confirmed",
          },
        ],
      };
    else
      data = {
        _id: ids[1],
        listing: listings[0],
        guestName: "Test Guest",
        guestEmail: "guest@example.com",
        numberOfGuests: 2,
        numberOfNights: 2,
        totalPrice: 240,
        bookingStatus: "Pending",
        checkInDate: day(2),
        checkOutDate: day(4),
      };
    await route.fulfill({ json: { success: true, data } });
  });
});

test("saved stays survive refresh and can be removed without storing personal details", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: `Save ${titles[0]}`, exact: true })
    .click();
  await page.evaluate(() => {
    document.querySelectorAll("img").forEach((img) => {
      img.loading = "eager";
    });
    window.scrollTo(0, 0);
    document.activeElement?.blur();
  });
  await expect(
    page.getByRole("button", { name: `Save ${titles[0]}` }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/#/saved");
  await expect(page.getByRole("heading", { name: titles[0] })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: titles[0] })).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("airbnb-stay-preferences-v1")),
  );
  expect(state).toEqual({ saved: [ids[0]], compare: [] });
  await page.getByRole("button", { name: `Save ${titles[0]}` }).click();
  await expect(
    page.getByRole("heading", { name: "Your next favourite is out there." }),
  ).toBeVisible();
});

test("comparison limits selections and renders a real side-by-side shortlist", async ({
  page,
}) => {
  await page.goto("/");
  for (const title of titles.slice(0, 3))
    await page
      .getByRole("button", { name: `Compare ${title}`, exact: true })
      .click();
  await page
    .getByRole("button", { name: `Compare ${titles[3]}`, exact: true })
    .click();
  await expect(page.locator("#toast")).toContainText("Compare up to 3 stays");
  await expect(
    page.getByRole("button", { name: `Compare ${titles[3]}` }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("link", { name: "Compare stays" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("row", { name: /Per night/ })).toContainText(
    "120",
  );
  await page.getByRole("button", { name: `Compare ${titles[0]}` }).click();
  await expect(
    page.getByRole("table").getByRole("link", { name: titles[0] }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("amenity filters use backend field names and restore after refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Make room for your must-haves").click();
  const request = page.waitForRequest(
    (req) =>
      req.url().includes("/api/search?") &&
      new URL(req.url()).searchParams.get("amenities") === "Wi-Fi",
  );
  await page.getByRole("checkbox", { name: "Wi-Fi", exact: true }).check();
  await request;
  await expect(page).toHaveURL(/amenities=Wi-Fi/);
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Wi-Fi", exact: true }),
  ).toBeChecked();
});

test("calendar supports reserved-day checkout and blocks stays across occupied nights", async ({
  page,
}) => {
  await page.goto(`/#/listing/${ids[0]}`);
  await expect(page.locator("#booking-calendar")).not.toBeEmpty();
  // Move to the month containing check-in, even at a month boundary.
  const targetMonth = day(2).slice(0, 7);
  if (targetMonth !== new Date().toISOString().slice(0, 7))
    await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page.getByRole("button", { name: `${day(2)}`, exact: true }).click();
  if (day(4).slice(0, 7) !== targetMonth)
    await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `${day(4)} reserved`, exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: `${day(5)} reserved`, exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: `${day(4)} reserved`, exact: true })
    .click();
  await expect(page.getByLabel("Check-in", { exact: true })).toHaveValue(
    day(2),
  );
  await expect(page.getByLabel("Check-out", { exact: true })).toHaveValue(
    day(4),
  );
  await expect(page.locator("#estimate")).toContainText("240");
});

test("photo viewer and calendar itinerary export work", async ({ page }) => {
  await page.goto(`/#/listing/${ids[0]}`);
  await page.getByRole("button", { name: "Open property photo 1" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto(`/#/booking/${ids[1]}`);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).click();
  const download = await downloadPromise;
  const content = await readFile(await download.path(), "utf8");
  expect(content).toContain("BEGIN:VCALENDAR");
  expect(content).toContain("STATUS:TENTATIVE");
  expect(content).not.toContain("guest@example.com");
});

test("new collection routes work on mobile without page errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: `Save ${titles[0]}`, exact: true })
    .click();
  await page.screenshot({
    path: "test-results/premium-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/premium-desktop.png",
    fullPage: true,
  });
  await page.goto("/#/saved");
  await expect(page.getByRole("heading", { name: titles[0] })).toBeVisible();
  expect(errors).toEqual([]);
});

test("primary screens pass automated WCAG accessibility checks", async ({
  page,
}) => {
  for (const path of [
    "/",
    `/#/listing/${ids[0]}`,
    `/#/booking/${ids[1]}`,
    "/#/saved",
    "/#/compare",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path === "/") {
      await expect(
        page.getByRole("heading", { name: titles[0] }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: `Save ${titles[0]}`, exact: true })
        .click();
      await page
        .getByRole("button", { name: `Compare ${titles[0]}`, exact: true })
        .click();
    }
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      path,
    ).toEqual([]);
  }
});
