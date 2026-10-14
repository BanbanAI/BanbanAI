import type { Component } from "vue";
import type { CellAddress } from "../runtime/types";
import type { ColumnDefinition } from "../runtime/column-definition";
import type { RowStore } from "../runtime/row-store";
import RuntimeOptionEditor from "./RuntimeOptionEditor.vue";

export type RuntimeEditorBinding = {
  component: Component;
  props: Record<string, unknown>;
};

type RuntimeEditorFactory = (column: ColumnDefinition, address: CellAddress, store: RowStore) => RuntimeEditorBinding;

const optionEditor = (column: ColumnDefinition, address: CellAddress, store: RowStore): RuntimeEditorBinding => ({
  component: RuntimeOptionEditor,
  props: {
    modelValue: store.getValue(address),
    options: (column.schema.options || []) as readonly { value: string; label: string }[],
    multiple: column.type === "widget.form.checkboxGroup"
      || column.type === "widget.form.treeMultipleSelect"
      || column.type === "widget.form.memberSelect"
      || column.type === "widget.form.departmentSelect"
      || column.schema.isMultiple === true,
    allowCustom: column.schema.allowCustom === true,
    otherLabel: typeof column.schema.otherLabel === "string" ? column.schema.otherLabel : "",
  },
});

const factories = new Map<string, RuntimeEditorFactory>([
  ["widget.form.radioGroup", optionEditor],
  ["widget.form.checkboxGroup", optionEditor],
  ["widget.form.treeSelect", optionEditor],
  ["widget.form.treeMultipleSelect", optionEditor],
]);

export function resolveRuntimeEditor(column: ColumnDefinition | null, address: CellAddress | null, store: RowStore) {
  if (!column || !address) return null;
  const factory = factories.get(column.type);
  return factory ? factory(column, address, store) : null;
}
