<template>
  <div class="report-replace-img-dialog">
    <div class="preview">
      <div class="title">{{ $t("reportReplaceImgDialog.nowImg") }}</div>
      <div class="report-cover">
        <div class="icon" :style="{ background: systemIcon.color }" v-if="isShowIcon">
          <el-icon :size="24" color="#fff">
            <component :is="systemIcon.icon" />
          </el-icon>
        </div>
        <el-image fit="fill" loading="lazy" style="width: 100%; height: 100%;" :src="coverImageURL" v-else>
          <template #error>
            <div class="default-cover"></div>
          </template>
        </el-image>
      </div>
    </div>
    <div class="edit">
      <div class="title">{{ $t("reportReplaceImgDialog.editImg") }}</div>
      <vn-stack v-model="selectImgMode">
        <el-radio-group v-model="selectImgMode">
          <el-radio :value="'system'">
            <vn-stack-tab :name="'system'">{{ $t("reportReplaceImgDialog.systemImg") }}</vn-stack-tab>
          </el-radio>
          <el-radio :value="'custom'">
            <vn-stack-tab :name="'custom'">{{ $t("reportReplaceImgDialog.customImg") }}</vn-stack-tab>
          </el-radio>
        </el-radio-group>
        <vn-stack-layer :name="'system'">
          <div class="images-container">
            <icon-selector
              v-model:color="systemIcon.color"
              v-model:icon="systemIcon.icon"
              scroll-mode="container"
            ></icon-selector>
          </div>
        </vn-stack-layer>
        <vn-stack-layer :name="'custom'">
          <div class="images-container custom">
            <el-upload list-type="text" drag ref="uploadRef" :auto-upload="false" :show-file-list="false"
              :multiple="false" :limit="1" :accept="accept.join()" :on-change="handleChangeFile" :on-exceed="handleExceed" :style="{
                height: uploadImgUrl ? '156px' : '34px'
              }">
              <img :src="uploadImgUrl" alt="" v-if="uploadImgUrl">
              <div class="el-upload-text" v-else>
                <el-icon color="#D1D1D2" :size="16"><i-ep-plus /></el-icon>
                <div>{{ $t("reportReplaceImgDialog.uploadImg") }}</div>
              </div>
            </el-upload>
            <div v-if="!uploadImgUrl" class="upload-tip">
              <div class="upload-tip-format">{{ $t("reportReplaceImgDialog.uploadImgTipFormat") }}</div>
              <div class="upload-tip-size">{{ $t("reportReplaceImgDialog.uploadImgTipSize") }}</div>
            </div>
          </div>
        </vn-stack-layer>
      </vn-stack>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, nextTick } from 'vue';
import axios from 'axios';
import { genFileId, UploadFile, UploadFiles, UploadProps, UploadRawFile } from 'element-plus';
import { NocodeBody, NocodeMeta } from '@common/types/nocode';
import { ElMessage } from "element-plus";
import i18next from 'i18next';

const props = defineProps<{
  modelValue: boolean;
  nocode?: NocodeMeta;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'updateNocodeCoverImage', nocodeId: string): void;
}>();

const selectImgMode = ref<'system' | 'custom'>('system');

const coverVersion = ref(0);
const coverImageURL = computed(() => {
  if (selectImgMode.value === 'system') {
    return selectSystemImg.value || `project/get-nocode-snapshot/${props.nocode?.id}?t=${coverVersion.value}`;
  } else {
    return uploadImgUrl.value || `project/get-nocode-snapshot/${props.nocode?.id}?t=${coverVersion.value}`;
  }
});

const isShowIcon = computed(() => {
  if (selectImgMode.value === 'system') {
    return !!systemIcon.icon;
  }
  return (!uploadImgUrl.value && systemIcon.icon);
})

const systemIcon = reactive({
  color: "#62cb84",
  icon: undefined,
});
const selectSystemImg = ref('');
const nocodeBody = ref<NocodeBody>();
const getNocodeBody = async () => {
  const res = await axios.get(`project/get-nocode-body/${props.nocode?.id}`).then(({ data }) => data).catch(() => null)
  if (res) {
    nocodeBody.value = res;
    systemIcon.color = res?.snapshot?.color || "#62cb84";
    systemIcon.icon = res?.snapshot?.icon;
  }
}

