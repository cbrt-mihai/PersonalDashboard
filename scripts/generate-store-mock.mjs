/**
 * One-off generator for data/store.mock.json — exhaustive, consistent fixtures.
 * Run: node scripts/generate-store-mock.mjs && node scripts/validate-mock-store.mjs
 */
import fs from "node:fs";
import path from "node:path";

const icon = (bg, paths) =>
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/>${paths}</svg>`,
  ).toString("base64");

const owners = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    key: "OPS-1",
    name: "Operations",
    color: "#1d4ed8",
    archivedAt: null,
    iconDataUrl: icon(
      "#1d4ed8",
      `<path fill="#fff" opacity=".92" d="M32 18l2.2 4.5 4.9.7-3.5 3.4.8 4.9L32 29l-4.4 2.3.8-4.9-3.5-3.4 4.9-.7L32 18z"/>`,
    ),
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    key: "UX-2",
    name: "UX Studio",
    color: "#7c3aed",
    archivedAt: null,
    iconDataUrl: icon(
      "#7c3aed",
      `<path fill="none" stroke="#fff" stroke-width="3" opacity=".9" d="M20 38c6-14 18-14 24 0" stroke-linecap="round"/>`,
    ),
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    key: "PLAT-3",
    name: "Platform Team",
    color: "#0f766e",
    archivedAt: null,
    iconDataUrl: icon(
      "#0f766e",
      `<path fill="#fff" opacity=".9" d="M22 22h8v8h-8zm12 0h8v8h-8zm-12 12h8v8h-8zm12 0h8v8h-8z"/>`,
    ),
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    key: "SEC-4",
    name: "Security",
    color: "#b91c1c",
    archivedAt: null,
    iconDataUrl: icon(
      "#b91c1c",
      `<path fill="#fff" opacity=".92" d="M32 20l12 6v9c0 7-5 13-12 15-7-2-12-8-12-15v-9l12-6z"/>`,
    ),
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    key: "DATA-5",
    name: "Data & Analytics",
    color: "#c2410c",
    archivedAt: null,
    iconDataUrl: icon(
      "#c2410c",
      `<path fill="#fff" opacity=".9" d="M22 40V28h6v12zm8-16v16h6V24zm8 8v8h6v-8z"/>`,
    ),
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    key: "GROW-6",
    name: "Growth",
    color: "#047857",
    archivedAt: null,
    iconDataUrl: icon(
      "#047857",
      `<path fill="none" stroke="#fff" stroke-width="3" opacity=".92" d="M22 42l8-14 6 8 6-18" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    key: "FIN-7",
    name: "Finance Systems",
    color: "#4338ca",
    archivedAt: null,
    iconDataUrl: icon(
      "#4338ca",
      `<path fill="#fff" opacity=".9" d="M32 22a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4v12l8-6-8-6z"/>`,
    ),
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    key: "SRE-8",
    name: "Site Reliability",
    color: "#0369a1",
    archivedAt: null,
    iconDataUrl: icon(
      "#0369a1",
      `<path fill="#fff" opacity=".88" d="M38 22c-2 0-3 1-4 2-3-2-7-1-9 2-2 3-1 7 2 9l-2 6 6-2c2 2 5 3 8 1 3-1 5-5 4-8s-4-5-7-5h2z"/>`,
    ),
  },
];

