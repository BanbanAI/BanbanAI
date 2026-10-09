import { getChinaAddressData } from "@renderer/utils/township";

type AddressNode = {
  label: string;
  value: string;
  children?: AddressNode[];
};

type AddressMatchResult = {
  valid: boolean;
  regionPath?: string;
  detail?: string;
};

export async function validateQuickFillAddress(rawValue: string, level: number): Promise<AddressMatchResult> {
  const normalized = String(rawValue || "").trim();
  if (!normalized) {
    return {
      valid: true,
      regionPath: "",
      detail: "",
    };
  }

  const needLevel = Math.min(Math.max(level, 1), 3);
  const segments = normalized.split(/\s+/).filter(Boolean);
  const firstSegment = (segments[0] || "").replace(/[／\-－—]/g, "/");
  const slashRegions = firstSegment.split("/").filter(Boolean);
  const regions = slashRegions.length >= needLevel ? slashRegions : segments.slice(0, needLevel);
  const detailParts = slashRegions.length >= needLevel ? segments.slice(1) : segments.slice(needLevel);
  if (regions.length < needLevel) {
    return { valid: false };
  }

  let currentNodes = await getChinaAddressData() as AddressNode[];
  const matchedRegions: string[] = [];

  for (let i = 0; i < needLevel; i++) {
    const target = regions[i];
    const matchedNode = currentNodes.find(node => node.label === target || node.value === target);
    if (!matchedNode) {
      return { valid: false };
    }
    matchedRegions.push(matchedNode.label || matchedNode.value);
    currentNodes = matchedNode.children || [];
  }

  return {
    valid: true,
    regionPath: matchedRegions.join("/"),
    detail: detailParts.join(" "),
  };
}
