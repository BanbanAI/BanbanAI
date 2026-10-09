import { NocodeFormData } from "@common/types/nocode";
import { Field, Row, Table as FormDataTable } from "@common/types/project";
import { hasConfiguredValue, SystemField } from "@common/utils";
import { getFormulaStr } from "@common/utils/formula";
import { deepClone, isEmpty } from "@common/utils/object";

export const COPY_CONTEXT_KEY = "__copyContext__";

export type CopyContext = {
  resetFieldUIDs?: string[];
  resetDefaultFieldUIDs?: string[];
  resetFormulaFieldUIDs?: string[];
  resetQuickComputeFieldUIDs?: string[];
};

const SUB_SERIAL_NUMBER_COUNTER_FIELD_PREFIX = "__sub_serial_number_counter__";

const isSubSerialNumberCounterField = (field?: Field) => {
  return !!field?.meta?.extra?.internalField && (
    field.meta?.uid?.startsWith(SUB_SERIAL_NUMBER_COUNTER_FIELD_PREFIX)
    || field.meta?.name?.startsWith("sub_serial_number_counter_")
  );
};

const clearCopiedFieldValue = (row: Row, field: Field, options: { remove?: boolean } = {}) => {
  const targetRow = row as Record<string, any>;
  const { remove = false } = options;

  if (remove) {
    delete targetRow[field.uid];
  } else {
    targetRow[field.uid] = null;
  }

  const legacyFieldId = field.meta?.uid;
  if (legacyFieldId && legacyFieldId in targetRow) {
    if (remove) {
      delete targetRow[legacyFieldId];
    } else {
      targetRow[legacyFieldId] = null;
    }
  }
};

const shouldResetOnCopy = (field?: Field) => {
  return !!field?.meta?.extra?.resetOnCopy;
};

const stripCopyInternalState = (row: Record<string, any>) => {
  delete row[COPY_CONTEXT_KEY];
  delete row.isManualAdd;
};

const stripCopyTransientStateInPlace = (value: unknown) => {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach(item => stripCopyTransientStateInPlace(item));
    return;
  }

  const targetValue = value as Record<string, any>;
  stripCopyInternalState(targetValue);
  Object.values(targetValue).forEach(item => stripCopyTransientStateInPlace(item));
};

const getSubTable = (field: Field, formData: NocodeFormData) => {
  const subTableUID = field.meta?.extra?.subTableUID;
  if (!subTableUID) return null;
  const tableUID = Array.isArray(subTableUID) ? subTableUID.at(-1) : subTableUID;
  return formData?.tables?.find(item => item.uid === tableUID) || null;
};

const collectResetDefaults = (
  field: Field,
  defaultFieldUIDs: Set<string>,
  formulaFieldUIDs: Set<string>,
  quickComputeFieldUIDs: Set<string>,
) => {
  const extra = field.meta?.extra;
  if ((extra?.defaultValueType === "custom" || extra?.linkType === "form") && hasConfiguredValue(extra?.defaultValue)) {
    defaultFieldUIDs.add(field.uid);
    return;
  }

  if (
    extra?.defaultValueType === "formula"
    && extra?.defaultComputeType === "quickCompute"
    && Array.isArray(extra?.otherTableFieldUID)
    && extra.otherTableFieldUID.length >= 3
  ) {
    quickComputeFieldUIDs.add(field.uid);
    return;
  }

  if (extra?.defaultValueType === "formula" && !isEmpty(getFormulaStr(extra?.formula))) {
    formulaFieldUIDs.add(field.uid);
  }
};

const cloneFieldWithUID = (field: Field, uid: string) => {
  return {
    ...field,
    uid,
  } as Field;
};

const isSubFormField = (field?: Field) => {
  return field?.meta?.extra?.widgetType === "widget.form.subform" || field?.meta?.subType === "subForm";
};

type SanitizeCopiedRowOptions = {
  row: Row,
  table?: FormDataTable | null,
  fields?: Field[],
  formData: NocodeFormData,
  isSubRow?: boolean,
  parentFieldUID?: string,
  pendingResetFieldUIDs?: Set<string>,
  pendingDefaultFieldUIDs?: Set<string>,
  pendingFormulaFieldUIDs?: Set<string>,
  pendingQuickComputeFieldUIDs?: Set<string>,
};

