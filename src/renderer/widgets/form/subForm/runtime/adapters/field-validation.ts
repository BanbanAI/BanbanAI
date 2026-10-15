
export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

export type RuntimeValidateRules = {
  readonly numberRangeEnabled: boolean;
  readonly numberRange?: readonly number[];
  readonly wordLimit: boolean;
  readonly wordRange?: readonly number[];
  readonly validationFormat?: string;
  readonly choiceLimit: boolean;
  readonly choiceRange?: readonly number[];
  readonly uploadCountLimit: boolean;
  readonly uploadCountRange?: readonly number[];
  readonly uploadMaxSizeMb?: number;
  readonly uploadExtensions?: readonly string[];
  readonly linkType?: string;
  readonly organizeCurrentDepartmentDefault?: boolean;
};

const ORGANIZE_DYNAMIC_CURRENT_DEPARTMENT = "currentDepartment";

const isCurrentDepartmentDynamicDefault = (extra: Record<string, unknown>) => {
  if (Array.isArray(extra.defaultValueDynamic)) {
    return extra.defaultValueDynamic.includes(ORGANIZE_DYNAMIC_CURRENT_DEPARTMENT);
  }
  const defaultValue = extra.defaultValue;
  if (!defaultValue || typeof defaultValue !== "object" || Array.isArray(defaultValue)) return false;
  const dynamic = (defaultValue as { dynamic?: unknown }).dynamic;
  return Array.isArray(dynamic) && dynamic.includes(ORGANIZE_DYNAMIC_CURRENT_DEPARTMENT);
};

const defaultTranslate: TranslateFn = key => key;

const MOBILE_PHONE_PATTERN = /^(?:(?:\+|00)86)?1\d{10}$/;
const TELEPHONE_PATTERN = /^(?:(?:\d{3}-)?\d{8}|^(?:\d{4}-)?\d{7,8})(?:-\d+)?$/;
const ID_NUMBER_PATTERN = /^\d{6}((((((19|20)\d{2})(0[13-9]|1[012])(0[1-9]|[12]\d|30))|(((19|20)\d{2})(0[13578]|1[02])31)|((19|20)\d{2})02(0[1-9]|1\d|2[0-8])|((((19|20)([13579][26]|[2468][048]|0[48]))|(2000))0229))\d{3})|((((\d{2})(0[13-9]|1[012])(0[1-9]|[12]\d|30))|((\d{2})(0[13578]|1[02])31)|((\d{2})02(0[1-9]|1\d|2[0-8]))|(([13579][26]|[2468][048]|0[048])0229))\d{2}))(\d|X|x)$/;
const EMAIL_PATTERN = /^[A-Za-z0-9\u4e00-\u9fa5]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/;
const LICENSE_PLATE_PATTERNS = [
  /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][A-HJ-NP-Z0-9]{4,5}([A-HJ-NP-Z0-9挂学警领]|应急)$/,
  /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z](([DF][A-HJ-NP-Z0-9][0-9]{4,5})|([0-9]{5}[DF]))$/,
  /^粤Z[A-HJ-NP-Z0-9]{4,5}[港澳]$/,
  /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼]([A-Z][0-9A-Z]{4}|[0-9]{5})领$/,
  /^(使[0-9]{6}|[0-9]{6}使)$/,
];

const NUMBER_FIELD_TYPES = ["widget.form.numberInput", "widget.form.amountInput"];
const TEXT_FIELD_TYPES = ["widget.form.textInput", "widget.form.textareaInput"];
const UPLOAD_FIELD_TYPES = ["widget.form.file-uploader", "widget.form.image-uploader"];
const TREE_SELECT_TYPE = "widget.form.treeSelect";

const toRange = (value: unknown): readonly number[] | undefined => {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const [min, max] = value;
  if (typeof min !== "number" || typeof max !== "number") return undefined;
  return [min, max];
};

const toValueList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return String(value).split(",").map(item => item.trim()).filter(Boolean);
};

const normalizeExtensions = (raw: unknown): readonly string[] | undefined => {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const extensions = raw.split(",")
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
    .map(ext => (ext.startsWith(".") ? ext : `.${ext}`));
  return extensions.length ? extensions : undefined;
};

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export type RuntimeFieldLike = { type?: string };

export function compileValidateRules(widget: RuntimeFieldLike, extra: Record<string, unknown>): RuntimeValidateRules {
  const type = String(widget?.type || "");
  const numberRange = toRange(extra.range);
  const wordRange = toRange(extra.wordRange);
  const choiceRange = toRange(extra.optionCountRange);
  const uploadCountRange = toRange(extra.limitCountRange);
  const uploadMaxSize = typeof extra.limitSizeRange === "number" && extra.limitSizeRange > 0
    ? extra.limitSizeRange
    : undefined;
  const supportsChoiceLimit = type === "widget.form.checkboxGroup" || extra.isMultiple === true;
  return Object.freeze({
    numberRangeEnabled: extra.numberRange === true && !!numberRange,
    numberRange,
    wordLimit: extra.wordLimit === true && !!wordRange,
    wordRange,
    validationFormat: typeof extra.validationFormat === "string" ? extra.validationFormat : undefined,
    choiceLimit: supportsChoiceLimit && extra.optionLimit === true && !!choiceRange,
    choiceRange,
    uploadCountLimit: extra.limitCount === true && !!uploadCountRange,
    uploadCountRange,
    uploadMaxSizeMb: extra.limitSize === true ? uploadMaxSize : undefined,
    uploadExtensions: extra.limitType === true ? normalizeExtensions(extra.limitTypeText) : undefined,
    linkType: typeof extra.linkType === "string" ? extra.linkType : undefined,
    organizeCurrentDepartmentDefault: type === "widget.form.departmentSelect"
      && isCurrentDepartmentDynamicDefault(extra),
  });
}

