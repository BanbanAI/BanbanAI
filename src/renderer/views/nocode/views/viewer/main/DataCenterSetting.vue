<template>
  <div class="data-center-setting">
    <div class="data-center-shell">
      <div class="aggregate-panel">
        <div class="aggregate-toolbar">
          <div class="aggregate-tip">
            <el-icon size="16" class="aggregate-tip__icon"><i-ep-warning /></el-icon>
            <div class="aggregate-tip__text">{{ TEXT.listTip }}</div>
            <!-- <el-link type="primary">{{ TEXT.viewTutorial }}</el-link> -->
          </div>

          <el-button type="primary" class="aggregate-toolbar__button" @click="handleCreateAggregateTable">
            <el-icon><i-ep-plus /></el-icon>
            {{ TEXT.createAggregateTable }}
          </el-button>
        </div>

        <div class="aggregate-content">
          <div v-if="aggregateTableList.length" class="aggregate-table-board">
            <div class="aggregate-table-row aggregate-table-row--header">
              <div class="aggregate-table-cell">{{ TEXT.nameColumn }}</div>
              <div class="aggregate-table-cell">{{ TEXT.sourceColumn }}</div>
              <div class="aggregate-table-cell">{{ TEXT.statusColumn }}</div>
              <div class="aggregate-table-cell">{{ TEXT.createdAtColumn }}</div>
              <div class="aggregate-table-cell aggregate-table-cell--actions">{{ TEXT.actionColumn }}</div>
            </div>

            <div v-for="item in aggregateTableList" :key="item.uid" class="aggregate-table-row">
              <div class="aggregate-table-cell">
                <div class="aggregate-table-cell__title">{{ item.name }}</div>
              </div>
              <div class="aggregate-table-cell">
                <div class="aggregate-table-cell__text">{{ item.sourceText }}</div>
              </div>
              <div class="aggregate-table-cell">
                <span class="aggregate-status" :class="item.statusClass">{{ item.statusText }}</span>
              </div>
              <div class="aggregate-table-cell">
                <div class="aggregate-table-cell__text">{{ item.createdAt }}</div>
              </div>
              <div class="aggregate-table-cell aggregate-table-cell--actions">
                <div class="aggregate-action-group">
                  <button type="button" class="aggregate-link-btn" @click="handleOpenAggregateTable(item.uid)">
                    {{ TEXT.viewAction }}
                  </button>
                  <el-dropdown
                    trigger="click"
                    placement="bottom-end"
                    :teleported="false"
                    popper-class="aggregate-more-dropdown"
                    @command="command => handleAggregateTableCommand(command, item.raw)"
                  >
                    <button type="button" class="aggregate-link-btn">{{ TEXT.moreAction }}</button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="edit">{{ TEXT.editAction }}</el-dropdown-item>
                        <el-dropdown-item command="copy">{{ TEXT.copyAction }}</el-dropdown-item>
                        <el-dropdown-item command="delete">{{ TEXT.deleteAction }}</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="aggregate-empty">
            <nocode-empty-state />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AGGREGATE_TABLE_TEXT as TEXT, useAggregateTableSettingContext } from './aggregateTableSettingContext';
import NocodeEmptyState from '@renderer/views/nocode/components/global/NocodeEmptyState.vue';

const emit = defineEmits<{ (event: 'open-editor'): void }>();

const aggregateTableSettingContext = useAggregateTableSettingContext();
const aggregateTableList = aggregateTableSettingContext.aggregateTableList;

const handleOpenAggregateTable = (uid: string) => {
  aggregateTableSettingContext.openAggregateTable(uid);
  emit('open-editor');
};

const handleCreateAggregateTable = () => {
  aggregateTableSettingContext.handleAddAggregateTable();
  emit('open-editor');
};

const handleAggregateTableCommand = (command: string, table: any) => {
  if (command === 'edit') {
    handleOpenAggregateTable(table.uid);
    return;
  }
  if (command === 'copy') {
    aggregateTableSettingContext.handleDuplicateAggregateTable(table);
    emit('open-editor');
    return;
  }
  if (command === 'delete') aggregateTableSettingContext.handleRemoveAggregateTable(table.uid);
};

const savePermissions = async () => {
  await aggregateTableSettingContext.handleSave();
};

defineExpose({
  savePermissions,
});
</script>

<style scoped lang="scss">
.data-center-setting {
  width: 100%;
  height: 100%;
}

.data-center-shell {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.aggregate-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.aggregate-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 36px;
  margin-bottom: 12px;
}

.aggregate-tip {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #909399;
  font-size: 14px;
  line-height: 20px;
}

.aggregate-tip__icon {
  flex-shrink: 0;
  color: #909399;
}

.aggregate-tip__text {
  min-width: 0;
}

.aggregate-tip__link {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: #409eff;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}

.aggregate-toolbar__button {
  height: 36px;
  padding: 0 16px;
  border-radius: 4px;

  .el-icon {
    margin-right: 8px;
  }
}

.aggregate-content {
  flex: 1;
  min-height: 0;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
}

.aggregate-table-board {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.aggregate-table-row {
  display: grid;
  grid-template-columns: 1.3fr 1.35fr 0.78fr 0.92fr 132px;
}

.aggregate-table-row--header {
  background: #f7f8fa;
}

.aggregate-table-cell {
  min-width: 0;
  min-height: 38px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  border-right: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
  color: #606266;
  font-size: 13px;
  line-height: 20px;
}

.aggregate-table-row .aggregate-table-cell:last-child {
  border-right: none;
}

.aggregate-table-row--header .aggregate-table-cell {
  min-height: 30px;
  color: #606266;
  font-weight: 500;
  background: #f7f8fa;
}

.aggregate-table-cell__title {
  color: #303133;
  font-weight: 500;
}

.aggregate-table-cell__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aggregate-table-cell--actions {
  justify-content: center;
}

.aggregate-action-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.aggregate-link-btn {
  padding: 0;
  border: none;
  background: transparent;
  color: #409eff;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}

.aggregate-status {
  font-size: 13px;
  line-height: 20px;
}

.aggregate-status--normal {
  color: #409eff;
}

.aggregate-status--warning {
  color: #e6a23c;
}

.aggregate-empty {
  width: 100%;
  height: 100%;
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.aggregate-more-dropdown.el-popper) {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}

:deep(.aggregate-more-dropdown .el-dropdown-menu) {
  padding: 6px 0;
}

:deep(.aggregate-more-dropdown .el-dropdown-menu__item) {
  min-width: 96px;
  height: 32px;
  line-height: 32px;
  font-size: 13px;
  color: #303133;
}

@media (max-width: 1360px) {
  .aggregate-toolbar {
    height: auto;
    align-items: flex-start;
    flex-direction: column;
  }

  .aggregate-tip {
    flex-wrap: wrap;
  }
}
</style>
