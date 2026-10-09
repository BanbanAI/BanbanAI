import { execFileSync } from "child_process";
import { cp, mkdir, rename, rm, writeFile, chmod } from "fs/promises";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createNasArtifactFileName, createFnosPackageName, NAS_DISPLAY_NAME } from "./package-name";
import { NAS_COMMON_OPTIONS, parseNasCliArgs, printNasHelp, readNasCliString, resolveNasArch } from "./cli";
import { createFnosUiConfig, createFnosUiRuntimeEnv } from "./fnos-ui";

const NAS_PACKAGE_DESCRIPTION = "斑斑低代码是一款面向中小企业的低代码数字化应用搭建平台，致力于提供“真免费、零门槛”的数字化转型解决方案，帮助企业零成本构建安全、高效、可拓展的业务系统，轻松开启数字化转型。";
const REQUIRED_TEMPLATE_FILES = [
  ["cmd", "install_init"],
  ["cmd", "install_callback"],
  ["cmd", "uninstall_init"],
  ["cmd", "uninstall_callback"],
  ["cmd", "upgrade_init"],
  ["cmd", "upgrade_callback"],
  ["ui", "index.cgi"],
] as const;

const resolvePlatform = (arch: string) => {
  return arch === "arm64" ? "arm64" : "x86_64";
};

const resolveFnpackBinary = () => {
  const customBinary = process.env.FNPACK_BIN?.trim();
  return customBinary || "fnpack";
};

const resolveBuiltFpkFile = (rootDir: string) => {
  const fpkFiles = readdirSync(rootDir, { encoding: "utf8" }).filter((fileName) => fileName.toLowerCase().endsWith(".fpk"));
  if (fpkFiles.length !== 1) {
    throw new Error(`fnpack 构建完成后未找到唯一 fpk 产物：${rootDir}`);
  }
  return join(rootDir, fpkFiles[0]);
};

const verifyRequiredTemplateFiles = (templateDir: string) => {
  for (const segments of REQUIRED_TEMPLATE_FILES) {
    const filePath = join(templateDir, ...segments);
    if (!existsSync(filePath)) {
      throw new Error(`缺少 fnOS 模板文件：${filePath}`);
    }
  }
};

const printHelp = () => {
  printNasHelp({
    usage: "ts-node tools/nas/pack-fnos-fpk [options]",
    options: [...NAS_COMMON_OPTIONS],
    notes: [
      "基于 dist/nas/payload/<flavor>/<lang>/<arch> 组装 fnpack 工程并产出 .fpk",
      "如果 fnpack 不在 PATH，可通过环境变量 FNPACK_BIN 指向具体可执行文件",
      "同时兼容 --arch x64 和 --arch=x64，两种写法；文档统一推荐前者",
    ],
    examples: [
      "yarn build:nas:fnos --arch x64",
      "yarn build:nas:fnos --arch arm64",
      "yarn build:nas:fnos --flavor main --lang zh-CN --arch x64",
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
  const rootDir = join(__dirname, "..", "..", "dist", "nas", "fnos", flavor, lang, arch);
  const payloadDir = join(__dirname, "..", "..", "dist", "nas", "payload", flavor, lang, arch);
  const templateDir = join(__dirname, "templates", "fnos");
  const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"));
  const packageName = createFnosPackageName(flavor);

  const packageVersion = packageJson.version || "1.0.0";
  const fnpackBinary = resolveFnpackBinary();

  if (!existsSync(payloadDir)) {
    throw new Error(`找不到 payload：${payloadDir}`);
  }
  verifyRequiredTemplateFiles(templateDir);
  const outputFile = join(rootDir, createNasArtifactFileName(packageVersion, arch, "fpk"));

  await rm(rootDir, { recursive: true, force: true });
  await mkdir(rootDir, { recursive: true });
  await cp(join(templateDir, "cmd"), join(rootDir, "cmd"), { recursive: true });
  await cp(join(templateDir, "config"), join(rootDir, "config"), { recursive: true });
  await cp(join(templateDir, "wizard"), join(rootDir, "wizard"), { recursive: true });
  await cp(join(__dirname, "..", "..", "builder", "resource", "icon", "ic_launcher.png"), join(rootDir, "ICON.PNG"));
  await cp(join(__dirname, "..", "..", "builder", "resource", "icon", "ic_launcher.png"), join(rootDir, "ICON_256.PNG"));

  // 显式为 cmd 目录下的生命周期脚本赋予可执行权限，避免因跨平台拷贝/Git 属性问题导致权限丢失
  const cmdFiles = readdirSync(join(rootDir, "cmd"));
  for (const file of cmdFiles) {
    await chmod(join(rootDir, "cmd", file), 0o755);
  }

  const manifestContent = readFileSync(join(templateDir, "manifest"), "utf8")
    .replace("appname=ds-banban-nas", `appname=${packageName}`)
    .replace("version=1.0.0", `version=${packageVersion}`)
    .replace("desc=斑斑低代码 NAS 包", `desc=${NAS_PACKAGE_DESCRIPTION}`)
    .replace("display_name=斑斑低代码", `display_name=${NAS_DISPLAY_NAME}`)
    .replace("arch=x86_64", `arch=${resolvePlatform(arch)}`);
  
  const fullManifest = manifestContent + `\ndesktop_uidir=ui\ndesktop_applaunchname=${packageName}.Application\n`;
  await writeFile(join(rootDir, "manifest"), fullManifest, "utf8");


  await cp(payloadDir, join(rootDir, "app"), { recursive: true });

  // 创建 ui 目录与桌面配置
  const appUiDir = join(rootDir, "app", "ui");
  const appUiImagesDir = join(appUiDir, "images");
  await mkdir(appUiImagesDir, { recursive: true });
  await cp(join(templateDir, "ui", "index.cgi"), join(appUiDir, "index.cgi"));
  await chmod(join(appUiDir, "index.cgi"), 0o755);
  await writeFile(join(appUiDir, "config"), createFnosUiConfig(packageName, NAS_DISPLAY_NAME), "utf8");
  await writeFile(join(appUiDir, "runtime-config.env"), createFnosUiRuntimeEnv(16666), "utf8");

  // 复制图标为 icon_64.png 和 icon_256.png
  const srcIcon = join(__dirname, "..", "..", "builder", "resource", "icon", "ic_launcher.png");
  await cp(srcIcon, join(appUiImagesDir, "icon_64.png"));
  await cp(srcIcon, join(appUiImagesDir, "icon_256.png"));


  try {
    execFileSync(fnpackBinary, ["build"], { cwd: rootDir, stdio: "inherit" });
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error(`找不到 fnpack，请先安装官方 fnpack，或通过 FNPACK_BIN 指向可执行文件：${fnpackBinary}`);
    }
    throw err;
  }

  const builtOutputFile = resolveBuiltFpkFile(rootDir);
  if (builtOutputFile !== outputFile) {
    await rm(outputFile, { force: true });
    await rename(builtOutputFile, outputFile);
  }

  console.log(outputFile);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
