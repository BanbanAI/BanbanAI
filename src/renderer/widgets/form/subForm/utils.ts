import { read as readXlsx, utils as utilsXlsx } from "xlsx/dist/xlsx.full.min.js";
import * as XLSX from "xlsx";
import { CellMerge, ExcelFileData, ExcelFormColMap, ExcelLocation, ExcelRange, FormFieldTypeClassify, SheetData, SpecialFieldProcess, SpecialFieldProcessRes } from "./type";
import { Field, Row } from '@common/types/project';
import { Department, NocodeUser } from '@common/types/account';
import { SubForm } from './subForm';
import dayjs from "dayjs";
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { provide, inject } from "vue";
import i18next from "@renderer/widgets/i18next";

dayjs.extend(customParseFormat);

export const dataRegex = {
  phone: /^(?:(?:\+|00)86|0)?1[3-9]\d{9}$/,
  address: /^([\u4e00-\u9fa5\w]+\/){2,3}[\u4e00-\u9fa5\w]+\s+.+$/,
}

const CUSTOM_DATE_FORMATS = [
  'YYYY年MM月DD日',
  'YYYY年M月DD日',
  'YYYY年MM月D日',
  'YYYY年M月D日',
  'HH时mm分ss秒',
  'H时m分s秒',
  'HH时mm分',
  'H时m分',
  'mm分ss秒',
  'm分s秒',
  'HH时',
  'H时',

  'YYYY年MM月DD日 HH:mm:ss',
  'YYYY年M月D日 H:m:s',
  'YYYY年MM月DD日 HH:mm',
  'YYYY年M月D日 H:m',
  'YYYY年MM月DD日 HH',
  'YYYY年M月D日 H',

  'YYYY年MM月DD日 HH时mm分ss秒',
  'YYYY年M月D日 H时m分s秒',
  'YYYY年MM月DD日 HH时mm分',
  'YYYY年M月D日 H时m分',
  'YYYY年MM月DD日 HH时',
  'YYYY年M月D日 H时',

  'YYYY/MM/DD HH时mm分ss秒',
  'YYYY/M/D H时m分s秒',
  'YYYY/MM/DD HH时mm分',
  'YYYY/M/D H时m分',
  'YYYY/MM/DD HH时',
  'YYYY/M/D H时',

  'YYYY-MM-DD HH时mm分ss秒',
  'YYYY-M-D H时m分s秒',
  'YYYY-MM-DD HH时mm分',
  'YYYY-M-D H时m分',
  'YYYY-MM-DD HH时',
  'YYYY-M-D H时',

  'YYYY.MM.DD HH时mm分ss秒',
  'YYYY.M.D H时m分s秒',
  'YYYY.MM.DD HH时mm分',
  'YYYY.M.D H时m分',
  'YYYY.MM.DD HH时',
  'YYYY.M.D H时',
];

export function customDayjs(dateInput: string | Date | dayjs.Dayjs): dayjs.Dayjs | null {
  if (!dateInput) return null;

  let instance: dayjs.Dayjs = dayjs(dateInput);
  if (instance.isValid()) return instance;

  instance = dayjs(dateInput, CUSTOM_DATE_FORMATS, true); // 第三个参数 `true` 表示严格模式
  return instance;
}

