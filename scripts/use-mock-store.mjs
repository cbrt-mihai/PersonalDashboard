import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const fixtures = {
  default: "store.mock.json",
  screenshots: "store.screenshots.json",
};

const requested = process.argv[2] ?? "default";
const fixtureName = fixtures[requested] ?? requested;
const root = process.cwd();
const source = path.resolve(root, "data", fixtureName);
const target = path.resolve(root, "data", "store.json");

if (!fs.existsSync(source)) {
  console.error(`Mock fixture not found: ${path.relative(root, source)}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);

console.log(`Copied ${path.relative(root, source)} to ${path.relative(root, target)}`);
