"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/LocaleProvider";

type Change = { from: unknown; to: unknown };
type ParsedAuditDetail =
  | { kind: "changes"; changes: Record<string, Change> }
  | { kind: "created"; fields: Record<string, unknown> }
  | { kind: "deleted"; fields: Record<string, unknown> }
  | { kind: "raw"; raw: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseDetail(detail: string): ParsedAuditDetail {
  try {
    const parsed: unknown = JSON.parse(detail);
    if (isRecord(parsed) && isRecord(parsed.changes)) {
      const changes: Record<string, Change> = {};
      for (const [key, value] of Object.entries(parsed.changes)) {
        if (!isRecord(value) || !("from" in value) || !("to" in value)) continue;
        changes[key] = { from: value.from, to: value.to };
      }
      if (Object.keys(changes).length > 0) return { kind: "changes", changes };
    }
    if (isRecord(parsed) && isRecord(parsed.created)) {
      return { kind: "created", fields: parsed.created };
    }
    if (isRecord(parsed) && isRecord(parsed.deleted)) {
      return { kind: "deleted", fields: parsed.deleted };
    }
  } catch {
    // Fall through to raw rendering for legacy or truncated entries.
  }
  return { kind: "raw", raw: detail };
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function DiffLine({
  kind,
  children,
}: {
  kind: "add" | "remove" | "neutral";
  children: React.ReactNode;
}) {
  const cls =
    kind === "add"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
      : kind === "remove"
        ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100"
        : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";
  const prefix = kind === "add" ? "+" : kind === "remove" ? "-" : " ";

  return (
    <pre className={`overflow-x-auto whitespace-pre-wrap break-words border-l-4 px-3 py-2 font-mono text-xs ${cls}`}>
      <span className="select-none pr-2">{prefix}</span>
      {children}
    </pre>
  );
}

function FieldHeader({ name }: { name: string }) {
  return (
    <h4 className="rounded-t-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 font-mono text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
      {name}
    </h4>
  );
}

function renderChangeValue(change: Change, t: ReturnType<typeof useI18n>["t"]) {
  const from = typeof change.from === "string" ? change.from : null;
  const to = typeof change.to === "string" ? change.to : null;
  const shouldSplit =
    from !== null &&
    to !== null &&
    (from.includes("\n") || to.includes("\n") || from.length > 100 || to.length > 100);

  if (!shouldSplit) {
    return (
      <>
        <DiffLine kind="remove">
          {t("audit.from")}: {formatValue(change.from)}
        </DiffLine>
        <DiffLine kind="add">
          {t("audit.to")}: {formatValue(change.to)}
        </DiffLine>
      </>
    );
  }

  return (
    <>
      {(from ?? "").split("\n").map((line, index) => (
        <DiffLine key={`from-${index}`} kind="remove">
          {line || " "}
        </DiffLine>
      ))}
      {(to ?? "").split("\n").map((line, index) => (
        <DiffLine key={`to-${index}`} kind="add">
          {line || " "}
        </DiffLine>
      ))}
    </>
  );
}

export function AuditDetailDiff({ detail }: { detail: string }) {
  const { t } = useI18n();
  const parsed = useMemo(() => parseDetail(detail), [detail]);

  if (parsed.kind === "raw") {
    return (
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("audit.rawDetail")}
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          {parsed.raw}
        </pre>
      </div>
    );
  }

  const title =
    parsed.kind === "changes"
      ? t("audit.changedFields")
      : parsed.kind === "created"
        ? t("audit.createdFields")
        : t("audit.deletedFields");

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</div>
      {parsed.kind === "changes"
        ? Object.entries(parsed.changes).map(([field, change]) => (
            <section key={field} className="overflow-hidden rounded-lg">
              <FieldHeader name={field} />
              {renderChangeValue(change, t)}
            </section>
          ))
        : Object.entries(parsed.fields).map(([field, value]) => (
            <section key={field} className="overflow-hidden rounded-lg">
              <FieldHeader name={field} />
              <DiffLine kind={parsed.kind === "created" ? "add" : "remove"}>
                {formatValue(value)}
              </DiffLine>
            </section>
          ))}
    </div>
  );
}
