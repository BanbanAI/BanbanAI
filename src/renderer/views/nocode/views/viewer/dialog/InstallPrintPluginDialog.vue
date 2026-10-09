<template>
  <div class="dialog-container">
    <el-dialog 
      class="install-print-plugin-dialog"
      v-model="dialogVisible" 
      :title="$t('InstallPrintPluginDialog.installPrintPlugin')" 
      draggable 
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      :before-close="beforeClose"
    >
      <div class="dialog-content">
        <div class="dialog-body">
          <div class="step-indicator">
            <div class="step-dot" :class="{ active: step >= 1 }"></div>
            <div class="step-line" :class="{ active: step === 2 }"></div>
            <div class="step-dot" :class="{ active: step === 2 }"></div>
          </div>
          <div class="step-content">
            <div class="install-step">
              <div class="step-title">{{ $t('InstallPrintPluginDialog.installPlugin') }}</div>
              <div class="step-body">
                <div class="btns">
                  <el-button class="online-install" 
                    type="primary" 
                    @click="startInstall" 
                    :loading="isInstalling && installType === 'online'" 
                    :disabled="isInstallDisabled"
                  >
                    <div class="btn-content">
                      <el-icon :size="16"><i-table-download /></el-icon>
                      <div class="btn-text">{{ $t('InstallPrintPluginDialog.onlineInstall') }}</div>
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
                    :disabled="isInstallDisabled"
                    ref="uploadRef"
                  >
                    <el-button 
                      class="local-import" 
                      :loading="isInstalling && installType === 'manual'"
                      :disabled="isInstallDisabled"
                    >
                      <div class="btn-content">
                        <el-icon :size="16"><i-table-import /></el-icon>
                        <div class="btn-text">{{ $t('InstallPrintPluginDialog.localImport') }}</div>
                      </div>
                    </el-button>
                  </el-upload>
                </div>
                <template v-if="isInstallStart">
                  <div class="install-progress" v-if="isInstalling">
                    <div class="progress-text">{{ $t('InstallPrintPluginDialog.installing') }} {{ +installProgress.toFixed(2) }}%</div>
                    <el-progress :stroke-width="8" :show-text="false" :percentage="+installProgress.toFixed(2)" />
                  </div>
                  <div class="install-success" v-else-if="isInstallSuccess">
                    <div class="title">
                      <div class="icon"><el-icon><CircleCheckFilled /></el-icon></div>
                      <div class="text">{{ $t('InstallPrintPluginDialog.installSuccess') }}</div>
                    </div>
                    <div class="tips">{{ $t('InstallPrintPluginDialog.doNotCloseWin') }}</div>
                  </div>
                  <div class="install-fail" v-else>
                    <div class="title">
                      <div class="icon"><el-icon><CircleCloseFilled /></el-icon></div>
                      <div class="text">{{ $t('InstallPrintPluginDialog.installFail') }}</div>
                    </div>
                    <div class="tips">{{ $t('InstallPrintPluginDialog.reinstallOrImport') }}</div>
                  </div>
                </template>
              </div>
            </div>
            <div class="start-step">
              <div class="step-title">{{ $t('InstallPrintPluginDialog.startService') }}</div>
              <div class="step-body">
                <div class="default" v-if="!isStartStart">
                  <el-button disabled>{{ $t('InstallPrintPluginDialog.startNow') }}</el-button>
                </div>
                <div class="starting" v-else-if="!isStartEnd">
                  <el-button type="primary" plain :loading="true" disabled>
                    <template #loading>
                      <div class="custom-loading" style="margin-top: 2px;">
                        <el-icon :size="16">
                          <i-ven-loading/>
                        </el-icon>
                      </div>
                    </template>
                    {{ $t('InstallPrintPluginDialog.starting') }}
                  </el-button>
                </div>
                <div class="start-success" v-else-if="isStartSuccess">
                  <el-button type="success" plain disabled>
                    <el-icon size="16"><CircleCheck /></el-icon>
                    {{ $t('InstallPrintPluginDialog.startSuccess') }}
                  </el-button>
                </div>
                <div class="restart" v-else>
                  <el-button type="primary" :loading="isRestarting" @click.stop="handleStart">
                    <el-icon size="16"><RefreshRight /></el-icon>
                    {{ $t('InstallPrintPluginDialog.restart') }}
                  </el-button>
                  <div class="dll-tip" v-if="isSystemDLLMiss">
                    <div class="title">{{ $t('InstallPrintPluginDialog.lackRuntimeComponent') }}</div>
                    <div class="tips">
                      {{ $t('InstallPrintPluginDialog.notInstalled') }} <b>{{ $t('InstallPrintPluginDialog.vcRuntimeLib') }}</b>{{ $t('InstallPrintPluginDialog.pluginStartFailCause') }}<br />
                      {{ $t('InstallPrintPluginDialog.installLibAndRestart') }}
                      <a target="_blank" href="https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#latest-supported-redistributable-version">{{ $t('installPrintPluginDialog.goToDownload') }}</a></div>
                  </div>
                  <div v-else class="tips">{{ $t('InstallPrintPluginDialog.startFailRestart') }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <el-button @click="handleCancel">{{ $t('InstallPrintPluginDialog.cancel') }}</el-button>
          <el-button type="primary" @click="handleConfirm">{{ $t('InstallPrintPluginDialog.confirm') }}</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { CircleCloseFilled, CircleCheckFilled, CircleCheck, RefreshRight } from "@element-plus/icons-vue";
import { ElMessage, UploadProps, UploadFile, ElUpload, UploadRawFile, genFileId } from 'element-plus';
import { getSocket, officeApi } from "@renderer/utils";
import mime from 'mime';
import i18next from 'i18next';

const dialogVisible = ref(false)
const step = ref(1)
const installProgress = ref(0)

const isInstalling = ref(false);
const isInstallDisabled = computed(() =>{
  return isInstalling.value || isInstallSuccess.value;
})

const uploadRef = ref<InstanceType<typeof ElUpload>>();
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

const startInstall = async() => {
  clearDialog()
  // isInstallStart.value = true
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
        step.value = 2
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
        const errorMessage = message || reason || i18next.t('InstallPrintPluginDialog.installFail');
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
          step.value = 2
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
          ElMessage.error(i18next.t('InstallPrintPluginDialog.startFailLackComponent'));
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
  clearDialog();
  const type = mime.getType(uploadFile.name.substring(uploadFile.name.lastIndexOf("."))) ?? '';
  if (type !== 'application/zip') {
    ElMessage.error(i18next.t('InstallPrintPluginDialog.onlyUploadZip'));
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
  stop();
  if (res) {
    await new Promise(resolve => setTimeout(resolve, 300));
    step.value = 2;
    isInstalling.value = false;
    isInstallSuccess.value = true;
    isStartStart.value = true;
    // 插件安装成功，开始启动服务
    handleStart();
  }
}


const handleCancel = () => { 
  if(isInstalling.value) {
    ElMessage.warning(i18next.t('InstallPrintPluginDialog.installingWait'));
  } else if (isStartStart.value && !isStartEnd.value) {
    ElMessage.warning(i18next.t('InstallPrintPluginDialog.startingWait'));
  } else {
    dialogVisible.value = false
    clearDialog()
  }
};

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
      ElMessage.error(i18next.t('InstallPrintPluginDialog.startFailLackComponent'));
    }
  } else {
    isStartSuccess.value = true;
  }
}

