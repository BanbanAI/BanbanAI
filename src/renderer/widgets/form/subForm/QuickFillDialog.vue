<template>
  <div class="quick-fill-dialog">
    <el-dialog
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      @opened="handleOpened"
      :width="680"
      align-center
      destroy-on-close
      draggable
      :close-on-click-modal="false"
      :fullscreen="isFullscreen"
      @closed="handleClosed"
    >
      <template #header>
        <div class="title">{{ $t('quickFill') }}</div>
        <div class="menus">
          <el-button link @click="toggleFullscreen">
            <el-icon size="14">
              <IVenIconGlobalFullscreen v-if="!isFullscreen" style="fill: currentColor;" />
              <IVenIconGlobalShrinkScreen v-else style="fill: currentColor;" />
            </el-icon>
          </el-button>
        </div>
      </template>

      <div class="quick-fill-dialog__body">
        <template v-if="mode === 'edit'">
          <div class="quick-fill-tip quick-fill-tip--plain">
            <p>{{ i18next.t('quickFillEditTip1') }}</p>
            <p>{{ i18next.t('quickFillEditTip2') }}</p>
            <p>{{ i18next.t('quickFillEditTip3') }}</p>
          </div>
        </template>

        <template v-else-if="mode === 'mapping'">
          <div class="quick-fill-tip quick-fill-tip--plain quick-fill-tip--between">
            <span>{{ i18next.t('quickFillMappingTip') }}</span>
            <span class="mapping-count">
              <el-icon size="14">
                <SuccessFilled />
              </el-icon>
              {{ i18next.t('quickFillMappedCount', { selected: mappedCount, total: columns.length }) }}
            </span>
          </div>
        </template>

        <template v-else>
          <div class="quick-fill-tip quick-fill-tip--error">
            <p>{{ i18next.t('quickFillIssueTip1', { count: issues.length }) }}</p>
            <p>{{ i18next.t('quickFillIssueTip2') }}</p>
          </div>
        </template>

        <div
          v-if="mode === 'edit'"
          ref="gridRef"
          class="quick-fill-grid"
          tabindex="0"
          @keydown="handleGridKeydown"
          @paste="handleGridPaste"
          @copy="handleGridCopy"
          @mousedown="handleGridMouseDown"
        >
          <table class="quick-fill-table">
            <thead>
              <tr>
                <th class="row-index"></th>
                <th
                  v-for="(column, columnIndex) in columns"
                  :key="column.key"
                  :class="getHeaderClass(columnIndex)"
                  @click.stop="selectColumn(columnIndex)"
                >
                  {{ column.title }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in draftRows" :key="row.id">
                <td
                  class="row-index"
                  :class="{ selected: selection.kind === 'row' && selection.rowIndex === rowIndex }"
                  @click.stop="selectRow(rowIndex)"
                >
                  {{ rowIndex + 1 }}
                </td>
                <td
                  v-for="(column, columnIndex) in columns"
                  :key="column.key"
                  :class="getCellClass(rowIndex, columnIndex)"
                  @mousedown.stop.prevent="handleCellMouseDown(rowIndex, columnIndex, $event)"
                  @mouseover="handleCellHover(rowIndex, columnIndex)"
                  @dblclick.stop="startEditCell(rowIndex, columnIndex)"
                >
                  <textarea
                    v-if="isEditingCell(rowIndex, columnIndex) && isTextareaColumn(column)"
                    :ref="setEditingInputRef"
                    v-model="editingValue"
                    class="cell-editor textarea"
                    @blur="commitEditCell"
                    @keydown.enter.stop="handleTextareaEnter"
                    @keydown.esc.prevent="cancelEditCell"
                  ></textarea>
                  <input
                    v-else-if="isEditingCell(rowIndex, columnIndex)"
                    :ref="setEditingInputRef"
                    v-model="editingValue"
                    class="cell-editor"
                    @blur="commitEditCell"
                    @keydown.enter.prevent="commitEditCell"
                    @keydown.esc.prevent="cancelEditCell"
                  />
                  <span v-else>{{ formatDisplayValue(row.values[column.fieldId]) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="quick-fill-preview">
          <table class="quick-fill-table">
            <thead>
              <tr>
                <th class="row-index"></th>
                <th v-for="column in columns" :key="column.key">
                  <el-select
                    v-model="mapping[column.key]"
                    :disabled="mode === 'fix'"
                    @change="handleMappingChange(column.key, $event)"
                  >
                    <el-option :label="i18next.t('doNotPaste')" value="skip" />
                    <el-option
                      v-for="option in columns"
                      :key="option.fieldId"
                      :label="option.title"
                      :value="option.fieldId"
                    />
                  </el-select>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in displayRows" :key="row.id">
                <td class="row-index">{{ rowIndex + 1 }}</td>
                <td
                  v-for="column in columns"
                  :key="column.key"
                  :class="{ 'issue-cell': hasIssue(row.id, column.key) }"
                >
                  <template v-if="mode === 'fix' && hasIssue(row.id, column.key)">
                    <div class="issue-editor">
                      <x-widget
                        v-if="getEditorWidget(row.id, column.key)"
                        :widget="getEditorWidget(row.id, column.key)"
                        :style="{ padding: '0px' }"
                      />
                      <div class="issue-message-bubble">{{ getIssue(row.id, column.key)?.message }}</div>
                    </div>
                  </template>
                  <template v-else>
                    {{ formatDisplayValue(getRowCellValue(row, column)) }}
                  </template>
                </td>
              </tr>
              <tr v-if="!displayRows.length">
                <td :colspan="columns.length + 1" class="empty-row">{{ i18next.t('noData') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <template #footer>
        <div class="quick-fill-footer">
          <el-button v-if="mode !== 'edit'" class="quick-fill-footer__btn quick-fill-footer__btn--default" @click="handlePrevStep">{{ i18next.t('prevStep') }}</el-button>
          <el-button v-if="mode === 'edit'" class="quick-fill-footer__btn" type="primary" :disabled="!columns.length" @click="handleNextFromEdit">{{ i18next.t('nextStep') }}</el-button>
          <el-button v-else-if="mode === 'mapping'" class="quick-fill-footer__btn" type="primary" @click="handleNextFromMapping">{{ i18next.t('confirm') }}</el-button>
          <el-button v-else class="quick-fill-footer__btn" type="primary" @click="handleContinueFromFix">{{ i18next.t('continue') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from "vue";
import { cloneDeep as deepClone } from "lodash";
import { SuccessFilled } from "@element-plus/icons-vue";
import { buildQuickFillDraftRows, createEmptyDraftRow, ensureTrailingBlankRow, isDraftRowEmpty, getQuickFillColumns } from "./quickFillSchema";
import { validateQuickFillRows } from "./quickFillValidator";
import type {
  QuickFillCellIssue,
  QuickFillColumn,
  QuickFillDraftRow,
  QuickFillMode,
  QuickFillTransientEditor,
  QuickFillValidationRow
} from "./quickFillTypes";
import { SubForm } from "./subForm";
import IVenIconGlobalFullscreen from "~icons/ven-icon/widget-form-sub-form-global-fullscreen";
import IVenIconGlobalShrinkScreen from "~icons/ven-icon/widget-form-sub-form-global-shrink-screen";
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  modelValue: boolean;
  subForm: SubForm;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
}>();

const mode = ref<QuickFillMode>("edit");
const columns = computed<QuickFillColumn[]>(() => {
  return getQuickFillColumns(props.subForm).filter(column => !column.widget?.isReadonly);
});
const draftRows = ref<QuickFillDraftRow[]>([]);
const compactRows = ref<QuickFillDraftRow[]>([]);
const validationRows = ref<QuickFillValidationRow[]>([]);
const issues = ref<QuickFillCellIssue[]>([]);
const mapping = reactive<Record<string, string | "skip">>({});
const transientEditors = shallowRef<QuickFillTransientEditor[]>([]);
const historyStack = ref<QuickFillDraftRow[][]>([]);
const historyIndex = ref(-1);
const isFullscreen = ref(false);

const selection = reactive({
  kind: "cell" as "cell" | "row" | "column",
  rowIndex: 0,
  columnIndex: 0,
  endRowIndex: 0,
  endColumnIndex: 0,
});

const isMouseSelecting = ref(false);
const gridRef = ref<HTMLElement | null>(null);
const editingCell = ref<{ rowIndex: number; columnIndex: number } | null>(null);
const editingValue = ref("");
const editingInputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);

const displayRows = computed(() => {
  return mode.value === "fix" ? validationRows.value : compactRows.value;
});

const mappedCount = computed(() => Object.values(mapping).filter(value => value && value !== "skip").length);

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      initDialogState();
      return;
    }
    resetDialogState();
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("mouseup", stopMouseSelection);
});

onBeforeUnmount(() => {
  window.removeEventListener("mouseup", stopMouseSelection);
  disposeTransientEditors();
});

function initDialogState() {
  mode.value = "edit";
  draftRows.value = buildQuickFillDraftRows(props.subForm, columns.value);
  compactRows.value = [];
  validationRows.value = [];
  issues.value = [];
  editingCell.value = null;
  editingValue.value = "";
  selection.kind = "cell";
  selection.rowIndex = 0;
  selection.columnIndex = 0;
  selection.endRowIndex = 0;
  selection.endColumnIndex = 0;
  disposeTransientEditors();
  resetMapping();
  resetHistory();
  focusGrid();
}

function resetDialogState() {
  mode.value = "edit";
  draftRows.value = [];
  compactRows.value = [];
  validationRows.value = [];
  issues.value = [];
  editingCell.value = null;
  editingValue.value = "";
  disposeTransientEditors();
  resetMapping();
  historyStack.value = [];
  historyIndex.value = -1;
}

function resetMapping() {
  Object.keys(mapping).forEach(key => delete mapping[key]);
  columns.value.forEach((column) => {
    mapping[column.key] = column.fieldId;
  });
}

function resetHistory() {
  historyStack.value = [deepClone(draftRows.value)];
  historyIndex.value = 0;
}

function pushHistory() {
  const snapshot = deepClone(draftRows.value);
  historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
  historyStack.value.push(snapshot);
  historyIndex.value = historyStack.value.length - 1;
}

function undoHistory() {
  if (historyIndex.value <= 0) return;
  historyIndex.value -= 1;
  draftRows.value = deepClone(historyStack.value[historyIndex.value] || []);
  cancelEditCell();
}

function handleClosed() {
  resetDialogState();
  isFullscreen.value = false;
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}

function handlePrevStep() {
  if (mode.value === "mapping") {
    mode.value = "edit";
    focusGrid();
    return;
  }

  if (mode.value === "fix") {
    disposeTransientEditors();
    issues.value = [];
    validationRows.value = [];
    mode.value = "mapping";
  }
}

function handleNextFromEdit() {
  commitEditCell();
  compactRows.value = draftRows.value
    .filter((row) => {
      if (row.meta?.hasHiddenData) return true;
      return !isDraftRowEmpty(row, columns.value);
    })
    .map(row => deepClone(row));

  mode.value = "mapping";
}

async function handleNextFromMapping() {
  const result = await validateQuickFillRows(props.subForm, compactRows.value, columns.value, mapping);
  validationRows.value = result.rows;
  issues.value = result.issues;

  if (!issues.value.length) {
    applyValidatedRows(result.rows);
    emit("update:modelValue", false);
    return;
  }

  await buildTransientEditors();
  mode.value = "fix";
}

async function handleContinueFromFix() {
  const revalidatedRows = await rebuildRowsFromFixEditors();
  applyValidatedRows(revalidatedRows);
  emit("update:modelValue", false);
}

function applyValidatedRows(rows: QuickFillValidationRow[]) {
  const currentRows = deepClone(props.subForm.rows || []);
  const nextRows = rows.map((row) => {
    const isNewRow = row.meta.source === "new";
    const baseRow: Record<string, any> = !isNewRow && row.meta.originalRowIndex !== undefined
      ? deepClone(currentRows[row.meta.originalRowIndex] || {})
      : {};

    columns.value.forEach((column) => {
      const targetFieldId = mapping[column.key];
      if (!targetFieldId || targetFieldId === "skip") return;
      baseRow[targetFieldId] = row.values?.[column.fieldId]?.normalizedValue;
    });

    if (isNewRow) {
      baseRow.isManualAdd = true;
      (props.subForm as any).applyManualAddRowDefaults?.(baseRow, {
        allowPopulatedRow: true,
      });
    }

    return baseRow;
  });

  props.subForm.inputValue = nextRows;
}

async function buildTransientEditors() {
  disposeTransientEditors();
  const editors: QuickFillTransientEditor[] = [];
  const issueRowIds = new Set(issues.value.map(item => item.rowId));

  for (const row of validationRows.value) {
    if (!issueRowIds.has(row.id)) continue;

    const seedRow = columns.value.reduce<Record<string, any>>((prev, column) => {
      const targetFieldId = mapping[column.key];
      if (!targetFieldId || targetFieldId === "skip") return prev;
      prev[targetFieldId] = row.values?.[column.fieldId]?.rawValue;
      return prev;
    }, {});

    const editor = await props.subForm.createTransientSubFormRow(seedRow);
    editors.push({
      rowId: row.id,
      form: editor.form,
      dispose: editor.dispose,
    });
  }

  transientEditors.value = editors;
}
function disposeTransientEditors() {
  transientEditors.value.forEach(item => item.dispose());
  transientEditors.value = [];
}

async function rebuildRowsFromFixEditors() {
  const editorRows = validationRows.value.map((row) => {
    const nextValues = columns.value.reduce<Record<string, any>>((prev, column) => {
      const cell = row.values?.[column.fieldId];
      if (!cell?.issue) {
        prev[column.fieldId] = cell?.rawValue;
        return prev;
      }

      const editorWidget = getEditorWidget(row.id, column.key);
      prev[column.fieldId] = editorWidget ? editorWidget.inputValue : cell?.rawValue;
      return prev;
    }, {});

    return {
      id: row.id,
      meta: row.meta,
      values: nextValues,
    };
  });

  const result = await validateQuickFillRows(props.subForm, editorRows, columns.value, mapping);
  return result.rows.map((row) => ({
    ...row,
    values: Object.fromEntries(
      Object.entries(row.values).map(([fieldId, cell]) => {
        if (cell.issue) {
          return [fieldId, { ...cell, normalizedValue: undefined }];
        }
        return [fieldId, cell];
      }),
    ),
  }));
}

function handleMappingChange(columnKey: string, value: string | "skip") {
  if (value === "skip") return;
  Object.keys(mapping).forEach((key) => {
    if (key !== columnKey && mapping[key] === value) {
      mapping[key] = "skip";
    }
  });
}

function selectCell(rowIndex: number, columnIndex: number) {
  if (!columns.value.length) return;
  selection.kind = "cell";
  selection.rowIndex = rowIndex;
  selection.columnIndex = columnIndex;
  selection.endRowIndex = rowIndex;
  selection.endColumnIndex = columnIndex;
  focusGrid();
}

function handleCellMouseDown(rowIndex: number, columnIndex: number, event: MouseEvent) {
  if (event.button !== 0) return;
  isMouseSelecting.value = true;
  selectCell(rowIndex, columnIndex);
}

function selectRow(rowIndex: number) {
  if (!columns.value.length) return;
  selection.kind = "row";
  selection.rowIndex = rowIndex;
  selection.endRowIndex = rowIndex;
  selection.columnIndex = 0;
  selection.endColumnIndex = columns.value.length - 1;
  focusGrid();
}

function selectColumn(columnIndex: number) {
  if (!columns.value.length) return;
  selection.kind = "column";
  selection.columnIndex = columnIndex;
  selection.endColumnIndex = columnIndex;
  selection.rowIndex = 0;
  selection.endRowIndex = Math.max(draftRows.value.length - 1, 0);
  focusGrid();
}

function handleOpened() {
  if (mode.value === "edit") {
    focusGrid();
  }
}

function focusGrid() {
  nextTick(() => {
    window.requestAnimationFrame(() => {
      gridRef.value?.focus();
    });
  });
}

function handleGridMouseDown(event: MouseEvent) {
  if (event.button !== 0) return;
  isMouseSelecting.value = true;
}

function handleCellHover(rowIndex: number, columnIndex: number) {
  if (!isMouseSelecting.value || selection.kind !== "cell") return;
  selection.endRowIndex = rowIndex;
  selection.endColumnIndex = columnIndex;
}

function stopMouseSelection() {
  isMouseSelecting.value = false;
}

function getCellClass(rowIndex: number, columnIndex: number) {
  return {
    active: selection.kind === "cell" && selection.rowIndex === rowIndex && selection.columnIndex === columnIndex,
    selected: isCellSelected(rowIndex, columnIndex),
  };
}

function getHeaderClass(columnIndex: number) {
  return {
    selected: selection.kind === "column" && selection.columnIndex === columnIndex,
  };
}

function isCellSelected(rowIndex: number, columnIndex: number) {
  if (selection.kind === "row") {
    return selection.rowIndex === rowIndex;
  }

  if (selection.kind === "column") {
    return selection.columnIndex === columnIndex;
  }

  const rowStart = Math.min(selection.rowIndex, selection.endRowIndex);
  const rowEnd = Math.max(selection.rowIndex, selection.endRowIndex);
  const colStart = Math.min(selection.columnIndex, selection.endColumnIndex);
  const colEnd = Math.max(selection.columnIndex, selection.endColumnIndex);
  return rowIndex >= rowStart && rowIndex <= rowEnd && columnIndex >= colStart && columnIndex <= colEnd;
}

function handleGridKeydown(event: KeyboardEvent) {
  if (!columns.value.length) return;

  if (editingCell.value) {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    undoHistory();
    event.preventDefault();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && ["c", "v"].includes(event.key.toLowerCase())) {
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    pushHistory();
    clearSelection();
    ensureTrailingBlankRow(draftRows.value, columns.value);
    event.preventDefault();
    return;
  }

  if (event.key === "Enter") {
    startEditCell(selection.rowIndex, selection.columnIndex);
    event.preventDefault();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
    startEditCell(selection.rowIndex, selection.columnIndex, event.key);
    event.preventDefault();
    return;
  }

  const next = {
    rowIndex: selection.rowIndex,
    columnIndex: selection.columnIndex,
  };

  if (event.key === "ArrowDown") next.rowIndex += 1;
  if (event.key === "ArrowUp") next.rowIndex -= 1;
  if (event.key === "ArrowRight") next.columnIndex += 1;
  if (event.key === "ArrowLeft") next.columnIndex -= 1;

  next.rowIndex = Math.min(Math.max(next.rowIndex, 0), Math.max(draftRows.value.length - 1, 0));
  next.columnIndex = Math.min(Math.max(next.columnIndex, 0), Math.max(columns.value.length - 1, 0));

  if (next.rowIndex !== selection.rowIndex || next.columnIndex !== selection.columnIndex) {
    selectCell(next.rowIndex, next.columnIndex);
    event.preventDefault();
  }
}

function handleGridPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData("text/plain");
  if (!text || !columns.value.length) return;

  event.preventDefault();
  commitEditCell();
  pushHistory();

  const rawRows = text.replace(/\r/g, "").split("\n");
  if (rawRows.length && rawRows[rawRows.length - 1] === "") {
    rawRows.pop();
  }
  const matrix = rawRows.map(row => row.split("\t"));
  if (!matrix.length) return;

  const startRow = selection.rowIndex;
  const startColumn = selection.columnIndex;
  const needRows = startRow + matrix.length;

  while (draftRows.value.length < needRows) {
    draftRows.value.push(createEmptyDraftRow(columns.value));
  }

  matrix.forEach((cells, rowOffset) => {
    const row = draftRows.value[startRow + rowOffset];
    cells.forEach((value, columnOffset) => {
      const column = columns.value[startColumn + columnOffset];
      if (!column || !row) return;
      row.values[column.fieldId] = value;
    });
  });

  ensureTrailingBlankRow(draftRows.value, columns.value);
}

function handleGridCopy(event: ClipboardEvent) {
  const text = serializeSelection();
  if (!text) return;
  event.preventDefault();
  event.clipboardData?.setData("text/plain", text);
}

function serializeSelection() {
  if (!draftRows.value.length || !columns.value.length) return "";
  const range = getSelectionRange();
  const rows: string[] = [];

  for (let rowIndex = range.rowStart; rowIndex <= range.rowEnd; rowIndex++) {
    const currentRow = draftRows.value[rowIndex];
    const cells: string[] = [];
    for (let columnIndex = range.colStart; columnIndex <= range.colEnd; columnIndex++) {
      const column = columns.value[columnIndex];
      cells.push(formatDisplayValue(currentRow?.values?.[column.fieldId]));
    }
    rows.push(cells.join("\t"));
  }

  return rows.join("\n");
}

function clearSelection() {
  const range = getSelectionRange();
  for (let rowIndex = range.rowStart; rowIndex <= range.rowEnd; rowIndex++) {
    const currentRow = draftRows.value[rowIndex];
    if (!currentRow) continue;
    for (let columnIndex = range.colStart; columnIndex <= range.colEnd; columnIndex++) {
      const column = columns.value[columnIndex];
      currentRow.values[column.fieldId] = undefined;
    }
  }
}

function getSelectionRange() {
  if (selection.kind === "row") {
    return {
      rowStart: selection.rowIndex,
      rowEnd: selection.rowIndex,
      colStart: 0,
      colEnd: Math.max(columns.value.length - 1, 0),
    };
  }

  if (selection.kind === "column") {
    return {
      rowStart: 0,
      rowEnd: Math.max(draftRows.value.length - 1, 0),
      colStart: selection.columnIndex,
      colEnd: selection.columnIndex,
    };
  }

  return {
    rowStart: Math.min(selection.rowIndex, selection.endRowIndex),
    rowEnd: Math.max(selection.rowIndex, selection.endRowIndex),
    colStart: Math.min(selection.columnIndex, selection.endColumnIndex),
    colEnd: Math.max(selection.columnIndex, selection.endColumnIndex),
  };
}

function startEditCell(rowIndex: number, columnIndex: number, presetValue?: string) {
  const column = columns.value[columnIndex];
  const row = draftRows.value[rowIndex];
  if (!column || !row) return;

  editingCell.value = { rowIndex, columnIndex };
  editingValue.value = presetValue ?? formatDisplayValue(row.values[column.fieldId]);
  nextTick(() => {
    editingInputRef.value?.focus();
    editingInputRef.value?.select?.();
  });
}

function commitEditCell() {
  if (!editingCell.value) return;
  const { rowIndex, columnIndex } = editingCell.value;
  const column = columns.value[columnIndex];
  const row = draftRows.value[rowIndex];
  if (column && row) {
    pushHistory();
    row.values[column.fieldId] = editingValue.value;
    if (rowIndex === draftRows.value.length - 1) {
      ensureTrailingBlankRow(draftRows.value, columns.value);
    }
  }
  editingCell.value = null;
  editingValue.value = "";
}

function cancelEditCell() {
  editingCell.value = null;
  editingValue.value = "";
}

function handleTextareaEnter(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey) {
    commitEditCell();
  }
}

