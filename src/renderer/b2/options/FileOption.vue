<template>
  <div class="option-group-control" ref="wrapperRef">
    <div v-for="(file, index) in files" :key="typeof file !== 'string' ? file.uid : file" class="file_item" 
    @click.capture.ctrl="openFileFolder(file, $event)">
      <div :class="{  'has_file' : modelValue(file), single: isMultiple || isShowFolderIcon(file), double: isMultiple && isShowFolderIcon(file) }" 
        class="file-wrapper" :style="ctrl ? 'pointer-events: none' : ''">
        <el-select v-show="editingIndex !== index" filterable clearable :modelValue="modelValue(file)" :placeholder="$t('filePath')"
          :title="modelValue(file)" @visible-change="getAllFitFile" size="small" @clear="clearFileOption(index)">
          <el-option value="link" :label="($t('networkLink') as string)" :title="($t('networkLink') as string)" :key="typeof file !== 'string' ? file.uid : file + 'link'">
            <div style="width: 100%;" @click="editCurrentFile(index, file)">{{ $t('networkLink') }}</div>
          </el-option>
          <el-option v-for="choice in selectChoices" :value="choice.value" :label="choice.label" :title="choice.label">
            <div style="width: 100%;" @click="changeCurrentFile(index, choice.value as string)">{{ choice.label }}</div>
          </el-option>
          <el-option v-for="uploadedFile in hasUploadFiles" :value="uploadedFile.relativePath">
            <div @click="changeToUploadedFile(uploadedFile,index)">
              <el-popover :width="320" placement="left" v-if="isImageOrVideo(uploadedFile)" popover-class="file-option-popover">
                <template #reference>
                  <el-image v-if="isImageOrVideo(uploadedFile) === 'image'" loading="lazy"
                    style="width: 30px; height: 30px; float: left" fit="cover"
                    :src="handFilePath(uploadedFile)"></el-image>
                  <video v-else-if="isImageOrVideo(uploadedFile) === 'video'"
                    style="width: 30px; height: 30px; float: left"
                    :src="handFilePath(uploadedFile)"></video>
                </template>
                <template #default>
                  <!-- 此处pointerdown事件用于防止点击预览图片时下拉列表折叠 -->
                  <div class="preview-image" @pointerdown.prevent.stop="">
                    <el-image v-if="isImageOrVideo(uploadedFile) === 'image'" loading="lazy"
                      style="width: 30px; height: 30px; float: left" fit="cover"
                      :src="handFilePath(uploadedFile)"></el-image>
                    <video v-else-if="isImageOrVideo(uploadedFile) === 'video'"
                      style="width: 300px; height: 300px;" :src="handFilePath(uploadedFile)"
                      controls></video>
                  </div>
                </template>
              </el-popover>
              <span class="file-path" :style="{ float: isImageOrVideo(uploadedFile) ? 'right' : 'left' }"
                :title="uploadedFile.relativePath">
                {{ uploadedFile.relativePath.replace('resources/', '') }}</span>
            </div>
          </el-option>
        </el-select>
        <el-input v-show="editingIndex === index" v-model="editingVal" size="small" @blur="endEditFilePath"
          :ref="(el) => setItemRefs(el, index)" @keyup.enter.native="inputEnterBlur" :key="index + (typeof file !== 'string' ? file.uid : file)">
        </el-input>
        <el-upload :accept="accept('format')" :auto-upload="false" :on-change="changeFile" :multiple="isMultiple"
          :limit="isMultiple ? undefined : 1" :show-file-list="false">
          <div v-show="editingIndex !== index" :title="modelValue(file)" class="upload_area" @click="beforeChangeFile($event, index)"></div>
        </el-upload>
        <div class="handle-btn"  v-if="isShowFolderIcon(file) || isMultiple">
          <div class="btn folder" v-if="isShowFolderIcon(file)">
            <el-icon @click.stop="openFileFolder(file, $event)"><i-ep-folder /></el-icon>
          </div>
          <div class="btn delete" v-if="isMultiple">
            <el-icon @click.stop="deleteFileOption(index)"><i-ep-delete /></el-icon>
          </div>
        </div>
      </div>
      <div class="preview" v-if="typeof file !== 'string' && isPreviewFile && file.relativePath && isImageOrVideo(file)">
        <el-image v-if="isImageOrVideo(file) === 'image'" loading="lazy" :src="handFilePath(file)"
          class="preview-area">
          <template #error>
            <div class="empty"></div>
          </template>
        </el-image>
        <video v-else-if="isImageOrVideo(file) === 'video'" :src="handFilePath(file)" class="preview-area"></video>
      </div>
    </div>
    <el-button class="add-button" @click="addFileOption" size="small" v-if="isMultiple">+</el-button>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, UPDATE_OPTION, OPTION_ELEMENT } from "../inject";
