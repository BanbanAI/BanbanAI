import { FormConditionValueType, FormLinkageCondition, FormLinkageRule } from "@common/types/nocode";
import { Row } from "@common/types/project";
import { deepClone, equals } from "@common/utils/object";

type LinkageFillRuntimeWidget = {
  type?: string;
  inputValue?: unknown;
  clearValue?: () => void;
  onFillData?: (data: unknown[]) => void;
  trySetInputValue?: (value: unknown) => void;
}

type LinkageFillRuleRowsOptions = {
  resolveWidget: (widgetUID: string) => LinkageFillRuntimeWidget | undefined | null;
  resolveSubWidget?: (subFormUID: string, widgetUID: string) => LinkageFillRuntimeWidget | undefined | null;
  canFillSubWidget?: (subFormUID: string, linkageSubFields: NonNullable<FormLinkageRule["fillWidgets"]>[number]["linkageSubFields"]) => boolean;
}

const TREE_SELECT_WIDGET_TYPES = ["widget.form.treeSelect", "widget.form.treeMultipleSelect"];

const getEdgeKey = (from: string, to: string) => `${from}\n${to}`;

const getConditionFieldIds = (conditions: FormLinkageCondition[] = []) => {
  return conditions
    .filter(condition => condition.type !== FormConditionValueType.CUSTOM)
    .map(condition => condition.value)
    .filter((value): value is string => typeof value === "string" && !!value);
}

const getRuleConditionFieldIds = (rule: FormLinkageRule) => {
  return [
    ...getConditionFieldIds(rule.conditions || []),
    ...getConditionFieldIds(rule.subTableSetting?.conditions || []),
  ];
}

const getRuleFillFieldIds = (rule: FormLinkageRule) => {
  const fillFieldIds: string[] = [];

  rule.fillWidgets?.forEach(fillRule => {
    if (!fillRule.fillWidget) return;

    if (fillRule.linkageSubFields?.length) {
      fillRule.linkageSubFields.forEach(subField => {
        if (subField.fillWidget) {
          fillFieldIds.push(`${fillRule.fillWidget}.${subField.fillWidget}`);
        }
      });
      return;
    }

    fillFieldIds.push(fillRule.fillWidget);
  });

  return fillFieldIds;
}

export const getLinkageFillValue = (linkageField: string, rows: Row[] = []) => {
  const [tableField, subField] = linkageField.split(".");
  if (!tableField) return undefined;

  return subField
    ? rows?.[0]?.[tableField]?.[0]?.[subField]
    : rows?.[0]?.[tableField];
}

export const getLinkageFillData = (linkageField: string, rows: Row[] = []) => {
  const [tableField, subField] = linkageField.split(".");
  if (!tableField) return [];

  return subField
    ? rows.flatMap(rowItem => Array.isArray(rowItem?.[tableField]) ? rowItem[tableField].map(item => item?.[subField]) : [])
    : rows.map(rowItem => rowItem?.[tableField]);
}

export const applyLinkageFillValueToWidget = (
  widget: LinkageFillRuntimeWidget | undefined | null,
  linkageField: string,
  rows: Row[] = [],
) => {
  if (!widget || !linkageField) return false;

  const previousValue = deepClone(widget.inputValue);
  if (TREE_SELECT_WIDGET_TYPES.includes(widget.type)) {
    widget.onFillData?.(rows.length ? getLinkageFillData(linkageField, rows) : []);
    return !equals(previousValue, widget.inputValue);
  }

  if (!rows.length) {
    if (widget.clearValue) {
      widget.clearValue();
    } else {
      widget.inputValue = null;
    }
    return !equals(previousValue, widget.inputValue);
  }

  const value = getLinkageFillValue(linkageField, rows);
  if (widget.trySetInputValue) {
    widget.trySetInputValue(value);
  } else {
    widget.inputValue = value;
  }
  return !equals(previousValue, widget.inputValue);
}

export const applyLinkageFillRuleRows = (
  rule: Pick<FormLinkageRule, "fillWidgets">,
  rows: Row[] = [],
  options: LinkageFillRuleRowsOptions,
) => {
  const changedWidgetUIDs: string[] = [];

  rule.fillWidgets?.forEach(fillRule => {
    if (!fillRule.fillWidget) return;

    if (fillRule.linkageSubFields?.length) {
      if (options.canFillSubWidget && !options.canFillSubWidget(fillRule.fillWidget, fillRule.linkageSubFields)) {
        return;
      }

      fillRule.linkageSubFields.forEach(subField => {
        if (!subField.fillWidget || !subField.linkageField) return;
        const widget = options.resolveSubWidget?.(fillRule.fillWidget, subField.fillWidget);
        if (applyLinkageFillValueToWidget(widget, subField.linkageField, rows)) {
          changedWidgetUIDs.push(`${fillRule.fillWidget}.${subField.fillWidget}`);
        }
      });
      return;
    }

    if (!fillRule.linkageField) return;
    const widget = options.resolveWidget(fillRule.fillWidget);
    if (applyLinkageFillValueToWidget(widget, fillRule.linkageField, rows)) {
      changedWidgetUIDs.push(fillRule.fillWidget);
    }
  });

  return changedWidgetUIDs;
}

const findPath = (
  from: string,
  to: string,
  graph: Record<string, string[]>,
  visited = new Set<string>(),
): string[] | null => {
  if (from === to) return [from];
  if (visited.has(from)) return null;

  visited.add(from);

  for (const next of graph[from] || []) {
    const path = findPath(next, to, graph, visited);
    if (path) {
      return [from, ...path];
    }
  }

  return null;
}

export const getCircularLinkageRuleIndexes = (rules: FormLinkageRule[] = []) => {
  const graph: Record<string, string[]> = {};
  const edgeRuleIndexes: Record<string, Set<number>> = {};

  rules.forEach((rule, ruleIndex) => {
    const conditionFieldIds = getRuleConditionFieldIds(rule);
    const fillFieldIds = getRuleFillFieldIds(rule);

    conditionFieldIds.forEach(conditionFieldId => {
      fillFieldIds.forEach(fillFieldId => {
        if (!graph[conditionFieldId]) {
          graph[conditionFieldId] = [];
        }
        if (!graph[conditionFieldId].includes(fillFieldId)) {
          graph[conditionFieldId].push(fillFieldId);
        }

        const edgeKey = getEdgeKey(conditionFieldId, fillFieldId);
        if (!edgeRuleIndexes[edgeKey]) {
          edgeRuleIndexes[edgeKey] = new Set();
        }
        edgeRuleIndexes[edgeKey].add(ruleIndex);
      });
    });
  });

  const circularRuleIndexes = new Set<number>();

  Object.keys(graph).forEach(from => {
    graph[from].forEach(to => {
      const path = findPath(to, from, graph);
      if (!path) return;

      edgeRuleIndexes[getEdgeKey(from, to)]?.forEach(index => circularRuleIndexes.add(index));
      for (let index = 0; index < path.length - 1; index += 1) {
        edgeRuleIndexes[getEdgeKey(path[index], path[index + 1])]?.forEach(ruleIndex => {
          circularRuleIndexes.add(ruleIndex);
        });
      }
    });
  });

  return circularRuleIndexes;
}

export const filterCircularLinkageRules = <T extends FormLinkageRule>(rules: T[] = []) => {
  const circularRuleIndexes = getCircularLinkageRuleIndexes(rules);

  return {
    rules: rules.filter((_, index) => !circularRuleIndexes.has(index)),
    circularRuleIndexes,
  };
}
