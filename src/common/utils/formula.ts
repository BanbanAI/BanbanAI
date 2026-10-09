import { all, arg, create, index } from "mathjs";
import * as formulajs from "@formulajs/formulajs";
import dayjs from "dayjs";
import isLeapYear from 'dayjs/plugin/isLeapYear';
import utc from "dayjs/plugin/utc";
import arraySupport from "dayjs/plugin/arraySupport"
import customParseFormat from "dayjs/plugin/customParseFormat";
import dayOfYear from "dayjs/plugin/dayOfYear";
import weekOfYear from "dayjs/plugin/weekOfYear";
import isoWeek from "dayjs/plugin/isoWeek";
import { unique } from "@common/utils/unique";
import { deepClone, equals, isEmpty } from "@common/utils/object";
import { Field, Row, Table, TableUID } from "@common/types/project";
import { FilterRule, NocodeFormData } from "@common/types/nocode";
import { compareStrictCustomDateInfo, isStrictCustomDateString } from "@common/utils/validate";

dayjs.extend(utc);
dayjs.extend(isLeapYear);
import i18next from "i18next";
import { SystemField } from "./connection";

type Formula = { name: string, subName: string, intro: string, usage: string, example: string, argOfNotTableCol?: number[], argStrOfdefault?: string, ignoreBlankReplace?: boolean, extraContext?: boolean }

type FormulaList = {
  title: string,
  category: FormulaCategory,
  isExpanded?: boolean,
  children: Formula[],
}[];

type caculationField = {
  formulaFields?: Field[],
  defaultFields?: Field[]
}

export type FormulaConfig = {
  formula: string,
  filterRules: Record<string, Record<TableUID, FilterRule>> // <functionId, Record<tableUID, FilterRule>>
}

export type FormulaContext = {
  row?: Row,
  recordId?: any,
}

export type FormulaRuntime = {
  context?: FormulaContext | null,
  scope: Record<string, any>,
  evaluate: (formula: string) => any,
}

export class FormulaContextMissingError extends Error {
  code = "FORMULA_CONTEXT_MISSING";
  functionNames: string[];

  constructor(functionNames: string[]) {
    super(`Formula requires runtime context for: ${functionNames.join(", ")}`);
    this.name = "FormulaContextMissingError";
    this.functionNames = functionNames;
  }
}

export const isFormulaContextMissingError = (error: unknown): error is FormulaContextMissingError => {
  return error instanceof FormulaContextMissingError
    || ((error as FormulaContextMissingError)?.name === "FormulaContextMissingError");
}

enum ComparisonOperator {
  NOT_EQUAL_EQ = '<>',
  LARGER_EQ = '>=',
  LARGER = '>',
  SMALLER_EQ = '<=',
  SMALLER = '<',
  NOT_EQ = '!=',
  EQ = '==',
}

const EXCEL_FAKE_LEAP_OFFSET = (d: dayjs.Dayjs) => {
  // 1900-03-01 及之后的日期
  return d.isAfter("1900-02-28") ? 1 : 0;
};

function equalsArrat(...args) {
  if (args.length < 2) return false;
  const comparison = args.at(-1);
  const arrays = args.slice(0, -1);
  return arrays.every(arr => {
    if (!Array.isArray(arr) || (Array.isArray(comparison) && comparison.length !== arr.length)) return false;

    return arr.every((item, index) => {
      const comparisonItem = Array.isArray(comparison) ? comparison[index] : comparison;
      return equals(comparisonItem, item);
    })
  })
}

function isComparableDateString(value: any) {
  if (typeof value !== 'string') return false;
  return isStrictCustomDateString(value);
}

function compareComparableDate(a: any, b: any, operator: ComparisonOperator) {
  if (!isComparableDateString(a) || !isComparableDateString(b)) return null;

  const comparableDateInfo = compareStrictCustomDateInfo(a, b);
  if (!comparableDateInfo) return null;

  return standardCompare(comparableDateInfo.dateA.valueOf(), comparableDateInfo.dateB.valueOf(), operator);
}

function robustCompare(a: any, b: any, operator: ComparisonOperator): boolean {
  if (isEmpty(a) || isEmpty(b)) return standardCompare(a, b, operator);

  const comparableDateResult = compareComparableDate(a, b, operator);
  if (comparableDateResult !== null) {
    return comparableDateResult;
  }

  let dateA = a;
  let dateB = b;
  if (!(dateA instanceof Date) && isNaN(Number(a))) dateA = new Date(dateA);
  if (!(dateB instanceof Date) && isNaN(Number(b))) dateB = new Date(dateB);

  if (!isNaN(Number(dateA?.getTime?.())) && !isNaN(Number(dateB?.getTime?.()))) {
    return standardCompare(dateA, dateB, operator);
  }

  return standardCompare(a, b, operator);
}

function standardCompare(a: any, b: any, operator: ComparisonOperator): boolean {
  switch (operator) {
    case ComparisonOperator.LARGER: return a > b;
    case ComparisonOperator.LARGER_EQ: return a >= b;
    case ComparisonOperator.SMALLER: return a < b;
    case ComparisonOperator.SMALLER_EQ: return a <= b;
    case ComparisonOperator.NOT_EQ: return a != b;
    case ComparisonOperator.EQ: return a == b;
    default: return false;
  }
}

function toSafeDate(input: any): Date | null {
  const d = dayjs(input);
  if (!d.isValid()) return null;

  return new Date(
    d.year(),
    d.month(),
    d.date()
  );
}

const DATE_FORMAT = "YYYY-MM-DD HH:mm:ss";
const DATE_VALUE_FORMATS = [
  DATE_FORMAT,
  "YYYY-MM-DD HH:mm",
  "YYYY-MM-DD HH",
  "YYYY-MM-DD",
  "YYYY-MM",
  "YYYY",
];

function isDateString(val: any): boolean {
  if (typeof val !== "string") return false;
  return DATE_VALUE_FORMATS.some(format => dayjs(val, format, true).isValid());
}

function isTimeString(v: any) {
  return typeof v === "string" &&
    /^\d{2}:\d{2}:\d{2}$/.test(v);
}

function parseToDayjs(v: any) {
  if (isTimeString(v)) {
    return dayjs(`1900-01-01 ${v}`);
  }
  return dayjs(v);
}

const excelAdd = function (a: any, b: any) {
  const aIsDate = isDateString(a);
  const bIsDate = isDateString(b);
  const aIsTime = isTimeString(a);
  const bIsTime = isTimeString(b);

  if (
    (aIsDate && typeof b === "number") ||
    (bIsDate && typeof a === "number")
  ) {
    const dateVal = aIsDate ? a : b;
    const numVal = typeof a === "number" ? a : b;

    const ms = numVal * 86400000;

    return dayjs(parseToDayjs(dateVal).valueOf() + ms)
      .format(DATE_FORMAT);
  }

  if (
    (aIsTime && typeof b === "number") ||
    (bIsTime && typeof a === "number")
  ) {
    const timeVal = aIsTime ? a : b;
    const numVal = typeof a === "number" ? a : b;

    const ms = numVal * 86400000;

    return dayjs(parseToDayjs(timeVal).valueOf() + ms)
      .format("HH:mm:ss");
  }

  if (
    (aIsDate && bIsTime) ||
    (aIsTime && bIsDate)
  ) {
    const dateVal = aIsDate ? a : b;
    const timeVal = aIsTime ? a : b;

    const seconds =
      parseToDayjs(timeVal).diff(dayjs("1900-01-01"), "second");

    return parseToDayjs(dateVal)
      .add(seconds, "second")
      .format(DATE_FORMAT);
  }

  if (aIsTime && bIsTime) {
    const secondsA =
      parseToDayjs(a).diff(dayjs("1900-01-01"), "second");
    const secondsB =
      parseToDayjs(b).diff(dayjs("1900-01-01"), "second");

    return dayjs("1900-01-01")
      .add(secondsA + secondsB, "second")
      .format("HH:mm:ss");
  }

  if (aIsDate && bIsDate) {
    const secondsA =
      parseToDayjs(a).diff(dayjs("1900-01-01"), "second");
    const secondsB =
      parseToDayjs(b).diff(dayjs("1900-01-01"), "second");

    return dayjs("1900-01-01")
      .add(secondsA + secondsB, "second")
      .format(DATE_FORMAT);
  }

  return originAdd(a, b);
};

const excelSubtract = function (a: any, b: any) {
  const aIsDate = isDateString(a);
  const bIsDate = isDateString(b);
  const aIsTime = isTimeString(a);
  const bIsTime = isTimeString(b);

    if (aIsDate && typeof b === "number") {
      const ms = b * 86400000;

      return dayjs(parseToDayjs(a).valueOf() - ms)
        .format(DATE_FORMAT);
    }

  if (aIsDate && bIsDate) {
    const diffSeconds = parseToDayjs(a).diff(parseToDayjs(b), "second");
    return diffSeconds / 86400;
  }

  if (aIsDate && bIsTime) {
    const seconds =
      parseToDayjs(b).diff(dayjs("1900-01-01"), "second");
    return parseToDayjs(a)
      .subtract(seconds, "second")
      .format(DATE_FORMAT);
  }

  if (aIsTime && bIsTime) {
    const diffSeconds =
      parseToDayjs(a).diff(parseToDayjs(b), "second");
    return diffSeconds / 86400;
  }

  if (aIsTime && typeof b === "number") {
    const ms = b * 86400000;

    return dayjs(parseToDayjs(a).valueOf() - ms)
      .format("HH:mm:ss");
  }

  return originSubtract(a, b);
};

