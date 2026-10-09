import { NocodeStructureType, type NocodeStructure } from "@common/types/nocode";

export const filterPrintTemplateFormStructure = (structure: NocodeStructure[] = []): NocodeStructure[] => {
  const result: NocodeStructure[] = [];

  for (const node of structure) {
    if (node.type === NocodeStructureType.FORM) {
      result.push({ ...node });
      continue;
    }

    if (node.type === NocodeStructureType.GROUP) {
      const children = filterPrintTemplateFormStructure(node.children || []);
      if (children.length) {
        result.push({
          ...node,
          children,
        });
      }
    }
  }

  return result;
}

export const findFirstPrintTemplateFormNodeId = (structure: NocodeStructure[] = []): string | null => {
  for (const node of structure) {
    if (node.type === NocodeStructureType.FORM) {
      return node.id;
    }

    const found = findFirstPrintTemplateFormNodeId(node.children || []);
    if (found) {
      return found;
    }
  }

  return null;
}
