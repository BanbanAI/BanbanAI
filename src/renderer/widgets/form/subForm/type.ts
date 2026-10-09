import { FieldUID } from "@common/types/project";
import { FormLinkageCondition, LogicalOperator } from "@renderer/b2/types";
import { Field, TableUID } from "@common/types/project";
import { SubForm } from "./subForm";

export type ExcelLocation = { c: number, r: number }
export type ExcelRange = { s: ExcelLocation, e: ExcelLocation }

export type CellMerge = { colspan: number , rowspan: number }

export type SheetData = {
  isSheetNull: boolean,
  rows: any[][],
  typeData: string[][],
  mergeData: CellMerge[][]
};

export type ExcelFileData = {
  fileName: string,
  sheets: string[],
  originSheetsData: {
    [sheetName: string]: SheetData
  }
}

export type FormFieldType = {
  type: string;
  name: string;
  icon?: any;
}

export type FormFieldTypeClassify = {
  category: string;
  children: Array<FormFieldType>;
};

export type ExcelFieldItem = {
  excelFieldTitle: string,  // Excel中某列的标题
  excelField: `col-${number}`,  // Excel中的标题所在列
  excelFieldType: string; // Excel中的某列的数据类型
  formField?: FieldUID | '不导入';  // 导入数据时，表单中某字段的uid
  formFieldTitle?: string;  // 新建表单时，表单中某字段的alias
  formFieldType?: string | '不导入'; // 新建表单时，表单中某字段对应的组件的类型
  titleRowIndex?: number,
};

export type ExcelFormColMap = Record<ExcelFieldItem['excelField'], ExcelFieldItem['formField']>;
export type ExcelSubformColMaps = Record<ExcelFieldItem['excelField'], ExcelFormColMap>;

export type SpecialFieldProcessArgs = {
  data: any,
  field?: Field,
  widget?: SubForm,
}
export type SpecialFieldProcessRes = { data: any, valid: boolean };
export type SpecialFieldProcess = {
  type: string,
  processor: (args: SpecialFieldProcessArgs) => Promise<SpecialFieldProcessRes>,
};

export type DataFillRule = {
  sourceConnectionUID?: string,
  sourceTableUID?: TableUID,
  logic?: LogicalOperator,
  conditions?: FormLinkageCondition[],
  fillWidgets?: {
    fillWidget?: string,
    linkageWidget?: string,
  }[],
}

export enum AggregationType {
  NOTAGGRE = 'NOTAGGRE',
  SUM = "SUM",
  AVG = "AVG",
  MAX = "MAX",
  MIN = "MIN",
}

export type AggregationRule = {
  field: string,
  type: AggregationType,
}
