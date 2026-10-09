<template>
  <div class="workbench-home-api-credentials" v-loading="loading">
    <div class="content">
      <div class="title">{{ $t('workbenchHomeApiTokens.pageTitle') }}</div>

      <el-form label-width="72px" label-position="left">
        <el-form-item :label="$t('workbenchHomeApiTokens.key')">
          <el-input v-model="credentials.key" readonly>
            <template #suffix>
              <el-tooltip :content="$t('workbenchHomeApiTokens.copyKey')" placement="top">
                <el-button
                  class="copy-button"
                  link
                  :disabled="!credentials.key"
                  @click="handleCopy(credentials.key)"
                >
                  <el-icon><i-ep-copy-document /></el-icon>
                </el-button>
              </el-tooltip>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item :label="$t('workbenchHomeApiTokens.secret')">
          <el-input v-model="credentials.secret" type="password" readonly>
            <template #suffix>
              <el-tooltip :content="$t('workbenchHomeApiTokens.copySecret')" placement="top">
                <el-button
                  class="copy-button"
                  link
                  :disabled="!credentials.secret"
                  @click="handleCopy(credentials.secret)"
                >
                  <el-icon><i-ep-copy-document /></el-icon>
                </el-button>
              </el-tooltip>
            </template>
          </el-input>
        </el-form-item>
      </el-form>

      <el-button type="primary" :loading="resetting" @click="handleReset">
        {{ $t('workbenchHomeApiTokens.reset') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { KeySecret } from '@common/types/nocode';
import { useClipboard } from '@vueuse/core';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import i18next from 'i18next';
import { ref } from 'vue';

const credentials = ref<KeySecret>({ key: '', secret: '' });
const loading = ref(false);
const resetting = ref(false);
const { copy } = useClipboard({ legacy: true });

function getErrorMessage(error: unknown, fallback: string) {
  const requestError = error as { response?: { data?: { message?: string } }; message?: string };
  return requestError?.response?.data?.message || requestError?.message || fallback;
}

async function loadCredentials() {
  loading.value = true;
  try {
    const response = await axios.get('/workbench/personal-key-secret');
    credentials.value = response.data || { key: '', secret: '' };
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, i18next.t('workbenchHomeApiTokens.fetchFailed')));
  } finally {
    loading.value = false;
  }
}

async function handleReset() {
  const confirmed = await ElMessageBox.confirm(
    i18next.t('workbenchHomeApiTokens.resetConfirmContent'),
    i18next.t('workbenchHomeApiTokens.resetConfirmTitle'),
    {
      type: 'warning',
      confirmButtonText: i18next.t('workbenchHomeApiTokens.reset'),
      cancelButtonText: i18next.t('workbenchHomeApiTokens.cancel'),
    },
  ).catch(() => null);
  if (!confirmed) return;

  resetting.value = true;
  try {
    const response = await axios.post('/workbench/personal-key-secret/reset');
    credentials.value = response.data || { key: '', secret: '' };
    ElMessage.success(i18next.t('workbenchHomeApiTokens.resetSuccess'));
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, i18next.t('workbenchHomeApiTokens.resetFailed')));
  } finally {
    resetting.value = false;
  }
}

async function handleCopy(value: string) {
  if (!value) return;
  try {
    await copy(value);
    ElMessage.success(i18next.t('workbenchHomeApiTokens.copySuccess'));
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, i18next.t('workbenchHomeApiTokens.copyFailed')));
  }
}

loadCredentials();
</script>

<style scoped lang="scss">
.workbench-home-api-credentials {
  height: 100%;

  .content {
    height: 100%;
    min-height: 480px;
    padding: 24px;
    background: var(--bg-color-page);
    border-radius: 4px;
  }

  .title {
    margin-bottom: 24px;
    color: var(--text-color-primary);
    font-size: 16px;
    font-weight: 600;
  }

  .el-form {
    width: min(100%, 560px);
  }

  .copy-button {
    width: 28px;
    height: 28px;
    padding: 0;
  }
}
</style>
