import { dirname, relative } from "path";

export const shouldCopyNasPayloadEntry = (sourceDir: string, entryPath: string, hasExecutable?: boolean) => {
  const relativePath = relative(sourceDir, entryPath);
  if (!relativePath || relativePath === ".") {
    return true;
  }

  // The server release zip is only used by other distribution channels.
  // Keeping it in NAS payload duplicates a large already-compressed artifact.
  const isRootZipFile = dirname(relativePath) === "." && relativePath.toLowerCase().endsWith(".zip");
  if (isRootZipFile) {
    return false;
  }

  if (hasExecutable) {
    // If we have a standalone binary executable, we don't need node_modules or server source directory
    const parts = relativePath.split(/[\\/]/);
    if (parts[0] === "node_modules" || parts[0] === "server") {
      return false;
    }
  }

  return true;
};