const projects = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    key: "PDASH-1",
    name: "Personal Dashboard polish",
    archivedAt: null,
    color: "#6366f1",
    iconDataUrl: icon(
      "#6366f1",
      `<path fill="#fff" opacity=".9" d="M22 24h20v16H22zm4-6h12v4H26z"/><path fill="#c7d2fe" d="M26 28h8v2h-8zm0 4h12v2H26zm0 4h6v2h-6z"/>`,
    ),
    description:
      "Shell navigation, i18n, audit trail polish, and mock fixtures for local demos.",
    tags: ["i18n", "navigation", "audit"],
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    key: "DOCS-2",
    name: "Documentation refresh",
    archivedAt: null,
    color: "#ea580c",
    iconDataUrl: icon(
      "#ea580c",
      `<path fill="#fff" opacity=".9" d="M24 20h14a2 2 0 0 1 2 2v22H26a2 2 0 0 1-2-2V20z"/><path fill="#fed7aa" d="M28 26h10v2H28zm0 4h10v2H28zm0 4h6v2h-6z"/>`,
    ),
    description: "Cross-platform setup, troubleshooting, and contributor onboarding.",
    tags: ["docs", "windows", "macos"],
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    key: "APIGW-3",
    name: "API gateway hardening",
    archivedAt: null,
    color: "#0891b2",
    iconDataUrl: icon(
      "#0891b2",
      `<path fill="none" stroke="#fff" stroke-width="3" opacity=".92" d="M22 32h8l4-8 4 16 4-8h8" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
    description: "Rate limits, JWT validation, and canary routing for public endpoints.",
    tags: ["api", "security", "edge"],
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    key: "MOBIL-4",
    name: "Retail mobile app",
    archivedAt: null,
    color: "#be185d",
    iconDataUrl: icon(
      "#be185d",
      `<rect x="24" y="18" width="16" height="28" rx="3" fill="#fff" opacity=".92"/><path fill="#be185d" d="M28 22h8v18h-8z"/>`,
    ),
    description: "Offline carts, push promos, and store-mode performance tuning.",
    tags: ["mobile", "retail", "offline"],
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    key: "MLPLT-5",
    name: "ML recommendations platform",
    archivedAt: null,
    color: "#7c3aed",
    iconDataUrl: icon(
      "#7c3aed",
      `<circle cx="24" cy="28" r="4" fill="#fff" opacity=".9"/><circle cx="40" cy="22" r="4" fill="#fff" opacity=".75"/><circle cx="40" cy="38" r="4" fill="#fff" opacity=".75"/><path stroke="#fff" stroke-width="2" opacity=".6" d="M27 29l9-5M28 31l8 5M32 32v-4"/>`,
    ),
    description: "Feature store hygiene, model cards, and shadow traffic for ranking.",
    tags: ["ml", "recommendations", "data"],
  },
  {
    id: "20000000-0000-4000-8000-000000000006",
    key: "CPORT-6",
    name: "Customer portal",
    archivedAt: null,
    color: "#16a34a",
    iconDataUrl: icon(
      "#16a34a",
      `<circle cx="26" cy="26" r="5" fill="#fff" opacity=".9"/><circle cx="38" cy="26" r="5" fill="#fff" opacity=".75"/><path fill="#bbf7d0" d="M22 38c2-4 6-6 10-6s8 2 10 6v2H22v-2z"/>`,
    ),
    description: "SSO, invoices, and support ticket history for mid-market accounts.",
    tags: ["portal", "sso", "billing"],
  },
  {
    id: "20000000-0000-4000-8000-000000000007",
    key: "CMPLY-7",
    name: "SOC readiness",
    archivedAt: null,
    color: "#ca8a04",
    iconDataUrl: icon(
      "#ca8a04",
      `<path fill="#fff" opacity=".9" d="M26 20h12v16H26zm2 4h8v2h-8zm0 4h8v2h-8zm0 4h5v2h-5z"/><path fill="#fef08a" d="M28 44l4 4 8-8-2-2-6 6-2-2z"/>`,
    ),
    description: "Evidence collection, access reviews, and vendor questionnaire automation.",
    tags: ["compliance", "soc", "audit"],
  },
  {
    id: "20000000-0000-4000-8000-000000000008",
    key: "OBSRV-8",
    name: "Observability uplift",
    archivedAt: null,
    color: "#0ea5e9",
    iconDataUrl: icon(
      "#0ea5e9",
      `<path fill="none" stroke="#fff" stroke-width="3" opacity=".92" d="M20 40l6-10 6 6 8-14" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
    description: "SLO dashboards, trace sampling budgets, and noisy-alert burn-down.",
    tags: ["sre", "metrics", "tracing"],
  },
];

const O = (n) => owners[n - 1].id;
const P = (n) => projects[n - 1].id;

