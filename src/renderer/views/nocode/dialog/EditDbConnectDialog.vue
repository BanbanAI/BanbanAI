<template>
  <div class="edit-db-connect-dialog">
    <el-dialog :modelValue="modelValue" width="400px" :title="$t('EditDBConnectDialog.title')"
      @update:modelValue="emit('update:modelValue', $event)" align-center draggable :close-on-click-modal="false"
      destroy-on-close @closed="handleClosed">
      
      <div class="dialog-body">
        <el-form :model="formData" label-width="90px" class="db-form" :rules="formRules" ref="formRef">
          <el-form-item :label="$t('EditDBConnectDialog.typeLabel')">
            <el-select v-model="formData.type" :placeholder="$t('EditDBConnectDialog.typePlaceholder')" :disabled="connectStatus === 'connecting'" style="width: 100%">
              <el-option 
                v-for="option in databaseOptions" 
                :key="option.value"
                :label="option.label" 
                :value="option.value" 
              />
            </el-select>
          </el-form-item>
          
          <el-form-item prop="host" required :label="$t('EditDBConnectDialog.hostLabel')">
            <el-input v-model="formData.host" :disabled="connectStatus === 'connecting'" :placeholder="$t('EditDBConnectDialog.inputPlaceholder')" />
          </el-form-item>
          
          <el-form-item prop="port" required :label="$t('EditDBConnectDialog.portLabel')">
            <el-input v-model="formData.port" :disabled="connectStatus === 'connecting'" :placeholder="$t('EditDBConnectDialog.inputPlaceholder')" />
          </el-form-item>

          <el-form-item :label="$t('EditDBConnectDialog.authDatabase')">
            <el-input v-model="formData.authDatabase" :disabled="connectStatus === 'connecting'" :placeholder="$t('EditDBConnectDialog.inputPlaceholder')" />
          </el-form-item>
          
          <el-form-item :label="$t('EditDBConnectDialog.usernameLabel')">
            <el-input v-model="formData.username" :disabled="connectStatus === 'connecting'" :placeholder="$t('EditDBConnectDialog.inputPlaceholder')" />
          </el-form-item>
          
          <el-form-item :label="$t('EditDBConnectDialog.passwordLabel')">
            <el-input v-model="formData.password" :disabled="connectStatus === 'connecting'" type="password" :placeholder="$t('EditDBConnectDialog.inputPlaceholder')" show-password />
          </el-form-item>
          
          <el-form-item :label="$t('EditDBConnectDialog.connectionTestLabel')">
            <el-button class="test-connect-button"
              :loading="isConnecting" 
              @click="handleTestConnection"
              type="primary"
            >
              {{ $t("EditDBConnectDialog.connectButton") }}
            </el-button>
            <div class="connect-status" :class="connectStatus" v-if="!['normal', 'connecting'].includes(connectStatus)">
              <el-icon :size="16">
                <i-ep-circle-close v-if="connectStatus === 'failed'"></i-ep-circle-close>
                <i-ep-circle-check v-else-if="connectStatus === 'success'"></i-ep-circle-check>
              </el-icon>
              {{ connectButtonText }}
            </div>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button class="cancel-btn" @click="handleCancel">{{ $t('EditDBConnectDialog.cancel') }}</el-button>
          <el-button type="primary" @click="handleConfirm" :disabled="connectStatus !== 'success'">{{ $t('EditDBConnectDialog.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { computed, reactive, ref, watch } from 'vue';
import axios from "axios";
import i18next from 'i18next';
import { DBInfo, FormDatabaseType } from '@common/types/nocode';
import { equals } from '@common/utils/object';
import { cloneDeep as deepClone } from "lodash";

const props = withDefaults(defineProps<{
  modelValue: boolean;
  config?: DBInfo;
}>(), {
  config: () => ({
    type: FormDatabaseType.MONGODB,
    host: '',
    port: 27017,
    username: '',
    password: '',
  })
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean),
  (event: 'confirm', value: DBInfo),
}>();

const formRef = ref<FormInstance>();
const formData = ref<DBInfo>({
  type: FormDatabaseType.MONGODB,
  host: '',
  port: 27017,
  username: '',
  password: ''
});

const formRules = reactive<FormRules<typeof formData>>({
  host: [{
    required: true,
    validator(rule, value, callback, source, options) {
      if (!value) {
        callback(new Error(i18next.t('EditDBConnectDialog.hostRequired')));
      }
      callback();
    },
    trigger: "blur",
  }],
  port: [{
    required: true,
    validator(rule, value, callback, source, options) {
      if (!value) {
        callback(new Error(i18next.t('EditDBConnectDialog.portRequired')));
      }
      callback();
    },
    trigger: "blur",
  }]
})

const databaseOptions = computed(() => [
  { label: i18next.t('EditDBConnectDialog.mongodbOption'), value: FormDatabaseType.MONGODB },
  // { label: i18next.t('EditDBConnectDialog.mysqlOption'), value: FormDatabaseType.MYSQL },
  // { label: i18next.t('EditDBConnectDialog.postgresqlOption'), value: 'postgresql' },
  // { label: i18next.t('EditDBConnectDialog.redisOption'), value: 'redis' }
]);

const connectStatus = ref("normal"); // normal, connecting, success, failed
const isConnecting = ref(false);

const getErrorMessage = (error: unknown): string => {
  if (!error) return '';
  if (typeof error === 'string') return error;

  if (typeof error !== 'object') return '';

  const responseMessage = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
  if (typeof responseMessage === 'string') return responseMessage;

  if (error instanceof Error) {
    return error.message;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
};
const isMongoVersionTooLow = ref(false);
const isMongoVersionTooLowError = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return /maximum wire version\s+\d+/i.test(message)
    && /requires at least\s+8/i.test(message)
    && /mongodb\s*4\.2/i.test(message);
};

const connectButtonText = computed(() => {
  if (isConnecting.value) return i18next.t('EditDBConnectDialog.connectingButton');
  if (connectStatus.value === 'success') return i18next.t('EditDBConnectDialog.connectSuccessButton');
  if (connectStatus.value === 'failed') {
    if (isMongoVersionTooLow.value) return i18next.t('EditDBConnectDialog.mongoVersionTooLow');
    return i18next.t('EditDBConnectDialog.connectTestFailed');
  }
  return i18next.t('EditDBConnectDialog.connectButton');
});

// 监听props变化，初始化表单数据
watch(() => props.config, (newConfig) => {
  if (newConfig) {
    formData.value = {
      type: newConfig.type !== FormDatabaseType.EMBEDDED ? newConfig.type : FormDatabaseType.MONGODB,
      host: newConfig.host || '',
      port: newConfig.port || 27017,
      username: newConfig.username || '',
      password: newConfig.password || ''
    };
  }
}, { immediate: true, deep: true });
watch(() => ({...formData.value}), (value, oldValue) => {
  if (equals(value, oldValue)) return;
  connectStatus.value = 'normal';
})
const handleTestConnection = async () => {
  if (isConnecting.value) return;
  const res = await formRef.value.validate()
  if (!res) return;

  isConnecting.value = true;
  connectStatus.value = 'connecting';
  
  try {
    const response = await axios.post('/form-data/test-db-connect', formData.value).then(({ data }) => data)
    if (!response) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
    connectStatus.value = 'success';
    ElMessage.success(i18next.t('EditDBConnectDialog.connectTestSuccess'));
  } catch (error) {
    connectStatus.value = 'failed';
    isMongoVersionTooLow.value = isMongoVersionTooLowError(error);
    if (isMongoVersionTooLow.value) {
      ElMessage.error(i18next.t('EditDBConnectDialog.mongoVersionTooLow'));
    }
  } finally {
    isConnecting.value = false;
  }
};

const handleCancel = () => {
  emit('update:modelValue', false);
};

const handleConfirm = () => {
  if (connectStatus.value !== 'success') {
    ElMessage.warning(i18next.t('EditDBConnectDialog.testConnectionFirst'));
    return;
  }
  if (props.config) {
    if (props.config.type === formData.value.type && props.config.host === formData.value.host && props.config.port === formData.value.port) {
      ElMessage.error(i18next.t('EditDBConnectDialog.sameConnection'));
      return;
    }
  }
  emit('confirm', deepClone(formData.value));
  emit('update:modelValue', false);
};

const handleClosed = () => {
  isConnecting.value = false;
  connectStatus.value = 'normal';
}
</script>

<style scoped lang="scss">
.edit-db-connect-dialog {
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
      .db-form {
        .el-form-item {
          margin-bottom: 16px;
          
          .el-form-item__label {
            color: #1D2129;
            font-size: 14px;
            font-weight: 400;
            padding-right: 12px;
          }
          
          .el-form-item__content {
            .el-input, .el-select {
              .el-input__wrapper, .el-select__wrapper {
                background-color: #F7F8FA;
                border: 1px solid #E5E6EB;
                border-radius: 4px;
                box-shadow: none;
                
                &:hover {
                  border-color: var(--el-color-primary);
                }
                
                &.is-focus {
                  border-color: var(--el-color-primary);
                  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
                }
              }
              
              .el-input__inner {
                color: #1D2129;
                font-size: 14px;
                
                &::placeholder {
                  color: #C9CDD4;
                }
              }
            }
            
            .el-button {
              height: 32px;
              padding: 5px 16px;
              border-radius: 4px;
              font-size: 14px;
              
              &.el-button--primary.is-plain {
                color: var(--el-color-primary);
                background-color: var(--el-color-primary-light-9);
                border-color: var(--el-color-primary-light-5);
                
                &:hover {
                  color: #fff;
                  background-color: var(--el-color-primary);
                  border-color: var(--el-color-primary);
                }
              }
              
              &.el-button--success.is-plain {
                color: var(--el-color-success);
                background-color: var(--el-color-success-light-9);
                border-color: var(--el-color-success-light-5);
                
                &:hover {
                  color: #fff;
                  background-color: var(--el-color-success);
                  border-color: var(--el-color-success);
                }
              }

              &.test-connect-button {
                width: 82px;
              }
            }

            .connect-status {
              margin-left: 18px;
              display: flex;
              align-items: center;
              column-gap: 4px;
              flex: 1;
              min-width: 0;
              line-height: 18px;

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
