<template>
  <div class="form-draft-list">
    <el-drawer
      class="form-draft-drawer"
      :model-value="modelValue"
      close-on-click-modal
      @update:model-value="emit('update:modelValue', $event)"
      direction="rtl"
      :size="400"
    >
      <template #header>
        <h2>{{ $t('FormDraftList.draftBox') }}</h2>
      </template>
      <template #default>
        <el-scrollbar class="draft-scrollbar">
          <div class="draft-list">
            <div class="draft-item" v-for="(row, index) in drafts" :key="index" @click="onDraftClick(row)">
              <div class="draft-header">
                <span>{{ getOwner(index) }}</span>
                <el-button link type="danger" @click.stop="onBeforeDelete(row)">
                  <el-icon style="margin-right: 4px;">
                    <i-ep-delete></i-ep-delete>
                  </el-icon>
                  {{ $t('FormDraftList.delete') }}
                </el-button>
              </div>
              <div class="draft-body">
                <div class="row" v-for="field in showFields" :key="field.uid">
                  <div class="name"><span>{{ field.alias }}</span>{{ getI18nLabelColon() }}</div>
                  <div class="value">{{ row[field.uid] }}</div>
                </div>
                <div class="update-time">{{ formatUpdateTime(row) }}</div>
              </div>
            </div>
          </div>
        </el-scrollbar>
        <div v-if="enableClear" class="draft-footer">
          <el-button class="clear-button" type="danger" plain :disabled="!drafts.length" @click="onBeforeClear">
            {{ $t('FormDraftList.clear') }}
          </el-button>
        </div>
      </template>
    </el-drawer>
    <draft-data-dialog
      v-model="draftDataDialogVisible"
      :title="table?.alias"
      :table="table"
      :row="currentRow"
      @submitted="emit('submitted', $event)"
      @updated="emit('updated', $event)"
    />
    <delete-confirm-dialog
      v-model="deleteConfirmDialogVisible"
      :text="$t('FormDraftList.confirmDelDraft')"
      :tip="$t('FormDraftList.delUnrecover')"
      @confirm="onDeleteConfirm"
    />
    <delete-confirm-dialog
      v-model="clearConfirmDialogVisible"
      :title="$t('FormDraftList.clearDraftTitle')"
      :text="$t('FormDraftList.confirmClearDraft')"
      :tip="$t('FormDraftList.clearDraftWarn')"
      :confirmText="$t('FormDraftList.confirmClear')"
      @confirm="onClearConfirm"
    />
  </div>
</template>

<script lang='ts' setup>
import { computed, ref } from 'vue';
import { Row, Table } from '@common/types/project';
import { isSystemField, SystemField } from '@common/utils';
import { dayjs } from 'element-plus';
import i18next from 'i18next';
import { getI18nLabelColon } from '@common/utils/i18n';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  table: Table;
  drafts: Row[];
  enableClear?: boolean;
}>(), {
  drafts: () => [],
  enableClear: false,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'delete', value: Row): void;
  (event: 'clear'): void;
  (event: 'submitted', value: Row): void;
  (event: 'updated', value: Row): void;
}>();

const deleteConfirmDialogVisible = ref(false);
const clearConfirmDialogVisible = ref(false);
const draftDataDialogVisible = ref(false);
const allowWidgetTypes = ['widget.form.textInput', 'widget.form.numberInput', 'widget.form.radioGroup', 'widget.form.treeSelect', 'widget.form.phoneInput'];

const showFields = computed(() => {
  return props.table?.fields?.filter(field => {
    return !isSystemField(field) && allowWidgetTypes.includes(field.meta?.extra.widgetType);
  }).slice(0, 3);
});

const getOwner = (index: number) => {
  return `${i18next.t('FormDraftList.draft')}${index + 1}`;
};

const formatUpdateTime = (row: Row) => {
  const field = props.table?.fields?.find(field => field.meta.name === SystemField.UPDATE_TIME);
  return dayjs(row[field?.uid]).format('YYYY-MM-DD HH:mm:ss');
};

const currentRow = ref<Row | null>(null);
const onDraftClick = (row: Row) => {
  currentRow.value = row;
  draftDataDialogVisible.value = true;
};

let deletingRow: Row | null = null;

const onBeforeDelete = (row: Row) => {
  deletingRow = row;
  deleteConfirmDialogVisible.value = true;
};

const onDeleteConfirm = () => {
  if (!deletingRow) return;
  emit('delete', deletingRow);
};

const onBeforeClear = () => {
  clearConfirmDialogVisible.value = true;
};

const onClearConfirm = () => {
  emit('clear');
};
</script>

<style lang='scss' scoped>
.form-draft-list {
  :deep(.form-draft-drawer) {
    .el-drawer__header {
      border-bottom: 1px solid var(--el-border-color);
      margin: 0;
      padding-top: 0;
      height: 60px;
      color: var(--text-color-primary);

      h2 {
        display: flex;
        justify-content: center;
      }
    }

    .el-drawer__body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      row-gap: 16px;

      .draft-scrollbar {
        flex: 1;
        min-height: 0;
      }

      .draft-list {
        display: flex;
        flex-direction: column;
        row-gap: 16px;

        .draft-item {
          background-color: var(--bg-color-page);
          cursor: pointer;

          .draft-header {
            height: 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 16px;
            border-bottom: 1px solid var(--el-border-color);
          }

          .draft-body {
            padding: 16px;
            display: flex;
            flex-direction: column;
            row-gap: 4px;
            color: var(--text-color-regular);

            .row {
              display: flex;
              line-height: 24px;

              .name {
                width: 84px;
                display: flex;

                span {
                  max-width: calc(100% - 12px);
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  color: var(--text-color-secondary);
                }
              }

              .value {
                padding-left: 4px;
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
            }

            .update-time {
              color: var(--text-color-secondary);
            }
          }
        }
      }

      .draft-footer {
        border-top: 1px solid var(--el-border-color);
        padding-top: 16px;

        .clear-button {
          width: 100%;
          border-radius: 4px;
        }
      }
    }
  }
}
</style>
