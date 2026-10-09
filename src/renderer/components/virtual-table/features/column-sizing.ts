import { FieldUID } from "@common/types/project";
import { VirtualTableFixed } from "../types";

type ResolveNocodeColumnWidthOptions = {
  uid: FieldUID;
  tableWidthData?: Record<string, number>;
  fallbackWidth?: number;
};

export const resolveNocodeColumnWidth = (options: ResolveNocodeColumnWidthOptions) => {
  const width = Number(options.tableWidthData?.[options.uid]);
  if (Number.isFinite(width) && width > 0) {
    return width;
  }
  return options.fallbackWidth ?? 150;
};

export const resolveNocodeColumnFixed = (
  uid: FieldUID,
  isFixedColumn?: (uid: FieldUID) => string | undefined,
): VirtualTableFixed | undefined => {
  const fixed = isFixedColumn?.(uid);
  if (fixed === "left" || fixed === "right") {
    return fixed;
  }
  return undefined;
};
