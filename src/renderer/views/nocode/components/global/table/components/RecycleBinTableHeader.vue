<template>
  <div class="recycle-bin-table-header">
    <div class="button-wrapper">
      <template v-if="selectedRows.length">
        <el-button @click="prepareSelectedAction('restore')" plain>
          <el-icon :size="14"><RefreshLeft /></el-icon>
          {{ $t('RecycleBinTableHeader.restore') }}
        </el-button>
        <el-button type="danger" @click="prepareSelectedAction('purge')" plain>
          <el-icon :size="14"><Delete /></el-icon>
          {{ $t('RecycleBinTableHeader.purge') }}
        </el-button>
      </template>
      <template v-else>
        <el-dropdown trigger="click" @command="handleRestoreCommand">
          <el-button text>
            <el-icon :size="14"><RefreshLeft /></el-icon>
            {{ $t('RecycleBinTableHeader.restore') }}
            <el-icon :size="14"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="filtered">{{ $t('RecycleBinTableHeader.filteredData') }}</el-dropdown-item>
              <el-dropdown-item command="all">{{ $t('RecycleBinTableHeader.allData') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-dropdown trigger="click" @command="handlePurgeCommand">
          <el-button text type="danger">
            <el-icon :size="14"><Delete /></el-icon>
            {{ $t('RecycleBinTableHeader.purge') }}
            <el-icon :size="14"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="filtered">{{ $t('RecycleBinTableHeader.filteredData') }}</el-dropdown-item>
              <el-dropdown-item command="all">{{ $t('RecycleBinTableHeader.allData') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </div>

    <div class="filter-wrapper">
      <table-display-fields :allowReorder="false" />
      <table-filter :labelKey="'RecycleBinTableHeader.filterConditions'" />
    </div>
  </div>

  <teleport to="body">
    <table-restore-data-dialog
      v-model="restoreDialogVisible"
      :title="confirmTitle"
      :dataText="confirmDataText"
      :restoreTip="confirmTip"
      :restoreWarningText="confirmWarningText"
      :confirmText="confirmButtonText"
      @confirm="handleConfirm"
    />
    <table-delete-data-dialog
      v-model="purgeDialogVisible"
      :title="confirmTitle"
      :dataText="confirmDataText"
      :deleteTip="confirmTip"
      :deleteWarningText="confirmWarningText"
      :confirmText="confirmButtonText"
      :confirmType="confirmButtonType"
      @confirm="handleConfirm"
    />
  </teleport>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { ArrowDown, Delete, RefreshLeft } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { useTable } from '../hooks';

type ActionType = 'restore' | 'purge';
type ActionScope = 'selected' | 'filtered' | 'all';

const emit = defineEmits<{
  (event: 'recycleChanged'): void;
}>();

const widget = useTable();
const restoreDialogVisible = ref(false);
const purgeDialogVisible = ref(false);
const pendingAction = ref<ActionType>('restore');
const pendingRows = ref<any[]>([]);

const dedupeRows = (rows: any[] = []) => {
  const rowKey = widget.rowKey;
  if (!rowKey) {
    return Array.isArray(rows) ? [...rows] : [];
  }
  const rowMap = new Map<string, any>();
  for (const row of rows || []) {
    const rowId = row?.[rowKey];
    if (!rowId || rowMap.has(rowId)) continue;
    rowMap.set(rowId, row);
  }
  return Array.from(rowMap.values());
};

const selectedRows = computed(() => {
  return dedupeRows(widget.checkboxRow || []);
});

const confirmTitle = computed(() => {
  return pendingAction.value === 'restore'
    ? i18next.t('RecycleBinTableHeader.confirmRestoreTitle')
    : i18next.t('RecycleBinTableHeader.confirmPurgeTitle');
});

const confirmTip = computed(() => {
  return pendingAction.value === 'restore'
    ? i18next.t('RecycleBinTableHeader.confirmRestoreTip')
    : i18next.t('RecycleBinTableHeader.confirmPurgeTip');
});

const confirmWarningText = computed(() => {
  return pendingAction.value === 'restore'
    ? i18next.t('RecycleBinTableHeader.confirmRestoreWarning')
    : i18next.t('RecycleBinTableHeader.confirmPurgeWarning');
});

const confirmButtonText = computed(() => {
  return pendingAction.value === 'restore'
    ? i18next.t('RecycleBinTableHeader.confirmRestore')
    : i18next.t('RecycleBinTableHeader.confirmPurge');
});

const confirmButtonType = computed(() => {
  return pendingAction.value === 'restore' ? 'primary' : 'danger';
});

const confirmDataText = computed(() => {
  return `${pendingRows.value.length}${i18next.t('RecycleBinTableHeader.dataCount')}`;
});

const loadRowsByScope = async (scope: ActionScope) => {
  if (scope === 'selected') {
    return selectedRows.value;
  }
  if (scope === 'filtered') {
    const bucket = await widget.queryBucket({
      filters: await widget.getTableFilter(),
    });
    return dedupeRows(bucket?.rows || []);
  }
  const bucket = await widget.queryBucket();
  return dedupeRows(bucket?.rows || []);
};

const prepareAction = async (action: ActionType, scope: ActionScope) => {
  const rows = await loadRowsByScope(scope);
  if (!rows.length) {
    ElMessage.warning(i18next.t('RecycleBinTableHeader.noData'));
    return;
  }
  pendingAction.value = action;
  pendingRows.value = rows;
  if (action === 'restore') {
    restoreDialogVisible.value = true;
  } else {
    purgeDialogVisible.value = true;
  }
};

const prepareSelectedAction = async (action: ActionType) => {
  await prepareAction(action, 'selected');
};

const handleRestoreCommand = async (scope: ActionScope) => {
  await prepareAction('restore', scope);
};

const handlePurgeCommand = async (scope: ActionScope) => {
  await prepareAction('purge', scope);
};

const handleConfirm = async () => {
  try {
    if (pendingAction.value === 'restore') {
      await widget.restoreRows(pendingRows.value);
      ElMessage.success(i18next.t('RecycleBinTableHeader.restoreSuccess'));
    } else {
      await widget.purgeRows(pendingRows.value);
      ElMessage.success(i18next.t('RecycleBinTableHeader.purgeSuccess'));
    }
    emit('recycleChanged');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    pendingRows.value = [];
  }
};
</script>

<style lang="scss" scoped>
.recycle-bin-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 32px;

  .button-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;

    .el-button {
      height: 32px;
      border-radius: 4px;
      margin: 0;
      padding: 6px 16px;

      .el-icon {
        margin-right: 4px;
      }
    }

    :deep(.el-dropdown) {
      .el-button {
        padding: 6px 8px;
      }

      .el-button .el-icon:last-child {
        margin-right: 0;
        margin-left: 4px;
      }
    }
  }

  .filter-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
