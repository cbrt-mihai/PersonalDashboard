"use client";

import { useDashboardConfig } from "@/components/DashboardSettingsProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { HexColorPickerRow } from "@/components/OwnerStyleColorPicker";
import { OwnerSwatch } from "@/components/OwnerSwatch";
import { fileToOwnerIconDataUrl } from "@/lib/ownerIconDataUrl";
import { archiveNowIso, isArchived } from "@/lib/archive";
import { EntityArchivedBanner } from "./EntityArchivedMark";
import type { Owner } from "@/lib/schemas";
import { NAMED_OWNER_COLOR_PRESETS } from "@/lib/presetColors";

export function OwnerEditClient({ ownerId }: { ownerId: string }) {
  const { settings } = useDashboardConfig();
  const colorPresets =
    settings?.ownerColorPresets ??
    NAMED_OWNER_COLOR_PRESETS.map(({ name, color }) => ({ name, color }));

  const router = useRouter();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [iconErr, setIconErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/owners/${ownerId}`);
      if (!r.ok) throw new Error("Owner not found");
      const p: Owner = await r.json();
      setOwner(p);
      setName(p.name);
      setColor(p.color);
      setIconDataUrl(p.iconDataUrl ?? null);
      setArchived(isArchived(p));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setOwner(null);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/owners/${ownerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          iconDataUrl,
          archivedAt: archived ? (owner?.archivedAt ?? archiveNowIso()) : null,
        }),
      });
      if (!r.ok) throw new Error("Could not save");
      router.push(`/owners/${ownerId}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (err && !owner) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {err}{" "}
        <Link href="/owners" className="underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/owners/${ownerId}`}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to owner
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Edit owner
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Update display name and color.</p>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      ) : null}

      {owner ? <EntityArchivedBanner entity={owner} kind="owner" /> : null}

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="max-w-xl rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
        style={{ borderTopWidth: 4, borderTopColor: color }}
      >
        <label className="block text-sm">
          <span className="text-zinc-500">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            required
          />
        </label>
        <div className="mt-6 text-sm">
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
        <div className="mt-6 text-sm">
          <span className="text-zinc-500">Icon (optional)</span>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <OwnerSwatch
              color={color}
              iconDataUrl={iconDataUrl}
              className="h-12 w-12 rounded-lg"
              title={name || "Owner icon"}
            />
            <div className="flex flex-col gap-2">
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
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  onClick={() => setIconDataUrl(null)}
                  disabled={!iconDataUrl}
                >
                  Remove icon
                </button>
              </div>
              {iconErr ? <p className="text-xs text-red-600">{iconErr}</p> : null}
              <p className="text-xs text-zinc-500">
                PNG/WebP with transparency supported. Large images are resized automatically.
              </p>
            </div>
          </div>
        </div>
        <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          <span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Archived</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Archived owners may be hidden from default lists and searches. Saves with the rest of this
              form.
            </span>
          </span>
        </label>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <Link
            href={`/owners/${ownerId}`}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
