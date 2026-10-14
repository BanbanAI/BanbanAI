export const SUB_FORM_FIELD_TYPES = Object.freeze([
  "widget.form.textInput",
  "widget.form.textarea",
  "widget.form.numberInput",
  "widget.form.amountInput",
  "widget.form.datePicker",
  "widget.form.dateRangePicker",
  "widget.form.timePicker",
  "widget.form.radioGroup",
  "widget.form.checkboxGroup",
  "widget.form.treeSelect",
  "widget.form.treeMultipleSelect",
  "widget.form.memberSelect",
  "widget.form.departmentSelect",
  "widget.form.phoneInput",
  "widget.form.address",
  "widget.form.rate",
  "widget.form.position",
  "widget.form.tagInput",
  "widget.form.image-uploader",
  "widget.form.file-uploader",
  "widget.form.switch",
  "widget.form.hyperlink",
  "widget.form.autoCompute",
  "widget.form.serialNumber",
  "widget.form.selectData",
  "widget.form.relatedData",
] as const);

export type SubFormFieldType = typeof SUB_FORM_FIELD_TYPES[number];

const subFormFieldTypeSet = new Set<string>(SUB_FORM_FIELD_TYPES);

export const isSubFormFieldType = (type: unknown): type is SubFormFieldType => (
  typeof type === "string" && subFormFieldTypeSet.has(type)
);