// Excel 空白
function isExcelBlank(v: any): boolean {
  return (
    v === null ||
    v === undefined ||
    v === "" ||
    (v instanceof Array && v.length === 0) ||
    (v instanceof Object && Object.keys(v).length === 0)
  );
}
export enum FormulaCategory {
  /** 常用函数 */
  COMMON = "common",
  /** 数学函数 */
  MATH = "math",
  /** 文本函数 */
  TEXT = "text",
  /** 日期函数 */
  DATE = "date",
  /** 逻辑函数 */
  LOGIC = "logic",
  /** 高级函数 */
  ADVANCED = "advanced",
}
export const formulaList: FormulaList = [
  {
    get title(){return i18next.t('commonFormula.commonFunction.title')},
    category: FormulaCategory.COMMON,
    isExpanded: false,
    children: [
      {
        name: "CONCATENATE",
        get subName(){return i18next.t('commonFormula.commonFunction.concatDesc')},
        get intro(){return i18next.t('commonFormula.commonFunction.concatDescDetail')} ,
        get usage(){return i18next.t('commonFormula.commonFunction.concatSyntax')},
        get example(){return i18next.t('commonFormula.commonFunction.concatExample')}
      },
      {
        name: "DATE",
        get subName(){return i18next.t('commonFormula.commonFunction.dateConvertDesc')},
        get intro(){return i18next.t('commonFormula.commonFunction.dateConvertDescDetail')} ,
        get usage(){return i18next.t('commonFormula.commonFunction.dateSyntax')},
        get example(){return i18next.t('commonFormula.commonFunction.dateExample')}
      },
      {
        name: "DATEDIF",
        get subName(){return i18next.t('commonFormula.commonFunction.dateDiffDesc')},
        get intro(){return i18next.t('commonFormula.commonFunction.dateDiffDescDetail')} ,
        get usage(){return i18next.t('commonFormula.commonFunction.dateDiffSyntax')},
        get example(){return i18next.t('commonFormula.commonFunction.dateDiffExample')}
      },
      {
        name: "IF",
        get subName(){return i18next.t('commonFormula.commonFunction.ifDesc')},
        get intro(){return i18next.t('commonFormula.commonFunction.ifDescDetail')} ,
        get usage(){return i18next.t('commonFormula.commonFunction.ifSyntax')},
        get example(){return i18next.t('commonFormula.commonFunction.ifExample')}
      },
      {
        name: "SUM",
        get subName(){return i18next.t('commonFormula.commonFunction.sumDesc')},
        get intro(){return i18next.t('commonFormula.commonFunction.sumDescDetail')} ,
        get usage(){return i18next.t('commonFormula.commonFunction.sumSyntax')},
        get example(){return i18next.t('commonFormula.commonFunction.sumExample')}
      },
    ]
  },
  {
    get title(){return i18next.t('commonFormula.mathFunction.title')},
    category: FormulaCategory.MATH,
    isExpanded: false,
    children: [
      {
        name: "ABS",
        get subName(){return i18next.t('commonFormula.mathFunction.absDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.absDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.absSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.absExample')}
      },
      // {
      //     name: "ADD",
      //     subName: "计算和",
      //     intro: "计算多个数字的和",
      //     usage: "ADD(数字1,数字2....数字N)",
      //     example: "ADD(1,2,7)的结果是10"
      // },
      {
        name: "AVERAGE",
        get subName(){return i18next.t('commonFormula.mathFunction.averageDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.averageDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.averageSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.averageExample')}
      },
      {
        name: "AVERAGECOLUMN",
        get subName(){return i18next.t('commonFormula.mathFunction.averageColumnDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.averageColumnDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.averageColumnSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.averageColumnExample')},
        argOfNotTableCol: []
      },
      {
        name: "CEILING",
        get subName(){return i18next.t('commonFormula.mathFunction.ceilingDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.ceilingDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.ceilingSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.ceilingExample')}
      },
      // {
      //     name: "COS",
      //     subName:"余弦",
      //     intro: "计算角度的余弦值，计算时需要先将角度转化为弧度。",
      //     usage: "COS(弧度)。",
      //     example: "COS(RADIANS(60))，返回0.5。"
      // },
      // {
      //     name: "COT",
      //     subName:"余切",
      //     intro: "计算角度的余切值，计算时需要先将角度转化为弧度。",
      //     usage: "COT(弧度)。",
      //     example: "COT(RADIANS(45))，返回1。"
      // },
      {
        name: "COUNT",
        get subName(){return i18next.t('commonFormula.mathFunction.countDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.countDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.countSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.countExample')},
        ignoreBlankReplace: true
      },
      {
        name: "COUNTA",
        get subName(){return i18next.t('commonFormula.mathFunction.countADesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.countADescDetail')},
        get usage(){return i18next.t('commonFormula.mathFunction.countASyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.countAExample')},
        ignoreBlankReplace: true
      },
      {
        name: "COUNTBLANK",
        get subName(){return i18next.t('commonFormula.mathFunction.countBlankDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.countBlankDescDetail')},
        get usage(){return i18next.t('commonFormula.mathFunction.countBlankSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.countBlankExample')},
        ignoreBlankReplace: true
      },
      {
        name: "COUNTIF",
        get subName(){return i18next.t('commonFormula.mathFunction.countIfDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.countIfDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.countIfSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.countIfExample')}
      },
      {
        name: "COUNTIFS",
        get subName(){return i18next.t('commonFormula.mathFunction.countIfsDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.countIfsDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.countIfsSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.countIfsExample')}
      },
      // {
      //     name: "COUNTCHAR",
      //     subName: "文本字符统计",
      //     intro: "统计多个文本字段的字符总数量",
      //     usage: "COUNT（文本1,文本2....文本N）",
      //     example: 'COUNT("文本1","文本2")，假设文本1和2的内容分别为"张三""杭州市"，最终统计结果为5'
      // },
      {
        name: "FIXED",
        get subName(){return i18next.t('commonFormula.mathFunction.fixedDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.fixedDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.fixedSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.fixedExample')}
      },
      {
        name: "FLOOR",
        get subName(){return i18next.t('commonFormula.mathFunction.floorDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.floorDesc')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.floorSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.floorExample')}
      },
      {
        name: "INT",
        get subName(){return i18next.t('commonFormula.mathFunction.intDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.intDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.intSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.intExample')}
      },
      {
        name: "LARGE",
        get subName(){return i18next.t('commonFormula.mathFunction.largeDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.largeDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.largeSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.largeExample')},
        argStrOfdefault: ",1"
      },
      {
        name: "LARGECOLUMN",
        get subName(){return i18next.t('commonFormula.mathFunction.largeColumnDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.largeColumnDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.largeColumnSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.largeColumnExample')},
        argOfNotTableCol: [-1],
        argStrOfdefault: ",1"
      },
      {
        name: "LOG",
        get subName(){return i18next.t('commonFormula.mathFunction.logDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.logDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.logSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.logExample')}
      },
      {
        name: "MAX",
        get subName(){return i18next.t('commonFormula.mathFunction.maxDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.maxDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.maxSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.maxExample')}
      },
      {
        name: "MIN",
        get subName(){return i18next.t('commonFormula.mathFunction.minDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.minDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.minSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.minExample')}
      },
      {
        name: "MOD",
        get subName(){return i18next.t('commonFormula.mathFunction.modDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.modDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.modSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.modExample')}
      },
      {
        name: "POWER",
        get subName(){return i18next.t('commonFormula.mathFunction.powerDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.powerDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.powerSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.powerExample')}
      },
      {
        name: "PRODUCT",
        get subName(){return i18next.t('commonFormula.mathFunction.productDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.productDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.productSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.productExample')}
      },
      // {
      //     name: "RADIANS",
      //     subName:"角度转弧度",
      //     intro: "将角度转为弧度。",
      //     usage: "RADIANS(角度)。",
      //     example: 'RADIANS(180)，返回3.14159265。'
      // },
      // {
      //     name: "RAND",
      //     subName:"获取随机实数",
      //     intro: "返回大于等于0且小于1的均匀分布随机实数。",
      //     usage: "RAND()。",
      //     example: 'RAND()返回0.424656'
      // },
      {
        name: "ROUND",
        get subName(){return i18next.t('commonFormula.mathFunction.roundDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.roundDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.roundSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.roundExample')}
      },
      {
        name: "ROUNDDOWN",
        get subName(){return i18next.t('commonFormula.mathFunction.roundDownDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.roundDownDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.roundDownSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.roundDownExample')}
      },
      // {
      //     name: "SIN",
      //     subName:"正弦",
      //     intro: "计算角度的正弦值，计算时需要先将角度转化为弧度。",
      //     usage: "SIN(弧度)。",
      //     example: 'SIN(RADIANS(30))，返回0.5。'
      // },
      {
        name: "SMALL",
        get subName(){return i18next.t('commonFormula.mathFunction.smallDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.smallDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.smallSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.smallExample')},
        argStrOfdefault: ",1"
      },
      {
        name: "SMALLCOLUMN",
        get subName(){return i18next.t('commonFormula.mathFunction.smallColumnDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.smallColumnDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.smallColumnSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.smallColumnExample')},
        argOfNotTableCol: [-1],
        argStrOfdefault: ",1"
      },
      {
        name: "SQRT",
        get subName(){return i18next.t('commonFormula.mathFunction.sqrtDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.sqrtDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.sqrtSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.sqrtExample')}
      },
      {
        name: "SUM",
        get subName(){return i18next.t('commonFormula.mathFunction.sumDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.sumDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.sumSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.sumExample')}
      },
      {
        name: "SUMCOLUMN",
        get subName(){return i18next.t('commonFormula.mathFunction.sumColumnDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.sumColumnDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.sumColumnSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.sumColumnExample')},
        argOfNotTableCol: []
      },
      {
        name: "SUMPRODUCT",
        get subName(){return i18next.t('commonFormula.mathFunction.sumProductDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.sumProductDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.sumProductSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.sumProductExample')}
      },
      {
        name: "SUMIF",
        get subName(){return i18next.t('commonFormula.mathFunction.sumIfDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.sumIfDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.sumIfSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.sumIfExample')}
      },
      {
        name: "SUMIFS",
        get subName(){return i18next.t('commonFormula.mathFunction.sumIfsDesc')},
        get intro(){return i18next.t('commonFormula.mathFunction.sumIfsDescDetail')} ,
        get usage(){return i18next.t('commonFormula.mathFunction.sumIfsSyntax')},
        get example(){return i18next.t('commonFormula.mathFunction.sumIfsExample')}
      },
      // {
      //     name: "TAN",
      //     subName:"正切",
      //     intro: "计算角度的正切值，计算时需要先将角度转化为弧度。",
      //     usage: "TAN(弧度)。",
      //     example: 'TAN(RADIANS(45))，返回1。'
      // },
    ]
  },
  {
    get title(){return i18next.t('commonFormula.textFunction.title')},
    category: FormulaCategory.TEXT,
    isExpanded: false,
    children: [
      // {
      //     name: "ARRAYGET",
      //     subName: "获取指定值",
      //     intro: "获取子表单的字段中指定第几个的值",
      //     usage: "ARRAYGET(子表单字段,数据位置)",
      //     example: "ARRAYGET(销售业绩.合同额,3)为获取子表单销售业绩的合同额字段中第3条数据的值"
      // },
      {
        name: "CHAR",
        get subName(){return i18next.t('commonFormula.textFunction.charDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.charDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.charSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.charExample')}
      },
      {
        name: "CONCATENATE",
        get subName(){return i18next.t('commonFormula.textFunction.concatDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.concatDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.concatSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.concatExample')}
      },
      {
        name: "EXACT",
        get subName(){return i18next.t('commonFormula.textFunction.exactDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.exactDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.exactSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.exactExample')}
      },
      // {
      //     name: "IP",
      //     subName:"获取IP地址",
      //     intro: "获取当前用户IP地址",
      //     usage: "IP()",
      //     example: '无'
      // },
      // {
      //     name: "ISEMPTY",
      //     subName:"判断是否为空",
      //     intro: "用来判断值是否为空文本、空对象或者空数组。",
      //     usage: "ISEMPTY(文本)。",
      //     example: '略。'
      // },
      {
        name: "JOIN",
        get subName(){return i18next.t('commonFormula.textFunction.joinDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.joinDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.joinSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.joinExample')}
      },
      {
        name: "LEFT",
        get subName(){return i18next.t('commonFormula.textFunction.leftDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.leftDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.leftSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.leftExample')}
      },
      {
        name: "LEN",
        get subName(){return i18next.t('commonFormula.textFunction.lenDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.lenDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.lenSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.lenExample')}
      },
      {
        name: "LOWER",
        get subName(){return i18next.t('commonFormula.textFunction.lowerDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.lowerDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.lowerSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.lowerExample')}
      },
      {
        name: "MID",
        get subName(){return i18next.t('commonFormula.textFunction.midDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.midDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.midSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.midExample')}
      },
      // {
      //     name: "PINYINHEADCHAR",
      //     subName: "首字母拼接",
      //     intro: "返回文本中的每个汉字的首字母，以大写字母拼接",
      //     usage: "PINYINHEADCHAR(文本)",
      //     example: 'PINYINHEADCHAR("今天天气很不错")结果为"JTTQHBC"'
      // },
      {
        name: "REGEXREPLACE",
        get subName(){return i18next.t('commonFormula.textFunction.regexReplaceDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.regexReplaceDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.regexReplaceSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.regexReplaceExample')}
      },
      {
        name: "REPLACE",
        get subName(){return i18next.t('commonFormula.textFunction.replaceDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.replaceDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.replaceSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.replaceExample')}
      },
      {
        name: "REPT",
        get subName(){return i18next.t('commonFormula.textFunction.reptDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.reptDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.reptSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.reptExample')}
      },
      {
        name: "RIGHT",
        get subName(){return i18next.t('commonFormula.textFunction.rightDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.rightDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.rightSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.rightExample')}
      },
      {
        name: "RMBFORMAT",
        get subName(){return i18next.t('commonFormula.textFunction.rmbFmtDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.rmbFmtDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.rmbFmtSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.rmbFmtExample')}
      },
      {
        name: "SEARCH",
        get subName(){return i18next.t('commonFormula.textFunction.searchDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.searchDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.searchSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.searchExample')}
      },
      {
        name: "SPLIT",
        get subName(){return i18next.t('commonFormula.textFunction.splitDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.splitDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.splitSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.splitExample')}
      },
      {
        name: "TEXT",
        get subName(){return i18next.t('commonFormula.textFunction.textDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.textDesc')} ,
        get usage(){return i18next.t('commonFormula.textFunction.textDescDtl')},
        get example(){return i18next.t('commonFormula.textFunction.textExample')}
      },
      {
        name: "TRIM",
        get subName(){return i18next.t('commonFormula.textFunction.trimDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.trimDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.trimSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.trimExample')}
      },
      // {
      //     name: "UPPER",
      //     subName: "小写转大写",
      //     intro: "将文本中的所有小写字母转换为大写字母",
      //     usage: "UPPER(文本)",
      //     example: 'UPPER("aBcD")结果为"ABCD"'
      // },
      {
        name: "UNION",
        get subName(){return i18next.t('commonFormula.textFunction.unionDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.unionDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.unionSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.unionExample')}
      },
      // {
      //     name: "UPPER",
      //     subName:"小写转大写",
      //     intro: "将一个文本中的所有小写字母转换为大写字母。",
      //     usage: 'UPPER(文本)。',
      //     example: 'UPPER(文本)。'
      // },
      {
        name: "UUID",
        get subName(){return i18next.t('commonFormula.textFunction.randCodeDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.randCodeDescDtl')} ,
        usage: "UUID()",
        get example(){return i18next.t('commonFormula.textFunction.randCodeExample')}
      },
      {
        name: "VALUE",
        get subName(){return i18next.t('commonFormula.textFunction.valueDesc')},
        get intro(){return i18next.t('commonFormula.textFunction.valueDescDtl')} ,
        get usage(){return i18next.t('commonFormula.textFunction.valueSyntax')},
        get example(){return i18next.t('commonFormula.textFunction.valueExample')}
      }
    ]
  },
  {
    get title(){return i18next.t('commonFormula.dateFunction.title')},
    category: FormulaCategory.DATE,
    isExpanded: false,
    children: [
      {
        name: "DATE",
        get subName(){return i18next.t('commonFormula.dateFunction.dateDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.dateDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.dateSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.dateExample')}
      },
      // {
      //     name: "DATEDELTA",
      //     subName:"加减日期天数",
      //     intro: "将指定日期加/减指定天数。",
      //     usage: 'DATE(时间戳)。',
      //     example: '略。'
      // },
      {
        name: "DAY",
        get subName(){return i18next.t('commonFormula.dateFunction.dayDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.dayDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.daySyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.dayExample')}
      },
      {
        name: "DAYS",
        get subName(){return i18next.t('commonFormula.dateFunction.daysDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.daysDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.daysSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.daysExample')}
      },
      {
        name: "DAYS360",
        get subName(){return i18next.t('commonFormula.dateFunction.days360Desc')},
        get intro(){return i18next.t('commonFormula.dateFunction.days360DescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.days360Syntax')},
        get example(){return i18next.t('commonFormula.dateFunction.days360Example')}
      },
      {
        name: "DATEDIF",
        get subName(){return i18next.t('commonFormula.dateFunction.dateDifDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.dateDifDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.dateDifSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.dateDifExample')}
      },
      {
        name: "HOUR",
        get subName(){return i18next.t('commonFormula.dateFunction.hourDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.hourDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.hourSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.hourExample')}
      },
      {
        name: "ISOWEEKNUM",
        get subName(){return i18next.t('commonFormula.dateFunction.isoWeeknumDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.isoWeeknumDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.isoWeeknumSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.isoWeeknumExample')}
      },
      {
        name: "MINUTE",
        get subName(){return i18next.t('commonFormula.dateFunction.minuteDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.minuteDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.minuteSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.minuteExample')}
      },
      {
        name: "MONTH",
        get subName(){return i18next.t('commonFormula.dateFunction.monthDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.monthDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.monthSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.monthExample')}
      },
      {
        name: "NETWORKDAYS",
        get subName(){return i18next.t('commonFormula.dateFunction.netDaysDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.netDaysDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.netDaysSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.netDaysExample')}
      },
      {
        name: "NOW",
        get subName(){return i18next.t('commonFormula.dateFunction.curTimeDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.curTimeDesc')} ,
        usage: "NOW()",
        get example(){return i18next.t('commonFormula.dateFunction.curTimeExample')}
      },
      {
        name: "SECOND",
        get subName(){return i18next.t('commonFormula.dateFunction.secondDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.secondDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.secondSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.secondExample')}
      },
      // {
      //     name: "SYSTIME",
      //     subName:"获取当前服务器时间",
      //     intro: "获取当前服务器时间。",
      //     usage: 'SYSTIME()。',
      //     example: '略。'
      // },
      {
        name: "TIME",
        get subName(){return i18next.t('commonFormula.dateFunction.timeDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.timeDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.timeSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.timeExample')}
      },
      {
        name: "TIMESTAMP",
        get subName(){return i18next.t('commonFormula.dateFunction.timeStampDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.timeStampDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.timeStampSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.timeStampExample')}
      },
      {
        name: "TODAY",
        get subName(){return i18next.t('commonFormula.dateFunction.todayDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.todayDescDtl')} ,
        usage: "TODAY()",
        get example(){return i18next.t('commonFormula.dateFunction.todayExample')}
      },
      {
        name: "WEEKDAY",
        get subName(){return i18next.t('commonFormula.dateFunction.weekDayDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.weekDayDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.weekDaySyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.weekDayExample')}
      },
      {
        name: "WEEKNUM",
        get subName(){return i18next.t('commonFormula.dateFunction.weeknumDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.weeknumDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.weeknumSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.weeknumExample')}
      },
      {
        name: "WORKDAY",
        get subName(){return i18next.t('commonFormula.dateFunction.workdayDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.workdayDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.workdaySyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.workdayExample')}
      },
      {
        name: "YEAR",
        get subName(){return i18next.t('commonFormula.dateFunction.yearDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.yearDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.yearSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.yearExample')}
      },
      {
        name: "EDATE",
        get subName(){return i18next.t('commonFormula.dateFunction.edateDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.edateDesc')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.edateSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.edateExample')}
      },
      {
        name: "EOMONTH",
        get subName(){return i18next.t('commonFormula.dateFunction.eomonthDesc')},
        get intro(){return i18next.t('commonFormula.dateFunction.eomonthDescDtl')} ,
        get usage(){return i18next.t('commonFormula.dateFunction.eomonthSyntax')},
        get example(){return i18next.t('commonFormula.dateFunction.eomonthExample')}
      }
    ]
  },
  {
    get title(){return i18next.t('commonFormula.logicFunction.title')},
    category: FormulaCategory.LOGIC,
    isExpanded: false,
    children: [
      {
        name: "AND",
        get subName(){return i18next.t('commonFormula.logicFunction.andDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.andDescDtl')} ,
        get usage(){return i18next.t('commonFormula.logicFunction.andSyntax')},
        get example(){return i18next.t('commonFormula.logicFunction.andExample')}
      },
      {
        name: "IF",
        get subName(){return i18next.t('commonFormula.logicFunction.ifDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.ifDescDtl')} ,
        get usage(){return i18next.t('commonFormula.logicFunction.ifSyntax')},
        get example(){return i18next.t('commonFormula.logicFunction.ifExample')}
      },
      {
        name: "IFS",
        get subName(){return i18next.t('commonFormula.logicFunction.ifsDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.ifsDescDtl')} ,
        get usage(){return i18next.t('commonFormula.logicFunction.ifsSyntax')},
        get example(){return i18next.t('commonFormula.logicFunction.ifsExample')}
      },
      {
        name: "ISEMPTY",
        get subName(){return i18next.t('commonFormula.logicFunction.isEmptyDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.isEmptyDescDtl')} ,
        get usage(){return i18next.t('commonFormula.logicFunction.isEmptySyntax')},
        get example(){return i18next.t('commonFormula.logicFunction.isEmptyExample')}
      },
      {
        name: "NOT",
        get subName(){return i18next.t('commonFormula.logicFunction.notDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.notDescDtl')} ,
        get usage(){return i18next.t('commonFormula.logicFunction.notSyntax')},
        get example(){return i18next.t('commonFormula.logicFunction.notExample')}
      },
      {
        name: "OR",
        get subName(){return i18next.t('commonFormula.logicFunction.orDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.orDescDtl')} ,
        get usage(){return i18next.t('commonFormula.logicFunction.orSyntax')},
        get example(){return i18next.t('commonFormula.logicFunction.orExample')}
      },
      {
        name: "XOR",
        get subName(){return i18next.t('commonFormula.logicFunction.xorDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.xorDescDtl')} ,
        get usage(){return i18next.t('commonFormula.logicFunction.xorSyntax')},
        get example(){return i18next.t('commonFormula.logicFunction.xorExample')}
      },
      {
        name: "False",
        get subName(){return i18next.t('commonFormula.logicFunction.falseDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.falseDescDtl')} ,
        usage: "FALSE()",
        get example(){return i18next.t('commonFormula.logicFunction.falseExample')}
      },
      {
        name: "True",
        get subName(){return i18next.t('commonFormula.logicFunction.trueDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.trueDescDtl')} ,
        usage: "TRUE()",
        get example(){return i18next.t('commonFormula.logicFunction.trueExample')}
      },
      {
        name: "CONTAINS",
        get subName(){return i18next.t('commonFormula.logicFunction.containsDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.containsDescDtl')} ,
        get usage(){return i18next.t('commonFormula.logicFunction.containsSyntax')},
        get example(){return i18next.t('commonFormula.logicFunction.containsExample')}
      },
      {
        name: "CONTAINSCOLUMN",
        get subName(){return i18next.t('commonFormula.logicFunction.containsColDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.containsColDescDtl')} ,
        get usage(){return i18next.t('commonFormula.logicFunction.containsColSyntax')},
        get example(){return i18next.t('commonFormula.logicFunction.containsColExample')},
        argOfNotTableCol: []
      },
      {
        name: "EQUAL",
        get subName(){return i18next.t('commonFormula.logicFunction.equalDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.equalDescDtl')} ,
        get usage(){return i18next.t('commonFormula.logicFunction.equalSyntax')},
        get example(){return i18next.t('commonFormula.logicFunction.equalExample')}
      },
      {
        name: "EQUALCOLUMN",
        get subName(){return i18next.t('commonFormula.logicFunction.equalColDesc')},
        get intro(){return i18next.t('commonFormula.logicFunction.equalColDescDtl')} ,
        get usage(){return i18next.t('commonFormula.logicFunction.equalColSyntax')},
        get example(){return i18next.t('commonFormula.logicFunction.equalColExample')},
        argOfNotTableCol: []
      },
    ]
  },
  {
    get title(){return i18next.t('commonFormula.advancedFunction.title')},
    category: FormulaCategory.ADVANCED,
    isExpanded: false,
    children: [
      {
        name: "TEXTLOCATION",
        get subName(){return i18next.t('commonFormula.advancedFunction.textLocDesc')},
        get intro(){return i18next.t('commonFormula.advancedFunction.textLocSyntax')} ,
        get usage(){return i18next.t('commonFormula.advancedFunction.textLocSyntaxSimple')},
        get example(){return i18next.t('commonFormula.advancedFunction.textLocExample')}
      },
      {
        name: "GETID",
        get subName(){return i18next.t('commonFormula.advancedFunction.getIDDesc')},
        get intro(){return i18next.t('commonFormula.advancedFunction.getIDSyntax')} ,
        get usage(){return i18next.t('commonFormula.advancedFunction.getIDSyntaxSimple')},
        get example(){return i18next.t('commonFormula.advancedFunction.getIDExample')},
        extraContext: true
      },
    ]
  }
]

export function getFormulaOfColArguments(): Formula[] {
  return formulaList.flatMap(category =>
    (category.children || []).filter(child => Array.isArray(child.argOfNotTableCol))
  );
}


dayjs.extend(arraySupport);
dayjs.extend(customParseFormat);
dayjs.extend(dayOfYear);
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

function padStartZero(num: number, length: number = 2): string {
  return num.toString().padStart(length, '0');
}

function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  return format
    .replace(/y{4}/g, year.toString())
    .replace(/y{2,3}/g, year.toString().slice(-2))
    .replace(/y/g, year.toString()) // 支持单个y
    .replace(/Y{4}/g, year.toString())
    .replace(/Y{2,3}/g, year.toString().slice(-2))
    .replace(/Y/g, year.toString())
    .replace(/M{3,4}/g, padStartZero(month))
    .replace(/M{1,2}/g, month.toString())
    .replace(/d{2}/g, padStartZero(day))
    .replace(/d/g, day.toString()) // 支持单个d
    .replace(/D{2}/g, padStartZero(day))
    .replace(/D/g, day.toString()) // 支持大写D
    .replace(/H{2}/g, padStartZero(hours))
    .replace(/H/g, hours.toString()) // 支持大写H
    .replace(/h{2}/g, padStartZero(hours))
    .replace(/h/g, hours.toString()) // 支持小写h
    .replace(/m{2}/g, padStartZero(minutes))
    .replace(/m/g, minutes.toString())
    .replace(/s{2}/g, padStartZero(seconds))
    .replace(/s/g, seconds.toString());
}

// 4位数rmb转换
function convertFourDigits(n) {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const numStr = n.toString().padStart(4, '0').split('');
  let result = '';
  let lastZero = false;
  let hasValue = false;

  for (let i = 0; i < 4; i++) {
    const digit = parseInt(numStr[i]);
    const unit = units[3 - i];

    if (digit === 0) {
      if (hasValue && !lastZero) { //防止第一位就是0
        lastZero = true;
      }
    } else {
      if (lastZero) { //上一位为0
        result += '零';
        lastZero = false;
      }
      result += digits[digit] + unit;
      hasValue = true;
    }
  }

  if (result.endsWith('零')) {
    result = result.slice(0, -1);
  }

  return result;
}

// 字符串格式化成正则表达式
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& 表示整个匹配的字符串
}