function matchTextFormatKey(format: string | undefined, text: string): string | undefined {
  if (!format) return undefined;
  if (format === "mobile-phone") return MOBILE_PHONE_PATTERN.test(text) ? undefined : "invalidMobilePhone";
  if (format === "telephone") return TELEPHONE_PATTERN.test(text) ? undefined : "invalidTelephone";
  if (format === "ID-number") return ID_NUMBER_PATTERN.test(text) ? undefined : "invalidIdNumber";
  if (format === "email") return EMAIL_PATTERN.test(text) ? undefined : "invalidEmail";
  if (format === "license-plate") {
    const cleaned = text.trim().toUpperCase().replace(/[\s·]/g, "");
    return LICENSE_PLATE_PATTERNS.some(pattern => pattern.test(cleaned)) ? undefined : "licensePlateError";
  }
  return undefined;
}

export function validateFieldValue(
  widget: RuntimeFieldLike,
  rules: RuntimeValidateRules,
  value: unknown,
  translate: TranslateFn = defaultTranslate,
): string | undefined {
  if (NUMBER_FIELD_TYPES.includes(widget.type)) {
    if (value === undefined || value === null || value === "") return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    if (Math.abs(numeric) > Number.MAX_SAFE_INTEGER) return translate("numberExceedsMax");
    if (rules.numberRangeEnabled && rules.numberRange) {
      const [min, max] = rules.numberRange;
      if (numeric < min || numeric > max) return translate("numberOutOfRange", { min, max });
    }
    return undefined;
  }

  if (TEXT_FIELD_TYPES.includes(widget.type)) {
    const text = String(value ?? "");
    if (rules.wordLimit && rules.wordRange) {
      const [min, max] = rules.wordRange;
      if (text.length < min || text.length > max) return translate("wordCountOutOfRange", { min, max });
    }
    if (!text) return undefined;
    const formatKey = matchTextFormatKey(rules.validationFormat, text);
    return formatKey ? translate(formatKey) : undefined;
  }

  if (widget.type === "widget.form.phoneInput") {
    const text = String(value ?? "");
    return text && !MOBILE_PHONE_PATTERN.test(text) ? translate("invalidMobilePhone") : undefined;
  }

  if (rules.choiceLimit && rules.choiceRange) {
    const list = toValueList(value);
    const [min, max] = rules.choiceRange;
    if (list.length < min || list.length > max) {
      return widget.type === TREE_SELECT_TYPE
        ? translate("selectCountRange", { min, max })
        : `${translate("needSelect")}${min}~${max}${translate("item")}`;
    }
    return undefined;
  }

  if (UPLOAD_FIELD_TYPES.includes(widget.type)) {
    const list = Array.isArray(value) ? value : [];
    const isImage = widget.type === "widget.form.image-uploader";
    if (rules.uploadCountLimit && rules.uploadCountRange) {
      const [min, max] = rules.uploadCountRange;
      if (list.length < min) return translate(isImage ? "minImageCountError" : "minFileCountError", { count: min });
      if (list.length > max) return translate(isImage ? "maxImageCountError" : "maxFileCountError", { count: max });
    }
    if (rules.uploadMaxSizeMb !== undefined) {
      const limit = rules.uploadMaxSizeMb * 1024 * 1024;
      for (const item of list) {
        const size = Number((item as Record<string, unknown> | null)?.size);
        if (Number.isFinite(size) && size > limit) {
          return translate(isImage ? "maxImageSizeError" : "maxFileSizeError", { size: rules.uploadMaxSizeMb });
        }
      }
    }
    if (rules.uploadExtensions?.length) {
      for (const item of list) {
        const name = String((item as Record<string, unknown> | null)?.name || "").toLowerCase();
        if (name && !rules.uploadExtensions.some(ext => name.endsWith(ext))) {
          return translate(isImage ? "imageFormatError" : "fileFormatError", {
            types: rules.uploadExtensions.join(","),
          });
        }
      }
    }
    return undefined;
  }

  if (widget.type === "widget.form.hyperlink") {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "object" && Object.keys(value as Record<string, unknown>).length === 0) return undefined;
    if (rules.linkType !== "form" && !isValidUrl(String(value))) return translate("invalidUrl");
    return undefined;
  }

  return undefined;
}
