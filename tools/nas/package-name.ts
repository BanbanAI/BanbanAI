export type SupportedNasArch = "x64" | "arm64";
export const NAS_DISPLAY_NAME = "斑斑低代码";
export const NAS_ARTIFACT_DISPLAY_NAME = NAS_DISPLAY_NAME;
export type SupportedNasArtifactArch = "x86" | "arm";
export type SupportedNasArtifactExtension = "fpk" | "spk";

const FNOS_RUNTIME_ACCOUNT_MAX_LENGTH = 32;

export function createFnosPackageName(flavor: string) {
  return `ds-banban-nas-${flavor}`;
}

export function createFnosRuntimeAccountName(flavor: string) {
  const normalizedAccountName = createFnosPackageName(flavor)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const truncatedAccountName = normalizedAccountName
    .slice(0, FNOS_RUNTIME_ACCOUNT_MAX_LENGTH)
    .replace(/_+$/g, "");
  return truncatedAccountName || "banban";
}

export function createSynologyPackageName(flavor: string, arch: SupportedNasArch) {
  return `ds-banban-nas-${flavor}-${arch}`;
}

export function normalizeNasArtifactVersion(version: string) {
  const normalizedVersion = version.trim();
  if (/^\d+(?:\.\d+)*$/.test(normalizedVersion)) {
    return normalizedVersion;
  }
  return normalizedVersion.match(/^\d+(?:\.\d+)*/)?.[0] || "1.0.0";
}

export function createNasArtifactBaseName(version: string) {
  return `${NAS_ARTIFACT_DISPLAY_NAME}-${normalizeNasArtifactVersion(version)}`;
}

export function resolveNasArtifactArch(arch: SupportedNasArch): SupportedNasArtifactArch {
  return arch === "arm64" ? "arm" : "x86";
}

export function createNasArtifactFileName(
  version: string,
  arch: SupportedNasArch,
  extension: SupportedNasArtifactExtension,
) {
  return `${createNasArtifactBaseName(version)}-${resolveNasArtifactArch(arch)}.${extension}`;
}
