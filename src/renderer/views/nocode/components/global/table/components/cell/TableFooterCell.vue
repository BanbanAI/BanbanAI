<template>
  <div
    class="table-footer-cell"
    :class="{
      ['show']: transformValue != AggregationType.NOT_SHOW,
    }"
    @mouseenter="ensureAggregationOptions"
  >
    <el-select :modelValue="transformValue" @update:modelValue="updateValue" @visible-change="handleVisibleChange" placeholder="" v-if="!isUnsupported">
      <el-option :key="AggregationType.NOT_SHOW" :label="aggregationOptionText[AggregationType.NOT_SHOW]" :value="AggregationType.NOT_SHOW"/>
      <el-option v-for="item in aggregationOptions" :key="item" :label="aggregationOptionText[item]" :value="item"/>
      <template #label="{ label, value }">
        <span :title="`${value === AggregationType.NOT_SHOW ? $t('TableFooterCell.notSetStatistics ') : label}` + ` ${aggregationValue}`">
          {{ value === AggregationType.NOT_SHOW ? $t('TableFooterCell.notSetStatistics ') : label }}{{ ` ${aggregationValue}` }}
        </span>
      </template>
    </el-select>
    <el-select :title="$t('TableFooterCell.notSupportStatistics ')" :modelValue="$t('TableFooterCell.notSupportStatistics ')" disabled v-else class="disable-select"/>
  </div>
</template>

<script lang='ts' setup>
import { computed, ref, watch } from 'vue'
import { Table } from "../../table";
import { AggregationType } from '@common/types/nocode';
import { formElementInstances } from '@renderer/utils/instance';
import { formDataApi } from '@renderer/utils';
import { equals, isEmpty } from '@common/utils/object';
import { fixFloat } from '@common/utils/math'
import { formatNumberFieldDisplayValue } from '@common/utils/fieldValue';
import { TableUID } from '@common/types/project';
import i18next from 'i18next';
import { executeFormulaCalculation } from '../../utils';

const props = defineProps<{
  params: any,
  widget: Table,
  subTableUID?: TableUID
}>();

const extra = computed(() => props.params.extra);
const fieldUID = computed(() => props.params.uid);
const isSubColumn = computed(() => props.params.isSubColumn)

const aggregationOptions = ref([])
const aggregationOptionsLoaded = ref(false)

const updateAggregationOptions = (options: AggregationType[] = []) => {
  aggregationOptions.value = options.filter(item => {
    if(isSubColumn.value) {
      return [AggregationType.MAX, AggregationType.MIN, AggregationType.SUM].includes(item)
    }
    return AggregationType.NOT_SHOW !== item
  })
  aggregationOptionsLoaded.value = true
}

const ensureAggregationOptions = async () => {
  if (aggregationOptionsLoaded.value) return
  const type = extra.value?.widgetType;
  if(!type) {
    updateAggregationOptions()
    return
  }
  const widget = await formElementInstances.getInstance(type)
  const config = widget.getConfigurations()
  updateAggregationOptions(config.aggregationInfo || [])
}

watch(() => {
  return extra.value?.widgetType
}, (newVal, oldVal) => {
  if(newVal === oldVal) return
  aggregationOptionsLoaded.value = false
  aggregationOptions.value = []
  if (!newVal) {
    aggregationOptionsLoaded.value = true
    return
  }
  if (props.widget.dataAggregation[fieldUID.value] && props.widget.dataAggregation[fieldUID.value] !== AggregationType.NOT_SHOW) {
    void ensureAggregationOptions()
  }
}, { immediate: true })

const aggregationOptionText = {
  get [AggregationType.NOT_SHOW]() { return i18next.t('TableFooterCell.notShow') },
  get [AggregationType.SUM]() { return i18next.t('TableFooterCell.sum') },
  get [AggregationType.AVE]() { return i18next.t('TableFooterCell.ave') },
  get [AggregationType.MAX]() { return i18next.t('TableFooterCell.max') },
  get [AggregationType.MIN]() { return i18next.t('TableFooterCell.min') },
  get [AggregationType.FILLED]() { return i18next.t('TableFooterCell.filled') },
  get [AggregationType.UNFILLED]() { return i18next.t('TableFooterCell.notFilled') },
}

