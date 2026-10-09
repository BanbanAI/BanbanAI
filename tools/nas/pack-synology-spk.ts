import { cp, mkdir, rm, writeFile } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { execFileSync } from "child_process";
import { NAS_COMMON_OPTIONS, normalizeNasArchName, parseNasCliArgs, printNasHelp, readNasCliString } from "./cli";
import { createNasArtifactFileName, createSynologyPackageName, NAS_DISPLAY_NAME } from "./package-name";
import { createSynologySpk } from "./synology-spk";
import { shouldCopyNasPayloadEntry } from "./payload-copy-filter";

const NAS_PACKAGE_DESCRIPTION = "斑斑低代码是一款面向中小企业的低代码数字化应用搭建平台，致力于提供“真免费、零门槛”的数字化转型解决方案，帮助企业零成本构建安全、高效、可拓展的业务系统，轻松开启数字化转型。";
const DSM_APP_ICON_SIZES = [16, 24, 32, 48, 64, 72, 256];

const createDsmAppName = (flavor: string) => `com.duosuan.banban.${flavor.replace(/[^A-Za-z0-9_]/g, "_")}`;

const createDsmAppConfig = (packageName: string, appName: string, displayName: string) => {
  return JSON.stringify({
    ".url": {
      [appName]: {
        type: "url",
        icon: "images/app_{0}.png",
        title: displayName,
        desc: "打开斑斑低代码",
        url: `/webman/3rdparty/${packageName}/open.cgi`,
        allUsers: true,
      },
    },
  }, null, 2);
};

const createDsmUiRuntimeEnv = (port: number, protocol = "http", baseUrl = "") => {
  return [
    `BANBAN_OPEN_PORT='${port}'`,
    `BANBAN_OPEN_PROTOCOL='${protocol}'`,
    `BANBAN_OPEN_BASE_URL='${baseUrl.replace(/'/g, `'\\''`)}'`,
    "",
  ].join("\n");
};

const resolveArch = (arch?: string) => {
  if (arch === "x64") return "x86_64";
  if (arch === "arm64") return "aarch64";
  return process.arch === "arm64" ? "aarch64" : "x86_64";
};

const createInfo = (packageName: string, arch: string, dsmAppName: string) => {
  return [
    `package="${packageName}"`,
    `version="1.0.0"`,
    `arch="${arch}"`,
    `description="${NAS_PACKAGE_DESCRIPTION}"`,
    `maintainer="多算科技"`,
    `startable="yes"`,
    `installable="yes"`,
    `silent_install="yes"`,
    `silent_uninstall="yes"`,
    'dsmuidir="ui"',
    `dsmappname="${dsmAppName}"`,
  ].join("\n");
};

const printHelp = () => {
  printNasHelp({
    usage: "ts-node tools/nas/pack-synology-spk [options]",
    options: [...NAS_COMMON_OPTIONS],
    notes: [
      "直接基于 payload 封装 .spk，主要用于开发验证，不替代 Linux 上 pkgscripts-ng 的正式出包",
      "同时兼容 --arch x64 和 --arch=x64，两种写法；文档统一推荐前者",
    ],
    examples: [
      "ts-node tools/nas/pack-synology-spk --flavor main --lang zh-CN --arch x64",
      "ts-node tools/nas/pack-synology-spk --help",
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
  const inputArch = readNasCliString(options, "arch");
  const sourceArch = normalizeNasArchName(inputArch) || (process.arch === "arm64" ? "arm64" : "x64");
  const arch = resolveArch(sourceArch);
  const rootDir = join(__dirname, "..", "..", "dist", "nas", "synology", flavor, lang, arch);
  const payloadDir = join(__dirname, "..", "..", "dist", "nas", "payload", flavor, lang, sourceArch);
  const packageName = createSynologyPackageName(flavor, sourceArch);
  const dsmAppName = createDsmAppName(flavor);
  const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"));
  const outputFile = join(dirname(rootDir), createNasArtifactFileName(packageJson.version || "1.0.0", sourceArch, "spk"));
  const templateDir = join(__dirname, "templates", "synology");
  const packageTgz = join(rootDir, "package.tgz");
  const packageIcon = join(rootDir, "PACKAGE_ICON.PNG");
  const packageIcon256 = join(rootDir, "PACKAGE_ICON_256.PNG");
  const scriptsDir = join(rootDir, "scripts");
  const confDir = join(rootDir, "conf");

  if (!existsSync(payloadDir)) {
    throw new Error(`找不到 payload：${payloadDir}`);
  }

  await rm(rootDir, { recursive: true, force: true });
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(confDir, { recursive: true });
  await cp(join(templateDir, "scripts"), scriptsDir, { recursive: true });
  await cp(join(templateDir, "conf"), confDir, { recursive: true });
  await cp(join(__dirname, "..", "..", "builder", "resource", "icon", "ic_launcher.png"), packageIcon);
  await cp(join(__dirname, "..", "..", "builder", "resource", "icon", "ic_launcher.png"), packageIcon256);

  const info = createInfo(packageName, arch, dsmAppName).replace(/(^package=".*"$)/m, `$1\ndisplayname="${NAS_DISPLAY_NAME}"`);
  await writeFile(join(rootDir, "INFO"), info, "utf8");

  const tempPackageDir = join(rootDir, "package");
  const packageUiDir = join(tempPackageDir, "ui");
  const packageUiImagesDir = join(packageUiDir, "images");
  await mkdir(tempPackageDir, { recursive: true });
  await cp(payloadDir, tempPackageDir, {
    recursive: true,
    filter: (entryPath) => shouldCopyNasPayloadEntry(payloadDir, entryPath),
  });
  await mkdir(packageUiImagesDir, { recursive: true });
  await cp(join(templateDir, "ui", "open.cgi"), join(packageUiDir, "open.cgi"));
  await writeFile(join(packageUiDir, "config"), createDsmAppConfig(packageName, dsmAppName, NAS_DISPLAY_NAME), "utf8");
  await writeFile(join(packageUiDir, "runtime-config.env"), createDsmUiRuntimeEnv(16666), "utf8");
  for (const iconSize of DSM_APP_ICON_SIZES) {
    await cp(
      join(__dirname, "..", "..", "builder", "resource", "icon", "ic_launcher.png"),
      join(packageUiImagesDir, `app_${iconSize}.png`),
    );
  }
  execFileSync("tar", ["-czf", packageTgz, "-C", tempPackageDir, "."], { stdio: "inherit" });
  await rm(tempPackageDir, { recursive: true, force: true });
  await createSynologySpk({ sourceDir: rootDir, outputFile });

  console.log(outputFile);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