const handleConfirm = () => {
  if(isInstalling.value) {
    ElMessage.warning(i18next.t('InstallPrintPluginDialog.installingWait'));
  } else if (isStartStart.value && !isStartEnd.value) {
    ElMessage.warning(i18next.t('InstallPrintPluginDialog.startingWait'));
  } else {
    dialogVisible.value = false
    clearDialog()
  }
};

function clearDialog() {
  step.value = 1
  installProgress.value = 0
  isInstallStart.value = false;
  isInstalling.value = false;
  isInstallSuccess.value = false
  isStartStart.value = false
  isStartEnd.value = false
  isStartSuccess.value = false
  isSystemDLLMiss.value = false;
}

const beforeClose = (done: () => void) => {
  // 如果正在安装中，不允许关闭
  if(isInstalling.value) {
    ElMessage.warning(i18next.t('InstallPrintPluginDialog.installingWait'));
    return; // 不执行done()
  } else if(isStartStart.value && !isStartEnd.value) {
    ElMessage.warning(i18next.t('InstallPrintPluginDialog.startingWait'));
    return; // 不执行done()
  } else {
    // 如果安装，启动操作已完成，则允许关闭
    clearDialog();
    done();
  }
}; 

defineExpose({
  show: () => {
    dialogVisible.value = true;
  },
  close: () => {
    dialogVisible.value = false
  }
})
</script>
  
