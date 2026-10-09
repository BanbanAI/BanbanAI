import { FieldAuthValue, FormWidgetType } from "../../../../../../../common/types/nocode";
import { NocodeTableColumnLike } from "./types";

const DATA_OWNER_SYSTEM_FIELD = "_data_owner";
const SYSTEM_FIELD_NAMES = new Set([
  "_uuid",
  "_create_time",
  "_update_time",
  "_create_owner",
  "_data_owner",
  "_update_owner",
  "_status",
  "_current_node",
  "_current_owner",
  "_todo_id",
  "_key",
  "_data_title",
  "_sort",
  "_data_stage",
  "_related_sub_form",
]);

const POPPER_SELECTORS = [
  ".checkbox-group-select-popver",
  ".el-select__popper",
  ".tree-select-popper",
  ".el-popper",
];

const DIALOG_SELECTORS = [
  ".workbench-add-admin-dialog",
  ".rich-text-dialog",
  ".markdown-editor-dialog",
];

const getTableUuidFieldId = (table?: { fields?: Array<{ uid?: string; meta?: { name?: string } }> } | null) => {
  return table?.fields?.find((field) => field?.meta?.name === "_uuid")?.uid;
};

const isDataOwnerEnabledTable = (table?: { meta?: { extra?: any }, extra?: any } | null) => {
  return !Boolean(table?.meta?.extra?.primaryTable || table?.extra?.primaryTable);
};

const isSystemFieldName = (fieldName?: string | null) => {
  return Boolean(fieldName) && SYSTEM_FIELD_NAMES.has(fieldName as string);
};

const resolveCurrentField = (
  options: {
    widget: any;
    column: NocodeTableColumnLike;
  },
) => {
  const table = options.column.params.isSubColumn
    ? options.widget.getTable(options.column.params.tableUID)
    : options.widget.table;
  const field = table?.fields?.find((item) => item.uid === options.column.field);
  if (field) {
    return field;
  }
  if (options.column.field === DATA_OWNER_SYSTEM_FIELD && table && isDataOwnerEnabledTable(table)) {
    return {
      uid: DATA_OWNER_SYSTEM_FIELD,
      meta: {
        name: DATA_OWNER_SYSTEM_FIELD,
        subType: "account",
      },
    };
  }
  return undefined;
};

const resolveWidgetType = (
  options: {
    widget: any;
    column: NocodeTableColumnLike;
  },
) => {
  const widgetInstance = options.widget.getInstanceById?.(options.column.params.elementId);
  if (widgetInstance?.type) {
    return widgetInstance.type as FormWidgetType;
  }
  return options.column.params?.extra?.widgetType as FormWidgetType | undefined;
};

const resolvePermissionRow = (
  options: {
    widget: any;
    row: Record<string, any>;
  },
) => {
  const rowKeyField = options.widget?.rowKey;
  const rowKey = rowKeyField ? options.row?.[rowKeyField] : undefined;
  if ((typeof rowKey !== "string" && typeof rowKey !== "number")) {
    return options.row;
  }
  return options.widget?.getRow?.(rowKey) || options.row;
};

export const resolveNocodeTableCellEditingState = (
  options: {
    widget: any;
    row: Record<string, any>;
    column: NocodeTableColumnLike;
    tableProps: {
      isEditDataAble?: boolean;
      isTableCellEditable?: boolean;
    };
    isCellEdit: boolean;
    isAdmin: boolean;
  },
) => {
  const table = options.widget.getTable(options.widget.formTableUID);
  if (!table) {
    return {
      editable: false,
      interaction: "none",
      widgetType: undefined,
    } as const;
  }

  const currentField = resolveCurrentField({
    widget: options.widget,
    column: options.column,
  });
  const permissionRow = resolvePermissionRow({
    widget: options.widget,
    row: options.row,
  });
  const canEditCurrentRow = options.widget.canEditRow?.(permissionRow) ?? Boolean(options.tableProps.isEditDataAble);
  const isDataOwnerEditable = Boolean(
    !options.column.params.isSubColumn
    && currentField?.meta?.name === DATA_OWNER_SYSTEM_FIELD
    && options.tableProps.isEditDataAble
    && options.tableProps.isTableCellEditable
    && !options.isCellEdit
    && canEditCurrentRow
    && options.isAdmin,
  );

  if (isDataOwnerEditable) {
    return {
      editable: true,
      interaction: "dialog",
      widgetType: undefined,
    } as const;
  }

  if (!canEditCurrentRow) {
    return {
      editable: false,
      interaction: "none",
      widgetType: undefined,
    } as const;
  }

  const widgetInstance = options.widget.getInstanceById?.(options.column.params.elementId);
  const widgetType = resolveWidgetType({
    widget: options.widget,
    column: options.column,
  });

  if (widgetInstance?.isReadonly) {
    return {
      editable: false,
      interaction: "none",
      widgetType,
    } as const;
  }
  if (["related", "relatedSubForm"].includes(options.column.params.subType)) {
    return {
      editable: false,
      interaction: "none",
      widgetType,
    } as const;
  }

  const fieldsAuth = options.widget.fieldsAuth;
  if (
    fieldsAuth !== "all"
    && fieldsAuth?.[options.column.params.elementId] !== FieldAuthValue.VISIBLE_EDITABLE
  ) {
    return {
      editable: false,
      interaction: "none",
      widgetType,
    } as const;
  }

  if (currentField && isSystemFieldName(currentField.meta?.name)) {
    return {
      editable: false,
      interaction: "none",
      widgetType,
    } as const;
  }

  if (options.column.params.isSubColumn) {
    const subTable = options.widget.getTable(options.column.params.tableUID);
    const subTableKeyField = getTableUuidFieldId(subTable);
    const subTableKey = subTableKeyField ? options.row?.[subTableKeyField] : undefined;
    if (!subTableKey) {
      return {
        editable: false,
        interaction: "none",
        widgetType,
      } as const;
    }
  }

  return {
    editable: Boolean(
      options.tableProps.isEditDataAble
      && options.tableProps.isTableCellEditable
      && !options.isCellEdit,
    ),
    interaction: "widget",
    widgetType,
  } as const;
};

export const shouldIgnoreNocodeTableEditorOutsideClick = (
  event: Pick<MouseEvent, "target">,
) => {
  const target = event.target as HTMLElement | null;
  if (!target?.closest) {
    return false;
  }
  return [...POPPER_SELECTORS, ...DIALOG_SELECTORS].some((selector) => Boolean(target.closest(selector)));
};
