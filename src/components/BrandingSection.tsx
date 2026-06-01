import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Palette, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  clearBranding,
  loadBranding,
  saveBranding,
  type Branding,
} from "@/utils/branding";

const MAX_LOGO_BYTES = 500 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/svg+xml"];
const DEFAULT_ACCENT = "#0ea5e9";

export function BrandingSection() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [branding, setBranding] = useState<Branding>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBranding(loadBranding());
  }, []);

  const update = (patch: Partial<Branding>) => {
    setBranding((prev) => {
      const next = { ...prev, ...patch };
      saveBranding(next);
      return next;
    });
  };

  const handleLogo = (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t("branding.logoInvalid"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(t("branding.logoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        update({ logoDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    clearBranding();
    setBranding({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const accent = branding.accentColor || DEFAULT_ACCENT;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{t("branding.title")}</span>
            {(branding.logoDataUrl || branding.orgName) && (
              <span className="text-xs text-muted-foreground">
                · {branding.orgName || t("branding.logo")}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 pt-0 space-y-4">
        {/* Preview */}
        <div
          className="rounded-md p-3 flex items-center gap-3 min-h-[64px]"
          style={{ backgroundColor: accent }}
        >
          {branding.logoDataUrl ? (
            <img
              src={branding.logoDataUrl}
              alt=""
              className="max-h-10 max-w-[120px] object-contain"
            />
          ) : null}
          <div className="text-white">
            <div className="font-semibold text-sm leading-tight">
              {branding.orgName || t("branding.preview")}
            </div>
            {branding.tagline && (
              <div className="text-xs opacity-90">{branding.tagline}</div>
            )}
          </div>
        </div>

        {/* Logo */}
        <div className="space-y-2">
          <Label>{t("branding.logo")}</Label>
          <div className="flex items-center gap-2">
            <Input
              ref={fileRef}
              type="file"
              accept={ACCEPTED.join(",")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLogo(f);
              }}
              className="flex-1"
            />
            {branding.logoDataUrl && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  update({ logoDataUrl: undefined });
                  if (fileRef.current) fileRef.current.value = "";
                }}
                aria-label={t("branding.removeLogo")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="branding-org">{t("branding.orgName")}</Label>
            <Input
              id="branding-org"
              value={branding.orgName ?? ""}
              onChange={(e) => update({ orgName: e.target.value || undefined })}
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branding-tagline">{t("branding.tagline")}</Label>
            <Input
              id="branding-tagline"
              value={branding.tagline ?? ""}
              onChange={(e) => update({ tagline: e.target.value || undefined })}
              maxLength={120}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="branding-accent">{t("branding.accentColor")}</Label>
            <div className="flex items-center gap-2">
              <input
                id="branding-accent"
                type="color"
                value={accent}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="h-9 w-12 rounded border border-input bg-background cursor-pointer"
              />
              <Input
                value={accent}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="flex-1 font-mono text-sm"
                maxLength={9}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="branding-footer">{t("branding.footer")}</Label>
            <Input
              id="branding-footer"
              value={branding.footerText ?? ""}
              onChange={(e) => update({ footerText: e.target.value || undefined })}
              maxLength={200}
            />
          </div>
        </div>


        <div className="flex items-start gap-2 rounded-md border p-3">
          <input
            id="branding-cover"
            type="checkbox"
            className="mt-1"
            checked={branding.coverPage !== false}
            onChange={(e) => update({ coverPage: e.target.checked })}
          />
          <div className="space-y-1">
            <Label htmlFor="branding-cover" className="cursor-pointer">
              {t("branding.coverPage")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("branding.coverPageHint")}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t("branding.quickHint")}</p>

        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
            {t("branding.reset")}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
