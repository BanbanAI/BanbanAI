<template>
  <div class="form-draft-list">
    <el-dialog
      class="form-draft-dialog"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      @opened="emit('opened')"
      align-center
      :show-close="false"
      destroy-on-close
      ref="dialogRef"
    >
      <template #header>
        <div class="title" @click="emit('update:modelValue', false)">
          <el-icon class="back-button"><i-ep-arrow-left /></el-icon>
          <span>{{ $t('MobileFormDraftListDialog.draftBox') }}</span>
        </div>
      </template>
      <div class="container">
        <div class="content">
          <el-scrollbar class="draft-scrollbar">
            <div class="draft-list">
              <div class="draft-item" v-for="(row, index) in drafts" :key="index" @click="onDraftClick(row)">
                <div class="draft-header">
                  <span class="header-text">{{ getOwner(index) }}</span>
                  <el-button link type="danger" @click.stop="onBeforeDelete(row)">
                    <el-icon style="margin-right: 4px;">
                      <i-ep-delete></i-ep-delete>
                    </el-icon>
                  </el-button>
                </div>
                <div class="draft-body">
                  <div class="row" v-for="field in showFields" :key="field.uid">
                    <div class="name"><span>{{ field.alias }}</span></div>
                    <div class="value">{{ row[field.uid] }}</div>
                  </div>
                  <div class="update-time">{{ formatUpdateTime(row) }}</div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>
        <div v-if="enableClear" class="footer">
          <el-button class="clear-button" type="danger" :disabled="!drafts.length" @click="onBeforeClear">
            {{ $t('MobileFormDraftListDialog.clear') }}
          </el-button>
        </div>
      </div>
    </el-dialog>
    <mobile-draft-data-dialog
      v-model="draftDataDialogVisible"
      :title="table?.alias"
      :table="table"
      :row="currentRow"
      @submitted="emit('submitted', $event)"
      @updated="emit('updated', $event)"
    />
    <delete-confirm-dialog
      v-model="deleteConfirmDialogVisible"
      :text="$t('MobileFormDraftListDialog.confirmDelDraft')"
      :tip="$t('MobileFormDraftListDialog.delDraftWarn')"
      @confirm="onDeleteConfirm"
    />
    <delete-confirm-dialog
      v-model="clearConfirmDialogVisible"
      :title="$t('MobileFormDraftListDialog.clearDraftTitle')"
      :text="$t('MobileFormDraftListDialog.confirmClearDraft')"
      :tip="$t('MobileFormDraftListDialog.clearDraftWarn')"
      :confirmText="$t('MobileFormDraftListDialog.confirmClear')"
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
  (event: 'opened'): void;
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
  return `${i18next.t('MobileFormDraftListDialog.draft')}${index + 1}`;
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
  :deep(.form-draft-dialog) {
    width: 100%;
    height: 100%;
    padding: 16px;
    padding-top: 24px;
    display: flex;
    flex-direction: column;

    .el-dialog__header {
      padding-bottom: 0;
      margin-bottom: 8px;

      .title {
        height: 44px;
        display: inline-flex;
        align-items: center;
        padding-right: 12px;
        gap: 8px;

        .back-button {
          color: var(--text-color-primary);
          font-size: 16px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        span {
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
          letter-spacing: 0;
        }
      }
    }

    .el-dialog__body {
      height: 100%;
      padding-top: 8px;
      overflow: hidden;

      &::-webkit-scrollbar {
        display: none;
      }

      scrollbar-width: none;
      -ms-overflow-style: none;
    }
  }

  .container {
    height: 100%;
    display: flex;
    flex-direction: column;

    .content {
      flex: 1;
      min-height: 0;

      .draft-scrollbar {
        height: 100%;
      }

      .draft-list {
        .draft-item {
          background-color: #fff;
          padding: 16px 12px;
          border-radius: 8px;
          margin-bottom: 16px;

          .draft-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            margin-bottom: 16px;
            border-bottom: 1px solid #E6E6E6;

            .header-text {
              font-size: 14px;
              font-weight: 500;
            }

            .el-icon {
              width: 16px;
              height: 16px;
            }
          }

          .draft-body {
            display: flex;
            flex-direction: column;
            row-gap: 4px;

            .row {
              margin-bottom: 16px;
              display: flex;

              .name {
                width: 84px;
                display: flex;

                span {
                  font-size: 14px;
                  font-weight: 400;
                  line-height: 20px;
                  max-width: calc(100% - 12px);
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  color: var(--text-color-secondary);
                }
              }

              .value {
                font-size: 14px;
                font-weight: 400;
                line-height: 20px;
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
    }

    .footer {
      .clear-button {
        width: 100%;
        height: 40px;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 500;
        border: none;
        transition: all 0.1s;
        -webkit-tap-highlight-color: transparent;

        &:active:not(.is-disabled) {
          opacity: 0.8;
          transform: scale(0.98);
        }
      }
    }
  }
}
</style>
