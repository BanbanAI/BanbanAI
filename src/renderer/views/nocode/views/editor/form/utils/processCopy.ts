import {
  ConditionBranchCondition,
  EditDataTargetScope,
  Field,
  FLOW_DATA_OWNER_SOURCE_SUBMITTER,
  FormOption,
  NocodeProcess,
  PROCESS_TARGET_SOURCE_UID,
  ProcessFlow,
  ProcessNodeOwnerType,
  ProcessNodeType,
  ProcessVersionStatus,
  SourceTable,
  Table,
  TargetFieldFillRule,
  TargetFieldFillType,
} from '@common/types/project';
import { ConditionBranchConditionGroup } from '@common/types/project';
import { FieldAuthValue, FilterRule, FormCondition, FormConditionValueType, LogicalOperator, NocodeBody, NocodeFormData, OtherDataSource } from '@common/types/nocode';
import { getFormulaDetailed, getFormulaStr, getMaxProcessVersion, getProcessVersionKey, type FormulaConfig } from '@common/utils';
import { getNocodeDataSourceTableByUID, isDataOwnerEnabledTable } from '@common/utils/connection';
import { deepClone } from '@common/utils/object';
import { unique } from '@common/utils/unique';

export type NocodeLikeBody = {
  formData?: NocodeFormData,
  otherDataSources?: OtherDataSource[],
  otherDataSourceSchemas?: OtherDataSource[],
};

export type CopyableTargetForm = {
  id: string,
  name: string,
  table: Table,
  nocodeId?: string,
  nocodeName?: string,
  isCrossApp?: boolean,
  nocodeStructure?: NocodeBody['structure'],
  nocodeSnapshot?: NocodeBody['snapshot'],
};

type FlowOptionWidget = {
  uid?: string,
  widgets?: FlowOptionWidget[],
};

type CopyProcessContext = {
  currentTable: Table,
  targetTable: Table,
  targetFormOption?: FormOption | null,
  nocodeBody: NocodeLikeBody,
  nocodeId?: string,
  nocodeName?: string,
};

type SourceTableContext = {
  uid: string,
  tableUID?: string | null,
};

type NodeOwnerDepartmentField = {
  value?: string,
};

type FormulaValue = string | FormulaConfig;

const isFormulaValue = (value: unknown): value is FormulaValue => {
  return typeof value === 'string'
    || (typeof value === 'object' && value !== null && 'formula' in value);
};

const getSanitizedFormulaText = (
  value: unknown,
  currentTableUIDSet: Set<string>,
  currentFieldUIDSet: Set<string>,
) => {
  const sanitizedValue = sanitizeFormulaValue(value, currentTableUIDSet, currentFieldUIDSet);
  if (typeof sanitizedValue === 'string') {
    return sanitizedValue;
  }
  return sanitizedValue?.formula;
};

const getTargetTableContext = (context: CopyProcessContext, tableUID?: string | null) => {
  if (!tableUID) {
    return undefined;
  }
  return getNocodeDataSourceTableByUID(context.nocodeBody, tableUID as Table['uid'], {
    nocodeId: context.nocodeId,
    name: context.nocodeName,
    includeSchemaSources: true,
  }, true);
};

const getCurrentAndTargetSubTableUIDs = (table: Table) => {
  return new Set(
    (table.fields || [])
      .map(field => field.meta?.extra?.subTableUID?.[1])
      .filter(Boolean),
  );
};

const getTableFieldUIDSet = (table?: Table | null) => {
  const fieldUIDSet = new Set<string>();
  if (!table) {
    return fieldUIDSet;
  }
  (table.fields || []).forEach(field => {
    fieldUIDSet.add(field.uid);
    if (field.meta?.uid) {
      fieldUIDSet.add(field.meta.uid);
    }
    (field.subTableFields || []).forEach(subField => {
      fieldUIDSet.add(`${field.uid}.${subField.uid}`);
      fieldUIDSet.add(subField.uid);
      if (subField.meta?.uid) {
        fieldUIDSet.add(subField.meta.uid);
      }
    });
  });
  return fieldUIDSet;
};