function isTextareaColumn(column: QuickFillColumn) {
  return column.widgetType === "widget.form.textarea";
}

function isEditingCell(rowIndex: number, columnIndex: number) {
  return editingCell.value?.rowIndex === rowIndex && editingCell.value?.columnIndex === columnIndex;
}

function setEditingInputRef(el: HTMLInputElement | HTMLTextAreaElement | null) {
  editingInputRef.value = el;
}

function formatDisplayValue(value: any) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("、");
  return String(value);
}

function getRowCellValue(row: QuickFillDraftRow | QuickFillValidationRow, column: QuickFillColumn) {
  const validationCell = (row as QuickFillValidationRow).values?.[column.fieldId];
  if (validationCell && Object.prototype.hasOwnProperty.call(validationCell, "rawValue")) {
    if (!validationCell.issue && shouldDisplayEmptyValidationCell(validationCell)) {
      return undefined;
    }
    return validationCell.rawValue;
  }
  return (row as QuickFillDraftRow).values?.[column.fieldId];
}

function shouldDisplayEmptyValidationCell(cell: { rawValue: any; normalizedValue: any; issue?: QuickFillCellIssue }) {
  return !cell.issue && cell.normalizedValue === undefined && !isBlankDisplayValue(cell.rawValue);
}

function isBlankDisplayValue(value: any) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function hasIssue(rowId: string, columnKey: string) {
  return issues.value.some(item => item.rowId === rowId && item.columnKey === columnKey);
}

