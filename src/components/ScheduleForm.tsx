import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const WEEKDAYS = [
  { id: 1, key: "monday" },
  { id: 2, key: "tuesday" },
  { id: 3, key: "wednesday" },
  { id: 4, key: "thursday" },
  { id: 5, key: "friday" },
  { id: 6, key: "saturday" },
  { id: 0, key: "sunday" },
];

interface ScheduleFormProps {
  onGenerate: (data: {
    eventName: string;
    startDate: Date;
    numberOfMeetings: number;
    selectedDays: number[];
    startTime: string;
    endTime: string;
  }) => void;
}

export function ScheduleForm({ onGenerate }: ScheduleFormProps) {
  const { t, i18n } = useTranslation();
  const [eventName, setEventName] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [numberOfMeetings, setNumberOfMeetings] = useState("28");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 4]); // Mon, Wed, Thu
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("21:00");

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

    if (!eventName.trim()) {
      toast.error(t('form.validation.eventNameRequired'));
      return;
    }

    if (!startDate) {
      toast.error(t('form.validation.dateRequired'));
      return;
    }

    if (parseInt(numberOfMeetings) < 1) {
      toast.error(t('form.validation.meetingsRequired'));
      return;
    }

    if (selectedDays.length === 0) {
      toast.error(t('form.validation.daysRequired'));
      return;
    }

    onGenerate({
      eventName,
      startDate,
      numberOfMeetings: parseInt(numberOfMeetings),
      selectedDays,
      startTime,
      endTime,
    });
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
        <Label htmlFor="numberOfMeetings">{t('form.numberOfMeetings')}</Label>
        <Input
          id="numberOfMeetings"
          type="number"
          min="1"
          max="365"
          value={numberOfMeetings}
          onChange={(e) => setNumberOfMeetings(e.target.value)}
          required
          className="mt-2"
        />
      </div>

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
