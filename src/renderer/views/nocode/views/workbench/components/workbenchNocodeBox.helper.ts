import dayjs from 'dayjs';

export type WorkbenchNocodeMenuKey = "replaceIcon" | "rename" | "copy" | "saveAs" | "manageExpireAt" | "delete";

export type WorkbenchNocodeExpireInfo = {
  status: "limited" | "expired";
  formattedExpireAt: string;
};

export const canShowWorkbenchMetaActions = (options: {
  hasEditablePermission: boolean;
  isImportReadonly?: boolean;
  isImportExpired?: boolean;
}) => {
  return !!options.hasEditablePermission;
};

export const getWorkbenchNocodeMenuKeys = (options: {
  isEditable: boolean;
  isDeletable: boolean;
  canCopy: boolean;
  isExpired?: boolean;
  isBroken?: boolean;
  canSaveAs?: boolean;
  canManageImportExpireAt?: boolean;
  hasImportExpireAt?: boolean;
}) => {
  if (options.isBroken) {
    return options.isDeletable ? ["delete"] : [];
  }

  const menus: WorkbenchNocodeMenuKey[] = [];

  if (options.isEditable) {
    menus.push("replaceIcon", "rename");
  }

  if (options.canCopy && !options.isExpired) {
    menus.push("copy");
  }

  if (options.canSaveAs) {
    menus.push("saveAs");
  }

  if (options.canManageImportExpireAt && options.hasImportExpireAt) {
    menus.push("manageExpireAt");
  }

  if (options.isDeletable) {
    menus.push("delete");
  }

  return menus;
};

export const getWorkbenchNocodeExpireInfo = (expireAt?: number | string | null, isExpired?: boolean): WorkbenchNocodeExpireInfo | null => {
  const currentExpireAt = Number(expireAt || 0);
  if (!currentExpireAt) return null;

  return {
    status: isExpired ? "expired" : "limited",
    formattedExpireAt: dayjs(currentExpireAt).format("YYYY.MM.DD HH:mm"),
  };
};
