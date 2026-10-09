import { DepolyFile } from "@main/utils";
import { getRuntime } from "@main/runtime";
import { unique } from "@common/utils/unique";
import { mkdir } from "fs/promises";
import { existsSync } from 'fs';
import { BoardSoul, ProjectBody, WidgetSoul } from '@common/types/project';
import { join, extname, basename } from "path";
import { writeFile, readFile, rename, readdir, unlink, cp, rm } from "fs/promises";
import os from "os";
import { Logger } from '@nestjs/common';

const logger = new Logger('projectUtils')
const projectSaveMap: Record<string, number> = {};
const filterSoul = (souls: BoardSoul | WidgetSoul) => {
  if ((souls as WidgetSoul)?.widgets) {
    (souls as WidgetSoul).widgets = (souls as WidgetSoul).widgets.filter(widgetSoul => {
      if (widgetSoul.isSnap) return false;
      filterSoul(widgetSoul);
      return true;
    })
  }
}

const replaceOldJson = async (oldJsonDir: string) => {
  const files = await readdir(oldJsonDir);
  const targetFiles = files.filter(filename => filename.startsWith('main.json.old'));
  if (targetFiles.length === 0) return;
  targetFiles.sort((prev, next) => {
    const suffixA = parseInt(extname(prev).slice(1));
    const suffixB = parseInt(extname(next).slice(1));
    return suffixA - suffixB;
  });
  for (let index = targetFiles.length - 1; index >= 0; index--) {
    const filename = targetFiles[index];
    const oldPath = join(oldJsonDir, filename);
    if (index >= 9) {
      try {
        await rm(oldPath);
      } catch (err) {
        logger.log(`${oldPath} rm error`, err);
      }
    } else {
      const curName = basename(filename, extname(filename));
      const newPath = join(oldJsonDir, `${curName}.${index + 2}`);
      await rename(oldPath, newPath);
    }
  }
}

export async function writeProjectBody(projectDir: string, projectBody: ProjectBody, projectId: string) {
  delete projectBody.id;
  const jsonDir = join(projectDir, "main.json");
  let content: string;
  if (getRuntime().isProduction) {
    content = JSON.stringify(projectBody);
  } else {
    content = JSON.stringify(projectBody, null, 2);
  }
  const tempDir = join(os.tmpdir(), `main-json-${projectId}-${Date.now()}.tmp`);
  try {
    await writeFile(tempDir, content, "utf-8");
    if ((!projectSaveMap[projectId] || ((Date.now() - projectSaveMap[projectId]) > 60 * 1000)) && existsSync(projectDir)) {
      projectSaveMap[projectId] = Date.now();
      await replaceOldJson(projectDir);
      await rename(jsonDir, join(projectDir, `main.json.old.${Date.now()}.1`));
    }

    try {
      await cp(tempDir, jsonDir);
    } catch (err) {
      logger.log(`copy error`, err);
      let i = 0;
      while (i < 3) {
        await new Promise((resolve) => {
          setTimeout(() => {
            resolve(true);
          }, 300);
        });
        try {
          logger.log(`copy again ${ i+1 }`);
          await cp(tempDir, jsonDir);
          logger.log(`copy again success ${ i+1 }`);
          i = 3;
        } catch (err) {
          logger.log(`copy again err ${ i+1 }`, err);
          i ++;
        }
      }
    }
    await mkdir(projectDir, {recursive: true});
    try {
      await rm(tempDir);
    } catch (err) {
      logger.log(`rm error: `, err);      
    }
  } catch (err) {
    if (err.message.indexOf("ENOSPC:") > -1) {
      throw new Error(global.i18next.t("projectServicesTs.diskSpaceTip"))
    }
    throw err;
  }
}

async function readProjectBody(projectDir: string): Promise<ProjectBody> {
  const jsonDir = join(projectDir, "main.json");
  const projectBody = JSON.parse(await readFile(jsonDir, "utf-8"));
  return projectBody;
}

/**
 * 用于创建空白项目
 */
export function getEmptyProjectBody(): ProjectBody {
  return {
    boards: [
      {
        type: "board",
        name: global.i18next.t("projectServicesTs.boardOne"),
        uid: unique(),
        widgets: [],
      }
    ],
    version: 4,
    traceId: unique(),
    sharing: true,
  };
}

export async function saveProjectBody(projectsDir: string, id: string, projectBody: ProjectBody) {
  const projectDir = join(projectsDir, id);
  try {
    filterSoul(projectBody.foreboard);
    filterSoul(projectBody.backboard);
    projectBody.boards.forEach(boardSoul => filterSoul(boardSoul));
    await writeProjectBody(projectDir, projectBody, id);
  } catch(err) {
    throw err;
  }
}

export async function getProjectBody(projectsDir: string, projectId: string, liveUpdate?: boolean): Promise<ProjectBody> {
  const projectDir = (liveUpdate ?? true) ? join(projectsDir, projectId) : join(projectsDir, projectId, "release");
  const projectBody = await _getProjectBody(projectDir);
  projectBody.id = projectId;
  return projectBody;
}

async function _getProjectBody(projectDir: string): Promise<ProjectBody> {
  const projectBody = await readProjectBody(projectDir);
  return projectBody;
}

export class ProjectFile extends DepolyFile {
  async getProjectBody(): Promise<ProjectBody> {
    return _getProjectBody(this.unzipDir);
  }
}

export const sanitizeFilenameAdvanced = (filename: string, options: {
  replaceChar?: string,
  trim?: boolean,
  allowDots?: boolean,
  maxLen?: number
} = {}) => {
  const {
    replaceChar = '_',
    trim = true,
    allowDots = true, // 是否允许点（用于扩展名）
    maxLen = 255 // Windows 最大文件名长度
  } = options;

  let clean = filename;

  if (trim) {
    clean = clean.trim();
  }

  // 替换非法字符
  const illegalChars = new RegExp('[\\\\/:*?"<>|]', 'g');
  clean = clean.replace(illegalChars, replaceChar);

  // 可选：去除连续多个替换字符（避免出现 ____）
  clean = clean.replace(new RegExp(`\\${replaceChar}+`, 'g'), replaceChar);

  // 截断长度
  if (clean.length > maxLen) {
    const ext = allowDots ? clean.slice(clean.lastIndexOf('.')) : '';
    clean = clean.slice(0, maxLen - ext.length) + ext;
  }

  return clean;
}
