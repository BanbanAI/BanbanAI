import { ViteDevServer, ResolvedConfig } from "vite";
import { writeFile, mkdir, cp, rm, readFile, readdir, stat } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { basename, join, resolve } from "path";
import { build, Plugin as EsbuildPlugin } from "esbuild";
import { execSync, spawn } from "child_process";
import chalk from "chalk";
import { exec } from "@yao-pkg/pkg";
import { zip } from "../../src/main/utils/zip";
import cpy from 'cpy';
import { esbuildDecoratorMetadataPlugin } from './decorator-metadata-plugin'

async function isDirectory(path: string) {
  try { return (await stat(path)).isDirectory(); } catch { return false; }
}

function makeAllPackagesExternal(skips: string[]=[]): EsbuildPlugin {
  return {
    name: 'make-all-packages-external',
    setup(build) {
      let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/ // Must not start with "/" or "./" or "../"
      build.onResolve({ filter }, args => {
        let shouldSkip = !!skips.find(skip=>args.path.startsWith(skip));
        if (args.kind !== 'entry-point' && !shouldSkip) {
          return { path: args.path, external: true }
        }
      })
    },
  }
}
async function findAllESModules(): Promise<string[]> {
  const esModules: string[] = [];
  const queue = (await readdir("node_modules")).filter((dir)=>!dir.startsWith(".") && dir !== "@types");
  while (queue.length > 0) {
    const module = queue.pop();
    if (module.startsWith(".")) {
      continue;
    }
    if (!await isDirectory(join("node_modules", module))) {
      continue;
    }
    const packageJson = join("node_modules", module, "package.json");
    if (!existsSync(packageJson)) {
      const subModules = await readdir(join("node_modules", module));
      for (const subModule of subModules) {
        queue.push(`${module}/${subModule}`);
      }
    } else {
      const json = JSON.parse(await readFile(packageJson, {encoding: "utf-8"}));
      if (json && json["type"] === "module" && !json["exports"]?.["."]?.["require"]) {
        esModules.push(module);
      }
    }
  }
  return esModules;
}
async function createEsbuildOptions(options, dev=true) {
  let define = Object.entries(options.env).reduce((preVal, [key, value]) => ({
    ...preVal,
    [`process.env.${key}`]: JSON.stringify(value)
  }), {});
  define = Object.assign(define, options.define);
  const { entryFiles, appDir, main, tsconfig, external } = options;
  const esModules = await findAllESModules();
  const mainFile = join(appDir, main);
  console.log("createEsbuildOptions mainFile", mainFile)
  return {
    entryPoints: entryFiles,
    target: "es2020",
    outdir: mainFile,
    bundle: true,
    define,
    tsconfig,
    plugins: [
      makeAllPackagesExternal(["@common", "@main", "@renderer"].concat(esModules)),
      esbuildDecoratorMetadataPlugin({ tsconfig }),
    ],
    external,
  };
}

async function copyAssets(assetsDir: string, destDir: string) {
  await cpy('**/*', join(destDir, basename(assetsDir)), {
    cwd: assetsDir,
    parents: true,
  });
}

function runMainProcess(mainFile: string, inspectPort: number) {
  return spawn("node", [`--inspect=${inspectPort}`, mainFile], { stdio: "inherit" });
}

export function VitePluginPkgBuilder(options) {
  let viteConfig: ResolvedConfig;
  return {
    name: "vite-plugin-nestjs-builder",
    configResolved(config) {
      viteConfig = config;
    },
    configureServer: ({ httpServer }: ViteDevServer) => {
      httpServer.on("listening", async () => {
        const address: any = httpServer.address();
        options.env = options.env || {};
        options.env.DEV_SERVER_URL = `${viteConfig.server.https ? "https" : "http"}://${address.address}:${address.port}`;
        options.env.DEV_SERVER_PORT = address.port;
        handleDev(options)
        const { appDir, main, inspectPort = 5757 } = options;
        const esbuildOptions = await createEsbuildOptions(options);
        const mainFile = join(appDir, main, "server.js");
        let child;
        build({
          ...esbuildOptions,
          platform: "node",
          format: "cjs",
          keepNames: true,
          sourcemap: "inline",
        }).then(() => {
          console.log(chalk.yellowBright("⚡Server Process Running"));
          if (child) child.kill();
          child = runMainProcess(mainFile, inspectPort);
          child.on("exit", () => {
            process.exit();
          });
        });
      });
    },
    writeBundle: () => {
      if (viteConfig.command === "build") {
        return handleBuild(options);
      }
    },
  };
}

async function handleDev(options) {
  const { appDir, assetsDir, publicAssetsDir, main } = options;
  const mainFile = join(appDir, main);
  await copyAssets(publicAssetsDir,mainFile);
  if (assetsDir) {
    await copyAssets(assetsDir, mainFile);
  }
}

