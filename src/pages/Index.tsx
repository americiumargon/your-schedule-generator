import { useState } from "react";
import { ScheduleForm } from "@/components/ScheduleForm";
import { ScheduleDisplay } from "@/components/ScheduleDisplay";
import { generateSchedule, exportToCSV, exportToICS } from "@/utils/scheduleGenerator";
import { Calendar } from "lucide-react";
import { toast } from "sonner";

interface Session {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
}

const Index = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [eventName, setEventName] = useState("");

  const handleGenerate = (data: {
    eventName: string;
    startDate: Date;
    numberOfMeetings: number;
    selectedDays: number[];
    startTime: string;
    endTime: string;
  }) => {
    const generatedSessions = generateSchedule(
      data.startDate,
      data.numberOfMeetings,
      data.selectedDays,
      data.startTime,
      data.endTime
    );
    setSessions(generatedSessions);
    setEventName(data.eventName);
    toast.success(`Generated ${generatedSessions.length} sessions!`);
  };

  const handleExport = (format: "csv" | "ics", enabledSessions: Session[]) => {
    if (format === "csv") {
      exportToCSV(enabledSessions, eventName);
      toast.success("Schedule exported as CSV");
    } else {
      exportToICS(enabledSessions, eventName);
      toast.success("Schedule exported as ICS");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Schedule Generator</h1>
              <p className="text-sm text-muted-foreground">
                Create event calendars in seconds
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div>
            <div className="bg-card rounded-xl shadow-lg p-6 sticky top-24">
              <h2 className="text-xl font-semibold mb-6">Event Details</h2>
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
                />
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Schedule Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Fill in the form and click "Generate Schedule" to create your event calendar
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
          <p>Built for academies, bootcamps, and event organizers</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
