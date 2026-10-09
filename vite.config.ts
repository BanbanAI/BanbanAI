import "dotenv/config";
import { join } from "path";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { cp, readFile, rm } from "fs/promises";
import { Plugin, ServerOptions, defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Icons from "unplugin-icons/vite";
import { FileSystemIconLoader } from "unplugin-icons/loaders";
import IconsResolver from "unplugin-icons/resolver";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import vueJsx from "@vitejs/plugin-vue-jsx";
import legacy from "@vitejs/plugin-legacy";
import { VitePluginPkgBuilder } from "./builder/vite-plugin-builder";
import { VitePluginElectronBuilder } from "./builder/vite-plugin-builder/vite-plugin-electron-builder";
import { electronBuilderConfig } from "./builder/electron-builder.config";
import { resolveRendererManualChunk } from "./tools/build/rendererManualChunks";
import packageConfig from "./package.json";

let lang = "zh-CN";
let outputApp = join(__dirname, "dist/server/main/zh-CN/app");
let outputPublic = join(outputApp, "public");
const widgetTemplatesDir = join(__dirname, "src/main/modules/widgets/templates");

function VitePluginLangJsonHotReload(localeDir: string, refreshLangJson: () => void): Plugin {
  const normalizedLocaleDir = localeDir.replace(/\\/g, "/");

  return {
    name: "vite-plugin-lang-json-hot-reload",
    apply: "serve",
    configureServer(server) {
      server.watcher.add(localeDir);
    },
    handleHotUpdate({ file, server }) {
      const normalizedFile = file.replace(/\\/g, "/");
      if (!normalizedFile.startsWith(`${normalizedLocaleDir}/`) || !normalizedFile.endsWith("/lang.json")) {
        return;
      }
      refreshLangJson();
      server.ws.send({ type: "full-reload", path: "*" });
      return [];
    },
  };
}

function VitePluginWidgetI18n(): Plugin {
  const prefix = "\0builtin-widget-i18n:";
  return {
    name: "builtin-widget-i18n",
    enforce: "pre",
    resolveId(source, importer) {
      const isWidgetI18nImport = source === "@renderer/widgets/i18next"
        || source === "/widgets/i18next"
        || source.replace(/\\/g, "/").endsWith("/src/renderer/widgets/i18next");
      if (!isWidgetI18nImport || !importer) return;
      const normalizedImporter = importer.replace(/\\/g, "/");
      const match = normalizedImporter.match(/\/src\/renderer\/widgets\/([^/]+\/[^/]+)\//);
      if (!match) return `${prefix}global`;
      const packagePath = match[1];
      const manifestPath = join(__dirname, "src/renderer/widgets", packagePath, "manifest.json");
      if (!existsSync(manifestPath)) return `${prefix}global`;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      return `${prefix}${manifest.name || "global"}`;
    },
    load(id) {
      if (!id.startsWith(prefix)) return;
      const namespace = id.slice(prefix.length);
      return `import { createWidgetI18n } from "@renderer/widgets/i18n"; const i18next = createWidgetI18n(${JSON.stringify(namespace === "global" ? undefined : namespace)}); export const $t = i18next.t; export default i18next;`;
    },
  };
}

function getRealLangJson() {
  const realLangJson = {};
  const langs = readdirSync(join(__dirname, "src/locales"), { encoding: "utf-8" });
  for (const key of langs) {
    const langContent = JSON.parse(readFileSync(join(__dirname, `src/locales/${key}/lang.json`), { encoding: "utf-8" }));
    realLangJson[key] = { translation: langContent };
  }
  return realLangJson;
}

function writeRealLangJson(realLangJson) {
  mkdirSync(join(outputApp, "locales"), { recursive: true });
  writeFileSync(join(outputApp, "locales", "lang.json"), JSON.stringify(realLangJson));
}

async function prepareOutput() {
  if (existsSync(outputApp)) {
    await rm(outputApp, { recursive: true, force: true });
  }
  mkdirSync(outputApp, { recursive: true });
  mkdirSync(outputPublic, { recursive: true });
  await cp(join(__dirname, "builder/resource"), join(outputApp, "builder-resource"), { recursive: true });
  await cp(join(__dirname, "src/renderer/public"), outputPublic, { recursive: true });

  mkdirSync(join(outputApp, "locales"), { recursive: true });
  const preferences = readFileSync(join(__dirname, `src/locales/${lang}/preferences.json`), { encoding: "utf-8" });
  writeFileSync(join(outputApp, "locales", "preferences.json"), preferences);
  writeRealLangJson(getRealLangJson());

  const packageJson = JSON.parse(await readFile(join(__dirname, "package.json"), { encoding: "utf-8" }));
  delete packageJson.scripts;
  delete packageJson.devDependencies;
  packageJson.dependencies["@mikro-orm/mysql"] = "5.2.3";
  packageJson.lang = lang;
  writeFileSync(join(outputApp, "package.json"), JSON.stringify(packageJson));
  return packageJson;
}

// The community edition always builds and serves the Node server entry.
export default defineConfig(async ({ command, mode }) => {
  lang = "zh-CN";
  const isClient = mode !== "server";
  const entryDir = isClient ? "src/main/app.ts" : "src/main/server.ts";
  const main = isClient ? "app" : "server";
  const outputRoot = join(__dirname, `dist/${isClient ? "app" : "server"}/main/zh-CN`);
  outputApp = join(outputRoot, "app");
  outputPublic = join(outputApp, "public");
  process.env.NODE_ENV = command === "build" ? "production" : "development";
  const packageJson = await prepareOutput();
  const preferences = JSON.parse(readFileSync(join(outputApp, "locales/preferences.json"), { encoding: "utf-8" }));
  if (isClient) {
    packageJson.main = "main/app.js";
    writeFileSync(join(outputApp, "package.json"), JSON.stringify(packageJson));
  }

  const vitePluginBuilderOptions = {
    tsconfig: "src/main/tsconfig.json",
    entryFiles: [
      join(__dirname, entryDir),
      join(__dirname, "src/main/search.ts"),
      join(__dirname, "src/main/calculate.ts"),
      ...(isClient ? [join(__dirname, "src/main/electron/preload.ts")] : []),
      join(__dirname, "src/main/flow-worker.ts"),
    ],
    publicAssetsDir: join(__dirname, "src/main/assets"),
    assetsDir: widgetTemplatesDir,
    packageConfig: packageJson,
    appDir: outputApp,
    main,
    entryFile: isClient ? "app.js" : "server.js",
    inspectPort: isClient ? 5758 : 5757,
    devConfig: {
      inspectPort: isClient ? 5758 : 5757,
    },
    env: {},
    ...(isClient ? {
      electronConfig: {
        buildConfig: {
          appId: "work.banban",
          appIdSuffix: "",
          appDir: outputApp,
          copyright: `杭州多算科技有限公司© ${new Date().getFullYear()}`,
          productName: getRealLangJson()[lang].translation.productName,
          executableName: packageJson.executableName,
          lang,
          flavor: "main",
          is32bit: false,
          packageDir: join(outputRoot, "package"),
          version: packageJson.version,
          resourceDir: join(outputApp, "builder-resource"),
        },
        packageDir: join(outputRoot, "package"),
        preferences,
        getElectronBuilderConfig: electronBuilderConfig,
      },
    } : {}),
    define: {
      __APP_VERSION__: JSON.stringify(packageConfig.version),
      __IS_SERVER__: JSON.stringify(!isClient),
      __DEBUGGER__: JSON.stringify(""),
    },
  };

  return {
    root: join(__dirname, "src/renderer"),
    plugins: [
      VitePluginWidgetI18n(),
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag === "feDistantLight",
          },
        },
      }),
      legacy({
        ignoreBrowserslistConfig: true,
        additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
        renderLegacyChunks: false,
        modernPolyfills: ["es.array.flat-map", "es.array.at", "esnext.global-this"],
      }),
      vueJsx(),
      ...(isClient
        ? [VitePluginElectronBuilder(vitePluginBuilderOptions)]
        : [VitePluginPkgBuilder(vitePluginBuilderOptions)]),
      VitePluginLangJsonHotReload(
        join(__dirname, "src/locales"),
        () => writeRealLangJson(getRealLangJson()),
      ),
      AutoImport({
        resolvers: [
          IconsResolver({
            alias: { ven: "ven-icon", cubist: "cubist-icon" },
            customCollections: ["ven-icon", "cubist-icon", "workbench", "table", "nocode"],
          }),
        ],
      }),
      Components({
        dirs: ["./b2/", "./views/", "./components"],
        resolvers: [
          IconsResolver({
            alias: { ven: "ven-icon", cubist: "cubist-icon" },
            customCollections: ["ven-icon", "cubist-icon", "workbench", "table", "nocode"],
          }),
        ],
        dts: true,
      }),
      Icons({
        compiler: "vue3",
        autoInstall: true,
        customCollections: {
          "ven-icon": FileSystemIconLoader(join(__dirname, "src/renderer/assets/icons/ven-icon"), svg => svg.replace(/^<svg /, "<svg fill=\"currentColor\" ")),
          "cubist-icon": FileSystemIconLoader(join(__dirname, "src/renderer/assets/icons/cubist-icon"), svg => svg.replace(/^<svg /, "<svg fill=\"currentColor\" ")),
          workbench: FileSystemIconLoader(join(__dirname, "src/renderer/assets/icons/workbench"), svg => svg.replace(/^<svg /, "<svg fill=\"currentColor\" ")),
          table: FileSystemIconLoader(join(__dirname, "src/renderer/assets/icons/table"), svg => svg.replace(/^<svg /, "<svg fill=\"currentColor\" ")),
          nocode: FileSystemIconLoader(join(__dirname, "src/renderer/assets/icons/nocode"), svg => svg.replace(/^<svg /, "<svg fill=\"currentColor\" ")),
        },
      }),
    ],
    optimizeDeps: {
      include: [
        "lodash",
        "mitt",
        "@vueuse/core",
        "@vueuse/shared",
        "@vueuse/math",
        "@vue/reactivity",
        "docx-preview",
        "xlsx",
        "exceljs",
        "qrcode",
        "@codemirror/lang-javascript",
        "@codemirror/theme-one-dark",
        "pinyin-match",
        "@vue-office/docx",
        "@vue-office/excel",
        "dayjs/locale/zh-cn",
        "dayjs/locale/en",
        "vuedraggable",
        "mime",
        "hash-sum",
      ],
    },
    resolve: {
      alias: {
        "@common": join(__dirname, "src/common"),
        "@main": join(__dirname, "src/main"),
        "@renderer/router/dev-routes-entry": command === "build"
          ? join(__dirname, "src/renderer/router/dev-empty.ts")
          : join(__dirname, "src/renderer/router/dev.ts"),
        "@renderer": join(__dirname, "src/renderer"),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageConfig.version),
      __IS_SERVER__: JSON.stringify(!isClient),
      __DEBUGGER__: JSON.stringify(""),
    },
    assetsInclude: ["**/*.xlsx"],
    base: "./",
    publicDir: outputPublic,
    build: {
      rollupOptions: {
        input: { main: join(__dirname, "/src/renderer/index.html") },
        output: { manualChunks: resolveRendererManualChunk },
      },
      outDir: join(outputApp, "renderer"),
      emptyOutDir: true,
      reportCompressedSize: false,
    },
    css: {
      devSourcemap: true,
      preprocessorOptions: {
        scss: { silenceDeprecations: ["legacy-js-api"] },
      },
    },
    server: {
      host: "0.0.0.0",
      port: +(process.env.PORT || 30000),
      hmr: { port: +(process.env.PORT || 30000) },
    } satisfies ServerOptions,
  };
});
