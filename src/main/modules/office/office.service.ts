import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { dirname, extname, join } from 'path';
import { getRuntime } from '@main/runtime';
import { execFile, spawn } from 'child_process';
import { existsSync } from 'fs';
import os from "os";
import { unique } from '@common/utils/unique';
import { cp, rename, rm, readFile, chmod, readdir } from 'fs/promises';
import { detectLinuxPackageType, LinuxPackageType } from '@main/utils/linuxType';
import { unzipFile } from '@main/utils';
import { isFreePort, findFreePorts } from 'find-free-ports';
import net from 'net';
import {
  OfficeRuntimeError,
  OfficeStartupSingleFlight,
  runOfficeConversionWithRecovery,
} from './office-conversion-recovery';

type Manifest = {
  version: string;
  platform: "darwin" | "win" | "linux";
  packageFormat: "rpm" | "deb";
  architecture: "x64";
}

type OfficeStartupResult = false | {
  success: boolean;
  type?: "dll" | "timeout";
}

type OfficeCommandResult = {
  stdout: string;
  stderr: string;
}

@Injectable()
export class OfficeService implements OnApplicationBootstrap {
  private officeDir: string;
  private sofficePath: string;
  private pythonPath: string;
  private unoconvPath: string;
  private host = '127.0.0.1';
  private port = 2002;
  private readonly logger = new Logger("OfficeService");
  private officeProcess: ReturnType<typeof spawn> | null = null;
  private linuxPkgType: LinuxPackageType | null = null;
  private installing = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly startupSingleFlight = new OfficeStartupSingleFlight<OfficeStartupResult>();
  constructor(
  ) {
  }

  onApplicationBootstrap() {
    return this.ensureInitialized().then(() => {
      if (this.usesListener) {
        void this.startup().catch(error => this.logOfficeFailure('warmup', error));
      }
    });
  }

  private get isMac() {
    return process.platform === 'darwin';
  }

  private get isWin() {
    return process.platform === 'win32';
  }

  private get isWin7() {
    return this.isWin && os.release().startsWith("6.1");
  }

  private get isLinux() {
    return process.platform === 'linux';
  }

  private get usesListener() {
    return !this.isMac && !this.isWin7;
  }

