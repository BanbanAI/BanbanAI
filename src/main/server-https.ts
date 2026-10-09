import { NestApplicationOptions } from "@nestjs/common";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export type CertFiles = { key?: string; cert?: string; ca?: string };

/** https.createServer 的 options */
export type ServerHttpsOptions = NestApplicationOptions["httpsOptions"];

export type ResolvedHttpsOptions = {
  httpsOptions?: ServerHttpsOptions;
  configCertError?: unknown;
};

const defaultCertDir = join(__dirname, "assets", "pem");

const readHttpsFile = (filePath?: string) => {
  if (!filePath || !existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath);
};

/** config.jsonc / 内置证书用的是文件路径 */
const readHttpsOptionsFromFiles = (cert?: CertFiles): ServerHttpsOptions | null => {
  if (!cert?.key || !cert?.cert) return null;
  const key = readHttpsFile(cert.key);
  const certFile = readHttpsFile(cert.cert);
  const ca = readHttpsFile(cert.ca);
  if (!key || !certFile) return null;
  return { key, cert: certFile, ...(ca ? { ca } : {}) };
};

/** 上传接口存进 Preferences 的是 PEM 内容 */
export const readHttpsOptionsFromContent = (cert?: CertFiles): ServerHttpsOptions | null => {
  if (!cert?.key || !cert?.cert) return null;
  return {
    key: Buffer.from(cert.key),
    cert: Buffer.from(cert.cert),
    ...(cert.ca ? { ca: Buffer.from(cert.ca) } : {}),
  };
};

/** 内置默认证书，只覆盖 localhost / 127.0.0.1 */
export const resolveDefaultHttpsOptions = (): ServerHttpsOptions | null => readHttpsOptionsFromFiles({
  key: join(defaultCertDir, "key.pem"),
  cert: join(defaultCertDir, "cert.pem"),
  ca: join(defaultCertDir, "ca.pem"),
});

/**
 * 证书来源优先级：config.jsonc 显式配置（文件路径）→ 用户上传（Preferences 内容）→ 内置默认证书。
 * 只有显式配置了文件却读不到才算配置错误；其余情况回退，不阻断启动。
 */
export const resolveServerHttpsOptions = (configCert?: CertFiles, uploadedCert?: CertFiles): ResolvedHttpsOptions => {
  if (configCert?.key && configCert?.cert) {
    try {
      const httpsOptions = readHttpsOptionsFromFiles(configCert);
      if (httpsOptions) return { httpsOptions };
    } catch (configCertError) {
      return { configCertError };
    }

    return { configCertError: new Error("HTTPS certificate or key file does not exist") };
  }

  const uploaded = readHttpsOptionsFromContent(uploadedCert);
  if (uploaded) return { httpsOptions: uploaded };

  return { httpsOptions: resolveDefaultHttpsOptions() ?? undefined };
};
