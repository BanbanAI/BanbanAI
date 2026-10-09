import { createVirtualTableEditorRegistry } from "./editing/editor-registry";
import { VirtualTableResolvedEditor } from "./editing/types";
import { VirtualTableColumn } from "./types";
import {
  type VirtualTableLabRow,
  createVirtualTableLabColumns,
  createVirtualTableLabRows,
  resolveVirtualTableLabCellSpan,
  resolveVirtualTableLabRowClassName,
  VIRTUAL_TABLE_LAB_STRESS_MERGE,
} from "./VirtualTableLab.model";
import VirtualTableLabInlineNumberEditor from "./VirtualTableLabInlineNumberEditor.vue";
import VirtualTableLabInlineTextEditor from "./VirtualTableLabInlineTextEditor.vue";
import VirtualTableLabPopupSelectEditor from "./VirtualTableLabPopupSelectEditor.vue";

export {
  createVirtualTableLabColumns,
  createVirtualTableLabRows,
  resolveVirtualTableLabCellSpan,
  resolveVirtualTableLabRowClassName,
  VIRTUAL_TABLE_LAB_STRESS_MERGE,
};
export type { VirtualTableLabRow } from "./VirtualTableLab.model";

export const virtualTableLabEditorRegistry = createVirtualTableEditorRegistry([
  {
    type: "lab-text-inline",
    mode: "inline",
    component: VirtualTableLabInlineTextEditor,
  },
  {
    type: "lab-number-inline",
    mode: "inline",
    component: VirtualTableLabInlineNumberEditor,
    canCommitOnEnter: true,
  },
  {
    type: "lab-select-popup",
    mode: "popup",
    component: VirtualTableLabPopupSelectEditor,
    canCommitOnBlur: false,
  },
]);

export const resolveVirtualTableLabCellEditor = (
  row: VirtualTableLabRow,
  column: VirtualTableColumn,
): VirtualTableResolvedEditor | undefined => {
  const editorType = String(column.meta?.editorType || "");
  if (!editorType) {
    return undefined;
  }

  return {
    type: editorType,
    value: row[column.dataIndex as keyof VirtualTableLabRow],
    context: {
      options: column.meta?.options,
    },
  };
};