export function getWidgets(): FormFieldTypeClassify[] {
  return [
    {
      category: i18next.t("widgetCategoryBasic"),
      children: [
        {
          "type": "widget.form.textInput",
          "name": i18next.t("widgetSingleLineText"),
        },
        {
          "type": "widget.form.textarea",
          "name": i18next.t("widgetMultiLineText"),
        },
        {
          "type": "widget.form.numberInput",
          "name": i18next.t("widgetNumberField"),
        },
        {
          "type": "widget.form.serialNumber",
          "name": i18next.t("widgetSerialNumber"),
        },
        {
          "type": "widget.form.datePicker",
          "name": i18next.t("widgetDateTime"),
        },
        {
          "type": "widget.form.dateRangePicker",
          "name": i18next.t("widgetTimeRange"),
        },
        {
          "type": "widget.form.radioGroup",
          "name": i18next.t("widgetRadio"),
        },
        {
          "type": "widget.form.checkboxGroup",
          "name": i18next.t("widgetCheckbox"),
        },
        {
          "type": "widget.form.treeSelect",
          "name": i18next.t("widgetDropdownSingle"),
        },
        {
          "name": i18next.t("widgetDropdownMultiple"),
          "type": "widget.form.treeMultipleSelect",
        },
        {
          "name": i18next.t("widgetMember"),
          "type": "widget.form.memberSelect",
        },
        {
          "name": i18next.t("widgetDepartment"),
          "type": "widget.form.departmentSelect",
        },
        {
          "type": "widget.form.subform",
          "name": i18next.t("widgetSubForm"),
        },
        // {
        //   "type": "widget.form.splitLine",
        //   "name": "分割线"
        // },
      ],
    },
    {
      category: i18next.t("widgetCategoryAdvanced"),
      children: [
        {
          "name": i18next.t("widgetPhone"),
          "type": "widget.form.phoneInput",
        },
        {
          "type": "widget.form.address",
          "name": i18next.t("widgetAddress"),
        },
        {
          "type": "widget.form.rate",
          "name": i18next.t("widgetRate"),
        },
        {
          "type": "widget.form.position",
          "name": i18next.t("widgetLocation"),
        },
        {
          "type": "widget.form.tagInput",
          "name": i18next.t("widgetTagText"),
        },
        {
          "type": "widget.form.richTextEditor",
          "name": i18next.t("widgetRichText"),
        },
        {
          "type": "widget.form.markdownEditor",
          "name": i18next.t("widgetMarkdown"),
        },
        {
          "name": i18next.t("widgetUploadImage"),
          "type": "widget.form.image-uploader",
        },
        {
          "name": i18next.t("widgetUploadFile"),
          "type": "widget.form.file-uploader",
        },
        {
          "type": "widget.form.switch",
          "name": i18next.t("widgetSwitch"),
        },
        {
          "type": "widget.form.searchForm",
          "name": i18next.t("widgetSearchForm"),
        },
        {
          "type": "widget.form.hyperlink",
          "name": i18next.t("widgetHyperlink"),
        },
        {
          "type": "widget.form.autoCompute",
          "name": i18next.t("widgetRealtimeCalculation"),
        },
      ],
    },
    {
      category: i18next.t("widgetCategoryRelated"),
      children: [
        {
          "type": "widget.form.selectData",
          "name": i18next.t("widgetSelectData"),
        },
        {
          "type": "widget.form.relatedData",
          "name": i18next.t("widgetRelatedData"),
        },
      ],
    },
    {
      category: i18next.t("widgetCategoryLayout"),
      children: [
        {
          "type": "widget.form.titleBar",
          "name": i18next.t("widgetTitleBar"),
        },
        {
          "type": "widget.form.imageTextShow",
          "name": i18next.t("widgetImageTextShow"),
        },
        {
          "type": "widget.form.multipleTabs",
          "name": i18next.t("widgetTabs"),
        },
      ],
    }
  ]
}

export async function parseExcelData(file: File, maxRows?: number): Promise<ExcelFileData> {
  if (!file) {
    throw new Error(i18next.t("importExcelFileNotFound"));
  }

  // 从路径中提取文件名（不包含路径部分）
  const fullFileName = file.name;
  // 提取原始文件名（移除时间戳和扩展名）
  // 匹配模式：文件名_数字.xlsx → 提取下划线前的部分
  const fileNameMatch = fullFileName.match(/^(.+?)_\d+\.\w+$/);
  const originalFileName = fileNameMatch
    ? fileNameMatch[1] // 提取第一个捕获组（下划线前的部分）
    : fullFileName.replace(/\.\w+$/, ''); // 备用：直接移除扩展名

  // 读取文件并解析为工作簿对象
  const fileArrayBuffer = await file.arrayBuffer();
  const workbook = readXlsx(fileArrayBuffer, { cellDates: true, cellText: false });
  // 获取所有表名
  const sheetNames = workbook.SheetNames;
  let originSheetsData: ExcelFileData['originSheetsData'] = {};

  // 遍历所有工作表并提取数据
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    let isSheetNull: boolean = worksheet['!ref'] === undefined;
    if (isSheetNull) {
      originSheetsData[sheetName] = { isSheetNull, rows: [], typeData: [], mergeData: [] };
      continue;
    }

    let range: XLSX.Range = utilsXlsx.decode_range(worksheet['!ref']);

    // 将工作表转换为JSON格式
    const jsonData = utilsXlsx.sheet_to_json(worksheet, { header: 1, raw: true });

    // 如果传入maxRows参数，则限制读取的行数，否则读取所有行
    let maxRowsToRead = maxRows !== undefined ? Math.min(jsonData.length, maxRows) : jsonData.length;
    range.e.r = range.s.r + maxRowsToRead - 1;

    let mergeData: CellMerge[][] = parseDataMerge(worksheet, range);
    maxRowsToRead = Math.max(maxRowsToRead, mergeData.length);
    range.e.r = range.s.r + maxRowsToRead - 1;

    let rows = sheetFillNull(jsonData.slice(0, maxRowsToRead) as any[][], range);
    let typeData = parseDataType(worksheet, range);

    originSheetsData[sheetName] = { isSheetNull, rows, typeData, mergeData };
  }

  return {
    fileName: originalFileName,
    sheets: sheetNames,
    originSheetsData
  }
}

