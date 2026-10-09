import type { Field, Row } from "@common/types/project";
import type { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import i18next from "i18next";
import { _getColumnLetter } from "../formUtil/outputFormat";
import { getField } from "../formUtil";
import { isImageField, isMultipleRelated, isSubForm } from "../other";
import type { FormatRowDataContext } from "./format-row-data";

// 子表单占位符分隔符
export const SubFormCodePartition = '.'
export const SubFormOrderCode = 'order'

export const getColumnLetter = _getColumnLetter

export const regex = /\$\{[^#]*#([^}]*)\}/g;

// 二维码字符串
export const qrcodeStr = 'qrcode=true'
// 条形码字符串
export const barcodeStr = 'barcode=true'
export const imageFillAuto = '_auto'
export const imageFillFixed = '_fixed'
export const getKeyArr = (key: string): string[] => {
  const arr = key.split(SubFormCodePartition);
  const keyArr = []
  const useKey = []
  for (const key of arr) {
    useKey.push(key)
    keyArr.push(useKey.join(SubFormCodePartition))
  }
  return keyArr
}
export const getSize = (key: string): null | { width: number | string, height: number | string } => {
  const regex = /size=([^|}]*)/;
  const matchSize = key.match(regex)
  if (matchSize) {
    let [sizeStr] = matchSize[1].split("_")
    let [width, height] = sizeStr.split('*')
    let numWidth = null
    // 宽度和高度都为数字时，转换为数字类型
    if (width === 'auto') {
      numWidth = width
    } else if (!isNaN(Number(width))) {
      numWidth = Number(width)
    } else {
      numWidth = 30
    }
    let numHeight = null
    // 宽度和高度都为数字时，转换为数字类型
    if (height === 'auto') {
      numHeight = height
    } else if (!isNaN(Number(height))) {
      numHeight = Number(height)
    } else {
      numHeight = 30
    }
    return {
      width: numWidth ?? width,
      height: numHeight ?? height,
    }
  }
  return {
    width: 'auto',
    height: 'auto',
  }
}

const normalizeImageFieldValue = (value: unknown): string[] => {
  const valueArr = Array.isArray(value) ? value : [value]
  return valueArr.map((item) => {
    if (typeof item === 'string') {
      return item
    }
    if (!item || typeof item !== 'object') {
      return ''
    }
    const url = (item as Record<string, unknown>).url ?? (item as Record<string, unknown>).relativePath
    return typeof url === 'string' ? url : ''
  }).filter((item): item is string => Boolean(item))
}

export const getValue = (
  key: string,
  rowData: Row,
  placeholder: string,
  subFormIndex: number = null,
  fields: Field[],
) => {
  const fieldKey = key.split('|')[0]
  const field = getField(fieldKey, fields)
  const isImage = isImageField(field)
  const _getValue = (
    key: string,
    rowData: Row,
    placeholder: string,
    subFormIndex: number = null,
    fields: Field[],
  ) => {
    key = key.split('|')[0]

    // 需要判断当前是否是 多条配置的关联表单 的 子表单
    const judgeRelatedAndSubForm = (key: string) => {
      const keyArr = getKeyArr(key)
      for (let i = 0; i < 2; i++) {
        const key = keyArr[i];
        const field = getField(key, fields)
        if (!field) {
          return false
        }
        if (i === 0) {
          const res = isMultipleRelated(field)
          if (!res) return false
        } else if (i === 1) {
          const res = isSubForm(field)
          if (!res) return false
          return true
        }
      }
    }
    const isHasSubForm = judgeRelatedAndSubForm(key)
    if (isHasSubForm) {
      return i18next.t('commonUtilsOther.notSupportRelFormSubForm')
    }

    const arr = key.split(SubFormCodePartition)
    // 有子表单的情况
    if (arr.length === 2) {
      const [id, key] = arr
      // 子表单序号
      if (key === SubFormOrderCode) {
        return subFormIndex + 1
      }
      let value
      try {
        value = rowData?.[id]?.[subFormIndex ?? 0]?.[key]
      } catch (error) {
        console.log(error)
      }
      if (typeof subFormIndex === 'number') {
        return value ?? (isImage ? [] : '')
      }
      return value ?? (isImage ? [] : placeholder)
    } else if (arr.length === 3) {
      // 关联表单有子表单的情况
      const defaultIndex = 0
      const [relatedId, subFormId, subFormKey] = arr
      if (subFormKey === SubFormOrderCode) {
        return typeof subFormIndex === 'number' ? (subFormIndex + 1) : 1
      }
      let value
      try {
        value = rowData?.[relatedId]?.[defaultIndex]?.[subFormId]?.[subFormIndex ?? 0]?.[subFormKey]
      } catch (error) {
        console.log(error)
      }
      if (typeof subFormIndex === 'number') {
        return value ?? (isImage ? [] : '')
      }
      return value ?? (isImage ? [] : placeholder)
    }

    const value = rowData[key]
    return value ?? (isImage ? [] : placeholder)
  };

  const value = _getValue(key, rowData, placeholder, subFormIndex, fields);
  if (!isImage) {
    return value
  }
  return normalizeImageFieldValue(value)
}

export type GetParser = () => DOMParser
type GetXMLSerializer = () => XMLSerializer

export const fetchPathAsArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch Excel file');
  return await res.arrayBuffer();
}
/**
 * 获取图片的宽度和高度
 * @param buffer 图片的 ArrayBuffer 数据
 * @returns 包含宽度和高度的对象
 */
export const getImageDimensions = async (buffer: ArrayBuffer): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer], { type: 'image/*' }); // 可指定具体类型如 'image/jpeg'
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = img;
      URL.revokeObjectURL(url); // 释放内存
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export interface imageOptions {
  width: number,
  height: number,
  col: number,
  row: number,
  base64?: string | string[],
}
export interface ImageMap {
  // 使用字符串索引签名，表示可以用任何字符串作为键
  [sheetName: string]: imageOptions[];
}

export type ReplaceExcelTemplateOptions = FormatRowDataContext & {
  getDataPath?: () => Promise<string> | string,
  getImageMap?: (imageMap: ImageMap) => void,
  readFile?: (path: string) => Promise<string>,
  getParser?: GetParser,
  getXMLSerializer?: GetXMLSerializer,
  readFileToArrBuffer?: (path: string) => Promise<ArrayBuffer>,
  getImageDimensions?: (buffer: ArrayBuffer) => Promise<{ width: number; height: number }>,
  mergePrint?: boolean,
}