const getTargetFormElementUIDSet = (formOption?: FormOption | null) => {
  const widgetUIDSet = new Set<string>();
  const walk = (widgets: FlowOptionWidget[] = []) => {
    widgets.forEach(widget => {
      if (widget?.uid) {
        widgetUIDSet.add(widget.uid);
      }
      if (Array.isArray(widget?.widgets)) {
        walk(widget.widgets);
      }
    });
  };
  walk(formOption?.widget?.widgets || []);
  return widgetUIDSet;
};

const getTargetTableEditableFieldUIDSet = (table: Table, formOption?: FormOption | null) => {
  const widgetUIDSet = getTargetFormElementUIDSet(formOption);
  const fieldUIDSet = new Set<string>();

  const appendFieldUID = (field: Field, prefix?: string) => {
    if (!field) {
      return;
    }
    const fieldKey = prefix ? `${prefix}.${field.uid}` : field.uid;
    if (field.meta?.uid && widgetUIDSet.has(field.meta.uid)) {
      fieldUIDSet.add(fieldKey);
    }
  };

  const appendField = (field: Field, parentField?: Field) => {
    appendFieldUID(field, parentField?.uid);
    (field.subTableFields || []).forEach(subField => appendField(subField, field));
  };

  (table.fields || []).forEach(field => appendField(field));

  if (isDataOwnerEnabledTable(table)) {
    fieldUIDSet.add('dataOwner');
  }

  return fieldUIDSet;
};

const cloneConditionGroup = <T>(groups?: T[][]) => {
  return deepClone(groups || []);
};

const createEmptySourceTable = (): SourceTable[] => [];

const createEmptyTargetFilterRule = (logic: LogicalOperator = LogicalOperator.AND) => ({
  logic,
  conditions: [],
});

const createDefaultTargetFields = () => [{
  fieldUID: null,
  type: TargetFieldFillType.EMPTY,
  value: null,
}];

const createPrimarySourceTable = (context: CopyProcessContext, targetTableUID?: string) => {
  const targetTable = getTargetTableContext(context, targetTableUID)?.table;
  if (!targetTable?.meta?.extra?.primaryTable) {
    return null;
  }
  const primaryUID = targetTable.meta.extra.primaryTable?.[1];
  const primaryTable = getTargetTableContext(context, primaryUID)?.table;
  return {
    uid: unique(),
    name: primaryTable?.alias || targetTable.alias,
    tableUID: primaryTable?.uid,
    filterRule: {
      logic: LogicalOperator.AND,
      conditions: [],
    },
  };
};

const isCurrentTableUID = (context: CopyProcessContext, tableUID?: string | null) => {
  return tableUID === context.currentTable.uid;
};

const isCurrentSubTableUID = (subTableUIDSet: Set<string>, tableUID?: string | null) => {
  return !!tableUID && subTableUIDSet.has(tableUID);
};

const clearNodeOwnerCurrentTableBinding = (
  owner: Record<string, unknown> | undefined,
  currentFieldUIDSet: Set<string>,
  targetEditableFieldUIDSet: Set<string>,
) => {
  if (!owner) {
    return;
  }

  const memberFieldUIDs = owner[ProcessNodeOwnerType.FORM_MEMBER];
  if (Array.isArray(memberFieldUIDs)) {
    const nextFieldUIDs = memberFieldUIDs.filter(uid => {
      return !currentFieldUIDSet.has(uid) && targetEditableFieldUIDSet.has(uid);
    });
    if (nextFieldUIDs.length) {
      owner[ProcessNodeOwnerType.FORM_MEMBER] = nextFieldUIDs;
    } else {
      delete owner[ProcessNodeOwnerType.FORM_MEMBER];
    }
  }

  const departmentField = owner[ProcessNodeOwnerType.FORM_DEPARTMENT] as NodeOwnerDepartmentField | undefined;
  if (departmentField?.value && (currentFieldUIDSet.has(departmentField.value) || !targetEditableFieldUIDSet.has(departmentField.value))) {
    delete owner[ProcessNodeOwnerType.FORM_DEPARTMENT];
  }
};

