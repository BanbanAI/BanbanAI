import { FormWidgetType, NocodeFormData } from "@common/types/nocode";
import { Field, Row, Table, TableUID } from "@common/types/project";
import { isEmpty } from "@common/utils/object";


export const getRelatedFields = (formData: NocodeFormData, _table: Table) => {
  const results: Record<TableUID, { name: string, fields: Field[] }> = {};
  if (!_table?.uid) {
    return results;
  }
  for (const table of formData.tables) {
    const relatedFields = table.fields.filter(field => field.meta?.extra?.relatedTableUID?.[1] === _table?.uid);
    if (isEmpty(relatedFields)) continue;
    results[table.uid] = {
      name: table.alias,
      fields: relatedFields,
    }
  }
  return results;
}

export type PrintableRelatedSubForm = {
  name: string,
  fields: Field[],
  table: Table,
  printableFields: Field[],
}

const unsupportedPrintableRelatedSubFormWidgetTypes = new Set<string>([
  FormWidgetType.RELATED_DATA,
  FormWidgetType.SUBFORM,
]);
const systemFieldNames = new Set<string>([
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
  "_todo_version",
  "_key",
  "_data_title",
  "_sort",
  "_data_stage",
  "_related_sub_form",
]);

export const isPrintableRelatedSubFormField = (field: Field) => {
  if (field?.meta?.isSystem || systemFieldNames.has(field?.meta?.name)) {
    return false;
  }
  const widgetType = field?.meta?.extra?.widgetType;
  if (unsupportedPrintableRelatedSubFormWidgetTypes.has(widgetType)) {
    return false;
  }
  return true;
}

export const getPrintableRelatedSubForms = (formData: NocodeFormData, _table: Table) => {
  const relatedFields = getRelatedFields(formData, _table);
  const results: Record<TableUID, PrintableRelatedSubForm> = {};

  for (const [tableUID, relatedInfo] of Object.entries(relatedFields)) {
    const table = formData.tables.find(item => item.uid === tableUID);
    if (!table) {
      continue;
    }
    const printableFields = table.fields.filter(isPrintableRelatedSubFormField);
    if (isEmpty(printableFields)) {
      continue;
    }
    results[tableUID] = {
      ...relatedInfo,
      table,
      printableFields,
    };
  }

  return results;
}

export const buildPrintableRelatedSubFormRuntimeFields = (
  relatedSubForms: Record<TableUID, PrintableRelatedSubForm>,
) => {
  return Object.entries(relatedSubForms).map(([tableUID, relatedInfo]) => ({
    uid: tableUID,
    alias: relatedInfo.name,
    type: "array",
    meta: {
      uid: tableUID,
      name: tableUID,
      subType: "subForm",
      extra: {
        widgetType: FormWidgetType.SUBFORM,
      },
    },
    subTableFields: relatedInfo.printableFields,
  } as Field));
}

const normalizeArrayValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return [value];
}

const pickPrintableRelatedSubFormRow = (row: Row, printableFields: Field[]) => {
  return printableFields.reduce<Row>((result, field) => {
    result[field.uid] = row?.[field.uid];
    return result;
  }, {});
}

export const attachPrintableRelatedSubFormRows = (
  rows: Row[],
  rowKey: string,
  relatedSubForms: Record<TableUID, PrintableRelatedSubForm>,
  relatedRowsByTable: Record<TableUID, Row[]>,
) => {
  if (isEmpty(rows) || !rowKey || isEmpty(relatedSubForms)) {
    return rows;
  }

  return rows.map(row => {
    const rowValue = row?.[rowKey];
    const nextRow = { ...row };

    for (const [tableUID, relatedInfo] of Object.entries(relatedSubForms)) {
      const matchedRows: Row[] = [];
      const matchedRowSet = new Set<Row>();
      const relatedRows = relatedRowsByTable[tableUID] || [];

      for (const relatedRow of relatedRows) {
        const isMatched = relatedInfo.fields.some(field => normalizeArrayValue(relatedRow?.[field.uid]).includes(rowValue));
        if (!isMatched || matchedRowSet.has(relatedRow)) {
          continue;
        }
        matchedRowSet.add(relatedRow);
        matchedRows.push(pickPrintableRelatedSubFormRow(relatedRow, relatedInfo.printableFields));
      }

      nextRow[tableUID] = matchedRows;
    }

    return nextRow;
  });
}
