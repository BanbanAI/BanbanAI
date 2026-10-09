import { ref } from "vue";
import { Column } from "./table";
import { getSystemColumnConfigurations } from "./utils";
import { RuleFunc, RuleFuncTextMapping, RuleFuncValue } from "@common/types/nocode";
import { SystemField, isSystemField } from "@common/utils/connection";
import { formElementInstances } from "@renderer/utils/instance";
import { FormElement } from "@renderer/b2/controllers/form";
import { isAutoComputeColumn } from "./column-capability";

export type FilterOption = {
  label: string;
  value: string;
  column?: Column;
  parent?: Column;
  style?: Record<string, string>;
}

export type FilterFieldTarget = {
  key: string;
  elementId?: string;
  widgetType?: string;
  systemColumnName?: string;
}

type BuildFilterOptionsConfig = {
  excludeTopLevelRelated?: boolean;
  excludeCurrentOwner?: boolean;
}

export const buildFilterOptions = (
  columns: Column[],
  config: BuildFilterOptionsConfig = {},
): FilterOption[] => {
  const { excludeTopLevelRelated = false, excludeCurrentOwner = false } = config;
  const { subColumns, baseColumns } = columns.reduce<{ subColumns: Column[], baseColumns: Column[] }>((prev, column) => {
    if (excludeTopLevelRelated && column.subType === "related") return prev;
    if ([SystemField.DATA_TITLE, SystemField.UUID, SystemField.RELATED_SUB_FORM].includes(column.name as any)) return prev;
    if (["widget.form.dateRangePicker"].includes(column.extra?.widgetType)) return prev;
    if (isAutoComputeColumn(column)) return prev;
    if (Object.hasOwn(column, "subColumns")) {
      prev.subColumns.push(column);
    } else {
      prev.baseColumns.push(column);
    }
    return prev;
  }, { subColumns: [], baseColumns: [] });

  const subOptions = subColumns.map(col => {
    return col.subColumns.filter(item => {
      return (item.subType !== "related")
        && ![SystemField.UUID, SystemField.RELATED_SUB_FORM].includes(item.name as any)
        && !isAutoComputeColumn(item);
    }).map(subCol => {
      return {
        label: `${col.alias}.${subCol.alias}`,
        value: `${col.uid}.${subCol.uid}`,
        column: subCol,
        parent: col,
      };
    });
  }).flat(Infinity) as FilterOption[];

  const baseOptions = baseColumns.map(col => {
    const isSystem = isSystemField({ meta: { name: col.name } } as any);
    return {
      label: col.alias,
      value: col.uid,
      column: col,
      style: isSystem ? { color: "var(--color-primary)" } : {},
    };
  }).filter(item => {
    return !excludeCurrentOwner || item.column?.name !== "_current_owner";
  });

  return [...baseOptions, ...subOptions];
};

export const createColumnFilterTarget = (column: Column, parentColumn?: Column): FilterFieldTarget => {
  return {
    key: column.isSubColumn ? `${parentColumn?.uid}.${column.uid}` : column.uid,
    elementId: column.elementId,
    widgetType: column.extra?.widgetType,
    systemColumnName: column.name,
  };
};

export const createOptionFilterTarget = (fieldId: string, option?: FilterOption): FilterFieldTarget => {
  return {
    key: fieldId,
    elementId: option?.column?.elementId,
    widgetType: option?.column?.extra?.widgetType,
    systemColumnName: option?.column?.name,
  };
};

export const useFilterElementResolver = (getCurrentElement: (elementId?: string) => FormElement | undefined) => {
  const fallbackInstanceMap = ref<Record<string, FormElement>>({});
  const pendingInstanceMap = new Map<string, Promise<FormElement | undefined>>();

  const resolveInstance = async (target?: FilterFieldTarget) => {
    if (!target?.key) return;
    const element = getCurrentElement(target.elementId);
    if (element) {
      return element;
    }
    const cached = fallbackInstanceMap.value[target.key];
    if (cached) {
      return cached;
    }
    if (!target.widgetType) return;
    const pending = pendingInstanceMap.get(target.key);
    if (pending) {
      return await pending;
    }
    const promise = formElementInstances.getInstance(target.widgetType).then((instance) => {
      fallbackInstanceMap.value = {
        ...fallbackInstanceMap.value,
        [target.key]: instance,
      };
      return instance;
    }).finally(() => {
      pendingInstanceMap.delete(target.key);
    });
    pendingInstanceMap.set(target.key, promise);
    return await promise;
  };

  const getInstance = (target?: FilterFieldTarget) => {
    if (!target?.key) return;
    const element = getCurrentElement(target.elementId);
    if (element) {
      return element;
    }
    const cached = fallbackInstanceMap.value[target.key];
    if (!cached && target.widgetType) {
      void resolveInstance(target);
    }
    return cached;
  };

  return {
    resolveInstance,
    getInstance,
  };
};

export const getFilterConfigurations = (
  target: FilterFieldTarget | undefined,
  instance?: FormElement,
) => {
  if (instance) {
    return instance.getConfigurations();
  }
  return getSystemColumnConfigurations(target?.systemColumnName);
};

export const getFilterFuncInfo = (
  target: FilterFieldTarget | undefined,
  instance?: FormElement,
) => {
  return getFilterConfigurations(target, instance)?.funcInfo || {};
};

export const getFilterFuncValue = (
  target: FilterFieldTarget | undefined,
  func: RuleFunc,
  instance?: FormElement,
): RuleFuncValue => {
  const funcInfo = getFilterFuncInfo(target, instance);
  return funcInfo[func] || funcInfo[RuleFunc.EQUAL];
};

export const getFilterFuncTextLabel = (
  func: RuleFunc,
  instance?: FormElement,
) => {
  return instance?.getConfigurations()?.editFuncInfoText?.[func] || RuleFuncTextMapping[func];
};

export const getFilterDefaultValue = (type: RuleFuncValue) => {
  if ([RuleFuncValue.SELECT_MULTIPLE, RuleFuncValue.RANGE, RuleFuncValue.TAGS].includes(type)) {
    return [];
  }
  return "";
};

export const isFilterValueVisible = (func: RuleFunc, extraHiddenFuncs: RuleFunc[] = []) => {
  return ![RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, ...extraHiddenFuncs].includes(func);
};
