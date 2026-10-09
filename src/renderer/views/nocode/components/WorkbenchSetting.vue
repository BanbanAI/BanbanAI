<template>
  <nocode-panel :title="$t('workbenchSetting.configuration')">
    <nocode-base-setting-panel class="setting-container" :title="$t('workbenchSetting.serviceSettings')">
      <template #tip>
        <div class="title-tip">{{ getI18nPunctuation("leftParenthesis") }}{{ $t("WorkbenchSetting.cannotAccess") }}<a href="https://www.banban.work/docs/v1/ipumpmzp0zurke5o/" target="browser">{{ $t("WorkbenchSetting.clickToView") }}</a>{{ getI18nPunctuation("rightParenthesis") }}</div>
      </template>
      <div class="setting-item saas-domain">
        <div class="label">{{ $t("workbenchSetting.IP") }}</div>
        <div class="container saas-ips-container">
          <el-select class="domain-text input-with-select ip-select" v-model="saasIp" @change="selectDomainFn">
            <el-option :value="'localhost'" :label="'localhost'" :key="'localhost'" />
            <el-option :value="'127.0.0.1'" :label="'127.0.0.1'" :key="'127.0.0.1'" />
            <el-option v-for="ip in ips" :value="ip" :label="ip" :key="ip" />
          </el-select>
          <el-button @click="handleResetIps">
            <el-icon>
              <i-ep-refresh-right rotate="180deg" />
            </el-icon>
          </el-button>
        </div>
      </div>
      <div class="setting-item saas-port">
        <div class="label">{{ $t("workbenchSetting.port") }}</div>
        <div class="container" v-if="env.inClient()">
          <el-input-number :min="1" :max="65535" v-model="saasPort" class="change-saas-port"
            @change="handlePortChange" />
          <el-button v-if="restartRequired" class="btn-saas" type="warning" :loading="restartingSaas" :disabled="restartingSaas" @click="restartSaas">
            <el-icon style="transform: rotate(180deg);">
              <i-ep-refresh-right rotate="180deg" />
            </el-icon>
            {{ $t("saasSetting.saasRestart") }}
          </el-button>
          <div class="wrap-port">
            <div class="port-info">
              <div class="tip">
                {{ $t("workbenchSetting.saasRunning") }}&nbsp;&nbsp;<span class="tagPort">{{ runningPort }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="container server-config-container" v-else-if="canEditServerAccessConfig">
          <el-input-number :min="1" :max="65535" v-model="saasPort" class="change-saas-port"
            @change="handlePortChange" />
          <div class="server-config-tip">{{ $t("reportSetting.portChangeTip") }}</div>
        </div>
        <div v-else class="config-hint">
          {{ $t("WorkbenchSetting.setInConfig") }}
        </div>
      </div>
      <div class="protocol-type" v-if="canEditServerAccessConfig">
        <div class="protocol-type-radio">
          <span class="protocol-type-title">{{ $t("workbenchSetting.agreement") }}</span>
          <div class="radio-container">
            <label class="radio-item" :class="saasProtocol === 'http' ? 'checked' : ''">
              <input type="checkbox" class="checkbox" :checked="saasProtocol === 'http'" @change="handleProtocolChange('http')">
              <span>http</span>
            </label>
            <label class="radio-item" :class="saasProtocol === 'https' ? 'checked' : ''">
              <input type="checkbox" class="checkbox" :checked="saasProtocol === 'https'" @change="handleProtocolChange('https')">
              <span>https</span>
              <el-button type="primary" v-if="saasProtocol === 'https' && env.inClient()" class="https-setting-button" link @click="httpsSettingRef?.show()">
                {{ $t("WorkbenchSetting.setting") }}
              </el-button>
            </label>
          </div>
        </div>
      </div>
      <div class="setting-item saas-domain service-address-qr-code-popver">
        <div class="label">{{ $t("workbenchSetting.serviceAddress") }}</div>
        <div class="container service-address">
          <el-input v-model.trim="saasDomain" :placeholder="$t('saasSetting.saasDomainPlaceholder')"
            @blur="handleSassDomainBlur(saasDomain)" class="domain-text input-with-select">
          </el-input>
          <el-button class="icon-btn" @click="handleCopyText()">
            <el-icon class="copy-icon" :size="16"><i-workbench-copy /></el-icon>
          </el-button>
          <el-popover :teleported="false" :append-to="'.service-address-qr-code-popver'" popper-class="qr-code-popover" :width="144" placement="bottom" trigger="click">
            <template #reference>
              <el-button class="icon-btn">
                <el-icon class="qr-code-icon" :size="16"><i-workbench-qr-code /></el-icon>
              </el-button>
            </template>
            <template #default>
              <qrcode-vue :value="saasDomain" :size="128" />
              <p>{{ $t("WorkbenchSetting.scanToOpen") }}</p>
            </template>
          </el-popover>
          <el-button class="icon-btn" @click.stop="handleOpenWorkbench">
            <el-icon class="open-icon" :size="16"><i-workbench-open-workbench /></el-icon>
          </el-button>
          <el-button class="icon-btn-reset" @click="handleResetDomain()"><div class="reset-text">{{ $t("WorkbenchSetting.reset") }}</div></el-button>
        </div>
      </div>
    </nocode-base-setting-panel>

    <nocode-base-setting-panel :title="$t('workbenchSetting.enterpriseInformation')">
      <el-form class="form-container-admin" label-width="auto" :model="formAdmin">
        <el-form-item label-position="left" :label="$t('workbenchSetting.enterpriseName')">
          <el-input v-model="formAdmin.enterprise" :readonly="!passportState.companyNameEditable" @focus="handleCompanyNameInputFocus" @blur="handleCompanyNameInputBlur"/>
        </el-form-item>
        <el-form-item label-position="left" :label="$t('workbenchSetting.admin')">
          <el-input class="username-input" v-model="formAdmin.account" readonly />
        </el-form-item>
        <el-form-item class="password-item" label-position="left" :label="$t('workbenchSetting.password')">
          <el-input v-model="formAdmin.password" readonly/>
          <el-button @click="handleEditAdminPass">
            {{ $t("workbenchSetting.modify") }}
          </el-button>
        </el-form-item>
      </el-form>
    </nocode-base-setting-panel>
  </nocode-panel>
  <edit-user-password-dialog ref="editAdminPasswordDialogRef" :title="$t('workbenchSetting.modifyAdminPassword')" v-model="visibleEditPassword" @edit:formPassword="editFormPassword"></edit-user-password-dialog>
  <https-setting-dialog ref="httpsSettingRef" />
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch, reactive } from 'vue'
import axios from "axios";
import { ElMessage } from 'element-plus';
import { usePassportStore, useSettingStore } from '@renderer/stores';
import i18next from "i18next";
import QrcodeVue from 'qrcode.vue'
import { copyText } from '@renderer/utils';
import { env } from '@renderer/utils/env';
import { getI18nPunctuation } from "@common/utils/i18n";

