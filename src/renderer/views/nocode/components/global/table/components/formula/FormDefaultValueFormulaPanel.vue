<template>
  <div class="form-default-value-formula-panel">
    <formula-editer
      ref="formulaEditor"
      class="form-default-value-formula-panel__editor"
      :formWidget="widget"
      :defaultTables="defaultTables"
      :tables="otherHistTables"
      :linkedTables="linkedTables"
      :filter-rule-editable="true"
      :disabledFieldMap="disabledFieldMap"
    ></formula-editer>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, onBeforeUnmount, ref, watch, type PropType } from "vue";
import { findIdByFormula, getFormulaDetailed, getFormulaStr, type FormulaConfig } from "@common/utils/formula";
import FormulaEditer from "./FormulaEditer.vue";
import { getSourceTables, replaceBracketId } from "./utils";
import { ACTIVE_ELEMENT } from "@renderer/types";
import { buildFormulaTableUID, isNocodeFormData, parseFormulaTableUID } from "@common/utils/connection";
import { linkWidgetTypeMap, isHistoryTableUID, getSourceTableUID, FORMULA_RECORD_COUNT_FIELD_ALIAS, FORMULA_RECORD_COUNT_FIELD_UID } from "@common/utils/formula";
import type { FormElement } from "@renderer/b2/controllers/form";
import { deepClone } from "@common/utils/object";
import i18next from "i18next";
import {
  buildDefaultFormulaAiContext,
  buildDefaultFormulaFieldList,
  buildDefaultFormulaFunctionList,
  type AiDefaultFormulaContext,
  buildDefaultFormulaTargetContext,
  type AiDefaultFormulaTargetContext,
} from "./aiContext";

const props = defineProps({
  value: {
    type: [String, Object] as PropType<string | FormulaConfig>,
    default: undefined,
  },
  formWidget: {
    type: Object as PropType<FormElement>,
    default: undefined,
  },
  isLimitSubform: {
    type: Boolean,
    default: false,
  },
  includeSelf: {
    type: Boolean,
    default: false,
  },
});

const formulaEditor = ref();
const injectedWidget = inject(ACTIVE_ELEMENT, ref());
const widget = computed(() => props.formWidget || injectedWidget?.value);
const isLimitSubform = computed(() => {
  return props.isLimitSubform ?? Boolean((widget.value as FormElement)?.isInSubForm);
});
const includeSelf = computed(() => {
  return props.includeSelf ?? false;
});
const currentTable = ref();
const linkedTables = ref([]);
const otherHistTables = ref([]);
const HISTORY_TABLE_UID_PREFIX = "hist_";

const currentFormLabel = computed(() => i18next.t('FormDefaultValueFormulaDialog.currentForm'));
const currentFormRowLabel = computed(() => `${currentFormLabel.value}-${i18next.t('FormDefaultValueFormulaDialog.currentRow')}`);
const currentFormHistoryLabel = computed(() => `${currentFormLabel.value}-${i18next.t('FormDefaultValueFormulaDialog.historyData')}`);

const getWidgetDefaultFormulaText = (targetWidget: FormElement) => {
  return getFormulaStr(targetWidget.getOption("default-formula"));
}

const getCurrentWidgetTitle = (widgetUID?: string) => {
  if (!widgetUID) return "";

  const activeWidget = widget.value as FormElement;
  const currentWidget = activeWidget?.topForm?.getChildElement(widgetUID);
  if (!currentWidget) return widgetUID;

  return currentWidget.isInSubForm
    ? `${currentWidget.parent.title}.${currentWidget.title}`
    : currentWidget.title;
}

const getReferencedCurrentWidgetUidList = (formulaText: string) => {
  const activeWidget = widget.value as FormElement;
  const topForm = activeWidget?.topForm;
  if (!topForm) return [];

  const [currentConnectionUID, currentTableUID] = topForm.tableUID;

  return [...new Set(findIdByFormula(formulaText).map((id) => {
    const ids = id.split(".");

    if (ids.length === 1) {
      return topForm.getChildElement(ids[0])?.uid;
    }

    const [rawTableUID, field_uid, subField_uid] = ids;
    const { connectionUID, tableUID } = parseFormulaTableUID(rawTableUID, currentConnectionUID);
    const sourceTableUID = getSourceTableUID(tableUID);

    if (connectionUID !== currentConnectionUID || sourceTableUID !== currentTableUID || isHistoryTableUID(tableUID)) {
      return undefined;
    }

    const currentWidget = topForm.getChildElement(field_uid);
    if (!currentWidget) return undefined;

    if (subField_uid) {
      const key = linkWidgetTypeMap[currentWidget.getSoul()?.type];
      if (key) return currentWidget.uid;
      return topForm.getChildElement(subField_uid)?.uid;
    }

    return currentWidget.uid;
  }).filter(Boolean))];
}