function getIssue(rowId: string, columnKey: string) {
  return issues.value.find(item => item.rowId === rowId && item.columnKey === columnKey);
}

function getEditorWidget(rowId: string, columnKey: string) {
  const targetFieldId = mapping[columnKey];
  if (!targetFieldId || targetFieldId === "skip") return null;
  const editor = transientEditors.value.find(item => item.rowId === rowId);
  return editor?.form?.children?.find(child => child.fieldId === targetFieldId) || null;
}
</script>

<style lang="scss" scoped>
.quick-fill-dialog {
  --el-dialog-padding-primary: 0;
  :deep(.el-dialog) {
    border-radius: 8px;
    overflow: hidden;
    padding: 0;
    background-color: #ffffff;
    box-shadow: 0 8px 24px rgba(31, 35, 41, 0.16);

    .el-dialog__header {
      height: 48px;
      padding: 12px 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      border-bottom: 1px solid var(--border-color);
      flex: 0 0 auto;

      .el-dialog__headerbtn {
        height: 48px;
        width: 48px;

        .el-dialog__close {
          color: var(--text-color);
        }
      }

      .title {
        font-size: 16px;
        line-height: 24px;
      }

      .menus {
        position: absolute;
        top: 12px;
        right: 50px;
      }
    }

    .el-dialog__body {
      height: 600px;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      min-height: 0;
      box-sizing: border-box;
    }

    .el-dialog__footer {
      height: 60px;
      border-top: 1px solid var(--border-color);
      padding: 12px 16px;


      .quick-fill-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;

        .quick-fill-footer__btn {
          height: 36px;
          border-radius: 4px;
          font-size: 14px;
        }

        .quick-fill-footer__btn--default {
          border-color: #d9dce3;
          color: #4e5969;
        }
      }
    }
  }
}

