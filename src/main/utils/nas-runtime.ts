import { existsSync, readFileSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export type NasPackageMeta = Partial<{
  flavor: string;
  lang: string;
  arch: string;
}>;

export type NasUiRuntimeEnvOptions = {
  protocol?: "http" | "https";
  baseUrl?: string;
  host?: string;
};

export const readNasPackageMeta = (packageRoot = process.cwd()): NasPackageMeta | null => {
  try {
    const packageJsonPath = join(packageRoot, "package.json");
    if (!existsSync(packageJsonPath)) {
      return null;
    }
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (!packageJson?.nas || typeof packageJson.nas !== "object") {
      return null;
    }
    const { flavor, lang, arch } = packageJson.nas as NasPackageMeta;
    return {
      flavor,
      lang,
      arch,
    };
  } catch {
    return null;
  }
};

export const isNasRuntime = (packageRoot = process.cwd()) => {
  return !!readNasPackageMeta(packageRoot);
};

const escapeSingleQuotes = (value: string) => value.replace(/'/g, `'\\''`);

export const buildNasUiRuntimeEnv = (port: number, options: NasUiRuntimeEnvOptions = {}) => {
  const protocol = options.protocol === "https" ? "https" : "http";
  const baseUrl = options.baseUrl || "";
  const host = options.host || "";
  return [
    `BANBAN_OPEN_PORT='${port}'`,
    `BANBAN_OPEN_PROTOCOL='${protocol}'`,
    `BANBAN_OPEN_BASE_URL='${escapeSingleQuotes(baseUrl)}'`,
    `BANBAN_OPEN_HOST='${escapeSingleQuotes(host)}'`,
    "",
  ].join("\n");
};

export const syncNasUiRuntimeEnv = async (packageRoot: string, port: number, options: NasUiRuntimeEnvOptions = {}) => {
  const uiDir = join(packageRoot, "ui");
  if (!existsSync(uiDir)) {
    return false;
  }
  await mkdir(uiDir, { recursive: true });
  await writeFile(join(uiDir, "runtime-config.env"), buildNasUiRuntimeEnv(port, options), "utf8");
  return true;
};
