<template>
  <nocode-panel :title="$t('commmonSetting.title')" max-height="300px">
    <nocode-base-setting-panel :title="$t('CommonSetting.languageSetting')">
      <div class="setting-item">
        <span class="title language-title">{{ $t('CommonSetting.currentLanguage') }}{{ getI18nLabelColon() }}</span>
        <el-select v-model="currentLanguage" class="language-select" @change="handleChangeLanguage">
          <el-option
            v-for="item in languageOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
    </nocode-base-setting-panel>
    <nocode-base-setting-panel :title="$t('commmonSetting.agentSetting')">
      <div class="setting-item">
        <span class="title">{{ $t('commmonSetting.networkAgent') }}</span>
        <div class="wrapper radio-container">
          <div class="radio-item" :class="!proxyForm.on ? 'checked' : ''">
            <input type="checkbox" class="checkbox" @click="setProxyOn(false)">
            <span>{{ $t("CommonSetting.close") }}</span>
          </div>
          <div class="radio-item" :class="proxyForm.on ? 'checked' : ''">
            <input type="checkbox" class="checkbox" @click="setProxyOn(true)">
            <span>{{ $t("CommonSetting.open") }}</span>
          </div>
        </div>
      </div>
      <template v-if="proxyForm.on">
        <el-form class="proxy-form" :model="proxyForm" ref="proxyFormRef" label-width="86px" label-position="left">
          <el-form-item v-for="item in proxyFormItems" :key="item.name" :prop="item.name" :label="item.label + getI18nLabelColon()">
            <el-input :type="item.inputType" v-model="proxyForm[item.name]" :show-password="item.inputType === 'password'" v-if="item.type === 'input'" @change="saveProxy" />
            <el-input-number v-if="item.type === 'number'" :align="'left'" v-model="proxyForm[item.name]" @change="saveProxy" :controls="false" :max="65535" :min="0" style="width: 100%;" />
          </el-form-item>
        </el-form>
      </template>
    </nocode-base-setting-panel>
    <nocode-base-setting-panel :title="$t('CommonSetting.printSetting')">
      <div class="setting-item">
        <span class="title">{{ $t("CommonSetting.installPlugin") }}{{ getI18nLabelColon() }}</span>
        <el-button
          class="btn-primary"
          :class="{
            disabled: false
          }"
          type="primary"
          style="margin-right: 8px;"
          @click="installPlugin"
        >
          <div v-if="isInstalling && installType === 'online'" style="display: flex; align-items: center; gap: 4px;">
            <el-progress color="#fff" :stroke-width="2" :width="15" type="circle" :percentage="installProgress" :show-text="false"/>
            {{ +installProgress.toFixed(2) }}%
          </div>
          <div v-else style="display: flex; align-items: center;">
            <el-icon :size="16" style="margin-right: 4px;"><i-table-download /></el-icon>
            {{ $t("CommonSetting.installOnline") }}
          </div>
        </el-button>
        <el-upload
          class="btn-upload"
          accept=".zip"
          :show-file-list="false"
          :auto-upload="false"
          :multiple="false"
          :limit="1"
          :on-exceed="handleExceed"
          :on-change="handleUploadPlugin"
          :disabled="isInstallDisabled || props.officePluginInfo.installed"
          ref="uploadRef"
        >
          <el-button
            class="local-import"
            :disabled="isInstallDisabled || props.officePluginInfo.installed"
          >
            <div v-if="isInstalling && installType === 'manual'" style="display: flex; align-items: center; gap: 4px;">
              <el-progress color="#fff" :stroke-width="2" :width="15" type="circle" :percentage="installProgress" :show-text="false"/>
              {{ +installProgress.toFixed(2) }}%
            </div>
            <div v-else style="display: flex; align-items: center;">
              <el-icon :size="16" style="margin-right: 4px;"><i-table-import/></el-icon>
              {{ $t("CommonSetting.localImport") }}
            </div>
          </el-button>
        </el-upload>
        <span class="tip success" v-if="isInstallStart && isInstallSuccess && !isStartSuccess">{{ $t("CommonSetting.pluginInstallSuccess") }}</span>
        <span v-else-if="!props.officePluginInfo.installed || (props.officePluginInfo.installed && props.officePluginInfo.running) || (isInstallSuccess && isStartSuccess)"></span>
        <span class="tip error" v-else>{{ $t("CommonSetting.pluginInstallFailed") }}</span>
      </div>
      <div class="setting-item">
        <span class="title" :class="{ 'system-dll-miss': isSystemDLLMiss }">{{ $t("CommonSetting.startService") }}{{ getI18nLabelColon() }}</span>
        <div class="startup-body">
          <div class="start-success" v-if="isStartSuccess || props.officePluginInfo.running">
            <el-button type="success" plain disabled>
              <el-icon size="16"><CircleCheck /></el-icon>
              {{ $t("CommonSetting.startSuccess") }}
            </el-button>
          </div>
          <div class="default" v-else-if="!isStartStart">
            <el-button type="primary" :disabled="isInstallDisabled || !(props.officePluginInfo.installed && !props.officePluginInfo.running)" @click.stop="handleStart()">{{ $t("CommonSetting.startNow") }}</el-button>
          </div>
          <div class="starting" v-else-if="!isStartEnd">
            <el-button type="primary" plain :loading="isStartStart && !isStartEnd" disabled>
              <template #loading>
                <div class="custom-loading" style="margin-top: 2px;">
                  <el-icon :size="16">
                    <i-ven-loading/>
                  </el-icon>
                </div>
              </template>
              {{ $t("CommonSetting.starting") }}
            </el-button>
          </div>
          <div class="restart" v-else>
            <el-button type="primary" :loading="isRestarting" @click.stop="handleStart()">
              <el-icon size="16"><RefreshRight /></el-icon>
              {{ $t("CommonSetting.restart") }}
            </el-button>
            <div class="dll-tip" v-if="isSystemDLLMiss">
              <div>{{ $t("CommonSetting.missPlugin") }}</div>
              <div>
                {{ $t("CommonSetting.notInstallPlugin") }} <b>{{ $t("CommonSetting.microsoftVisual") }}</b>，{{ $t("CommonSetting.pluginFailedStart") }}<br />
                {{ $t("CommonSetting.installAndRestart") }}
                <a target="browser" href="https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#latest-supported-redistributable-version">{{ $t("CommonSetting.goToDownload") }}</a></div>
            </div>
            <span class="error-tip" v-else>
              {{ $t("CommonSetting.startServiceFailed") }}
            </span>
          </div>
        </div>
      </div>
    </nocode-base-setting-panel>
    <nocode-base-setting-panel :title="$t('SystemMigration.panelTitle')">
      <div class="setting-item">
        <span class="title">{{ $t('SystemMigration.exportLabel') }}{{ getI18nLabelColon() }}</span>
        <el-button class="migration-btn" @click="systemMigrationExportVisible = true">
          {{ $t('SystemMigration.openExport') }}
        </el-button>
      </div>
      <div class="setting-item">
        <span class="title">{{ $t('SystemMigration.importLabel') }}{{ getI18nLabelColon() }}</span>
        <el-button class="migration-btn" @click="systemMigrationImportVisible = true">
          {{ $t('SystemMigration.openImport') }}
        </el-button>
      </div>
      <div class="setting-item migration-status-item" v-if="systemMigrationApplyFailed">
        <span class="title"></span>
        <div class="migration-status">
          <span class="tip error migration-status-text">{{ migrationApplyErrorText }}</span>
          <el-button v-if="systemMigrationApplyCanRetry" class="migration-btn" @click="emit('retry-system-migration-apply')">
            {{ $t('SystemMigration.retryApply') }}
          </el-button>
        </div>
      </div>
    </nocode-base-setting-panel>
    <nocode-base-setting-panel :title="$t('CommonSetting.otherSetting')">
      <div class="setting-item">
        <span class="title">{{ $t("CommonSetting.clearCache") }}{{ getI18nLabelColon() }}</span>
        <el-button class="btn-clear-cache" :loading="isClearCache" @click="clearCache">
          {{ $t('commmonSetting.clearCache') }}
        </el-button>
      </div>
    </nocode-base-setting-panel>
    <system-migration-export-dialog v-model="systemMigrationExportVisible" />
    <system-migration-import-dialog v-model="systemMigrationImportVisible" />
  </nocode-panel>
