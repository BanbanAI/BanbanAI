import { NocodeStructureType, type NocodeStructure } from "@common/types/nocode";

export const filterPublishStructure = (structure: NocodeStructure[]): NocodeStructure[] => {
  return structure.reduce<NocodeStructure[]>((result, node) => {
    if (node.type !== NocodeStructureType.GROUP) {
      result.push(node);
      return result;
    }

    const children = filterPublishStructure(node.children || []);
    if (children.length) {
      result.push({
        ...node,
        children,
      });
    }
    return result;
  }, []);
};