const sanitizeFieldAuth = (
  fieldAuth: unknown,
  currentFieldUIDSet: Set<string>,
  targetEditableFieldUIDSet: Set<string>,
) => {
  if (!fieldAuth || fieldAuth === 'all' || typeof fieldAuth !== 'object') {
    return fieldAuth as 'all' | Record<string, FieldAuthValue> | undefined;
  }
  const nextFieldAuth = Object.fromEntries(
    Object.entries(fieldAuth as Record<string, unknown>).filter(([fieldUID]) => {
      return !currentFieldUIDSet.has(fieldUID) && targetEditableFieldUIDSet.has(fieldUID);
    }),
  ) as Record<string, FieldAuthValue>;
  return nextFieldAuth;
};

const sanitizeConditionValue = (
  condition: ConditionBranchCondition,
  currentFieldUIDSet: Set<string>,
  sourceTableMap: Map<string, SourceTableContext>,
) => {
  if (condition.type === FormConditionValueType.NODE) {
    return;
  }
  if (condition.type === FormConditionValueType.FORM) {
    if (typeof condition.uid === 'string' && currentFieldUIDSet.has(condition.uid)) {
      condition.value = null;
      return;
    }
  }
  if (condition.type === FormConditionValueType.FILTER_ROW) {
    if (typeof condition.uid === 'string') {
      const sourceContext = sourceTableMap.get(condition.uid);
      if (!sourceContext) {
        condition.value = null;
      }
    }
  }
};

const sanitizeFormulaValue = (
  value: unknown,
  currentTableUIDSet: Set<string>,
  currentFieldUIDSet: Set<string>,
): FormulaValue | null | undefined => {
  if (!value) {
    return undefined;
  }
  if (!isFormulaValue(value)) {
    return null;
  }
  const detailed = getFormulaDetailed(value);
  const formulaText = getFormulaStr(value);
  const matches = formulaText.match(/<([^>]+)>/g) || [];
  const hasCurrentTableReference = matches.some(match => {
    const ids = match.slice(1, -1).split(',');
    const [uidPart] = ids;
    const [tableUID, fieldUID, subFieldUID] = uidPart?.split('.') || [];
    if (!tableUID) {
      return false;
    }
    if (currentTableUIDSet.has(tableUID)) {
      return true;
    }
    if (!fieldUID) {
      return false;
    }
    const targetFieldUID = subFieldUID ? `${fieldUID}.${subFieldUID}` : fieldUID;
    return currentFieldUIDSet.has(targetFieldUID);
  });
  if (hasCurrentTableReference) {
    return null;
  }
  if (Object.keys(detailed.filterRules || {}).length > 0) {
    return null;
  }
  return value;
};

