import * as ExcelJS from "exceljs";
import { Field, Row } from "@common/types/project";
import { AddImageOption, cellLoadImage, getCellFormulaImageId, TemplateImage } from "../excelUtil";
import { isImageField, isMultipleRelated, isNode } from "../../other";
import { barcodeStr, getImageDimensions, getKeyArr, getSize, getValue, imageFillAuto, qrcodeStr, regex, type ReplaceExcelTemplateOptions, SubFormCodePartition } from "../../print/shared";
import { generateBarcode } from "../../print/barcode";
import { areRectanglesIntersecting, base64ToArrayBuffer, fetchUrlToBase64, getAddress, pngBase64ToDataUrl, Rectangle } from "../outputFormat";
import { cloneDeep, memoize } from 'lodash';
import { getField } from "..";
import { printOperator, printTime } from "@common/utils/connection";
import { shouldRenderPrintRowShareQrCode } from "../../print-row-share-fields";


export type RowMerge = {
  address?: string
  left: number
  top: number
  right: number
  bottom: number
  // 子表单数据条数
  subNum: number
  // 是否是单个单元格
  isSingleCell?: boolean
}
type RangeObject<T> = {
  start: number
  end: number
  value: T
}
type GetRangeValue<T> = {
  start: number
  end: number
  value: T
  index: number
}
export class RangeMap<T> {
  // 按 start 升序排列的区间列表
  private ranges: RangeObject<T>[] = [];