</template>

<script lang='ts' setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from "axios";
import { ElLoading, ElMessage, FormInstance, ElUpload, UploadProps, UploadRawFile, genFileId, UploadFile } from "element-plus";
import { CircleCheck, RefreshRight } from "@element-plus/icons-vue";
import i18next from "i18next";
import { useSettingStore, usePassportStore } from "@renderer/stores";
import { ProxyOptions } from '@common/types/user';
import { SystemMigrationApplyStatus } from '@common/types/system-migration';
import { getSocket } from "@renderer/utils";
import { officeApi } from '@renderer/utils/api/office'
import mime from 'mime';
import { bootLanguageStore } from '@renderer/utils/storage';
import { getI18nLabelColon } from '@common/utils/i18n';

const props = defineProps<{
  officePluginInfo: {
    installed?: boolean,
    running?: boolean
  },
  systemMigrationApplyStatus?: SystemMigrationApplyStatus,
}>();

const emit = defineEmits<{
  (event: 'retry-system-migration-apply'): void;
}>();

const settingState = useSettingStore();
const isClearCache = ref(false);
const passportState = usePassportStore();
const languageOptions = [
  { label: "简体中文", value: "zh-CN" },
  { label: "繁体中文", value: "zh-TW" },
  { label: "English", value: "en" },
];
const normalizeLanguage = (lang?: string) => {
  const value = (lang || "").toLowerCase();
  if (value.startsWith("zh-tw") || value.startsWith("zh-hk")) return "zh-TW";
  if (value.startsWith("en")) return "en";
  return "zh-CN";
}
const currentLanguage = ref(normalizeLanguage(i18next.language));