const sanitizeTargetFields = (
  targetFields: TargetFieldFillRule[] | undefined,
  currentTableUIDSet: Set<string>,
  currentFieldUIDSet: Set<string>,
  sourceTableMap: Map<string, SourceTableContext>,
  allowedTargetFieldUIDSet: Set<string>,
  currentTableUID: string,
  targetTableUID?: string | null,
) => {
  return (targetFields || []).map(field => {
    const nextField = deepClone(field);
    if (!nextField.fieldUID || !allowedTargetFieldUIDSet.has(nextField.fieldUID)) {
      nextField.fieldUID = null;
      nextField.type = TargetFieldFillType.EMPTY;
      nextField.value = null;
      return nextField;
    }

    if (nextField.type === TargetFieldFillType.FIELD) {
      if (nextField.value === FLOW_DATA_OWNER_SOURCE_SUBMITTER) {
        return nextField;
      }
      const [sourceUID, fieldUID] = String(nextField.value || '').split('.');
      if (!sourceUID || !fieldUID) {
        nextField.value = null;
        return nextField;
      }
      if (sourceUID === currentTableUID || currentFieldUIDSet.has(fieldUID)) {
        nextField.value = null;
        return nextField;
      }
      if (sourceUID === PROCESS_TARGET_SOURCE_UID || sourceUID === targetTableUID) {
        return nextField;
      }
      const sourceTable = sourceTableMap.get(sourceUID);
      if (!sourceTable) {
        nextField.value = null;
        return nextField;
      }
      if (currentTableUIDSet.has(sourceTable.tableUID || '') || currentFieldUIDSet.has(fieldUID)) {
        nextField.value = null;
      }
      return nextField;
    }

    if (nextField.type === TargetFieldFillType.FORMULA) {
      nextField.value = sanitizeFormulaValue(nextField.value, currentTableUIDSet, currentFieldUIDSet);
      if (!nextField.value) {
        nextField.type = TargetFieldFillType.EMPTY;
      }
      return nextField;
    }

    if (nextField.type === TargetFieldFillType.AUTO_RELATED) {
      nextField.type = TargetFieldFillType.EMPTY;
      nextField.value = null;
      return nextField;
    }

    return nextField;
  });
};

const sanitizeSourceTables = (
  sourceTables: SourceTable[] | undefined,
  context: CopyProcessContext,
  currentTableUIDSet: Set<string>,
) => {
  const currentFieldUIDSet = getTableFieldUIDSet(context.currentTable);
  return (sourceTables || []).reduce((result, sourceTable) => {
    const tableUID = sourceTable?.tableUID;
    if (!tableUID || currentTableUIDSet.has(tableUID)) {
      return result;
    }
    const targetTable = getTargetTableContext(context, tableUID)?.table;
    if (!targetTable) {
      return result;
    }
    const nextSourceTable = deepClone(sourceTable);
    nextSourceTable.filterRule = sanitizeTargetTableFilterRule(
      nextSourceTable.filterRule,
      currentTableUIDSet,
      currentFieldUIDSet,
    );
    result.push(nextSourceTable);
    return result;
  }, [] as SourceTable[]);
};

const createSourceTableMap = (sourceTables: SourceTable[] = []) => {
  return new Map(
    sourceTables.map(item => [item.uid, { uid: item.uid, tableUID: item.tableUID }] as const),
  );
};

const resetConditionReference = (condition: ConditionBranchCondition) => {
  condition.uid = undefined;
  condition.func = undefined;
  condition.value = null;
  delete condition.subformMatchMode;
};

const sanitizeConditionGroups = (
  groups: ConditionBranchConditionGroup[] | undefined,
  currentTableUIDSet: Set<string>,
  currentFieldUIDSet: Set<string>,
  sourceTableMap: Map<string, SourceTableContext>,
) => {
  return (groups || []).map(group => {
    return (group || []).map(condition => {
      const nextCondition = deepClone(condition);
      if (nextCondition.type === FormConditionValueType.FORM && typeof nextCondition.uid === 'string') {
        if (currentTableUIDSet.has(nextCondition.uid.split('.')[0] || '') || currentFieldUIDSet.has(nextCondition.uid)) {
          resetConditionReference(nextCondition);
        } else if (nextCondition.value != null) {
          sanitizeConditionValue(nextCondition, currentFieldUIDSet, sourceTableMap);
        }
      } else if (nextCondition.type === FormConditionValueType.FILTER_ROW) {
        if (!sourceTableMap.has(String(nextCondition.uid || ''))) {
          resetConditionReference(nextCondition);
        }
      } else if (nextCondition.type === FormConditionValueType.FORMULA) {
        nextCondition.formula = getSanitizedFormulaText(nextCondition.formula, currentTableUIDSet, currentFieldUIDSet);
        if (!nextCondition.formula) {
          nextCondition.func = undefined;
          nextCondition.value = null;
        }
      }
      return nextCondition;
    });
  });
};

