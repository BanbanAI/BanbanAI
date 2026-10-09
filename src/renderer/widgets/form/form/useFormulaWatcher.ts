import { findIdByFormula, replaceByFormula, collectFormulaFieldUsages, extractFnIdsFromText, getFormulaDetailed, FormulaConfig, createFormulaRuntimeByWidget } from "@common/utils/formula";
import { FormElement, SubFormRow } from "@renderer/b2/controllers/form";
import { buildFormulaValueMap, FieldUsage, getFormulaDependencySignals, getFormulaFieldValues, getReferencedTableCacheKey, parseFormulaTableUID, refreshReferencedTableFieldCache, getQuoteFieldLastChange, refreshSearchFormCacheIfNeeded } from "./function";
import { watch, type WatchStopHandle } from "vue";
import { ElMessage } from "element-plus";
import { equals } from "@common/utils/object";
import i18next from "@renderer/widgets/i18next";

const warnedFormulaCycleKeys = new Set<string>();

function getFormulaWidgetId(formElement: FormElement) {
  const currentTableUID = formElement.topForm?.tableUID?.[1];
  if (!currentTableUID) return formElement.uid;

  const subFormUID = (formElement as any).form?.form?.uid;
  if (formElement.isInSubForm && subFormUID) {
    return `${currentTableUID}.${subFormUID}.${formElement.uid}`;
  }

  return `${currentTableUID}.${formElement.uid}`;
}

function normalizeFormulaWidgetId(formElement: FormElement, idPath?: string) {
  if (!idPath) return null;

  const segments = idPath.split(".");
  if (segments.length === 1) {
    return idPath;
  }

  const currentTableUID = formElement.topForm?.tableUID;
  if (!currentTableUID?.length) return null;

  const [rawTableUID, fieldUID, subFieldUID] = segments;
  const { connectionUID, tableUID } = parseFormulaTableUID(rawTableUID, currentTableUID[0]);
  if (connectionUID !== currentTableUID[0] || tableUID !== currentTableUID[1]) {
    return null;
  }

  return subFieldUID ? `${tableUID}.${fieldUID}.${subFieldUID}` : `${tableUID}.${fieldUID}`;
}

function getFormulaWidgetById(formElement: FormElement, widgetId: string) {
  const topForm = formElement.topForm;
  if (!topForm) return undefined;

  const segments = widgetId.split(".");
  if (segments.length === 1) {
    return topForm.container.getChildWidgets(true).find(widget => widget.uid === widgetId) as FormElement | undefined;
  }

  if (segments.length >= 3) {
    return topForm.getChildElement(segments[2]) as FormElement | undefined;
  }

  return topForm.getChildElement(segments[1]) as FormElement | undefined;
}

function getFormulaSource(widget?: FormElement | null) {
  if (!widget) return null;

  if ((widget as any).computeType === "formula" && (widget as any).formulaValue) {
    return (widget as any).formulaValue as string | FormulaConfig;
  }

  if ((widget as any).defaultType === "formula" && (widget as any).defaultFormulaValue) {
    return (widget as any).defaultFormulaValue as string | FormulaConfig;
  }

  return null;
}

function getFormulaWidgetTitle(formElement: FormElement, widgetId: string) {
  const widget = getFormulaWidgetById(formElement, widgetId);
  if (!widget) return i18next.t("unknownField");

  let title = widget.title || i18next.t("unknownField");
  const subFormTitle = (widget as any).form?.form?.title;
  if (widget.isInSubForm && subFormTitle) {
    title = `${subFormTitle}.${title}`;
  }

  return title;
}

function detectFormulaCycle(formElement: FormElement) {
  const startWidgetId = getFormulaWidgetId(formElement);
  const visited = new Set<string>();
  const currentPath: string[] = [];
  const currentPathSet = new Set<string>();

  const walk = (widgetId: string): string[] | null => {
    if (currentPathSet.has(widgetId)) {
      const cycleStartIndex = currentPath.indexOf(widgetId);
      return currentPath.slice(cycleStartIndex);
    }

    if (visited.has(widgetId)) return null;
    visited.add(widgetId);
    currentPath.push(widgetId);
    currentPathSet.add(widgetId);

    const widget = getFormulaWidgetById(formElement, widgetId);
    const formula = getFormulaSource(widget);
    if (formula) {
      const { formula: formulaStr } = getFormulaDetailed(formula);
      const referencedWidgetIds = findIdByFormula(formulaStr)
        .map(id => normalizeFormulaWidgetId(formElement, id))
        .filter(Boolean) as string[];

      for (const referencedWidgetId of referencedWidgetIds) {
        const cycle = walk(referencedWidgetId);
        if (cycle) {
          return cycle;
        }
      }
    }

    currentPath.pop();
    currentPathSet.delete(widgetId);
    return null;
  };

  return walk(startWidgetId);
}

