import { useState } from "react";
import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Session {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
}

interface ScheduleDisplayProps {
  eventName: string;
  sessions: Session[];
  onExport: (format: "csv" | "ics", enabledSessions: Session[], language: string) => void;
}

export function ScheduleDisplay({ eventName, sessions, onExport }: ScheduleDisplayProps) {
  const { t, i18n } = useTranslation();
  const [enabledSessions, setEnabledSessions] = useState<Set<number>>(
    new Set(sessions.map((_, idx) => idx))
  );

  const dateLocale = i18n.language === 'id' ? idLocale : enUS;

  const toggleSession = (index: number) => {
    setEnabledSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getEnabledSessions = () => {
    return sessions.filter((_, idx) => enabledSessions.has(idx));
  };

  const handleExport = (format: "csv" | "ics") => {
    const enabled = getEnabledSessions();
    if (enabled.length === 0) {
      toast.error(t('export.errorNoSessions'));
      return;
    }
    onExport(format, enabled, i18n.language);
  };

  const enabledCount = enabledSessions.size;
  const allSelected = enabledCount === sessions.length;
  const someSelected = enabledCount > 0 && enabledCount < sessions.length;

  const toggleAll = () => {
    if (allSelected) {
      setEnabledSessions(new Set());
    } else {
      setEnabledSessions(new Set(sessions.map((_, idx) => idx)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{eventName || t('schedule.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('schedule.sessionsSelected', { count: enabledCount, total: sessions.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            {t('schedule.csvButton')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("ics")}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            {t('schedule.icsButton')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 pb-2 border-b">
        <Checkbox
          checked={allSelected}
          onCheckedChange={toggleAll}
          ref={(ref) => {
            if (ref) {
              (ref as any).indeterminate = someSelected;
            }
          }}
        />
        <label className="text-sm font-medium cursor-pointer" onClick={toggleAll}>
          {allSelected ? t('schedule.deselectAll') : t('schedule.selectAll')}
        </label>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
        {sessions.map((session, index) => {
          const isEnabled = enabledSessions.has(index);
          return (
            <Card
              key={index}
              className={cn(
                "p-4 flex items-center justify-between transition-all hover:shadow-md",
                !isEnabled && "opacity-50"
              )}
            >
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={isEnabled}
                  onCheckedChange={() => toggleSession(index)}
                />
                <div>
                  <div className="font-medium">
                    {t('schedule.session')} {session.sessionNumber}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(session.date, "EEEE, MMMM d, yyyy", { locale: dateLocale })}
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {session.startTime} - {session.endTime}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
