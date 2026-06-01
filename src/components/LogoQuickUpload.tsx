import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { loadBranding, saveBranding } from "@/utils/branding";

const MAX_LOGO_BYTES = 500 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/svg+xml"];

/**
 * Inline logo upload affordance placed next to the PDF export button so
 * users discover the branding feature without opening the panel.
 * Reads / writes the same `branding` localStorage record as BrandingSection.
 */
export function LogoQuickUpload() {
  const { t } = useTranslation();
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLogoDataUrl(loadBranding().logoDataUrl);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "branding:v1") {
        setLogoDataUrl(loadBranding().logoDataUrl);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleFile = (file: File) => {
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
        const next = { ...loadBranding(), logoDataUrl: reader.result };
        saveBranding(next);
        setLogoDataUrl(reader.result);
        toast.success(t("branding.quickChange"));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    const current = loadBranding();
    saveBranding({ ...current, logoDataUrl: undefined });
    setLogoDataUrl(undefined);
    if (fileRef.current) fileRef.current.value = "";
  };

  const triggerPicker = () => fileRef.current?.click();

  const label = logoDataUrl
    ? t("branding.quickChange")
    : t("branding.quickAdd");

  return (
    <TooltipProvider delayDuration={300}>
      <div className="inline-flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            // Allow re-uploading the same file later.
            e.target.value = "";
          }}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerPicker}
              className="gap-2"
            >
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt=""
                  className="h-4 w-4 object-contain"
                />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{label}</span>
              <Upload className="h-3 w-3 opacity-60" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("branding.quickTooltip")}</TooltipContent>
        </Tooltip>
        {logoDataUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleRemove}
                aria-label={t("branding.quickRemove")}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("branding.quickRemove")}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
