import type { PivotTableIndicator } from "../model";

export type PivotTableLabRecord = {
  id: string;
  region: string;
  store: string;
  quarter: string;
  month: string;
  channel: string;
  amount: number;
  target: number;
};

export type PivotTableLabDimension = {
  code: keyof PivotTableLabRecord;
  name: string;
  width?: number;
};

export type PivotTableLabAggregateRecord = {
  amount: number;
  target: number;
};

const REGIONS = ["华东", "华南", "华北"];
const STORES = {
  华东: ["上海一店", "上海二店"],
  华南: ["广州一店", "深圳一店"],
  华北: ["北京一店", "天津一店"],
} as const;
const QUARTERS = [
  { quarter: "Q1", months: ["1月", "2月"] },
  { quarter: "Q2", months: ["4月", "5月"] },
];
const CHANNELS = ["直营网", "经销商"];

export const PIVOT_TABLE_LAB_DIMENSIONS: PivotTableLabDimension[] = [
  {
    code: "region",
    name: "大区",
    width: 140,
  },
  {
    code: "store",
    name: "门店",
    width: 160,
  },
  {
    code: "channel",
    name: "渠道",
    width: 120,
  },
];

export const PIVOT_TABLE_LAB_DEFAULT_LEFT_CODES: Array<keyof PivotTableLabRecord> = ["region", "store"];
export const PIVOT_TABLE_LAB_CROSS_TOP_CODES: Array<keyof PivotTableLabRecord> = ["quarter", "month"];
export const PIVOT_TABLE_LAB_TREE_TOP_CODES: Array<keyof PivotTableLabRecord> = ["quarter"];
export const PIVOT_TABLE_LAB_DEFAULT_TOP_CODES: Array<keyof PivotTableLabRecord> = [...PIVOT_TABLE_LAB_CROSS_TOP_CODES];
export const PIVOT_TABLE_LAB_TOP_DIMENSIONS: PivotTableLabDimension[] = [
  {
    code: "quarter",
    name: "季度",
    width: 120,
  },
  {
    code: "month",
    name: "月份",
    width: 120,
  },
];

export type PivotTableLabIndicatorSide = "top" | "left";

export const pivotTableLabIndicators: PivotTableIndicator<PivotTableLabRecord, PivotTableLabAggregateRecord>[] = [
  {
    code: "amount",
    name: "销售额",
    width: 120,
    align: "right",
    headerAlign: "right",
    render(value) {
      return typeof value === "number" ? value.toLocaleString("zh-CN") : value;
    },
  },
  {
    code: "target",
    name: "目标值",
    width: 120,
    align: "right",
    headerAlign: "right",
    render(value) {
      return typeof value === "number" ? value.toLocaleString("zh-CN") : value;
    },
  },
  {
    code: "rate",
    name: "达成率",
    width: 120,
    align: "right",
    headerAlign: "right",
    getValue(record) {
      if (!record?.target) {
        return "-";
      }
      return Number((record.amount / record.target).toFixed(2));
    },
    render(value) {
      return typeof value === "number" ? `${Math.round(value * 100)}%` : value;
    },
  },
];

export const createPivotTableLabRecords = (): PivotTableLabRecord[] => {
  const rows: PivotTableLabRecord[] = [];
  let rowIndex = 0;

  for (const region of REGIONS) {
    for (const store of STORES[region]) {
      for (const quarterConfig of QUARTERS) {
        for (const month of quarterConfig.months) {
          for (const channel of CHANNELS) {
            rowIndex += 1;
            const amount = 80 + rowIndex * 7;
            const target = 100 + rowIndex * 5;
            rows.push({
              id: `pivot-row-${rowIndex}`,
              region,
              store,
              quarter: quarterConfig.quarter,
              month,
              channel,
              amount,
              target,
            });
          }
        }
      }
    }
  }

  return rows;
};
