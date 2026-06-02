import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value: string; // "HH:mm" or ""
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
}

const pad = (n: number) => n.toString().padStart(2, "0");

function parse(value: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

type Stage = "hour" | "minute";

const SIZE = 260;
const CENTER = SIZE / 2;
const OUTER_R = 110; // hours 1-12 / minutes
const INNER_R = 74;  // hours 13-00
const NUM_R = 18;

interface NumPos { value: number; x: number; y: number; inner?: boolean }

function hourPositions(): NumPos[] {
  const list: NumPos[] = [];
  for (let i = 1; i <= 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    list.push({ value: i, x: CENTER + Math.cos(angle) * OUTER_R, y: CENTER + Math.sin(angle) * OUTER_R });
  }
  for (let i = 13; i <= 24; i++) {
    const display = i === 24 ? 0 : i;
    const angle = ((i - 12) / 12) * Math.PI * 2 - Math.PI / 2;
    list.push({ value: display, x: CENTER + Math.cos(angle) * INNER_R, y: CENTER + Math.sin(angle) * INNER_R, inner: true });
  }
  return list;
}

function minutePositions(): NumPos[] {
  const list: NumPos[] = [];
  for (let i = 0; i < 12; i++) {
    const m = i * 5;
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    list.push({ value: m, x: CENTER + Math.cos(angle) * OUTER_R, y: CENTER + Math.sin(angle) * OUTER_R });
  }
  return list;
}

export function TimePickerClock({ value, onChange, id, ariaLabel, placeholder = "--:--", className, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("hour");
  const parsed = parse(value);
  const [hour, setHour] = useState<number>(parsed?.h ?? 9);
  const [minute, setMinute] = useState<number>(parsed?.m ?? 0);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (open) {
      const p = parse(value);
      setHour(p?.h ?? 9);
      setMinute(p?.m ?? 0);
      setStage("hour");
    }
  }, [open, value]);

  const hours = useMemo(hourPositions, []);
  const minutes = useMemo(minutePositions, []);

  const commit = (h: number, m: number) => {
    onChange(`${pad(h)}:${pad(m)}`);
  };

  const selectHour = (h: number) => {
    setHour(h);
    commit(h, minute);
    setStage("minute");
  };

  const selectMinute = (m: number) => {
    setMinute(m);
    commit(hour, m);
    setTimeout(() => setOpen(false), 120);
  };

  // Hand angle + radius for current selection
  const handAngle = stage === "hour"
    ? ((hour % 12 === 0 ? 12 : hour % 12) / 12) * 360 - 90
    : (minute / 60) * 360 - 90;
  const handRadius = stage === "hour" && (hour === 0 || hour > 12) ? INNER_R : OUTER_R;
  const handX = CENTER + Math.cos((handAngle * Math.PI) / 180) * handRadius;
  const handY = CENTER + Math.sin((handAngle * Math.PI) / 180) * handRadius;

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 1 && e.type !== "pointerdown") return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE - CENTER;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE - CENTER;
    const dist = Math.hypot(x, y);
    let angle = Math.atan2(y, x) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const slot = angle / (Math.PI * 2);
    if (stage === "hour") {
      const idx = Math.round(slot * 12);
      const normalized = idx === 0 ? 12 : idx;
      const inner = dist < (OUTER_R + INNER_R) / 2;
      let h: number;
      if (inner) {
        h = normalized === 12 ? 0 : normalized + 12;
      } else {
        h = normalized;
      }
      setHour(h);
      if (e.type === "pointerup") selectHour(h);
    } else {
      const idx = Math.round(slot * 12) % 12;
      const m = idx * 5;
      setMinute(m);
      if (e.type === "pointerup") selectMinute(m);
    }
  };

  const displayValue = parsed ? `${pad(parsed.h)}:${pad(parsed.m)}` : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            !displayValue && "text-muted-foreground",
            invalid && "border-destructive focus-visible:ring-destructive",
            className,
          )}
        >
          <span>{displayValue || placeholder}</span>
          <Clock className={cn("h-4 w-4", invalid ? "text-destructive" : "text-muted-foreground")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="flex items-center justify-center gap-2 mb-3 text-3xl font-semibold tabular-nums">
          <button
            type="button"
            onClick={() => setStage("hour")}
            className={cn("px-2 rounded-md transition-colors", stage === "hour" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {pad(hour)}
          </button>
          <span className="text-muted-foreground">:</span>
          <button
            type="button"
            onClick={() => setStage("minute")}
            className={cn("px-2 rounded-md transition-colors", stage === "minute" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {pad(minute)}
          </button>
        </div>

        <svg
          ref={svgRef}
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="touch-none select-none"
          onPointerDown={handlePointer}
          onPointerMove={handlePointer}
          onPointerUp={handlePointer}
        >
          <circle cx={CENTER} cy={CENTER} r={CENTER - 4} className="fill-secondary" />
          {/* hand */}
          <line x1={CENTER} y1={CENTER} x2={handX} y2={handY} className="stroke-primary" strokeWidth={2} />
          <circle cx={CENTER} cy={CENTER} r={3} className="fill-primary" />
          <circle cx={handX} cy={handY} r={NUM_R} className="fill-primary" />

          {(stage === "hour" ? hours : minutes).map((p) => {
            const isSelected =
              stage === "hour"
                ? p.value === hour
                : p.value === minute;
            return (
              <g key={`${stage}-${p.value}-${p.inner ? "i" : "o"}`}>
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={cn(
                    "pointer-events-none text-[13px]",
                    isSelected ? "fill-primary-foreground font-semibold" : p.inner ? "fill-muted-foreground" : "fill-foreground",
                  )}
                >
                  {stage === "minute" ? pad(p.value) : p.value}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-3">
          <Input
            type="text"
            inputMode="numeric"
            placeholder="HH:mm"
            value={displayValue}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v);
              const p = parse(v);
              if (p) {
                setHour(p.h);
                setMinute(p.m);
              }
            }}
            aria-label={ariaLabel ? `${ariaLabel} (text input)` : "Time text input"}
            className="h-9"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