const getLanguage = async () => {
  const result = await axios.get<string>("/user/get-language");
  currentLanguage.value = normalizeLanguage(result.data);
}

const handleChangeLanguage = async (lang: string) => {
  const nextLanguage = normalizeLanguage(lang);
  currentLanguage.value = nextLanguage;
  await i18next.changeLanguage(nextLanguage);
  await axios.post('/user/change-lang', { lang: nextLanguage });
  bootLanguageStore.set(nextLanguage);
}

getLanguage();

const installProgress = ref(0)
const isInstalling = ref(false);
const isInstallDisabled = computed(() =>{
  return isInstalling.value || isInstallSuccess.value;
})
const uploadRef = ref<InstanceType<typeof ElUpload>>();
// 是否开始安装
const isInstallStart = ref(false);
// 是否成功安装插件
const isInstallSuccess = ref(false)
// 是否开始启动服务
const isStartStart = ref(false)
// 是否启动服务结束
const isStartEnd = ref(false)
// 是否成功启动服务
const isStartSuccess = ref(false)
const isSystemDLLMiss = ref(false);
const isRestarting = ref(false);
const installType = ref("online");
const systemMigrationExportVisible = ref(false);
const systemMigrationImportVisible = ref(false);
const systemMigrationApplyFailed = computed(() => props.systemMigrationApplyStatus?.status === 'failed');
const systemMigrationApplyCanRetry = computed(() => !!props.systemMigrationApplyStatus?.canRetry);
const migrationApplyErrorText = computed(() => {
  const message = props.systemMigrationApplyStatus?.message?.trim();
  if (!message) {
    return i18next.t('SystemMigration.applyFailed');
  }
  return `${i18next.t('SystemMigration.applyFailed')}: ${message}`;
});

// 清除缓存
const clearCache = async()=>{
  isClearCache.value = true;
  const result = await axios.get("/user/clear-cache");
  isClearCache.value = false;
  ElMessage.success(i18next.t("basicSetting.clearSuccess"));
}

const proxyFormItems = [
  {
    name: 'host',
    get label() { return i18next.t("proxySetting.proxyHost") },
    type: 'input',
  },
  {
    name: 'port',
    get label() { return i18next.t("proxySetting.proxyPort") },
    type: 'number',
  },
  {
    name: 'username',
    get label() { return i18next.t("proxySetting.proxyUsername") },
    type: 'input',
    get placeholder() { return i18next.t("proxySetting.proxyUsernamePlaceholder") }
  },
  {
    name: 'password',
    get label() { return i18next.t("proxySetting.proxyPassword") },
    type: 'input',
    inputType: 'password',
    get placeholder() { return i18next.t("proxySetting.proxyPasswordPlaceholder") }
  }
];
const proxyFormRef = ref<FormInstance>();

const proxyForm = reactive<ProxyOptions>({
  ...settingState.proxy,
})

onMounted(async () => {
  const loaders = [
    settingState.getProxyOptions(),
  ];
  await Promise.allSettled(loaders);
  Object.assign(proxyForm, settingState.proxy);
});

// 网络代理设置
const setProxyOn = (val: boolean) => {
  proxyForm.on = val;
  saveProxy()
}

