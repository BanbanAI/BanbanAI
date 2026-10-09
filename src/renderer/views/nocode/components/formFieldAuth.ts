import { FieldAuthValue, FormTableRuntime, NocodeFormData, ViewActionFieldId } from "@common/types/nocode";
import { getEnabledProcessVersion, getFlowById, getFlows, getFormElementsInfo } from "@common/utils";
import { DataChangeType, Field, ProcessFlow, ProcessNodeType, Table, TableUID } from "@common/types/project";
import { WidgetSoul } from "@common/types/project";
import { deepClone } from "@common/utils/object";

type FormFieldAuth = "all" | Record<string, FieldAuthValue | number> | undefined;
type FormRequiredAuth = Record<string, boolean> | undefined;

type BuildMergedFormFieldsAuthOptions = {
  runtime?: FormTableRuntime;
  formData?: NocodeFormData;
  table?: Table;
  widget?: WidgetSoul;
  flowId?: string;
  isViewing?: boolean;
  uuid?: string;
  memberFieldAuth?: FormFieldAuth;
  flowFieldAuthOverride?: FormFieldAuth;
  disableTriggerDataChangeFallback?: boolean;
}

type BuildMergedFormRequiredAuthOptions = Omit<BuildMergedFormFieldsAuthOptions, "memberFieldAuth" | "flowFieldAuthOverride"> & {
  flowRequiredAuthOverride?: FormRequiredAuth;
};

const resolveFieldAuthValue = (value: unknown, defaultValue = 0) => {
  if (value === FieldAuthValue.VISIBLE_EDITABLE) return FieldAuthValue.VISIBLE_EDITABLE;
  if (value === FieldAuthValue.VISIBLE) return FieldAuthValue.VISIBLE;
  return defaultValue;
}

const getExplicitFieldAuthValue = (
  auth: FormFieldAuth,
  elementUID: string,
  fieldUID?: string,
) => {
  if (!auth || auth === "all") return undefined;
  if (Object.prototype.hasOwnProperty.call(auth, elementUID)) {
    return resolveFieldAuthValue(auth[elementUID], 0);
  }
  if (fieldUID && Object.prototype.hasOwnProperty.call(auth, fieldUID)) {
    return resolveFieldAuthValue(auth[fieldUID], 0);
  }
  return undefined;
}

const isOpenFieldAuth = (auth: FormFieldAuth) => {
  return auth === "all" || auth === undefined;
}

const getFieldRequiredValue = (
  auth: FormRequiredAuth,
  elementUID: string,
  defaultWhenMissing: boolean,
  fieldUID?: string,
) => {
  if (!auth) return defaultWhenMissing;
  if (Object.prototype.hasOwnProperty.call(auth, elementUID)) {
    return !!auth[elementUID];
  }
  if (fieldUID && Object.prototype.hasOwnProperty.call(auth, fieldUID)) {
    return !!auth[fieldUID];
  }
  return defaultWhenMissing;
}

const getTableFieldByElementUID = (fields: Field[] = [], elementUID: string, formData?: NocodeFormData): Field | undefined => {
  for (const field of fields) {
    if (field.meta?.uid === elementUID) {
      return field;
    }

    const subTableUID = field.meta?.extra?.subTableUID?.[1];
    const subTable = subTableUID ? formData?.tables?.find(item => item.uid === subTableUID) : undefined;
    const subField = getTableFieldByElementUID(subTable?.fields || [], elementUID, formData);
    if (subField) {
      return subField;
    }
  }

  return undefined;
}

const getTriggerDataChangeFlow = (
  flows: ProcessFlow[] = [],
  fallbackChangeType: DataChangeType,
) => {
  const branches = flows[0]?.branches || [];
  const matchFlow = (predicate: (flow?: ProcessFlow | null) => boolean) => {
    const branch = branches.find(item => predicate(item.flows?.[0]));
    return branch?.flows?.[0] || null;
  };

  return matchFlow((flow) => (
    flow?.type === ProcessNodeType.TRIGGER_DATA_CHANGE
    && flow.options?.changeType?.includes(fallbackChangeType)
  )) || matchFlow((flow) => (
    flow?.type === ProcessNodeType.TRIGGER_DATA_CHANGE
    && (!Array.isArray(flow.options?.changeType) || flow.options.changeType.length <= 0)
  ));
}