const sanitizeCopiedRowInternal = ({
  row,
  table,
  fields = table?.fields || [],
  formData,
  isSubRow = false,
  parentFieldUID,
  pendingResetFieldUIDs,
  pendingDefaultFieldUIDs,
  pendingFormulaFieldUIDs,
  pendingQuickComputeFieldUIDs,
}: SanitizeCopiedRowOptions): Row => {
  const nextRow = deepClone(row ?? {}) as Record<string, any>;
  stripCopyInternalState(nextRow);

  if (isSubRow) {
    delete nextRow.__uuid__;
  }

  const resetFieldUIDs = pendingResetFieldUIDs ?? new Set<string>();
  const defaultFieldUIDs = pendingDefaultFieldUIDs ?? new Set<string>();
  const formulaFieldUIDs = pendingFormulaFieldUIDs ?? new Set<string>();
  const quickComputeFieldUIDs = pendingQuickComputeFieldUIDs ?? new Set<string>();

  const buildCopyField = (field: Field) => {
    if (!parentFieldUID) return field;
    return cloneFieldWithUID(field, `${parentFieldUID}.${field.uid}`);
  };

  for (const field of fields) {
    if (field.meta?.extra?.widgetType === "widget.form.subform") {
      const subRows = Array.isArray(nextRow[field.uid]) ? nextRow[field.uid] : [];
      const subTable = getSubTable(field, formData);
      const subFields = subTable?.fields || field.subTableFields || [];
      nextRow[field.uid] = subRows.map(item => sanitizeCopiedRowInternal({
        row: item,
        table: subTable,
        fields: subFields,
        formData,
        isSubRow: true,
        parentFieldUID: parentFieldUID ? `${parentFieldUID}.${field.uid}` : field.uid,
        pendingResetFieldUIDs: resetFieldUIDs,
        pendingDefaultFieldUIDs: defaultFieldUIDs,
        pendingFormulaFieldUIDs: formulaFieldUIDs,
        pendingQuickComputeFieldUIDs: quickComputeFieldUIDs,
      }));
      continue;
    }

    if (
      field.meta?.extra?.widgetType === "widget.form.serialNumber"
      || field.meta?.name === SystemField.UUID
      || (!isSubRow && isSubSerialNumberCounterField(field))
    ) {
      clearCopiedFieldValue(nextRow, field, {
        remove: isSubRow && field.meta?.name === SystemField.UUID,
      });
      continue;
    }

    if (!shouldResetOnCopy(field)) continue;
    const copyField = buildCopyField(field);
    clearCopiedFieldValue(nextRow, field);
    resetFieldUIDs.add(copyField.uid);
    collectResetDefaults(copyField, defaultFieldUIDs, formulaFieldUIDs, quickComputeFieldUIDs);
  }

  nextRow.isManualAdd = true;
  if (!isSubRow && resetFieldUIDs.size > 0) {
    nextRow[COPY_CONTEXT_KEY] = {
      resetFieldUIDs: [...resetFieldUIDs],
      resetDefaultFieldUIDs: [...defaultFieldUIDs],
      resetFormulaFieldUIDs: [...formulaFieldUIDs],
      resetQuickComputeFieldUIDs: [...quickComputeFieldUIDs],
    } as CopyContext;
  }

  return nextRow as Row;
};

export const sanitizeCopiedRowForCopy = ({
  row,
  table,
  formData,
}: Pick<SanitizeCopiedRowOptions, "row" | "table" | "formData">): Row => {
  return sanitizeCopiedRowInternal({
    row,
    table,
    fields: table?.fields || [],
    formData,
    isSubRow: false,
  });
};

export const getCopyContext = (row?: Row | null): CopyContext | undefined => {
  return row?.[COPY_CONTEXT_KEY];
};

