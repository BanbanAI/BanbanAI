import i18next from "i18next";

export type SerialNumberRuleType = 'date' | 'field' | 'prefix' | 'counting'

export type CountingRuleValue = {
  digitLength: number;
  digitFixed: boolean;
  resetCycle: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  startValue: number;
}

export type CountingRule = {
  id: string;
  type: 'counting';
  value: CountingRuleValue;
}

export const resetCycleOptions = [
  {
    value: 'none',
    get label(){return i18next.t('nocodeTypes.noAutoReset')}
  },
  {
    value: 'daily',
    get label(){return i18next.t('nocodeTypes.resetDaily')}
  },
  {
    value: 'weekly',
    get label(){return i18next.t('nocodeTypes.resetWeekly')}
  },
  {
    value: 'monthly',
    get label(){return i18next.t('nocodeTypes.resetMonthly')}
  },
  {
    value: 'yearly',
    get label(){return i18next.t('nocodeTypes.resetYearly')}
  },
]

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