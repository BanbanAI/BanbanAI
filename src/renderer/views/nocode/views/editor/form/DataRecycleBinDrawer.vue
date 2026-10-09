<template>
  <div class="data-recycle-bin-drawer">
    <el-drawer
      :class="{ 'is-fullscreen': isFullscreen }"
      :model-value="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      direction="btt"
      :size="drawerSize"
      :with-header="false"
      :close-on-click-modal="false"
    >
      <div class="drawer-content">
        <div class="drawer-header">
          <div class="drawer-title">{{ $t('RecycleBinTableHeader.title') }}</div>
          <div class="drawer-actions">
            <el-button v-if="isFullscreen" link class="header-icon-btn" @click="toggleFullscreen">
              <el-icon :size="16"><i-ven-global-shrink-screen /></el-icon>
            </el-button>
            <el-button v-else link class="header-icon-btn" @click="toggleFullscreen">
              <el-icon :size="16"><i-ven-global-full-screen /></el-icon>
            </el-button>
            <el-button link class="close-btn" @click="emit('update:modelValue', false)">
              <el-icon :size="16"><i-ep-close /></el-icon>
            </el-button>
          </div>
        </div>
  
        <div class="drawer-body">
          <NocodeDataManagementTable
            v-if="modelValue"
            class="recycle-bin-table"
            :nocodeId="props.nocodeId"
            :tableUID="props.tableUID"
            :uid="recycleTableUid"
            :tableViewMeta="recycleTableViewMeta"
            :isAddDataAble="false"
            :isImportDataAble="false"
            :isExportDataAble="false"
            :isDeleteDataAble="false"
            :isShowMoreMenu="false"
            :isEditDataAble="false"
            :searchable="false"
            :filterable="true"
            :sortable="false"
            :hideColumnsAble="true"
            :changeRowHeightAble="false"
            :isShowFooter="true"
            :isShowAggregateRow="false"
            :isShowCheck="true"
            :isMultiple="true"
            :clickRowShowDetail="false"
            :isTableCellEditable="false"
            :headerVariant="'recycle'"
            :queryStage="FormDataStage.DELETED"
            :fullscreen="isFullscreen"
            ref="recycleTableRef"
            @toggleFullscreen="toggleFullscreen"
            @recycleChanged="handleRecycleChanged"
          />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, ref, watch } from 'vue';
import { FormDataStage, SystemField } from '@common/utils';
import { FormTableViewMeta } from '@common/types/nocode';
import { TableUID } from '@common/types/project';
import { NOCODE } from '@renderer/types';
import NocodeDataManagementTable from '../../../components/global/table/NocodeDataManagementTable.vue';

const props = defineProps<{
  modelValue: boolean,
  nocodeId: string,
  tableUID: TableUID,
  uid?: string,
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'changed'): void;
}>();

const nocode = inject(NOCODE, null);
const isFullscreen = ref(false);
const recycleTableRef = ref();

const recycleTableUid = computed(() => {
  return props.uid ? `${props.uid}-recycle-bin` : `${props.tableUID}-recycle-bin`;
});

const recycleTableViewMeta = computed<FormTableViewMeta>(() => {
  const fields = nocode?.value?.body?.formData?.tables?.find((item) => item.uid === props.tableUID)?.fields || [];
  const createOwnerField = fields.find((field) => field.meta?.name === SystemField.CREATE_OWNER);
  const createTimeField = fields.find((field) => field.meta?.name === SystemField.CREATE_TIME);
  const updateOwnerField = fields.find((field) => field.meta?.name === SystemField.UPDATE_OWNER);
  const updateTimeField = fields.find((field) => field.meta?.name === SystemField.UPDATE_TIME);

  return {
    columnOrders: {
      __root__: {
        ...(createOwnerField?.uid ? { [createOwnerField.uid]: 900 } : {}),
        ...(createTimeField?.uid ? { [createTimeField.uid]: 901 } : {}),
        ...(updateOwnerField?.uid ? { [updateOwnerField.uid]: 902 } : {}),
        ...(updateTimeField?.uid ? { [updateTimeField.uid]: 903 } : {}),
      },
    },
  };
});

const drawerSize = computed(() => {
  return isFullscreen.value ? '100%' : '88%';
});

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};

watch(() => props.modelValue, async (value) => {
  if (!value) {
    return;
  }
  await nextTick();
  recycleTableRef.value?.refreshData?.();
});

const handleRecycleChanged = () => {
  recycleTableRef.value?.refreshData?.();
  emit('changed');
};
</script>

<style lang="scss" scoped>
.data-recycle-bin-drawer {
  :deep(.el-drawer) {
    background-color: #fff;
    border-radius: 8px 8px 0 0;

    .el-drawer__body {
      border-radius: 8px 8px 0 0;
      padding: 0;
    }

    .drawer-content {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #e6eaf2;
      box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.08);
    }
  
    .drawer-header {
      height: 40px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--border-color);
      position: relative;
      background-color: #fff;
  
      .drawer-title {
        font-size: 16px;
        font-weight: 500;
        line-height: 1;
      }
  
      .drawer-actions {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        gap: 4px;
      }
  
      .header-icon-btn,
      .close-btn {
        width: 28px;
        height: 28px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--text-color-secondary);
        cursor: pointer;
        margin: 0;
  
        &:hover {
          background-color: var(--bg-color-overlay);
        }
      }
  
      .header-icon-btn {
        img {
          width: 14px;
          height: 14px;
        }
      }
    }
  
    .drawer-body {
      flex: 1;
      min-height: 0;
      padding: 12px 64px;
      background-color: #fff;
    }
  
    :deep(.recycle-bin-table) {
      height: 100%;
      gap: 0;
  
      .b2table {
        row-gap: 0;
        background-color: #fff;
        border: 1px solid #e6eaf2;
        border-radius: 8px;
        overflow: hidden;
      }
  
      .table-header {
        height: auto;
        padding: 12px 12px 10px;
        border-bottom: 1px solid #eef1f5;
        box-sizing: border-box;
      }
  
      .b2table-pagination-wrap {
        height: 52px;
        padding: 0 16px;
        border-top: 1px solid #eef1f5;
        box-sizing: border-box;
      }
  
    }
  
    &.is-fullscreen {
      .drawer-content {
        border-radius: 0;
        border: 0;
        box-shadow: none;
      }
    }
  }
}
</style>
