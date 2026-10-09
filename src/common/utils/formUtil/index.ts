import { Field, Row } from "@common/types/project";
import type { ImageFillType } from "./excelUtil";
import { memoize } from 'lodash';

export const isNumber = v => typeof v === 'number' && !isNaN(v)

type ProportionWHOptions = {
  defaultWidth?: number,
  defaultHeight?: number,
  // 适应方式
  imageFillType?: ImageFillType,
}
/**
 * 按比例得到宽度或者高度
 * @param size 原始宽度和高度
 * @param proportion 缩放比例
 * @returns 按比例缩放后的宽度和高度
 */
export const proportionWH = (
  size: null | { width: number | string, height: number | string },
  proportion: null | { width: number, height: number },
  options: ProportionWHOptions = {},
) => {
  if (!size || !proportion) {
    return null
  }
  let { width, height } = size
  const { width: proportionWidth, height: proportionHeight } = proportion

  if (isNumber(width) && isNumber(height)) {
    if (options?.imageFillType === 'auto') {
      // 宽度和高度需要按照比例，并且不超过width和height

      const proportionScale = proportionWidth / proportionHeight;
      const whScale = (width as number) / (height as number);
      // 取更大的缩放比例，确保不超出任一边界
      if (proportionScale > whScale) {
        return {
          width,
          height: proportionHeight * ((width as number) / proportionWidth),
        }
      }
      // 取更小的缩放比例，确保不超出任一边界
      return {
        width: proportionWidth * ((height as number) / proportionHeight),
        height,
      }
    }

    return {
      width,
      height,
    }
  }
  if (isNumber(width)) {
    return {
      width,
      height: width as number * proportionHeight / proportionWidth,
    }
  }
  if (isNumber(height)) {
    return {
      width: height as number * proportionWidth / proportionHeight,
      height,
    }
  }
  if (isNumber(options?.defaultWidth)) {
    return {
      width: options.defaultWidth,
      height: options.defaultWidth * proportionHeight / proportionWidth,
    }
  }
  if (isNumber(options?.defaultHeight)) {
    return {
      width: options.defaultHeight * proportionWidth / proportionHeight,
      height: options.defaultHeight,
    }
  }
  return {
    width: 30,
    height: 30 * proportionHeight / proportionWidth,
  }
}

export const getField = (key: string, fields: Field[]) => {
  if (!key || !Array.isArray(fields)) {
    return null
  }
  key = key.split('|')[0]
  const arr = key.split('.')
  if (arr.length === 1) {
    return fields.find(item => item.uid === arr[0])
  } else if (arr.length === 2) {
    const [fileUid, subFileUid] = arr
    const file = fields.find(item => item.uid === fileUid)
    if (!file) {
      return null
    }
    // 有子表单的情况
    if (Array.isArray(file.subTableFields)) {
      return file.subTableFields.find(item => item.uid === subFileUid)
    }
    if (Array.isArray(file.relatedTableFields)) {
      return file.relatedTableFields.find(item => item.uid === subFileUid)
    }

    return file
  } else if (arr.length === 3) {
    const [fileUid, relatedTableUid, subFileUid] = arr
    const file = fields.find(item => item.uid === fileUid)
    if (!file) {
      return null
    }
    // 有子表单的情况
    if (Array.isArray(file.relatedTableFields)) {
      const relatedField = file.relatedTableFields.find(item => item.uid === relatedTableUid)
      if (!Array.isArray(relatedField?.subTableFields)) {
        return null
      }
      return relatedField.subTableFields.find(item => item.uid === subFileUid)
    }
  }
}
