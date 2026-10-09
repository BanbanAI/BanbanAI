<template>
  <div class="container">
    <div class="container-header">
      <div class="header-title">
        <span>{{ widget?.title || $t('FormulaEditer.formula') }} =</span>
      </div>
      <div class="header-options">
        <div class="copy" color="var(--text-color-secondary)" @click="handleCopyFormula">
          <el-icon :size="16"><i-ven-copy-formula /></el-icon>
          {{ $t('FormulaEditer.copy') }}
        </div>
      </div>
    </div>
    <div class="container-code" ref="editorRef">
      <CodeMirror class="mirror" ref="codeMirrorRef" :placeholder="$t('FormulaEditer.editPlaceholder')"
        :extensions="extensions" wrap @update="handleUpdate" @ready="handleReady"/>
      <div class="formula-error" v-show="hasError"> {{ errorMessage }}</div>
    </div>
    <div class="container-list">
      <div class="fields-container" v-if="supportTableFields">
        <span class="title">{{ $t('FormulaEditer.formField') }}</span>
        <div class="fields-search">
          <el-input :placeholder="$t('FormulaEditer.searchField')" v-model="fieldInput">
            <template #prefix>
              <el-icon :size="12"><i-ven-search /></el-icon>
            </template>
          </el-input>
        </div>

        <form-select :options="tablesOption" :modelValue="tableUIDOfSelected"
          @update:modelValue="(val) => tableUIDOfSelected = val" filterable :placeholder="$t('FormulaEditer.selectForm')" :no-data-text="$t('FormulaEditer.noData')"
          :show-arrow="false" :offset="4">
          <template #prefix>
            <el-icon :size="12"><i-ven-subtract /></el-icon>
          </template>
          <template #option-icon>
            <el-icon :size="12"><i-ven-subtract /></el-icon>
          </template>
        </form-select>

        <div class="fields-list" v-if="!fieldInput">
          <div class="filed-item" :class="{ 'filed-item--disabled': isFieldDisabled(item) }" :title="getFieldItemTitle(item)" v-for="item in fieldList" @click="handleFieldClick(item)">
            <span class="item-name" :title="getFieldItemTitle(item)" v-html="highlight(getWidgetTitle(item, false), fieldInput)"></span>
            <el-tag :style="getTagData(item).style ?? {}" size="small" class="item-attr">
              {{ getTagData(item).text }}
            </el-tag>
          </div>
        </div>
        <div class="fields-list" v-else>
          <div class="filed-item" :class="{ 'filed-item--disabled': isFieldDisabled(item) }" :title="getFieldItemTitle(item)" v-for="item in searchFieldList" @click="handleFieldClick(item)">
            <span class="item-name" :title="getFieldItemTitle(item)" v-html="highlight(getWidgetTitle(item, false), fieldInput)"></span>
            <el-tag :style="getTagData(item).style ?? {}" size="small" class="item-attr">
              {{ getTagData(item).text }}
            </el-tag>
          </div>
        </div>
      </div>
      <div class="formula-menu">
        <span class="title">{{ $t('FormulaEditer.funcList') }}</span>
        <div class="formula-search">
          <el-input :placeholder="$t('FormulaEditer.searchFunc')" v-model="formulaInput">
            <template #prefix>
              <el-icon :size="12"><i-ven-icon-search /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="formula-list" v-if="!formulaInput">
          <div class="formula-category" v-for="(category, index) in formula">
            <div class="title" @click="toggleCategory(index)">
              <el-icon :size="12" v-if="category.isExpanded">
                <CaretBottom />
              </el-icon>
              <el-icon :size="12" v-else>
                <CaretRight />
              </el-icon>
              <span>{{ category.title }}</span>
            </div>
            <div class="children" v-show="category.isExpanded">
              <div class="formula-item" v-for="item in category.children" @click="insertClick(item, 'fn')"
                @mouseenter="handleMouseEnter(item)">
                <div class="item-name">{{ item.name }}</div>
                <div class="item-subName">{{ item.subName }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="search-list" v-else>
          <div class="formula-item" v-for="item in searchFormulaList" @click="insertClick(item, 'fn')"
            @mouseenter="handleMouseEnter(item)">
            <div class="item-name" v-html="highlight(item.name, formulaInput)"></div>
            <div class="item-subName">{{ item.subName }}</div>
          </div>
        </div>
      </div>
      <div class="formula-intro">
        <el-scrollbar height="100%">
        <formula-filter-rule v-if="filterRuleEditable && fnIdEditingRule && filterRuleContext" :widget="(filterRuleContext as FormElement)" :formulaFilterMap="formulaFilterRule[fnIdEditingRule]"></formula-filter-rule>
        <el-divider v-if="filterRuleEditable && fnIdEditingRule && filterRuleContext" />
        <slot v-if="tagConfigEditable && currentTagMeta" name="tag-config" :tag="currentTagMeta"></slot>
        <el-divider v-if="tagConfigEditable && currentTagMeta" />

          <template v-if="showOperateTipBlock">
            <div class="formula-title">{{ $t('FormulaEditer.operateTip') }}</div>
            <template v-if="!currentFormula">
              <ul class="default-intro-wrapper">
                <li>{{ $t('FormulaEditer.tip') }}</li>
              </ul>
            </template>
            <template v-else>
              <div class="formula-name">
                {{ currentFormula.name }}
              </div>
              <div class="formula-container">
                <ul class="intro-wrapper">
                  <li class="intro"><span class="li-title">{{ $t('FormulaEditer.func') }}:</span><span
                      v-html="highlightFormula(currentFormula.intro)"></span></li>
                  <li class="usage"><span class="li-title">{{ $t('FormulaEditer.usage') }}:</span><span
                      v-html="highlightFormula(currentFormula.usage)"></span></li>
                  <li class="example"><span class="li-title">{{ $t('FormulaEditer.example') }}:</span><span
                      v-html="highlightFormula(currentFormula.example)"></span></li>
                </ul>
              </div>
            </template>
          </template>

        </el-scrollbar>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ref, computed, watch, inject, Ref, shallowRef } from "vue";
