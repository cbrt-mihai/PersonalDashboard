"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

/** Normalize #RGB / #RRGGBB for <input type="color"> (requires #RRGGBB). */
export function expandHex(s: string): string {
  const t = s.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const a = t.slice(1);
    return `#${a[0]!}${a[0]!}${a[1]!}${a[1]!}${a[2]!}${a[2]!}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  return "#64748b";
}

function hexColorsMatch(a: string, b: string): boolean {
  return expandHex(a) === expandHex(b);
}

function DelayedTooltip({
  label,
  open,
}: {
  label: ReactNode;
  open: boolean;
}) {
  if (!open) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
      {label}
    </div>
  );
}

function hexToRgbParts(hex: string): { r: number; g: number; b: number } | null {
  const h = expandHex(hex).slice(1);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbStringFromHex(hex: string): string {
  const p = hexToRgbParts(hex);
  if (!p) return "rgb(?)";
  return `rgb(${p.r}, ${p.g}, ${p.b})`;
}

function rgbStringFromRgba(rgba: string): string {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(rgba.trim());
  if (!m) return "rgb(?)";
  return `rgb(${m[1]}, ${m[2]}, ${m[3]})`;
}

function useDelayedHover(delayMs = 1000) {
  const [open, setOpen] = useState(false);
  const t = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (t.current) window.clearTimeout(t.current);
    };
  }, []);

  function onEnter() {
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setOpen(true), delayMs);
  }

  function onLeave() {
    if (t.current) window.clearTimeout(t.current);
    t.current = null;
    setOpen(false);
  }

  return { open, onEnter, onLeave };
}

function HexSwatchButton({
  swatch,
  title,
  selected,
  ariaLabel,
  onClick,
}: {
  swatch: string;
  title: string;
  selected: boolean;
  ariaLabel: string;
  onClick: () => void;
}) {
  const hover = useDelayedHover(1000);
  const hex = expandHex(swatch);
  const rgb = rgbStringFromHex(hex);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel}
        className={`h-8 w-8 shrink-0 rounded-md border-2 ${
          selected ? "border-zinc-900 dark:border-white" : "border-transparent"
        }`}
        style={{ backgroundColor: expandHex(swatch) }}
        onClick={onClick}
        onMouseEnter={hover.onEnter}
        onMouseLeave={hover.onLeave}
        onFocus={hover.onEnter}
        onBlur={hover.onLeave}
      />
      <DelayedTooltip
        open={hover.open}
        label={
          <span className="inline-flex flex-col gap-0.5">
            <span>{title}</span>
            <span className="font-mono font-normal text-zinc-700 dark:text-zinc-300">
              {hex} · {rgb}
            </span>
          </span>
        }
      />
    </span>
  );
}

/** Same layout as the owner create form: preset swatches + native color input. */
export function HexColorPickerRow({
  value,
  onChange,
  swatches,
  swatchTitles,
}: {
  value: string;
  onChange: (hex: string) => void;
  swatches: readonly string[];
  swatchTitles?: readonly string[];
}) {
  const live = expandHex(value);
  return (
    <div className="flex flex-wrap gap-2">
      {swatches.map((swatch, i) => {
        const selected = hexColorsMatch(swatch, value);
        const title = swatchTitles?.[i] ?? swatch;
        const ariaLabel = swatchTitles?.[i] ? `${swatchTitles[i]} (${swatch})` : swatch;
        return (
          <HexSwatchButton
            key={`${swatch}-${i}`}
            swatch={swatch}
            title={title}
            selected={selected}
            ariaLabel={ariaLabel}
            onClick={() => onChange(expandHex(swatch))}
          />
        );
      })}
      <input
        type="color"
        value={live}
        onChange={(e) => onChange(expandHex(e.target.value))}
        className="h-8 w-14 cursor-pointer rounded border border-zinc-300 dark:border-zinc-600"
      />
    </div>
  );
}

function rgbaToHexForColorInput(bg: string): string {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(bg.trim());
  if (!m) return "#64748b";
  const r = Math.min(255, Math.max(0, parseInt(m[1]!, 10)));
  const g = Math.min(255, Math.max(0, parseInt(m[2]!, 10)));
  const b = Math.min(255, Math.max(0, parseInt(m[3]!, 10)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** rgba(...) badge tint from a hex picked in the browser color input. */
export function hexToTintRgba(hex: string, alpha = 0.12): string {
  const h = expandHex(hex).slice(1);
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function rgbaAlphaFromString(bg: string): number {
  const m = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/i.exec(bg.trim());
  if (m) {
    const a = parseFloat(m[1]!);
    if (!Number.isNaN(a) && a >= 0 && a <= 1) return a;
  }
  return 0.12;
}

function TintSwatchButton({
  swatch,
  title,
  selected,
  onClick,
}: {
  swatch: string;
  title: string;
  selected: boolean;
  onClick: () => void;
}) {
  const hover = useDelayedHover(1000);
  const rgb = rgbStringFromRgba(swatch);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`Background ${title}`}
        className={`h-8 w-8 shrink-0 rounded-md border-2 ${
          selected ? "border-zinc-900 dark:border-white" : "border-transparent"
        }`}
        style={{ backgroundColor: swatch }}
        onClick={onClick}
        onMouseEnter={hover.onEnter}
        onMouseLeave={hover.onLeave}
        onFocus={hover.onEnter}
        onBlur={hover.onLeave}
      />
      <DelayedTooltip
        open={hover.open}
        label={
          <span className="inline-flex flex-col gap-0.5">
            <span>{title}</span>
            <span className="font-mono font-normal text-zinc-700 dark:text-zinc-300">
              {swatch} · {rgb}
            </span>
          </span>
        }
      />
    </span>
  );
}

/** Preset rgba swatches + native color input (keeps alpha from the current value when adjusting hue). */
export function TintBackgroundPickerRow({
  value,
  onChange,
  swatches,
  swatchTitles,
}: {
  value: string;
  onChange: (rgba: string) => void;
  swatches: readonly string[];
  swatchTitles?: readonly string[];
}) {
  const liveHex = rgbaToHexForColorInput(value);
  const alpha = rgbaAlphaFromString(value);
  return (
    <div className="flex flex-wrap gap-2">
      {swatches.map((swatch, i) => {
        const selected = value.trim() === swatch.trim();
        const title = swatchTitles?.[i] ?? swatch;
        return (
          <TintSwatchButton
            key={`${swatch}-${i}`}
            swatch={swatch}
            title={title}
            selected={selected}
            onClick={() => onChange(swatch)}
          />
        );
      })}
      <input
        type="color"
        value={liveHex}
        onChange={(e) => onChange(hexToTintRgba(e.target.value, alpha))}
        className="h-8 w-14 cursor-pointer rounded border border-zinc-300 dark:border-zinc-600"
      />
    </div>
  );
}
