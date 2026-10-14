import type { ColumnDefinition } from "../runtime/column-definition";
import { isSubFormFieldType, SUB_FORM_FIELD_TYPES, type SubFormFieldType } from "../sub-form-field-types";

const optionTypes = new Set([
  "widget.form.radioGroup",
  "widget.form.checkboxGroup",
  "widget.form.treeSelect",
  "widget.form.treeMultipleSelect",
]);

const actionOnlyTypes = new Set([
  "widget.form.selectData",
  "widget.form.relatedData",
  "widget.form.image-uploader",
  "widget.form.file-uploader",
  "widget.form.memberSelect",
  "widget.form.departmentSelect",
]);

const genericEditorTypes = new Set([
  "widget.form.textInput",
  "widget.form.textarea",
  "widget.form.phoneInput",
  "widget.form.address",
  "widget.form.amountInput",
  "widget.form.timePicker",
  "widget.form.dateRangePicker",
  "widget.form.hyperlink",
  "widget.form.rate",
  "widget.form.position",
  "widget.form.tagInput",
  "widget.form.numberInput",
  "widget.form.datePicker",
  "widget.form.switch",
]);

const readonlyTypes = new Set([
  "widget.form.autoCompute",
  "widget.form.serialNumber",
]);

export type RuntimeFieldCapability = "inline" | "option" | "action" | "readonly";

export const getRuntimeFieldCapability = (type: string): RuntimeFieldCapability | undefined => {
  if (actionOnlyTypes.has(type)) return "action";
  if (optionTypes.has(type)) return "option";
  if (genericEditorTypes.has(type)) return "inline";
  if (readonlyTypes.has(type)) return "readonly";
  return undefined;
};

export const isRuntimeFieldSupported = (type: unknown): type is SubFormFieldType => (
  isSubFormFieldType(type) && getRuntimeFieldCapability(type) !== undefined
);

export const runtimeFieldTypes = SUB_FORM_FIELD_TYPES;

export const isRuntimeCellEditable = (column: ColumnDefinition) => {
  const capability = getRuntimeFieldCapability(column.type);
  if (capability === "option") {
    return column.schema.dynamicOptions !== undefined
      || column.schema.allowCustom === true
      || column.schema.allowAddCustomOption === true
      || (Array.isArray(column.schema.options) && column.schema.options.length > 0);
  }
  return capability === "inline";
};

export const isRuntimeActionOnly = (type: string) => actionOnlyTypes.has(type);
