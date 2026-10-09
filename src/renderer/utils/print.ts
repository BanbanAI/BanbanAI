import { getColumnLetter } from "@common/utils/print/shared";
import type { ImageMap, imageOptions } from "@common/utils/print/shared";
import type * as ExcelJSTypes from "exceljs";
import { isEmpty } from "@common/utils/object";
import { formatFloat } from "@common/utils/math";
import { cloneDeep } from 'lodash';
import { formDataApi } from "@renderer/utils/api/form-data";
import { getUUIDSystemField, SystemField } from "@common/utils/connection";
import { Row } from "@common/types/project";
// @ts-ignore
import { Column } from "@renderer/views/nocode/components/global/table/table";
import i18next from "i18next";

const printHtmlString = (htmlString: string) => {
  const hideFrame = document.createElement('iframe');
  const closePrint = () => {
    hideFrame.parentNode.removeChild(hideFrame);
  }
  hideFrame.onload = () => {
    hideFrame.contentWindow.onbeforeunload = closePrint;
    hideFrame.contentWindow.onafterprint = closePrint;
    hideFrame.contentWindow.print();
  }
  hideFrame.style.display = 'none';

  hideFrame.srcdoc = htmlString;
  document.body.appendChild(hideFrame);
}

// 打印类型
export enum PrintType {
  EXCEL = "excel",
  WORD = "word",
  HTML = "html",
}
export enum ExcelPrintSpace {
  ALL = "all",
  SELECT = "select",
}
export type PrintOptions = {
  // 打印excel时，指定打印的sheet名称
  excelPrintSheetName?: string | Array<string>;
  // 打印excel时加载图片
  excelImageMap?: ImageMap;
};

/**
 * HTML包装选项接口
 */