function warnFormulaCycle(formElement: FormElement, cycleWidgetIds: string[]) {
  if (!cycleWidgetIds.length) return;

  const cycleKey = [...new Set(cycleWidgetIds)].sort().join("|");
  if (!cycleKey || warnedFormulaCycleKeys.has(cycleKey)) return;

  warnedFormulaCycleKeys.add(cycleKey);

  const fieldTitles = [...new Set(cycleWidgetIds.map(widgetId => getFormulaWidgetTitle(formElement, widgetId)))];
  ElMessage.warning(i18next.t("defaultFormulaCycleWarning", {
    fields: fieldTitles.join(i18next.t("fieldSeparator")),
  }));
}

function createCoalescedRunner<T>(task: (value?: T) => Promise<void>) {
  let scheduled = false;
  let running = false;
  let stopped = false;
  let hasPending = false;
  let pendingValue: T | undefined;
  const run = async () => {
    if (running || stopped) return;
    scheduled = false;
    running = true;
    try {
      while (hasPending && !stopped) {
        const value = pendingValue;
        hasPending = false;
        pendingValue = undefined;
        await task(value);
      }
    } finally {
      running = false;
      if (hasPending && !stopped && !scheduled) {
        scheduled = true;
        queueMicrotask(() => void run());
      }
    }
  };
  return {
    schedule(value?: T) {
      if (stopped) return;
      if (!hasPending) pendingValue = value;
      hasPending = true;
      if (!running && !scheduled) {
        scheduled = true;
        queueMicrotask(() => void run());
      }
    },
    stop() {
      stopped = true;
      hasPending = false;
      pendingValue = undefined;
    },
  };
}

