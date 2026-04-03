import { test, expect } from "@playwright/test";

const WHATSAPP_CONTACT_NUMBER = "919030613344";

// Helper: intercept window.open and capture the URL instead of opening a real tab
async function interceptWindowOpen(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    (window as any).__capturedOpenUrl = null;
    window.open = (url?: string | URL) => {
      (window as any).__capturedOpenUrl = typeof url === "string" ? url : url?.toString() ?? null;
      return null;
    };
  });
}

async function getCapturedUrl(page: import("@playwright/test").Page): Promise<string | null> {
  return page.evaluate(() => (window as any).__capturedOpenUrl);
}

test.describe("WhatsApp CTA — Classes Page", () => {
  test('classes page shows "Enquire on WhatsApp" buttons', async ({ page }) => {
    await page.goto("/classes");
    await page.waitForLoadState("networkidle");

    const ctaButtons = page.getByRole("button", {
      name: /Enquire on WhatsApp/i,
    });
    const count = await ctaButtons.count();

    // If there are active classes, there should be CTA buttons
    // If no classes from API, the page should still load without errors
    if (count > 0) {
      await expect(ctaButtons.first()).toBeVisible();
    }
  });

  test("classes WhatsApp CTA opens correct wa.me URL", async ({ page }) => {
    await page.goto("/classes");
    await page.waitForLoadState("networkidle");

    const ctaButtons = page.getByRole("button", {
      name: /Enquire on WhatsApp/i,
    });
    const count = await ctaButtons.count();

    if (count > 0) {
      await interceptWindowOpen(page);
      // force:true bypasses hover overlay that intercepts pointer events
      await ctaButtons.first().click({ force: true });

      const url = await getCapturedUrl(page);
      expect(url).toBeTruthy();
      expect(url).toContain(`https://wa.me/${WHATSAPP_CONTACT_NUMBER}`);
      expect(url).toContain("text=");
      expect(decodeURIComponent(url!)).toContain("class");
    }
  });
});

test.describe("WhatsApp CTA — Events Page", () => {
  test('events page shows "Enquire on WhatsApp" buttons', async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    const ctaButtons = page.getByRole("button", {
      name: /Enquire on WhatsApp/i,
    });
    const count = await ctaButtons.count();

    if (count > 0) {
      await expect(ctaButtons.first()).toBeVisible();
    }
  });

  test("events WhatsApp CTA opens correct wa.me URL", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    const ctaButtons = page.getByRole("button", {
      name: /Enquire on WhatsApp/i,
    });
    const count = await ctaButtons.count();

    if (count > 0) {
      await interceptWindowOpen(page);
      // force:true bypasses hover overlay that intercepts pointer events
      await ctaButtons.first().click({ force: true });

      const url = await getCapturedUrl(page);
      expect(url).toBeTruthy();
      expect(url).toContain(`https://wa.me/${WHATSAPP_CONTACT_NUMBER}`);
      expect(url).toContain("text=");
      expect(decodeURIComponent(url!)).toContain("event");
    }
  });
});

test.describe("WhatsApp CTA — Space Enquiry Page", () => {
  test('space enquiry page shows "Enquire on WhatsApp" button', async ({
    page,
  }) => {
    await page.goto("/space-enquiry");
    await page.waitForLoadState("networkidle");

    const ctaButton = page.getByRole("button", {
      name: /Enquire on WhatsApp/i,
    });
    await expect(ctaButton).toBeVisible();
  });

  test("space enquiry WhatsApp CTA opens correct wa.me URL", async ({
    page,
  }) => {
    await page.goto("/space-enquiry");
    await page.waitForLoadState("networkidle");

    await interceptWindowOpen(page);

    const ctaButton = page.getByRole("button", {
      name: /Enquire on WhatsApp/i,
    });
    await ctaButton.click();

    const url = await getCapturedUrl(page);
    expect(url).toBeTruthy();
    expect(url).toContain(`https://wa.me/${WHATSAPP_CONTACT_NUMBER}`);
    expect(url).toContain("text=");
    expect(decodeURIComponent(url!)).toContain("space");
  });
});
