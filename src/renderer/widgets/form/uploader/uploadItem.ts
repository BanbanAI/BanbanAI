export interface UploadItemLike {
  uid?: string | number;
  url?: string;
  name?: string;
  size?: number;
  status?: string;
}

export const hasValidUploadItemUid = (uid: UploadItemLike["uid"]) => {
  return uid !== undefined && uid !== null && uid !== "" && !(typeof uid === "number" && Number.isNaN(uid));
};

export const getUploadItemKey = (file: UploadItemLike, index = -1) => {
  if (hasValidUploadItemUid(file?.uid)) {
    return String(file.uid);
  }

  return [file?.url, file?.name, file?.size, index]
    .filter((item) => item !== undefined && item !== null && item !== "")
    .join("-");
};

const isSameUploadItem = (current: UploadItemLike, target: UploadItemLike) => {
  if (current === target) {
    return true;
  }

  return current?.url === target?.url
    && current?.name === target?.name
    && current?.size === target?.size
    && current?.status === target?.status;
};

export const removeUploadItemFromList = <T extends UploadItemLike>(items: T[] = [], uploadFile?: UploadItemLike) => {
  if (!Array.isArray(items) || !uploadFile) {
    return Array.isArray(items) ? items : [];
  }

  if (hasValidUploadItemUid(uploadFile.uid)) {
    const filteredItems = items.filter((item) => item?.uid !== uploadFile.uid);
    if (filteredItems.length !== items.length) {
      return filteredItems;
    }
  }

  const matchedIndex = items.findIndex((item) => isSameUploadItem(item, uploadFile));
  if (matchedIndex === -1) {
    return items;
  }

  return items.filter((_, index) => index !== matchedIndex);
};
