<template>
  <div class="nocode-approval-opinion-dialog-wrap">
    <el-drawer
      class="nocode-approval-opinion-drawer"
      :modelValue="visible"
      @update:modelValue="emit('update:modelValue', $event)"
      :title="title"
      align-center
      width="100%"
      size="60%"
      close-on-click-modal
      draggable
      direction="btt"
      :show-close="false"
      :close-on-press-escape="false"
    >
      <template #header>
        <span class="el-drawer__title">{{ title }}</span>
        <el-button class="el-drawer__close-btn" link @click="handleCancel()">
          <el-icon :size="16">
            <i-ep-close />
          </el-icon>
        </el-button>
      </template>

      <el-form :rules="rules" :model="formData" ref="formRef">
        <div class="approval-opinion">
          <el-form-item prop="backNode" v-if="isBackNode">
            <span>{{ $t('MobileNocodeApprovalOpinionDialog.rollbackTo') }}</span>
            <el-select
              class="back-node-select"
              v-model="formData.backNode"
              :show-arrow="false"
              :offset="4"
              :no-data-text="$t('MobileNocodeApprovalOpinionDialog.noRollbackNode')"
              :placeholder="$t('MobileNocodeApprovalOpinionDialog.selectNode')"
              popper-class="back-node-select-popper"
            >
              <el-option
                v-for="child in selectNodeOption"
                :key="child?.uid"
                :label="isTriggerNode(child?.type) ? $t('MobileNocodeApprovalOpinionDialog.submit') : child?.options?.name"
                :value="child?.uid"
              />
            </el-select>
          </el-form-item>

          <el-form-item class="opinion" prop="suggestion">
            <el-input
              v-model="formData.suggestion"
              type="textarea"
              :placeholder="$t('MobileNocodeApprovalOpinionDialog.inputOpinion')"
              :input-style="{ lineHeight: '20px', padding: '6px 12px', height: '100%', borderRadius: '4px' }"
              resize="none"
            />
          </el-form-item>
        </div>

        <div class="recommended-reply">
          <span>{{ $t('MobileNocodeApprovalOpinionDialog.historyOpinion') }}</span>
          <div class="btns-recommended" v-if="historyOpinionList.length">
            <el-button
              v-for="item in historyOpinionList"
              :key="item"
              :title="item"
              @click="formData.suggestion = item"
            >
              {{ item }}
            </el-button>
          </div>
          <div class="history-empty" v-else>
            {{ $t('MobileNocodeApprovalOpinionDialog.noHistoryOpinion') }}
          </div>
        </div>

        <div class="btns-upload">
          <input
            ref="imageInputRef"
            hidden
            type="file"
            accept="image/*"
            multiple
            @change="handleUploadImage"
          >
          <el-button :loading="uploadingImage" @click="openFilePicker('image')">
            <el-icon :size="14"><i-ven-image-upload /></el-icon>
            {{ $t('MobileNocodeApprovalOpinionDialog.uploadImg') }}
          </el-button>
          <input
            ref="fileInputRef"
            hidden
            type="file"
            multiple
            @change="handleUploadFile"
          >
          <el-button :loading="uploadingFile" @click="openFilePicker('file')">
            <el-icon :size="14"><i-ven-file-upload /></el-icon>
            {{ $t('MobileNocodeApprovalOpinionDialog.uploadAttach') }}
          </el-button>
        </div>

        <div class="upload-preview-container" v-if="formData.commentImages.length || formData.commentFiles.length">
          <div class="upload-preview" v-if="formData.commentImages.length">
            <span class="preview-title">{{ $t('MobileNocodeApprovalOpinionDialog.images') }}</span>
            <div class="image-list">
              <div class="image-item" v-for="(item, index) in formData.commentImages" :key="item.uid">
                <el-image
                  :src="item.url"
                  fit="cover"
                  :preview-src-list="imagePreviewUrls"
                  :initial-index="index"
                  preview-teleported
                />
                <el-button link class="remove-btn" @click="removeOpinionFile('image', item.uid)">
                  <el-icon :size="12"><i-ep-close /></el-icon>
                </el-button>
              </div>
            </div>
          </div>

          <div class="upload-preview" v-if="formData.commentFiles.length">
            <span class="preview-title">{{ $t('MobileNocodeApprovalOpinionDialog.attachments') }}</span>
            <div class="file-list">
              <div class="file-item" v-for="item in formData.commentFiles" :key="item.uid">
                <span class="file-name" :title="item.name">{{ item.name }}</span>
                <el-button link class="remove-btn" @click="removeOpinionFile('file', item.uid)">
                  <el-icon :size="12"><i-ep-close /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-form>

      <template #footer>
        <el-button type="default" :class="continuous ? 'cancel' : 'cancel stretch'" @click="handleCancel()">{{ $t('MobileNocodeApprovalOpinionDialog.cancel') }}</el-button>
        <el-button @click="handleConfirm(true)" class="next" v-if="continuous">{{ $t('MobileNocodeApprovalOpinionDialog.confirmApproveNext') }}</el-button>
        <el-button type="primary" class="confirm" @click="handleConfirm(false)">{{ $t('MobileNocodeApprovalOpinionDialog.confirm') }}</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script lang='ts' setup>