const sanitizeTargetTableFilterRule = (
  filterRule: unknown,
  currentTableUIDSet: Set<string>,
  currentFieldUIDSet: Set<string>,
) => {
  const nextFilterRule = deepClone(
    (filterRule && typeof filterRule === 'object' && 'logic' in (filterRule as Record<string, unknown>) && 'conditions' in (filterRule as Record<string, unknown>))
      ? filterRule
      : createEmptyTargetFilterRule(),
  ) as FilterRule;
  (nextFilterRule?.conditions || []).forEach((condition: FormCondition) => {
    if (condition.type === FormConditionValueType.FORM && typeof condition.value === 'string') {
      const valueParts = condition.value.split('.');
      const [tableUID, fieldUID, subFieldUID] = valueParts;
      const valueFieldUID = subFieldUID ? `${fieldUID}.${subFieldUID}` : fieldUID;
      const isCurrentFieldOnlyValue = valueParts.length === 1 && currentFieldUIDSet.has(condition.value);
      if (isCurrentFieldOnlyValue || currentTableUIDSet.has(tableUID) || currentFieldUIDSet.has(valueFieldUID)) {
        condition.value = null;
      }
    } else if (condition.type === FormConditionValueType.FORMULA) {
      condition.formula = getSanitizedFormulaText(condition.formula, currentTableUIDSet, currentFieldUIDSet);
      if (!condition.formula) {
        condition.value = null;
      }
    }
  });
  return nextFilterRule;
};

const sanitizeDataNodeOptions = (
  flow: ProcessFlow,
  context: CopyProcessContext,
  currentTableUIDSet: Set<string>,
  currentFieldUIDSet: Set<string>,
  allowedTargetFieldUIDSet: Set<string>,
) => {
  const options = flow.options || {};
  const originalTargetTableUID = options.targetTableUID;
  const targetSource = getTargetTableContext(context, originalTargetTableUID);
  const canKeepTargetTable = !!targetSource?.table;
  const isCurrentTarget = isCurrentTableUID(context, originalTargetTableUID) || isCurrentSubTableUID(getCurrentAndTargetSubTableUIDs(context.currentTable), originalTargetTableUID);

  if (!canKeepTargetTable) {
    options.targetTableUID = null;
    options.sourceTables = createEmptySourceTable();
    options.primarySourceTable = null;
    options.targetFields = createDefaultTargetFields();
    if (options.batchNumber?.type === TargetFieldFillType.FIELD) {
      options.batchNumber.value = null;
    }
    if ('targetTableFilterRule' in options) {
      options.targetTableFilterRule = createEmptyTargetFilterRule(options.targetTableFilterRule?.logic || LogicalOperator.AND);
    }
    if ('batchFields' in options) {
      options.batchFields = [];
    }
    return;
  }

  const sourceTables = sanitizeSourceTables(options.sourceTables, context, currentTableUIDSet);
  const sourceTableMap = createSourceTableMap(sourceTables);

  options.sourceTables = sourceTables;
  options.targetTableUID = originalTargetTableUID;
  options.primarySourceTable = options.primarySourceTable?.tableUID && !currentTableUIDSet.has(options.primarySourceTable.tableUID)
    ? deepClone(options.primarySourceTable)
    : createPrimarySourceTable(context, originalTargetTableUID);
  if (options.primarySourceTable) {
    options.primarySourceTable.filterRule = sanitizeTargetTableFilterRule(
      options.primarySourceTable.filterRule,
      currentTableUIDSet,
      currentFieldUIDSet,
    );
  }

  if (isCurrentTarget) {
    options.targetTableUID = null;
    options.primarySourceTable = null;
    options.targetTableFilterRule = createEmptyTargetFilterRule(options.targetTableFilterRule?.logic || LogicalOperator.AND);
    options.targetFields = createDefaultTargetFields();
    if (options.batchNumber?.type === TargetFieldFillType.FIELD && typeof options.batchNumber?.value === 'string') {
      const [sourceUID, fieldUID] = String(options.batchNumber.value).split('.');
      if (!sourceUID || !fieldUID) {
        options.batchNumber.value = null;
      } else if (sourceUID === context.currentTable.uid || currentFieldUIDSet.has(fieldUID)) {
        options.batchNumber.value = null;
      } else if (sourceUID === PROCESS_TARGET_SOURCE_UID || sourceUID === originalTargetTableUID) {
        options.batchNumber.value = null;
      } else {
        const sourceTable = sourceTableMap.get(sourceUID);
        if (!sourceTable || currentTableUIDSet.has(sourceTable.tableUID || '') || currentFieldUIDSet.has(fieldUID)) {
          options.batchNumber.value = null;
        }
      }
    }
    if ('batchFields' in options) {
      options.batchFields = [];
    }
    if ('targetTableDataScope' in options) {
      options.targetTableDataScope = EditDataTargetScope.HISTORY;
    }
    return;
  }

  if ('targetTableFilterRule' in options) {
    options.targetTableFilterRule = sanitizeTargetTableFilterRule(options.targetTableFilterRule, currentTableUIDSet, currentFieldUIDSet);
  }
  if ('targetTableDataScope' in options && options.targetTableUID === context.currentTable.uid) {
    options.targetTableDataScope = EditDataTargetScope.HISTORY;
  }
  options.targetFields = sanitizeTargetFields(
    options.targetFields,
    currentTableUIDSet,
    currentFieldUIDSet,
    sourceTableMap,
    allowedTargetFieldUIDSet,
    context.currentTable.uid,
    options.targetTableUID,
  );
  if ('batchFields' in options) {
    options.batchFields = sanitizeTargetFields(
      options.batchFields,
      currentTableUIDSet,
      currentFieldUIDSet,
      sourceTableMap,
      allowedTargetFieldUIDSet,
      context.currentTable.uid,
      options.targetTableUID,
    ).filter(field => field.fieldUID);
  }
  if (options.batchNumber?.type === TargetFieldFillType.FIELD && typeof options.batchNumber?.value === 'string') {
    const [sourceUID, fieldUID] = String(options.batchNumber.value).split('.');
    if (sourceUID === context.currentTable.uid || currentFieldUIDSet.has(fieldUID)) {
      options.batchNumber.value = null;
      return;
    }
    if (sourceUID === PROCESS_TARGET_SOURCE_UID || sourceUID === options.targetTableUID) {
      return;
    }
    const sourceTable = sourceTableMap.get(sourceUID);
    if (!sourceTable || currentTableUIDSet.has(sourceTable.tableUID || '') || currentFieldUIDSet.has(fieldUID)) {
      options.batchNumber.value = null;
    }
  }
};

