import { cp, mkdir, rm, writeFile } from "fs/promises";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { NAS_COMMON_OPTIONS, parseNasCliArgs, printNasHelp, readNasCliString, resolveNasArch } from "./cli";
import { shouldCopyNasPayloadEntry } from "./payload-copy-filter";

const hasNasRuntime = (sourceDir: string) => {
  const files = readdirSync(sourceDir);
  const hasExecutable = files.some(
    (name) => name === "banban" || name === "banban.exe" || /^banban-\d+\.\d+\.\d+$/.test(name)
  );
  if (hasExecutable) {
    return true;
  }
  return ["package.json", "server", "node_modules"].every((name) => existsSync(join(sourceDir, name)));
};

const resolveServerSourceDir = (projectRoot: string, flavor: string, lang: string) => {
  const configuredPath = join(projectRoot, "dist", "server", flavor, lang, "app");
  if (flavor === "main" && lang === "zh-CN") {
    return join(projectRoot, "dist", "server", "main", "zh-CN", "app");
  }
  return configuredPath;
};

const printHelp = () => {
  printNasHelp({
    usage: "ts-node tools/nas/build-payload [options]",
    options: [...NAS_COMMON_OPTIONS],
    notes: [
      "从当前 server 构建产物复制 NAS 通用 payload",
      "同时兼容 --arch x64 和 --arch=x64，两种写法；文档统一推荐前者",
    ],
    examples: [
      "yarn build:nas:payload --arch x64",
      "yarn build:nas:payload --arch arm64",
      "yarn build:nas:payload --flavor main --lang zh-CN --arch x64",
    ],
  });
};

const main = async () => {
  const options = parseNasCliArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const flavor = readNasCliString(options, "flavor") || "main";
  const lang = readNasCliString(options, "lang") || "zh-CN";
  const arch = resolveNasArch(readNasCliString(options, "arch"));
  const projectRoot = join(__dirname, "..", "..");
  const sourceDir = resolveServerSourceDir(projectRoot, flavor, lang);
  const payloadDir = join(__dirname, "..", "..", "dist", "nas", "payload", flavor, lang, arch);

  if (!existsSync(sourceDir)) {
    throw new Error(`Can't find server build artifact: ${sourceDir}`);
  }
  if (!hasNasRuntime(sourceDir)) {
    throw new Error(`NAS runtime not found in server build output: ${sourceDir}`);
  }

  const files = readdirSync(sourceDir);
  const hasExecutable = files.some(
    (name) => name === "banban" || name === "banban.exe" || /^banban-\d+\.\d+\.\d+$/.test(name)
  );

  await rm(payloadDir, { recursive: true, force: true });
  await mkdir(payloadDir, { recursive: true });
  await cp(sourceDir, payloadDir, {
    recursive: true,
    filter: (entryPath) => shouldCopyNasPayloadEntry(sourceDir, entryPath, hasExecutable),
  });

  if (!hasExecutable) {
    const serverEntry = join(payloadDir, "server", "server.js");
    if (!existsSync(serverEntry)) {
      throw new Error(`Can't find server entry: ${serverEntry}`);
    }
  }

  const packageJsonPath = join(payloadDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  packageJson.nas = {
    flavor,
    lang,
    arch,
  };
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf8");

  const manifestPath = join(payloadDir, "nas-manifest.json");
  await writeFile(manifestPath, JSON.stringify({ flavor, lang, arch, sourceDir }, null, 2), "utf8");

  console.log(payloadDir);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
