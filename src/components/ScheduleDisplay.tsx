import { useEffect, useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { enUS, id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClockTimePicker } from "@/components/ui/clock-time-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Calendar, FileText, Copy, Pencil, CalendarIcon, ChevronDown, Printer, Link2, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  formatPlain,
  formatMarkdown,
  formatHtml,
  writeToClipboard,
  type CopyFormat,
} from "@/utils/copyFormats";
import { buildGoogleCalendarUrl } from "@/utils/googleCalendar";
import { LogoQuickUpload } from "@/components/LogoQuickUpload";


interface Session {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  slotLabel?: string;
  rolledFrom?: Date;
  location?: string;
  notes?: string;
  trackId?: string;
  trackName?: string;
  trackColor?: string;
}

export type ExportScope = "combined" | "perTrack";

interface ScheduleDisplayProps {
  eventName: string;
  sessions: Session[];
  location?: string;
  notes?: string;
  timezone?: string;
  onExport: (format: "csv" | "ics" | "pdf", enabledSessions: Session[], language: string, scope: ExportScope) => void;
  onClear: () => void;
  onUpdateSession?: (
    index: number,
    updated: {
      date: Date;
      startTime: string;
      endTime: string;
      location?: string;
      notes?: string;
    }
  ) => void;
  onShare?: () => void;
}

function sessionKey(s: Session) {
  return `${format(s.date, "yyyy-MM-dd")}|${s.startTime}|${s.endTime}`;
}

