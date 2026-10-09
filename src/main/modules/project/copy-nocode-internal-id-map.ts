import { deepClone } from "@common/utils/object";
import { unique } from "@common/utils/unique";
import { replaceUID } from "../../../common/utils/replace";
import { SystemField } from "../../../common/utils/connection";
import { ProcessNodeType } from "../../../common/types/project";

type IdMap = Record<string, string>;

const STABLE_SYSTEM_FIELD_IDS = new Set<string>(Object.values(SystemField));
const STABLE_PROCESS_NODE_IDS = new Set<string>(Object.values(ProcessNodeType));
const HISTORY_TABLE_UID_PREFIX = "hist_";

export type CopiedNocodeInternalIdMaps = {
  uidMap: IdMap,
  pageIdMap: IdMap,
  groupIdMap: IdMap,
  replaceMap: IdMap,
}

function createMappedId(sourceId: string) {
  const prefix = String(sourceId || "").match(/^[a-zA-Z]+_/)?.[0] || "";
  return `${prefix}${unique()}`;
}

function assignMappedId(idMap: IdMap, sourceId?: string | null) {
  if (!sourceId) return "";
  // 流程语义节点类型是固定协议值，复制应用时不能当成内部 id 一起替换
  if (STABLE_SYSTEM_FIELD_IDS.has(sourceId) || STABLE_PROCESS_NODE_IDS.has(sourceId)) return sourceId;
  if (!idMap[sourceId]) {
    idMap[sourceId] = createMappedId(sourceId);
  }
  return idMap[sourceId];
}

function appendHistoryTableUidMappings(uidMap: IdMap) {
  Object.entries(uidMap).forEach(([sourceId, mappedId]) => {
    if (!sourceId?.startsWith("t_") || !mappedId) return;
    uidMap[`${HISTORY_TABLE_UID_PREFIX}${sourceId}`] = `${HISTORY_TABLE_UID_PREFIX}${mappedId}`;
  });
}

function collectOptionColumnIds(columns: any[], uidMap: IdMap) {
  (columns || []).forEach(column => {
    assignMappedId(uidMap, column?.uid);
    collectOptionColumnIds(column?.extra?.subColumns, uidMap);
  });
}

function collectTableIds(tables: any[], uidMap: IdMap) {
  (tables || []).forEach(table => {
    assignMappedId(uidMap, table?.uid);
    assignMappedId(uidMap, table?.meta?.uid);
    collectFieldIds(table?.fields, uidMap);
  });
}

function collectFieldIds(fields: any[], uidMap: IdMap) {
  (fields || []).forEach(field => {
    assignMappedId(uidMap, field?.uid);
    assignMappedId(uidMap, field?.meta?.uid);
    collectFieldIds(field?.subTableFields, uidMap);
    collectFieldIds(field?.relatedTableFields, uidMap);
  });
}

function collectWidgetIds(widget: any, uidMap: IdMap) {
  if (!widget) return;
  assignMappedId(uidMap, widget.uid);
  (widget.widgets || []).forEach(child => collectWidgetIds(child, uidMap));
}

function collectDeletedWidgetHistoryIds(widget: any, uidMap: IdMap) {
  if (!widget) return;
  assignMappedId(uidMap, widget?.recycleInfo?.tableUID);
  assignMappedId(uidMap, widget?.recycleInfo?.tableMetaUID);
  assignMappedId(uidMap, widget?.recycleInfo?.fieldId);
  assignMappedId(uidMap, widget?.recycleInfo?.widgetUID);
  (widget.widgets || []).forEach(child => collectDeletedWidgetHistoryIds(child, uidMap));
}

function collectDeletedWidgetIds(deletedWidgets: any[], uidMap: IdMap) {
  (deletedWidgets || []).forEach(widget => {
    collectWidgetIds(widget, uidMap);
    collectDeletedWidgetHistoryIds(widget, uidMap);
  });
}

