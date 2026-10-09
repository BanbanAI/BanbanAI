import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import { spawn, ChildProcess, exec, spawnSync } from 'child_process'
import chalk from 'chalk'
import { build, BuildOptions, Plugin as EsbuildPlugin } from "esbuild"
import { join, dirname, basename, resolve } from 'path'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { readdir, readFile, rm, stat } from 'fs/promises'
import electron from 'electron'
import { builtinModules } from "module";
import { build as electronBuilder, Configuration as ElectronBuilderConfiguration } from 'electron-builder'
import cpy from 'cpy'
import { esbuildDecoratorMetadataPlugin } from './decorator-metadata-plugin'

async function isDirectory(path: string) {
  try { return (await stat(path)).isDirectory(); } catch { return false; }
}

interface BuilderConfig {
  lang: string,
  appDir: string,
  appId: string,
  appIdSuffix: string,
  copyright?: string,
  resourceDir?: string,
  productName?: string,
  executableName?: string,
  fileAssociations?: any[],
  license?: string,
  is32bit: boolean,
  packageDir: string,
  releaseInfo?: {
    add: string[],
    fix: string[],
    opt: string[],
  }
}
interface ViteElectronBuilderOptions {
  tsconfig?: string;
  entryFiles?: string[];
  assetsDir?: string;
  publicAssetsDir?: string;
  packageConfig?: any;
  appDir: string;
  main?: string;
  external?: string[];
  define?: { [key: string]: string };
  devConfig: {
    inspectPort?: number;
  },
  electronConfig: {
    buildConfig?: BuilderConfig,
    packageDir?: string,
    preferences?: any,
    getElectronBuilderConfig?: (config: BuilderConfig) => ElectronBuilderConfiguration,
    electronBuilderConfig?: ElectronBuilderConfiguration;
  }
}
interface ResolvedViteElectronBuilderOptions extends Required<ViteElectronBuilderOptions> {
  env: Record<string, any>;
  command: 'build' | 'serve';
  publicAssetsDir: string;
}

export function VitePluginElectronBuilder(userOptions: Partial<ViteElectronBuilderOptions> = {}): Plugin {
  let viteConfig: ResolvedConfig;
  let options: ResolvedViteElectronBuilderOptions;

  return {
    name: 'vite-plugin-electron-builder',
    configResolved(config) {
      viteConfig = config;
      options = resolveOptions(userOptions, viteConfig);
    },
    configureServer: ({ httpServer }: ViteDevServer) => {
      httpServer.on('listening', () => {
        const address: any = httpServer.address();
        options.env.DEV_SERVER_URL = `${viteConfig.server.https ? "https" : "http"}://${address.address}:${address.port}`;
        options.env.DEV_SERVER_PORT = address.port;
        handleDev(options)
      })
    },
    writeBundle: () => options.command === "build" ? handleBuild(options) : undefined,
  }
}