import { INPUT_ENTER_BLUR, ACTIVE_ELEMENT } from '@renderer/types';
import { UploadFile, UploadFiles, ElOption, ElPopover } from 'element-plus';
import { ComponentPublicInstance, computed, HTMLAttributes, inject, ref, watch, nextTick, onMounted, unref } from 'vue';
import { unique } from '@common/utils/unique';
import { DefinedOptionWithParsedType, OptionFileValue, OptionRenderFileValue, SelectChoice } from '../types';
import { useMagicKeys, useActiveElement } from "@vueuse/core";
import { equals } from '@common/utils/object';
import axios from "axios";
const inputEnterBlur = inject(INPUT_ENTER_BLUR)

const activeElement = inject(ACTIVE_ELEMENT);
const projectId = computed(() => activeElement.value?.getBoard()?.projectId);

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();

const wrapperRef = ref<HTMLDivElement>();
const wrapperWidth = ref<number>();
onMounted(() => {
  nextTick(() => {
    wrapperWidth.value = wrapperRef.value.offsetWidth;
  })
});

const modelValue = computed(() => (file: OptionRenderFileValue | string) => {
  if (typeof file !== 'string') {
    return file.relativePath || file.url
  } else {
    return file;
  }
})

const isShowFolderIcon = computed(() => (file) => {
  return false;
});

const changeCurrentFile = (index: number, value: string) => {
  files.value[index] = value;
  updateFileOption();
}

const element = inject(OPTION_ELEMENT);
const selectChoices = computed(() => {
  const choices = props.option.selectChoices;
  if (typeof choices === 'function') {
    return choices(unref(element)) as SelectChoice[];
  }
  return choices as SelectChoice[] ?? [];
});

const isPreviewFile = computed(() => {
  return 'preview' in props.option.args;
})

const handFilePath = (file: OptionRenderFileValue) => {
  if (file.isLink || file.__opt_type !== "file") {
    return file.relativePath;
  } else {
    return `${projectId.value}/${file.relativePath}`;
  }
}

const hasUploadFiles = ref<OptionRenderFileValue[]>([])
const { ctrl } = useMagicKeys();
const openFileFolder = (file: OptionRenderFileValue | string, ev: MouseEvent) => {
  if (typeof file !== 'string' && !file.isLink && file.relativePath) {
    ev.preventDefault()
    ev.stopPropagation()
    window.open(`${projectId.value}/${file.relativePath}`, 'browser')
  }
}

const getAllFitFile = async () => {
  const result = await axios.post('project/fit-files', { types: accept.value('format'), folderTypes: accept.value('folder'), projectId: projectId.value, recursive: isRecursive.value }).catch(err => {
    console.log(err);
  })
  if (result) {
    const allUploadedFiles = result.data.allFiles.map((filePath: string) => {
      return {
        relativePath: filePath,
        uid: unique(),
        __opt_type: 'file',
        isLink: false,
      }
    })
    const allUploadedFolderFiles = result.data.allFolderFiles.map((filePath: string) => {
      return {
        relativePath: filePath,
        uid: unique(),
        __opt_type: 'file',
        exportFolder: true,
        isLink: false,
      }
    })
    hasUploadFiles.value = [...allUploadedFiles, ...allUploadedFolderFiles];
  }
}

const isImageOrVideo = (file: OptionRenderFileValue) => {
  let filePath = file.relativePath;
  if (file.isLink) {
    filePath = file.url;
  }
  if (extensionMap.image.indexOf('.' + filePath?.split('.')[filePath?.split('.').length - 1]) !== -1) {
    return 'image'
  } else if (extensionMap.video.indexOf('.' + filePath?.split('.')[filePath?.split('.').length - 1]) !== -1) {
    return 'video'
  }
  return false
}

