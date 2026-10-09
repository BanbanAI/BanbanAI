import { VirtualTableEditorDefinition } from "./types";

export interface VirtualTableEditorRegistry {
  has(type: string): boolean;
  resolve(type: string): VirtualTableEditorDefinition | undefined;
  list(): VirtualTableEditorDefinition[];
}

export const createVirtualTableEditorRegistry = (
  definitions: VirtualTableEditorDefinition[] = [],
): VirtualTableEditorRegistry => {
  const definitionMap = new Map<string, VirtualTableEditorDefinition>();

  for (const definition of definitions) {
    if (!definition?.type) {
      continue;
    }
    definitionMap.set(definition.type, definition);
  }

  return {
    has(type: string) {
      return definitionMap.has(type);
    },
    resolve(type: string) {
      return definitionMap.get(type);
    },
    list() {
      return Array.from(definitionMap.values());
    },
  };
};