const buildLoopTooltip = (fieldTitle: string, path: string[]) => {
  return [
    i18next.t('FormulaEditer.fieldDisabledLoopReason', { field: fieldTitle }),
    i18next.t('FormulaEditer.fieldDisabledLoopPath', { path: path.join(" → ") }),
  ].join("\n");
}

const disabledFieldMap = computed<Record<string, { title: string }>>(() => {
  const activeWidget = widget.value as FormElement;
  if (!activeWidget?.topForm) return {};

  const topForm = activeWidget.topForm;
  const reverseDependencyMap = new Map<string, Set<string>>();
  const allWidgets = topForm.container.getChildWidgets(true) as FormElement[];

  allWidgets.forEach((targetWidget) => {
    const formulaText = getWidgetDefaultFormulaText(targetWidget);
    if (!formulaText) return;

    getReferencedCurrentWidgetUidList(formulaText).forEach((fieldUid) => {
      if (!fieldUid) return;

      if (!reverseDependencyMap.has(fieldUid)) {
        reverseDependencyMap.set(fieldUid, new Set());
      }

      reverseDependencyMap.get(fieldUid)?.add(targetWidget.uid);
    });
  });

  const activeWidgetTitle = getCurrentWidgetTitle(activeWidget.uid);
  const disabledFieldMapValue: Record<string, { title: string }> = {
    [activeWidget.uid]: {
      title: buildLoopTooltip(activeWidgetTitle, [activeWidgetTitle, activeWidgetTitle]),
    }
  };
  const visited = new Set<string>([activeWidget.uid]);
  const parentMap = new Map<string, string>();
  const queue = [...(reverseDependencyMap.get(activeWidget.uid) ?? [])];
  queue.forEach((fieldUid) => {
    if (!parentMap.has(fieldUid)) {
      parentMap.set(fieldUid, activeWidget.uid);
    }
  });

  while (queue.length) {
    const fieldUid = queue.shift();
    if (!fieldUid || visited.has(fieldUid)) continue;

    visited.add(fieldUid);

    const nextFieldUidList = reverseDependencyMap.get(fieldUid) ?? [];
    nextFieldUidList.forEach((nextFieldUid) => {
      if (!parentMap.has(nextFieldUid)) {
        parentMap.set(nextFieldUid, fieldUid);
      }
      queue.push(nextFieldUid);
    });
  }

  visited.forEach((fieldUid) => {
    if (fieldUid === activeWidget.uid) return;

    const pathUIDList = [fieldUid];
    let currentFieldUID = fieldUid;

    while (currentFieldUID !== activeWidget.uid) {
      const nextFieldUID = parentMap.get(currentFieldUID);
      if (!nextFieldUID) break;
      pathUIDList.push(nextFieldUID);
      currentFieldUID = nextFieldUID;
    }

    if (pathUIDList.at(-1) !== activeWidget.uid) return;

    const fieldTitle = getCurrentWidgetTitle(fieldUid);
    const pathTitleList = [activeWidgetTitle, ...pathUIDList.map(item => getCurrentWidgetTitle(item))];

    disabledFieldMapValue[fieldUid] = {
      title: buildLoopTooltip(fieldTitle, pathTitleList),
    };
  });

  return disabledFieldMapValue;
})

const defaultTables = computed(() => {
  if (!currentTable.value) return [];
  return [
    {
      ...currentTable.value,
      label: currentFormLabel.value,
      formSelectLabel: currentFormRowLabel.value,
    },
    {
      ...deepClone(currentTable.value),
      uid: `${HISTORY_TABLE_UID_PREFIX}${currentTable.value.uid}`,
      label: currentFormLabel.value,
      formSelectLabel: currentFormHistoryLabel.value,
      formulaAlias: `${currentTable.value.alias}-${i18next.t('FormDefaultValueFormulaDialog.historyData')}`,
    }
  ]
})

type FormulaTableAliasSource = {
  alias?: string;
  name?: string;
  formulaAlias?: string;
}

const getFormulaTableAlias = (table: FormulaTableAliasSource | undefined, connectionUID?: string, currentConnectionUID?: string, connectionName?: string) => {
  if (!table) return '';
  if (table?.formulaAlias) return table.formulaAlias;
  if (connectionUID && currentConnectionUID && connectionUID !== currentConnectionUID && connectionName) {
    return `${connectionName}-${table.alias}`;
  }
  return table.alias || table.name || '';
}

