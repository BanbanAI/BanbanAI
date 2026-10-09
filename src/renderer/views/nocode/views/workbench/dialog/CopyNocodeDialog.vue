<template>
  <div class="copy-nocode-dialog">
    <el-dialog
      v-model="dialogVisible"
      width="400px"
      :close-on-click-modal="false"
      :title="$t('copyNocodeDialog.copyApp')"
      align-center
      class="copy-nocode-dialog-wrapper"
    >
        <div class="dialog-body">
          <div class="option-title">{{ $t("copyNocodeDialog.copyFormData") }}</div>
          <div class="option-content">
            <el-radio-group v-model="copyData">
              <el-radio :label="false">{{ $t("ReportSaveAs.radioFalse") }}</el-radio>
              <el-radio :label="true">{{ $t("ReportSaveAs.radioTrue") }}</el-radio>
            </el-radio-group>
          </div>
        </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button class="cancel-btn" @click="handleClose">{{ $t("nocodeSaveAs.cancel") }}</el-button>
          <el-button class="confirm-btn" type="primary" :loading="loading" @click="handleConfirm">{{ $t("ReportSaveAs.confirm") }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import axios from "axios";
import { ElMessage } from "element-plus";

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  nocodeId: {
    type: String,
    required: true,
  },
  parentId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue", "success"]);

const loading = ref(false);
const copyData = ref(false);

const dialogVisible = computed({
  get() {
    return props.modelValue;
  },
  set(value: boolean) {
    emit("update:modelValue", value);
  },
});

const handleClose = () => {
  if (loading.value) return;
  dialogVisible.value = false;
};

const handleConfirm = async () => {
  if (!props.nocodeId) return;
  loading.value = true;
  const res = await axios.get("/project/copy-nocode", {
    params: {
      id: props.nocodeId,
      parentId: props.parentId,
      copyData: copyData.value,
    },
  }).catch((err) => {
    ElMessage.error(err?.response?.data?.message);
    return null;
  });
  loading.value = false;
  if (!res) return;
  dialogVisible.value = false;
  emit("success");
};

watch(() => props.modelValue, (visible) => {
  if (visible) {
    copyData.value = false;
  }
});
</script>

<style scoped lang="scss">
.copy-nocode-dialog {
  :deep(.el-dialog) {
    height: 214px;
    border-radius: 8px;
    overflow: hidden;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--el-bg-color-page);
    display: flex;
    flex-direction: column;

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      height: 48px;
      line-height: 48px;
      border-bottom: 1px solid #f0f0f0;
      --el-dialog-title-font-size: 14px;

      .el-dialog__headerbtn {
        height: 48px;
        width: 48px;
        line-height: 48px;
        font-size: 16px;
        top: 0;
      }
    }

    .el-dialog__body {
      height: calc(100% - 48px);
      overflow: hidden;
      border-bottom: 1px solid #f0f0f0;

      .dialog-body {
        padding: 24px 20px;

        .option-title {
          line-height: 22px;
        }

        .option-content {
          line-height: 24px;
        }
      }
    }

    .dialog-footer {
      padding: 16px 20px;

      .el-button { 
        border-radius: 4px;
      }
    }
  }
}
</style>
