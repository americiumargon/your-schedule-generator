import { useMemo, useRef, useState } from "react";
import { useKeyboardShortcuts, modKeyLabel } from "@/hooks/useKeyboardShortcuts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  CalendarIcon, Check, ChevronDown, ChevronsUpDown, Clock, MapPin, Plus, Repeat, Settings2, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { TrackTabs } from "@/components/TrackTabs";
import { createTrack, newTrackId, TRACK_COLORS, type ProjectState, type Track } from "@/utils/tracks";

const WEEKDAYS = [
  { id: 1, key: "monday" }, { id: 2, key: "tuesday" }, { id: 3, key: "wednesday" },
  { id: 4, key: "thursday" }, { id: 5, key: "friday" }, { id: 6, key: "saturday" }, { id: 0, key: "sunday" },
];

const MAX_SLOTS = 6;
const MAX_TRACKS = 12;
const REMINDER_OPTIONS = [0, 5, 15, 30, 60, 1440] as const;

const FALLBACK_TIMEZONES = [
  "UTC", "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos",
  "America/Anchorage", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Mexico_City", "America/New_York", "America/Sao_Paulo", "America/Toronto",
  "Asia/Bangkok", "Asia/Dubai", "Asia/Hong_Kong", "Asia/Jakarta", "Asia/Kolkata",
  "Asia/Manila", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Melbourne", "Australia/Sydney",
  "Europe/Amsterdam", "Europe/Berlin", "Europe/Istanbul", "Europe/London",
  "Europe/Madrid", "Europe/Moscow", "Europe/Paris", "Europe/Rome",
  "Pacific/Auckland", "Pacific/Honolulu",
];

function getTimezoneList(): string[] {
  try {
    const a = Intl as any;
    if (typeof a.supportedValuesOf === "function") {
      const list = a.supportedValuesOf("timeZone") as string[];
      if (Array.isArray(list) && list.length) return list;
    }
  } catch { /* ignore */ }
  return FALLBACK_TIMEZONES;
}
function getBrowserTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

function reminderLabel(t: (k: string, o?: any) => string, minutes: number): string {
  if (minutes === 0) return t('form.reminderNone');
  if (minutes === 1440) return t('form.reminderDays', { count: 1 });
  if (minutes >= 60) return t('form.reminderHours', { count: minutes / 60 });
  return t('form.reminderMinutes', { count: minutes });
}

type Mode = "count" | "endDate";
type HolidayBehavior = "skip" | "rollForward";
type RecType = "weekly" | "monthlyByWeekday" | "monthlyByDate";

interface TimeSlotInput { startTime: string; endTime: string; label: string }

interface TrackDraft {
  id: string;
  name: string;
  color: string;
  selectedDays: number[];
  timeSlots: TimeSlotInput[];
  recurrenceType: RecType;
  weeklyInterval: number;
  ordinals: number[];
  daysOfMonth: number[];
  location: string;
  notes: string;
}

function trackToDraft(t: Track): TrackDraft {
  return {
    id: t.id,
    name: t.name,
    color: t.color,
    selectedDays: t.selectedDays,
    timeSlots: t.timeSlots.length
      ? t.timeSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime, label: s.label ?? "" }))
      : [{ startTime: "", endTime: "", label: "" }],
    recurrenceType: t.recurrence.type,
    weeklyInterval: t.recurrence.type === "weekly" ? t.recurrence.interval : 1,
    ordinals: t.recurrence.type === "monthlyByWeekday" ? t.recurrence.ordinals : [1],
    daysOfMonth: t.recurrence.type === "monthlyByDate" ? t.recurrence.daysOfMonth : [1],
    location: t.location ?? "",
    notes: t.notes ?? "",
  };
}

function draftToTrack(d: TrackDraft): Track {
  const slots = d.timeSlots.map((s) => ({
    startTime: s.startTime,
    endTime: s.endTime,
    label: s.label.trim() || undefined,
  }));
  const recurrence =
    d.recurrenceType === "weekly"
      ? { type: "weekly" as const, interval: d.weeklyInterval }
      : d.recurrenceType === "monthlyByWeekday"
      ? { type: "monthlyByWeekday" as const, ordinals: [...d.ordinals].sort((a, b) => a - b) }
      : { type: "monthlyByDate" as const, daysOfMonth: [...d.daysOfMonth].sort((a, b) => a - b) };
  return {
    id: d.id,
    name: d.name.trim() || "Track",
    color: d.color,
    selectedDays: d.selectedDays,
    timeSlots: slots,
    recurrence,
    location: d.location.trim() || undefined,
    notes: d.notes.trim() || undefined,
  };
}

