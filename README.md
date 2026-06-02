# Your Schedule Generator

A web app for generating recurring schedules. Built for academies, bootcamps, and anyone running multiple classes or events at once.

**Live app:** [yourschedulegenerator.netlify.app](https://yourschedulegenerator.netlify.app)

## What it does

You define your classes (days, times, recurrence pattern, start date), and it generates every session with exact dates. Then you export the schedule to CSV, ICS, PDF, or add it directly to Google Calendar.

I built this to solve my own problem: scheduling 8+ concurrent class batches at [Ruby Thalib Academy](https://rubythalib.ai), where each batch has different days, times, and session counts. Doing it manually was eating hours every month.

## Features

- **Multi-group scheduling.** Plan several classes or tracks within one project, each with its own days, times, and session count.
- **Flexible recurrence.** Weekly, biweekly, every 3 to 4 weeks, monthly by weekday (e.g. every 2nd Tuesday), or monthly by date.
- **Holiday handling.** Mark dates to skip, with the option to auto-roll sessions forward to the next available day.
- **Group dependencies.** Chain groups so one starts after another finishes.
- **Multiple time slots.** Create morning and evening sessions on the same day.
- **Export anywhere.** CSV, ICS (with reminders and timezone), PDF (with optional cover page and branding), or Google Calendar link.
- **Per-track export.** Download a ZIP with separate files for each group.
- **Copy formats.** Plain text, Markdown, or rich text to paste into docs or messages.
- **Share and draft links.** Generate a URL that loads the exact schedule config for someone else, or for yourself later.
- **PDF branding.** Add your logo, org name, tagline, accent color, and footer.
- **Bilingual.** English and Indonesian (Bahasa Indonesia).
- **Dark/light mode.**
- **Recent schedules.** Quickly reload past configurations from local storage.

## Tech stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, i18next, jsPDF, date-fns.

## Run locally

```bash
git clone https://github.com/americiumargon/your-schedule-generator.git
cd your-schedule-generator
npm install
npm run dev
```
