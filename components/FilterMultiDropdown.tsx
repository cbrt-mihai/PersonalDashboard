"use client";

import { useMemo, useState } from "react";

export function FilterMultiDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const filteredOptions = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return options;
    return options.filter((o) => o.label.toLowerCase().includes(ql));
  }, [options, q]);

  const summaryText =
    selected.length === 0
      ? "All"
      : selected.length <= 2
        ? selected
            .map((v) => options.find((o) => o.value === v)?.label ?? v)
            .join(", ")
        : `${selected.length} selected`;

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-500">{label}</span>
      <details className="relative rounded-lg border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900">
        <summary className="cursor-pointer list-none rounded-lg px-2 py-1.5 text-zinc-900 marker:hidden dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
          <span className="block truncate leading-normal">{summaryText}</span>
        </summary>
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 min-w-[12rem] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-600 dark:bg-zinc-950">
          <label className="mb-1 flex flex-col gap-1">
            <span className="sr-only">Search {label}</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          {selected.length ? (
            <button
              type="button"
              className="mb-1 w-full rounded px-2 py-1 text-left text-xs text-blue-600 hover:bg-zinc-50 dark:text-blue-400 dark:hover:bg-zinc-900"
              onClick={(e) => {
                e.preventDefault();
                onChange([]);
              }}
            >
              Clear
            </button>
          ) : null}
          <div className="flex max-h-48 flex-col gap-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-2 text-xs text-zinc-500">No matches.</div>
            ) : null}
            {filteredOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() =>
                    onChange(
                      selected.includes(opt.value)
                        ? selected.filter((x) => x !== opt.value)
                        : [...selected, opt.value],
                    )
                  }
                  className="rounded border-zinc-300 dark:border-zinc-600"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
