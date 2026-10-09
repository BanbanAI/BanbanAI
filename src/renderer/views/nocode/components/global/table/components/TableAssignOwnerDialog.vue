<template>
  <div class="table-assign-owner-dialog">
    <el-dialog
      :model-value="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      :title="$t('TableAssignOwnerDialog.title')"
      :width="400"
      align-center
      destroy-on-close
      :close-on-click-modal="false"
    >
      <!-- <div class="assign-owner-dialog__count">
        {{ $t('TableAssignOwnerDialog.selectedRows') }}
        <span>{{ targetRows.length }}</span>
        {{ $t('TableAssignOwnerDialog.dataRows') }}
      </div> -->
      <div class="assign-owner-dialog__desc">
        <el-icon :size="14">
          <i-ep-warning />
        </el-icon>
        {{ $t('TableAssignOwnerDialog.description') }}
      </div>
      <el-select
        v-model="selectedOwnerId"
        class="assign-owner-dialog__select"
        clearable
        :loading="loadingUsers"
        :placeholder="$t('TableAssignOwnerDialog.selectOwner')"
        :no-data-text="$t('TableAssignOwnerDialog.noData')"
        popper-class="table-assign-owner-select-popper"
        @visible-change="handleSelectVisibleChange"
      >
        <template #header>
          <el-input v-model="searchValue" clearable :placeholder="$t('FieldSelect.search')">
            <template #prefix>
              <el-icon :size="16">
                <i-ep-search></i-ep-search>
              </el-icon>
            </template>
          </el-input>
        </template>
        <el-option
          v-for="user in filteredOwnerOptions"
          :key="user.id"
          :label="getOwnerLabel(user)"
          :value="user.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="emit('update:modelValue', false)">{{ $t('TableAssignOwnerDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t('TableAssignOwnerDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import type { Account } from '@common/types/account';
import type { Row } from '@common/types/project';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { useTable } from '../hooks';
import { ORGANIZE_UTIL } from '@renderer/types';
import { SystemField } from '@common/utils';
import { isDataOwnerEnabledTable } from '@common/utils/connection';

const props = defineProps<{
  modelValue: boolean,
  rows?: Row[],
  initialOwnerId?: string,
  onSubmit?: (rows: Row[], ownerId: string) => Promise<void> | void,
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
}>()

const table = useTable();
const organizeUtil = inject(ORGANIZE_UTIL);
const selectedOwnerId = ref<string | undefined>();
const searchValue = ref('');
const loadingUsers = ref(false);

const checkRows = computed(() => table?.checkboxRow || []);
const targetRows = computed(() => props.rows?.length ? props.rows : checkRows.value);
const dataOwnerField = computed(() => {
  if (!table?.table || !isDataOwnerEnabledTable(table.table)) {
    return null;
  }
  return table.table.fields?.find(field => field.meta?.name === SystemField.DATA_OWNER) || {
    uid: SystemField.DATA_OWNER,
  };
})
const ownerOptions = computed(() => {
  return (organizeUtil?.users || []).filter(user => user?.id && (user.realname || user.user));
});
const filteredOwnerOptions = computed(() => {
  const keyword = searchValue.value;
  if (!keyword) {
    return ownerOptions.value;
  }
  return ownerOptions.value.filter((user) => getOwnerLabel(user).includes(keyword));
});
const getOwnerLabel = (user: Account) => user?.realname || user?.user || '';

watch(() => props.modelValue, (value) => {
  if (value) {
    selectedOwnerId.value = props.initialOwnerId || undefined;
    searchValue.value = '';
    loadingUsers.value = true;
    organizeUtil?.getUsers?.()
      .catch(() => undefined)
      .finally(() => {
        loadingUsers.value = false;
      });
    return;
  }
  if (!value) {
    selectedOwnerId.value = undefined;
    searchValue.value = '';
  }
}, {
  immediate: true,
})

const handleSelectVisibleChange = (visible: boolean) => {
  if (!visible) {
    searchValue.value = '';
  }
}

const handleConfirm = async () => {
  if (!selectedOwnerId.value) {
    ElMessage.warning(i18next.t('TableAssignOwnerDialog.selectOwnerRequired'));
    return;
  }
  if (!table?.rowKey) {
    ElMessage.error(i18next.t('TableAssignOwnerDialog.fieldMissing'));
    return;
  }
  if (!dataOwnerField.value?.uid) {
    ElMessage.error(i18next.t('TableAssignOwnerDialog.fieldMissing'));
    return;
  }
  const rows = [...new Set(targetRows.value.map(row => row[table.rowKey]))]
    .map(key => ({
      [table.rowKey]: key,
      [dataOwnerField.value.uid]: selectedOwnerId.value,
      [SystemField.DATA_OWNER]: selectedOwnerId.value,
    }));
  if (!rows.length) {
    ElMessage.warning(i18next.t('TableAssignOwnerDialog.selectRowRequired'));
    return;
  }
  try {
    if (props.onSubmit) {
      await props.onSubmit(rows, selectedOwnerId.value);
    } else {
      await table.updateRows(rows);
      table.refreshData();
    }
    emit('update:modelValue', false);
    selectedOwnerId.value = undefined;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error));
  }
}
</script>

<style scoped lang="scss">
.table-assign-owner-dialog {
 :deep(.el-dialog) {
    padding: 0;
    background-color: #fff;
    border-radius: 8px;

    .el-dialog__header {
      padding: 0;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--border-color);

      .el-dialog__title {
        font-size: 16px;
        line-height: 24px;
      }
    }

    .el-dialog__body {
      padding: 24px 20px;
    }

    .el-dialog__footer {
      height: 64px;
      padding: 5px 16px;
      display: flex;
      align-items: center;
      justify-content: flex-end;

      .el-button {
        height: 32px;
        border-radius: 4px;
      }
    }
 }
}

.assign-owner-dialog__count {
  margin-bottom: 8px;
  color: var(--text-color-regular);
  font-size: 14px;
  line-height: 22px;

  span {
    margin: 0 4px;
    color: var(--color-primary);
    font-weight: 600;
  }
}

.assign-owner-dialog__desc {
  margin-bottom: 12px;
  padding: 9px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #FF9F00;
  font-size: 14px;
  line-height: 22px;
  background: #FFF7E8;
  border-radius: 4px;
}

.assign-owner-dialog__select {
  width: 100%;
  :deep(.el-select__wrapper) {
    height: 36px;
    background-color: #F2F3F5;
    border-radius: 4px;
  }
}
</style>
<style lang="scss">
.table-assign-owner-select-popper {
  --el-bg-color-overlay: #fff;
  border-radius: 8px;
  padding: 8px 0;

  .el-popper__arrow {
    display: none;
  }

  .el-select-dropdown {
    background-color: #fff;
    border-radius: 8px;
  }

  .el-scrollbar,
  .el-scrollbar__wrap,
  .el-select-dropdown__list {
    background-color: #fff;
  }

  .el-select-dropdown__header {
    padding: 0 8px 8px;

    .el-input {
      .el-input__wrapper {
        min-height: 36px;
        background-color: #F2F3F5;
        border-radius: 4px;
        box-shadow: none;
      }
    }
  }
}
</style>
