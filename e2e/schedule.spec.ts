import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

/**
 * End-to-end coverage for the Schedule Generator:
 *  - fill the form and generate a schedule
 *  - edit a session inline via the popover
 *  - export to CSV, ICS, and PDF and validate the downloaded files
 *
 * The form pre-fills start date (next Monday) and count = 8, so the minimum
 * interaction to generate a schedule is: name + a weekday + start/end time.
 */

async function fillBasicSchedule(page: Page, name = "Yoga Bootcamp") {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Schedule details" })).toBeVisible();

  await page.locator("#projectName").fill(name);

  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Wednesday", { exact: true }).check();

  // First (and only) time slot in the essentials section.
  await page.locator('input[type="time"]').nth(0).fill("09:00");
  await page.locator('input[type="time"]').nth(1).fill("10:00");

  await page.getByRole("button", { name: "Generate schedule" }).click();

  // Right pane heading switches to the project name.
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 10_000 });
}

function sessionCards(page: Page) {
  return page.locator(".print-session");
}

test.describe("Schedule Generator E2E", () => {
  test("generates a schedule from the form", async ({ page }) => {
    await fillBasicSchedule(page);
    await expect(sessionCards(page)).toHaveCount(8);
    await expect(page.getByText(/8\s*of\s*8\s*sessions selected/i)).toBeVisible();
  });

  test("edits a session and persists the change", async ({ page }) => {
    await fillBasicSchedule(page);

    const firstCard = sessionCards(page).first();
    const originalTime = (await firstCard.innerText()).match(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/)?.[0];
    expect(originalTime).toBeTruthy();

    await firstCard.getByRole("button", { name: "Edit session" }).click();

    // The popover renders its own Start time / End time inputs in a dialog.
    const popover = page.locator('[role="dialog"]').last();
    await popover.getByLabel("Start time").fill("11:30");
    await popover.getByLabel("End time").fill("12:45");
    await popover.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Session updated")).toBeVisible();

    // Card now shows the new time and "edited" badge.
    await expect(firstCard).toContainText("11:30");
    await expect(firstCard).toContainText("12:45");
    await expect(firstCard).toContainText(/edited/i);
  });

  test("exports CSV with Google Calendar headers and one record per session", async ({ page }) => {
    await fillBasicSchedule(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "CSV", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    const text = await readFile((await download.path())!, "utf8");

    expect(text.split(/\r?\n/)[0]).toBe(
      "Subject,Start Date,Start Time,End Date,End Time,All Day Event,Description,Location,Private"
    );
    // One record per session — match by "Subject" cell at line start.
    const records = text.match(/^"Yoga Bootcamp - Session \d+"/gm) ?? [];
    expect(records).toHaveLength(8);
  });

  test("exports ICS with one VEVENT per session", async ({ page }) => {
    await fillBasicSchedule(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "ICS", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.ics$/i);
    const text = await readFile((await download.path())!, "utf8");

    expect(text).toMatch(/^BEGIN:VCALENDAR/);
    expect(text.trimEnd()).toMatch(/END:VCALENDAR$/);
    const events = text.match(/BEGIN:VEVENT/g) ?? [];
    expect(events).toHaveLength(8);
    expect(text).toContain("SUMMARY:Yoga Bootcamp - Session 1");
  });

  test("exports a non-empty PDF", async ({ page }) => {
    await fillBasicSchedule(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "PDF", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const buf = await readFile((await download.path())!);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
