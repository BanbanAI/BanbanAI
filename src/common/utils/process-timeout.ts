import {
  FieldUID,
  ProcessTimeoutActionType,
  ProcessTimeoutConfig,
  ProcessTimeoutDeadline,
  ProcessTimeoutDeadlineType,
  ProcessTimeoutFieldDeadlineValue,
  ProcessTimeoutRelativePoint,
  ProcessTimeoutRule,
  ProcessTimeoutUnit,
} from "@common/types/project";
import i18next from "i18next";

const UNIT_MS: Record<ProcessTimeoutUnit, number> = {
  [ProcessTimeoutUnit.MINUTE]: 60 * 1000,
  [ProcessTimeoutUnit.HOUR]: 60 * 60 * 1000,
  [ProcessTimeoutUnit.DAY]: 24 * 60 * 60 * 1000,
};

const RULE_ACTION_TEXT: Partial<Record<ProcessTimeoutActionType, string>> = {
  get [ProcessTimeoutActionType.SUBMIT]() { return i18next.t("processTimeout.autoSubmit") },
  get [ProcessTimeoutActionType.BACK]() { return i18next.t("processTimeout.autoReturn") },
};

const POINT_TEXT: Record<Exclude<ProcessTimeoutRelativePoint, ProcessTimeoutRelativePoint.AFTER_NODE_ARRIVAL>, string> = {
  get [ProcessTimeoutRelativePoint.BEFORE_DEADLINE]() { return i18next.t("processTimeout.beforeDeadline") },
  get [ProcessTimeoutRelativePoint.AT_DEADLINE]() { return i18next.t("processTimeout.atDeadline") },
  get [ProcessTimeoutRelativePoint.AFTER_DEADLINE]() { return i18next.t("processTimeout.afterDeadline") },
};

const UNIT_TEXT: Record<ProcessTimeoutUnit, string> = {
  get [ProcessTimeoutUnit.MINUTE]() { return i18next.t("processTimeout.minute") },
  get [ProcessTimeoutUnit.HOUR]() { return i18next.t("processTimeout.hour") },
  get [ProcessTimeoutUnit.DAY]() { return i18next.t("processTimeout.day") },
};

const DEFAULT_DATE_ONLY_DEADLINE_TIME = "09:00";

export const PROCESS_TIMEOUT_MAX_RULE_COUNT = 5;

export type ProcessTimeoutRuleLimitReason =
  | "max-rule-count"
  | "submit-duplicate"
  | "submit-conflict-back"
  | "back-duplicate"
  | "back-conflict-submit";

export type ProcessTimeoutDeadlineConflictReason =
  | "before-node-arrival";

const toTimestamp = (value: unknown) => {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
  }

  return null;
};

