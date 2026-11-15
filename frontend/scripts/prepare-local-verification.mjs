// Make a physical, secret-free verification copy when OneDrive placeholders
// are treated as symlinks by glob-based test discovery. Dependencies are reused.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, symlink } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const target = join(tmpdir(), `airbnb-verification-${Date.now()}`);
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
for (const file of files) {
  if (
    file
      .split("/")
      .some(
        (part) =>
          part === ".env" ||
          (part.startsWith(".env.") && part !== ".env.example"),
      )
  )
    continue;
  const path = join(target, file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, await readFile(join(root, file)));
}
for (const part of ["frontend", "backend"])
  await symlink(
    join(root, part, "node_modules"),
    join(target, part, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
const configPath = join(target, "frontend/playwright.config.js");
let config = await readFile(configPath, "utf8");
config = config
  .replaceAll("5173", "5181")
  .replace(
    "run dev -- --host 127.0.0.1",
    "run dev -- --host 127.0.0.1 --port 5181",
  );
await writeFile(configPath, config);
console.log(target);