const taskGroups = [
  { id: "30000000-0000-4000-8000-000000000001", key: "INTL-1", ownerId: O(3), projectId: P(1), archivedAt: null, name: "Language support", description: "Locale files, RTL prep, and copy review workflow.", tags: ["i18n"] },
  { id: "30000000-0000-4000-8000-000000000002", key: "NAVPO-2", ownerId: O(2), projectId: P(1), archivedAt: null, name: "Navigation polish", description: "Active routes, mobile overflow, keyboard shortcuts.", tags: ["nav", "ux"] },
  { id: "30000000-0000-4000-8000-000000000003", key: "WINPZ-3", ownerId: O(1), projectId: P(2), archivedAt: null, name: "Windows parity", description: "PowerShell scripts, path separators, and CI matrix rows.", tags: ["windows", "docs"] },
  { id: "30000000-0000-4000-8000-000000000004", key: "PUBSZ-4", ownerId: O(4), projectId: P(3), archivedAt: null, name: "Public surface controls", description: "WAF rules, bot scoring, and abuse playbooks.", tags: ["security", "api"] },
  { id: "30000000-0000-4000-8000-000000000005", key: "OFFLN-5", ownerId: O(2), projectId: P(4), archivedAt: null, name: "Offline retail flows", description: "Queue sync, conflict resolution, and UX for flaky networks.", tags: ["mobile", "offline"] },
  { id: "30000000-0000-4000-8000-000000000006", key: "FEAST-6", ownerId: O(5), projectId: P(5), archivedAt: null, name: "Feature store", description: "Entity keys, TTL policies, and backfill jobs.", tags: ["ml", "data"] },
  { id: "30000000-0000-4000-8000-000000000007", key: "BILLG-7", ownerId: O(7), projectId: P(6), archivedAt: null, name: "Billing UX", description: "Proration display, tax lines, and dunning emails.", tags: ["billing", "portal"] },
  { id: "30000000-0000-4000-8000-000000000008", key: "EVIDC-8", ownerId: O(4), projectId: P(7), archivedAt: null, name: "Evidence lockers", description: "Immutable exports and signed URLs for auditors.", tags: ["compliance"] },
  { id: "30000000-0000-4000-8000-000000000009", key: "ALERT-9", ownerId: O(8), projectId: P(8), archivedAt: null, name: "Alert budget", description: "SLO-based routing and on-call fatigue metrics.", tags: ["sre", "observability"] },
  { id: "30000000-0000-4000-8000-000000000010", key: "GROWA-10", ownerId: O(6), projectId: P(6), archivedAt: null, name: "Activation experiments", description: "A/B hooks, holdouts, and guardrail metrics.", tags: ["growth", "experiment"] },
  { id: "30000000-0000-4000-8000-000000000011", key: "BKLOG-11", ownerId: O(3), projectId: null, archivedAt: null, name: "Platform backlog (unscoped)", description: "Tasks not yet tied to a delivery project.", tags: ["backlog"] },
  { id: "30000000-0000-4000-8000-000000000012", key: "LEGAC-12", ownerId: O(1), projectId: P(2), archivedAt: "2025-12-01T10:00:00.000Z", name: "Legacy PDF export (archived epic)", description: "Superseded by web-first docs; kept for history.", tags: ["archived"] },
];

const G = (n) => taskGroups[n - 1].id;

