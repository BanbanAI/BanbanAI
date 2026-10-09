import { PrintTemplateMode, PrintTemplateType } from "@common/types/nocode";
import type { PrintTemplate } from "@common/types/nocode";
import type { Field, Row } from "@common/types/project";
import * as ExcelJS from "exceljs";
import { isEmpty } from "@common/utils/object";
import { _templateLoadData } from "../formUtil/excelTemplateLoadData/excelTemplateLoadData";
import { _templateLoadDatas } from "../formUtil/excelTemplateLoadData/excelTemplateLoadDatas";
import { AddImageOption, cellLoadImage, extractImagesFromXlsx, setWorkSheetSetByWorkSheet } from "../formUtil/excelUtil";
import { formatRowData } from "./format-row-data";
import type { ImageMap, ReplaceExcelTemplateOptions } from "./shared";

// excel 内置默认样式
const EXCEL_BUILTIN_DEFAULT_STYLE = {
  font: {
    name: 'Calibri',
    size: 11,
    color: { argb: '#333333' },
    bold: false,
    italic: false,
    underline: false,
    strike: false,
  },
  fill: {
    pattern: "none",
    type:"pattern"
  }, // 无填充
  border: {}, // 无边框
  alignment: {
    indent: 0,
    textRotation: 0,
  },
  numFmt: 'General',
  protection: {
    locked: true,
    hidden: false,
  },
};

