<template>
  <el-dialog
    :model-value="modelValue"
    class="aggregate-dimension-dialog-panel"
    width="960"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-header__title">{{ $t('AggregateDimensionDialog.title') }}</div>
      </div>
    </template>

    <div class="dimension-dialog">
      <div class="dimension-dialog__tip">{{ $t('AggregateDimensionDialog.tip') }}</div>

      <template v-if="sourceTables.length">
        <div class="dimension-builder">
          <el-scrollbar class="dimension-builder-scrollbar">
            <div class="dimension-builder__content">
              <div class="dimension-builder__header">
                <div
                  v-for="sourceTable in sourceTables"
                  :key="sourceTable.uid"
                  class="dimension-builder__header-item"
                >
                  <div class="dimension-builder__header-title">{{ getSourceHeaderTitle(sourceTable.uid) }}</div>
                </div>
                <div class="dimension-builder__header-action"></div>
              </div>

              <div class="dimension-builder__body">
                <div
                  v-for="dimension in draftDimensions"
                  :key="dimension.uid"
                  v-memo="[getDimensionMemoKey(dimension)]"
                  class="dimension-builder-row"
                >
                  <div class="dimension-builder-row__cells">
                    <template v-for="sourceTable in sourceTables" :key="sourceTable.uid">
                      <div class="dimension-builder-row__cell">
                        <el-select
                          :model-value="getFieldReferenceValue(getDimensionItem(dimension, sourceTable.uid))"
                          :placeholder="$t('AggregateDimensionDialog.selectField')"
                          filterable
                          clearable
                          @update:model-value="(value) => handleDimensionItemChange(dimension, sourceTable.uid, value)"
                        >
                          <el-option
                            v-for="option in getAvailableFieldOptions(dimension, sourceTable.uid)"
                            :key="option.value"
                            :label="option.label"
                            :value="option.value"
                          />
                        </el-select>
                      </div>
                    </template>
                  </div>

                  <button class="dimension-builder-row__delete" type="button" @click="handleRemoveDimension(dimension.uid)">
                    <el-icon><i-ep-delete /></el-icon>
                  </button>
                </div>
              </div>
            </div>
          </el-scrollbar>

          <button class="add-dimension-btn" type="button" @click="handleAddDimension">
            <el-icon><i-ep-plus /></el-icon>
            {{ $t('AggregateDimensionDialog.add') }}
          </button>
        </div>
      </template>

      <el-empty v-else :description="$t('AggregateDimensionDialog.noSource')" :image-size="60" />
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ $t('AggregateDimensionDialog.cancel') }}</el-button>
      <el-button type="primary" @click="handleConfirm">{{ $t('AggregateDimensionDialog.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { AggregateDimension, AggregateDimensionDateFormat, AggregateDimensionItem, AggregateSourceTable } from '@common/types/nocode';
import { Field, FieldUID } from '@common/types/project';
import { deepClone } from '@common/utils/object';
import { computed, ref, watch } from 'vue';

type AggregateFieldOption = {
  value: string,
  label: string,
  fieldUID?: FieldUID | '_count' | null,
  subFieldUID?: FieldUID | '_count' | null,
  field?: Field | null,
};

type AggregateSourceHeader = {
  uid: string,
  title: string,
  subLabel?: string,
};

type GroupedFieldOptions = {
  all: AggregateFieldOption[],
  byType: Record<string, AggregateFieldOption[]>,
  byValue: Record<string, AggregateFieldOption>,
};

const DEFAULT_DATE_FORMAT: AggregateDimensionDateFormat = 'year-month-day';

const props = withDefaults(defineProps<{
  modelValue: boolean,
  value?: AggregateDimension[],
  sourceTables?: AggregateSourceTable[],
  sourceHeaders?: AggregateSourceHeader[],
  fieldOptionsMap?: Record<string, AggregateFieldOption[]>,
  filterEmptyValue?: boolean,
}>(), {
  value: () => [],
  sourceTables: () => [],
  sourceHeaders: () => [],
  fieldOptionsMap: () => ({}),
  filterEmptyValue: false,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
  (event: 'update', value: AggregateDimension[]): void,
  (event: 'update:filter-empty-value', value: boolean): void,
}>();

const draftDimensions = ref<AggregateDimension[]>([]);
const EMPTY_GROUPED_FIELD_OPTIONS: GroupedFieldOptions = {
  all: [],
  byType: {},
  byValue: {},
};

const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const createDefaultDimensionItem = (sourceUID = ''): AggregateDimensionItem => ({ uid: createId('dimension_item'), sourceUID, fieldUID: null, subFieldUID: null });
const createDefaultDimension = (sourceTableList: AggregateSourceTable[] = []): AggregateDimension => ({
  uid: createId('dimension'),
  name: '',
  dateFormat: null,
  items: sourceTableList.map(item => createDefaultDimensionItem(item.uid)),
});

const buildFieldOptionValue = (fieldUID?: FieldUID | '_count' | null, subFieldUID?: FieldUID | '_count' | null) => {
  if (!fieldUID && !subFieldUID) return '';
  return [fieldUID || '', subFieldUID || ''].join('::');
};
const getFieldReferenceValue = (field?: AggregateDimensionItem) => buildFieldOptionValue(field?.fieldUID, field?.subFieldUID);
const getFieldTypeKey = (option?: AggregateFieldOption) => {
  const field = option?.field;
  if (!field) return '';
  return `${field.revisedType || field.type}::${field.meta?.subType || ''}`;
};
const isDateTypeKey = (typeKey = '') => ['date', 'daterange'].includes(typeKey.split('::')[1] || '');
const sourceHeaderMap = computed(() => props.sourceHeaders.reduce<Record<string, AggregateSourceHeader>>((result, item) => {
  result[item.uid] = item;
  return result;
}, {}));
const groupedFieldOptionsMap = computed(() => Object.entries(props.fieldOptionsMap).reduce<Record<string, GroupedFieldOptions>>((result, [sourceUID, options]) => {
  const grouped = options.reduce<GroupedFieldOptions>((current, option) => {
    current.all.push(option);
    current.byValue[option.value] = option;
    const typeKey = getFieldTypeKey(option);
    if (!current.byType[typeKey]) current.byType[typeKey] = [];
    current.byType[typeKey].push(option);
    return current;
  }, {
    all: [],
    byType: {},
    byValue: {},
  });
  result[sourceUID] = grouped;
  return result;
}, {}));
const getGroupedFieldOptionsBySourceUID = (sourceUID?: string) => groupedFieldOptionsMap.value[sourceUID || ''] || EMPTY_GROUPED_FIELD_OPTIONS;
const getFieldOptionsBySourceUID = (sourceUID?: string) => getGroupedFieldOptionsBySourceUID(sourceUID).all;
const getSourceHeaderTitle = (sourceUID: string) => {
  const title = sourceHeaderMap.value[sourceUID]?.title;
  if (!title) return '';

  const subLabel = sourceHeaderMap.value[sourceUID]?.subLabel;
  if (subLabel) return `${title}.${subLabel}`;

  return title;
};

const applyFieldReferenceValue = (target: AggregateDimensionItem, option?: AggregateFieldOption) => {
  target.fieldUID = option?.fieldUID ?? null;
  target.subFieldUID = option?.subFieldUID ?? null;
};

const getNormalizedDimensionItems = (dimension: AggregateDimension) => {
  return props.sourceTables.map(sourceTable => {
    return dimension.items?.find(item => item.sourceUID === sourceTable.uid) || createDefaultDimensionItem(sourceTable.uid);
  });
};

const syncDimensionItems = (dimension: AggregateDimension) => {
  dimension.items = getNormalizedDimensionItems(dimension);
  return dimension.items;
};

const getDimensionItem = (dimension: AggregateDimension, sourceUID: string) => {
  return dimension.items?.find(item => item.sourceUID === sourceUID) || createDefaultDimensionItem(sourceUID);
};

const getFieldOptionByValue = (sourceUID: string, value?: string) => {
  return getGroupedFieldOptionsBySourceUID(sourceUID).byValue[value || ''];
};

const getDimensionSelectedTypeKey = (dimension: AggregateDimension) => {
  return getNormalizedDimensionItems(dimension).reduce((result, item) => {
    if (result) return result;
    return getFieldTypeKey(getFieldOptionByValue(item.sourceUID, getFieldReferenceValue(item)));
  }, '');
};

const normalizeDimensionSelection = (dimension: AggregateDimension) => {
  const dimensionItems = syncDimensionItems(dimension);
  const selectedTypeKey = getDimensionSelectedTypeKey(dimension);
  if (selectedTypeKey) {
    dimensionItems.forEach(item => {
      const option = getFieldOptionByValue(item.sourceUID, getFieldReferenceValue(item));
      if (option && getFieldTypeKey(option) !== selectedTypeKey) {
        applyFieldReferenceValue(item);
      }
    });
  }
  if (selectedTypeKey && isDateTypeKey(selectedTypeKey)) {
    if (!dimension.dateFormat) dimension.dateFormat = DEFAULT_DATE_FORMAT;
    return;
  }
  dimension.dateFormat = null;
};

const getAvailableFieldOptions = (dimension: AggregateDimension, sourceUID: string) => {
  const selectedTypeKey = getDimensionSelectedTypeKey(dimension);
  const groupedOptions = getGroupedFieldOptionsBySourceUID(sourceUID);
  if (!selectedTypeKey) return groupedOptions.all;
  return groupedOptions.byType[selectedTypeKey] || [];
};

const getDimensionMemoKey = (dimension: AggregateDimension) => {
  return `${dimension.uid}|${dimension.dateFormat || ''}|${(dimension.items || []).map(item => getFieldReferenceValue(item)).join('|')}`;
};

const syncDraftDimensions = () => {
  draftDimensions.value = deepClone(props.value || []).map(item => ({
    ...item,
    name: item.name || '',
    dateFormat: item.dateFormat || null,
    items: props.sourceTables.map(sourceTable => {
      return item.items?.find(dimensionItem => dimensionItem.sourceUID === sourceTable.uid) || createDefaultDimensionItem(sourceTable.uid);
    }),
  }));
  draftDimensions.value.forEach(dimension => normalizeDimensionSelection(dimension));
};

const handleAddDimension = () => {
  draftDimensions.value.push(createDefaultDimension(props.sourceTables));
};

const handleRemoveDimension = (uid: string) => {
  draftDimensions.value = draftDimensions.value.filter(item => item.uid !== uid);
};

const handleDimensionItemChange = (dimension: AggregateDimension, sourceUID: string, value?: string) => {
  syncDimensionItems(dimension);
  const item = getDimensionItem(dimension, sourceUID);
  const option = getFieldOptionsBySourceUID(sourceUID).find(field => field.value === value);
  applyFieldReferenceValue(item, option);
  normalizeDimensionSelection(dimension);
};

const handleConfirm = () => {
  const nextDimensions = deepClone(draftDimensions.value).filter(item => (item.items || []).some(dimensionItem => dimensionItem.fieldUID || dimensionItem.subFieldUID));
  emit('update:filter-empty-value', Boolean(props.filterEmptyValue));
  emit('update', nextDimensions);
  emit('update:modelValue', false);
};

watch(() => props.modelValue, visible => {
  if (visible) {
    syncDraftDimensions();
    if (draftDimensions.value.length === 0) {
      handleAddDimension();
    }
    return;
  }
  draftDimensions.value = [];
}, { immediate: true });
</script>

<style scoped lang="scss">
.dialog-header__title {
  color: var(--text-color-primary);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  text-align: center;
}

@mixin common-select {
  &:has(.is-disabled) {
    cursor: not-allowed;
  }

  :deep(.el-select__wrapper) {
    width: 100%;
    height: 32px;
    background-color: var(--bg-color-overlay);
    border-radius: 4px;
    box-shadow: 0 0 0 0px var(--border-color) inset;
    font-size: 12px;

    &:hover {
      box-shadow: 0 0 0 1px var(--border-color) inset;
    }

    &.is-focused {
      box-shadow: 0 0 0 1px var(--color-primary) inset !important;
    }
  }
}

.dimension-dialog {
  min-height: 500px;
}

.dimension-dialog__tip {
  margin-bottom: 28px;
  color: #8f95a3;
  font-size: 14px;
  line-height: 22px;
}

.dimension-builder {
  --dimension-builder-column-gap: 24px;
  --dimension-builder-column-half-gap: 12px;
  --dimension-builder-column-min-width: 150px;
  --dimension-builder-column-max-width: 360px;
  --dimension-builder-row-action-width: 32px;
  --dimension-builder-row-action-gap: 8px;
  --dimension-builder-row-action-space: calc(var(--dimension-builder-row-action-width) + var(--dimension-builder-row-action-gap));
  min-width: 0;
}

.dimension-builder-scrollbar {
  width: 100%;
}

.dimension-builder__content {
  min-width: max-content;
  width: max-content;
  padding-bottom: 12px;
  box-sizing: border-box;
  width: 100%;
}

.dimension-builder__header {
  display: flex;
  align-items: stretch;
  gap: var(--dimension-builder-column-gap);
  margin-bottom: 18px;
  width: max-content;
  min-width: 100%;
}

.dimension-builder__header-item {
  flex: 1 1 0;
  min-width: var(--dimension-builder-column-min-width);
  max-width: var(--dimension-builder-column-max-width);
  padding: 5px 12px;
  border-radius: 6px;
  background: #f5f7fa;
  height: 32px;
}

.dimension-builder__header-title {
  color: #303133;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}

.dimension-builder__header-subtitle {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 18px;
}

.dimension-builder__header-action {
  width: calc(var(--dimension-builder-row-action-space) - var(--dimension-builder-column-gap));
  flex: 0 0 calc(var(--dimension-builder-row-action-space) - var(--dimension-builder-column-gap));
}

.dimension-builder__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dimension-builder-row {
  display: flex;
  align-items: center;
  gap: var(--dimension-builder-row-action-gap);
  width: max-content;
  min-width: 100%;
}

.dimension-builder-row__cells {
  flex: 0 0 calc(100% - var(--dimension-builder-row-action-space));
  display: flex;
  align-items: center;
  gap: var(--dimension-builder-column-gap);
  width: calc(100% - var(--dimension-builder-row-action-space));
  min-width: calc(100% - var(--dimension-builder-row-action-space));
  max-width: calc(100% - var(--dimension-builder-row-action-space));
}

.dimension-builder-row__cell {
  position: relative;
  flex: 1 1 0;
  min-width: var(--dimension-builder-column-min-width);
  max-width: var(--dimension-builder-column-max-width);

  :deep(.el-select) {
    width: 100%;
    font-size: 14px;
    .el-select__wrapper {
      border-radius: 4px;
    }
  }

  &:not(:last-child)::after {
    content: '=';
    position: absolute;
    left: calc(100% + var(--dimension-builder-column-half-gap));
    top: 50%;
    color: #909399;
    font-size: 18px;
    line-height: 1;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
}

.dimension-builder-row__delete {
  width: var(--dimension-builder-row-action-width);
  height: 32px;
  flex: 0 0 var(--dimension-builder-row-action-width);
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #909399;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.dimension-builder-row__delete:hover {
  background: #fef0f0;
  color: #f56c6c;
}

.add-dimension-btn {
  margin-top: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: #1677ff;
  font-size: 14px;
  line-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

:deep(.dimension-builder-scrollbar .el-scrollbar__wrap) {
  overflow-y: hidden;
}

:deep(.dimension-builder-scrollbar .el-scrollbar__bar.is-horizontal) {
  height: 10px;
}

:deep(.dimension-builder-scrollbar .el-scrollbar__thumb) {
  background-color: #c7ced9;
}

:deep(.dimension-builder-scrollbar .el-scrollbar__view) {
  min-width: 100%;
}

@media (max-width: 1280px) {
  .dimension-builder {
    --dimension-builder-column-gap: 16px;
    --dimension-builder-column-half-gap: 8px;
  }
}
</style>

<style lang="scss">
.aggregate-dimension-dialog-panel {
  --el-dialog-padding-primary: 0;
  --el-dialog-bg-color: var(--bg-color-page);
  --dialog-header-height: 48px;
  --dialog-footer-height: 64px;
  width: 680px;
  padding: 0;
  border-radius: 8px;

  .el-dialog__header {
    height: var(--dialog-header-height);
    padding: 0 16px;
    margin-right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--border-color);
  }

  .el-dialog__headerbtn {
    top: 0;
    right: 0;
    width: var(--dialog-header-height);
    height: var(--dialog-header-height);
  }

  .el-dialog__body {
    border-radius: 8px;
    padding: 24px 20px;
  }

  .el-dialog__footer {
    height: var(--dialog-footer-height);
    padding: 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: end;
    align-items: center;
    background: var(--bg-color-page);
    border-radius: 0 0 8px 8px;
  }

  .el-dialog__footer .el-button {
    border-radius: 4px;
  }
}
</style>