const tasks = [
  { id: "40000000-0000-4000-8000-000000000001", key: "TASK-1", ownerId: O(3), groupId: G(1), archivedAt: null, name: "Add English and Romanian dictionaries", description: "`.ts` locale modules and `{year}` style placeholders.", type: "Task", status: "done", date: "2026-05-10", priority: "High", tags: ["i18n"], subtasks: [{ id: "50000000-0000-4000-8000-000000000001", title: "English base schema", done: true }, { id: "50000000-0000-4000-8000-000000000002", title: "Romanian strings QA", done: true }], createdAt: "2026-05-09T08:00:00.000Z", updatedAt: "2026-05-10T16:00:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000002", key: "TASK-2", ownerId: O(2), groupId: G(2), archivedAt: null, name: "Make active menu state obvious", description: "Route-prefix match + sticky nav on long pages.", type: "Task", status: "in_progress", date: "2026-05-14", priority: "Medium", tags: ["nav"], subtasks: [{ id: "50000000-0000-4000-8000-000000000003", title: "Prefix matcher", done: true }, { id: "50000000-0000-4000-8000-000000000004", title: "Mobile wrap QA", done: false }], createdAt: "2026-05-11T09:00:00.000Z", updatedAt: "2026-05-14T11:00:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000003", key: "TASK-3", ownerId: O(1), groupId: G(3), archivedAt: null, name: "Verify Windows setup instructions", description: "PowerShell path, npm scripts, and mock copy command.", type: "Task", status: "open", date: "2026-05-16", priority: "High", tags: ["windows", "docs"], subtasks: [], createdAt: "2026-05-12T10:00:00.000Z", updatedAt: "2026-05-12T10:00:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000004", key: "TASK-4", ownerId: O(4), groupId: G(4), archivedAt: null, name: "Canary JWT validator rollout", description: "Shadow mode one week, then enforce.", type: "Spike", status: "in_progress", date: "2026-05-13", priority: "High", tags: ["api", "security"], subtasks: [{ id: "50000000-0000-4000-8000-000000000005", title: "Metrics board", done: true }, { id: "50000000-0000-4000-8000-000000000006", title: "Cutover checklist", done: false }], createdAt: "2026-05-08T14:00:00.000Z", updatedAt: "2026-05-13T09:00:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000005", key: "TASK-5", ownerId: O(2), groupId: G(5), archivedAt: null, name: "Offline cart merge conflicts", description: "Last-write-wins vs manual resolve — product decision pending.", type: "Bug", status: "open", date: "2026-05-18", priority: "Critical", tags: ["mobile", "offline"], subtasks: [], createdAt: "2026-05-10T11:00:00.000Z", updatedAt: "2026-05-10T11:00:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000006", key: "TASK-6", ownerId: O(5), groupId: G(6), archivedAt: null, name: "Backfill user embeddings job", description: "Idempotent Spark job with checkpointing.", type: "Task", status: "done", date: "2026-05-01", priority: "Medium", tags: ["ml", "data"], subtasks: [{ id: "50000000-0000-4000-8000-000000000007", title: "Dry run", done: true }], createdAt: "2026-04-28T07:00:00.000Z", updatedAt: "2026-05-01T18:00:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000007", key: "TASK-7", ownerId: O(7), groupId: G(7), archivedAt: null, name: "Proration line on invoice PDF", description: "Align with tax service v3 decimals.", type: "Task", status: "in_progress", date: "2026-05-15", priority: "Medium", tags: ["billing"], subtasks: [], createdAt: "2026-05-12T13:00:00.000Z", updatedAt: "2026-05-14T08:30:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000008", key: "TASK-8", ownerId: O(4), groupId: G(8), archivedAt: null, name: "Signed URL expiry for auditor packs", description: "Max 24h; audit trail on regeneration.", type: "Task", status: "open", date: "2026-05-20", priority: "High", tags: ["compliance"], subtasks: [], createdAt: "2026-05-11T16:00:00.000Z", updatedAt: "2026-05-11T16:00:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000009", key: "TASK-9", ownerId: O(8), groupId: G(9), archivedAt: null, name: "SLO burn rate alerts", description: "Multi-window, routing by severity.", type: "Task", status: "done", date: "2026-04-20", priority: "High", tags: ["sre"], subtasks: [], createdAt: "2026-04-18T10:00:00.000Z", updatedAt: "2026-04-20T15:00:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000010", key: "TASK-10", ownerId: O(6), groupId: G(10), archivedAt: null, name: "Holdout group for onboarding tips", description: "Feature flag + analytics contract.", type: "Spike", status: "open", date: "2026-05-22", priority: "Low", tags: ["growth"], subtasks: [], createdAt: "2026-05-13T12:00:00.000Z", updatedAt: "2026-05-13T12:00:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000011", key: "TASK-11", ownerId: O(3), groupId: G(11), archivedAt: null, name: "Upgrade Node LTS on build agents", description: "Blocked on vendor image; track here.", type: "Task", status: "open", date: "2026-06-01", priority: "Medium", tags: ["infra"], subtasks: [], createdAt: "2026-05-01T09:00:00.000Z", updatedAt: "2026-05-05T10:00:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000012", key: "TASK-12", ownerId: O(5), groupId: null, archivedAt: null, name: "Ad-hoc churn cohort export", description: "One-off for leadership review Friday.", type: "Task", status: "in_progress", date: "2026-05-14", priority: "High", tags: ["data", "adhoc"], subtasks: [], createdAt: "2026-05-13T07:00:00.000Z", updatedAt: "2026-05-14T06:00:00.000Z" },
  { id: "40000000-0000-4000-8000-000000000013", key: "TASK-13", ownerId: O(1), groupId: null, archivedAt: null, name: "Rotate on-call handoff template", description: "Add customer impact section.", type: "Task", status: "done", date: "2026-05-08", priority: "Low", tags: ["ops"], subtasks: [], createdAt: "2026-05-07T17:00:00.000Z", updatedAt: "2026-05-08T09:00:00.000Z" },
];

