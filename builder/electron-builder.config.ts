/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
import { Configuration } from "electron-builder";
import { join } from "path";

export type OEMConfig = {
  appId: string,
  productName: string,
  resourceDir: string,
  fileAssociations?: any[]
}

export type BuilderConfig = {
  lang: string,
  appDir: string,
  appId: string,
  appIdSuffix: string,
  copyright?: string,
  oemId?: string,
  resourceDir?: string,
  productName?: string,
  executableName?: string,
  fileAssociations?: any[],
  license?: string,
  flavor: 'main' | 'viewer',
  is32bit: boolean,
  packageDir: string,
  releaseInfo?: {
    add: string[],
    fix: string[],
    opt: string[],
  },
  version: string,
}

const getArmArchSuffix = () => {
  return process.platform === 'linux' && process.arch.startsWith('arm') ? `-${process.arch}` : '';
}

const getFileAssociationIcon = (resourceDir: string) => {
  const extension = process.platform === "win32" ? "ico" : process.platform === "darwin" ? "icns" : "png";
  return join(resourceDir, "ext", `bb.${extension}`);
};

export const electronBuilderConfig = (config: BuilderConfig): Configuration => {
  const resourceDir = config.resourceDir ? config.resourceDir: "builder/resource/";
  const appId = (config.appId || "work.banban") + (config.appIdSuffix || "");
  const dmgIcon = join(resourceDir, "dmg/dmg-icon.icns");
  const dmgBackground = join(resourceDir, "dmg/zh-CN/dmg-bg.png");
  const armArchSuffix = getArmArchSuffix();
  return {
    appId,
    productName: config.productName,
    copyright: config.copyright,
    directories: {
      output: config.packageDir,
      app: config.appDir,
      buildResources: join(resourceDir, "license", config.lang),
    },
    npmRebuild: false,
    buildDependenciesFromSource: true,
    electronDist: join(process.cwd(), "node_modules/electron/dist"),
    disableSanityCheckAsar: true,
    files: [
      "**/*",
    ],
    fileAssociations: config.fileAssociations || [
      {
        ext: "bb",
        description: "斑斑低代码应用文件",
        icon: getFileAssociationIcon(resourceDir),
        role: "Viewer",
      },
    ],
    win: {
      executableName: config.executableName,
      target: [
        {
          target: "nsis",
          arch: config.is32bit ? ['ia32'] : ['x64']
        }
      ],
      icon: join(resourceDir, "icon/ic_launcher.ico"),
      verifyUpdateCodeSignature: false,
    },
    nsis: {
      artifactName: config.is32bit ? "${productName}-${version}(32位).${ext}" : "${productName}-${version}.${ext}",
      oneClick: false,
      perMachine: false,
      allowElevation: true,
      packElevateHelper: true,
      allowToChangeInstallationDirectory: true,
      menuCategory: config.productName,
      createStartMenuShortcut: true,
      license: config.license || join(resourceDir, "license", config.lang, `license_${config.lang.replace(/\-/g, "_")}.txt`),
      installerIcon: join(resourceDir, "nsis/icon_install.ico"),
      uninstallerIcon: join(resourceDir, "nsis/icon_uninstall.ico"),
      installerSidebar: join(resourceDir, "nsis/side_install.bmp"),
      uninstallerSidebar: join(resourceDir, "nsis/side_uninstall.bmp"),
      include: join(resourceDir, "nsis/installer.nsh"),
      installerLanguages: [
        config.lang
      ],
      warningsAsErrors: false,
      createDesktopShortcut: true,
    },
    linux: {
      executableName: config.executableName,
      target: [
        "appImage", "deb", "rpm"
      ],
      maintainer: "多算科技",
      artifactName: armArchSuffix ? `${"${productName}"}${armArchSuffix}-${"${version}"}.${"${ext}"}` : "${productName}-${version}.${ext}",
      icon: join(resourceDir, "icon/ic_launcher.icns"),
      category: "Utility",
      synopsis: "私有化部署的低代码平台",
      description: "斑斑低代码是一款面向中小企业的低代码数字化应用搭建平台，致力于提供“真免费、零门槛”的数字化转型解决方案，帮助企业零成本构建安全、高效、可拓展的业务系统，轻松开启数字化转型。"
    },
    mac: {
      // executableName: config.executableName,
      artifactName: "${productName}-${version}.${ext}",
      target: [
        "dmg",
        "zip"
      ],
      icon: join(resourceDir, "icon/ic_launcher.icns"),
      category: "public.app-category.developer-tools",
      bundleVersion: "",
      electronLanguages: [
        "zh_CN"
      ],
      extraResources: {
        "from": join(resourceDir, "mac/resources")
      },
      hardenedRuntime: true,
      gatekeeperAssess: false,
      entitlements: join(resourceDir, "mac/entitlements.mac.plist"),
      entitlementsInherit: join(resourceDir, "mac/entitlements.mac.plist")
    },
    dmg: {
      icon: dmgIcon,
      background: dmgBackground,
      contents: [
        {
          x: 180,
          y: 210,
          type: "file"
        },
        {
          x: 420,
          y: 210,
          type: "link",
          name: "应用程序",
          path: "/Applications"
        }
      ],
      window: {
        x: 200,
        y: 300,
        width: 600,
        height: 420
      },
      sign: false
    },
    beforePack: async (context) => {
      console.log("beforePack");
    },
    afterSign: async (context) => {
      console.log("afterSign");
      //公证notarizing
      if (context.electronPlatformName === "darwin") {
        const { notarize } = await import("@electron/notarize");
        const options = {
          tool: "notarytool",
          appPath: join(context.appOutDir, context.packager.appInfo.productName+".app"),
          keychainProfile: "NOTARY_BANBAN",
        };
        console.log("notarize", options);
        return await notarize(options as any);
      }
    },
    afterAllArtifactBuild: async () => {
      console.log("afterAllArtifactBuild");
      return null;
    },
  };
};
