Update the app subtitle in both locale files to accurately reflect that the tool generates a fixed schedule of sessions (not open-ended recurring events).

## Changes

**`src/locales/en.json`**
- Change `header.subtitle` from "Create recurring schedules for any activity" to "Generate a schedule of sessions for any activity"

**`src/locales/id.json`**
- Change `header.subtitle` from "Buat jadwal berulang untuk aktivitas apa pun" to a matching Indonesian translation: "Buat jadwal sesi untuk aktivitas apa pun"

## Why
The current wording "recurring schedules" implies open-ended repetition (e.g., "every Monday forever"), but the app actually generates a finite list of dated sessions from a start date. The new wording better matches the actual behavior.