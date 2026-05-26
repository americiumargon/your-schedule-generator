import { useEffect, useState } from "react";
import { ScheduleForm, type FormTimeSlot } from "@/components/ScheduleForm";
import { ScheduleDisplay } from "@/components/ScheduleDisplay";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { generateSchedule, exportToCSV, exportToICS } from "@/utils/scheduleGenerator";
import { Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  buildShareUrl,
  decodeShareState,
  readShareTokenFromHash,
  type ShareFormState,
} from "@/utils/shareLink";

interface Session {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  slotLabel?: string;
  rolledFrom?: Date;
}

const Index = () => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [eventName, setEventName] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState<number>(0);
  const [timezone, setTimezone] = useState<string>(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
  });
  const [lastFormState, setLastFormState] = useState<ShareFormState | null>(null);
  const [initialFormState, setInitialFormState] = useState<ShareFormState | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const token = readShareTokenFromHash();
    if (token) {
      const decoded = decodeShareState(token);
      if (decoded) {
        setInitialFormState(decoded);
        toast.success(t('toast.loadedFromLink'));
      } else {
        toast.error(t('toast.linkInvalid'));
      }
      try {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch {
        // ignore
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = (data: {
    eventName: string;
    startDate: Date;
    selectedDays: number[];
    timeSlots: FormTimeSlot[];
    holidays: Date[];
    holidayBehavior: "skip" | "rollForward";
    recurrence:
      | { type: "weekly"; interval: number }
      | { type: "monthlyByWeekday"; ordinals: number[] }
      | { type: "monthlyByDate"; daysOfMonth: number[] };
    mode: "count" | "endDate";
    numberOfMeetings?: number;
    endDate?: Date;
    location?: string;
    notes?: string;
    reminderMinutes?: number;
    timezone?: string;
  }) => {
    const generatedSessions = generateSchedule({
      startDate: data.startDate,
      selectedDays: data.selectedDays,
      timeSlots: data.timeSlots,
      holidays: data.holidays,
      holidayBehavior: data.holidayBehavior,
      recurrence: data.recurrence,
      mode: data.mode,
      numberOfMeetings: data.numberOfMeetings,
      endDate: data.endDate,
    });
    if (generatedSessions.length === 0) {
      toast.error(t('form.validation.noSessionsInRange'));
      return;
    }
    const tz = data.timezone ?? timezone;
    setSessions(generatedSessions);
    setEventName(data.eventName);
    setLocation(data.location ?? "");
    setNotes(data.notes ?? "");
    setReminderMinutes(data.reminderMinutes ?? 0);
    if (data.timezone) setTimezone(data.timezone);
    setLastFormState({
      eventName: data.eventName,
      startDate: data.startDate,
      mode: data.mode,
      numberOfMeetings: data.numberOfMeetings,
      endDate: data.endDate,
      selectedDays: data.selectedDays,
      timeSlots: data.timeSlots,
      holidays: data.holidays,
      holidayBehavior: data.holidayBehavior,
      recurrence: data.recurrence,
      location: data.location,
      notes: data.notes,
      reminderMinutes: data.reminderMinutes ?? 0,
      timezone: tz,
    });
    toast.success(t('toast.generated', { count: generatedSessions.length }));
  };

  const handleExport = (format: "csv" | "ics", enabledSessions: Session[], language: string) => {
    const opts = { location, notes, reminderMinutes, timezone };
    if (format === "csv") {
      exportToCSV(enabledSessions, eventName, language, opts);
      toast.success(t('export.successCsv'));
    } else {
      exportToICS(enabledSessions, eventName, language, opts);
      toast.success(t('export.successIcs'));
    }
  };

  const handleShare = async () => {
    if (!lastFormState) return;
    try {
      const url = buildShareUrl(lastFormState);
      await navigator.clipboard.writeText(url);
      toast.success(t('toast.linkCopied'));
    } catch {
      toast.error(t('toast.linkCopyFailed'));
    }
  };

  const handleClear = () => {
    if (sessions.length === 0) return;
    const prevSessions = sessions;
    const prevName = eventName;
    const prevLocation = location;
    const prevNotes = notes;
    const prevReminder = reminderMinutes;
    setSessions([]);
    setEventName("");
    setLocation("");
    setNotes("");
    setReminderMinutes(0);
    toast.success(t('toast.cleared'), {
      action: {
        label: t('toast.undo'),
        onClick: () => {
          setSessions(prevSessions);
          setEventName(prevName);
          setLocation(prevLocation);
          setNotes(prevNotes);
          setReminderMinutes(prevReminder);
        },
      },
      duration: 6000,
    });
  };

  const handleUpdateSession = (
    index: number,
    updated: { date: Date; startTime: string; endTime: string }
  ) => {
    const prev = sessions;
    const next = sessions.map((s, i) =>
      i === index ? { ...s, ...updated } : s
    );
    setSessions(next);
    toast.success(t('toast.sessionUpdated'), {
      action: {
        label: t('toast.undo'),
        onClick: () => setSessions(prev),
      },
      duration: 6000,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 print:hidden">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t('header.title')}</h1>
                <p className="text-sm text-muted-foreground">
                  {t('header.subtitle')}
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 print:block">
          {/* Left Column - Form */}
          <div className="print:hidden">
            <div className="bg-card rounded-xl shadow-lg p-6 sticky top-24">
              <h2 className="text-xl font-semibold mb-6">{t('form.title')}</h2>
              {hydrated && (
                <ScheduleForm onGenerate={handleGenerate} initialState={initialFormState} />
              )}
            </div>
          </div>

          {/* Right Column - Results */}
          <div>
            <div className="bg-card rounded-xl shadow-lg p-6 print:shadow-none print:p-0">
              {/* Header - Always visible */}
              <div className="flex items-center justify-between mb-6 print:hidden">
                <h2 className="text-xl font-semibold">
                  {sessions.length > 0 ? eventName || t('schedule.title') : t('emptyState.title')}
                </h2>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClear}
                  disabled={sessions.length === 0}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('schedule.clearAll')}
                </Button>
              </div>

              {/* Content */}
              {sessions.length > 0 ? (
                <ScheduleDisplay
                  eventName={eventName}
                  location={location}
                  notes={notes}
                  timezone={timezone}
                  sessions={sessions}
                  onExport={handleExport}
                  onClear={handleClear}
                  onUpdateSession={handleUpdateSession}
                  onShare={lastFormState ? handleShare : undefined}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('emptyState.description')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8 bg-card/50 print:hidden">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>{t('footer.text')}</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
