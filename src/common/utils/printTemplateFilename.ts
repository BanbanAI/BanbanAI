import type { Field, Row } from "@common/types/project";
import type { PrintTemplate, PrintTemplateExportNameSegment } from "@common/types/nocode";
import {
  FormWidgetType,
  PrintTemplateExportNameMode,
  PrintTemplateMode,
} from "@common/types/nocode";

const printableFilenameWidgetTypes = new Set<string>([
  FormWidgetType.TEXT_INPUT,
  FormWidgetType.TEXTAREA,
  FormWidgetType.TAG_INPUT,
  FormWidgetType.NUMBER_INPUT,
  FormWidgetType.DATE_PICKER,
  FormWidgetType.TIME_PICKER,
  FormWidgetType.RADIO_GROUP,
  FormWidgetType.CHECKBOX_GROUP,
  FormWidgetType.TREE_SELECT,
  FormWidgetType.TREE_MULTIPLE_SELECT,
  FormWidgetType.MEMBER_SELECT,
  FormWidgetType.DEPARTMENT_SELECT,
]);

export const getPrintableFilenameFields = (fields: Field[] = []) => {
  return (fields || []).filter(field => {
    const widgetType = field?.meta?.extra?.widgetType;
    return !!widgetType && printableFilenameWidgetTypes.has(widgetType);
  });
};

export const normalizePrintTemplateFilenameSegments = (
  segments?: PrintTemplateExportNameSegment[] | null,
): PrintTemplateExportNameSegment[] => {
  const normalized: PrintTemplateExportNameSegment[] = [];

  for (const segment of segments || []) {
    if (segment?.type === "text") {
      const value = String(segment.value || "");
      if (!value) continue;
      const lastSegment = normalized.at(-1);
      if (lastSegment?.type === "text") {
        lastSegment.value += value;
      } else {
        normalized.push({ type: "text", value });
      }
      continue;
    }

    if (segment?.type === "field") {
      const fieldUid = String(segment.fieldUid || "").trim();
      if (!fieldUid) continue;
      normalized.push({ type: "field", fieldUid });
    }
  }

  return normalized;
};

export const hasPrintTemplateFilenameFieldSegments = (
  segments?: PrintTemplateExportNameSegment[] | null,
) => {
  return normalizePrintTemplateFilenameSegments(segments).some(segment => segment.type === "field");
};

export const stringifyPrintTemplateFilenameSegments = (
  segments?: PrintTemplateExportNameSegment[] | null,
) => {
  return normalizePrintTemplateFilenameSegments(segments).map(segment => {
    if (segment.type === "text") return segment.value;
    return `\${${segment.fieldUid}}`;
  }).join("");
};

const stringifyObjectValue = (value: Record<string, any>): string => {
  const preferredValue = value.realname
    ?? value.name
    ?? value.label
    ?? value.title
    ?? value.text
    ?? value.value
    ?? value.id
    ?? value.uid;

  if (preferredValue === value) return "";
  return stringifyPrintTemplateFieldValue(preferredValue);
};

export const stringifyPrintTemplateFieldValue = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return value.map(item => stringifyPrintTemplateFieldValue(item)).filter(Boolean).join("、");
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const objectValue = value as Record<string, any>;
    if (typeof objectValue.format === "function") {
      try {
        return String(objectValue.format("YYYY-MM-DD HH:mm:ss") || "");
      } catch (_error) {
        return "";
      }
    }
    return stringifyObjectValue(objectValue);
  }
  return String(value);
};

export const renderPrintTemplateFilenameSegments = (
  segments: PrintTemplateExportNameSegment[] | null | undefined,
  row: Row | null | undefined,
  fields: Field[] = [],
) => {
  const printableFieldUids = new Set(getPrintableFilenameFields(fields).map(field => field.uid));
  return normalizePrintTemplateFilenameSegments(segments).map(segment => {
    if (segment.type === "text") return segment.value;
    if (!printableFieldUids.has(segment.fieldUid as Field["uid"])) return "";
    return stringifyPrintTemplateFieldValue(row?.[segment.fieldUid as Field["uid"]]);
  }).join("");
};

