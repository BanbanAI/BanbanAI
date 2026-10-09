type AbstractTreeNode = {
  children?: AbstractTreeNode[];
};

export const isLeafNode = (node: AbstractTreeNode | null | undefined) => {
  return !node?.children || node.children.length === 0;
};

export const groupBy2 = <T, K extends string | number>(
  list: T[],
  iteratee: (item: T) => K,
) => {
  const groups = new Map<K, T[]>();
  for (const item of list) {
    const key = iteratee(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  return groups;
};

export const getTreeDepth = (nodes: AbstractTreeNode[] = []) => {
  let maxDepth = -1;

  const visit = (items: AbstractTreeNode[], depth: number) => {
    for (const item of items) {
      if (isLeafNode(item)) {
        maxDepth = Math.max(maxDepth, depth);
        continue;
      }
      visit(item.children || [], depth + 1);
    }
  };

  visit(nodes, 0);
  return maxDepth;
};

export const always = <T>(value: T) => {
  return () => value;
};