// rmb转换
function convertSection(n, unit) {
  if (n === 0) return '';
  const str = convertFourDigits(n);
  return str + unit;
}

// 是否是闰年
// function isLeapYear(year) {
//   return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
// }

// function daysInYear(year) {
//   return isLeapYear(year) ? 366 : 365;
// }

function wildcardMatch(text: string, pattern: string): boolean {
  if (!pattern) return !text;
  if (!text) return pattern === '*';

  const regexSpecialChars = /[.+^${}()|[\]\\]/;
  let regexStr = '^';
  let i = 0;
  
  while (i < pattern.length) {
    const current = pattern[i];

    if (current === '~' && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      if (next === '*' || next === '?' || next === '~') {
        if (next === '*' || next === '?') {
          regexStr += '\\' + next;
        } else {
          regexStr += '~';
        }
        i += 2;
      } else {
        regexStr += '~';
        i++;
      }
    } else if (current === '*') {
      regexStr += '.*';
      i++;
    } else if (current === '?') {
      regexStr += '.';
      i++;
    } else {
      regexStr += regexSpecialChars.test(current) ? '\\' + current : current;
      i++;
    }
  }

  regexStr += '$';
  const regex = new RegExp(regexStr, 'i');
  return regex.test(text);
}

function evaluateComparison(value: string, compareValue: string, operator: ComparisonOperator): boolean {
  if (typeof value == 'string' && typeof compareValue == 'string') {
    const valueIsDate = isComparableDateString(value);
    const compareValueIsDate = isComparableDateString(compareValue);

    if (!valueIsDate || !compareValueIsDate) {
      if (operator === ComparisonOperator.EQ) return wildcardMatch(value, compareValue);
      else if (operator === ComparisonOperator.NOT_EQ || operator === ComparisonOperator.NOT_EQUAL_EQ) return !wildcardMatch(value, compareValue);
    }
  }
  return robustCompare(value, compareValue, operator);
}

function parseComparisonCriteria(criteria: any): { operator: ComparisonOperator; compareValue: string } | null {
  const operators = Object.values(ComparisonOperator);

  if (!(typeof criteria === "string")) {
    return {
      operator: ComparisonOperator.EQ,
      compareValue: criteria,
    }
  }

  criteria = criteria.trim();
  const operator = operators.find(o => criteria.startsWith(o));
  const compareValue = criteria.substring(operator?.length ?? 0);
  return {
    operator: operator ?? ComparisonOperator.EQ,
    compareValue: compareValue.trim(),
  }
}

