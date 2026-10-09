type ItemWithId = {
  id: string;
};

export const resolveDisplayItemsByOrder = <T extends ItemWithId>(
  ids: string[] = [],
  preferredItems: T[] = [],
  fallbackItems: T[] = [],
) => {
  const preferredMap = new Map((preferredItems || []).filter(Boolean).map(item => [item.id, item] as const));
  const fallbackMap = new Map((fallbackItems || []).filter(Boolean).map(item => [item.id, item] as const));

  return (ids || []).map(id => preferredMap.get(id) || fallbackMap.get(id)).filter(Boolean);
};
