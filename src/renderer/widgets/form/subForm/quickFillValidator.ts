import { Department } from "@common/types/account";
import { FormElement } from "@renderer/b2/controllers/form";
import { customDayjs } from "./utils";
import { validateQuickFillAddress } from "./quickFillAddress";
import type {
  QuickFillCellIssue,
  QuickFillColumn,
  QuickFillDraftRow,
  QuickFillMappingItem,
  QuickFillIssueType,
  QuickFillValidationCell,
  QuickFillValidationResult,
  QuickFillValidationRow
} from "./quickFillTypes";
import { SubForm } from "./subForm";
import i18next from "@renderer/widgets/i18next";

const ISSUE_MESSAGE_MAP: Record<QuickFillIssueType, string> = {
  option_not_matched: i18next.t("quickFillOptionNotMatched"),
  address_not_matched: i18next.t("quickFillAddressNotMatched"),
};

export async function validateQuickFillRows(
  subForm: SubForm,
  rows: QuickFillDraftRow[],
  columns: QuickFillColumn[],
  mapping: Record<string, QuickFillMappingItem["targetFieldId"]>,
): Promise<QuickFillValidationResult> {
  const issues: QuickFillCellIssue[] = [];
  const mappedByFieldId = new Map(columns.map(column => [column.fieldId, column]));
  const resultRows: QuickFillValidationRow[] = [];

  for (const row of rows) {
    const valueMap: Record<string, QuickFillValidationCell> = {};

    for (const column of columns) {
      const targetFieldId = mapping[column.key];
      const rawValue = row.values?.[column.fieldId];

      if (!targetFieldId || targetFieldId === "skip") {
        valueMap[column.fieldId] = {
          rawValue,
          normalizedValue: rawValue,
        };
        continue;
      }

      const targetColumn = mappedByFieldId.get(targetFieldId);
      if (!targetColumn) {
        valueMap[column.fieldId] = {
          rawValue,
          normalizedValue: rawValue,
        };
        continue;
      }

      const cell = await normalizeCellValue(subForm, targetColumn.widget, rawValue);
      if (cell.issue) {
        const issue: QuickFillCellIssue = {
          ...cell.issue,
          rowId: row.id,
          columnKey: column.key,
        };
        cell.issue = issue;
        issues.push(issue);
      }
      valueMap[column.fieldId] = cell;
    }

    resultRows.push({
      id: row.id,
      values: valueMap,
      meta: row.meta,
    });
  }

  return {
    rows: resultRows,
    issues,
  };
}

export async function normalizeCellValue(subForm: SubForm, widget: FormElement, rawValue: any): Promise<QuickFillValidationCell> {
  if (isBlankValue(rawValue)) {
    return {
      rawValue,
      normalizedValue: undefined,
    };
  }

  switch (widget.type) {
    case "widget.form.textInput":
    case "widget.form.textarea":
      return {
        rawValue,
        normalizedValue: String(rawValue),
      };
    case "widget.form.numberInput":
    case "widget.form.amountInput": {
      const numericValue = Number(rawValue);
      return {
        rawValue,
        normalizedValue: Number.isNaN(numericValue) ? undefined : numericValue,
      };
    }
    case "widget.form.datePicker": {
      const instance = customDayjs(String(rawValue));
      const format = widget.field?.meta?.extra?.format || "YYYY-MM-DD HH:mm:ss";
      return {
        rawValue,
        normalizedValue: instance?.isValid() ? instance.format(format) : undefined,
      };
    }
    case "widget.form.radioGroup":
    case "widget.form.treeSelect":
      return normalizeSingleChoice(widget as any, rawValue);
    case "widget.form.checkboxGroup":
    case "widget.form.treeMultipleSelect":
      return normalizeMultipleChoice(widget as any, rawValue);
    case "widget.form.memberSelect":
      return normalizeMemberValue(subForm, rawValue);
    case "widget.form.departmentSelect":
      return normalizeDepartmentValue(subForm, rawValue);
    case "widget.form.address":
      return await normalizeAddressValue(widget as any, rawValue);
    default:
      return {
        rawValue,
        normalizedValue: rawValue,
      };
  }
}

function normalizeSingleChoice(widget: any, rawValue: any): QuickFillValidationCell {
  const normalized = String(rawValue).trim();
  const options = getWidgetOptions(widget);
  const matched = options.find(option => option === normalized);
  if (matched) {
    return {
      rawValue,
      normalizedValue: matched,
    };
  }

  if (widget?.customOption?.otherOptions?.value) {
    return {
      rawValue,
      normalizedValue: normalized,
    };
  }

  return {
    rawValue,
    normalizedValue: undefined,
    issue: createIssue("option_not_matched", rawValue),
  };
}

