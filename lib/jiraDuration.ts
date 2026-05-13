export type JiraDurationOptions = {
  /** Minutes represented by `1d` in worklog notation (default 1440). */
  minutesPerDay: number;
};

const DEFAULT_OPTS: JiraDurationOptions = { minutesPerDay: 1440 };

const MAX_MINUTES = 60 * 24 * 365 * 2; // 2 years wall-clock cap

export class JiraDurationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JiraDurationParseError";
  }
}

function clampDayMinutes(n: number): number {
  if (!Number.isFinite(n) || n < 60 || n > 2880) return 1440;
  return Math.floor(n);
}

/** Parse Jira-style `1h 30m`, `2d`, `1w` into total minutes. */
export function parseJiraDuration(
  input: string,
  opts: Partial<JiraDurationOptions> = {},
): number {
  const minutesPerDay = clampDayMinutes(opts.minutesPerDay ?? DEFAULT_OPTS.minutesPerDay);
  const minutesPerWeek = minutesPerDay * 7;
  const s = input.trim();
  if (!s) throw new JiraDurationParseError("Empty duration");
  if (!/^\s*(\d+\s*[wdhm]\s*)+$/i.test(s)) {
    throw new JiraDurationParseError(`Could not parse: ${input}`);
  }
  let total = 0;
  for (const m of s.matchAll(/(\d+)\s*([wdhm])/gi)) {
    const n = Number(m[1]);
    const u = m[2]!.toLowerCase();
    if (!Number.isFinite(n) || n < 0) throw new JiraDurationParseError("Invalid number");
    if (n > 9999) throw new JiraDurationParseError("Value too large");
    switch (u) {
      case "w":
        total += n * minutesPerWeek;
        break;
      case "d":
        total += n * minutesPerDay;
        break;
      case "h":
        total += n * 60;
        break;
      case "m":
        total += n;
        break;
      default:
        throw new JiraDurationParseError(`Unknown unit: ${u}`);
    }
  }
  if (total <= 0) throw new JiraDurationParseError("Duration must be positive");
  if (total > MAX_MINUTES) throw new JiraDurationParseError("Duration too large");
  return Math.floor(total);
}

/** Format minutes for the Settings “minutes per day” text field (h/m only, no d/w). */
export function formatWorkdayMinutesForSettingsInput(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes)) return "24h";
  const clamped = Math.min(2880, Math.max(60, Math.floor(totalMinutes)));
  if (clamped % 60 === 0) return `${clamped / 60}h`;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h}h ${m}m`;
}

/**
 * Parse Settings workday length: plain integer (60–2880) = minutes, or `h`/`m` tokens only
 * (e.g. `8h`, `30m`, `7h 30m`). No `d`/`w` (avoids circular “day” definition).
 */
export function parseWorkdayMinutesFromSettingsInput(input: string): number {
  const s = input.trim();
  if (!s) throw new JiraDurationParseError("Empty value");
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 60 || n > 2880) {
      throw new JiraDurationParseError("Enter 60–2880 minutes, or use h/m (e.g. 8h or 7h 30m)");
    }
    return n;
  }
  if (!/^\s*(\d+\s*[hm]\s*)+$/i.test(s)) {
    throw new JiraDurationParseError(
      "Use h and m only (e.g. 8h, 30m, 7h 30m), or a minute count between 60 and 2880",
    );
  }
  let total = 0;
  for (const m of s.matchAll(/(\d+)\s*([hm])/gi)) {
    const n = Number(m[1]);
    const u = m[2]!.toLowerCase();
    if (!Number.isFinite(n) || n < 0) throw new JiraDurationParseError("Invalid number");
    if (n > 9999) throw new JiraDurationParseError("Value too large");
    if (u === "h") total += n * 60;
    else total += n;
  }
  if (total < 60 || total > 2880) {
    throw new JiraDurationParseError("Total must be between 1h (60m) and 48h (2880m)");
  }
  return Math.floor(total);
}

/** Format minutes as compact Jira-style using `w`, `d`, `h`, `m`. */
export function formatJiraDuration(
  totalMinutes: number,
  opts: Partial<JiraDurationOptions> = {},
): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "0m";
  const minutesPerDay = clampDayMinutes(opts.minutesPerDay ?? DEFAULT_OPTS.minutesPerDay);
  const minutesPerWeek = minutesPerDay * 7;
  let n = Math.floor(totalMinutes);
  const parts: string[] = [];
  const take = (chunk: number, suffix: string) => {
    if (n >= chunk) {
      const c = Math.floor(n / chunk);
      parts.push(`${c}${suffix}`);
      n -= c * chunk;
    }
  };
  take(minutesPerWeek, "w");
  take(minutesPerDay, "d");
  take(60, "h");
  if (n > 0) parts.push(`${n}m`);
  return parts.length ? parts.join(" ") : "0m";
}