const passportState = usePassportStore();
const settingState = useSettingStore();
const canEditServerAccessConfig = computed(() => env.inClient() || !!settingState.saas.consoleAccessConfigEditable);

const saasPort = ref(settingState.saas.port);
const saasPortChanged = computed(() => Number(settingState.saas.port) !== Number(settingState.saas.runningPort));
const restartRequired = computed(() => saasPortChanged.value || settingState.saas.protocol !== settingState.saas.runningProtocol || settingState.saas.restartRequired);
const restartingSaas = ref(false);
const runningPort = computed(() => settingState.saas.runningPort);
const saasDomain = ref(settingState.saas.domain);
const domainCustomized = ref(settingState.saas.domainCustomized);
const saasIp = ref(settingState.saas.ip);
const saasProtocol = ref(settingState.saas.protocol);

const visitAddress = computed(() => saasDomain.value)

const ips = computed(() => {
  return settingState.ips
})

const visibleEditPassword = ref(false);
const editAdminPasswordDialogRef = ref();
const httpsSettingRef = ref();

const formAdmin = reactive({
  enterprise: '',
  account: 'admin',
  password: '*****************',
})
const getErrorMessage = (error: unknown, fallbackKey: string) => {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message || (error instanceof Error ? error.message : i18next.t(fallbackKey));
}
onMounted(async () => {
  await Promise.allSettled([
    settingState.getDomainPort(),
    settingState.getCompanyName(),
  ]);
  syncLocalSettings();
  formAdmin.enterprise = settingState.companyName;
});

const getCompanyName = async () => {
  formAdmin.enterprise = await settingState.getCompanyName();
};