const mathjs = create(all)
const originAdd = mathjs.add;
const originSubtract = mathjs.subtract;
mathjs.import({
  // 数字函数
  "ABS": function (number: number) {
    return isNaN(number) ? 0 : Math.abs(number)
  },
  "ADD": function (...args) {
    const results = [];
    for (const arg of args) {
      if (arg?.toArray) {
        results.push(...arg.toArray())
      } else if (Array.isArray(arg)) {
        results.push(...arg);
      } else {
        results.push(arg);
      }
    }
    return results.reduce((accumulator, currentValue) => {
      let nAccumulator = Number(accumulator);
      if (isNaN(nAccumulator)) {
        nAccumulator = 0
      }
      let nCurrentValue = Number(currentValue);
      if (isNaN(nCurrentValue)) {
        nCurrentValue = 0
      }
      return nAccumulator + nCurrentValue;
    }, 0);
  },
  "AVERAGE": function (...args) {
    let results = [];
    for (const arg of args) {
      if (arg?.toArray) {
        results.push(...arg.toArray())
      } else if (Array.isArray(arg)) {
        results.push(...arg);
      } else {
        results.push(arg);
      }
    }
    if (results.length == 0) {
      return 0;
    }
    results = results.filter((item) => !isNaN(item))
    return results.reduce((accumulator, currentValue) => {
      let nAccumulator = Number(accumulator);
      if (isNaN(nAccumulator)) {
        nAccumulator = 0
      }
      let nCurrentValue = Number(currentValue);
      if (isNaN(nCurrentValue)) {
        nCurrentValue = 0
      }
      return nAccumulator + nCurrentValue;
    }, 0) / results.length;
  },
  "AVERAGECOLUMN": function (...args) {
    let results = [];
    for (const arg of args) {
      if (arg?.toArray) {
        results.push(...arg.toArray())
      } else if (Array.isArray(arg)) {
        results.push(...arg);
      } else {
        results.push(arg);
      }
    }
    if (results.length == 0) {
      return 0;
    }
    results = results.filter((item) => !isNaN(item))
    return results.reduce((accumulator, currentValue) => {
      let nAccumulator = Number(accumulator);
      if (isNaN(nAccumulator)) {
        nAccumulator = 0
      }
      let nCurrentValue = Number(currentValue);
      if (isNaN(nCurrentValue)) {
        nCurrentValue = 0
      }
      return nAccumulator + nCurrentValue;
    }, 0) / results.length;
  },
  "CEILING": function (number: number, factor: number) {
    if (typeof number !== "number" && typeof factor !== "number") return
    if (factor === 0) {
      return 0;
    }
    return Math.ceil(number / factor) * factor;
  },
  "COS": function (number: number) {
    if (isNaN(number)) {
      return
    }
    return Math.cos(number);
  },
  "COT": function (number: number) {
    if (isNaN(number)) {
      return
    }
    const sinValue = Math.sin(number);
    if (sinValue === 0) {
      return Infinity;
    }
    return Math.cos(number) / sinValue;
  },
  "COUNT": function (range: any[]) {
    let count = 0;
    for (const v of range) {
      if (typeof v === "number" || isDateString(v) || isTimeString(v)) count++;
    }
    return count;
  },
  "COUNTA": function (range: any[]) {
    let count = 0;
    for (const v of range) {
      if (!isExcelBlank(v)) count++;
    }
    return count;
  },
  "COUNTBLANK": function (range: any[]) {
    let count = 0;
    for (const v of range) {
      if (isExcelBlank(v)) count++;
    }
    return count;
  },
  "COUNTIF": function (range, criteria) {
    const { operator, compareValue } = parseComparisonCriteria(criteria);
    let total = 0;

    for (let i = 0; i < range.length; i++) {
      const compare = range[i];
      const resultOfContrast = evaluateComparison(compare, compareValue, operator);
      if (resultOfContrast) {
        total += 1;
      }
    }

    return total;
  },
  "COUNTIFS": function (...conditions) {
    if (conditions.length % 2 !== 0) return 0;

    let total = 0;

    outerLoop:
    for (let i = 0; i < conditions[0].length; i++) {
      for (let j = 0; j < conditions.length / 2; j++) {
        const range = conditions[j * 2];
        const criteria = conditions[j * 2 + 1];
        const { operator, compareValue } = parseComparisonCriteria(criteria);
        const compare = range[i];
        const resultOfContrast = evaluateComparison(compare, compareValue, operator);

        if (!resultOfContrast) {
          continue outerLoop;
        }
      }
      total += 1;
    }

    return total;
  },
  "FIXED": function (number: number, decimalPlaces: number) {
    if (typeof number !== "number") return
    if (typeof number !== "number") {
      decimalPlaces = 0
    }
    return number.toFixed(decimalPlaces);
  },
  "FLOOR": function (number: number, significance) {
    try {
      // 尝试使用 formulajs 的 TEXT 函数
      const result = formulajs.FLOOR(number, significance);
      if (result instanceof Error) {
        throw result;
      }
      return result;
    } catch (error) {
      return undefined;
    }
  },
  "INT": function (number: number) {
    return isNaN(number) ? '' : Math.floor(number);
  },
  "LARGE": function (array: number[], k: number) {
    if (!Array.isArray(array) || array.length === 0) {
      return
    }
    if (typeof k !== "number" || k < 1 || k > array.length) {
      return
    }
    const uniqueSortedArray = Array.from(new Set(array)).sort((a, b) => b - a);
    return uniqueSortedArray[k - 1];
  },
  "LARGECOLUMN": function (...args: (number | number[])[]): number {
    if (args.length < 2) {
      throw new Error(`LARGECOLUMN${i18next.t('commonFormula.funcErrMin2Param')}`);
    }

    const n = args[args.length - 1];

    if (typeof n !== 'number') {
      throw new Error(`LARGECOLUMN${i18next.t('commonFormula.funcErrLastIsNum')}`);
    }

    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`LARGECOLUMN${i18next.t('commonFormula.funcErrRankGt0')}`);
    }

    const dataArgs = args.slice(0, -1);

    const allValues: number[] = [];

    dataArgs.forEach(arg => {
      if (Array.isArray(arg)) {
        const validNumbers = arg.filter(item => typeof item === 'number');
        allValues.push(...validNumbers);
      } else if (typeof arg === 'number') {
        allValues.push(arg);
      }
    });

    if (allValues.length === 0) {
      throw new Error(`LARGECOLUMN${i18next.t('commonFormula.funcErrNoValidNum')}`);
    }

    if (n > allValues.length) {
      throw new Error(`${i18next.t('commonFormula.funcRankParam')}${n}${i18next.t('commonFormula.funcRankOutRange')}${allValues.length}${i18next.t('commonFormula.funcRankValidCount')}`);
    }

    const sortedValues = [...allValues].sort((a, b) => b - a);
    return sortedValues[n - 1];
  },
  "LOG": function (number: number, base: number = 10) {
    if (isNaN(number) || isNaN(base)) {
      return
    }
    return Math.log(number) / Math.log(base);
  },
  "MAX": function (...args) {
    const results = [];
    for (const arg of args) {
      if (arg?.toArray) {
        results.push(...arg.toArray())
      } else if (Array.isArray(arg)) {
        results.push(...arg);
      } else {
        results.push(arg);
      }
    }
    return Math.max(...results);
  },
  "MIN": function (...args) {
    const results = [];
    for (const arg of args) {
      if (arg?.toArray) {
        results.push(...arg.toArray())
      } else if (Array.isArray(arg)) {
        results.push(...arg);
      } else {
        results.push(arg);
      }
    }
    return Math.min(...results);
  },
  "MOD": function (number: number, divisor: number) {
    if (isNaN(number) || isNaN(divisor)) {
      return
    }
    return ((number % divisor) + divisor) % divisor;
  },
  "POWER": function (number: number, power: number) {
    if (isNaN(number) || isNaN(power)) {
      return
    }
    return Math.pow(number, power);
  },
  "PRODUCT": function (...args) {
    const values = [];
    for (const arg of args) {
      if (arg?.toArray) {
        values.push(...arg.toArray());
      } else if (Array.isArray(arg)) {
        values.push(...arg);
      } else {
        values.push(arg);
      }
    }
    if (values.length === 0) {
      return 0; // 没有参数时返回0
    }
    return values.reduce((accumulator, currentValue) => accumulator * currentValue, 1);
  },
  "RADIANS": function (angle: number) {
    return (angle * Math.PI) / 180;
  },
  "RAND": function () {
    return Math.random();
  },
  "ROUND": function (number: number, num_digits: number, keepExtraDecimals = false) {
    const multiplier = Math.pow(10, num_digits);
    let roundedNumber = Math.round(Math.abs(number) * multiplier) / multiplier;
    if (number < 0) {
      roundedNumber *= -1;
    }
    if (!keepExtraDecimals) {
      // 过滤9999,0000等精度计算丢失导致的多余数字
      const roundedString = roundedNumber.toString();
      const decimalIndex = roundedString.indexOf('.');
      if (decimalIndex !== -1) {
        const decimalPart = roundedString.substring(decimalIndex + 1);
        if (decimalPart.length > num_digits && (/^0+$/.test(decimalPart) || /^9+$/.test(decimalPart))) {
          roundedNumber = Math.round(roundedNumber);
        }
      }
    }
    return roundedNumber;
  },
  "ROUNDDOWN": function (number: number, num_digits: number = 0) {
    if (isNaN(number) || isNaN(num_digits)) {
      return
    }
    const multiplier = Math.pow(10, num_digits);
    let roundedNumber = Math.floor(Math.abs(number) * multiplier) / multiplier;
    if (number < 0) {
      roundedNumber *= -1;
    }
    return roundedNumber;
  },
  "SIN": function (number: number) {
    return Math.sin(number);
  },
  "SMALL": function (array: number[], k: number) {
    if (!Array.isArray(array) || array.length === 0) {
      return;
    }
    if (typeof k !== "number" || k < 1 || k > array.length) {
      return;
    }
    const uniqueSortedArray = Array.from(new Set(array)).sort((a, b) => a - b);
    return uniqueSortedArray[k - 1];
  },
  "SMALLCOLUMN": function (...args: (number | number[])[]): number {
    if (args.length < 2) {
      throw new Error(`SMALLCOLUMN${i18next.t('commonFormula.funcErrMin2Param')}`);
    }

    const n = args[args.length - 1];

    if (typeof n !== 'number') {
      throw new Error(`SMALLCOLUMN${i18next.t('commonFormula.funcErrLastIsNum')}`);
    }

    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`SMALLCOLUMN${i18next.t('commonFormula.funcErrRankGt0')}`);
    }

    const dataArgs = args.slice(0, -1);

    const allValues: number[] = [];

    dataArgs.forEach(arg => {
      if (Array.isArray(arg)) {
        const validNumbers = arg.filter(item => typeof item === 'number');
        allValues.push(...validNumbers);
      } else if (typeof arg === 'number') {
        allValues.push(arg);
      }
    });

    if (allValues.length === 0) {
      throw new Error(`SMALLCOLUMN${i18next.t('commonFormula.funcErrNoValidNum')}`);
    }

    if (n > allValues.length) {
      throw new Error(`${i18next.t('commonFormula.funcRankParam')}${n}${i18next.t('commonFormula.funcRankOutRange')}${allValues.length}${i18next.t('commonFormula.funcRankValidCount')}`);
    }

    const sortedValues = [...allValues].sort((a, b) => a - b);
    return sortedValues[n - 1];
  },
  "SQRT": function (number: number) {
    return Math.sqrt(number);
  },
  "SUM": function (...args) {
    const results = [];
    for (const arg of args) {
      if (arg?.toArray) {
        results.push(...arg.toArray())
      } else if (Array.isArray(arg)) {
        results.push(...arg);
      } else {
        results.push(arg);
      }
    }
    return results.reduce((accumulator, currentValue) => {
      let nAccumulator = Number(accumulator);
      if (isNaN(nAccumulator)) {
        nAccumulator = 0
      }
      let nCurrentValue = Number(currentValue);
      if (isNaN(nCurrentValue)) {
        nCurrentValue = 0
      }
      return nAccumulator + nCurrentValue;
    }, 0);
  },
  "SUMCOLUMN": function (...args) {
    const results = [];
    for (const arg of args) {
      if (arg?.toArray) {
        results.push(...arg.toArray())
      } else if (Array.isArray(arg)) {
        results.push(...arg);
      } else {
        results.push(arg);
      }
    }
    return results.reduce((accumulator, currentValue) => {
      let nAccumulator = Number(accumulator);
      if (isNaN(nAccumulator)) {
        nAccumulator = 0
      }
      let nCurrentValue = Number(currentValue);
      if (isNaN(nCurrentValue)) {
        nCurrentValue = 0
      }
      return nAccumulator + nCurrentValue;
    }, 0);
  },
  "CONTAINS": function (...args) {
    if (args.length < 2) return false;
    const comparison = args.at(-1);
    const arrays = args.slice(0, -1);
    return arrays.every(arr => Array.isArray(arr) && arr.includes(comparison));
  },
  "CONTAINSCOLUMN": function (...args) {
    if (args.length < 2) return false;
    const comparison = args.at(-1);
    const arrays = args.slice(0, -1);
    return arrays.every(arr => Array.isArray(arr) && arr.includes(comparison));
  },
  "EQUAL": function (...args) {
    return equalsArrat(...args);
  },
  "EQUALCOLUMN": function (...args) {
    return equalsArrat(...args);
  },
  "SUMPRODUCT": function (...args) {
    const maxLength = Math.max(...args.map(array => array.length));
    const paddedArrays = args.map(array =>
      Array.from({ length: maxLength }, (item, i) => (i < array.length ? array[i] : 0))
    );
    return paddedArrays[0].reduce((sum, cur, index) => {
      const product = paddedArrays.map(array => array[index]).reduce((prod, num) => prod * num, 1);
      return sum + product
    }, 0)
  },
  "SUMIF": function (range, criteria, sum_range) {
    const {operator, compareValue} = parseComparisonCriteria(criteria);
    let total = 0;
    for (let i = 0; i < range.length; i++) {
      const compare = range[i];
      const result = sum_range && sum_range.length > i ? sum_range[i]
        : sum_range ? 0
        : compare;

      const resultOfContrast = evaluateComparison(compare, compareValue, operator)
      total += resultOfContrast ? result : 0;
    }
    return total;
  },
  "SUMIFS": function (sum_range, ...conditions) {
    if (conditions.length % 2 !== 0) return 0;

    let total = 0;
    outerLoop:
    for (let i = 0; i < sum_range.length; i++) {
      const result = sum_range[i] ?? 0;
      for (let j = 0; j < conditions.length / 2; j++) {
        const range = conditions[j * 2];
        const criteria = conditions[j * 2 + 1];
        const {operator, compareValue} = parseComparisonCriteria(criteria);
        const compare = range[i];
        const resultOfContrast = evaluateComparison(compare, compareValue, operator);
        if (!resultOfContrast) continue outerLoop;
      }
      total += result;
    }
    return total;
  },
  "TAN": function (number: number) {
    return Math.tan(number);
  },
  //文本函数
  "ARRAYGET": function (arrayStr: string, index: number) {
    // return array[index - 1];
    return '';
  },
  "CONCATENATE": function (...args) {
    return args.flat().join('');
  },
  "CHAR": function (...args) {
    return String.fromCharCode(args[0]);
  },
  "EXACT": function (text1, text2) {
    return text1 === text2;
  },
  //TODO
  // "IP":  function(){

  // },
  "ISEMPTY": function (value) {
    if (typeof value === 'string' && value.trim() === '') return true;
    // if (Array.isArray(value) && value.length === 0) return true;
    // if (value instanceof Object && Object.keys(value).length === 0 && value.constructor === Object) return true;
    return isEmpty(value);
  },
  "JOIN": function (array: [], connector = "") {
    return array.flat().join(connector)
  },
  "LEFT": function (text, num_chars = 1) {
    if (typeof text === 'string' && typeof num_chars === 'number' && num_chars >= 0) {
      return text.slice(0, num_chars);
    } else {
      return "#VALUE";
    }
  },
  "LEN": function (args) {
    if (typeof args === 'string') {
      return args.length;
    } else if (Array.isArray(args)) {
      return args.length;
    } else {
      return;
    }
  },
  "LOWER": function (text: string) {
    if (typeof text === 'string') {
      return text.toLowerCase();
    } else {
      return;
    }
  },
  "MID": function (text: string, start_num: number, num_chars: number) {
    if (typeof text !== 'string' || start_num < 1 || num_chars < 0) {
      return;
    }
    if (start_num > text.length) {
      return "";
    }
    return text.substring(start_num - 1, start_num - 1 + num_chars);
  },
  "REGEXREPLACE": function (
    text: unknown,
    pattern: unknown,
    replacement: unknown,
    occurrence: unknown = 0,
    caseSensitivity: unknown = 0,
  ) {
    if (arguments.length < 3) return "#VALUE";

    const occurrenceNumber = Number(occurrence);
    const caseSensitivityNumber = Number(caseSensitivity);
    if (
      !Number.isInteger(occurrenceNumber)
      || ![0, 1].includes(caseSensitivityNumber)
    ) {
      return "#VALUE";
    }

    const sourceText = String(text ?? "");
    const patternText = String(pattern ?? "");
    const replacementText = String(replacement ?? "");
    const regex = new RegExp(patternText, caseSensitivityNumber === 1 ? "giu" : "gu");

    if (occurrenceNumber === 0) {
      return sourceText.replace(regex, replacementText);
    }

    const matches = Array.from(sourceText.matchAll(regex));
    const targetIndex = occurrenceNumber > 0
      ? occurrenceNumber - 1
      : matches.length + occurrenceNumber;
    const targetMatch = matches[targetIndex];
    if (!targetMatch || targetMatch.index === undefined) return sourceText;

    const matchStart = targetMatch.index;
    const matchEnd = matchStart + targetMatch[0].length;
    const resolvedReplacement = replacementText.replace(
      /\$(\$|&|`|'|<[^>]+>|0[1-9]|[1-9]\d?)/g,
      (placeholder, token: string) => {
        if (token === "$") return "$";
        if (token === "&") return targetMatch[0];
        if (token === "`") return sourceText.slice(0, matchStart);
        if (token === "'") return sourceText.slice(matchEnd);
        if (token.startsWith("<")) {
          if (!targetMatch.groups) return placeholder;
          const groupName = token.slice(1, -1);
          return targetMatch.groups[groupName] ?? "";
        }

        const groupIndex = Number(token);
        if (groupIndex < targetMatch.length) {
          return targetMatch[groupIndex] ?? "";
        }
        if (token.length === 2 && token[0] !== "0") {
          const fallbackGroupIndex = Number(token[0]);
          if (fallbackGroupIndex < targetMatch.length) {
            return `${targetMatch[fallbackGroupIndex] ?? ""}${token[1]}`;
          }
        }
        return placeholder;
      },
    );

    return sourceText.slice(0, matchStart) + resolvedReplacement + sourceText.slice(matchEnd);
  },
  "REPLACE": function (text, texttoreplace, Num_chars, numChars) {
    if (typeof text !== 'string') {
      return;
    }
    if (Num_chars !== undefined && numChars !== undefined) {
      const prefix = text.slice(0, texttoreplace - 1);
      const suffix = text.slice(texttoreplace - 1 + Num_chars);
      return prefix + numChars + suffix;
    } else {
      return text.replace(new RegExp(escapeRegExp(texttoreplace), 'g'), Num_chars);
    }
  },
  "REPT": function (text: string, count: number) {
    return Array(count + 1).join(text);
  },
  "RIGHT": function (text: string, num_chars = 1) {
    if (typeof text !== 'string' || typeof num_chars !== 'number' || num_chars < 0) {
      return '';
    } else if (num_chars == 0) {
      return "";
    }
    return text.slice(-num_chars);
  },
  "RMBFORMAT": function (number: number) {
    if (number === undefined || number === null) return '';

    const numberToChineseUpper = {
      '0': '零',
      '1': '壹',
      '2': '贰',
      '3': '叁',
      '4': '肆',
      '5': '伍',
      '6': '陆',
      '7': '柒',
      '8': '捌',
      '9': '玖',
    };
    const numStr = String(number).split('.');
    let integerPart = numStr[0] || '0';
    let decimalPart = (numStr[1] || '').slice(0, 2);

    const A = Math.floor(parseInt(integerPart) / 1e8);
    const B = Math.floor((parseInt(integerPart) % 1e8) / 1e4);
    const C = parseInt(integerPart) % 1e4;

    const partA = convertSection(A, '亿');
    const partB = convertSection(B, '万');
    const partC = convertSection(C, '元');

    let rmbStr = partA + partB + partC;

    const jiao = decimalPart[0] || '0';
    const fen = decimalPart[1] || '0';
    let decimalStr = '';

    if (jiao !== '0' || fen !== '0') {
      if (jiao !== '0') {
        decimalStr += numberToChineseUpper[jiao] + '角';
      }
      if (fen !== '0') {
        decimalStr += numberToChineseUpper[fen] + '分';
      }
    } else {
      rmbStr += '整';
    }

    let result
    if (integerPart === '0') {
      if (decimalStr === '') {
        result = i18next.t('commonFormula.rmbZeroYuan');
      } else {
        result = i18next.t('commonFormula.rmbPrefix') + decimalStr;
      }
    } else {
      result = i18next.t('commonFormula.rmbPrefix') + rmbStr + decimalStr;
    }
    return result;
  },
  "SEARCH": function (text1: string, text2: string) {
    if (typeof text1 !== 'string' || typeof text2 !== 'string') {
      return
    }
    if (text1 === '') {
      return 0;
    }
    const position = text2.indexOf(text1);
    return position !== -1 ? position + 1 : 0;
  },
  "SPLIT": function (String1, String2) {
    if (arguments.length <= 1) {
      return '#VALUE!';
    }
    if (typeof String1 !== 'string' || typeof String2 !== 'string') {
      return '#VALUE!';
    }
    return String1.split(String2);
  },
  "TEXT": function (value: any, format?: string) {
    if (value === null || value === undefined) {
      return '';
    }

    if (format === undefined) {
      return String(value);
    }

    try {
      // 尝试使用 formulajs 的 TEXT 函数
      const result = formulajs.TEXT(value, format);
      if (result instanceof Error) {
        throw result;
      }
      return result;
    } catch (error) {
      // 如果 formulajs 处理失败，回退到自定义实现
      if (value instanceof Date || Object.prototype.toString.call(value) === '[object Date]') {
        return formatDate(value, format);
      } else if (typeof value === 'string' && !isNaN(Date.parse(value))) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return formatDate(date, format);
        }
      } else if (typeof value === 'number') {
        if (value > 19000101 && format.match(/y{1,4}|M{1,4}|d{1,2}/)) {
          const dateStr = value.toString();
          const year = parseInt(dateStr.substring(0, 4));
          const month = parseInt(dateStr.substring(4, 6)) - 1;
          const day = parseInt(dateStr.substring(6, 8));
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            return formatDate(date, format);
          }
        } else if (value > 0 && format.match(/y{1,4}|M{1,4}|d{1,2}|H{1,2}|m{1,2}|s{1,2}/)) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return formatDate(date, format);
          }
        }
      }
      return String(value);
    }
  },
  "TRIM": function (text) {
    if (typeof text === 'string') {
      return text.trim();
    } else {
      return null;
    }
  },
  "UNION": function (...args) {
    if (args.length === 0) {
      return null;
    }
    let result = new Set();
    for (let arg of args) {
      if (Array.isArray(arg)) {
        for (let item of arg) {
          result.add(item);
        }
      }
      else if (typeof arg === 'string') {
        result.add(arg);
      }
      else {
        return null;
      }
    }

    return Array.from(result);
  },
  "UPPER": function (text) {
    if (typeof text === 'string') {
      return text.toUpperCase();
    } else {
      return null;
    }
  },
  "VALUE": function (text: string) {
    if (typeof text !== 'string' || text.trim() === '') {
      return undefined;
    }
    const result = Number(text);
    return isNaN(result) ? undefined : result;
  },
  "DATE": function (...args) {
    const hasInvalidArg = args.some(arg =>
      arg === null || arg === undefined || (typeof arg === 'number' && isNaN(arg)) || arg === ""
    );

    if (hasInvalidArg) {
      return null;
    }

    if (args.length === 1) {
      let timestamp = args[0];
      return dayjs(timestamp).format("YYYY-MM-DD");
    } else if (args.length >= 2 && args.length <= 6) {
      const year = args[0];
      const month = (args[1] || 1) - 1;
      const day = args[2] || 1;
      const hour = args[3] || 0;
      const minute = args[4] || 0;
      const second = args[5] || 0;

      if (year < 1900) {
        const base = dayjs.utc("1900-01-01");

        const offset = dayjs.utc("1900-01-01")
          .add(year, "year")
          .add(month, "month")
          .add(day, "day")
          .add(hour, "hour")
          .add(minute, "minute")
          .add(second, "second");
        return offset.diff(base, "day", true) + EXCEL_FAKE_LEAP_OFFSET(offset);
      }

      const date = new Date(year, month, day, hour, minute, second);

      if (isNaN(date.getTime())) {
        return "";
      }

      if (args.length === 2) {
        return dayjs(date).format("YYYY-MM");
      } else if (args.length === 3) {
        return dayjs(date).format("YYYY-MM-DD");
      } else if (args.length === 4) {
        return dayjs(date).format("YYYY-MM-DD HH");
      } else if (args.length === 5) {
        return dayjs(date).format("YYYY-MM-DD HH:mm");
      } else if (args.length === 6) {
        return dayjs(date).format("YYYY-MM-DD HH:mm:ss");
      }
    }

    return "";

  },
  "DATEDELTA": function (dateString, deltaDays) {
    if (typeof dateString === 'string' && typeof deltaDays === 'number') {
      const date = new Date(dateString);
      date.setDate(date.getDate() + deltaDays);
      return date.toISOString().split('T')[0];
    } else {
      return null;
    }
  },
  "DATEDIF": function (...args) {
    let start_date, end_date, unit, method;
    if (Array.isArray(args[0])) {
      start_date = args[0][0];
      end_date = args[0][1];
      unit = args[1];
      method = args[1];
    } else {
      start_date = args[0];
      end_date = args[1];
      unit = args[2];
      method = args[3];
    }

    const d1 = dayjs(start_date);
    const d2 = dayjs(end_date);
    if (!d1.isValid()|| !d2.isValid()) return null;

    switch (unit) {
        case 'Y':
        case 'y': {
            let years = d2.year() - d1.year();
            if (d2.month() < d1.month() || (d2.month() === d1.month() && d2.date() < d1.date())) {
                years--;
            }
            return Math.abs(years);
        }
        case 'M': {
          let months = (d2.year() - d1.year()) * 12 + (d2.month() - d1.month());
          const forward = d2.isAfter(d1) || d2.isSame(d1);

          const startIsFeb29 = d1.month() === 1 && d1.date() === 29;
          const endIsFeb28NonLeap = d2.month() === 1 && d2.date() === 28 && !d2.isLeapYear();
                
          if (forward) {
            if (!(startIsFeb29 && endIsFeb28NonLeap)) {
              if (d2.date() < d1.date()) months--;
            }
          } else {
            // 反向
            const endIsFeb29 = d2.month() === 1 && d2.date() === 29;
            const startIsFeb28NonLeap = d1.month() === 1 && d1.date() === 28 && !d1.isLeapYear();
          
            if (!(endIsFeb29 && startIsFeb28NonLeap)) {
              if (d2.date() > d1.date()) months++;
            }
          }
        
          return months;
        }
        case 'D':
        case 'd':
            return d2.diff(d1, 'day');
        case 'H':
        case 'h':
            return d2.diff(d1, 'hour');
        case 'm':
            return d2.diff(d1, 'minute');
        case 'S':
        case 's':
            return d2.diff(d1, 'second');
        case 'MD':
          let mdDiff = d2.date() - d1.date();
          return mdDiff < 0 ? Math.abs((d1.daysInMonth() - d1.date()) + d2.date()) : mdDiff;
        case 'YM':{
            let months = (d2.month() - d1.month());
            if (d2.date() < d1.date()) {
                months--;
            }
            return Math.abs((months + 12) % 12);
        }
        case 'YD': {
            const baseYear = d1.year();
            const baseStart = dayjs(`${baseYear}-${d1.month() + 1}-${d1.date()}`);
            let baseEnd = dayjs(`${baseYear}-${d2.month() + 1}-${d2.date()}`);
            if (baseEnd.isBefore(baseStart)) {
                baseEnd = baseEnd.add(1, 'year');
            }
            return Math.abs(baseEnd.diff(baseStart, 'day'));
        }
        default:
            return d2.diff(d1, 'day');
    }
  },
  "DAY": function getDayBySerial(serial_number: number | string): number | null {
    let d: dayjs.Dayjs;

    if (typeof serial_number === 'number') {
      d = dayjs('1899-12-30').add(serial_number, 'day');
    } else if (typeof serial_number === 'string') {
      d = dayjs(serial_number);
    } else {
      return null;
    }

    if (!d.isValid()) return null;

    return d.date();
  },
  "DAYS": function (...args) {
    // 兼容 DAYS(TODAY()-日期) 这类先做日期减法、再包 DAYS 的旧写法
    if (!Array.isArray(args[0]) && args.length === 1) {
      return typeof args[0] === 'number' && !Number.isNaN(args[0]) ? args[0] : null;
    }

    let startDate, endDate;
    if (Array.isArray(args[0])) {
      startDate = args[0][0];
      endDate = args[0][1];
    } else {
      startDate = args[0];
      endDate = args[1];
    }

    if (endDate === undefined) {
      return null;
    }

    const start = dayjs(startDate);
    const end = dayjs(endDate);

    if (!start.isValid() || !end.isValid()) {
      return null;
    }

    // 按“整天差”计算，等价于 Excel / DATEDIF 的 D
    return end.diff(start, 'day');
  },
  "DAYS360": function (...args: any[]) {
  let start_date: any;
  let end_date: any;
  let method = false; // false = US(NASD), true = EU(30E/360)

  if (Array.isArray(args[0])) {
    start_date = args[0][0];
    end_date = args[0][1];
    method = !!args[1];
  } else {
    start_date = args[0];
    end_date = args[1];
    method = !!args[2];
  }

  const start = dayjs(start_date);
  const end = dayjs(end_date);

  if (!start.isValid() || !end.isValid()) return null;

  let y1 = start.year();
  let m1 = start.month(); // 0-based
  let d1 = start.date();

  let y2 = end.year();
  let m2 = end.month();
  let d2 = end.date();

  const isLastDayOfFeb = (d: dayjs.Dayjs) =>
    d.month() === 1 && d.date() === d.daysInMonth();

  if (method) {
    // 🇪🇺 欧洲法 30E/360
    if (d1 === 31) d1 = 30;
    if (d2 === 31) d2 = 30;
  } else {
    // 🇺🇸 美国法 30US/360（Excel 默认）
    if (isLastDayOfFeb(start)) {
      d1 = 30;
    } else if (d1 === 31) {
      d1 = 30;
    }

    if (d2 === 31) {
      if (d1 < 30) {
        // 不调整（保持 31）
      } else {
        d2 = 30;
      }
    }
  }

  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
},
  "HOUR": function (serial_number, format) {
    let date;
    if (typeof serial_number === 'number') {
      date = dayjs(serial_number);
    } else {
      date = dayjs(serial_number, format);
    }

    if (!date.isValid()) {
      return null;
    }
    const hour = date.hour();
    return hour;
  },
  "ISOWEEKNUM": function (date) {
    const day = dayjs(date);
    if (!day.isValid()) {
      return null;
    }
    return day.isoWeek();
  },
  "MINUTE": function (timestamp) {
    if (timestamp === undefined) return '';
    const minute = dayjs(timestamp).minute();
    return minute;
  },
  "MONTH": function (timestamp) {
    if (timestamp === undefined) return '';
    const month = dayjs(timestamp).month() + 1;
    return month;
  },
  "NETWORKDAYS": function (...args) {
    let startInput: any;
    let endInput: any;
    let holidaysInput: any[] = [];

    try {
      if (Array.isArray(args[0])) {
        startInput = args[0][0];
        endInput = args[0][1];
        holidaysInput = Array.isArray(args[1]) ? args[1] : [];
      } else {
        startInput = args[0];
        endInput = args[1];
        holidaysInput = Array.isArray(args[2]) ? args[2] : [];
      }

      const startDate = toSafeDate(startInput);
      const endDate = toSafeDate(endInput);
      if (!startDate || !endDate) return null;

      const holidayDates = holidaysInput
      .map(toSafeDate)
      .filter(Boolean) as Date[]

      const result = formulajs.NETWORKDAYS(
        startDate,
        endDate,
        holidayDates
      );
      return typeof result === 'number' && !isNaN(result) ? result : null;
    } catch (error) {
      // 如果formulajs版本出错，回退到原来的实现
      return undefined;
    }
  },
  "NOW": function () {
    return dayjs().format('YYYY-MM-DD HH:mm:ss');
  },
  "SECOND": function (timestamp) {
    const second = dayjs(timestamp).second();
    return second;
  },
  // "SYSTIME": function () {

  // },
  "TIME": function (...args) {
    return dayjs().hour(args[0]).minute(args[1]).second(args[2]).millisecond(0).format('HH:mm:ss');
  },
  "TIMESTAMP": function (date: any) {
    const d = dayjs(date);

    if (!d.isValid()) {
      throw new Error(`${i18next.t('commonFormula.dateErrParse')} ${date}`);
    }

    return d.valueOf();
  },
  "TODAY": function () {
    return dayjs().format('YYYY-MM-DD');
  },
  "WEEKDAY": function (serial_number: any, return_type?: any) {
    // 将系列数转换为日期
    const date = toSafeDate(serial_number)
    try {
      const result = formulajs.WEEKDAY(date, return_type);
      return isNaN(result as number) ? null : result;
    } catch (error) {
      return undefined;
    }
  },
  "WEEKNUM": function (date) {
    const day = dayjs(date);
    if (!day.isValid()) {
      return null;
    }
    return dayjs(date).week();
  },
  "WORKDAY": function (start_date: any, days: any, holidays: any = []) {
    const date = toSafeDate(start_date);
    if (!date) return null;

    const holidayDates = holidays
      .map(toSafeDate)
      .filter(Boolean) as Date[]
    try {
      const day = formulajs.WORKDAY(date, days, holidayDates) as Date;
      return isNaN(day.getTime()) ? null : formatDate(day, 'yyyy-MM-dd');
    } catch (error) {
      return null;
    }
  },
  "YEAR": function (date) {
    const day = dayjs(date);
    if (!day.isValid()) {
      return null;
    }
    return dayjs(date).year();
  },
  "EDATE": function (start_date, months) { 
    const startDate = toSafeDate(start_date);
    try {
      const result = formulajs.EDATE(startDate, months);
      const day = dayjs(result);
      return day.isValid() ? day.format('YYYY-MM-DD HH:mm:ss') : null;
    } catch (error) {
      return undefined;
    }
  },
  "EOMONTH": function (start_date, months) { 
    const startDate = toSafeDate(start_date);
    try {
      const result = formulajs.EOMONTH(startDate, months);
      if (result instanceof Error) return null;
      const day = dayjs(result);
      return day.isValid() ? day.format('YYYY-MM-DD HH:mm:ss') : null;
    } catch (error) {
      return undefined;
    }
  },
  //逻辑函数
  "AND": function (...args) {
    for (const arg of args) {
      if (!arg) {
        return false;
      }
    }
    return true;
  },
  "FALSE": function () {
    return false
  },
  "IF": function (expression: boolean, str1: string | number, str2: string | number) {
    return expression ? str1 : str2;
  },
  "IFS": function (...args) {
    if (args.length % 2 !== 0) {
      return false;
    }
    for (let i = 0; i < args.length; i += 2) {
      const condition = args[i];
      const value = args[i + 1];
      if (condition) {
        return value;
      }
    }
    return false;
  },
  "NOT": function (expression: boolean) {
    return !expression
  },
  "OR": function (...args) {
    return args.some(arg => arg);
  },
  "TRUE": function () {
    return true
  },
  "XOR": function (...args) {
    return args.reduce((result, value) => result !== value, false);
  },

  // 高级函数
  "DISTANCE": function (coord1, coord2) {
    // 解析字符串时确保顺序为 [纬度, 经度]
    const [latitude1, longitude1] = coord1.split(',').map(Number);
    const [latitude2, longitude2] = coord2.split(',').map(Number);

    // 转换为弧度
    const lat1Rad = latitude1 * Math.PI / 180;
    const lat2Rad = latitude2 * Math.PI / 180;
    const deltaLat = lat2Rad - lat1Rad; // 纬度差的弧度
    const deltaLon = (longitude2 - longitude1) * Math.PI / 180; // 经度差的弧度

    // Haversine 公式
    const a = Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // 地球半径（米）
    const earthRadius = 6371000;
    return earthRadius * c;
  },
  // "GETUSERNAME": function(){

  // },
  "INDEX": function (arr, index) {
    if (index > 0 && index < arr.length) {
      return arr[index - 1]
    }
    if (index < 0 && Math.abs(index) < arr.length) {
      return arr[arr.length - Math.abs(index)]
    }
  },
  // "RECNO": function(){

  // },
  "TEXTLOCATION": function (address: string, format: string) {
    if (!address || typeof address !== 'string') {
      return "";
    }

    // 去除首尾空格，并按 '/' 分割
    const trimmedAddress = address.trim();
    const parts = trimmedAddress.split(/\s+/); // 按空格分割主地址和详细地址
    const mainAddress = parts[0]; // 主地址部分（如 "辽宁省/大连市/西岗区"）
    const detailPart = parts[1] || ""; // 详细地址（如果有）

    const mainParts = mainAddress.split('/').filter(Boolean); // 按 '/' 分割并过滤空值

    switch (format) {
      case "address":
        return trimmedAddress;
      case "province":
        return mainParts[0] || "";
      case "city":
        return mainParts[1] || "";
      case "district":
        return mainParts[2] || "";
      case "detail":
        return detailPart;
      default:
        return "";
    }
  },
  // "TEXTUSER": function(){

  // },
  // "TEXTDEPT": function(){

  // },
  "TEXTPHONE": function (phone: string) {
    const phoneRegex = /^(?:(?:\+|00)86)?1\d{10}$/;;
    return phoneRegex.test(phone) ? phone : '';
  },
  "UUID": function () {
    return unique(32)
  },
  "equal": function (a: any, b: any) {
    if (isNaN(a) || isNaN(b)) {
      return String(a) == String(b);
    }

    if (Array.isArray(a)) {
      return equalsArrat(a, b);
    }

    return a == b;
  },
  "unequal": function (a: any, b: any) {
    return !mathjs["equal"](a, b);
  },
  "larger": function (a: any, b: any) {
    return robustCompare(a, b, ComparisonOperator.LARGER);
  },
  "largerEq": function (a: any, b: any) {
    return robustCompare(a, b, ComparisonOperator.LARGER_EQ);
  },
  "smaller": function (a: any, b: any) {
    return robustCompare(a, b, ComparisonOperator.SMALLER);
  },
  "smallerEq": function (a: any, b: any) {
    return robustCompare(a, b, ComparisonOperator.SMALLER_EQ);
  },
  "==": mathjs["equal"],
  "!=": mathjs["unequal"],
  "bitAnd": function (...args) {
    return args.map(arg => {
      if (arg === null || arg === undefined) return '';
      if (Array.isArray(arg)) return arg.map(item => String(item)).join('');
      return String(arg);
    }).join('');
  },
  "&&": mathjs["and"],
  "||": mathjs["or"],
  ">": mathjs["larger"],
  ">=": mathjs["largerEq"],
  "<": mathjs["smaller"],
  "<=": mathjs["smallerEq"],
  "<>": mathjs["unequal"],
  add: excelAdd,
  subtract: excelSubtract,
  '+': excelAdd,
  '-': excelSubtract,
}, { override: true, wrap: true })

