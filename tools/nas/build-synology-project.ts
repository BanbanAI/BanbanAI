import { cp, mkdir, rm, writeFile } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NAS_COMMON_OPTIONS, parseNasCliArgs, printNasHelp, readNasCliString, resolveNasArch } from "./cli";
import { createNasArtifactFileName, createSynologyPackageName, NAS_DISPLAY_NAME } from "./package-name";
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

const resolveSynologyVersion = (version: string, buildVersion?: string) => {
  const normalizedVersion = version.trim();
  if (/^\d+(?:[._-]\d+)*$/.test(normalizedVersion)) {
    return normalizedVersion;
  }

  const baseVersion = normalizedVersion.match(/^\d+(?:\.\d+)*/)?.[0] || "1.0.0";
  if (buildVersion && /^\d+$/.test(buildVersion)) {
    return `${baseVersion}-${buildVersion}`;
  }

  const fallbackBuild = normalizedVersion.match(/(\d+)(?!.*\d)/)?.[1];
  if (fallbackBuild) {
    return `${baseVersion}-${fallbackBuild}`;
  }

  return baseVersion;
};

const resolvePackageArch = (arch: string, platform?: string) => {
  if (platform) return platform;
  if (arch === "arm64") return "armv8";
  return "x86_64";
};

const createInfo = (
  packageName: string,
  displayName: string,
  version: string,
  arch: string,
  maintainer: string,
  dsmAppName: string,
) => {
  return [
    `package="${packageName}"`,
    `displayname="${displayName}"`,
    `version="${version}"`,
    `arch="${arch}"`,
    `description="${NAS_PACKAGE_DESCRIPTION}"`,
    `maintainer="${maintainer}"`,
    'os_min_ver="7.0-40000"',
    `startable="yes"`,
    `installable="yes"`,
    `silent_install="yes"`,
    `silent_uninstall="yes"`,
    'dsmuidir="ui"',
    `dsmappname="${dsmAppName}"`,
  ].join("\n");
};

const createDepends = (dsm: string) => {
  return [
    "[default]",
    `all="${dsm}"`,
    "",
  ].join("\n");
};

