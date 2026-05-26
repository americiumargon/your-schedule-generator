import { useMemo, useState } from "react";
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
  CalendarIcon,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  MapPin,
  Plus,
  Repeat,
  Settings2,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

const WEEKDAYS = [
  { id: 1, key: "monday" },
  { id: 2, key: "tuesday" },
  { id: 3, key: "wednesday" },
  { id: 4, key: "thursday" },
  { id: 5, key: "friday" },
  { id: 6, key: "saturday" },
  { id: 0, key: "sunday" },
];

const MAX_SLOTS = 6;

interface TimeSlotInput {
  startTime: string;
  endTime: string;
  label: string;
}

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const slotSchema = z.object({
  startTime: z.string().regex(timeRegex, "Invalid start time format"),
  endTime: z.string().regex(timeRegex, "Invalid end time format"),
  label: z.string().trim().max(50, "Slot label must be less than 50 characters").optional(),
}).refine((s) => s.startTime < s.endTime, {
  message: "End time must be after start time",
  path: ["endTime"],
});

const baseSchema = {
  eventName: z.string()
    .trim()
    .min(1, "Activity name is required")
    .max(100, "Activity name must be less than 100 characters"),
  selectedDays: z.array(z.number().min(0).max(6)),
  timeSlots: z.array(slotSchema).min(1, "At least one time slot is required").max(MAX_SLOTS),
  holidays: z.array(z.date()),
  location: z.string().trim().max(200, "Location must be less than 200 characters").optional(),
  notes: z.string().trim().max(2000, "Notes must be less than 2000 characters").optional(),
  reminderMinutes: z.number().refine(v => [0, 5, 15, 30, 60, 1440].includes(v), "Invalid reminder"),
  timezone: z.string().min(1, "Timezone is required"),
};

const REMINDER_OPTIONS = [0, 5, 15, 30, 60, 1440] as const;
function reminderLabel(t: (k: string, o?: any) => string, minutes: number): string {
  if (minutes === 0) return t('form.reminderNone');
  if (minutes === 1440) return t('form.reminderDays', { count: 1 });
  if (minutes >= 60) return t('form.reminderHours', { count: minutes / 60 });
  return t('form.reminderMinutes', { count: minutes });
}

const FALLBACK_TIMEZONES = [
  "UTC",
  "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos",
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
    const anyIntl = Intl as any;
    if (typeof anyIntl.supportedValuesOf === "function") {
      const list = anyIntl.supportedValuesOf("timeZone") as string[];
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {
    // fall through
  }
  return FALLBACK_TIMEZONES;
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const countSchema = z.object({
  ...baseSchema,
  mode: z.literal("count"),
  numberOfMeetings: z.number()
    .int("Number of sessions must be a whole number")
    .min(1, "At least 1 session is required")
    .max(366, "Maximum 366 sessions allowed"),
});

const endDateSchema = z.object({
  ...baseSchema,
  mode: z.literal("endDate"),
  endDate: z.date({ required_error: "Please select an end date" }),
  startDate: z.date(),
}).refine(data => data.endDate >= data.startDate, {
  message: "End date must be on or after the start date",
  path: ["endDate"],
});

type Mode = "count" | "endDate";

export interface FormTimeSlot {
  startTime: string;
  endTime: string;
  label?: string;
}

export type HolidayBehavior = "skip" | "rollForward";

export type FormRecurrence =
  | { type: "weekly"; interval: number }
  | { type: "monthlyByWeekday"; ordinals: number[] }
  | { type: "monthlyByDate"; daysOfMonth: number[] };

interface ScheduleFormProps {
  onGenerate: (data: {
    eventName: string;
    startDate: Date;
    selectedDays: number[];
    timeSlots: FormTimeSlot[];
    holidays: Date[];
    holidayBehavior: HolidayBehavior;
    recurrence: FormRecurrence;
    mode: Mode;
    numberOfMeetings?: number;
    endDate?: Date;
    location?: string;
    notes?: string;
    reminderMinutes?: number;
    timezone?: string;
  }) => void;
  initialState?: {
    eventName: string;
    startDate: Date;
    mode: Mode;
    numberOfMeetings?: number;
    endDate?: Date;
    selectedDays: number[];
    timeSlots: FormTimeSlot[];
    holidays: Date[];
    holidayBehavior?: HolidayBehavior;
    recurrence?: FormRecurrence;
    location?: string;
    notes?: string;
    reminderMinutes: number;
    timezone: string;
  };
}

function initialSlotsFromState(state?: ScheduleFormProps["initialState"]): TimeSlotInput[] {
  if (state?.timeSlots && state.timeSlots.length > 0) {
    return state.timeSlots.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      label: s.label ?? "",
    }));
  }
  return [{ startTime: "", endTime: "", label: "" }];
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

