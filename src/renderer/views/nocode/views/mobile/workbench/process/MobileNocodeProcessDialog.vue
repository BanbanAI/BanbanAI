<template>
  <div class="nocode-process-dialog">
    <el-dialog class="nocode-process-container"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)" 
      @opened="emit('opened')" 
      align-center
      :title="todo?.formName"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      destroy-on-close
    >
      <div class="container">
        <div class="title" @click="closeDialog">
          <el-icon>
            <i-ep-arrow-left/>
          </el-icon>
          {{ todo?.formName }}
        </div>
        <vn-stack class="stack-container" v-model="activeName">
          <div class="stack-tabs">
            <vn-stack-tab name="data">
              {{ $t('MobileNocodeProcessDialog.data') }}
            </vn-stack-tab>
            <vn-stack-tab name="process">
              {{ $t('MobileNocodeProcessDialog.process') }}
            </vn-stack-tab>
          </div>
          <el-scrollbar class="stack-content">
            <vn-stack-layer name="data">
              <div v-if="formPlaceholderText" class="no-form-data">
                {{ formPlaceholderText }}
              </div>
              <nocode-form
                v-else-if="isReportData"
                :nocodeId="targetFormPayload.nocodeId"
                :tableUID="[null, targetFormPayload.tableId]"
                :uuid="todo.reportTargetUUID"
                :flowId="todo.currentFlowId || todo.flowId"
                :isViewing="!editable"
                :row="reportRow"
                :fieldsAuth="flow?.options?.fieldAuth"
                :requiredFieldsAuth="flow?.options?.requiredFieldAuth"
                ref="nocodeFormRef"
                @ready="handleFormReady"
              />
              <nocode-form
                v-else
                :nocodeId="todo.nocodeId"
                :tableUID="[null, todo.tableId]"
                :uuid="todo.uuid"
                :flowId="todo.currentFlowId || todo.flowId"
                :isViewing="!editable"
                :row="todoRow"
                ref="nocodeFormRef"
                @ready="handleFormReady"
              />
            </vn-stack-layer>
            <vn-stack-layer name="process" class="process-container">
              <process-flows :todo="todo" :isMobile="true"/>
            </vn-stack-layer>
          </el-scrollbar>
        </vn-stack>
      </div>

      <template #footer>
        <div class="button-container" v-if="editable || buttonData.length">
          <ul :class="{ 'is-continuing': continueLoading }">
            <li v-for="button in buttonData" :key="button.name" :class="[button.className, { 'is-disabled': actionLoading }]" @click="!actionLoading && button.click()">
              <el-icon>
                <i-ep-loading v-if="actionLoading" class="is-loading" />
                <component v-else :is="button.icon" />
              </el-icon>
              <span>{{ button.name }}</span>
            </li>
          </ul>
          
          <el-tooltip
            v-if="!transferOnly && isShowReject"
            :content="$t('MobileNocodeProcessDialog.formLoadingTip')"
            :disabled="isFormActionReady"
            placement="top"
          >
            <span class="form-action-tooltip-trigger">
              <el-button
                class="button-reject"
                :loading="actionLoading"
                :disabled="!isFormActionReady || actionLoading"
                @click="reject"
              >
                {{ $t('MobileNocodeProcessDialog.reject') }}
              </el-button>
            </span>
          </el-tooltip>
          <el-tooltip
            v-if="!transferOnly && isShowStash"
            :content="$t('MobileNocodeProcessDialog.formLoadingTip')"
            :disabled="isFormActionReady"
            placement="top"
          >
            <span class="form-action-tooltip-trigger">
              <el-button
                class="button-reject"
                :loading="actionLoading"
                :disabled="!isFormActionReady || actionLoading"
                @click="stash"
              >
                {{ $t('MobileNocodeProcessDialog.stash') }}
              </el-button>
            </span>
          </el-tooltip>
          <el-tooltip
            v-if="canSubmitTodo"
            :content="$t('MobileNocodeProcessDialog.formLoadingTip')"
            :disabled="isFormActionReady"
            placement="top"
          >
            <span class="form-action-tooltip-trigger">
              <el-button
                type="primary"
                class="button-submit"
                :loading="actionLoading"
                :disabled="!isFormActionReady || actionLoading"
                @click="submit"
              >
                {{ todo.type === ProcessNodeType.APPROVAL ? $t('MobileNocodeProcessDialog.approve') : $t('MobileNocodeProcessDialog.submit')}}
              </el-button>
            </span>
          </el-tooltip>
        </div>
      </template>
    </el-dialog>
    <mobile-nocode-approval-opinion-dialog
      ref="approvalOpinionDialogRef"
      :title="title"
      :isBackNode="isBackNode"
      :requireComment="requireComment"
      :todo="props.todo"
      v-if="modelValue"
    />
    <nocode-select-transfer-user-dialog
      v-if="modelValue"
      v-model="nocodeSelectTransferUserDialogShow"
      :disabledUid="props.todo?.paddingOperators || []"
      @confirm="nocodeSelectTransferUserDialogShowConfirm"
      :todo="props.todo"
    />
    <tip-dialog
      ref="finishFlowTipDialogRef"
      :title="$t('MobileNocodeProcessDialog.finishFlow')"
      :content="$t('MobileNocodeProcessDialog.confirmFinishFlow')"
      :confirmText="$t('MobileNocodeProcessDialog.finishFlow')"
      :cancelText="$t('MobileNocodeProcessDialog.cancel')"
      :confirmBtnStyle="{ backgroundColor: '#f9484e' }"
    />
  </div>
