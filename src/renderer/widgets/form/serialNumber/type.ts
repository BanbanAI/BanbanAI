export type SerialNumberRuleType = 'date' | 'field' | 'prefix' | 'counting'

export type CountingRuleValue = {
  digitLength: number;
  digitFixed: boolean;
  resetCycle: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  startValue: number;
  resetOnSubmit?: boolean;
}

export type CountingRule = {
  id: string;
  type: 'counting';
  value: CountingRuleValue;
}

export type DateRuleValue = {
  optionalFormat: 'YYYY' | 'YYYYMM' | 'YYYY-MM' | 'YYYY/MM' | 'YYYYMMMDD' | 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'custom';
  customFormat: string;
}

export type DateRule = {
  id: string;
  type: 'date';
  value: DateRuleValue;
}

export type SerialNumberRule = {
  id: string;
  type: 'field' | 'prefix';
  value: string;
} | CountingRule | DateRule

export type SelectOption = {
  label: string;
  value: string;
};

export type SerialNumberCounter = {
  count?: number;
  resetTime?: number | null;
  updateTime?: number | null;
}

export const resetCycleOptions = [
  {
    value: 'none',
    label: '不自动重置',
  },
  {
    value: 'daily',
    label: '每日重置',
  },
  {
    value: 'weekly',
    label: '每周重置',
  },
  {
    value: 'monthly',
    label: '每月重置',
  },
  {
    value: 'yearly',
    label: '每年重置',
  },
]

// [
//     {name: "xx", value},
//     {name: "xx",value}
// ]

// [
//     {
//         label: string,
//         name: string, // 唯一的
//         type: "button" | "input",
//         max?: number,  // 当前选项点击后能创建多少次
//         component: //vue弹窗组件，v-model、widget,value   emit: update
//     },
    
// ]