  addRange(start: number, end: number, value: T): void {
    if (start > end) throw new Error('Invalid range: start > end');
    
    let i = 0;
    while (i < this.ranges.length && this.ranges[i].end < start) i++;
    
    let j = i;
    while (j < this.ranges.length && this.ranges[j].start <= end) j++;
    
    let newStart = start;
    let newEnd = end;
    
    for (let k = i; k < j; k++) {
      newStart = Math.min(newStart, this.ranges[k].start);
      newEnd = Math.max(newEnd, this.ranges[k].end);
    }
    
    const newRange = { start: newStart, end: newEnd, value };
    this.ranges = [
      ...this.ranges.slice(0, i),
      newRange,
      ...this.ranges.slice(j),
    ];
  }
  // 查询 key 所在区间对应的值
  getValue(key: number): T | void {
    // 二分查找：找到最大的 start <= key
    let low = 0;
    let high = this.ranges.length - 1;
    let candidateIndex = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.ranges[mid].start <= key) {
        candidateIndex = mid; // 可能的候选
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (candidateIndex === -1) {
      return void 0; // 没有 start <= key 的区间
    }

    const candidate = this.ranges[candidateIndex];
    if (key <= candidate.end) {
      return candidate.value; // key ∈ [start, end]
    }

    return void 0; // 虽然 start <= key，但 key > end，不匹配
  }
  getRange(key: number): GetRangeValue<T> | void {
    // 二分查找：找到最大的 start <= key
    let low = 0;
    let high = this.ranges.length - 1;
    let candidateIndex = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.ranges[mid].start <= key) {
        candidateIndex = mid; // 可能的候选
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (candidateIndex === -1) {
      return void 0; // 没有 start <= key 的区间
    }

    const candidate = this.ranges[candidateIndex];
    if (key <= candidate.end) {
      return {
        start: candidate.start,
        end: candidate.end, 
        value: candidate.value,
        index: candidateIndex,
      };
    }

    return void 0; // 虽然 start <= key，但 key > end，不匹配
  }
  forEach(callback: (value: T, start: number, end: number, index: number) => void) {
    this.ranges.forEach(({ start, end, value }, index) => {
      callback(value, start, end, index)
    })
  }
  getFirstValue() {
    return this.ranges[0]
  }
}
// 获取模板中最大的子表单数量
export const getMaxSubNum = (
  template: string,
  rowData: Row,
  fields: Field[],
) => {
  let maxsubRow = 1
  template.replace(regex, (match, key: string) => {
    const keyArr = getKeyArr(key)
    for (const key of keyArr) {
      const field = getField(key, fields)
      if (!field) {
        continue;
      }
      const res = judgeField(field)
      if (res) {
        const arr = key.split(SubFormCodePartition)

        // 有子表单的情况
        if (arr.length === 1) {
          const [id] = arr
          const subFormArr = rowData?.[id]
          if (Array.isArray(subFormArr) && subFormArr?.length) {
            maxsubRow = Math.max(maxsubRow, subFormArr.length)
          }
        } else if (arr.length === 2) {
          const [id, key] = arr
          const subFormArr = rowData?.[id]
          if (Array.isArray(subFormArr) && subFormArr?.length) {
            maxsubRow = Math.max(maxsubRow, subFormArr.length)
          }
        } else if (arr.length === 3) {
          const [relatedId, subFormId, subFormKey] = arr
          const defaultIndex = 0
          const subFormArr = rowData?.[relatedId]?.[defaultIndex]?.[subFormId]
          if (Array.isArray(subFormArr) && subFormArr?.length) {
            maxsubRow = Math.max(maxsubRow, subFormArr.length)
          }
        }
        return match
      }
    }

  })
  return maxsubRow
}
const copyCellToCell = (sourceCell: ExcelJS.Cell, targetCell: ExcelJS.Cell) => {
  targetCell.value = cloneDeep(sourceCell.value)
  if (sourceCell.style) {
    targetCell.style = cloneDeep(sourceCell.style)
  }
  if (sourceCell.note !== 'string') {
    targetCell.note = cloneDeep(sourceCell.note)
  }
}
// 判断字段是否可以扩列
export const judgeField = (field: Field) => {
  const widgetType = field.meta?.extra?.widgetType
  const judgeMap = {
    'widget.form.relatedData': () => {
      const isMultiple = isMultipleRelated(field)
      if (isMultiple) return true
    },
    'widget.form.subform': () => true
  }
  const judge = judgeMap[widgetType]
  if (judge) {
    const res = judge()
    if (res) return true
  }
}
export const isHasSubForm = (template: string, fields: Field[],): boolean => {
  // 使用exec方法替代replace，避免不必要的字符串替换操作
  let match;
  // 重置正则表达式的lastIndex确保从头开始匹配
  regex.lastIndex = 0;

  const _isHasSubFormByKeyArr = (keyArr: string[], fields: Field[]) => {
    for (const key of keyArr) {
      const field = getField(key, fields)
      if (!field) {
        continue;
      }
      const res = judgeField(field)
      if (res) return true
    }
    return false
  }
  while ((match = regex.exec(template)) !== null) {
    const key = match[1];
    const keyArr = getKeyArr(key)
    
    const res = _isHasSubFormByKeyArr(keyArr, fields)
    if (res) return true
  }
  
  return false; // 未找到符合条件的子表单
}
// 判断模板中是否有代码
export const isHasCode = (template: string, fields: Field[],): boolean => {
  // 使用exec方法替代replace，避免不必要的字符串替换操作
  let match;
  // 重置正则表达式的lastIndex确保从头开始匹配
  regex.lastIndex = 0;

  const _isHasCodeByKeyArr = (keyArr: string[], fields: Field[]) => {
    for (const key of keyArr) {
      if ([printOperator, printTime].includes(key)) return true
      const field = getField(key, fields)
      if (!field) {
        continue;
      }
      return true
    }
    return false
  }
  while ((match = regex.exec(template)) !== null) {
    const key = match[1];
    const keyArr = getKeyArr(key)

    const res = _isHasCodeByKeyArr(keyArr, fields)
    if (res) return true
  }

  return false; // 未找到符合条件的子表单
}
export type TemplateCodeRenderMode = "plain" | "loop" | "summary";

const isAggregateMetricField = (field?: Field | null) => {
  return Boolean(field?.meta?.extra?.isAggregateMetric || field?.meta?.extra?.tableAggregateField)
}

