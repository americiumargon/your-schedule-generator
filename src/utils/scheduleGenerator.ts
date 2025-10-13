import { addDays, getDay, format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import en from "@/locales/en.json";
import id from "@/locales/id.json";

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

function convertTo12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function exportToCSV(sessions: Session[], eventName: string, language: string = 'en'): void {
  const t = language === 'id' ? id : en;
  
  // Google Calendar CSV format headers
  const headers = [
    "Subject",
    "Start Date",
    "Start Time",
    "End Date",
    "End Time",
    "All Day Event",
    "Description",
    "Location",
    "Private"
  ];
  
  const rows = sessions.map(session => {
    const dateStr = format(session.date, "MM/dd/yyyy"); // Always use MM/DD/YYYY for Google Calendar
    const subject = `${eventName} - ${t.schedule.session} ${session.sessionNumber}`;
    const description = `${t.schedule.session} ${session.sessionNumber} ${t.export.description.split(' ')[0]} ${eventName}`;
    
    return [
      subject,
      dateStr,
      convertTo12Hour(session.startTime),
      dateStr,
      convertTo12Hour(session.endTime),
      "False",
      description,
      "",
      ""
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  downloadFile(csvContent, `${eventName || "schedule"}.csv`, "text/csv");
}

export function exportToICS(sessions: Session[], eventName: string, language: string = 'en'): void {
  const t = language === 'id' ? id : en;
  const formatICSDate = (date: Date, time: string): string => {
    const [hours, minutes] = time.split(":");
    const dateWithTime = new Date(date);
    dateWithTime.setHours(parseInt(hours), parseInt(minutes), 0);
    return dateWithTime.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const events = sessions.map(session => {
    const startDateTime = formatICSDate(session.date, session.startTime);
    const endDateTime = formatICSDate(session.date, session.endTime);
    
    const summary = t.export.summary
      .replace('{{eventName}}', eventName)
      .replace('{{sessionNumber}}', session.sessionNumber.toString());
    const description = t.export.description
      .replace('{{sessionNumber}}', session.sessionNumber.toString())
      .replace('{{eventName}}', eventName);
    
    return [
      "BEGIN:VEVENT",
      `DTSTART:${startDateTime}`,
      `DTEND:${endDateTime}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
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
