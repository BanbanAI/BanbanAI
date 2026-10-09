<template>
  <el-dialog
    :model-value="modelValue"
    class="aggregate-dimension-edit-dialog-panel"
    width="960"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-header__title">{{ $t('AggregateDimensionEditDialog.title') }}</div>
      </div>
    </template>

    <div class="dimension-edit-dialog">
      <div class="dimension-edit-dialog__tip">{{ $t('AggregateDimensionEditDialog.tip') }}</div>

      <template v-if="sourceTables.length && draftDimension">
        <div class="dimension-edit-form">
          <div class="dimension-edit-form__block">
            <div class="dimension-edit-form__label">{{ $t('AggregateDimensionEditDialog.nameLabel') }}</div>
            <el-input v-model="draftDimensionName" class="dimension-edit-form__control" :placeholder="$t('AggregateDimensionEditDialog.namePlaceholder')" />
          </div>

          <div v-if="isDateDimension" v-memo="[fieldConfigMemoKey]" class="dimension-edit-form__block">
            <div class="dimension-edit-form__label">{{ $t('AggregateDimensionEditDialog.dateFormatLabel') }}</div>
            <el-select v-model="dimensionDateFormatValue" class="dimension-edit-form__control">
              <el-option
                v-for="option in DATE_FORMAT_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>

          <div v-memo="[fieldConfigMemoKey]" class="dimension-edit-form__block">
            <div class="dimension-edit-form__label">{{ $t('AggregateDimensionEditDialog.configLabel') }}</div>

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
                </div>

                <div class="dimension-builder-row__cells">
                  <template v-for="sourceTable in sourceTables" :key="sourceTable.uid">
                    <div class="dimension-builder-row__cell">
                      <el-select
                        :model-value="getFieldReferenceValue(getDimensionItem(draftDimension, sourceTable.uid))"
                        :placeholder="$t('AggregateDimensionEditDialog.selectField')"
                        filterable
                        clearable
                        @update:model-value="(value) => handleDimensionItemChange(sourceTable.uid, value)"
                      >
                        <el-option
                          v-for="option in getAvailableFieldOptions(sourceTable.uid)"
                          :key="option.value"
                          :label="option.label"
                          :value="option.value"
                        />
                      </el-select>
                    </div>
                  </template>
                </div>
              </div>
            </el-scrollbar>
          </div>
        </div>
      </template>

      <el-empty v-else :description="$t('AggregateDimensionEditDialog.noSource')" :image-size="60" />
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ $t('AggregateDimensionEditDialog.cancel') }}</el-button>
      <el-button type="primary" @click="handleConfirm">{{ $t('AggregateDimensionEditDialog.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { AggregateDimension, AggregateDimensionDateFormat, AggregateDimensionItem, AggregateSourceTable } from '@common/types/nocode';
import { Field, FieldUID } from '@common/types/project';
import { deepClone } from '@common/utils/object';
import i18next from 'i18next';
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

const DATE_FORMAT_OPTIONS: { label: string, value: AggregateDimensionDateFormat }[] = [
  { get label() { return i18next.t('AggregateDimensionEditDialog.year') }, value: 'year' },
  { get label() { return i18next.t('AggregateDimensionEditDialog.yearQuarter') }, value: 'year-quarter' },
  { get label() { return i18next.t('AggregateDimensionEditDialog.yearMonth') }, value: 'year-month' },
  { get label() { return i18next.t('AggregateDimensionEditDialog.yearWeek') }, value: 'year-week' },
  { get label() { return i18next.t('AggregateDimensionEditDialog.yearMonthDay') }, value: 'year-month-day' },
];
const DEFAULT_DATE_FORMAT: AggregateDimensionDateFormat = 'year-month-day';

const props = withDefaults(defineProps<{
  modelValue: boolean,
  value?: AggregateDimension | null,
  sourceTables?: AggregateSourceTable[],
  sourceHeaders?: AggregateSourceHeader[],
  fieldOptionsMap?: Record<string, AggregateFieldOption[]>,
}>(), {
  value: null,
  sourceTables: () => [],
  sourceHeaders: () => [],
  fieldOptionsMap: () => ({}),
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
  (event: 'update', value: AggregateDimension): void,
}>();

const draftDimension = ref<AggregateDimension | null>(null);
const draftDimensionName = ref('');
const EMPTY_GROUPED_FIELD_OPTIONS: GroupedFieldOptions = {
  all: [],
  byType: {},
  byValue: {},
};

const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const createDefaultDimensionItem = (sourceUID = ''): AggregateDimensionItem => ({ uid: createId('dimension_item'), sourceUID, fieldUID: null, subFieldUID: null });
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
const getFieldOptionByValue = (sourceUID: string, value?: string) => getGroupedFieldOptionsBySourceUID(sourceUID).byValue[value || ''];
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

const getDimensionSelectedTypeKey = (dimension: AggregateDimension) => {
  return getNormalizedDimensionItems(dimension).reduce((result, item) => {
    if (result) return result;
    return getFieldTypeKey(getFieldOptionByValue(item.sourceUID, getFieldReferenceValue(item)));
  }, '');
};

const normalizeDimensionSelection = () => {
  if (!draftDimension.value) return;
  const dimensionItems = syncDimensionItems(draftDimension.value);
  const selectedTypeKey = getDimensionSelectedTypeKey(draftDimension.value);
  if (selectedTypeKey) {
    dimensionItems.forEach(item => {
      const option = getFieldOptionByValue(item.sourceUID, getFieldReferenceValue(item));
      if (option && getFieldTypeKey(option) !== selectedTypeKey) {
        applyFieldReferenceValue(item);
      }
    });
  }
  if (selectedTypeKey && isDateTypeKey(selectedTypeKey)) {
    if (!draftDimension.value.dateFormat) draftDimension.value.dateFormat = DEFAULT_DATE_FORMAT;
    return;
  }
  draftDimension.value.dateFormat = null;
};

const isDateDimension = computed(() => {
  if (!draftDimension.value) return false;
  return isDateTypeKey(getDimensionSelectedTypeKey(draftDimension.value));
});
const selectedTypeKey = computed(() => {
  if (!draftDimension.value) return '';
  return getDimensionSelectedTypeKey(draftDimension.value);
});
const fieldConfigMemoKey = computed(() => {
  if (!draftDimension.value) return '';
  return `${selectedTypeKey.value}|${draftDimension.value.dateFormat || ''}|${(draftDimension.value.items || []).map(item => getFieldReferenceValue(item)).join('|')}`;
});

const dimensionDateFormatValue = computed<AggregateDimensionDateFormat>({
  get: () => draftDimension.value?.dateFormat || DEFAULT_DATE_FORMAT,
  set: value => {
    if (!draftDimension.value) return;
    draftDimension.value.dateFormat = value;
  },
});

const getAvailableFieldOptions = (sourceUID: string) => {
  const groupedOptions = getGroupedFieldOptionsBySourceUID(sourceUID);
  if (!selectedTypeKey.value) return groupedOptions.all;
  return groupedOptions.byType[selectedTypeKey.value] || [];
};

const syncDraftDimension = () => {
  if (!props.value) {
    draftDimension.value = null;
    draftDimensionName.value = '';
    return;
  }
  draftDimension.value = {
    ...deepClone(props.value),
    name: props.value.name || '',
    dateFormat: props.value.dateFormat || null,
    items: props.sourceTables.map(sourceTable => {
      return props.value?.items?.find(item => item.sourceUID === sourceTable.uid) || createDefaultDimensionItem(sourceTable.uid);
    }),
  };
  draftDimensionName.value = draftDimension.value.name || '';
  normalizeDimensionSelection();
};

watch(() => props.modelValue, visible => {
  if (!visible) return;
  syncDraftDimension();
}, { immediate: true });

const handleDimensionItemChange = (sourceUID: string, value?: string) => {
  if (!draftDimension.value) return;
  syncDimensionItems(draftDimension.value);
  const item = getDimensionItem(draftDimension.value, sourceUID);
  const option = getFieldOptionsBySourceUID(sourceUID).find(field => field.value === value);
  applyFieldReferenceValue(item, option);
  normalizeDimensionSelection();
};

const handleConfirm = () => {
  if (!draftDimension.value) return;
  draftDimension.value.name = draftDimensionName.value;
  emit('update', deepClone(draftDimension.value));
  emit('update:modelValue', false);
};
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

@mixin common-input {
  :deep(.el-input__wrapper) {
    border-radius: 4px;
    background-color: var(--bg-color-overlay);
    box-shadow: unset;

    &:hover {
      box-shadow: 0 0 0 1px var(--border-color) inset;
    }

    &.is-focus,
    &.is-focused {
      box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
    }

    .el-input__inner {
      font-size: 12px;
      height: 32px;
      color: var(--text-color-regular);

      &::placeholder {
        font-size: 12px;
      }
    }
  }
}

.dimension-edit-dialog {
  min-height: 500px;
}

.dimension-edit-dialog__tip {
  margin-bottom: 32px;
  color: #8f95a3;
  font-size: 14px;
  line-height: 22px;
}

.dimension-edit-form {
  --dimension-builder-column-gap: 24px;
  --dimension-builder-column-half-gap: 12px;
  --dimension-builder-column-min-width: 150px;
  --dimension-builder-column-max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 32px;
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

.dimension-edit-form__block {
  min-width: 0;
}

.dimension-edit-form__label {
  margin-bottom: 12px;
  color: #303133;
  font-size: 15px;
  line-height: 24px;
  font-weight: 500;
}

.dimension-edit-form__control {
  height: 32px;
  width: 360px;

  :deep(.el-input__wrapper) {
    border-radius: 4px;
  }

  :deep(.el-select__wrapper) {
    border-radius: 4px;
  }
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
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
}

.dimension-builder__header-subtitle {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 18px;
}

.dimension-builder-row__cells {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--dimension-builder-column-gap);
  width: max-content;
  min-width: 100%;
}

.dimension-builder-row__cell {
  position: relative;
  flex: 1 1 0;
  min-width: var(--dimension-builder-column-min-width);
  max-width: var(--dimension-builder-column-max-width);

  :deep(.el-select) {
    width: 100%;

    .el-select__wrapper{
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
  .dimension-edit-form {
    --dimension-builder-column-gap: 16px;
    --dimension-builder-column-half-gap: 8px;
  }
}

</style>

<style lang="scss">
.aggregate-dimension-edit-dialog-panel {
  --el-dialog-padding-primary: 0;
  --el-dialog-bg-color: var(--bg-color-page);
  --dialog-header-height: 48px;
  --dialog-footer-height: 64px;
  width: 680px;
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
    padding: 16px;
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
