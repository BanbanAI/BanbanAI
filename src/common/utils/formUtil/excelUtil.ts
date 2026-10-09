import type { GetParser, ReplaceExcelTemplateOptions } from "../print/shared";
import JSZip from 'jszip';
import { numPTToPX, numPXToPT, pngBase64ToDataUrl } from "./outputFormat";
import * as ExcelJS from "exceljs";
import { isNumber, proportionWH } from ".";
import { cloneDeep } from 'lodash';

interface Dimension {
  width: number,
  height: number,
  unit: 'EMU' | 'cm' | 'in' | 'px',
  toCentimeters?: () => Dimension,
  toInches?: () => Dimension,
  toPixels?: (dpi?: number) => Dimension,
}
export interface TemplateImage {
  [key: string]: {
    path: string,
    base64: string,
    mimeType: string,
    name: string,
    embed: string,
    dimensions: Dimension,
  }
}
// 只有设置了图片的宽度和高度，才会有效
export type ImageFillType = 'auto' | 'fixed'
export type AddImageOption = {
  isImage?: boolean;
  width: number | "auto";
  height: number | "auto";
  imageFillType?: ImageFillType;
  col: number;
  row: number;
  worksheet: ExcelJS.Worksheet;
  workbook: ExcelJS.Workbook;
  base64?: string | string[];
  base64Dimension?:
    | { width: number; height: number }
    | { width: number; height: number }[];
};

export const setWorkSheetSetByWorkSheet = (newWorksheet: ExcelJS.Worksheet, worksheet: ExcelJS.Worksheet) => {
  newWorksheet.pageSetup = {
    ...worksheet.pageSetup,
  }
  newWorksheet.views = cloneDeep(worksheet.views)
  newWorksheet.properties = cloneDeep(worksheet.properties)
  newWorksheet.headerFooter = cloneDeep(worksheet.headerFooter)
  newWorksheet.state = worksheet.state
  newWorksheet.autoFilter = cloneDeep(worksheet.autoFilter)
}

function getImageMimeType(path) {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.bmp')) return 'image/bmp';
  return 'image/png'; // 默认
}
export async function extractImagesFromXlsx(arrayBuffer: ArrayBuffer, getParser?: GetParser): Promise<TemplateImage> {
  if (!arrayBuffer) {
    throw new Error('ArrayBuffer is required.');
  }
  if (!getParser && typeof DOMParser === 'undefined') {
    throw new Error('DOMParser is not available. Please provide a getParser function for non-browser environments.');
  }
  const createParser = getParser || (() => {
    if (typeof DOMParser !== 'undefined') {
      return new DOMParser();
    }
    throw new Error('DOMParser is not available. Please provide a getParser function for non-browser environments.');
  });
  const zip = await JSZip.loadAsync(arrayBuffer);
  // 找到所有 drawing.xml.rels 文件
  const relsFiles = Object.keys(zip.files).filter(f => f.startsWith('xl/_rels/cellimages') && f.endsWith('.rels'));

  const imageMap = {};

  for (const relsPath of relsFiles) {
    const relsContent = await zip.file(relsPath)?.async('text');
    if (!relsContent) {
      continue
    }
    const parser = createParser();
    const xmlDoc = parser.parseFromString(relsContent, 'application/xml');
    // 遍历 <Relationship> 标签
    const relationships = xmlDoc.getElementsByTagName('Relationship');
    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target'); // media/image1.png

      if (target.startsWith('media/')) {
        const imagePath = 'xl/' + target
        const imageFile = zip.file(imagePath);
        if (imageFile) {
          const imageData = await imageFile.async('base64');
          const mimeType = getImageMimeType(imagePath)
          imageMap[id] = {
            path: imagePath,
            base64: pngBase64ToDataUrl(imageData, mimeType),
            mimeType: mimeType
          };
        }
      }
    }
  }

  const cellimagesPath = Object.keys(zip.files).filter(f => f.startsWith('xl/cellimages.xml'))[0];
  const cellimagesContent = await zip.file(cellimagesPath)?.async('text');
  if (!cellimagesContent) {
    return {}
  }
  const cellimagesParser = createParser();
  const xmlDoc = cellimagesParser.parseFromString(cellimagesContent, 'text/xml');
  const etcCellimages = xmlDoc.getElementsByTagName('etc:cellImage');
  const idImageMap = {}
  for (let i = 0; i < etcCellimages.length; i++) {
    const etcCellimage = etcCellimages[i];
    const cNvPr = etcCellimage.getElementsByTagName('xdr:cNvPr')[0];
    const blipFill = etcCellimage.getElementsByTagName('xdr:blipFill')[0];
    const blip = blipFill.getElementsByTagName('a:blip')[0];
    const embed = blip.getAttribute('r:embed');
    const id = cNvPr.getAttribute('id');
    const name = cNvPr.getAttribute('name');
    const dimensions = etcCellimage.getElementsByTagName('a:ext')[0];
    const width = parseInt(dimensions.getAttribute('cx'));
    const height = parseInt(dimensions.getAttribute('cy'));
    const unit = 'EMU';

    if (imageMap[embed]) {
      const { path, base64, mimeType } = imageMap[embed]
      idImageMap[name] = {
        name,
        path,
        base64,
        mimeType,
        embed,
        dimensions: {
          width,
          height,
          unit,
          toCentimeters: function () {
            return {
              width: this.width / 360000,
              height: this.height / 360000,
              unit: 'cm'
            }
          },
          toInches: function () {
            return {
              width: this.width / 914400,
              height: this.height / 914400,
              unit: 'in'
            }
          },
          toPixels: function (dpi = 96) {
            return {
              width: Math.round(this.width * dpi / 914400),
              height: Math.round(this.height * dpi / 914400),
              unit: 'px'
            }
          }
        }
      }
    }
  }
  return idImageMap;
}

