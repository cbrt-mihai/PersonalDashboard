import fs from "node:fs";
import path from "node:path";
import { emptyStore, storeSchema, type Store } from "./schemas";
import { migrateLegacyStoreJson } from "./storeMigrateLegacy";

const STORE_PATH = path.join(process.cwd(), "data", "store.json");

export function readStore(): Store {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return storeSchema.parse(migrateLegacyStoreJson(JSON.parse(raw)));
  } catch (e) {
    console.error("[readStore] failed to load/validate store.json; falling back to empty store.", e);
    return emptyStore();
  }
}

export function writeStore(store: Store): void {
  const validated = storeSchema.parse(store);
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(validated, null, 2)}\n`, "utf-8");
  fs.renameSync(tmp, STORE_PATH);
}

export function mutateStore(mutator: (draft: Store) => void): Store {
  const store = readStore();
  mutator(store);
  writeStore(store);
  return store;
}