export const sanitizePrintTemplateFilename = (
  filename: unknown,
  options: { replaceChar?: string, trim?: boolean, allowDots?: boolean, maxLen?: number } = {},
) => {
  const {
    replaceChar = "_",
    trim = true,
    allowDots = true,
    maxLen = 255,
  } = options;

  let clean = String(filename ?? "");
  if (trim) clean = clean.trim();
  clean = clean.replace(/[\\/:*?"<>|]/g, replaceChar);
  clean = clean.replace(new RegExp(`\\${replaceChar}+`, "g"), replaceChar);
  if (!allowDots) clean = clean.replace(/\./g, replaceChar);
  if (clean.length > maxLen) {
    const extStart = allowDots ? clean.lastIndexOf(".") : -1;
    const ext = extStart > 0 ? clean.slice(extStart) : "";
    clean = clean.slice(0, Math.max(0, maxLen - ext.length)) + ext;
  }
  return clean;
};

export type BuildPrintTemplateBaseNameOptions = {
  template: Pick<PrintTemplate, "mode" | "exportNameMode" | "exportNameValue" | "exportNameSegments" | "file">;
  tableAlias: string;
  row?: Row | null;
  fields?: Field[];
  titleValue?: unknown;
  useRowForMultiple?: boolean;
};

export const buildPrintTemplateBaseName = (options: BuildPrintTemplateBaseNameOptions) => {
  const { template, tableAlias, row, fields = [], titleValue, useRowForMultiple = false } = options;
  const fallbackName = tableAlias || template.file?.name || "print";
  let rawName = fallbackName;

  if (template.exportNameMode === PrintTemplateExportNameMode.DATA_TITLE) {
    if (template.mode === PrintTemplateMode.MULTIPLE && !useRowForMultiple) {
      rawName = tableAlias || fallbackName;
    } else {
      rawName = String(titleValue || template.file?.name || fallbackName);
    }
  } else if (template.exportNameMode === PrintTemplateExportNameMode.CUSTOM) {
    const segments = normalizePrintTemplateFilenameSegments(template.exportNameSegments);
    if (segments.length > 0) {
      rawName = renderPrintTemplateFilenameSegments(segments, row, fields) || fallbackName;
    } else if (template.mode === PrintTemplateMode.MULTIPLE && !useRowForMultiple) {
      rawName = tableAlias || fallbackName;
    } else {
      rawName = template.exportNameValue || fallbackName;
    }
  }

  return sanitizePrintTemplateFilename(rawName) || sanitizePrintTemplateFilename(fallbackName) || "print";
};

export const shouldAppendTimestampForPrintTemplateName = (
  template: Pick<PrintTemplate, "exportNameMode" | "exportNameSegments">,
) => {
  return !(
    template.exportNameMode === PrintTemplateExportNameMode.CUSTOM
    && hasPrintTemplateFilenameFieldSegments(template.exportNameSegments)
  );
};

export type BuildPrintTemplateFileNameOptions = {
  baseName: string;
  extension: string;
  exists?: (fileName: string) => boolean;
};

export const buildPrintTemplateFileName = (options: BuildPrintTemplateFileNameOptions) => {
  const extension = options.extension.startsWith(".") ? options.extension : `.${options.extension}`;
  const baseName = sanitizePrintTemplateFilename(options.baseName, { maxLen: 255 - extension.length }) || "print";
  const exists = options.exists || (() => false);
  const firstFileName = `${baseName}${extension}`;
  if (!exists(firstFileName)) return firstFileName;

  let index = 1;
  while (true) {
    const suffix = `(${index})`;
    const nextBaseName = sanitizePrintTemplateFilename(baseName, { maxLen: 255 - extension.length - suffix.length }) || "print";
    const fileName = `${nextBaseName}${suffix}${extension}`;
    if (!exists(fileName)) return fileName;
    index += 1;
  }
};