function defaultDraft(idx = 0): TrackDraft {
  return trackToDraft(createTrack({}, idx));
}

interface Props {
  onGenerate: (project: ProjectState) => void;
  initialState?: ProjectState;
}

interface SectionHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}
function SectionHeader({ icon: Icon, title, hint }: SectionHeaderProps) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        <span>{title}</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1 ml-6">{hint}</p>}
    </div>
  );
}

export function ScheduleForm({ onGenerate, initialState }: Props) {
  const { t, i18n } = useTranslation();
  const browserTz = useMemo(() => getBrowserTimezone(), []);
  const dateLocale = i18n.language === 'id' ? idLocale : enUS;

  // Shared (project-level)
  const [projectName, setProjectName] = useState<string>(() => initialState?.projectName ?? "");
  const [startDate, setStartDate] = useState<Date | undefined>(() => initialState?.startDate);
  const [mode, setMode] = useState<Mode>(() => initialState?.mode ?? "count");
  const [numberOfMeetings, setNumberOfMeetings] = useState<string>(() =>
    initialState?.numberOfMeetings != null ? String(initialState.numberOfMeetings) : ""
  );
  const [endDate, setEndDate] = useState<Date | undefined>(() => initialState?.endDate);
  const [holidays, setHolidays] = useState<Date[]>(() => initialState?.holidays ?? []);
  const [holidayBehavior, setHolidayBehavior] = useState<HolidayBehavior>(() => initialState?.holidayBehavior ?? "skip");
  const [reminderMinutes, setReminderMinutes] = useState<number>(() => initialState?.reminderMinutes ?? 0);
  const [timezone, setTimezone] = useState<string>(() => initialState?.timezone ?? browserTz);
  const [tzOpen, setTzOpen] = useState(false);
  const timezones = useMemo(() => getTimezoneList(), []);

  // Tracks
  const [drafts, setDrafts] = useState<TrackDraft[]>(() => {
    const initial = initialState?.tracks;
    if (initial && initial.length > 0) return initial.map(trackToDraft);
    return [defaultDraft(0)];
  });
  const [activeId, setActiveId] = useState<string>(() => drafts[0].id);
  const active = drafts.find((d) => d.id === activeId) ?? drafts[0];

  const updateActive = (patch: Partial<TrackDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === active.id ? { ...d, ...patch } : d)));
  };

  const addTrack = () => {
    if (drafts.length >= MAX_TRACKS) return;
    const idx = drafts.length;
    const fresh: TrackDraft = {
      ...defaultDraft(idx),
      // Inherit the project-wide template (active track's pattern minus its specifics)
      name: `${t("tracks.newName", { defaultValue: "Class" })} ${idx + 1}`,
      color: TRACK_COLORS[idx % TRACK_COLORS.length],
    };
    setDrafts((prev) => [...prev, fresh]);
    setActiveId(fresh.id);
  };

  const renameTrack = (id: string, name: string) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
  };
  const setTrackColor = (id: string, color: string) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, color } : d)));
  };
  const duplicateTrack = (id: string) => {
    if (drafts.length >= MAX_TRACKS) return;
    const src = drafts.find((d) => d.id === id);
    if (!src) return;
    const copy: TrackDraft = {
      ...src,
      id: newTrackId(),
      name: `${src.name} (copy)`,
    };
    setDrafts((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setActiveId(copy.id);
  };
  const deleteTrack = (id: string) => {
    if (drafts.length <= 1) {
      toast.error(t("tracks.minOne"));
      return;
    }
    setDrafts((prev) => {
      const filtered = prev.filter((d) => d.id !== id);
      if (id === activeId) {
        setActiveId(filtered[0].id);
      }
      return filtered;
    });
  };

  // Per-track field shortcuts
  const selectedDays = active.selectedDays;
  const timeSlots = active.timeSlots;
  const recurrenceType = active.recurrenceType;
  const weeklyInterval = active.weeklyInterval;
  const ordinals = active.ordinals;
  const daysOfMonth = active.daysOfMonth;
  const location = active.location;
  const notes = active.notes;

  const handleDayToggle = (dayId: number) => {
    const next = selectedDays.includes(dayId)
      ? selectedDays.filter((d) => d !== dayId)
      : [...selectedDays, dayId].sort();
    updateActive({ selectedDays: next });
  };
  const updateSlot = (index: number, patch: Partial<TimeSlotInput>) => {
    updateActive({ timeSlots: timeSlots.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  };
  const addSlot = () => {
    if (timeSlots.length >= MAX_SLOTS) return;
    updateActive({ timeSlots: [...timeSlots, { startTime: "", endTime: "", label: "" }] });
  };
  const removeSlot = (index: number) => {
    if (timeSlots.length <= 1) return;
    updateActive({ timeSlots: timeSlots.filter((_, i) => i !== index) });
  };
  const toggleOrdinal = (o: number) => {
    updateActive({ ordinals: ordinals.includes(o) ? ordinals.filter((x) => x !== o) : [...ordinals, o] });
  };
  const toggleDayOfMonth = (d: number) => {
    updateActive({ daysOfMonth: daysOfMonth.includes(d) ? daysOfMonth.filter((x) => x !== d) : [...daysOfMonth, d] });
  };

  const needsWeekdays = recurrenceType === "weekly" || recurrenceType === "monthlyByWeekday";

  interface FormErrors {
    projectName?: string;
    startDate?: string;
    numberOfMeetings?: string;
    endDate?: string;
    perTrack?: Record<string, string>;
  }
  const [errors, setErrors] = useState<FormErrors>({});
  const fieldError = (msg?: string) =>
    msg ? <p className="text-sm font-medium text-destructive mt-1">{msg}</p> : null;

  const eventNameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const modLabel = modKeyLabel();
  useKeyboardShortcuts([
    { key: "Enter", mod: true, handler: () => formRef.current?.requestSubmit() },
    { key: "k", mod: true, handler: () => { eventNameRef.current?.focus(); eventNameRef.current?.select(); } },
  ]);

  const customizedCount = useMemo(() => {
    let n = 0;
    if (drafts.length > 1) n++;
    if (recurrenceType !== "weekly" || weeklyInterval !== 1) n++;
    if (timeSlots.length > 1 || (timeSlots[0]?.label?.trim() ?? "")) n++;
    if (holidays.length > 0) n++;
    if (location.trim() || notes.trim()) n++;
    if (reminderMinutes !== 0) n++;
    if (timezone !== browserTz) n++;
    return n;
  }, [drafts.length, recurrenceType, weeklyInterval, timeSlots, holidays, location, notes, reminderMinutes, timezone, browserTz]);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(() => {
    if (!initialState) return false;
    if (initialState.tracks.length > 1) return true;
    const tr = initialState.tracks[0];
    if (tr?.recurrence && tr.recurrence.type !== "weekly") return true;
    if (tr?.recurrence?.type === "weekly" && tr.recurrence.interval !== 1) return true;
    if ((tr?.timeSlots?.length ?? 0) > 1) return true;
    if (initialState.holidays.length > 0) return true;
    if (tr?.location || tr?.notes) return true;
    if (initialState.reminderMinutes !== 0) return true;
    return false;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: FormErrors = {};
    const trimmedProject = projectName.trim();
    if (!trimmedProject) next.projectName = t("form.validation.projectNameRequired");
    if (!startDate) next.startDate = t('form.validation.dateRequired');

    if (mode === "count") {
      const parsed = parseInt(numberOfMeetings);
      if (!numberOfMeetings || isNaN(parsed) || parsed < 1) {
        next.numberOfMeetings = t('form.validation.meetingsRequired');
      }
    } else if (!endDate) {
      next.endDate = t('form.validation.endDateRequired');
    } else if (startDate && endDate < startDate) {
      next.endDate = t('form.validation.endDateAfterStart');
    }

    const perTrack: Record<string, string> = {};
    for (const d of drafts) {
      if (!d.name.trim()) {
        perTrack[d.id] = t("form.validation.eventNameRequired");
        continue;
      }
      const tNeedsWeekdays = d.recurrenceType !== "monthlyByDate";
      if (tNeedsWeekdays && d.selectedDays.length === 0) {
        perTrack[d.id] = t('form.validation.daysRequired');
        continue;
      }
      if (d.recurrenceType === "monthlyByWeekday" && d.ordinals.length === 0) {
        perTrack[d.id] = t('form.validation.ordinalsRequired');
        continue;
      }
      if (d.recurrenceType === "monthlyByDate" && d.daysOfMonth.length === 0) {
        perTrack[d.id] = t('form.validation.daysOfMonthRequired');
        continue;
      }
      if (d.timeSlots.some((s) => !s.startTime || !s.endTime || s.startTime >= s.endTime)) {
        perTrack[d.id] = t('form.validation.timeRequired');
        continue;
      }
    }

    if (Object.keys(perTrack).length > 0) {
      next.perTrack = perTrack;
      // Switch to first errored track
      const firstErrId = Object.keys(perTrack)[0];
      setActiveId(firstErrId);
    }

    if (next.projectName || next.startDate || next.numberOfMeetings || next.endDate || next.perTrack) {
      setErrors(next);
      requestAnimationFrame(() => {
        const firstInvalid = document.querySelector<HTMLElement>('[data-invalid="true"]');
        firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid?.focus?.();
      });
      // surface track-level error
      const firstTrackErr = perTrack[Object.keys(perTrack)[0] ?? ""];
      if (firstTrackErr) toast.error(firstTrackErr);
      return;
    }

    setErrors({});
    const project: ProjectState = {
      projectName: trimmedProject,
      startDate: startDate!,
      mode,
      numberOfMeetings: mode === "count" ? parseInt(numberOfMeetings) : undefined,
      endDate: mode === "endDate" ? endDate : undefined,
      holidays,
      holidayBehavior,
      reminderMinutes,
      timezone,
      tracks: drafts.map(draftToTrack),
    };
    onGenerate(project);
  };

  const firstSlot = timeSlots[0];
  const extraSlots = timeSlots.slice(1);
  const trackErr = errors.perTrack?.[active.id];

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-8 pb-4 lg:pb-0">
      {/* ===================== ESSENTIALS ===================== */}
      <div className="space-y-5">
        {/* Project name */}
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="projectName">{t('form.projectName')}</Label>
            <kbd className="hidden sm:inline-flex text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
              {modLabel}+K
            </kbd>
          </div>
          <Input
            id="projectName"
            ref={eventNameRef}
            value={projectName}
            onChange={(e) => { setProjectName(e.target.value); setErrors((p) => ({ ...p, projectName: undefined })); }}
            placeholder={t('form.projectNamePlaceholder')}
            data-invalid={!!errors.projectName}
            aria-invalid={!!errors.projectName}
            className={cn("mt-2", errors.projectName && "border-destructive focus-visible:ring-destructive")}
          />
          {fieldError(errors.projectName)}
        </div>

        {/* Start date */}
        <div>
          <Label>{t('form.startDate')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                data-invalid={!!errors.startDate}
                className={cn("w-full justify-start text-left font-normal mt-2",
                  !startDate && "text-muted-foreground",
                  errors.startDate && "border-destructive"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP", { locale: dateLocale }) : t('form.pickDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate}
                onSelect={(d) => { setStartDate(d); setErrors((p) => ({ ...p, startDate: undefined })); }}
                initialFocus className="pointer-events-auto" locale={dateLocale} />
            </PopoverContent>
          </Popover>
          {fieldError(errors.startDate)}
        </div>

        {/* Mode */}
        <div>
          <Label className="mb-2 block">{t('form.generateBy')}</Label>
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="count">{t('form.modeByCount')}</TabsTrigger>
              <TabsTrigger value="endDate">{t('form.modeByEndDate')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {mode === "count" ? (
          <div>
            <Label htmlFor="numberOfMeetings">{t('form.numberOfMeetings')}</Label>
            <Input id="numberOfMeetings" type="number" min="1" max="366"
              value={numberOfMeetings}
              onChange={(e) => { setNumberOfMeetings(e.target.value); setErrors((p) => ({ ...p, numberOfMeetings: undefined })); }}
              data-invalid={!!errors.numberOfMeetings}
              aria-invalid={!!errors.numberOfMeetings}
              className={cn("mt-2", errors.numberOfMeetings && "border-destructive focus-visible:ring-destructive")}
            />
            {fieldError(errors.numberOfMeetings)}
          </div>
        ) : (
          <div>
            <Label>{t('form.endDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" data-invalid={!!errors.endDate}
                  className={cn("w-full justify-start text-left font-normal mt-2",
                    !endDate && "text-muted-foreground",
                    errors.endDate && "border-destructive"
                  )}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP", { locale: dateLocale }) : t('form.pickEndDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate}
                  onSelect={(d) => { setEndDate(d); setErrors((p) => ({ ...p, endDate: undefined })); }}
                  initialFocus className="pointer-events-auto" locale={dateLocale}
                  disabled={(date) => (startDate ? date < startDate : false)} />
              </PopoverContent>
            </Popover>
            {fieldError(errors.endDate)}
          </div>
        )}

        {/* Track tabs */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label className="text-sm">{t('tracks.title')}</Label>
            <span className="text-xs text-muted-foreground">{t('tracks.hint')}</span>
          </div>
          <TrackTabs
            tracks={drafts.map((d) => ({ id: d.id, name: d.name, color: d.color }))}
            activeId={active.id}
            onSelect={setActiveId}
            onAdd={addTrack}
            onRename={renameTrack}
            onDuplicate={duplicateTrack}
            onDelete={deleteTrack}
            onSetColor={setTrackColor}
          />
        </div>

        {/* Session label (renames the active group's tab) */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`trackName-${active.id}`}>{t('form.eventName')}</Label>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
              aria-live="polite"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: active.color }}
                aria-hidden
              />
              {t('form.sessionLabelEditing', { name: active.name })}
            </span>
          </div>
          <Input
            id={`trackName-${active.id}`}
            value={active.name}
            onChange={(e) => updateActive({ name: e.target.value })}
            placeholder={t('form.eventNamePlaceholder')}
            maxLength={100}
            style={{ borderLeftWidth: 3, borderLeftColor: active.color }}
            className={cn("mt-2", trackErr && "border-destructive focus-visible:ring-destructive")}
            data-invalid={!!trackErr}
          />
          <p className="text-xs text-muted-foreground mt-1.5">{t('form.sessionLabelHelper')}</p>
          {trackErr && <p className="text-sm font-medium text-destructive mt-1">{trackErr}</p>}
        </div>


        {/* Weekdays */}
        {needsWeekdays && (
          <div tabIndex={-1}>
            <Label className="mb-1 block">{t('form.meetingDays')}</Label>
            <p className="text-xs text-muted-foreground mb-3">{t('form.selectDays')}</p>
            <div className="grid grid-rows-4 grid-flow-col gap-x-6 gap-y-2">
              {WEEKDAYS.map((day) => (
                <div key={day.id} className="flex items-center space-x-2 min-h-[36px]">
                  <Checkbox
                    id={`day-${active.id}-${day.id}`}
                    checked={selectedDays.includes(day.id)}
                    onCheckedChange={() => handleDayToggle(day.id)}
                  />
                  <Label htmlFor={`day-${active.id}-${day.id}`} className="text-sm font-normal cursor-pointer">
                    {t(`weekdays.${day.key}`)}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Primary time slot */}
        <div>
          <Label className="mb-1 block">{t('form.sections.time')}</Label>
          <p className="text-xs text-muted-foreground mb-2">{t('form.helper.time')}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor={`slot-start-0-${active.id}`} className="text-xs text-muted-foreground">{t('form.startTime')}</Label>
              <Input id={`slot-start-0-${active.id}`} type="time"
                value={firstSlot?.startTime ?? ""}
                onChange={(e) => updateSlot(0, { startTime: e.target.value })}
                className="mt-1" />
            </div>
            <div>
              <Label htmlFor={`slot-end-0-${active.id}`} className="text-xs text-muted-foreground">{t('form.endTime')}</Label>
              <Input id={`slot-end-0-${active.id}`} type="time"
                value={firstSlot?.endTime ?? ""}
                onChange={(e) => updateSlot(0, { endTime: e.target.value })}
                className="mt-1" />
            </div>
          </div>
        </div>
      </div>

      {/* ===================== ADVANCED ===================== */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <button type="button"
            className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm font-medium hover:bg-secondary/50 transition-colors">
            <span className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              {t('form.advanced.title')}
              {customizedCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  {t('form.advanced.customizedBadge', { count: customizedCount })}
                </span>
              )}
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", advancedOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-8 pt-6">
          {/* Repeat */}
          <section>
            <SectionHeader icon={Repeat} title={t('form.sections.repeat')} hint={t('form.helper.repeat')} />
            <div className="space-y-4">
              <Select
                value={recurrenceType === "weekly" ? `weekly-${weeklyInterval}` : recurrenceType}
                onValueChange={(v) => {
                  if (v.startsWith("weekly-")) {
                    updateActive({ recurrenceType: "weekly", weeklyInterval: Number(v.split("-")[1]) });
                  } else {
                    updateActive({ recurrenceType: v as RecType });
                  }
                }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly-1">{t('form.recurrence.weekly')}</SelectItem>
                  <SelectItem value="weekly-2">{t('form.recurrence.every2Weeks')}</SelectItem>
                  <SelectItem value="weekly-3">{t('form.recurrence.every3Weeks')}</SelectItem>
                  <SelectItem value="weekly-4">{t('form.recurrence.every4Weeks')}</SelectItem>
                  <SelectItem value="monthlyByWeekday">{t('form.recurrence.monthlyByWeekday')}</SelectItem>
                  <SelectItem value="monthlyByDate">{t('form.recurrence.monthlyByDate')}</SelectItem>
                </SelectContent>
              </Select>

              {recurrenceType === "monthlyByWeekday" && (
                <div>
                  <Label className="mb-2 block text-sm">{t('form.recurrence.ordinalsLabel')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {[{ v: 1, k: 'first' }, { v: 2, k: 'second' }, { v: 3, k: 'third' }, { v: 4, k: 'fourth' }, { v: -1, k: 'last' }].map((o) => (
                      <button type="button" key={o.v} onClick={() => toggleOrdinal(o.v)}
                        className={cn("px-3 py-1.5 rounded-md text-sm border transition-colors",
                          ordinals.includes(o.v)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-secondary"
                        )}>
                        {t(`form.recurrence.ordinal.${o.k}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurrenceType === "monthlyByDate" && (
                <div>
                  <Label className="mb-2 block text-sm">{t('form.recurrence.daysOfMonthLabel')}</Label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <button type="button" key={d} onClick={() => toggleDayOfMonth(d)}
                        className={cn("h-9 rounded-md text-sm border transition-colors",
                          daysOfMonth.includes(d)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-secondary"
                        )}>{d}</button>
                    ))}
                    <button type="button" onClick={() => toggleDayOfMonth(-1)}
                      className={cn("col-span-2 h-9 rounded-md text-sm border transition-colors",
                        daysOfMonth.includes(-1)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-secondary"
                      )}>{t('form.recurrence.lastDay')}</button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{t('form.recurrence.daysOfMonthHint')}</p>
                </div>
              )}
            </div>
          </section>

          {/* Slots & holidays */}
          <section>
            <SectionHeader icon={Clock} title={t('form.sections.slotsHolidays')} hint={t('form.helper.slotsHolidays')} />
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">{t('form.timeSlots.title')}</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addSlot}
                    disabled={timeSlots.length >= MAX_SLOTS} className="h-8 gap-1">
                    <Plus className="h-4 w-4" />{t('form.timeSlots.add')}
                  </Button>
                </div>
                <div className="rounded-lg border border-border bg-secondary/20 p-3 mb-3">
                  <Label htmlFor={`slot-label-0-${active.id}`} className="text-xs text-muted-foreground">{t('form.timeSlots.labelForFirst')}</Label>
                  <Input id={`slot-label-0-${active.id}`} value={firstSlot?.label ?? ""}
                    onChange={(e) => updateSlot(0, { label: e.target.value })}
                    placeholder={t('form.timeSlots.labelPlaceholder')} maxLength={50}
                    className="mt-1 h-9" />
                </div>
                {extraSlots.length > 0 && (
                  <div className="space-y-3">
                    {extraSlots.map((slot, i) => {
                      const idx = i + 1;
                      return (
                        <div key={idx} className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
                          <div className="flex items-end gap-2">
                            <div className="flex-1 min-w-0">
                              <Label htmlFor={`slot-label-${idx}-${active.id}`} className="text-xs text-muted-foreground">{t('form.timeSlots.labelOptional')}</Label>
                              <Input id={`slot-label-${idx}-${active.id}`} value={slot.label}
                                onChange={(e) => updateSlot(idx, { label: e.target.value })}
                                placeholder={t('form.timeSlots.labelPlaceholder')} maxLength={50}
                                className="mt-1 h-9" />
                            </div>
                            <Button type="button" variant="ghost" size="icon"
                              onClick={() => removeSlot(idx)}
                              aria-label={t('form.timeSlots.remove')}
                              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor={`slot-start-${idx}-${active.id}`} className="text-xs text-muted-foreground">{t('form.startTime')}</Label>
                              <Input id={`slot-start-${idx}-${active.id}`} type="time"
                                value={slot.startTime}
                                onChange={(e) => updateSlot(idx, { startTime: e.target.value })}
                                className="mt-1 h-9" />
                            </div>
                            <div>
                              <Label htmlFor={`slot-end-${idx}-${active.id}`} className="text-xs text-muted-foreground">{t('form.endTime')}</Label>
                              <Input id={`slot-end-${idx}-${active.id}`} type="time"
                                value={slot.endTime}
                                onChange={(e) => updateSlot(idx, { endTime: e.target.value })}
                                className="mt-1 h-9" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">{t('form.timeSlots.description')}</p>
              </div>

              <div>
                <Label className="mb-1 block text-sm">{t('form.holidays')}</Label>
                <p className="text-xs text-muted-foreground mb-2">{t('form.holidaysDescription')}</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {holidays.length > 0 ? t('form.holidaysSelected', { count: holidays.length }) : t('form.selectHolidays')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="multiple" selected={holidays}
                      onSelect={(dates) => setHolidays(dates || [])}
                      initialFocus className="pointer-events-auto" locale={dateLocale} />
                  </PopoverContent>
                </Popover>
                {holidays.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm">{t('form.holidayBehavior.label')}</Label>
                    <RadioGroup value={holidayBehavior} onValueChange={(v) => setHolidayBehavior(v as HolidayBehavior)} className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip" id="hb-skip" />
                        <Label htmlFor="hb-skip" className="text-sm font-normal cursor-pointer">{t('form.holidayBehavior.skip')}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="rollForward" id="hb-roll" />
                        <Label htmlFor="hb-roll" className="text-sm font-normal cursor-pointer">{t('form.holidayBehavior.rollForward')}</Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">{t('form.holidayBehavior.description')}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Details */}
          <section>
            <SectionHeader icon={MapPin} title={t('form.sections.details')} hint={t('form.helper.details')} />
            <div className="space-y-5">
              <div>
                <Label htmlFor={`location-${active.id}`} className="text-sm">{t('form.location')}</Label>
                <Input id={`location-${active.id}`} value={location}
                  onChange={(e) => updateActive({ location: e.target.value })}
                  placeholder={t('form.locationPlaceholder')} maxLength={200} className="mt-2" />
              </div>
              <div>
                <Label htmlFor={`notes-${active.id}`} className="text-sm">{t('form.notes')}</Label>
                <Textarea id={`notes-${active.id}`} value={notes}
                  onChange={(e) => updateActive({ notes: e.target.value })}
                  placeholder={t('form.notesPlaceholder')} maxLength={2000} rows={3} className="mt-2" />
              </div>
              <div>
                <Label htmlFor="reminder" className="text-sm">{t('form.reminder')}</Label>
                <Select value={String(reminderMinutes)} onValueChange={(v) => setReminderMinutes(Number(v))}>
                  <SelectTrigger id="reminder" className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_OPTIONS.map((m) => (
                      <SelectItem key={m} value={String(m)}>{reminderLabel(t, m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">{t('form.timezone')}</Label>
                <Popover open={tzOpen} onOpenChange={setTzOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" aria-expanded={tzOpen}
                      className="w-full justify-between mt-2 font-normal">
                      <span className="truncate">{timezone}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t('form.timezoneSearchPlaceholder')} />
                      <CommandList>
                        <CommandEmpty>{t('form.timezoneEmpty')}</CommandEmpty>
                        <CommandGroup>
                          {timezones.map((tz) => (
                            <CommandItem key={tz} value={tz} onSelect={(v) => { setTimezone(v); setTzOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", timezone === tz ? "opacity-100" : "opacity-0")} />
                              {tz}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground mt-1">{t('form.timezoneDescription')}</p>
              </div>
            </div>
          </section>
        </CollapsibleContent>
      </Collapsible>

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-card/95 backdrop-blur border-t border-border lg:static lg:bg-transparent lg:border-0 lg:p-0 lg:mx-0 lg:backdrop-blur-none z-10">
        <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity gap-2" size="lg">
          <span>{t('form.generateButton')}</span>
          <kbd className="hidden sm:inline-flex text-[10px] font-mono bg-primary-foreground/15 px-1.5 py-0.5 rounded border border-primary-foreground/20">
            {modLabel}+Enter
          </kbd>
        </Button>
      </div>
    </form>
  );
}