function parseDataType(worksheet: XLSX.WorkSheet, range: XLSX.Range): string[][] {
  const typeData: string[][] = [];
  const typeMap = {
    n: 'number',
    s: 'string',
    b: 'boolean',
    d: 'date',
    e: 'error'
  };
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = { c: C, r: R };
      const cellRef = utilsXlsx.encode_cell(cellAddress);
      const cellType = worksheet[cellRef]?.t ?? null;

      if (!typeData[R - range.s.r]) typeData[R - range.s.r] = [];
      typeData[R - range.s.r][C - range.s.c] = typeMap[cellType];
    }
  }
  return typeData;
}

function parseDataMerge(worksheet: XLSX.WorkSheet, range: XLSX.Range): CellMerge[][] {
  const mergeData: CellMerge[][] = [];
  const originMerge: ExcelRange[] = worksheet?.['!merges'] ?? [];
  for (const merge of originMerge) {
    if (merge.s.r > range.e.r) continue;
    const rowIndex = merge.s.r - range.s.r;
    const colIndex = merge.s.c - range.s.c;

    // 被合并单元格，rowspan与colspan都为0
    for (let R = rowIndex; R <= merge.e.r - range.s.r; R++) {
      for (let C = colIndex; C <= merge.e.c - range.s.c; C++) {
        if (!mergeData[R]) mergeData[R] = [];
        if (R === rowIndex && C === colIndex) {
          mergeData[rowIndex][colIndex] = {
            rowspan: merge.e.r - merge.s.r + 1,
            colspan: merge.e.c - merge.s.c + 1,
          };
        } else {
          // 区分被横向，纵向合并的单元格
          mergeData[R][C] = { rowspan: C === colIndex ? 0 : 1, colspan: R === rowIndex ? 0 : 1 };
        }
      }
    }
  }
  // 未赋值的单元格，rowspan与colspan都为1
  let rowCount = Math.max(mergeData.length, range.e.r - range.s.r + 1);
  for (let R = range.s.r; R < range.s.r + rowCount; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const rowIndex = R - range.s.r;
      const colIndex = C - range.s.c;
      if (!mergeData[rowIndex]) mergeData[rowIndex] = [];
      if (mergeData[rowIndex][colIndex] === undefined)
        mergeData[rowIndex][colIndex] = { rowspan: 1, colspan: 1 };
    }
  }
  return mergeData;
}

export function sheetFillNull(sheetData: any[][], range: XLSX.Range) {
  // 空单元格按最长行填充null
  const maxLength = range.e.c - range.s.c + 1;
  sheetData.forEach(row => {
    for (let i = 0; i < maxLength; i++) {
      if (row[i] === undefined) row[i] = null;
    }
  });
  return sheetData;
}

