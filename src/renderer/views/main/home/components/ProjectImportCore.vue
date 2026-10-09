<template>
  <div class="content-wrapper">
    <div class="input-item">
      <div class="item-input d-flex">
        <div class="tip-wrapper" :class="{ 'has-file': !!filePath }">
          <input class="path" :placeholder="$t('projectImportDialog.projectUploadPlaceholder')" type="text" name="path"
            :value="filePath" spellcheck="false" readonly />
          <el-icon :size="16" class="remove-filepath" @click.stop="handleClearFiles"><i-ep-close /></el-icon>
        </div>
        <el-upload style="display:inline-block;" :on-change="selectFile" drag list-type="text" :auto-upload="false"
          :show-file-list="false" :accept="acceptType" ref="uploadRef">
        </el-upload>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox, UploadInstance } from 'element-plus';
import { ImportNocodeResult } from '@common/types/nocode';
import axios from "axios";
import i18next from "i18next";
import { NOCODE_IMPORT_EXPIRED_ERROR } from '@common/utils';

const props = defineProps<{
  reportId?: string,
  nocodeId?: string,
  args?: string,
  parentId?: string,
  groupId?: string,
  restoreDataChecked?: boolean,
}>();

const emit = defineEmits<{
  (e: "import-success", data: ImportNocodeResult, replace?: boolean): void;
  (e: "update-import-tip", importTip: string): void;
}>();

const acceptType = computed(() => {
  return $p('nocodeExt');
})

const filePath = ref('');
const allowImport = ref(false);
const uploadRef = ref<UploadInstance>();

let formData = null;
let uploadOptions = {};
let oldProjectId = "";
let replaceProjectCode = false;

const updateImportTip = (importTip: string) => {
  emit("update-import-tip", importTip);
}

const handleClearFiles = () => {
  uploadRef.value?.clearFiles?.();
  filePath.value = '';
  allowImport.value = false;
  updateImportTip("");
}
const selectFile = async (file) => {
  updateImportTip("");
  allowImport.value = true;
  uploadOptions = {};
  filePath.value = file.raw.path?.replace(/(\\)+/g, "/") || file.name;
  formData = new FormData();
  formData.append("file", file.raw);
  uploadOptions['filename'] = file.name;
}

const doImport = async () => {
  if (!filePath.value || !filePath.value.trim()) {
    ElMessage.warning(i18next.t("projectImportDialog.nocodeFileEmptyTip"));
    return;
  }
  await importNocode();
}

const importNocode = async () => {
  let body;
  let url = '/project/create-from-nocode';
  uploadOptions['transformData'] = props.restoreDataChecked || false;
  uploadOptions['parentId'] = props.parentId || ""
  uploadOptions['groupId'] = props.groupId || ""
  formData.append('options', JSON.stringify(uploadOptions));
  body = formData;

  const res = await axios.post(url, body).catch(err => {
    let message = err.response.data.message || "";
    allowImport.value = false;
    if (message.indexOf("ENOSPC:") > -1) {
      updateImportTip(i18next.t("projectImportDialog.diskSpaceTip"));
    } else if (message.indexOf("end of central directory record signature") > -1) {
      updateImportTip(i18next.t("projectImportDialog.fileCorrupted"));
    } else if (message === NOCODE_IMPORT_EXPIRED_ERROR) {
      updateImportTip("");
      ElMessageBox.alert(i18next.t("projectImportDialog.importExpired"), i18next.t("nocodeRouter.tipTitle"), {
        type: "warning",
        confirmButtonText: i18next.t("projectImportDialog.projectImportConfirm"),
        showClose: false,
      });
    } else {
      updateImportTip(message);
    }
  });

  if (res) {
    emit('import-success', res.data);
  }
}


const handleDialogClose = () => {
  updateImportTip("");
  filePath.value = '';
  allowImport.value = false;

  formData = null;
  uploadOptions = {};
  oldProjectId = "";
  replaceProjectCode = false;

}

defineExpose({
  doImport,
  allowImport,
  close: handleDialogClose
})

</script>
<style lang="scss" scoped>
.content-wrapper {
  display: flex;
  flex-direction: column;
  row-gap: 8px;
  .input-item.options {
    margin-top: 10px;
    position: relative;
    height: 15px;

    .open-project {
      width: calc(100% - 30px);
      border-radius: 0;
      height: 100%;
      border-right: 0;
      padding-left: 0px;
      vertical-align: middle;
    }

    .transform {
      right: 20px;
    }
  }
  .user-overwrite {
    height: 30px;
    display: flex;
    align-items: center;
    column-gap: 16px;

    .user-overwrite-title {
      display: flex;
      align-items: center;

      .tip-icon {
        cursor: pointer;
        margin-top: 2px;
        margin-left: 4px;
      }
    }

    :deep(.el-radio-group) {
      column-gap: 12px;
      .el-radio {
        margin-right: 0;
      }
    }
  }
}
</style>