export function useFormulaWatcher(options: {
  formElement: FormElement;
  formula: string | FormulaConfig;
  fieldType: string;
  isEditMode: boolean;
  onBeforeCalculate?: () => boolean | void;
  normalizeResult?: (value: any) => any;
  onApplyResult: (value: any) => void;
  onAfterCalculate?: (value: any, changed: boolean) => void;
  onError?: (options: {
    error: unknown;
    formula: string;
    replacedFormula: string;
    valueMap: Record<string, any>;
  }) => void;
}) {
  const {
    formElement,
    formula,
    isEditMode,
    onBeforeCalculate,
    normalizeResult,
    onApplyResult,
    onAfterCalculate,
    onError
  } = options;

  const { formula: formulaStr, filterRules } = getFormulaDetailed(formula);
  const ids = findIdByFormula(formulaStr);
  const formulaFieldMap:Map<string, FieldUsage[]> = collectFormulaFieldUsages(formulaStr);
  const formulaWithoutFnId = extractFnIdsFromText(formulaStr)?.textWithoutIds ?? formulaStr;
  let hasAppliedManualInitialValue = false;

  const createFormulaWatch = (): WatchStopHandle | undefined => {
    const currentTableUID = formElement.topForm?.tableUID;
    if (!currentTableUID?.[1]) return;

    const cycleWidgetIds = detectFormulaCycle(formElement);
    if (cycleWidgetIds?.length) {
      warnFormulaCycle(formElement, cycleWidgetIds);
      return;
    }

    const { idsThisTable, idsReferencedTable } = ids.reduce((pre, id) => {
      const [rawTableUID] = id.split(".");
      const { connectionUID, tableUID } = parseFormulaTableUID(rawTableUID, formElement.topForm.tableUID[0]);
      if (connectionUID === currentTableUID[0] && tableUID === currentTableUID[1]) {
        pre.idsThisTable.push(id);
      } else {
        pre.idsReferencedTable.push(id);
      }
      return pre;
    }, {idsThisTable: [] as string[], idsReferencedTable: [] as string[]});

    const subFormRow = formElement.form instanceof SubFormRow
      ? formElement.form
      : undefined;
    const row = subFormRow?.getRow() as Record<string, unknown> | undefined;
    const shouldApplyManualInitialValue = isEditMode &&
      !!subFormRow &&
      row?.isManualAdd === true &&
      !Object.prototype.hasOwnProperty.call(row, formElement.fieldId) &&
      !hasAppliedManualInitialValue;
    let isInitialCallback = true;

    const calculate = async (oldSignals?: ReturnType<typeof getFormulaDependencySignals>) => {
        const bypassEditChangeGate = isInitialCallback && shouldApplyManualInitialValue;
        isInitialCallback = false;
        if (bypassEditChangeGate) {
          hasAppliedManualInitialValue = true;
        }

        if (onBeforeCalculate && onBeforeCalculate() === false) return;

        if (isEditMode && !bypassEditChangeGate) {
          const times = Object.values(getQuoteFieldLastChange(formElement, idsThisTable, formulaFieldMap) || {})
          .flat(Infinity)
          .filter(Boolean);
          if (!times.length) return;
        }

      // A virtual subform only mounts visible rows. Ensure formula-backed
      // columns are materialized in the raw rows before collecting a column
      // dependency, without retaining a full row/component for every item.
      if (!formElement.isInSubForm) {
        const dynamicTargets = new Map<any, Set<string>>();
        for (const id of idsThisTable) {
          const [, fieldUID, subFieldUID] = id.split(".");
          if (!fieldUID || !subFieldUID) continue;
          const subForm = formElement.topForm?.getChildElement(fieldUID) as any;
          if (subForm?.ensureDynamicFieldValues) {
            if (!dynamicTargets.has(subForm)) dynamicTargets.set(subForm, new Set());
            dynamicTargets.get(subForm)!.add(subFieldUID);
          }
        }
        await Promise.all([...dynamicTargets].map(([subForm, fieldIds]) => {
          return subForm.ensureDynamicFieldValues([...fieldIds]);
        }));
      }

      const depMap = getFormulaFieldValues(formElement, idsThisTable, formulaFieldMap);
      await refreshSearchFormCacheIfNeeded(depMap.queryDeps, oldSignals?.queryDeps, formElement);

        await refreshReferencedTableFieldCache(formElement, idsReferencedTable, filterRules, formulaFieldMap);

        const valueMap = buildFormulaValueMap({
          formElement,
          commonDeps: depMap.formulaDeps,
          queryDeps: depMap.queryDeps,
          formulaFieldMap
        });

        const replaceCursor: Record<string, number> = {};
        const replaced = replaceByFormula(formulaWithoutFnId, (keys) => {
          const id = keys.join('.');

          const index = replaceCursor[id] ?? 0;
          const usage = formulaFieldMap.get(id)?.[index];
          replaceCursor[id] = index + 1;

          if (idsThisTable.includes(id)) {
            const values = valueMap[id];
            if (!Array.isArray(values)) {
              return values ?? null;
            }

            return values[index] ?? null;
          } else {
            const cacheKey = getReferencedTableCacheKey(usage, keys[1]);
            if (!cacheKey) return null;
            return formElement.otherTableDataCache?.[cacheKey]?.[id] ?? null;
          }
        });

        const formulaRuntime = createFormulaRuntimeByWidget(formElement)

        try {
          const rawValue = formulaRuntime?.evaluate(replaced);
          const value = normalizeResult ? normalizeResult(rawValue) : rawValue;
          const changed = !equals(formElement.inputValue, value);
          if (changed) {
          onApplyResult(value);
          formElement.updateLastChangeTime();
          }
          onAfterCalculate?.(value, changed);
        } catch (error) {
          onError?.({
            error,
            formula: formulaStr,
            replacedFormula: replaced!,
            valueMap
          });
        }
    };
    const runner = createCoalescedRunner(calculate);
    const stopWatch = watch(
      () => getFormulaDependencySignals(formElement, idsThisTable, formulaFieldMap),
      (_, oldSignals) => runner.schedule(oldSignals),
      { immediate: !isEditMode || shouldApplyManualInitialValue, deep: true }
    );
    return () => { runner.stop(); stopWatch(); };
  };

  let stopFormulaWatch: WatchStopHandle | undefined;
  const stopReadyWatch = watch(
    () => formElement.topForm?.tableUID?.join("."),
    (tableUIDKey) => {
      if (!tableUIDKey) return;
      stopFormulaWatch?.();
      stopFormulaWatch = createFormulaWatch();
    },
    { immediate: true }
  );

  return () => {
    stopFormulaWatch?.();
    stopReadyWatch();
  };
}
