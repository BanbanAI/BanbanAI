<template>
  <div class="view-action-batch-dialog">
    <el-dialog
      :model-value="resultVisible"
      class="view-action-batch-dialog--result"
      :title="$t('ViewActionBatchDialogs.title')"
      width="680px"
      align-center
      destroy-on-close
      @update:model-value="emit('update:resultVisible', $event)"
    >
      <div class="view-action-batch-result__title">{{ resultTitle }}</div>
      <div v-if="hasResultContent" class="view-action-batch-result">
        <div class="view-action-batch-result__counts">
          <div>{{ executedMessage }}</div>
          <div>{{ successMessage }}</div>
          <div>{{ failedMessage }}</div>
        </div>
        <p class="view-action-batch-result__text">{{ successCount > 0 ? successDescription : failedDescription }}</p>
        <p class="view-action-batch-result__text">{{ commonDescription }}</p>
      </div>
      <template #footer>
        <div class="view-action-batch-result__footer">
          <el-button @click="emit('view-detail')">{{ viewDetailText }}</el-button>
          <el-button type="primary" @click="emit('retry-failed')">{{ retryFailedText }}</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      :model-value="detailVisible"
      class="view-action-batch-dialog--detail"
      :title="failedDetailTitle"
      width="680px"
      align-center
      destroy-on-close
      @update:model-value="emit('update:detailVisible', $event)"
    >
      <div class="view-action-batch-detail">
        <div class="view-action-batch-detail__table-wrap">
          <table class="view-action-batch-detail__table">
            <thead>
              <tr>
                <th>{{ sequenceText }}</th>
                <th>{{ dataTitleText }}</th>
                <th>{{ failureReasonText }}</th>
                <th>{{ suggestionText }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in failedItems" :key="`${item.uuid}-${item.index}`">
                <td>{{ item.index }}</td>
                <td>{{ item.dataTitle || item.uuid }}</td>
                <td>{{ item.message }}</td>
                <td>{{ item.suggestion }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <template #footer>
        <div class="view-action-batch-result__footer">
          <el-button @click="emit('update:detailVisible', false)">{{ closeText }}</el-button>
          <el-button type="primary" @click="emit('retry-failed')">{{ retryFailedText }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { ExecuteViewActionFailedItem } from "@common/types/nocode";

const props = withDefaults(defineProps<{
  resultVisible: boolean,
  detailVisible: boolean,
  resultTitle: string,
  failedDetailTitle: string,
  executedMessage: string,
  successMessage: string,
  failedMessage: string,
  successCount: number,
  successDescription: string,
  failedDescription: string,
  commonDescription: string,
  viewDetailText: string,
  retryFailedText: string,
  closeText: string,
  sequenceText: string,
  dataTitleText: string,
  failureReasonText: string,
  suggestionText: string,
  failedItems?: ExecuteViewActionFailedItem[],
}>(), {
  failedItems: () => [],
});

const emit = defineEmits<{
  (event: "update:resultVisible", value: boolean): void,
  (event: "update:detailVisible", value: boolean): void,
  (event: "view-detail"): void,
  (event: "retry-failed"): void,
}>();

const hasResultContent = computed(() => (
  !!props.executedMessage
  || !!props.successMessage
  || !!props.failedMessage
  || !!props.commonDescription
));
</script>

<style lang="scss" scoped>
.view-action-batch-result {
  display: flex;
  flex-direction: column;
  color: #86909C;
}

.view-action-batch-result__title {
  font-size: 14px;
  line-height: 22px;
  margin-bottom: 8px;
}

.view-action-batch-result__counts {
  display: flex;
  flex-direction: column;
  color: var(--text-color-regular);
  font-size: 14px;
  line-height: 22px;
  color: #86909C;
}

.view-action-batch-result__text {
  margin: 0;
  color: #86909C;
  font-size: 14px;
  line-height: 22px;
}

.view-action-batch-result__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;

  :deep(.el-button) {
    min-width: 88px;
    height: 32px;
    margin-left: 0;
    border-radius: 4px;
    padding: 0 12px;
  }
}

.view-action-batch-detail__table-wrap {
  max-height: 240px;
  overflow: auto;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background-color: #fff;
}

.view-action-batch-detail__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;

  th,
  td {
    padding: 6px 9px;
    border-bottom: 1px solid #e5e6eb;
    border-right: 1px solid #e5e6eb;
    text-align: left;
    vertical-align: top;
    font-size: 14px;
    line-height: 22px;
    word-break: break-word;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: #fff;
    color: #1d2129;
    font-weight: 500;
  }

  th:nth-child(1),
  td:nth-child(1) {
    width: 47px;
  }

  th:nth-child(2),
  td:nth-child(2) {
    width: 200px;
  }

  th:nth-child(3),
  td:nth-child(3) {
    width: 200px;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tr > *:last-child {
    border-right: none;
  }
}

.view-action-batch-dialog {
  :deep(.el-dialog) {
    border-radius: 8px;
    overflow: hidden;
    padding: 0;
    background-color: #fff;

    .el-dialog__header {
      height: 48px;
      margin-right: 0;
      padding: 10px 16px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;

      .el-dialog__title {
        display: block;
        text-align: center;
        color: #1d2129;
        font-size: 16px;
        line-height: 24px;
        font-weight: 500;
      }
    }

    .el-dialog__body {
      padding: 16px;
    }

    .el-dialog__footer {
      height: 64px;
      border-top: 1px solid #f0f0f0;
      padding: 16px 20px;
    }
  }
}
</style>
