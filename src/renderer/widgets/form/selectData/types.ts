import { FieldUID } from "@common/types/project";
import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { SystemField } from "@common/utils/connection";
import { LogicalOperator } from "@renderer/b2/types";

export type FillRule = {
  targetUID: string | typeof NEW_FIELD,
  sourceUID: string,
  linkageSubFields?: {
    subTargetUID?: string;
    subSourceUID?: string;
  }[]
};
export type FillRules = Array<FillRule>;

export type SelectDataFillTrace = {
  batch: true;
};

export const NEW_FIELD = "NEW_FIELD";

export enum CurrentFieldWrapperOperator {
  FIELD = "FIELD",
  INPUT = "INPUT"
}

export enum SelectIdOfForm {
  CURRENT = "current",
  LINKAGE = "linkage",
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

export enum SelectBelongFormOperator {
  TARGET = "TARGET",
  LINKAGE = "LINKAGE"
}