function collectProcessFlowIds(flows: any[], uidMap: IdMap) {
  (flows || []).forEach(flow => {
    assignMappedId(uidMap, flow?.uid);
    collectProcessBranchIds(flow?.branches, uidMap);
  });
}

function collectProcessBranchIds(branches: any[], uidMap: IdMap) {
  (branches || []).forEach(branch => {
    assignMappedId(uidMap, branch?.uid);
    collectProcessFlowIds(branch?.flows, uidMap);
  });
}

function collectFormOptionIds(formOptions: Record<string, any>, uidMap: IdMap) {
  Object.values(formOptions || {}).forEach(option => {
    collectWidgetIds(option?.widget, uidMap);
    collectDeletedWidgetIds(option?.deletedWidgets, uidMap);
    collectProcessFlowIds(option?.process?.flows, uidMap);
    Object.values((option?.process?.flowsByVersion || {}) as Record<string, any[]>).forEach(flows => collectProcessFlowIds(flows, uidMap));
  });
}

function collectViewIds(views: Record<string, any[]>, uidMap: IdMap) {
  Object.values(views || {}).forEach(viewList => {
    (viewList || []).forEach(view => {
      assignMappedId(uidMap, view?.uid);
      (view?.actions || []).forEach(action => assignMappedId(uidMap, action?.id));
    });
  });
}

function collectAggregateIds(aggregateTables: any[], uidMap: IdMap) {
  (aggregateTables || []).forEach(aggregateTable => {
    assignMappedId(uidMap, aggregateTable?.uid);
    (aggregateTable?.sourceTables || []).forEach(sourceTable => assignMappedId(uidMap, sourceTable?.uid));
    (aggregateTable?.dimensions || []).forEach(dimension => {
      assignMappedId(uidMap, dimension?.uid);
      (dimension?.items || []).forEach(item => assignMappedId(uidMap, item?.uid));
    });
    (aggregateTable?.variables || []).forEach(variable => assignMappedId(uidMap, variable?.uid));
    (aggregateTable?.metrics || []).forEach(metric => {
      assignMappedId(uidMap, metric?.uid);
      (metric?.variables || []).forEach(variable => assignMappedId(uidMap, variable?.uid));
      assignMappedId(uidMap, metric?.singleFieldConfig?.uid);
    });
    (aggregateTable?.submitValidate?.rules || []).forEach(rule => assignMappedId(uidMap, rule?.uid));
  });
}

function collectMetaIds(metas: Record<string, any>, uidMap: IdMap) {
  Object.values(metas || {}).forEach(meta => {
    (meta?.aggregateFields || []).forEach(field => {
      assignMappedId(uidMap, field?.uid);
      assignMappedId(uidMap, field?.singleFieldConfig?.uid);
      assignMappedId(uidMap, field?.singleFieldConfig?.sourceVariableUID);
    });
  });
}

function collectPrintTemplateIds(printTemplate: Record<string, any[]>, uidMap: IdMap) {
  Object.values(printTemplate || {}).forEach(templates => {
    (templates || []).forEach(template => assignMappedId(uidMap, template?.uid));
  });
}

function collectStructureIds(structure: any[], pageIdMap: IdMap, groupIdMap: IdMap) {
  (structure || []).forEach(node => {
    if (node?.type === "page") {
      assignMappedId(pageIdMap, node.id);
    } else if (node?.type === "group") {
      assignMappedId(groupIdMap, node.id);
    }
    collectStructureIds(node?.children, pageIdMap, groupIdMap);
  });
}

function remapStructure(structure: any[], idMaps: CopiedNocodeInternalIdMaps) {
  return (structure || []).map(node => {
    let nextId = node.id;
    if (node.type === "page") {
      nextId = idMaps.pageIdMap[node.id] || node.id;
    } else if (node.type === "group") {
      nextId = idMaps.groupIdMap[node.id] || node.id;
    } else if (node.type === "form") {
      nextId = idMaps.uidMap[node.id] || node.id;
    }
    return {
      ...node,
      id: nextId,
      children: remapStructure(node.children, idMaps),
    };
  });
}

