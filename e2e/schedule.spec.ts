import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

/**
 * End-to-end coverage for the Schedule Generator:
 *  - fill the form and generate a schedule
 *  - edit a session inline
 *  - export to CSV, ICS, and PDF and validate the downloaded files
 *
 * The form pre-fills a sensible start date (next Monday) and default count of 8,
 * so the minimum interaction to generate is: name + a weekday + start/end time.
 */

async function fillBasicSchedule(page: Page, name = "Yoga Bootcamp") {
  await page.goto("/");
  // Wait for the form to be hydrated.
  await expect(page.getByRole("heading", { name: "Schedule details" })).toBeVisible();

  await page.locator("#projectName").fill(name);

  // Pick Monday + Wednesday.
  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Wednesday", { exact: true }).check();

  // First time slot (only one rendered by default in essentials section).
  const timeInputs = page.locator('input[type="time"]');
  await timeInputs.nth(0).fill("09:00");
  await timeInputs.nth(1).fill("10:00");

  await page.getByRole("button", { name: "Generate schedule" }).click();

  // Schedule appears (the project name shows up as the right-pane heading).
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 10_000 });
}

test.describe("Schedule Generator E2E", () => {
  test("generates a schedule from the form", async ({ page }) => {
    await fillBasicSchedule(page);
    // The summary card shows "8" sessions (the default count).
    await expect(page.getByText(/8\s*of\s*8\s*sessions selected/i)).toBeVisible();
    // The table has 8 data rows.
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(8);
  });

  test("edits a session and persists the change", async ({ page }) => {
    await fillBasicSchedule(page);

    const firstRow = page.locator("table tbody tr").first();
    const originalTime = await firstRow.locator("td").nth(3).innerText();

    await firstRow.getByRole("button", { name: "Edit session" }).click();

    // The popover exposes its own time inputs labelled Start time / End time.
    const popover = page.getByRole("dialog").or(page.locator('[role="dialog"]'));
    const startTime = page.locator('input[type="time"]').last().locator("xpath=preceding::input[@type='time'][1]");
    // Simpler: target by label inside the popover.
    await page.getByLabel("Start time").last().fill("11:30");
    await page.getByLabel("End time").last().fill("12:45");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // Sonner toast appears.
    await expect(page.getByText("Session updated")).toBeVisible();

    const newTime = await firstRow.locator("td").nth(3).innerText();
    expect(newTime).not.toBe(originalTime);
    expect(newTime).toMatch(/11:30/);
  });

  test("exports CSV with Google Calendar headers", async ({ page }) => {
    await fillBasicSchedule(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "CSV", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    const path = await download.path();
    const text = await readFile(path!, "utf8");
    const firstLine = text.split("\n")[0];
    expect(firstLine).toBe(
      "Subject,Start Date,Start Time,End Date,End Time,All Day Event,Description,Location,Private"
    );
    // 1 header + 8 sessions.
    expect(text.trim().split("\n")).toHaveLength(9);
    expect(text).toContain("Yoga Bootcamp");
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
    // PDF magic header.
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
