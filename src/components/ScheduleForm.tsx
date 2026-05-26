import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
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

const baseSchema = {
  eventName: z.string()
    .trim()
    .min(1, "Activity name is required")
    .max(100, "Activity name must be less than 100 characters"),
  selectedDays: z.array(z.number().min(0).max(6))
    .min(1, "At least one day must be selected"),
  startTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid start time format"),
  endTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid end time format"),
  holidays: z.array(z.date()),
  location: z.string().trim().max(200, "Location must be less than 200 characters").optional(),
  notes: z.string().trim().max(2000, "Notes must be less than 2000 characters").optional(),
  reminderMinutes: z.number().refine(v => [0, 5, 15, 30, 60, 1440].includes(v), "Invalid reminder"),
};

const REMINDER_OPTIONS = [0, 5, 15, 30, 60, 1440] as const;
function reminderLabel(t: (k: string, o?: any) => string, minutes: number): string {
  if (minutes === 0) return t('form.reminderNone');
  if (minutes === 1440) return t('form.reminderDays', { count: 1 });
  if (minutes >= 60) return t('form.reminderHours', { count: minutes / 60 });
  return t('form.reminderMinutes', { count: minutes });
}

const countSchema = z.object({
  ...baseSchema,
  mode: z.literal("count"),
  numberOfMeetings: z.number()
    .int("Number of sessions must be a whole number")
    .min(1, "At least 1 session is required")
    .max(366, "Maximum 366 sessions allowed"),
}).refine(data => data.startTime < data.endTime, {
  message: "End time must be after start time",
  path: ["endTime"],
});

const endDateSchema = z.object({
  ...baseSchema,
  mode: z.literal("endDate"),
  endDate: z.date({ required_error: "Please select an end date" }),
  startDate: z.date(),
}).refine(data => data.startTime < data.endTime, {
  message: "End time must be after start time",
  path: ["endTime"],
}).refine(data => data.endDate >= data.startDate, {
  message: "End date must be on or after the start date",
  path: ["endDate"],
});

type Mode = "count" | "endDate";

interface ScheduleFormProps {
  onGenerate: (data: {
    eventName: string;
    startDate: Date;
    selectedDays: number[];
    startTime: string;
    endTime: string;
    holidays: Date[];
    mode: Mode;
    numberOfMeetings?: number;
    endDate?: Date;
    location?: string;
    notes?: string;
    reminderMinutes?: number;
  }) => void;
}

export function ScheduleForm({ onGenerate }: ScheduleFormProps) {
  const { t, i18n } = useTranslation();
  const [eventName, setEventName] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [mode, setMode] = useState<Mode>("count");
  const [numberOfMeetings, setNumberOfMeetings] = useState("");
  const [endDate, setEndDate] = useState<Date>();
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [holidays, setHolidays] = useState<Date[]>([]);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState<number>(0);

  const dateLocale = i18n.language === 'id' ? idLocale : enUS;

  const handleDayToggle = (dayId: number) => {
    setSelectedDays(prev =>
      prev.includes(dayId)
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId].sort()
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate) {
      toast.error(t('form.validation.dateRequired'));
      return;
    }

    if (!startTime || !endTime) {
      toast.error(t('form.validation.timeRequired'));
      return;
    }

    try {
      const trimmedName = eventName.trim();

      if (mode === "count") {
        const validated = countSchema.parse({
          eventName: trimmedName,
          mode: "count",
          numberOfMeetings: parseInt(numberOfMeetings),
          selectedDays,
          startTime,
          endTime,
          holidays,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
          reminderMinutes,
        });
        const sanitizedEventName = validated.eventName.replace(/[",\n\r]/g, ' ');
        onGenerate({
          eventName: sanitizedEventName,
          startDate,
          selectedDays: validated.selectedDays,
          startTime: validated.startTime,
          endTime: validated.endTime,
          holidays: validated.holidays,
          mode: "count",
          numberOfMeetings: validated.numberOfMeetings,
          location: validated.location,
          notes: validated.notes,
          reminderMinutes: validated.reminderMinutes,
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
          startTime,
          endTime,
          holidays,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        const sanitizedEventName = validated.eventName.replace(/[",\n\r]/g, ' ');
        onGenerate({
          eventName: sanitizedEventName,
          startDate,
          selectedDays: validated.selectedDays,
          startTime: validated.startTime,
          endTime: validated.endTime,
          holidays: validated.holidays,
          mode: "endDate",
          endDate: validated.endDate,
          location: validated.location,
          notes: validated.notes,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div>
        <Label className="mb-3 block">{t('form.meetingDays')}</Label>
        <div className="space-y-2">
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startTime">{t('form.startTime')}</Label>
          <Input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="endTime">{t('form.endTime')}</Label>
          <Input
            id="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className="mt-2"
          />
        </div>
      </div>

      <div>
        <Label className="mb-3 block">{t('form.holidays')}</Label>
        <p className="text-sm text-muted-foreground mb-2">{t('form.holidaysDescription')}</p>
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
      </div>

      <div>
        <Label htmlFor="location">{t('form.location')}</Label>
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
        <Label htmlFor="notes">{t('form.notes')}</Label>
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
