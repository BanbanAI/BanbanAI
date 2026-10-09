import * as ExcelJS from "exceljs";
import { Field, Row } from "@common/types/project";
import { _renderSheetLoadData, getTemplateCodeRenderMode, isHasCode, RangeMap, RowMerge, TemplateLoadDataOption, TemplateSheetLoadDataOption } from "./excelTemplateLoadData";
import { AddImageOption, cellLoadImage } from "../excelUtil";
import { getAddress } from "../outputFormat";
import i18next from "i18next";

export const _templateLoadDatas = async (
  workbook: ExcelJS.Workbook,
  datas: Row[],
  templateLoadDataOption: TemplateLoadDataOption,
) => {
  const worksheets = workbook.worksheets
  for (let i = 0; i < worksheets.length; i++) {
    const worksheet = worksheets[i];
    await _renderSheetLoadDatas(worksheet, datas, {
      ...templateLoadDataOption,
      workbook,
    })
  }

  return workbook;
}
const worksheetloadRow = (worksheet: ExcelJS.Worksheet, rows: ExcelJS.Row[]) => {
  let rowNumber = 1
  for (const row of rows) {
    const worksheetRow = worksheet.getRow(rowNumber);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const worksheetCell = worksheetRow.getCell(colNumber);
      worksheetCell.value = cell.value;
      if (cell.style) {
        worksheetCell.style = {...worksheetCell.style, ...cell.style};
      }
    })
    rowNumber++;
  }
  return worksheet
}
/**
 * 复制一个worksheet 到 workbook 中
 * @param workbook 
 * @param sourceSheet 
 * @param newSheetName 
 * @returns 
 */