function normalizeMultipleChoice(widget: any, rawValue: any): QuickFillValidationCell {
  const optionValues = new Set(getWidgetOptions(widget));
  const parts = splitMultipleText(rawValue);
  const matchedValues: string[] = [];
  const unmatchedValues: string[] = [];

  parts.forEach((item) => {
    if (optionValues.has(item)) {
      matchedValues.push(item);
      return;
    }
    unmatchedValues.push(item);
  });

  if (unmatchedValues.length === 0) {
    return {
      rawValue,
      normalizedValue: matchedValues,
    };
  }

  if (widget?.customOption?.otherOptions?.value) {
    return {
      rawValue,
      normalizedValue: [...matchedValues, unmatchedValues.join("、")],
    };
  }

  return {
    rawValue,
    normalizedValue: matchedValues,
    issue: createIssue("option_not_matched", unmatchedValues.join("、")),
  };
}

async function normalizeMemberValue(subForm: SubForm, rawValue: any): Promise<QuickFillValidationCell> {
  if (Array.isArray(rawValue) && rawValue.every(value => typeof value === "string")) {
    return {
      rawValue,
      normalizedValue: rawValue,
    };
  }

  const names = splitMultipleText(rawValue);
  const users = await subForm.getBoard().getOrganizeUsers();
  const matchedIds = names
    .map(name => users.find(user => user.realname === name || user.id === name)?.id)
    .filter(Boolean);

  if (matchedIds.length === names.length) {
    return {
      rawValue,
      normalizedValue: matchedIds,
    };
  }

  return {
    rawValue,
    normalizedValue: matchedIds,
    issue: createIssue("option_not_matched", rawValue),
  };
}

async function normalizeDepartmentValue(subForm: SubForm, rawValue: any): Promise<QuickFillValidationCell> {
  if (Array.isArray(rawValue) && rawValue.every(value => typeof value === "string")) {
    return {
      rawValue,
      normalizedValue: rawValue,
    };
  }

  const names = splitMultipleText(rawValue);
  const departmentList = flattenDepartments(await subForm.getBoard().getOrganizeDepartments());
  const matchedIds = names
    .map(name => departmentList.find(dep => dep.name === name || dep.id === name)?.id)
    .filter(Boolean);

  if (matchedIds.length === names.length) {
    return {
      rawValue,
      normalizedValue: matchedIds,
    };
  }

  return {
    rawValue,
    normalizedValue: matchedIds,
    issue: createIssue("option_not_matched", rawValue),
  };
}

async function normalizeAddressValue(widget: any, rawValue: any): Promise<QuickFillValidationCell> {
  const matched = await validateQuickFillAddress(String(rawValue), widget.addressPrecision || 3);
  if (!matched.valid) {
    return {
      rawValue,
      normalizedValue: undefined,
      issue: createIssue("address_not_matched", rawValue),
    };
  }

  const normalizedValue = [matched.regionPath, matched.detail].filter(Boolean).join(" ").trim();
  return {
    rawValue,
    normalizedValue,
  };
}

function getWidgetOptions(widget: any): string[] {
  if (Array.isArray(widget?.radioList)) {
    return widget.radioList.map(item => item.value);
  }
  if (Array.isArray(widget?.checkboxList)) {
    return widget.checkboxList.map(item => item.value);
  }
  if (Array.isArray(widget?.primaryTreeList)) {
    return widget.primaryTreeList.map(item => item.value);
  }
  if (Array.isArray(widget?.treeList)) {
    return widget.treeList.map(item => item.value);
  }

  const choices = widget?.field?.meta?.extra?.choices || [];
  return choices.map(item => item?.value).filter(Boolean);
}

function createIssue(type: QuickFillIssueType, rawValue: any) {
  return {
    rowId: "",
    columnKey: "",
    type,
    message: type === "option_not_matched"
      ? i18next.t("quickFillOptionNotMatchedWithValue", { value: String(rawValue) })
      : ISSUE_MESSAGE_MAP[type],
    rawValue,
    fallbackOnApply: "empty" as const,
  };
}

function splitMultipleText(rawValue: any) {
  if (Array.isArray(rawValue)) {
    return rawValue.map(item => String(item).trim()).filter(Boolean);
  }

  return String(rawValue)
    .split(/[,，、]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function flattenDepartments(departments: Department[]) {
  const result: Department[] = [];

  const dfs = (items: Department[]) => {
    items.forEach((item) => {
      result.push(item);
      if (Array.isArray(item.children) && item.children.length > 0) {
        dfs(item.children);
      }
    });
  };

  dfs(departments || []);
  return result;
}

function isBlankValue(value: any) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
