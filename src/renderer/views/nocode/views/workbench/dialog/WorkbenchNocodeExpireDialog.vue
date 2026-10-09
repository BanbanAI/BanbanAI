<template>
  <el-dialog :modelValue="modelValue" @update:model-value="emit('update:modelValue', $event)" :title="$t('nocodeSaveAs.appValidity')" width="400px" top="30vh" destroy-on-close :close-on-click-modal="false" draggable align-center>
    <div class="expire-dialog-body">
      <div class="expire-dialog-row">
        <div class="expire-dialog-label">{{ $t('nocodeSaveAs.appValidity') }}</div>
        <el-config-provider :locale="elementPlusLocale">
          <el-date-picker
            v-model="expireAt"
            class="expire-picker"
            type="datetime"
            format="YYYY.MM.DD HH:mm:ss"
            value-format="x"
            prefix-icon=""
            :suffix-icon="ArrowDown"
            :show-arrow="false"
            :placeholder="$t('nocodeSaveAs.expireAtPlaceholder')"
          />
        </el-config-provider>
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="emit('update:modelValue', false)" :loading="btnLoading">{{ $t('TipDialog.cancel') }}</el-button>
        <el-button @click="handleRemove" :loading="btnLoading">{{ $t('WorkbenchNocodeExpireDialog.removeExpireAt') }}</el-button>
        <el-button type="primary" @click="handleSave" :loading="btnLoading">{{ $t('CrossAppSetting.save') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { NocodeImportState } from '@common/types/nocode';
import { ArrowDown } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale';
import axios from 'axios';
import i18next from 'i18next';
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean,
  nocodeId?: string,
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
  (event: 'updated', importState: NocodeImportState): void,
}>();

const btnLoading = ref(false);
const expireAt = ref("");

const loadImportState = async () => {
  if (!props.nocodeId) return;
  const importState = await axios.get("/project/get-nocode-import-state", {
    params: {
      nocodeId: props.nocodeId,
    },
  }).then(({ data }) => data as NocodeImportState).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
    return null;
  });
  if (!importState) return;
  if (!importState.canManageExpireAt) {
    emit('update:modelValue', false);
    return;
  }
  expireAt.value = importState.expireAt ? String(importState.expireAt) : "";
}

const submitExpireAt = async (nextExpireAt: number | null) => {
  if (!props.nocodeId) return;
  btnLoading.value = true;
  const importState = await axios.post("/project/save-nocode-import-expire-at", {
    nocodeId: props.nocodeId,
    expireAt: nextExpireAt,
  }).then(({ data }) => data as NocodeImportState).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
    return null;
  });
  btnLoading.value = false;
  if (!importState) return;

  emit('updated', importState);
  emit('update:modelValue', false);
  ElMessage.success(i18next.t(nextExpireAt ? 'WorkbenchNocodeExpireDialog.saveSuccess' : 'WorkbenchNocodeExpireDialog.removeSuccess'));
}

const handleSave = async () => {
  const currentExpireAt = Number(expireAt.value || 0);
  if (!currentExpireAt) {
    ElMessage.warning(i18next.t("nocodeSaveAs.expireAtRequired"));
    return;
  }
  if (currentExpireAt <= Date.now()) {
    ElMessage.warning(i18next.t("nocodeSaveAs.expireAtFuture"));
    return;
  }
  await submitExpireAt(currentExpireAt);
}

const handleRemove = async () => {
  await submitExpireAt(null);
}

watch(() => [props.modelValue, props.nocodeId], ([modelValue]) => {
  if (modelValue) {
    void loadImportState();
  }
}, { immediate: true });
</script>

<style scoped lang="scss">
.expire-dialog-body {
  padding: 24px;
}

.expire-dialog-row {
  display: flex;
  align-items: center;
}

.expire-dialog-label {
  flex-shrink: 0;
  width: 96px;
  margin-right: 16px;
  font-size: 14px;
  color: var(--text-color-regular);
}

.expire-picker {
  width: 248px;

  :deep(.el-input__wrapper) {
    box-shadow: unset;
    background-color: var(--bg-color-overlay);
  }
}
</style>
