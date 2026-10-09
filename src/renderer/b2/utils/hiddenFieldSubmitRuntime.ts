import { FormWidgetType, ViewActionFieldId } from "@common/types/nocode";
import { Field, Row } from "@common/types/project";
import { getHiddenFieldSubmitMode, HiddenFieldSubmitMode } from "@common/utils/hiddenFieldSubmitPolicy";
import { isBuiltinField, SystemField } from "@common/utils/connection";
import { equals } from "@common/utils/object";

export type HiddenFieldSubmitRuntimeFormInput = {
  uid?: string;
  fieldId?: string;
  inputValue?: any;
  isHidden?: boolean;
  isUnique?: boolean;
  type?: string;
  field?: Field;
  clearValue?: () => any;
  getOption?: (path: string) => unknown;
  allUserList?: HiddenOrganizeUser[];
};

export type HiddenFieldSubmitContext = {
  isBusinessHidden: boolean;
  isPermissionHidden?: boolean;
  mode: HiddenFieldSubmitMode;
  hasSnapshot?: boolean;
  snapshotValue?: unknown;
};

type HiddenOrganizeUser = {
  id?: string;
  departments?: string[];
};

export type RecalculateHiddenFieldOptions = {
  formInput: HiddenFieldSubmitRuntimeFormInput;
  fieldId: string;
  baseRow: Row;
  visibleRow: Row;
  currentRow: Row;
};

export type HiddenFieldSubmitRuntimeInput = {
  formInputs: HiddenFieldSubmitRuntimeFormInput[];
  visibleRow: Row;
  workingRow?: Row;
  currentRow?: Row | null;
  formOptions?: Record<string, unknown> | null;
  isAddingRow: boolean;
  submitFieldIds?: ViewActionFieldId[];
  hiddenFieldContexts?: Record<string, HiddenFieldSubmitContext>;
  recalculateHiddenField?: (options: RecalculateHiddenFieldOptions) => Promise<any> | any;
  stabilizeSubmitRow?: (options: StabilizeHiddenFieldSubmitRowOptions) => Promise<StabilizeHiddenFieldSubmitRowResult | void> | StabilizeHiddenFieldSubmitRowResult | void;
};

export type StabilizeHiddenFieldSubmitRowOptions = {
  row: Row;
  triggerFieldIds: string[];
  lockedFieldIds: string[];
  recalculableHiddenFieldIds: string[];
  permissionHiddenFieldIds: string[];
};

export type StabilizeHiddenFieldSubmitRowResult = {
  row?: Row;
  affectedFieldIds?: string[];
};

export type HiddenFieldSubmitRuntimeResult = {
  row: Row;
  submitFieldIds: ViewActionFieldId[];
  affectedFieldIds: string[];
};

export type ResolveHiddenOrganizeAutoFillSubmitValueOptions = {
  formInput: HiddenFieldSubmitRuntimeFormInput;
  loadUsers?: () => Promise<HiddenOrganizeUser[]> | HiddenOrganizeUser[];
};

export type HiddenOrganizeAutoFillSubmitValueResult = {
  matched: boolean;
  value: unknown;
};

const ARRAY_EMPTY_WIDGET_TYPES = new Set<string>([
  FormWidgetType.SUBFORM,
  FormWidgetType.DATE_RANGE_PICKER,
  FormWidgetType.CHECKBOX_GROUP,
  FormWidgetType.TREE_MULTIPLE_SELECT,
  FormWidgetType.TAG_INPUT,
  FormWidgetType.MEMBER_SELECT,
  FormWidgetType.DEPARTMENT_SELECT,
]);

const hasOwn = (row: Row | null | undefined, key: string) => {
  return Object.prototype.hasOwnProperty.call(row || {}, key);
};

const cloneValue = <T = any>(value: T): T => {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item)) as T;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  return Object.entries(value as Record<string, any>).reduce<Record<string, any>>((prev, [key, item]) => {
    prev[key] = cloneValue(item);
    return prev;
  }, {}) as T;
};

const cloneRow = (row: Row = {}) => {
  return cloneValue(row || {}) as Row;
};

const getFieldWidgetType = (formInput: HiddenFieldSubmitRuntimeFormInput) => {
  return formInput.field?.meta?.extra?.widgetType || formInput.type;
};