</template>
  
<script lang='ts' setup>
import { computed, nextTick, ref, watch } from 'vue';
import { OptionTableUID, ProcessNodeType, ProcessNodeStatus, Row } from '@common/types/project';
import { TODO, TodoCategory } from '@common/types/nocode';
import { formFlowApi, getOperationEmptyRowDisplayText } from '../../../../utils';
import { canRollbackFlow, getFlowById, isDataProcessingNode } from "@common/utils";
import i18next from 'i18next';
import { ElMessage, ElMessageBox } from 'element-plus';
import { canShowProcessSubmitButton } from '../../../../utils/process-submit-button';
import { resolveReInitiateMode, type ReInitiateMode } from '../../../../utils/process-reinitiate';
import { sanitizeCopiedRowForCopy } from '@renderer/views/nocode/components/global/table/copy';
import { usePassportStore } from '@renderer/stores';

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  modelValue: boolean,
  todo: TODO,
  editable: boolean,
  category?: TodoCategory,
  hideFormData?: boolean,
}>(), {
  category: TodoCategory.MY_TODO,
  hideFormData: false,
});

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: "gotoMarket"),
  (event: "closed"),
  (event: "opened"),
  (event: "submit"),
  (event: "continue"),
  (event: "stash"),
  (event: "back"),
  (event: "deleteTodo"),
  (event: "toDrawer"),
  (event: "reInitiate", payload: { row: Row, tableUID: OptionTableUID, mode: ReInitiateMode }),
  (event: 'cancel'),
  (event: 'transfer'),
  (event: "update:modelValue", value: boolean),
}>();