function findAllDependencies(packageJson, dependencies: string[] = []) {
  for (const name in packageJson?.dependencies ?? {}) {
    if (dependencies.includes(name)) continue;
    dependencies.push(name);
    const packageJsonPath = join("node_modules", name, "package.json");
    if (!existsSync(packageJsonPath)) continue;
    const mPackageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    findAllDependencies(mPackageJson, dependencies);
  }
  for (const name in packageJson?.peerDependencies ?? {}) {
    if (dependencies.includes(name)) continue;
    dependencies.push(name);
    const packageJsonPath = join("node_modules", name, "package.json");
    if (!existsSync(packageJsonPath)) continue;
    const mPackageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    findAllDependencies(mPackageJson, dependencies);
  }
  return dependencies;
}

const pkgNodeVersion = "20.11.1";

const installDependencies = async (dependencies: string[], appDir: string, packageConfig: any) => {
  const patches = await readdir("patches");
    if (patches && patches.length > 0) {
      packageConfig.scripts = {
        postinstall: "patch-package"
      }
    }
    for (const name of patches) {
      if (dependencies.includes(name.replace(/\+[^\+]*$/,"").replace(/\+/g, "/"))) {
        await cp(join("patches", name), join(appDir, "patches", name), {recursive: true});
      }
    }
    await cp("yarn.lock", join(appDir, "yarn.lock"));
    await writeFile(join(appDir, "package.json"), JSON.stringify(packageConfig, null, 2));
    execSync(`cd ${appDir} && yarn`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        npm_config_runtime: "node",
        npm_config_target: pkgNodeVersion,
        npm_config_better_sqlite3_binary_host: "https://registry.npmmirror.com/-/binary/better-sqlite3",
      },
    });
}


async function handleBuild(options) {
  const { appDir, main, packageConfig, publicAssetsDir, assetsDir } = options;
  
  const dependencies = await findAllDependencies(packageConfig);
  await installDependencies(dependencies, appDir, packageConfig);


  packageConfig.pkg = {
    assets: [
      "./main/assets",
      "./renderer",
      "./config.json",
      "./locales",
      "./server/assets",
      "./server/templates",
      ...dependencies.map((name)=>`node_modules/${name}/**/*`),
    ],
    scripts: [
      "server/*.js"
    ]
  };

  const esbuildOptions = await createEsbuildOptions(options, false);
  const mainFile = join(appDir, main);
  await copyAssets(publicAssetsDir, mainFile);
  if (assetsDir) {
    await copyAssets(assetsDir, mainFile);
  }

  packageConfig.bin = main;

  if (existsSync("./node_modules/leveldown/binding.js")) {
    let bindingJs = await readFile("./node_modules/leveldown/binding.js", {encoding: "utf-8"});
    bindingJs = bindingJs.replace("__dirname", `require('path').dirname(require('path').dirname(process.pkg.entrypoint))+'/node_modules/leveldown'`);
    await writeFile(join(appDir, "node_modules/leveldown/binding.js"), bindingJs);
  }

  const configJsonc = resolve("config.jsonc");
  process.chdir(appDir);
  packageConfig.bin = "server/server.js";
  await writeFile("./package.json", JSON.stringify(packageConfig, null, 2));

  const exeName = "banban";
  const zipName = "斑斑AI低代码无桌面版";
  const executableName = process.platform === "win32" ? `${exeName}.exe` : exeName;
  const versionedExecutableName = process.platform === "win32"
    ? `${exeName}-${packageConfig.version}.exe`
    : `${exeName}-${packageConfig.version}`;
  return build({
    ...esbuildOptions,
    platform: "node",
    format: "cjs",
  }).then(async () => {
    if (process.platform === "win32") {
      await exec(['package.json', "-t", "node20-win-x64", "--compress", "GZip", "-o", `./${versionedExecutableName}`]);
    } else if (process.platform === "darwin") {
      await exec(['package.json', "-t", "node20-macos-x64", "--compress", "GZip", "-o", `./${versionedExecutableName}`]);
    } else if (process.platform === "linux") {
      await exec(["package.json", "-t", `node20-linux-${process.arch}`, "--compress", "GZip", "-o", `./${versionedExecutableName}`]);
    }
    console.log(chalk.green("Main Process Build Succeeded."));
  }).catch(error => {
    console.log(`\n${chalk.red("Main Process Build Failed")}\n`, error, "\n");
  }).then(async () => {
    console.log("\nStart zip server.");
    const tmpDir = join(appDir, "temp_for_pack"+ Date.now());
    await mkdir(tmpDir, {recursive: true})
    await cp(join(appDir, versionedExecutableName), join(tmpDir, executableName));
    await cp(configJsonc, join(tmpDir, "config.jsonc"));

    const archSuffix = process.platform === 'linux' && process.arch.startsWith('arm') ? `-${process.arch}` : '';
    const fileName = `${zipName}${archSuffix}-${packageConfig.version}.zip`;

    const zipFile = join(appDir, fileName);
    await zip(zipFile, tmpDir);
    await rm(tmpDir, {recursive: true});
    console.log("\nFinish zip server.");
  });
}
