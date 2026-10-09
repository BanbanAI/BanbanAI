import { equals } from "@common/utils/object";

type EditorLike = {
  isRequired?: boolean;
  isEmpty?: () => boolean;
  doValidate?: () => void;
  inputValue?: any;
};

type ResolveNocodeEditorHostConfirmResultOptions = {
  widget?: EditorLike | null;
  initialValue: any;
  reason?: string;
};

export type NocodeEditorHostConfirmResult =
  | {
    action: "commit";
    reason?: string;
    value: any;
  }
  | {
    action: "cancel";
    reason?: string;
  }
  | {
    action: "stay-editing";
    reason?: string;
    message: string;
  };

export const resolveNocodeEditorHostConfirmResult = (
  options: ResolveNocodeEditorHostConfirmResultOptions,
): NocodeEditorHostConfirmResult => {
  const widget = options.widget;
  if (!widget) {
    return {
      action: "cancel",
      reason: options.reason,
    };
  }

  try {
    if (widget.isRequired && widget.isEmpty?.()) {
      throw new Error("required");
    }
    widget.doValidate?.();
    const nextValue = widget.inputValue;
    if (equals(options.initialValue, nextValue)) {
      return {
        action: "cancel",
        reason: options.reason,
      };
    }
    return {
      action: "commit",
      reason: options.reason,
      value: nextValue,
    };
  } catch (error) {
    return {
      action: "stay-editing",
      reason: options.reason,
      message: error instanceof Error ? error.message : String(error),
    };
  }
};
