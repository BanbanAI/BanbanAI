<template>
  <div class="nocode-select-transfer-user-dialog">
    <el-dialog 
      v-model="show"
      v-if="!isMobileDevice"
      :title="$t('NocodeSelectTransferUserDialog.selectTransferUser')"
      width="680px"
      align-center
      :close-on-click-modal="false"
      destroy-on-close
      @open="handleOpen"
    >
      <div class="body">
        <select-user-core
          v-if="hasAvailableUsers"
          :isAvailable="true"
          :multiple="false"
          :disabledUid="useDisabledUid"
          ref="selectUserCoreRef"
          :availableValue="availableTransferValue"
        />
        <div v-else class="empty-list">
          {{ $t('MobileSelectUserDrawer.noMatchResult') }}
        </div>
      </div>
      <template #footer>
        <el-button type="primary" class="confirm" :disabled="!hasAvailableUsers" @click="confirm">{{ $t('NocodeSelectTransferUserDialog.confirm') }}</el-button>
      </template>
    </el-dialog>

    <el-drawer 
      v-else
      size="60%"
      v-model="show"
      :with-header="false"
      direction="btt"
      close-on-click-modal
      destroy-on-close
      @open="handleOpen"
    >
      <mobile-select-user-drawer
        ref="mobileSelectUserDrawerRef"
        :multiple="false"
        :disabledUid="useDisabledUid"
        :users="availableUsers"
        @confirm="handleMobileConfirm"
        @cancel="handleMobileCancel"
      />
  </el-drawer>
  </div>
</template>

<script lang="ts" setup>
import { usePassportStore } from '@renderer/stores';
import { ref, computed, inject } from 'vue'
import { isMobile } from '@renderer/utils';
import { TODO } from '@common/types/nocode';
import { ORGANIZE_UTIL } from '@renderer/types';
import { formFlowApi } from '../utils';

const isMobileDevice = isMobile();

const props = withDefaults(defineProps<{
  modelValue?: boolean;
  disabledUid?: string[],
  todo?: TODO
}>(), {
  modelValue: null,
})

const selectUserCoreRef = ref(null);
const mobileSelectUserDrawerRef = ref(null);
const organizeUtil = inject(ORGANIZE_UTIL);
const emits = defineEmits<{
  (event: 'update:modelValue', value: boolean),
  (event: 'confirm', value: { state: boolean, transferOwner: string }),
  (event: 'cancel', value: boolean),
}>()
const passportState = usePassportStore();
const visible = ref(false)
const transferUserIds = ref<string[]>([])
const show = computed({
  get() {
    if (typeof props.modelValue === 'boolean') {
      return props.modelValue;
    }
    return visible.value;
  },
  set(value) {
    visible.value = value
    emits('update:modelValue', value);
    if (!value) {
      emits('cancel', false)
    }
  },
});
let _resolve: Function;

const useDisabledUid = computed<string[]>(() => {
  if(!Array.isArray(props.disabledUid)) return [passportState.account.id]

  return [
    ...props.disabledUid,
    passportState.account.id,
  ]
})
const availableUsers = computed(() => {
  return transferUserIds.value
    .map(userId => organizeUtil?.users?.find(user => user.id === userId))
    .filter(Boolean) || [];
})
const hasAvailableUsers = computed(() => {
  return availableUsers.value.length > 0;
})
const availableTransferValue = computed(() => {
  return {
    users: availableUsers.value,
    departments: [],
    roles: [],
    dynamic: [],
  }
})
const handleOpen = async () => {
  transferUserIds.value = [];
  if (props.todo) {
    await organizeUtil?.getUsers?.();
    const userIds = await formFlowApi.getTransferTodoUsers({
      nocodeId: props.todo.nocodeId,
      tableId: props.todo.tableId,
      uuid: props.todo.uuid,
      flowId: props.todo.flowId,
      todoId: props.todo.todoId,
      id: props.todo.id,
    });
    transferUserIds.value = Array.isArray(userIds) ? userIds : [];
  }
  if (isMobileDevice) {
    mobileSelectUserDrawerRef.value?.reset();
  } else {
    selectUserCoreRef.value?.reset();
  }
}
const confirm = () => {
  const transferOwner = selectUserCoreRef.value?.serialize?.()?.[0]
  const confirmObj = {
    state: !!transferOwner,
    transferOwner,
  }
  if (_resolve) {
    _resolve(confirmObj)
    _resolve = null
  }
  emits('confirm', confirmObj)
  show.value = false
}

const handleMobileConfirm = (selectedUsers) => {
  const transferOwner = selectedUsers.length > 0 ? selectedUsers[0].id : undefined;
  const confirmObj = { state: !!transferOwner, transferOwner };
  if (_resolve) {
    _resolve(confirmObj);
    _resolve = null;
  }
  emits('confirm', confirmObj);
  show.value = false;
};

const handleMobileCancel = () => {
  if (_resolve) {
    _resolve({ state: false, transferOwner: undefined });
    _resolve = null;
  }
  show.value = false;
}

defineExpose({
  confirm: async () => {
    return new Promise((resolve) => {
      show.value = true;
      _resolve = resolve;
    });
  }
})
</script>

<style lang="scss" scoped>
.nocode-select-transfer-user-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    background-color: #fff;
    box-shadow: unset;
    --el-dialog-padding-primary: 0px;

    .el-dialog__header {
      height: 40px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      padding: 16px 32px;
      color: rgba(20, 20, 20, 1);
      display: flex;
      align-items: center;
      justify-content: center;

      span {
        font-size: 14px;
      }

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
        color: rgba(30, 30, 30, 0.8);
      }
    }

    .el-dialog__body {
      padding: 16px;

      .body {
        padding: 8px 0;
        height: 352px;

        .empty-list {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-color-placeholder);
        }
      }
    }

    .el-dialog__footer {
      padding: 16px;
      border-top: 1px solid var(--border-color);

      .el-button { 
        height: 32px;
        width: 64px;
        border-radius: 4px;
      }
    }
  }
}
</style>