export async function importExcelData(sheetData: SheetData, fields: Field[], mapping: ExcelFormColMap, titleRowIndex: number, widget: SubForm) {
  // 标题行有纵向的单元格合并时，会占用多行
  let titleRowHeight = Math.max(...(sheetData.mergeData[titleRowIndex]?.map(item => item?.rowspan ?? 1) ?? [1]));

  let rows: Row[] = [], totalCount = 0;
  if (!sheetData.isSheetNull) {
    rowLoop:
    for (let rowIndex = titleRowIndex + titleRowHeight; rowIndex < sheetData.rows.length; rowIndex++) {
      const row = sheetData.rows[rowIndex];
      const newRow: Row = {};
      const curRowspanArr: number[] = sheetData.mergeData[rowIndex]?.map(item => item?.rowspan ?? 1) ?? [1];
      let minRowspan = Math.min(...curRowspanArr);
      if (minRowspan <= 0) continue rowLoop; // 当前行存在被纵向合并单元格，则识别为子表单行，跳过处理
      totalCount++;

      for (const [col, uid] of Object.entries(mapping)) {
        const colIndex = Number(col.replace('col-', ''));
        const field: Field = fields.find(field => field.uid === uid);
        const cellLocation: ExcelLocation = { c: colIndex, r: rowIndex };
        // 字段校验，作为导入行是否成功的依据
        const processRes = await processCellData(row[colIndex], field, widget);
        if (processRes.valid) {
          newRow[uid] = processRes.data;
        } else {
          continue rowLoop;
        }
      }
      rows.push(newRow);
    }
  }

  return {
    rows,
    successImportCount: rows.length,
    total: totalCount,
  }
}

const specialFieldProcessArr: SpecialFieldProcess[] = [{
  type: 'widget.form.phoneInput',
  processor: async ({ data }) => {
    data = String(data);
    let valid = dataRegex.phone.test(data.trim());
    return { data, valid };
  }
}, {
  type: 'widget.form.address',
  processor: async ({ data }) => {
    // e.g.河北省/石家庄市/长安区/建北街道 AA小区3栋2单元203
    let valid = dataRegex.address.test(data.trim());
    return { data, valid };
  }
}, {
  type: 'widget.form.datePicker',
  processor: async ({ data, field }) => {
    let instance: dayjs.Dayjs = customDayjs(data);
    let valid = instance?.isValid();
    if (valid) {
      data = instance.format(field.meta.extra.format);
    }
    return { data, valid };
  }
}, {
  type: 'widget.form.dateRangePicker',
  processor: async ({ data, field }) => {
    let valid = true;
    let timeArr: any[] = data?.split(',');
    if (!Array.isArray(timeArr) || timeArr.length !== 2) {
      valid = false;
    } else {
      for (const i in timeArr) {
        let time = timeArr[i];
        let instance: dayjs.Dayjs = customDayjs(time);
        valid = instance?.isValid();
        if (!valid) break;
        time = instance.format(field.meta.extra.format);
      }
    }
    return { data: timeArr, valid };
  }
}, {
  type: 'widget.form.memberSelect',
  processor: async ({ data, widget }) => {
    let valid = true;
    const users = await widget.getBoard().getOrganizeUsers();
    const user: NocodeUser = users.find(user => user.realname === data);
    if (user) data = [user.id];
    else valid = false;
    return { data, valid };
  }
}, {
  type: 'widget.form.departmentSelect',
  processor: async ({ data, widget }) => {
    let valid = true;
    const departmentList = flattenDepartments(await widget.getBoard().getOrganizeDepartments());
    const dep: Department = departmentList.find(dep => dep.name === data);
    if (dep) data = [dep.id];
    else valid = false;
    return { data, valid };
  }
}, {
  type: 'widget.form.serialNumber',
  processor: async ({ data }) => {
    let valid = true;
    data = '';
    return { data, valid };
  }
}]

export async function processCellData(data: any, field: Field, widget: SubForm) {
  const specialFieldProcess = specialFieldProcessArr.find(item => item.type === field.meta.extra.widgetType);
  let processRes: SpecialFieldProcessRes = { data, valid: true };
  if (specialFieldProcess) {
    processRes = await specialFieldProcess.processor({ data, field, widget });
  }
  return processRes;
}

function flattenDepartments(departments: Department[]) {
  const result: Department[] = []
  function dfs(list: Department[]) {
    for (const item of list) {
      result.push(item) // 先加自己
      if (item.children && item.children.length > 0) {
        dfs(item.children) // 递归子节点
      }
    }
  }
  dfs(departments)
  return result
}

export const provideEnterPress = (enterPress: ((uid: string) => void)) => {
  return provide('subform-enter-press', enterPress);
}

export const injectEnterPress = (): ((uid: string) => void) => {
  return inject('subform-enter-press', null);
}

export const injectAutoSubmitEmitter = (): ((payload: { type: "fieldEnter" | "mobileScan"; fieldUid?: string; value?: any }) => void) => {
  return inject('FORM_AUTO_SUBMIT_EMITTER', null);
}
