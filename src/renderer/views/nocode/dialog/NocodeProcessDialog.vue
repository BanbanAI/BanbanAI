<template>
  <div class="nocode-process-dialog">
    <el-dialog class="nocode-process-container"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)" 
      @opened="emit('opened')" 
      align-center
      :title="dialogTitle"
      :close-on-click-modal="false"
      destroy-on-close
      draggable
      ref="dialogRef"
      :fullscreen="fullscreen"
      :before-close="handleDrawerBeforeClose"
    >
      <!-- :transition="fullscreen ? 'none' : 'dialog-fade'" -->
      <template #header>
        <div class="my-header">
          <div class="header-title">
            <span
              v-if="todoDataTitle"
              class="data-title"
              :title="todoDataTitle"
            >
              {{ todoDataTitle }}
            </span>
            <span v-if="todoDataTitle && todo?.formName" class="title-divider"></span>
            <el-button
              v-if="todo?.formName"
              class="form-link"
              text type="primary"
              size="small"
              @click="openTargetForm"
            >
              {{ todo.formName }}
            </el-button>
          </div>
          <el-button
            link
            class="header-action"
            :title="$t('NocodeProcessDialog.switchToDrawer')"
            @click="toDrawer"
          >
            <el-icon>
              <i-ven-icon-partial-full-screen />
            </el-icon>
          </el-button>
          <el-button
            link
            class="header-action"
            :title="fullscreen ? $t('NocodeProcessDialog.exitFullscreen') : $t('NocodeProcessDialog.fullscreen')"
            @click="emit('update:fullscreen', !fullscreen)"
          >
            <el-icon>
              <i-ven-icon-shrink-screen v-if="fullscreen" />
              <i-ven-icon-full-screen v-else />
            </el-icon>
          </el-button>
        </div>
      </template>
      <div class="container" :class="{ 'is-process-folded': processInfoFolded }" v-if="todo">
        <div class="process-toggle-button" v-if="processInfoFolded">
          <el-button text :title="$t('NocodeProcessDrawer.expandProcessInfo')" @click="emit('update:processInfoFolded', !processInfoFolded)">
            <el-icon>
              <i-ven-icon-double-left-arrow />
            </el-icon>
          </el-button>
        </div>
        <div class="container-left">

          <!-- 放置不同表单内容 -->
          <div class="main-container">
            <!-- <iframe src="" frameborder="0"></iframe> -->
            <process-info-card :todo="props.todo"></process-info-card>
            <el-scrollbar class="form-container">
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
            </el-scrollbar>
          </div>

          <div
            class="button-container"
            v-if="editable || buttonMenuData.length"
          >
            <template v-if="editable || buttonMenuData.length">
              <ul v-if="buttonMenuData.length">
                <li v-for="button in buttonMenuData" :key="button.name" :class="button.className" @click="button.click">
                  <el-icon>
                    <component :is="button.icon" />
                  </el-icon>
                  <span>{{ button.name }}</span>
                </li>
              </ul>

              <el-tooltip
                v-if="!transferOnly && isShowStash"
                :content="$t('NocodeProcessDialog.formLoadingTip')"
                :disabled="isFormActionReady"
                placement="top"
              >
                <span class="form-action-tooltip-trigger">
                  <el-button
                    class="button-reject"
                    :disabled="!isFormActionReady"
                    @click="stash"
                  >
                    {{ $t('NocodeProcessDialog.stash') }}
                  </el-button>
                </span>
              </el-tooltip>
              <el-tooltip
                v-if="!transferOnly && isShowReject"
                :content="$t('NocodeProcessDialog.formLoadingTip')"
                :disabled="isFormActionReady"
                placement="top"
              >
                <span class="form-action-tooltip-trigger">
                  <el-button
                    class="button-reject"
                    :disabled="!isFormActionReady"
                    @click="reject"
                  >
                    {{ $t('NocodeProcessDialog.reject') }}
                  </el-button>
                </span>
              </el-tooltip>
              <el-tooltip
                v-if="canSubmitTodo"
                :content="$t('NocodeProcessDialog.formLoadingTip')"
                :disabled="isFormActionReady"
                placement="top"
              >
                <span class="form-action-tooltip-trigger">
                  <el-button
                    type="primary"
                    class="button-submit"
                    :disabled="!isFormActionReady"
                    @click="submit"
                  >
                    {{ todo.type === ProcessNodeType.APPROVAL ? $t('NocodeProcessDialog.pass') : $t('NocodeProcessDialog.submit')}}
                  </el-button>
                </span>
              </el-tooltip>
            </template>
          </div>

        </div>
        <div class="container-right" v-if="!processInfoFolded">
          <data-form-side-panel
            :todo="props.todo"
            :showFlowTab="true"
            defaultActiveTab="flow"
            @fold="emit('update:processInfoFolded', true)"
          />
        </div>
      </div>
    </el-dialog>
    <nocode-approval-opinion-dialog
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
  </div>
  <tip-dialog ref="dialogExitTipDialogRef" :title="$t('NocodeProcessDialog.tips')" :content="$t('NocodeProcessDialog.confirmQuit')" :closeOnClickModal="true"/>
  <tip-dialog
    ref="finishFlowTipDialogRef"
    :title="$t('NocodeProcessDialog.finishFlow')"
    :content="$t('NocodeProcessDialog.confirmFinishFlow')"
    :confirmText="$t('NocodeProcessDialog.finishFlow')"
    :cancelText="$t('NocodeProcessDialog.cancel')"
    :confirmBtnStyle="{ backgroundColor: '#f9484e' }"
  />
