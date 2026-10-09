import { NocodeBody, NocodeStructure, NocodeStructureType } from "@common/types/nocode";
import { TableUID } from "@common/types/project";

export const EXPORT_PAGE_NODE_PREFIX = "page-";

export type NocodeSaveAsImportRestriction = {
  disableEdit?: boolean;
  lockable?: boolean;
  expireAt?: number;
};

export type ExportTableTreeNode = {
  value: string,
  label: string,
  disabled?: boolean,
  isGroup?: boolean,
  children?: ExportTableTreeNode[],
};

const getExportPageNodeValue = (pageId: string) => {
  return `${EXPORT_PAGE_NODE_PREFIX}${pageId}`;
}

export const getExportPageIdFromNodeValue = (value: string) => {
  if (!value.startsWith(EXPORT_PAGE_NODE_PREFIX)) return "";
  return value.slice(EXPORT_PAGE_NODE_PREFIX.length);
}

export const getNocodeSaveAsOptionVisibleState = (importRestriction?: NocodeSaveAsImportRestriction | null) => {
  const expireAt = Number(importRestriction?.expireAt || 0);

  return {
    showReadonlyAfterImport: !importRestriction?.disableEdit,
    showImportValidity: !expireAt,
  };
};

export const buildNocodeSaveAsImportRestriction = (options: {
  currentImportRestriction?: NocodeSaveAsImportRestriction | null;
  showReadonlyAfterImport: boolean;
  showImportValidity: boolean;
  disableEdit: boolean;
  expireType: "forever" | "limited";
  expireAt?: number | string | null;
}) => {
  const importRestriction: NocodeSaveAsImportRestriction = {};
  const currentExpireAt = Number(options.currentImportRestriction?.expireAt || 0);
  const nextExpireAt = Number(options.expireAt || 0);
  const nextDisableEdit = options.showReadonlyAfterImport ? options.disableEdit : !!options.currentImportRestriction?.disableEdit;

  if (nextDisableEdit) {
    importRestriction.disableEdit = true;
  }
  if (nextDisableEdit || options.currentImportRestriction?.lockable) {
    importRestriction.lockable = true;
  }

  if (options.showImportValidity) {
    if (options.expireType === "limited" && nextExpireAt) {
      importRestriction.expireAt = nextExpireAt;
    }
  } else if (currentExpireAt) {
    importRestriction.expireAt = currentExpireAt;
  }

  return Object.keys(importRestriction).length ? importRestriction : undefined;
};

export const getExportTableOptionsFromStructure = (structure?: NocodeStructure[]) => {
  const tableUIDs: TableUID[] = [];
  const selectedNodeValues: string[] = [];

  const walk = (nodes?: NocodeStructure[], parentPath = ""): ExportTableTreeNode[] => {
    return (nodes || []).reduce((result, item, index) => {
      if (item.type === NocodeStructureType.PAGE) {
        const pageNodeValue = getExportPageNodeValue(item.id);
        selectedNodeValues.push(pageNodeValue);
        result.push({
          value: pageNodeValue,
          label: item.name,
        });
        return result;
      }
      if (item.type === NocodeStructureType.FORM) {
        tableUIDs.push(item.id as TableUID);
        selectedNodeValues.push(item.id);
        result.push({
          value: item.id,
          label: item.name,
        });
        return result;
      }
      const children = walk(item.children, `${parentPath}${index}-`);
      if (!children.length) {
        return result;
      }
      result.push({
        value: `group-${parentPath}${index}`,
        label: item.name,
        isGroup: true,
        children,
      });
      return result;
    }, [] as ExportTableTreeNode[]);
  };

  return {
    treeData: walk(structure),
    tableUIDs,
    selectedNodeValues,
  };
}

export const getExportTableOptionsFromTables = (nocodeBody?: NocodeBody | null) => {
  const tables = nocodeBody?.formData?.tables || [];
  const tableNameMap = new Map((nocodeBody?.formData?.options?.tables || []).map(item => [item.uid, item.tableName]));
  const tableMap = new Map(tables.map(table => [table.uid, table]));
  const subTableUIDs = new Set<TableUID>();
  const childrenMap = new Map<TableUID, Set<TableUID>>();

  tables.forEach((table) => {
    table.fields?.forEach((field) => {
      const subTableUID = field.meta?.extra?.subTableUID?.[1] as TableUID;
      if (subTableUID && tableMap.has(subTableUID) && subTableUID !== table.uid) {
        subTableUIDs.add(subTableUID);
        if (!childrenMap.has(table.uid)) {
          childrenMap.set(table.uid, new Set<TableUID>());
        }
        childrenMap.get(table.uid)?.add(subTableUID);
      }
    });
  });

  const allTableUIDs: TableUID[] = [];
  const buildNode = (uid: TableUID, parentPath = "", depth = 0, visited = new Set<TableUID>()): ExportTableTreeNode | null => {
    if (visited.has(uid)) return null;
    const table = tableMap.get(uid);
    if (!table) return null;

    allTableUIDs.push(uid);

    const nodeId = parentPath ? `${parentPath}/${uid}` : uid;
    const nextVisited = new Set(visited);
    nextVisited.add(uid);
    const children = [...(childrenMap.get(uid) || [])]
      .map(childUID => buildNode(childUID, nodeId, depth + 1, nextVisited))
      .filter(Boolean) as ExportTableTreeNode[];

    return {
      value: table.uid,
      label: table.alias || tableNameMap.get(table.uid) || table.uid,
      isGroup: depth > 0,
      children: children.length ? children : undefined,
    };
  };

  const rootTableUIDs = tables.filter(table => !subTableUIDs.has(table.uid)).map(table => table.uid);
  const rootUIDs = rootTableUIDs.length ? rootTableUIDs : tables.map(table => table.uid);
  const treeData = rootUIDs.map(uid => buildNode(uid)).filter(Boolean) as ExportTableTreeNode[];

  return {
    treeData,
    tableUIDs: allTableUIDs,
    selectedNodeValues: [...allTableUIDs],
  };
}

export const getExportTableOptions = (nocodeBody?: NocodeBody | null) => {
  const structureOptions = getExportTableOptionsFromStructure(nocodeBody?.structure);
  if (structureOptions.tableUIDs.length) {
    return structureOptions;
  }
  return getExportTableOptionsFromTables(nocodeBody);
}
