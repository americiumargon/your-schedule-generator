import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

/**
 * Mobile viewport coverage for the Schedule Generator. Validates that the form,
 * schedule output, inline editing, and exports all work on common phone sizes.
 *
 * Sizes mirror the preview's responsive snap targets and cover small Android
 * (360x800), iPhone SE-class (375x667), iPhone 12/13/14 (390x844), and the
 * larger iPhone Pro Max class (414x896).
 */

const MOBILE_VIEWPORTS = [
  { name: "Android small (360x800)", width: 360, height: 800 },
  { name: "iPhone SE (375x667)", width: 375, height: 667 },
  { name: "iPhone 13 (390x844)", width: 390, height: 844 },
  { name: "iPhone 14 Pro Max (414x896)", width: 414, height: 896 },
] as const;

async function fillBasicSchedule(page: Page, name = "Mobile Bootcamp") {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Schedule details" })).toBeVisible();

  await page.locator("#projectName").fill(name);
  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Wednesday", { exact: true }).check();

  await page.locator('input[type="time"]').nth(0).fill("09:00");
  await page.locator('input[type="time"]').nth(1).fill("10:00");

  await page.getByRole("button", { name: "Generate schedule" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 10_000 });
}

function sessionCards(page: Page) {
  return page.locator(".print-session");
}

test.describe("Mobile viewports", () => {
  for (const vp of MOBILE_VIEWPORTS) {
    test.describe(vp.name, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: true });

      test("renders header and form without horizontal overflow", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("heading", { name: /schedule/i }).first()).toBeVisible();
        await expect(page.getByRole("heading", { name: "Schedule details" })).toBeVisible();

        // No horizontal scrollbar: document scroll width should fit the viewport
        // (allow 1px for sub-pixel rounding).
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);

        // Key controls must be reachable in the viewport's width.
        const name = page.locator("#projectName");
        await expect(name).toBeVisible();
        const box = await name.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
      });

      test("generates and shows the schedule list", async ({ page }) => {
        await fillBasicSchedule(page);
        await expect(sessionCards(page).first()).toBeVisible();
        await expect(sessionCards(page)).toHaveCount(8);

        // The generated list should be reachable by scrolling within viewport width.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
      });

      test("edits a session inline via the popover", async ({ page }) => {
        await fillBasicSchedule(page);

        const firstCard = sessionCards(page).first();
        await firstCard.scrollIntoViewIfNeeded();
        await firstCard.getByRole("button", { name: "Edit session" }).click();

        const timeInputs = page.locator('input[type="time"]');
        await expect(timeInputs).toHaveCount(4);
        await timeInputs.nth(2).fill("11:30");
        await timeInputs.nth(3).fill("12:45");
        await page.getByRole("button", { name: "Save", exact: true }).click();

        await expect(page.getByText("Session updated")).toBeVisible();
        await expect(firstCard).toContainText("11:30");
        await expect(firstCard).toContainText("12:45");
      });

      test("exports CSV from a mobile viewport", async ({ page }) => {
        await fillBasicSchedule(page);
        const csvButton = page.getByRole("button", { name: "CSV", exact: true });
        await csvButton.scrollIntoViewIfNeeded();
        const [download] = await Promise.all([
          page.waitForEvent("download"),
          csvButton.click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/\.csv$/i);
        const text = await readFile((await download.path())!, "utf8");
        const records = text.match(/^"Mobile Bootcamp - Session \d+"/gm) ?? [];
        expect(records).toHaveLength(8);
      });
    });
  }
});