const saveProxy = async () => {
  const res = await settingState.setProxyOptions({ ...proxyForm });
  if (res) {
    ElMessage.success(i18next.t("proxySetting.saveSuccess"));
  } else {
    ElMessage.error(i18next.t("proxySetting.proxyConnectionFailed"));
  }
}

const installPlugin = async () => {
  handleClear()
  await installPrintPlugin();
}

// 下载打印插件
const installPrintPlugin = async (): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    installType.value = "online";
    isInstallStart.value = true;
    isInstalling.value = true;
    installProgress.value = 0;
    let stop;

    const installSocket = await getSocket({
      ioOptions: {
        query: {
         installPlugin: true, 
        }
      }
    });
    // 连接
    installSocket.on('connect', () => {
      // 更新进度条
      installSocket.on('progress', (progress) => {
        installProgress.value = progress;
      });
      // 下载完成
      installSocket.on('downloaded', () => {
        installProgress.value = 80;
        stop = startManualInstall(80);
      });
      // 解压完成
      installSocket.on('unzip', () => {
        stop();
        isInstalling.value = false;
        isInstallSuccess.value = true
        // 开始启动服务
        isStartStart.value = true
      });
      // 下载出错
      installSocket.on('download-error', ({ message, reason }) => {
        isInstalling.value = false;
        isInstallSuccess.value = false
        installSocket.disconnect();
        const errorMessage = message || reason || i18next.t('CommonSetting.pluginInstallFailed');
        ElMessage.error(errorMessage);
        console.error(errorMessage);
        reject(new Error(errorMessage));
      });
      // 重复下载提醒
      installSocket.on('install-multiple', ({ message, ...info }) => {
        ElMessage.warning(message);
        if (info.status === "downloading") {
          isInstallStart.value = true;
          isInstalling.value = true;
        } else if (info.status  === "downloaded") {
          installProgress.value = 80;
          stop = startManualInstall(80);
        } else if (info.status  === "unzip") {
          installProgress.value = 100;
          isInstalling.value = false;
          isInstallSuccess.value = true
          // 开始启动服务
          isStartStart.value = true
        }
      });
      // 启动服务成功
      installSocket.on('startup-success', async() => {
        // 等待5-10秒的随机时间
        const randomDelay = Math.floor(Math.random() * 3000) + 2000; // 生成2-5秒的随机时间
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        isStartEnd.value = true
        isStartSuccess.value = true
      });
      // 启动服务失败
      installSocket.on('startup-fail', (type: string) => {
        isStartEnd.value = true
        isStartSuccess.value = false;
        if (type === "dll") {
          isSystemDLLMiss.value = true;
          ElMessage.error(`${i18next.t("CommonSetting.installPluginBeforeStart")}`);
        }
      })
      // 关闭
      installSocket.on('closed', (finalPath) => {
        installSocket.disconnect();
        resolve(finalPath);
      });
      //开始下载
      installSocket.emit('install-print-plugin');
    });
  });
}

const handleExceed: UploadProps['onExceed'] = (files) => {
  uploadRef.value!.clearFiles()
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  uploadRef.value!.handleStart(file);
}

const startManualInstall = (startValue = 0) => {
  isInstallStart.value = true;
  isInstalling.value = true;
  installProgress.value = startValue;
  // 模拟假的进度条
  const timer = setInterval(() => {
    if (installProgress.value >= 99) {
      installProgress.value = 99;
    } else if (installProgress.value >= 95) {
      installProgress.value += (Math.random() * 0.1);
    } else if (installProgress.value >= 80) {
      installProgress.value += (Math.random() * 0.5);
    } else if (installProgress.value >= 50) {
      installProgress.value += (Math.random() * 0.8);
    } else {
      installProgress.value += (Math.random() * 2);
    }
  }, 200);
  return () => {
    clearInterval(timer);
    installProgress.value = 100;
  }
}

const handleUploadPlugin = async (uploadFile: UploadFile) => {
  handleClear();
  const type = mime.getType(uploadFile.name.substring(uploadFile.name.lastIndexOf("."))) ?? '';
  if (type !== 'application/zip') {
    ElMessage.error(`${i18next.t('CommonSetting.onlyZipCanUpload')}`);
    return; // 阻止文件上传
  }
  installType.value = 'manual';
  const formData = new FormData();
  formData.append('file', uploadFile.raw);
  const stop = startManualInstall();
  const res = await officeApi.installOfficePlugin(formData).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
    isInstalling.value = false;
    isInstallSuccess.value = false;
  })
  console.log("res:", res);
  stop();
  if (res) {
    await new Promise(resolve => setTimeout(resolve, 300));
    isInstalling.value = false;
    isInstallSuccess.value = true;
    isStartStart.value = true;
    // 插件安装成功，开始启动服务
    handleStart();
  }
}

