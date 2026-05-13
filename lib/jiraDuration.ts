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