// 加载图片到单元格
export const cellLoadImage = (option: AddImageOption) => {
  const {
    width,
    height,
    imageFillType,
    col,
    row,
    worksheet,
    workbook,
    base64,
    base64Dimension,
    isImage,
  } = option;
  const base64Arr = Array.isArray(base64) ? base64 : [base64];
  const base64DimensionArr = Array.isArray(base64Dimension)
    ? base64Dimension
    : [base64Dimension];

  const imageX = col - 1;
  const imageY = row - 1;
  const imageRow = worksheet.getRow(row);
  const imageColumn = worksheet.getColumn(col);
  const columnWidth = imageColumn.width ?? 20;
  const imageCell = imageRow.getCell(col);
  imageCell.value = "";
  imageCell.alignment = {
    ...imageCell.alignment,
    indent: 2,
    horizontal: "center",
  };

  type AddImageOption = {
    imageId: number;
    imageWidth: number;
    imageHeight: number;
  }
  const addImageOptions: AddImageOption[] = []

  // 得到处理后的高度
  for (let i = 0; i < base64Arr.length; i++) {
    const base64 = base64Arr[i];
    const imageId = workbook.addImage({ base64, extension: "png" });
    let imageWidth = width;
    let imageHeight = height;
    if (isImage) {
      const dimension = base64DimensionArr[i];
      const newSize = proportionWH(
        {
          width: isNumber(width) ? (width as number) * 5 : width,
          height: isNumber(height) ? (height as number) * 5 : height,
        },
        dimension,
        {
          defaultHeight: 30 * 5,
          imageFillType,
        }
      );
      imageWidth = newSize.width as number;
      imageHeight = newSize.height as number;
    } else {
      imageWidth = (width as number) * 5;
      imageHeight = (height as number) * 5;
    }

    addImageOptions.push({
      imageId,
      imageWidth,
      imageHeight,
    })
  }
  type AddImageOptionWithCol = AddImageOption & {
    currentCol: number,
    imageWidthRatio: number,
  }
  // 排版所有图片 得到最终高度
  // 排版数组 每一个数组项都是一行
  const addImageTypographyArr: {
    maxImageHeight: number
    rowImageOptinArr: AddImageOptionWithCol[]
  }[] = []
  
  let currentCol = imageX + 0.1

  for (let i = 0; i < addImageOptions.length; i++) {
    const { imageId, imageWidth , imageHeight } = addImageOptions[i];

    const imageWidthRatio = numPXToPT(imageWidth) / columnWidth
    if ((currentCol + imageWidthRatio - imageX) > 1 || imageWidth > columnWidth || i === 0) {
      currentCol = imageX + 0.1
      addImageTypographyArr.push({
        maxImageHeight: 0,
        rowImageOptinArr: []
      })
    }
    const lastRowImageOption = addImageTypographyArr[addImageTypographyArr.length - 1]
    lastRowImageOption.rowImageOptinArr.push({
      imageWidthRatio,
      currentCol,
      imageId,
      imageWidth,
      imageHeight,
    })
    lastRowImageOption.maxImageHeight = Math.max(lastRowImageOption.maxImageHeight, imageHeight)

    currentCol = currentCol + imageWidthRatio
  }
  const padding = 20
  const rowTotalHeight = addImageTypographyArr.reduce((prev, cur) => prev + cur.maxImageHeight, 0)
  const rowTotalHeightAndPadding = addImageTypographyArr.reduce((prev, cur) => prev + cur.maxImageHeight + padding, 0)
  if (!imageRow.height || imageRow.height < rowTotalHeightAndPadding) {
    imageRow.height = numPXToPT(rowTotalHeightAndPadding);
  }
  const paddingRatio = (padding / 2) / rowTotalHeightAndPadding
  let cumulativeHeight = 0
  addImageTypographyArr.forEach((item) => {
    item.rowImageOptinArr.forEach((imageOption) => {
      const { imageWidthRatio, currentCol, imageId, imageWidth, imageHeight } = imageOption
      const beforeHeightRatio = cumulativeHeight / rowTotalHeight
      const addImageOption = {
        tl: { col: currentCol, row: imageY + beforeHeightRatio + paddingRatio },
        ext: { width: imageWidth, height: imageHeight },
        editAs: 'oneCell',
      };
      worksheet.addImage(imageId, addImageOption);
    })
    cumulativeHeight += item.maxImageHeight + padding
  })
};
export const getCellFormulaImageId = (formula: string) => {
  if (!formula.includes('DISPIMG')) return null
  const regex = /(?:_xlfn\.)?DISPIMG\(\s*"([^"]+)"\s*,\s*\d+\s*\)/i;
  const match = formula.match(regex)
  const dispimgId = match ? match[1] : null;
  return dispimgId
}
/**
 * 加载包含图片的excel文件
 * @param arrayBuffer 
 * @param options 
 * @returns 
 */