import CodeMirror from "vue-codemirror6";
import { useClipboard } from '@vueuse/core'
import { EditorView, ViewUpdate } from "@codemirror/view";
import { createExtensions, insertText, getCurrentFnFirstScopeFields, getFnArgsRange, PlaceholderTagMeta, setFnScopeEffect, setTagActiveEffect, fnScopeField } from './codemirror';
import { findInvalidFormulaEscape, formulaList, getBoardConnectionsByNocodeBody, getFormulaCodeText, getNocodeDataSourceTableByOptionTableUID, getNocodeDataSourceTableByUID, scanFormula } from "@common/utils";
import { ElMessage } from "element-plus";
import { CaretRight, CaretBottom } from '@element-plus/icons-vue'
import { filedType } from "./types";
import { buildFormulaFieldToken, normalizeFormula, checkChineseQuotesInFormulaByScan, isFormulaHiddenField } from "./utils";
import { buildFormulaTableUID, isSystemField } from "@common/utils/connection";
import { extractFnIdsFromText, FnMeta, FormulaCategory, FORMULA_RECORD_COUNT_FIELD_ALIAS, FORMULA_RECORD_COUNT_FIELD_UID, getSourceTableUID, isHistoryTableUID, linkWidgetTypeMap } from "@common/utils/formula";
import { FieldUID } from "@common/types/project";
import { unique } from "@common/utils/unique";
import { AbstractForm, FormElement } from "@renderer/b2/controllers/form";
import { ConnectionUID, Field, OptionTableUID, Table, TableUID, TableWithSource } from "@common/types/project";
import { ACTIVE_ELEMENT, NOCODE } from "@renderer/types";
import { deepClone, isEmpty } from "@common/utils/object";
import i18next from "i18next";
import { FilterRule } from "@common/types/nocode";
import FormulaFilterRule from "./FormulaFilterRule.vue";
import { fnMetaField, parseFnMetas } from "./fnMeta";
import { isNocodeFormData } from "@common/utils/connection";

type FieldWithSource = Field & {
  tableUID: string;
  subTableUID?: string;
  linkedForm?: string;
}

type TableWithFormulaSource = (Table | TableWithSource) & {
  connectionUID?: ConnectionUID;
  sourceConnectionUID?: ConnectionUID;
  sourceTableUID?: TableUID;
  formulaAlias?: string;
  formSelectLabel?: string;
  linkedForm?: string;
}

const props = withDefaults(defineProps<{
  defaultTables: Table[];
  linkedTables?: TableWithSource[];
  tables: TableWithSource[];
  otherTableLabel: string;
  defaultValue?: string;
  hiddenCurrentTable?: boolean;
  supportTableFields?: boolean;
  supportCategories?: FormulaCategory[];
  filterRuleEditable?: boolean;
  filterFunctions?: string[];
  filterRuleFunctionNames?: string[];
  tagConfigEditable?: boolean;
  resolveTagInsertContent?: (field: FieldWithSource) => string;
  formWidget?: any;
  filterRuleContext?: any;
  allowCurrentTableFunctionFilter?: boolean;
  disabledFieldMap?: Record<string, { title: string }>;
}>(), {
  tables: () => [],
  linkedTables: () => [],
  otherTableLabel: () => i18next.t('FormulaEditer.otherForm'),
  hiddenCurrentTable: false,
  supportTableFields: true,
  filterRuleEditable: false,
  filterFunctions: () => [],
  filterRuleFunctionNames: () => [],
  tagConfigEditable: false,
  resolveTagInsertContent: undefined,
  formWidget: null,
  filterRuleContext: null,
  allowCurrentTableFunctionFilter: false,
  disabledFieldMap: () => ({}),
});

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update:formula", value: boolean): void;
  (event: "tag-click", value: PlaceholderTagMeta): void;
  (event: "tag-clear"): void;
}>();

const { copy } = useClipboard({ legacy: true });
const codeMirrorRef = ref();
const fieldInput = ref('');
const formulaInput = ref('');
const currentFormula = ref();
const defaultFormula = ref(formulaList);
const formula = computed(() => {
  return defaultFormula.value
    .filter(item => !props.supportCategories || props.supportCategories.includes(item.category))
    .map(item => ({
      ...item,
      children: item.children.filter(fn => !props.filterFunctions.includes(fn.name)),
    }))
    .filter(item => item.children.length > 0);
});
const tableUIDOfSelected = ref();
const nocode = inject(NOCODE)
const injectedWidget = inject(ACTIVE_ELEMENT);
const widget = computed(() => props.formWidget || injectedWidget?.value);
const createCurrentTableFilterContext = () => {
  const body = nocode.value?.body;
  const nocodeId = nocode.value?.meta?.id;
  const currentTableUID = getSourceTableUID(props.defaultTables[0]?.uid);
  if (!body || !currentTableUID) return null;

  const currentDataSource = getNocodeDataSourceTableByUID(
    body,
    currentTableUID,
    { nocodeId },
    true,
  );
  const currentConnectionUID = currentDataSource?.connection?.uid as ConnectionUID | undefined;
  if (!currentConnectionUID) return null;

  const connections = getBoardConnectionsByNocodeBody(body, { nocodeId });
  const getContextTable = (optionTableUID?: OptionTableUID) => {
    if (!optionTableUID?.[0] || !optionTableUID?.[1]) return undefined;
    return getNocodeDataSourceTableByOptionTableUID(
      body,
      optionTableUID,
      { nocodeId },
      true,
    )?.table;
  };

  return {
    topForm: {
      tableUID: [currentConnectionUID, currentTableUID] as OptionTableUID,
    },
    getBoard: () => ({
      nocodeId,
      getConnections: () => connections,
    }),
    getTable: (optionTableUID?: OptionTableUID | TableUID) => {
      if (!optionTableUID) return undefined;
      if (Array.isArray(optionTableUID)) {
        return getContextTable(optionTableUID as OptionTableUID);
      }
      return getContextTable([currentConnectionUID, optionTableUID as TableUID]);
    },
    getField: (path: [ConnectionUID?, TableUID?, FieldUID?, FieldUID?]) => {
      const [connectionUID = currentConnectionUID, tableUID = currentTableUID, fieldUID, subFieldUID] = path || [];
      if (!fieldUID) return undefined;

      const table = getContextTable([connectionUID, tableUID]);
      const field = table?.fields?.find(item => item.uid === fieldUID);
      if (!field) return undefined;
      if (!subFieldUID) return field;
      return field.subTableFields?.find(item => item.uid === subFieldUID);
    },
  };
}
const filterRuleContext = computed(() => {
  if (props.filterRuleContext?.topForm?.tableUID) return props.filterRuleContext as FormElement;
  const currentWidget = widget.value as FormElement | undefined;
  if (currentWidget?.topForm?.tableUID) return currentWidget;
  if (!props.allowCurrentTableFunctionFilter) return null;
  return createCurrentTableFilterContext() as FormElement | null;
});
const formulaFilterRule = ref<Record<string, Record<TableUID, FilterRule>>>({});
const fnIdEditingRule = ref();
const currentTagMeta = ref<PlaceholderTagMeta | null>(null);
const showOperateTipBlock = computed(() => !(props.tagConfigEditable && currentTagMeta.value));
const formulaTextOutFnIdInited = ref()
const getAllTables = () => [...props.tables, ...props.defaultTables, ...props.linkedTables].filter(Boolean);
const getTableConnectionUID = (table?: Table | TableWithSource) => {
  return table?.['connectionUID'] || (filterRuleContext.value as FormElement | undefined)?.topForm?.tableUID?.[0];
}
const getTableSourceConnectionUID = (table?: TableWithFormulaSource) => {
  return table?.sourceConnectionUID || table?.connectionUID || getTableConnectionUID(table);
}
const getTableSourceUID = (table?: TableWithFormulaSource) => {
  if (!table) return undefined;
  return table.sourceTableUID || getSourceTableUID(table.uid);
}
const getTableSourceKey = (table?: TableWithFormulaSource) => {
  const connectionUID = getTableSourceConnectionUID(table);
  const tableUID = getTableSourceUID(table);
  if (!connectionUID || !tableUID) return undefined;
  return `${connectionUID}.${tableUID}`;
}

