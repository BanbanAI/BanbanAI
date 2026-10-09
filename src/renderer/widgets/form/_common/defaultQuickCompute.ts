import { createWidgetI18n } from "@renderer/widgets/i18n";
import { watch } from "vue";
import { debounce } from "lodash";
import { isEmpty } from "@common/utils/object";
import { calculateAggregation } from "@renderer/utils/autoCompute";
import { FormConditionValueType, FormWidgetType, AggregationType } from "@common/types/nocode";
import { getFormulaStr } from "@common/utils/formula";
import { isNocodeFormData, SystemField, isSystemField } from "@common/utils/connection";
import { FormLinkageCondition, SelectChoice, SelectIdOfForm } from "@renderer/b2/types";
import { FormElement, SubFormRow } from "@renderer/b2/controllers/form";
import { FilterRule } from "@common/types/nocode";
import { resolveDataSourceSelectionMeta } from "./page-permission";
import { FormMode } from "./type";

const DEFAULT_COMPUTE_TYPE_OPTION = "default-compute-type";
const DEFAULT_OTHER_TABLE_FIELD_OPTION = "default-other-table-field";
const DEFAULT_DATA_FILTER_OPTION = "default-data-filter";
const DEFAULT_AGGREGATE_TYPE_OPTION = "default-aggregate-type";
const DEFAULT_QUICK_COMPUTE_FIELD_WIDGET_TYPES = new Set([
  FormWidgetType.NUMBER_INPUT,
  FormWidgetType.AMOUNT_INPUT,
]);
const DEFAULT_QUICK_COMPUTE_AGGREGATE_TYPES = new Set([
  AggregationType.SUM,
  AggregationType.AVE,
  AggregationType.MAX,
  AggregationType.MIN,
]);

type NumericDefaultQuickComputeWidget = FormElement & {
  effectScope: {
    run: (fn: () => void) => void;
  };
  topForm?: any;
  form?: any;
  parent?: any;
  uid?: string;
  decimal?: number;
  getBoard: () => any;
  getTable: (uid?: string[]) => any;
  getOption: <T = any>(name: string, options?: { skipDefault?: boolean }) => T;
  updateLastChangeTime: () => void;
};

type WatchDefaultQuickComputeOptions = {
  widget: NumericDefaultQuickComputeWidget;
  getDecimal: () => number;
  applyValue: (value: number | null | undefined) => void;
};

const findElementByUidOrFieldId = (elements: FormElement[] = [], targetId?: string) => {
  if (!targetId) return undefined;

  return elements.find((item: FormElement) => item.uid === targetId)
    ?? elements.find((item: FormElement) => item.fieldId === targetId);
};

const getCurrentSubFormRow = (widget: NumericDefaultQuickComputeWidget) => {
  if (widget.parent instanceof SubFormRow) {
    return widget.parent as SubFormRow;
  }

  if (widget.form instanceof SubFormRow) {
    return widget.form as SubFormRow;
  }

  return undefined;
};

const getTopFormComparisonElement = (widget: NumericDefaultQuickComputeWidget, comparisonUid?: string) => {
  return findElementByUidOrFieldId(widget.topForm?.children as FormElement[], comparisonUid);
};

const getComparisonFormElement = (widget: NumericDefaultQuickComputeWidget, comparisonUid?: string) => {
  if (!comparisonUid) return undefined;
  const currentSubFormRow = getCurrentSubFormRow(widget);

  if (currentSubFormRow) {
    const [subFormFieldId, subFieldId] = comparisonUid.split(".");
    if (subFieldId) {
      const currentSubForm = currentSubFormRow.parent as FormElement | undefined;
      if (currentSubForm?.fieldId && ![currentSubForm.uid, currentSubForm.fieldId].includes(subFormFieldId)) {
        return undefined;
      }

      return findElementByUidOrFieldId(currentSubFormRow.children as FormElement[], subFieldId);
    }

    return getTopFormComparisonElement(widget, comparisonUid);
  }

  return findElementByUidOrFieldId(widget.form?.children as FormElement[], comparisonUid)
    ?? getTopFormComparisonElement(widget, comparisonUid);
};