export const resolveHiddenOrganizeAutoFillSubmitValue = async ({
  formInput,
  loadUsers,
}: ResolveHiddenOrganizeAutoFillSubmitValueOptions): Promise<HiddenOrganizeAutoFillSubmitValueResult> => {
  const widgetType = getFieldWidgetType(formInput);
  const isOrganizeWidget = widgetType === FormWidgetType.MEMBER_SELECT
    || widgetType === FormWidgetType.DEPARTMENT_SELECT;
  if (
    !isOrganizeWidget
    || formInput.getOption?.("auto-fill") !== "fill"
    || !formInput.getOption?.("fill-field")
  ) {
    return {
      matched: false,
      value: undefined,
    };
  }

  if (
    widgetType === FormWidgetType.DEPARTMENT_SELECT
    && !formInput.allUserList?.length
    && loadUsers
  ) {
    formInput.allUserList = cloneValue(await loadUsers());
  }

  return {
    matched: true,
    value: cloneValue(formInput.inputValue),
  };
};

const shouldSkipHiddenFieldSubmitPolicy = (formInput: HiddenFieldSubmitRuntimeFormInput) => {
  const field = formInput.field;
  if (field && isBuiltinField(field)) {
    return true;
  }
  return getFieldWidgetType(formInput) === FormWidgetType.SERIAL_NUMBER;
};

const isArrayEmptyValueField = (formInput: HiddenFieldSubmitRuntimeFormInput) => {
  const field = formInput.field;
  const widgetType = getFieldWidgetType(formInput);
  const extra = field?.meta?.extra || {};
  return ARRAY_EMPTY_WIDGET_TYPES.has(widgetType)
    || field?.meta?.subType === "subForm"
    || field?.type === "array"
    || extra.relatedDataMode === "multiple"
    || extra.dataMode === "multiple"
    || ((widgetType === FormWidgetType.FILE_UPLOADER || widgetType === FormWidgetType.IMAGE_UPLOADER) && extra.isMultiple)
    || ((widgetType === FormWidgetType.RELATED_DATA || widgetType === FormWidgetType.SELECT_DATA) && extra.isMultiple)
    || Array.isArray(formInput.inputValue);
};

const resolveEmptyValue = (formInput: HiddenFieldSubmitRuntimeFormInput) => {
  if (isArrayEmptyValueField(formInput)) {
    return [];
  }

  return null;
};

const appendUniqueFieldId = (fieldIds: ViewActionFieldId[], fieldId: string) => {
  if (!fieldId || fieldIds.includes(fieldId as ViewActionFieldId)) {
    return fieldIds;
  }
  return [...fieldIds, fieldId as ViewActionFieldId];
};

const isFieldAllowedBySubmitFieldIds = (fieldId: string, submitFieldIds: ViewActionFieldId[] = []) => {
  if (!submitFieldIds.length) {
    return true;
  }

  return submitFieldIds.some((submitFieldId) => String(submitFieldId || "").split(".")[0] === fieldId);
};

export const collectSubmitUniqueChecks = (
  formInputs: HiddenFieldSubmitRuntimeFormInput[] = [],
  row: Row = {},
  isUniqueFieldEmpty: (value: any) => boolean,
) => {
  return formInputs.reduce<Array<{ key: string; value: any }>>((prev, formInput) => {
    const fieldId = formInput?.fieldId;
    if (!fieldId || !formInput.isUnique || !Object.prototype.hasOwnProperty.call(row || {}, fieldId)) {
      return prev;
    }

    const value = row[fieldId];
    if (!isUniqueFieldEmpty(value)) {
      prev.push({ key: fieldId, value });
    }
    return prev;
  }, []);
};