import { TODO } from '@common/types/nocode';
import { FlowOpinionFile } from '@common/types/project';
import { getFlowById, getRollbackTargetFlows, isTriggerNode } from "@common/utils";
import { usePassportStore } from '@renderer/stores';
import { ElMessage, FormRules } from 'element-plus';
import { computed, reactive, ref } from 'vue';
import i18next from 'i18next';
import {
  appendGlobalFlowOpinionHistory,
  getGlobalFlowOpinionHistory,
  uploadFlowOpinionFile,
} from '@renderer/views/nocode/utils/flow-opinion';

const props = withDefaults(defineProps<{
  title: string;
  requireComment: boolean;
  isBackNode?: boolean;
  continuous?: boolean;
  todo?: TODO;
}>(), {
  isBackNode: false,
  continuous: false,
});
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "submit"): void,
}>();

type OpinionDialogForm = {
  suggestion: string,
  backNode?: string,
  commentImages: FlowOpinionFile[],
  commentFiles: FlowOpinionFile[],
}

const createDefaultFormData = (): OpinionDialogForm => ({
  suggestion: '',
  backNode: undefined,
  commentImages: [],
  commentFiles: [],
});

const historySuggestions = ref<string[]>([]);
const formRef = ref();
const imageInputRef = ref<HTMLInputElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const visible = ref(false);
const uploadingImage = ref(false);
const uploadingFile = ref(false);
const formData = ref<OpinionDialogForm>(createDefaultFormData());
const passportState = usePassportStore();
let _resolve: Function;

const rules = reactive<FormRules<typeof formData>>({
  suggestion: [
    {
      trigger: 'blur',
      validator(rule, value, callback) {
        if (!value && props.requireComment) return callback(new Error(''));
        callback();
      }
    }
  ],
  backNode: [
    {
      trigger: 'blur',
      validator(rule, value, callback) {
        if (!value) return callback(new Error(''));
        callback();
      }
    }
  ]
});

const imagePreviewUrls = computed(() => formData.value.commentImages.map((item) => item.url));

const getDefaultHistorySuggestions = () => {
  return [
    i18next.t('MobileNocodeApprovalOpinionDialog.confirmed'),
    i18next.t('MobileNocodeApprovalOpinionDialog.verified'),
    i18next.t('MobileNocodeApprovalOpinionDialog.handled'),
  ];
};

const getOpinionHistoryAccountKey = () => {
  return `${passportState.account?.id || passportState.account?.user || passportState.user?.id || passportState.user?.loginName || 'anonymous'}`;
};

const historyOpinionList = computed(() => {
  return historySuggestions.value.filter((item, index, list) => !!item && list.indexOf(item) === index);
});

const getOpinionFileInputRef = (category: 'image' | 'file') => {
  return category === 'image' ? imageInputRef : fileInputRef;
};

const openFilePicker = (category: 'image' | 'file') => {
  const uploading = category === 'image' ? uploadingImage : uploadingFile;
  if (uploading.value) return;
  getOpinionFileInputRef(category).value?.click();
};

