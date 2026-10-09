<template>
  <div class="aggregate-data-preview" v-loading="loading">
    <div v-if="columns.length && displayRows.length" class="preview-table-wrap">
      <table class="preview-table">
        <thead>
          <tr>
            <th v-for="item in columns" :key="item.uid">
              {{ item.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in displayRows" :key="`preview_row_${rowIndex}`">
            <template v-for="item in columns" :key="`${item.uid}_${rowIndex}`">
              <td
                v-if="!isDimensionColumn(item.uid) || getPreviewCell(rowIndex, item.uid)?.visible"
                :rowspan="isDimensionColumn(item.uid) ? getPreviewCell(rowIndex, item.uid)?.rowspan : undefined"
              >
                {{ getDisplayCellValue(rowIndex, item.uid) }}
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="preview-empty">
      <nocode-empty-state />
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatNumberWithSeparator } from '@common/utils/amount';
import { Row } from '@common/types/project';
import { computed } from 'vue';
import NocodeEmptyState from '@renderer/views/nocode/components/global/NocodeEmptyState.vue';

type PreviewDimension = {
  uid: string,
  label: string,
};

type PreviewMetric = {
  uid: string,
  label: string,
  format?: {
    isPercent?: boolean,
    completeZero?: boolean,
    decimalPlaces?: number,
    thousandSeparator?: string,
    decimalSeparator?: string,
  },
};

const TEXT = {
  emptyValue: '--',
};

const props = withDefaults(defineProps<{
  dimensions?: PreviewDimension[],
  metrics?: PreviewMetric[],
  rows?: Row[],
  loading?: boolean,
}>(), {
  dimensions: () => [],
  metrics: () => [],
  rows: () => [],
  loading: false,
});

const columns = computed(() => [...props.dimensions, ...props.metrics]);
const dimensionUIDs = computed(() => props.dimensions.map(item => item.uid));
const dimensionUIDSet = computed(() => new Set(dimensionUIDs.value));
const metricFormatMap = computed(() => props.metrics.reduce<Record<string, PreviewMetric['format']>>((result, item) => {
  result[item.uid] = item.format;
  return result;
}, {}));

const serializeCellValue = (value: any) => {
  if (value === undefined || value === null || value === '') return '__empty__';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
};

const compareCellValue = (left: any, right: any) => {
  const leftValue = serializeCellValue(left);
  const rightValue = serializeCellValue(right);
  return leftValue.localeCompare(rightValue, 'zh-CN', { numeric: true, sensitivity: 'base' });
};

const sortedRows = computed(() => {
  const rows = [...(props.rows || [])];
  if (!dimensionUIDs.value.length) return rows;

  rows.sort((left, right) => {
    for (const uid of dimensionUIDs.value) {
      const result = compareCellValue(left?.[uid], right?.[uid]);
      if (result !== 0) return result;
    }
    return 0;
  });

  return rows;
});

const displayRows = computed(() => sortedRows.value.slice(0, 100));

const previewCellMap = computed(() => {
  const rows = displayRows.value;
  const result = rows.map(() => ({} as Record<string, { visible: boolean, rowspan: number }>));

  dimensionUIDs.value.forEach((uid, dimensionIndex) => {
    let startIndex = 0;

    while (startIndex < rows.length) {
      let endIndex = startIndex + 1;

      while (endIndex < rows.length) {
        const isSameGroup = dimensionUIDs.value.slice(0, dimensionIndex + 1).every(currentUID => {
          return serializeCellValue(rows[startIndex]?.[currentUID]) === serializeCellValue(rows[endIndex]?.[currentUID]);
        });
        if (!isSameGroup) break;
        endIndex += 1;
      }

      result[startIndex][uid] = {
        visible: true,
        rowspan: endIndex - startIndex,
      };

      for (let index = startIndex + 1; index < endIndex; index += 1) {
        result[index][uid] = {
          visible: false,
          rowspan: 0,
        };
      }

      startIndex = endIndex;
    }
  });

  return result;
});

const isDimensionColumn = (uid: string) => dimensionUIDSet.value.has(uid);
const getPreviewCell = (rowIndex: number, uid: string) => previewCellMap.value[rowIndex]?.[uid];

const formatPlainValue = (value: any) => {
  if (value === undefined || value === null || value === '') return TEXT.emptyValue;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
};

const formatMetricValue = (value: any, format?: PreviewMetric['format']) => {
  if (value === undefined || value === null || value === '') return TEXT.emptyValue;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return formatPlainValue(value);

  const formattedValue = formatNumberWithSeparator(
    format?.isPercent ? numericValue * 100 : numericValue,
    {
      decimalPlaces: format?.decimalPlaces ?? 0,
      thousandSeparator: format?.thousandSeparator || '',
      decimalSeparator: format?.decimalSeparator || '.',
      decimalPadding: Boolean(format?.completeZero),
    },
  );

  return format?.isPercent ? `${formattedValue}%` : formattedValue;
};

const displayValueMap = computed(() => {
  return displayRows.value.map(row => {
    return columns.value.reduce<Record<string, string>>((result, item) => {
      result[item.uid] = isDimensionColumn(item.uid)
        ? formatPlainValue(row?.[item.uid])
        : formatMetricValue(row?.[item.uid], metricFormatMap.value[item.uid]);
      return result;
    }, {});
  });
});

const getDisplayCellValue = (rowIndex: number, uid: string) => displayValueMap.value[rowIndex]?.[uid] || TEXT.emptyValue;
</script>

<style scoped lang="scss">
.aggregate-data-preview {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #fff;
}

.preview-table-wrap {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.preview-table {
  min-width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.preview-table th,
.preview-table td {
  height: 46px;
  padding: 0 14px;
  border: 1px solid #ebeef5;
  text-align: left;
  vertical-align: middle;
  font-size: 13px;
  line-height: 20px;
  color: #303133;
  background: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  font-weight: 500;
  color: #606266;
  background: #fafbfd;
}

.preview-empty {
  width: 100%;
  height: 100%;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
