import {
  FormConditionValueType,
  FilterRule,
  NocodeBody,
} from "@common/types/nocode";
import {
  CurrentSubTableFilter,
  Field,
  ProcessFlow,
  SourceTable,
  Table,
  TableUID,
  TargetFieldFillRule,
  TargetFieldFillType,
  getProcessTargetSourceUID,
} from "@common/types/project";
import { getNocodeDataSourceTableByUID } from "@common/utils/connection";
import { replaceByFormula } from "@common/utils/formula";

export type FlowFieldReferenceKind =
  | "target_form"
  | "target_filter_field"
  | "target_filter_value_field"
  | "source_table"
  | "source_field"
  | "target_field"
  | "formula_field"
  | "current_subtable"
  | "current_subtable_filter_field";

export type FlowFieldReferenceInvalidReason =
  | "form_missing"
  | "field_missing"
  | "subfield_missing"
  | "source_table_missing"
  | "inaccessible"
  | "unsupported_field"
  | "permission_denied";

export type FlowFieldReferenceIssue = {
  kind: FlowFieldReferenceKind;
  reason: FlowFieldReferenceInvalidReason;
  nodeUID?: string;
  nodeName?: string;
  tableUID?: string;
  tableName?: string;
  fieldUID?: string;
  fieldName?: string;
  sourceTableUID?: string;
  sourceFieldUID?: string;
  sourceTableName?: string;
  sourceFieldName?: string;
  location?: string;
};

export class FlowFieldReferenceValidationError extends Error {
  readonly code = "FLOW_FIELD_REFERENCE_INVALID";
  readonly issues: FlowFieldReferenceIssue[];

  constructor(issues: FlowFieldReferenceIssue[]) {
    const first = issues[0];
    const nodeName = first?.nodeName || global.i18next.t("flowFieldReferenceValidator.defaultNodeName");
    const tableName = first?.tableName || first?.sourceTableName || global.i18next.t("flowFieldReferenceValidator.targetForm");
    const fieldName = first?.fieldName || first?.sourceFieldName;
    const reason = first?.reason === "source_table_missing" || first?.reason === "form_missing"
      ? global.i18next.t("flowFieldReferenceValidator.formMissingOrInaccessible", {
        tableName,
        interpolation: { escapeValue: false },
      })
      : fieldName
        ? global.i18next.t("flowFieldReferenceValidator.fieldMissingOrDeleted", {
          tableName,
          fieldName,
          interpolation: { escapeValue: false },
        })
        : global.i18next.t("flowFieldReferenceValidator.nodeConfigIncomplete");
    const location = first?.location ? global.i18next.t("flowFieldReferenceValidator.locationSuffix", { location: first.location }) : "";
    const countText = issues.length > 1 ? global.i18next.t("flowFieldReferenceValidator.issueCountPrefix", { issueCount: issues.length }) : "";
    super(global.i18next.t("flowFieldReferenceValidator.flowEndedMessage", {
      nodeName,
      countText,
      reason,
      location,
      interpolation: { escapeValue: false },
    }));
    this.name = "FlowFieldReferenceValidationError";
    this.issues = issues;
  }
}

type ResolvedTable = {
  sourceUID: string;
  tableUID: TableUID;
  table: Table;
  formData: NocodeBody["formData"];
  alias?: string;
};

type ValidatorInput = {
  node: ProcessFlow;
  nocodeId: string;
  nocodeBody: NocodeBody;
  currentTable: Table;
  targetTable: Table;
  targetFormData: NocodeBody["formData"];
  targetTableUID: TableUID;
};

const text = (value: unknown) => String(value ?? "").trim();

const getFieldIdentity = (field?: Field | null) => text(field?.uid || field?.meta?.uid);

const findField = (table: Table | undefined, fieldUID: string) => {
  if (!table || !fieldUID) return undefined;
  return table.fields.find(field => getFieldIdentity(field) === fieldUID);
};

const resolveFieldPath = (
  table: Table | undefined,
  formData: NocodeBody["formData"] | undefined,
  fieldPath: string,
) => {
  const [parentUID, subFieldUID] = text(fieldPath).split(".");
  const parentField = findField(table, parentUID);
  if (!parentField) return null;
  if (!subFieldUID) return { field: parentField, path: parentUID };

  const subTableUID = parentField.meta?.extra?.subTableUID?.at(-1);
  const subTable = formData?.tables?.find(item => item.uid === subTableUID);
  const subField = findField(subTable, subFieldUID);
  if (!subTable || !subField) return null;
  return {
    field: subField,
    parentField,
    path: `${getFieldIdentity(parentField)}.${getFieldIdentity(subField)}`,
  };
};

const fieldLabel = (field?: Field | null, fallback = "") => text(field?.alias || field?.meta?.name || fallback) || fallback;