const handlePortChange = async (value: number) => {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    saasPort.value = settingState.saas.port;
    return;
  }
  try {
    await settingState.changeServerPort(value);
    syncAutoDomain();
  } catch (error: unknown) {
    saasPort.value = settingState.saas.port;
    ElMessage.error(getErrorMessage(error, "saasSetting.serverPortUpdateFailed"));
  }
}

const handleProtocolChange = async (value: 'http' | 'https') => {
  if (value === saasProtocol.value) return;
  try {
    await settingState.changeServerProtocol(value);
    saasProtocol.value = value;
    syncAutoDomain();
    ElMessage.warning(i18next.t("webShareSetting.protocolEditTip"));
  } catch (error: unknown) {
    saasProtocol.value = settingState.saas.protocol;
    ElMessage.error(getErrorMessage(error, "saasSetting.serverProtocolUpdateFailed"));
  }
}

const restartSaas = async () => {
  if (!restartRequired.value || restartingSaas.value) return;
  restartingSaas.value = true;
  try {
    await settingState.restartServer();
  } catch (error: unknown) {
    restartingSaas.value = false;
    ElMessage.error(getErrorMessage(error, "saasSetting.serverRestartFailed"));
  }
}

const syncAutoDomain = () => {
  domainCustomized.value = settingState.saas.domainCustomized;
  if (!domainCustomized.value) {
    saasDomain.value = `${settingState.saas.protocol}://${settingState.saas.ip}:${settingState.saas.port}`;
  }
}

watch(() => [settingState.saas.domain, settingState.saas.domainCustomized], () => {
  domainCustomized.value = settingState.saas.domainCustomized;
  if (domainCustomized.value) saasDomain.value = settingState.saas.domain;
  else syncAutoDomain();
})
watch(() => [settingState.saas.port, settingState.saas.protocol, settingState.saas.ip], syncAutoDomain)
watch(() => settingState.saas.runningPort, () => {
  saasPort.value = settingState.saas.port;
})
watch(() => settingState.saas.protocol, (value) => {
  saasProtocol.value = value;
})
watch(() => settingState.saas.ip, (value) => {
  saasIp.value = value;
})

watch(() => settingState.saas.port, (value) => {
  saasPort.value = value;
})

const syncLocalSettings = () => {
  saasPort.value = settingState.saas.port;
  saasIp.value = settingState.saas.ip;
  saasProtocol.value = settingState.saas.protocol;
  syncAutoDomain();
}

const handleResetIps = async () => {
  await settingState.getDomainPort(true);
  ElMessage.success(i18next.t("WorkbenchSetting.refreshSuccess"));
}

const selectDomainFn = async (val: string) => {
  try {
    await settingState.changeServerIp(val);
    syncAutoDomain();
  } catch (error: unknown) {
    saasIp.value = settingState.saas.ip;
    ElMessage.error(getErrorMessage(error, "saasSetting.serverIpUpdateFailed"));
  }
}

// 打开工作台
const handleOpenWorkbench = () => {
  window.open(saasDomain.value, "browser");
}

let oldVal = null
const handleCompanyNameInputFocus = () => {
  oldVal = formAdmin.enterprise
}

const handleCompanyNameInputBlur = async () => {
  if (!formAdmin.enterprise || formAdmin.enterprise.trim() === '') {
    ElMessage.warning(i18next.t("workbenchSetting.enterpriseNameRequired"));
    formAdmin.enterprise = oldVal || '';
    return;
  }
  
  if (oldVal !== formAdmin.enterprise) {
    await settingState.setCompanyName(formAdmin.enterprise).then(() => {
      ElMessage.success(i18next.t("workbenchSetting.companyNameEditSuccess"));
    }).catch(() => { ElMessage.error(i18next.t("workbenchSetting.companyNameEditFailed")); });
  }
}

const handleSassDomainBlur = async (newSassDomain) => {
  if (!newSassDomain || newSassDomain === settingState.saas.domain) return;
  try {
    await settingState.changeServerDomain(newSassDomain);
    domainCustomized.value = true;
  } catch (error: unknown) {
    syncLocalSettings();
    ElMessage.error(getErrorMessage(error, "saasSetting.serverDomainUpdateFailed"));
  }
}

const handleCopyText = async () => {
  try {
    await copyText(visitAddress.value);
    ElMessage.success(i18next.t("saasSetting.copySuccess"));
  } catch (error) {
    console.error('Workbench service address copy failed:', error);
    ElMessage.error(i18next.t("saasSetting.copyFail"));
  }
}

