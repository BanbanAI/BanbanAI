<template>
  <div v-if="currentAggregateTable" class="aggregate-table-setting">
    <header class="aggregate-editor-header">
      <button class="aggregate-editor-header__back" type="button" @click="handleBackClick">
        <el-icon :size="22" color="var(--text-color-regular)"><i-ep-arrow-left /></el-icon>
      </button>

      <div class="aggregate-editor-header__title-wrap">
        <div class="aggregate-editor-header__title-box">
          <div v-if="!isTitleEditing" class="aggregate-editor-header__title-text">
            {{ currentAggregateTable.name || $t('AggregateTableSetting.unnamedAggregateTable') }}
          </div>
          <input
            v-else
            ref="titleInputRef"
            v-model="currentAggregateTable.name"
            class="aggregate-editor-header__title-input"
            :placeholder="$t('AggregateTableSetting.unnamedAggregateTable')"
            @blur="handleTitleInputBlur"
          />
          <button
            class="aggregate-editor-header__edit"
            :class="{ 'aggregate-editor-header__edit--active': isTitleEditing }"
            type="button"
            @click="handleTitleEditClick"
          >
            <el-icon :size="16"><i-ep-edit /></el-icon>
          </button>
        </div>
      </div>
    </header>

    <div class="aggregate-editor-layout">
      <aside class="aggregate-editor-sidebar">
        <el-scrollbar class="aggregate-editor-sidebar__scroll">
          <div class="aggregate-editor-sidebar__content">
            <section class="sidebar-section">
              <div class="sidebar-section__header">
                <div class="sidebar-section__title">{{ $t('AggregateTableSetting.sourceSection') }}</div>
              </div>

              <div v-if="configuredSourceRows.length" class="sidebar-list">
                <div v-for="item in configuredSourceRows" :key="item.uid" class="sidebar-list-item sidebar-list-item--source">
                  <div class="sidebar-list-item__content">
                    <div class="sidebar-list-item__title">{{ item.title }}</div>
                  </div>

                  <div class="sidebar-list-item__actions">
                    <button
                      class="icon-action-btn"
                      :class="{ 'icon-action-btn--active': item.hasFilter }"
                      type="button"
                      @click="openSourceFilterDialog(item.uid)"
                    >
                      <el-icon :size="16"><i-ven-nocode-aggregate-filter /></el-icon>
                    </button>
                    <button class="icon-action-btn icon-action-btn--danger" type="button" @click="handleRemoveSource(item.uid)">
                      <el-icon :size="16"><i-ep-delete /></el-icon>
                    </button>
                  </div>
                </div>
              </div>

              <aggregate-source-tree-select
                :value="currentAggregateTable.sourceTables"
                :tree-data="aggregateSourceTreeData"
                :button-text="$t('AggregateTableSetting.addSource')"
                @update="handleSourceTableDialogUpdate"
              >
                <button class="section-link-btn" type="button">
                  <el-icon><i-ep-plus /></el-icon>
                  {{ $t('AggregateTableSetting.addSource') }}
                </button>
              </aggregate-source-tree-select>
            </section>

            <el-divider />

            <section class="sidebar-section">
              <div class="sidebar-section__header sidebar-section__header--split">
                <div class="sidebar-section__title">{{ $t('AggregateTableSetting.dimensionSection') }}</div>

                <div class="sidebar-section__switch">
                  <span class="sidebar-section__switch-label">{{ $t('AggregateTableSetting.filterEmpty') }}</span>
                  <el-switch size="small"
                    :model-value="Boolean(currentAggregateTable.dimensionFilterEmpty)"
                    @update:model-value="handleDimensionFilterEmptyUpdate"
                  />
                </div>
              </div>

              <draggable
                v-if="currentAggregateTable.dimensions.length"
                v-model="currentAggregateTable.dimensions"
                item-key="uid"
                handle=".dimension-sidebar-item__drag"
                chosen-class="aggregate-dragging"
                animation="200"
                class="dimension-sidebar-list"
                @change="handleDimensionSortChange"
              >
                <template #item="{ element: dimension, index }">
                  <div class="dimension-sidebar-item">
                    <div class="dimension-sidebar-item__drag">
                      <el-icon :size="16"><i-icon-park-outline-drag /></el-icon>
                    </div>

                    <div class="dimension-sidebar-item__main">
                      <div class="dimension-sidebar-item__title">{{ getDimensionRowTitle(dimension.uid, index) }}</div>
                    </div>

                    <div class="dimension-sidebar-item__actions">
                      <button class="icon-action-btn" type="button" @click="openDimensionEditDialog(dimension.uid)">
                        <el-icon :size="16"><i-ven-nocode-aggregate-edit /></el-icon>
                      </button>
                      <button class="icon-action-btn icon-action-btn--danger" type="button" @click="handleRemoveDimension(dimension.uid)">
                        <el-icon :size="16"><i-ep-delete /></el-icon>
                      </button>
                    </div>
                  </div>
                </template>
              </draggable>

              <button
                class="section-link-btn"
                type="button"
                :disabled="!configuredSourceRows.length"
                @click="dimensionDialogVisible = true"
              >
                <el-icon><i-ep-plus /></el-icon>
                {{ $t('AggregateTableSetting.addField') }}
              </button>
            </section>

            <el-divider />

            <section class="sidebar-section">
              <div class="sidebar-section__header">
                <div class="sidebar-section__title">{{ $t('AggregateTableSetting.metricSection') }}</div>
              </div>

              <draggable
                v-if="metricRows.length"
                v-model="currentAggregateTable.metrics"
                item-key="uid"
                handle=".metric-sidebar-item__drag"
                chosen-class="aggregate-dragging"
                animation="200"
                class="metric-sidebar-list"
                @change="handleMetricSortChange"
              >
                <template #item="{ element: metric, index }">
                  <div class="metric-sidebar-item">
                    <div class="metric-sidebar-item__drag">
                      <el-icon :size="16"><i-icon-park-outline-drag /></el-icon>
                    </div>

                    <div class="metric-sidebar-item__main">
                      <div class="metric-sidebar-item__title">{{ metric.name || `${$t('AggregateTableSetting.metricItemPrefix')}${index + 1}` }}</div>
                    </div>

                    <div class="metric-sidebar-item__actions">
                      <button class="icon-action-btn" type="button" @click="openMetricDialog(metric)">
                        <el-icon :size="16"><i-ven-nocode-aggregate-edit /></el-icon>
                      </button>
                      <button class="icon-action-btn icon-action-btn--danger" type="button" @click="handleRemoveMetric(metric.uid)">
                        <el-icon :size="16"><i-ep-delete /></el-icon>
                      </button>
                    </div>
                  </div>
                </template>
              </draggable>

              <el-dropdown
                trigger="click"
                popper-class="aggregate-metric-mode-dropdown"
                :disabled="!canAddMetricField"
                @command="handleAddMetricByMode"
              >
                <button class="section-link-btn" type="button" :disabled="!canAddMetricField">
                  <el-icon><i-ep-plus /></el-icon>
                  {{ $t('AggregateTableSetting.addField') }}
                </button>

                <template #dropdown>
                  <el-dropdown-menu class="aggregate-editor-dropdown aggregate-editor-dropdown--metric-mode">
                    <el-dropdown-item command="singleField">{{ $t('AggregateTableSetting.quickAggregate') }}</el-dropdown-item>
                    <el-dropdown-item command="formula">{{ $t('AggregateTableSetting.formulaEdit') }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </section>

            <el-divider />

            <section class="sidebar-section">
              <div class="sidebar-section__header">
                <div class="sidebar-section__title">{{ $t('AggregateTableSetting.submitValidateSection') }}</div>
              </div>

              <button
                class="submit-validate-btn"
                :class="{ 'is-configured': validateRuleCount > 0 }"
                type="button"
                :disabled="!metricRows.length"
                @click="handleOpenSubmitValidate"
              >
                {{ validateRuleCount ? $t('AggregateTableSetting.hasValidateRule') : $t('AggregateTableSetting.addValidateRule') }}
              </button>
            </section>
          </div>
        </el-scrollbar>

        <div class="aggregate-editor-sidebar__footer">
          <el-button type="primary" class="aggregate-editor-sidebar__save" @click="handleSaveClick">{{ $t('AggregateTableSetting.save') }}</el-button>
        </div>
      </aside>

      <main class="aggregate-editor-main">
        <aggregate-data-preview
          class="aggregate-editor-main__preview"
          :dimensions="previewDimensions"
          :metrics="previewMetrics"
          :rows="previewRows"
          :loading="previewLoading"
        />
      </main>
    </div>

    <aggregate-dimension-dialog
      v-if="dimensionDialogVisible && currentAggregateTable"
      :key="`aggregate_dimension_dialog_${currentAggregateTable.uid}`"
      v-model="dimensionDialogVisible"
      :value="currentAggregateTable.dimensions"
      :source-tables="currentAggregateTable.sourceTables"
      :source-headers="dimensionSourceHeaders"
      :field-options-map="dimensionFieldOptionsMap"
      :filter-empty-value="Boolean(currentAggregateTable.dimensionFilterEmpty)"
      @update="handleDimensionDialogUpdate"
      @update:filter-empty-value="handleDimensionFilterEmptyUpdate"
    />
    <aggregate-variable-filter-dialog
      v-model="sourceFilterDialogVisible"
      :value="currentEditingSourceTable?.filterRule"
      :source-label="currentEditingSourceLabel"
      :field-options="currentSourceFilterFieldOptions"
      @update="handleSourceFilterUpdate"
    />
    <aggregate-dimension-edit-dialog
      :key="dimensionEditDialogKey"
      v-model="dimensionEditDialogVisible"
      :value="editingDimensionDraft"
      :source-tables="currentAggregateTable.sourceTables"
      :source-headers="dimensionSourceHeaders"
      :field-options-map="dimensionFieldOptionsMap"
      @update="handleDimensionEditDialogUpdate"
    />
    <aggregate-metric-formula-dialog
      v-model="metricFormulaDialogVisible"
      :table-uid="currentAggregateTable.uid"
      :value="currentEditingMetric"
      :field-options="currentMetricFieldOptions"
      @update="handleMetricDialogUpdate"
    />
    <aggregate-metric-single-field-dialog
      v-model="metricSingleFieldDialogVisible"
      :value="currentEditingMetric"
      :field-options="currentMetricFieldOptions"
      @update="handleMetricDialogUpdate"
    />
    <aggregate-submit-validate-group-dialog
      v-model="submitValidateDialogVisible"
      :table-uid="currentAggregateTable.uid"
      :metrics="currentAggregateTable.metrics"
      :value="currentAggregateTable.submitValidate"
      @update="handleSubmitValidateDialogUpdate"
    />
    <tip-dialog
      ref="backTipDialogRef"
      :content="$t('AggregateTableSetting.unsavedBackConfirm')"
      :confirmText="$t('AggregateTableSetting.save')"
      :cancelText="$t('AggregateTableSetting.backWithoutSave')"
      :closeOnClickModal="true"
    />
  </div>

  <div v-else class="aggregate-table-setting aggregate-table-setting--empty">
    <el-empty :description="$t('AggregateTableSetting.selectAggregateTable')" :image-size="64" />
  </div>
</template>

<script setup lang="ts">
import { AggregateDimension, AggregateMetricMode, FilterRule } from '@common/types/nocode';
import { deepClone } from '@common/utils/object';
import i18next from 'i18next';
import { computed, inject, nextTick, ref, watch, type Ref } from 'vue';
import draggable from 'vuedraggable';
import AggregateDataPreview from './AggregateDataPreview.vue';
import AggregateDimensionDialog from './AggregateDimensionDialog.vue';
import AggregateDimensionEditDialog from './AggregateDimensionEditDialog.vue';
import AggregateMetricFormulaDialog from './AggregateMetricFormulaDialog.vue';
import AggregateMetricSingleFieldDialog from './AggregateMetricSingleFieldDialog.vue';
import AggregateSourceTreeSelect from './AggregateSourceTreeSelect.vue';
import AggregateSubmitValidateGroupDialog from './AggregateSubmitValidateGroupDialog.vue';
import AggregateVariableFilterDialog from './AggregateVariableFilterDialog.vue';
import { useAggregateTableSettingContext } from './aggregateTableSettingContext';

const TITLE_INPUT_MAX_WIDTH = 520;

const emit = defineEmits<{ (event: 'back'): void }>();
const isChanged = inject<Ref<boolean>>('isChanged')!;
const aggregateTableSettingContext = useAggregateTableSettingContext();

const {
  currentAggregateTable,
  currentEditingMetric,
  dimensionDialogVisible,
  metricFormulaDialogVisible,
  metricSingleFieldDialogVisible,
  submitValidateDialogVisible,
  previewRows,
  previewLoading,
  aggregateSourceTreeData,
  sourceTableSummaryList,
  dimensionSummaryList,
  dimensionSourceHeaders,
  dimensionFieldOptionsMap,
  sourceFilterFieldOptionsMap,
  currentMetricFieldOptions,
  previewDimensions,
  previewMetrics,
  isCurrentAggregateTableChanged,
  discardCurrentAggregateTableDraft,
  handleSourceTableDialogUpdate,
  handleSourceTableFilterUpdate,
  handleDimensionDialogUpdate,
  handleDimensionFilterEmptyUpdate,
  handleAddMetric,
  handleRemoveMetric,
  openMetricDialog,
  handleMetricDialogUpdate,
  handleAddSubmitValidateRule,
  openSubmitValidateDialog,
  handleRemoveSubmitValidateRule,
  handleSubmitValidateDialogUpdate,
  handleSave,
} = aggregateTableSettingContext;

const configuredSourceRows = computed(() => sourceTableSummaryList.value);
const dimensionSummaryMap = computed(() => dimensionSummaryList.value.reduce<Record<string, { name: string, label: string }>>((result, item) => {
  result[item.uid] = {
    name: item.name || '',
    label: item.label || '',
  };
  return result;
}, {}));
const metricRows = computed(() => currentAggregateTable.value?.metrics || []);
const validateRows = computed(() => (currentAggregateTable.value?.submitValidate.rules || []).map(item => ({
  uid: item.uid,
  title: item.errorText || i18next.t('AggregateTableSetting.emptyValidateText'),
  raw: item,
})));
const validateRuleCount = computed(() => validateRows.value.length);
const canAddMetricField = computed(() => (
  configuredSourceRows.value.length > 0
  && (currentAggregateTable.value?.dimensions?.length || 0) > 0
));
const dimensionEditDialogVisible = ref(false);
const editingDimensionUid = ref('');
const editingDimensionDraft = ref<AggregateDimension | null>(null);
const dimensionEditDialogKey = computed(() => editingDimensionUid.value || 'aggregate_dimension_edit_dialog');
const sourceFilterDialogVisible = ref(false);
const editingSourceUid = ref('');
const backTipDialogRef = ref();
const isTitleEditing = ref(false);
const titleInputRef = ref<HTMLInputElement | null>(null);
const titleMeasureRef = ref<HTMLElement | null>(null);
const titleInputWidth = ref(0);
const currentEditingSourceTable = computed(() => currentAggregateTable.value?.sourceTables.find(item => item.uid === editingSourceUid.value) || null);
const currentEditingSourceLabel = computed(() => configuredSourceRows.value.find(item => item.uid === editingSourceUid.value)?.title || '');
const currentSourceFilterFieldOptions = computed(() => sourceFilterFieldOptionsMap.value[editingSourceUid.value] || []);

const handleSaveClick = async () => {
  await handleSave();
};

const handleTitleEditClick = async () => {
  isTitleEditing.value = true;
  await nextTick();
  titleInputRef.value?.focus();
};

const handleTitleInputBlur = () => {
  isTitleEditing.value = false;
};

const handleBackClick = async () => {
  if (!isCurrentAggregateTableChanged.value) {
    emit('back');
    return;
  }

  const isSave = await backTipDialogRef.value?.confirm();
  if (isSave === true) {
    await handleSave();
    if (!isChanged.value) emit('back');
    return;
  }

  if (isSave === false) {
    discardCurrentAggregateTableDraft();
    emit('back');
  }
};

const openSourceFilterDialog = (uid: string) => {
  const target = currentAggregateTable.value?.sourceTables.find(item => item.uid === uid);
  if (!target?.tableUID) return;
  editingSourceUid.value = uid;
  sourceFilterDialogVisible.value = true;
};

const handleSourceFilterUpdate = (value?: FilterRule) => {
  if (!editingSourceUid.value) return;
  handleSourceTableFilterUpdate(editingSourceUid.value, value);
};

const handleRemoveSource = (uid: string) => {
  if (!currentAggregateTable.value) return;
  const nextSourceTables = deepClone(currentAggregateTable.value.sourceTables || []).filter(item => item.uid !== uid);
  handleSourceTableDialogUpdate(nextSourceTables);
};

const handleRemoveDimension = (uid: string) => {
  if (!currentAggregateTable.value) return;
  const nextDimensions = deepClone(currentAggregateTable.value.dimensions || []).filter(item => item.uid !== uid);
  handleDimensionDialogUpdate(nextDimensions);
};

const handleDimensionSortChange = () => {
  if (!currentAggregateTable.value) return;
  handleDimensionDialogUpdate(deepClone(currentAggregateTable.value.dimensions || []));
};

const getDimensionRowTitle = (uid: string, index: number) => {
  const item = dimensionSummaryMap.value[uid];
  return item?.name || item?.label || `${i18next.t('AggregateTableSetting.dimensionItemPrefix')}${index + 1}`;
};

const getDimensionRowSummary = (uid: string) => {
  const item = dimensionSummaryMap.value[uid];
  return item?.name ? item.label : '';
};

const openDimensionEditDialog = (uid: string) => {
  const target = currentAggregateTable.value?.dimensions.find(item => item.uid === uid);
  if (!target) return;
  editingDimensionUid.value = uid;
  editingDimensionDraft.value = deepClone(target);
  dimensionEditDialogVisible.value = true;
};

const handleDimensionEditDialogUpdate = (value: AggregateDimension) => {
  if (!currentAggregateTable.value) return;
  const nextDimensions = deepClone(currentAggregateTable.value.dimensions || []);
  const index = nextDimensions.findIndex(item => item.uid === value.uid);
  if (index === -1) return;
  nextDimensions.splice(index, 1, value);
  handleDimensionDialogUpdate(nextDimensions);
};

const handleAddMetricByMode = (mode: AggregateMetricMode | string) => {
  if (!canAddMetricField.value) return;
  const nextMode = mode === 'singleField' ? 'singleField' : 'formula';
  handleAddMetric(nextMode);
};

const handleMetricSortChange = () => {
  if (!currentAggregateTable.value) return;
  currentAggregateTable.value.metrics = deepClone(currentAggregateTable.value.metrics || []);
};

const handleOpenSubmitValidate = () => {
  if (validateRuleCount.value) {
    openSubmitValidateDialog();
    return;
  }
  handleAddSubmitValidateRule();
};

defineExpose({
  savePermissions: handleSave,
});

watch(dimensionEditDialogVisible, value => {
  if (value) return;
  editingDimensionUid.value = '';
  editingDimensionDraft.value = null;
});

watch(sourceFilterDialogVisible, value => {
  if (value) return;
  editingSourceUid.value = '';
});
</script>

<style scoped lang="scss">
.aggregate-table-setting {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.aggregate-table-setting--empty {
  align-items: center;
  justify-content: center;
}

.aggregate-editor-header {
  height: 52px;
  padding: 0 16px 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
}

.aggregate-editor-header__back {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #909399;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
}

.aggregate-editor-header__back:hover {
  background: #f5f7fa;
}

.aggregate-editor-header__title-wrap {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.aggregate-editor-header__title-box {
  min-width: 0;
  max-width: 520px;
  position: relative;
  display: flex;
  align-items: center;
}

.aggregate-editor-header__title-text {
  padding: 0 6px;
  color: #303133;
  font-size: 16px;
  line-height: 24px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aggregate-editor-header__title-input {
  box-sizing: border-box;
  padding: 0 6px;
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  outline: none;
  background: transparent;
  color: #303133;
  font-size: 16px;
  line-height: 30px;
  text-overflow: ellipsis;
  white-space: nowrap;
  height: 30px;
  margin-right: 4px;
}

.aggregate-editor-header__edit {
  width: 20px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: #909399;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.aggregate-editor-header__edit--active {
  color: var(--color-primary);
}

.aggregate-editor-header__title-measure {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  white-space: pre;
  pointer-events: none;
  font-size: 16px;
  line-height: 24px;
}

.aggregate-editor-header__title-input::placeholder {
  color: #303133;
  opacity: 1;
}

.change-flag {
  width: 8px;
  height: 8px;
  background-color: var(--color-warning);
  border-radius: 100px;
  margin-left: 2px;
  margin-bottom: 18px;
}

.aggregate-editor-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
}

.aggregate-editor-sidebar {
  width: 256px;
  min-width: 256px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #ebeef5;
  background: #fff;
}

.aggregate-editor-sidebar__scroll {
  flex: 1;
  min-height: 0;
}

.aggregate-editor-sidebar__content {
  padding: 16px 12px;
}

.sidebar-section__header {
  line-height: 22px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.sidebar-section__header--split {
  align-items: flex-start;
}

.sidebar-section__title {
  color: var(--text-color-primary);
  font-size: 14px;
  line-height: 22px;
}

.sidebar-section__switch {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-section__switch-label {
  color: var(--text-color-regular);
  font-size: 12px;
  line-height: 20px;
}

.sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dimension-sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dimension-sidebar-list > .aggregate-dragging.sortable-ghost {
  visibility: hidden;
  opacity: 1;
}

.dimension-sidebar-item {
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.2s ease;
}

.dimension-sidebar-item:hover {
  background: #f5f7fb;
}

.dimension-sidebar-item__drag {
  width: 24px;
  height: 24px;
  color: #c0c4cc;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: move;
}

.dimension-sidebar-item__main {
  min-width: 0;
  flex: 1;
}

.dimension-sidebar-item__title {
  color: #303133;
  font-size: 14px;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dimension-sidebar-item__summary {
  margin-top: 2px;
  color: #909399;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dimension-sidebar-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.dimension-sidebar-item:hover .dimension-sidebar-item__actions {
  opacity: 1;
}

.metric-sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-sidebar-list > .aggregate-dragging.sortable-ghost {
  visibility: hidden;
  opacity: 1;
}

.metric-sidebar-item {
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.metric-sidebar-item:hover {
  background: #f3f4f6;
}

.metric-sidebar-item__drag {
  width: 24px;
  height: 24px;
  color: #c0c4cc;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: move;
}

.metric-sidebar-item__main {
  min-width: 0;
  flex: 1;
}

.metric-sidebar-item__title {
  color: #1f2329;
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-sidebar-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.metric-sidebar-item:hover .metric-sidebar-item__actions {
  opacity: 1;
}

.sidebar-list-item {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  gap: 4px;
  align-items: center;
  min-height: 30px;
}

.sidebar-list-item--source {
  grid-template-columns: minmax(0, 1fr) auto;
}

.sidebar-list-item__drag {
  color: #c0c4cc;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sidebar-list-item__content {
  min-width: 0;
  padding: 6px 10px;
  border-radius: 2px;
  background: var(--bg-color-overlay);
}

.sidebar-list-item__title {
  color: #303133;
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-list-item__actions,
.validate-row__actions {
  display: flex;
  align-items: center;
  gap: 4x;
  transition: opacity 0.2s ease;
}

.sidebar-list-item:hover .sidebar-list-item__actions,
.validate-row:hover .validate-row__actions {
  opacity: 1;
}

.icon-action-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-color-regular);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon-action-btn:hover {
  background: var(--bg-color-overlay);
  color: var(--text-color-regular);
}

.icon-action-btn--active {
  color: #1677ff;
}

.icon-action-btn--active:hover {
  color: #1677ff;
}

.icon-action-btn--danger:hover {
  background: var(--bg-color-overlay);
  color: #f56c6c;
}

.section-link-btn {
  margin-top: 10px;
  padding: 0;
  border: none;
  background: transparent;
  color: #1677ff;
  font-size: 14px;
  line-height: 22px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.section-link-btn:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.submit-validate-btn {
  width: 100%;
  height: 28px;
  border: 1px solid #ebeef5;
  border-radius: 2px;
  background: #fff;
  color: #c0c4cc;
  font-size: 12px;
  line-height: 20px;
  cursor: not-allowed;
}

.submit-validate-btn:enabled {
  color: #909399;
  cursor: pointer;
}

.submit-validate-btn:enabled:hover {
  color: #409eff;
  border-color: #d9ecff;
  background: #f5f9ff;
}

.submit-validate-btn.is-configured:enabled {
  color: #409eff;
}

.sidebar-list--validate {
  margin-top: 8px;
}

.validate-row {
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.validate-row__text {
  min-width: 0;
  color: #606266;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aggregate-editor-sidebar__footer {
  padding: 10px;
}

.aggregate-editor-sidebar__save {
  width: 100%;
  height: 30px;
  border-radius: 4px;
}

.aggregate-editor-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: #fff;
}

.aggregate-editor-main__preview {
  width: 100%;
  height: 100%;
}

:deep(.aggregate-editor-dropdown.el-dropdown-menu) {
  padding: 6px 0;
  border-radius: 6px;
}

:deep(.aggregate-metric-mode-dropdown.el-dropdown-menu) {
  min-width: 168px;
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(31, 35, 41, 0.12);
}

:deep(.aggregate-editor-dropdown--metric-mode .el-dropdown-menu__item) {
  height: 44px;
  margin: 0;
  padding: 0 16px;
  border-radius: 8px;
  color: #1f2329;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
}

:deep(.aggregate-editor-dropdown--metric-mode .el-dropdown-menu__item:not(:first-child)) {
  margin-top: 8px;
}

:deep(.aggregate-editor-dropdown--metric-mode .el-dropdown-menu__item:hover) {
  background: #f2f3f5;
  color: #1f2329;
}

@media (max-width: 1280px) {
  .aggregate-editor-header__title-input {
    width: 180px;
  }

  .aggregate-editor-sidebar {
    width: 236px;
    min-width: 236px;
  }
}
</style>
