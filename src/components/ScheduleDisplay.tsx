import { useEffect, useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Download, Calendar, FileText, Copy, Pencil, CalendarIcon, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  formatPlain,
  formatMarkdown,
  formatHtml,
  writeToClipboard,
  type CopyFormat,
} from "@/utils/copyFormats";


interface Session {
  date: Date;
  sessionNumber: number;
  startTime: string;
  endTime: string;
}

interface ScheduleDisplayProps {
  eventName: string;
  sessions: Session[];
  location?: string;
  notes?: string;
  onExport: (format: "csv" | "ics", enabledSessions: Session[], language: string) => void;
  onClear: () => void;
  onUpdateSession?: (
    index: number,
    updated: { date: Date; startTime: string; endTime: string }
  ) => void;
}

function sessionKey(s: Session) {
  return `${format(s.date, "yyyy-MM-dd")}|${s.startTime}|${s.endTime}`;
}

function EditSessionPopover({
  session,
  onSave,
}: {
  session: Session;
  onSave: (u: { date: Date; startTime: string; endTime: string }) => void;
}) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'id' ? idLocale : enUS;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>(session.date);
  const [startTime, setStartTime] = useState(session.startTime);
  const [endTime, setEndTime] = useState(session.endTime);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDate(session.date);
      setStartTime(session.startTime);
      setEndTime(session.endTime);
    }
    setOpen(next);
  };

  const handleSave = () => {
    if (!date || !startTime || !endTime) return;
    onSave({ date, startTime, endTime });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
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
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('form.endTime')}</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
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

export function ScheduleDisplay({ eventName, sessions, location, notes, onExport, onClear, onUpdateSession }: ScheduleDisplayProps) {
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

  const handleExport = (format: "csv" | "ics") => {
    const enabled = getEnabledSessions();
    if (enabled.length === 0) {
      toast.error(t('export.errorNoSessions'));
      return;
    }
    onExport(format, enabled, i18n.language);
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

  const enabledList = getEnabledSessions();
  const firstDate = enabledList[0]?.date;
  const lastDate = enabledList[enabledList.length - 1]?.date;
  const spanDays = firstDate && lastDate ? differenceInCalendarDays(lastDate, firstDate) + 1 : 0;
  const spanWeeks = spanDays > 0 ? Math.ceil(spanDays / 7) : 0;

  const toggleAll = () => {
    if (allSelected) {
      setEnabledSessions(new Set());
    } else {
      setEnabledSessions(new Set(sessions.map((_, idx) => idx)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
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

      {enabledList.length > 0 && firstDate && lastDate && (
        <Card className="p-4 bg-secondary/30 grid grid-cols-3 gap-3 text-center">
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
          const isEdited =
            originalKeys[index] !== undefined &&
            originalKeys[index] !== sessionKey(session);
          return (
            <Card
              key={index}
              className={cn(
                "p-4 flex items-center justify-between transition-all hover:shadow-md gap-3",
                !isEnabled && "opacity-50"
              )}
            >
              <div className="flex items-center gap-4 min-w-0">
                <Checkbox
                  checked={isEnabled}
                  onCheckedChange={() => toggleSession(index)}
                />
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    <span>{t('schedule.session')} {session.sessionNumber}</span>
                    {isEdited && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground border border-accent/30">
                        {t('schedule.editedBadge')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(session.date, "EEEE, MMMM d, yyyy", { locale: dateLocale })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-sm text-muted-foreground">
                  {session.startTime} - {session.endTime}
                </div>
                {onUpdateSession && (
                  <EditSessionPopover
                    session={session}
                    onSave={(u) => onUpdateSession(index, u)}
                  />
                )}
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
