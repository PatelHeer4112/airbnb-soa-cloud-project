import { test as base, expect } from "@playwright/test";

// UI checks must not wait on third-party font/CDN availability. Local fallback
// fonts are part of the product; actual bundled photography remains enabled.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
      route.abort(),
    );
    await use(page);
  },
});
export { expect };
