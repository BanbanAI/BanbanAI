import { execSync } from "child_process";
import { existsSync } from "fs";
import { rm } from "fs/promises";
import { join } from "path";

const main = async () => {
  const rootDir = join(__dirname, "..", "..");
  
  console.log("1. 开始在 ARM 机器上编译 server...");
  execSync("yarn build:server", { cwd: rootDir, stdio: "inherit" });
  
  const serverDir = join(rootDir, "dist", "server");
  if (!existsSync(serverDir)) {
    throw new Error(`编译失败，未找到目录: ${serverDir}`);
  }
  
  const tarFile = join(rootDir, "dist", "dist-server-arm64.tar.gz");
  console.log(`2. 开始打包压缩为 ${tarFile}...`);
  
  if (existsSync(tarFile)) {
    await rm(tarFile, { force: true });
  }
  
  // 在 Linux-ARM 上使用 tar 压缩 dist/server 目录
  // 注意 -C 是切换工作目录，这样压缩包里不会包含 dist 这一层多余路径，而是直接从 server/ 开始
  execSync(`tar -czf "${tarFile}" -C "${join(rootDir, "dist")}" server`, { stdio: "inherit" });
  
  console.log("\n=======================================================");
  console.log(`打包成功！请将项目 dist 目录下的 dist-server-arm64.tar.gz`);
  console.log("拷贝到 x86 打包机的 dist 目录下。");
  console.log("=======================================================\n");
};

main().catch((err) => {
  console.error("ARM server 打包失败:", err);
  process.exit(1);
});
