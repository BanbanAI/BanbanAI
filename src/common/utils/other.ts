import { Account } from "@common/types/account";
import { FormElementInfo, FormWidgetType, NocodeHomePageSetting, NocodeStructure, NocodeStructureType } from "@common/types/nocode";
import { DataMode, Field, WidgetSoul } from "@common/types/project";
import { isEmpty } from "@common/utils/object";
import i18next from "i18next";

export const isNode = typeof process !== 'undefined' && process.versions?.node;

export const escapeRegExp = (value: string) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const richTextHtmlEntityMap: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ensp: ' ',
  emsp: ' ',
}

const decodeRichTextHtmlEntities = (value: string) => {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    const normalizedEntity = String(entity).toLowerCase()
    if (normalizedEntity.startsWith('#x')) {
      const codePoint = Number.parseInt(normalizedEntity.slice(2), 16)
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
    }
    if (normalizedEntity.startsWith('#')) {
      const codePoint = Number.parseInt(normalizedEntity.slice(1), 10)
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
    }
    return richTextHtmlEntityMap[normalizedEntity] ?? match
  })
}

export const richTextToPlainText = (value: unknown) => {
  if (typeof value !== 'string') {
    return value
  }

  const normalizedValue = value
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<span\b[^>]*\bclass=["'][^"']*\bkatex-mathml\b[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<(svg|video|audio|iframe|canvas|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<img\b[^>]*\/?>/gi, i18next.t('commonUtilsOther.imagePlaceholder'))
    .replace(/<(source|track)\b[^>]*\/?>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|header|footer|aside|blockquote|pre|tr|table|h[1-6]|ul|ol)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  return decodeRichTextHtmlEntities(normalizedValue)
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const diskSize = (num: number) => {
	if (num == 0) return '0B';
	var k = 1024;
	var sizeStr = ['B','KB','MB','GB','TB','PB','EB','ZB','YB'];
	var l = 0;
	for(let i = 0; i < 8; i++){
	  if(num / Math.pow(k, i) < 1){
      break;
    }
	  l = i; 
	}
  return (num / Math.pow(k, l)).toFixed(0) + sizeStr[l];
}

export const getAllPages = (_structure: NocodeStructure[]) => {
  const pages: NocodeStructure[] = [];
  for (const item of _structure || []) {
    if (item.type === NocodeStructureType.GROUP) {
      pages.push(...getAllPages(item.children));
    } else if (item.type === NocodeStructureType.PAGE) {
      pages.push(item);
    }
  }
  return pages;
}

export const getAllForms = (_structure: NocodeStructure[]) => {
  const forms: NocodeStructure[] = [];
  for (const item of _structure || []) {
    if (item.type === NocodeStructureType.GROUP) {
      forms.push(...getAllForms(item.children));
    } else if (item.type === NocodeStructureType.FORM) {
      forms.push(item);
    }
  }
  return forms;
}

export const getNocodeHomePage = (
  structure: NocodeStructure[] = [],
  homePage?: NocodeHomePageSetting,
): NocodeStructure | undefined => {
  if (!homePage?.enabled || !homePage.nodeId) return;

  for (const item of structure) {
    if (item.disable) continue;
    if (item.id === homePage.nodeId) {
      return item.type === NocodeStructureType.GROUP ? undefined : item;
    }
    const target = getNocodeHomePage(item.children, homePage);
    if (target) return target;
  }
}

export const normalizeNocodeHomePageSetting = (
  structure: NocodeStructure[] = [],
  homePage?: NocodeHomePageSetting,
): NocodeHomePageSetting | undefined => {
  if (homePage?.enabled && !getNocodeHomePage(structure, homePage)) {
    return { enabled: false };
  }
  return homePage;
}

export const getFormElementsInfo = (widgets: WidgetSoul[], path: string[] = []) => {
  const elements: FormElementInfo[] = [];
  for (const item of widgets || []) {
    let name = item?.options?.["title-text"] as string || item.name;
    if (item.type === "widget.form.titleBar") {
      name = (item?.options?.["title-bar-type"] === "image-text-title" ? item?.options?.["main-default-value"] : item?.options?.["text-default-value"]) as string || item.name;
    }
    elements.push({
      type: item.type,
      uid: item.uid,
      name,
      path,
    });
    if (item.widgets) {
      const _elements = getFormElementsInfo(item.widgets, [...path, item.uid]);
      elements.push(..._elements.map(e => ({...e, name: path.length > 3 ? `${name}.${e.name}` : e.name})));
    }
  }
  return elements;
}

export const isAnonymousAccount = (account: Account) => {
  return account?.id === "0";
}

const parseColorChannel = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.endsWith('%')) {
    const percent = Number.parseFloat(normalized.slice(0, -1));
    if (Number.isNaN(percent)) return null;
    return Math.max(0, Math.min(255, Math.round(percent * 2.55)));
  }
  const channel = Number.parseFloat(normalized);
  if (Number.isNaN(channel)) return null;
  return Math.max(0, Math.min(255, Math.round(channel)));
};