export const getTemplateCodeRenderMode = (
  template: string,
  fields: Field[] = [],
): TemplateCodeRenderMode => {
  let hasCode = false
  let hasAggregateMetric = false
  let match
  regex.lastIndex = 0

  while ((match = regex.exec(template)) !== null) {
    const key = String(match[1] || "")
    const keyArr = getKeyArr(key)
    let matchedField: Field | null = null

    for (const currentKey of keyArr) {
      if ([printOperator, printTime].includes(currentKey)) {
        hasCode = true
        break
      }
      const field = getField(currentKey, fields)
      if (!field) {
        continue
      }
      hasCode = true
      matchedField = field
      break
    }

    if (!matchedField) {
      continue
    }
    if (!isAggregateMetricField(matchedField)) {
      return "loop"
    }
    hasAggregateMetric = true
  }

  if (!hasCode) return "plain"
  return hasAggregateMetric ? "summary" : "plain"
}

const cellHasValue = (cell: ExcelJS.Cell) => {
  return cell.value !== undefined && cell.value !== null || cell.formula
}
const addressToRectangle = (addressRectangle: string) => {
  const [left, right] = addressRectangle.split(':')
  const { col: leftCol, row: topRow } = addressToColRow(left)
  const { col: rightCol, row: bottomRow } = addressToColRow(right)
  if (!leftCol || !topRow || !rightCol || !bottomRow) return null
  return { left: leftCol, top: topRow, right: rightCol, bottom: bottomRow }
}
// 判断某一个单元格是否在某一个矩形内容
const isCellInRectangle = (cell: { col: number, row: number }, rectangle: Rectangle): boolean => {
  const { left, top, right, bottom } = rectangle
  const { col: cellCol, row: cellRow } = cell
  return cellCol >= left && cellCol <= right && cellRow >= top && cellRow <= bottom
}
const addressToColRow = (address: string) => {
  const regex = /^([A-Z]+)(\d+)$/
  const match = address.match(regex)
  if (!match) return null
  const col = match[1].toUpperCase().split('').reduce((acc, cur) => acc * 26 + (cur.charCodeAt(0) - 'A'.charCodeAt(0) + 1), 0)
  const row = parseInt(match[2])
  return { col, row }
}
const isCellInRectangleByAddress = (address: string, rectangle: string | string[]) => {
  const { col, row } = addressToColRow(address)
  if (!col || !row) return false
  const rectangleArr = Array.isArray(rectangle) ? rectangle : [rectangle]
  for (const item of rectangleArr) {
    const { left, top, right, bottom } = addressToRectangle(item)
    if (isCellInRectangle({ col, row }, { left, top, right, bottom })) return true
  }
  return false
}

const replaceQrcodeCell = async (
  replaceValue: string,
  size: null | { width: number | string, height: number | string } = null,
) => {
  const { width = 20, height = 20 } = size ?? {}
  const NumberWidth = Number(width)
  const NumberHeight = Number(height)
  let base64 = await generateBarcode({
    bcid: 'qrcode',
    text: replaceValue,
    width: Number.isNaN(NumberWidth) ? 20 : NumberWidth,
    height: Number.isNaN(NumberHeight) ? 20 : NumberHeight,
  }, 'base64')
  if (base64 && typeof base64 === 'string') {
    base64 = pngBase64ToDataUrl(base64)
  }
  return {
    base64,
  }
}
const replaceBarcodeCell = async (
  replaceValue: string,
  size: null | { width: number | string, height: number | string } = null,
) => {
  const { width = 20, height = 20 } = size ?? {}
  const NumberWidth = Number(width)
  const NumberHeight = Number(height)
  let base64 = await generateBarcode({
    bcid: 'code128',
    text: replaceValue,
    width: Number.isNaN(NumberWidth) ? 30 : NumberWidth,
    height: Number.isNaN(NumberHeight) ? 20 : NumberHeight,
  }, 'base64')
  if (base64 && typeof base64 === 'string') {
    base64 = pngBase64ToDataUrl(base64)
  }
  return {
    base64,
  }
}

/**
 * 替换字符串中所有形如 ${key} 的占位符
 * @param template 模板
 * @param rowData 数据
 * @param subFormIndex 第几条子表单，如果没有使用第0条
 * @returns 替换后的字符串
 */
