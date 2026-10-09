<template>
  <div class="edit-db-dialog">
    <el-dialog :modelValue="modelValue" width="400px" :title="$t('EditDBDialog.title')"
      @update:modelValue="emit('update:modelValue', $event)" align-center draggable :close-on-click-modal="false" :close-on-press-escape="!step3Completed"
      destroy-on-close ref="dialogRef" :show-close="!step3Completed" :before-close="onBeforeClose">
      
      <div class="dialog-body">
        <!-- 警告信息 -->
        <div class="warning-box">
          <el-icon class="warning-icon"><i-ep-warning /></el-icon>
          <span class="warning-text">{{ $t('EditDBDialog.serverWarning') }}</span>
        </div>

        <el-steps class="edit-db-steps" direction="vertical" :active="activeStep">
          <el-step :title="$t('EditDBDialog.step1Title')" :class="{ active: currentStep == 1, completed: step1Completed }">
            <template #icon>
              <div class="step-dot"></div>
            </template>
            <template #description>
              <div class="step-descriptions">
                <div class="step-desc">1. {{ $t('EditDBDialog.step1Desc1') }}</div>
                <div class="step-desc">2. {{ $t('EditDBDialog.step1Desc2') }}</div>
              </div>
              <el-button 
                :class="['step-button']"
                type="primary"
                :plain="step1Completed"
                :disabled="currentStep !== 1"
                :loading="currentStep == 1 && loading"
                @click="handleStep1"
              >
                {{ step1Completed ? $t('EditDBDialog.step1ButtonDone') : $t('EditDBDialog.step1ButtonServer') }}
              </el-button>
            </template>
          </el-step>

          <el-step :title="$t('EditDBDialog.step2Title')" :class="{ active: currentStep == 2, completed: step2Completed }">
            <template #icon>
              <div class="step-dot" :class="{ active: currentStep >= 2, completed: step2Completed }"></div>
            </template>
            <template #description>
              <el-button 
                :class="['step-button']"
                type="primary"
                :plain="step2Completed"
                :disabled="currentStep !== 2"
                :loading="currentStep == 2 && loading"
                @click="handleShowDbConnect"
              >
                {{ (step2Completed || isToEmbedded) ? $t("alreadySetting") : $t('EditDBDialog.step2Button') }}
              </el-button>
            </template>
          </el-step>

          <el-step :title="$t('EditDBDialog.step3Title')" :class="{ active: currentStep == 3, completed: step3Completed }">
            <template #icon>
              <div class="step-dot" :class="{ active: currentStep >= 3, completed: step3Completed }"></div>
            </template>
            <template #description>
              <div class="migration-wrapper">
                <el-button 
                  :class="['step-button']"
                  type="primary"
                  :plain="step3Completed"
                  :disabled="currentStep !== 3 || step3Completed"
                  :loading="currentStep == 3 && loading"
                  @click="handleStep3"
                >
                  {{ $t('EditDBDialog.step3Button') }}
                </el-button>
                <el-progress :stroke-width="8" :percentage="+migrationProgress.toFixed(2)" v-if="(currentStep == 3) && loading" />
                <div class="migration-status" :class="migrationStatus" v-if="!['normal', 'migrating'].includes(migrationStatus)">
                  <el-icon :size="16">
                    <i-ep-circle-close v-if="migrationStatus === 'failed'"></i-ep-circle-close>
                    <i-ep-circle-check v-else-if="migrationStatus === 'success'"></i-ep-circle-check>
                  </el-icon>
                  {{ migrationStatusText }}
                </div>
              </div>
            </template>
          </el-step>
        </el-steps>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button class="cancel-btn" @click="handleCancel" v-if="!step3Completed">{{ $t('EditDBDialog.cancel') }}</el-button>
          <el-button type="primary" @click="handleConfirm" :disabled="!step3Completed">{{ $t('EditDBDialog.confirmAndRestart') }}</el-button>
        </div>
      </template>
    </el-dialog>
    <edit-db-connect-dialog v-model="dbSettingVisible" :config="settingState.dbInfo" @confirm="handleStep2" />
  </div>
</template>

