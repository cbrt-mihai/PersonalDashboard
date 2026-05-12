"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import styles from "./LandscapeThemeToggle.module.css";

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Day: clouds (cx,cy) fill sky from near the sun (~34px) to the far right.
 * Night: stars (sx,sy) fill from the left edge up toward the moon (~134px).
 * Each puff pairs one cloud site with one star site for the travel morph.
 */
const MORPH_PUFFS: {
  cx: number;
  cy: number;
  cw: number;
  ch: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  starOpacity: number;
  delayMs: number;
}[] = [
  {
    cx: 36,
    cy: 5,
    cw: 32,
    ch: 12,
    sx: 10,
    sy: 7,
    sw: 2.2,
    sh: 2.1,
    starOpacity: 0.9,
    delayMs: 0,
  },
  {
    cx: 54,
    cy: 12,
    cw: 28,
    ch: 11,
    sx: 26,
    sy: 18,
    sw: 1.7,
    sh: 1.9,
    starOpacity: 0.65,
    delayMs: 22,
  },
  {
    cx: 72,
    cy: 3,
    cw: 34,
    ch: 13,
    sx: 42,
    sy: 5,
    sw: 2.3,
    sh: 2.2,
    starOpacity: 0.92,
    delayMs: 48,
  },
  {
    cx: 90,
    cy: 17,
    cw: 26,
    ch: 10,
    sx: 58,
    sy: 21,
    sw: 1.6,
    sh: 1.5,
    starOpacity: 0.58,
    delayMs: 10,
  },
  {
    cx: 104,
    cy: 6,
    cw: 36,
    ch: 13,
    sx: 74,
    sy: 11,
    sw: 2,
    sh: 2.1,
    starOpacity: 0.78,
    delayMs: 66,
  },
  {
    cx: 120,
    cy: 20,
    cw: 24,
    ch: 9,
    sx: 88,
    sy: 4,
    sw: 1.8,
    sh: 1.7,
    starOpacity: 0.72,
    delayMs: 34,
  },
  {
    cx: 132,
    cy: 4,
    cw: 28,
    ch: 11,
    sx: 102,
    sy: 19,
    sw: 1.9,
    sh: 1.8,
    starOpacity: 0.68,
    delayMs: 78,
  },
  {
    cx: 146,
    cy: 14,
    cw: 22,
    ch: 9,
    sx: 114,
    sy: 8,
    sw: 2.1,
    sh: 2,
    starOpacity: 0.85,
    delayMs: 16,
  },
  {
    cx: 44,
    cy: 22,
    cw: 20,
    ch: 8,
    sx: 6,
    sy: 24,
    sw: 1.5,
    sh: 1.6,
    starOpacity: 0.52,
    delayMs: 92,
  },
  {
    cx: 66,
    cy: 8,
    cw: 22,
    ch: 9,
    sx: 48,
    sy: 14,
    sw: 1.7,
    sh: 1.6,
    starOpacity: 0.62,
    delayMs: 40,
  },
  {
    cx: 112,
    cy: 23,
    cw: 18,
    ch: 7,
    sx: 96,
    sy: 25,
    sw: 1.4,
    sh: 1.4,
    starOpacity: 0.48,
    delayMs: 58,
  },
  {
    cx: 128,
    cy: 11,
    cw: 30,
    ch: 11,
    sx: 120,
    sy: 15,
    sw: 1.8,
    sh: 1.9,
    starOpacity: 0.7,
    delayMs: 6,
  },
];

type Travel = "idle" | "toDark" | "toLight";

export type LandscapeThemeToggleProps = {
  resolvedDark: boolean;
  onToggle: () => void;
};

export function LandscapeThemeToggle({ resolvedDark, onToggle }: LandscapeThemeToggleProps) {
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  const firstPaint = useRef(true);
  const prevDark = useRef(resolvedDark);
  const [travel, setTravel] = useState<Travel>("idle");

  useLayoutEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
      prevDark.current = resolvedDark;
      return;
    }
    if (prevDark.current === resolvedDark) return;
    const nextIsDark = resolvedDark;
    prevDark.current = resolvedDark;
    if (!reduceMotion) {
      queueMicrotask(() => {
        setTravel(nextIsDark ? "toDark" : "toLight");
      });
    }
  }, [resolvedDark, reduceMotion]);

  const onOrbAnimEnd = useCallback(() => {
    setTravel("idle");
  }, []);

  useEffect(() => {
    if (travel === "idle" || reduceMotion) return;
    const t = window.setTimeout(() => setTravel("idle"), 920);
    return () => window.clearTimeout(t);
  }, [travel, reduceMotion]);

  const orbMotion =
    !reduceMotion && travel === "toDark"
      ? styles.travelToDark
      : !reduceMotion && travel === "toLight"
        ? styles.travelToLight
        : resolvedDark
          ? styles.orbRestDark
          : styles.orbRestLight;

  const orbClass = `${styles.orb} ${orbMotion}`;

  const skyClass = `${styles.sky} ${resolvedDark ? styles.skyNight : styles.skyDay}`;
  const hillFillClass = resolvedDark ? styles.hillNight : styles.hillDay;

  const sceneClass = `${resolvedDark ? styles.sceneNight : styles.sceneDay} ${reduceMotion ? styles.morphInstant : ""}`;

  return (
    <button
      type="button"
      className={`${styles.wrap} ${styles.focusRing}`}
      onClick={onToggle}
      role="switch"
      aria-checked={resolvedDark}
      aria-label="Toggle light or dark color theme"
      data-cy="app.nav.theme.scenic"
    >
      <div className={skyClass} aria-hidden />
      <div className={`${styles.morphLayer} ${sceneClass}`} aria-hidden>
        {MORPH_PUFFS.map((p, i) => (
          <span
            key={i}
            className={styles.morphPuff}
            style={
              {
                "--cx": `${p.cx}px`,
                "--cy": `${p.cy}px`,
                "--cw": `${p.cw}px`,
                "--ch": `${p.ch}px`,
                "--sx": `${p.sx}px`,
                "--sy": `${p.sy}px`,
                "--sw": `${p.sw}px`,
                "--sh": `${p.sh}px`,
                "--star-opacity": String(p.starOpacity),
                "--face-delay": `${p.delayMs}ms`,
                transitionDelay: `${p.delayMs}ms`,
              } as React.CSSProperties
            }
          >
            <span className={styles.morphGlyph} aria-hidden />
          </span>
        ))}
      </div>
      <svg
        className={styles.hill}
        viewBox="0 0 170 22"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          className={hillFillClass}
          d="M0,22 L0,15 Q40,6.5 82,6 Q123,6.5 170,15.5 L170,22 L0,22 Z"
        />
      </svg>
      <span
        className={orbClass}
        onAnimationEnd={onOrbAnimEnd}
      />
    </button>
  );
}
