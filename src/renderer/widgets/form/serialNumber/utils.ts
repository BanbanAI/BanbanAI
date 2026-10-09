import dayjs from 'dayjs';
import { FormElement } from '@renderer/b2/controllers/form';
import type { SerialNumber } from './serialNumber';
import type { CountingRule, CountingRuleValue, SerialNumberCounter } from './type';

const SUB_SERIAL_NUMBER_COUNTER_FIELD_PREFIX = "__sub_serial_number_counter__";

export function getSubSerialNumberCounterFieldId(widgetUid: string) {
  return `${SUB_SERIAL_NUMBER_COUNTER_FIELD_PREFIX}${widgetUid}`;
}

export function getSubSerialNumberCounterFieldName(widgetUid: string) {
  return `sub_serial_number_counter_${widgetUid.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

export function isEmptySerialNumberValue(value: any) {
  return value === undefined || value === null || value === "";
}

export function getResetTimestamp(cycle: CountingRuleValue['resetCycle']): number | null {
  const now = dayjs();

  switch (cycle) {
    case 'daily':
      return now.endOf('day').valueOf();
    case 'weekly':
      return now.endOf('week').valueOf();
    case 'monthly':
      return now.endOf('month').valueOf();
    case 'yearly':
      return now.endOf('year').valueOf();
    default:
      return null;
  }
}

export function getNextSerialNumberCounter(counter: SerialNumberCounter = {}, countingRule?: CountingRule): SerialNumberCounter {
  if (!countingRule) {
    return counter;
  }

  const nextCounter = {
    ...counter,
  };

  if (!nextCounter.resetTime && countingRule.value.resetCycle !== 'none') {
    nextCounter.resetTime = getResetTimestamp(countingRule.value.resetCycle) ?? null;
  }

  if (nextCounter.resetTime !== null && nextCounter.resetTime !== undefined && dayjs().valueOf() > nextCounter.resetTime) {
    nextCounter.count = Number(countingRule.value.startValue ?? 0);
    nextCounter.resetTime = getResetTimestamp(countingRule.value.resetCycle) ?? null;
  } else {
    nextCounter.count = nextCounter.count === undefined ? Number(countingRule.value.startValue ?? 0) : nextCounter.count + 1;
  }

  nextCounter.updateTime = Date.now();

  return nextCounter;
}

export function flattenDepartments<T extends { children?: T[] }>(departments: T[] = []): T[] {
  const result: T[] = [];

  const dfs = (list: T[] = []) => {
    for (const item of list) {
      result.push(item);
      if (item?.children?.length) {
        dfs(item.children);
      }
    }
  };

  dfs(departments);
  return result;
}

function normalizeFieldValue(value: any) {
  if (Array.isArray(value)) {
    return value.filter(item => item !== undefined && item !== null && item !== "");
  }

  if (typeof value === "string" && value.includes(",")) {
    return value
      .split(",")
      .map(item => item.trim())
      .filter(item => item !== "");
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

function getOrganizeItemName(item: any) {
  return item?.realname || item?.name || item?.label || item?.id || "";
}

function getOrganizeItemId(item: any) {
  return item?.id ?? item?.uid ?? item?.value;
}

function isSameOrganizeItem(source: any, value: any) {
  const sourceId = getOrganizeItemId(source);
  const valueId = typeof value === "object" ? getOrganizeItemId(value) : value;

  if (sourceId === undefined || sourceId === null || valueId === undefined || valueId === null) {
    return false;
  }

  return String(sourceId) === String(valueId);
}

function formatOrganizeFieldValue(value: any, sourceList: any[] = []) {
  return normalizeFieldValue(value)
    .map((item) => {
      const matched = sourceList.find(source => isSameOrganizeItem(source, item));
      if (matched) {
        return getOrganizeItemName(matched);
      }

      if (typeof item === "object") {
        return getOrganizeItemName(item);
      }

      return String(item ?? "");
    })
    .filter(Boolean)
    .join("");
}

function formatFieldValue(fieldWidget: any, value: any) {
  if (fieldWidget?.type === "widget.form.memberSelect") {
    return formatOrganizeFieldValue(value, fieldWidget?.allUserList || []);
  }

  if (fieldWidget?.type === "widget.form.departmentSelect") {
    return formatOrganizeFieldValue(value, flattenDepartments(fieldWidget?.allDepartmentsList || []));
  }

  if (fieldWidget?.type === "widget.form.datePicker" && value) {
    if (typeof fieldWidget.formatDateValue === "function") {
      return fieldWidget.formatDateValue(value) ?? value;
    }
    const format = typeof fieldWidget.format === "string" ? fieldWidget.format : "";
    const date = dayjs(value);
    if (format && date.isValid()) {
      return date.format(format);
    }
  }

  return value ?? "";
}

export function formatSerialNumber(serialNumber: number, serialNumberRules: any, widget: SerialNumber, row?: Record<string, any>): string {
  const countingRule = serialNumberRules?.find(item => item.type === 'counting');

  let textSerialNumber = "";
  for (const rule of serialNumberRules) {
    switch (rule.type) {
      case "date":
        const format = rule.value.optionalFormat === "custom" ? rule.value.customFormat : rule.value.optionalFormat;
        const now = dayjs();
        const timeStr = now.format(format);
        textSerialNumber += timeStr;
        break;
      case "field":
        const fieldWidget = widget.form.children.find(child => ((child as any).originId ?? child.uid) === rule.value) as FormElement;
        if (row && fieldWidget?.fieldId) {
          textSerialNumber += formatFieldValue(fieldWidget, row[fieldWidget.fieldId]);
        } else {
          textSerialNumber += formatFieldValue(fieldWidget, fieldWidget?.inputValue);
        }
        break;
      case "prefix":
        textSerialNumber += rule.value;
        break;
      case "counting":
        textSerialNumber += countingRule?.value.digitFixed ? String(serialNumber).padStart(rule.value.digitLength, '0') : String(serialNumber);
        break;
    }
  }

  return textSerialNumber;
}