export const loadExcelhasImage: (arrayBuffer: ArrayBuffer, options?: ReplaceExcelTemplateOptions) => Promise<ExcelJS.Workbook> = async (arrayBuffer: ArrayBuffer, options?: ReplaceExcelTemplateOptions) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const excelImageMap = await extractImagesFromXlsx(arrayBuffer, options?.getParser)
  if (!excelImageMap) return workbook
  const imageIdArrPromise = []
  const addImageOption: AddImageOption[] = []
  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (typeof (cell.value as any)?.formula === 'string' && (cell.value as any)?.formula.includes('DISPIMG')) {
          const dispimgId = getCellFormulaImageId((cell.value as any)?.formula)
          if (dispimgId && excelImageMap[dispimgId]) {
            const templateImage = excelImageMap[dispimgId]
            imageIdArrPromise.push(
              Promise.resolve({
                base64: templateImage.base64,
              })
            )
            const { width, height } = templateImage.dimensions.toPixels(27)
            
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
      })
    })
  })
  const imageIdArr = await Promise.all(imageIdArrPromise)

  imageIdArr.forEach(({ base64 }, index) => {
    const { width, height, worksheet, col, row, workbook } = addImageOption[index]

    cellLoadImage({
      width,
      height,
      col,
      row,
      worksheet,
      workbook,
      base64,
    })
  })
  return workbook;
}

// 融合多个workbook到一个workbook里
export const mergeWorkbookArr = (workbookArr: ExcelJS.Workbook[], imageMap: object): ExcelJS.Workbook => {
  const firstWorkbook = workbookArr.splice(0, 1)[0]
  const getRowNumBySheet = (worksheet: ExcelJS.Worksheet): number => {
    let maxRowNum = 0
    worksheet.eachRow((row, rowNumber) => {
      maxRowNum = Math.max(maxRowNum, rowNumber)
    })
    return maxRowNum
  }
  // 循环第一个sheet
  firstWorkbook.eachSheet((firstWorksheet, sheetId) => {
    const firstRowNum = getRowNumBySheet(firstWorksheet)
    //  给合并使用
    let rowCount = firstRowNum
    let mergeArr = []
    for (let i = 0; i < workbookArr.length; i++) {

      const workbook = workbookArr[i];
      const worksheet = workbook.getWorksheet(sheetId)
      const merges = (worksheet as any)._merges

      worksheet.eachRow({ includeEmpty: true }, (rowObj, rowNumber) => {
        // 得到某一行的数据 再 添加到firstworksheet
        const row = []
        rowObj.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          row.push(cell.value)
        })
        const firstNewRow = firstWorksheet.addRow(row)
        rowObj.eachCell({ includeEmpty: true }, (cellObj, colNumber) => {
          const firstNewCell = firstNewRow.getCell(colNumber)
          if (cellObj.style) {
            firstNewCell.style = {
              ...cellObj.style,
            }
          }
          if (cellObj.isMerged) {
            if (merges[cellObj.address]) {
              const { top, left, bottom, right } = merges[cellObj.address]?.model
              mergeArr.push({
                top: top + rowCount,
                left: left,
                bottom: bottom + rowCount,
                right: right,
              })
            }
          }
        })
      })
      // 合并单元格
      for (const merge of mergeArr) {
        const { top, left, bottom, right } = merge
        firstWorksheet.mergeCells(top, left, bottom, right)
      }

      imageMap?.[i + 1]?.[firstWorksheet.name]?.forEach((item: AddImageOption) => {
        const { width, height, col, row, base64, isImage, base64Dimension, imageFillType } = item
        cellLoadImage({
          isImage,
          base64Dimension,
          width,
          height,
          col,
          row: row + rowCount,
          worksheet: firstWorksheet,
          workbook: firstWorkbook,
          base64,
          imageFillType,
        })
      })

      const rowNum = getRowNumBySheet(worksheet)
      rowCount += rowNum
    }
  })

  return firstWorkbook
}
