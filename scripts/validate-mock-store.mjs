import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const key = /^[A-Z]{2,16}-\d{1,32}(?:-\d{1,32})?$/;
const fixtures = process.argv.slice(2);
const files = fixtures.length ? fixtures : ["data/store.mock.json"];

function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

function expectArray(file, store, name) {
  if (!Array.isArray(store[name])) fail(file, `${name} must be an array`);
}

function validateEntity(file, entity, label) {
  if (!entity || typeof entity !== "object") fail(file, `${label} must be an object`);
  if (!uuid.test(String(entity.id ?? ""))) fail(file, `${label}.id must be a UUID`);
  if (!key.test(String(entity.key ?? ""))) fail(file, `${label}.key must be a public key`);
  if (typeof entity.name !== "string" || !entity.name.trim()) fail(file, `${label}.name is required`);
}

function validateStore(file, store) {
  if (!store || typeof store !== "object" || Array.isArray(store)) {
    fail(file, "root must be an object");
  }
  for (const name of ["owners", "projects", "taskGroups", "tasks", "ownerEntries", "worklogs", "auditLog"]) {
    expectArray(file, store, name);
  }

  const owners = new Set(store.owners.map((owner, index) => {
    validateEntity(file, owner, `owners[${index}]`);
    return owner.id;
  }));
  const projects = new Set(store.projects.map((project, index) => {
    validateEntity(file, project, `projects[${index}]`);
    return project.id;
  }));
  const groups = new Set(store.taskGroups.map((group, index) => {
    validateEntity(file, group, `taskGroups[${index}]`);
    if (!owners.has(group.ownerId)) fail(file, `taskGroups[${index}].ownerId does not exist`);
    if (group.projectId !== null && !projects.has(group.projectId)) {
      fail(file, `taskGroups[${index}].projectId does not exist`);
    }
    return group.id;
  }));
  const tasks = new Set(store.tasks.map((task, index) => {
    validateEntity(file, task, `tasks[${index}]`);
    if (!owners.has(task.ownerId)) fail(file, `tasks[${index}].ownerId does not exist`);
    if (task.groupId !== null && !groups.has(task.groupId)) fail(file, `tasks[${index}].groupId does not exist`);
    return task.id;
  }));

  for (const [index, note] of store.ownerEntries.entries()) {
    if (!uuid.test(String(note.id ?? ""))) fail(file, `ownerEntries[${index}].id must be a UUID`);
    if (!key.test(String(note.key ?? ""))) fail(file, `ownerEntries[${index}].key must be a public key`);
    if (typeof note.title !== "string" || !note.title.trim()) fail(file, `ownerEntries[${index}].title is required`);
    const linked =
      (note.ownerId && owners.has(note.ownerId)) ||
      (note.projectId && projects.has(note.projectId)) ||
      (note.taskId && tasks.has(note.taskId)) ||
      (note.taskGroupId && groups.has(note.taskGroupId));
    if (!linked) fail(file, `ownerEntries[${index}] must link to an existing owner, project, task, or epic`);
  }

  for (const [index, worklog] of store.worklogs.entries()) {
    if (!uuid.test(String(worklog.id ?? ""))) fail(file, `worklogs[${index}].id must be a UUID`);
    if (!key.test(String(worklog.key ?? ""))) fail(file, `worklogs[${index}].key must be a public key`);
    if (!Number.isInteger(worklog.durationMinutes) || worklog.durationMinutes <= 0) {
      fail(file, `worklogs[${index}].durationMinutes must be positive`);
    }
  }

  for (const [index, entry] of store.auditLog.entries()) {
    if (!uuid.test(String(entry.id ?? ""))) fail(file, `auditLog[${index}].id must be a UUID`);
    if (!["create", "update", "delete"].includes(entry.action)) fail(file, `auditLog[${index}].action is invalid`);
    if (entry.detail !== undefined && String(entry.detail).length > 4000) {
      fail(file, `auditLog[${index}].detail exceeds 4000 characters`);
    }
  }
}

for (const file of files) {
  const absolute = path.resolve(process.cwd(), file);
  const store = JSON.parse(fs.readFileSync(absolute, "utf8"));
  validateStore(file, store);
  console.log(`Validated ${file}`);
}