function replaceTemplatePlaceholders(
  template: string,
  rowData: Row,
  subFormIndex: number = null,
  fields: Field[],
): string {
  if (!template) return ''

  const str = template.replace(regex, (match, key: string) => {
    key = key.split('|')[0]
    return getValue(key, rowData, match,  subFormIndex, fields)
  });

  return str
}

const replaceRichTextPlaceholders = (
  richText: ExcelJS.RichText[],
  replaceText: (text: string) => string | undefined,
) => {
  const sourceText = richText.map(item => item.text).join('')
  const placeholderRegex = new RegExp(regex.source, regex.flags)
  const matches = Array.from(sourceText.matchAll(placeholderRegex))

  if (!matches.length) {
    return richText.map(item => ({
      ...item,
      text: replaceText(item.text),
    }))
  }

  const runs = richText.map(item => ({ ...item }))
  const runRanges = []
  let offset = 0
  for (const run of runs) {
    const start = offset
    offset += run.text.length
    runRanges.push({ start, end: offset })
  }

  // Match against the complete cell text, then write each replacement back to its source runs.
  for (const match of matches.reverse()) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const overlappingIndexes = runRanges
      .map((range, index) => ({ range, index }))
      .filter(({ range }) => range.start < end && range.end > start)
      .map(({ index }) => index)
    if (!overlappingIndexes.length) continue

    const styledRunIndex = overlappingIndexes.find(index => Object.keys(runs[index]).some(key => key !== 'text'))
    const replacementRunIndex = styledRunIndex ?? overlappingIndexes[0]
    const replacement = replaceText(match[0])
    const replacementText = typeof replacement === 'string' ? replacement : ''

    for (const index of overlappingIndexes) {
      const range = runRanges[index]
      const run = runs[index]
      const localStart = Math.max(start, range.start) - range.start
      const localEnd = Math.min(end, range.end) - range.start
      const prefix = run.text.slice(0, localStart)
      const suffix = run.text.slice(localEnd)
      run.text = prefix + (index === replacementRunIndex ? replacementText : '') + suffix
    }
  }

  return runs.filter(item => item.text.length > 0)
}

export type TemplateLoadDataOption = {
  fields?: Field[],
  excelImageMap?: TemplateImage,
  imageMap?: object,
  options: ReplaceExcelTemplateOptions,
}

export type TemplateSheetLoadDataOption = {
  workbook: ExcelJS.Workbook,
} & TemplateLoadDataOption

