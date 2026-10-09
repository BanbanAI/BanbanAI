import { mkdir, rename, rm } from "fs/promises";
import { dirname, join } from "path";
import { execFileSync } from "child_process";

type CreateSynologySpkOptions = {
  sourceDir: string;
  outputFile: string;
};

export const createSynologySpk = async (options: CreateSynologySpkOptions) => {
  await mkdir(dirname(options.outputFile), { recursive: true });
  await rm(options.outputFile, { force: true });
  const tempOutputFile = join(process.cwd(), `.tmp-synology-spk-${Date.now()}.spk`);
  await rm(tempOutputFile, { force: true });
  execFileSync("tar", ["-cf", tempOutputFile, "-C", options.sourceDir, "."], { stdio: "inherit" });
  await rename(tempOutputFile, options.outputFile);
};

export const createSynologySpkFileName = (packageName: string, arch: string) => `${packageName}-${arch}.spk`;
