export enum HiddenFieldSubmitMode {
  RECALCULATE = "recalculate",
  KEEP_ORIGINAL = "keep-original",
  EMPTY = "empty",
}

export const DEFAULT_HIDDEN_FIELD_SUBMIT_MODE = HiddenFieldSubmitMode.RECALCULATE;

export const HIDDEN_FIELD_SUBMIT_MODE_OPTION = "hidden-field-submit-mode";
export const HIDDEN_FIELD_SUBMIT_SPECIAL_RULES_OPTION = "hidden-field-submit-special-rules";

export type HiddenFieldSubmitSpecialRules = Record<string, HiddenFieldSubmitMode>;

const isHiddenFieldSubmitMode = (value: unknown): value is HiddenFieldSubmitMode => {
  return value === HiddenFieldSubmitMode.RECALCULATE
    || value === HiddenFieldSubmitMode.KEEP_ORIGINAL
    || value === HiddenFieldSubmitMode.EMPTY;
};

export const normalizeHiddenFieldSubmitMode = (value: unknown): HiddenFieldSubmitMode => {
  return isHiddenFieldSubmitMode(value) ? value : DEFAULT_HIDDEN_FIELD_SUBMIT_MODE;
};

export const normalizeHiddenFieldSubmitSpecialRules = (value: unknown): HiddenFieldSubmitSpecialRules => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<HiddenFieldSubmitSpecialRules>((prev, [fieldPath, mode]) => {
    if (!fieldPath || !isHiddenFieldSubmitMode(mode)) {
      return prev;
    }
    prev[fieldPath] = mode;
    return prev;
  }, {});
};

export const getHiddenFieldSubmitMode = (
  options: Record<string, unknown> | null | undefined,
  fieldPath: string,
): HiddenFieldSubmitMode => {
  const specialRules = normalizeHiddenFieldSubmitSpecialRules(options?.[HIDDEN_FIELD_SUBMIT_SPECIAL_RULES_OPTION]);
  return specialRules[fieldPath] ?? normalizeHiddenFieldSubmitMode(options?.[HIDDEN_FIELD_SUBMIT_MODE_OPTION]);
};
