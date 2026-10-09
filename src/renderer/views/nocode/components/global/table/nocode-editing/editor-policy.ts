import { FormWidgetType } from "../../../../../../../common/types/nocode";
import type { NocodeTableEditorType } from "./types";

export type NocodeTableEditorPolicy = {
  type: NocodeTableEditorType;
  presentationMode: "inline" | "popup";
  commitOnEnter: boolean;
  commitOnBlur: boolean;
};

const INLINE_EDITOR_WIDGET_TYPES = new Set<FormWidgetType>([
  FormWidgetType.TEXT_INPUT,
  FormWidgetType.NUMBER_INPUT,
  FormWidgetType.PHONE_INPUT,
  FormWidgetType.AMOUNT_INPUT,
  FormWidgetType.DATE_PICKER,
  FormWidgetType.TIME_PICKER,
  FormWidgetType.RATE,
  FormWidgetType.SWITCH,
  FormWidgetType.HYPERLINK,
]);

export const isNocodeTableInlineEditorType = (
  widgetType?: FormWidgetType,
) => {
  return INLINE_EDITOR_WIDGET_TYPES.has(widgetType as FormWidgetType);
};

export const isNocodeTableEditorEnterCommitEnabled = (
  widgetType?: FormWidgetType,
) => {
  return isNocodeTableInlineEditorType(widgetType);
};

export const isNocodeTableEditorBlurCommitEnabled = (
  _widgetType?: FormWidgetType,
) => {
  return true;
};

export const resolveNocodeTableEditorPolicy = (
  widgetType?: FormWidgetType,
): NocodeTableEditorPolicy => {
  const type: NocodeTableEditorType = isNocodeTableInlineEditorType(widgetType)
    ? "nocode-widget-inline"
    : "nocode-widget-popup";

  return {
    type,
    presentationMode: type === "nocode-widget-inline" ? "inline" : "popup",
    commitOnEnter: isNocodeTableEditorEnterCommitEnabled(widgetType),
    commitOnBlur: isNocodeTableEditorBlurCommitEnabled(widgetType),
  };
};
