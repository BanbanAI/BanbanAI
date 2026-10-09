import { Department, NocodeUser } from "./account";
import { NocodeBody } from "./nocode";
import { Field, FieldUID } from "./project";

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

export type FieldMatchResult = 'all-success' | 'some-success' | 'all-fail' | 'not-import';
export type ExcelFieldItem = {
  uid: string,
  excelFieldTitle: string,  // Excel中某列的标题
  excelField: `col-${number}`,  // Excel中的标题所在列
  excelFieldType: string; // Excel中的某列的数据类型
  formField?: FieldUID | '不导入';  // 导入数据时，表单中某字段的uid
  formFieldTitle?: string;  // 新建表单时，表单中某字段的alias
  formFieldType?: string | '不导入'; // 新建表单时，表单中某字段对应的组件的类型
  subformExcelFields?: ExcelFieldItem[],  // 子表单的字段信息
  parentExcelField?: ExcelFieldItem['excelField'],  // 子表单列所属的父表单列
  parentFormField?: FieldUID, // 子表单字段所属的父表单字段
  fieldMatchResult?: FieldMatchResult, // 字段匹配检测的结果
};
export type ExcelFormColMap = Record<ExcelFieldItem['excelField'], ExcelFieldItem['formField']>;
export type ExcelSubformColMaps = Record<ExcelFieldItem['excelField'], ExcelFormColMap>;
export type SpecialFieldProcessArgs = {
  data: any,
  cellLocation?: ExcelLocation,
  field?: Field,
  sheetData?: SheetData,
  titleRowIndex?: number,
  subformMappings?: ExcelSubformColMaps,
  // workbenchService?: WorkbenchService,
  nocodeBody?: NocodeBody,
  userList?: NocodeUser[],
  departmentList?: Department[],
  relatedDataImportMap?: Record<string, Set<string>>,
  rowDataMap?: Record<string, any>,
  parentRowDataMap?: Record<string, any>,
  skipRequiredValidation?: boolean,
}
export type SpecialFieldProcess = {
  type: string,
  processor: (args: SpecialFieldProcessArgs) => Promise<SpecialFieldProcessRes>,
};
export type SpecialFieldProcessRes = { data: any, valid: boolean, reason?: string };

export type ExcelFieldValidationSeverity = 'pass' | 'warning' | 'error' | 'skip';

export type ExcelFieldValidationExample = {
  rowIndex: number,
  colIndex: number,
  value: any,
  reason: string,
}

export type ExcelFieldValidationResult = {
  status: FieldMatchResult,
  severity: ExcelFieldValidationSeverity,
  totalCount: number,
  successCount: number,
  failedCount: number,
  failedExamples: ExcelFieldValidationExample[],
  reason?: string,
}

export type ExcelFieldValidationInput = {
  excelField: Pick<ExcelFieldItem, 'excelField' | 'excelFieldTitle'>,
  field: Field,
  sheetData: SheetData,
  titleRowIndex: number,
  mapping?: ExcelFormColMap,
  subformMappings?: ExcelSubformColMaps,
  nocodeBody: NocodeBody,
  userList?: NocodeUser[],
  departmentList?: Department[],
  relatedDataImportMap?: Record<string, Set<string>>,
  maxFailedExamples?: number,
}
