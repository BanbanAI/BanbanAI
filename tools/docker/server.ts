import fs from "fs";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import path, { join, resolve } from "path";
import { spawn, spawnSync } from "child_process";
import zlib from "zlib";

type Command = "prepare" | "build" | "push";
type SupportedArch = "x86" | "arm64";

type CliOptions = {
  [key: string]: string | undefined,
  appDir?: string,
  arch?: string,
  binary?: string,
  config?: string,
  outputDir?: string,
  image?: string,
  tag?: string,
  platform?: string,
  saveTo?: string,
};

type ContextInfo = {
  appDir: string,
  arch: SupportedArch,
  binaryName: string,
  configPath: string,
  contextDir: string,
  imageRef: string,
  latestImageRef: string,
  offlineImagePath: string,
  repository: string,
  tag: string,
  version: string,
};

type PreparedContext = ContextInfo & {
  binaryPath: string,
};

const projectRoot = resolve(__dirname, "..", "..");
const templateDir = join(__dirname, "templates");

function parseArgs(argv: string[]) {
  const command = (argv[0] || "prepare") as Command;
  const options: CliOptions = {};

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }

    options[key] = next;
    i++;
  }

  return { command, options };
}

function getPackageVersion() {
  const packageJsonPath = join(projectRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  return String(packageJson.version);
}

function normalizeArchName(arch?: string): SupportedArch | "" {
  if (!arch) return "";

  const normalized = arch.toLowerCase().replaceAll("-", "_");
  if (["x86", "x64", "amd64"].includes(normalized)) return "x86";
  if (["arm64", "arm_64", "aarch64"].includes(normalized)) return "arm64";

  throw new Error(`不支持的架构：${arch}，当前仅支持 x86 和 arm64`);
}

function getCurrentMachineArch(): SupportedArch {
  const normalized = process.arch.toLowerCase().replaceAll("-", "_");
  if (["x64", "amd64"].includes(normalized)) return "x86";
  if (["arm64", "aarch64"].includes(normalized)) return "arm64";

  throw new Error(`当前运行机架构暂不支持：${process.arch}，请显式传 --arch x86 或 --arch arm64`);
}

function resolveTargetArch(arch?: string): SupportedArch {
  return normalizeArchName(arch) || getCurrentMachineArch();
}

function getArchTagSuffix(arch: SupportedArch) {
  return arch === "x86" ? "x86" : "arm64";
}

function resolveImageInfo(version: string, options: CliOptions) {
  const arch = resolveTargetArch(options.arch);
  let repository = options.image || process.env.BANBAN_DOCKER_IMAGE || "banban-server";
  let tag = options.tag || process.env.BANBAN_DOCKER_TAG || version;

  const atIndex = repository.indexOf("@");
  if (atIndex > -1) {
    throw new Error("镜像地址暂不支持 digest，请使用 repository[:tag] 格式");
  }

  const lastColon = repository.lastIndexOf(":");
  const lastSlash = repository.lastIndexOf("/");
  if (lastColon > lastSlash) {
    tag = repository.slice(lastColon + 1) || tag;
    repository = repository.slice(0, lastColon);
  }

  const archSuffix = getArchTagSuffix(arch);
  if (archSuffix && !tag.endsWith(`-${archSuffix}`)) {
    tag = `${tag}-${archSuffix}`;
  }

  return {
    arch,
    archSuffix,
    repository,
    tag,
    imageRef: `${repository}:${tag}`,
    latestImageRef: `${repository}:latest-${archSuffix}`,
  };
}

function getDefaultAppDir() {
  return join(projectRoot, "dist", "server", "main", "zh-CN", "app");
}

function getDefaultConfigPath() {
  return join(projectRoot, "config.jsonc");
}

function getDefaultOutputDir(tag: string, arch: SupportedArch) {
  return join(projectRoot, "dist", "docker", "server");
}

function getDockerBinaryName(version: string) {
  return "banban";
}

function getDefaultSavePath(contextDir: string, version: string, arch: SupportedArch) {
  return join(contextDir, `banban-${version}-${arch}.tar.gz`);
}

function resolveContextInfo(options: CliOptions): ContextInfo {
  const version = getPackageVersion();
  const imageInfo = resolveImageInfo(version, options);
  const appDir = resolve(projectRoot, options.appDir || getDefaultAppDir());
  const configPath = resolve(projectRoot, options.config || getDefaultConfigPath());
  const contextDir = resolve(
    projectRoot,
    options.outputDir || process.env.BANBAN_DOCKER_OUTPUT || getDefaultOutputDir(imageInfo.tag, imageInfo.arch),
  );
  const offlineImagePath = resolve(projectRoot, options.saveTo || getDefaultSavePath(contextDir, version, imageInfo.arch));

  return {
    appDir,
    arch: imageInfo.arch,
    binaryName: getDockerBinaryName(version),
    configPath,
    contextDir,
    imageRef: imageInfo.imageRef,
    latestImageRef: imageInfo.latestImageRef,
    offlineImagePath,
    repository: imageInfo.repository,
    tag: imageInfo.tag,
    version,
  };
}

async function findServerBinary(appDir: string, version: string, arch: SupportedArch, binary?: string) {
  if (binary) {
    const customBinary = resolve(projectRoot, binary);
    if (!fs.existsSync(customBinary)) {
      throw new Error(`未找到指定的 server 可执行文件：${customBinary}`);
    }
    return customBinary;
  }

  const candidateNames: string[] = [];
  if (arch === "x86") {
    candidateNames.push(`banban-x86-${version}`, "banban-x86");
  }
  if (arch === "arm64") {
    candidateNames.push(`banban-arm64-${version}`, "banban-arm64");
  }
  candidateNames.push(`banban-${version}`, "banban");

  for (const candidateName of candidateNames) {
    const candidatePath = join(appDir, candidateName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  const entries = await readdir(appDir);
  const candidates: Array<{ filePath: string, mtimeMs: number }> = [];
  for (const entry of entries) {
    if (!entry.startsWith("banban")) continue;
    const filePath = join(appDir, entry);
    const info = await stat(filePath);
    if (!info.isFile()) continue;
    candidates.push({ filePath, mtimeMs: info.mtimeMs });
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (candidates.length > 0) {
    return candidates[0].filePath;
  }

  throw new Error(`未在 ${appDir} 中找到 server 可执行文件，请先执行 yarn build:server`);
}

async function renderTemplate(fileName: string, replacements: Record<string, string>) {
  let content = await readFile(join(templateDir, fileName), "utf-8");
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(key, value);
  }
  return content;
}

async function prepareContext(options: CliOptions): Promise<PreparedContext> {
  const context = resolveContextInfo(options);

  if (!fs.existsSync(context.appDir)) {
    throw new Error(`未找到 server 发布目录：${context.appDir}，请先执行 yarn build:server`);
  }
  if (!fs.existsSync(context.configPath)) {
    throw new Error(`未找到配置文件：${context.configPath}`);
  }

  const binaryPath = await findServerBinary(context.appDir, context.version, context.arch, options.binary);

  await rm(context.contextDir, { recursive: true, force: true });
  await mkdir(context.contextDir, { recursive: true });
  await cp(binaryPath, join(context.contextDir, context.binaryName));
  await cp(context.configPath, join(context.contextDir, "config.jsonc"));

  const replacements = {
    "__BINARY_NAME__": context.binaryName,
    "__IMAGE_REF__": context.imageRef,
    "__OFFLINE_IMAGE_FILE__": path.basename(context.offlineImagePath),
    "__VERSION__": context.version,
  };

  for (const fileName of ["Dockerfile", ".dockerignore", "docker-compose.yml", "README.md"]) {
    const content = await renderTemplate(fileName, replacements);
    await writeFile(join(context.contextDir, fileName), content, "utf-8");
  }

  console.log(`Docker 上下文已生成：${context.contextDir}`);
  console.log(`使用的 server 可执行文件：${binaryPath}`);
  if (context.arch) {
    console.log(`目标架构：${context.arch}`);
  }
  console.log(`目标镜像：${context.imageRef}`);

  return {
    ...context,
    binaryPath,
  };
}

function runDockerCommand(args: string[]) {
  console.log(`执行命令：docker ${args.join(" ")}`);
  const result = spawnSync("docker", args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(`docker ${args[0]} 执行失败`);
  }
}

function buildImage(context: ContextInfo, options: CliOptions) {
  const args = ["build", "-t", context.imageRef];
  const platform = options.platform || process.env.BANBAN_DOCKER_PLATFORM;
  if (platform) {
    args.push("--platform", platform);
  }
  args.push(context.contextDir);
  runDockerCommand(args);
}

async function saveImage(context: ContextInfo) {
  await mkdir(path.dirname(context.offlineImagePath), { recursive: true });

  console.log(`导出离线镜像：${context.offlineImagePath}`);

  await new Promise<void>((resolvePromise, reject) => {
    const docker = spawn("docker", ["save", context.imageRef], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "inherit"],
      shell: process.platform === "win32",
    });

    const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });
    const writer = fs.createWriteStream(context.offlineImagePath);

    docker.on("error", reject);
    writer.on("error", reject);
    gzip.on("error", reject);

    docker.stdout.pipe(gzip).pipe(writer);

    writer.on("close", () => {
      if (docker.exitCode && docker.exitCode !== 0) {
        reject(new Error("docker save 执行失败"));
        return;
      }
      resolvePromise();
    });

    docker.on("close", (code) => {
      if (code && code !== 0) {
        reject(new Error("docker save 执行失败"));
      }
    });
  });
}

