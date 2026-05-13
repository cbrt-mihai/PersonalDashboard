# Personal dashboard

A **local-first** app for organizing your work in one place: people and areas you care about (**owners**), **projects**, **epics** (big buckets of work), **tasks**, **notes**, and **time you log** (**worklogs**). It runs on your machine; your data lives in a single file you control—no sign-up and no cloud database bundled in.

If you want architecture, APIs, and implementation detail, see **[README.technical.md](README.technical.md)**.

---

## Quick start

1. **Install** [Node.js](https://nodejs.org/) 20 or newer (includes `npm`).
2. In a terminal, go to this project folder and run:

   ```bash
   npm install
   npm run dev
   ```

3. Open **http://localhost:3000** in your browser.

On first use, the app creates its data file when needed. To try the UI with sample data instead of an empty slate, run:

```bash
npm run mock:screenshots
npm run dev
```

That copies a prepared dataset into place, then you start the app as usual.

**Other useful commands:** `npm run build` checks that everything compiles for production; `npm run start` serves a production build; `npm run lint` runs the code linter.

---

## What you can do (overview)

Think of the app as a small personal **command center**: you record who/what work belongs to, break work into epics and tasks, jot notes, log time, and adjust how labels and statuses behave.

### Home (dashboard)

- See tasks in a **table** or grouped **by epic**.
- **Filter** by owner, tags, status, type, priority, and more.
- **Create tasks** from the dashboard, open them to view or edit, and use **Markdown** for descriptions.
- **Subtasks** help you split a task into smaller check-off steps.

### Owners

- **Owners** represent people, teams, or “lanes” of work you want to group by (with a color and optional icon).
- On an owner page you see their **epics**, **tasks**, and **notes**, and you can add new ones in context.

### Projects

- **Projects** are another way to scope work—often a product, initiative, or area.
- Each project can have a description, tags, **epics and tasks**, and **notes** tied to that project.

### Epics (task groups)

- An **epic** is a named group of related tasks (for example a milestone or theme).
- You can browse epics across the app and drill into one epic’s tasks and progress.

### Tasks

- Tasks have a **name**, **status**, **type**, **priority**, **date**, optional **tags**, and optional **Markdown** details.
- They can sit inside an epic or be **ungrouped** under an owner.
- You can **archive** items when you want them out of the default view but not deleted.

### Notes

- **Notes** are free-form entries (title, body, status, type, priority, tags).
- You link a note to **at least one** owner and/or project so it stays findable in the right place.
- Each note gets a **public reference code** derived from that parent (so related items share a recognizable prefix). The numeric part can be **very short or quite long** (for example `ONE-3`, `ONE-3435`, or `RBRAND-435343`), the same style as owners and projects.

### Worklogs

- **Log time** against a task, epic, project, owner, or note—useful for weekly reviews or reporting.
- You can enter duration in **plain language** (for example “1h 30m” or “2d”). In **Settings**, you can set how many minutes count as one “day” for those shortcuts.

### Achievements

- A dedicated view helps you **summarize completed work** and worklog activity over a date range, with filters.
- You can **export** a snapshot (for example to share or archive outside the app).

### Search

- Use **Search** in the header or press **⌘K** (Mac) / **Ctrl+K** (Windows) to open a **quick search** across owners, projects, epics, tasks, and notes.

### Audit log

- The app keeps an **append-only log** of many create/update/delete actions so you can see **what changed** and when.

### Settings

- Tune **task** statuses, types, and priorities; **note** statuses and types; **owner color** presets; **theme** behavior; and **worklog** defaults—so the vocabulary matches how you actually work.

### Markdown and wiki-style links

- Long text fields support **Markdown** (headings, lists, links, code, and more).
- Special **wiki links** in double brackets can jump straight to an owner, project, epic, task, or note. There is an in-app **Markdown** help page under **Docs** and a longer reference in [`docs/MARKDOWN.md`](docs/MARKDOWN.md).

---

## Data and backups

Everything you add is stored in **`data/store.json`** on this computer. That file is the source of truth—**back it up** before risky experiments. It may be git-ignored for privacy; keep your own copies if you care about history.

---

## Further reading

- **[README.technical.md](README.technical.md)** — stack, folder layout, APIs, keys, migration, troubleshooting.
- **[docs/MARKDOWN.md](docs/MARKDOWN.md)** — wiki link syntax and Markdown behavior.
- **[AGENTS.md](AGENTS.md)** — short note for automated assistants working in this repo.
