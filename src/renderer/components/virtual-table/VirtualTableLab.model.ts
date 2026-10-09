import { VirtualTableColumn } from "./types";

export type VirtualTableLabRow = {
  id: string;
  index: number;
  checked: boolean;
  name: string;
  region: string;
  owner: string;
  status: string;
  score: number;
  address: string;
  note: string;
};

const STATUS_OPTIONS = ["草稿", "进行中", "已完成", "已归档"];
const OWNER_OPTIONS = ["张三", "李四", "王五", "赵六"];
const REGION_OPTIONS = ["华东", "华南", "华北", "西南"];
const VIRTUAL_TABLE_LAB_DEFAULT_ROW_COUNT = 180;
const VIRTUAL_TABLE_LAB_BUSINESS_SPAN_COLUMN_KEYS = [
  "name",
  "region",
  "owner",
  "status",
  "score",
  "address",
  "note",
] as const;

export const VIRTUAL_TABLE_LAB_STRESS_MERGE = {
  startIndex: 48,
  rowSpan: 52,
  colSpan: 2,
} as const;

export const createVirtualTableLabColumns = (): VirtualTableColumn[] => {
  return [
    {
      key: "selection",
      title: "",
      width: 56,
      fixed: "left",
      align: "center",
      headerAlign: "center",
      meta: {
        kind: "selection",
      },
    },
    {
      key: "index",
      title: "序号",
      width: 72,
      fixed: "left",
      align: "center",
      headerAlign: "center",
      meta: {
        kind: "index",
      },
    },
    {
      key: "group-base",
      title: "基础信息",
      children: [
        {
          key: "name",
          title: "名称",
          dataIndex: "name",
          width: 180,
          minWidth: 140,
          resizable: true,
          meta: {
            kind: "data",
            editable: true,
            editorType: "lab-text-inline",
          },
        },
        {
          key: "region",
          title: "区域",
          dataIndex: "region",
          width: 120,
          minWidth: 100,
          meta: {
            kind: "data",
            editable: true,
            editorType: "lab-select-popup",
            options: REGION_OPTIONS,
          },
        },
        {
          key: "owner",
          title: "负责人",
          dataIndex: "owner",
          width: 120,
          minWidth: 100,
          meta: {
            kind: "data",
            editable: true,
            editorType: "lab-select-popup",
            options: OWNER_OPTIONS,
          },
        },
      ],
    },
    {
      key: "group-progress",
      title: "进度信息",
      children: [
        {
          key: "status",
          title: "状态",
          dataIndex: "status",
          width: 120,
          minWidth: 100,
          meta: {
            kind: "data",
            editable: true,
            editorType: "lab-select-popup",
            options: STATUS_OPTIONS,
          },
        },
        {
          key: "score",
          title: "得分",
          dataIndex: "score",
          width: 100,
          minWidth: 90,
          align: "right",
          headerAlign: "right",
          meta: {
            kind: "data",
            editable: true,
            editorType: "lab-number-inline",
          },
        },
        {
          key: "address",
          title: "地址",
          dataIndex: "address",
          width: 240,
          minWidth: 180,
          meta: {
            kind: "data",
          },
        },
      ],
    },
    {
      key: "note",
      title: "备注",
      dataIndex: "note",
      width: 320,
      minWidth: 220,
      meta: {
        kind: "data",
      },
    },
    {
      key: "action",
      title: "操作",
      width: 184,
      fixed: "right",
      align: "center",
      headerAlign: "center",
      meta: {
        kind: "action",
      },
    },
  ];
};

export const createVirtualTableLabRows = (count = 180): VirtualTableLabRow[] => {
  return Array.from({ length: count }, (_, index) => {
    const region = REGION_OPTIONS[Math.floor(index / 6) % REGION_OPTIONS.length];
    const owner = OWNER_OPTIONS[Math.floor(index / 4) % OWNER_OPTIONS.length];
    const status = STATUS_OPTIONS[Math.floor(index / 3) % STATUS_OPTIONS.length];
    const noteLineCount = index % 9 === 0 ? 4 : index % 4 === 0 ? 2 : 1;
    const note = Array.from({ length: noteLineCount }, (_, lineIndex) => `第 ${index + 1} 行的备注说明 ${lineIndex + 1}`).join(" / ");
    return {
      id: `lab-row-${index + 1}`,
      index: index + 1,
      checked: index % 7 === 0,
      name: `客户 ${Math.floor(index / 3) + 1}`,
      region,
      owner,
      status,
      score: 60 + (index % 35),
      address: `${region} · 园区 ${Math.floor(index / 5) + 1} · ${100 + (index % 20)} 室`,
      note,
    };
  });
};

