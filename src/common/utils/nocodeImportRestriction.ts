import { NocodeBody, NocodeFormData, NocodeImportRestriction, NocodeImportState, NocodeMeta, NocodeStructure, NocodeStructureType } from "../types/nocode";
import { TableUID } from "../types/project";

type NocodeImportRestrictionTarget =
  | NocodeImportRestriction
  | Pick<NocodeBody, "importRestriction">
  | Pick<NocodeMeta, "importRestriction">
  | null
  | undefined;

export const NOCODE_IMPORT_EXPIRED_ERROR = "NOCODE_IMPORT_EXPIRED";

const hasImportRestrictionField = (
  target: NocodeImportRestrictionTarget,
): target is Pick<NocodeBody, "importRestriction"> | Pick<NocodeMeta, "importRestriction"> => {
  return !!target && typeof target === "object" && "importRestriction" in target;
}

export const getNocodeImportRestriction = (target?: NocodeImportRestrictionTarget): NocodeImportRestriction | undefined => {
  if (!target) return undefined;
  if (hasImportRestrictionField(target)) {
    return (target.importRestriction as NocodeImportRestriction) || undefined;
  }
  return target as NocodeImportRestriction;
}

export const isNocodeImportReadonly = (target?: NocodeImportRestrictionTarget) => {
  return !!getNocodeImportRestriction(target)?.disableEdit;
}

export const isNocodeImportExpired = (target?: NocodeImportRestrictionTarget, now = Date.now()) => {
  const expireAt = Number(getNocodeImportRestriction(target)?.expireAt || 0);
  return !!expireAt && expireAt <= now;
}

export const buildNocodeImportState = (
  target?: NocodeImportRestrictionTarget,
  options: {
    canClearReadonly?: boolean,
    canManageReadonly?: boolean,
    canManageExpireAt?: boolean,
  } = {},
): NocodeImportState => {
  const importRestriction = getNocodeImportRestriction(target);
  const disableEdit = isNocodeImportReadonly(target);
  const canManageReadonly = !!options.canManageReadonly;

  return {
    disableEdit,
    expired: isNocodeImportExpired(target),
    expireAt: importRestriction?.expireAt || null,
    canClearReadonly: options.canClearReadonly ?? (disableEdit && canManageReadonly),
    canManageReadonly,
    canManageExpireAt: !!options.canManageExpireAt,
  };
}

export const setNocodeImportReadonly = (
  target?: Pick<NocodeBody, "importRestriction"> | Pick<NocodeMeta, "importRestriction"> | null,
  disableEdit?: boolean,
  options: {
    emptyValue?: null | undefined,
  } = {},
) => {
  if (!target) return;

  if (disableEdit) {
    target.importRestriction = target.importRestriction || {};
    target.importRestriction.lockable = true;
    target.importRestriction.disableEdit = true;
    return;
  }

  if (!target.importRestriction) return;
  if (target.importRestriction.disableEdit && !target.importRestriction.lockable) {
    target.importRestriction.lockable = true;
  }
  delete target.importRestriction.disableEdit;

  if (Object.keys(target.importRestriction).length) return;

  if (options.emptyValue === null) {
    target.importRestriction = null;
    return;
  }

  delete target.importRestriction;
}

export const expandNocodeExportTableUIDs = (formData?: NocodeFormData, rootTableUIDs: TableUID[] = []) => {
  const queue = [...new Set((rootTableUIDs || []).filter(Boolean))];
  const visited = new Set<TableUID>();
  const result = new Set<TableUID>();

  while (queue.length) {
    const tableUID = queue.shift();
    if (!tableUID || visited.has(tableUID)) continue;
    visited.add(tableUID);

    const table = formData?.tables?.find(item => item.uid === tableUID);
    if (!table) continue;
    result.add(tableUID);

    for (const field of table.fields || []) {
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      if (subTableUID && !visited.has(subTableUID)) {
        queue.push(subTableUID);
      }
    }
  }

  return result;
}

const filterTableRecord = <T>(record: Record<string, T> | undefined, tableUIDSet: Set<TableUID>) => {
  if (!record) return record;
  return Object.keys(record).reduce((result, key) => {
    const tableUID = key as TableUID;
    if (tableUIDSet.has(tableUID)) {
      result[tableUID] = record[tableUID];
    }
    return result;
  }, {} as Record<string, T>);
}

const filterNocodeExportStructure = (structure: NocodeStructure[] | undefined, options: {
  rootTableUIDSet: Set<TableUID>,
  selectedPageIDSet?: Set<string>,
}) => {
  if (!structure) return structure;
  return structure.reduce((result, item) => {
    if (item.type === NocodeStructureType.FORM) {
      const shouldKeepForm = options.rootTableUIDSet.size
        ? options.rootTableUIDSet.has(item.id as TableUID)
        : !options.selectedPageIDSet;
      if (shouldKeepForm) {
        result.push(item);
      }
      return result;
    }
    if (item.type === NocodeStructureType.PAGE) {
      const shouldKeepPage = options.selectedPageIDSet
        ? options.selectedPageIDSet.has(item.id)
        : true;
      if (shouldKeepPage) {
        result.push(item);
      }
      return result;
    }
    if (item.type === NocodeStructureType.GROUP) {
      const children = filterNocodeExportStructure(item.children, options);
      if (children?.length) {
        result.push({
          ...item,
          children,
        });
      }
      return result;
    }
    return result;
  }, [] as NocodeStructure[]);
}

export const filterNocodeExportBody = (
  nocodeBody?: NocodeBody | null,
  rootTableUIDs: TableUID[] = [],
  selectedPageIDs?: string[],
) => {
  const hasSelectedPageIDs = Array.isArray(selectedPageIDs);
  if (!nocodeBody || (!rootTableUIDs?.length && !hasSelectedPageIDs)) return nocodeBody;

  const rootTableUIDSet = new Set<TableUID>([...new Set((rootTableUIDs || []).filter(Boolean))]);
  const selectedPageIDSet = hasSelectedPageIDs ? new Set((selectedPageIDs || []).filter(Boolean)) : undefined;
  const exportTableUIDSet = nocodeBody.formData
    ? expandNocodeExportTableUIDs(nocodeBody.formData, [...rootTableUIDSet])
    : rootTableUIDSet;
  const exportTableMetaUIDSet = new Set(
    (nocodeBody.formData?.tables || [])
      .filter(table => exportTableUIDSet.has(table.uid))
      .map(table => table.meta?.uid)
      .filter(Boolean)
  );

  return {
    ...nocodeBody,
    structure: filterNocodeExportStructure(nocodeBody.structure, {
      rootTableUIDSet,
      selectedPageIDSet,
    }),
    formData: nocodeBody.formData
      ? {
        ...nocodeBody.formData,
        options: {
          ...nocodeBody.formData.options,
          tables: nocodeBody.formData.options?.tables?.filter(item => exportTableMetaUIDSet.has(item.uid)),
        },
        formOptions: filterTableRecord(nocodeBody.formData.formOptions, rootTableUIDSet),
        metas: filterTableRecord(nocodeBody.formData.metas, exportTableUIDSet),
        tables: nocodeBody.formData.tables?.filter(table => exportTableUIDSet.has(table.uid)),
      }
      : nocodeBody.formData,
    views: filterTableRecord(nocodeBody.views, rootTableUIDSet),
    printTemplate: filterTableRecord(nocodeBody.printTemplate, rootTableUIDSet),
  };
}