export interface WrapHtmlOptions {
  /** 要包装的HTML内容 */
  html: string;
  /** 文档标题，默认为'Document' */
  title?: string;
  /** 样式数组，每个元素会被包装在<style>标签中 */
  styles?: string[];
  /** 自定义头部内容，直接添加到head标签中 */
  head?: string;
  /** body标签的属性，如'class="container" id="main"' */
  bodyAttributes?: string;
  /** HTML语言属性，默认为'en' */
  lang?: string;
}
export function argbToRgba(argb: string, usePercentage = false): string {
  // 移除可能的前缀
  const cleanArgb = argb.replace(/^#/, '').replace(/^0x/, '');
  
  // 验证长度
  if (cleanArgb.length !== 8) {
    throw new Error(i18next.t('print.invalidArgbFormatTips'));
  }
  
  // 提取各分量
  const alpha = parseInt(cleanArgb.substring(0, 2), 16);
  const red = parseInt(cleanArgb.substring(2, 4), 16);
  const green = parseInt(cleanArgb.substring(4, 6), 16);
  const blue = parseInt(cleanArgb.substring(6, 8), 16);
  
  // 计算alpha值
  const alphaValue = usePercentage 
    ? `${Math.round((alpha / 255) * 100)}%`
    : alpha / 255;
  
  // 格式化为rgba字符串
  return `rgba(${red}, ${green}, ${blue}, ${alphaValue})`;
}
/**
 * 将HTML内容包装成完整的HTML文档
 * @param options 可以是字符串(直接作为html内容)或WrapHtmlOptions对象
 * @returns 完整的HTML文档字符串
 * @example
 * // 简单使用
 * wrapHtml('<div>Hello</div>');
 *
 * // 完整配置
 * wrapHtml({
 *   html: '<div>Hello</div>',
 *   title: 'My Page',
 *   styles: ['body { color: red; }'],
 *   lang: 'zh-CN'
 * });
 */
export const wrapHtml = (options: string | WrapHtmlOptions): string => {
  const config = typeof options === "string" ? { html: options } : options;
  const {
    html,
    title = "",
    styles = [],
    head = "",
    bodyAttributes = "",
    lang = "en",
  } = config;

  return `
    <!DOCTYPE html>
    <html lang="${lang}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      ${styles.map((style) => `<style>${style}</style>`).join("\n")}
      ${head}
    </head>
    <body${bodyAttributes ? ` ${bodyAttributes}` : ""}>
      ${html}
    </body>
    </html>
  `;
};
// 默认打印样式
export const PrintDefaultStyle = `
  @media print {
    @page {
      size: auto;

      @top-center {
        content: ""; /* 设置页眉内容 */
      }
      @bottom-center {
        content: ""; /* 设置页脚内容，包含页码 */
      }
    }
  }
`;
// ARGB 转 HEX（忽略 alpha，或简单处理）
export const argbToHex = (argb: string) => {
  if (!argb || argb.length !== 8) return null;
  // 取 RRGGBB（忽略 AA）
  return argb.substring(2).toLowerCase();
};
export const getExcelPt = (value) => {
  return value ?? 8.43;
};
export const ptToPx = (pt?: number) => {
  pt = getExcelPt(pt);
  return Math.max(10, Math.round(pt * 5));
};
export const getExcelHtml = async (
  excelBuffer: ArrayBuffer,
  printOptions: PrintOptions = {}
) => {
  const ExcelJS = (await import("exceljs")).default;
  if (!excelBuffer) {
    throw new Error("excelBuffer is required");
  }
  if (excelBuffer instanceof Blob || excelBuffer instanceof File) {
    excelBuffer = await excelBuffer.arrayBuffer();
  }
  if (!(excelBuffer instanceof ArrayBuffer)) {
    throw new Error("excelBuffer must be ArrayBuffer");
  }

  const { excelPrintSheetName, excelImageMap } = printOptions;
  const PAGE_WIDTH = 550;

  const excelPrintSheetNameArr = [];
  if (typeof excelPrintSheetName === "string") {
    excelPrintSheetNameArr.push(excelPrintSheetName);
  } else if (Array.isArray(excelPrintSheetName)) {
    excelPrintSheetNameArr.push(...excelPrintSheetName);
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer);

    const tableObj: Record<string, string> = {};
    workbook.eachSheet((worksheet, sheetId) => {
      const sheetName = worksheet.name;

      if (
        excelPrintSheetNameArr.length > 0 &&
        !excelPrintSheetNameArr.includes(sheetName)
      ) {
        return;
      }
      const imageMapArr = excelImageMap?.[sheetName] || []
      const imageAddressMap: Record<string, imageOptions> = imageMapArr.reduce((prev, cur: imageOptions) => {
        const { col, row } = cur
        const address = `${getColumnLetter(col - 1)}${row}`
        prev[address] = cur;
        return prev;
      }, {});
      // 分页 分table
      const tables = [];
      const colWidths = [];
      const rowCount = worksheet.actualRowCount;
      // 遍历行，获取行高
      const cellHeight = {};
      for (let rowIndex = 1; rowIndex <= rowCount; rowIndex++) {
        const row = worksheet.getRow(rowIndex);
        if (row.height) {
          cellHeight[rowIndex] = Math.floor(row.height / (4 / 3));
        }
      }
      worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const col = worksheet.getColumn(colNumber);
        colWidths.push({
          colNumber,
          width: ptToPx(col.width) + 2,
        });
      });

      const merges = (worksheet as any)._merges;
      const skipSet = new Set();
      const colGroups = [];
      let currentGroup = [];
      let currentWidth = 0;

      for (let colIndex = 1; colIndex <= colWidths.length; colIndex++) {
        const item = colWidths[colIndex - 1];
        const w = item.width;
        if (currentWidth + w > PAGE_WIDTH && currentGroup.length > 0) {
          colGroups.push([...currentGroup]); // 保存当前组
          currentGroup = [item];
          currentWidth = w;
        } else {
          currentGroup.push(item);
          currentWidth += w;
        }
      }
      if (currentGroup.length > 0) colGroups.push(currentGroup);

      colGroups.forEach((group, gapIndex) => {
        let table = `<table>`;

        table += "<colgroup>";
        group.forEach((item) => {
          table += `<col style="width: ${item.width}px">`;
        });
        table += "</colgroup>";
        worksheet.eachRow((row, rowNumber) => {
          table += `<tr>`;
          group.forEach((item) => {
            const colNumber = item.colNumber;
            const cell = row.getCell(colNumber);
            let rightCell = null
            // 单元格合并（colSpan / rowSpan）
            let colSpan = 1;
            let rowSpan = 1;
            if (merges[cell.address]) {
              const { top, left, bottom, right } = merges[cell.address]?.model;
              let rTL = right - left + 1;
              if (rTL === 0) rTL = 1;
              let rTB = bottom - top + 1;
              if (rTB === 0) rTB = 1;

              colSpan = rTL;
              rowSpan = rTB;

              for (let col = left - 1; col < right; col++) {
                let letter = getColumnLetter(col);
                for (let row = top; row <= bottom; row++) {
                  skipSet.add(`${letter}${row}`);
                }
              }
              rightCell = worksheet.getCell(`${getColumnLetter(right - 1)}${bottom}`)
            }
            if (!merges[cell.address] && skipSet.has(cell.address)) return;
            const styles = [];

            const font = cell.style.font;
            const getFontStyleArr = (font: Partial<ExcelJSTypes.Font>) => {
              if (!font) return [];
              const styleArr = []
              if (font?.name) styleArr.push(`font-family: ${font.name}`);
              if (font?.size) {
                styleArr.push(`font-size: ${font.size}px`);
              }

              if (font?.color?.argb) {
                const color = argbToHex(font.color.argb);
                if (color) styleArr.push(`color: #${color}`);
              } else {
                styleArr.push("color: #333333");
              }
              if (font?.bold) {
                styleArr.push("font-weight: bold");
              } else {
                styleArr.push("font-weight: normal");
              }
              if (font?.italic) styleArr.push("font-style: italic");
              if (typeof font?.underline === "string") {
                styleArr.push(`text-decoration: ${font.underline}`);  
              } else if (font?.underline === true) {
                styleArr.push("text-decoration: underline");
              } else if (font?.underline === false) {
                styleArr.push("text-decoration: none");
              }
              if (font?.strike) {
                styleArr.push("text-decoration: line-through");
              }
              if (font?.outline) {
                styleArr.push("text-decoration: outline");
              }
              if (font?.vertAlign) {
                styleArr.push(`vertical-align: ${font.vertAlign}`);
              } else {
                styleArr.push("vertical-align: middle");
              }
              return styleArr;
            }
            const fontStyleArr = getFontStyleArr(font);
            styles.push(...fontStyleArr);

            // 背景色
            if (
              cell.style?.fill?.type === "pattern" &&
              cell.style.fill.fgColor?.argb
            ) {
              const bgColor = argbToHex(cell.style.fill.fgColor.argb);
              if (bgColor) styles.push(`background-color: #${bgColor}`);
            }

            // 对齐方式
            if (cell.style?.alignment?.horizontal) {
              styles.push(`text-align: ${cell.style.alignment.horizontal}`);
            }
            if (cell.style?.alignment?.vertical) {
              styles.push(`vertical-align: ${cell.style.alignment.vertical}`);
            }
            if (cell.style?.alignment?.wrapText) {
              styles.push("white-space: wrap");
            } else {
              styles.push("white-space: nowrap");
            }

            if (cell.style?.alignment?.indent) {
              styles.push(`text-indent: ${cell.style.alignment.indent}em`);
            }

            if (cell.style?.alignment?.textRotation) {
              styles.push(
                `text-rotation: ${cell.style.alignment.textRotation}`
              );
            } else {
              styles.push("text-rotation: 0");
            }

            if (cell.style?.alignment?.readingOrder) {
              styles.push(
                `reading-order: ${cell.style.alignment.readingOrder}`
              );
            } else {
              styles.push("reading-order: ltr");
            }
            const getBorderStyleArr = (border: Partial<ExcelJSTypes.Borders>) => {
              const borderStyleArr = []
              const borderStyle = {
                thin: '1px solid',
                dotted: '1px dotted',
                hair: '0.5px solid',
                medium: '2px solid',
                double: '3px solid',
                thick: '4px solid',
                dashed: '1px dashed',
                dashDot: '1px dashed',
                // dashDotDot: '1px dashDotDot',
                // slantDashDot: '1px slantDashDot',
                mediumDashed: '2px dashed',
                // mediumDashDotDot: '2px dashDotDot',
                // mediumDashDot: '2px dashDot',
              }
              const getBorderValue = (border: Partial<ExcelJSTypes.Border>) => {
                const color = border?.color?.argb ? argbToRgba(border.color.argb) : '#000000';
                const style = borderStyle[border?.style] ?? '1px solid';
                return `${style} ${color}`;
              }
              if (border?.top?.style) borderStyleArr.push(`border-top: ${getBorderValue(border.top)}`);
              if (border?.bottom?.style) borderStyleArr.push(`border-bottom: ${getBorderValue(border.bottom)}`);
              if (border?.left?.style) borderStyleArr.push(`border-left: ${getBorderValue(border.left)}`);
              if (border?.right?.style) borderStyleArr.push(`border-right: ${getBorderValue(border.right)}`);
              return borderStyleArr;
            }
            if (cell?.border) {
              const borderStyleArr = getBorderStyleArr(cell.border);
              styles.push(...borderStyleArr);
            }
            if (rightCell?.border) {
              const borderStyleArr = getBorderStyleArr(rightCell.border);
              styles.push(...borderStyleArr);
            }

            if (cell?.fill) {
              // console.log('cell.fill', cell.fill)
              // if (cell.fill?.type === "pattern" && cell.fill.fgColor?.argb) {
              //   const bgColor = argbToHex(cell.fill.fgColor.argb);
              //   if (bgColor) styles.push(`background-color: #${bgColor}`);
              // }
            }

            if (cellHeight[rowNumber])
              styles.push(`height: ${cellHeight[rowNumber]}px`);

            const getText = (cell: ExcelJSTypes.Cell) => {
              if (imageAddressMap[cell.address]) {
                const {width, height, base64 } = imageAddressMap[cell.address]
                const base64Arr = Array.isArray(base64) ? base64 : [base64];
                return base64Arr.reduce((prev, cur) => {
                  return `<img src="${cur}" style="width: ${width * 2}px; height: ${height * 2}px; margin: 0px 4px;">`;
                }, '');
              }

              if (Array.isArray((cell.value as any)?.richText)) {
                return (cell.value as any).richText.reduce((prev, cur) => {
                  const styleArr = getFontStyleArr(cur?.font);
                  return `${prev}<span style="${styleArr.join('; ')};">${cur.text}</span>` ;
                }, '');
              }
              return cell.value?.toString() || '';
            }
            const text = getText(cell);
            table += `<td
              colSpan="${colSpan}"
              rowSpan="${rowSpan}"
              style="${styles.join("; ")}"
            >${text}</td>`;
          });
          table += "</tr>";
        });
        table += `</table>`;

        tables.push(table);
      });

      tableObj[sheetName] = tables.join("");
    });
    let html = "";
    for (const key in tableObj) {
      if (!Object.hasOwn(tableObj, key)) continue;
      const tableStr = tableObj[key];
      html += `${tableStr}`;
    }
    html = wrapHtml({
      html,
      styles: [
        PrintDefaultStyle,
        `
        @media print {
          @page {
            margin: 40pt 40pt; /* 设置每页的边距 */
          }
        }
        table {
          width: ${PAGE_WIDTH}px;
          border-collapse: collapse;
          max-width: 100vw;
          table-layout: fixed;
          break-after: page;
        }
        td {
          overflow: hidden;
        }
        `,
      ],
    });
    return html;
  } catch (error) {
    console.error("getExcelHtml error", error);
    throw error;
  }
};
const getDocxHtml = async (wordBuffer: ArrayBuffer) => {
  const { renderAsync } = await import("docx-preview");
  const div = document.createElement("div");
  await renderAsync(wordBuffer, div, null, {
    className: "docx-viewer",
    inWrapper: false,
    hideWrapperOnPrint: true,
    breakPages: true,
    renderHeaders: false,
    renderFooters: false,
    ignoreWidth: false,
    ignoreHeight: false,
    renderFootnotes: true,
    renderEndnotes: true,
    renderComments: true,
    useBase64URL: false,
  });
  
  let html = div.innerHTML;
  html = wrapHtml({
    html,
    styles: [
      PrintDefaultStyle,
      `
        @media print {
          @page {
            margin: 72pt 90pt; /* 设置每页的边距 */
          }
          .docx-viewer {
            padding: 0 !important;
            break-after: page;
          }
          body {
            padding: 0;
            margin: 0;
          }
        }
      `,
    ],
  })
  return html;
};
/**
 * 打印文件
 * @param type 打印类型
 * @param printValue 打印文件内容
 */