const normalizeFieldDeadlineTime = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmedValue = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmedValue)) {
    return null;
  }
  const [hour, minute] = trimmedValue.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const normalizeFieldDeadlineValue = (value: unknown): ProcessTimeoutFieldDeadlineValue | null => {
  if (typeof value === "string" && value.trim()) {
    return {
      fieldId: value as FieldUID,
      time: null,
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const fieldId = typeof (value as any).fieldId === "string" && (value as any).fieldId.trim()
    ? (value as any).fieldId as FieldUID
    : null;

  if (!fieldId) {
    return null;
  }

  return {
    fieldId,
    time: normalizeFieldDeadlineTime((value as any).time),
  };
};

const resolveFieldDeadlineValue = (deadline?: ProcessTimeoutDeadline | null): ProcessTimeoutFieldDeadlineValue | null => {
  if (deadline?.type !== ProcessTimeoutDeadlineType.FIELD) {
    return null;
  }
  return normalizeFieldDeadlineValue(deadline.value);
};

const mergeDateOnlyFieldDeadline = (value: unknown, configuredTime?: string | null) => {
  const baseDate = toTimestamp(value);
  if (!Number.isFinite(baseDate || NaN)) {
    return null;
  }

  const timeText = normalizeFieldDeadlineTime(configuredTime) || DEFAULT_DATE_ONLY_DEADLINE_TIME;
  const match = typeof value === "string"
    ? value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
    : null;

  if (match) {
    const [, yearText, monthText, dayText] = match;
    const [hour, minute] = timeText.split(":").map(Number);
    return new Date(Number(yearText), Number(monthText) - 1, Number(dayText), hour, minute, 0, 0).getTime();
  }

  const date = new Date(baseDate);
  const [hour, minute] = timeText.split(":").map(Number);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
};

const normalizeDelay = (value: unknown, fallback = 0) => {
  const delay = Number(value);
  if (!Number.isFinite(delay)) {
    return fallback;
  }
  return Math.max(0, Math.floor(delay));
};

const normalizeUnit = (value: unknown, fallback = ProcessTimeoutUnit.MINUTE) => {
  return Object.values(ProcessTimeoutUnit).includes(value as ProcessTimeoutUnit)
    ? value as ProcessTimeoutUnit
    : fallback;
};

const normalizeRuleTrigger = (
  trigger?: Partial<ProcessTimeoutRule["trigger"]> | null,
  legacy?: Pick<ProcessTimeoutRule, "action"> & { delay?: number; unit?: ProcessTimeoutUnit },
): ProcessTimeoutRule["trigger"] => {
  if (trigger?.point && Object.values(ProcessTimeoutRelativePoint).includes(trigger.point)) {
    return {
      point: trigger.point,
      delay: normalizeDelay(trigger.delay, trigger.point === ProcessTimeoutRelativePoint.AT_DEADLINE ? 0 : 1),
      unit: normalizeUnit(trigger.unit, ProcessTimeoutUnit.MINUTE),
    };
  }

  return {
    point: legacy?.action === ProcessTimeoutActionType.REMIND
      ? ProcessTimeoutRelativePoint.AFTER_DEADLINE
      : ProcessTimeoutRelativePoint.AT_DEADLINE,
    delay: normalizeDelay(legacy?.delay, legacy?.action === ProcessTimeoutActionType.REMIND ? 10 : 0),
    unit: normalizeUnit(legacy?.unit, ProcessTimeoutUnit.MINUTE),
  };
};

const normalizeRule = (rule?: any): ProcessTimeoutRule | null => {
  if (!rule?.uid) {
    return null;
  }

  const action = Object.values(ProcessTimeoutActionType).includes(rule.action)
    ? rule.action
    : ProcessTimeoutActionType.REMIND;

  const normalizedRule: ProcessTimeoutRule = {
    uid: rule.uid,
    action,
    trigger: normalizeRuleTrigger(rule.trigger, {
      action,
      delay: rule.delay,
      unit: rule.unit,
    }),
  };

  if (action === ProcessTimeoutActionType.BACK) {
    normalizedRule.backNodeId = typeof rule.backNodeId === "string" && rule.backNodeId.trim()
      ? rule.backNodeId
      : null;
  }

  return normalizedRule;
};

export const normalizeProcessTimeoutConfig = (timeout?: ProcessTimeoutConfig | null): ProcessTimeoutConfig => {
  const deadline = timeout?.deadline;
  let normalizedDeadline: ProcessTimeoutDeadline | null = null;

  if (deadline?.type === ProcessTimeoutDeadlineType.FIELD) {
    const fieldDeadlineValue = normalizeFieldDeadlineValue(deadline.value);
    normalizedDeadline = {
      type: ProcessTimeoutDeadlineType.FIELD,
      value: fieldDeadlineValue,
    };
  } else if (deadline?.type === ProcessTimeoutDeadlineType.CUSTOM) {
    const customValue = deadline.value as any;
    normalizedDeadline = {
      type: ProcessTimeoutDeadlineType.CUSTOM,
      value: customValue?.point === ProcessTimeoutRelativePoint.AFTER_NODE_ARRIVAL
        ? {
            point: ProcessTimeoutRelativePoint.AFTER_NODE_ARRIVAL,
            delay: normalizeDelay(customValue?.delay, 1),
            unit: normalizeUnit(customValue?.unit, ProcessTimeoutUnit.DAY),
          }
        : null,
    };
  } else if (timeout?.deadlineFieldId) {
    normalizedDeadline = {
      type: ProcessTimeoutDeadlineType.FIELD,
      value: timeout.deadlineFieldId,
    };
  }

  const rules = (Array.isArray(timeout?.rules) ? timeout.rules : [])
    .map(normalizeRule)
    .filter(Boolean) as ProcessTimeoutRule[];

  const hasDeadlineValue = normalizedDeadline?.type === ProcessTimeoutDeadlineType.FIELD
    ? Boolean(resolveFieldDeadlineValue(normalizedDeadline)?.fieldId)
    : Boolean(normalizedDeadline?.value);

  const enabled = typeof timeout?.enabled === "boolean"
    ? timeout.enabled
    : Boolean(hasDeadlineValue && rules.length);

  return {
    ...timeout,
    enabled,
    deadline: normalizedDeadline,
    deadlineFieldId: resolveFieldDeadlineValue(normalizedDeadline)?.fieldId || null,
    rules,
  };
};

export const resolveTimeoutDeadlineAt = (
  deadline?: ProcessTimeoutDeadline | null,
  context?: {
    currentRow?: Record<string, unknown> | null,
    nodeArrivedAt?: number | null,
  },
) => {
  if (!deadline) {
    return null;
  }

  if (deadline.type === ProcessTimeoutDeadlineType.FIELD) {
    const fieldDeadlineValue = resolveFieldDeadlineValue(deadline);
    const fieldId = fieldDeadlineValue?.fieldId || null;
    if (!fieldId) {
      return null;
    }
    const fieldValue = context?.currentRow?.[fieldId];
    if (fieldDeadlineValue?.time) {
      return mergeDateOnlyFieldDeadline(fieldValue, fieldDeadlineValue.time);
    }
    return toTimestamp(fieldValue);
  }

  if (deadline.type === ProcessTimeoutDeadlineType.CUSTOM) {
    const value = deadline.value as any;
    if (value?.point !== ProcessTimeoutRelativePoint.AFTER_NODE_ARRIVAL) {
      return null;
    }
    const nodeArrivedAt = Number(context?.nodeArrivedAt);
    if (!Number.isFinite(nodeArrivedAt)) {
      return null;
    }
    return nodeArrivedAt + normalizeDelay(value.delay, 1) * UNIT_MS[normalizeUnit(value.unit, ProcessTimeoutUnit.DAY)];
  }

  return null;
};

export const resolveTimeoutRuleAt = (deadlineAt: number, rule: ProcessTimeoutRule) => {
  const delay = normalizeDelay(rule?.trigger?.delay, 0) * UNIT_MS[normalizeUnit(rule?.trigger?.unit, ProcessTimeoutUnit.MINUTE)];
  switch (rule?.trigger?.point) {
    case ProcessTimeoutRelativePoint.BEFORE_DEADLINE:
      return deadlineAt - delay;
    case ProcessTimeoutRelativePoint.AFTER_DEADLINE:
      return deadlineAt + delay;
    case ProcessTimeoutRelativePoint.AT_DEADLINE:
    default:
      return deadlineAt;
  }
};

export const getDueTimeoutRules = (
  timeout?: ProcessTimeoutConfig | null,
  deadlineAt?: number | null,
  executedRuleAtMap: Record<string, number> = {},
  now = Date.now(),
) => {
  const normalizedTimeout = normalizeProcessTimeoutConfig(timeout);
  if (!normalizedTimeout.enabled || !Number.isFinite(deadlineAt || NaN)) {
    return [];
  }

  return (normalizedTimeout.rules || [])
    .filter(rule => rule?.uid)
    .filter(rule => {
      const ruleAt = resolveTimeoutRuleAt(deadlineAt as number, rule);
      return ruleAt <= now && !Number.isFinite(executedRuleAtMap[rule.uid] || NaN);
    });
};

export const resolveTimeoutDeadlineFieldId = (timeout?: ProcessTimeoutConfig | null): FieldUID | null => {
  const normalizedTimeout = normalizeProcessTimeoutConfig(timeout);
  return resolveFieldDeadlineValue(normalizedTimeout.deadline)?.fieldId || null;
};

export const getProcessTimeoutRuleLimitReason = (
  rules: ProcessTimeoutRule[] = [],
  nextAction?: ProcessTimeoutActionType | null,
  editingRuleIndex = -1,
): ProcessTimeoutRuleLimitReason | null => {
  const normalizedRules = Array.isArray(rules) ? rules : [];
  const nextRules = editingRuleIndex >= 0
    ? normalizedRules.filter((_, index) => index !== editingRuleIndex)
    : normalizedRules;

  if (editingRuleIndex < 0 && nextRules.length >= PROCESS_TIMEOUT_MAX_RULE_COUNT) {
    return "max-rule-count";
  }

  if (!nextAction) {
    return null;
  }

  const hasSubmitRule = nextRules.some(rule => rule?.action === ProcessTimeoutActionType.SUBMIT);
  const hasBackRule = nextRules.some(rule => rule?.action === ProcessTimeoutActionType.BACK);

  if (nextAction === ProcessTimeoutActionType.SUBMIT) {
    if (hasSubmitRule) {
      return "submit-duplicate";
    }
    if (hasBackRule) {
      return "submit-conflict-back";
    }
  }

  if (nextAction === ProcessTimeoutActionType.BACK) {
    if (hasBackRule) {
      return "back-duplicate";
    }
    if (hasSubmitRule) {
      return "back-conflict-submit";
    }
  }

  return null;
};

export const getProcessTimeoutAvailableActions = (
  rules: ProcessTimeoutRule[] = [],
  supportedActions: ProcessTimeoutActionType[] = [],
  editingRuleIndex = -1,
) => {
  return (Array.isArray(supportedActions) ? supportedActions : [])
    .filter(action => !getProcessTimeoutRuleLimitReason(rules, action, editingRuleIndex));
};

export const getProcessTimeoutDeadlineConflictReason = (
  timeout?: ProcessTimeoutConfig | null,
) : ProcessTimeoutDeadlineConflictReason | null => {
  const normalizedTimeout = normalizeProcessTimeoutConfig(timeout);
  const deadline = normalizedTimeout.deadline;

  if (deadline?.type !== ProcessTimeoutDeadlineType.CUSTOM) {
    return null;
  }

  const deadlineValue = deadline.value as any;
  if (deadlineValue?.point !== ProcessTimeoutRelativePoint.AFTER_NODE_ARRIVAL) {
    return null;
  }

  const deadlineAt = resolveTimeoutDeadlineAt(deadline, {
    nodeArrivedAt: 0,
  });
  if (!Number.isFinite(deadlineAt || NaN)) {
    return null;
  }

  const hasRuleBeforeNodeArrival = (normalizedTimeout.rules || []).some((rule) => {
    const ruleAt = resolveTimeoutRuleAt(deadlineAt as number, rule);
    return Number.isFinite(ruleAt) && ruleAt < 0;
  });

  if (hasRuleBeforeNodeArrival) {
    return "before-node-arrival";
  }

  return null;
};

export const resolveTimeoutRuleSummary = (rule?: ProcessTimeoutRule | null) => {
  if (!rule) {
    return "";
  }
  if (rule.action === ProcessTimeoutActionType.REMIND) {
    return "";
  }

  const point = rule.trigger?.point || ProcessTimeoutRelativePoint.AT_DEADLINE;
  const actionText = RULE_ACTION_TEXT[rule.action] || "";

  if (point === ProcessTimeoutRelativePoint.AT_DEADLINE) {
    return i18next.t("processTimeout.deadlineSummaryAt", { action: actionText });
  }

  const delay = normalizeDelay(rule.trigger?.delay, 0);
  const unitText = UNIT_TEXT[normalizeUnit(rule.trigger?.unit, ProcessTimeoutUnit.MINUTE)];
  return i18next.t("processTimeout.deadlineSummaryRelative", {
    action: actionText,
    delay,
    point: POINT_TEXT[point],
    unit: unitText,
  });
};

export const hasConfiguredTimeout = (timeout?: ProcessTimeoutConfig | null) => {
  const normalizedTimeout = normalizeProcessTimeoutConfig(timeout);
  const hasDeadlineValue = normalizedTimeout.deadline?.type === ProcessTimeoutDeadlineType.FIELD
    ? Boolean(resolveFieldDeadlineValue(normalizedTimeout.deadline)?.fieldId)
    : Boolean(normalizedTimeout.deadline?.value);
  return Boolean(hasDeadlineValue && normalizedTimeout.rules?.length);
};