const handleResetDomain = async () => {
  try {
    await settingState.resetServerDomain();
    domainCustomized.value = false;
    syncAutoDomain();
    ElMessage.success(i18next.t("saasSetting.resetSuccess"));
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, "saasSetting.serverDomainResetFailed"));
  }
}

const handleEditAdminPass = () => {
  visibleEditPassword.value = true;
}

const editFormPassword = async (val) => {
  const { newPassword, oldPassword } = val;
  await axios.post(`/workbench/update-password`, {
    oldPassword,
    newPassword,
  }).then((res) => {
    if (res) {
      ElMessage.success(i18next.t("WorkbenchSetting.passwordChangedSuccess"));
      visibleEditPassword.value = false;
      editAdminPasswordDialogRef.value.clear();
    }
  }).catch((err) => {
    ElMessage.error(err.response.data.message);
  })
}

defineExpose({
  getCompanyName,
})
</script>

<style scoped lang="scss">
:deep(.el-input) {
  --el-input-border-radius: 4px;
  --el-input-text-color: var(--text-color-regular);
  --el-fill-color-light: var(--bg-color-overlay);

  .el-input__wrapper {
    box-shadow: none;
    background-color: var(--bg-color-overlay);
  }
}

:deep(.el-button) {
  border: none;
}

:deep(.el-select) {
  .el-select__wrapper {
    background-color: var(--bg-color-overlay);
    border-radius: 4px;
    box-shadow: none;
  }
}

.title-tip {
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-color-secondary);
  margin-left: 2px;
  pointer-events: auto;

  a {
    font-size: 12px;
    font-weight: 400;
    color: var(--color-primary);
  }
}

// .setting-item:not(:last-child) {
.setting-item {
  margin-bottom: 16px;
}

.setting-item.no-flex{
  display: block;
}

.setting-container {
  position: relative;
  &:not(:last-child) {
    margin-bottom: 32px;

  }

}

.common-btn {
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 4px;
  color: var(--color-primary);
  background-color: var(--bg-color-overlay);
}

.config-hint {
  padding: 8px 12px;
  background-color: var(--bg-color-overlay);
  border-radius: 4px;
  color: var(--text-color-secondary);
  font-size: 14px;
  display: flex;
  align-items: center;
  min-height: 32px;
}

.setting-item {
  width: 100%;
  display: flex;
  align-items: center;
  color: var(--text-color-regular);

  .label {
    width: 74px;
    height: 32px;
    font-size: 14px;
    line-height: 32px;
    margin-right: 16px;
  }

  .container {
    height: 100%;

    &.box {
      width: 50%;
      height: 42px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid var(--border-color);
      background-color: var(--bg-color-overlay);
      font-size: 15px;
    }

    .ip-select {
      :deep(.el-select__wrapper) {
        background-color: var(--bg-color-overlay);
        border-radius: 4px;
      }
    }

    .icon-btn {
      height: 32px;
      width: 32px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      padding: 8px;
      margin: 0;
    }

    .icon-btn-reset {
      height: 32px;
      width: 60px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      padding: 8px;
      margin: 0;

      .reset-text {
        font-size: 12px;
        font-weight: 400;
        color: var(--color-primary);
      }
    }
    .preview {
      display: flex;
      justify-content: left;
      .preview-btn {
        background-color: #0873FF;
        border-radius: 4px;
      }
    }
  }
  .service-address {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
  }

  &.service-address-qr-code-popver {
    position: relative;
    :deep(.qr-code-popover) {
      min-width: 144px !important;
      height: 176px !important;
      top: calc(50% + 22px) !important;
      padding: 8px !important;
      p {
        margin-top: 4px;
        text-align: center;
      }
    }
  }

  &.saas-domain {
    .container {
      flex: 1;
    }

    .saas-ips-container {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .el-button {
        background-color: var(--bg-color-overlay);
        border-radius: 4px;
        height: 32px;
        width: 32px;
      }
    }
  }

  &.saas-port {
    align-items: baseline;

    .container {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 16px 0;
      align-items: center;
      position: relative;

      .change-saas-port {
        margin-right: 8px;
        width: 126px;

        :deep(.el-input__wrapper) {
          width: 64px;

          .el-input__inner {
            width: 60px;
          }
        }
      }

      :deep(.btn-saas) {
        width: 100px;
        font-size: 12px;
        border-radius: 4px;
        margin-right: 10px;

        span>i {
          font-size: 16px;
          margin-right: 4px;
        }
      }

      .wrap-port {
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .port-info {
          display: flex;
          flex-wrap: wrap;

          .tip {
            font-size: 12px;
            display: flex;
            align-items: center;

            .tagPort {
              color: var(--color-primary);
              font-weight: bold;
            }
          }
        }
      }

    }

    .server-config-tip {
      font-size: 12px;
      color: var(--text-color-secondary);
    }
  }

  &.follow-app-start {
    .container {
      .text {
        min-width: 140px;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }
    }
  }

  .text-wrapper {
    .el-input {
      --el-input-border-radius: 4px;
      
      .el-input__wrapper {
        box-shadow: unset;
        
        .el-input__inner {
          text-align: center;
          
          &::placeholder {
            color: rgba(146, 148, 150, 0.4);
            font-size: 12px;
          }
        }
      }
    }
  }

  .text-wrapper.input-text {
    flex: 1;
    :deep(.el-input) {
      width: 100%;
    }
  }

}

