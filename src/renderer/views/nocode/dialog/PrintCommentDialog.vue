<template>
  <div class="print-comment-dialog">
    <el-dialog
      class="print-comment-el-dialog"
      v-model="dialogVisible"
      width="500px"
      draggable
      append-to-body
      :close-on-click-modal="false"
      :title="$t('CompareTableDialog.printRuleSetting')"
      align-center
      destroy-on-close
      @closed="handleClosed"
    >
      <div class="dialog-body">
        <div class="dialog-section">
          <div class="dialog-section__title">{{ $t('CompareTableDialog.printOrder') }}</div>
          <el-radio-group v-model="flowCommentRule.order" class="dialog-section__options">
            <el-radio :value="PrintFlowCommentOrder.ASC">{{ $t('CompareTableDialog.printOrderAsc') }}</el-radio>
            <el-radio :value="PrintFlowCommentOrder.DESC">{{ $t('CompareTableDialog.printOrderDesc') }}</el-radio>
          </el-radio-group>
        </div>

        <div class="dialog-section">
          <div class="dialog-section__title">{{ $t('CompareTableDialog.printContent') }}</div>
          <div class="dialog-section__desc">{{ $t('CompareTableDialog.selectPrintApprovalOpinionNodes') }}</div>
          <el-radio-group v-model="flowCommentRule.nodeScope" class="dialog-section__options">
            <el-radio :value="PrintFlowCommentNodeScope.ALL">{{ $t('CompareTableDialog.allApprovalOpinionNodes') }}</el-radio>
            <el-radio :value="PrintFlowCommentNodeScope.CUSTOM">{{ $t('CompareTableDialog.customNodes') }}</el-radio>
          </el-radio-group>

          <div class="dialog-section__field" v-if="flowCommentRule.nodeScope === PrintFlowCommentNodeScope.CUSTOM">
            <span class="dialog-section__label">{{ $t('CompareTableDialog.approvalNode') }}</span>
            <el-select
              class="dialog-section-select"
              v-model="flowCommentRule.nodeIds"
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              :placeholder="$t('CompareTableDialog.selectApprovalNode')"
            >
              <el-option
                v-for="node in flowCommentNodeOptions"
                :key="node.uid"
                :label="node.name"
                :value="node.uid"
              />
            </el-select>
          </div>
        </div>

        <div class="dialog-section">
          <div class="dialog-section__title">{{ $t('CompareTableDialog.printOpinionFilter') }}</div>
          <div>
            <el-checkbox v-model="flowCommentRule.onlySubmitOperation">
              {{ $t('CompareTableDialog.onlySubmitApprovalOpinion') }}
            </el-checkbox>
          </div>
          <div>
            <el-checkbox v-model="flowCommentRule.onlyNonEmptyComment">
              {{ $t('CompareTableDialog.onlyNonEmptyApprovalOpinion') }}
            </el-checkbox>
            <el-tooltip
              effect="light"
              show-arrow
              placement="top"
              trigger="hover"
            >
              <template #content>
                {{ $t('CompareTableDialog.onlyNonEmptyApprovalOpinionTip') }}
              </template>
              <el-icon size="14"><i-nocode-data-source-form-question/></el-icon>
            </el-tooltip>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button class="print-comment-btn" @click="dialogVisible = false">{{ $t('CompareTableDialog.cancel') }}</el-button>
        <el-button class="print-comment-btn" type="primary" @click="handleConfirm">{{ $t('CompareTableDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { normalizePrintFlowCommentRule } from '@common/utils';
import { PrintFlowCommentNodeScope, PrintFlowCommentOrder, PrintFlowCommentRule } from '@common/types/nocode';
import { ref } from 'vue';
import type { PropType } from 'vue';

type FlowCommentRuleState = Required<Pick<PrintFlowCommentRule, 'order' | 'nodeScope' | 'onlySubmitOperation' | 'onlyNonEmptyComment'>> & {
  nodeIds: string[];
}

type FlowCommentNodeOption = {
  uid: string;
  name: string;
}

defineProps({
  flowCommentNodeOptions: {
    type: Array as PropType<FlowCommentNodeOption[]>,
    default: () => [],
  },
});
const emit = defineEmits(['confirm']);

const dialogVisible = ref(false);

const createFlowCommentRuleState = (rule?: PrintFlowCommentRule | null): FlowCommentRuleState => {
  const normalizedRule = normalizePrintFlowCommentRule(rule);
  return {
    ...normalizedRule,
    nodeIds: [...(normalizedRule.nodeIds || [])],
  };
};

const flowCommentRule = ref<FlowCommentRuleState>(createFlowCommentRuleState());

const handleConfirm = () => {
  emit('confirm', createFlowCommentRuleState(flowCommentRule.value));
  dialogVisible.value = false;
};

const handleClosed = () => {
  dialogVisible.value = false;
};

defineExpose({
  show: (rule?: PrintFlowCommentRule | null) => {
    flowCommentRule.value = createFlowCommentRuleState(rule);
    dialogVisible.value = true;
  },
});
</script>

<style lang="scss">
.print-comment-el-dialog {
  --el-dialog-bg-color: var(--bg-color-page);
  border-radius: 4px;
  .print-comment-btn {
    border-radius: 4px;
  }

  .dialog-section__title {
    margin-bottom: 16px;
    font-size: 14px;
    line-height: 20px;
    color: #141414;
    font-weight: 700;
  }

  .dialog-section__desc {
    margin-bottom: 16px;
    font-size: 14px;
    line-height: 20px;
    color: #141414;
  }

  .dialog-section__options {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 24px;
    margin-bottom: 24px;
  }

  .dialog-section__field {
    margin-top: 16px;
  }

  .dialog-section__label {
    display: inline-flex;
    align-items: center;
    margin-bottom: 8px;
    font-size: 14px;
    line-height: 20px;
    color: #727272;
  }

  .dialog-section-select {
    width: 100%;
    margin-bottom: 24px;
  }
  .dialog-section {
    .el-icon {
      color: var(--text-color-secondary);
      margin-left: 8px;
    }
  }
}
</style>

<style scoped lang="scss">
.print-comment-dialog {
  :deep(.el-dialog) {

    .el-dialog__header {
      padding: 0;
      margin: 0;
      text-align: center;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;

      .el-dialog__headerbtn {
        height: 40px;
        width: 40px;
        top: 0;
        line-height: 46px;
        border-top-right-radius: 4px;

        &:hover {
          background-color: var(--color-danger);

          .el-dialog__close {
            color: var(--color-white);
          }
        }

        .el-dialog__close {
          font-size: 18px;
        }
      }
    }

    .el-dialog__body {
      padding: 28px 24px 24px;
      border-bottom: 1px solid var(--border-color);
    }

    .el-dialog__footer {
      padding: 14px 24px 20px;
    }
  }

}
</style>
