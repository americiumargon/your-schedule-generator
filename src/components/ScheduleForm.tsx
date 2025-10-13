import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
  { id: 0, name: "Sunday" },
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
  const [eventName, setEventName] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [numberOfMeetings, setNumberOfMeetings] = useState("28");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 4]); // Mon, Wed, Thu
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("21:00");

  const handleDayToggle = (dayId: number) => {
    setSelectedDays(prev =>
      prev.includes(dayId)
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId].sort()
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || selectedDays.length === 0) {
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
        <Label htmlFor="eventName">Event Name</Label>
        <Input
          id="eventName"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="e.g., Web Development Bootcamp"
          required
          className="mt-2"
        />
      </div>

      <div>
        <Label>Start Date</Label>
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
              {startDate ? format(startDate, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label htmlFor="numberOfMeetings">Number of Meetings</Label>
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
        <Label className="mb-3 block">Meeting Days</Label>
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
                {day.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startTime">Start Time</Label>
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
          <Label htmlFor="endTime">End Time</Label>
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
        Generate Schedule
      </Button>
    </form>
  );
}