const nocodeFormRef = ref();
const approvalOpinionDialogRef = ref();
const finishFlowTipDialogRef = ref();
const continueLoading = ref(false);
const passportState = usePassportStore();
const title = ref("");
const isBackNode = ref(false);
const requireComment = ref(false);
const nocodeSelectTransferUserDialogShow = ref(false);
const actionLoading = ref(false);
const isSuccessfulFlowResult = (result: unknown) => result !== null && !Array.isArray(result);
const isReportData = computed(() => {
  return props.todo?.type === ProcessNodeType.REPORT_DATA;
});
const resolvedFlowId = computed(() => props.todo?.currentFlowId || props.todo?.flowId || '');
const flow = computed(() => {
  const flows = props.todo.flows;
  return getFlowById(flows || [], resolvedFlowId.value);
});
const activeName = ref('data');
const singleOnceNoFormDataText = computed(() => {
  if (!props.hideFormData) return '';
  if (props.todo?.viewContextOnceNoFormData) {
    return i18next.t('MobileNocodeProcessDialog.timeTaskSingleNoData');
  }
  if (props.todo?.operationTriggerActionName) {
    return getOperationEmptyRowDisplayText(
      props.todo,
      'MobileNocodeProcessDialog.operationEmptyRowPrefix',
      'MobileNocodeProcessDialog.operationEmptyRowSuffix',
    );
  }
  return i18next.t('MobileNocodeProcessDialog.timeTaskSingleNoData');
});
const transferOnly = computed(() => {
  return props.todo?.canViewCurrentData === false
    && [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(props.todo?.type)
    && props.todo?.status === ProcessNodeStatus.IN_PROGRESS;
});
const formPlaceholderText = computed(() => {
  if (transferOnly.value) {
    return i18next.t('MobileNocodeProcessDialog.noViewPermissionTransferTip');
  }
  return singleOnceNoFormDataText.value;
});
const canSubmitTodo = computed(() => {
  return !isDataProcessingNode(props.todo?.type)
    && canShowProcessSubmitButton(props.todo, props.editable, transferOnly.value);
});
const isShowContinueFlow = computed(() => {
  return !transferOnly.value
    && props.editable
    && props.todo?.status === ProcessNodeStatus.IN_PROGRESS
    && props.todo?.canHandleStuckDataProcessing === true;
});
const reportRow = computed(() => {
  return props.todo?.reportData || null;
});
const todoRow = computed(() => {
  if (props.todo?.type === ProcessNodeType.REPORT_DATA) {
    return reportRow.value;
  }
  return props.todo?.data || null;
});
const buildSubmitPayloadRow = (row) => {
  if (props.todo?.type === ProcessNodeType.REPORT_DATA) {
    return {
      ...(reportRow.value || {}),
      ...(row || {}),
    };
  }
  return {
    ...props.todo.data,
    ...row,
  };
};
const targetFormPayload = computed(() => {
  if (props.todo?.type === ProcessNodeType.REPORT_DATA) {
    return {
      nocodeId: props.todo?.reportTargetNocodeId || props.todo?.nocodeId,
      tableId: props.todo?.reportTargetTableId || flow.value?.options?.targetTableUID || props.todo?.tableId,
    };
  }
  return {
    nocodeId: props.todo?.nocodeId,
    tableId: props.todo?.tableId,
  };
});
const isFormReady = ref(false);
const isFormActionReady = computed(() => Boolean(formPlaceholderText.value) || isFormReady.value);
const handleFormReady = () => {
  isFormReady.value = true;
};

watch(
  () => [
    props.modelValue,
    targetFormPayload.value.nocodeId,
    targetFormPayload.value.tableId,
    props.todo?.uuid,
    resolvedFlowId.value,
    formPlaceholderText.value,
  ],
  () => {
    isFormReady.value = false;
  },
  { immediate: true },
);

const reInitiatableStatuses = [
  ProcessNodeStatus.FINISHED,
  ProcessNodeStatus.REJECTED,
  ProcessNodeStatus.CANCELED,
];

const reInitiateMode = ref<ReInitiateMode | null>(null);

watch(
  () => [props.modelValue, props.todo?.todoId, props.todo?.status] as const,
  async ([visible, todoId]) => {
    reInitiateMode.value = null;
    if (!visible || !todoId) return;
    if (props.category !== TodoCategory.MY_INITIATED || !reInitiatableStatuses.includes(props.todo?.status)) return;
    const mode = await resolveReInitiateMode(props.todo);
    if (props.todo?.todoId !== todoId) return;
    reInitiateMode.value = mode;
  },
  { immediate: true },
);

const canReInitiate = computed(() => {
  return props.category === TodoCategory.MY_INITIATED
    && reInitiatableStatuses.includes(props.todo?.status)
    && !formPlaceholderText.value
    && !!reInitiateMode.value;
});
const closeDialog = () => {
  emit("update:modelValue", false);
};

const prepareSubmitRow = async() => {
  if (formPlaceholderText.value) {
    return {};
  }
  return await nocodeFormRef.value?.prepareSubmitRow?.();
}

const submit = async() => {
  if (actionLoading.value) return;
  actionLoading.value = true;
  try {
    const row = await prepareSubmitRow();
    if (!row) return;
    const confirmed = formPlaceholderText.value
      ? true
      : await nocodeFormRef.value?.confirmSubmitBeforeMutation?.();
    if (!confirmed) return;
    title.value = i18next.t('MobileNocodeProcessDialog.approvalOpn');
    if (props.todo.type === ProcessNodeType.TRANSACT) {
      title.value = i18next.t('MobileNocodeProcessDialog.handleOpn');
    }
    isBackNode.value = false;
    requireComment.value = !!props.todo?.requireComments;
    await nextTick();
    let resolve = null;
    if ([ProcessNodeType.TRANSACT, ProcessNodeType.APPROVAL].includes(props.todo?.type)) {
      resolve = await approvalOpinionDialogRef.value.confirm()
      if (!resolve?.state) return;
    }
    const res = await formFlowApi.submitTodo({
      nocodeId: props.todo.nocodeId,
      tableId: props.todo.tableId,
      uuid: props.todo.uuid,
      flowId: resolvedFlowId.value,
      id: props.todo.id,
      todoId: props.todo.todoId,
      row: buildSubmitPayloadRow(row),
      comment: resolve?.suggestion,
      commentImages: resolve?.commentImages,
      commentFiles: resolve?.commentFiles,
    })
    if (!isSuccessfulFlowResult(res)) {
      return;
    }
    if (res?.errorMsg) {
      ElMessage.warning(res?.errorMsg);
      if (!res?.isFinish) {
        nocodeFormRef.value?.notifySubmitValidationMessages?.();
        return;
      }
    }
    nocodeFormRef.value?.notifySubmitValidationMessages?.();
    closeDialog();
    emit("submit");
  } finally {
    actionLoading.value = false;
    nocodeFormRef.value?.clearSubmitValidationNotice?.();
  }
}

const stash = async() => {
  if (actionLoading.value) return;
  actionLoading.value = true;
  try {
    const row = await prepareSubmitRow();
    if (!row) return;
    const confirmed = formPlaceholderText.value
      ? true
      : await nocodeFormRef.value?.confirmSubmitBeforeMutation?.();
    if (!confirmed) return;
    const result = await nocodeFormRef.value?.stash?.({ todo: props.todo, row: buildSubmitPayloadRow(row) });
    if (!result) return;
    closeDialog();
    emit("stash");
  } finally {
    actionLoading.value = false;
    nocodeFormRef.value?.clearSubmitValidationNotice?.();
  }
}

const back = async() => {
  if (actionLoading.value) return;
  actionLoading.value = true;
  try {
    title.value = i18next.t('MobileNocodeProcessDialog.rollback');
    isBackNode.value = true;
    requireComment.value = false;
    await nextTick();
    const resolve = await approvalOpinionDialogRef.value.confirm();
    if (!resolve?.state) return;

    const row = nocodeFormRef.value?.serialize();
    const result = await formFlowApi.backTodo({
      nocodeId: props.todo.nocodeId,
      tableId: props.todo.tableId,
      uuid: props.todo.uuid,
      flowId: resolvedFlowId.value,
      id: props.todo.id,
      todoId: props.todo.todoId,
      row,
      backId: resolve.backNode,
      comment: resolve.suggestion,
      commentImages: resolve.commentImages,
      commentFiles: resolve.commentFiles,
    });
    if (!isSuccessfulFlowResult(result)) return;
    closeDialog();
    emit("back");
  } finally {
    actionLoading.value = false;
  }
}
const deleteFlow = async () => {
  if (actionLoading.value) return;
  ElMessageBox({
    title: i18next.t("nocodeDeleteFlow.title"),
    message: i18next.t("nocodeDeleteFlow.message"),
    showCancelButton: true,
    cancelButtonClass: 'nocodeProcessDrawerElMessageBoxBtnClass',
    confirmButtonClass: 'nocodeProcessDrawerElMessageBoxBtnClass',
    cancelButtonText: i18next.t("nocodeDeleteFlow.cancelButtonText"),
    confirmButtonText: i18next.t("nocodeDeleteFlow.confirmButtonText"),
  }).then(async () => {
    actionLoading.value = true;
    try {
      const result = await formFlowApi.deleteTodo({
        nocodeId: props?.todo?.nocodeId,
        tableId: props?.todo?.tableId,
        uuid: props?.todo?.uuid,
        todoId: props.todo.todoId,
        flowId: resolvedFlowId.value,
        id: props?.todo?.id,
      });
      if (!isSuccessfulFlowResult(result)) {
        ElMessage.error(i18next.t('formFlowService.statusChangedRefreshTips'));
        return;
      }
      closeDialog();
      emit("deleteTodo");
    } finally {
      actionLoading.value = false;
    }
  })
}
const transfer = () => {
  nocodeSelectTransferUserDialogShow.value = true
}
const nocodeSelectTransferUserDialogShowConfirm = async (resolve) => {
  if (actionLoading.value) return;
  if (!resolve || !resolve.state || !resolve.transferOwner) return;

  actionLoading.value = true;
  try {
    const result = await formFlowApi.transferTodo({
      nocodeId: props.todo.nocodeId,
      tableId: props.todo.tableId,
      uuid: props.todo.uuid,
      flowId: resolvedFlowId.value,
      todoId: props.todo.todoId,
      id: props.todo.id,
      transferOwner: resolve.transferOwner
    });
    if (!isSuccessfulFlowResult(result)) {
      ElMessage.error(i18next.t('formFlowService.statusChangedRefreshTips'));
      return;
    }
    closeDialog();
    emit("transfer");
  } finally {
    actionLoading.value = false;
  }
}

const reject = async() => {
  if (actionLoading.value) return;
  actionLoading.value = true;
  try {
    title.value = i18next.t('MobileNocodeProcessDialog.reject');
    isBackNode.value = false;
    requireComment.value = false;
    await nextTick();
    const resolve = await approvalOpinionDialogRef.value.confirm();
    if (!resolve?.state) return;
    const result = await formFlowApi.rejectTodo({
      nocodeId: props.todo.nocodeId,
      tableId: props.todo.tableId,
      uuid: props.todo.uuid,
      todoId: props.todo.todoId,
      flowId: resolvedFlowId.value,
      id: props.todo.id,
      comment: resolve?.suggestion,
      commentImages: resolve?.commentImages,
      commentFiles: resolve?.commentFiles,
    });
    if (!isSuccessfulFlowResult(result)) {
      ElMessage.error(i18next.t('formFlowService.statusChangedRefreshTips'));
      return;
    }
    closeDialog();
    emit("back");
  } finally {
    actionLoading.value = false;
  }
}

const isShowBack = computed(() => {
  const flow = getFlowById(props.todo?.flows || [], resolvedFlowId.value);
  return !transferOnly.value && props.editable && canRollbackFlow(flow);
})

const isShowDelete = computed(() => {
  return ![
    ProcessNodeStatus.IN_PROGRESS,
  ].includes(props.todo?.status) && !transferOnly.value;
})

const isShowReject = computed(() => {
  const flow = getFlowById(props.todo?.flows || [], resolvedFlowId.value);
  const allowReject = flow?.options?.allowReject
  return !transferOnly.value && props.editable && props.todo?.type === ProcessNodeType.APPROVAL && allowReject;
})
const isShowStash = computed(() => {
  const flow = getFlowById(props.todo?.flows || [], resolvedFlowId.value);
  return !transferOnly.value && props.editable && !!flow?.options?.allowStash;
})

const reInitiate = () => {
  if (!canReInitiate.value) {
    ElMessage.warning(i18next.t('MobileNocodeProcessDialog.reInitiateUnavailable'));
    return;
  }
  const currentRow = nocodeFormRef.value?.getFormRow?.();
  const currentTable = nocodeFormRef.value?.getCurrentTable?.();
  const currentFormData = nocodeFormRef.value?.getCurrentFormData?.();
  const mode = reInitiateMode.value;
  if (!currentRow || !currentTable || !currentFormData?.uid || !mode) {
    ElMessage.warning(i18next.t('MobileNocodeProcessDialog.reInitiateUnavailable'));
    return;
  }
  emit('reInitiate', {
    row: mode === 'add'
      ? sanitizeCopiedRowForCopy({
        row: currentRow,
        table: currentTable,
        formData: currentFormData,
      })
      : currentRow,
    tableUID: [currentFormData.uid, currentTable.uid],
    mode,
  });
}

const cancelFlow = async () => {
  if (actionLoading.value) return;
  ElMessageBox({
    title: i18next.t('MobileNocodeProcessDialog.revoke'),
    message: i18next.t('MobileNocodeProcessDialog.confirmRevoke'),
    showCancelButton: true,
    cancelButtonClass: 'nocodeProcessDrawerElMessageBoxBtnClass',
    confirmButtonClass: 'nocodeProcessDrawerElMessageBoxBtnClass',
    cancelButtonText: i18next.t('MobileNocodeProcessDialog.cancel'),
    confirmButtonText: i18next.t('MobileNocodeProcessDialog.revoke'),
  }).then(async () => {
    actionLoading.value = true;
    try {
      await formFlowApi.cancelTodo({
        nocodeId: props.todo.nocodeId,
        tableId: props.todo.tableId,
        uuid: props.todo.uuid,
        flowId: resolvedFlowId.value,
        id: props.todo.id,
        todoId: props.todo.todoId,
      })
      closeDialog();
      emit("cancel");
    } catch (err) {
      ElMessage.error(err?.message || i18next.t('formFlowService.statusChangedRefreshTips'));
    } finally {
      actionLoading.value = false;
    }
  })
}

const finishFlow = async () => {
  if (actionLoading.value) return;
  const confirmed = await finishFlowTipDialogRef.value?.confirm();
  if (!confirmed) {
    return;
  }
  actionLoading.value = true;
  try {
    await formFlowApi.finishTodo({
      nocodeId: props.todo.nocodeId,
      tableId: props.todo.tableId,
      uuid: props.todo.uuid,
      flowId: resolvedFlowId.value,
      id: props.todo.id,
      todoId: props.todo.todoId,
    })
    closeDialog();
    emit("update:modelValue", false)
    emit("cancel");
  } catch (err) {
    ElMessage.error(err?.message || i18next.t('formFlowService.statusChangedRefreshTips'));
  } finally {
    actionLoading.value = false;
  }
}

const continueFlow = async () => {
  if (continueLoading.value) {
    return;
  }
  continueLoading.value = true;
  try {
    await formFlowApi.continueTodo({
      nocodeId: props.todo.nocodeId,
      tableId: props.todo.tableId,
      uuid: props.todo.uuid,
      flowId: resolvedFlowId.value,
      id: props.todo.id,
      todoId: props.todo.todoId,
    });
    closeDialog();
    emit("continue");
  } catch (err) {
    ElMessage.error(err?.message || i18next.t('formFlowService.statusChangedRefreshTips'));
  } finally {
    continueLoading.value = false;
  }
}

const isShowTransfer = computed(() => {
  const flow = getFlowById(props.todo?.flows || [], resolvedFlowId.value);
  const allowTransfer = flow?.options?.allowTransfer
  return props.editable
    && [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(props.todo?.type)
    && (allowTransfer || transferOnly.value)
})

const isShowCanceled = computed(() => {
  return props.category === TodoCategory.MY_INITIATED
    && !transferOnly.value
    && props.todo?.status === ProcessNodeStatus.IN_PROGRESS
    && props.todo?.flowStartOperator === passportState.account.id
    && props.todo?.allowCancel === true;
})

const isShowFinishFlow = computed(() => {
  const flow = getFlowById(props.todo?.flows || [], resolvedFlowId.value);
  return !transferOnly.value
    && props.editable
    && props.todo?.status === ProcessNodeStatus.IN_PROGRESS
    && (
      props.todo?.canHandleStuckDataProcessing === true
      || (!isDataProcessingNode(props.todo?.type) && !!flow?.options?.allowFinishFlow)
    );
})

const buttonData = computed(() => {
  return [
    {
      name: i18next.t('MobileNocodeProcessDialog.reInitiate'),
      icon: IWorkbenchNocodeTodoInitiateProcessIcon,
      visible: canReInitiate.value,
      click: () => {
        reInitiate();
      }
    },
    {
      name: i18next.t('MobileNocodeProcessDialog.transfer'),
      icon: INocodeProcessFlowForward,
      visible: isShowTransfer.value,
      click: () => {
        transfer();
      },
    },
    {
      name: i18next.t('MobileNocodeProcessDialog.rollback'),
      icon: INocodeProcessFlowBack,
      visible: isShowBack.value,
      click: () => {
        back()
      }
    },
    {
      name: i18next.t('MobileNocodeProcessDialog.comment'),
      icon: INocodeProcessFlowComment,
      visible: false,
      click: () => {},
    },
    {
      name: i18next.t('MobileNocodeProcessDialog.revoke'),
      icon: INocodeProcessFlowRevoke,
      visible: isShowCanceled.value,
      click: () => {
        cancelFlow()
      },
    },
    {
      name: i18next.t('MobileNocodeProcessDialog.finishFlow'),
      icon: IEpSwitchButton,
      visible: isShowFinishFlow.value,
      className: 'danger',
      click: () => {
        finishFlow()
      },
    },
    {
      name: i18next.t('MobileNocodeProcessDialog.continueFlow'),
      icon: INocodeProcessFlowGoOn,
      visible: isShowContinueFlow.value,
      className: 'primary',
      click: () => {
        continueFlow()
      },
    },
    {
      name: i18next.t('MobileNocodeProcessDialog.delete'),
      icon: INocodeFlowDeleteData, 
      visible: isShowDelete.value,
      click: () => {
        deleteFlow()
      }
    },
    {
      name: i18next.t('MobileNocodeProcessDialog.more'),
      icon: IEpMoreFilled,
      visible: false,
      click: () => {},
    }
  ].filter(item => item.visible)
})

watch(() => ({
  visible: props.modelValue,
}), ({ visible }) => {
  if (!visible) {
    activeName.value = 'data';
    return;
  }
  activeName.value = 'data';
}, {
  immediate: true,
});

</script>
  
<style lang="scss" scoped>
.nocode-process-dialog {
  :deep(.el-overlay-dialog) {
    overflow: hidden;
  }
  :deep(.nocode-process-container){
    width: 100%;
    height: 100%;
    max-height: 100%;
    // border-radius: 8px;
    box-shadow: none;
    padding: 0px;
    background-color: var(--color-white);

    .el-dialog__header {
      display: none;
    }

    .content-container .container {
      margin-top: 4px;
    }
    
    .el-dialog__body{
      padding: 16px;
      padding-top: 24px;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--bg-color);

      .container {
        display: flex;
        flex-direction: column;
        gap: 16px;
        height: 100%;
        min-height: 0;

        .title {
          color: var(--text-color-primary);
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
          letter-spacing: 0px;
          width: 100%;
          height: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stack-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          flex: 1;
          gap: 16px;
          min-height: 0;
          padding-bottom: 60px;

          .stack-tabs {
            width: 100%;
            height: 40px;
            display: flex;
            align-items: center;
            font-weight: 500;
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0%; 
            border-bottom: 1px solid var(--border-color);

            .vn-stack-tab {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              border-bottom: 1px solid transparent;
              height: 100%;
              transition: all 0.1s ease;

              &.active {
                border-bottom: 2px solid var(--el-color-primary);
                color: var(--el-color-primary);
              }
            }

            
          }

          .stack-content {
            flex: 1;
            min-height: 0px;
            display: flex;
            flex-direction: column;
            overflow: auto;
            border-radius: 8px;
            background: #fff;

            .el-scrollbar__wrap {
              display: flex;
              flex-direction: column;
              flex: 1;
              min-height: 0;
            }

            .el-scrollbar__view {
              height: 100%;
              flex: 1;
              min-height: 0;
              display: flex;
              flex-direction: column;
            }

            :deep(.vn-stack-layer.active) {
              height: 100%;
              display: flex;
              flex-direction: column;
              min-height: 0;
            }

            .no-form-data {
              height: 100%;
              padding: 24px 16px;
              color: var(--text-color-secondary);
              line-height: 22px;
              font-size: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
            }

            .process-container {
              height: 100%;
              flex: 1;
              min-height: 0;
              background-color: #fff;
              border-radius: 8px;
            }

            :deep(.process-flows) {
              height: 100%;
              flex: 1;
              min-height: 0;
            }
          }
        }
      }
    }

    .content-container {
      .b2container {
        padding: 2px !important;
      }
    }
    
    .el-dialog__footer {
      width: 100%;
      padding: 0px;
      position: absolute;
      bottom: 0;
      left: 0;
      .button-container {
        display: flex;
        align-items: center;
        border-top: 1px solid var(--border-color);
        padding: 12px 16px;
        column-gap: 8px;
        background-color: #fff;
        justify-content: flex-end;

        .el-button {
          border-radius: 4px;
          margin: 0;
        }

        .form-action-tooltip-trigger {
          display: inline-flex;
        }

        ul {
          margin-right: auto;
          display: flex;
          align-items: center;
          gap: 8px;

          li {
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 400;
            font-size: 12px;
            line-height: 16px; 
            letter-spacing: 0%;
            gap: 4px;
            padding: 8px 4px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.3s ease;

            &:hover {
              background-color: var(--bg-color-overlay);
            }

            &.danger {
              color: #f9484e;
            }

            &.primary {
              color: var(--color-primary);
            }
          }

          &.is-continuing {
            pointer-events: none;
            opacity: 0.6;
          }
        }
      }
    }
  }

  .my-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-right: 40px;

    span {
      margin-right: auto;
      margin-left: 16px;
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
      text-align: center;
      color: var(--text-color-regular);
    }

    .el-icon {
      font-size: 14px;
      padding-bottom: 2px;
      cursor: pointer;

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }

  .container {
    height: 100%;
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    display: flex;
    overflow: hidden;

    .container-left {
      width: 70%;
      background-color: #f5f6f7;
      border-bottom-left-radius: 8px;
      display: flex;
      flex-direction: column; 

      .main-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        background-color: #f5f6f7;
        flex: 1;
        padding: 16px;
        gap: 16px;
        min-height: 0;

        .form-container {
          flex: 1;
          border-radius: 4px;
          background-color: white;
          display: flex;
          flex-direction: column;
        }
      }

      .button-container {
        display: flex;
        align-items: center;
        border-top: 1px solid var(--border-color);
        padding: 16px;
        column-gap: 8px;
        background-color: #fff;
        justify-content: flex-end;

        .el-button {
          border-radius: 4px;
          margin: 0;
        }

        ul {
          margin-right: auto;
          display: flex;
          align-items: center;
          gap: 8px;

          li {
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 400;
            font-size: 12px;
            line-height: 16px; 
            letter-spacing: 0%;
            gap: 4px;
            padding: 8px 4px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.3s ease;

            &:hover {
              background-color: var(--bg-color-overlay);
            }

            &.is-disabled {
              cursor: not-allowed;
              opacity: 0.6;
              pointer-events: none;
            }
          }
        }
      }
    }

    .container-right {
      width: 30%;
      height: 100%;
      border-bottom-right-radius: 8px;
      background-color: var(--color-white); 
      border-left: 1px solid var(--border-color);

    }
  }
}
</style>
