import { useState } from "react";
import { ScheduleForm } from "@/components/ScheduleForm";
import { ScheduleDisplay } from "@/components/ScheduleDisplay";
import { LanguageToggle } from "@/components/LanguageToggle";
import { generateSchedule, exportToCSV, exportToICS } from "@/utils/scheduleGenerator";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Session {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
}

const Index = () => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [eventName, setEventName] = useState("");

  const handleGenerate = (data: {
    eventName: string;
    startDate: Date;
    numberOfMeetings: number;
    selectedDays: number[];
    startTime: string;
    endTime: string;
    holidays: Date[];
  }) => {
    const generatedSessions = generateSchedule(
      data.startDate,
      data.numberOfMeetings,
      data.selectedDays,
      data.startTime,
      data.endTime,
      data.holidays
    );
    setSessions(generatedSessions);
    setEventName(data.eventName);
    toast.success(t('toast.generated', { count: generatedSessions.length }));
  };

  const handleExport = (format: "csv" | "ics", enabledSessions: Session[], language: string) => {
    if (format === "csv") {
      exportToCSV(enabledSessions, eventName, language);
      toast.success(t('export.successCsv'));
    } else {
      exportToICS(enabledSessions, eventName, language);
      toast.success(t('export.successIcs'));
    }
  };

  const handleClear = () => {
    setSessions([]);
    setEventName("");
    toast.success(t('toast.cleared'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
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
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div>
            <div className="bg-card rounded-xl shadow-lg p-6 sticky top-24">
              <h2 className="text-xl font-semibold mb-6">{t('form.title')}</h2>
              <ScheduleForm onGenerate={handleGenerate} />
            </div>
          </div>

          {/* Right Column - Results */}
          <div>
            <div className="bg-card rounded-xl shadow-lg p-6">
              {sessions.length > 0 ? (
                <ScheduleDisplay
                  eventName={eventName}
                  sessions={sessions}
                  onExport={handleExport}
                  onClear={handleClear}
                />
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t('emptyState.title')}</h3>
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
      <footer className="border-t mt-16 py-8 bg-card/50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>{t('footer.text')}</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