.quick-fill-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.quick-fill-tip {
  border-radius: 0;
  padding: 0;
  font-size: 12px;
  line-height: 18px;

  p {
    margin: 0;
  }

  p + p {
    margin-top: 4px;
  }

  &--plain {
    color: #86909c;
  }

  &--between {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  &--error {
    color: #f53f3f;
  }

  .mapping-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #4e5969;
    font-size: 12px;
    white-space: nowrap;

    :deep(svg) {
      color: #52c41a;
    }
  }
}

.quick-fill-grid,
.quick-fill-preview {
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  overflow: auto;
  flex: 1;
  min-height: 0;
  outline: none;
  background: #ffffff;
}

.quick-fill-table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  table-layout: fixed;

  th,
  td {
    border-right: 1px solid #e9edf5;
    border-bottom: 1px solid #e9edf5;
    vertical-align: middle;
    background-color: #fff;
  }

  th:not(.row-index),
  td:not(.row-index) {
    width: 160px;
    min-width: 160px;
    max-width: 160px;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 2;
    background-color: #f7f8fa;
    padding: 0 8px;
    height: 40px;
    font-size: 12px;
    font-weight: 500;
    text-align: left;
    color: #1f2329;
  }

  td {
    min-width: 92px;
    padding: 0 8px;
    height: 48px;
    cursor: text;
    word-break: break-all;
    font-size: 12px;
    color: #1f2329;
  }

  .row-index {
    width: 32px;
    min-width: 32px;
    text-align: center;
    padding: 0;
    background-color: #ffffff;
    cursor: pointer;
    color: #86909c;
    font-weight: 400;
    font-size: 12px;
  }

  .selected {
    background-color: #f2f9ff;
  }

  .active {
    position: relative;
    box-shadow: inset 0 0 0 1px #1677ff;
  }

  .issue-cell {
    background-color: #fff1f0;
  }

  .empty-row {
    text-align: center;
    color: #c9cdd4;
    cursor: default;
  }
}