const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const extensionMap = {
  image: [".jpg", ".png", ".gif", ".jpeg", ".bmp", ".svg", ".webp", ".di"],
  video: [".mp4", ".webm", ".dv"],
  html: [".html", ".htm"],
  model: ['.glb', '.gltf', '.gle', '.obj3'],
  hdr: [".hdr", ".env", ".dds"],
  texture: [".png", ".jpg", ".jpeg", ".mp4", ".webm", ".glb", ".obj3", ".gltf", ".gle"],
}

const files = ref<(OptionRenderFileValue | string)[]>();
const isMultiple = computed(() => props.option.args?.hasOwnProperty("multiple"));
const isRecursive = computed(() => props.option.args?.hasOwnProperty("recursive"));

const editingIndex = ref<number>(-1);
const overwriteIndex = ref<number>();
let overWrote = false;

watch(() => getOptionValue(), (value: OptionFileValue | (OptionFileValue | string)[] | string, oldValue) => {
  if (oldValue !== undefined && equals(value, oldValue)) {
    return;
  }
  const defaultValue = {
    uid: unique(),
    isLink: false,
  };
  if (Array.isArray(value)) {
    files.value = (value.length ? value.map((item) => {
      if (typeof item !== 'string') {
        return {
          ...item, uid: unique(), isLink: item?.hasOwnProperty('url'),
        };
      } else {
        return item;
      }
    }) : [defaultValue]) as OptionRenderFileValue[];
  } else {
    if (typeof value !== 'string') {
      if (value?.hasOwnProperty('url')) {
        defaultValue.isLink = true;
      }
      files.value = (value ? [{ ...value, ...defaultValue }] : [defaultValue]) as OptionRenderFileValue[];
    } else {
      files.value = value ? [value] : [defaultValue];
    }
  }
}, { immediate: true, deep: true });

const updateFileOption = () => {
  if (isMultiple.value) {
    updateOption(
      files.value.map((file) => {
        if (typeof file !== 'string') {
          let { uid, isLink, ...rest } = file;
          return rest;
        } else {
          return file;
        }
      })
    );
  } else {
    if (typeof files.value[0] !== 'string') {
      let { uid, isLink, ...rest } = files.value[0];
      updateOption(rest);
    } else {
      updateOption(files.value[0]);
    }
  }
}
const editingVal = ref('');
const editCurrentFile = (index: number, file: OptionRenderFileValue | string) => {
  editingIndex.value = index;
  if ((files.value[index] as OptionRenderFileValue)?.isLink) {
    editingVal.value = (files.value[index] as OptionRenderFileValue)?.url;
  } else {
    editingVal.value = '';
  }
  nextTick(() => {
    allFileInput.value[index].focus();
    allFileInput.value[index].select();
  })
}

const allFileInput = ref([])
const setItemRefs = (el: HTMLElement | ComponentPublicInstance | HTMLAttributes, index: number) => {
  allFileInput.value[index] = el
}

const endEditFilePath = () => {
  if (editingVal.value?.startsWith('http')) {
    files.value[editingIndex.value] = {
      uid: unique(),
      isLink: true,
      url: editingVal.value,
    }
    updateFileOption();
  }
  editingIndex.value = -1;
}

const changeToUploadedFile = (uploadedFile: OptionRenderFileValue, index: number) => {
  files.value[index] = uploadedFile;
  updateFileOption();
}

const clearFileOption = (index: number) => {
  files.value[index] = {
    uid: unique(),
    isLink: false
  };
  updateFileOption();
}

const deleteFileOption = (index: number) => {
  if (files.value.length === 1) {
    files.value[0] = {
      uid: unique(),
      isLink: false
    }
  } else {
    files.value.splice(index, 1);
  }
  updateFileOption();
}

const addFileOption = () => {
  files.value.push({
    uid: unique(),
    isLink: false
  });
  updateFileOption();
}

const accept = computed(() => (key: string) => {
  const types = props.option.args?.[key]?.split('|') ?? []
  let extensions = []
  types.forEach((type) => {
    if (type.startsWith('.')) {
      extensions = extensions.concat(type);
    } else {
      if (!extensionMap[type]) {
        console.error("unknown extensions", extensionMap[type]);
        return;
      }
      extensions = extensions.concat(extensionMap[type]);
    }
  })
  return extensions.join(',');
})

