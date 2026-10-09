import { execSync } from "child_process";
import { existsSync } from "fs";
import { rm, mkdir } from "fs/promises";
import { join } from "path";

const main = async () => {
  const rootDir = join(__dirname, "..", "..");
  const serverDir = join(rootDir, "dist", "server");
  const tarFile = join(rootDir, "dist", "dist-server-arm64.tar.gz");
  
  console.log("1. 正在清理现有的 dist/server 目录...");
  await rm(serverDir, { recursive: true, force: true });
  
  console.log("2. 正在检查是否存在 ARM64 编译包 dist-server-arm64.tar.gz...");
  if (!existsSync(tarFile)) {
    throw new Error(
      `未找到 ARM64 编译压缩包: ${tarFile}\n请先在 ARM 机器上运行 'yarn build:nas:server:arm64:tgz' 并把产生的压缩包拷贝到 x86 打包机的 dist 目录下。`
    );
  }
  
  console.log("3. 正在解压 dist-server-arm64.tar.gz 到 dist/ 目录...");
  const distDir = join(rootDir, "dist");
  if (!existsSync(distDir)) {
    await mkdir(distDir, { recursive: true });
  }
  
  // 在 x86_64 Linux 或 Windows 宿主机上解压
  // Windows 10/11 和 Linux 都原生自带 tar 命令，所以可以直接执行 tar -xzf
  try {
    execSync(`tar -xzf "${tarFile}" -C "${distDir}"`, { stdio: "inherit" });
  } catch (error) {
    console.error("解压失败，请确保系统已安装 tar 命令（Windows 10/11 已内置 tar）：", error);
    throw error;
  }
  
  console.log("\n=======================================================");
  console.log("解压完成，ARM 版 dist/server 目录准备就绪。");
  console.log("即将开始后续的 payload 生成与群晖 ARM 平台打包流程。");
  console.log("=======================================================\n");
};

main().catch((err) => {
  console.error("准备 ARM64 server 编译产物失败:", err);
  process.exit(1);
});
