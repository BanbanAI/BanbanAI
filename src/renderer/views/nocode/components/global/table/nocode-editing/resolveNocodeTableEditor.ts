import { FormWidgetType } from "../../../../../../../common/types/nocode";
import { resolveNocodeTableEditorPolicy } from "./editor-policy";
import type { ResolveNocodeTableEditorOptions } from "./types";

export const resolveNocodeTableEditorType = (
  widgetType?: FormWidgetType,
) => {
  return resolveNocodeTableEditorPolicy(widgetType).type;
};

export const resolveNocodeTableEditor = (
  options: ResolveNocodeTableEditorOptions,
) => {
  if (!options.editable) {
    return undefined;
  }
  return {
    type: resolveNocodeTableEditorType(options.widgetType),
    props: options.props || {},
  };
};