const updateFormulaFieldAlias = (formula: string) => {
  const activeWidget = widget.value as FormElement;
  const topForm = activeWidget?.topForm;
  if (!topForm) return formula;

  const connections = activeWidget.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || [];
  const currentConnection = connections.find(c => c.uid === topForm.tableUID[0]);
  const currentTables = currentConnection?.tables || [];
  const currentTable = currentTables.find(t => t.uid === topForm.tableUID[1]);
  if (!currentTable) return formula;

  const newFormula = replaceBracketId(formula, (ids, aliases) => {
    let [rawTableUID, field_uid, subField_uid, source_uid] = ids;

    if (ids.length === 1) {
      const currentWidget = topForm.getChildElement(ids[0]);
      rawTableUID = currentTable.uid;

      if (currentWidget?.isInSubForm) {
        subField_uid = currentWidget.uid;
        field_uid = currentWidget.form.uid
      } else if (currentWidget) {
        field_uid = currentWidget.uid;
      }
    }

    const { connectionUID, tableUID } = parseFormulaTableUID(rawTableUID, topForm.tableUID[0]);
    const sourceTableUID = getSourceTableUID(tableUID);
    const sourceConnection = connections.find(connection => connection.uid === connectionUID);
    const sourceTables = sourceConnection?.tables || [];
    const formulaTableUID = (connectionUID && tableUID)
      ? buildFormulaTableUID(connectionUID, tableUID, topForm.tableUID[0])
      : rawTableUID;
    const currentTableAlias = isHistoryTableUID(tableUID)
      ? `${currentTable.alias}-${i18next.t('FormDefaultValueFormulaDialog.historyData')}`
      : `${currentTable.alias}-${i18next.t('FormDefaultValueFormulaDialog.currentRow')}`;

    if (field_uid === FORMULA_RECORD_COUNT_FIELD_UID) {
      if (connectionUID === topForm.tableUID[0] && sourceTableUID === currentTable.uid) {
        return `${formulaTableUID}.${field_uid},${currentTableAlias}.${FORMULA_RECORD_COUNT_FIELD_ALIAS()}`
      }

      const table = sourceTables.find(t => t.uid === sourceTableUID);
      if (!table) return `${ids.join(".")},${i18next.t('FormDefaultValueFormulaDialog.formModified')}`;

      return `${formulaTableUID}.${field_uid},${getFormulaTableAlias(table, connectionUID, topForm.tableUID[0], sourceConnection?.name)}.${FORMULA_RECORD_COUNT_FIELD_ALIAS()}`
    }

    if (connectionUID === topForm.tableUID[0] && sourceTableUID === currentTable.uid) {
      const currentWidget = topForm.getChildElement(field_uid);
      if (!currentWidget) return `${ids.join(".")},${i18next.t('FormDefaultValueFormulaDialog.fieldDeleted')}`;

      if (subField_uid) {
        const key = linkWidgetTypeMap[currentWidget.getSoul()?.type];
        if (key) {
          let [ linkTableAlias ] = aliases;
          const linkTableUID = currentWidget[key];
          const linkTableConnection = connections.find(connection => connection.uid === linkTableUID?.[0]) || currentConnection;
          const t = linkTableConnection?.tables?.find(t => t.uid === linkTableUID?.[1]);
          const linkageTableField = t?.fields.find(f => f.uid === subField_uid);

          if (!linkageTableField) return `${ids.join(".")},${i18next.t('FormDefaultValueFormulaDialog.formModified')}`;

          linkTableAlias = `${currentWidget.title}-${t.alias}`
          if (source_uid) {
            const subTableUID = linkageTableField.meta.extra.subTableUID[1];
            const subTable = linkTableConnection?.tables?.find(t => t.uid === subTableUID);
            const linkageTableSubField = subTable?.fields?.find(subField => subField.uid === source_uid);

            if (!linkageTableSubField) return `${ids.join(".")},${i18next.t('FormDefaultValueFormulaDialog.formModified')}`;

            return `${formulaTableUID}.${field_uid}.${subField_uid}.${source_uid},${linkTableAlias}.${linkageTableField.alias}.${linkageTableSubField.alias}`
          } else {
            return `${formulaTableUID}.${field_uid}.${subField_uid},${linkTableAlias}.${linkageTableField.alias}`
          }
        }
        const subWidget = topForm.getChildElement(subField_uid);
        if (!subWidget) return `${ids.join(".")},${i18next.t('FormDefaultValueFormulaDialog.fieldDeleted')}`;

        return `${formulaTableUID}.${field_uid}.${subField_uid},${currentTableAlias}.${currentWidget.title}.${subWidget.title}`
      } else {
        return `${formulaTableUID}.${field_uid},${currentTableAlias}.${currentWidget.title}`
      }
    } else {
      const table = sourceTables.find(t => t.uid === sourceTableUID);
      if (!table) return `${ids.join(".")},${i18next.t('FormDefaultValueFormulaDialog.formModified')}`;

      if (subField_uid) {
        const subformField = table.fields.find(field => field.uid === field_uid);
        const subTableUID = subformField?.meta?.extra?.subTableUID?.[1];
        const subTable = sourceTables?.find(t => t.uid === subTableUID);
        const subTableField = subTable?.fields?.find(field => field.uid === subField_uid);
        if (subformField && subTableField) {
          return `${formulaTableUID}.${field_uid}.${subField_uid},${getFormulaTableAlias(table, connectionUID, topForm.tableUID[0], sourceConnection?.name)}.${subformField.alias}.${subTableField.alias}`
        } else {
          return `${ids.join(".")},${i18next.t('FormDefaultValueFormulaDialog.formModified')}`;
        }
      } else {
        const field = table.fields.find(field => field.uid === field_uid);
        if (field) {
          return `${formulaTableUID}.${field_uid},${getFormulaTableAlias(table, connectionUID, topForm.tableUID[0], sourceConnection?.name)}.${field.alias}`
        } else {
          return `${ids.join(".")},${i18next.t('FormDefaultValueFormulaDialog.formModified')}`;
        }
      }
    }
  })

  return newFormula
}

