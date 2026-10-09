import { FormElement } from "@renderer/b2/controllers/form";
import { QuickFillColumn, QuickFillDraftRow, QuickFillSupportedWidgetType } from "./quickFillTypes";
import { SubForm, UUID } from "./subForm";

const SUPPORTED_WIDGET_TYPES = new Set<QuickFillSupportedWidgetType>([
  "widget.form.textInput",
  "widget.form.textarea",
  "widget.form.numberInput",
  "widget.form.amountInput",
  "widget.form.datePicker",
  "widget.form.radioGroup",
  "widget.form.checkboxGroup",
  "widget.form.treeSelect",
  "widget.form.treeMultipleSelect",
  "widget.form.memberSelect",
  "widget.form.departmentSelect",
  "widget.form.address",
]);

const SHARE_BLOCKED_WIDGET_TYPES = new Set<QuickFillSupportedWidgetType>([
  "widget.form.memberSelect",
  "widget.form.departmentSelect",
]);

export function isQuickFillSupportedWidget(widget: FormElement) {
  return SUPPORTED_WIDGET_TYPES.has(widget.type as QuickFillSupportedWidgetType);
}

export function shouldHideWidgetInQuickFill(widget: FormElement) {
  if (!widget?.fieldId) return true;
  if (!isQuickFillSupportedWidget(widget)) return true;
  if (SHARE_BLOCKED_WIDGET_TYPES.has(widget.type as QuickFillSupportedWidgetType)) return true;
  if (widget.isReadonly && !widget.isCreateField()) return true;
  return false;
}

export function getQuickFillColumns(subForm: SubForm): QuickFillColumn[] {
  return subForm.children
    .filter(child => !shouldHideWidgetInQuickFill(child))
    .map((child): QuickFillColumn => ({
      key: child.fieldId,
      childUid: child.uid,
      fieldId: child.fieldId,
      title: child.title,
      widgetType: child.type as QuickFillSupportedWidgetType,
      widget: child,
    }));
}

export function buildQuickFillDraftRows(subForm: SubForm, columns: QuickFillColumn[], minRowCount = 10): QuickFillDraftRow[] {
  const rows: QuickFillDraftRow[] = (subForm.rows || []).map((row, index) => {
    const values = columns.reduce<Record<string, any>>((prev, column) => {
      prev[column.fieldId] = row?.[column.fieldId];
      return prev;
    }, {});

    return {
      id: row?.[UUID] || `${index}`,
      values,
      meta: {
        source: "existing" as const,
        originalRowIndex: index,
        hasHiddenData: hasHiddenData(subForm, row, columns),
      }
    };
  });

  while (rows.length < minRowCount) {
    rows.push(createEmptyDraftRow(columns));
  }
  ensureTrailingBlankRow(rows, columns);
  return rows;
}

export function createEmptyDraftRow(columns: QuickFillColumn[]): QuickFillDraftRow {
  const values = columns.reduce<Record<string, any>>((prev, column) => {
    prev[column.fieldId] = undefined;
    return prev;
  }, {});
  return {
    id: `quick-fill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    values,
    meta: {
      source: "new",
      hasHiddenData: false,
    }
  };
}

export function isDraftRowEmpty(row: QuickFillDraftRow, columns: QuickFillColumn[]) {
  return columns.every(column => {
    const value = row.values?.[column.fieldId];
    return isBlankQuickFillValue(value);
  });
}

export function ensureTrailingBlankRow(rows: QuickFillDraftRow[], columns: QuickFillColumn[]) {
  if (!rows.length || !isDraftRowEmpty(rows[rows.length - 1], columns)) {
    rows.push(createEmptyDraftRow(columns));
  }
}

function hasHiddenData(subForm: SubForm, row: Record<string, any>, columns: QuickFillColumn[]) {
  if (!row) return false;
  const quickFillFieldIds = new Set(columns.map(column => column.fieldId));
  return subForm.children.some((child) => {
    if (!child?.fieldId || quickFillFieldIds.has(child.fieldId)) return false;
    const value = row?.[child.fieldId];
    return !isBlankQuickFillValue(value);
  });
}

function isBlankQuickFillValue(value: any) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