const resolveProcessFlows = (
  formData?: NocodeFormData,
  table?: Table,
) => {
  const process = table ? formData?.formOptions?.[table.uid]?.process : undefined;
  const enabledVersion = getEnabledProcessVersion(process);
  return {
    flows: getFlows(process) || [],
    enabled: !!enabledVersion,
    enabledFlows: enabledVersion ? (getFlows(process, enabledVersion) || []) : [],
  };
}

const buildDefaultRequiredFieldMap = (widget?: WidgetSoul) => {
  const formElementsInfo = getFormElementsInfo(widget?.widgets || []);
  const widgetMap = new Map<string, WidgetSoul>();
  const visit = (widgets: WidgetSoul[] = []) => {
    widgets.forEach((currentWidget) => {
      if (currentWidget?.uid) {
        widgetMap.set(currentWidget.uid, currentWidget);
      }
      if (Array.isArray(currentWidget?.widgets) && currentWidget.widgets.length) {
        visit(currentWidget.widgets);
      }
    });
  };

  if (widget?.widgets?.length) {
    visit(widget.widgets);
  }

  return formElementsInfo.reduce<Record<string, boolean>>((prev, element) => {
    prev[element.uid] = !!widgetMap.get(element.uid)?.options?.required;
    return prev;
  }, {});
}

export const buildMergedFormFieldsAuth = ({
  runtime,
  formData,
  table,
  widget,
  flowId,
  isViewing,
  uuid,
  memberFieldAuth,
  flowFieldAuthOverride,
  disableTriggerDataChangeFallback,
}: BuildMergedFormFieldsAuthOptions) => {
  if (runtime === FormTableRuntime.FORM_EDITOR) return "all" as const;
  if (!table || !widget) return {};

  const { enabled, flows, enabledFlows } = resolveProcessFlows(formData, table);
  let currentFlow = flowId ? getFlowById(flows, flowId) : null;
  const shouldFallbackToTriggerDataChange = enabled && !disableTriggerDataChangeFallback && !(isViewing && !flowId && uuid);

  if (!currentFlow && shouldFallbackToTriggerDataChange) {
    const fallbackChangeType = uuid ? DataChangeType.EDIT : DataChangeType.ADD;
    currentFlow = getTriggerDataChangeFlow(enabledFlows, fallbackChangeType);
  }

  const flowFieldAuth = flowFieldAuthOverride ?? currentFlow?.options?.fieldAuth ?? "all";
  const buildSourceAuthMap = (
    auth: FormFieldAuth,
    defaultWhenOpen: FieldAuthValue,
  ) => {
    const sourceAuthMap: Record<string, FieldAuthValue> = {};
    const openByDefault = isOpenFieldAuth(auth);

    const resolveWidgetAuth = (currentWidget: WidgetSoul): FieldAuthValue => {
      const field = getTableFieldByElementUID(table.fields, currentWidget.uid, formData);
      const explicitAuthValue = getExplicitFieldAuthValue(auth, currentWidget.uid, field?.uid);
      const childAuthValues = (currentWidget.widgets || []).map(childWidget => resolveWidgetAuth(childWidget));
      let nextAuth: FieldAuthValue;
      if (explicitAuthValue !== undefined) {
        nextAuth = explicitAuthValue;
      } else if (openByDefault) {
        nextAuth = defaultWhenOpen;
      } else if (childAuthValues.length > 0) {
        nextAuth = childAuthValues.reduce((prev, value) => Math.max(prev, value), FieldAuthValue.HIDDEN) as FieldAuthValue;
      } else {
        nextAuth = FieldAuthValue.HIDDEN;
      }

      sourceAuthMap[currentWidget.uid] = nextAuth;
      return nextAuth;
    };

    for (const currentWidget of widget.widgets || []) {
      resolveWidgetAuth(currentWidget);
    }

    return sourceAuthMap;
  }

  const memberAuthMap = buildSourceAuthMap(memberFieldAuth, FieldAuthValue.VISIBLE_EDITABLE);
  const flowAuthMap = currentFlow?.type === ProcessNodeType.END
    ? buildSourceAuthMap("all", FieldAuthValue.VISIBLE)
    : buildSourceAuthMap(flowFieldAuth, FieldAuthValue.VISIBLE_EDITABLE);
  const widgetUIDs = new Set([...Object.keys(memberAuthMap), ...Object.keys(flowAuthMap)]);
  const mergedFieldsAuth: Record<string, FieldAuthValue> = {};

  widgetUIDs.forEach((widgetUID) => {
    mergedFieldsAuth[widgetUID] = Math.min(
      memberAuthMap[widgetUID] ?? FieldAuthValue.HIDDEN,
      flowAuthMap[widgetUID] ?? FieldAuthValue.HIDDEN,
    ) as FieldAuthValue;
  });

  return mergedFieldsAuth;
}