const resolveConditionRuntimeValue = (
  widget: NumericDefaultQuickComputeWidget,
  condition: FormLinkageCondition,
) => {
  if ((condition.type && condition.type !== FormConditionValueType.FORM) || !condition.comparisonUid) {
    return condition.value;
  }

  if (condition.comparisonOfForm === SelectIdOfForm.LINKAGE) {
    const allRelatedForms = (widget.topForm?.children || [])
      .filter(child => child.getSoul().type === FormWidgetType.RELATED_DATA)
      .filter((relatedForm: any) => {
        const relatedTable = widget.getTable(relatedForm.connectionTable);
        return relatedTable?.fields?.find(f => f.uid === condition.comparisonUid);
      });
    const relatedValues = allRelatedForms
      .map((relatedData: any) => relatedData.getValue(condition.comparisonUid))
      .flat(Infinity);

    return relatedValues.length > 0 ? [...new Set(relatedValues)] : condition.value;
  }

  const comparisonForm = getComparisonFormElement(widget, condition.comparisonUid);
  if (comparisonForm) return comparisonForm.inputValue;

  // Transient rows only mount dynamic widgets. Resolve a same-row condition
  // from the raw row when its ordinary field widget is not mounted.
  const currentSubFormRow = getCurrentSubFormRow(widget);
  const [subFormFieldId, subFieldId] = condition.comparisonUid.split(".");
  const currentSubForm = currentSubFormRow?.parent as FormElement | undefined;
  if (currentSubFormRow && subFieldId && currentSubForm
    && (!currentSubForm.fieldId || [currentSubForm.uid, currentSubForm.fieldId].includes(subFormFieldId))) {
    const field = findElementByUidOrFieldId(currentSubForm.children as FormElement[], subFieldId);
    const fieldId = field?.fieldId || subFieldId;
    const row = currentSubFormRow.getRow();
    if (row && Object.prototype.hasOwnProperty.call(row, fieldId)) return row[fieldId];
  }

  return condition.value;
};

export const getDefaultQuickComputeType = (widget: NumericDefaultQuickComputeWidget) => {
  const computeType = widget.getOption<"quickCompute" | "formula">(
    DEFAULT_COMPUTE_TYPE_OPTION,
    { skipDefault: true },
  );
  if (computeType === "quickCompute" || computeType === "formula") {
    return computeType;
  }

  return getFormulaStr(widget.getOption("default-formula"))
    ? "formula"
    : "quickCompute";
};

export const getDefaultQuickComputeOtherTableFieldUID = (widget: NumericDefaultQuickComputeWidget) => {
  const value = widget.getOption<string>(DEFAULT_OTHER_TABLE_FIELD_OPTION);
  const otherTableFieldUID = value?.split(".") || [];
  if (otherTableFieldUID.length < 3) return [];

  const meta = resolveDataSourceSelectionMeta(
    widget.getBoard(),
    otherTableFieldUID.slice(0, 2),
    widget.topForm?.tableUID?.[0],
    { includeSchemaOnly: true },
  );
  const targetField = meta.table?.fields?.find(field => {
    return field.uid === otherTableFieldUID[2]
      && DEFAULT_QUICK_COMPUTE_FIELD_WIDGET_TYPES.has(field.meta?.extra?.widgetType);
  });

  return targetField ? otherTableFieldUID : [];
};

export const getDefaultQuickComputeDataFilter = (widget: NumericDefaultQuickComputeWidget) => {
  return widget.getOption<FilterRule>(DEFAULT_DATA_FILTER_OPTION);
};

/** Resolve form-based filter conditions against the current runtime widget values. */
export const getDefaultQuickComputeRuntimeDataFilter = (
  widget: NumericDefaultQuickComputeWidget,
  asFixedValues = false,
) => {
  const dataFilter = getDefaultQuickComputeDataFilter(widget);
  if (!dataFilter) return dataFilter;

  return {
    ...dataFilter,
    conditions: (dataFilter.conditions || []).map(condition => {
      const value = resolveConditionRuntimeValue(widget, condition as FormLinkageCondition);
      if (asFixedValues && (!condition.type || condition.type === FormConditionValueType.FORM) && condition.comparisonUid) {
        return {
          ...condition,
          type: FormConditionValueType.CUSTOM,
          value,
          fixedValue: value,
        };
      }
      return { ...condition, value };
    }),
  };
};

export const getDefaultQuickComputeAggregateType = (widget: NumericDefaultQuickComputeWidget) => {
  const aggregateType = widget.getOption<AggregationType>(DEFAULT_AGGREGATE_TYPE_OPTION);
  return DEFAULT_QUICK_COMPUTE_AGGREGATE_TYPES.has(aggregateType)
    ? aggregateType
    : AggregationType.SUM;
};

