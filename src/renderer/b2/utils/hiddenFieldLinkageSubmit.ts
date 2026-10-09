import { FormConditionValueType, LogicalOperator, RuleFunc, type FormCondition, type FormLinkageCondition, type FormLinkageRule } from "@common/types/nocode";
import { transformCondition } from "@common/utils/connection";
import type { Row, WhereCondition } from "@common/types/project";

type HiddenFieldLinkageFillRule = {
  rule: FormLinkageRule;
  linkageField: string;
}

export type HiddenFieldLinkageSubmitResult = {
  matched: boolean;
  value: unknown;
}

export type ResolveHiddenFieldLinkageSubmitValueOptions = {
  fieldId: string;
  rules?: FormLinkageRule[];
  baseRow?: Row;
  resolveWidgetFieldId?: (widgetUid: string) => string | null | undefined;
  getRows: (rule: FormLinkageRule, conditionValues: Record<string, unknown>, rowsQuery?: WhereCondition | null) => Promise<Row[]> | Row[];
}

const getConditionKey = (condition: FormLinkageCondition) => {
  return condition.id || condition.uid;
}

const isCustomCondition = (condition: FormLinkageCondition) => {
  return condition.type === "CUSTOM";
}

const getTopLevelConditionFieldId = (value: unknown) => {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const parts = value.split(".");
  return parts.length === 1 ? value : null;
}

const getLinkageFillValue = (linkageField: string, rows: Row[] = []) => {
  const [tableField, subField] = linkageField.split(".");
  if (!tableField) {
    return undefined;
  }

  return subField
    ? rows?.[0]?.[tableField]?.[0]?.[subField]
    : rows?.[0]?.[tableField];
}

const getHiddenFieldLinkageFillRules = (
  rules: FormLinkageRule[] = [],
  fieldId: string,
) => {
  return rules.reduce<HiddenFieldLinkageFillRule[]>((prev, rule) => {
    (rule.fillWidgets || []).forEach(fillRule => {
      if (
        fillRule.fillWidget !== fieldId
        || !fillRule.linkageField
        || fillRule.linkageSubFields?.length
      ) {
        return;
      }

      prev.push({
        rule,
        linkageField: fillRule.linkageField,
      });
    });
    return prev;
  }, []);
}

export const buildLinkageConditionValuesFromRow = (
  conditions: FormLinkageCondition[] = [],
  row: Row = {},
  options: Pick<ResolveHiddenFieldLinkageSubmitValueOptions, "resolveWidgetFieldId"> = {},
) => {
  return conditions.reduce<Record<string, unknown>>((prev, condition) => {
    if (isCustomCondition(condition)) {
      return prev;
    }

    const conditionKey = getConditionKey(condition);
    const widgetUid = getTopLevelConditionFieldId(condition.value);
    if (!conditionKey || !widgetUid) {
      return prev;
    }

    const fieldId = options.resolveWidgetFieldId?.(widgetUid) || widgetUid;
    prev[conditionKey] = row?.[fieldId];
    return prev;
  }, {});
}

const hasRunnableConditionValue = (conditionValues: Record<string, unknown>) => {
  return Object.keys(conditionValues).some(key => conditionValues[key] !== undefined);
}

const isEmptyFieldsFillValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.filter(item => item !== undefined && item !== null && item !== "").length === 0;
  }

  return value === undefined || value === null || value === "";
}

const isNoValueRequiredFunc = (func?: RuleFunc) => {
  return [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(func as RuleFunc);
}

const transformHiddenFieldLinkageCondition = (condition: FormLinkageCondition) => {
  const { uid, func, fixedValue, type } = condition;
  if (type === FormConditionValueType.FORM && Array.isArray(fixedValue)) {
    const value = fixedValue.filter(item => item !== undefined && item !== null && item !== "");
    if (!value.length) return null;
    if (func === RuleFunc.EQUAL) {
      return transformCondition({ uid, func: RuleFunc.IN, value } as FormCondition);
    }
    if (func === RuleFunc.NOT_EQUAL) {
      return transformCondition({ uid, func: RuleFunc.NOT_IN, value } as FormCondition);
    }
    return transformCondition({ uid, func, value } as FormCondition);
  }

  return transformCondition({ uid, func, value: fixedValue } as FormCondition);
}

const hasMissingFieldConditionValue = (
  conditions: FormLinkageCondition[] = [],
  valuesMap: Record<string, unknown> = {},
) => {
  return conditions.some(condition => {
    if (condition.type !== FormConditionValueType.FORM) return false;
    if (isNoValueRequiredFunc(condition.func)) return false;
    const conditionKey = getConditionKey(condition);
    return isEmptyFieldsFillValue(conditionKey ? valuesMap[conditionKey] : undefined);
  });
}

export const buildHiddenFieldLinkageRowsQuery = (
  rule: Pick<FormLinkageRule, "conditions" | "logic">,
  conditionValues: Record<string, unknown> = {},
): WhereCondition | null => {
  const conditions = rule.conditions || [];
  if (!conditions.length) return null;
  if (rule.logic === LogicalOperator.AND && hasMissingFieldConditionValue(conditions, conditionValues)) {
    return null;
  }

  const queryConditions = conditions.map(condition => {
    const runtimeCondition = condition.type === FormConditionValueType.FORM
      ? {
        ...condition,
        fixedValue: conditionValues[getConditionKey(condition)],
      }
      : condition;
    return transformHiddenFieldLinkageCondition(runtimeCondition);
  }).filter((condition): condition is WhereCondition => Boolean(condition));

  if (!queryConditions.length) return null;

  return {
    [rule.logic === LogicalOperator.AND ? "$and" : "$or"]: queryConditions,
  } as WhereCondition;
}

export const resolveHiddenFieldLinkageSubmitValue = async ({
  fieldId,
  rules = [],
  baseRow = {},
  resolveWidgetFieldId,
  getRows,
}: ResolveHiddenFieldLinkageSubmitValueOptions): Promise<HiddenFieldLinkageSubmitResult> => {
  const matchedFillRules = getHiddenFieldLinkageFillRules(rules, fieldId);
  if (!matchedFillRules.length) {
    return {
      matched: false,
      value: undefined,
    };
  }

  for (const fillRule of matchedFillRules) {
    const conditionValues = buildLinkageConditionValuesFromRow(fillRule.rule.conditions || [], baseRow, {
      resolveWidgetFieldId,
    });
    const rowsQuery = buildHiddenFieldLinkageRowsQuery(fillRule.rule, conditionValues);
    if (!hasRunnableConditionValue(conditionValues) || !rowsQuery) {
      return {
        matched: true,
        value: null,
      };
    }

    const rows = await getRows(fillRule.rule, conditionValues, rowsQuery);
    return {
      matched: true,
      value: rows?.length ? getLinkageFillValue(fillRule.linkageField, rows) : null,
    };
  }

  return {
    matched: false,
    value: undefined,
  };
}
