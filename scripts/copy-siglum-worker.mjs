import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/@siglum/engine/src/worker.js");
const destination = resolve(root, "public/worker.js");

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.info("Copied Siglum worker to public/worker.js");