export const getDefaultQuickComputeFieldChoices = (widget: NumericDefaultQuickComputeWidget) => {
  const i18next = createWidgetI18n(widget.type);
  const connections = widget.getBoard().getConnections().filter(c => isNocodeFormData(c));
  if (!connections.length) return [];

  const canView = (connectionUID: string, tableUID: string) => {
    return connectionUID !== widget.topForm?.tableUID?.[0] || widget.topForm?.canReadLayerDataSync?.(tableUID);
  };

  const buildOptions = (connection) => connection.tables?.filter(t => {
    return isEmpty(t.meta?.extra?.primaryTable)
      && !t.meta?.extra?.isAggregateTable
      && canView(connection.uid, t.uid);
  }).map(t => {
    const { baseFields, subFields } = t.fields.reduce<{ baseFields: any[]; subFields: any[] }>((prev, f) => {
      if (isSystemField(f)) return prev;
      if (f.meta?.uid === widget.uid) return prev;
      if (f.meta.subType === "subForm") {
        prev.subFields.push(f);
      } else {
        prev.baseFields.push(f);
      }
      return prev;
    }, { baseFields: [], subFields: [] });
    const baseOptions = baseFields
      .filter(f => DEFAULT_QUICK_COMPUTE_FIELD_WIDGET_TYPES.has(f.meta?.extra?.widgetType))
      .map(f => ({ label: f.alias, value: `${connection.uid}.${t.uid}.${f.uid}` }));
    const subOptions = subFields.map(f => {
      const subTable = connection.tables.find(t => t.uid === f.meta?.extra?.subTableUID?.[1]);
      return subTable?.fields?.filter(sf => {
        return !isSystemField(sf)
          && DEFAULT_QUICK_COMPUTE_FIELD_WIDGET_TYPES.has(sf.meta?.extra?.widgetType);
      }).map(sf => ({
        label: `${f.alias}.${sf.alias}`,
        value: `${f.meta.extra?.subTableUID?.join(".")}.${sf.uid}`,
      })) ?? [];
    });
    const isCurrent = t.uid === widget.topForm?.tableUID?.[1];
    return {
      label: isCurrent ? i18next.t("currentForm") : t.alias,
      value: t.uid,
      isCurrent,
      children: [...baseOptions, ...subOptions.flat(Infinity)],
    };
  }).filter(option => option.children?.length > 0) || [];

  if (connections.length === 1) {
    return buildOptions(connections[0]).sort((a, b) => b.isCurrent - a.isCurrent);
  }

  return connections.map(connection => {
    const options = buildOptions(connection).sort((a, b) => b.isCurrent - a.isCurrent);
    return {
      label: connection.name,
      value: connection.uid,
      children: options,
      isCurrent: options.some(item => item.isCurrent),
    };
  }).filter(option => option.children?.length > 0).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
};

export const isDefaultQuickComputeDataFilterVisible = (widget: NumericDefaultQuickComputeWidget) => {
  const otherTableFieldUID = getDefaultQuickComputeOtherTableFieldUID(widget);
  const meta = resolveDataSourceSelectionMeta(
    widget.getBoard(),
    otherTableFieldUID?.slice(0, 2),
    widget.topForm?.tableUID?.[0],
    { includeSchemaOnly: true },
  );
  return getDefaultQuickComputeType(widget) === "quickCompute" && widget.getOption(DEFAULT_OTHER_TABLE_FIELD_OPTION) && meta.table !== undefined;
};

export const getDefaultQuickComputeAggregateChoices = (widget: { type?: string }) => {
  const i18next = createWidgetI18n(widget.type);
  const aggregationOptionText: Partial<Record<AggregationType, string>> = {
    [AggregationType.SUM]: i18next.t("aggregation.sum"),
    [AggregationType.AVE]: i18next.t("aggregation.ave"),
    [AggregationType.MAX]: i18next.t("aggregation.max"),
    [AggregationType.MIN]: i18next.t("aggregation.min"),
  };

  return Object.entries(aggregationOptionText).map(([key, value]) => ({
    label: value,
    value: key,
  }));
};