const createLinuxBuildScript = (packageName: string, packageVersion: string, artifactFileName: string, dsm: string) => {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    'TOOLKIT_DIR="${PKGSCRIPTS_NG_DIR:-}"',
    'PLATFORM=""',
    `DSM_VERSION="${dsm}"`,
    'if [ $# -ge 3 ]; then',
    '  TOOLKIT_DIR="$1"',
    '  PLATFORM="$2"',
    '  DSM_VERSION="$3"',
    'elif [ $# -ge 2 ]; then',
    '  PLATFORM="$1"',
    '  DSM_VERSION="$2"',
    'elif [ $# -ge 1 ]; then',
    '  PLATFORM="$1"',
    "fi",
    'if [ -z "${TOOLKIT_DIR}" ]; then',
    '  echo "missing pkgscripts-ng root dir, pass it as the first argument or set PKGSCRIPTS_NG_DIR" >&2',
    "  exit 1",
    "fi",
    'if [ -z "${PLATFORM}" ]; then',
    '  echo "missing synology platform" >&2',
    "  exit 1",
    "fi",
    `PACKAGE_NAME="${packageName}"`,
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'SOURCE_DIR="${SCRIPT_DIR}/source/${PACKAGE_NAME}"',
    'WORKSPACE_DIR="$(cd "${TOOLKIT_DIR}/.." && pwd)"',
    'TARGET_DIR="${WORKSPACE_DIR}/source/${PACKAGE_NAME}"',
    'INFO_FILE="${TARGET_DIR}/INFO"',
    `PACKAGE_VERSION="${packageVersion}"`,
    `ARTIFACT_FILE_NAME="${artifactFileName}"`,
    'RESULT_ROOT_DIR="${WORKSPACE_DIR}/result_spk"',
    'FINAL_ARTIFACT_FILE="${SCRIPT_DIR}/${ARTIFACT_FILE_NAME}"',
    "",
    'rm -rf "${TARGET_DIR}"',
    'mkdir -p "${WORKSPACE_DIR}/source"',
    'cp -R "${SOURCE_DIR}" "${TARGET_DIR}"',
    'python3 - "${INFO_FILE}" "${PLATFORM}" <<\'PY\'',
    "from pathlib import Path",
    "import sys",
    "info_path = Path(sys.argv[1])",
    "platform = sys.argv[2]",
    "lines = info_path.read_text(encoding='utf-8').splitlines()",
    "updated = []",
    "for line in lines:",
    "    if line.startswith('arch='):",
    "        val = line.split('=', 1)[1].strip('\"')",
    "        if val in ['x86_64', 'armv8', 'noarch']:",
    "            updated.append(line)",
    "        else:",
    "            updated.append(f'arch=\"{platform}\"')",
    "    else:",
    "        updated.append(line)",
    "info_path.write_text('\\n'.join(updated) + '\\n', encoding='utf-8')",
    "PY",
    "",
    'cd "${TOOLKIT_DIR}"',
    'if [ "$(id -u)" -eq 0 ]; then',
    '  ./PkgCreate.py -v "${DSM_VERSION}" -p "${PLATFORM}" -c "${PACKAGE_NAME}"',
    "else",
    '  sudo ./PkgCreate.py -v "${DSM_VERSION}" -p "${PLATFORM}" -c "${PACKAGE_NAME}"',
    "fi",
    "",
    'FOUND_ARTIFACT_FILE="$(python3 - "${RESULT_ROOT_DIR}" "${PACKAGE_NAME}" "${PACKAGE_VERSION}" "${PLATFORM}" <<\'PY\'',
    "from pathlib import Path",
    "import sys",
    "result_root = Path(sys.argv[1])",
    "package_name = sys.argv[2]",
    "package_version = sys.argv[3]",
    "platform = sys.argv[4]",
    "package_dir_name = f\"{package_name}-{package_version}\"",
    "package_dir = result_root / package_dir_name",
    "search_roots = [package_dir, result_root]",
    "candidates = []",
    "for root in search_roots:",
    "    if not root.exists():",
    "        continue",
    "    for path in root.rglob('*.spk'):",
    "        if package_name not in path.name:",
    "            continue",
    "        score = 0",
    "        if path.parent.name == package_dir_name:",
    "            score += 2",
    "        if platform in path.name:",
    "            score += 1",
    "        candidates.append((score, path.stat().st_mtime, path))",
    "if not candidates:",
    "    sys.exit(1)",
    "candidates.sort(key=lambda item: (item[0], item[1]))",
    "print(candidates[-1][2])",
    "PY",
    ')"',
    'if [ -z "${FOUND_ARTIFACT_FILE}" ]; then',
    '  echo "failed to locate generated spk under ${RESULT_ROOT_DIR}" >&2',
    "  exit 1",
    "fi",
    'rm -f "${FINAL_ARTIFACT_FILE}"',
    'cp "${FOUND_ARTIFACT_FILE}" "${FINAL_ARTIFACT_FILE}"',
    'echo "artifact copied to ${FINAL_ARTIFACT_FILE}"',
    "",
  ].join("\n");
};

