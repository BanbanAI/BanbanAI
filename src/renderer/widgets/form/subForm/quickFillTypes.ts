import { FormElement } from "@renderer/b2/controllers/form";
import { SubFormRow } from "@renderer/b2/controllers/form";

export type QuickFillMode = "edit" | "mapping" | "fix";

export type QuickFillSupportedWidgetType =
  | "widget.form.textInput"
  | "widget.form.textarea"
  | "widget.form.numberInput"
  | "widget.form.amountInput"
  | "widget.form.datePicker"
  | "widget.form.radioGroup"
  | "widget.form.checkboxGroup"
  | "widget.form.treeSelect"
  | "widget.form.treeMultipleSelect"
  | "widget.form.memberSelect"
  | "widget.form.departmentSelect"
  | "widget.form.address";

export type QuickFillColumn = {
  key: string;
  childUid: string;
  fieldId: string;
  title: string;
  widgetType: QuickFillSupportedWidgetType;
  widget: FormElement;
};

export type QuickFillRowMeta = {
  source: "existing" | "new";
  originalRowIndex?: number;
  hasHiddenData?: boolean;
};

export type QuickFillDraftRow = {
  id: string;
  values: Record<string, any>;
  meta: QuickFillRowMeta;
};

export type QuickFillMappingItem = {
  columnKey: string;
  targetFieldId: string | "skip";
};

export type QuickFillIssueType = "option_not_matched" | "address_not_matched";

export type QuickFillCellIssue = {
  rowId: string;
  columnKey: string;
  type: QuickFillIssueType;
  message: string;
  rawValue: any;
  fallbackOnApply: "empty";
};

export type QuickFillValidationCell = {
  rawValue: any;
  normalizedValue: any;
  issue?: QuickFillCellIssue;
};

export type QuickFillValidationRow = {
  id: string;
  values: Record<string, QuickFillValidationCell>;
  meta: QuickFillRowMeta;
};

export type QuickFillValidationResult = {
  rows: QuickFillValidationRow[];
  issues: QuickFillCellIssue[];
};

export type QuickFillTransientEditor = {
  rowId: string;
  form: SubFormRow;
  dispose: () => void;
};
