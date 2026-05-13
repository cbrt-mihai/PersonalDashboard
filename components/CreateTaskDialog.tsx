"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Owner, TaskGroup } from "@/lib/schemas";
import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import { EntityKeyTagInput } from "@/components/EntityKeyTagInput";
import { NoteTagsEditor } from "@/components/NoteTagsEditor";
import { TaskStatusSelect } from "@/components/TaskStatusSelect";

export type CreateTaskFormState = {
  ownerId: string;
  groupId: string;
  name: string;
  description: string;
  type: string;
  status: string;
  date: string;
  priority: string;
  tags: string[];
  keyTag: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  owners: Owner[];
  groups: TaskGroup[];
  types: string[];
  priorities: string[];
  defaultOwnerId: string;
  /** Epic id or empty string for none */
  defaultGroupId?: string | null;
  lockOwner?: boolean;
  lockGroup?: boolean;
};

export function CreateTaskDialog({
  open,
  onClose,
  onSaved,
  owners,
  groups,
  types,
  priorities,
  defaultOwnerId,
  defaultGroupId = "",
  lockOwner = false,
  lockGroup = false,
}: Props) {
  const { statusKeys } = useDashboardConfig();
  const [form, setForm] = useState<CreateTaskFormState>({
    ownerId: "",
    groupId: "",
    name: "",
    description: "",
    type: "Task",
    status: "open",
    date: "",
    priority: "Medium",
    tags: [],
    keyTag: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const defaultStatus = statusKeys[0] ?? "open";
    const type0 = types[0] ?? "Task";
    setErr(null);
    setForm({
      ownerId: defaultOwnerId || owners[0]?.id || "",
      groupId: defaultGroupId ?? "",
      name: "",
      description: "",
      type: type0,
      status: defaultStatus,
      date: new Date().toISOString().slice(0, 10),
      priority: "Medium",
      tags: [],
      keyTag: "",
    });
  }, [open, defaultOwnerId, defaultGroupId, owners, statusKeys, types]);

  const ownerGroups = useMemo(() => {
    if (!form.ownerId) return [];
    return groups.filter((g) => g.ownerId === form.ownerId);
  }, [groups, form.ownerId]);

  const saveTask = useCallback(async () => {
    if (!form.ownerId || !form.name.trim()) return;
    setSaving(true);
    setErr(null);
    const payload = {
      ownerId: form.ownerId,
      groupId: form.groupId ? form.groupId : null,
      name: form.name.trim(),
      description: form.description,
      type: form.type,
      status: form.status,
      date: form.date,
      priority: form.priority,
      tags: form.tags,
      keyTag: form.keyTag,
    };
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      onClose();
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [form, onClose, onSaved]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">New task</h2>
        {err ? (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3">
          <label className="text-sm">
            <span className="text-zinc-500">Owner</span>
            <select
              value={form.ownerId}
              disabled={lockOwner}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ownerId: e.target.value,
                  groupId: lockGroup ? f.groupId : "",
                }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 disabled:opacity-70 dark:border-zinc-600 dark:bg-zinc-900"
            >
              {owners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Epic (optional)</span>
            <select
              value={form.groupId}
              disabled={lockGroup}
              onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 disabled:opacity-70 dark:border-zinc-600 dark:bg-zinc-900"
            >
              <option value="">None</option>
              {ownerGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <EntityKeyTagInput
            value={form.keyTag}
            onChange={(keyTag) => setForm((f) => ({ ...f, keyTag }))}
            defaultTag="TSK"
          />
          <label className="text-sm">
            <span className="text-zinc-500">Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Status</span>
            <TaskStatusSelect
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Priority</span>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Description (Markdown)</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={6}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <NoteTagsEditor tags={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => void saveTask()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