export function validateEditDataNodeFieldReferences(input: ValidatorInput): FlowFieldReferenceIssue[] {
  const { node, nocodeId, nocodeBody, currentTable, targetTable, targetFormData, targetTableUID } = input;
  const options = node.options || {};
  const nodeName = text(options.name) || global.i18next.t("flowFieldReferenceValidator.defaultNodeName");
  const nodeUID = text(node.uid) || undefined;
  const issues: FlowFieldReferenceIssue[] = [];
  const tableRefs = new Map<string, ResolvedTable>();

  const addIssue = (issue: Omit<FlowFieldReferenceIssue, "nodeUID" | "nodeName">) => {
    issues.push({ nodeUID, nodeName, ...issue });
  };

  const registerTable = (sourceUID: string, tableUID: TableUID, table: Table, formData: NocodeBody["formData"], alias?: string) => {
    tableRefs.set(sourceUID, { sourceUID, tableUID, table, formData, alias });
  };

  registerTable(currentTable.uid, currentTable.uid, currentTable, nocodeBody.formData, currentTable.alias);
  registerTable(targetTable.uid, targetTable.uid, targetTable, targetFormData, targetTable.alias);
  registerTable(
    getProcessTargetSourceUID(targetTableUID, currentTable.uid),
    targetTable.uid,
    targetTable,
    targetFormData,
    targetTable.alias,
  );

  const resolveConfiguredTable = (sourceTable: SourceTable | undefined, kind: FlowFieldReferenceKind, location: string) => {
    if (!sourceTable?.tableUID) {
      addIssue({ kind, reason: "source_table_missing", location });
      return undefined;
    }
    const sourceData = getNocodeDataSourceTableByUID(nocodeBody, sourceTable.tableUID, {
      nocodeId,
      includeSchemaSources: true,
    }, true);
    if (!sourceData?.table || !sourceData.connection) {
      addIssue({
        kind,
        reason: "source_table_missing",
        sourceTableUID: sourceTable.tableUID,
        sourceTableName: sourceTable.alias || sourceTable.name,
        location,
      });
      return undefined;
    }
    registerTable(
      sourceTable.uid,
      sourceTable.tableUID,
      sourceData.table,
      sourceData.connection,
      sourceTable.alias || sourceTable.name || sourceData.table.alias,
    );
    return tableRefs.get(sourceTable.uid);
  };

  const sourceTables = Array.isArray(options.sourceTables) ? options.sourceTables : [];
  sourceTables.forEach((sourceTable, index) => {
    const location = global.i18next.t("flowFieldReferenceValidator.locationSourceTableItem", { index: index + 1 });
    const resolved = resolveConfiguredTable(sourceTable, "source_table", location);
    if (resolved) {
      validateFilterRule(sourceTable.filterRule, resolved, "source_field", global.i18next.t("flowFieldReferenceValidator.locationSourceTableFilter", { index: index + 1 }));
    }
  });

  const primarySourceTable = options.primarySourceTable as SourceTable | undefined;
  const primaryResolved = primarySourceTable
    ? resolveConfiguredTable(primarySourceTable, "source_table", global.i18next.t("flowFieldReferenceValidator.locationPrimarySourceTable"))
    : undefined;
  if (primaryResolved) {
    validateFilterRule(primarySourceTable?.filterRule, primaryResolved, "source_field", global.i18next.t("flowFieldReferenceValidator.locationPrimarySourceTableFilter"));
  }

  const targetFields = Array.isArray(options.targetFields) ? options.targetFields as TargetFieldFillRule[] : [];
  targetFields.forEach((item, index) => {
    const location = global.i18next.t("flowFieldReferenceValidator.locationTargetFieldRuleItem", { index: index + 1 });
    const targetPath = text(item?.fieldUID);
    const targetField = resolveFieldPath(targetTable, targetFormData, targetPath);
    if (!targetField) {
      addIssue({
        kind: "target_field",
        reason: targetPath.includes(".") ? "subfield_missing" : "field_missing",
        tableUID: targetTable.uid,
        tableName: targetTable.alias || targetTable.meta?.name,
        fieldUID: targetPath,
        fieldName: targetPath,
        location,
      });
      return;
    }

    if (item.type === TargetFieldFillType.FIELD) {
      const sourceValue = text(item.value);
      if (!sourceValue || sourceValue === "submitter") return;
      validateSourceField(sourceValue, "source_field", location, false);
    } else if (item.type === TargetFieldFillType.FORMULA) {
      validateFormula(text(item.value), global.i18next.t("flowFieldReferenceValidator.locationTargetFieldFormulaItem", { index: index + 1 }));
    }
  });

  validateFilterRule(options.targetTableFilterRule as FilterRule | undefined, {
    sourceUID: getProcessTargetSourceUID(targetTableUID, currentTable.uid),
    tableUID: targetTable.uid,
    table: targetTable,
    formData: targetFormData,
    alias: targetTable.alias,
  }, "target_filter_field", global.i18next.t("flowFieldReferenceValidator.locationTargetFormFilter"));

  const currentSubTableFilters = [
    ...(Array.isArray(options.currentSubTableFilters) ? options.currentSubTableFilters : []),
    ...(options.currentSubTableFilter ? [options.currentSubTableFilter] : []),
  ] as CurrentSubTableFilter[];
  currentSubTableFilters.forEach((filter, index) => {
    const location = global.i18next.t("flowFieldReferenceValidator.locationCurrentSubTableFilterItem", { index: index + 1 });
    const currentSubTableField = findField(currentTable, text(filter.fieldUID));
    const subTableUID = currentSubTableField?.meta?.extra?.subTableUID?.at(-1);
    const subTable = nocodeBody.formData.tables.find(item => item.uid === filter.tableUID);
    if (!currentSubTableField || !subTableUID || subTableUID !== filter.tableUID || !subTable) {
      addIssue({
        kind: "current_subtable",
        reason: "subfield_missing",
        tableUID: currentTable.uid,
        tableName: currentTable.alias || currentTable.meta?.name,
        fieldUID: text(filter.fieldUID),
        fieldName: fieldLabel(currentSubTableField, text(filter.fieldUID)),
        location,
      });
      return;
    }
    const subRef: ResolvedTable = {
      sourceUID: filter.tableUID,
      tableUID: subTable.uid,
      table: subTable,
      formData: nocodeBody.formData,
      alias: subTable.alias,
    };
    validateFilterRule(filter.filterRule, subRef, "current_subtable_filter_field", location);
  });

  return issues;

  function resolveSourceField(path: string) {
    const tokens = text(path).split(".");
    if (tokens.length < 2) {
      return resolveFieldPath(currentTable, nocodeBody.formData, tokens[0]);
    }
    const sourceUID = tokens[0];
    const sourceRef = tableRefs.get(sourceUID)
      || tableRefs.get(tokens.slice(0, 1).join("."));
    if (!sourceRef) return null;
    return resolveFieldPath(sourceRef.table, sourceRef.formData, tokens.slice(1).join("."));
  }

  function validateSourceField(path: string, kind: FlowFieldReferenceKind, location: string, allowCurrentFallback = true) {
    const tokens = text(path).split(".");
    const sourceUID = tokens.length > 1 ? tokens[0] : currentTable.uid;
    const sourceRef = tokens.length > 1 ? tableRefs.get(sourceUID) : tableRefs.get(currentTable.uid);
    const resolved = resolveSourceField(path);
    if (resolved) return resolved;
    if (allowCurrentFallback && !sourceRef) {
      const fallback = resolveFieldPath(currentTable, nocodeBody.formData, path);
      if (fallback) return fallback;
    }
    addIssue({
      kind,
      reason: tokens.length > 2 ? "subfield_missing" : "field_missing",
      sourceTableUID: sourceRef?.tableUID || sourceUID,
      sourceTableName: sourceRef?.alias || sourceRef?.table.alias || sourceUID,
      sourceFieldUID: tokens.slice(1).join(".") || tokens[0],
      sourceFieldName: tokens.slice(1).join(".") || tokens[0],
      location,
    });
    return null;
  }

  function validateFormula(formula: string, location: string) {
    if (!formula) {
      addIssue({ kind: "formula_field", reason: "field_missing", location });
      return;
    }
    replaceByFormula(formula, (keys) => {
      validateSourceField(keys.join("."), "formula_field", location);
      return "";
    });
  }

  function validateFilterRule(rule: FilterRule | undefined, tableRef: ResolvedTable, kind: FlowFieldReferenceKind, location: string) {
    if (!rule) return;
    for (const condition of rule.conditions || []) {
      const fieldPath = text(condition?.uid);
      if (fieldPath && !resolveFieldPath(tableRef.table, tableRef.formData, fieldPath)) {
        addIssue({
          kind,
          reason: fieldPath.includes(".") ? "subfield_missing" : "field_missing",
          tableUID: tableRef.tableUID,
          tableName: tableRef.alias || tableRef.table.alias || tableRef.table.meta?.name,
          fieldUID: fieldPath,
          fieldName: fieldPath,
          location,
        });
      }
      if (condition?.type === FormConditionValueType.FORM && text(condition.value)) {
        validateSourceField(text(condition.value), "target_filter_value_field", global.i18next.t("flowFieldReferenceValidator.locationFilterConditionValue", { location }));
      } else if (condition?.type === FormConditionValueType.FORMULA) {
        validateFormula(text(condition.formula || condition.value), global.i18next.t("flowFieldReferenceValidator.locationFilterConditionFormula", { location }));
      }
    }
  }
}
