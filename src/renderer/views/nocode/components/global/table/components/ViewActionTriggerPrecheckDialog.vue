<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="680px"
    align-center
    destroy-on-close
    class="view-action-trigger-precheck-dialog"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <div v-if="result" class="view-action-trigger-precheck">
      <div class="view-action-trigger-precheck__summary">
        {{ summary }}
      </div>
      <div class="view-action-trigger-precheck__table-wrap">
        <table class="view-action-trigger-precheck__table">
          <thead>
            <tr>
              <th>{{ labels.sequence }}</th>
              <th>{{ labels.dataTitle }}</th>
              <th>{{ labels.status }}</th>
              <th>{{ labels.failureReason }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in result.items" :key="`${item.uuid}-${item.index}`">
              <td>{{ item.index }}</td>
              <td>{{ item.dataTitle || item.uuid }}</td>
              <td :class="item.executable ? 'is-executable' : 'is-blocked'">
                {{ item.executable ? labels.executable : labels.blocked }}
              </td>
              <td>{{ item.message || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <template #footer>
      <el-button class="view-action-trigger-precheck-dialog__button" @click="emit('cancel')">
        {{ i18next.t("NocodeTable.viewActionConfirmCancel") }}
      </el-button>
      <el-button
        class="view-action-trigger-precheck-dialog__button"
        type="primary"
        :loading="loading"
        :disabled="!hasExecutable"
        @click="emit('confirm')"
      >
        {{ i18next.t("NocodeTable.viewActionConfirmExecute") }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import i18next from "i18next";
import type { ViewActionTriggerPrecheckResult } from "@common/types/nocode";

const props = defineProps<{
  modelValue: boolean;
  title: string;
  result: ViewActionTriggerPrecheckResult | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "closed"): void;
  (event: "cancel"): void;
  (event: "confirm"): void;
}>();

const labels = computed(() => ({
  sequence: i18next.t("NocodeTable.viewActionBatchSequence"),
  dataTitle: i18next.t("NocodeTable.viewActionBatchDataTitle"),
  status: i18next.t("NocodeTable.viewActionTriggerPrecheckStatus"),
  failureReason: i18next.t("NocodeTable.viewActionBatchFailureReason"),
  executable: i18next.t("NocodeTable.viewActionTriggerPrecheckExecutable"),
  blocked: i18next.t("NocodeTable.viewActionTriggerPrecheckBlocked"),
}));

const summary = computed(() => {
  if (!props.result) return "";
  return i18next.t("NocodeTable.viewActionTriggerPrecheckSummary", {
    count: props.result.attemptedCount,
    executable: props.result.executableCount,
    blocked: props.result.blockedCount,
  });
});

const hasExecutable = computed(() => (props.result?.executableCount || 0) > 0);
</script>

<style scoped lang="scss">
:global(.view-action-trigger-precheck-dialog) {
  border-radius: 8px;
  background-color: #fff;
  overflow: hidden;
}

:global(.view-action-trigger-precheck-dialog .el-dialog__header),
:global(.view-action-trigger-precheck-dialog .el-dialog__body),
:global(.view-action-trigger-precheck-dialog .el-dialog__footer) {
  background-color: #fff;
}

:global(.view-action-trigger-precheck-dialog .el-dialog__header) {
  margin-right: 0;
}

.view-action-trigger-precheck__summary {
  margin-bottom: 12px;
  color: var(--text-color-regular);
  font-size: 14px;
  line-height: 22px;
}

.view-action-trigger-precheck__table-wrap {
  max-height: 360px;
  overflow: auto;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background-color: #fff;
}

.view-action-trigger-precheck__table {
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
    width: 54px;
  }

  th:nth-child(2),
  td:nth-child(2) {
    width: 190px;
  }

  th:nth-child(3),
  td:nth-child(3) {
    width: 92px;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tr > *:last-child {
    border-right: none;
  }

  .is-executable {
    color: #00a870;
  }

  .is-blocked {
    color: #f53f3f;
  }
}

.view-action-trigger-precheck-dialog__button {
  border-radius: 6px;
}
</style>
