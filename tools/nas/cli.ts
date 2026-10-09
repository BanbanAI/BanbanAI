export type NasCliOptions = {
  [key: string]: string | boolean | undefined,
  help?: boolean,
};

type NasHelpConfig = {
  usage: string,
  options?: Array<{
    name: string,
    description: string,
  }>,
  notes?: string[],
  examples?: string[],
};

export function parseNasCliArgs(argv: string[]) {
  const options: NasCliOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;

    const normalizedArg = arg.replace(/^--/, "");
    if (normalizedArg === "help" || normalizedArg === "h") {
      options.help = true;
      continue;
    }

    if (normalizedArg.includes("=")) {
      const [key, value = "true"] = normalizedArg.split("=");
      options[key] = value;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      options[normalizedArg] = "true";
      continue;
    }

    options[normalizedArg] = next;
    i++;
  }

  return options;
}

export function readNasCliString(options: NasCliOptions, key: string) {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

export function normalizeNasArchName(arch?: string): "x64" | "arm64" | "" {
  if (!arch) return "";

  const normalized = arch.toLowerCase().replaceAll("-", "_");
  if (["x64", "amd64"].includes(normalized)) return "x64";
  if (["arm64", "arm_64", "aarch64"].includes(normalized)) return "arm64";

  throw new Error(`不支持的架构：${arch}，当前仅支持 x64 和 arm64`);
}

export function resolveNasArch(arch?: string) {
  return normalizeNasArchName(arch) || (process.arch === "arm64" ? "arm64" : "x64");
}

export function printNasHelp(config: NasHelpConfig) {
  const lines = [
    "用法：",
    `  ${config.usage}`,
  ];

  if (config.options && config.options.length > 0) {
    const optionWidth = Math.max(...config.options.map((item) => item.name.length)) + 2;
    lines.push("", "常用参数：");
    for (const item of config.options) {
      lines.push(`  ${item.name.padEnd(optionWidth)}${item.description}`);
    }
  }

  if (config.notes && config.notes.length > 0) {
    lines.push("", "说明：");
    for (const item of config.notes) {
      lines.push(`  ${item}`);
    }
  }

  if (config.examples && config.examples.length > 0) {
    lines.push("", "示例：");
    for (const item of config.examples) {
      lines.push(`  ${item}`);
    }
  }

  console.log(lines.join("\n"));
}

export const NAS_COMMON_OPTIONS = [
  { name: "--flavor", description: "构建 flavor，默认 main" },
  { name: "--lang", description: "语言，默认 zh-CN" },
  { name: "--arch", description: "架构，支持 x64、arm64；推荐写法 --arch x64" },
] as const;
