<template>
  <div class="mobile-organize-manager-dialog">
    <el-dialog 
      v-model="dialogVisible" 
      :fullscreen="true"
      :show-close="false"
      custom-class="mobile-dialog-fullscreen"
      :close-on-click-modal="false" 
      :close-on-press-escape="false"
      destroy-on-close 
      @closed="onClosed"
    >
      <template #header>
        <div class="title" @click="handleCancel">
          <el-icon class="back-button"><i-ep-arrow-left /></el-icon>
          <span>{{ title }}</span>
        </div>
      </template>
      
      <div class="dialog-body">
        <mobile-select-user-core 
          :isAvailable="isAvailable"
          :availableValue="availableValue"
          :isOnlyAdd="isOnlyAdd"
          ref="selectUserCoreRef"
          :multiple="multiple"
          :currentType="currentType"
          :tableList="getTableList"
          :isSetting="isSetting"
          :isSetDefault="isSetDefault"
          :isInWidget="isInWidget"
          :isInOption="isInOption"
          :isShowQuick="isShowQuick"
          :hideRoleTab="hideRoleTab"
          :hideDepartmentTab="hideDepartmentTab"
          :quickOptions="quickOptions"
        />
      </div>
      
      <template #footer>
        <div class="mobile-dialog-footer">
          <el-button type="primary" class="footer-btn confirm" @click="handleConfirm">{{ $t("MobileOrganizeManagerDialog.confirm") }}</el-button>
          <el-button class="footer-btn" @click="handleCancel">{{ $t("MobileOrganizeManagerDialog.cancel") }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import { NocodeUser, Department, Role } from '@common/types/account';
import i18next from 'i18next';

const emit = defineEmits<{
  (e: 'confirm', userIds: string[]): void;
  (e: 'update', userIds: string[]): void;
  (e: 'update:modelValue', value: boolean);
}>();

const props = withDefaults(defineProps<{
  modelValue?: boolean,
  isInWidget?: boolean;
  multiple?: boolean;
  currentType?: "department" | "member";
  dialogTitle?: string;
  tableList?: {
    departments: Department[];
    roles: Role[];
    users: NocodeUser[];
    dynamic: string[];
  };
  isOnlyAdd?: boolean;
  availableValue?: {
    departments: Department[];
    roles: Role[];
    users: NocodeUser[];
    dynamic: string[];
  };
  isAvailable?: boolean;
  isSetting?: boolean;
  isSetDefault?: boolean;
  defaultValue?: {
    departments: Department[];
    roles: Role[];
    users: NocodeUser[];
    dynamic: string[];
  };
  isInOption?: boolean;
  isShowQuick?: boolean;
  hideRoleTab?: boolean;
  hideDepartmentTab?: boolean;
  quickOptions?: Array<{ label: string, value: string }>;
}>(), {
  isInWidget: true,
  multiple: true,
  currentType: 'member',
  isOnlyAdd: false,
  isAvailable: false,
  isSetting: false,
  isSetDefault: false,
  isInOption: false,
  isShowQuick: true,
  hideRoleTab: false,
  hideDepartmentTab: false,
  quickOptions: () => []
});

const dialogVisible = ref(false);
const selectUserCoreRef = ref();
const title = computed(() => {
  if (props.currentType === 'member') {
    return i18next.t("MobileOrganizeManagerDialog.member");
  } else if (props.currentType === 'department') {
    return i18next.t("MobileOrganizeManagerDialog.department");
  }
});

const onClosed = () => {
  selectUserCoreRef.value?.reset();
  emit('update:modelValue', false);
}

const getTableList = computed(() => {
  return props.tableList;
});

const handleConfirm = () => {
  const selectedData = selectUserCoreRef.value?.getTabList();
  emit('confirm', selectedData);
  emit('update', selectedData);
  dialogVisible.value = false;
}

const handleCancel = () => {
  dialogVisible.value = false;
}

const show = () => {
  dialogVisible.value = true;
}

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      show();
    }
  }
);

defineExpose({
  show
});
</script>

<style scoped lang='scss'>
.mobile-organize-manager-dialog {
  margin: 0;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  background-color: #f7f8fa;

  // 隐藏滚动条
  :deep(.el-overlay) {
    .el-overlay-dialog {
      overflow-y: auto;
      overflow: hidden;
      &::-webkit-scrollbar {
        display: none;
      }
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
  }
  
  :deep(.el-dialog) {
    height: 100%;
    padding: 16px;
    padding-top: 24px;

    .el-dialog__header {
      padding-bottom: 0;
      .title {
        height: 44px;
        display: flex;
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
          letter-spacing: 0px;
        }
      }
    }

    .el-dialog__body {
      height: calc(100% - 44px);
      .dialog-body {
        height: 100%;
      }
    }

    .el-dialog__footer {
      width: 100%;
      padding: 16px;
      position: fixed;
      bottom: 0;
      left: 0;
      z-index: 100;
      background-color: #F5F6F7;

      .mobile-dialog-footer {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        
        .footer-btn {
          width: 100%;
          height: 40px;
          margin: 0;
          border-radius: 4px;
          font-size: 16px;
          background-color: #fff;
          color: #090A0A;
          border: 1px solid #D6D6D6;
          
          &.confirm {
            background-color: #0873FF;
            color: #fff;
            border: none;
          }
          &.cancel {
            margin-top: 8px;
          }
        }
        
      }
    }
  }
}
</style>