const initFormulaEditor = () => {
  const activeWidget = widget.value as FormElement;
  if (!activeWidget || !formulaEditor.value) return;

  let { targetTable, linkTables, otherTables } = getSourceTables(activeWidget, includeSelf.value) ?? {};
  if (!targetTable) return;

  if (isLimitSubform.value) {
    targetTable = deepClone(targetTable)
    targetTable.fields = targetTable.fields.filter(f => {
      if(f.meta?.extra?.widgetType != "widget.form.subform") return true;
      return f.meta?.uid == activeWidget.uid
    });
  }
  currentTable.value = targetTable;
  linkedTables.value = [...linkTables];
  otherHistTables.value = [...otherTables];

  formulaEditor.value.selectTable(currentTable.value?.uid);

  const { formula: formulaStr, filterRules } = deepClone(getFormulaDetailed(props.value))
  const currentFormula = updateFormulaFieldAlias(formulaStr)
  formulaEditor.value.init(currentFormula, filterRules);
}

const getValue = (): FormulaConfig => {
  if (!formulaEditor.value) {
    return deepClone(getFormulaDetailed(props.value));
  }

  return {
    formula: formulaEditor.value.getCodeMirrorText(),
    filterRules: formulaEditor.value.getFilterRule() ?? {},
  };
}

const setAiFormulaDraft = (value: unknown) => {
  if (!formulaEditor.value) return false;

  const formulaConfig = deepClone(getFormulaDetailed(value as string | FormulaConfig));
  formulaEditor.value.init(
    updateFormulaFieldAlias(formulaConfig.formula || ''),
    formulaConfig.filterRules || {},
  );
  return true;
}

const getAiTaskContext = (): AiDefaultFormulaContext | null => {
  const activeWidget = widget.value as FormElement | undefined;
  if (!activeWidget) return null;

  const currentFormula = String(
    formulaEditor.value?.getCodeMirrorText?.()
    || getFormulaDetailed(props.value).formula
    || ''
  );
  const fieldList = buildDefaultFormulaFieldList({
    currentTables: defaultTables.value,
    linkedTables: linkedTables.value,
    otherTables: otherHistTables.value,
    disabledFieldMap: disabledFieldMap.value,
  });

  return buildDefaultFormulaAiContext({
    widgetId: activeWidget.uid,
    widgetTitle: getCurrentWidgetTitle(activeWidget.uid) || activeWidget.title || activeWidget.uid,
    currentFormula,
    fieldList,
    formulaList: buildDefaultFormulaFunctionList(),
  });
}

const getAiSettingTargetContext = (): AiDefaultFormulaTargetContext | null => {
  const activeWidget = widget.value as FormElement | undefined;
  if (!activeWidget) return null;

  return buildDefaultFormulaTargetContext({
    widgetId: activeWidget.uid,
    widgetTitle: getCurrentWidgetTitle(activeWidget.uid) || activeWidget.title || activeWidget.uid,
  });
}

const getAiContext = (): AiDefaultFormulaContext | null => {
  return getAiTaskContext();
}

const clear = () => {
  formulaEditor.value?.clear?.();
}

watch([
  formulaEditor,
  () => props.formWidget,
  () => props.value,
  () => props.isLimitSubform,
  () => props.includeSelf,
], async () => {
  await nextTick();
  initFormulaEditor();
}, {
  immediate: true,
});

onBeforeUnmount(() => {
  clear();
});

defineExpose({
  clear,
  getValue,
  setAiFormulaDraft,
  getAiTaskContext,
  getAiSettingTargetContext,
  getAiContext,
});
</script>

<style lang="scss" scoped>
.form-default-value-formula-panel {
  width: 100%;
  height: 100%;
}
</style>
