import { ViewActionFieldId } from "@common/types/nocode";

export const mergeUpdateFieldIds = (
  ...fieldIdGroups: Array<ViewActionFieldId[] | null | undefined>
) => {
  const result: ViewActionFieldId[] = [];
  const visited = new Set<string>();

  for (const fieldIds of fieldIdGroups) {
    for (const fieldId of fieldIds || []) {
      if (!fieldId) {
        continue;
      }

      const normalizedFieldId = String(fieldId);
      if (visited.has(normalizedFieldId)) {
        continue;
      }

      visited.add(normalizedFieldId);
      result.push(fieldId);
    }
  }

  return result;
};
