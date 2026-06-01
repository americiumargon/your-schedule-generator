import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, MoreVertical, Copy as CopyIcon, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { TRACK_COLORS } from "@/utils/tracks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface TrackTabsProps {
  tracks: { id: string; name: string; color: string }[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSetColor: (id: string, color: string) => void;
}

export function TrackTabs({
  tracks, activeId, onSelect, onAdd, onRename, onDuplicate, onDelete, onSetColor,
}: TrackTabsProps) {
  const { t } = useTranslation();
  const [renameOpen, setRenameOpen] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  return (
    <div className="flex items-center gap-1 flex-wrap border-b border-border pb-2">
      {tracks.map((tr) => {
        const isActive = tr.id === activeId;
        return (
          <div
            key={tr.id}
            className={cn(
              "group inline-flex items-center gap-1 rounded-md border text-sm transition-colors",
              isActive
                ? "bg-primary/10 border-primary text-foreground"
                : "bg-background border-border text-muted-foreground hover:bg-secondary/50"
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(tr.id)}
              className="flex items-center gap-2 pl-2.5 pr-1 py-1.5"
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: tr.color }}
                aria-hidden
              />
              <span className="max-w-[140px] truncate">{tr.name}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 w-6 inline-flex items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground"
                  aria-label="Track options"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => {
                    setRenameValue(tr.name);
                    setRenameOpen(tr.id);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  {t("tracks.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(tr.id)}>
                  <CopyIcon className="h-3.5 w-3.5 mr-2" />
                  {t("tracks.duplicate")}
                </DropdownMenuItem>
                <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("tracks.color")}</div>
                <div className="px-2 pb-2 grid grid-cols-8 gap-1">
                  {TRACK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onSetColor(tr.id, c)}
                      className={cn(
                        "h-5 w-5 rounded-full border-2 transition-transform",
                        tr.color === c ? "border-foreground scale-110" : "border-transparent hover:scale-110"
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={tracks.length <= 1}
                  onClick={() => onDelete(tr.id)}
                >
                  <X className="h-3.5 w-3.5 mr-2" />
                  {t("tracks.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {renameOpen === tr.id && (
              <Popover open onOpenChange={(o) => !o && setRenameOpen(null)}>
                <PopoverTrigger asChild>
                  <span />
                </PopoverTrigger>
                <PopoverContent className="w-64 space-y-2" align="start">
                  <label className="text-xs font-medium">{t("tracks.rename")}</label>
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={50}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onRename(tr.id, renameValue.trim() || tr.name);
                        setRenameOpen(null);
                      } else if (e.key === "Escape") {
                        setRenameOpen(null);
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setRenameOpen(null)}>
                      {t("schedule.cancel")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        onRename(tr.id, renameValue.trim() || tr.name);
                        setRenameOpen(null);
                      }}
                    >
                      {t("schedule.save")}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAdd}
        className="h-8 gap-1 text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("tracks.add")}
      </Button>
    </div>
  );
}