export const buildMergedFormRequiredAuth = ({
  runtime,
  formData,
  table,
  widget,
  flowId,
  isViewing,
  uuid,
  flowRequiredAuthOverride,
  disableTriggerDataChangeFallback,
}: BuildMergedFormRequiredAuthOptions) => {
  if (!table || !widget) return {};

  const defaultRequiredMap = buildDefaultRequiredFieldMap(widget);
  if (runtime === FormTableRuntime.FORM_EDITOR) {
    return defaultRequiredMap;
  }

  const { enabled, flows, enabledFlows } = resolveProcessFlows(formData, table);
  let currentFlow = flowId ? getFlowById(flows, flowId) : null;
  const shouldFallbackToTriggerDataChange = enabled && !disableTriggerDataChangeFallback && !(isViewing && !flowId && uuid);

  if (!currentFlow && shouldFallbackToTriggerDataChange) {
    const fallbackChangeType = uuid ? DataChangeType.EDIT : DataChangeType.ADD;
    currentFlow = getTriggerDataChangeFlow(enabledFlows, fallbackChangeType);
  }

  const flowRequiredAuth = flowRequiredAuthOverride ?? currentFlow?.options?.requiredFieldAuth;
  const formElementsInfo = getFormElementsInfo(widget.widgets || []);

  return formElementsInfo.reduce<Record<string, boolean>>((prev, element) => {
    const field = getTableFieldByElementUID(table.fields, element.uid, formData);
    const defaultRequired = !!defaultRequiredMap[element.uid];
    const flowRequired = getFieldRequiredValue(
      flowRequiredAuth,
      element.uid,
      defaultRequired,
      field?.uid,
    );
    prev[element.uid] = defaultRequired || flowRequired;
    return prev;
  }, {});
}

export const buildFormFieldElementUidMap = (
  formData: NocodeFormData | undefined,
  tableUID: TableUID,
  widget?: WidgetSoul,
) => {
  const currentTable = formData?.tables?.find(item => item.uid === tableUID);
  const formWidget = widget || formData?.formOptions?.[tableUID]?.widget;
  const fieldElementUidMap: Record<string, string> = {};

  const visit = (
    widgets: WidgetSoul[] = [],
    fields: Field[] = [],
    path: string[] = [],
  ) => {
    for (const currentWidget of widgets || []) {
      const field = fields.find(item => item.meta?.uid === currentWidget.uid);
      if (!field) {
        visit(currentWidget.widgets || [], fields, path);
        continue;
      }

      const fieldPath = [...path, field.uid].join(".");
      fieldElementUidMap[fieldPath] = currentWidget.uid;

      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      const subTable = subTableUID ? formData?.tables?.find(item => item.uid === subTableUID) : undefined;
      visit(
        currentWidget.widgets || [],
        subTable?.fields || fields,
        subTable ? [...path, field.uid] : path,
      );
    }
  }

  if (!currentTable || !formWidget?.widgets?.length) {
    return fieldElementUidMap;
  }

  visit(formWidget.widgets, currentTable.fields, []);
  return fieldElementUidMap;
}

