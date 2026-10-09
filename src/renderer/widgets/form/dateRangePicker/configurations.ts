import { RuleFunc, RuleFuncValue } from "@common/types/nocode";

export const configurations = {
  funcInfo: {
    [RuleFunc.EQUAL]: RuleFuncValue.RANGE,
    [RuleFunc.NOT_EQUAL]: RuleFuncValue.RANGE,
    // [RuleFunc.GTE]: RuleFuncValue.DATE,
    // [RuleFunc.LTE]: RuleFuncValue.DATE,
    // [RuleFunc.BETWEEN]: RuleFuncValue.RANGE,
    // [RuleFunc.DYNAMIC]: RuleFuncValue.STRING,
    [RuleFunc.EMPTY]: RuleFuncValue.NULL,
    [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
  },
  // 编辑表单时使用的筛选判断条件
  editFuncInfo: {
    [RuleFunc.EQUAL]: RuleFuncValue.RANGE,
    [RuleFunc.NOT_EQUAL]: RuleFuncValue.RANGE,
    // [RuleFunc.GTE]: RuleFuncValue.DATE,
    // [RuleFunc.LTE]: RuleFuncValue.DATE,
    // [RuleFunc.DYNAMIC]: RuleFuncValue.STRING,
    [RuleFunc.EMPTY]: RuleFuncValue.NULL,
    [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    // [RuleFunc.BETWEEN]: RuleFuncValue.RANGE,
  }
}