const parseColorToRgb = (value?: string) => {
  const color = String(value || "").trim();
  if (!color) {
    return null;
  }

  const hex = color.replace(/^#/, "");
  if (/^[0-9a-fA-F]{3,4}$/.test(hex)) {
    const expanded = hex.slice(0, 3).split("").map(item => `${item}${item}`).join("");
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
    };
  }
  if (/^[0-9a-fA-F]{6,8}$/.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  const channels = color.match(/[\d.]+%?/g);
  if (!channels || channels.length < 3) {
    return null;
  }

  const r = parseColorChannel(channels[0]);
  const g = parseColorChannel(channels[1]);
  const b = parseColorChannel(channels[2]);
  if (r === null || g === null || b === null) {
    return null;
  }
  return { r, g, b };
};

export const isDarkColor = (value?: string, threshold = 160) => {
  const rgb = parseColorToRgb(value);
  if (!rgb) {
    return false;
  }
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness < threshold;
};

export const orMergeTwo = (...permsList: Record<string, any>[]) => {
  const result: Record<string, any> = {};

  for (const perms of permsList) {
    for (const [id, perm] of Object.entries(perms)) {
      if (!result[id]) {
        result[id] = { ...perm };
      } else {
        for (const [key, value] of Object.entries(perm)) {
          if (typeof value === 'boolean') {
            // 如果有一个为 true，结果就为 true
            result[id][key] = result[id][key] || value;
          } else {
            // 非布尔值，后出现的覆盖
            result[id][key] = value;
          }
        }
      }
    }
  }

  return result;
}

export const isMultipleRelated = (field: Field) => {
  if (!field) return false
  const widgetType = field?.meta?.extra?.widgetType
  return widgetType === FormWidgetType.RELATED_DATA && field?.meta?.extra?.relatedDataMode === DataMode.MULTIPLE
}
export const isSubForm = (field: Field) => {
  if (!field) return false
  const widgetType = field?.meta?.extra?.widgetType
  return widgetType === FormWidgetType.SUBFORM
}
const imageFieldArr = [FormWidgetType.IMAGE_UPLOADER, FormWidgetType.HANDWRITTEN_SIGNATURE]
export const isImageField = (field?: Field) => {
  if (!field) return false
  const widgetType = field?.meta?.extra?.widgetType as FormWidgetType
  return imageFieldArr.includes(widgetType)
}

export const hasConfiguredValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (value instanceof Map || value instanceof Set) {
    return value.size > 0
  }

  return value !== undefined && value !== null && value !== ''
}

export const sortByIDArray = (idArr: Array<string>, dataArr: Array<any>, idKey = 'id') => {
  if (isEmpty(idArr)) {
    return dataArr
  }
  // 先创建ID到数据的映射表，提升查找效率
  const dataMap = new Map();
  dataArr.forEach(item => {
    dataMap.set(item[idKey], item);
  });

  // 按照idArr的顺序构建新数组
  const sortedArr = [];
  idArr.forEach(id => {
    const item = dataMap.get(id);
    // 可选：处理arr1中有但arr2中没有的ID
    if (item) {
      sortedArr.push(item);
    } else {
      console.warn(`未找到ID为 ${id} 的数据`);
    }
  });

  return sortedArr;
}