const transformValue = computed(() => props.widget.dataAggregation[fieldUID.value] ?? AggregationType.NOT_SHOW)
const isUnsupported = computed(() => aggregationOptionsLoaded.value && !aggregationOptions.value.length)

const handleVisibleChange = (visible: boolean) => {
  if (visible) {
    void ensureAggregationOptions()
  }
}

const updateValue = (val: AggregationType) => {
  const _temp = {...props.widget.dataAggregation, [fieldUID.value]: val}
  props.widget.dataAggregation = _temp
}

const getDistinctCount = async () => {
  if(isSubColumn.value) {
    return getSubDistinctCount()
  }
  const _filters = await props.widget.getDisplayFilters()
  const res =  await formDataApi.distinctCount({
    nocodeId: props.widget.nocodeId,
    tableUID: props.widget.formTableUID,
    columnId: fieldUID.value,
    options: {
      stage: props.widget.getQueryStage(props.widget.formTableUID),
      filters: _filters
    }
  })
  return res
}

const getSubDistinctCount = async () => {
  // Formula columns are calculated in the cell renderer. A virtual table may
  // not mount every row, so calculate the complete loaded subtable here.
  const formula = extra.value?.computeType === 'formula'
    ? extra.value?.formula
    : (extra.value?.defaultType === 'formula' || extra.value?.defaultValueType === 'formula')
      ? (extra.value?.defaultFormulaValue || extra.value?.formula)
      : undefined;
  if (formula && props.subTableUID) {
    const subDataInfo = props.widget.subTableData?.[props.params.parentUID];
    let subData = subDataInfo?.rows || [];
    const subDataTotal = Number(subDataInfo?.total || 0);
    let displaySubFilters;
    if (subDataTotal > subData.length) {
      // A virtual table may only have the current page in subTableData. Fetch
      // the complete filtered set before evaluating a client-side formula.
      displaySubFilters = await props.widget.getSubTableDisplayFilters(props.params.parentUID, props.subTableUID);
      // Reuse the table's permission-aware data path. In "all" mode this
      // selects the managed-view endpoint and carries the widget context.
      const bucket = await (props.widget as any).getData(props.subTableUID, {
        stage: props.widget.getQueryStage(props.subTableUID),
        filters: displaySubFilters,
      });
      subData = bucket?.rows || subData;
    }
    if (!subData.length) {
      displaySubFilters ||= await props.widget.getSubTableDisplayFilters(props.params.parentUID, props.subTableUID);
      return await formDataApi.distinctCount({
        nocodeId: props.widget.nocodeId,
        tableUID: props.subTableUID,
        columnId: fieldUID.value,
        options: {
          stage: props.widget.getQueryStage(props.subTableUID),
          filters: displaySubFilters,
        },
      });
    }
    const formulaCache = new Map<string, any>();
    const values = await Promise.all(subData.map(async (row: any) => {
      const result = await executeFormulaCalculation(
        formula,
        props.widget,
        row,
        props.subTableUID as any,
        formulaCache,
      );
      return result === undefined ? row[fieldUID.value] : result;
    }));
    const countMap = new Map<string, { value: any, count: number }>();
    for (const value of values) {
      const key = JSON.stringify(value ?? null);
      const item = countMap.get(key);
      if (item) item.count += 1;
      else countMap.set(key, { value, count: 1 });
    }
    return [...countMap.values()];
  }
  const displaySubFilters = await props.widget.getSubTableDisplayFilters(props.params.parentUID, props.subTableUID)
  return await formDataApi.distinctCount({
    nocodeId: props.widget.nocodeId,
    tableUID: props.subTableUID,
    columnId: fieldUID.value,
    options: {
      stage: props.widget.getQueryStage(props.subTableUID),
      filters: displaySubFilters
    }
  })
}

const getFilledCount = async (unfilled: boolean = false) => {
  const res = await getDistinctCount()
  const filledCount = res.reduce((pre, cur) => {
    return pre + (!isEmpty(cur.value === "" ? null : cur.value) ? cur.count : 0)
  }, 0)
  const total = res.map(item => item.count).reduce((pre, cur) => pre + cur, 0)
  return unfilled ? total - filledCount : filledCount
}

