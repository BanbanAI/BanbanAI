import type { CSSProperties } from "vue";
import type { VirtualPlannedCellSpan, VirtualVisibleColumnDescriptor } from "./types";

type DecorateVirtualFlowCellStyleOptions = {
  baseStyle: Record<string, string | number | undefined>;
  descriptorType: "normal" | "blank";
  blankKind?: "virtual" | "filler";
  isHiddenSpanCell: boolean;
  isMergedRootCell: boolean;
};

type ResolveVirtualMergedOverlayStyleOptions = {
  baseStyle: Record<string, string | number | undefined>;
  width: number;
  height: number;
  alignItems: string;
  verticalAlign: string;
};

type ResolveVirtualMergedOverlayGeometryOptions = {
  descriptor: VirtualVisibleColumnDescriptor;
  plannedSpan: VirtualPlannedCellSpan;
  rowIndex: number;
  getSpanWidth: (columnIndex: number, colSpan: number) => number;
  getSpanHeight: (rowIndex: number, rowSpan: number) => number;
};

type ResolveVirtualRowFlowStyleOptions = {
  hasMergedRootCell: boolean;
};

type ResolveVirtualFillerInteractionDescriptorOptions = {
  descriptors: VirtualVisibleColumnDescriptor[];
  descriptorKey: string;
  isDescriptorHidden?: (descriptor: Extract<VirtualVisibleColumnDescriptor, { type: "normal" }>) => boolean;
};

type ResolveVirtualCellInteractionPlanOptions = ResolveVirtualFillerInteractionDescriptorOptions & {
  isHiddenSpanCell: boolean;
};

type VirtualCellInteractionPlan =
  | {
      type: "ignore";
    }
  | {
      type: "self" | "proxy";
      descriptor: Extract<VirtualVisibleColumnDescriptor, { type: "normal" }>;
    };

const NON_CONTENT_COLUMN_KINDS = new Set(["action", "index", "selection"]);

const isContentDescriptor = (descriptor: VirtualVisibleColumnDescriptor) => {
  if (descriptor.type !== "normal") {
    return false;
  }
  return !NON_CONTENT_COLUMN_KINDS.has(String(descriptor.column.meta?.kind || ""));
};

export const resolveVirtualFillerInteractionDescriptor = (
  options: ResolveVirtualFillerInteractionDescriptorOptions,
) => {
  const descriptorIndex = options.descriptors.findIndex((descriptor) => (
    descriptor.key === options.descriptorKey
  ));
  if (descriptorIndex < 0) {
    return null;
  }

  const descriptor = options.descriptors[descriptorIndex];
  if (descriptor.type !== "blank" || descriptor.blankKind !== "filler") {
    return null;
  }

  const isInteractiveCandidate = (
    candidate: VirtualVisibleColumnDescriptor,
  ): candidate is Extract<VirtualVisibleColumnDescriptor, { type: "normal" }> => {
    return isContentDescriptor(candidate) && !options.isDescriptorHidden?.(candidate);
  };

  for (let index = descriptorIndex - 1; index >= 0; index -= 1) {
    const candidate = options.descriptors[index];
    if (isInteractiveCandidate(candidate)) {
      return candidate;
    }
  }

  for (let index = descriptorIndex + 1; index < options.descriptors.length; index += 1) {
    const candidate = options.descriptors[index];
    if (isInteractiveCandidate(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const resolveVirtualCellInteractionPlan = (
  options: ResolveVirtualCellInteractionPlanOptions,
): VirtualCellInteractionPlan => {
  const descriptor = options.descriptors.find((item) => item.key === options.descriptorKey);
  if (!descriptor) {
    return {
      type: "ignore",
    };
  }

  if (descriptor.type === "blank") {
    if (descriptor.blankKind !== "filler") {
      return {
        type: "ignore",
      };
    }

    const fallbackDescriptor = resolveVirtualFillerInteractionDescriptor(options);
    if (!fallbackDescriptor) {
      return {
        type: "ignore",
      };
    }

    return {
      type: "proxy",
      descriptor: fallbackDescriptor,
    };
  }

  if (options.isHiddenSpanCell || options.isDescriptorHidden?.(descriptor)) {
    return {
      type: "ignore",
    };
  }

  return {
    type: "self",
    descriptor,
  };
};

export const resolveVirtualRowFlowStyle = (_options: ResolveVirtualRowFlowStyleOptions) => ({});

export const resolveVirtualMergedOverlayGeometry = (
  options: ResolveVirtualMergedOverlayGeometryOptions,
) => {
  if (options.descriptor.type !== "normal") {
    return null;
  }

  if (options.plannedSpan.hidden || options.plannedSpan.rowSpan <= 0 || options.plannedSpan.colSpan <= 0) {
    return null;
  }

  return {
    width: Math.max(0, Number(options.getSpanWidth(options.descriptor.columnIndex, options.plannedSpan.colSpan)) || 0),
    height: Math.max(0, Number(options.getSpanHeight(options.rowIndex, options.plannedSpan.rowSpan)) || 0),
    rowSpan: options.plannedSpan.rowSpan,
    colSpan: options.plannedSpan.colSpan,
  };
};

export const decorateVirtualFlowCellStyle = (options: DecorateVirtualFlowCellStyleOptions) => {
  if (options.descriptorType === "blank") {
    if (options.blankKind === "filler") {
      return options.baseStyle;
    }
    return {
      ...options.baseStyle,
      pointerEvents: "none",
      borderColor: "transparent",
      background: "transparent",
    };
  }

  if (options.isHiddenSpanCell) {
    return {
      ...options.baseStyle,
      visibility: "hidden",
      pointerEvents: "none",
      borderColor: "transparent",
      background: "transparent",
    };
  }

  if (options.isMergedRootCell) {
    const baseZIndex = Number(options.baseStyle.zIndex);
    return {
      ...options.baseStyle,
      position: options.baseStyle.position || "relative",
      zIndex: Number.isFinite(baseZIndex) ? baseZIndex + 1 : 1,
      overflow: "visible",
      borderColor: "transparent",
      background: "transparent",
    };
  }

  return options.baseStyle;
};

export const resolveVirtualMergedOverlayStyle = (
  options: ResolveVirtualMergedOverlayStyleOptions,
): CSSProperties => {
  const justifyContent = typeof options.baseStyle.justifyContent === "string"
    ? (options.baseStyle.justifyContent as CSSProperties["justifyContent"])
    : undefined;
  const baseZIndex = Number(options.baseStyle.zIndex);
  const width = Math.max(0, Number(options.width) || 0);
  const height = Math.max(0, Number(options.height) || 0);

  return {
    position: "absolute",
    width: `${width}px`,
    minWidth: `${width}px`,
    height: `${height}px`,
    minHeight: `${height}px`,
    alignItems: options.alignItems,
    "--virtual-table-cell-vertical-align": options.verticalAlign,
    "--virtual-table-cell-align-items": options.alignItems,
    justifyContent,
    zIndex: Number.isFinite(baseZIndex) ? baseZIndex + 1 : 2,
  } as CSSProperties;
};
