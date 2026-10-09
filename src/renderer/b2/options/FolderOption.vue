<template>
  <div class="option-group-control">
    <div class="upload-folder">
      <el-input class="select-input" :modelValue="folderPath.relativeDir" :placeholder="$t('fileDir')" :readonly="true" @click="selectFolder">
        <template #suffix>
          <i class="fs fs-remove" @click.stop.prevent="deleteFolderOption" style="font-size: 12px;"></i>
        </template>
      </el-input>
      <input type="file" id="folder" ref="folderRef" webkitdirectory @change="getFolder" style="display: none;">
    </div>
    <el-icon :size="16" v-show="option.args.showFolder && folderPath.relativeDir" @click.stop="openFolder">
      <i-ep-folder />
    </el-icon>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { ACTIVE_ELEMENT } from '@renderer/types';
import { ElMessage } from 'element-plus';
import { computed, inject, ref, watch } from 'vue';
import { DefinedOptionWithParsedType, OptionFileValue } from '../types';
import i18next from 'i18next';
import axios from "axios";

defineProps<{
  option: DefinedOptionWithParsedType,
}>();

const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const activeElement = inject(ACTIVE_ELEMENT);
const projectId = computed(() => activeElement.value?.getBoard()?.projectId);
const folderRef = ref<HTMLInputElement>(null)
const folderPath = ref<OptionFileValue>({
  relativePath: '',
  relativeDir: '',
  __opt_type: "folder"
})

const openFolder = () => {
  if (folderPath.value.relativeDir) {
    let dir = `${projectId.value}/${folderPath.value.relativeDir}`;
    if (dir !== encodeURIComponent(dir)) {
      dir = encodeURIComponent(dir);
    }
    window.open(dir, 'browser')
  }
}

watch(() => getOptionValue(), (value: OptionFileValue) => {
  folderPath.value = value
}, { immediate: true, deep: true });

const updateFolderOption = () => {
  updateOption(folderPath.value)
}
const selectFolder = () => {
  folderRef.value.click()
}

const deleteFolderOption = () => {
  folderPath.value = {
    relativePath: '',
    relativeDir: '',
    __opt_type: "folder"
  }
  updateFolderOption()
}

const getFolder = async (ev: Event) => {
  const uploadFiles = (ev.target as HTMLInputElement).files
  let errorAppear = false
  let relativePath

  for (const file of uploadFiles) {
    relativePath = 'resources/' + file.webkitRelativePath.split('/')[0]
    let params = new FormData();
    params.append('file', file);
    params.append('filename', file.name);
    params.append('projectId', projectId.value);
    params.append('type', 'resource');
    params.append('folder', file.webkitRelativePath.replace(file.name, ''));
    const res = await axios.post('/project/file', params, { headers: { 'Content-Type': 'multipart/form-data' } }).catch((err) => {
      errorAppear = true
      console.log(err);
    })
  }
  // 上传文件后清空以便下次上传
  (ev.target as HTMLInputElement).value = ''
  if (!errorAppear) {
    if (!relativePath) return
    folderPath.value = {
      relativePath,
      relativeDir: relativePath,
      __opt_type: "folder"
    }
    updateFolderOption()
  } else {
    ElMessage.error(i18next.t("fileUploadError"));
  }
}

</script>

<style lang="scss" scoped>
.option-group-control {
  display: flex;
  align-items: center;
  width: 100%;

  .upload-folder {
    flex: 1;
    display: flex;

    &:deep() {
      i.fs-remove,
      input {
        cursor: pointer;
      }

    }
  }

  .el-icon {
    margin-left: 5px;
    cursor: pointer;
    &:hover {
      color: #fff;
    }
  }

}
</style>
