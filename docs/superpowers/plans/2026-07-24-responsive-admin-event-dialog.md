# Responsive Admin Event Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin Add/Edit Event dialog a full-screen, scrollable mobile panel and a viewport-constrained desktop modal with persistent header and actions.

**Architecture:** Keep the existing Radix Dialog and React Hook Form instance. Convert the dialog shell into a responsive flex container, split the form into a scrollable field region and a fixed action region, and stack paired fields below the `sm` breakpoint. Add a Playwright regression test that mocks admin API reads and verifies mobile and desktop geometry.

**Tech Stack:** Next.js 16, React 18, TypeScript, Tailwind CSS 3.4, Radix Dialog, React Hook Form, Playwright

## Global Constraints

- Change only the admin Events dialog and its focused end-to-end coverage.
- Do not change event data, validation, API requests, image-upload behavior, copy, or field order.
- Use one shared form implementation at every viewport size.
- Mobile uses `100dvh`; tablet and desktop use a centered modal capped at `90dvh`.
- Keep the header and action buttons visible while the field region scrolls.
- Preserve Radix focus management, Escape-to-close behavior, and accessible title/description associations.

---

## File structure

- Create `e2e-tests/admin-event-dialog-responsive.spec.ts`: regression coverage for mobile full-screen geometry, scrolling, persistent actions, and desktop modal constraints.
- Modify `src/app/oss-ctrl-9x7k2m/events/page.tsx`: responsive dialog shell, scroll region, action region, and mobile-first field grids.

### Task 1: Responsive admin event dialog

**Files:**
- Create: `e2e-tests/admin-event-dialog-responsive.spec.ts`
- Modify: `src/app/oss-ctrl-9x7k2m/events/page.tsx:404-665`

**Interfaces:**
- Consumes: `DialogContent`, `DialogHeader`, and the existing `form.handleSubmit(handleSubmit)` form flow.
- Produces: a `data-testid="event-dialog-scroll-region"` field container used only for geometry/overflow verification; no exported application API changes.

- [ ] **Step 1: Write the failing responsive Playwright test**

Create `e2e-tests/admin-event-dialog-responsive.spec.ts` with this complete test:

```ts
import { expect, test, type Page } from "@playwright/test";

const openAddEventDialog = async (page: Page) => {
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
  await expect(page.getByRole("dialog")).toBeVisible();
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
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
npx playwright test e2e-tests/admin-event-dialog-responsive.spec.ts --project=chromium
```

Expected: FAIL because `event-dialog-scroll-region` does not exist and the mobile dialog does not fill/constrain itself to the viewport.

- [ ] **Step 3: Implement the responsive dialog shell**

In `src/app/oss-ctrl-9x7k2m/events/page.tsx`, replace the current dialog opening and header classes with:

```tsx
<DialogContent className="inset-0 flex h-[100dvh] max-h-[100dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 border-0 p-0 [&>button]:top-[max(1rem,env(safe-area-inset-top))] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border">
  <DialogHeader className="shrink-0 border-b px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] pr-12 text-left sm:border-b-0 sm:px-6 sm:pb-0 sm:pt-6">
    <DialogTitle>{editingEvent ? "Edit Event" : "Add New Event"}</DialogTitle>
    <DialogDescription>
      {editingEvent ? "Update event details" : "Create a new event"}
    </DialogDescription>
  </DialogHeader>
```

Keep the existing `Form` component, then replace the form opening with:

```tsx
<form
  onSubmit={form.handleSubmit(handleSubmit)}
  className="flex min-h-0 flex-1 flex-col"
>
  <div
    data-testid="event-dialog-scroll-region"
    className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
  >
```

Close that field-region `div` immediately after the `maxSeatsPerBooking` field group and before the action row. Replace the action row with:

```tsx
  </div>

  <div className="flex shrink-0 gap-3 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6">
    <Button
      type="button"
      variant="outline"
      className="flex-1"
      onClick={handleDialogClose}
    >
      Cancel
    </Button>
    <Button type="submit" className="flex-1" disabled={isPending}>
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Saving...
        </>
      ) : editingEvent ? (
        "Update Event"
      ) : (
        "Create Event"
      )}
    </Button>
  </div>
</form>
```

Do not alter any field names, controls, validation messages, handlers, or the surrounding `Form`/`Dialog` closing tags.

- [ ] **Step 4: Make every paired field group mobile-first**

Replace the four dialog-field occurrences of:

```tsx
<div className="grid grid-cols-2 gap-4">
```

with:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
```

The four groups are start date/time, end date/time, capacity/price, and pair price/max seats. Leave the unrelated event-card metadata grid later in the file unchanged.

- [ ] **Step 5: Run focused automated verification**

Run:

```bash
npx playwright test e2e-tests/admin-event-dialog-responsive.spec.ts --project=chromium
npx tsc --noEmit
```

Expected: both responsive Playwright tests PASS and TypeScript exits with code 0.

- [ ] **Step 6: Run production verification**

Run:

```bash
npm run build
```

Expected: Prisma generation and the Next.js production build complete successfully with exit code 0.

- [ ] **Step 7: Review the final diff and commit**

Run:

```bash
git diff --check
git diff -- e2e-tests/admin-event-dialog-responsive.spec.ts src/app/oss-ctrl-9x7k2m/events/page.tsx
git status --short
```

Expected: no whitespace errors; only the new responsive test and intended dialog page are uncommitted.

Commit:

```bash
git add e2e-tests/admin-event-dialog-responsive.spec.ts src/app/oss-ctrl-9x7k2m/events/page.tsx
git commit -m "fix: make admin event dialog responsive"
```
