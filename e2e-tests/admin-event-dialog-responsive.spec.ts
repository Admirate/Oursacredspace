import { expect, test, type Page } from "@playwright/test";

const openAddEventDialog = async (page: Page) => {
  await page.context().addCookies([
    {
      name: "admin_token",
      value: "0".repeat(64),
      url: "http://localhost:8888",
    },
  ]);
  await page.route("**/.netlify/functions/adminAuth", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { email: "admin@example.com", csrfToken: "test-csrf-token" },
      }),
    });
  });
  await page.route("**/.netlify/functions/adminListEvents", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.goto("/oss-ctrl-9x7k2m/events");
  await page.getByRole("button", { name: "Add Event" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished)
    );
  });
};

test.describe("admin event dialog responsive layout", () => {
  test("fills the mobile viewport and keeps actions visible around a scrolling field region", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAddEventDialog(page);

    const dialog = page.getByRole("dialog");
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo(0, 0);
    expect(box!.width).toBeGreaterThanOrEqual(389);
    expect(box!.height).toBeGreaterThanOrEqual(843);
    await expect(dialog).toHaveCSS("border-radius", "0px");

    const scrollRegion = page.getByTestId("event-dialog-scroll-region");
    await expect(scrollRegion).toBeVisible();
    await expect
      .poll(() =>
        scrollRegion.evaluate(
          (element) => element.scrollHeight > element.clientHeight
        )
      )
      .toBe(true);
    await expect(page.getByRole("button", { name: "Cancel" })).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Create Event" })
    ).toBeInViewport();
  });

  test("uses a centered, viewport-constrained modal on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openAddEventDialog(page);

    const dialog = page.getByRole("dialog");
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThan(0);
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.width).toBeLessThanOrEqual(512);
    expect(box!.height).toBeLessThanOrEqual(720);
    await expect(page.getByRole("button", { name: "Cancel" })).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Create Event" })
    ).toBeInViewport();
  });
});