export const replaceColFieldsByFormula = (formula: string, callback: (keys: string[]) => any): string => {
  formula = getFormulaStr(formula);
  const processFunction = (str: string): string => {
    const functionMatch = str.match(/([A-Z]+)(?:<([a-zA-Z0-9_-]+)>)?\(([\s\S]*)\)/);

    if (!functionMatch) {
      return str;
    }

    const [fullMatch, functionName, fid, argsContent] = functionMatch;

    const formulaFunctions = getFormulaOfColArguments();
    const targetFunction = formulaFunctions.find(f => f.name === functionName);

    if (!targetFunction || !targetFunction.argOfNotTableCol) {
      const processedArgs = processArguments(argsContent);
      return str.replace(fullMatch, `${functionName}(${processedArgs})`);
    }

    const argsArray = parseArguments(argsContent);

    const processedArgsArray = argsArray.map(arg => processFunction(arg));

    const argOfNotTableCol = targetFunction?.argOfNotTableCol?.map(indexOfArg => indexOfArg < 0 ? processedArgsArray.length + indexOfArg : indexOfArg) ?? []
    processedArgsArray.forEach((arg, index) => {
      if (!argOfNotTableCol.includes(index)) {
        const regex = /\[\[([^,]+),/;
        const match = arg.match(regex);
        const result = match?.[1]?.split('.');
        if (result?.length > 0) {
          let value = callback(result);
          if (Array.isArray(value)) {
            value = value.map(value => typeof value === "string" ? `"${value}"` : value).join(',');
            value = `[${value}]`;
          } else {
            value = typeof value === "string" ? `"${value}"` : value;
          }
          processedArgsArray[index] = value;
        }
      }
    });

    const newFunctionCall = `${functionName}(${processedArgsArray.join(',')})`;

    return str.replace(fullMatch, newFunctionCall);
  };

  const parseArguments = (argsStr: string): string[] => {
    const args: string[] = [];
    let currentArg = '';
    let bracketLevel = 0;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      }

      if (!inQuotes) {
        if (char === '(' || char === '[' || char === '{') {
          bracketLevel++;
        } else if (char === ')' || char === ']' || char === '}') {
          bracketLevel--;
        }
      }

      if (char === ',' && bracketLevel === 0 && !inQuotes) {
        args.push(currentArg.trim());
        currentArg = '';
      } else {
        currentArg += char;
      }
    }

    if (currentArg.trim()) {
      args.push(currentArg.trim());
    }

    return args;
  };

  const processArguments = (argsStr: string): string => {
    const argsArray = parseArguments(argsStr);
    const processedArgs = argsArray.map(arg => processFunction(arg));
    return processedArgs.join(',');
  };

  return processFunction(formula);
};

