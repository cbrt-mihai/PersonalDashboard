"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SingleSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function defaultMatch(label: string, q: string): boolean {
  const ql = q.trim().toLowerCase();
  if (!ql) return true;
  return label.toLowerCase().includes(ql);
}

export function SearchableSingleSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: SingleSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedLabel =
    options.find((o) => o.value === value)?.label ??
    (value ? value : "");

  const filtered = useMemo(() => {
    return options.filter((o) => defaultMatch(o.label, q));
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      inputRef.current?.focus();
    });
  }, [open]);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-500">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-left text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <span className="block truncate">
            {selectedLabel ? selectedLabel : <span className="text-zinc-500">{placeholder}</span>}
          </span>
        </button>
        {open ? (
          <div className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-600 dark:bg-zinc-950">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="mb-2 w-full rounded-md border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-2 py-2 text-xs text-zinc-500">No matches.</div>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {filtered.map((o) => {
                    const active = o.value === value;
                    return (
                      <li key={o.value}>
                        <button
                          type="button"
                          disabled={o.disabled}
                          className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-900 ${
                            active ? "bg-zinc-50 dark:bg-zinc-900" : ""
                          }`}
                          onClick={() => {
                            onChange(o.value);
                            setOpen(false);
                            setQ("");
                          }}
                        >
                          <span className="block truncate">{o.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                onClick={() => {
                  setOpen(false);
                  setQ("");
                }}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

