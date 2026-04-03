import { test, expect } from "@playwright/test";

// All public pages that should load without errors
const PUBLIC_PAGES = [
  { path: "/", title: "Home" },
  { path: "/events", title: "Events" },
  { path: "/classes", title: "Classes" },
  { path: "/workshops", title: "Workshops" },
  { path: "/book-space", title: "Book a Space" },
  { path: "/co-working-space", title: "Co-Working Space" },
  { path: "/space-enquiry", title: "Space Enquiry" },
  { path: "/community", title: "Community" },
  { path: "/initiatives", title: "Initiatives" },
  { path: "/visit", title: "Visit Us" },
  { path: "/contact", title: "Contact" },
];

test.describe("Smoke Tests — Public Pages", () => {
  for (const page of PUBLIC_PAGES) {
    test(`${page.title} (${page.path}) loads with 200`, async ({ page: p }) => {
      const response = await p.goto(page.path);
      expect(response?.status()).toBe(200);
    });

    test(`${page.title} (${page.path}) has no console errors`, async ({ page: p }) => {
      const errors: string[] = [];
      p.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      await p.goto(page.path);
      await p.waitForLoadState("networkidle");

      // Filter out known non-critical errors (e.g. Netlify RUM, favicon 404)
      const criticalErrors = errors.filter(
        (e) =>
          !e.includes("netlify") &&
          !e.includes("favicon") &&
          !e.includes("Failed to load resource") // external assets may 404 in dev
      );

      expect(criticalErrors).toEqual([]);
    });
  }

  test("has correct <title> containing 'OSS Space'", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title).toContain("OSS Space");
  });

  test("each page has a unique <title>", async ({ page }) => {
    const titles: string[] = [];
    for (const pg of PUBLIC_PAGES) {
      await page.goto(pg.path);
      titles.push(await page.title());
    }
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });
});

test.describe("Smoke Tests — Utility Pages", () => {
  test("404 page renders for unknown routes", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    // Next.js returns 404 for not-found pages
    expect(response?.status()).toBe(404);
    await expect(page.locator("text=Back to Home")).toBeVisible();
  });

  test("/success page loads without bookingId (graceful)", async ({ page }) => {
    const response = await page.goto("/success");
    expect(response?.status()).toBe(200);
  });

  test("/verify page loads without passId (graceful)", async ({ page }) => {
    const response = await page.goto("/verify");
    expect(response?.status()).toBe(200);
  });
});

test.describe("Smoke Tests — SEO", () => {
  test("robots.txt blocks admin panel", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    expect(response?.status()).toBe(200);
    const text = await page.locator("body").textContent();
    expect(text).toContain("/oss-ctrl-9x7k2m/");
    expect(text).toContain("/api/");
  });

  test("sitemap.xml is accessible", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    expect(response?.status()).toBe(200);
  });

  test("pages have Open Graph meta tags", async ({ page }) => {
    await page.goto("/");
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute("content");
    expect(ogTitle).toBeTruthy();

    const ogUrl = await page
      .locator('meta[property="og:url"]')
      .getAttribute("content");
    expect(ogUrl).toContain("oursacredspace.in");
  });
});