function resolveOptions(options: Partial<ViteElectronBuilderOptions>, viteConfig: ResolvedConfig) {
  const external = Array.from(new Set([
    ...builtinModules.filter(x => !/^_|^(internal|v8|node-inspect)\/|\//.test(x)),
    'electron',
    ...(Array.isArray(options.external) ? options.external : [])
  ]))

  const {
    tsconfig,
    entryFiles,
    assetsDir,
    publicAssetsDir,
    packageConfig,
    appDir,
    main,
    define,
    devConfig,
    electronConfig,
  } = options;

  const { env, command } = viteConfig;

  const resolvedViteElectronBuilderOptions: ResolvedViteElectronBuilderOptions = {
    tsconfig,
    entryFiles,
    publicAssetsDir,
    assetsDir,
    packageConfig,
    appDir,
    main,
    define,
    env,
    command,
    external,
    devConfig,
    electronConfig,
  }

  return resolvedViteElectronBuilderOptions
}

function makeAllPackagesExternal(skips: string[]=[]): EsbuildPlugin {
  return {
    name: 'make-all-packages-external',
    setup(build) {
      let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/
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
async function createEsbuildOptions(options: ResolvedViteElectronBuilderOptions): Promise<BuildOptions> {
  let define = Object.entries(options.env).reduce((preVal, [key, value]) => ({
    ...preVal,
    [`process.env.${key}`]: JSON.stringify(value)
  }), {})
  define["process.env.NODE_ENV"] = JSON.stringify(process.env.NODE_ENV || (options.command === "build" ? "production" : "development"));
  define = Object.assign(define, options.define);

  const { entryFiles, appDir, main, tsconfig, external } = options;
  const esModules = await findAllESModules();
  const mainFile = join(appDir, main);
  return {
    entryPoints: entryFiles,
    target: 'es2020',
    outdir: join(appDir, "main"),
    format: 'cjs',
    bundle: true,
    platform: 'node',
    define,
    tsconfig,
    plugins: [
      makeAllPackagesExternal(["@common", "@main", "@renderer"].concat(esModules)),
      esbuildDecoratorMetadataPlugin({ tsconfig }),
    ],
    external,
  };
};

async function handleDev(options: ResolvedViteElectronBuilderOptions) {
  const { appDir, assetsDir, main, devConfig, publicAssetsDir } = options;
  const { inspectPort=5858 } = devConfig;
  const esbuildOptions = await createEsbuildOptions(options);
  const mainFile = join(appDir, "main");
  await clean(mainFile);
  await copyAssets(publicAssetsDir, mainFile);
  if (assetsDir) {
    await copyAssets(assetsDir, mainFile);
  }

  let child: ChildProcess;
  build({
    ...esbuildOptions,
    keepNames: true,
    sourcemap: true,
  }).then(async () => {
    console.log(chalk.yellowBright('⚡Main Process Running'));
    if (child) child.kill();
    child = await runMainProcess(join(mainFile, `${main}.js`), inspectPort);
    child.on('exit', ()=>{
      process.exit();
    });
  });
}

async function handleBuild(options: ResolvedViteElectronBuilderOptions) {
  const { appDir, assetsDir, main, packageConfig, electronConfig, publicAssetsDir } = options;
  const { buildConfig, packageDir, preferences, getElectronBuilderConfig } = electronConfig;
  const esbuildOptions = await createEsbuildOptions(options);
  const mainFile = join(appDir, "main");

  await clean(mainFile);
  await copyAssets(publicAssetsDir, mainFile);
  if (assetsDir) {
    await copyAssets(assetsDir, mainFile);
  }
  packageConfig.main = `main/${main}.js`;
  if (!existsSync(appDir)) {
    mkdirSync(appDir, {recursive:true});
  }
  writeFileSync(join(appDir, 'package.json'), JSON.stringify(packageConfig, null, 2));

  buildConfig.packageDir = join(packageDir, buildConfig.is32bit ? `package-32` : `package`);
  if (existsSync(buildConfig.packageDir)) {
    await rm(buildConfig.packageDir, {recursive: true});
  }
  writeFileSync(join(appDir, "locales", "preferences.json"), JSON.stringify(preferences));
  const electronBuilderConfig = getElectronBuilderConfig(buildConfig);
  await _build(esbuildOptions, electronBuilderConfig);
}

async function runMainProcess(mainFile: string, inspectPort: number) {
  await initACLs();
  if (process.platform === "win32") {
    await spawnSync("chcp.com", ["65001"], {
      stdio: "inherit",
    });
  }
  const options = [];
  const rendererInspectPort = inspectPort + 10000;
  const electronArgs = [`--inspect=${inspectPort}`, ...options, mainFile];
  if (process.env.DISABLE_ELECTRON_REMOTE_DEBUGGING !== '1') {
    console.log(chalk.cyanBright(`Renderer Process CDP: http://127.0.0.1:${rendererInspectPort}`));
    electronArgs.splice(1, 0, `--remote-debugging-port=${rendererInspectPort}`);
  }
  return spawn(electron as any, electronArgs, { stdio: 'inherit' });
};

function initACLs() {
  const ACL_STRINGS = [
    'S-1-15-3-1024-2302894289-466761758-1166120688-1039016420-2430351297-4240214049-4028510897-3317428798:(OI)(CI)(RX)',
    'S-1-15-3-1024-3424233489-972189580-2057154623-747635277-1604371224-316187997-3786583170-1043257646:(OI)(CI)(RX)',
  ];
  return new Promise<void>(resolve => {
    if (process.platform == 'win32') {
      exec('icacls ./node_modules/electron/dist/', null, (err, output) => {
        let existing_acls = output.toString();
        let missing_acls = ACL_STRINGS.filter(acl => existing_acls.indexOf(acl) == -1);
        if (missing_acls.length > 0) {
          console.log("ACLs not found, set them now");
          let cmd = 'icacls ./node_modules/electron/dist/';
          missing_acls.forEach(acl => cmd += ` /grant *${acl}`);
          exec(cmd, null, ()=>{
            resolve();
          });
        } else {
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

async function clean(destDir: string) {
  if (existsSync(destDir)) {
    await rm(destDir, {recursive: true});
  }
}

async function copyAssets(assetsDir: string, destDir: string) {
  await cpy('**/*', join(destDir, basename(assetsDir)), {
    cwd: assetsDir,
    parents: true,
  });
}

async function _build(esbuildOptions: BuildOptions, electronBuilderConfig: ElectronBuilderConfiguration) {
  try {
    await build({
      ...esbuildOptions,
      minify: true,
      keepNames: true,
    });
    await electronBuilder({
      config: electronBuilderConfig,
      publish: "never",
    });
    console.log(chalk.green('Main Process Build Succeeded.'));
  } catch (error) {
    console.log(`\n${chalk.red('Main Process Build Failed')}\n`, error, '\n');
    throw error;
  }
}
