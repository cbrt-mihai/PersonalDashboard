# Personal dashboard

A **local-first** app for organizing your work in one place: people and areas you care about (**owners**), **projects**, **epics** (big buckets of work), **tasks**, **notes**, **time you log** (**worklogs**), **achievements**, and an **audit log** of changes. It runs on your machine; your data lives in a single file you control—no sign-up and no cloud database bundled in.

If you want architecture, APIs, and implementation detail, see **[README.technical.md](README.technical.md)**.

---

## Quick start

1. **Install** [Node.js](https://nodejs.org/) 20 or newer (includes `npm`).
2. In a terminal, go to this project folder.

   macOS / Linux:

   ```bash
   cd /path/to/PersonalDashboard
   ```

   Windows PowerShell:

   ```powershell
   cd C:\path\to\PersonalDashboard
   ```

3. Install dependencies and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Open **http://localhost:3000** in your browser.

On first use, the app creates its data file when needed. To try the UI with sample data instead of an empty slate, run:

```bash
npm run mock
npm run dev
```

That copies a prepared dataset into place, then you start the app as usual. The command is implemented with Node, so it works in macOS/Linux shells, Windows PowerShell, and Command Prompt. A screenshot-focused fixture is also available with `npm run mock:screenshots`.

**Other useful commands:** `npm run build` checks that everything compiles for production; `npm run start` serves a production build; `npm run lint` runs the code linter; `npm run mock:validate` checks the primary mock fixture without replacing your data.

---

## What you can do (overview)

Think of the app as a small personal **command center**: you record who/what work belongs to, break work into epics and tasks, jot notes, log time, and adjust how labels and statuses behave.

### Home (dashboard)

- See tasks in a **table** or grouped **by epic**.
- **Filter** by owner, tags, status, type, priority, and more (filters can be collapsed to save space on smaller screens).
- **Paginate** long task lists so the dashboard stays responsive with large datasets.
- **Create tasks** from the dashboard, open them to view or edit, and use **Markdown** for descriptions.
- **Subtasks** help you split a task into smaller check-off steps.
- **Layout width** is configurable (presets or a custom pixel max) so wide tables stay readable on large monitors.

### Owners

- **Owners** represent people, teams, or “lanes” of work you want to group by (with a color and optional icon).
- On an owner page you see their **epics**, **tasks**, and **notes**, and you can add new ones in context.

### Projects

- **Projects** are another way to scope work—often a product, initiative, or area.
- Each project can have a description, tags, **epics and tasks**, and **notes** tied to that project.

### Epics (task groups)

- An **epic** is a named group of related tasks (for example a milestone or theme).
- Use the **Epics** section in the nav to browse **all epics** with progress, then open one for its tasks and details.
- Epics also appear in context on **owner** and **project** pages.

### Tasks

- Tasks have a **name**, **status**, **type**, **priority**, **date**, optional **tags**, and optional **Markdown** details.
- They can sit inside an epic or be **ungrouped** under an owner.
- You can **archive** items when you want them out of the default view but not deleted.

### Notes

- **Notes** are free-form entries (title, body, status, type, priority, tags).
- You link a note to **at least one** owner and/or project so it stays findable in the right place.
- Each note gets a **public reference code** derived from that parent (so related items share a recognizable prefix). The numeric part can be **very short or quite long** (for example `TSK-3`, `TSK-3435`, or `PROJ-435343`), the same style as owners, projects, epics, tasks, and worklogs when you create them.
- When creating owners, projects, epics, tasks, or worklogs you can optionally set a **key tag** (letter prefix) so new keys match your naming scheme; notes inherit their prefix from the linked owner or project.

### Worklogs

- **Log time** against a task, epic, project, owner, or note—useful for weekly reviews or reporting.
- You can enter duration in **plain language** (for example “1h 30m” or “2d”). In **Settings**, you can set how many minutes count as one “day” for those shortcuts.

### Achievements

- A dedicated view helps you **summarize completed work** and worklog activity over a date range, with filters.
- You can **export** a snapshot (for example to share or archive outside the app).

### Search

- Use **Search** in the header or press **⌘K** (Mac) / **Ctrl+K** (Windows) to open a **quick search** across owners, projects, epics, tasks, notes, and worklogs.
- The top menu stays visible while you scroll and highlights the section you are currently viewing.

### Language

- Use the language control in the header to switch **platform chrome** (menus, buttons, empty states) between **English** and **Romanian**.
- The choice is stored in a browser cookie (`pd-locale`) and matches the page `lang` attribute for accessibility.
- **Your** content—task titles, note bodies, custom status names in Settings, and similar—is stored and shown exactly as you typed it; it is not machine-translated.

For developers who want to add another language, see **[Adding new localizations](#adding-new-localizations)** below.

### Audit Log

- The app keeps an **append-only log** of many create/update/delete actions so you can see **what changed** and when.
- Audit details are shown in a diff-style view when possible, so field changes are easier to scan than raw JSON.

### Settings

- Tune **task** statuses, types, and priorities; **note** statuses and types; **owner color** presets; **theme** behavior (light / dark and how the nav theme control looks); **worklog** defaults (including minutes per “day” for duration shortcuts); and **dashboard width**.
- **Export** downloads the full `store.json` as a dated file for backups or moving machines; **import** replaces the live store with a chosen JSON file (the app validates the shape—keep backups before importing).

### Markdown and wiki-style links

- Long text fields support **Markdown** (headings, lists, links, code, and more).
- Special **wiki links** in double brackets can jump straight to an owner, project, epic, task, or note. There is an in-app **Markdown** help page under **Docs** (Romanian uses [`docs/MARKDOWN.ro.md`](docs/MARKDOWN.ro.md) when that locale is active) and a longer reference in [`docs/MARKDOWN.md`](docs/MARKDOWN.md).

---

## Adding new localizations

Platform strings are **typed TypeScript objects**, not JSON bundles. **English** (`lib/i18n/locales/en.ts`) defines the full nested shape; every other locale must provide the **same keys** with translated string values.

1. **Add a locale module**  
   Copy `lib/i18n/locales/en.ts` to `lib/i18n/locales/<code>.ts` (use a short BCP 47-style code, e.g. `de` for German). Replace each string value with the translation. Do not rename or drop keys—TypeScript will error if the shape diverges from English.

2. **Register the locale**  
   In `lib/i18n/index.ts`, import your module and add it to the `LOCALES` object next to `en` and `ro`. `SupportedLocale` and `SUPPORTED_LOCALES` are derived from that map automatically.

3. **Language picker labels**  
   In `lib/i18n/locales/en.ts` (and every other locale file, including your new one), add entries under `language` for the new language’s **native** name, e.g. `german: "Deutsch"`. Then extend the `labels` map in `components/LanguageSelect.tsx` so the dropdown shows `t("language.german")` (or whatever keys you added) for the new code.

4. **Flag icon**  
   Add an SVG file at `public/flags/locale-<code>.svg`, then register that path in `components/LocaleFlagIcon.tsx`.

5. **In-app Markdown help (optional)**  
   `app/docs/markdown/MarkdownDocBody.tsx` only switches between the default file and Romanian today. For a third language, either add another imported markdown file and extend the `locale === …` logic, or rely on the English doc until you wire a translated file.

6. **Placeholders**  
   Strings may contain tokens like `{year}`, `{page}`, or `{total}`. Keep those token names **identical** across locales; only translate the surrounding text.

7. **Server and cookie**  
   No extra server wiring is required beyond step 2: `app/layout.tsx` and `lib/i18n/server.ts` already read the `pd-locale` cookie and pass the initial locale into `LocaleProvider`.

See also the **Internationalization** subsection in [README.technical.md](README.technical.md).

---

## Data and backups

Everything you add is stored in **`data/store.json`** on this computer. That file is the source of truth—**back it up** before risky experiments. It may be git-ignored for privacy; keep your own copies if you care about history.

---

## Further reading

- **[README.technical.md](README.technical.md)** — stack, folder layout, APIs, keys, migration, troubleshooting.
- **[docs/MARKDOWN.md](docs/MARKDOWN.md)** — wiki link syntax and Markdown behavior.
