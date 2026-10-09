import { Department, Role } from "@common/types/account";
import dayjs from 'dayjs';
import { FormElement } from '@renderer/b2/controllers/form';

export * from "./organize.util";
export * from "./process-back-node";
export * from "./todo";
export * from "./viewPermission";

export type TreeData<T> = T & {
  children?: TreeData<T>[]
}
export const buildTree = <T extends (Department | Role) = (Department | Role)>(data: T[]): TreeData<T>[] => {
  const map = new Map<string, TreeData<T>>();
  const tree: TreeData<T>[] = [];

  for (const item of data) {
    map.set(item.id, { ...item, children: [] });
  }

  // 组织树结构
  for (const item of data) {
    if (item.parent && item.id !== item.parent) {
      const parent = map.get(item.parent);
      if (parent) {
        parent.children.push(map.get(item.id));
      }
    } else {
      tree.push(map.get(item.id));
    }
  }

  return tree;
};

function flattenDepartments<T extends { children?: T[] }>(departments: T[] = []): T[] {
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

function getOrganizeItemId(item: any) {
  return item?.id ?? item?.uid ?? item?.value;
}

function getOrganizeItemName(item: any) {
  return item?.realname || item?.name || item?.user || item?.label || item?.id || "";
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

export function formatSerialNumber(serialNumber: number, serialNumberRules: any, widget: FormElement): string {
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
        if (widget) {
          const fieldWidget = widget.form.getChildElement(rule.value);
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

export * from "@renderer/utils/api";
