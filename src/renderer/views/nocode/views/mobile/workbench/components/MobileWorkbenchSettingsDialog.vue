<template>
  <div class="settings-container">
    <el-dialog
      :model-value="true"
      class="settings-dialog"
      width="100%"
      height="100%"
      :close-on-click-modal="false"
      :show-close="false"
      destroy-on-close
      draggable
      align-center
    >
      <template #header>
        <div class="header">
          <el-button
            class="back"
            text
            :title="$t('MobileWorkbenchSettingsDialog.backToDashboard')"
            @click="emit('closeSettings')"
          >
            <el-icon size="16" class="arrow">
              <i-ep-arrow-left />
            </el-icon>
            <div class="title-text">{{ $t('MobileWorkbenchSettingsDialog.personalSettings') }}</div>
          </el-button>
        </div>
      </template>

      <div class="dialog-content">
        <el-button
          class="logout-button"
          type="primary"
          size="large"
          @click="handleLogout"
        >
          {{ $t('MobileWorkbenchSettingsDialog.logout') }}
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePassportStore } from '@renderer/stores';
import { ElMessage } from "element-plus";
import i18next from "i18next";

const emit = defineEmits<{ (event: "closeSettings"): void }>();

const passportState = usePassportStore();
passportState.init()

const handleLogout = async () => {
  await passportState.logoutAccountActively();
  ElMessage.success(i18next.t('MobileWorkbenchSettingsDialog.logoutSuccess'));
}
</script>

<style scoped lang="scss">
.settings-container {
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;

  :deep(.settings-dialog) {
    width: 100%;
    height: 100%;
    background-color: #f5f5f7;
    padding: 16px;
    padding-top: 24px;
  }

  .header {
    height: 44px;
    display: flex;
    align-items: center;
    a {
      display: flex;
      align-items: center;
      color: inherit;
      -webkit-tap-highlight-color: transparent;
      &:hover {
        color: inherit;
      }
    }
    .el-button {
      padding: 0;
    }
    .title-text {
      font-size: 16px;
      font-weight: 500;
      margin-left: 8px;
      color: var(--text-color-primary);
    }
  }

  .header-back-icon {
    font-size: 16px;
    cursor: pointer;
  }

  .title-text {
    font-size: 17px;
    font-weight: 600;
    margin-left: 12px;
  }

  .logout-button {
    width: 100%;
    height: 40px;
    font-size: 16px;
    border-radius: 4px;
    background: #0873ff;
    border: none;
  }
}
</style>