const sanitizeReportDataOptions = (
  flow: ProcessFlow,
  context: CopyProcessContext,
  currentTableUIDSet: Set<string>,
  currentFieldUIDSet: Set<string>,
  targetEditableFieldUIDSet: Set<string>,
) => {
  const options = flow.options || {};
  const targetTableUID = options.targetTableUID;
  const canKeepTargetTable = !!getTargetTableContext(context, targetTableUID)?.table;
  const isCurrentTarget = isCurrentTableUID(context, targetTableUID) || isCurrentSubTableUID(getCurrentAndTargetSubTableUIDs(context.currentTable), targetTableUID);

  if (!canKeepTargetTable || isCurrentTarget) {
    options.targetTableUID = null;
  }

  clearNodeOwnerCurrentTableBinding(options.reporter, currentFieldUIDSet, targetEditableFieldUIDSet);

  if (options.finishCondition) {
    const finishSourceTables = sanitizeSourceTables(options.finishCondition.sourceTables, context, currentTableUIDSet);
    const sourceTableMap = createSourceTableMap(finishSourceTables);
    options.finishCondition.sourceTables = finishSourceTables;
    options.finishCondition.conditions = sanitizeConditionGroups(
      options.finishCondition.conditions,
      currentTableUIDSet,
      currentFieldUIDSet,
      sourceTableMap,
    );
  }
};