const _activeElement = useActiveElement();
const beforeChangeFile = (ev: MouseEvent, index: number) => {
  const value = files.value[index];
  if (typeof value !== 'string' && value.isLink) {
    ev.stopPropagation();
    ev.preventDefault();
    return;
  }
  overwriteIndex.value = index;
  overWrote = false;
  nextTick(() => {
    _activeElement.value.blur();
  })
}
const changeFile = async (uploadFile: UploadFile, uploadFiles: UploadFiles) => {
  /* 文件传输到后端 */
  let params = new FormData();
  let filename = uploadFile.name;
  params.append('file', uploadFile.raw);
  params.append('filename', filename);
  params.append('type', 'resource');
  params.append('projectId', projectId.value);
  const res = await axios.post('project/file', params, { headers: { 'Content-Type': 'multipart/form-data' } }).catch((err) => {
    console.log('file save failed: ', err);
  })
  if (res) {
    if (res.data.filePath) {
      // filePath是文件保存路径
      //保存失败，仍然显示用户选择的文件路径，保存成功，显示保存的相对路径
      // TODO 上传的是 gltf 的情况 __opt_type为 dir
      if (overWrote) {
        files.value.push({
          isLink: false,
          relativePath: res.data.filePath,
          uid: unique(),
          __opt_type: 'file'
        });
      } else {
        files.value[overwriteIndex.value] = {
          isLink: false,
          relativePath: res.data.filePath,
          uid: unique(),
          __opt_type: 'file'
        };
        overWrote = true;
      }
      updateFileOption();
    }
  }
}
</script>

<style lang="scss" scoped>
.option-group-control {
  display: flex;
  flex-direction: column;
  width: 100%;

  .el-button {
    display: block;
    width: 100%;
    line-height: 0;
    font-size: 16px;
  }

  .preview {
    width: 100%;
    position: relative;
    line-height: 0;
    font-size: 0;
    margin-top: 5px;

    .preview-area {
      width: calc(100% + 90px);
      max-height: 400px;
      transform: translateX(-85px);
    }

    img {
      width: 100%;
      padding-top: 10px;
      padding-right: 15px;
      background-color: #1f1f22;
      border: 1px solid #4c4d4f;
    }

    video {
      padding-top: 10px;
      padding-right: 15px;
      width: 100%;
      background-color: #000;
    }
  }

  :deep() .el-upload {
    position: absolute;
    top: 0;
    left: 0;
    height: 23px;
    right: 33px;

    .upload_area {
      width: 100%;
      height: 100%;
    }
  }

  :deep(.el-select) {
    width: 100%;

    .el-select__wrapper {
      justify-content: space-between;
      line-height: 24px;
      padding-top: 0;
      padding-bottom: 0;
      .el-select__prefix {
        display: none;
        position: absolute;
        right: 25px;
        font-size: 16px;
        z-index: 1;

        &:hover {
          color: #fff;
        }
      }
        .is-transparent{
          color: #8D9095;
      }
    }
  }

  .file_item{
    position: relative;
    height: 100%;

    &:not(:first-of-type) {
      margin-top: 5px;
    }
    .file-wrapper{
      display: flex;
      height: max-content;
      &.single{
        :deep(.el-upload){
          right: 58px;
        }
        :deep(.el-select) {
          width: calc(100% - 25px);
        }
      }
      &.double{
        :deep(.el-upload){
          right: 83px;
        }
        :deep(.el-select) {
          width: calc(100% - 50px);
        }
      }
      &.has_file:hover{
        :deep(.el-select){
          .el-select__wrapper{
            position: relative;
            height: var(--el-select-height);
            .el-select__prefix{
              display: inline-flex;
            }
          }
        }

        :deep(.el-upload){
          right: 58px;
        }
        &.single{
          :deep(.el-upload){
            right: 83px;
          }
        }
        &.double{
          :deep(.el-upload){
            right: 108px;
          }
        }
      }
      .handle-btn{
        display: flex;
        align-items: center;
        .btn{
          width: 25px;
          display: flex;
          align-items: center;
          justify-content: space-around;
          cursor: var(--cursor-pointer);
          color: #ebebeb;
          &:hover{
            color: #fff;
          }
        }
      }
    }
  }

  .add-button {
    margin-top: 5px;
    min-height: 20px;
  }

  .preview-image{
    padding: 12px;
  }
}

.file-path {
  width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}</style>

<style lang="scss">.el-select-dropdown__item {
  padding: 0 15px;
}

.file-option-popover {
  padding: 0 !important;
}</style>