<script lang="ts" setup>
import { DialogInstance, ElMessage } from 'element-plus';
import { computed, ref, watch } from 'vue';
import axios from "axios";
import { useSettingStore } from '@renderer/stores';
import i18next from 'i18next';
import { DBInfo, FormDatabaseType } from '@common/types/nocode';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  isToEmbedded: boolean,
}>(), {
  isToEmbedded: false,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean),
  (event: 'confirm'),
}>();

const settingState = useSettingStore();
const dialogRef = ref<DialogInstance>();
// 当前步骤（1-3）
const currentStep = ref(1);
// 步骤完成状态
const step1Completed = computed(() => currentStep.value > 1);
const step2Completed = computed(() => currentStep.value > 2);
const step3Completed = ref(false);

const activeStep = computed(() => Math.max(1, currentStep.value - 1));

// 重置状态
const resetState = () => {
  currentStep.value = 1;
  step3Completed.value = false;
};

// 监听对话框关闭，重置状态
watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    resetState();
  }
});

const loading = ref(false);
const handleStep1 = async () => {
  if (currentStep.value !== 1) return;
  loading.value = true;
  loading.value = false;
  if (props.isToEmbedded) {
    currentStep.value = 3;
  } else {
    currentStep.value = 2;
  }
};

const dbSettingVisible = ref(false);
const handleShowDbConnect = () => {
  if (currentStep.value !== 2) return;
  dbSettingVisible.value = true;
};
const config = ref<DBInfo>({ type: FormDatabaseType.EMBEDDED });
const handleStep2 = (_config: DBInfo) => {
  config.value = _config;
  currentStep.value = 3;
}

const migrationProgress  = ref(0);
const migrationStatus = ref("normal");
const migrationStatusText = computed(() => {
  if (migrationStatus.value === 'success') return i18next.t('EditDBDialog.migrationSuccessText');
  else if (migrationStatus.value === 'failed') return i18next.t('EditDBDialog.migrationFailedText');
});
const startManualInstall = (startValue = 0) => {
  migrationProgress.value = startValue;
  // 模拟假的进度条
  const timer = setInterval(() => {
    if (migrationProgress.value >= 99) {
      migrationProgress.value = 99;
    } else if (migrationProgress.value >= 95) {
      migrationProgress.value += (Math.random() * 0.1);
    } else if (migrationProgress.value >= 80) {
      migrationProgress.value += (Math.random() * 0.2);
    } else if (migrationProgress.value >= 50) {
      migrationProgress.value += (Math.random() * 0.4);
    } else {
      migrationProgress.value += (Math.random() * 0.5);
    }
  }, 1000);
  return () => {
    clearInterval(timer);
    migrationProgress.value = 100;
  }
}
const handleStep3 = async () => {
  if (currentStep.value !== 3) return;
  migrationStatus.value = "migrating";
  loading.value = true;
  // 数据迁移
  // 运行假进度条
  const stop = startManualInstall();
  if (props.isToEmbedded) {
    config.value.type = FormDatabaseType.EMBEDDED;
  }
  const res = await axios.post("/form-data/data-migration", config.value).then(() => true).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
    return false;
  });
  stop();
  await new Promise((resolve, reject) => setTimeout(() => resolve(true), 500))
  loading.value = false;
  if (!res) {
    migrationStatus.value = "failed";
    return;
  }
  migrationStatus.value = "success";
  step3Completed.value = true;
};

const onBeforeClose: DialogInstance['beforeClose'] = (done) => {
  if (loading.value) {
    ElMessage.warning(i18next.t('EditDBDialog.loadingTip'));
    return false;
  }
  done();
}

const handleCancel = () => {
  onBeforeClose(() => {
    dialogRef.value.visible = false;
  })
};

const handleConfirm = () => {
  emit('confirm');
  dialogRef.value.visible = false;
};

</script>