const T = (n) => tasks[n - 1].id;

const ownerEntries = [
  { id: "60000000-0000-4000-8000-000000000001", key: "PDASH-1-1", ownerId: null, projectId: P(1), archivedAt: null, title: "Translation rollout notes", body: "Platform chrome first; user-authored markdown unchanged.\n\nRelated: [[task:TASK-1]]", createdAt: "2026-05-10T12:00:00.000Z", closedAt: null, status: "todo", type: "Note", priority: "Medium", tags: ["i18n"], taskId: T(1), taskGroupId: G(1) },
  { id: "60000000-0000-4000-8000-000000000002", key: "DOCS-2-1", ownerId: O(1), projectId: P(2), archivedAt: null, title: "Windows README checklist", body: "- PowerShell quick start\n- npm ci\n- mock fixture copy", createdAt: "2026-05-11T13:00:00.000Z", closedAt: null, status: "todo", type: "Decision", priority: "High", tags: ["docs"], taskId: T(3), taskGroupId: null },
  { id: "60000000-0000-4000-8000-000000000003", key: "APIGW-3-1", ownerId: null, projectId: P(3), archivedAt: null, title: "JWT shadow period", body: "Week of 2026-05-06: log only mismatches.", createdAt: "2026-05-06T09:00:00.000Z", closedAt: "2026-05-12T17:00:00.000Z", status: "done", type: "Note", priority: "Medium", tags: ["security"], taskId: T(4), taskGroupId: G(4) },
  { id: "60000000-0000-4000-8000-000000000004", key: "MOBIL-4-1", ownerId: O(2), projectId: P(4), archivedAt: null, title: "Offline UX principles", body: "Prefer clarity over speed of sync.", createdAt: "2026-05-09T15:00:00.000Z", closedAt: null, status: "todo", type: "Note", priority: "Low", tags: ["ux"], taskId: null, taskGroupId: G(5) },
  { id: "60000000-0000-4000-8000-000000000005", key: "MLPLT-5-1", ownerId: O(5), projectId: P(5), archivedAt: null, title: "Model card template", body: "Owner: Data & Analytics; refresh quarterly.", createdAt: "2026-04-30T10:00:00.000Z", closedAt: null, status: "in_progress", type: "Note", priority: "Medium", tags: ["ml"], taskId: T(6), taskGroupId: G(6) },
  { id: "60000000-0000-4000-8000-000000000006", key: "CPORT-6-1", ownerId: O(7), projectId: P(6), archivedAt: null, title: "Tax rounding policy", body: "Match finance spreadsheet v9.", createdAt: "2026-05-12T08:00:00.000Z", closedAt: null, status: "todo", type: "Decision", priority: "High", tags: ["billing"], taskId: T(7), taskGroupId: G(7) },
  { id: "60000000-0000-4000-8000-000000000007", key: "CMPLY-7-1", ownerId: O(4), projectId: P(7), archivedAt: null, title: "Auditor pack SLA", body: "Regenerate within 1 business hour when requested.", createdAt: "2026-05-01T11:00:00.000Z", closedAt: null, status: "todo", type: "Note", priority: "High", tags: ["compliance"], taskId: T(8), taskGroupId: G(8) },
  { id: "60000000-0000-4000-8000-000000000008", key: "OBSRV-8-1", ownerId: O(8), projectId: P(8), archivedAt: null, title: "Burn rate playbook", body: "Link runbook in PagerDuty service.", createdAt: "2026-04-19T14:00:00.000Z", closedAt: "2026-04-21T09:00:00.000Z", status: "done", type: "Note", priority: "Medium", tags: ["sre"], taskId: T(9), taskGroupId: G(9) },
  { id: "60000000-0000-4000-8000-000000000009", key: "TASK-2-1", ownerId: null, projectId: null, archivedAt: null, title: "Nav design QA notes", body: "Check contrast in dark mode for active tab.", createdAt: "2026-05-13T10:00:00.000Z", closedAt: null, status: "todo", type: "Note", priority: "Low", tags: ["ux"], taskId: T(2), taskGroupId: null },
  { id: "60000000-0000-4000-8000-000000000010", key: "GROW-6-1", ownerId: O(6), projectId: null, archivedAt: null, title: "Experiment ethics checklist", body: "Signed by legal 2026-04-01.", createdAt: "2026-04-01T12:00:00.000Z", closedAt: null, status: "done", type: "Decision", priority: "Medium", tags: ["growth"], taskId: T(10), taskGroupId: G(10) },
];