const getTableByUID = (tableUID?: string) => {
  return getAllTables().find(t => t.uid === tableUID);
}
const getTableSelectLabel = (table: Table | TableWithSource) => {
  return table?.['formSelectLabel'] || table.alias || table.name;
}
const getTableFormulaAlias = (table: Table | TableWithSource) => {
  return table?.['formulaAlias'] || table.alias || table.name;
}
const buildPrefixedTableLabel = (prefix: string, label: string) => {
  return `${prefix}-${label}`;
}
const shouldAppendRecordCountField = (table?: Table | TableWithSource) => {
  if (!table) return false;
  return isHistoryTableUID(table.uid) || props.tables.some(item => item.uid === table.uid);
}
const createRecordCountField = (table: Table | TableWithSource): FieldWithSource => {
  return {
    uid: FORMULA_RECORD_COUNT_FIELD_UID as FieldUID,
    alias: FORMULA_RECORD_COUNT_FIELD_ALIAS(),
    type: "number",
    tableUID: table.uid,
    linkedForm: table['linkedForm'],
    meta: {
      name: "recordCount",
      uid: FORMULA_RECORD_COUNT_FIELD_UID as FieldUID,
      extra: {
        widgetType: "widget.form.numberInput"
      },
    }
  }
}

const currentSourceConnectionUID = computed(() => {
  return (filterRuleContext.value as FormElement | undefined)?.topForm?.tableUID?.[0]
    || widget.value?.topForm?.tableUID?.[0];
})
const currentSourceTableUID = computed(() => {
  return getSourceTableUID(props.defaultTables[0]?.uid);
})
const relatedFromOtherTableKeys = computed(() => {
  const currentConnectionUID = currentSourceConnectionUID.value;
  const currentTableUID = currentSourceTableUID.value;
  if (!currentConnectionUID || !currentTableUID) return new Set<string>();

  const connections = widget.value?.getBoard()?.getConnections?.()?.filter(connection => isNocodeFormData(connection)) || [];
  const relatedKeys = new Set<string>();

  connections.forEach(connection => {
    connection.tables?.forEach(table => {
      if (table.meta?.extra?.primaryTable) return;

      const isRelatedToCurrentTable = table.fields?.some(field => {
        const relatedTableUID = field.meta?.extra?.relatedTableUID;
        return relatedTableUID?.[0] === currentConnectionUID && relatedTableUID?.[1] === currentTableUID;
      });

      if (isRelatedToCurrentTable) {
        relatedKeys.add(`${connection.uid}.${table.uid}`);
      }
    });
  });

  return relatedKeys;
})
const linkedGroupTables = computed(() => {
  return props.linkedTables as TableWithFormulaSource[];
})
const linkedGroupTableKeys = computed(() => {
  return new Set(linkedGroupTables.value.map(table => getTableSourceKey(table)).filter(Boolean));
})
const relatedGroupTables = computed(() => {
  const options = new Map<string, TableWithFormulaSource>();
  const relatedMyFormPrefix = i18next.t('FormulaEditer.relatedMyForm');
  const pushTable = (table?: TableWithFormulaSource) => {
    const key = getTableSourceKey(table);
    if (!key || linkedGroupTableKeys.value.has(key) || options.has(key)) return;
    const nextTable = deepClone(table) as TableWithFormulaSource;
    const tableLabel = getTableSelectLabel(nextTable);
    const tableAlias = getTableFormulaAlias(nextTable);
    const prefixedLabel = buildPrefixedTableLabel(relatedMyFormPrefix, tableLabel);
    const prefixedAlias = buildPrefixedTableLabel(relatedMyFormPrefix, tableAlias);
    nextTable.name = prefixedLabel;
    nextTable.alias = prefixedAlias;
    nextTable.formSelectLabel = prefixedLabel;
    nextTable.formulaAlias = prefixedAlias;
    options.set(key, nextTable);
  };

  props.tables
    .filter(table => relatedFromOtherTableKeys.value.has(getTableSourceKey(table as TableWithFormulaSource) || ''))
    .forEach(table => pushTable(table as TableWithFormulaSource));

  return [...linkedGroupTables.value, ...options.values()];
})
const otherGroupTables = computed(() => {
  const relatedKeys = new Set(relatedGroupTables.value.map(table => getTableSourceKey(table)).filter(Boolean));
  const options = new Map<string, TableWithFormulaSource>();

  props.tables.forEach(table => {
    const tableWithSource = table as TableWithFormulaSource;
    const key = getTableSourceKey(tableWithSource);
    if (!key || relatedKeys.has(key) || options.has(key)) return;
    options.set(key, tableWithSource);
  });

  return [...options.values()];
})

