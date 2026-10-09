<template>
  <div class="window-buttons app-no-drag" v-if="env.inClient()">
    <el-button class="close" text size="large" @click="handleClose">
      <el-icon :size="16">
        <i-ep-close />
      </el-icon>
    </el-button>
  </div>
  <vn-stack class="nocode-view " :class="{'server-view': isServer}" v-model="activeTab">
    <el-aside class="left" width="232px">
      <el-header class="header"></el-header>
      <el-main class="slider app-no-drag">
        <el-dropdown popper-class="popper-no-arrow" placement="bottom-start" :disabled="!passportState.isLoginUser">
          <div class="user-information" :class="{'canClick': !passportState.isLoginUser}" @click="handleLogin">
            <el-icon :size="24"><i-ven-profile-picture /></el-icon>
            <span class="name" :title="nameLayout">{{ nameLayout }}</span>
          </div>
          <template #dropdown>
            <div class="wrapper-dropdown-menu">
              <el-dropdown-menu class="dropdown-menu">
                <el-dropdown-item @click="handleEditUserSetting">
                  <el-icon :size="16"><i-ep-user></i-ep-user></el-icon>
                  {{ $t('NocodeView.personalProfile') }}
                </el-dropdown-item>
                <el-dropdown-item class="dropdown-item-exit" v-show="passportState.isLoginUser" @click="() => visibleExitDialog = true">
                  <el-icon color="var(--el-color-danger)" :size="16"><i-ven-exit></i-ven-exit></el-icon>
                  {{ logoutBtnText }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </div>
          </template>
        </el-dropdown>
        <div class="btn-workbench" @click.stop="handleOpenWorkbench">
          <div class="btn-text">
            <el-icon :size="16"><i-workbench-nocode-workbench /></el-icon>
            <span>{{ $t("NocodeView.openWorkbench") }}</span>
          </div>
          <el-icon class="open-icon" :size="16"><i-icon-park-outline-arrow-right /></el-icon>
        </div>

        <div class="tabs-content">
          <div class="tabs">
            <vn-stack-tab class="tab" name="workbenchSetting">
              <el-icon :size="16">
                <i-workbench-configure />
              </el-icon>
              {{ $t("NocodeView.workbenchSetting") }}</vn-stack-tab>
            <vn-stack-tab class="tab" name="storageSetting">
              <el-icon :size="16">
                <i-ven-storage />
              </el-icon>
              {{ $t("NocodeView.storageSetting") }}</vn-stack-tab>
            <vn-stack-tab class="tab" name="commonSetting">
              <el-icon :size="16">
                <i-ven-frame />
              </el-icon>
              {{ $t("NocodeView.generalSetting") }}</vn-stack-tab>
          </div>
          <div class="version-info" v-if="!isServer">
            <span class="version product-name" :title="$t('productName')">{{ $t("productName") }}</span>
            <span class="version">v{{version}}</span>
            <span class="plan-tag">
              {{ $t('NocodeView.free') }}
            </span>
          </div>
        </div>
      </el-main>
    </el-aside>
    <el-container class="right">
      <el-header class="header">
      </el-header>
      <el-main class="content">
        <vn-stack-layer name="workbenchSetting">
          <workbench-setting v-if="activeTab === 'workbenchSetting'"></workbench-setting>
        </vn-stack-layer>
        <vn-stack-layer name="storageSetting">
          <storage-setting v-if="activeTab === 'storageSetting'"></storage-setting>
        </vn-stack-layer>
        <vn-stack-layer name="commonSetting">
          <common-setting
            v-if="activeTab === 'commonSetting'"
            :officePluginInfo="officePluginInfo"
            :systemMigrationApplyStatus="systemMigrationApplyStatus"
            @retry-system-migration-apply="handleRetrySystemMigrationApply"
          ></common-setting>
        </vn-stack-layer>
      </el-main>
    </el-container>
    <nocode-login-dialog v-model="dialogState.loginDialogVisible"
      @update:modelValue="dialogState.loginDialogVisible = $event"></nocode-login-dialog>
  </vn-stack>

  <exit-dialog :modelValue="visibleExitDialog" @update:modelValue="updateExitVisible" @confirm-exit="handleConfirmExit"></exit-dialog>
  <user-setting-dialog-manager :modelValue="visibleUserSettingDialog"
    @update:modelValue="updateUserSettingDialogVisible" ref="dialogManager"></user-setting-dialog-manager>
  <occupy-dialog />
  <offline-notice-dialog />
</template>

<script lang='ts' setup>
import { SystemMigrationApplyStatus } from '@common/types/system-migration';
import { ElMessage, ElMessageBox } from 'element-plus';
import i18next from 'i18next';
import { computed, onMounted, ref, watch } from 'vue';
import { useDialogStore, usePassportStore, useSettingStore } from "@renderer/stores";
import axios from "axios";
import { useRouter } from 'vue-router';
import { officeApi } from '@renderer/utils/api/office';
import { env } from '@renderer/utils/env';

const isServer = __IS_SERVER__;
const router = useRouter();
const visibleUserSettingDialog = ref(false);
const activeTab = ref("workbenchSetting");
const visibleExitDialog = ref(false);
const version = __APP_VERSION__;
const passportState = usePassportStore();
passportState.init();
const dialogState = useDialogStore();
const settingState = useSettingStore();
const officePluginInfo = ref({});
const systemMigrationApplyStatus = ref<SystemMigrationApplyStatus>({
  status: 'idle',
  pending: false,
  canRetry: false,
});
const handledSystemMigrationFailureKey = ref('');
const logoutBtnText = computed(() => {
  return i18next.t("basicSetting.exitUser");
})

const nameLayout = computed(() => {
  return passportState.isLoginUser ? passportState.showUserNickname : i18next.t("userCard.logoutState");
});

// 切换到通用设置标签页时要检查有没有安装打印插件
const onCommonSettingTabActivated = async() => {
  // 检测是否已经安装打印插件和是否启动
  officePluginInfo.value = await officeApi.checkOfficePlugin();
};

// 监听标签页变化
watch(activeTab, (newTab) => {
  if (newTab === 'commonSetting') {
    onCommonSettingTabActivated();
  }
}, { immediate: true });

const handleOpenWorkbench = () => {
  if (isServer) {
    router.replace({ path: "/"})
    return;
  }
  const url = new URL(settingState.saas.domain);
  url.searchParams.set("source", "openWorkbench");
  window.open(url.toString(), "browser");
}

const handleClose = () => {
  if (import.meta.env.DEV) {
    window.close();
    return;
  }
  window.hide?.();
}

const updateExitVisible = (modelValue) => {
  visibleExitDialog.value = modelValue;
}

const handleConfirmExit = () => {
  visibleExitDialog.value = false;
}

const handleEditUserSetting = () => {
  visibleUserSettingDialog.value = true;
}

const handleLogin = () => {
  if(passportState.isLoginUser) return;
  dialogState.show("loginDialogVisible");
}

const updateUserSettingDialogVisible = (val) => {
  visibleUserSettingDialog.value = val;
}

const resolveSystemMigrationApplyMessage = (message?: string) => {
  if (message?.trim()) {
    return message;
  }
  return i18next.t('SystemMigration.applyFailed');
}

const refreshSystemMigrationApplyStatus = async () => {
  const status = await axios.get('/system-migration/apply-status').then(({ data }) => data as SystemMigrationApplyStatus).catch(() => null);
  if (!status) {
    return;
  }
  systemMigrationApplyStatus.value = status;

  if (status.status === 'success') {
    ElMessage.success(i18next.t('SystemMigration.applySuccess'));
    await axios.post('/system-migration/apply-status/clear').catch(() => null);
    systemMigrationApplyStatus.value = {
      status: 'idle',
      pending: false,
      canRetry: false,
    };
    return;
  }

  if (status.status === 'failed') {
    await showSystemMigrationApplyFailedDialog(status);
  }
}

const handleRetrySystemMigrationApply = async () => {
  if (!systemMigrationApplyStatus.value.canRetry) {
    ElMessage.warning(i18next.t('SystemMigration.retryNotAvailable'));
    return false;
  }
  const result = await axios.post('/system-migration/retry-apply').then(({ data }) => data).catch(({ response }) => {
    const message = response?.data?.message || i18next.t('SystemMigration.retryApplyFailed');
    systemMigrationApplyStatus.value = {
      status: 'failed',
      pending: false,
      canRetry: true,
      message,
      updatedAt: Date.now(),
    };
    ElMessage.error(message);
    return null;
  });
  if (!result) {
    return false;
  }

  systemMigrationApplyStatus.value = {
    status: 'pending',
    pending: true,
    canRetry: false,
    updatedAt: Date.now(),
  };
  handledSystemMigrationFailureKey.value = '';

  const relaunched = await axios.post('/relaunch').then(() => true).catch(({ response }) => {
    const message = response?.data?.message || i18next.t('SystemMigration.relaunchFailed');
    systemMigrationApplyStatus.value = {
      status: 'failed',
      pending: false,
      canRetry: true,
      message,
      updatedAt: Date.now(),
    };
    ElMessage.error(message);
    return false;
  });
  return relaunched;
}

const showSystemMigrationApplyFailedDialog = async (status: SystemMigrationApplyStatus) => {
  const dialogKey = `${status.updatedAt || 0}-${status.message || ''}`;
  if (handledSystemMigrationFailureKey.value === dialogKey) {
    return;
  }
  handledSystemMigrationFailureKey.value = dialogKey;

  if (!status.canRetry) {
    await ElMessageBox.alert(
      resolveSystemMigrationApplyMessage(status.message),
      i18next.t('SystemMigration.applyFailedTitle'),
      {
        type: 'error',
        closeOnClickModal: false,
        confirmButtonText: i18next.t('SystemMigration.confirm'),
      }
    ).catch(() => null);
    return;
  }

  try {
    await ElMessageBox.confirm(
      resolveSystemMigrationApplyMessage(status.message),
      i18next.t('SystemMigration.applyFailedTitle'),
      {
        type: 'error',
        closeOnClickModal: false,
        confirmButtonText: i18next.t('SystemMigration.retryApply'),
        cancelButtonText: i18next.t('SystemMigration.cancel'),
      }
    );
    await handleRetrySystemMigrationApply();
  } catch (error) {}
}

onMounted(async () => {
  await refreshSystemMigrationApplyStatus();
})

</script>

<style lang='scss'>
body {
  --cursor-default: default;
  --cursor-pointer: pointer;
  --cursor-text: text;
  --cursor-replace: replace;
  --cursor-zoom-out: zoom-out;
  --cursor-zoom-in: zoom-in;

  --cursor-grab: grab;
  --cursor-grabbing: grabbing;

  --cursor-e-resize: e-resize;
  --cursor-n-resize: n-resize;
  --cursor-nw-resize: nw-resize;
  --cursor-ne-resize: ne-resize;

  --cursor-copy: copy;
}
body, .el-overlay-dialog {
  -webkit-app-region: drag;
}

.no-drag, .el-dialog {
  -webkit-app-region: no-drag;
}
.popper-no-arrow {
  margin-top: -8px !important;
  border: 1px solid var(--border-color) !important;
  box-shadow: 0px 6px 16px 0px #00000014 !important;

  .el-popper__arrow {
    display: none !important;
  }
}
</style>
<style lang='scss' scoped>
.window-buttons {
  position: fixed;
  right: 0;
  display: flex;
  align-items: center;
  z-index: 10;

  .el-button {
    width: 50px;
    margin: 0;

    &.close:hover {
      --el-fill-color-light: var(--color-danger);
      --el-button-text-color: var(--color-white);
    }
  }
}

.wrapper-dropdown-menu {
  :deep(.dropdown-menu) {
    width: 200px;
    padding: 2px;
    background-color: var(--color-white);
    border-radius: 4px;

    .el-dropdown-menu__item {
      padding-left: 12px;

      &.dropdown-item-exit {
        border-radius: 2px;
        color: var(--color-danger);
        margin-top: 8px;

        &:hover {
          background-color: #FF4D4F1A;
        }
      }
    }

  }
}

.nocode-view {
  background-color: var(--bg-color-page);
  width: 100%;
  height: 100%;
  display: flex;
  min-width: 0;
  --header-height: 32px;
  color: var(--text-color-regular);

  .left {
    background-color: var(--bg-color-page);

    .header {
      height: var(--header-height);
    }

    .slider {
      height: calc(100% - var(--header-height));
      display: flex;
      flex-direction: column;
      padding: 0 16px 16px 16px;
      border-right: 1px solid var(--border-color);

      .user-information {
        display: flex;
        align-items: center;
        height: 40px;
        width: 200px;
        border-radius: 4px;
        margin-bottom: 16px;
        padding: 8px;

        &[aria-expanded="true"] {
          background-color: rgba(171, 219, 255, 0.4);
        }

        &.canClick {
          cursor: var(--cursor-pointer);
        }

        &:focus-visible {
          outline: none;
        }

        i {
          color: var(--color-primary);
          margin-right: 8px;
        }

        .name {
          width: calc(100% - 32px);
          font-size: 14px;
          color: var(--text-color-primary);
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }
      }

      .tabs-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;

        .tabs {
          display: flex;
          flex-direction: column;
          row-gap: 8px;
          .tab {
            font-size: 14px;
            height: 36px;
            cursor: var(--cursor-pointer);
            display: flex;
            align-items: center;
            padding: 0 12px;
            column-gap: 8px;
            border-radius: 4px;

            &:hover {
              background-color: var(--bg-color);
            }
            &.active {
              background-color: var(--bg-color);
            }
          }
        }
      }

      .btn-workbench {
        height: 40px;
        padding: 8px 12px;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-radius: 4px;
        margin-bottom: 8px;
        background-color: #E6F5FF;
        cursor: var(--cursor-pointer);
        color: var(--color-primary);

        &:hover {
          background-color: rgba(171, 219, 255, 0.4);
          .open-icon {
            transform: translateX(4px);
          }
        }

        .btn-text {
          display: flex;
          justify-content: center;
          align-items: center;
          column-gap: 8px;

          span {
            margin-left: 0px;
            font-size: 14px;
          }
        }

        .el-icon {
          color: var(--color-primary);
        }
        
        .open-icon {
          transition: transform 0.2s ease;
        }
      }

      .version-info {
        display: flex;
        align-items: center;
        color: var(--text-color-secondary);
        font-size: 12px;

        .product-name {
          display: inline-block;
          max-width: 100px;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }

        .version {
          margin-left: 2px;
          font-weight: 500;
          white-space: nowrap;
        }

        .plan-tag {
          width: 48px;
          height: 20px;
          line-height: 20px;
          text-align: center;
          margin-left: 8px;
          border-radius: 4px;
          background-color: #f2f3f5;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;

          &.custom {
            background-color: #EFDDFD;
            color: #8D4EDA;
          }
        }
      }

    }
  }

  .right {
    flex: 1;
    min-width: 0;
    overflow: hidden;

    .header {
      height: var(--header-height);
      padding: 0;
    }

    .content {
      display: flex;
      min-width: 0;
      overflow: hidden;
      padding: 0 0 0 32px;

      :deep(.vn-stack-layer) {
        width: 100%;
        min-width: 0;
      }
    }
  }
}

.server-view {
  width: 1440px;
  padding: 64px 80px;
  margin: 0 auto;
}
</style>