  private ensureInitialized() {
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeWorkPath();
    }
    return this.initializationPromise;
  }

  private async initializeWorkPath() {
    if (this.isLinux) await this.initLinuxPkgType();
    await this.initWorkPath();
  }


  private async initLinuxPkgType() {
    this.linuxPkgType = await detectLinuxPackageType();
  }

  private getLibrePath(officeDir = this.officeDir) {
    if (this.isWin) {
      return join(officeDir, "program/soffice.exe");
    } else if (this.isMac) {
      return join(officeDir, "LibreOffice.app/Contents/MacOS/soffice");
    } else if (this.isLinux) {
      return join(officeDir, "program/soffice");
    }
    throw new Error(`Operating system not yet supported: ${process.platform}`);
  }

  private getPythonPath(officeDir = this.officeDir) {
    if (this.isWin) return join(officeDir, "program/python.exe");
    if (this.isLinux) return join(officeDir, "program/python");
    return "";
  }

  private getUnoconvPath(officeDir = this.officeDir) {
    return join(officeDir, "unoconv/unoconv");
  }

  private async initWorkPath() {
    const userDataPath = await getRuntime().getUserDataPath();
    this.officeDir = join(userDataPath, "Tools/office");
    this.sofficePath = this.getLibrePath();
    this.pythonPath = this.getPythonPath();
    this.unoconvPath = this.getUnoconvPath();
  }

  get sofficeSupport() {
    return !!this.sofficePath && existsSync(this.sofficePath);
  }

  private get officePluginSupport() {
    if (!this.sofficeSupport) return false;
    if (!this.usesListener) return true;
    return !!this.pythonPath
      && !!this.unoconvPath
      && existsSync(this.pythonPath)
      && existsSync(this.unoconvPath);
  }

  private probeSocket() {
    return new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      const finish = (connected: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(connected);
      };

      socket.setTimeout(1000);
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
      socket.once('timeout', () => finish(false));
      socket.connect(this.port, this.host);
    });
  }

  private async waitForSocket(timeout = 60 * 1000, processRef?: ReturnType<typeof spawn>) {
    const deadline = Date.now() + timeout;
    do {
      if (processRef && this.officeProcess !== processRef) return false;
      if (await this.probeSocket()) return true;
      const remaining = deadline - Date.now();
      if (remaining <= 0) return false;
      await new Promise(resolve => setTimeout(resolve, Math.min(1000, remaining)));
    } while (Date.now() <= deadline);
    return false;
  }

  private async isListenerRunning() {
    const processRef = this.officeProcess;
    return !!processRef && await this.waitForSocket(3 * 1000, processRef);
  }

  
  private async ensureExecInDir(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = join(dir, e.name);
      if (e.isDirectory()) {
        await this.ensureExecInDir(fullPath);
      }
      if (e.isFile()) {
        await chmod(fullPath, 0o755);
      }
    }
  }

  private async ensureExecutable() {
    if (!this.sofficeSupport) return;
    if (!this.isWin) {
      try {
        await this.ensureExecInDir(this.officeDir);
      } catch (err) {
        console.warn('[chmod failed]', err);
      }
    } 
    // else if (this.isMac) {
    //   try {
    //     await chmod(this.sofficePath, 0o755);
    //   } catch (err) {
    //     console.warn('[chmod failed]', err);
    //   }
    // }
  }

  private stopOfficeProcess() {
    const processRef = this.officeProcess;
    if (!processRef) return;
    this.officeProcess = null;
    if (!processRef.killed) {
      processRef.kill();
    }
  }

  private async startOfficeProcess(): Promise<OfficeStartupResult> {
    if (!this.officePluginSupport) return false;
    if (!this.usesListener) {
      await this.ensureExecutable();
      return {
        success: true,
      }
    }

    if (await this.isListenerRunning()) {
      return { success: true };
    }
    this.stopOfficeProcess();

    let processRef: ReturnType<typeof spawn>;
    try {
      const isFree = await isFreePort(this.port || 2002);
      if (!isFree) {
        const ports = await findFreePorts(1);
        this.port = ports[0];
      }
      await this.ensureExecutable();
      processRef = spawn(this.sofficePath, [
        '--headless',
        `--accept=socket,host=${this.host},port=${this.port};urp;`,
        '--invisible',
        '--norestore',
        '--nodefault',
        '--nologo',
        '--nofirststartwizard'
      ], {
        windowsHide: true
      });
      this.officeProcess = processRef;
    } catch (error) {
      this.logOfficeFailure('startup', error);
      return false;
    }

    const exited = new Promise<OfficeStartupResult>((resolve) => {
      processRef.once('exit', (code, signal) => {
        if (this.officeProcess === processRef) {
          this.officeProcess = null;
        }
        this.logger.warn(`soffice exited code=${String(code)} signal=${String(signal)}`);
        resolve({
          success: false,
          type: code === 3221225781 ? "dll" : "timeout",
        });
      });
      processRef.once('error', (error) => {
        this.logOfficeFailure('listener', error);
        resolve({ success: false, type: "timeout" });
      });
    });

    processRef.stdout?.on('data', (data) => {
      this.logger.log(`[soffice stdout] ${String(data).trim()}`);
    });
    processRef.stderr?.on('data', (data) => {
      this.logger.warn(`[soffice stderr] ${String(data).trim()}`);
    });

    const socketReady = this.waitForSocket(180 * 1000, processRef).then<OfficeStartupResult>(running => (
      running
        ? { success: true }
        : { success: false, type: "timeout" }
    ));
    const result = await Promise.race([exited, socketReady]);
    if (result && result.success) {
      this.logger.log('office startup success');
    } else {
      this.logger.warn(`office startup failed type=${result && result.type || 'unknown'}`);
      if (this.officeProcess === processRef) {
        this.stopOfficeProcess();
      }
    }
    return result;
  }

  async startup(): Promise<OfficeStartupResult> {
    await this.ensureInitialized();
    return await this.startupSingleFlight.run(() => this.startOfficeProcess());
  }

  private async ensureListenerRunning() {
    await this.ensureInitialized();
    if (!this.officePluginSupport) {
      throw new OfficeRuntimeError(
        'office_plugin_unavailable',
        global.i18next.t('officeService.pluginUnavailable'),
      );
    }
    if (await this.isListenerRunning()) return;

    const result = await this.startup();
    if (!result || !result.success) {
      throw new OfficeRuntimeError(
        'office_service_start_failed',
        global.i18next.t('officeService.serviceStartFailed'),
      );
    }
  }

  private async restartListener() {
    this.logger.warn('office listener unavailable, restarting before one retry');
    await this.ensureListenerRunning();
  }

  private async waitForSocketClosed(timeout = 15 * 1000) {
    const deadline = Date.now() + timeout;
    do {
      if (!await this.probeSocket()) return true;
      const remaining = deadline - Date.now();
      if (remaining <= 0) return false;
      await new Promise(resolve => setTimeout(resolve, Math.min(500, remaining)));
    } while (Date.now() <= deadline);
    return false;
  }

  private async stopOfficeProcessForInstall() {
    const processRef = this.officeProcess;
    if (!processRef) {
      if (this.usesListener && await this.probeSocket()) {
        throw new Error(global.i18next.t('officeService.serviceStopFailed'));
      }
      return;
    }

    this.officeProcess = null;
    if (this.isWin && processRef.pid) {
      try {
        await this.runOfficeCommand('taskkill', [
          '/PID',
          String(processRef.pid),
          '/T',
          '/F',
        ], 'stop');
      } catch {
        if (!processRef.killed) processRef.kill();
      }
    } else if (!processRef.killed) {
      processRef.kill();
    }

    if (this.usesListener && !await this.waitForSocketClosed()) {
      throw new Error(global.i18next.t('officeService.serviceStopFailed'));
    }
  }

  async checkOfficePlugin() {
    await this.ensureInitialized();
    const running = this.usesListener
      ? await this.isListenerRunning()
      : this.officePluginSupport;
    return {
      installed: this.officePluginSupport,
      running,
    }
  }

  async toPDF(inputPath: string, outputPath: string) {
    await this.ensureInitialized();
    if (!this.officePluginSupport) {
      throw new OfficeRuntimeError(
        'office_plugin_unavailable',
        global.i18next.t('officeService.pluginUnavailable'),
      );
    }

    if (!this.usesListener) {
      try {
        return await this.runDirectConversion(inputPath, outputPath);
      } catch (error) {
        if (error instanceof OfficeRuntimeError) throw error;
        throw new OfficeRuntimeError(
          'office_conversion_failed',
          global.i18next.t('officeService.conversionFailed'),
          error,
        );
      }
    }

    return await runOfficeConversionWithRecovery({
      ensureRunning: () => this.ensureListenerRunning(),
      isRunning: async () => await this.isListenerRunning(),
      restart: () => this.restartListener(),
      convert: () => this.runUnoconv(inputPath, outputPath),
      conversionErrorMessage: global.i18next.t('officeService.conversionFailed'),
    });
  }

  private runOfficeCommand(command: string, args: string[], stage: string) {
    return new Promise<OfficeCommandResult>((resolve, reject) => {
      execFile(command, args, (error, stdout, stderr) => {
        if (error) {
          this.logOfficeFailure(stage, error, stdout, stderr);
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  private async runUnoconv(inputPath: string, outputPath: string) {
    return await this.runOfficeCommand(this.pythonPath, [
      this.unoconvPath,
      '--port',
      String(this.port),
      '-f',
      'pdf',
      '-o',
      outputPath,
      inputPath,
    ], 'unoconv');
  }

  private async runDirectConversion(inputPath: string, outputPath: string) {
    const name = unique();
    const filePath = join(os.tmpdir(), `${name}${extname(inputPath)}`);
    const outputDir = dirname(outputPath);
    await cp(inputPath, filePath, { recursive: true });
    try {
      await chmod(this.sofficePath, 0o755);
    } catch (error) {
      this.logOfficeFailure('chmod', error);
    }
    const result = await this.runOfficeCommand(this.sofficePath, [
      '--headless',
      '--convert-to',
      'pdf',
      filePath,
      '--outdir',
      outputDir,
    ], 'soffice-convert');
    await rename(join(outputDir, `${name}.pdf`), outputPath);
    return result;
  }

  private logOfficeFailure(stage: string, error: unknown, stdout = '', stderr = '') {
    const detail = error as Error & { code?: unknown, signal?: unknown };
    this.logger.error([
      `[office ${stage} failed]`,
      `message=${detail?.message || String(error)}`,
      `code=${String(detail?.code || '')}`,
      `signal=${String(detail?.signal || '')}`,
      `stdout=${String(stdout).trim()}`,
      `stderr=${String(stderr).trim()}`,
    ].join(' '));
  }

  private async validateOfficePluginDirectory(officeDir: string) {
    const invalidPluginMessage = global.i18next.t('officeService.invalidPluginFile');
    const manifestString = await readFile(join(officeDir, "manifest.json"), "utf-8").catch(() => null);
    if (!manifestString) throw new Error(invalidPluginMessage);

    let manifest: Manifest;
    try {
      manifest = JSON.parse(manifestString);
    } catch {
      throw new Error(invalidPluginMessage);
    }

    const platformMismatch = (this.isWin && manifest.platform !== "win")
      || (this.isMac && manifest.platform !== "darwin")
      || (this.isLinux && (manifest.platform !== "linux" || manifest.packageFormat !== this.linuxPkgType));
    if (platformMismatch) {
      throw new Error(global.i18next.t('officeService.pluginNotMatchOs'));
    }

    const requiredPaths = [this.getLibrePath(officeDir)];
    if (this.usesListener) {
      requiredPaths.push(this.getPythonPath(officeDir), this.getUnoconvPath(officeDir));
    }
    if (requiredPaths.some(requiredPath => !requiredPath || !existsSync(requiredPath))) {
      throw new Error(invalidPluginMessage);
    }
  }

  private async replaceOfficeInstallation(stagingDir: string, backupDir: string) {
    const hasCurrentInstallation = existsSync(this.officeDir);
    await rm(backupDir, { recursive: true, force: true });
    if (hasCurrentInstallation) {
      await rename(this.officeDir, backupDir);
    }

    try {
      await rename(stagingDir, this.officeDir);
    } catch (error) {
      if (hasCurrentInstallation && existsSync(backupDir) && !existsSync(this.officeDir)) {
        await rename(backupDir, this.officeDir);
      }
      throw error;
    }

    if (hasCurrentInstallation) {
      await rm(backupDir, { recursive: true, force: true });
    }
  }

  async installOfficePlugin(url: string) {
    await this.ensureInitialized();
    if (!existsSync(url)) throw new Error("file not exist");
    if (this.installing) throw new Error(global.i18next.t('officeService.installingPluginWaitTips'));
    this.installing = true;
    const installId = unique(16);
    const officeParentDir = dirname(this.officeDir);
    const stagingDir = join(officeParentDir, `.office-installing-${installId}`);
    const backupDir = join(officeParentDir, `.office-backup-${installId}`);
    try {
      await rm(stagingDir, { recursive: true, force: true });
      const result = await unzipFile(url, stagingDir);
      if (!result.extractDir) {
        throw new Error(result.reason || global.i18next.t('officeService.invalidPluginFile'));
      }
      await this.validateOfficePluginDirectory(stagingDir);
      await this.stopOfficeProcessForInstall();
      await this.replaceOfficeInstallation(stagingDir, backupDir);
      return true;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : String(err));
    } finally {
      await rm(stagingDir, { recursive: true, force: true }).catch(error => {
        this.logOfficeFailure('install-staging-cleanup', error);
      });
      if (existsSync(backupDir) && existsSync(this.officeDir)) {
        await rm(backupDir, { recursive: true, force: true }).catch(error => {
          this.logOfficeFailure('install-backup-cleanup', error);
        });
      }
      await rm(url, { recursive: true, force: true }).catch(error => {
        this.logOfficeFailure('install-archive-cleanup', error);
      });
      this.installing = false;
    }
  }

  async getPluginInstallURL() {
    await this.ensureInitialized();
    const baseUrl = 'https://production-resources.oss-cn-beijing.aliyuncs.com/banban/client/plugin/office/';  // 先写死
    let relativePath = '';
    if(this.isLinux) {
      const pkgFormat = this.linuxPkgType;
      if (pkgFormat === LinuxPackageType.UNKNOWN) throw new Error(global.i18next.t('officeService.osNotSupported'));
      relativePath = `linux/${pkgFormat}/office.zip`;
    } else if (this.isMac){
      relativePath = `mac/office.zip`;
    } else if (this.isWin) {
      relativePath = `win/office.zip`;
    }
    if (!relativePath)  throw new Error(global.i18next.t('officeService.osNotSupported'));
    return new URL(relativePath, baseUrl).href;
  }
}

