#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 生成 GitHub Release 正文：Downloads 表格 + 折叠的 Release Notes + What's Changed。
 *
 * 刻意只用 node 内置模块（因此也只能用 CommonJS 的 require），
 * CI 里直接 `node tools/release/compose-release-body.js` 即可，不需要 yarn install。
 *
 * 发版说明固定读仓库根目录的 release-notes.md（单文件覆盖式，历史版本用 git show <tag>:release-notes.md 查）。
 * 产物命名规则必须与 .github/workflows/release.yml 里的重命名步骤保持一致。
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

const PLATFORMS = [
  {
    id: "win",
    label: "Windows",
    fileName: (base, arch, ext) => `${base}-win-${arch}-${ext}`,
    archs: [
      {
        arch: "x64",
        label: "x64",
        artifacts: [{ ext: "setup.exe", label: "Installer" }],
      },
    ],
  },
  {
    id: "mac",
    label: "macOS",
    fileName: (base, arch, ext) => `${base}-mac-${arch}.${ext}`,
    archs: [
      {
        arch: "arm64",
        label: "Apple silicon (arm64)",
        artifacts: [
          { ext: "dmg", label: "DMG" },
          { ext: "zip", label: "ZIP" },
        ],
      },
      {
        arch: "x64",
        label: "Intel (x64)",
        artifacts: [
          { ext: "dmg", label: "DMG" },
          { ext: "zip", label: "ZIP" },
        ],
      },
    ],
  },
  {
    id: "linux",
    label: "Linux",
    fileName: (base, arch, ext) => `${base}-linux-${arch}.${ext}`,
    archs: [
      {
        arch: "x64",
        label: "x64",
        artifacts: [
          { ext: "AppImage", label: "AppImage" },
          { ext: "deb", label: "DEB" },
          { ext: "rpm", label: "RPM" },
        ],
      },
      {
        arch: "arm64",
        label: "arm64",
        artifacts: [
          { ext: "AppImage", label: "AppImage" },
          { ext: "deb", label: "DEB" },
          { ext: "rpm", label: "RPM" },
        ],
      },
    ],
  },
];

function releaseBaseName({ product, tag }) {
  return `${product}-${tag.replace(/^v/, "")}`;
}

function listArtifacts({ product, tag }) {
  const base = releaseBaseName({ product, tag });
  const rows = [];

  for (const platform of PLATFORMS) {
    for (const arch of platform.archs) {
      rows.push({
        platform: platform.label,
        architecture: arch.label,
        files: arch.artifacts.map((artifact) => ({
          fileName: platform.fileName(base, arch.arch, artifact.ext),
          label: artifact.label,
        })),
      });
    }
  }

  return rows;
}

function createDownloadTable({ product, tag, baseUrl }) {
  const lines = [
    `## Downloads (${tag})`,
    "",
    "| Platform | Architecture | Download |",
    "| --- | --- | --- |",
  ];

  for (const row of listArtifacts({ product, tag })) {
    const downloads = row.files
      .map(({ fileName, label }) => {
        const url = `${baseUrl}/${encodeURIComponent(tag)}/${encodeURIComponent(fileName)}`;
        return `[${label}](${url})`;
      })
      .join(" · ");
    lines.push(`| ${row.platform} | ${row.architecture} | ${downloads} |`);
  }

  return lines.join("\n");
}

// 中英双语用 HTML 注释分隔，只取英文段（与 Cherry Studio 一致）。
// 现用的 release-notes.md 是纯中文、没有标记，走「整份原样使用」那条分支。
const LANG_EN = "<!--LANG:en-->";
const LANG_ZH = "<!--LANG:zh-CN-->";

function pickEnglish(curatedNotes) {
  if (!curatedNotes.includes(LANG_EN)) return curatedNotes;
  const end = curatedNotes.indexOf(LANG_ZH);
  return curatedNotes.slice(curatedNotes.indexOf(LANG_EN) + LANG_EN.length, end < 0 ? undefined : end);
}

function createReleaseNotes(curatedNotes) {
  const content = pickEnglish(curatedNotes).trim();
  if (!content) throw new Error("Release notes are empty");
  return `<details>\n<summary>Release Notes</summary>\n\n${content}\n\n</details>`;
}

// 单文件覆盖式，标题里的版本号最容易忘了跟着 tag 改，发出去才发现
function assertNotesVersion(notes, tag) {
  const version = tag.replace(/^v/, "");
  const title = notes.split(/\r?\n/).find((line) => line.trim()) || "";
  if (!title.includes(version)) {
    throw new Error(
      `发版说明第一行必须包含当前版本号 ${version}，实际是：\n  ${title}\n（发版时记得连标题里的版本号一起改）`
    );
  }
}

function composeReleaseBody({ notes, changes, product, repository, tag, baseUrl }) {
  assertNotesVersion(notes, tag);
  const url = baseUrl || `https://github.com/${repository}/releases/download`;
  const body = `${createDownloadTable({ product, tag, baseUrl: url })}\n\n${createReleaseNotes(notes)}`;
  const changesText = (changes || "").trim();
  return changesText ? `${body}\n\n${changesText}\n` : `${body}\n`;
}

const NOTES_FILE = "release-notes.md";

function resolveNotes(notesPath) {
  const candidate = notesPath || NOTES_FILE;
  const resolved = path.resolve(ROOT, candidate);
  if (!fs.existsSync(resolved)) throw new Error(`找不到发版说明文件：${candidate}`);
  return { content: fs.readFileSync(resolved, "utf8"), path: candidate };
}

function parseArgs(argv) {
  const options = {
    product: "",
    repository: process.env.GITHUB_REPOSITORY || "",
    tag: "",
    notes: "",
    changes: "",
    out: "",
    baseUrl: "",
    list: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    switch (key) {
      case "--product": options.product = value; i += 1; break;
      case "--repo": options.repository = value; i += 1; break;
      case "--tag": options.tag = value; i += 1; break;
      case "--notes": options.notes = value; i += 1; break;
      case "--changes": options.changes = value; i += 1; break;
      case "--out": options.out = value; i += 1; break;
      case "--base-url": options.baseUrl = value; i += 1; break;
      case "--list": options.list = true; break;
      default: throw new Error(`未知参数：${key}`);
    }
  }
  if (!options.product) {
    options.product = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).name;
  }
  if (!options.list && !options.tag) throw new Error("缺少 --tag（例如 --tag v2.0.0）");
  if (!options.list && !options.repository) throw new Error("缺少 --repo 或环境变量 GITHUB_REPOSITORY");
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.list) {
    for (const row of listArtifacts({ product: options.product, tag: options.tag || "v0.0.0" })) {
      for (const file of row.files) console.log(file.fileName);
    }
    return;
  }

  const notes = resolveNotes(options.notes);
  const changes = options.changes ? fs.readFileSync(options.changes, "utf8") : "";
  const body = composeReleaseBody({ ...options, notes: notes.content, changes });

  if (options.out) {
    fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
    fs.writeFileSync(options.out, body);
    console.log(`已写入 ${options.out}（发版说明来自 ${notes.path}）`);
  } else {
    process.stdout.write(body);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { composeReleaseBody, createDownloadTable, listArtifacts, releaseBaseName, PLATFORMS };