<style scoped lang="scss">
.edit-db-dialog {
  :deep(.el-dialog) {
    padding: 0;
    border-radius: 8px;
    overflow: hidden;
    background-color: var(--bg-color-page);
    box-shadow: 0px 8px 20px #0000001a;

    .el-dialog__header {
      margin: 0;
      padding: 0;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--border-color);
      position: relative;

      .el-dialog__title {
        font-size: 16px;
        font-weight: 500;
        color: #1D2129;
      }

      .el-dialog__headerbtn {
        top: 50%;
        transform: translateY(-50%);
        right: 16px;
        width: 16px;
        height: 16px;
        .el-dialog__close {
          font-size: 16px;
        }
      }
    }

    .el-dialog__body {
      padding: 20px;
    }

    .dialog-body {
      .warning-box {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 12px;
        background-color: var(--el-color-warning-light-9);
        color: var(--el-color-warning);
        border-radius: 4px;
        margin-bottom: 20px;

        .warning-icon {
          flex-shrink: 0;
          color: #FF9900;
          font-size: 16px;
          margin-top: 2px;
        }

        .warning-text {
          font-size: 14px;
          line-height: 1.5;
        }
      }

      .edit-db-steps {
        .el-step {
          .el-step__head {
            width: 10px;
            .el-step__line {
              top: 10px;
              bottom: -10px;
              left: 4px;
              .el-step__line-inner {
                border-width: 2px;
              }
            }
            .el-step__icon {
              width: 100%;
              border: none;
              background: transparent;

              .step-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background-color: #D9D9D9;
                transition: all 0.3s;
              }
            }
          }

          .el-step__main {
            .el-step__title {
              font-size: 14px;
              font-weight: 500;
              color: #1D2129;
              line-height: 20px;
            }
    
            .el-step__description {
              margin-top: 8px;
              .step-descriptions {
                margin-bottom: 12px;
      
                .step-desc {
                  font-size: 12px;
                  color: #86909C;
                  line-height: 1.5;
                  margin-bottom: 4px;
      
                  &:last-child {
                    margin-bottom: 0;
                  }
                }
              }
              .step-button {
                height: 32px;
                padding: 5px 16px;
                border-radius: 4px;
                font-size: 14px;
                min-width: 80px;

                &.disabled {
                  background-color: #F7F8FA;
                  border: 1px dashed #D9D9D9;
                  color: #C9CDD4;
                  cursor: not-allowed;
                  
                  &:hover {
                    background-color: #F7F8FA;
                    border-color: #D9D9D9;
                    color: #C9CDD4;
                  }
                }

                &.done {
                  background-color: #F7F8FA;
                  border: 1px dashed #D9D9D9;
                  color: #86909C;
                  cursor: default;
                  
                  &:hover {
                    background-color: #F7F8FA;
                    border-color: #D9D9D9;
                    color: #86909C;
                  }
                }
              }
              .migration-wrapper {
                display: flex;
                column-gap: 12px;
                .el-progress {
                  flex: 1;
                  .el-progress__text {
                    text-align: right;
                    margin: 0;
                  }
                }

                .migration-status {
                  margin-left: 6px;
                  display: flex;
                  align-items: center;
                  column-gap: 4px;
                  font-size: 14px;

                  &.failed {
                    color: var(--el-color-danger);
                  }
                  &.success {
                    color: var(--el-color-success);
                  }
                }
              }
            }
          }

          &:not(:last-of-type) {
            .el-step__main {
              padding-bottom: 24px;
            }
          }

          &.active, &.completed {
            .el-step__line {
              .el-step__line-inner {
                transition-delay: 0ms !important;
                border-width: 1px !important;
                height: 100% !important;
                color: var(--el-color-primary);
                border-color: var(--el-color-primary)
              }
            }
            .step-dot {
              background-color: var(--el-color-primary) !important;
            }
          }
        }
        
      }
    }

    .el-dialog__footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
      
      .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .el-button {
        padding: 5px 16px;
        border-radius: 4px;
        height: 32px;
        font-size: 14px;
        margin: 0;
      }
      
      .cancel-btn {
        color: var(--el-text-color-regular);
        background-color: #F2F3F5;
        border: none;
        &:hover {
          color: var(--el-color-primary);
          border-color: var(--el-color-primary-light-7);
          background-color: var(--el-color-primary-light-9);
        }
      }
    }
  }
}
</style>