const copyWorksheetToWorkbook = async (workbook: ExcelJS.Workbook, sourceSheet: ExcelJS.Worksheet, newSheetName: string) => {
  const targetName = newSheetName || `${sourceSheet.name}_copy`;
  if (workbook.getWorksheet(targetName)) {
    throw new Error(`${i18next.t('excelTemplateLoadDatas.sheetName')} "${targetName}" ${i18next.t('excelTemplateLoadDatas.nameExistChangeTips')}`);
  }
  const targetSheet = workbook.addWorksheet(targetName, {
    state: sourceSheet.state, // 可见性（visible/hidden/veryHidden）
    properties: { ...sourceSheet.properties }, // 基础属性（默认行高、大纲级别等）
    pageSetup: { ...sourceSheet.pageSetup }, // 页面设置（初始浅拷贝，后续补全）
    headerFooter: { ...sourceSheet.headerFooter }, // 页眉页脚
  });

  targetSheet.pageSetup = JSON.parse(JSON.stringify(sourceSheet.pageSetup));
  targetSheet.headerFooter = JSON.parse(JSON.stringify(sourceSheet.headerFooter));

  if (sourceSheet.columns) {
    targetSheet.columns = sourceSheet.columns.map(col => ({
      ...col,
      width: col.width, // 列宽
      key: col.key,     // 列别名（addRow时的key映射）
      hidden: col.hidden // 列是否隐藏
    }));
  }
  const sourceRowCount = sourceSheet.rowCount;
  for (let rowNum = 1; rowNum <= sourceRowCount; rowNum++) {
    const sourceRow = sourceSheet.getRow(rowNum);
    if (!sourceRow) continue;

    const targetRow = targetSheet.getRow(rowNum);
    targetRow.height = sourceRow.height;
    targetRow.outlineLevel = sourceRow.outlineLevel;
    targetRow.hidden = sourceRow.hidden;

    sourceRow.eachCell({ includeEmpty: true }, (sourceCell, colNum) => {
      const targetCell = targetRow.getCell(colNum);
      
      // 复制单元格值/公式
      targetCell.value = sourceCell.value; // 兼容值、公式、日期、超链接等类型

      // 复制单元格样式（深拷贝，避免引用关联）
      if (sourceCell.style) {
        targetCell.style = JSON.parse(JSON.stringify(sourceCell.style));
      }

      // 复制数字格式（如日期、货币格式）
      targetCell.numFmt = sourceCell.numFmt;
    });

    // 提交行修改（提升性能）
    targetRow.commit();
  }

  const _merges = (sourceSheet as any)._merges;
  if (_merges && Object.keys(_merges).length) {
    Object.keys(_merges).forEach(key => {
      const item = _merges[key];
      const { top, left, bottom, right  } = item.model
      const leftAddress = getAddress(left, top);
      const rightAddress = getAddress(right, bottom);
      targetSheet.mergeCells(`${leftAddress}:${rightAddress}`);
    });
  }

  return targetSheet
}
// 给一个sheet 加载 多条数据
export const _renderSheetLoadDatas = async (
  worksheet: ExcelJS.Worksheet,
  datas: Row[],
  templateSheetLoadDataOption: TemplateSheetLoadDataOption,
) => {
  const { fields, excelImageMap, workbook, options } = templateSheetLoadDataOption

  const templateWorkbook = new ExcelJS.Workbook();
  const templateWorksheet = await copyWorksheetToWorkbook(templateWorkbook, worksheet, `templateSheet`)
  const merges = (worksheet as any)._merges;
  const mergesKeys = Object.keys(merges);
  // 记录所有图片的信息
  const allImageIdArrPromise = []
  const allImageInfoArr: AddImageOption[] = [];
  const isCodeCell = (cell: ExcelJS.Cell) => {
    return (
      cell?.value &&
      typeof cell.value === 'string' &&
      isHasCode(cell.value, fields)
    );
  };

  // 分析 worksheet 对 有数据需要替换的行分组
  let lastRenderMode = null;
  type groupItem = {
    row: ExcelJS.Row,
    renderMode: ReturnType<typeof getTemplateCodeRenderMode>,
  }
  const groups: groupItem[][] = []
  // 分析 worksheet 对 有数据需要替换的行分组
  const judgeRowRenderMode = (row: ExcelJS.Row): ReturnType<typeof getTemplateCodeRenderMode> => {
    let hasSummaryCell = false;
    const cells = (row as any)._cells as ExcelJS.Cell[];
    for (const cell of cells) {
      if (!cell?.value || typeof cell.value !== 'string') continue;
      const renderMode = getTemplateCodeRenderMode(cell.value, fields);
      if (renderMode === "loop") return "loop";
      if (renderMode === "summary") hasSummaryCell = true;
    }
    return hasSummaryCell ? "summary" : "plain";
  }
  templateWorksheet.eachRow({includeEmpty: true }, (row, rowNumber) => {
    const renderMode = judgeRowRenderMode(row);
    if (renderMode !== lastRenderMode) {
      lastRenderMode = renderMode;
      groups.push([])
    }
    groups[groups.length - 1].push({
      row,
      renderMode,
    })
  })
  console.log('groups', groups)
  const realRows: ExcelJS.Row[] = []
  const mergeArr = []
  let AccumulativeRowNumber = 0;
  let templateRowNumber = 0;
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const renderMode = group[0].renderMode;
    const rows = group.map(item => item.row);
    if (renderMode === "plain") {
      // 如果没有值 就 直接添加
      realRows.push(...rows);
      AccumulativeRowNumber += rows.length;
      templateRowNumber += rows.length;
      continue;
    }
    const VirtualMergeArr = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const address = cell.address;
        const item = merges[address];
        if (cell.isMerged && item) {
          const { top, left, bottom, right } = item.model;
          const leftAddress = getAddress(left, top - templateRowNumber);
          const rightAddress = getAddress(right, bottom - templateRowNumber);
          if (leftAddress === rightAddress) {
            return;
          }
          VirtualMergeArr.push(`${leftAddress}:${rightAddress}`)
        }
      })
    }
    
    // 如果有值 就 遍历 数据 加载
    const renderDatas = renderMode === "summary" ? datas.slice(0, 1) : datas;
    for (let i = 0; i < renderDatas.length; i++) {
      const data = renderDatas[i];

      const VirtualWorkbook = new ExcelJS.Workbook();
      const VirtualWorksheet = VirtualWorkbook.addWorksheet(`data${i}`)
      worksheetloadRow(VirtualWorksheet, rows);
      VirtualMergeArr.forEach((item) => {
        VirtualWorksheet.mergeCells(item)
      })
      const { imageIdArrPromise, addImageOption } = await _renderSheetLoadData(VirtualWorksheet, data, {
        options,
        fields,
        excelImageMap,
        workbook: VirtualWorkbook,
      })
      allImageIdArrPromise.push(...imageIdArrPromise);
      allImageInfoArr.push(...addImageOption.map(item => {
        item.row += AccumulativeRowNumber;
        return {
          ...item,
        }
      }));
      VirtualWorksheet.eachRow({includeEmpty: true }, (row, rowNumber) => {
        realRows.push(row);
      })
      const _merges = (VirtualWorksheet as any)._merges;
      const mergesKeys = Object.keys(_merges);
      mergesKeys.forEach((key) => {
        const item = _merges[key];
        const { top, left, bottom, right } = item.model;
        const leftAddress = getAddress(left, top + AccumulativeRowNumber);
        const rightAddress = getAddress(right, bottom + AccumulativeRowNumber);
        if (leftAddress === rightAddress) {
          return;
        }
        const address = `${leftAddress}:${rightAddress}`
        mergeArr.push(address)
      });
      AccumulativeRowNumber += VirtualWorksheet.rowCount;
    }
    templateRowNumber += rows.length;
  }
  
  // 拆分所有单元格
  mergesKeys.forEach((key) => {
    worksheet.unMergeCells(key);
  });

  console.log('realRows', realRows)
  for (let i = 0; i < realRows.length; i++) {
    const realRow = realRows[i];
    const row = worksheet.getRow(i + 1)
    // 置空
    row.eachCell((cell, colNumber) => {
      cell.value = null;
      if (typeof cell.value === 'string' && isCodeCell(cell)) {
        cell.value = '';
      }
    })
    realRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const worksheetCell = row.getCell(colNumber);
      worksheetCell.value = cell.value;
      if (cell.style) {
        worksheetCell.style = {...worksheetCell.style, ...cell.style};
      }
    })
  }
  // 合并单元格
  for (let i = 0; i < mergeArr.length; i++) {
    const address = mergeArr[i];
    worksheet.mergeCells(address);
  }
  // 加载图片
  const imageIdArr = await Promise.all(allImageIdArrPromise);
  for (let i = 0; i < imageIdArr.length; i++) {
    const { base64, base64Dimension } = imageIdArr[i];
    let {
      width,
      height,
      col,
      row,
      isImage = false,
      imageFillType = 'auto',
    } = allImageInfoArr[i];

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
  return worksheet
}