function remapPrintTemplate(printTemplate: Record<string, any[]>, uidMap: IdMap) {
  const result: Record<string, any[]> = {};
  Object.entries(printTemplate || {}).forEach(([tableUID, templates]) => {
    const copiedTableUID = uidMap[tableUID] || tableUID;
    result[copiedTableUID] = (templates || []).map(template => ({
      ...template,
      uid: uidMap[template?.uid] || template?.uid,
    }));
  });
  return result;
}

export function buildCopiedNocodeInternalIdMaps(nocodeBody: any): CopiedNocodeInternalIdMaps {
  const uidMap: IdMap = {};
  const pageIdMap: IdMap = {};
  const groupIdMap: IdMap = {};
  const formData = nocodeBody?.formData;

  assignMappedId(uidMap, formData?.uid);
  (formData?.options?.tables || []).forEach(table => {
    assignMappedId(uidMap, table?.uid);
    collectOptionColumnIds(table?.columns, uidMap);
  });
  collectTableIds(formData?.tables, uidMap);
  collectMetaIds(formData?.metas, uidMap);
  collectFormOptionIds(formData?.formOptions, uidMap);
  collectAggregateIds(formData?.aggregateTables, uidMap);
  collectViewIds(nocodeBody?.views, uidMap);
  collectPrintTemplateIds(nocodeBody?.printTemplate, uidMap);
  collectStructureIds(nocodeBody?.structure, pageIdMap, groupIdMap);
  appendHistoryTableUidMappings(uidMap);

  return {
    uidMap,
    pageIdMap,
    groupIdMap,
    replaceMap: {
      ...uidMap,
      ...pageIdMap,
      ...groupIdMap,
    },
  };
}

export function applyCopiedNocodeInternalIdMaps(sourceBody: any, idMaps: CopiedNocodeInternalIdMaps) {
  const nocodeBody = deepClone(sourceBody);

  if (nocodeBody.formData) {
    nocodeBody.formData = replaceUID(nocodeBody.formData, idMaps.uidMap);
  }
  if (nocodeBody.views) {
    nocodeBody.views = replaceUID(nocodeBody.views, idMaps.uidMap);
  }
  if (nocodeBody.permissions) {
    nocodeBody.permissions = replaceUID(nocodeBody.permissions, idMaps.replaceMap);
  }
  if (nocodeBody.printTemplate) {
    nocodeBody.printTemplate = remapPrintTemplate(nocodeBody.printTemplate, idMaps.uidMap);
  }
  if (nocodeBody.structure) {
    nocodeBody.structure = remapStructure(nocodeBody.structure, idMaps);
  }
  const homePage = nocodeBody.settings?.homePage;
  if (homePage?.enabled && homePage.nodeId) {
    const copiedNodeId = idMaps.uidMap[homePage.nodeId] || idMaps.pageIdMap[homePage.nodeId];
    nocodeBody.settings.homePage = copiedNodeId
      ? { enabled: true, nodeId: copiedNodeId }
      : { enabled: false };
  } else if (homePage) {
    nocodeBody.settings.homePage = { enabled: false };
  }

  return nocodeBody;
}

export function remapCopiedNocodeInternalIds(sourceBody: any) {
  const idMaps = buildCopiedNocodeInternalIdMaps(sourceBody);
  const nocodeBody = applyCopiedNocodeInternalIdMaps(sourceBody, idMaps);
  return {
    nocodeBody,
    idMaps,
  };
}

export function remapCopiedPageBodyInternalIds(sourceBody: any, idMaps: CopiedNocodeInternalIdMaps) {
  const pageBody = deepClone(sourceBody);
  return replaceUID(pageBody, idMaps.replaceMap);
}
