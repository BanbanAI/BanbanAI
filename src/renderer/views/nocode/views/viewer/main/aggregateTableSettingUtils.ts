export const getFirstAvailableAggregateTableName = (
  names: string[],
  formatName: (index: number) => string,
) => {
  const nameSet = new Set(names);
  let index = 1;
  while (nameSet.has(formatName(index))) index += 1;
  return formatName(index);
};

export const normalizeAggregateTableName = (name = '') => name.trim();