.cell-editor {
  width: 100%;
  min-height: 32px;
  border: 1px solid #1677ff;
  border-radius: 4px;
  padding: 2px 6px;
  outline: none;
  resize: none;
  font-size: 12px;
  color: #1f2329;
  background: #ffffff;
}

:deep(.el-select) {
  width: 100%;
}

:deep(.el-select .el-select__wrapper) {
  min-height: 24px;
  border-radius: 4px;
  box-shadow: 0 0 0 1px #d9dce3 inset;
  background: #ffffff;
  padding: 0 6px;
}

:deep(.el-select .el-select__selected-item) {
  font-size: 12px;
}

:deep(.el-select .el-select__caret) {
  font-size: 12px;
}

.issue-editor {
  position: relative;
  min-height: 32px;

  :deep(.b2-form-element) {
    padding: 0;
  }

  :deep(.el-input__wrapper),
  :deep(.el-textarea__inner),
  :deep(.el-select .el-select__wrapper) {
    min-height: 32px;
    box-shadow: 0 0 0 1px #ffccc7 inset;
    background: #ffffff;
  }
}

.issue-message-bubble {
  position: absolute;
  left: 8px;
  top: calc(100% + 4px);
  z-index: 3;
  padding: 4px 8px;
  border-radius: 4px;
  background: #ffffff;
  box-shadow: 0 4px 10px rgba(31, 35, 41, 0.12);
  color: #f53f3f;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-2px);
  transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;

  &::before {
    content: "";
    position: absolute;
    left: 14px;
    top: -4px;
    width: 8px;
    height: 8px;
    background: #ffffff;
    transform: rotate(45deg);
    box-shadow: -2px -2px 4px rgba(31, 35, 41, 0.04);
  }
}

.issue-cell:hover .issue-message-bubble,
.issue-editor:focus-within .issue-message-bubble {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
</style>