function EditSessionPopover({
  session,
  globalLocation,
  globalNotes,
  onSave,
}: {
  session: Session;
  globalLocation?: string;
  globalNotes?: string;
  onSave: (u: {
    date: Date;
    startTime: string;
    endTime: string;
    location?: string;
    notes?: string;
  }) => void;
}) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'id' ? idLocale : enUS;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>(session.date);
  const [startTime, setStartTime] = useState(session.startTime);
  const [endTime, setEndTime] = useState(session.endTime);
  // "" = explicit blank; undefined = inherit. Track inherit separately via a flag.
  const [locationOverride, setLocationOverride] = useState<string | undefined>(session.location);
  const [notesOverride, setNotesOverride] = useState<string | undefined>(session.notes);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDate(session.date);
      setStartTime(session.startTime);
      setEndTime(session.endTime);
      setLocationOverride(session.location);
      setNotesOverride(session.notes);
    }
    setOpen(next);
  };

  const handleSave = () => {
    if (!date || !startTime || !endTime) return;
    onSave({
      date,
      startTime,
      endTime,
      location: locationOverride,
      notes: notesOverride,
    });
    setOpen(false);
  };

  const locationPlaceholder = globalLocation
    ? t('schedule.useDefaultPlaceholder', { value: globalLocation })
    : t('form.locationPlaceholder');
  const notesPlaceholder = globalNotes
    ? t('schedule.useDefaultPlaceholder', {
        value: globalNotes.length > 40 ? `${globalNotes.slice(0, 40)}…` : globalNotes,
      })
    : t('form.notesPlaceholder');

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 print:hidden"
          aria-label={t('schedule.editSession')}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4" align="end">
        <div className="space-y-2">
          <Label>{t('form.startDate')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "PPP", { locale: dateLocale })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarUI
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>{t('form.startTime')}</Label>
            <ClockTimePicker value={startTime} onChange={setStartTime} />
          </div>
          <div className="space-y-2">
            <Label>{t('form.endTime')}</Label>
            <ClockTimePicker value={endTime} onChange={setEndTime} />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('schedule.locationOverrideLabel')}</Label>
            {locationOverride !== undefined && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setLocationOverride(undefined)}
              >
                {t('schedule.clearOverride')}
              </button>
            )}
          </div>
          <Input
            value={locationOverride ?? ""}
            placeholder={locationPlaceholder}
            onChange={(e) => setLocationOverride(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('schedule.notesOverrideLabel')}</Label>
            {notesOverride !== undefined && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setNotesOverride(undefined)}
              >
                {t('schedule.clearOverride')}
              </button>
            )}
          </div>
          <Textarea
            value={notesOverride ?? ""}
            placeholder={notesPlaceholder}
            onChange={(e) => setNotesOverride(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            {t('schedule.cancel')}
          </Button>
          <Button size="sm" onClick={handleSave}>
            {t('schedule.save')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ScheduleDisplay({ eventName, sessions, location, notes, timezone, onExport, onClear, onUpdateSession, onShare }: ScheduleDisplayProps) {
  const { t, i18n } = useTranslation();
  const [enabledSessions, setEnabledSessions] = useState<Set<number>>(
    new Set(sessions.map((_, idx) => idx))
  );
  const [originalKeys] = useState<string[]>(() => sessions.map(sessionKey));

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

  const [exportScope, setExportScope] = useState<ExportScope>("combined");
  const handleExport = (format: "csv" | "ics" | "pdf", scope: ExportScope = exportScope) => {
    const enabled = getEnabledSessions();
    if (enabled.length === 0) {
      toast.error(t('export.errorNoSessions'));
      return;
    }
    onExport(format, enabled, i18n.language, scope);
  };

  const [copyFormat, setCopyFormat] = useState<CopyFormat>("markdown");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("schedule.copyFormat");
      if (stored === "plain" || stored === "markdown" || stored === "rich") {
        setCopyFormat(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleCopy = async (fmt: CopyFormat = copyFormat) => {
    const enabled = getEnabledSessions();
    if (enabled.length === 0) {
      toast.error(t('export.errorNoSessions'));
      return;
    }
    const loc = location || undefined;
    const nts = notes || undefined;
    try {
      if (fmt === "plain") {
        const text = formatPlain(eventName, enabled, loc, nts, t, i18n.language);
        await writeToClipboard("plain", text);
        toast.success(t('toast.copiedPlain'));
      } else if (fmt === "markdown") {
        const text = formatMarkdown(eventName, enabled, loc, nts, t, i18n.language);
        await writeToClipboard("markdown", text);
        toast.success(t('toast.copiedMarkdown'));
      } else {
        const html = formatHtml(eventName, enabled, loc, nts, t, i18n.language);
        const text = formatPlain(eventName, enabled, loc, nts, t, i18n.language);
        await writeToClipboard("rich", text, html);
        toast.success(t('toast.copiedRich'));
      }
      setCopyFormat(fmt);
      try { localStorage.setItem("schedule.copyFormat", fmt); } catch { /* ignore */ }
    } catch {
      toast.error(t('toast.copyFailed'));
    }
  };


  const enabledCount = enabledSessions.size;
  const allSelected = enabledCount === sessions.length;
  const someSelected = enabledCount > 0 && enabledCount < sessions.length;
  const isMultiTrack = new Set(sessions.map((s) => s.trackId).filter(Boolean)).size > 1;

  const enabledList = getEnabledSessions();
  const firstDate = enabledList[0]?.date;
  const lastDate = enabledList[enabledList.length - 1]?.date;
  const spanDays = firstDate && lastDate ? differenceInCalendarDays(lastDate, firstDate) + 1 : 0;
  const spanWeeks = spanDays > 0 ? Math.ceil(spanDays / 7) : 0;

  const handlePrint = () => {
    if (enabledList.length === 0) {
      toast.error(t('export.errorNoSessions'));
      return;
    }
    window.print();
  };

  const handleAddToGoogle = () => {
    if (enabledList.length === 0) {
      toast.error(t('export.errorNoSessions'));
      return;
    }
    const result = buildGoogleCalendarUrl(eventName, enabledList, location, notes, timezone);
    if ('reason' in result) {
      if (result.reason === "too_many") toast.error(t('toast.gcalTooMany'));
      else if (result.reason === "not_representable") toast.error(t('toast.gcalNotRepresentable'));
      return;
    }
    window.open(result.url, '_blank', 'noopener,noreferrer');
  };

  const toggleAll = () => {
    if (allSelected) {
      setEnabledSessions(new Set());
    } else {
      setEnabledSessions(new Set(sessions.map((_, idx) => idx)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Print-only header */}
      <div className="hidden print:block space-y-1">
        <h1 className="text-2xl font-bold">{eventName}</h1>
        {location && <div className="text-sm">📍 {location}</div>}
        {firstDate && lastDate && (
          <div className="text-sm">
            {format(firstDate, "MMM d", { locale: dateLocale })} – {format(lastDate, "MMM d, yyyy", { locale: dateLocale })}
            {" · "}
            {enabledList.length} {t('summary.totalSessions')}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <p className="text-sm text-muted-foreground">
          {t('schedule.sessionsSelected', { count: enabledCount, total: sessions.length })}
        </p>
        <div className="flex gap-2 flex-wrap">
          <div className="inline-flex rounded-md shadow-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy()}
              className="gap-2 rounded-r-none border-r-0"
            >
              <Copy className="h-4 w-4" />
              {t('schedule.copyButton')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-l-none px-2"
                  aria-label={t('schedule.copyAs')}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('schedule.copyAs')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleCopy('plain')}>
                  {t('schedule.copyFormatPlain')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopy('markdown')}>
                  {t('schedule.copyFormatMarkdown')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopy('rich')}>
                  {t('schedule.copyFormatRich')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isMultiTrack && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {exportScope === "combined"
                    ? t('schedule.exportScopeCombined')
                    : t('schedule.exportScopePerTrack')}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('schedule.exportScope')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setExportScope("combined")}>
                  {t('schedule.exportScopeCombined')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setExportScope("perTrack")}>
                  {t('schedule.exportScopePerTrack')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            {t('schedule.pdfButton')}
          </Button>
          <LogoQuickUpload />



          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            {t('schedule.printButton')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddToGoogle}
            className="gap-2"
          >
            <CalendarPlus className="h-4 w-4" />
            {t('schedule.googleButton')}
          </Button>
          {onShare && (
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              className="gap-2"
            >
              <Link2 className="h-4 w-4" />
              {t('schedule.shareButton')}
            </Button>
          )}
        </div>
      </div>

      {enabledList.length > 0 && firstDate && lastDate && (
        <Card className="p-4 bg-secondary/30 grid grid-cols-3 gap-3 text-center print:hidden">
          <div>
            <div className="text-2xl font-semibold">{enabledList.length}</div>
            <div className="text-xs text-muted-foreground">{t('summary.totalSessions')}</div>
          </div>
          <div>
            <div className="text-sm font-medium">
              {format(firstDate, "MMM d", { locale: dateLocale })} – {format(lastDate, "MMM d, yyyy", { locale: dateLocale })}
            </div>
            <div className="text-xs text-muted-foreground">{t('summary.dateSpan')}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{spanWeeks}</div>
            <div className="text-xs text-muted-foreground">{t('summary.weeks', { count: spanWeeks })}</div>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2 pb-2 border-b print:hidden">
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

      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 print:max-h-none print:overflow-visible print:pr-0">
        {sessions.map((session, index) => {
          const isEnabled = enabledSessions.has(index);
          const isEdited =
            originalKeys[index] !== undefined &&
            originalKeys[index] !== sessionKey(session);
          return (
            <Card
              key={index}
              className={cn(
                "p-4 flex items-center justify-between transition-all hover:shadow-md gap-3 print-session",
                !isEnabled && "opacity-50 print:hidden"
              )}
            >
              <div className="flex items-center gap-4 min-w-0">
                <Checkbox
                  checked={isEnabled}
                  onCheckedChange={() => toggleSession(index)}
                  className="print:hidden"
                />
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {isMultiTrack && session.trackName && (
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded border"
                        style={{ borderColor: session.trackColor, color: session.trackColor }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: session.trackColor }}
                          aria-hidden
                        />
                        {session.trackName}
                      </span>
                    )}
                    <span>{t('schedule.session')} {session.sessionNumber}</span>
                    {isEdited && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground border border-accent/30">
                        {t('schedule.editedBadge')}
                      </span>
                    )}
                    {session.location !== undefined && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground border border-accent/30">
                        📍 {t('schedule.overrideBadge')}
                      </span>
                    )}
                    {session.notes !== undefined && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground border border-accent/30">
                        📝 {t('schedule.overrideBadge')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(session.date, "EEEE, MMMM d, yyyy", { locale: dateLocale })}
                  </div>
                  {(session.location ?? location) && (
                    <div className="text-xs text-muted-foreground/80 mt-0.5 truncate max-w-[280px]">
                      📍 {session.location ?? location}
                    </div>
                  )}
                  {session.rolledFrom && (
                    <div className="text-xs text-muted-foreground/80 italic mt-0.5">
                      {t('schedule.rolledFromBadge')} {format(session.rolledFrom, "MMM d", { locale: dateLocale })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  {session.slotLabel && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-medium">
                      {session.slotLabel}
                    </span>
                  )}
                  <span>{session.startTime} - {session.endTime}</span>
                </div>
                {onUpdateSession && (
                  <EditSessionPopover
                    session={session}
                    globalLocation={location}
                    globalNotes={notes}
                    onSave={(u) => onUpdateSession(index, u)}
                  />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {notes && (
        <div className="hidden print:block border border-border p-3 text-sm whitespace-pre-wrap">
          {notes}
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
