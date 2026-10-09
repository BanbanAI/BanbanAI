<template>
  <div class="workbench-add-admin-dialog">
    <el-dialog 
      v-model="dialogVisible" 
      :close-on-click-modal="false" 
      :title="dialogTitle || title" 
      :close-on-press-escape="false"
      align-center
      destroy-on-close 
      @closed="onClosed"
    >
      <div class="dialog-body">
        <select-user-core 
          :isAvailable="isAvailable"
          :availableValue="availableValue"
          :isOnlyAdd="isOnlyAdd"
          ref="selectUserCoreRef"
          :multiple="multiple"
          :type="currentType"
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
        <span class="dialog-footer">
          <el-button @click="handleCancel">{{ $t("PcOrganizeManagerDialog.cancel") }}</el-button>
          <el-button type="primary" @click="handleConfirm">{{ $t("PcOrganizeManagerDialog.confirm") }}</el-button>
        </span>
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

const type = ref<'add' | 'edit'>('add');
const dialogVisible = ref(false);
const title = computed(() => type.value === 'add' ? i18next.t("PcOrganizeManagerDialog.addAdmin") : i18next.t("PcOrganizeManagerDialog.editAdmin"));
const selectUserCoreRef = ref();
const firstOpen = ref(true)

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
  isInWidget: false,
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

const onClosed = () => {
  selectUserCoreRef.value?.reset();
  emit('update:modelValue', false);
}

const getTableList = computed(() => {
  const result = props.tableList
  return result
})


const handleConfirm = () => {
  dialogVisible.value = false;
  const selectedData = selectUserCoreRef.value?.getTabList();
  emit('confirm', selectedData);
  emit('update', selectedData);
  firstOpen.value = false
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
})

</script>

<style scoped lang='scss'>
.workbench-add-admin-dialog {
  :deep(.el-dialog) {
    width: 676px;
    background-color: var(--bg-color-page);
    border-radius: 4px;
    padding: 0;

    .el-dialog__header {
      text-align: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);


      &>span {
        font-size: 14px;
      }

      &>.el-dialog__headerbtn {
        width: 40px;
        height: 40px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
    }

    .el-dialog__body {
      padding: 16px;

      .dialog-body {
        height: 352px;
        padding: 8px 0;
      }
    }

    .el-dialog__footer {
      padding: 16px;
      border-top: 1px solid var(--border-color);


      .el-button {
        width: 60px;
        height: 32px;
        border-radius: 4px;
      }
    }
  }
}
</style>