export const windowPrint = async (
  type: PrintType,
  printValue: ArrayBuffer | String,
  printOptions: PrintOptions = {}
) => {
  // 判断环境是否支持打印
  if (!window || !window.print) {
    throw new Error(i18next.t('print.printNotSupportedTips'));
  }
  let html = "";
  // 生成能够打印的html
  if (type === PrintType.HTML) {
    html = printValue as string;
  } else if (type === PrintType.EXCEL) {
    html = await getExcelHtml(printValue as ArrayBuffer, printOptions);
  } else if (type === PrintType.WORD) {
    html = await getDocxHtml(printValue as ArrayBuffer);
  }
  console.log('html', html)
  // 打印html
  printHtmlString(html);
};

type SystemPrintColumn = {
  title?: string,
  describeInfo?: string,
  columns: Column[],
  rows: Row[],
  headerTitle?: string,
  hideColumns?: Column[] | string[],
  mode?: SystemPrintMode,
}

export type SystemPrintMode = "table" | "singleRecord";

const escapePrintHtml = (value: unknown) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const stringifyPrintValue = (value: unknown): string => {
  if (value === void 0 || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(item => stringifyPrintValue(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const normalizedValue = value as Record<string, unknown>;
    const preferredKeys = ["label", "name", "realname", "title", "user", "value", "url"];
    for (const key of preferredKeys) {
      if (normalizedValue[key] !== void 0 && normalizedValue[key] !== null && normalizedValue[key] !== "") {
        return stringifyPrintValue(normalizedValue[key]);
      }
    }
    return Object.values(normalizedValue).map(item => stringifyPrintValue(item)).filter(Boolean).join(" ");
  }
  return String(value);
};

const normalizeGeneratedParagraphHtml = (value: string) => {
  const normalizedValue = value.trim();
  if (!/^(\s*<p>[\s\S]*?<\/p>\s*)+$/i.test(normalizedValue)) {
    return value;
  }

  const text = normalizedValue
    .replace(/^\s*<p>/i, "")
    .replace(/<\/p>\s*$/i, "")
    .replace(/<\/p>\s*<p>/gi, "\n");

  return /<[^>]+>/.test(text) ? value : text;
};

const isTrustedPrintImageHtml = (value: string) => {
  return /^(\s*<img\b[^>]*>\s*)+$/i.test(value)
    && !/\bon[a-z]+\s*=/i.test(value)
    && !/javascript\s*:/i.test(value);
};

const renderPrintValue = (value: unknown) => {
  const text = normalizeGeneratedParagraphHtml(stringifyPrintValue(value));
  if (!text) {
    return "";
  }
  if (isTrustedPrintImageHtml(text)) {
    return text;
  }
  return escapePrintHtml(text).replace(/\r\n|\r|\n/g, "<br>");
};

const getHiddenPrintColumnIds = (hideColumns: SystemPrintColumn["hideColumns"] = []) => {
  return new Set(hideColumns.map(item => {
    if (typeof item === "string") {
      return item;
    }
    return item.uid;
  }));
};

const isSystemPrintSubformColumn = (column: Column) => {
  return (column?.extra?.widgetType === "widget.form.subform" || column?.subType === "subForm")
    && Array.isArray(column.subColumns)
    && column.subColumns.length > 0;
};

const getPrintColumnTitle = (column: Column) => {
  return escapePrintHtml(column?.alias || column?.name || column?.uid || "");
};

const singleRecordMetaFieldNames = new Set<SystemField>([
  SystemField.CREATE_OWNER,
  SystemField.CREATE_TIME,
  SystemField.UPDATE_TIME,
]);

const singleRecordPrintableSystemFieldNames = new Set<SystemField>(singleRecordMetaFieldNames);

const isBuiltinPrintColumn = (column: Column) => {
  return Object.values(SystemField).includes(column?.name as SystemField) || Boolean(column?.extra?.internalField);
};

const shouldPrintSingleRecordColumn = (column: Column, options: { isSubColumn?: boolean } = {}) => {
  if (!isBuiltinPrintColumn(column)) {
    return true;
  }
  if (options.isSubColumn) {
    return false;
  }
  return singleRecordPrintableSystemFieldNames.has(column.name as SystemField);
};

const getVisibleSystemPrintColumns = (
  columns: Column[] = [],
  hideColumns: SystemPrintColumn["hideColumns"] = [],
) => {
  const hiddenIds = getHiddenPrintColumnIds(hideColumns);
  return columns.reduce<Column[]>((result, column) => {
    if (!column?.uid || hiddenIds.has(column.uid)) {
      return result;
    }
    if (!isSystemPrintSubformColumn(column)) {
      if (!shouldPrintSingleRecordColumn(column)) {
        return result;
      }
      result.push(column);
      return result;
    }

    const subColumns = column.subColumns.filter(subColumn => {
      return subColumn?.uid
        && !hiddenIds.has(subColumn.uid)
        && shouldPrintSingleRecordColumn(subColumn, { isSubColumn: true });
    });
    if (subColumns.length) {
      result.push({
        ...column,
        subColumns,
      });
    }
    return result;
  }, []);
};

const buildSingleRecordMetaHtml = (columns: Column[], row: Row) => {
  const metaColumns = columns.filter(column => singleRecordMetaFieldNames.has(column.name as SystemField));
  if (!metaColumns.length) {
    return "";
  }
  return `
    <div class="single-record-print__meta">
      ${metaColumns.map(column => `
        <div class="single-record-print__meta-item">
          <span class="single-record-print__meta-label">${getPrintColumnTitle(column)}</span>
          <span class="single-record-print__meta-value">${renderPrintValue(row?.[column.uid])}</span>
        </div>
      `).join("")}
    </div>
  `;
};

const buildSingleRecordDetailTableHtml = (columns: Column[], row: Row) => {
  const detailColumns = columns.filter(column => {
    return !isSystemPrintSubformColumn(column) && !singleRecordMetaFieldNames.has(column.name as SystemField);
  });
  if (!detailColumns.length) {
    return "";
  }

  return `
    <table class="single-record-print__detail-table">
      <tbody>
        ${detailColumns.map(column => `
          <tr>
            <th>${getPrintColumnTitle(column)}</th>
            <td>${renderPrintValue(row?.[column.uid])}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
};

const buildSingleRecordSubformTableHtml = (column: Column, row: Row) => {
  const subColumns = column.subColumns || [];
  const subRows = Array.isArray(row?.[column.uid]) ? row[column.uid] : [];
  return `
    <table class="single-record-print__sub-table">
      <thead>
        <tr>
          <th colspan="${subColumns.length}">${getPrintColumnTitle(column)}</th>
        </tr>
        <tr>
          ${subColumns.map(subColumn => `<th>${getPrintColumnTitle(subColumn)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${(subRows.length ? subRows : [{}]).map(subRow => `
          <tr>
            ${subColumns.map(subColumn => `<td>${renderPrintValue(subRow?.[subColumn.uid])}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
};

const buildSingleRecordBodyHtml = (columns: Column[], row: Row) => {
  const blocks: string[] = [];
  let detailColumns: Column[] = [];
  const flushDetailColumns = () => {
    const detailTableHtml = buildSingleRecordDetailTableHtml(detailColumns, row);
    if (detailTableHtml) {
      blocks.push(detailTableHtml);
    }
    detailColumns = [];
  };

  columns.forEach(column => {
    if (singleRecordMetaFieldNames.has(column.name as SystemField)) {
      return;
    }
    if (isSystemPrintSubformColumn(column)) {
      flushDetailColumns();
      blocks.push(buildSingleRecordSubformTableHtml(column, row));
      return;
    }
    detailColumns.push(column);
  });
  flushDetailColumns();
  return blocks.join("");
};

export const buildSingleRecordSystemPrintHtml = ({
  title = "",
  describeInfo = "",
  columns = [],
  rows = [],
  headerTitle = "",
  hideColumns = [],
}: SystemPrintColumn) => {
  const row = rows?.[0] || {};
  const visibleColumns = getVisibleSystemPrintColumns(cloneDeep(columns), hideColumns);
  const html = `
    <div class="single-record-print">
      ${headerTitle ? `<div class="single-record-print__caption">${escapePrintHtml(headerTitle)}</div>` : ""}
      ${title ? `<h1>${escapePrintHtml(title)}</h1>` : ""}
      ${describeInfo ? `<div class="single-record-print__description">${escapePrintHtml(describeInfo)}</div>` : ""}
      ${buildSingleRecordMetaHtml(visibleColumns, row)}
      ${buildSingleRecordBodyHtml(visibleColumns, row)}
    </div>
  `;

  return wrapHtml({
    html,
    lang: "zh-CN",
    title,
    styles: [
      PrintDefaultStyle,
      `
        @media print {
          @page {
            size: A4 portrait;
            margin: 48px 40px 56px;
          }

          body {
            margin: 0;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        body {
          margin: 0;
          color: #141E31;
          font-family: Arial, "Microsoft YaHei", sans-serif;
          font-size: 12px;
          line-height: 1.45;
        }

        .single-record-print {
          box-sizing: border-box;
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
        }

        .single-record-print__caption {
          text-align: center;
          font-size: 10px;
          line-height: 18px;
          margin-bottom: 28px;
        }

        .single-record-print h1 {
          margin: 0 0 12px;
          text-align: center;
          font-size: 20px;
          line-height: 28px;
          font-weight: 600;
        }

        .single-record-print__description {
          margin: 0 0 12px;
          color: #4E5969;
          font-size: 11px;
          line-height: 18px;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .single-record-print__meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 4px 18px;
          margin-bottom: 6px;
        }

        .single-record-print__meta-item {
          display: flex;
          min-width: 0;
          column-gap: 8px;
          line-height: 18px;
        }

        .single-record-print__meta-label {
          flex: 0 0 auto;
          color: #141E31;
        }

        .single-record-print__meta-value {
          min-width: 0;
          color: #0F2A4D;
          word-break: break-word;
        }

        .single-record-print__detail-table,
        .single-record-print__sub-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          border: 1px solid #D8DEE8;
          margin-top: 8px;
        }

        .single-record-print__detail-table tr,
        .single-record-print__sub-table tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .single-record-print__detail-table th,
        .single-record-print__detail-table td,
        .single-record-print__sub-table th,
        .single-record-print__sub-table td {
          border: 1px solid #D8DEE8;
          padding: 5px 6px;
          min-height: 22px;
          color: #0F2A4D;
          font-size: 12px;
          font-weight: 400;
          line-height: 20px;
          text-align: left;
          vertical-align: top;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .single-record-print__detail-table th {
          width: 25%;
          color: #141E31;
        }

        .single-record-print__sub-table thead th {
          text-align: center;
          color: #141E31;
        }

        .single-record-print__sub-table tbody td {
          text-align: left;
        }

        .single-record-print img {
          max-width: 100%;
          max-height: 120px;
          object-fit: contain;
        }
      `,
    ],
  });
};
/**
 * 系统打印
 * @param title 打印标题
 * @param describeInfo 打印描述
 * @param columns 打印列
 * @param rows 打印行
 * @param headerTitle 打印表头标题
 */
export const systemPrint = async ({
  title = '',
  describeInfo = '',
  columns = [],
  rows = [],
  headerTitle = '',
  hideColumns = [],
  mode = "table",
}: SystemPrintColumn) => {
  if (mode === "singleRecord") {
    windowPrint(PrintType.HTML, buildSingleRecordSystemPrintHtml({
      title,
      describeInfo,
      columns,
      rows,
      headerTitle,
      hideColumns,
    }));
    return;
  }

  columns = cloneDeep(columns)
  const hideUid = hideColumns.map(item => {
    if (typeof item === 'string') {
      return item
    }
    return item.uid
  })
  columns = columns.filter(item => !hideUid.includes(item.uid))
  let html = ''
  let h1 = ''
  // 顶部边距
  html += `<div class="container">`
  if (title) {
    h1 = `<h1>${title}</h1>`
  }
  let h2 = ''
  if (describeInfo) {
    h2 = `<h2>${describeInfo}</h2>`
  }
  html += `
    ${h1}
    ${h2}
  `
  // 是否有子表单
  const getIsSubform = (column) => {
    return column?.extra?.widgetType === 'widget.form.subform' && Array.isArray(column.subColumns) && column.subColumns.length > 0
  }
  let table = '<table>'
  const setHeader = (table, columns) => {
    table += '<thead>'
    const hasSubForm = columns.some(item => getIsSubform(item))
    const rowSpan = hasSubForm ? 2 : 1
    table += '<tr>'
    columns.forEach(column => {
      const isSubform = getIsSubform(column)
      const colSpan = isSubform ? column.subColumns.length : 1
      table += `<th rowspan="${isSubform ? 1 : rowSpan}" colspan="${colSpan}">${column.alias}</th>`
    })
    table += '</tr>'
    if (hasSubForm) {
      table += '<tr>'
      columns.forEach(column => {
        const isSubform = getIsSubform(column)
        if (!isSubform) {
          return
        }

        column.subColumns.forEach(subColumn => {
          table += `<th>${subColumn.alias}</th>`
        })
      })
      table += '</tr>'
    }
    table += '</thead>'

    return table
  }
  // 表头
  table = setHeader(table, columns)
  // 设置内容
  const setTableContent = (table: string, columns, rows) => {
    if (!rows || rows.length === 0) {
      return table
    }
    table += '<tbody>'
    rows.forEach(row => {
      // 得到最大行数
      let maxRowSpan = 1
      columns.forEach(column => {
        const isSubform = getIsSubform(column)
        if (isSubform) {
          const key = column?.uid
          maxRowSpan = Math.max(maxRowSpan, row[key]?.length || 1)
        }
      })
      for (let i = 0; i < maxRowSpan; i++) {
        table += '<tr>'
        columns.forEach(column => {
          const isSubform = getIsSubform(column)
          const key = column?.uid
          if (i === 0 && !isSubform) {
            table += `<td rowspan="${maxRowSpan}">${row[key]}</td>`
          } else if (isSubform) {
            column?.subColumns?.forEach(subColumn => {
              const subKey = subColumn?.uid
              const data = row?.[key]?.[i]?.[subKey]
              table += `<td>${data ?? ""}</td>`
            })
          }
        })
        table += '</tr>'
      }
    })
    table += '</tbody>'
    return table
  }
  table = setTableContent(table, columns, rows)

  table += '</table>'
  html += table
  html += '</div>'

  html = wrapHtml({
    html,
    styles: [
      PrintDefaultStyle,
      `
        @media print {
          @page {
            margin: 52px 32px 52px;
          }
          
          .container {
            margin-top: -10px;
          }
          th {
            background: #f5f6f8;
            -webkit-print-color-adjust: exact;   /* Chrome, Safari */
            color-adjust: exact;                 /* Firefox, 标准属性 */
            print-color-adjust: exact;           /* 未来标准（部分浏览器支持） */
          }

        }
        h1 {
          text-align: center;
          font-weight: 500;
          font-size: 16px;
          height: 24px;
          line-height: 24px;
          margin-top: 0px;
          overflow: hidden;
        }
        h2 {
          font-size: 10px;
          font-weight: 400;
          height: 14px;
          line-height: 14px;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          table-layout: fixed;
          border: 1px solid #e1e3e5;
          font-size: 10px;
        }
        th {
          color: #141E31;
          font-weight: 400;
          font-size: 10px;
          white-space: wrap;
          padding: 2px;
        }
        td,
        th {
          border: 1px solid #e1e3e5;
          padding: 6px
          overflow-wrap: break-word;
          word-wrap: break-word;
          hyphens: auto;
          /* 确保内容不会溢出容器 */
          overflow: hidden;
        }
        `,
    ],
  })
  windowPrint(PrintType.HTML, html);
}
/**
 * 打印数据替换 需要将 一些数据替换为 打印时需要的格式 如：成员需要展示名字，而不是展示id；数字需要按照配置展示
 * @param data 打印数据
 * @param columns 打印列配置
 * @returns 替换完成的数据
 */
export const printDataReplace = async (
  rows: Row[],
  columns: Column[],
  options: null | { nocodeId?: string; loadBucket?: (tableUID: string, queryOptions: any) => Promise<any> } = null,
) => {
  rows = cloneDeep(rows)
  const cacheMap = new Map()
  const resolvePrintAssetUrl = (value: unknown) => {
    if (!value) {
      return ""
    }
    if (typeof value !== "string") {
      return ""
    }
    if (/^(https?:)?\/\//.test(value) || value.startsWith("data:")) {
      return value
    }
    return `${location.origin}/${value.replace(/^\/+/, "")}`
  }
  const getPrintAssetUrl = (item: unknown) => {
    if (typeof item === "string") {
      return resolvePrintAssetUrl(item)
    }
    if (item && typeof item === "object" && "url" in item) {
      return resolvePrintAssetUrl(String((item as { url?: string }).url || ""))
    }
    return ""
  }
  const dealColumnMap = {
    subForm: async (rows: Row[], column: Column) => {
      const key = column?.uid
      if (!key) return
      const subColumns = column?.subColumns || []
      if (!Array.isArray(subColumns) || subColumns.length === 0) return
      for (let i = 0; i < rows.length; i++) {
        const data = rows[i];
        if (!data) continue
        if (!Array.isArray(data[key]) || data[key].length === 0) continue
        data[key] = await printDataReplace(data[key], subColumns, options)
      }
    },
    related: async (datas: Row[], column: Column) => {
      if (!options) return
      const { nocodeId } = options
      if (!nocodeId ) return
      const key = column?.uid
      if (!key) return
      const { relatedTableUID } = column?.extra || {}
      if (!relatedTableUID || isEmpty(relatedTableUID)) return
      for (let i = 0; i < datas.length; i++) {
        const data = datas[i];
        const value = data?.[key]
        const ArrValue = Array.isArray(value) ? value : [value].filter(Boolean)
        if (!ArrValue || ArrValue.length === 0) continue
        let fetchData = null
        const cacheKey = key + nocodeId + relatedTableUID[1]
        let fetchApi = null
        if (cacheMap.has(cacheKey)) {
          fetchApi = cacheMap.get(cacheKey)
        } else {
          fetchApi = options?.loadBucket
            ? options.loadBucket(relatedTableUID[1], {
              filters: {
                [relatedTableUID[1]]: [
                  {
                    [key]: {
                      $in: ArrValue,
                    }
                  }
                ]
              }
            })
            : formDataApi.getData({
              nocodeId,
              tableUIDs: [relatedTableUID[1]],
              options: {
                filters: {
                  [relatedTableUID[1]]: [
                    {
                      [key]: {
                        $in: ArrValue,
                      }
                    }
                  ]
                }
              },
            }).then((buckets) => buckets[0])
          cacheMap.set(cacheKey, fetchApi)
        }
        fetchData = await fetchApi
        const { fields } = fetchData
        const uuidField = getUUIDSystemField(fields);
        const titleFieldUID = fields.find(f => f.meta.name === SystemField.DATA_TITLE)?.uid
        const dataValue = ArrValue.map(uuid => fetchData?.rows?.find(row => row[uuidField.uid] === uuid))?.filter(Boolean) || []
        data[key] = dataValue.map(item => item?.[titleFieldUID] || '').join('')
      }
    },
    number: async (datas: Row[], column: Column) => {
      const key = column?.uid
      if(!key) {
        return
      }
      for (let i = 0; i < datas.length; i++) {
        const data = datas[i];
        if (!data) {
          continue
        }
        const value = data?.[key]
        if (!value) {
          continue
        }
        if (isEmpty(column?.extra)) {
          continue
        }
        let numberPrefix = ''
        let numberSuffix = ''
        let numberValue = ''
        const dealValue = (value) => {
          if (value === void 0 || value === null) {
            return ''
          }
          if (isNaN(value)) {
            value = 0
          }
          const { isPercent, decimalPlaces, completeZero } = column?.extra;
          let resultText = formatFloat(value, decimalPlaces, completeZero);
          if (isPercent) {
            resultText = formatFloat(value * 100, decimalPlaces, completeZero)
            resultText += "%";
          }

          return resultText
        }
        numberValue = dealValue(data[key])

        if (!column?.extra?.['isPercent'] && column?.extra?.['unitPosition'] === 'prefix') {
          numberPrefix = column?.extra?.['unit'];
        }
        if (!column?.extra?.['isPercent'] && column?.extra?.['unitPosition'] === 'suffix') {
          numberSuffix = column?.extra?.['unit'];
        }
        data[key] = `${numberPrefix}${numberValue}${numberSuffix}`
      }
    },
    file: async (datas: Row[], column: Column) => {
      const key = column?.uid
      if(!key) {
        return
      }
      for (let i = 0; i < datas.length; i++) {
        const data = datas[i];
        if (!data) {
          continue
        }
        const value = data?.[key]
        if (!value) {
          continue
        }
        let ArrValue = Array.isArray(value) ? value : [value].filter(Boolean)
        data[key] = ArrValue.map(item => {
          return `<p>${location.origin}/${item.url}</p>`
        }).join('')
      }
    },
    image: async (datas: Row[], column: Column) => {
      const key = column?.uid
      if(!key) {
        return
      }
      for (let i = 0; i < datas.length; i++) {
        const data = datas[i];
        if (!data) {
          continue
        }
        const value = data?.[key]
        if (!value) {
          continue
        }
        let ArrValue = Array.isArray(value) ? value : [value].filter(Boolean)
        data[key] = ArrValue.map(item => {
          return `<p>${location.origin}/${item.url}</p>`
        }).join('')
      }
    },
    signature: async (datas: Row[], column: Column) => {
      const key = column?.uid
      if (!key) {
        return
      }
      for (let i = 0; i < datas.length; i++) {
        const data = datas[i]
        if (!data) {
          continue
        }
        const value = data?.[key]
        if (!value) {
          continue
        }
        const arrValue = Array.isArray(value) ? value : [value].filter(Boolean)
        data[key] = arrValue.map(item => {
          const url = getPrintAssetUrl(item)
          if (!url) {
            return ""
          }
          return `<img src="${url}" style="width: 100%; max-height: 64px; object-fit: contain;" />`
        }).filter(Boolean).join('')
      }
    }
  }
  const getKey = (column) => {
    return column?.subType
  }
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    const key = getKey(column)
    const func = dealColumnMap[key]
    if (func) {
      await func(rows, column)
    }
  }
  return rows
}


export const printPDF = (url: string) => {
  const iframe = document.createElement('iframe')
  iframe.src = url;

  iframe.onload = () => {
    iframe.contentWindow.print();
    setTimeout(() => {
      iframe.remove();
    }, 30 * 1000)
  }
  iframe.style.display = 'none';
  document.body.appendChild(iframe)
}