export const applyHiddenFieldSubmitPolicy = async ({
  formInputs = [],
  visibleRow = {},
  workingRow = visibleRow,
  currentRow = {},
  formOptions = {},
  isAddingRow,
  submitFieldIds = [],
  hiddenFieldContexts = {},
  recalculateHiddenField,
  stabilizeSubmitRow,
}: HiddenFieldSubmitRuntimeInput): Promise<HiddenFieldSubmitRuntimeResult> => {
  const row = cloneRow(visibleRow || {});
  const safeWorkingRow = cloneRow(workingRow || {});
  const safeCurrentRow = (currentRow || {}) as Row;
  const baseRow = isAddingRow
    ? cloneRow(safeWorkingRow)
    : {
      ...cloneRow(safeCurrentRow),
      ...cloneRow(safeWorkingRow),
    };
  const hiddenInputs = formInputs.filter(formInput => {
    const fieldId = formInput?.fieldId;
    const context = fieldId ? hiddenFieldContexts[fieldId] : undefined;
    return formInput?.fieldId
      && (context ? context.isBusinessHidden && !context.isPermissionHidden : formInput.isHidden)
      && isFieldAllowedBySubmitFieldIds(formInput.fieldId, submitFieldIds)
      && !shouldSkipHiddenFieldSubmitPolicy(formInput);
  });
  const hiddenInputModes = new Map<string, HiddenFieldSubmitMode>();
  const hiddenFinalValues = new Map<string, unknown>();
  const dependencyTriggerFieldIds: string[] = [];
  const lockedFieldIds: string[] = [];
  const recalculableHiddenFieldIds: string[] = [];
  const affectedFieldIds: string[] = [];
  let effectiveSubmitFieldIds = Array.from(new Set((submitFieldIds || []).filter(Boolean)));

  const markAffected = (fieldId: string, value: any, force = false) => {
    if (!force && !isAddingRow && equals(safeCurrentRow?.[fieldId], value)) {
      return;
    }
    if (!affectedFieldIds.includes(fieldId)) {
      affectedFieldIds.push(fieldId);
    }
    if (submitFieldIds.length > 0) {
      effectiveSubmitFieldIds = appendUniqueFieldId(effectiveSubmitFieldIds, fieldId);
    }
  };

  for (const formInput of hiddenInputs) {
    const fieldId = formInput.fieldId as string;
    const context = hiddenFieldContexts[fieldId];
    const mode = context?.mode ?? getHiddenFieldSubmitMode(formOptions, fieldId);
    hiddenInputModes.set(fieldId, mode);
    const workingValue = hasOwn(baseRow, fieldId)
      ? cloneValue(baseRow[fieldId])
      : cloneValue(formInput.inputValue);
    let nextValue = workingValue;

    // 第一阶段只确定隐藏字段终值；所有修改都落在提交副本，不回写页面工作值。
    if (mode === HiddenFieldSubmitMode.KEEP_ORIGINAL) {
      nextValue = context?.hasSnapshot ? cloneValue(context.snapshotValue) : workingValue;
      lockedFieldIds.push(fieldId);
    } else if (mode === HiddenFieldSubmitMode.EMPTY) {
      nextValue = resolveEmptyValue(formInput);
      lockedFieldIds.push(fieldId);
    } else {
      recalculableHiddenFieldIds.push(fieldId);
    }

    baseRow[fieldId] = cloneValue(nextValue);
    row[fieldId] = cloneValue(nextValue);
    hiddenFinalValues.set(fieldId, cloneValue(nextValue));
    if (!equals(workingValue, nextValue)) {
      dependencyTriggerFieldIds.push(fieldId);
    }
    markAffected(fieldId, nextValue);
  }

  for (const formInput of hiddenInputs) {
    const fieldId = formInput.fieldId as string;
    if (hiddenInputModes.get(fieldId) !== HiddenFieldSubmitMode.RECALCULATE) {
      continue;
    }

    const recalculatedValue = await recalculateHiddenField?.({
      formInput,
      fieldId,
      baseRow,
      visibleRow,
      currentRow: safeCurrentRow,
    });
    const nextValue = recalculatedValue === undefined
      ? cloneValue(baseRow[fieldId])
      : recalculatedValue;
    if (!equals(baseRow[fieldId], nextValue) && !dependencyTriggerFieldIds.includes(fieldId)) {
      dependencyTriggerFieldIds.push(fieldId);
    }
    baseRow[fieldId] = cloneValue(nextValue);
    row[fieldId] = cloneValue(nextValue);
    hiddenFinalValues.set(fieldId, cloneValue(nextValue));
    markAffected(fieldId, nextValue, true);
  }

  // 第二阶段基于隐藏终值重放联动计算，锁定字段会在重放后再次覆盖，避免被填回。
  const stabilized = await stabilizeSubmitRow?.({
    row: cloneRow(baseRow),
    triggerFieldIds: [...new Set(dependencyTriggerFieldIds)],
    lockedFieldIds: [...new Set(lockedFieldIds)],
    recalculableHiddenFieldIds: [...new Set(recalculableHiddenFieldIds)],
    permissionHiddenFieldIds: Object.entries(hiddenFieldContexts)
      .filter(([, context]) => context.isPermissionHidden)
      .map(([fieldId]) => fieldId),
  });
  const stabilizedResult = (stabilized || {}) as StabilizeHiddenFieldSubmitRowResult;
  const stabilizedRow = stabilizedResult.row || baseRow;
  for (const fieldId of lockedFieldIds) {
    stabilizedRow[fieldId] = cloneValue(hiddenFinalValues.get(fieldId));
  }
  for (const fieldId of stabilizedResult.affectedFieldIds || []) {
    if (!fieldId || lockedFieldIds.includes(fieldId)) {
      continue;
    }
    row[fieldId] = cloneValue(stabilizedRow[fieldId]);
    markAffected(fieldId, stabilizedRow[fieldId], true);
  }

  if (isAddingRow) {
    delete row[SystemField.UUID];
  }

  return {
    row,
    submitFieldIds: submitFieldIds.length > 0 ? effectiveSubmitFieldIds : [],
    affectedFieldIds,
  };
};
