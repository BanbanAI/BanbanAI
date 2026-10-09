import { FieldUID } from "@common/types/project";
import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { SystemField } from "@common/utils/connection";
import { LogicalOperator } from "@renderer/b2/types";
import { InjectionKey } from "vue";

export enum ShowDataRow {
  SINGLE = "single",
  MULTIPLE = "multiple",
}

export enum ShowDataStyle {
  PARAGRAPH = "paragraph",
  TABLE = "table",
}

export enum FormTableRowHeight {
    AUTO = "auto",
    SMALL = "small",
    MEDIUM = "medium",
    LARGE = "large"
}

export enum CurrentFieldWrapperOperator {
  FIELD = "FIELD",
  INPUT = "INPUT"
}

export enum FormSortOrder {
  ASCEND = 1,
  DESCEND = -1,
}

export type FormCondition = {
  uid: FieldUID;
  func: RuleFunc;
  value: any;
  fieldType?: string;
  funcOptions?: object;
  slelectedElement?: any;
  slelectedElementTpye?: any;
  comparisonUid?: string;
  comparisonOfForm?: SelectIdOfForm;
};
export type FilterRule = {
  logic: LogicalOperator;
  conditions: FormCondition[];
};

export enum SelectIdOfForm {
  CURRENT = "current",
  LINKAGE = "linkage",
}

export type Column = {
  label: string,
  value: string,
  subType?: string,
  isSystem?: boolean,
  children?: Column[]
}
