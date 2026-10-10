import { spawnSync } from "child_process";
import { copyFileSync, existsSync, rmSync } from "fs";
import { join, resolve } from "path";

const projectRoot = resolve(__dirname, "../..");
const packageDir = join(projectRoot, "node_modules", "better-sqlite3");
const releaseDir = join(packageDir, "build", "Release");
const nodeBinding = join(releaseDir, "better_sqlite3.node");
const electronBinding = join(releaseDir, "better_sqlite3.electron.node");

if (existsSync(electronBinding)) {
  process.exit(0);
}

if (!existsSync(nodeBinding)) {
  throw new Error(`better-sqlite3 Node binding not found: ${nodeBinding}`);
}

const backup = `${nodeBinding}.node-runtime`;
copyFileSync(nodeBinding, backup);
try {
  const electronRebuild = join(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron-rebuild.cmd" : "electron-rebuild",
  );
  const result = spawnSync(electronRebuild, ["--force", "--only", "better-sqlite3"], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      npm_config_dist_url: "https://www.electronjs.org/headers",
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`electron-rebuild exited with code ${result.status}`);
  copyFileSync(nodeBinding, electronBinding);
} finally {
  copyFileSync(backup, nodeBinding);
  rmSync(backup, { force: true });
}
