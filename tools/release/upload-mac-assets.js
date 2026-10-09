#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 把本地打好的 macOS 安装包改成 release 表格里约定的文件名，再传进已存在的 release。
 *
 * macOS 不在 CI 里构建（要签名 + 公证，必须用本机 keychain），所以这一步在 Mac 上手动跑：
 *   yarn build
 *   yarn release:upload:mac --tag v2.1.0
 *
 * 仓库 remote 是 GitHub 时 gh 能自己推断目标仓库；remote 是别的（比如 GitLab）时加 --repo owner/repo。
 * 和 compose-release-body 一样只用 node 内置模块，不依赖第三方包。
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { PLATFORMS, releaseBaseName } = require("./compose-release-body");

const ROOT = path.resolve(__dirname, "../..");
const EXTENSIONS = ["dmg", "zip"];

function parseArgs(argv) {
  const options = {
    tag: "",
    repo: "",
    arch: process.platform === "darwin" ? process.arch : "",
    dir: "dist/app/main/zh-CN/package",
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    switch (key) {
      case "--tag": options.tag = value; i += 1; break;
      case "--repo": options.repo = value; i += 1; break;
      case "--arch": options.arch = value; i += 1; break;
      case "--dir": options.dir = value; i += 1; break;
      case "--dry-run": options.dryRun = true; break;
      default: throw new Error(`未知参数：${key}`);
    }
  }
  if (!options.tag) throw new Error("缺少 --tag（例如 --tag v2.1.0）");
  if (!options.arch) throw new Error("不在 macOS 上运行，请用 --arch arm64 或 --arch x64 指定架构");
  return options;
}

// 只认顶层产物，跳过 mac-arm64/ 这种 unpacked 目录里的东西
function findArtifact(dir, ext) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!/unpacked|mac-/.test(entry.name)) stack.push(full);
      } else if (entry.name.endsWith(`.${ext}`)) {
        return full;
      }
    }
  }
  return null;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const mac = PLATFORMS.find((platform) => platform.id === "mac");
  if (!mac) throw new Error("compose-release-body.js 里没有 mac 平台定义");

  const product = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).name;
  const base = releaseBaseName({ product, tag: options.tag });

  const sourceDir = path.resolve(ROOT, options.dir);
  if (!fs.existsSync(sourceDir)) throw new Error(`产物目录不存在：${options.dir}，先跑 yarn build`);

  const stageDir = path.join(sourceDir, "upload-mac");
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  const files = [];
  for (const ext of EXTENSIONS) {
    const found = findArtifact(sourceDir, ext);
    if (!found) throw new Error(`在 ${options.dir} 里没找到 .${ext}`);
    const target = path.join(stageDir, mac.fileName(base, options.arch, ext));
    fs.copyFileSync(found, target);
    console.log(`${path.basename(found)}  ->  ${path.basename(target)}`);
    files.push(target);
  }

  if (options.dryRun) {
    console.log("\n--dry-run，没有上传。确认上面的文件名和 release 表格里的链接一致。");
    return;
  }

  try {
    const args = ["release", "upload", options.tag, ...files, "--clobber"];
    if (options.repo) args.push("--repo", options.repo);
    execFileSync("gh", args, { stdio: "inherit" });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("没找到 gh 命令，先装 GitHub CLI：winget install GitHub.cli 或 brew install gh");
    }
    throw error;
  }

  console.log(`\n已传到 ${options.repo || "当前 remote 指向的仓库"} 的 ${options.tag}，回 GitHub 页面确认后点 Publish`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