export const replaceByFormula = (formula: string, callback: (keys: string[]) => string) => {
  return formula?.replaceAll(/\[\[(.*?)\]\]/g, ($0, $1) => {
    const arr = $1?.split(",");
    const ids = arr[0]?.split(".");
    const value = callback(ids);
    return JSON.stringify(value);
  })
}

export function collectFormulaFields(formula: string, tables: Table[]): string[] {
  const fields = new Set<string>();
  if (!formula) return [];
  replaceByFormula(formula, (keys) => {
    fields.add(keys.join('.'));
    return ''
  });

  return [...fields].map(item => {
    if(item.split('.')?.length === 1) return item;
    const table = tables.find(t => t.uid === item?.split('.')[0]);
    if(table) {
      const field = table.fields?.find(f => f.meta?.uid === item?.split('.')[1]);
      if(!field) return null;
      if(item?.split('.')[2]) {
        const subTable = tables.find(t => t.uid === field?.meta?.extra?.subTableUID?.[1]);
        if(subTable) {
          const subField = subTable.fields?.find(f => f.meta?.uid === item?.split('.')[2]);
          if(subField) return `${field.uid}.${subField.uid}`;
        }
      } else {
        return field.uid;
      }
    };
    return null;
  }).filter(item => item !== null);
}

