<template>
  <div class="process-version-manager-dialog">
    <el-dialog
      :model-value="modelValue"
      :width="680"
      align-center
      :close-on-click-modal="false"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template #header>
        <div class="dialog-title">{{ $t('ProcessVersionManagerDialog.title') }}</div>
      </template>

      <div class="version-table">
        <div class="version-table__header">
          <div class="version-table__col is-name">{{ $t('ProcessVersionManagerDialog.versionColumn') }}</div>
          <div class="version-table__col is-status">{{ $t('ProcessVersionManagerDialog.statusColumn') }}</div>
          <div class="version-table__col is-actions">{{ $t('ProcessVersionManagerDialog.operationColumn') }}</div>
        </div>

        <div class="version-table__body">
          <el-scrollbar :max-height="412">
            <div
              v-for="item in versions"
              :key="item.version"
              class="version-table__row"
              :class="{ 'is-editing': item.isEditing, 'is-active': item.status === ProcessVersionStatus.ENABLED }"
            >
              <div class="version-table__col is-name">
                <div class="version-name">{{ formatVersionName(item.version) }}</div>
              </div>
  
              <div class="version-table__col is-status">
                <div
                  class="version-status"
                  :class="`is-${item.status}`"
                >
                  {{ item.statusLabel }}
                </div>
              </div>
  
              <div class="version-table__col is-actions">
                <button
                  v-if="item.status === ProcessVersionStatus.ENABLED"
                  type="button"
                  class="version-action is-warning"
                  @click="emit('disable-version', item.version)"
                >
                  {{ $t('ProcessVersionManagerDialog.disableVersion') }}
                </button>
                <span
                  v-if="item.status === ProcessVersionStatus.ENABLED"
                  class="version-action-divider"
                ></span>
                <button
                  v-if="item.status !== ProcessVersionStatus.ENABLED"
                  type="button"
                  class="version-action"
                  @click="emit('enable-version', item.version)"
                >
                  {{ $t('ProcessVersionManagerDialog.enableVersion') }}
                </button>
                <span
                  v-if="item.status !== ProcessVersionStatus.ENABLED && item.showDelete"
                  class="version-action-divider"
                ></span>
                <button
                  v-if="item.status !== ProcessVersionStatus.ENABLED && item.showDelete"
                  type="button"
                  class="version-action is-danger"
                  :class="{ 'is-disabled': !item.canDelete }"
                  :disabled="!item.canDelete"
                  :title="!item.canDelete ? $t('ProcessVersionManagerDialog.deleteVersionHasDataTip') : ''"
                  @click="emit('delete-version', item.version)"
                >
                  {{ $t('ProcessVersionManagerDialog.deleteVersion') }}
                </button>
                <button
                  v-if="item.status === ProcessVersionStatus.ENABLED"
                  type="button"
                  class="version-action"
                  @click="emit('copy-version', item.version)"
                >
                  {{ $t('ProcessVersionManagerDialog.copy') }}
                </button>
                <span class="version-action-divider"></span>
                <el-dropdown
                  trigger="click"
                  placement="bottom-start"
                  popper-class="process-version-action-dropdown"
                  @command="handleMoreCommand(item.version, $event)"
                >
                  <button
                    type="button"
                    class="version-action version-action--more"
                  >
                    {{ $t('ProcessVersionManagerDialog.more') }}
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit">
                        <el-icon :size="16"><i-ven-edit-state /></el-icon>
                        <span>{{ $t('ProcessVersionManagerDialog.editVersion') }}</span>
                      </el-dropdown-item>
                      <el-dropdown-item command="copy">
                        <el-icon :size="16"><i-ep-copy-document /></el-icon>
                        <span>{{ $t('ProcessVersionManagerDialog.copy') }}</span>
                      </el-dropdown-item>
                      <el-dropdown-item command="copy-to-form">
                        <el-icon :size="16"><i-ven-icon-copy-to /></el-icon>
                        <span>{{ $t('ProcessVersionManagerDialog.copyToForm') }}</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ProcessVersionStatus } from '@common/types/project';
import i18next from 'i18next';
import type { PropType } from 'vue';

type ProcessVersionItem = {
  version: number,
  status: ProcessVersionStatus,
  statusLabel: string,
  isStored: boolean,
  isEditing: boolean,
  showDelete: boolean,
  canDelete: boolean,
};

defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  versions: {
    type: Array as PropType<ProcessVersionItem[]>,
    default: () => [],
  },
});

const emit = defineEmits([
  'update:modelValue',
  'enable-version',
  'disable-version',
  'copy-version',
  'copy-to-form',
  'edit-version',
  'delete-version',
]);

const formatVersionName = (version: number) => i18next.t('FormProcess.versionLabel', { version });

const handleMoreCommand = (version: number, command: string | number | object) => {
  if (command === 'edit') {
    emit('edit-version', version);
    return;
  }
  if (command === 'copy') {
    emit('copy-version', version);
    return;
  }
  if (command === 'copy-to-form') {
    emit('copy-to-form', version);
  }
};
</script>

<style scoped lang="scss">
.process-version-manager-dialog {
  :deep(.el-dialog) {
    --el-dialog-padding-primary: 0;
    border-radius: 8px;
    overflow: hidden;
    max-height: 548px;

    .el-dialog__header {
      padding: 12px 20px;
      height: 48px;
      border-bottom: 1px solid #edf1f6;
      
      .dialog-title {
        text-align: center;
        font-size: 16px;
        line-height: 24px;
        color: #1D2129;
      }
    }

    .el-dialog__body {
      padding: 20px 24px;
      background: #fff;
    
      .version-table {
        border: 1px solid #e3e8ef;
        border-radius: 5px;
        overflow: hidden;
        background: #fff;
      }
    
      .version-table__header,
      .version-table__row {
        display: grid;
        grid-template-columns: minmax(0, 1.8fr) 140px minmax(0, 1fr);
        align-items: center;
      }
    
      .version-table__header {
        height: 40px;
        border-bottom: 1px solid #e3e8ef;
        background: #f8fafc;
        color: #1D2129;
        font-size: 14px;
        line-height: 22px;
      }
    
      .version-table__row {
        min-height: 48px;
        background: #fff;
        transition: background-color 0.2s ease;
    
        & + .version-table__row {
          border-top: 1px solid #edf1f6;
        }
      }
    
      .version-table__col {
        display: flex;
        align-items: center;
        height: 100%;
        padding: 0 12px;
    
        &.is-status,
        &.is-actions {
          border-left: 1px solid #edf1f6;
        }
    
        &.is-actions {
          gap: 12px;
          flex-wrap: wrap;
        }
      }
    
      .version-name {
        font-size: 14px;
        line-height: 22px;
        color: #364152;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    
      .version-status {
        height: 20px;
        border-radius: 2px;
        padding: 0 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        line-height: 22px;
    
        &.is-designing {
          color: #FAAD14;
          background: #F4FFE8;
        }
    
        &.is-enabled {
          color: #ffffff;
          background: #52C41A;
        }
    
        &.is-history {
          color: #7f8898;
          background: #f3f5f7;
        }
      }
    
      .version-action {
        appearance: none;
        border: 0;
        background: transparent;
        padding: 0;
        color: #1677ff;
        font-size: 14px;
        line-height: 22px;
        cursor: pointer;

        :deep(.el-button) {
          padding: 0;
        }
    
        &:hover {
          color: #0f62d8;
        }

        &--more {
          display: inline-flex;
          align-items: center;
        }

        &.is-warning {
          color: #F77234;

          &:hover {
            color: #F77234;
          }
        }
    
        &.is-danger {
          color: #ff5f5f;
    
          &:hover {
            color: #e24d4d;
          }
    
          &:disabled,
          &.is-disabled {
            color: #ffb8b8;
            cursor: not-allowed;
          }
        }
      }
    
      .version-action-divider {
        width: 1px;
        height: 14px;
        background: #e2e8f0;
      }
    }
  }
}
</style>

<style lang="scss">
.process-version-action-dropdown.el-popper {
  --el-dropdown-menuItem-hover-fill: #f2f3f5;
  border: 1px solid #e5e6eb !important;
  background-color: #fff !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 24px rgba(31, 35, 41, 0.12) !important;
  padding: 4px !important;

  .el-popper__arrow {
    display: none !important;
  }

  .el-dropdown-menu {
    padding: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
    background-color: #fff !important;
    min-width: 146px;
  }

  .el-dropdown-menu__item {
    padding: 10px 12px !important;
    border-radius: 6px;
    line-height: 22px !important;
    color: #1d2129 !important;

    &:hover {
      background: #f2f3f5 !important;
      color: #1d2129 !important;
    }
  }
}
</style>
