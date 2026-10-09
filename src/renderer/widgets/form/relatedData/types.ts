import { FormConditionValueType, RuleFunc } from "@common/types/nocode";
import { LogicalOperator } from "@renderer/b2/types";

export enum DataMode {
  SINGLE = "single",
  MULTIPLE = "multiple",
}

export type FormCondition = {
  uid: string,
  func: RuleFunc,
  value: any,
  fixedValue?: any,
  type?: FormConditionValueType,
}

export type FilterRule = {
  logic: LogicalOperator;
  conditions: FormCondition[];
}