const sanitizeApprovalLikeNodeOptions = (
  flow: ProcessFlow,
  ownerKey: 'approver' | 'transactor' | 'notifier',
  currentFieldUIDSet: Set<string>,
  targetEditableFieldUIDSet: Set<string>,
) => {
  const options = flow.options || {};
  clearNodeOwnerCurrentTableBinding(options[ownerKey], currentFieldUIDSet, targetEditableFieldUIDSet);
};

const sanitizeTriggerConditionNodeOptions = (
  flow: ProcessFlow,
  context: CopyProcessContext,
  currentTableUIDSet: Set<string>,
  currentFieldUIDSet: Set<string>,
) => {
  const options = flow.options || {};
  const sourceTables = sanitizeSourceTables(options.sourceTables, context, currentTableUIDSet);
  const sourceTableMap = createSourceTableMap(sourceTables);
  options.sourceTables = sourceTables;
  options.conditions = sanitizeConditionGroups(
    cloneConditionGroup(options.conditions),
    currentTableUIDSet,
    currentFieldUIDSet,
    sourceTableMap,
  );
};

const sanitizeFlow = (
  flow: ProcessFlow,
  context: CopyProcessContext,
  currentTableUIDSet: Set<string>,
  currentFieldUIDSet: Set<string>,
  targetEditableFieldUIDSet: Set<string>,
  allowedTargetFieldUIDSet: Set<string>,
) => {
  const nextFlow = deepClone(flow);
  nextFlow.uid = unique();
  if (nextFlow.options) {
    nextFlow.options.fieldAuth = sanitizeFieldAuth(nextFlow.options.fieldAuth, currentFieldUIDSet, targetEditableFieldUIDSet);
  }

  switch (nextFlow.type) {
  case ProcessNodeType.TRIGGER_DATA_CHANGE:
  case ProcessNodeType.TRIGGER_TIME_TASK:
  case ProcessNodeType.CONDITION_BRANCH:
    sanitizeTriggerConditionNodeOptions(nextFlow, context, currentTableUIDSet, currentFieldUIDSet);
    break;
  case ProcessNodeType.APPROVAL:
    sanitizeApprovalLikeNodeOptions(nextFlow, 'approver', currentFieldUIDSet, targetEditableFieldUIDSet);
    break;
  case ProcessNodeType.TRANSACT:
    sanitizeApprovalLikeNodeOptions(nextFlow, 'transactor', currentFieldUIDSet, targetEditableFieldUIDSet);
    if (nextFlow.options?.finishCondition) {
      const finishSourceTables = sanitizeSourceTables(nextFlow.options.finishCondition.sourceTables, context, currentTableUIDSet);
      const sourceTableMap = createSourceTableMap(finishSourceTables);
      nextFlow.options.finishCondition.sourceTables = finishSourceTables;
      nextFlow.options.finishCondition.conditions = sanitizeConditionGroups(
        nextFlow.options.finishCondition.conditions,
        currentTableUIDSet,
        currentFieldUIDSet,
        sourceTableMap,
      );
    }
    break;
  case ProcessNodeType.NOTIFY:
    sanitizeApprovalLikeNodeOptions(nextFlow, 'notifier', currentFieldUIDSet, targetEditableFieldUIDSet);
    break;
  case ProcessNodeType.REPORT_DATA:
    sanitizeReportDataOptions(nextFlow, context, currentTableUIDSet, currentFieldUIDSet, targetEditableFieldUIDSet);
    break;
  case ProcessNodeType.ADD_DATA:
  case ProcessNodeType.EDIT_DATA:
  case ProcessNodeType.DELETE_DATA:
    sanitizeDataNodeOptions(nextFlow, context, currentTableUIDSet, currentFieldUIDSet, allowedTargetFieldUIDSet);
    break;
  default:
    break;
  }

  if (Array.isArray(nextFlow.branches)) {
    nextFlow.branches = nextFlow.branches.map(branch => {
      return {
        ...branch,
        uid: unique(),
        flows: (branch.flows || []).map(item => sanitizeFlow(
          item,
          context,
          currentTableUIDSet,
          currentFieldUIDSet,
          targetEditableFieldUIDSet,
          allowedTargetFieldUIDSet,
        )),
      };
    });
  }

  return nextFlow;
};