const worklogs = [
  { id: "70000000-0000-4000-8000-000000000001", key: "LOG-1", startedAt: "2026-05-10T14:00:00.000Z", durationMinutes: 90, comment: "Locale schema + Romanian first pass.", target: { kind: "task", taskId: T(1) }, targetEntryKey: "TASK-1", targetEntryName: "Add English and Romanian dictionaries", createdAt: "2026-05-10T15:30:00.000Z", updatedAt: "2026-05-10T15:30:00.000Z" },
  { id: "70000000-0000-4000-8000-000000000002", key: "LOG-2", startedAt: "2026-05-11T16:00:00.000Z", durationMinutes: 45, comment: "README Windows flow.", target: { kind: "project", projectId: P(2) }, targetEntryKey: "DOCS-2", targetEntryName: "Documentation refresh", createdAt: "2026-05-11T16:45:00.000Z", updatedAt: "2026-05-11T16:45:00.000Z" },
  { id: "70000000-0000-4000-8000-000000000003", key: "LOG-3", startedAt: "2026-05-14T09:00:00.000Z", durationMinutes: 120, comment: "Sticky nav prototype + route match tests.", target: { kind: "task", taskId: T(2) }, targetEntryKey: "TASK-2", targetEntryName: "Make active menu state obvious", createdAt: "2026-05-14T11:00:00.000Z", updatedAt: "2026-05-14T11:00:00.000Z" },
  { id: "70000000-0000-4000-8000-000000000004", key: "LOG-4", startedAt: "2026-05-13T13:00:00.000Z", durationMinutes: 180, comment: "JWT shadow metrics dashboard.", target: { kind: "epic", groupId: G(4) }, targetEntryKey: "PUBSZ-4", targetEntryName: "Public surface controls", createdAt: "2026-05-13T16:00:00.000Z", updatedAt: "2026-05-13T16:00:00.000Z" },
  { id: "70000000-0000-4000-8000-000000000005", key: "LOG-5", startedAt: "2026-05-12T10:00:00.000Z", durationMinutes: 60, comment: "Note review: offline UX principles.", target: { kind: "note", entryId: "60000000-0000-4000-8000-000000000004" }, targetEntryKey: "MOBIL-4-1", targetEntryName: "Offline UX principles", createdAt: "2026-05-12T10:30:00.000Z", updatedAt: "2026-05-12T10:30:00.000Z" },
  { id: "70000000-0000-4000-8000-000000000006", key: "LOG-6", startedAt: "2026-05-01T08:00:00.000Z", durationMinutes: 240, comment: "Embedding backfill dry run + prod.", target: { kind: "task", taskId: T(6) }, targetEntryKey: "TASK-6", targetEntryName: "Backfill user embeddings job", createdAt: "2026-05-01T18:00:00.000Z", updatedAt: "2026-05-01T18:00:00.000Z" },
  { id: "70000000-0000-4000-8000-000000000007", key: "LOG-7", startedAt: "2026-05-14T07:00:00.000Z", durationMinutes: 90, comment: "Cohort SQL + sanity checks.", target: { kind: "task", taskId: T(12) }, targetEntryKey: "TASK-12", targetEntryName: "Ad-hoc churn cohort export", createdAt: "2026-05-14T08:00:00.000Z", updatedAt: "2026-05-14T08:00:00.000Z" },
  { id: "70000000-0000-4000-8000-000000000008", key: "LOG-8", startedAt: "2026-05-09T11:00:00.000Z", durationMinutes: 30, comment: "Planning only — platform team.", target: { kind: "owner", ownerId: O(3) }, targetEntryKey: "PLAT-3", targetEntryName: "Platform Team", createdAt: "2026-05-09T11:30:00.000Z", updatedAt: "2026-05-09T11:30:00.000Z" },
  { id: "70000000-0000-4000-8000-000000000009", key: "LOG-9", startedAt: "2026-05-08T15:00:00.000Z", durationMinutes: 45, comment: "Invoice PDF layout tweaks.", target: { kind: "project", projectId: P(6) }, targetEntryKey: "CPORT-6", targetEntryName: "Customer portal", createdAt: "2026-05-08T15:45:00.000Z", updatedAt: "2026-05-08T15:45:00.000Z" },
  { id: "70000000-0000-4000-8000-000000000010", key: "LOG-10", startedAt: "2026-04-20T09:00:00.000Z", durationMinutes: 360, comment: "SLO multi-window implementation.", target: { kind: "task", taskId: T(9) }, targetEntryKey: "TASK-9", targetEntryName: "SLO burn rate alerts", createdAt: "2026-04-20T15:00:00.000Z", updatedAt: "2026-04-20T15:00:00.000Z" },
  { id: "70000000-0000-4000-8000-000000000011", key: "LOG-11", startedAt: "2026-05-13T18:00:00.000Z", durationMinutes: 25, comment: "Quick triage on merge bug.", target: { kind: "task", taskId: T(5) }, targetEntryKey: "TASK-5", targetEntryName: "Offline cart merge conflicts", createdAt: "2026-05-13T18:25:00.000Z", updatedAt: "2026-05-13T18:25:00.000Z" },
  { id: "70000000-0000-4000-8000-000000000012", key: "LOG-12", startedAt: "2026-05-07T09:00:00.000Z", durationMinutes: 40, comment: "Handoff doc update.", target: { kind: "task", taskId: T(13) }, targetEntryKey: "TASK-13", targetEntryName: "Rotate on-call handoff template", createdAt: "2026-05-07T09:40:00.000Z", updatedAt: "2026-05-07T09:40:00.000Z" },
];

