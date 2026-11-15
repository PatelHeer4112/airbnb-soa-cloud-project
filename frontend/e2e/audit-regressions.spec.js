import { test, expect } from "./fixtures.js";

test("editing a destination while inventory loads does not restore an obsolete search", async ({
  page,
}) => {
  let release;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/**", async (route) => {
    if (new URL(route.request().url()).pathname === "/api/listings")
      await ready;
    return route.fulfill({
      json: {
        success: true,
        data: [
          {
            _id: "a".repeat(24),
            city: "London",
            country: "United Kingdom",
            propertyType: "Apartment",
            pricePerNight: 100,
            amenities: [],
          },
        ],
        meta: { total: 1, page: 1, totalPages: 1 },
      },
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Where to?").fill("London");
  await page.getByRole("button", { name: "Search stays" }).click();
  await page.getByLabel("Where to?").fill("Paris");
  release();
  await expect(page.locator("#inventory-summary")).toContainText(
    "1 destinations",
  );
  await expect(page.getByLabel("Where to?")).toHaveValue("Paris");
  await expect(page).not.toHaveURL(/city=London/);
});

test("nightly price filters accept decimal rates supported by the backend", async ({
  page,
}) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [],
        meta: { page: 1, total: 0, totalPages: 0 },
      },
    }),
  );
  await page.goto("/");
  await page.getByLabel("Min. nightly price").fill("120.50");
  await page.getByLabel("Max. nightly price").fill("150.75");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/minPrice=120.50/);
  await expect(page).toHaveURL(/maxPrice=150.75/);
});

test("refreshing availability replaces calendar listeners instead of accumulating them", async ({
  page,
}) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [],
        meta: { page: 1, total: 0, totalPages: 0 },
      },
    }),
  );
  await page.goto("/");
  const draws = await page.evaluate(async () => {
    const { mountCalendar } = await import("/src/calendar.js");
    const wrapper = document.createElement("section");
    wrapper.innerHTML =
      '<form><input name="checkIn" type="date"><input name="checkOut" type="date"></form><div></div>';
    document.body.append(wrapper);
    const form = wrapper.querySelector("form"),
      target = wrapper.querySelector("div");
    const descriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "innerHTML",
    );
    let renders = 0;
    Object.defineProperty(target, "innerHTML", {
      get() {
        return descriptor.get.call(this);
      },
      set(value) {
        renders++;
        descriptor.set.call(this, value);
      },
    });
    mountCalendar(target, [], form);
    mountCalendar(target, [], form);
    mountCalendar(target, [], form);
    renders = 0;
    form.elements.checkIn.value = "2099-01-01";
    form.elements.checkIn.dispatchEvent(new Event("change"));
    wrapper.remove();
    return renders;
  });
  expect(draws).toBe(1);
});
