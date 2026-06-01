import { useEffect, useRef, useState } from "react";
import { ScheduleForm } from "@/components/ScheduleForm";
import { ScheduleDisplay } from "@/components/ScheduleDisplay";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RecentSchedules } from "@/components/RecentSchedules";
import { BrandingSection } from "@/components/BrandingSection";
import { Button } from "@/components/ui/button";
import { exportToCSV, exportToICS } from "@/utils/scheduleGenerator";
import { exportToPDF } from "@/utils/pdfExport";
import { generateProject, type TrackedSession } from "@/utils/projectGenerator";
import { loadBranding } from "@/utils/branding";
import { Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  buildShareUrl,
  buildDraftUrl,
  decodeShareState,
  readShareTokenFromHash,
  type ShareFormState,
  type DraftFormState,
} from "@/utils/shareLink";
import { saveRecent } from "@/utils/recentSchedules";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { ProjectState, Track } from "@/utils/tracks";
import { exportPerTrackZip } from "@/utils/perTrackExport";

const Index = () => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<TrackedSession[]>([]);
  const [byTrack, setByTrack] = useState<Record<string, TrackedSession[]>>({});
  const [tracks, setTracks] = useState<Track[]>([]);
  const [projectName, setProjectName] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState<number>(0);
  const [timezone, setTimezone] = useState<string>(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
  });
  const [lastFormState, setLastFormState] = useState<ShareFormState | null>(null);
  const [initialFormState, setInitialFormState] = useState<ShareFormState | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);
  const [recentRefresh, setRecentRefresh] = useState(0);
  const formColumnRef = useRef<HTMLDivElement>(null);

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

  const handleGenerate = (project: ProjectState) => {
    const result = generateProject(project);
    if (result.combined.length === 0) {
      toast.error(t('form.validation.noSessionsInRange'));
      return;
    }
    setSessions(result.combined);
    setByTrack(result.byTrack);
    setTracks(project.tracks);
    setProjectName(project.projectName);
    setReminderMinutes(project.reminderMinutes);
    setTimezone(project.timezone);
    setLastFormState(project);
    saveRecent(project.projectName, project);
    setRecentRefresh((n) => n + 1);
    toast.success(t('toast.generated', { count: result.combined.length }));
  };

  const handleLoadRecent = (state: ShareFormState) => {
    setInitialFormState({ ...state });
    setSessions([]);
    requestAnimationFrame(() => {
      formColumnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleExport = async (
    format: "csv" | "ics" | "pdf",
    enabledSessions: TrackedSession[],
    language: string,
    scope: "combined" | "perTrack" = "combined",
  ) => {
    const hasMultipleTracks = new Set(enabledSessions.map((s) => s.trackId)).size > 1;
    const opts = { reminderMinutes, timezone, includeTrackColumn: hasMultipleTracks };
    const branding = loadBranding();
    if (scope === "perTrack" && hasMultipleTracks) {
      // Filter byTrack to only enabled sessions
      const enabledIds = new Set(enabledSessions.map((s) => `${s.trackId}#${s.sessionNumber}`));
      const enabledByTrack: Record<string, TrackedSession[]> = {};
      for (const tr of tracks) {
        const list = (byTrack[tr.id] ?? []).filter((s) =>
          enabledSessions.some(
            (e) => e.trackId === s.trackId && e.date.getTime() === s.date.getTime() && e.startTime === s.startTime,
          ),
        );
        if (list.length > 0) enabledByTrack[tr.id] = list;
      }
      void enabledIds;
      await exportPerTrackZip(enabledByTrack, tracks, projectName, format, opts, branding, t, language);
      toast.success(
        format === "csv" ? t('export.successCsv') : format === "ics" ? t('export.successIcs') : t('export.successPdf'),
      );
      return;
    }
    if (format === "csv") {
      exportToCSV(enabledSessions, projectName, language, opts);
      toast.success(t('export.successCsv'));
    } else if (format === "ics") {
      exportToICS(enabledSessions, projectName, language, opts);
      toast.success(t('export.successIcs'));
    } else {
      exportToPDF(enabledSessions, projectName, language, opts, branding, t);
      toast.success(t('export.successPdf'));
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

  const handleSaveDraft = async (draft: DraftFormState) => {
    try {
      const url = buildDraftUrl(draft);
      await navigator.clipboard.writeText(url);
      toast.success(t('toast.draftLinkCopied'));
    } catch {
      toast.error(t('toast.linkCopyFailed'));
    }
  };

  const handleClear = () => {
    if (sessions.length === 0) return;
    const prevSessions = sessions;
    const prevName = projectName;
    const prevReminder = reminderMinutes;
    setSessions([]);
    setProjectName("");
    setReminderMinutes(0);
    toast.success(t('toast.cleared'), {
      action: {
        label: t('toast.undo'),
        onClick: () => {
          setSessions(prevSessions);
          setProjectName(prevName);
          setReminderMinutes(prevReminder);
        },
      },
      duration: 6000,
    });
  };

  const handleUpdateSession = (
    index: number,
    updated: {
      date: Date;
      startTime: string;
      endTime: string;
      location?: string;
      notes?: string;
    }
  ) => {
    const prev = sessions;
    const next = sessions.map((s, i) =>
      i === index
        ? {
            ...s,
            date: updated.date,
            startTime: updated.startTime,
            endTime: updated.endTime,
            location: updated.location,
            notes: updated.notes,
          }
        : s
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

  useKeyboardShortcuts([
    {
      key: "Escape",
      handler: () => {
        if (sessions.length === 0) return;
        if (document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"][data-state="open"]')) return;
        handleClear();
      },
    },
  ]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 print:hidden">
        <div className="container mx-auto px-4 py-4 lg:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
                <Calendar className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold">{t('header.title')}</h1>
                <p className="text-xs lg:text-sm text-muted-foreground">
                  {t('header.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <LanguageToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 lg:py-8">
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-8 print:block">
          {/* Left Column - Form */}
          <div className="print:hidden space-y-4" ref={formColumnRef}>
            <div className="bg-card rounded-xl shadow-lg p-4 lg:p-6 lg:sticky lg:top-24 space-y-4">
              <h2 className="text-xl font-semibold">{t('form.title')}</h2>
              {hydrated && (
                <ScheduleForm onGenerate={handleGenerate} onSaveDraft={handleSaveDraft} initialState={initialFormState} />
              )}
              <BrandingSection />
            </div>
          </div>

          {/* Right Column - Results */}
          <div>
            <div className="bg-card rounded-xl shadow-lg p-4 lg:p-6 print:shadow-none print:p-0">
              {/* Header - Always visible */}
              <div className="flex items-center justify-between mb-6 print:hidden">
                <h2 className="text-xl font-semibold">
                  {sessions.length > 0 ? projectName || t('schedule.title') : t('emptyState.title')}
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
                  eventName={projectName}
                  timezone={timezone}
                  sessions={sessions}
                  onExport={handleExport}
                  onClear={handleClear}
                  onUpdateSession={handleUpdateSession}
                  onShare={lastFormState ? handleShare : undefined}
                />
              ) : (
                <div>
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('emptyState.description')}
                    </p>
                  </div>
                  <RecentSchedules onLoad={handleLoadRecent} refreshKey={recentRefresh} />
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