export const copyProcessVersionToForm = (
  sourceFlows: ProcessFlow[],
  targetProcess: NocodeProcess | undefined,
  context: CopyProcessContext,
) => {
  const currentSubTableUIDSet = getCurrentAndTargetSubTableUIDs(context.currentTable);
  const currentTableUIDSet = new Set<string>([context.currentTable.uid, ...currentSubTableUIDSet]);
  const currentFieldUIDSet = getTableFieldUIDSet(context.currentTable);
  const targetEditableFieldUIDSet = getTargetTableEditableFieldUIDSet(context.targetTable, context.targetFormOption);
  const allowedTargetFieldUIDSet = getTableFieldUIDSet(context.targetTable);

  const copiedFlows = (sourceFlows || []).map(flow => {
    return sanitizeFlow(
      flow,
      context,
      currentTableUIDSet,
      currentFieldUIDSet,
      targetEditableFieldUIDSet,
      allowedTargetFieldUIDSet,
    );
  });

  const nextProcess: NocodeProcess = deepClone(targetProcess || {
    enabled: false,
    flowsByVersion: {},
    versionStatusByVersion: {},
    version: 1,
  });
  const nextVersion = getMaxProcessVersion(nextProcess) + 1 || 1;
  nextProcess.flowsByVersion = nextProcess.flowsByVersion || {};
  nextProcess.versionStatusByVersion = nextProcess.versionStatusByVersion || {};
  nextProcess.flowsByVersion[getProcessVersionKey(nextVersion)] = copiedFlows;
  nextProcess.versionStatusByVersion[getProcessVersionKey(nextVersion)] = ProcessVersionStatus.DESIGNING;
  if (!nextProcess.version) {
    nextProcess.version = nextVersion;
  }
  return {
    process: nextProcess,
    version: nextVersion,
  };
};

export const getCopyableTargetForms = (
  nocodeBody: NocodeLikeBody & Partial<Pick<NocodeBody, 'structure' | 'snapshot'>>,
  currentTableUID: string,
  nocodeId?: string,
  nocodeName?: string,
) => {
  return (nocodeBody?.formData?.tables || [])
    .filter(table => !table.meta?.extra?.primaryTable && table.uid !== currentTableUID)
    .map(table => ({
      id: `${nocodeId || 'current'}:${table.uid}`,
      name: table.alias || table.uid,
      table,
      nocodeId,
      nocodeName,
      isCrossApp: false,
      nocodeStructure: nocodeBody?.structure,
      nocodeSnapshot: nocodeBody?.snapshot,
    }));
};

export const getTargetTableByUID = (
  nocodeBody: NocodeLikeBody | undefined,
  tableUID?: string | null,
) => {
  if (!tableUID) {
    return undefined;
  }
  return (nocodeBody?.formData?.tables || []).find(table => table.uid === tableUID);
};

export const buildCrossAppTargetForms = (
  nocodes: Array<{
    meta?: { id?: string, name?: string },
    body?: NocodeLikeBody & Partial<Pick<NocodeBody, 'structure' | 'snapshot'>>,
  }>,
  currentNocodeId?: string,
) => {
  return nocodes.flatMap(item => {
    if (!item?.meta?.id || item.meta.id === currentNocodeId || !item.body?.formData) {
      return [];
    }

    return (item.body.formData.tables || [])
      .filter(table => !table.meta?.extra?.primaryTable)
      .map(table => ({
        id: `${item.meta?.id}:${table.uid}`,
        name: table.alias || table.uid,
        table,
        nocodeId: item.meta?.id,
        nocodeName: item.meta?.name,
        isCrossApp: true,
        nocodeStructure: item.body?.structure,
        nocodeSnapshot: item.body?.snapshot,
      }));
  });
};
