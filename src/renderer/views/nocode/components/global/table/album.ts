import { FieldUID } from "@common/types/project";
import { Column } from "./table";
import { ViewSetting } from "@common/types/nocode";

export enum SizeStateEnum {
  LARGE = "Large",
  MEDIUM = "Medium",
  SMALL = "Small",
}

// 同时作为类型和运行时数据
export const SizeData = [
  {
    size: [400, 500],
    type: SizeStateEnum.LARGE,
  },
  {
    size: [300, 400],
    type: SizeStateEnum.MEDIUM,
  },
  {
    size: [200, 260],
    type: SizeStateEnum.SMALL,
  },
] as const;

// 封面的填充方式
export enum AlbumCoverStateEnum {
  // 裁剪
  COVER = "cover",
  // 适应
  CONTAIN = "contain",
}

// 字段标题显示隐藏
export enum FieldTitleStateEnum {
  SHOW = "show",
  HIDE = "hide",
}

// 从对象推导类型
export type SizeType = (typeof SizeData)[number]["type"];
export type SizeSize = (typeof SizeData)[number]["size"];

export type sizeObj = {
  size: SizeSize;
  type: SizeType;
};

// 画册视图的显示配置
export interface AlbumStateOption {
  sizeType: SizeType;
  coverUid: string;
  showCover: boolean;
  albumCoverState: AlbumCoverStateEnum;
  // 字段标题 的 显示 隐藏
  fieldTitleState: FieldTitleStateEnum;
  // 隐藏的列
  hiddenColumns?: FieldUID[];
  // 顺序数组
  sortOrderColumns?: FieldUID[];
}
export type AlbumStateOptionType = AlbumStateOption & ViewSetting;

// 默认值
export const DefautAlbumStateOption: AlbumStateOption = {
  sizeType: SizeStateEnum.LARGE,
  coverUid: "",
  showCover: true,
  albumCoverState: AlbumCoverStateEnum.COVER,
  fieldTitleState: FieldTitleStateEnum.SHOW,
  hiddenColumns: [],
  sortOrderColumns: [],
};

export type useColumnType = Readonly<Column> & {
  // 标题旁展示的
  icon?: string;
  // 是否展示
  show: boolean;
};
// 不展示的列
const unShowColumn = ["file", "image"];

// 是否显示当前列
export const isShowColums = (column: Column) => {
  const widgetType = !!column?.extra?.widgetType;
  if (!widgetType) return false;
  const subType = column.subType;
  if (unShowColumn.includes(subType)) return false;
  return true;
};

// 是否可以当做封面
export const isCoverColumn = (column: Column) => {
  const coverColumn = ["file", "image"];
  return coverColumn.includes(column.subType);
};

// 获取封面下标
export const getCoverIndex = (columns: Column[]) => {
  if (!Array.isArray(columns)) {
    console.warn("columns is no a columns[]");
    return;
  }
  return columns.findIndex((item) => {
    return isCoverColumn(item);
  });
};

export const sortAlbumColumnsByOrder = <T extends { uid: FieldUID }>(
  columns: T[] = [],
  order: FieldUID[] = []
) => {
  if (!Array.isArray(columns) || !columns.length) {
    return [];
  }
  if (!Array.isArray(order) || !order.length) {
    return [...columns];
  }

  const orderMap = new Map<FieldUID, number>();
  order.forEach((uid, index) => {
    orderMap.set(uid, index);
  });

  const placedIds = new Set<FieldUID>();
  const result = columns
    .filter((column) => orderMap.has(column.uid))
    .sort((a, b) => (orderMap.get(a.uid) ?? 0) - (orderMap.get(b.uid) ?? 0));

  result.forEach((column) => placedIds.add(column.uid));

  columns.forEach((column, index) => {
    if (placedIds.has(column.uid)) return;

    let insertIndex = 0;
    let hasPrevPlaced = false;
    for (let i = index - 1; i >= 0; i--) {
      const prevUid = columns[i].uid;
      const prevIndex = result.findIndex((item) => item.uid === prevUid);
      if (prevIndex !== -1) {
        insertIndex = prevIndex + 1;
        hasPrevPlaced = true;
        break;
      }
    }

    if (!hasPrevPlaced) {
      insertIndex = 0;
    }

    result.splice(insertIndex, 0, column);
    placedIds.add(column.uid);
  });

  return result;
};