export const buildFormFieldDefaultValueMap = (
  formData: NocodeFormData | undefined,
  tableUID: TableUID,
  widget?: WidgetSoul,
) => {
  const currentTable = formData?.tables?.find(item => item.uid === tableUID);
  const formWidget = widget || formData?.formOptions?.[tableUID]?.widget;
  const fieldDefaultValueMap: Record<string, unknown> = {};
  const cloneDefaultValueItem = (value: unknown) => {
    if (value === null || value === undefined) {
      return value;
    }
    return deepClone(value);
  }
  const normalizeSubformDefaultValue = (
    defaultValue: unknown,
    subFields: Field[] = [],
  ) => {
    if (!Array.isArray(defaultValue)) {
      return cloneDefaultValueItem(defaultValue);
    }

    const fieldUIDSet = new Set(subFields.map(item => String(item.uid || "")));
    const fieldKeyMap = subFields.reduce<Record<string, string>>((prev, item) => {
      const fieldUID = String(item.uid || "");
      const metaUID = String(item.meta?.uid || "");
      if (fieldUID) {
        prev[fieldUID] = fieldUID;
      }
      if (metaUID) {
        prev[metaUID] = fieldUID;
      }
      return prev;
    }, {});

    return defaultValue.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return cloneDefaultValueItem(row);
      }

      const sourceRow = row as Record<string, unknown>;
      const normalizedRow: Record<string, unknown> = {};

      Object.keys(sourceRow).forEach((key) => {
        if (!fieldUIDSet.has(key)) {
          return;
        }
        normalizedRow[key] = cloneDefaultValueItem(sourceRow[key]);
      });

      Object.keys(sourceRow).forEach((key) => {
        const normalizedKey = fieldKeyMap[key] || key;
        if (Object.prototype.hasOwnProperty.call(normalizedRow, normalizedKey)) {
          return;
        }
        normalizedRow[normalizedKey] = cloneDefaultValueItem(sourceRow[key]);
      });

      return normalizedRow;
    });
  }

  const visit = (
    widgets: WidgetSoul[] = [],
    fields: Field[] = [],
    path: string[] = [],
  ) => {
    for (const currentWidget of widgets || []) {
      const field = fields.find(item => item.meta?.uid === currentWidget.uid);
      if (!field) {
        visit(currentWidget.widgets || [], fields, path);
        continue;
      }

      const fieldPath = [...path, field.uid].join(".");
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      const subTable = subTableUID ? formData?.tables?.find(item => item.uid === subTableUID) : undefined;
      if (Object.prototype.hasOwnProperty.call(currentWidget.options || {}, "default-value")) {
        fieldDefaultValueMap[fieldPath] = subTable
          ? normalizeSubformDefaultValue(currentWidget.options?.["default-value"], subTable.fields || [])
          : cloneDefaultValueItem(currentWidget.options?.["default-value"]);
      }

      visit(
        currentWidget.widgets || [],
        subTable?.fields || fields,
        subTable ? [...path, field.uid] : path,
      );
    }
  }

  if (!currentTable || !formWidget?.widgets?.length) {
    return fieldDefaultValueMap;
  }

  visit(formWidget.widgets, currentTable.fields, []);
  return fieldDefaultValueMap;
}

export const hydrateSubformParentDefaultRows = (
  row: Record<string, any> = {},
  fields: Field[] = [],
  fieldDefaultValueMap: Record<string, unknown> = {},
) => {
  let changed = false;
  const visitedParentFieldIds = new Set<string>();

  for (const field of fields) {
    const fieldUID = String(field?.uid || "");
    const fieldPath = fieldUID.split(".");
    if (fieldPath.length !== 2) {
      continue;
    }

    const [parentFieldId] = fieldPath;
    if (visitedParentFieldIds.has(parentFieldId)) {
      continue;
    }
    visitedParentFieldIds.add(parentFieldId);

    if (Array.isArray(row?.[parentFieldId]) && row[parentFieldId].length) {
      continue;
    }

    const parentDefaultValue = fieldDefaultValueMap[parentFieldId];
    if (!Array.isArray(parentDefaultValue) || !parentDefaultValue.length) {
      continue;
    }

    row[parentFieldId] = deepClone(parentDefaultValue);
    changed = true;
  }

  return changed;
}

export const filterEditableViewActionFieldIds = (
  visibleFieldIds: ViewActionFieldId[] = [],
  mergedFieldsAuth: "all" | Record<string, FieldAuthValue>,
  fieldElementUidMap: Record<string, string> = {},
) => {
  const uniqueFieldIds = Array.from(new Set((visibleFieldIds || []).filter(Boolean)));
  if (mergedFieldsAuth === "all") {
    return uniqueFieldIds;
  }

  return uniqueFieldIds.filter((fieldId) => {
    const elementUID = fieldElementUidMap[String(fieldId)];
    if (!elementUID) {
      return false;
    }
    return mergedFieldsAuth[elementUID] === FieldAuthValue.VISIBLE_EDITABLE;
  });
}