function pushImage(context: ContextInfo) {
  runDockerCommand(["push", context.imageRef]);

  if (context.imageRef === context.latestImageRef) {
    return;
  }

  runDockerCommand(["tag", context.imageRef, context.latestImageRef]);
  runDockerCommand(["push", context.latestImageRef]);
}

function printHelp() {
  console.log(`用法：
  ts-node tools/docker/server <prepare|build|push> [options]

常用参数：
  --image      Docker Hub 仓库名，例如 your-org/banban-server
  --tag        镜像 tag，默认取 package.json 的 version
  --arch       架构，当前支持 x86、arm64
  --appDir     server 发布目录，默认 dist/server/main/zh-CN/app
  --binary     指定 server 可执行文件路径
  --config     指定 config.jsonc 路径
  --outputDir  Docker 上下文输出目录，默认 dist/docker/server
  --platform   docker build 平台，例如 linux/amd64
  --saveTo     离线镜像输出路径，默认 <outputDir>/banban-<version>-<arch>.tar.gz

  说明：
  build 会在构建镜像后自动导出离线镜像包

示例：
  yarn prepare:docker:server -- --image your-org/banban-server --arch x86
  yarn build:docker:server -- --image your-org/banban-server --tag 0.37.0 --arch arm64
  yarn publish:docker:server -- --image your-org/banban-server --tag 0.37.0 --arch x86
`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!["prepare", "build", "push"].includes(command)) {
    printHelp();
    return;
  }

  if (command === "prepare") {
    await prepareContext(options);
    return;
  }
  if (command === "build") {
    const context = await prepareContext(options);
    buildImage(context, options);
    await saveImage(context);
    return;
  }
  if (command === "push") {
    const context = resolveContextInfo(options);
    pushImage(context);
    return;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
