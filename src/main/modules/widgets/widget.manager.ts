import { Injectable, Inject, Logger } from '@nestjs/common'
import path, { basename, dirname, join, resolve } from 'path'
import { readFile, stat, mkdir, cp } from 'fs/promises';
import { existsSync } from 'fs';
import { handleTemplateTree } from './widget-template';
import { NOCODES_DIR, PREFERENCES } from '@main/constants';
import { isEmpty } from '@common/utils/object';
import {
  WidgetTemplate,
  WidgetTemplateList,
} from '@common/types/project';
import { unique } from '@common/utils/unique';
import { Preferences } from '@main/modules/common';
import { getFileMd5 } from '@main/utils/md5';

import { getBuiltinWidgetManifests } from '@main/modules/widgets/builtin-widget-registry';

@Injectable()
export class WidgetManager {
  private readonly logger = new Logger('WidgetManager');
  private _templatesList: WidgetTemplateList; //整理后可用于前端渲染的模板结构

  constructor(
    @Inject(PREFERENCES) private readonly preferences: Preferences,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
  ) {}

  private getAllWidgets() {
    return getBuiltinWidgetManifests();
  }

  private getFormWidgets() {
    return this.getAllWidgets().filter((manifest) => manifest.name.includes("widget.form"));
  }

  async getAllFormTemplates() {
    let data: WidgetTemplateList = [];
    try {
      const manifestPath = join(__dirname, 'templates', 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      data = Object.values(manifest) as WidgetTemplateList;
    } catch (error) {
      this.logger.error('failed to load offline widget templates', error);
    }
    this._templatesList = handleTemplateTree(data, this.getFormWidgets());
    return this.checkTemplateSupport(this._templatesList);
  }

  private getUsedResourcePaths(boardVal: any): string[] {
    const paths = [];
    if (Array.isArray(boardVal)) {
      for (const item of boardVal) {
        paths.push(...this.getUsedResourcePaths(item));
      }
    } else if (boardVal instanceof Object) {
      if (boardVal['__opt_type'] === 'file') {
        if (boardVal['exportFolder']) {
          paths.push(dirname(boardVal['relativePath']));
        } else {
          paths.push(boardVal['relativePath']);
        }
      } else if (boardVal['__opt_type'] === 'folder') {
        paths.push(boardVal['relativeDir']);
      } else {
        for (const key in boardVal) {
          paths.push(...this.getUsedResourcePaths(boardVal[key]));
        }
      }
    }
    return Array.from(new Set(paths));
  }

  async copyResource(template: WidgetTemplate, nocodeId: string) {
    const relativePaths = this.getUsedResourcePaths(template.soul);
    let templateSoulJson = JSON.stringify(template.soul);
    let hasChanged = false;
    const localFolderPath = this.resolveTemplatePath(this.getBuiltinTemplateDir(), template.url);
    const widgetSnapshotPath = this.resolveTemplatePath(this.getBuiltinTemplateDir(), template.image);
    const snapshotName = `snapshot-${unique()}.jpg`
    const nocodeDir = join(this.nocodesDir, nocodeId);
    const targetCopyPath = join(nocodeDir, "snapshot", "widgets",snapshotName);
    await cp(widgetSnapshotPath, targetCopyPath, {recursive:true});

    for (const relativePath of relativePaths) {
      if (!relativePath) continue;
      const resourcePath = join(localFolderPath, relativePath);
      let targetPath = join(nocodeDir, relativePath);
      const stats = await stat(resourcePath).catch(() => {});
      if (stats && stats.isDirectory()) { // 文件夹暂时整个覆盖
        if (!existsSync(targetPath)) {
          await mkdir(targetPath, { recursive: true });
        }
        await cp(resourcePath, targetPath, { recursive: true });
      } else {
        if (existsSync(resourcePath)) {
          if (existsSync(targetPath)) {
            const resourceFileMd5 = await getFileMd5(resourcePath);
            const targetFileMd5 = await getFileMd5(targetPath);
            if (resourceFileMd5 !== targetFileMd5) {
              const baseName = basename(resourcePath);
              const targetName = `${new Date().getTime()}-${basename(baseName)}`;
              targetPath = targetPath.replace(baseName, targetName);
              const replacedRelativePath = relativePath.replace(baseName, targetName);
              templateSoulJson = templateSoulJson.replace(relativePath, replacedRelativePath);
              hasChanged = true;
              await cp(resourcePath, targetPath, { recursive: true });
            }
          } else {
            await cp(resourcePath, targetPath, { recursive: true });
          }
        }
      }
    }
    return {
      hasChanged,
      templateSoul: JSON.parse(templateSoulJson),
      snapshotPath: join("snapshot", "widgets", snapshotName)
    }
  }

  private resolveTemplatePath(rootPath: string, relativePath: string) {
    const resolvedRoot = resolve(rootPath);
    const resolvedPath = resolve(resolvedRoot, relativePath);
    if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error('template path is outside the template directory');
    }
    return resolvedPath;
  }

  private getBuiltinTemplateDir() {
    return join(__dirname, 'templates');
  }

  async getTemplateImagePath(url: string) {
    return this.resolveTemplatePath(this.getBuiltinTemplateDir(), url);
  }

  async getBuiltinTemplateSoul(templatePath: string) {
    const templateDir = this.resolveTemplatePath(this.getBuiltinTemplateDir(), templatePath);
    const templateSoulString = await readFile(join(templateDir, 'main.json'), 'utf8');
    return JSON.parse(templateSoulString);
  }

  private checkTemplateSupport(templatesList: WidgetTemplateList) {
    const addonNames = this.getAllWidgets().map((manifest) => manifest.name);
    return templatesList.map(template => {
      template.children = (template.children || []).map(category => {
        category.children = (category.children || []).map(widget => {
          const metaWidgets = widget?.meta?.widgets || [];
          for (const metaWidget of metaWidgets) {
            if (!addonNames.includes(metaWidget.type)) {
              widget.notSupport = true;
              break;
            }
          }
          return widget;
        });
        return category;
      })
      return template;
    });
  }
}