const tablesOption = computed(() => {
  if (!props.defaultTables) return [];

  const tableGroups = []
  if (!props.hiddenCurrentTable) {
    if (props.defaultTables.length) {
      tableGroups.push({
        label: props.defaultTables[0]?.['label'] || i18next.t('FormulaEditer.currentForm'),
        options: props.defaultTables.map(t => {
          return {
            value: t.uid,
            label: getTableSelectLabel(t)
          }
        }),
      })
    }
  }

  if (relatedGroupTables.value.length) {
    tableGroups.push({
      label: i18next.t('FormulaEditer.relatedForm'),
      options: relatedGroupTables.value.map(t => {
        return {
          value: t.uid,
          label: getTableSelectLabel(t)
        }
      })
    })
  }

  if (otherGroupTables.value.length) {
    tableGroups.push({
      label: props.otherTableLabel,
      options: otherGroupTables.value.map(t => {
        return {
          value: t.uid,
          label: t.name
        }
      })
    })
  }

  return tableGroups
})

const fieldList = computed<FieldWithSource[]>(() => {
  const table = getTableByUID(tableUIDOfSelected.value)

  const fields = table?.fields.reduce((acc, field) => {
    if (!isSystemField(field) && !isFormulaHiddenField(field)) {
      if (field.meta.extra.widgetType === "widget.form.subform") {
        const subTableUID = field.meta?.extra?.subTableUID?.[1];
        const currentConnectionUID = (filterRuleContext.value as FormElement | undefined)?.topForm?.tableUID?.[0];
        const currentSubTableUID = subTableUID
          ? buildFormulaTableUID(getTableConnectionUID(table), subTableUID, currentConnectionUID)
          : undefined;
        const tables = nocode.value.body?.formData?.tables;
        const curTable = getTableByUID(currentSubTableUID) || tables.find(t => t.uid === subTableUID);
        let subFields = [];
        // 当前表单中新增未保存的字段数据存在subTableFields，只有在从当前表字段进入公式编辑才显示，关联表则直接使用fields
        const currentContext = filterRuleContext.value;
        const topForm = currentContext instanceof AbstractForm ? currentContext : (currentContext as FormElement | undefined)?.topForm;
        if (topForm && topForm.tableUID?.[1] === getSourceTableUID(table.uid)) {
          subFields = field.subTableFields ?? [];
        } else {
          subFields = curTable?.fields ?? [];
        }
        acc.push(...(subFields.filter(subTableField => !isSystemField(subTableField) && !isFormulaHiddenField(subTableField)).map(subTableField => {
          return {
            ...subTableField,
            tableUID: table.uid,
            subTableUID: field.uid,
            linkedForm: table['linkedForm']
          }
        }) ?? []))
      } else {
        acc.push({
          ...field,
          tableUID: table.uid,
          linkedForm: table['linkedForm']
        })
      }
    }
    return acc
  }, []) ?? []

  if (shouldAppendRecordCountField(table)) {
    fields.push(createRecordCountField(table));
  }

  return fields
})
const formulaChildren = computed(() => {
  return formula.value.flatMap((category) => category.children || []);
})
const searchFieldList = computed(() => {
  return fieldList.value.filter((item) => {
    return item.alias.includes(fieldInput.value)
  }) ?? []
})
const getFieldDisabledMeta = (field: FieldWithSource) => {
  const currentTableUID = props.defaultTables[0]?.uid;
  if (!currentTableUID || field.tableUID !== currentTableUID) return null;

  const fieldUID = field.meta?.uid ?? field.uid;
  return props.disabledFieldMap?.[fieldUID] ?? null;
}
const isFieldDisabled = (field: FieldWithSource) => {
  return Boolean(getFieldDisabledMeta(field));
}
const getFieldItemTitle = (field: FieldWithSource) => {
  return getFieldDisabledMeta(field)?.title || getWidgetTitle(field, false);
}
const enabledFieldList = computed(() => {
  return fieldList.value.filter(item => !isFieldDisabled(item));
})
const searchFormulaList = computed(() => {
  const seen = new Set();
  return formulaChildren.value.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(formulaInput.value.toLowerCase()) || item.subName.includes(formulaInput.value);

    if (matchesSearch && !seen.has(item.name)) {
      seen.add(item.name);
      return true;
    }

    return false;
  })
})

function getFnScopeFieldMap(
  formula: string
): Record<string, string[]> {

  const result: Record<string, string[]> = {}

  let depth = 0
  let inSingleQuote = false
  let inDoubleQuote = false
  let inBracket = false
  let escapeNext = false

  const fnStack: {
    fid: string
    paramDepth: number
  }[] = []

  for (let i = 0; i < formula.length; i++) {

    const ch = formula[i]
    const next = formula[i + 1]

    /* 转义 */
    if (escapeNext) {
      escapeNext = false
      continue
    }
    if (ch === '\\') {
      escapeNext = true
      continue
    }

    /* 字符串切换 */
    if (!inBracket) {
      if (ch === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote
        continue
      }
      if (ch === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote
        continue
      }
    }

    if (inSingleQuote || inDoubleQuote) continue

    /* [[ 字段 */
    if (!inBracket && ch === '[' && next === '[') {

      inBracket = true

      const end = formula.indexOf(']]', i + 2)
      if (end === -1) break

      // 只有函数第一层才采集
      if (fnStack.length) {
        const currentFn = fnStack[fnStack.length - 1]

        if (depth === currentFn.paramDepth) {

          const content = formula.slice(i + 2, end)
          const [fieldId] = content.split(',')

          result[currentFn.fid].push(fieldId)
        }
      }

      i = end + 1
      inBracket = false
      continue
    }

    /* 识别函数名<fid>( */
    if (ch === '<') {

      // 向前找函数名
      let j = i - 1
      while (j >= 0 && /[a-zA-Z0-9_]/.test(formula[j])) j--

      const funcName = formula.slice(j + 1, i)

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(funcName)) continue

      const end = formula.indexOf('>', i + 1)
      if (end === -1) continue

      const fid = formula.slice(i + 1, end)
      if (!/^[a-zA-Z0-9_-]+$/.test(fid)) continue

      if (formula[end + 1] !== '(') continue

      // 注册函数
      fnStack.push({
        fid,
        paramDepth: depth + 1
      })

      result[fid] = []

      continue
    }

    /* 处理括号 */
    if (ch === '(') {
      depth++
      continue
    }

    if (ch === ')') {
      depth--

      // 函数结束
      if (fnStack.length) {
        const current = fnStack[fnStack.length - 1]

        if (depth < current.paramDepth - 1) {
          fnStack.pop()
        }
      }

      continue
    }
  }

  return result
}

