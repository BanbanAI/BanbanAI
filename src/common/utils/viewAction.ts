import {
  FormWidgetType,
  ViewAction,
  ViewActionBehaviorType,
  ViewActionTarget,
  ViewActionTriggerMode,
  ViewActionViewConditionMode,
} from "@common/types/nocode";
import { Field, FlowOpinionFile } from "@common/types/project";

const unsupportedViewActionCustomValueWidgetTypes = new Set<FormWidgetType>([
  FormWidgetType.DATE_RANGE_PICKER,
  FormWidgetType.SELECT_DATA,
  FormWidgetType.RELATED_DATA,
]);

export const getViewActionFieldWidgetType = (field?: Pick<Field, "meta"> | null) => {
  return field?.meta?.extra?.widgetType as FormWidgetType | undefined;
};

export const isViewActionUploadWidgetType = (widgetType?: string | null): widgetType is FormWidgetType.FILE_UPLOADER | FormWidgetType.IMAGE_UPLOADER => {
  return widgetType === FormWidgetType.FILE_UPLOADER
    || widgetType === FormWidgetType.IMAGE_UPLOADER;
};

export const isViewActionUploadField = (field?: Pick<Field, "meta"> | null) => {
  return isViewActionUploadWidgetType(getViewActionFieldWidgetType(field));
};

export const isViewActionUploadFieldMultiple = (field?: Pick<Field, "meta"> | null) => {
  return !!field?.meta?.extra?.isMultiple;
};

export const canViewActionFieldUseCustomValue = (field?: Pick<Field, "meta"> | null) => {
  const widgetType = getViewActionFieldWidgetType(field);
  if (!widgetType) {
    return true;
  }
  return !unsupportedViewActionCustomValueWidgetTypes.has(widgetType);
};

export const canViewActionEditFieldBeConfigured = (field?: Pick<Field, "meta"> | null) => {
  const widgetType = getViewActionFieldWidgetType(field);
  return widgetType !== FormWidgetType.DATE_RANGE_PICKER;
};

export const isViewActionUploadFile = (value: any): value is FlowOpinionFile => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return typeof value.name === "string"
    && value.name.trim().length > 0
    && typeof value.url === "string"
    && value.url.trim().length > 0;
};

export const getDefaultViewActionViewConditionMode = (triggerMode: ViewActionTriggerMode) => {
  return triggerMode === ViewActionTriggerMode.VIEW_CONTEXT_ONCE
    ? ViewActionViewConditionMode.ALWAYS
    : ViewActionViewConditionMode.HAS_DATA;
};

export const normalizeViewActionTarget = (
  target?: ViewActionTarget | "view" | "record" | null,
) => {
  if (target === ViewActionTarget.VIEW_SELECTED) {
    return ViewActionTarget.VIEW_SELECTED;
  }
  if (target === ViewActionTarget.RECORD) {
    return ViewActionTarget.RECORD;
  }
  return ViewActionTarget.VIEW_ALL;
};

export const isViewActionRecordTarget = (
  target?: ViewActionTarget | "view" | "record" | null,
) => {
  return normalizeViewActionTarget(target) === ViewActionTarget.RECORD;
};

export const isViewActionViewTarget = (
  target?: ViewActionTarget | "view" | "record" | null,
) => {
  const normalizedTarget = normalizeViewActionTarget(target);
  return normalizedTarget === ViewActionTarget.VIEW_ALL
    || normalizedTarget === ViewActionTarget.VIEW_SELECTED;
};

export const isViewActionSelectedTarget = (
  target?: ViewActionTarget | "view" | "record" | null,
) => {
  return normalizeViewActionTarget(target) === ViewActionTarget.VIEW_SELECTED;
};

export const isViewActionViewConditionModeAllowed = (
  triggerMode: ViewActionTriggerMode,
  mode?: ViewActionViewConditionMode | null,
) => {
  if (!mode) {
    return false;
  }

  if (triggerMode === ViewActionTriggerMode.EACH_RECORD) {
    return mode === ViewActionViewConditionMode.ALWAYS
      || mode === ViewActionViewConditionMode.HAS_DATA;
  }

  return mode === ViewActionViewConditionMode.ALWAYS
    || mode === ViewActionViewConditionMode.HAS_DATA
    || mode === ViewActionViewConditionMode.NO_DATA;
};

export const normalizeViewActionViewConditionMode = (
  triggerMode: ViewActionTriggerMode,
  mode?: ViewActionViewConditionMode | null,
) => {
  return isViewActionViewConditionModeAllowed(triggerMode, mode)
    ? mode as ViewActionViewConditionMode
    : getDefaultViewActionViewConditionMode(triggerMode);
};

export const getViewActionTriggerMode = (
  action?: Pick<ViewAction, "target" | "behavior" | "executeCondition"> | null,
) => {
  if (action?.behavior?.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
    return ViewActionTriggerMode.EACH_RECORD;
  }

  const rawTriggerMode = action.behavior.config?.triggerMode;
  if (
    rawTriggerMode === ViewActionTriggerMode.EACH_RECORD
    || rawTriggerMode === ViewActionTriggerMode.VIEW_CONTEXT_ONCE
  ) {
    return rawTriggerMode;
  }

  return ViewActionTriggerMode.EACH_RECORD;
};
