import {
  FormConditionValueType,
  RuleFunc,
  type FormLinkageCondition,
  type FormLinkageRule,
} from "@common/types/nocode";
import type { Row, WhereCondition } from "@common/types/project";
import { matchConditionByRuleFunc } from "@common/utils/aggregateTableShared";

export type TopLevelLinkageFillWidget = {
  fillWidget: string;
  linkageField: string;
};

type TopLevelLinkageRunnableRule = {
  rule: FormLinkageRule;
  fillWidgets: TopLevelLinkageFillWidget[];
  dependencyWidgetIds: string[];
};

type ReplayTopLevelLinkageRulesOptions = {
  rules?: FormLinkageRule[];
  triggerWidgetIds?: string[];
  getConditionValues: (rule: FormLinkageRule) => Record<string, unknown>;
  shouldExecute?: (conditionValues: Record<string, unknown>, rule: FormLinkageRule) => boolean;
  executeRule: (
    rule: FormLinkageRule,
    fillWidgets: TopLevelLinkageFillWidget[],
    conditionValues: Record<string, unknown>,
  ) => Promise<string[]> | string[];
  onMaxExecutions?: () => void;
};

const hasNestedLinkageCondition = (conditions: FormLinkageCondition[] = []) => {
  return conditions.some(condition => {
    return typeof condition.value === "string" && condition.value.split(".").length > 1;
  });
};

const collectConditionWidgetIds = (conditions: FormLinkageCondition[] = []) => {
  return conditions
    .filter(condition => condition.type !== FormConditionValueType.CUSTOM)
    .map(condition => condition.value)
    .filter((value): value is string => typeof value === "string" && value.split(".").length === 1);
};

const getTopLevelLinkageRunnableRules = (
  rules: FormLinkageRule[] = [],
): TopLevelLinkageRunnableRule[] => {
  return rules.reduce<TopLevelLinkageRunnableRule[]>((result, rule) => {
    if (
      hasNestedLinkageCondition(rule.conditions || [])
      || hasNestedLinkageCondition(rule.subTableSetting?.conditions || [])
    ) {
      return result;
    }

    const fillWidgets = (rule.fillWidgets || []).reduce<TopLevelLinkageFillWidget[]>((items, fillItem) => {
      if (
        !fillItem.fillWidget
        || fillItem.fillWidget.split(".").length > 1
        || !fillItem.linkageField
        || fillItem.linkageSubFields?.length
      ) {
        return items;
      }
      items.push({
        fillWidget: fillItem.fillWidget,
        linkageField: fillItem.linkageField,
      });
      return items;
    }, []);
    if (!fillWidgets.length) return result;

    result.push({
      rule,
      fillWidgets,
      dependencyWidgetIds: [...new Set([
        ...collectConditionWidgetIds(rule.conditions || []),
        ...collectConditionWidgetIds(rule.subTableSetting?.conditions || []),
      ])],
    });
    return result;
  }, []);
};

export const collectTopLevelLinkageConditionWidgetIds = (rules: FormLinkageRule[] = []) => {
  return [...new Set(
    getTopLevelLinkageRunnableRules(rules).flatMap(item => item.dependencyWidgetIds),
  )];
};

export const hasInitialLinkageTriggerValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
};

export const buildTopLevelLinkageSubTableRowsQuery = (
  rowsQuery: WhereCondition,
  keyFieldUID: string,
  primaryRowIds: unknown[] = [],
): WhereCondition => {
  return {
    $and: [
      rowsQuery,
      { [keyFieldUID]: primaryRowIds },
    ],
  };
};

export const matchTopLevelLinkageCondition = (
  condition: FormLinkageCondition,
  row: Row,
  conditionValues: Record<string, unknown>,
) => {
  const expectedValue = condition.type === FormConditionValueType.CUSTOM
    ? condition.fixedValue
    : conditionValues[condition.id || condition.uid];
  const func = Array.isArray(expectedValue)
    ? condition.func === RuleFunc.EQUAL
      ? RuleFunc.IN
      : condition.func === RuleFunc.NOT_EQUAL
        ? RuleFunc.NOT_IN
        : condition.func
    : condition.func;
  const rowValue = row[condition.uid];

  return matchConditionByRuleFunc(
    Array.isArray(rowValue) ? rowValue : [rowValue],
    func,
    expectedValue,
  );
};

export const replayTopLevelLinkageRules = async ({
  rules = [],
  triggerWidgetIds = [],
  getConditionValues,
  shouldExecute = conditionValues => Object.values(conditionValues).some(value => value !== undefined),
  executeRule,
  onMaxExecutions,
}: ReplayTopLevelLinkageRulesOptions) => {
  const runnableRules = getTopLevelLinkageRunnableRules(rules);
  const triggerWidgetIdSet = new Set(triggerWidgetIds);
  const dependentRuleIndexes = runnableRules.reduce<Record<string, number[]>>((result, item, index) => {
    item.dependencyWidgetIds.forEach(widgetId => {
      (result[widgetId] ||= []).push(index);
    });
    return result;
  }, {});
  const queue = runnableRules.reduce<number[]>((result, item, index) => {
    if (item.dependencyWidgetIds.some(widgetId => triggerWidgetIdSet.has(widgetId))) {
      result.push(index);
    }
    return result;
  }, []);
  const queuedRuleIndexes = new Set(queue);
  const maxExecutions = Math.max(runnableRules.length ** 2, 1);
  let executionCount = 0;
  let hasChanges = false;

  while (queue.length) {
    const ruleIndex = queue.shift();
    if (ruleIndex === undefined) continue;

    queuedRuleIndexes.delete(ruleIndex);
    executionCount += 1;
    if (executionCount > maxExecutions) {
      onMaxExecutions?.();
      break;
    }

    const runnableRule = runnableRules[ruleIndex];
    const conditionValues = getConditionValues(runnableRule.rule);
    if (!shouldExecute(conditionValues, runnableRule.rule)) continue;

    const changedWidgetIds = await executeRule(
      runnableRule.rule,
      runnableRule.fillWidgets,
      conditionValues,
    );
    if (!changedWidgetIds.length) continue;
    hasChanges = true;

    const nextRuleIndexes = new Set<number>();
    changedWidgetIds.forEach(widgetId => {
      (dependentRuleIndexes[widgetId] || []).forEach(nextRuleIndex => {
        if (nextRuleIndex !== ruleIndex && !queuedRuleIndexes.has(nextRuleIndex)) {
          nextRuleIndexes.add(nextRuleIndex);
        }
      });
    });
    nextRuleIndexes.forEach(nextRuleIndex => {
      queue.push(nextRuleIndex);
      queuedRuleIndexes.add(nextRuleIndex);
    });
  }

  return { hasChanges, executionCount };
};