onMounted(() => {
  nextTick(() => {
    if(props.nocode) {
      getNocodeBody();
    }
  })
})

const uploadRef = ref();
const uploadImgUrl = ref('');
const file = ref<UploadFile>();
const accept = [".jpg", ".png", ".jpeg",];
const handleChangeFile = async (uploadFile: UploadFile, uploadFiles: UploadFiles) => {
  console.log('sdf', uploadFile, uploadFiles)
  uploadImgUrl.value = URL.createObjectURL(uploadFile.raw!)
  file.value = uploadFile;
}

const handleExceed: UploadProps['onExceed'] = (files) => {
  uploadRef.value!.clearFiles()
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  uploadRef.value!.handleStart(file);
}

defineExpose({ 
  getFormData: async () => {
    let targetFile;
    const formData = new FormData();
    if (selectImgMode.value === 'system') {
      if (!systemIcon.icon) {
        if(props.nocode) {
          ElMessage.warning(i18next.t('NocodeImgCore.plsSelectIcon'));
        }
        return;
      }
      formData.append("color", systemIcon.color);
      formData.append("icon", systemIcon.icon);
    } else if (selectImgMode.value === 'custom') {
      targetFile = file.value;
      if (!targetFile) {
        ElMessage.warning(i18next.t('NocodeImgCore.plsSelectIcon'));
        return;
      }
      formData.append('file', targetFile.raw);
      formData.append('filename', targetFile.name);
    }
    if(props.nocode) {
      formData.append('nocodeId', props.nocode?.id);
    }
    return formData
  },
  handleAddVersion: () => {
    coverVersion.value++;
  },
  closeClear: () => {
    uploadRef.value.clearFiles();
    uploadImgUrl.value = '';
    file.value = undefined;
    selectSystemImg.value = '';
    systemIcon.icon = undefined;
    systemIcon.color = '#62cb84';
  },
  systemIcon,
  isShowIcon,
  coverImageURL
})

</script>

<style scoped lang='scss'>
.preview {
  display: flex;
  flex-direction: column;
  row-gap: 16px;
  margin-bottom: 16px;

  .report-cover {
    height: 32px;
    width: 32px;
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;

    .icon {
      width: 100%;
      height: 100%;
      border-radius: 4px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .el-image {
      border-radius: 4px;

      img {
        pointer-events: none;
        width: 100%;
        height: 100%;
        border-radius: 4px;
        object-fit: cover;
      }

      .default-cover {
        width: 100%;
        height: 100%;
        background: url(@renderer/assets/image/report-default-cover.png) center / cover no-repeat !important;

      }
    }
  }
}

.vn-stack {
  margin-top: 2px;

  .el-radio-group {
    margin-bottom: 12px;
  }
}

.edit {
  display: flex;
  flex-direction: column;

  .tabs {
    display: flex;
    column-gap: 32px;
  }

  .images-container {
    width: 302px;
    height: 182px;
    background-color: var(--bg-color-page);
    border-radius: 4px;
    border: 1px solid  var(--border-color);
    padding: 8px;
    display: flex;
    flex-wrap: wrap;
    row-gap: 8px;
    column-gap: 8px;


    :deep(.el-upload) {
      width: 156px;
      height: 100%;

      .el-upload-dragger {
        width: 156px;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0 !important;

        .el-upload-text {
          display: flex;
          justify-content: center;
          align-items: center;
          column-gap: 4px;
          font-size: 14px;
          color: #9D9EA1;
        }

        img {
          width: 100%;
          height: 100%;
        }
      }
    }

    .image {
      width: 56px;
      height: 56px;
      border-radius: 8px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: var(--cursor-pointer);

      &>img {
        width: 36px;
        height: 36px;

      }

      &.active {
        background-color: #333333;
      }
    }

    .upload-tip {
      width: 186px;
      text-align: center;
      font-size: 10px;
      color: #949494;

      .upload-tip-format {
        margin-bottom: 4px;
      }
    }

  }

  .custom {
    justify-content: center;
    align-content: center;
    row-gap: 20px;
  }
}
</style>