export const getFormulaFields = (editFields, fields, tables) => {
  let index = 0
  let temp = [...editFields]
  let result = []
  
  const checkFormulaFields = (extra, fieldUID) => {
    if(temp.find(item => item.uid === fieldUID)) return false;
    if(extra?.defaultValueType != 'formula' || isEmpty(getFormulaStr(extra?.formula))) return false;
    if(!temp.some(item => collectFormulaFields(getFormulaStr(extra?.formula), tables).find(f => f === item.uid))) return false;
    return true
  }

  while(index < temp.length) {
    for(const field of fields) {
      if(field.meta?.subType === "subForm") {
        const subFormTable = tables.find(t => t.uid === field?.meta?.extra?.subTableUID?.[1]);
        for(const subField of subFormTable.fields) {
          if(!checkFormulaFields(subField.meta?.extra, `${field.uid}.${subField.uid}`)) continue;
          temp.push({...subField, uid: `${field.uid}.${subField.uid}`});
          result.push({...subField, uid: `${field.uid}.${subField.uid}`});
        }
      }
      if(!checkFormulaFields(field.meta?.extra, field.uid)) continue;
      temp.push(field);
      result.push(field);
    }
    index++
  }
  return result;
}

/** 公式数值运算中，空值按 0 处理；其他公式仍保留原始空值语义。 */
export const normalizeFormulaNumericValue = (value: any, enabled = true) => {
  if (!enabled) return value;
  if (
    value === null
    || value === undefined
    || value === ""
    || (typeof value === "number" && Number.isNaN(value))
  ) {
    return 0;
  }
  return value;
}

export const getFormulaEmptyCheckReferenceKeys = (formula: string) => {
  const keys = new Set<string>();
  const pattern = /\bISEMPTY(?:<[^>]+>)?\s*\(\s*\[\[([^\]]+)\]\]\s*\)/gi;
  for (const match of formula?.matchAll(pattern) || []) {
    const tokenPath = match[1]?.split(",")[0]?.trim();
    if (tokenPath) keys.add(tokenPath.split(".").join(","));
  }
  return keys;
}

const resolveFormulaFieldTokens = (keys: string[] = [], currentTableUID?: string) => {
  if (currentTableUID && keys[0] === currentTableUID) {
    return {
      fieldToken: keys[1] || "",
      subFieldToken: keys[2] || "",
    }
  }

  return {
    fieldToken: keys[0] || "",
    subFieldToken: keys[1] || "",
  }
}

const resolveFormulaRowFieldIds = (keys: string[] = [], targetTable: Table, formData: NocodeFormData) => {
  const { fieldToken, subFieldToken } = resolveFormulaFieldTokens(keys, targetTable?.uid);
  if (!fieldToken) {
    return {
      fieldId: "",
      subFieldId: "",
    }
  }

  const field = fieldToken.startsWith('f_')
    ? targetTable.fields.find(f => f.uid === fieldToken)
    : targetTable.fields.find(f => f.meta?.uid === fieldToken);
  const fieldId = field?.uid || (fieldToken.startsWith('f_') ? fieldToken : "");
  if (!subFieldToken) {
    return {
      fieldId,
      subFieldId: "",
    }
  }

  if (subFieldToken.startsWith('f_')) {
    return {
      fieldId,
      subFieldId: subFieldToken,
    }
  }

  const subTableUID = field?.meta?.extra?.subTableUID?.[field?.meta?.extra?.subTableUID?.length - 1];
  const subTable = formData.tables.find(t => t.uid === subTableUID);
  const subFieldId = subTable?.fields?.find(f => f.meta?.uid === subFieldToken)?.uid || "";
  return {
    fieldId,
    subFieldId,
  }
}

/** 主表公式引用子表字段时，返回该字段在子表中的整列值。 */
export const getSubFieldColumnValues = (fieldValue: unknown, subFieldId: string): any[] => {
  if (!Array.isArray(fieldValue)) return [];
  return fieldValue.map(item => item?.[subFieldId]);
}

export const rowsDefaultValueCalculation = (rows: Row[], calculationField: caculationField, targetTable: Table, formData: NocodeFormData) => {
  const formulaFields = calculationField.formulaFields || []
  const defaultFields = calculationField.defaultFields || []

  for(const row of rows) {
    for(const item of defaultFields) {
      const isSubField = item.uid?.split('.')?.length === 2;
      if(isSubField) {
        const subRows = row?.[item.uid.split('.')[0]]?.length ? row[item.uid.split('.')[0]] : [{}];
        for(const subRow of subRows) {
          subRow[item.uid.split('.')[1]] = item.meta?.extra?.defaultValue;
        }
        row[item.uid.split('.')[0]] = subRows;
      } else {
        row[item.uid] = item.meta?.extra?.defaultValue;
      }
    }
  }
  const getSubFieldFallbackRows = (row: Row, fieldUID: string) => {
    const [parentFieldId] = fieldUID.split('.');
    const parentField = targetTable.fields.find(field => field.uid === parentFieldId);
    const parentDefaultValue = parentField?.meta?.extra?.defaultValue;
    if (Array.isArray(parentDefaultValue) && parentDefaultValue.length) {
      return deepClone(parentDefaultValue);
    }
    return Array.isArray(row?.[parentFieldId]) ? row[parentFieldId] : [];
  }
  const isNumericFormulaReference = (fieldId: string, subFieldId?: string) => {
    const field = targetTable.fields.find(item => item.uid === fieldId || item.meta?.uid === fieldId);
    if (!field) return false;
    if (!subFieldId) return (field.revisedType || field.type) === 'number';
    const subTableUID = field.meta?.extra?.subTableUID?.at(-1);
    const subTable = formData.tables.find(table => table.uid === subTableUID);
    const subField = subTable?.fields.find(item => item.uid === subFieldId || item.meta?.uid === subFieldId);
    return !!subField && (subField.revisedType || subField.type) === 'number';
  }
  const formulaCollectMap = formulaFields.map(item => {
    return {
      uid: item.uid,
      collect: collectFormulaFields(getFormulaStr(item.meta?.extra?.formula), formData.tables)
    }
  })
  const pendingFormulaFields = [...formulaFields]
  while(pendingFormulaFields?.length) {
    let progressed = false
    for(let i = pendingFormulaFields.length - 1; i >= 0; i--) {
      const _field = pendingFormulaFields[i]
      const collect = formulaCollectMap.find(f => f.uid === _field.uid)?.collect || [];
      if(collect.some(f => pendingFormulaFields.find(item => item.uid === f))) continue;
      pendingFormulaFields.splice(i, 1)
      progressed = true
      const emptyCheckReferenceKeys = getFormulaEmptyCheckReferenceKeys(getFormulaStr(_field.meta?.extra?.formula));
      for(const row of rows) {
        if(_field.uid.split('.').length === 1) {
          let formula = replaceColFieldsByFormula(getFormulaStr(_field.meta?.extra?.formula), (keys) => {
            const { fieldId, subFieldId } = resolveFormulaRowFieldIds(keys, targetTable, formData);
            const shouldNormalizeFormulaValues = isNumericFormulaReference(fieldId, subFieldId)
              && !emptyCheckReferenceKeys.has(keys.join(','));
  
            if (subFieldId) {
              const fieldValue = Array.isArray(row?.[fieldId]) ? row[fieldId] : [];
              return getSubFieldColumnValues(fieldValue, subFieldId)
                .map(value => normalizeFormulaNumericValue(value, shouldNormalizeFormulaValues));
            } else {
              return normalizeFormulaNumericValue(row?.[fieldId], shouldNormalizeFormulaValues);
            }
          })
          formula = replaceByFormula(formula, (keys) => {
            const { fieldId, subFieldId } = resolveFormulaRowFieldIds(keys, targetTable, formData);
            const shouldNormalizeFormulaValues = isNumericFormulaReference(fieldId, subFieldId)
              && !emptyCheckReferenceKeys.has(keys.join(','));
            if (subFieldId) {
              const fieldValue = Array.isArray(row?.[fieldId]) ? row[fieldId] : [];
              return getSubFieldColumnValues(fieldValue, subFieldId).map(value => normalizeFormulaNumericValue(value, shouldNormalizeFormulaValues));
            } else {
              return normalizeFormulaNumericValue(row?.[fieldId], shouldNormalizeFormulaValues);
            }
          })
          if (!formula) continue;
          try {
            const formulaRuntime = createFormulaRuntimeByData(row, targetTable.fields);
            row[_field.uid] = formulaRuntime.evaluate(formula);
          } catch (err) {
            console.log(`edit data evaluate formula error:`, err);
          }
        } else {
          const [key, subFieldUID] = _field.uid.split('.')
          if(!row?.[key]?.length) {
            const fallbackSubRows = getSubFieldFallbackRows(row, _field.uid);
            row[key] = fallbackSubRows.length ? fallbackSubRows : [{}];
          }
          const rawFormula = replaceColFieldsByFormula(getFormulaStr(_field.meta?.extra?.formula), (keys) => {
            const { fieldId, subFieldId } = resolveFormulaRowFieldIds(keys, targetTable, formData);
            const shouldNormalizeFormulaValues = isNumericFormulaReference(fieldId, subFieldId)
              && !emptyCheckReferenceKeys.has(keys.join(','));
  
            if (subFieldId) {
              const fieldValue = Array.isArray(row?.[fieldId]) ? row[fieldId] : [];
              return getSubFieldColumnValues(fieldValue, subFieldId)
                .map(value => normalizeFormulaNumericValue(value, shouldNormalizeFormulaValues));
            } else {
              return [normalizeFormulaNumericValue(row?.[fieldId], shouldNormalizeFormulaValues)];
            }
          })
          for(let j = 0; j < (row[key].length || 0); j++) {
            const subRow = row[key][j]
            const formula = replaceByFormula(rawFormula, (keys) => {
              const { fieldId, subFieldId } = resolveFormulaRowFieldIds(keys, targetTable, formData);
              const shouldNormalizeFormulaValues = isNumericFormulaReference(fieldId, subFieldId)
                && !emptyCheckReferenceKeys.has(keys.join(','));
              if (subFieldId) {
                const index = fieldId != key ? 0 : j;
                const fieldValue = Array.isArray(row?.[fieldId]) ? row[fieldId] : [];
                const values = getSubFieldColumnValues(fieldValue, subFieldId);
                if (fieldId === key) {
                  return normalizeFormulaNumericValue(values[index], shouldNormalizeFormulaValues);
                }
                return values.map(value => normalizeFormulaNumericValue(value, shouldNormalizeFormulaValues));
              } else {
                return normalizeFormulaNumericValue(row?.[fieldId], shouldNormalizeFormulaValues);
              }
            })
            if (!formula) continue;
            try {
              const fieldId = _field.uid.split('.')[0]
              const subField = targetTable.fields.find(f => f.uid == fieldId);
              const subTable = formData.tables.find(t => t.uid === subField.meta?.extra?.subTableUID?.[subField.meta?.extra?.subTableUID?.length - 1]);
              const formulaRuntime = createFormulaRuntimeByData(subRow, subTable.fields);
              subRow[subFieldUID] = formulaRuntime.evaluate(formula);
            } catch (err) {
              console.log(`edit data evaluate formula error:`, err);
            }
          }
        }
      }
    }
    if(!progressed) {
      console.log('公式存在循环依赖')
      break
    }
  }
  return rows
}

export function stripFunctionIds(formula: string): string {
  return formula.replace(/<[^>]+>/g, '');
}

function stripFormulaStringLiterals(formula: string): string {
  return formula.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
}

function collectExtraContextFunctionNames(formula: string): string[] {
  const normalized = stripFormulaStringLiterals(stripFunctionIds(formula || ""));
  const functionNameSet = new Set<string>();
  const fnReg = /\b([A-Z_][A-Z0-9_]*)\s*\(/gi;
  let match: RegExpExecArray | null = null;

  while ((match = fnReg.exec(normalized))) {
    const fnName = match[1]?.toUpperCase();
    if (fnName && extraContextFunctions[fnName]) {
      functionNameSet.add(fnName);
    }
  }

  return Array.from(functionNameSet);
}

function assertExtraContextFunctionAvailability(formula: string, scope: Record<string, any> = {}) {
  const requiredFunctionNames = collectExtraContextFunctionNames(formula);
  if (!requiredFunctionNames.length) return;

  const missingFunctionNames = requiredFunctionNames.filter(name => typeof scope?.[name] !== 'function');
  if (missingFunctionNames.length) {
    throw new FormulaContextMissingError(missingFunctionNames);
  }
}

export const evaluateFormula = (formula: string, scope: Record<string, any> = {}) => {
  formula = normalizeRegexReplacePatternEscapes(formula);
  formula = normalizeLogicOperatorsByScan(formula)?.trim(); // 将无法导入的自定义运算符(&&、||)替换为mathjs支持的运算符，并且移除末尾换行
  assertExtraContextFunctionAvailability(formula, scope);
  const result = mathjs.evaluate(formula, scope);
  if (isFunctionFormula(formula)) return result;
  try { return JSON.parse(result); } catch { return result; }
}

export const evaluateFormulaWithRuntime = (formula: string, formulaRuntime?: FormulaRuntime | null) => {
  return formulaRuntime ? formulaRuntime.evaluate(formula) : evaluateFormula(formula);
}

export const findIdByFormula = (formula: string) => {
  if (!formula) return [];

  // 匹配两种格式：[[id,label]] 和 [[id]]
  const regex = /\[\[([a-zA-Z0-9.:_]+)(?:,[^\]]*)?\]\]/g;

  return Array.from(formula?.matchAll(regex) ?? [], match => match[1]);
}

export const linkWidgetTypeMap = {
  'widget.form.searchForm': 'selectSearchForm',
  'widget.form.selectData': 'connectionTable',
  'widget.form.relatedData': 'connectionTable'
}

export function isFunctionFormula(str) {
  if (typeof str !== 'string') return false;

  // 正则表达式匹配函数调用模式
  // 匹配：函数名(参数) 的模式
  const functionRegex = /^[A-Z_][A-Z0-9_]*(?:<[^>]+>)?\([\s\S]*\)$/i;
  
  return functionRegex.test(str.trim());
}

type FieldUsage = {
  formula: Formula | null,
  functionId: string | null,
  usageType: 'function' | 'standalone'
  argIndex: number | null,
  argsLength: number
}

