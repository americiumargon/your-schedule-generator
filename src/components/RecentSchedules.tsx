import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { History, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import {
  loadRecent,
  removeRecent,
  clearRecent,
  type RecentScheduleEntry,
} from "@/utils/recentSchedules";
import type { ShareFormState } from "@/utils/shareLink";

interface RecentSchedulesProps {
  onLoad: (state: ShareFormState) => void;
  refreshKey: number;
}

export function RecentSchedules({ onLoad, refreshKey }: RecentSchedulesProps) {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<RecentScheduleEntry[]>([]);

  useEffect(() => {
    setEntries(loadRecent());
  }, [refreshKey]);

  const dateLocale = i18n.language === "id" ? idLocale : enUS;

  if (entries.length === 0) return null;

  const handleRemove = (id: string) => {
    removeRecent(id);
    setEntries(loadRecent());
  };

  const handleClear = () => {
    clearRecent();
    setEntries([]);
  };

  return (
    <div className="mt-8 text-left">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-primary" />
          <span>{t("recent.title")}</span>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          {t("recent.clearAll")}
        </button>
      </div>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate text-sm">{entry.name}</div>
              <div className="text-xs text-muted-foreground">
                {t("recent.createdAgo", {
                  ago: formatDistanceToNow(new Date(entry.createdAt), {
                    addSuffix: true,
                    locale: dateLocale,
                  }),
                })}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onLoad(entry.formState)}
            >
              {t("recent.load")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(entry.id)}
              aria-label={t("recent.remove")}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
