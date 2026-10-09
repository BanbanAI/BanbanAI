<template>
  <div class="nocode-home-page-setting-dialog">
    <el-dialog
      v-model="visible"
      :title="$t('NocodeHomePageSettingDialog.title')"
      width="400px"
      align-center
      :close-on-click-modal="false"
    >
      <el-form>
        <el-form-item :label="$t('NocodeHomePageSettingDialog.homePage')">
          <el-select
            v-model="selectedNodeId"
            class="home-page-select"
            filterable
            :placeholder="$t('NocodeHomePageSettingDialog.placeholder')"
          >
            <el-option
              v-for="item in candidates"
              :key="item.id"
              :label="item.label"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">{{ $t('NocodeHomePageSettingDialog.cancel') }}</el-button>
        <el-button type="primary" :disabled="!selectedNodeId" @click="handleConfirm">
          {{ $t('NocodeHomePageSettingDialog.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { NOCODE, NOCODE_ID, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { getAllForms, getAllPages, getNocodeHomePage } from '@common/utils';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';

const props = defineProps<{
  modelValue: boolean,
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
  (event: 'updated'): void,
}>();

const nocode = inject(NOCODE);
const nocodeId = inject(NOCODE_ID);
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);
const selectedNodeId = ref('');

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const candidates = computed(() => {
  const structure = nocode?.value?.body?.structure || [];
  return [
    ...getAllForms(structure).filter(item => getNocodeHomePage(structure, { enabled: true, nodeId: item.id })).map(item => ({
      ...item,
      label: `${item.name}（${i18next.t('NocodeHomePageSettingDialog.form')}）`,
    })),
    ...getAllPages(structure).filter(item => getNocodeHomePage(structure, { enabled: true, nodeId: item.id })).map(item => ({
      ...item,
      label: `${item.name}（${i18next.t('NocodeHomePageSettingDialog.board')}）`,
    })),
  ];
});

watch(visible, (value) => {
  if (value) {
    selectedNodeId.value = nocode?.value?.body?.settings?.homePage?.nodeId || '';
  }
});

const handleConfirm = async () => {
  if (!nocode?.value || !selectedNodeId.value || !checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;

  const settings = {
    ...nocode.value.body.settings,
    homePage: {
      enabled: true,
      nodeId: selectedNodeId.value,
    },
  };

  try {
    const { headers } = await axios.post('/project/save-nocode-settings', {
      nocodeId,
      settings,
    }, {
      headers: {
        'x-sign': nocode.value.body.sign,
      },
    });
    const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign;
    }
    nocode.value.body.settings = settings;
    ElMessage.success(i18next.t('NocodeHomePageSettingDialog.saveSuccess'));
    visible.value = false;
    emit('updated');
  } catch (error) {
    if (!handleNocodeSyncConflictError(error, nocodeSignIsLatest)) {
      ElMessage.error(error?.response?.data?.message || error?.message);
    }
  }
};
</script>

<style scoped lang="scss">
.nocode-home-page-setting-dialog {
  :deep(.el-dialog) {
    border-radius: 8px;
    background-color: #fff;
    padding: 0;

    .el-dialog__header {
      display: flex;
      justify-content: center;
      border-bottom: 1px solid #E5E6EB;
      padding: 12px 20px;

      .el-dialog__title {
        font-size: 16px;
        line-height: 24px;
      }
    }

    .el-dialog__body {
      padding: 24px 20px;

      .home-page-select {
        width: 100%;

        .el-select__wrapper {
          min-height: 32px;
          background-color: var(--bg-color-overlay);
          box-shadow: unset;
          border-radius: 4px;
        }
      }
    }

    .el-dialog__footer {
      padding: 16px 20px;
      border-top: 1px solid #E5E6EB;

      .el-button {
        border-radius: 4px;
      }
    }
  }
}
</style>