const getSumCount = async () => {
  const res = await getDistinctCount()
  return res.reduce((pre, cur) => fixFloat(pre + (cur.value ?? 0) * (cur.count ?? 0)), 0)
}

const getAveCount = async () => {
  const res = await getDistinctCount()
  const sumCount = res.reduce((pre, cur) => fixFloat(pre + (cur.value ?? 0) * (cur.count ?? 0)), 0)
  const count = res.reduce((pre, cur) => pre + (cur.count ?? 0), 0)
  const average = fixFloat(sumCount / count).toFixed(2)
  return Number(average)
}

const getMaxCount = async () => {
  const res = await getDistinctCount()
  const max = Math.max(...res.map(r => r.value ?? Number.NEGATIVE_INFINITY))
  return max === Number.NEGATIVE_INFINITY ? null : max
}

const getMinCount = async () => {
  const res = await getDistinctCount()
  const min = Math.min(...res.map(r => r.value ?? Number.POSITIVE_INFINITY))
  return min === Number.POSITIVE_INFINITY ? null : min
}

const count = ref(0)
let aggregationRequestVersion = 0
const numericAggregationTypes = [
  AggregationType.SUM,
  AggregationType.AVE,
  AggregationType.MAX,
  AggregationType.MIN,
]

const formatAggregationValue = (value: number) => {
  const fieldExtra = extra.value || {}
  const amount = fieldExtra.amount
  const isPercent = Boolean(fieldExtra.isPercent)

  const formattedValue = formatNumberFieldDisplayValue(value, {
    ...fieldExtra,
    isPercent: false,
    decimalPlaces: fieldExtra.decimalPlaces ?? amount?.decimal,
    completeZero: amount?.decimalPadding ?? amount?.completeZero ?? fieldExtra.completeZero,
    thousandSeparator: amount?.thousandSeparator ?? fieldExtra.thousandSeparator,
    decimalSeparator: amount?.decimalSeparator ?? fieldExtra.decimalSeparator,
  })

  return isPercent && formattedValue ? `${formattedValue}%` : formattedValue
}

const aggregationValue = computed(() => {
  if(!aggregationOptions.value?.length) return ''
  if(transformValue.value === AggregationType.NOT_SHOW) return ''
  if(count.value === null || count.value === undefined) return ''
  if(!numericAggregationTypes.includes(transformValue.value)) return count.value
  return formatAggregationValue(count.value)
})

const refreshAggregationValue = async () => {
  const requestVersion = ++aggregationRequestVersion;
  count.value = null;

  let request: Promise<number | null> | undefined;
  switch(transformValue.value) {
  case AggregationType.FILLED:
    request = getFilledCount();
    break;
  case AggregationType.UNFILLED:
    request = getFilledCount(true);
    break;
  case AggregationType.SUM:
    request = getSumCount();
    break;
  case AggregationType.AVE:
    request = getAveCount();
    break;
  case AggregationType.MAX:
    request = getMaxCount();
    break;
  case AggregationType.MIN:
    request = getMinCount();
    break;
  default:
    return;
  }

  try {
    const value = await request;
    if (requestVersion === aggregationRequestVersion) {
      count.value = value;
    }
  } catch {
    if (requestVersion === aggregationRequestVersion) {
      count.value = null;
    }
  }
};

watch(() => {
  return {
    value: transformValue.value,
    refreshFooter: props.widget.refreshDataTime,
  }
}, (newVal, oldVal) => {
  if(equals(newVal, oldVal)) return
  void refreshAggregationValue();
},{immediate: true, deep: true})
</script>

<style lang='scss' scoped>
.table-footer-cell {
  padding: 0px 8px;
  width: 100%;
  height: 100%;

  &:hover {
    background-color: #f7f7fa;

    :deep(.el-select .el-select__wrapper) {
      opacity: 1;
    }
  }

  &.show {
    :deep(.el-select .el-select__wrapper) {
      opacity: 1 !important;
    }
  }

  :deep(.el-select) {
    .el-select__wrapper {
      box-shadow: none;
      background-color: transparent;
      opacity: 0;

      &.is-focused {
        opacity: 1 !important;
      }
    }

    &.disable-select {
      .el-select__suffix {
        display: none;
      }
    }
  }
}
</style>