</template>
  
<script lang='ts' setup>
import { computed, nextTick, ref, watch } from 'vue';
import { OptionTableUID, ProcessNodeType, ProcessNodeStatus, Row } from '@common/types/project';
import { TODO, TodoCategory } from '@common/types/nocode';
import { formFlowApi, getOperationEmptyRowDisplayText, getTodoDataTitle } from '../utils';
import { canRollbackFlow, getFlowById } from "@common/utils";
import i18next from 'i18next';
import { ElMessage, ElMessageBox } from 'element-plus';
import { usePassportStore } from '@renderer/stores';
import { canShowProcessSubmitButton } from '../utils/process-submit-button';
import { sanitizeCopiedRowForCopy } from '@renderer/views/nocode/components/global/table/copy';
import DataFormSidePanel from '../components/global/table/components/DataFormSidePanel.vue';

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  modelValue: boolean,
  todo: TODO,
  editable: boolean,
  category?: TodoCategory,
  hideFormData?: boolean,
  row?: Row,
  fullscreen?: boolean,
  processInfoFolded?: boolean,
}>(), {
  category: TodoCategory.MY_TODO,
  hideFormData: false,
  row: null,
  fullscreen: false,
  processInfoFolded: false,
});

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: "gotoMarket"),
  (event: "closed"),
  (event: "opened"),
  (event: "submit"),
  (event: "stash"),
  (event: "back"),
  (event: "deleteTodo"),
  (event: "toDrawer", row: Row),
  (event: "reInitiate", payload: { row: Row, tableUID: OptionTableUID }),
  (event: "openForm", payload: { nocodeId: string, tableId: string }),
  (event: 'cancel'),
  (event: 'transfer'),
  (event: "update:fullscreen", value: boolean),
  (event: "update:processInfoFolded", value: boolean),
  (event: "update:modelValue", value: boolean),
}>();

