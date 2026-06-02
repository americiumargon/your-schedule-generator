import * as React from "react";
import { useState, useCallback, useRef } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";

type ClockMode = "hour" | "minute";

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function angleFromCenter(cx: number, cy: number, x: number, y: number) {
  const rad = Math.atan2(y - cy, x - cx);
  let deg = (rad * 180) / Math.PI + 90;
  if (deg < 0) deg += 360;
  return deg;
}

interface ClockFaceProps {
  mode: ClockMode;
  value: number;
  onSelect: (v: number) => void;
}

function ClockFace({ mode, value, onSelect }: ClockFaceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const numberRadius = 82;
  const handRadius = 72;

  const items = mode === "hour" ? HOURS_12 : MINUTES;
  const steps = mode === "hour" ? 12 : 60;

  const getCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return null;
      const rect = svgRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return { x, y };
    },
    [],
  );

  const handleInteraction = useCallback(
    (clientX: number, clientY: number) => {
      const coords = getCoords(clientX, clientY);
      if (!coords) return;
      const angle = angleFromCenter(cx, cy, coords.x, coords.y);
      if (mode === "hour") {
        let h = Math.round(angle / 30) % 12;
        if (h === 0) h = 12;
        onSelect(h);
      } else {
        let m = Math.round(angle / 6) % 60;
        const snapped = Math.round(m / 5) * 5;
        if (Math.abs(m - snapped) <= 1) m = snapped;
        if (m === 60) m = 0;
        onSelect(m);
      }
    },
    [mode, cx, cy, getCoords, onSelect],
  );

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    handleInteraction(e.clientX, e.clientY);
  };

  const handAngle = mode === "hour" ? (value % 12) * 30 : value * 6;
  const handEnd = polarToCartesian(cx, cy, handRadius, handAngle);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      className="cursor-pointer select-none"
      onClick={handleClick}
    >
      <circle cx={cx} cy={cy} r={105} className="fill-muted/50" />

      <line
        x1={cx}
        y1={cy}
        x2={handEnd.x}
        y2={handEnd.y}
        className="stroke-primary"
        strokeWidth={2}
      />
      <circle cx={cx} cy={cy} r={3} className="fill-primary" />
      <circle cx={handEnd.x} cy={handEnd.y} r={18} className="fill-primary/15" />

      {items.map((item, i) => {
        const angle = (i * 360) / items.length;
        const pos = polarToCartesian(cx, cy, numberRadius, angle);
        const isSelected =
          mode === "hour" ? value === item : value === item;
        return (
          <text
            key={item}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            className={cn(
              "text-xs font-medium pointer-events-none",
              isSelected
                ? "fill-primary font-semibold"
                : "fill-foreground/70",
            )}
          >
            {mode === "minute" ? String(item).padStart(2, "0") : item}
          </text>
        );
      })}
    </svg>
  );
}

interface ClockTimePickerProps {
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function ClockTimePicker({
  value,
  onChange,
  placeholder = "--:--",
  className,
  id,
}: ClockTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ClockMode>("hour");
  const [period, setPeriod] = useState<"AM" | "PM">(() => {
    if (!value) return "AM";
    const h = parseInt(value.split(":")[0], 10);
    return h >= 12 ? "PM" : "AM";
  });

  const parsedHour = value ? parseInt(value.split(":")[0], 10) : null;
  const parsedMinute = value ? parseInt(value.split(":")[1], 10) : null;

  const display12Hour =
    parsedHour !== null
      ? parsedHour === 0
        ? 12
        : parsedHour > 12
          ? parsedHour - 12
          : parsedHour
      : 12;
  const displayMinute = parsedMinute ?? 0;

  const formatTime = (h24: number, m: number) => {
    return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const to24 = (h12: number, p: "AM" | "PM") => {
    if (p === "AM") return h12 === 12 ? 0 : h12;
    return h12 === 12 ? 12 : h12 + 12;
  };

  const handleHourSelect = (h: number) => {
    const h24 = to24(h, period);
    onChange(formatTime(h24, parsedMinute ?? 0));
    setMode("minute");
  };

  const handleMinuteSelect = (m: number) => {
    const h24 = to24(display12Hour, period);
    onChange(formatTime(h24, m));
  };

  const handlePeriodToggle = (p: "AM" | "PM") => {
    setPeriod(p);
    if (value) {
      const h24 = to24(display12Hour, p);
      onChange(formatTime(h24, parsedMinute ?? 0));
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setMode("hour");
  };

  const displayValue = value
    ? `${String(display12Hour).padStart(2, "0")}:${String(displayMinute).padStart(2, "0")} ${period}`
    : "";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal gap-2",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <Clock className="h-4 w-4 shrink-0" />
          {displayValue || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-1 text-lg font-mono">
            <button
              type="button"
              onClick={() => setMode("hour")}
              className={cn(
                "px-2 py-1 rounded transition-colors",
                mode === "hour"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {value ? String(display12Hour).padStart(2, "0") : "--"}
            </button>
            <span>:</span>
            <button
              type="button"
              onClick={() => setMode("minute")}
              className={cn(
                "px-2 py-1 rounded transition-colors",
                mode === "minute"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {value ? String(displayMinute).padStart(2, "0") : "--"}
            </button>
            <div className="flex flex-col ml-2 text-xs gap-0.5">
              <button
                type="button"
                onClick={() => handlePeriodToggle("AM")}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors",
                  period === "AM"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => handlePeriodToggle("PM")}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors",
                  period === "PM"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                PM
              </button>
            </div>
          </div>

          <ClockFace
            mode={mode}
            value={mode === "hour" ? display12Hour : displayMinute}
            onSelect={mode === "hour" ? handleHourSelect : handleMinuteSelect}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