export const replaceExcelTemplate = async (
  template: PrintTemplate,
  templateBuffer: ArrayBuffer,
  rowData: Row[],
  fields?: Field[],
  options?: ReplaceExcelTemplateOptions,
): Promise<ExcelJS.Workbook[] | Error> => {
  if (isEmpty(rowData)) {
    throw new Error('data is empty')
  }
  try {
    if (template.type !== PrintTemplateType.EXCEL) {
      throw new Error('template math a excel file')
    }
    if (!Array.isArray(fields)) {
      fields = []
    }
    
    // 格式化数据
    rowData = formatRowData(rowData, fields, {
      formOptions: options?.formOptions,
      formTableUID: options?.formTableUID,
    })
    /**
     * [key] 第几个数据
     * [key2] sheetId
     * imageMap[key][key2] 是对象有 图片的数据 添加单元格的位置
     */
    const imageMap = {}
    // 添加图片的选项

    const excelImageMap = await extractImagesFromXlsx(templateBuffer, options?.getParser)
    // 加载默认样式
    const _loadDefaultStyle = (workbook: ExcelJS.Workbook,) => {
      workbook.eachSheet((worksheet, sheetId) => {
        worksheet.eachRow((row, rowNumber) => {
          row.eachCell((cell, colNumber) => {
            if (cell.isMerged && !cell.style?.alignment?.horizontal) {
              // 如果没有设置文字，默认居中
              cell.style.alignment = { ...EXCEL_BUILTIN_DEFAULT_STYLE.alignment, ...cell.style.alignment, horizontal: 'center' }
            } else if (typeof cell.value === 'number' && !cell.style?.alignment?.horizontal) {
              cell.style.alignment = { ...EXCEL_BUILTIN_DEFAULT_STYLE.alignment, ...cell.style.alignment, horizontal: 'right' }
            }
            
            if (cell.style) {
              cell.style = {
                font: { ...EXCEL_BUILTIN_DEFAULT_STYLE.font, ...cell.style.font },
                fill: { ...EXCEL_BUILTIN_DEFAULT_STYLE.fill, ...cell.style.fill },
                border: { ...EXCEL_BUILTIN_DEFAULT_STYLE.border, ...cell.style.border },
                alignment: { ...EXCEL_BUILTIN_DEFAULT_STYLE.alignment, ...cell.style.alignment },
                numFmt: cell.style.numFmt || EXCEL_BUILTIN_DEFAULT_STYLE.numFmt,
                protection: { ...EXCEL_BUILTIN_DEFAULT_STYLE.protection, ...cell.style.protection },
              }
            }
          })
        })
      })
    }

    const workbookArr: ExcelJS.Workbook[] = []

    if (options?.mergePrint) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(templateBuffer);
      if (isEmpty(rowData)) {
        workbookArr.push(workbook)
        return workbookArr
      }
      _loadDefaultStyle(workbook)
      const loadWorkbook = await _templateLoadDatas(workbook, rowData, {
        options,
        fields,
        excelImageMap,
      })
      workbookArr.push(loadWorkbook)
      return workbookArr
    } else {
      for (let i = 0; i < rowData.length; i++) {
        const row = rowData[i];
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(templateBuffer);
        if (isEmpty(row)) {
          workbookArr.push(workbook)
          continue;
        }
        imageMap[i] = {}
        _loadDefaultStyle(workbook)
        const loadWorkbook = await _templateLoadData(workbook, row, i, {
          options,
          fields,
          excelImageMap,
          imageMap,
        })
        workbookArr.push(loadWorkbook)
      }
    }
    if (template.mode === PrintTemplateMode.MULTIPLE) {
      // 拆分成多个文件打印
      if (typeof options?.getImageMap === 'function') {
        options?.getImageMap(imageMap)
      }
      return workbookArr
    }
    // 合并成一个文件打印
    const mergeWorkbook = new ExcelJS.Workbook();
    const mergeImageMap: ImageMap = {}
    workbookArr.forEach((workbook, index) => {

      workbook.eachSheet((worksheet, sheetId) => {
        const newWorksheetName = rowData.length <= 1 ? worksheet.name : worksheet.name + (index + 1)
        mergeImageMap[newWorksheetName] = []
        const newWorksheet = mergeWorkbook.addWorksheet(newWorksheetName)
        setWorkSheetSetByWorkSheet(newWorksheet, worksheet)
        worksheet?.columns?.forEach((col, idx) => {
          if(col.width) newWorksheet.getColumn(idx + 1).width = col.width
        })
        if (Array.isArray(imageMap?.[index]?.[worksheet.name])) {
          imageMap?.[index]?.[worksheet.name].forEach((item: AddImageOption) => {
            const { width, height, col, row, base64, isImage, base64Dimension, imageFillType } = item
            mergeImageMap[newWorksheetName].push({
              width: (width as number),
              height: (height as number),
              col,
              row,
              base64,
            })
            cellLoadImage({
              isImage,
              base64Dimension,
              width,
              height,
              col,
              row,
              worksheet: newWorksheet,
              workbook: mergeWorkbook,
              base64,
              imageFillType,
            })
          })
        }

        const merges = (worksheet as any)._merges

        worksheet.eachRow({ includeEmpty: true },(rowObj, rowNumber) => {
          if (rowObj.height) newWorksheet.getRow(rowNumber).height = rowObj.height;
          rowObj.eachCell({ includeEmpty: true },(cell, colNumber) => {
            const newCell = newWorksheet.getCell(rowNumber, colNumber);
            newCell.value = cell.value;
            if (cell.style) newCell.style = { ...cell.style };
            if (cell.isMerged) {
              if (merges[cell.address]) {
                const { top, left, bottom, right } = merges[cell.address]?.model
                newWorksheet.mergeCells(top, left, bottom, right)
              }
              return
            }
          });
        })
      })
    })
    if (typeof options?.getImageMap === 'function') {
      options?.getImageMap(mergeImageMap)
    }
    return [mergeWorkbook]
  } catch (error) {
    console.error(error, template)
    throw error as Error
  }
}

/**
 * 根据一个excel和需要的sheet名称生成一个新的excel文件
 * @param excelBuffer excel文件buffer
 * @param excelPrintSheetName 要打印的sheet名
 */
export const createWorkbookFromSheets = async(
  excelBuffer: ArrayBuffer,
  excelPrintSheetName: string | string[]
): Promise<ExcelJS.Workbook | Error> => {
  const excelPrintSheetNameArr = [];
  if (typeof excelPrintSheetName === "string") {
    excelPrintSheetNameArr.push(excelPrintSheetName);
  } else if (Array.isArray(excelPrintSheetName)) {
    excelPrintSheetNameArr.push(...excelPrintSheetName);
  }
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer);
    if (excelPrintSheetNameArr.length > 0) {
      workbook.eachSheet((worksheet, sheetId) => {
        const sheetName = worksheet.name;
        if (!excelPrintSheetNameArr.includes(sheetName)) {
          workbook.removeWorksheet(sheetId)
          return;
        }
      })
    }

    return workbook
  } catch (error) {
    console.error(error, excelPrintSheetName)
    throw error as Error
  }
}
