"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AuditAction, AuditEntity, AuditEvent } from "@/lib/schemas";
import { TableClampCell } from "@/components/TableClampCell";

const PAGE_SIZE = 100;

function RefreshIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 0 1-9.925 2.293.75.75 0 1 1 1.414-.495 4 4 0 0 0 7.214-1.669H12.5a.75.75 0 0 1 0-1.5h4.25a.75.75 0 0 1 .75.75v4.25a.75.75 0 0 1-1.5 0v-2.086ZM4.688 8.576a5.5 5.5 0 0 1 9.925-2.293.75.75 0 1 1-1.414.495 4 4 0 0 0-7.214 1.669H7.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75V4.002a.75.75 0 0 1 1.5 0v2.086Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronIcon({ className = "h-4 w-4", open }: { className?: string; open?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`${className} motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function actionPillClass(action: AuditAction): string {
  switch (action) {
    case "create":
      return "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200";
    case "update":
      return "border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-100";
    case "delete":
      return "border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100";
    default:
      return "border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }
}

function entityPillClass(entity: AuditEntity): string {
  switch (entity) {
    case "owner":
      return "border-violet-200/70 bg-violet-50 text-violet-900 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-100";
    case "project":
      return "border-indigo-200/70 bg-indigo-50 text-indigo-900 dark:border-indigo-800/50 dark:bg-indigo-950/40 dark:text-indigo-100";
    case "task_group":
      return "border-amber-200/70 bg-amber-50 text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100";
    case "task":
      return "border-cyan-200/70 bg-cyan-50 text-cyan-950 dark:border-cyan-800/50 dark:bg-cyan-950/35 dark:text-cyan-100";
    case "owner_entry":
      return "border-fuchsia-200/70 bg-fuchsia-50 text-fuchsia-950 dark:border-fuchsia-800/50 dark:bg-fuchsia-950/35 dark:text-fuchsia-100";
    case "settings":
      return "border-zinc-300/80 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
  }
}

function AuditTableSkeleton() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-200/90 dark:bg-zinc-700/80" />
        <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-700/60" />
        <div className="mt-2 h-4 w-2/3 max-w-md animate-pulse rounded bg-zinc-200/50 dark:bg-zinc-700/40" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 shadow-inner dark:border-zinc-800 dark:bg-zinc-950/50">
        <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-3 flex-1 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-700/60"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, r) => (
          <div
            key={r}
            className="flex gap-4 border-b border-zinc-50 px-4 py-3 last:border-0 dark:border-zinc-800/80"
          >
            {Array.from({ length: 6 }).map((_, c) => (
              <div
                key={c}
                className="h-4 flex-1 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/60"
                style={{ animationDelay: `${(r * 6 + c) * 40}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type AuditPageResponse = {
  entries: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
};

function entityLabel(e: AuditEntity): string {
  switch (e) {
    case "task_group":
      return "Epic";
    case "owner_entry":
      return "Note";
    case "owner":
      return "Owner";
    case "task":
      return "Task";
    case "settings":
      return "Settings";
    default:
      return e;
  }
}

function AuditLogClientInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = useMemo(() => {
    const raw = searchParams.get("page");
    const n = raw ? Number.parseInt(raw, 10) : 1;
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }, [searchParams]);

  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [serverPage, setServerPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/audit?page=${page}`);
      if (!r.ok) throw new Error("Failed to load audit log");
      const data: unknown = await r.json();
      if (!data || typeof data !== "object" || !("entries" in data) || !Array.isArray((data as AuditPageResponse).entries)) {
        throw new Error("Bad response");
      }
      const body = data as AuditPageResponse;
      setRows(body.entries);
      setTotal(body.total);
      setServerPage(body.page);
      if (body.page !== page) {
        const url = body.page <= 1 ? pathname : `${pathname}?page=${body.page}`;
        router.replace(url, { scroll: false });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pathname, router]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    setOpenId(null);
  }, [page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (serverPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(serverPage * PAGE_SIZE, total);
  const showPager = total > PAGE_SIZE;

  function goToPage(next: number) {
    const p = Math.max(1, Math.min(next, pageCount));
    if (p <= 1) router.replace(pathname, { scroll: false });
    else router.replace(`${pathname}?page=${p}`, { scroll: false });
  }

  if (loading) return <p className="text-zinc-500">Loading audit log…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Audit log
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Create, update, and delete actions for owners, epics, tasks, notes, and settings
            (saved in <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">store.json</code>
            ). Newest first.
            {total > 0 ? (
              <>
                {" "}
                Showing <strong className="text-zinc-700 dark:text-zinc-300">{from}</strong>–
                <strong className="text-zinc-700 dark:text-zinc-300">{to}</strong> of{" "}
                <strong className="text-zinc-700 dark:text-zinc-300">{total}</strong>.
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
        >
          Refresh
        </button>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      ) : null}

      {showPager ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <span className="text-zinc-600 dark:text-zinc-400">
            Page {serverPage} of {pageCount}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={serverPage <= 1}
              onClick={() => goToPage(serverPage - 1)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={serverPage >= pageCount}
              onClick={() => goToPage(serverPage + 1)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[80rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Id</th>
              <th className="px-3 py-2 font-medium">Summary</th>
              <th className="px-3 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="max-w-[12rem] align-middle px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                    <TableClampCell
                      className="text-sm"
                      fullTitle={new Date(row.at).toLocaleString()}
                    >
                      <span>{new Date(row.at).toLocaleString()}</span>
                    </TableClampCell>
                  </td>
                  <td className="max-w-[8rem] align-middle px-3 py-2 capitalize">
                    <TableClampCell className="text-sm" fullTitle={row.action}>
                      <span>{row.action}</span>
                    </TableClampCell>
                  </td>
                  <td className="max-w-[10rem] align-middle px-3 py-2">
                    <TableClampCell className="text-sm" fullTitle={entityLabel(row.entity)}>
                      <span>{entityLabel(row.entity)}</span>
                    </TableClampCell>
                  </td>
                  <td className="max-w-[14rem] align-middle px-3 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    <TableClampCell
                      className="text-xs"
                      fullTitle={row.entityId ?? undefined}
                    >
                      <span>{row.entityId ?? "—"}</span>
                    </TableClampCell>
                  </td>
                  <td className="min-w-[28rem] max-w-2xl align-middle px-3 py-2 text-zinc-900 dark:text-zinc-100">
                    <TableClampCell suppressTitle className="min-h-[2.5rem] text-sm">
                      <span>{row.summary}</span>
                    </TableClampCell>
                  </td>
                  <td className="px-3 py-2 align-middle whitespace-nowrap">
                    {row.detail ? (
                      <button
                        type="button"
                        className="text-blue-600 text-xs hover:underline dark:text-blue-400"
                        onClick={() => setOpenId((id) => (id === row.id ? null : row.id))}
                      >
                        {openId === row.id ? "Hide detail" : "Detail"}
                      </button>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
                {openId === row.id && row.detail ? (
                  <tr className="bg-zinc-50/80 dark:bg-zinc-900/40">
                    <td colSpan={6} className="px-3 py-2">
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                        {row.detail}
                      </pre>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !loading ? (
          <p className="p-6 text-center text-sm text-zinc-500">No audit entries yet.</p>
        ) : null}
      </div>
    </div>
  );
}

export function AuditLogClient() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading audit log…</p>}>
      <AuditLogClientInner />
    </Suspense>
  );
}
