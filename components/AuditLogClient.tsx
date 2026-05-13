"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuditDetailDiff } from "@/components/AuditDetailDiff";
import { useI18n } from "@/components/LocaleProvider";
import type { AuditEvent } from "@/lib/schemas";
import { TableClampCell } from "@/components/TableClampCell";

const PAGE_SIZE = 100;

type AuditPageResponse = {
  entries: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
};

function AuditLogClientInner() {
  const { t } = useI18n();
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
      if (!r.ok) throw new Error(t("audit.failedToLoad"));
      const data: unknown = await r.json();
      if (!data || typeof data !== "object" || !("entries" in data) || !Array.isArray((data as AuditPageResponse).entries)) {
        throw new Error(t("audit.badResponse"));
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
      setErr(e instanceof Error ? e.message : t("audit.loadFailed"));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pathname, router, t]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    queueMicrotask(() => setOpenId(null));
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

  if (loading) return <p className="text-zinc-500">{t("common.loadingAuditLog")}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t("audit.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            {t("audit.description")}
            {total > 0 ? (
              <>
                {" "}
                <strong className="text-zinc-700 dark:text-zinc-300">
                  {t("common.showingRange", { from, to, total })}
                </strong>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
        >
          {t("common.refresh")}
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
            {t("common.pageXOfY", { page: serverPage, pageCount })}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={serverPage <= 1}
              onClick={() => goToPage(serverPage - 1)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600"
            >
              {t("common.previous")}
            </button>
            <button
              type="button"
              disabled={serverPage >= pageCount}
              onClick={() => goToPage(serverPage + 1)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[80rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">{t("audit.columns.when")}</th>
              <th className="px-3 py-2 font-medium">{t("audit.columns.action")}</th>
              <th className="px-3 py-2 font-medium">{t("audit.columns.type")}</th>
              <th className="px-3 py-2 font-medium">{t("audit.columns.id")}</th>
              <th className="px-3 py-2 font-medium">{t("audit.columns.summary")}</th>
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
                      <span>{t(`audit.actions.${row.action}`)}</span>
                    </TableClampCell>
                  </td>
                  <td className="max-w-[10rem] align-middle px-3 py-2">
                    <TableClampCell className="text-sm" fullTitle={t(`audit.entities.${row.entity}`)}>
                      <span>{t(`audit.entities.${row.entity}`)}</span>
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
                        {openId === row.id ? t("audit.hideDetail") : t("audit.detail")}
                      </button>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
                {openId === row.id && row.detail ? (
                  <tr className="bg-zinc-50/80 dark:bg-zinc-900/40">
                    <td colSpan={6} className="px-3 py-2">
                      <AuditDetailDiff detail={row.detail} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !loading ? (
          <p className="p-6 text-center text-sm text-zinc-500">{t("audit.empty")}</p>
        ) : null}
      </div>
    </div>
  );
}

export function AuditLogClient() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<p className="text-zinc-500">{t("common.loadingAuditLog")}</p>}>
      <AuditLogClientInner />
    </Suspense>
  );
}