const printHelp = () => {
  printNasHelp({
    usage: "ts-node tools/nas/build-synology-project [options]",
    options: [
      ...NAS_COMMON_OPTIONS,
      { name: "--dsm", description: "DSM 版本，默认 7.3" },
      { name: "--platform", description: "群晖目标平台，如 v1000nk rtd1619b" },
      { name: "--version", description: "覆盖 package.json 里的版本号" },
    ],
    notes: [
      "基于 dist/nas/payload/<flavor>/<lang>/<arch> 生成群晖 pkgscripts-ng 工程骨架",
      "Linux 上执行 build-on-linux.sh 后，生成的 .spk 会从 pkgscripts-ng/result_spk 复制回 build-on-linux.sh 的同级目录",
      "同时兼容 --arch x64 和 --arch=x64，两种写法；文档统一推荐前者",
    ],
    examples: [
      "yarn build:nas:synology --arch x64",
      "yarn build:nas:synology --arch arm64",
      "yarn build:nas:synology --flavor main --lang zh-CN --arch x64 --dsm 7.3 --platform v1000nk",
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
  const dsm = readNasCliString(options, "dsm") || "7.3";
  const platform = readNasCliString(options, "platform");
  const version = readNasCliString(options, "version");
  const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"));
  const packageName = createSynologyPackageName(flavor, arch);
  const packageVersion = resolveSynologyVersion(
    version || packageJson.version || "1.0.0",
    `${packageJson.buildVersion || ""}`,
  );
  const packageArch = resolvePackageArch(arch, platform);
  const maintainer = packageJson.author || "多算科技";
  const artifactFileName = createNasArtifactFileName(version || packageJson.version || "1.0.0", arch, "spk");
  const payloadDir = join(__dirname, "..", "..", "dist", "nas", "payload", flavor, lang, arch);
  const dsmAppName = createDsmAppName(flavor);
  const rootDir = join(__dirname, "..", "..", "dist", "nas", "synology", flavor, lang, arch);
  const projectDir = join(rootDir, "source", packageName);
  const templateDir = join(__dirname, "templates", "synology");
  const packageUiDir = join(projectDir, "payload", "ui");
  const packageUiImagesDir = join(packageUiDir, "images");

  if (!existsSync(payloadDir)) {
    throw new Error(`找不到 payload：${payloadDir}`);
  }

  await rm(rootDir, { recursive: true, force: true });
  await mkdir(projectDir, { recursive: true });

  await cp(join(templateDir, "SynoBuildConf"), join(projectDir, "SynoBuildConf"), { recursive: true });
  await cp(join(templateDir, "scripts"), join(projectDir, "scripts"), { recursive: true });
  await cp(join(templateDir, "conf"), join(projectDir, "conf"), { recursive: true });
  await cp(payloadDir, join(projectDir, "payload"), {
    recursive: true,
    filter: (entryPath) => shouldCopyNasPayloadEntry(payloadDir, entryPath),
  });
  await mkdir(packageUiImagesDir, { recursive: true });
  await cp(join(templateDir, "ui", "open.cgi"), join(packageUiDir, "open.cgi"));
  await writeFile(join(packageUiDir, "config"), createDsmAppConfig(packageName, dsmAppName, NAS_DISPLAY_NAME), "utf8");
  await writeFile(join(packageUiDir, "runtime-config.env"), createDsmUiRuntimeEnv(16666), "utf8");
  await cp(join(__dirname, "..", "..", "builder", "resource", "icon", "ic_launcher.png"), join(projectDir, "PACKAGE_ICON.PNG"));
  await cp(join(__dirname, "..", "..", "builder", "resource", "icon", "ic_launcher.png"), join(projectDir, "PACKAGE_ICON_256.PNG"));
  for (const iconSize of DSM_APP_ICON_SIZES) {
    await cp(
      join(__dirname, "..", "..", "builder", "resource", "icon", "ic_launcher.png"),
      join(packageUiImagesDir, `app_${iconSize}.png`),
    );
  }

  await writeFile(join(projectDir, "INFO"), createInfo(packageName, NAS_DISPLAY_NAME, packageVersion, packageArch, maintainer, dsmAppName), "utf8");
  await writeFile(join(projectDir, "SynoBuildConf", "depends"), createDepends(dsm), "utf8");
  await writeFile(join(rootDir, "build-on-linux.sh"), createLinuxBuildScript(packageName, packageVersion, artifactFileName, dsm), "utf8");
  await writeFile(join(rootDir, "pkgscripts-manifest.json"), JSON.stringify({
    flavor,
    lang,
    arch,
    dsm,
    platform: platform || "",
    packageName,
    packageVersion,
    packageArch,
    artifactFileName,
    projectDir,
    payloadDir,
  }, null, 2), "utf8");

  console.log(rootDir);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