const handleUploadOpinionFiles = async (event: Event, category: 'image' | 'file') => {
  if (!props.todo?.nocodeId) return;

  const input = event.target as HTMLInputElement | null;
  const rawFiles = Array.from(input?.files || []);
  if (!rawFiles.length) {
    return;
  }

  const uploading = category === 'image' ? uploadingImage : uploadingFile;
  let hasUploadError = false;

  uploading.value = true;
  try {
    for (const rawFile of rawFiles) {
      try {
        const file = await uploadFlowOpinionFile(props.todo.nocodeId, rawFile);
        if (!file) {
          throw new Error('upload failed');
        }
        if (category === 'image') {
          formData.value.commentImages.push(file);
        } else {
          formData.value.commentFiles.push(file);
        }
      } catch (error) {
        console.error(error);
        hasUploadError = true;
      }
    }
  } finally {
    if (input) {
      input.value = '';
    }
    uploading.value = false;
  }

  if (hasUploadError) {
    ElMessage.error(i18next.t('MobileNocodeApprovalOpinionDialog.uploadFailed'));
  }
};

const handleUploadImage = async (event: Event) => {
  await handleUploadOpinionFiles(event, 'image');
};

const handleUploadFile = async (event: Event) => {
  await handleUploadOpinionFiles(event, 'file');
};

const removeOpinionFile = (category: 'image' | 'file', uid: string) => {
  if (category === 'image') {
    formData.value.commentImages = formData.value.commentImages.filter((item) => item.uid !== uid);
    return;
  }
  formData.value.commentFiles = formData.value.commentFiles.filter((item) => item.uid !== uid);
};

const handleConfirm = async (next: boolean = false) => {
  const res = await formRef.value.validate().then(() => {
    return {
      state: true,
    }
  }).catch((invalidFields) => {
    return {
      state: false,
      invalidFields,
    }
  });

  if (!res.state && res.invalidFields.backNode) {
    ElMessage.warning(i18next.t('MobileNocodeApprovalOpinionDialog.selectNodeTips'));
    return;
  }

  if (props.requireComment && !res.state && res.invalidFields.suggestion) {
    ElMessage.warning(i18next.t('MobileNocodeApprovalOpinionDialog.fillApprovalOpinion'));
    return;
  }

  appendGlobalFlowOpinionHistory(
    getOpinionHistoryAccountKey(),
    formData.value.suggestion,
    getDefaultHistorySuggestions(),
  );
  visible.value = false;
  _resolve({
    state: true,
    ...formData.value,
    next
  });
  _resolve = null;
}

const handleCancel = () => {
  visible.value = false;
  _resolve({
    state: false
  });
  _resolve = null;
}

const selectNodeOption = computed(() => {
  if (!props.todo) return [];
  const flow = getFlowById(props.todo.flows, props.todo.flowId);
  const hasRevertRange = Object.prototype.hasOwnProperty.call(flow?.options ?? {}, 'revertRange');
  return getRollbackTargetFlows(
    props.todo.flows || [],
    props.todo.flowId || '',
    hasRevertRange ? (flow?.options?.revertRange || []) : undefined,
  );
})
defineExpose({
  confirm: async () => {
    return new Promise((resolve) => {
      historySuggestions.value = getGlobalFlowOpinionHistory(
        getOpinionHistoryAccountKey(),
        getDefaultHistorySuggestions(),
      );
      formData.value = createDefaultFormData();
      visible.value = true;
      formRef.value?.clearValidate();
      _resolve = resolve;
    });
  }
})
</script>

