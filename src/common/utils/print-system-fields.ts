import { ProcessNodeStatusMapping } from "../types/nocode";
import type { Field, NocodeProcess, ProcessFlow, Row } from "../types/project";
import { SystemField } from "./connection";
import { getFlowById, getFlows } from "./flow";

export const printProcessSystemFieldNames: SystemField[] = [
  SystemField.STATUS,
  SystemField.CURRENT_NODE,
  SystemField.CURRENT_OWNER,
];

export const printTemplateSystemFieldNames: SystemField[] = [
  SystemField.CREATE_OWNER,
  SystemField.DATA_OWNER,
  SystemField.CREATE_TIME,
  SystemField.UPDATE_TIME,
  ...printProcessSystemFieldNames,
];

type OwnerNameMap = Record<string, string> | Map<string, string>;

type FillPrintProcessSystemFieldOptions = {
  process?: NocodeProcess | null;
  ownerNameMap?: OwnerNameMap;
}

export const normalizePrintArrayValue = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap(item => normalizePrintArrayValue(item))
      .filter(Boolean);
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [String(value)];
}

const getRowSystemFieldValue = (row: Row | null | undefined, systemField: SystemField) => {
  if (!row) return undefined;
  return row[systemField];
}

export const getPrintProcessFlow = (
  process: NocodeProcess | null | undefined,
  flowId: string,
  row?: Row | null,
): ProcessFlow | null => {
  if (!process || !flowId) return null;

  const versionSet = new Set<number>();
  const rowVersion = Number(getRowSystemFieldValue(row, SystemField.TODO_VERSION));
  if (Number.isInteger(rowVersion) && rowVersion > 0) {
    versionSet.add(rowVersion);
  }

  const currentVersion = Number(process.version);
  if (Number.isInteger(currentVersion) && currentVersion > 0) {
    versionSet.add(currentVersion);
  }

  for (const version of Array.from(versionSet)) {
    const flow = getFlowById(getFlows(process, version) || [], flowId);
    if (flow) return flow;
  }

  const versionKeys = Object.keys(process.flowsByVersion || {});
  for (const key of versionKeys) {
    const match = /^v(\d+)$/.exec(key);
    const version = match ? Number(match[1]) : NaN;
    if (!Number.isInteger(version) || versionSet.has(version)) {
      continue;
    }
    const flow = getFlowById(getFlows(process, version) || [], flowId);
    if (flow) return flow;
  }

  return getFlowById(getFlows(process) || [], flowId) || null;
}

export const getPrintProcessFlowLabel = (
  process: NocodeProcess | null | undefined,
  flowId: string,
  row?: Row | null,
) => {
  return getPrintProcessFlow(process, flowId, row)?.options?.name || flowId;
}

export const getPrintProcessStatusLabel = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const status = String(value);
  return ProcessNodeStatusMapping[status] || status;
}

const getOwnerName = (ownerNameMap: OwnerNameMap | undefined, ownerId: string) => {
  if (!ownerNameMap) return ownerId;
  if (ownerNameMap instanceof Map) {
    return ownerNameMap.get(ownerId) || ownerId;
  }
  return ownerNameMap[ownerId] || ownerId;
}

const formatPrintProcessSystemFieldValue = (
  systemField: SystemField,
  value: unknown,
  row: Row,
  options: FillPrintProcessSystemFieldOptions,
) => {
  if (systemField === SystemField.STATUS) {
    return getPrintProcessStatusLabel(value);
  }
  if (systemField === SystemField.CURRENT_NODE) {
    return normalizePrintArrayValue(value)
      .map(flowId => getPrintProcessFlowLabel(options.process, flowId, row))
      .join(",");
  }
  if (systemField === SystemField.CURRENT_OWNER) {
    return normalizePrintArrayValue(value)
      .map(ownerId => getOwnerName(options.ownerNameMap, ownerId))
      .join(",");
  }
  return value;
}

export const collectPrintCurrentOwnerIds = (
  rows: Row[],
  fields: Field[],
) => {
  const ownerField = fields.find(field => field.meta?.name === SystemField.CURRENT_OWNER);
  const ids = new Set<string>();
  for (const row of rows || []) {
    const value = ownerField?.uid && row[ownerField.uid] !== undefined
      ? row[ownerField.uid]
      : row[SystemField.CURRENT_OWNER];
    normalizePrintArrayValue(value).forEach(id => ids.add(id));
  }
  return Array.from(ids);
}

export const fillPrintProcessSystemFieldValues = (
  rows: Row[],
  fields: Field[],
  options: FillPrintProcessSystemFieldOptions = {},
) => {
  const processFields = fields.filter(field => {
    return printProcessSystemFieldNames.includes(field.meta?.name as SystemField);
  });
  if (!processFields.length) return rows;

  return rows.map(row => {
    const nextRow = { ...row };
    for (const field of processFields) {
      const systemField = field.meta.name as SystemField;
      const value = field.uid && nextRow[field.uid] !== undefined
        ? nextRow[field.uid]
        : nextRow[systemField];
      const printValue = formatPrintProcessSystemFieldValue(systemField, value, nextRow, options);
      if (field.uid) {
        nextRow[field.uid] = printValue;
      }
      nextRow[systemField] = printValue;
    }
    return nextRow;
  });
}