export const watchDefaultQuickComputeValue = ({
  widget,
  getDecimal,
  applyValue,
}: WatchDefaultQuickComputeOptions) => {
  const aggregationConditionWatchStops: Array<() => void> = [];
  let calculationVersion = 0;
  const triggerAggregationCalculation = debounce((
    preserveExistingValue: boolean,
    scheduledValue: unknown,
    version: number,
  ) => {
    if (
      preserveExistingValue
      && widget.inputValue !== undefined
      && widget.inputValue !== null
      && widget.inputValue !== ""
    ) {
      return;
    }
    void calculateQuickComputeValue(scheduledValue, version);
  }, 300);
  const scheduleAggregationCalculation = (preserveExistingValue = false) => {
    calculationVersion += 1;
    triggerAggregationCalculation(preserveExistingValue, widget.inputValue, calculationVersion);
  };
  const isEditMode = () => widget.getBoard().formMode === FormMode.Edit;

  const getRuntimeDataFilter = () => {
    return getDefaultQuickComputeRuntimeDataFilter(widget);
  };

  const clearAggregationConditionWatchers = () => {
    calculationVersion += 1;
    triggerAggregationCalculation.cancel();
    aggregationConditionWatchStops.forEach(stop => stop());
    aggregationConditionWatchStops.length = 0;
  };

  const bindAggregationConditionWatchers = () => {
    const dataFilter = getDefaultQuickComputeDataFilter(widget);
    if (isEmpty(dataFilter?.conditions)) return;

    widget.effectScope.run(() => {
      dataFilter.conditions.forEach(condition => {
        if (condition.type !== FormConditionValueType.FORM || !condition.comparisonUid) {
          return;
        }

        if (condition.comparisonOfForm === SelectIdOfForm.LINKAGE) {
          const allRelatedForms = (widget.topForm?.children || [])
            .filter(child => child.getSoul().type === FormWidgetType.RELATED_DATA)
            .filter((relatedForm: any) => {
              const relatedTable = widget.getTable(relatedForm.connectionTable);
              return relatedTable?.fields?.find(f => f.uid === condition.comparisonUid);
            });
          let isInitialWatchCallback = !isEditMode();

          const stop = watch(() => {
            return allRelatedForms.map((relatedData: any) => relatedData.getValue(condition.comparisonUid));
          }, () => {
            scheduleAggregationCalculation(isInitialWatchCallback);
            isInitialWatchCallback = false;
          }, { deep: true, immediate: !isEditMode() });

          aggregationConditionWatchStops.push(stop);
          return;
        }

        let isInitialWatchCallback = !isEditMode();
        const stop = watch(() => {
          const comparisonWidget = getComparisonFormElement(widget, condition.comparisonUid);
          return {
            forceWatch: widget.topForm?.forceWatch?.value,
            widgetUid: comparisonWidget?.uid,
            value: comparisonWidget?.inputValue,
            lastChangeTime: comparisonWidget?.status?.lastChangeTime,
          };
        }, () => {
          scheduleAggregationCalculation(isInitialWatchCallback);
          isInitialWatchCallback = false;
        }, { deep: true, immediate: !isEditMode() });

        aggregationConditionWatchStops.push(stop);
      });
    });
  };

  const refreshAggregationWatchers = (preserveExistingValue = false) => {
    clearAggregationConditionWatchers();
    if (getDefaultQuickComputeType(widget) !== "quickCompute") return;

    bindAggregationConditionWatchers();
    if (!isEditMode()) {
      scheduleAggregationCalculation(preserveExistingValue);
    }
  };

  const calculateQuickComputeValue = async (scheduledValue: unknown, version: number) => {
    if (!widget.getBoard().isProjectReady || getDefaultQuickComputeType(widget) !== "quickCompute") {
      return;
    }

    const otherTableFieldUID = getDefaultQuickComputeOtherTableFieldUID(widget);
    let value: number | null | undefined;
    if (otherTableFieldUID.length < 3) {
      value = null;
    } else {
      const dataSourceMeta = resolveDataSourceSelectionMeta(
        widget.getBoard(),
        otherTableFieldUID.slice(0, 2),
        widget.topForm?.tableUID?.[0],
        { includeSchemaOnly: true },
      );
      if (!dataSourceMeta.nocodeId || (!dataSourceMeta.isCurrentConnection && !dataSourceMeta.hasViewPermission)) {
        value = null;
      } else {
        value = await calculateAggregation({
          otherTableFieldUID,
          dataFilter: getRuntimeDataFilter() as FilterRule,
          nocodeId: dataSourceMeta.nocodeId,
          aggregateType: getDefaultQuickComputeAggregateType(widget) as AggregationType,
          decimal: getDecimal(),
        }) as number | null | undefined;
      }
    }

    if (version !== calculationVersion || !Object.is(widget.inputValue, scheduledValue)) return;

    applyValue(value);
    widget.updateLastChangeTime();
  };

  widget.effectScope.run(() => {
    let isInitialConfigurationWatchCallback = true;
    watch(() => ({
      isProjectReady: widget.getBoard().isProjectReady,
      computeType: getDefaultQuickComputeType(widget),
      otherTableField: widget.getOption<string>(DEFAULT_OTHER_TABLE_FIELD_OPTION),
      aggregateType: getDefaultQuickComputeAggregateType(widget),
      dataFilter: getDefaultQuickComputeDataFilter(widget),
      decimal: getDecimal(),
      forceWatch: widget.topForm?.forceWatch?.value,
    }), (value, previousValue) => {
      const hasQuickComputeSource = Boolean(value.otherTableField || previousValue?.otherTableField);
      if (hasQuickComputeSource) {
        refreshAggregationWatchers(isInitialConfigurationWatchCallback && !isEditMode());
      }
      isInitialConfigurationWatchCallback = false;
    }, { deep: true, immediate: true });
  });
};