<style scoped lang="scss">
.dialog-container {
  :deep(.install-print-plugin-dialog).el-dialog {
    width: 400px;
    // height: 400px;
    padding: 0px;
    border-radius: 8px;
    background-color: var(--color-white);
    
    .el-dialog__header {
      height: 48px;
      border-bottom: 1px solid var(--border-color);
      font-weight: 400;
      display: flex;
      justify-content: center;
      align-items: center;
      .el-dialog__title {
        font-size: 16px;
        margin: 12px 0 0 20px;
      }
    }

    .el-dialog__body {
      display: flex;
      padding: 0;

      .dialog-content {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        .el-button {
          width: 100px;
          height: 32px;
          border-radius: 4px;
          padding-top: 8px;
        }
        .dialog-body {
          // height: 288px;
          padding: 24px 20px;
          display: flex;

          .step-indicator {
            .step-dot {
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background-color: var(--border-color);
            }
            .step-dot.active {
              background-color: var(--color-primary);
            } 
            .step-line {
              width: 1.5px;
              height: 162px;
              background-color: var(--border-color);
              margin-left: 4.5px;
            }
            .step-line.active {
              background-color: var(--color-primary);
            }
          }
          .step-content {
            width: 100%;
            margin-left: 16px;
            .step-title {
              font-size: 14px;
              color: var(--text-color-primary);
            }
            .install-step {
              height: 170px;
              .step-body {
                margin-top: 12px;
                .btns {
                  display: flex;
                  margin-bottom: 24px;
                  .online-install,
                  .local-import {
                    .btn-content {
                      display: flex;
                      justify-self: center;
                      align-items: center;
                      .btn-text {
                        margin-left: 4px;
                      }
                    }
                  }
                  .online-install {
                    margin-right: 8px;
                  }
                  .local-import {
                    background-color: #F2F3F5;
                    border: none;
                  }
                }
                .install-progress {
                  .progress-text {
                    margin-bottom: 8px;
                  }
                }
                .install-fail,
                .install-success {
                  .title {
                    display: flex;
                    .icon {
                      width: 20px;
                      height: 20px;
                      color: var(--el-color-danger);
                    }
                    .text {
                      font-size: 14px;
                      color: var(--el-color-danger);
                    }
                  }
                  .tips {
                    margin-top: 4px;
                    font-size: 14px;
                    color: #86909C;
                  }
                }
                .install-success {
                  .icon {
                    color: #52C41A !important;
                  }
                  .text {
                    color: #52C41A !important;
                  }
                }
              }
            }
            .start-step {
              .step-title {
                margin-bottom: 12px;
              }
              .step-body {
                .default {
                  .el-button {
                    color: #C9CDD4;
                    background-color: #F7F8FA;
                    border: none;
                  }
                }
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
                    color: var(--el-color-danger);
                    a {
                      color: #0089ff;
                    }
                  }
                  .tips {
                    margin-top: 8px;
                    font-size: 12px;
                    line-height: 14px;
                    color: var(--el-color-danger);
                  }
                }
              }
            }
          }
        }
        .dialog-footer {
          border-top: 1px solid var(--border-color);
          height: 64px;
          padding-right: 16px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          
          .el-button {
            width: 52px;
          }
        }
      }
    }
  }
}
</style>