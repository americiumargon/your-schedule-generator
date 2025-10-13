import { addDays, getDay } from "date-fns";

interface Session {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
}

export function generateSchedule(
  startDate: Date,
  numberOfMeetings: number,
  selectedDays: number[], // 0 = Sunday, 1 = Monday, etc.
  startTime: string,
  endTime: string
): Session[] {
  const sessions: Session[] = [];
  let currentDate = new Date(startDate);
  let sessionCount = 0;

  // Sort selected days to ensure consistent ordering
  const sortedDays = [...selectedDays].sort();

  while (sessionCount < numberOfMeetings) {
    const dayOfWeek = getDay(currentDate);
    
    if (sortedDays.includes(dayOfWeek)) {
      sessions.push({
        date: new Date(currentDate),
        sessionNumber: sessionCount + 1,
        startTime,
        endTime,
      });
      sessionCount++;
    }
    
    currentDate = addDays(currentDate, 1);
  }

  return sessions;
}

export function exportToCSV(sessions: Session[], eventName: string): void {
  const headers = ["Session Number", "Date", "Day", "Start Time", "End Time"];
  const rows = sessions.map(session => [
    session.sessionNumber,
    session.date.toLocaleDateString(),
    session.date.toLocaleDateString("en-US", { weekday: "long" }),
    session.startTime,
    session.endTime,
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.join(",")),
  ].join("\n");

  downloadFile(csvContent, `${eventName || "schedule"}.csv`, "text/csv");
}

export function exportToICS(sessions: Session[], eventName: string): void {
  const formatICSDate = (date: Date, time: string): string => {
    const [hours, minutes] = time.split(":");
    const dateWithTime = new Date(date);
    dateWithTime.setHours(parseInt(hours), parseInt(minutes), 0);
    return dateWithTime.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const events = sessions.map(session => {
    const startDateTime = formatICSDate(session.date, session.startTime);
    const endDateTime = formatICSDate(session.date, session.endTime);
    
    return [
      "BEGIN:VEVENT",
      `DTSTART:${startDateTime}`,
      `DTEND:${endDateTime}`,
      `SUMMARY:${eventName} - Session ${session.sessionNumber}`,
      `DESCRIPTION:Session ${session.sessionNumber} of ${eventName}`,
      `UID:${Date.now()}-${session.sessionNumber}@schedule-generator.com`,
      "END:VEVENT",
    ].join("\r\n");
  }).join("\r\n");

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Schedule Generator//EN",
    "CALSCALE:GREGORIAN",
    events,
    "END:VCALENDAR",
  ].join("\r\n");

  downloadFile(icsContent, `${eventName || "schedule"}.ics`, "text/calendar");
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
