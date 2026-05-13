"use client";

import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useDashboardLocalPager } from "@/lib/useDashboardLocalPager";
import { HexColorPickerRow } from "@/components/OwnerStyleColorPicker";
import { OwnerSwatch } from "@/components/OwnerSwatch";
import { TrashIcon } from "@/components/icons";
import { fileToOwnerIconDataUrl } from "@/lib/ownerIconDataUrl";
import type { Owner, Project, Task, TaskGroup } from "@/lib/schemas";
import { NAMED_OWNER_COLOR_PRESETS } from "@/lib/presetColors";
import { isArchived } from "@/lib/archive";
import { EntityArchivedBadge } from "@/components/EntityArchivedMark";
import { EntityKeyTagInput } from "@/components/EntityKeyTagInput";
import { DashboardFilterDisclosure } from "@/components/DashboardFilterDisclosure";
import { DashboardPager } from "@/components/DashboardPager";

export function OwnersListClient() {
  const { settings } = useDashboardConfig();
  const colorPresets =
    settings?.ownerColorPresets ??
    NAMED_OWNER_COLOR_PRESETS.map(({ name, color }) => ({ name, color }));

  const [owners, setOwners] = useState<Owner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [keyTag, setKeyTag] = useState("");
  const [color, setColor] = useState<string>(NAMED_OWNER_COLOR_PRESETS[0]!.color);
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const [iconErr, setIconErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, pj, g, t] = await Promise.all([
      fetch("/api/owners").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
    ]);
    setOwners(p);
    setProjects(pj);
    setGroups(g);
    setTasks(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function createOwner(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/api/owners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color, iconDataUrl, keyTag }),
    });
    setName("");
    setKeyTag("");
    setIconDataUrl(null);
    setIconErr(null);
    await load();
  }

  async function deleteOwner(id: string) {
    const r = await fetch(`/api/owners/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.error ?? "Cannot delete (remove tasks, epics, and notes first)");
      return;
    }
    await load();
  }

  function taskCount(ownerId: string) {
    return tasks.filter((t) => t.ownerId === ownerId).length;
  }

  const projectNameById = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p.name] as const));
  }, [projects]);

  function ownerProjectNames(ownerId: string): string[] {
    const epicProjectIds = new Set(
      groups
        .filter((g) => g.ownerId === ownerId)
        .map((g) => g.projectId)
        .filter((x): x is string => Boolean(x)),
    );
    return [...epicProjectIds]
      .map((id) => projectNameById.get(id) ?? id)
      .sort((a, b) => a.localeCompare(b));
  }

  const filteredOwners = useMemo(() => {
    let list = owners.filter((p) => {
      if (!isArchived(p)) return true;
      return showArchived;
    });
    const ql = q.trim().toLowerCase();
    if (ql) list = list.filter((p) => p.name.toLowerCase().includes(ql));
    return list;
  }, [owners, showArchived, q]);

  const ownerPagerResetKey = useMemo(() => JSON.stringify({ q, showArchived }), [q, showArchived]);

  const ownerPager = useDashboardLocalPager(filteredOwners.length, ownerPagerResetKey);

  const pagedOwners = useMemo(() => ownerPager.slice(filteredOwners), [ownerPager, filteredOwners]);

  if (loading) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Owners
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Each owner has a color used across tasks. Open an owner for epics, tasks, and
          timestamped notes.
        </p>
      </div>

      <DashboardFilterDisclosure>
        <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Owner name"
            className="rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          />
          <span className="mt-1 text-xs text-zinc-500">
            Archived owners are hidden unless you enable below.
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-600"
          />
          Show archived
        </label>
        </div>
      </DashboardFilterDisclosure>

      <form
        onSubmit={(e) => void createOwner(e)}
        className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-end"
      >
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-zinc-500">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="Acme Corp"
          />
        </label>
        <div className="min-w-[14rem] flex-1">
          <EntityKeyTagInput value={keyTag} onChange={setKeyTag} defaultTag="OWN" />
        </div>
        <div className="text-sm">
          <span className="text-zinc-500">Color</span>
          <div className="mt-2">
            <HexColorPickerRow
              value={color}
              onChange={setColor}
              swatches={colorPresets.map((p) => p.color)}
              swatchTitles={colorPresets.map((p) => p.name)}
            />
          </div>
        </div>
        <div className="text-sm sm:min-w-[16rem]">
          <span className="text-zinc-500">Icon (optional)</span>
          <div className="mt-2 flex items-center gap-3">
            <OwnerSwatch
              color={color}
              iconDataUrl={iconDataUrl}
              className="h-10 w-10 rounded-md"
              title={name || "Owner icon"}
            />
            <div className="min-w-0 flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setIconErr(null);
                  queueMicrotask(() => {
                    void fileToOwnerIconDataUrl(f)
                      .then((url) => setIconDataUrl(url))
                      .catch((err) =>
                        setIconErr(err instanceof Error ? err.message : "Could not load icon"),
                      );
                  });
                }}
                className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
              />
              {iconErr ? <p className="mt-1 text-xs text-red-600">{iconErr}</p> : null}
            </div>
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add owner
        </button>
      </form>

      <DashboardPager
        page={ownerPager.page}
        pageCount={ownerPager.pageCount}
        total={ownerPager.total}
        pageSize={ownerPager.pageSize}
        onPageChange={ownerPager.setPage}
      />

      <ul className="grid gap-4 sm:grid-cols-2">
        {pagedOwners.map((p) => (
          <li
            key={p.id}
            className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            style={{ borderLeftWidth: 4, borderLeftColor: p.color }}
            {...(isArchived(p) ? { "data-pd-archived": "true" } : {})}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/owners/${p.id}`}
                    className="block min-w-0 flex-1 truncate text-lg font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {p.name}
                  </Link>
                  <EntityArchivedBadge entity={p} />
                </div>
              </div>
              <Link
                href={`/owners/${p.id}`}
                className="shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
                aria-label={`Open ${p.name}`}
                title={`Open ${p.name}`}
              >
                <OwnerSwatch owner={p} className="h-14 w-14 rounded-xl" />
              </Link>
            </div>
            <p className="mt-2 text-sm text-zinc-500">
              {taskCount(p.id)} task{taskCount(p.id) === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Projects:{" "}
              {(() => {
                const names = ownerProjectNames(p.id);
                if (names.length === 0) return "—";
                const shown = names.slice(0, 3);
                return `${shown.join(", ")}${names.length > shown.length ? ` (+${names.length - shown.length})` : ""}`;
              })()}
            </p>
            <div className="mt-4 flex gap-3 text-sm">
              <Link
                href={`/owners/${p.id}`}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Open
              </Link>
              <Link
                href={`/owners/${p.id}/edit`}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Edit
              </Link>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                onClick={() => void deleteOwner(p.id)}
                aria-label="Delete owner"
                title="Delete owner"
              >
                <TrashIcon />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {filteredOwners.length === 0 ? (
        <p className="text-sm text-zinc-500">No owners yet. Create one above.</p>
      ) : null}
    </div>
  );
}