export const _renderSheetLoadData = async (
  worksheet: ExcelJS.Worksheet,
  data: Row,
  templateSheetLoadDataOption: TemplateSheetLoadDataOption,
) => {
  const { fields, excelImageMap, imageMap, workbook, options } = templateSheetLoadDataOption
  const imageIdArrPromise = [];
  const addImageOption: AddImageOption[] = [];
  /**
   * 记录已经合并的单元格
   */
  const merges = (worksheet as any)._merges;
  const hasMergesArr = [];
  const mergesKeys = Object.keys(merges);
  const isSubFormCell = (cell: ExcelJS.Cell) => {
    return (
      cell.value &&
      typeof cell.value === "string" &&
      isHasSubForm(cell.value, fields)
    );
  };
  mergesKeys.forEach((key) => {
    const item = merges[key];
    const { top, left, bottom, right } = item.model;
    const cell = worksheet.getCell(`${getAddress(left, top)}`);
    const isSubForm = isSubFormCell(cell);
    hasMergesArr.push({
      isSubForm,
      address: `${getAddress(left, top)}:${getAddress(right, bottom)}`,
      left,
      top,
      right,
      bottom,
    });
  });
  const subRowMap = new RangeMap<RangeMap<RowMerge>>();
  // 是有子表单数据
  const subFormMergeKeys = [];
  mergesKeys.forEach((address) => {
    const cell = worksheet.getCell(address);
    if (cell.isMerged && isSubFormCell(cell)) {
      const subNum = getMaxSubNum(cell.value as string, data, fields);
      const item = merges[address];
      const { top, left, bottom, right } = item.model;
      subFormMergeKeys.push({ address, top, left, bottom, right, subNum });
    }
  });
  for (let i = 0; i < subFormMergeKeys.length; i++) {
    const subFormMerge1 = subFormMergeKeys[i];
    let value =
      subRowMap.getValue(subFormMerge1.top) ||
      subRowMap.getValue(subFormMerge1.bottom);
    if (!value) {
      value = new RangeMap<RowMerge>();
    }
    value.addRange(subFormMerge1.left, subFormMerge1.right, subFormMerge1);
    subRowMap.addRange(subFormMerge1.top, subFormMerge1.bottom, value);
  }

  // 循环所有单元格内容找到有子表单数据的单元格添加到对应的rMap中
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      if (isSubFormCell(cell)) {
        const subNum = getMaxSubNum(cell.value as string, data, fields);
        const rowMergeValue = subRowMap.getValue(rowNumber);
        if (!rowMergeValue) {
          const colMerge = new RangeMap<RowMerge>();
          colMerge.addRange(colNumber, colNumber, {
            address: cell.address,
            top: rowNumber,
            bottom: rowNumber,
            left: colNumber,
            right: colNumber,
            subNum,
            isSingleCell: true,
          });
          subRowMap.addRange(rowNumber, rowNumber, colMerge);
        } else {
          const colMerge = rowMergeValue?.getValue(colNumber);
          if (!colMerge) {
            rowMergeValue.addRange(colNumber, colNumber, {
              top: rowNumber,
              bottom: rowNumber,
              left: colNumber,
              right: colNumber,
              subNum,
            });
          }
        }
      }
    });
  });

  // 拆分所有单元格
  mergesKeys.forEach((key) => {
    worksheet.unMergeCells(key);
  });

  // rMap 已经得到所有有子表单的单元格合并信息，并且已经成功有了小行的概念
  const copyMergesMap = {};
  let accumulatorCopyNum = 0;
  const bigRowMap = new RangeMap<RangeMap<RangeMap<RowMerge>>>();
  subRowMap.forEach((rowMap, start, end) => {
    const rowRangeMap = new RangeMap<RangeMap<RowMerge>>();
    // 当前行要复制的数量
    let maxSubNum = 0;
    // 当前行的高度
    const height = end - start + 1;
    rowMap.forEach((colMap) => {
      const { subNum } = colMap;
      maxSubNum = Math.max(maxSubNum, subNum);
    });
    const copySubNum = maxSubNum - 1;
    const copyNum = copySubNum * height;
    worksheet.duplicateRow(end + accumulatorCopyNum, copyNum, true);
    for (let i = 0; i < maxSubNum; i++) {
      const colRangeMap = new RangeMap<RowMerge>();
      const iHeight = height * i;
      rowMap.forEach((colMap) => {
        const { left, right, top, bottom, subNum } = colMap;
        const newTop = top + iHeight + accumulatorCopyNum;
        const newBottom = bottom + iHeight + accumulatorCopyNum;
        const newColMap = {
          left,
          right,
          top: newTop,
          bottom: newBottom,
          subNum,
        };
        const address = getAddress(left, newTop);
        copyMergesMap[address] = {
          address: `${getAddress(left, newTop)}:${getAddress(
            right,
            newBottom
          )}`,
          left,
          top: newTop,
          right,
          bottom: newBottom,
          subNum,
        };

        colRangeMap.addRange(left, right, newColMap);
      });
      const rowTop = start + accumulatorCopyNum + iHeight;
      const rowBottom = end + accumulatorCopyNum + iHeight;
      rowRangeMap.addRange(rowTop, rowBottom, colRangeMap);
    }

    const bigTop = start + accumulatorCopyNum;
    const bigBottom = end + accumulatorCopyNum + copyNum;
    bigRowMap.addRange(bigTop, bigBottom, rowRangeMap);

    hasMergesArr.forEach((item, index) => {
      let { left, top, right, bottom, isSubForm } = item;
      if (top > end + accumulatorCopyNum) {
        top = top + copyNum;
        bottom = bottom + copyNum;
      }
      hasMergesArr[index] = {
        isSubForm,
        left,
        top,
        right,
        bottom,
      };
    });
    accumulatorCopyNum += copyNum;
  });
  hasMergesArr.forEach((item, index) => {
    const { left, top, right, bottom, isSubForm } = item;
    if (isSubForm) {
      return;
    }
    const bigRowMerge = bigRowMap.getRange(top) || bigRowMap.getRange(bottom);
    if (bigRowMerge) {
      const bigRowMergeHeight = bigRowMerge.end - bigRowMerge.start + 1;

      const bigRowMergeValue = bigRowMerge.value;
      const bigColMerge =
        bigRowMergeValue.getRange(top) || bigRowMergeValue.getRange(bottom);
      if (bigColMerge) {
        const moveHeight =
          bigRowMergeHeight - (bigColMerge.end - bigColMerge.start + 1);
        hasMergesArr[index] = {
          isSubForm,
          left,
          top,
          right,
          bottom: bottom + moveHeight,
        };
      }
    }
  });

  const hasMergesAddress = hasMergesArr.map(
    (item) =>
      `${getAddress(item.left, item.top)}:${getAddress(
        item.right,
        item.bottom
      )}`
  );
  const mergeArr = [];
  // 额外复制单元格填充内容
  bigRowMap.forEach((bigRowMap, start, end) => {
    const getTemplateRow = (top: number, bottom: number) => {
      const templateRow: ExcelJS.Row[] = [];
      for (let i = top; i <= bottom; i++) {
        templateRow.push(worksheet.getRow(i));
      }
      return templateRow;
    };
    const bigRowHeight = end - start + 1;
    // 模板行范围
    const templateRowRangeMap = bigRowMap.getFirstValue();
    const top = templateRowRangeMap.start;
    const bottom = templateRowRangeMap.end;
    // 模板行
    const templateRow: ExcelJS.Row[] = getTemplateRow(top, bottom);

    bigRowMap.forEach((rowRangeMap, top, bottom, index) => {
      if (index === 0) return;
      const rowArr = getTemplateRow(top, bottom);
      rowArr.forEach((row, index) => {
        const templateR = templateRow[index];
        templateR.eachCell((templateCell, colNumber) => {
          const targetCell = row.getCell(colNumber);
          copyCellToCell(templateCell, targetCell);
        });
      });
    });

    const templateRowHeight = bottom - top + 1;
    const addHeight = bigRowHeight - templateRowHeight;
    const templateRowFirst = templateRow[0];
    templateRowFirst.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (!cellHasValue(cell)) {
        // 判断模板的其他列有没有值
        const colHasValue = templateRow.some((row, index) => {
          if (index === 0) return false;
          const cell = row.getCell(colNumber);
          if (cellHasValue(cell)) {
            return true;
          }
          return false;
        });
        if (!colHasValue) return;
      }
      const colMerge = templateRowRangeMap.value.getRange(colNumber);
      const address = cell.address;
      const { col, row } = addressToColRow(address);
      const isMerge = isCellInRectangleByAddress(address, hasMergesAddress);
      if (!colMerge && !isMerge) {
        // 找一找模板行的这一列有没有内容
        mergeArr.push({
          top: row,
          bottom: row + addHeight,
          left: col,
          right: col,
        });
      }
    });
  });

  hasMergesArr.push(...Object.values(copyMergesMap));
  worksheet.eachRow((row, rowNumber) => {
    let currentSubRow = null;
    // 大行
    const bigRowRangeMap = bigRowMap.getRange(rowNumber);
    let rowRangeMap: GetRangeValue<RangeMap<RowMerge>> | void, height;
    if (bigRowRangeMap) {
      // 单行
      rowRangeMap = bigRowRangeMap?.value?.getRange(rowNumber);
      if (rowRangeMap) {
        currentSubRow = rowRangeMap.index;
      }
    }

    row.eachCell((cell, colNumber) => {
      const replaceText = (text: string) => {
        // 字符串第一个符合 ${key} 格式的占位符
        const qrcodeKey = regex.exec(text)?.[1] ?? regex.exec(text)?.['1'] ?? "";
        const file = getField(qrcodeKey, fields);
        const fieldValue = getValue(qrcodeKey, data, text, currentSubRow, fields) as string | string[];
        const imageValue = Array.isArray(fieldValue) ? fieldValue : [];
        const textValue = typeof fieldValue === 'string' ? fieldValue : '';
        const size = getSize(qrcodeKey);
        let isQrcode = qrcodeKey.includes(qrcodeStr);
        let isBarcode = qrcodeKey.includes(barcodeStr);
        
        const isImage = isImageField(file);
        if (imageValue.length > 0 && isImage) {
          const promise = async (imageValue: string[]) => {
            const getDataPath =
              options?.getDataPath ??
              (() => {
                if (window) {
                  return window.location.origin;
                }
                return "";
              });
            const userDataPath = await getDataPath();
            const getPath = (userDataPath: string, url: string) => {
              if (isNode) {
                return `${userDataPath.replace(/\\/g, "/")}/${url}`;
                } else if (window) {
                  return `${userDataPath}/${url}`;
                }
              };
            const urlArr = imageValue
              .map((item) => getPath(userDataPath, item))
              .filter((item): item is string => Boolean(item));
            const imageBase64Arr = [];
            const imageDimensionArr = [];
            for (const url of urlArr) {
              const base64 =
                (await options?.readFile?.(url)) ??
                (await fetchUrlToBase64(url));
              const buffer = base64ToArrayBuffer(base64) as ArrayBuffer;
              const dimension =
                (await options?.getImageDimensions?.(buffer)) ??
                (await getImageDimensions(buffer));
              imageBase64Arr.push(base64);
              imageDimensionArr.push(dimension);
            }
            return {
              base64: imageBase64Arr,
              base64Dimension: imageDimensionArr,
            };
          };
          imageIdArrPromise.push(promise(imageValue));
          addImageOption.push({
            isImage: true,
            width: size?.width === 'auto' ? 'auto' : Number(size?.width),
            height: size?.height === 'auto' ? 'auto' : Number(size?.height),
            imageFillType: qrcodeKey.includes(imageFillAuto) ? 'auto' : 'fixed',
            col: colNumber,
            row: rowNumber,
            worksheet,
            workbook,
          });
          return text;
        } else if (textValue && isQrcode && shouldRenderPrintRowShareQrCode(textValue)) {
          imageIdArrPromise.push(replaceQrcodeCell(textValue, size));
          addImageOption.push({
            width: typeof size?.width === "number" ? size?.width : 30,
            height: typeof size?.height === "number" ? size?.height : 30,
            col: colNumber,
            row: rowNumber,
            worksheet,
            workbook,
          });
          return text;
        } else if (textValue && isBarcode) {
          imageIdArrPromise.push(replaceBarcodeCell(textValue, size));
          addImageOption.push({
            width: typeof size?.width === "number" ? size?.width : 40,
            height: typeof size?.height === "number" ? size?.height : 30,
            col: colNumber,
            row: rowNumber,
            worksheet,
            workbook,
          });
        } else {
          return replaceTemplatePlaceholders(text, data, currentSubRow, fields);
        }
      };
      // 🔍 读取原值
      if (typeof cell.value === "string") {
        cell.value = replaceText(cell.value);
      } else if (Array.isArray((cell.value as any)?.richText)) {
        (cell.value as any).richText = replaceRichTextPlaceholders(
          (cell.value as any).richText,
          replaceText,
        );
      } else if (
        excelImageMap &&
        typeof (cell.value as any)?.formula === "string" &&
        (cell.value as any)?.formula.includes("DISPIMG")
      ) {
        const dispimgId = getCellFormulaImageId((cell.value as any)?.formula);
        if (dispimgId && excelImageMap[dispimgId]) {
          const templateImage = excelImageMap[dispimgId];
          imageIdArrPromise.push(
            Promise.resolve({
              base64: templateImage.base64,
            })
          );
          const { width, height } = templateImage.dimensions.toPixels(27);

          addImageOption.push({
            width: width,
            height: height,
            col: colNumber,
            row: rowNumber,
            worksheet,
            workbook,
          });
        }
      }
    });
  });
  // 需要对比 hasMergesArr 和 mergeArr 是否有有交集，有则需要合并的单元格
  if (mergeArr.length === 0) {
    mergeArr.push(null);
  }
  const mergeMergeArr = new Set<string>();
  mergeArr.forEach((item) => {
    let left = item?.left ?? 1;
    let top = item?.top ?? 1;
    let right = item?.right ?? 1;
    let bottom = item?.bottom ?? 1;
    let hasMerge = false;
    hasMergesArr.forEach((hasItem) => {
      const {
        left: hasLeft,
        top: hasTop,
        right: hasRight,
        bottom: hasBottom,
      } = hasItem;

      const isMerge = item ? areRectanglesIntersecting(item, hasItem) : false;
      if (isMerge) {
        hasMerge = true;
        mergeMergeArr.add(
          `${getAddress(
            Math.min(left, hasLeft),
            Math.min(top, hasTop)
          )}:${getAddress(
            Math.max(right, hasRight),
            Math.max(bottom, hasBottom)
          )}`
        );
      } else {
        const address = `${getAddress(hasLeft, hasTop)}:${getAddress(
          hasRight,
          hasBottom
        )}`;
        mergeMergeArr.add(address);
      }
    });
    if (item && !hasMerge) {
      mergeMergeArr.add(
        `${getAddress(left, top)}:${getAddress(right, bottom)}`
      );
    }
  });
  mergeMergeArr.forEach((item) => {
    worksheet.mergeCells(item);
  });

  const imageIdArr = await Promise.all(imageIdArrPromise);
  for (let i = 0; i < imageIdArr.length; i++) {
    const { base64, base64Dimension } = imageIdArr[i];
    let {
      width,
      height,
      worksheet,
      col,
      row,
      workbook,
      isImage = false,
      imageFillType = 'auto',
    } = addImageOption[i];

    cellLoadImage({
      isImage,
      width,
      height,
      imageFillType,
      col,
      row,
      worksheet,
      workbook,
      base64,
      base64Dimension,
    });
  }

  return {
    worksheet,
    imageIdArrPromise,
    addImageOption,
  }
}
// 加载数据
export const _templateLoadData = async (
  workbook: ExcelJS.Workbook,
  data: Row,
  dataIndex: number,
  templateLoadDataOption: TemplateLoadDataOption,
) => {
  const { fields, excelImageMap, imageMap, options } = templateLoadDataOption
  // 加载所有二维码图片
  const imageIdArrPromise = [];

  const addImageOption: AddImageOption[] = [];
  const worksheets = workbook.worksheets;
  for (let i = 0; i < worksheets.length; i++) {
    const worksheet = worksheets[i];
    const { imageIdArrPromise: sheetImageIdArrPromise, addImageOption: sheetAddImageOption } = await _renderSheetLoadData(worksheet, data, {
      ...templateLoadDataOption,
      workbook,
    })
    imageIdArrPromise.push(...sheetImageIdArrPromise);
    addImageOption.push(...sheetAddImageOption);
  }

  const imageIdArr = await Promise.all(imageIdArrPromise);
  for (let i = 0; i < imageIdArr.length; i++) {
    const { base64, base64Dimension } = imageIdArr[i];
    let {
      width,
      height,
      worksheet,
      col,
      row,
      workbook,
      isImage = false,
      imageFillType = 'auto',
    } = addImageOption[i];
    if (!Array.isArray(imageMap[dataIndex][worksheet.name])) {
      imageMap[dataIndex][worksheet.name] = [];
    }
    imageMap[dataIndex][worksheet.name].push({
      isImage,
      width,
      height,
      col,
      row,
      base64,
      base64Dimension,
      imageFillType,
    });
  }

  return workbook;
};