<style lang='scss' scoped>
.nocode-approval-opinion-dialog-wrap {

  :deep(.nocode-approval-opinion-drawer) {
    --el-drawer-padding-primary: 0;
    --el-drawer-bg-color: var(--bg-color-page);
    --drawer-header-height: 40px;
    --drawer-footer-height: 64px;

    .el-button {
      -webkit-tap-highlight-color: transparent;
    }

    .el-drawer__header {
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--border-color);
      padding: 12px;
      margin-bottom: 0;

      .el-drawer__title {
        font-size: 14px;
        color: #141414;
        display: flex;
        justify-content: center;
      }

      .el-drawer__close-btn {
        position: absolute;
        right: 12px;
      }

      .el-drawer__headerbtn {
        width: var(--dialog-header-height);
        height: var(--dialog-header-height);
      }
    }


    .el-drawer__body {
      padding: 16px;

      .el-form-item__content {
        width: 100%;
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;

        > span {
          white-space: nowrap;
          margin-right: 16px;
        }
      }

      .el-select {
        .el-select__wrapper {
          -webkit-tap-highlight-color: transparent;
        }
      }
    }

    .el-drawer__footer {
      height: var(--dialog-footer-height);
      padding: 12px 16px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: end;
      align-items: center;
      gap: 8px;

      .el-button {
        height: 40px;
        border-radius: 4px;
        margin-left: 0;
        font-size: 14px;

        &.cancel {
          width: auto;
          padding: 0 16px;

          &.stretch {
            flex: 1;
          }
        }

        &.confirm {
          flex: 1;
          width: 50%;
          max-width: 50%;
        }
      }
    }
  }

  .el-form {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .approval-opinion {
      height: 192px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    :deep(.el-form-item) {
      margin-bottom: 0;

      &.opinion {
        height: 100%;

        .el-form-item__content {
          height: 100%;

          .el-textarea {
            height: 100%;
          }
        }
      }
    }

    .back-node-select {
      :deep(.el-select__wrapper) {
        height: 32px;
        background-color: var(--bg-color-overlay);
        border-radius: 4px;
        box-shadow: 0 0 0 0px var(--border-color) inset;

        &:hover {
          box-shadow: 0 0 0 1px var(--border-color) inset;
        }

        &.is-focused {
          box-shadow: 0 0 0 1px var(--color-primary) inset !important;
        }

        .el-select__selected-item.is-transparent span {
          font-size: 12px;
        }
      }
    }

    .recommended-reply {
      display: flex;
      flex-direction: column;
      gap: 8px;

      > span {
        color: var(--text-color-primary);
      }

      .btns-recommended {
        display: flex;
        gap: 8px;
        width: 100%;
        min-width: 0;
        overflow: hidden;

        .el-button {
          flex: 0 0 auto;
          max-width: 180px;
          margin-left: 0;
          justify-content: flex-start;
          border: 0;
          background-color: var(--bg-color-overlay);
          border-radius: 4px;
          padding: 3.5px 8px;
          line-height: 14px;
          font-size: 12px;
          height: 24px;
          overflow: hidden;

          :deep(span) {
            display: block;
            width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: left;
          }
        }
      }

      .history-empty {
        height: 24px;
        line-height: 24px;
        font-size: 12px;
        color: var(--text-color-placeholder);
      }
    }

    .btns-upload {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      .el-button {
        border-radius: 4px;
        font-size: 12px;
        height: 28px;
        padding: 4px 10px;
      }
    }

    .upload-preview-container {
      height: 104px;
      overflow-x: hidden;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 4px;
    }

    .upload-preview {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .preview-title {
        font-size: 12px;
        line-height: 20px;
        color: var(--text-color-primary);
      }

      .image-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        min-width: 0;
        width: 100%;
        overflow-x: hidden;
        overflow-y: visible;

        .image-item {
          flex: 0 0 72px;
          position: relative;
          width: 72px;
          height: 72px;
          border-radius: 4px;
          overflow: hidden;
          background-color: var(--bg-color-overlay);

          .el-image {
            width: 100%;
            height: 100%;
          }
        }
      }

      .file-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        min-width: 0;

        .file-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 4px;
          background-color: var(--bg-color-overlay);

          .file-name {
            flex: 1;
            min-width: 0;
            font-size: 12px;
            color: var(--text-color-regular);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }

      .remove-btn {
        position: absolute;
        right: 4px;
        top: 4px;
        width: 18px;
        height: 18px;
        min-height: 18px;
        padding: 0;
        border-radius: 999px;
        background-color: rgb(0 0 0 / 45%);
        color: var(--color-white);
      }

      .file-item .remove-btn {
        position: static;
        background-color: transparent;
        color: var(--text-color-placeholder);
      }
    }
  }
}
</style>

<style lang="scss">
.back-node-select-popper {
  --el-bg-color-overlay: var(--bg-color-page);

  ul li {
    -webkit-tap-highlight-color: transparent;
  }
}
</style>
