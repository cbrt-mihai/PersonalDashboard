"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardSearchHit } from "@/lib/dashboardSearch";

type SearchResponse = { query: string; results: DashboardSearchHit[] };

export function GlobalSearch() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<DashboardSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults([]);
    setSel(0);
    setLoading(false);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key === "k" || e.key === "K";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = q.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (t.length < 1) {
      queueMicrotask(() => {
        setResults([]);
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => {
      setLoading(true);
    });
    debounceRef.current = setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(t)}`)
        .then((r) => r.json())
        .then((data: SearchResponse) => {
          setResults(Array.isArray(data.results) ? data.results : []);
          setSel(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, q]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, close]);

  const onPaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[sel]) {
      e.preventDefault();
      go(results[sel].href);
    }
  };

  const overlay =
    open && mounted ? (
      <div
        className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div
          className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          onKeyDown={onPaletteKeyDown}
        >
          <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks, notes, projects…"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900"
              autoComplete="off"
            />
            <p className="mt-2 text-xs text-zinc-500">
              Owners, projects, epics, tasks, notes, and worklogs (by key or text). Use arrow keys and
              Enter.
            </p>
          </div>
          <div className="max-h-[min(50vh,22rem)] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">Searching…</p>
            ) : q.trim().length < 1 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">Type to search.</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">No matches.</p>
            ) : (
              <ul className="py-1">
                {results.map((r, i) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <button
                      type="button"
                      onClick={() => go(r.href)}
                      onMouseEnter={() => setSel(i)}
                      className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left text-sm ${
                        i === sel
                          ? "bg-blue-50 text-zinc-900 dark:bg-blue-950/50 dark:text-zinc-50"
                          : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <span className="font-medium">{r.title}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{r.subtitle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative z-[1] inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <span>Search</span>
        <kbd className="hidden rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-mono text-xs text-zinc-500 sm:inline dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
          ⌘K
        </kbd>
      </button>

      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
