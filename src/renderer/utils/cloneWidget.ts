import { Options } from "@common/types/project";
import { unique } from "@common/utils/unique";
import { OptionFileValue, SoulUIDMapping, isOptionFileArrayValue, isOptionFileValue } from "@renderer/b2/types";
import { BoardSoul, WidgetSoul } from "@common/types/project";
import axios from "axios";

// 处理粘贴组件soul
export const handlePastedWidgetsSoul = async (widgetSouls: WidgetSoul[], projectId: string, activeBoardId: string, originalBoardId?: string, originalProjectId?: string): Promise<{ pastedWidgetSouls: { widgetSoul: WidgetSoul; oldUID: string; }[], pastedWidgetsUIDMap: SoulUIDMapping }> => {
  let pastedWidgetsUIDMap: SoulUIDMapping = {};
  if (originalBoardId) {
    pastedWidgetsUIDMap[originalBoardId] = activeBoardId;
  }
  const pastedWidgetSouls: { widgetSoul: WidgetSoul, oldUID: string }[] = [];
  for (const widgetSoul of widgetSouls) {
    if (originalProjectId && projectId !== originalProjectId) {
      await handleSoul(widgetSoul, originalProjectId, projectId);
    }
    updateAllWidgetsSoulUID(widgetSoul, pastedWidgetsUIDMap);
  }
  for (const widgetSoul of widgetSouls) {
    handleElementOptionsSoul(widgetSoul, pastedWidgetsUIDMap);
    let oldUID: string;
    for (const key in pastedWidgetsUIDMap) {
      if (pastedWidgetsUIDMap[key] === widgetSoul.uid) {
        oldUID = key;
        break;
      }
    }
    pastedWidgetSouls.push({
      widgetSoul, oldUID
    })
  }
  return { pastedWidgetSouls, pastedWidgetsUIDMap };
}

export const handleSoul = async (soul: WidgetSoul, originalProjectId: string, projectId: string) => {
  await handleFileOptions(soul.options, originalProjectId, projectId);
  for (const widget of (soul as WidgetSoul).widgets || []) {
    await handleSoul(widget, originalProjectId, projectId);
  }
};

const isObject = (value: any) => {
  return value != null && typeof value === 'object'
}

export const handleFileOptions = async (options: any, originalProjectId: string, projectId: string) => {
  for (const key in options) {
    if (!isObject(options[key])) continue;
    if (isOptionFileValue(options[key]) && options[key].relativePath) {
      const res = await axios.post('/project/copy-file', {
        filePath: (options[key] as OptionFileValue).relativePath,
        optType: (options[key] as OptionFileValue).__opt_type,
        originProjectId: originalProjectId,
        projectId
      })
      if(res?.data?.filePath){
        (options[key] as OptionFileValue).relativePath = res.data.filePath;
      }
    } else if (isOptionFileArrayValue(options[key])) {
      for (const fileOption of options[key] as OptionFileValue[]) {
        if (!fileOption.relativePath) continue;
        const res = await axios.post('/project/copy-file', {
          filePath: fileOption.relativePath,
          optType: fileOption.__opt_type,
          originProjectId: originalProjectId,
          projectId
        })
        if(res?.data?.filePath){
          fileOption.relativePath = res.data.filePath;
        }
      }
    } else {
      await handleFileOptions(options[key] as any, originalProjectId, projectId);
    }
  }
}

// 递归更新widget内的uid
export const updateAllWidgetsSoulUID = (soul: WidgetSoul, soulUIDs: SoulUIDMapping) => {
  const oldUID = soul.uid;
  soul.uid = unique();
  if (soulUIDs) {
    soulUIDs[oldUID] = soul.uid;
  }
  soul.widgets?.forEach((child) => {
    updateAllWidgetsSoulUID(child, soulUIDs);
  })
}
// 处理elementOption
export const handleElementOptions = (options: Options, soulUIDs: SoulUIDMapping) => {
  for (const key in options) {
    if (!isObject(options[key])) continue;
    if (options[key]["__opt_type"] === "element") {
      let uidArr = options[key]['elementPath'];
      if (uidArr && soulUIDs[uidArr[uidArr.length -1]]) {
        options[key]['elementPath'] = (uidArr as string[]).map((uid) => {
          return soulUIDs[uid] ?? uid;
        });
      }
    } else {
      handleElementOptions(options[key] as any, soulUIDs);
    }
  }
}


// 递归处理 widget 配置项
export const handleElementOptionsSoul = async (soul: WidgetSoul, soulUIDs: SoulUIDMapping) => {
  handleElementOptions(soul.options, soulUIDs);
  for (const widget of (soul as WidgetSoul).widgets || []) {
    handleElementOptionsSoul(widget, soulUIDs);
  }
};

export const mergeObjects = (baseObj: any, targetObj: any) => {
  for (let prop in targetObj) {
    if (targetObj.hasOwnProperty(prop)) {
      if (typeof targetObj[prop] === "object" && targetObj[prop] !== null) {
        if (!baseObj[prop]) baseObj[prop] = {};
        mergeObjects(baseObj[prop], targetObj[prop]);
      } else {
        baseObj[prop] = targetObj[prop];
      }
    }
  }
  return baseObj;
}

export { findWidgetSoulByUID } from "@common/utils/element";