export function collectFormulaFieldUsages(
  formula: string,
): Map<string, FieldUsage[]> {
  const usageMap = new Map<string, FieldUsage[]>()
  if (!formula) return usageMap
  const formulaListFlat = formulaList.flatMap(category => category.children || [])

  const pushUsage = (
    fieldId: string,
    usage: FieldUsage
  ) => {
    if (!usageMap.has(fieldId)) {
      usageMap.set(fieldId, [])
    }
    usageMap.get(fieldId)!.push(usage)
  }

  function findNextFunction(str: string) {
    const fnMatch = str.match(/([A-Z]+)(?:<([a-zA-Z0-9_-]+)>)?\(/)
    if (!fnMatch) return null

    const start = fnMatch.index!
    const name = fnMatch[1]
    const fnId = fnMatch[2] || null

    let index = start + fnMatch[0].length - 1
    let depth = 0

    for (let i = index; i < str.length; i++) {
      if (str[i] === "(") depth++
      else if (str[i] === ")") {
        depth--
        if (depth === 0) {
          return {
            fullMatch: str.slice(start, i + 1),
            name,
            fnId,
            argsContent: str.slice(index + 1, i),
            start,
            end: i + 1
          }
        }
      }
    }

    return null
  }

  const walk = (
    str: string,
    currentFormula: Formula | null,
    argIndex: number | null,
    argsLength: number | null,
    parentFnId: string | null,
  ) => {

    const fn = findNextFunction(str)

    if (fn) {
      const formula = formulaListFlat.find(f => f.name === fn.name) || null

      const args = parseArguments(fn.argsContent)

      args.forEach((arg, index) => {
        walk(arg, formula, index, args.length, fn.fnId)
      })

      const rest =
        str.slice(0, fn.start) +
        str.slice(fn.end)

      if (rest.trim()) {
        walk(rest, currentFormula, argIndex, argsLength, parentFnId)
      }

      return
    }

    // 处理字段
    const fieldRegex = /\[\[(.*?)\]\]/g
    let match

    while ((match = fieldRegex.exec(str))) {
      const content = match[1]
      const fieldId = content.split(',')[0]

      pushUsage(fieldId, {
        formula: currentFormula,
        functionId: parentFnId,
        usageType: currentFormula ? 'function' : 'standalone',
        argIndex,
        argsLength
      })
    }
  }

  walk(formula, null, null, null, null)

  return usageMap
}

export function parseArguments(argsStr: string): string[] {
  const args: string[] = []

  let current = ''
  let bracketLevel = 0
  let inQuotes = false
  let quoteChar = ''

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i]

    // 处理引号
    if ((char === '"' || char === "'")) {
      if (!inQuotes) {
        inQuotes = true
        quoteChar = char
      } else if (char === quoteChar) {
        inQuotes = false
        quoteChar = ''
      }
      current += char
      continue
    }

    if (!inQuotes) {
      // 括号层级
      if (char === '(' || char === '[' || char === '{') {
        bracketLevel++
      } else if (char === ')' || char === ']' || char === '}') {
        bracketLevel--
      }

      // 顶层逗号，才是真正的参数分隔
      if (char === ',' && bracketLevel === 0) {
        args.push(current.trim())
        current = ''
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    args.push(current.trim())
  }

  return args
}

export type FormulaTextRange = {
  start: number;
  end: number;
}

export function getRegexReplacePatternRanges(formula: string): FormulaTextRange[] {
  const ranges: FormulaTextRange[] = [];
  const functionRegex = /REGEXREPLACE(?:<[a-zA-Z0-9_-]+>)?\s*\(/iy;
  const collectPatternRange = (openParenIndex: number) => {
    let argumentIndex = 0;
    let nestedDepth = 0;
    let quote = '';
    let quoteStart = -1;
    let escapeNext = false;

    for (let index = openParenIndex + 1; index < formula.length; index++) {
      const char = formula[index];

      if (quote) {
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char !== quote) continue;

        if (argumentIndex === 1 && nestedDepth === 0 && quoteStart >= 0) {
          ranges.push({ start: quoteStart + 1, end: index });
          break;
        }
        quote = '';
        quoteStart = -1;
        continue;
      }

      if (char === '[' && formula[index + 1] === '[') {
        const bracketEnd = formula.indexOf(']]', index + 2);
        if (bracketEnd === -1) break;
        index = bracketEnd + 1;
        continue;
      }

      if (char === '"' || char === "'") {
        quote = char;
        if (argumentIndex === 1 && nestedDepth === 0) quoteStart = index;
        continue;
      }

      if (char === '(' || char === '[' || char === '{') {
        nestedDepth++;
        continue;
      }
      if (char === ')' || char === ']' || char === '}') {
        if (char === ')' && nestedDepth === 0) break;
        nestedDepth--;
        continue;
      }
      if (char === ',' && nestedDepth === 0) {
        argumentIndex++;
        if (argumentIndex > 1) break;
      }
    }
  };

  scanFormula(formula, {
    onChar(_char, context) {
      if (context.inString) return;

      const previousChar = formula[context.index - 1];
      if (previousChar && /[a-zA-Z0-9_]/.test(previousChar)) return;

      functionRegex.lastIndex = context.index;
      const functionMatch = functionRegex.exec(formula);
      if (functionMatch) {
        collectPatternRange(functionMatch.index + functionMatch[0].lastIndexOf('('));
      }
    },
  });

  return ranges.sort((left, right) => left.start - right.start);
}

function normalizeRegexReplacePatternEscapes(formula: string): string {
  const ranges = getRegexReplacePatternRanges(formula);
  let result = formula;

  for (let index = ranges.length - 1; index >= 0; index--) {
    const range = ranges[index];
    const pattern = formula.slice(range.start, range.end).replace(/\\(?!["'])/g, '\\\\');
    result = result.slice(0, range.start) + pattern + result.slice(range.end);
  }

  return result;
}

export function findInvalidFormulaEscape(formula: string): string | null {
  const regexPatternRanges = getRegexReplacePatternRanges(formula);
  const invalidEscape = Array.from(formula.matchAll(/\\(?!["'\\])[\s\S]?/g)).find(match => {
    return !regexPatternRanges.some(range => match.index! >= range.start && match.index! < range.end);
  });

  return invalidEscape?.[0] ?? null;
}

export function createFormulaContextByWidget(
  formElement
): FormulaContext {
  const form = formElement?.isInSubForm
    ? (formElement?.form ?? formElement?.parent)
    : formElement?.topForm;
  return {
    row: form?.getRow?.(),
    recordId: form?.getUUID?.(),
  };
}

export function createFormulaContextByData(
  row: Row,
  fields?: Field[],
): FormulaContext {
  const uuidField = fields?.find(field => field?.meta?.name === SystemField.UUID);
  const uuid = Object.entries(row).find(([id, value]) => {
    const idPath = id.split('.');
    return idPath[idPath.length - 1] === uuidField?.uid;
  })?.[1]
    ?? row?.[uuidField?.uid]
    ?? row?.["__uuid__"]
    ?? row?.[SystemField.UUID];
  return {
    row,
    recordId: uuid,
  };
}

type ContextFn = (...args: any[]) => any;

type ContextAwareFunction = {
  execute: ContextFn,
  isContextReady?: (ctx: FormulaContext | null | undefined) => boolean,
}

export const extraContextFunctions: Record<string, ContextAwareFunction> = {
  GETID: {
    execute: (ctx: FormulaContext) => ctx?.recordId,
    isContextReady: (ctx) => ctx?.recordId !== undefined && ctx?.recordId !== null,
  }
}

export function buildContextAwareFunctions(ctx?: FormulaContext | null) {
  const scopeFunctions: Record<string, ContextFn> = {};

  for (const [name, definition] of Object.entries(extraContextFunctions)) {
    scopeFunctions[name] = (...args: any[]) => {
      if (definition.isContextReady && !definition.isContextReady(ctx)) {
        throw new FormulaContextMissingError([name]);
      }
      return definition.execute(...args, ctx);
    };
  }

  return scopeFunctions;
}

export function createFormulaRuntime(context?: FormulaContext | null): FormulaRuntime {
  const scope = buildContextAwareFunctions(context);
  return {
    context: context ?? null,
    scope,
    evaluate: (formula: string) => evaluateFormula(formula, scope),
  };
}

export function createFormulaRuntimeByWidget(formElement): FormulaRuntime {
  return createFormulaRuntime(createFormulaContextByWidget(formElement));
}

export function createFormulaRuntimeByData(row: Row, fields?: Field[]): FormulaRuntime {
  return createFormulaRuntime(createFormulaContextByData(row, fields));
}

export type ScanContext = {
  index: number;
  inSingleQuote: boolean;
  inDoubleQuote: boolean;
  inString: boolean;
  inBracket: boolean;
};

export type ScanHooks = {
  onChar?: (ch: string, ctx: ScanContext) => boolean | void;
  onBracketChar?: (ch: string, ctx: ScanContext) => boolean | void;
  onEnd?: (ctx: ScanContext) => boolean;
};

export function normalizeLogicOperatorsByScan(formula: string): string {
  if (!formula) return formula;

  let result = '';
  let lastIndex = 0;

  scanFormula(formula, {
    onChar(ch, ctx) {
      const i = ctx.index;
      const next = formula[i + 1];

      // 跳过函数的 <fid>
      if (
        ch === '<' &&
        !ctx.inString &&
        !ctx.inBracket
      ) {
        // 向前找函数名
        let j = i - 1;
        while (j >= 0 && /[a-zA-Z0-9_]/.test(formula[j])) j--;
        const funcName = formula.slice(j + 1, i);
        // 必须是合法函数名（防止 1<xxx）
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(funcName)) {
          return;
        }

        // 找最近的 >，校验 < 和 > 之间是不是 fnId，fnId只允许是字母、数字、_、-
        const end = formula.indexOf('>', i + 1);
        if (end === -1) return;
        const fid = formula.slice(i + 1, end);
        if (!/^[a-zA-Z0-9_-]+$/.test(fid)) {
          return;
        }

        // 确认是 <fnId>
        result += formula.slice(lastIndex, i);
        lastIndex = end + 1;
        return;
      }

      // 只处理 非字符串、非 [[ ]]
      if (!ctx.inString && !ctx.inBracket) {
        if (ch === '&' && next === '&') {
          result += formula.slice(lastIndex, i) + ' and ';
          lastIndex = i + 2;
          return;
        }

        if (ch === '|' && next === '|') {
          result += formula.slice(lastIndex, i) + ' or ';
          lastIndex = i + 2;
          return;
        }
      }
    },
    onEnd() {
      result += formula.slice(lastIndex);
      return true;
    }
  });

  return result;
}

export function scanFormula(text: string, hooks: ScanHooks): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBracket = false;
  let escapeNext = false;

  const ctx: ScanContext = {
    index: 0,

    get inSingleQuote() {
      return inSingleQuote;
    },
    get inDoubleQuote() {
      return inDoubleQuote;
    },
    get inString() {
      return inSingleQuote || inDoubleQuote;
    },
    get inBracket() {
      return inBracket;
    },
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    ctx.index = i;

    /* 转义 */
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }

    /* [[ ... ]] 只能在非字符串中进入 / 退出 */
    if (!inSingleQuote && !inDoubleQuote) {
      if (!inBracket && ch === '[' && next === '[') {
        inBracket = true;
        i++;
        continue;
      }
      if (inBracket && ch === ']' && next === ']') {
        inBracket = false;
        i++;
        continue;
      }
    }

    if (inBracket) {
      if (hooks.onBracketChar?.(ch, ctx) === false) return false;
      continue;
    }

    /* 字符串切换 */
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    /* 普通字符 */
    if (hooks.onChar?.(ch, ctx) === false) return false;
  }

  return hooks.onEnd ? hooks.onEnd(ctx) : true;
}

export function getFormulaCodeText(formula: string): string {
  const codeText = Array.from({ length: formula.length }, () => ' ');

  scanFormula(formula, {
    onChar(ch, ctx) {
      if (!ctx.inString) {
        codeText[ctx.index] = ch;
      }
    },
  });

  return codeText.join('');
}

export interface FnMeta {
  name: string
  nameFrom: number
  nameTo: number
  fnId: string
}

export function extractFnIdsFromText(formula: string) {
  const metas: FnMeta[] = []
  const regexp = /([a-zA-Z0-9_]+)<([a-zA-Z0-9_-]+)>\(/g

  let match
  let offset = 0 // 累计删除长度

  while ((match = regexp.exec(formula))) {
    const fullMatch = match[0]          // SUM<abc>(
    const name = match[1]               // SUM
    const fnId = match[2]               // abc
    const idWithBrackets = `<${fnId}>`

    const originalIndex = match.index   // 原始字符串位置
    const adjustedIndex = originalIndex - offset

    const nameFrom = adjustedIndex
    const nameTo = nameFrom + name.length

    metas.push({
      name,
      nameFrom,
      nameTo,
      fnId
    })

    offset += idWithBrackets.length
  }

  const textWithoutIds = formula?.replace(/<([a-zA-Z0-9_-]+)>/g, "") ?? ""

  return {
    textWithoutIds,
    metas
  }
}

// 兼容字符串类型公式属性 返回对象
export const getFormulaDetailed = (formula: string | FormulaConfig): FormulaConfig => { 
  if (typeof formula === "string") {
    return {
      formula,
      filterRules: {}
    }
  }
  return formula ?? { formula: "", filterRules: {} }
}

// 兼容字符串类型公式属性 返回公式字符串
export const getFormulaStr = (formula: string | FormulaConfig): string => {
  return getFormulaDetailed(formula).formula;
}

export const normalizeFormulaText = (formula: unknown): string => {
  if (typeof formula === 'string') {
    return formula.trim();
  }

  if (formula && typeof formula === 'object' && !Array.isArray(formula)) {
    return getFormulaStr(formula as FormulaConfig).trim();
  }

  return '';
}

export const HISTORY_TABLE_UID_PREFIX = "hist_";
export const FORMULA_RECORD_COUNT_FIELD_UID = "_count";
export const FORMULA_RECORD_COUNT_FIELD_ALIAS = () => i18next.t('FormulaEditer.recordCount');
export const getSourceTableUID = (tableUID?: string) => {
  if (!tableUID) return tableUID;
  return tableUID.startsWith(HISTORY_TABLE_UID_PREFIX) ? tableUID.slice(HISTORY_TABLE_UID_PREFIX.length) : tableUID;
}
export const isHistoryTableUID = (tableUID?: string) => {
  return !!tableUID?.startsWith(HISTORY_TABLE_UID_PREFIX);
}