const handleStart = async () => { 
  isRestarting.value = true;
  isStartStart.value = true;
  isStartEnd.value = false;
  isSystemDLLMiss.value = false;
  const res = await officeApi.startUp();
  isStartEnd.value = true;
  isRestarting.value = false;
  if (!res) {
    isStartSuccess.value = false;
  } else if (!res?.success) {
    isStartSuccess.value = false;
    if (res?.type === "dll") {
      isSystemDLLMiss.value = true;
      ElMessage.error(i18next.t('CommonSetting.installPluginBeforeStart'));
    }
  } else {
    isStartSuccess.value = true;
  }
}

function handleClear() {
  installProgress.value = 0
  isInstallStart.value = false;
  isInstalling.value = false;
  isInstallSuccess.value = false
  isStartStart.value = false
  isStartEnd.value = false
  isStartSuccess.value = false
  isSystemDLLMiss.value = false;
}
</script>

<style lang='scss' scoped>
:deep(.el-input) {
  height: 32px;
  width: 100%;

  .el-input__wrapper {
    border-radius: 4px;
    background-color: var(--bg-color-overlay);

    .el-input__inner {
      color: var(--text-color-regular);
    }
  }

  .el-input-group__append {
    background-color: var(--bg-color-overlay);

    svg {
      color: var(--text-color-regular);
    }
  }
}

:deep(.proxy-form) {
  .el-input__inner {
    text-align: left;
  }
}

.setting-item {
  margin-bottom: 16px;
  width: 100%;
  // height: 32px;
  display: flex;
  align-items: center;

  .title {
    display: inline-block;
    font-size: 14px;
    width: 70px;
    line-height: 20px;
    margin-right: 16px;
    color: var(--text-color-regular);

    &.system-dll-miss {
      margin-bottom: 45px;
    }
  }

  .el-button {
    width: 100px;
    height: 32px;
    border-radius: 4px;
    padding-top: 8px;
  }

  .local-import {
    background-color: var(--bg-color-overlay);
    border: none;
  }

  .tip {
    font-weight: 400;
    font-size: 12px;
    line-height: 20px;
    letter-spacing: 0%;
    
    height: 100%;
    margin-left: 8px;
    white-space: nowrap;
    display: flex;
    align-items: flex-end;
    
    &.error {
      color: #f9484e;
    }

    &.success {
      color: #5ec431;
    }
  }

  .wrapper {
    flex: 1;
    height: 100%;
    display: flex;
  }

  .radio-container {
    display: flex;
    justify-content: flex-start;

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

  .startup-body {
    .starting {
      .el-button {
        background-color: #fff;
      }
    }
    .start-success {
      .el-button {
        background-color: #fff;
      }
      .el-icon {
        margin-right: 2px;
      }
    }
    .restart {
      .el-icon {
        margin-right: 2px;
      }
      .dll-tip {
        margin-top: 8px;
        line-height: 14px;
        color: var(--el-color-danger);
        a {
          color: #0089ff;
        }
      }
    .error-tip {
        margin-left: 8px;
        position: relative;
        top: 5px;
        font-size: 12px;
        color: var(--el-color-danger);
      }
    }
  }

}

.btn-common {
  width: 48px;
  height: 32px;
  font-size: 12px;
  border-radius: 4px;
  color: var(--color-primary);
  background-color: var(--bg-color-overlay);
}

.common-path .el-input {
  margin-right: 10px;
}

.btn-clear-cache {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-color-regular);
  background-color: var(--bg-color-overlay);
  border: none;
  transition: color 0.3s ease;

  &:hover {
    color: var(--color-primary);
  }
}

.migration-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-color-regular);
  background-color: var(--bg-color-overlay);
  border: none;
  transition: color 0.3s ease;

  &:hover {
    color: var(--color-primary);
  }
}

.migration-status-item {
  align-items: flex-start;
}

.migration-status {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.migration-status-text {
  max-width: 360px;
  white-space: pre-line;
  align-items: flex-start;
}

.language-select {
  width: 160px;
  :deep(.el-select__wrapper) {
    background-color: var(--bg-color-overlay);
    border-radius: 4px;
    box-shadow: none;
  }
}
</style>