export const resolveVirtualTableLabRowClassName = (row: VirtualTableLabRow) => {
  if (row.checked) {
    return "is-row-checked";
  }
  if (row.status === "已完成") {
    return "is-row-opened";
  }
  return "";
};

const resolveVirtualTableLabBusinessCellSpan = (
  columnKey: string,
  rowIndex: number,
) => {
  if (columnKey === "name" && rowIndex === VIRTUAL_TABLE_LAB_STRESS_MERGE.startIndex) {
    return {
      rowSpan: VIRTUAL_TABLE_LAB_STRESS_MERGE.rowSpan,
      colSpan: VIRTUAL_TABLE_LAB_STRESS_MERGE.colSpan,
    };
  }

  if (columnKey === "name" && rowIndex % 12 === 0) {
    return {
      rowSpan: 3,
      colSpan: 2,
    };
  }

  if (columnKey === "status" && rowIndex % 10 === 4) {
    return {
      rowSpan: 2,
      colSpan: 1,
    };
  }

  return {
    rowSpan: 1,
    colSpan: 1,
  };
};

const mergeVirtualTableLabBoundary = (
  previous: { start: number; end: number } | undefined,
  next: { start: number; end: number },
) => {
  if (!previous) {
    return next;
  }
  return {
    start: Math.min(previous.start, next.start),
    end: Math.max(previous.end, next.end),
  };
};

const createVirtualTableLabBusinessBoundaryMap = (rowCount = VIRTUAL_TABLE_LAB_DEFAULT_ROW_COUNT) => {
  const boundaries = new Map<number, { start: number; end: number }>();

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (const columnKey of VIRTUAL_TABLE_LAB_BUSINESS_SPAN_COLUMN_KEYS) {
      const span = resolveVirtualTableLabBusinessCellSpan(columnKey, rowIndex);
      const rowSpan = Math.max(0, Math.floor(Number(span.rowSpan) || 0));
      if (rowSpan <= 1) {
        continue;
      }

      const boundary = {
        start: rowIndex,
        end: Math.min(rowCount - 1, rowIndex + rowSpan - 1),
      };

      for (let coveredRowIndex = boundary.start; coveredRowIndex <= boundary.end; coveredRowIndex += 1) {
        boundaries.set(
          coveredRowIndex,
          mergeVirtualTableLabBoundary(boundaries.get(coveredRowIndex), boundary),
        );
      }
    }
  }

  return boundaries;
};

const VIRTUAL_TABLE_LAB_UTILITY_MIRROR_BOUNDARIES = createVirtualTableLabBusinessBoundaryMap();

const resolveVirtualTableLabUtilityMirrorSpan = (rowIndex: number) => {
  const boundary = VIRTUAL_TABLE_LAB_UTILITY_MIRROR_BOUNDARIES.get(rowIndex);
  if (!boundary) {
    return {
      rowSpan: 1,
      colSpan: 1,
    };
  }

  if (boundary.start !== rowIndex) {
    return {
      rowSpan: 0,
      colSpan: 0,
    };
  }

  return {
    rowSpan: Math.max(1, boundary.end - boundary.start + 1),
    colSpan: 1,
  };
};

type ResolveVirtualTableLabCellSpanOptions = {
  mirrorUtilitySpans?: boolean;
};

export const resolveVirtualTableLabCellSpan = (
  _row: VirtualTableLabRow,
  rowIndex: number,
  column: VirtualTableColumn,
  options: ResolveVirtualTableLabCellSpanOptions = {},
) => {
  if (column.key === "selection" || column.key === "index" || column.key === "action") {
    if (options.mirrorUtilitySpans) {
      return resolveVirtualTableLabUtilityMirrorSpan(rowIndex);
    }
    return {
      rowSpan: 1,
      colSpan: 1,
    };
  }

  return resolveVirtualTableLabBusinessCellSpan(column.key, rowIndex);
};