const cancelSelectFnScope = () => { 
  const view = editorView.value
  if (!view) return

  const currentDeco = view.state.field(fnScopeField, false)

  if (!currentDeco || currentDeco.length === 0) return;
  fnIdEditingRule.value = null;

  editorView.value.dispatch({
    effects: setFnScopeEffect.of(null)
  });
}

const cancelSelectTagConfig = () => {
  const view = editorView.value;
  if (view) {
    view.dispatch({
      effects: setTagActiveEffect.of(null)
    });
  }
  if (!currentTagMeta.value) return;
  currentTagMeta.value = null;
  emit('tag-clear');
}

const resolveClickedFnMeta = (view: EditorView, pos: number, currentFnMeta?: FnMeta | null) => {
  if (currentFnMeta) return currentFnMeta;

  const currentFnMetas = view.state.field(fnMetaField, false) || [];
  const scannedFnMeta = parseFnMetas(view.state.doc.toString()).find(meta => {
    return pos >= meta.nameFrom && pos <= meta.nameTo;
  });
  if (!scannedFnMeta) return null;

  return currentFnMetas.find(meta => {
    return meta.name === scannedFnMeta.name
      && meta.nameFrom === scannedFnMeta.nameFrom
      && meta.nameTo === scannedFnMeta.nameTo;
  }) || scannedFnMeta;
}

const handleClickFunc = ({view, fnMeta, pos}: {view: EditorView, fnMeta: FnMeta, pos: number}) => {
  if (!props.filterRuleEditable) return;
  const currentWidget = filterRuleContext.value as FormElement | undefined;
  if (!currentWidget?.topForm?.tableUID) {
    cancelSelectFnScope();
    return;
  }

  const clickedFnMeta = resolveClickedFnMeta(view, pos, fnMeta);
  if (!clickedFnMeta) {
    cancelSelectFnScope();
    return;
  }

  cancelSelectTagConfig();

  if (props.filterRuleFunctionNames.length) {
    const isSupportedFunction = props.filterRuleFunctionNames.includes(String(clickedFnMeta.name || "").toUpperCase());
    if (!isSupportedFunction) {
      cancelSelectFnScope();
      return;
    }
  }

  const funcCilcked = formula.value.flatMap(item => item.children).find(item => item.name === clickedFnMeta.name);
  if (funcCilcked) currentFormula.value = funcCilcked;

  // 公式合法性判断，作用域、字符串未闭合都会导致字符串扫描出错
  if (hasError.value) {
    ElMessage.warning(i18next.t("FormulaEditer.clickFuncWarning"));
    cancelSelectFnScope();
    return;
  }

  const fieldPaths = getCurrentFnFirstScopeFields({
    view,
    fnMeta: clickedFnMeta
  });
  const currentTableUID = currentWidget.topForm.tableUID;
  const filterableFieldPaths = fieldPaths.filter(path => {
    const [tableUID, fieldUID, subFieldUID, sourceFieldUID] = path.split('.');

    if (isHistoryTableUID(tableUID)) {
      return true;
    }

    if (tableUID === currentTableUID[1]) {
      const field = currentWidget.getField([...currentTableUID, fieldUID as FieldUID]);
      if (!field) return false;

      if (props.allowCurrentTableFunctionFilter) return true;
      if (linkWidgetTypeMap[field?.meta.extra.widgetType]) return true;
    } else {
      return true;
    }
  })
  if (!filterableFieldPaths.length) {
    cancelSelectFnScope();
    return;
  }

  const argsRange = getFnArgsRange(view, clickedFnMeta);
  if (!argsRange) {
    cancelSelectFnScope();
    return;
  }
  view.dispatch({
    effects: setFnScopeEffect.of({
      from: clickedFnMeta.nameFrom,
      to: argsRange.end + 1
    })
  })

  if (clickedFnMeta.fnId) {
    fnIdEditingRule.value = clickedFnMeta.fnId;
  } else {
    const fnId = unique();
    clickedFnMeta.fnId = fnId;
    fnIdEditingRule.value = fnId;
  }

  if (!formulaFilterRule.value[fnIdEditingRule.value]) formulaFilterRule.value[fnIdEditingRule.value] = {};
  const filterRuleMap = formulaFilterRule.value[fnIdEditingRule.value];
  for (const path of filterableFieldPaths) {
    const [tableUID, fieldUID, subFieldUID, sourceFieldUID] = path.split('.');
    if (!filterRuleMap[tableUID]) {
      filterRuleMap[tableUID] = {
        logic: 'AND',
        conditions: []
      }
    }
  }
}

const handleClickTag = ({ tagMeta }: { view: EditorView, tagMeta: PlaceholderTagMeta | null, pos: number }) => {
  if (!props.tagConfigEditable) return;

  if (!tagMeta) {
    cancelSelectTagConfig();
    return;
  }

  cancelSelectFnScope();
  const view = editorView.value;
  if (view) {
    view.dispatch({
      effects: setTagActiveEffect.of({
        from: tagMeta.from,
        to: tagMeta.to,
      }),
    });
  }
  currentTagMeta.value = tagMeta;
  emit('tag-click', tagMeta);
}

const extensions = shallowRef<any[]>([])
// const extensions = computed(() => { 
//   if (!fieldList.value || !formulaChildren.value) return []

//   return [
//     fnMetaField.init(()=>initFnMetas.value),
//     ...createExtensions(
//       fieldList.value,
//       formulaChildren.value,
//       {fnPlugin: { clickHandler: handleClickFunc }}
//     )
//   ]
// })

const hasError = ref(false);
const errorMessage = ref('');