export const stripCopyTransientState = (row?: Row | null) => {
  if (!row) return row;
  const nextRow = deepClone(row) as Record<string, any>;
  stripCopyTransientStateInPlace(nextRow);
  return nextRow as Row;
};

const resolveCopyContextField = (fieldUID: string, table?: FormDataTable | null, formData?: NocodeFormData) => {
  if (!fieldUID || !table || !formData) return null;

  const fieldUIDParts = fieldUID.split(".");
  if (fieldUIDParts.length === 1) {
    return table.fields.find(field => field.uid === fieldUID) || null;
  }
  if (fieldUIDParts.length !== 2) return null;

  const [subFormFieldUID, subFieldUID] = fieldUIDParts;
  const subFormField = table.fields.find(field => field.uid === subFormFieldUID);
  const subTable = subFormField ? getSubTable(subFormField, formData) : null;
  const subField = subTable?.fields?.find(field => field.uid === subFieldUID);
  return subField ? cloneFieldWithUID(subField, fieldUID) : null;
};

const resolveCopyContextFields = (fieldUIDs: string[] = [], table?: FormDataTable | null, formData?: NocodeFormData) => {
  const uniqueFieldUIDs = [...new Set(fieldUIDs)];
  return uniqueFieldUIDs.reduce<Field[]>((prev, fieldUID) => {
    const field = resolveCopyContextField(fieldUID, table, formData);
    if (field) {
      prev.push(field);
    }
    return prev;
  }, []);
};

export const getCopyContextCalculationFields = (
  copyContext?: CopyContext,
  table?: FormDataTable | null,
  formData?: NocodeFormData,
) => {
  return {
    defaultFields: resolveCopyContextFields(copyContext?.resetDefaultFieldUIDs || [], table, formData),
    formulaFields: resolveCopyContextFields(copyContext?.resetFormulaFieldUIDs || [], table, formData),
    quickComputeFields: resolveCopyContextFields(copyContext?.resetQuickComputeFieldUIDs || [], table, formData),
  };
};

export const getTableCalculationFields = (
  table?: FormDataTable | null,
  formData?: NocodeFormData,
) => {
  const defaultFields: Field[] = [];
  const formulaFields: Field[] = [];
  const quickComputeFields: Field[] = [];
  const defaultFieldUIDs = new Set<string>();
  const formulaFieldUIDs = new Set<string>();
  const quickComputeFieldUIDs = new Set<string>();

  const appendCalculationField = (field: Field) => {
    const pendingDefaultUIDs = new Set<string>();
    const pendingFormulaUIDs = new Set<string>();
    const pendingQuickComputeUIDs = new Set<string>();
    collectResetDefaults(field, pendingDefaultUIDs, pendingFormulaUIDs, pendingQuickComputeUIDs);

    if (pendingDefaultUIDs.has(field.uid) && !defaultFieldUIDs.has(field.uid)) {
      defaultFieldUIDs.add(field.uid);
      defaultFields.push(field);
    }

    if (pendingFormulaUIDs.has(field.uid) && !formulaFieldUIDs.has(field.uid)) {
      formulaFieldUIDs.add(field.uid);
      formulaFields.push(field);
    }

    if (pendingQuickComputeUIDs.has(field.uid) && !quickComputeFieldUIDs.has(field.uid)) {
      quickComputeFieldUIDs.add(field.uid);
      quickComputeFields.push(field);
    }
  };

  const visitFields = (fields: Field[] = [], parentFieldUID?: string) => {
    for (const field of fields) {
      if (isSubFormField(field)) {
        const subTable = formData ? getSubTable(field, formData) : null;
        const subFields = subTable?.fields || field.subTableFields || [];
        const nextParentFieldUID = parentFieldUID ? `${parentFieldUID}.${field.uid}` : field.uid;
        visitFields(subFields, nextParentFieldUID);
        continue;
      }

      const targetField = parentFieldUID
        ? cloneFieldWithUID(field, `${parentFieldUID}.${field.uid}`)
        : field;
      appendCalculationField(targetField);
    }
  };

  visitFields(table?.fields || []);

  return {
    defaultFields,
    formulaFields,
    quickComputeFields,
  };
};