const nocodeFormRef = ref();
const dialogRef = ref();
const approvalOpinionDialogRef = ref();
const dialogExitTipDialogRef = ref();
const finishFlowTipDialogRef = ref();
const passportState = usePassportStore();
const isReportData = computed(() => {
  return props.todo?.type === ProcessNodeType.REPORT_DATA;
});
const resolvedFlowId = computed(() => props.todo?.currentFlowId || props.todo?.flowId || '');
const flow = computed(() => {
  const flows = props.todo.flows;
  return getFlowById(flows || [], resolvedFlowId.value);
});
const title = ref("");
const isBackNode = ref(false);
const requireComment = ref(false);
const nocodeSelectTransferUserDialogShow = ref(false);
const todoDataTitle = computed(() => getTodoDataTitle(props.todo));
const dialogTitle = computed(() => {
  return [todoDataTitle.value, props.todo?.formName].filter(Boolean).join(' | ');
});
const singleOnceNoFormDataText = computed(() => {
  if (!props.hideFormData) return '';
  if (props.todo?.operationTriggerActionName) {
    return getOperationEmptyRowDisplayText(
      props.todo,
      'NocodeProcessDialog.operationEmptyRowPrefix',
      'NocodeProcessDialog.operationEmptyRowSuffix',
    );
  }
  return i18next.t('NocodeProcessDialog.timeTaskSingleNoData');
});
const transferOnly = computed(() => {
  return props.todo?.canViewCurrentData === false
    && [ProcessNodeType.APPROVAL, ProcessNodeType.TRANSACT].includes(props.todo?.type)
    && props.todo?.status === ProcessNodeStatus.IN_PROGRESS;
});
const formPlaceholderText = computed(() => {
  if (transferOnly.value) {
    return i18next.t('NocodeProcessDialog.noViewPermissionTransferTip');
  }
  return singleOnceNoFormDataText.value;
});
const canSubmitTodo = computed(() => {
  return canShowProcessSubmitButton(props.todo, props.editable, transferOnly.value);
});
const isShowStash = computed(() => {
  const flow = getFlowById(props.todo?.flows || [], resolvedFlowId.value);
  return !transferOnly.value && props.editable && !!flow?.options?.allowStash;
});
const reportRow = computed(() => {
  return props.todo?.reportData || props.row || null;
});
const todoRow = computed(() => {
  if (props.todo?.type === ProcessNodeType.REPORT_DATA) {
    return reportRow.value;
  }
  return props.todo?.data || props.row || null;
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

const openTargetForm = async () => {
  if (!targetFormPayload.value?.nocodeId || !targetFormPayload.value?.tableId) {
    return;
  }
  const isModified = nocodeFormRef.value?.isModified?.();
  if (isModified) {
    const isExit = await dialogExitTipDialogRef.value?.confirm();
    if (!isExit) {
      return;
    }
  }
  emit('openForm', {
    nocodeId: targetFormPayload.value.nocodeId,
    tableId: targetFormPayload.value.tableId as string,
  });
};

const handleDrawerBeforeClose = async (done) => {
  const isModified = nocodeFormRef.value?.isModified?.();
  if (isModified) {
    const isExit = await dialogExitTipDialogRef.value?.confirm();
    if (isExit) {
      done();
    }
  } else {
    done();
  }
}

const prepareSubmitRow = async() => {
  if (formPlaceholderText.value) {
    return {};
  }
  return await nocodeFormRef.value?.prepareSubmitRow();
};

const submit = async() => {
  const row = await prepareSubmitRow();
  if (!row) return;
  const confirmed = formPlaceholderText.value
    ? true
    : await nocodeFormRef.value?.confirmSubmitBeforeMutation?.();
  if (!confirmed) {
    nocodeFormRef.value?.clearSubmitValidationNotice?.();
    return;
  }
  title.value = i18next.t('NocodeProcessDialog.approvalOpinion');
  if (props.todo.type === ProcessNodeType.TRANSACT) {
    title.value = i18next.t('NocodeProcessDialog.handleOpinion');
  }
  isBackNode.value = false;
  requireComment.value = !!props.todo?.requireComments;
  await nextTick();
  let resolve = null;
  if ([ProcessNodeType.TRANSACT, ProcessNodeType.APPROVAL].includes(props.todo?.type)) {
    resolve = await approvalOpinionDialogRef.value.confirm()
    if (!resolve?.state) {
      nocodeFormRef.value?.clearSubmitValidationNotice?.();
      return;
    }
  }

  try {
    const res = await formFlowApi.submitTodo({
      nocodeId: props.todo.nocodeId,
      tableId: props.todo.tableId,
      uuid: props.todo.uuid,
      flowId: resolvedFlowId.value,
      todoId: props.todo.todoId,
      id: props.todo.id,
      row: buildSubmitPayloadRow(row),
      comment: resolve?.suggestion,
      commentImages: resolve?.commentImages,
      commentFiles: resolve?.commentFiles,
    });
    if (!res) {
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
    dialogRef.value.visible = false;
    emit("update:modelValue", false)
    emit("submit");
  } finally {
    nocodeFormRef.value?.clearSubmitValidationNotice?.();
  }
}

const stash = async() => {
  const row = await prepareSubmitRow();
  if (!row) return;
  const confirmed = formPlaceholderText.value
    ? true
    : await nocodeFormRef.value?.confirmSubmitBeforeMutation?.();
  if (!confirmed) {
    nocodeFormRef.value?.clearSubmitValidationNotice?.();
    return;
  }
  try {
    const result = await nocodeFormRef.value?.stash?.({ todo: props.todo, row: buildSubmitPayloadRow(row) });
    if (!result) return;
    dialogRef.value.visible = false;
    emit("update:modelValue", false);
    emit("stash");
  } finally {
    nocodeFormRef.value?.clearSubmitValidationNotice?.();
  }
}

const back = async() => {
  title.value = i18next.t('NocodeProcessDialog.rollback');
  isBackNode.value = true;
  requireComment.value = false;
  await nextTick();
  const resolve = await approvalOpinionDialogRef.value.confirm();
  if (!resolve?.state) return;

  const row = nocodeFormRef.value?.serialize();
  await formFlowApi.backTodo({
    nocodeId: props.todo.nocodeId,
    tableId: props.todo.tableId,
    uuid: props.todo.uuid,
    flowId: resolvedFlowId.value,
    todoId: props.todo.todoId,
    id: props.todo.id,
    row,
    backId: resolve.backNode,
    comment: resolve.suggestion,
    commentImages: resolve.commentImages,
    commentFiles: resolve.commentFiles,
  })
  dialogRef.value.visible = false;
  emit("update:modelValue", false)
  emit("back");
}
const deleteFlow = async () => {
  ElMessageBox({
    title: i18next.t("nocodeDeleteFlow.title"),
    message: i18next.t("nocodeDeleteFlow.message"),
    showCancelButton: true,
    cancelButtonClass: 'nocodeProcessDrawerElMessageBoxBtnClass',
    confirmButtonClass: 'nocodeProcessDrawerElMessageBoxBtnClass',
    cancelButtonText: i18next.t("nocodeDeleteFlow.cancelButtonText"),
    confirmButtonText: i18next.t("nocodeDeleteFlow.confirmButtonText"),
  }).then(async () => {
    await formFlowApi.deleteTodo({
      nocodeId: props?.todo?.nocodeId,
      tableId: props?.todo?.tableId,
      uuid: props?.todo?.uuid,
      flowId: resolvedFlowId.value,
      todoId: props.todo.todoId,
      id: props?.todo?.id,
    })

    emit("update:modelValue", false)
    emit("deleteTodo");
  })
}
const transfer = () => {
  nocodeSelectTransferUserDialogShow.value = true
}

const nocodeSelectTransferUserDialogShowConfirm = async (resolve) => {
  if (!resolve || !resolve.state || !resolve.transferOwner) return;

  await formFlowApi.transferTodo({
    nocodeId: props.todo.nocodeId,
    tableId: props.todo.tableId,
    uuid: props.todo.uuid,
    flowId: resolvedFlowId.value,
    todoId: props.todo.todoId,
    id: props.todo.id,
    transferOwner: resolve.transferOwner
  });

  emit("update:modelValue", false);
  emit("transfer");
}

const reject = async() => {
  title.value = i18next.t('NocodeProcessDialog.reject');
  isBackNode.value = false;
  requireComment.value = false;
  await nextTick();
  const resolve = await approvalOpinionDialogRef.value.confirm();
  if (!resolve?.state) return;
  await formFlowApi.rejectTodo({
    nocodeId: props.todo.nocodeId,
    tableId: props.todo.tableId,
    uuid: props.todo.uuid,
    todoId: props.todo.todoId,
    flowId: resolvedFlowId.value,
    id: props.todo.id,
    comment: resolve?.suggestion,
    commentImages: resolve?.commentImages,
    commentFiles: resolve?.commentFiles,
  })
  dialogRef.value.visible = false;
  emit("update:modelValue", false)
  emit("back");
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

const reInitiatableStatuses = [
  ProcessNodeStatus.FINISHED,
  ProcessNodeStatus.REJECTED,
  ProcessNodeStatus.CANCELED,
];

const canReInitiate = computed(() => {
  return props.category === TodoCategory.MY_INITIATED
    && reInitiatableStatuses.includes(props.todo?.status)
    && !formPlaceholderText.value;
});

const toDrawer = () => {
  const row = nocodeFormRef.value?.getFormRow() ?? null;
  emit('toDrawer', row);
}

const reInitiate = () => {
  if (!canReInitiate.value) {
    ElMessage.warning(i18next.t('NocodeProcessDialog.reInitiateUnavailable'));
    return;
  }
  const currentRow = nocodeFormRef.value?.getFormRow?.();
  const currentTable = nocodeFormRef.value?.getCurrentTable?.();
  const currentFormData = nocodeFormRef.value?.getCurrentFormData?.();
  if (!currentRow || !currentTable || !currentFormData?.uid) {
    ElMessage.warning(i18next.t('NocodeProcessDialog.reInitiateUnavailable'));
    return;
  }
  emit('reInitiate', {
    row: sanitizeCopiedRowForCopy({
      row: currentRow,
      table: currentTable,
      formData: currentFormData,
    }),
    tableUID: [currentFormData.uid, currentTable.uid],
  });
}

const cancelFlow = async () => {
  ElMessageBox({
    title: i18next.t('NocodeProcessDialog.revoke'),
    message: i18next.t('NocodeProcessDialog.confirmRevoke'),
    showCancelButton: true,
    cancelButtonClass: 'nocodeProcessDrawerElMessageBoxBtnClass',
    confirmButtonClass: 'nocodeProcessDrawerElMessageBoxBtnClass',
    cancelButtonText: i18next.t('NocodeProcessDialog.cancel'),
    confirmButtonText: i18next.t('NocodeProcessDialog.revoke'),
  }).then(async () => {
    try {
      await formFlowApi.cancelTodo({
        nocodeId: props.todo.nocodeId,
        tableId: props.todo.tableId,
        uuid: props.todo.uuid,
        todoId: props.todo.todoId,
        flowId: resolvedFlowId.value,
        id: props.todo.id,
      })
      emit("update:modelValue", false)
      emit("cancel");
    } catch (err) {
      ElMessage.error(err?.message || i18next.t('formFlowService.statusChangedRefreshTips'));
    }
  })
}

const finishFlow = async () => {
  const confirmed = await finishFlowTipDialogRef.value?.confirm();
  if (!confirmed) {
    return;
  }
  try {
    await formFlowApi.finishTodo({
      nocodeId: props.todo.nocodeId,
      tableId: props.todo.tableId,
      uuid: props.todo.uuid,
      todoId: props.todo.todoId,
      flowId: props.todo.flowId,
      id: props.todo.id,
    })
    emit("update:modelValue", false)
    emit("cancel");
  } catch (err) {
    ElMessage.error(err?.message || i18next.t('formFlowService.statusChangedRefreshTips'));
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
  const flow = getFlowById(props.todo?.flows || [], props.todo?.flowId || '');
  return !transferOnly.value
    && props.editable
    && props.todo?.status === ProcessNodeStatus.IN_PROGRESS
    && !!flow?.options?.allowFinishFlow;
})

const buttonData = computed(() => {
  if (props.category === TodoCategory.MY_INITIATED) {
    return [
      {
        name: i18next.t('NocodeProcessDialog.reInitiate'),
        icon: IWorkbenchNocodeTodoInitiateProcessIcon,
        visible: canReInitiate.value,
        click: () => {
          reInitiate();
        },
      },
      {
        name: i18next.t('NocodeProcessDialog.revoke'),
        icon: INocodeProcessFlowRevoke,
        visible: isShowCanceled.value,
        click: () => {
          cancelFlow();
        },
      },
    ].filter(item => item.visible)
  }
  return [
    {
      name: i18next.t('NocodeProcessDialog.transfer'),
      icon: INocodeProcessFlowForward,
      visible: isShowTransfer.value,
      click: () => {
        transfer();
      },
    },
    {
      name: i18next.t('NocodeProcessDialog.rollback'),
      icon: INocodeProcessFlowBack,
      visible: isShowBack.value,
      click: () => {
        back()
      }
    },
    {
      name: i18next.t('NocodeProcessDialog.comment'),
      icon: INocodeProcessFlowComment,
      visible: false,
      click: () => {},
    },
    {
      name: i18next.t('NocodeProcessDialog.revoke'),
      icon: INocodeProcessFlowRevoke,
      visible: isShowCanceled.value,
      click: () => {
        cancelFlow()
      },
    },
    {
      name: i18next.t('NocodeProcessDialog.finishFlow'),
      icon: IEpSwitchButton,
      visible: isShowFinishFlow.value,
      className: 'danger',
      click: () => {
        finishFlow()
      },
    },
    {
      name: i18next.t('NocodeProcessDialog.delete'),
      icon: INocodeFlowDeleteData, 
      visible: isShowDelete.value,
      click: () => {
        deleteFlow()
      }
    },
    {
      name: i18next.t('NocodeProcessDialog.more'),
      icon: IEpMoreFilled,
      visible: false,
      click: () => {},
    }
  ].filter(item => item.visible)
})

const buttonMenuData = computed(() => {
  return buttonData.value;
})

</script>
  
<style lang="scss" scoped>
.nocode-process-dialog {
  max-width: 100vw;
  :deep(.el-overlay-dialog) {
    overflow: hidden;
  }
  :deep(.nocode-process-container){
    width: 950px;
    height: 800px;
    max-height: 100%;
    border-radius: 8px;
    box-shadow: none;
    padding: 0px;
    background-color: var(--color-white);

    .el-dialog__header {
      height: 40px;
      padding: 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      --el-dialog-title-font-size: 14px;
      --el-text-color-primary: var(--el-text-color-regular);

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
      }
    }
      
    
    .el-dialog__body{
      height: calc(100% - 40px);
    }

    &.is-fullscreen {
      width: 100% !important;
      height: 100% !important;
      border-radius: 0;

      .el-dialog__header {
        border-radius: 0;
      }

      .container {
        border-radius: 0;
        .container-left, .container-right {
          border-radius: 0;
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

    .header-title {
      margin-right: auto;
      margin-left: 16px;
      display: flex;
      align-items: center;
      min-width: 0;
      gap: 12px;
    }

    .data-title {
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      color: var(--text-color-regular);
    }

    .title-divider {
      width: 1px;
      height: 13px;
      background-color: var(--border-color);
      flex-shrink: 0;
    }

    .form-link {
      border-radius: 4px;
    }

    .header-action {
      width: 28px;
      height: 28px;
      padding: 0;
      margin: 0 8px 0 8px;

      .el-icon {
        font-size: 14px;
      }

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }

  .container {
    position: relative;
    height: 100%;
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    display: flex;
    overflow: hidden;

    .process-toggle-button {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      top: 80px;
      right: 0;
      z-index: 2;
      border-radius: 8px 0 0 8px;
      background-color: #ffffff;
      box-shadow: 0px 2px 5px 0px #0000001A;

      .el-button {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        padding: 0;
      }
    }

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

          :deep(.el-scrollbar__view) {
            height: 100%;
          }

          .no-form-data {
            height: 100%;
            padding: 24px;
            color: var(--text-color-secondary);
            line-height: 22px;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
          }
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
          }
        }
      }
    }

    .container-right {
      flex: 0 0 30%;
      min-width: 0;
      min-height: 0;
      height: 100%;
      display: flex;
      overflow: hidden;
      border-bottom-right-radius: 8px;

      :deep(.data-form-side-panel) {
        width: 100%;
        height: 100%;
        flex: 1;
        min-width: 0;
        min-height: 0;
      }
    }

    &.is-process-folded {
      .container-left {
        width: 100%;
        border-bottom-right-radius: 8px;
      }
    }
  }
}
</style>
