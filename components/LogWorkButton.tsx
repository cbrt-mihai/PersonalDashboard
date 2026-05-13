"use client";

import { useCallback, useState } from "react";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { useI18n } from "@/components/LocaleProvider";
import { WorklogDialog } from "@/components/WorklogDialog";
import type { WorklogTarget } from "@/lib/schemas";

type Props = {
  target: WorklogTarget;
  disabled?: boolean;
  label?: string;
  /** `link` matches small row actions (e.g. Edit). `button` is filled primary. */
  variant?: "button" | "link";
  className?: string;
  onSaved?: () => void;
};

export function LogWorkButton({
  target,
  disabled = false,
  label,
  variant = "button",
  className = "",
  onSaved,
}: Props) {
  const { t } = useI18n();
  const { settings } = useDashboardConfig();
  const mpd = settings?.worklogMinutesPerDay ?? 1440;
  const [open, setOpen] = useState(false);

  const handleSaved = useCallback(() => {
    onSaved?.();
  }, [onSaved]);

  const btnClass =
    variant === "link"
      ? `text-blue-600 text-xs hover:underline dark:text-blue-400 ${className}`.trim()
      : `rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 ${className}`.trim();

  return (
    <>
      <button type="button" disabled={disabled} className={btnClass} onClick={() => setOpen(true)}>
        {label ?? t("worklog.logWork")}
      </button>
      <WorklogDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={handleSaved}
        target={target}
        minutesPerDay={mpd}
        disabled={disabled}
      />
    </>
  );
}
