import { test, expect } from "@playwright/test";

test.describe("Navigation — Header Links", () => {
  const NAV_ITEMS = [
    { label: "Home", href: "/" },
    { label: "Events", href: "/events" },
    { label: "Classes", href: "/classes" },
    { label: "Workshops", href: "/workshops" },
    { label: "Spaces", href: "/book-space" },
    { label: "Co-Working", href: "/co-working-space" },
    { label: "Community", href: "/community" },
    { label: "Initiatives", href: "/initiatives" },
    { label: "Visit", href: "/visit" },
    { label: "Contact", href: "/contact" },
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  for (const item of NAV_ITEMS) {
    test(`header link "${item.label}" navigates to ${item.href}`, async ({
      page,
    }) => {
      // Desktop nav links (hidden on mobile via lg:flex)
      const link = page
        .locator("header nav")
        .getByRole("link", { name: item.label, exact: true })
        .first();

      await link.click();
      await page.waitForURL(`**${item.href}`);
      expect(new URL(page.url()).pathname).toBe(item.href);
    });
  }

  test("logo links to home page", async ({ page }) => {
    await page.goto("/classes");
    const logo = page.locator('header a[aria-label="Sacred Space Home"]');
    await logo.click();
    await page.waitForURL("**/");
    expect(new URL(page.url()).pathname).toBe("/");
  });
});

test.describe("Navigation — Footer Links", () => {
  const FOOTER_EXPLORE_LINKS = [
    { label: "Classes", href: "/classes" },
    { label: "Events & Workshops", href: "/events" },
    { label: "Book a Space", href: "/book-space" },
    { label: "Community", href: "/community" },
  ];

  const FOOTER_SUPPORT_LINKS = [
    { label: "Contact Us", href: "/contact" },
    { label: "Visit Us", href: "/visit" },
    { label: "Initiatives", href: "/initiatives" },
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  for (const link of FOOTER_EXPLORE_LINKS) {
    test(`footer explore link "${link.label}" navigates to ${link.href}`, async ({
      page,
    }) => {
      // Scroll footer into view first (home page is large)
      const footer = page.locator("footer");
      await footer.scrollIntoViewIfNeeded();
      const footerLink = footer
        .getByRole("link", { name: link.label, exact: true })
        .first();
      await footerLink.click();
      await page.waitForURL(`**${link.href}`);
      expect(new URL(page.url()).pathname).toBe(link.href);
    });
  }

  for (const link of FOOTER_SUPPORT_LINKS) {
    test(`footer support link "${link.label}" navigates to ${link.href}`, async ({
      page,
    }) => {
      const footer = page.locator("footer");
      await footer.scrollIntoViewIfNeeded();
      const footerLink = footer
        .getByRole("link", { name: link.label, exact: true })
        .first();
      await footerLink.click();
      await page.waitForURL(`**${link.href}`);
      expect(new URL(page.url()).pathname).toBe(link.href);
    });
  }

  test("footer social links have correct external URLs", async ({ page }) => {
    const instagram = page
      .locator("footer")
      .getByRole("link", { name: /instagram/i });
    await expect(instagram).toHaveAttribute(
      "href",
      "https://instagram.com/oursacredspace"
    );
    await expect(instagram).toHaveAttribute("target", "_blank");

    const facebook = page
      .locator("footer")
      .getByRole("link", { name: /facebook/i });
    await expect(facebook).toHaveAttribute(
      "href",
      "https://facebook.com/oursacredspace"
    );

    const youtube = page
      .locator("footer")
      .getByRole("link", { name: /youtube/i });
    await expect(youtube).toHaveAttribute(
      "href",
      "https://youtube.com/@oursacredspace"
    );
  });

  test("footer phone link has correct tel: href", async ({ page }) => {
    const phone = page.locator('footer a[href^="tel:"]');
    await expect(phone).toHaveAttribute("href", "tel:+914027617444");
  });

  test("footer email link has correct mailto: href", async ({ page }) => {
    const email = page.locator('footer a[href^="mailto:"]');
    await expect(email).toHaveAttribute(
      "href",
      "mailto:info@oursacredspace.in"
    );
  });
});
