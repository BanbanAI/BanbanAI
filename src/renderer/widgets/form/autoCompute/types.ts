import { FieldUID } from "@common/types/project";
import { RuleFunc, FormConditionValueType } from "@common/types/nocode";
import { SelectIdOfForm, LogicalOperator } from "@renderer/b2/types";

export type FormCondition = {
  uid: FieldUID;
  func: RuleFunc;
  value: any;
  type?: FormConditionValueType;
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