const auditLog = [
  { id: "80000000-0000-4000-8000-000000000001", at: "2026-05-14T10:00:00.000Z", action: "update", entity: "task", entityId: T(2), summary: "Updated task \"Make active menu state obvious\"", detail: '{"changes":{"status":{"from":"open","to":"in_progress"}}}' },
  { id: "80000000-0000-4000-8000-000000000002", at: "2026-05-11T13:00:00.000Z", action: "create", entity: "owner_entry", entityId: "60000000-0000-4000-8000-000000000002", summary: "Created note \"Windows README checklist\"", detail: '{"created":{"title":"Windows README checklist","status":"todo"}}' },
  { id: "80000000-0000-4000-8000-000000000003", at: "2026-05-10T16:00:00.000Z", action: "update", entity: "task", entityId: T(1), summary: "Closed task \"Add English and Romanian dictionaries\"", detail: '{"changes":{"status":{"to":"done"}}}' },
  { id: "80000000-0000-4000-8000-000000000004", at: "2026-05-08T08:00:00.000Z", action: "create", entity: "worklog", entityId: "70000000-0000-4000-8000-000000000012", summary: "Logged 40m on TASK-13" },
  { id: "80000000-0000-4000-8000-000000000005", at: "2026-05-01T18:00:00.000Z", action: "update", entity: "task", entityId: T(6), summary: "Marked embeddings backfill done", detail: '{"changes":{"status":{"to":"done"}}}' },
];

const store = {
  settings: { worklogMinutesPerDay: 480 },
  owners,
  projects,
  taskGroups,
  tasks,
  ownerEntries,
  worklogs,
  auditLog,
};

const out = path.resolve(process.cwd(), "data/store.mock.json");
fs.writeFileSync(out, JSON.stringify(store, null, 2) + "\n", "utf8");
console.log("Wrote", out);