const hexToRgba = (hex: string, alpha: number = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getTagData = (field: FieldWithSource) => {
  const tagType = filedType.find(type => type.filed.some(filedname => filedname === field.meta.extra.widgetType)) ?? filedType.find(type => type.filed.includes('widget.form.textInput'));
  return {
    text: tagType.name,
    style: {
      '--tag-color': tagType.color,
      '--tag-bg-color': hexToRgba(tagType.color, 0.1),
    }
  };
};

const getWidgetTitle = (field: FieldWithSource, hasPrefixOfTableTitle: boolean = true): string => {
  const table = getTableByUID(field.tableUID);
  const subform = table?.fields.find(f => f.uid === field.subTableUID);
  const tableAlias = hasPrefixOfTableTitle && table ? getTableFormulaAlias(table) : '';
  return `${tableAlias ? `${tableAlias}.` : ''}${subform ? `${subform.alias}.` : ''}${field.alias}`;
};

function isEnglishQuoteClosed(text: string): boolean {
  return scanFormula(text, {
    onEnd(ctx) {
      return !ctx.inSingleQuote && !ctx.inDoubleQuote;
    }
  });
}

function isEnglishQuoteClosedAndBracketSafe(text: string): boolean {
  return scanFormula(text, {
    onBracketChar(ch, ctx) {
      if (
        ch === '"' ||
        ch === "'" ||
        (ch === '[') ||
        (ch === ']')
      ) {
        return false;
      }
      return true;
    },
    onEnd(ctx) {
      return !ctx.inSingleQuote && !ctx.inDoubleQuote && !ctx.inBracket;
    }
  });
}

const formulaValidator = (view: ViewUpdate) => {
  const text = view.state.doc.toString().trim();
  hasError.value = false;
  errorMessage.value = '';

  // 空内容时不显示任何状态
  if (!text) return;
  const formulaCodeText = getFormulaCodeText(text);
  const quoteUnclosed = !isEnglishQuoteClosed(text);
  const bracketText = quoteUnclosed ? text : formulaCodeText;

  // 1. 检查括号匹配
  const openBrackets = (bracketText.match(/\(/g) || []).length;
  const closeBrackets = (bracketText.match(/\)/g) || []).length;
  if (openBrackets !== closeBrackets) {
    hasError.value = true;
    cancelSelectFnScope();
    errorMessage.value = i18next.t('FormulaEditer.parenthesesUnclosed');
    return;
  }

  // 2. 检查未闭合的英文引号（" 和 '）
  if (quoteUnclosed) {
    hasError.value = true;
    cancelSelectFnScope();
    errorMessage.value = i18next.t('FormulaEditer.quotationUnclosed');
    return;
  }

  if (!isEnglishQuoteClosedAndBracketSafe(text)) {
    hasError.value = true;
    cancelSelectFnScope();
    errorMessage.value = i18next.t('FormulaEditer.invalidChar');
    return;
  }

  // 3. 检查非法转义（正则表达式参数允许 \d、\s 等正则转义）
  const invalidEscape = findInvalidFormulaEscape(text);
  if (invalidEscape) {
    hasError.value = true;
    cancelSelectFnScope();
    errorMessage.value = `${i18next.t('FormulaEditer.escapedChar')}: ${invalidEscape}`;
    return;
  }

  // 4. 检查中文引号
  if (checkChineseQuotesInFormulaByScan(text)?.length) {
    hasError.value = true;
    cancelSelectFnScope();
    errorMessage.value = i18next.t('FormulaEditer.notUseChineseQuotation');
    return;
  }

  // 5. 检查函数调用
  const functionNames = formulaChildren.value.map(fn => fn.name);
  if (functionNames.length > 0) {
    const escapedNames = functionNames.map(name =>
      name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    );

    const functionCallRegex = new RegExp(
      `\\b(${escapedNames.join('|')})\\b(?!((<[a-zA-Z0-9_-]+>)?\\())`,
      'g'
    );

    let match;
    while ((match = functionCallRegex.exec(formulaCodeText)) !== null) {
      hasError.value = true;
      cancelSelectFnScope();
      errorMessage.value = `${i18next.t('FormulaEditer.funcTip')} ${match[0]} ${i18next.t('FormulaEditer.missParentheses')}`;
      return;
    }
  }
};

const highlight = (text, keyword) => {
  if (!keyword || !text) return text;
  const regex = new RegExp(keyword, "g");
  return text.replace(regex, `<span class="keyword">${keyword}</span>`);
};

const toggleCategory = (index: number) => {
  const category = formula.value[index];
  const target = defaultFormula.value.find(item => item.category === category.category);
  if (target) {
    target.isExpanded = !target.isExpanded;
  }
};

const highlightFormula = (text) => {
  if (!text) return text;

  return text.replace(/([A-Z][A-Z0-9_]+)/g, '<span class="formula-name">$1</span>');
};

const insertTitleText = (fieldWithSource: FieldWithSource, type: "fn" | "tag") => {
  if (codeMirrorRef.value) {
    const linkedForm = fieldWithSource.linkedForm
    const table = getTableByUID(fieldWithSource.tableUID)
    const parentField = fieldWithSource.subTableUID
      ? table?.fields.find(f => f.uid === fieldWithSource.subTableUID)
      : undefined
    const content = type === "tag"
      ? (props.resolveTagInsertContent?.(fieldWithSource) || buildFormulaFieldToken({
        tableUID: linkedForm ?? fieldWithSource.tableUID,
        tableLabel: table ? getTableFormulaAlias(table) : "",
        field: fieldWithSource,
        parentField,
      }))
      : `${fieldWithSource.alias}()`;
    codeMirrorRef.value.replaceSelection(content)
    if (type === "fn") {
      codeMirrorRef.value.setCursor(codeMirrorRef.value.getCursor() - 1)
    }
    codeMirrorRef.value.focus = true
  }
};
const handleFieldClick = (fieldWithSource: FieldWithSource) => {
  if (isFieldDisabled(fieldWithSource)) return;
  insertTitleText(fieldWithSource, 'tag');
}
const insertClick = (item, type: 'tag' | 'fn') => {
  insertText(codeMirrorRef.value, item, type, {
    tagPlugin: {
      resolveInsertContent: props.resolveTagInsertContent,
    }
  });
};

const handleCopyFormula = () => {
  if (!editorView.value?.state?.doc) return;
  copy(editorView.value.state.doc.toString() || '');
  ElMessage.success(i18next.t('FormulaEditer.copySuccess'));
}
const handleMouseEnter = (item) => {
  if (fnIdEditingRule.value || currentTagMeta.value) return;
  currentFormula.value = item;
}

const selectTable = (tableUID) => {
  tableUIDOfSelected.value = tableUID;
}
const getFirstSelectableTableUID = () => {
  for (const group of tablesOption.value) {
    const value = group.options?.[0]?.value;
    if (value) return value;
  }
  return undefined;
}

const setEditorFormula = (formulaText: string) => { 
  if (!editorView.value) return;
  editorView.value.dispatch({
    changes: {
      from: 0,
      to: editorView.value.state.doc.length,
      insert: formulaText
    }
  })
}

const insertFnId = (formulaText: string) => {
  if (!editorView.value) return formulaText;

  const doc = editorView.value.state.doc.toString()
  const metas = editorView.value.state.field(fnMetaField)

  let offset = 0
  let result = doc

  for (const fn of metas) {
    if (!fn.fnId) continue

    const insertPos = fn.nameTo + offset

    const insertText = `<${fn.fnId}>`

    result =
      result.slice(0, insertPos) +
      insertText +
      result.slice(insertPos)

    offset += insertText.length
  }

  return result
}

const initExtensions = (metas) => { 
  extensions.value = [
    fnMetaField.init(() => metas),
    ...createExtensions(
      enabledFieldList.value,
      formulaChildren.value,
      {
        fnPlugin: { clickHandler: handleClickFunc },
        tagPlugin: {
          clickHandler: handleClickTag,
          resolveInsertContent: props.resolveTagInsertContent,
        }
      }
    )
  ]
}

function getCurrentFnIds(view: EditorView) {
  const metas = view.state.field(fnMetaField, false)
  return metas?.map(m => m.fnId)
}

function syncFilterRule(view: EditorView) {
  const validFnIds = getCurrentFnIds(view)
  if (!validFnIds) return;

  for (const fnId of Object.keys(formulaFilterRule.value)) {
    if (!validFnIds.includes(fnId)) {
      delete formulaFilterRule.value[fnId]
    }
  }
}

const handleUpdate = (viewUpdate: ViewUpdate) => {
  if (!editorView.value) return

  formulaValidator(viewUpdate);

  if (viewUpdate.docChanged) {
    cancelSelectFnScope();
    cancelSelectTagConfig();
    syncFilterRule(viewUpdate.view);
  }
}

const editorView = ref<EditorView | null>(null)
const handleReady = (payload: { view: Ref<EditorView> }) => {
  editorView.value = payload.view.value;
  setEditorFormula(formulaTextOutFnIdInited.value)
}

watch(
  () => [enabledFieldList.value, formulaChildren.value],
  () => {
    const metas = editorView.value?.state.field(fnMetaField, false) || [];
    initExtensions(metas);
  },
  { deep: true }
)
watch(
  tablesOption,
  (options) => {
    const hasSelectedTable = options.some(group => group.options?.some(option => option.value === tableUIDOfSelected.value));
    if (hasSelectedTable) return;

    const firstTableUID = getFirstSelectableTableUID();
    if (firstTableUID) selectTable(firstTableUID);
  },
  { immediate: true, deep: true }
)

defineExpose({
  getCodeMirrorText: () => {
    let formulaStr = editorView.value?.state.doc.toString() || '';
    if (props.filterRuleEditable) formulaStr = insertFnId(formulaStr);

    if (!isEnglishQuoteClosed(formulaStr) 
    || !isEnglishQuoteClosedAndBracketSafe(formulaStr)
    || checkChineseQuotesInFormulaByScan(formulaStr)?.length) {
      return formulaStr
    }
    return normalizeFormula(formulaStr);
  },
  setCodeMirrorText: (text: string) => {
    setEditorFormula(text || '');
  },
  getFilterRule: () => formulaFilterRule.value,
  init: (text: string, filterRules?: Record<string, Record<TableUID, FilterRule>>) => {
    if (props.filterRuleEditable) formulaFilterRule.value = deepClone(filterRules ?? {});
    cancelSelectTagConfig();
    const { textWithoutIds, metas } = extractFnIdsFromText(text)
    initExtensions(metas);
    formulaTextOutFnIdInited.value = textWithoutIds;
    // init 可能发生在编辑器 ready 之后，这里需要主动回填文本
    setEditorFormula(textWithoutIds);
  },
  selectTable: selectTable,
  clear: () => {
    currentFormula.value = null;
    cancelSelectFnScope();
    cancelSelectTagConfig();
    formulaInput.value = "";
    fieldInput.value = "";
    defaultFormula.value = formulaList.map((item) => ({ ...item, isExpanded: false }));
  }
});

</script>

<style lang="scss" scoped>
.container {
  width: 100%;
  height: 100%;
  border: 1px solid var(--border-color);

  .container-header {
    height: 40px;
    font-size: 16px;
    color: var(--text-color-primary);
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-color-overlay);
    padding: 0 16px;

    .header-title {
      font-weight: 500;
    }

    .header-options {
      display: flex;
      align-items: center;
      font-size: 14px;
      color: var(--text-color-secondary);

      .copy {
        cursor: pointer;
        display: flex;
        align-items: center;

        &:hover {
          color: var(--color-primary);
        }

        .el-icon {
          margin-right: 2px;
        }
      }
    }
  }

  .container-code {
    display: flex;
    flex-direction: column;
    min-height: 148px;
    border-bottom: 1px solid var(--border-color);
    line-height: 20px;
    font-size: 12px;
    color: var(--text-color-regular);
    cursor: text;

    :deep(.cm-editor.cm-focused) {
      outline: none !important;
    }

    .vue-codemirror {
      font-size: 14px;
      padding: 16px;
    }

    .mirror {
      flex: 1;
      overflow: auto;
    }

    .formula-error {
      background: #FAAD1426;
      color: var(--color-danger);
      height: 32px;
      line-height: 16px;
      font-size: 12px;
      padding: 8px;
    }
  }

  .container-list {
    display: flex;
    flex-direction: row;
    height: 328px;

    .fields-container {
      width: 320px;
      height: 328px;
      padding: 16px;

      .title {
        font-size: 12px;
        line-height: 16px;
        color: var(--text-color-secondary);
      }

      .fields-search {
        height: 34px;
        margin: 8px 0 16px 0;
        overflow: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;

        :deep(.el-input) {
          --el-input-placeholder-color: var(--text-color-placeholder);

          .el-input__wrapper {
            border-radius: 4px;
            border: 1px solid var(--border-color);
            padding: 0 0 0 9px;
            box-shadow: none;
            height: 32px;

            .el-input__prefix {
              color: var(--text-color-regular);
            }
          }
        }

        &::-webkit-scrollbar {
          display: none;
        }
      }

      .form-select {
        margin-bottom: 8px;

          :deep(.el-select__wrapper) {
            border-radius: 4px;
            border: 1px solid var(--border-color);
            padding: 0 8px 0 8px;
            box-shadow: none;
            height: 32px;

            .el-input__prefix {
              color: var(--text-color-regular);
            }
          }
      }

      .fields-list {
        width: 100%;
        max-height: 180px;
        overflow: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;

        &::-webkit-scrollbar {
          display: none;
        }

        .filed-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 32px;
          padding: 6px 8px;
          border-radius: 4px;

          .item-name {
            font-size: 14px;
            max-width: 180px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .item-attr {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 20px;
            line-height: 20px;
            padding: 0 4px;
            font-size: 12px;
            border-radius: 2px;
            border: none !important;
            color: var(--tag-color) !important;
            background-color: var(--tag-bg-color) !important;
          }

          &:hover {
            cursor: pointer;
            background-color: var(--bg-color-hover);
          }

          &--disabled {
            opacity: 0.56;
            cursor: not-allowed;

            &:hover {
              cursor: not-allowed;
              background-color: transparent;
            }
          }
        }
      }
    }

    .formula-menu {
      width: 256px;
      height: 100%;
      border-left: 1px solid var(--border-color);
      padding: 16px;
      overflow: hidden;

      &>.title {
        font-size: 12px;
        color: var(--text-color-secondary);
      }

      .formula-search {
        height: 34px;
        margin: 8px 0 16px 0;

        :deep(.el-input) {
          --el-input-placeholder-color: var(--text-color-placeholder);

          .el-input__wrapper {
            border-radius: 4px;
            border: 1px solid var(--border-color);
            padding: 0 0 0 9px;
            box-shadow: none;
            height: 32px;

            .el-input__prefix {
              color: var(--text-color-regular);
            }
          }
        }
      }

      .formula-list {
        height: 224px;
        gap: 12px;
        overflow: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;

        &::-webkit-scrollbar {
          display: none;
        }

        .formula-category {
          min-height: 20px;
          line-height: 20px;
          color: var(--text-color-regular);
          font-size: 14px;
          margin-top: 6px;
          margin-bottom: 6px;
          cursor: pointer;

          .el-icon {
            margin-right: 4px;
          }

          .children {
            margin-top: 10px;

            .formula-item {
              margin-bottom: 16px;
              padding-left: 16px;

              .item-name {
                line-height: 17px;
              }

              .item-subName {
                line-height: 17px;
                margin-top: 4px;
                font-weight: 500;
                color: var(--text-color-secondary);
              }

              &:hover {
                cursor: pointer;
                background: var(--bg-color-hover);
              }
            }
          }
        }
      }

      .search-list {
        height: calc(100% - 72px);
        padding: 0 8px;
        overflow: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;

        &::-webkit-scrollbar {
          display: none;
        }

        .formula-item {
          margin-bottom: 16px;

          &:last-child {
            margin-bottom: 0;
          }

          .item-name {
            line-height: 17px;
          }

          .item-subName {
            line-height: 17px;
            margin-top: 4px;
            font-weight: 500;
            color: var(--text-color-secondary);
          }

          &:hover {
            background: var(--bg-color-hover);
            cursor: pointer;
          }
        }
      }
    }

    .formula-intro {
      margin: 12px 0;
      flex: 1;
      height: calc(100% - 24px);
      padding: 0 2px 0 16px;
      border-left: 1px solid var(--border-color);
      line-height: 20px;
      display: flex;
      flex-direction: column;

      :deep(.el-scrollbar__wrap) {
        padding-right: 14px;
      }

      .filter-rule {
        .filter-rule-title {
          font-size: 12px;
          color: var(--text-color-placeholder);
        }

        .filter-rule-content {
          width: 100%;
          height: fit-content;
          display: inline-flex;
          flex-direction: column;
          gap: 16px;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          box-sizing: border-box;
        }
        
      }

      .default-intro-wrapper {
        margin-bottom: 16px;

        li {
          font-size: 14px;
          list-style-type: none;
          padding: 6px 0;
          margin-top: 8px;

          .li-title {
            color: var(--text-color-primary);
          }
        }
      }

      .default-links {
        a {
          display: block;
          margin-bottom: 20px;
          color: var(--color-primary);
        }
      }

      .formula-title {
        height: 20px;
        line-height: 20px;
        color: var(--text-color-primary);
        font-size: 12px;
        color: var(--text-color-placeholder);
        margin-bottom: 8px;
      }

      .formula-name {
        height: 22px;
        line-height: 22px;
        font-size: 14px;
        color: var(--text-color-primary);
        margin-bottom: 8px;
      }

      .formula-container {
        font-size: 14px;
        line-height: 20px;

        .intro-wrapper {
          li {
            word-wrap: break-word;
            margin-bottom: 4px;
            word-break: break-word;
            margin-bottom: 4px;
            line-height: 20px;

            .li-title {
              color: var(--text-color-primary);
              margin-right: 4px;
            }

            :deep(.formula-name) {
              color: var(--color-primary) !important;
            }
          }
        }
      }
    }
  }

  .keyword {
    color: #00B899
  }

  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background-color: #555355;
  }

  ::-webkit-scrollbar-corner {
    background: transparent
  }
}

.form-default-value-formula-panel__editor.container {
  display: flex;
  flex-direction: column;
  min-height: 0;

  .container-code {
    flex: 1;
    min-height: 0;

    .vue-codemirror,
    .mirror {
      flex: 1;
      min-height: 0;
    }

    :deep(.cm-editor),
    :deep(.cm-scroller) {
      height: 100%;
      min-height: 0;
    }
  }
}
</style>