.protocol-type {
  .protocol-type-title {
    width: 74px;
    font-size: 14px;
    margin-right: 16px;
  }

  .protocol-type-radio {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
  }

  .server-container {
    padding: 8px 12px 0 12px;
    border: 1px solid var(--el-fill-color-light);
    border-radius: 5px;

    &>*:not(:last-child) {
      margin-bottom: 8px;
    }

    .server-tittle {
      width: 140px;
      line-height: 20px;
      font-size: 12px;
      color: var(--text-color-regular);
    }

    .server-item {
      height: 32px;
      color: var(--text-color-regular);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
        font-size: 12px;

      .server-item-title {
        display: inline-block;
        height: 25px;
        width: 40px;
      }

      .server-item-upload {
        height: 100%;
        width: 100%;
        position: relative;
        display: flex;

        &> :not(:last-child) {
          margin-right: 8px;
        }

        .server-item-value {
          flex: 1;
          height: 32px;
          border-radius: 4px;
          background-color: var(--bg-color-overlay);
          padding-left: 10px;
          color: var(--bg-color-overlay);
          font-size: 14px;
          pointer-events: none;
          margin-right: 0;
        }

        .upload-btn {
          margin-left: 8px;
        }

        .delete-icon {
          position: absolute;
          right: 140px;
          top: 50%;
          transform: translateY(-50%);
          cursor: var(--cursor-pointer);
          display: none;
        }

        &:hover {
          .delete-icon {
            display: block;
          }
        }

        .server-item-file {
          display: none;
        }
      }
    }
  }
}

.radio-container {
  display: flex;
  justify-content: space-between;

  .radio-item {
    margin-right: 30px;
    height: 30px;
    line-height: 30px;
    user-select: none;
    display: flex;
    justify-content: center;
    align-items: center;

    .checkbox {
      width: 18px;
      height: 18px;
      margin-right: 8px;
      vertical-align: middle;
      color: transparent;

      &::before {
        content: "\2714";
        display: block;
        width: 100%;
        height: 100%;
        background-color: var(--bg-color-overlay);
        border: 1px solid var(--border-color);
        line-height: 18px;
        text-align: center;
        font-size: 18px;
        box-sizing: border-box;
      }
    }

    .https-btn {
      display: flex;
      cursor: pointer;
      border-left: 1px solid var(--border-color);
      padding: 0px;
      line-height: 13px;
      margin-left: 8px;
      padding-left: 8px;
      color: var(--color-primary);
      transition: all 0.3s ease;
      
      &:hover {
        opacity: 0.7;
      }
    }

    &.checked {
      .checkbox {
        color: var(--color-primary);
      }
    }

    span {
      font-size: 12px;
      font-weight: 400;
      color: var(--text-color-regular);
    }
  }
}
:deep(.username-input) .el-input__inner {
  cursor: var(--cursor-default);
  color: var(--text-color-placeholder)
}
.form-container-admin {
  .password-item {
    :deep(.el-form-item__content) {
      flex-wrap: nowrap;
    }

    .el-button {
      margin-left: 8px;
      width: 48px;
      font-size: 12px;
      border-radius: 4px;
      color: var(--color-primary);
      background-color: var(--bg-color-overlay);
    }
  }

  :deep(.el-form-item__label) {
    pointer-events: none;
  }
}

</style>