export function ScheduleForm({ onGenerate, initialState }: ScheduleFormProps) {
  const { t, i18n } = useTranslation();
  const browserTz = useMemo(() => getBrowserTimezone(), []);
  const [eventName, setEventName] = useState(() => initialState?.eventName ?? "");
  const [startDate, setStartDate] = useState<Date | undefined>(() => initialState?.startDate);
  const [mode, setMode] = useState<Mode>(() => initialState?.mode ?? "count");
  const [numberOfMeetings, setNumberOfMeetings] = useState(() =>
    initialState?.numberOfMeetings != null ? String(initialState.numberOfMeetings) : ""
  );
  const [endDate, setEndDate] = useState<Date | undefined>(() => initialState?.endDate);
  const [selectedDays, setSelectedDays] = useState<number[]>(() => initialState?.selectedDays ?? []);
  const [timeSlots, setTimeSlots] = useState<TimeSlotInput[]>(() => initialSlotsFromState(initialState));
  const [holidays, setHolidays] = useState<Date[]>(() => initialState?.holidays ?? []);
  const [holidayBehavior, setHolidayBehavior] = useState<HolidayBehavior>(() => initialState?.holidayBehavior ?? "skip");
  const [recurrenceType, setRecurrenceType] = useState<FormRecurrence["type"]>(
    () => initialState?.recurrence?.type ?? "weekly"
  );
  const [weeklyInterval, setWeeklyInterval] = useState<number>(() =>
    initialState?.recurrence?.type === "weekly" ? initialState.recurrence.interval : 1
  );
  const [ordinals, setOrdinals] = useState<number[]>(() =>
    initialState?.recurrence?.type === "monthlyByWeekday" ? initialState.recurrence.ordinals : [1]
  );
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>(() =>
    initialState?.recurrence?.type === "monthlyByDate" ? initialState.recurrence.daysOfMonth : [1]
  );
  const [location, setLocation] = useState(() => initialState?.location ?? "");
  const [notes, setNotes] = useState(() => initialState?.notes ?? "");
  const [reminderMinutes, setReminderMinutes] = useState<number>(() => initialState?.reminderMinutes ?? 0);
  const [timezone, setTimezone] = useState<string>(() => initialState?.timezone ?? browserTz);
  const [tzOpen, setTzOpen] = useState(false);
  const timezones = useMemo(() => getTimezoneList(), []);

  // Customization count for the advanced badge + auto-expand
  const customizedCount = useMemo(() => {
    let n = 0;
    if (recurrenceType !== "weekly" || weeklyInterval !== 1) n++;
    if (timeSlots.length > 1 || (timeSlots[0]?.label?.trim() ?? "")) n++;
    if (holidays.length > 0) n++;
    if (location.trim() || notes.trim()) n++;
    if (reminderMinutes !== 0) n++;
    if (timezone !== browserTz) n++;
    return n;
  }, [recurrenceType, weeklyInterval, timeSlots, holidays, location, notes, reminderMinutes, timezone, browserTz]);

  const [advancedOpen, setAdvancedOpen] = useState<boolean>(() => {
    // Auto-expand if loaded from a share link with customizations
    if (!initialState) return false;
    if (initialState.recurrence && initialState.recurrence.type !== "weekly") return true;
    if (initialState.recurrence?.type === "weekly" && initialState.recurrence.interval !== 1) return true;
    if ((initialState.timeSlots?.length ?? 0) > 1) return true;
    if ((initialState.holidays?.length ?? 0) > 0) return true;
    if (initialState.location || initialState.notes) return true;
    if ((initialState.reminderMinutes ?? 0) !== 0) return true;
    return false;
  });

  const buildRecurrence = (): FormRecurrence => {
    if (recurrenceType === "weekly") return { type: "weekly", interval: weeklyInterval };
    if (recurrenceType === "monthlyByWeekday") return { type: "monthlyByWeekday", ordinals: [...ordinals].sort((a, b) => a - b) };
    return { type: "monthlyByDate", daysOfMonth: [...daysOfMonth].sort((a, b) => a - b) };
  };

  const toggleOrdinal = (o: number) => {
    setOrdinals((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));
  };
  const toggleDayOfMonth = (d: number) => {
    setDaysOfMonth((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const needsWeekdays = recurrenceType === "weekly" || recurrenceType === "monthlyByWeekday";

  const dateLocale = i18n.language === 'id' ? idLocale : enUS;

  const handleDayToggle = (dayId: number) => {
    setSelectedDays(prev =>
      prev.includes(dayId)
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId].sort()
    );
  };

  const updateSlot = (index: number, patch: Partial<TimeSlotInput>) => {
    setTimeSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addSlot = () => {
    setTimeSlots((prev) => (prev.length >= MAX_SLOTS ? prev : [...prev, { startTime: "", endTime: "", label: "" }]));
  };

  const removeSlot = (index: number) => {
    setTimeSlots((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate) {
      toast.error(t('form.validation.dateRequired'));
      return;
    }

    if (timeSlots.some((s) => !s.startTime || !s.endTime)) {
      toast.error(t('form.validation.timeRequired'));
      return;
    }

    if (needsWeekdays && selectedDays.length === 0) {
      toast.error(t('form.validation.daysRequired'));
      return;
    }
    if (recurrenceType === "monthlyByWeekday" && ordinals.length === 0) {
      toast.error(t('form.validation.ordinalsRequired'));
      return;
    }
    if (recurrenceType === "monthlyByDate" && daysOfMonth.length === 0) {
      toast.error(t('form.validation.daysOfMonthRequired'));
      return;
    }

    const recurrence = buildRecurrence();

    try {
      const trimmedName = eventName.trim();
      const normalizedSlots = timeSlots.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        label: s.label?.trim() ? s.label.trim() : undefined,
      }));

      if (mode === "count") {
        const validated = countSchema.parse({
          eventName: trimmedName,
          mode: "count",
          numberOfMeetings: parseInt(numberOfMeetings),
          selectedDays,
          timeSlots: normalizedSlots,
          holidays,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
          reminderMinutes,
          timezone,
        });
        const sanitizedEventName = validated.eventName.replace(/[",\n\r]/g, ' ');
        onGenerate({
          eventName: sanitizedEventName,
          startDate,
          selectedDays: validated.selectedDays,
          timeSlots: normalizedSlots,
          holidays: validated.holidays,
          holidayBehavior,
          recurrence,
          mode: "count",
          numberOfMeetings: validated.numberOfMeetings,
          location: validated.location,
          notes: validated.notes,
          reminderMinutes: validated.reminderMinutes,
          timezone: validated.timezone,
        });
      } else {
        if (!endDate) {
          toast.error(t('form.validation.endDateRequired'));
          return;
        }
        const validated = endDateSchema.parse({
          eventName: trimmedName,
          mode: "endDate",
          endDate,
          startDate,
          selectedDays,
          timeSlots: normalizedSlots,
          holidays,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
          reminderMinutes,
          timezone,
        });
        const sanitizedEventName = validated.eventName.replace(/[",\n\r]/g, ' ');
        onGenerate({
          eventName: sanitizedEventName,
          startDate,
          selectedDays: validated.selectedDays,
          timeSlots: normalizedSlots,
          holidays: validated.holidays,
          holidayBehavior,
          recurrence,
          mode: "endDate",
          endDate: validated.endDate,
          location: validated.location,
          notes: validated.notes,
          reminderMinutes: validated.reminderMinutes,
          timezone: validated.timezone,
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(t('form.validation.invalid'));
      }
    }
  };

  const firstSlot = timeSlots[0];
  const extraSlots = timeSlots.slice(1);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ===================== ESSENTIALS ===================== */}
      <div className="space-y-5">
        {/* Activity name */}
        <div>
          <Label htmlFor="eventName">{t('form.eventName')}</Label>
          <Input
            id="eventName"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder={t('form.eventNamePlaceholder')}
            required
            className="mt-2"
          />
        </div>

        {/* Start date */}
        <div>
          <Label>{t('form.startDate')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal mt-2",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP", { locale: dateLocale }) : t('form.pickDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
                className="pointer-events-auto"
                locale={dateLocale}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Mode tabs */}
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
            <Input
              id="numberOfMeetings"
              type="number"
              min="1"
              max="366"
              value={numberOfMeetings}
              onChange={(e) => setNumberOfMeetings(e.target.value)}
              required
              className="mt-2"
            />
          </div>
        ) : (
          <div>
            <Label>{t('form.endDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mt-2",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP", { locale: dateLocale }) : t('form.pickEndDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className="pointer-events-auto"
                  locale={dateLocale}
                  disabled={(date) => (startDate ? date < startDate : false)}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Weekdays — shown for weekly recurrence (most users) */}
        {needsWeekdays && (
          <div>
            <Label className="mb-1 block">{t('form.meetingDays')}</Label>
            <p className="text-xs text-muted-foreground mb-3">{t('form.selectDays')}</p>
            <div className="grid grid-rows-4 grid-flow-col gap-x-6 gap-y-2">
              {WEEKDAYS.map((day) => (
                <div key={day.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`day-${day.id}`}
                    checked={selectedDays.includes(day.id)}
                    onCheckedChange={() => handleDayToggle(day.id)}
                  />
                  <Label
                    htmlFor={`day-${day.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {t(`weekdays.${day.key}`)}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Primary time slot — simple start/end */}
        <div>
          <Label className="mb-1 block">{t('form.sections.time')}</Label>
          <p className="text-xs text-muted-foreground mb-2">{t('form.helper.time')}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="slot-start-0" className="text-xs text-muted-foreground">
                {t('form.startTime')}
              </Label>
              <Input
                id="slot-start-0"
                type="time"
                value={firstSlot?.startTime ?? ""}
                onChange={(e) => updateSlot(0, { startTime: e.target.value })}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="slot-end-0" className="text-xs text-muted-foreground">
                {t('form.endTime')}
              </Label>
              <Input
                id="slot-end-0"
                type="time"
                value={firstSlot?.endTime ?? ""}
                onChange={(e) => updateSlot(0, { endTime: e.target.value })}
                required
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===================== ADVANCED ===================== */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm font-medium hover:bg-secondary/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              {t('form.advanced.title')}
              {customizedCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  {t('form.advanced.customizedBadge', { count: customizedCount })}
                </span>
              )}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                advancedOpen && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-8 pt-6">
          {/* ----- Sub-section: Repeat pattern ----- */}
          <section>
            <SectionHeader
              icon={Repeat}
              title={t('form.sections.repeat')}
              hint={t('form.helper.repeat')}
            />
            <div className="space-y-4">
              <Select
                value={
                  recurrenceType === "weekly"
                    ? `weekly-${weeklyInterval}`
                    : recurrenceType
                }
                onValueChange={(v) => {
                  if (v.startsWith("weekly-")) {
                    setRecurrenceType("weekly");
                    setWeeklyInterval(Number(v.split("-")[1]));
                  } else {
                    setRecurrenceType(v as FormRecurrence["type"]);
                  }
                }}
              >
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
                    {[
                      { v: 1, k: 'first' },
                      { v: 2, k: 'second' },
                      { v: 3, k: 'third' },
                      { v: 4, k: 'fourth' },
                      { v: -1, k: 'last' },
                    ].map((o) => (
                      <button
                        type="button"
                        key={o.v}
                        onClick={() => toggleOrdinal(o.v)}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-sm border transition-colors",
                          ordinals.includes(o.v)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-secondary"
                        )}
                      >
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
                      <button
                        type="button"
                        key={d}
                        onClick={() => toggleDayOfMonth(d)}
                        className={cn(
                          "h-9 rounded-md text-sm border transition-colors",
                          daysOfMonth.includes(d)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-secondary"
                        )}
                      >
                        {d}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => toggleDayOfMonth(-1)}
                      className={cn(
                        "col-span-2 h-9 rounded-md text-sm border transition-colors",
                        daysOfMonth.includes(-1)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-secondary"
                      )}
                    >
                      {t('form.recurrence.lastDay')}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{t('form.recurrence.daysOfMonthHint')}</p>
                </div>
              )}
            </div>
          </section>

          {/* ----- Sub-section: Time slots & holidays ----- */}
          <section>
            <SectionHeader
              icon={Clock}
              title={t('form.sections.slotsHolidays')}
              hint={t('form.helper.slotsHolidays')}
            />

            <div className="space-y-5">
              {/* Slot 0 label + extra slots editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">{t('form.timeSlots.title')}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addSlot}
                    disabled={timeSlots.length >= MAX_SLOTS}
                    className="h-8 gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    {t('form.timeSlots.add')}
                  </Button>
                </div>

                {/* Slot 0: just the optional label (times live in essentials above) */}
                <div className="rounded-lg border border-border bg-secondary/20 p-3 mb-3">
                  <Label htmlFor="slot-label-0" className="text-xs text-muted-foreground">
                    {t('form.timeSlots.labelForFirst')}
                  </Label>
                  <Input
                    id="slot-label-0"
                    value={firstSlot?.label ?? ""}
                    onChange={(e) => updateSlot(0, { label: e.target.value })}
                    placeholder={t('form.timeSlots.labelPlaceholder')}
                    maxLength={50}
                    className="mt-1 h-9"
                  />
                </div>

                {/* Extra slots */}
                {extraSlots.length > 0 && (
                  <div className="space-y-3">
                    {extraSlots.map((slot, i) => {
                      const index = i + 1;
                      return (
                        <div
                          key={index}
                          className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2"
                        >
                          <div className="flex items-end gap-2">
                            <div className="flex-1 min-w-0">
                              <Label htmlFor={`slot-label-${index}`} className="text-xs text-muted-foreground">
                                {t('form.timeSlots.labelOptional')}
                              </Label>
                              <Input
                                id={`slot-label-${index}`}
                                value={slot.label}
                                onChange={(e) => updateSlot(index, { label: e.target.value })}
                                placeholder={t('form.timeSlots.labelPlaceholder')}
                                maxLength={50}
                                className="mt-1 h-9"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSlot(index)}
                              aria-label={t('form.timeSlots.remove')}
                              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor={`slot-start-${index}`} className="text-xs text-muted-foreground">
                                {t('form.startTime')}
                              </Label>
                              <Input
                                id={`slot-start-${index}`}
                                type="time"
                                value={slot.startTime}
                                onChange={(e) => updateSlot(index, { startTime: e.target.value })}
                                required
                                className="mt-1 h-9"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`slot-end-${index}`} className="text-xs text-muted-foreground">
                                {t('form.endTime')}
                              </Label>
                              <Input
                                id={`slot-end-${index}`}
                                type="time"
                                value={slot.endTime}
                                onChange={(e) => updateSlot(index, { endTime: e.target.value })}
                                required
                                className="mt-1 h-9"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">{t('form.timeSlots.description')}</p>
              </div>

              {/* Holidays */}
              <div>
                <Label className="mb-1 block text-sm">{t('form.holidays')}</Label>
                <p className="text-xs text-muted-foreground mb-2">{t('form.holidaysDescription')}</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {holidays.length > 0
                        ? t('form.holidaysSelected', { count: holidays.length })
                        : t('form.selectHolidays')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="multiple"
                      selected={holidays}
                      onSelect={(dates) => setHolidays(dates || [])}
                      initialFocus
                      className="pointer-events-auto"
                      locale={dateLocale}
                    />
                  </PopoverContent>
                </Popover>

                {holidays.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm">{t('form.holidayBehavior.label')}</Label>
                    <RadioGroup
                      value={holidayBehavior}
                      onValueChange={(v) => setHolidayBehavior(v as HolidayBehavior)}
                      className="space-y-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip" id="hb-skip" />
                        <Label htmlFor="hb-skip" className="text-sm font-normal cursor-pointer">
                          {t('form.holidayBehavior.skip')}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="rollForward" id="hb-roll" />
                        <Label htmlFor="hb-roll" className="text-sm font-normal cursor-pointer">
                          {t('form.holidayBehavior.rollForward')}
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">{t('form.holidayBehavior.description')}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ----- Sub-section: Event details & calendar ----- */}
          <section>
            <SectionHeader
              icon={MapPin}
              title={t('form.sections.details')}
              hint={t('form.helper.details')}
            />

            <div className="space-y-5">
              <div>
                <Label htmlFor="location" className="text-sm">{t('form.location')}</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t('form.locationPlaceholder')}
                  maxLength={200}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="notes" className="text-sm">{t('form.notes')}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('form.notesPlaceholder')}
                  maxLength={2000}
                  rows={3}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="reminder" className="text-sm">{t('form.reminder')}</Label>
                <Select
                  value={String(reminderMinutes)}
                  onValueChange={(v) => setReminderMinutes(Number(v))}
                >
                  <SelectTrigger id="reminder" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_OPTIONS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {reminderLabel(t, m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">{t('form.timezone')}</Label>
                <Popover open={tzOpen} onOpenChange={setTzOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={tzOpen}
                      className="w-full justify-between mt-2 font-normal"
                    >
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
                            <CommandItem
                              key={tz}
                              value={tz}
                              onSelect={(v) => {
                                setTimezone(v);
                                setTzOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  timezone === tz ? "opacity-100" : "opacity-0"
                                )}
                              />
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

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
        size="lg"
      >
        {t('form.generateButton')}
      </Button>
    </form>
  );
}
