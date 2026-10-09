import type { Field, Row } from "@common/types/project";
import { ProcessNodeStatus } from "@common/types/project";
import { FormWidgetType, PrintFlowCommentNodeScope, PrintFlowCommentOrder, PrintFlowCommentRule } from "@common/types/nocode";
import i18next from "i18next";

export const printFlowCommentFieldUid = "flow_comment";
export const printFlowCommentTextFieldUid = "comment";
export const defaultPrintFlowCommentRule: Required<Pick<PrintFlowCommentRule, "order" | "nodeScope" | "onlySubmitOperation" | "onlyNonEmptyComment">> & Pick<PrintFlowCommentRule, "nodeIds"> = {
  order: PrintFlowCommentOrder.DESC,
  nodeScope: PrintFlowCommentNodeScope.ALL,
  nodeIds: [],
  onlySubmitOperation: false,
  onlyNonEmptyComment: true,
};

export type PrintFlowCommentTextSource = "meta" | "submit_record";

export type PrintFlowCommentTextItem = {
  comment: string;
  nodeId: string;
  time: number;
  source: PrintFlowCommentTextSource | "empty";
}

export type PrintFlowCommentSourceRecord = {
  uuid?: string;
  flowId?: string;
  status?: ProcessNodeStatus | string;
  startTime?: number;
  endTime?: number;
  metas?: Record<string, {
    comment?: string;
    updateTime?: number;
  }>;
  submitRecords?: Array<{
    userId?: string;
    comment?: string;
    time?: number;
  }>;
}

export type BuildPrintFlowCommentTextRowsOptions = {
  rowUuidKey?: string;
  rule?: PrintFlowCommentRule;
}

export const createPrintFlowCommentField = (): Field => ({
  uid: printFlowCommentFieldUid as Field["uid"],
  alias: i18next.t("CompareTableDialog.approvalOpinion"),
  type: "array",
  meta: {
    name: printFlowCommentFieldUid,
    subType: "subForm",
    extra: {
      widgetType: FormWidgetType.SUBFORM,
    },
  },
  subTableFields: [
    {
      uid: printFlowCommentTextFieldUid as Field["uid"],
      alias: i18next.t("CompareTableDialog.flowCommentText"),
      type: "string",
      meta: {
        name: printFlowCommentTextFieldUid,
      },
    },
  ],
});

export const isPrintFlowCommentFieldKey = (fieldKey: string) => {
  const normalizedKey = String(fieldKey || "").split("|")[0];
  return normalizedKey === printFlowCommentFieldUid
    || normalizedKey.startsWith(`${printFlowCommentFieldUid}.`);
}

export const normalizePrintFlowCommentRule = (
  rule?: PrintFlowCommentRule | null,
): Required<Pick<PrintFlowCommentRule, "order" | "nodeScope" | "onlySubmitOperation" | "onlyNonEmptyComment">> & Pick<PrintFlowCommentRule, "nodeIds"> => {
  const order = rule?.order === PrintFlowCommentOrder.ASC
    ? PrintFlowCommentOrder.ASC
    : PrintFlowCommentOrder.DESC;
  const nodeScope = rule?.nodeScope === PrintFlowCommentNodeScope.CUSTOM
    ? PrintFlowCommentNodeScope.CUSTOM
    : PrintFlowCommentNodeScope.ALL;
  return {
    order,
    nodeScope,
    nodeIds: Array.isArray(rule?.nodeIds) ? rule.nodeIds.filter(Boolean).map(String) : [],
    onlySubmitOperation: !!rule?.onlySubmitOperation,
    onlyNonEmptyComment: rule?.onlyNonEmptyComment !== false,
  };
}

const normalizePrintFlowCommentText = (value: unknown) => {
  return String(value || "").trim();
}

const shouldUseRecordByRule = (
  record: PrintFlowCommentSourceRecord,
  rule: ReturnType<typeof normalizePrintFlowCommentRule>,
) => {
  if (record.flowId === 'start' || record.flowId === 'end') {
    return false;
  }
  if (rule.nodeScope === PrintFlowCommentNodeScope.CUSTOM) {
    if (!rule.nodeIds.length || !rule.nodeIds.includes(String(record.flowId || ""))) {
      return false;
    }
  }
  if (rule.onlySubmitOperation && record.status !== ProcessNodeStatus.FINISHED) {
    return false;
  }
  return true;
}

const getRecordTime = (
  record: PrintFlowCommentSourceRecord,
  preferredTime?: number,
) => {
  const time = Number(preferredTime ?? record.endTime ?? record.startTime ?? 0);
  return Number.isFinite(time) ? time : 0;
}

const collectRecordCommentItems = (
  record: PrintFlowCommentSourceRecord,
  rule: ReturnType<typeof normalizePrintFlowCommentRule>,
) => {
  const items: PrintFlowCommentTextItem[] = [];
  const nodeId = String(record.flowId || "");

  for (const submitRecord of record.submitRecords || []) {
    const comment = normalizePrintFlowCommentText(submitRecord?.comment);
    if (!comment && rule.onlyNonEmptyComment) continue;
    items.push({
      comment,
      nodeId,
      time: getRecordTime(record, submitRecord?.time),
      source: "submit_record",
    });
  }

  for (const meta of Object.values(record.metas || {})) {
    const comment = normalizePrintFlowCommentText(meta?.comment);
    if (!comment && rule.onlyNonEmptyComment) continue;
    items.push({
      comment,
      nodeId,
      time: getRecordTime(record, meta?.updateTime),
      source: "meta",
    });
  }
  if (items.length === 0 && rule.onlyNonEmptyComment === false) {
    items.push({
      comment: "",
      nodeId,
      time: getRecordTime(record),
      source: "empty",
    });
  }

  return items;
}

const uniquePrintFlowCommentTextItems = (items: PrintFlowCommentTextItem[]) => {
  const usedKeys = new Set<string>();
  const result: PrintFlowCommentTextItem[] = [];
  for (const item of items) {
    const key = `${item.nodeId}\n${item.time}\n${item.comment}`;
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    result.push(item);
  }
  return result;
}

export const buildPrintFlowCommentTextRows = (
  rows: Row[],
  records: PrintFlowCommentSourceRecord[],
  options: BuildPrintFlowCommentTextRowsOptions = {},
) => {
  const rowUuidKey = options.rowUuidKey || "uuid";
  const rule = normalizePrintFlowCommentRule(options.rule);
  const recordItemsByUuid = new Map<string, PrintFlowCommentTextItem[]>();

  for (const record of records || []) {
    if (!record?.uuid) continue;
    if (!shouldUseRecordByRule(record, rule)) continue;
    const items = collectRecordCommentItems(record, rule);
    if (!items.length) continue;
    const existingItems = recordItemsByUuid.get(record.uuid) || [];
    recordItemsByUuid.set(record.uuid, existingItems.concat(items));
  }

  for (const [uuid, items] of recordItemsByUuid.entries()) {
    recordItemsByUuid.set(
      uuid,
      uniquePrintFlowCommentTextItems(items)
        .sort((left, right) => rule.order === PrintFlowCommentOrder.ASC
          ? left.time - right.time
          : right.time - left.time,
        ),
    );
  }

  return (rows || []).map(row => {
    const uuid = String(row?.[rowUuidKey] || "");
    return {
      ...row,
      [printFlowCommentFieldUid]: recordItemsByUuid.get(uuid) || [],
    };
  });
}
