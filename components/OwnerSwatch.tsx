"use client";

import type { Owner } from "@/lib/schemas";

export function OwnerSwatch({
  owner,
  color,
  iconDataUrl,
  className = "h-10 w-10 rounded-md",
  title,
}: {
  owner?: Owner | null;
  color?: string;
  iconDataUrl?: string | null | undefined;
  className?: string;
  title?: string;
}) {
  const bg = color ?? owner?.color ?? "#64748b";
  const icon = iconDataUrl ?? owner?.iconDataUrl ?? null;
  const t = title ?? owner?.name ?? bg;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={{ backgroundColor: bg }}
      title={t}
      aria-label={t}
    >
      {icon ? (
        <img
          src={icon}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
      ) : null}
    </span>
  );
}

