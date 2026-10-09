<template>
  <div class="option-group-control">
    <div class="preview" @mouseenter.stop="handleMouseEnter">
      <template v-if="btnLoading">
        <img class="loading-img" src="@renderer/assets/image/snap-loading.svg" />
      </template>
      <template v-else>
        <el-image v-if="files[0]?.relativePath" fit="contain" :src="handleFilePath(files[0])"></el-image>
        <div v-else class="error-image"></div>
      </template>
    </div>
    <div class="mask" :class="hoveringImage ? 'hover' : ''" v-show="hoveringImage && !btnLoading" @mouseleave.stop="handleMouseLeave" v-if="!isHideMenu">
      <el-upload  drag list-type="text" ref="uploadRef" :auto-upload="false" :show-file-list="false" :multiple="isMultiple" :limit="isMultiple ? undefined : 1"
        :accept="accept.join()" :on-change="handleChangeFile" @click="handleClick">
          <el-button :title="$t('SnapshotOption.uploadPlaceholder')" :icon="Upload" ></el-button>
      </el-upload>
      <el-button :title="$t('SnapshotOption.downloadPlaceholder')" :icon="Download" @click="download(files)" :disabled="isFileClear" ></el-button>
      <el-button :title="$t('SnapshotOption.clearPlaceholder')" :icon="DeleteFilled" @click="clear" :disabled="isFileClear" ></el-button>
    </div>
    <el-button class="btn" @click="handleSnapShot(paths)" :disabled="btnLoading">{{ getButtonAlias() }}</el-button>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, UPDATE_OPTION, OPTION_ELEMENT } from "../inject";
import { PROJECT, HANDLE_PROJECT_SNAPSHOTTED, PROJECT_ID, ACTIVE_BOARD_ID, ALL_BOARD, ALL_BOARD_DOM } from '@renderer/types';
import { ElMessage, UploadFile, UploadFiles } from 'element-plus';
import { Download, Upload, DeleteFilled} from '@element-plus/icons-vue';
import { computed, inject, ref, unref, watch } from 'vue';
import { unique } from '@common/utils/unique';
import { DefinedOptionWithParsedType, OptionFileValue, OptionRenderFileValue, isBoard } from '../types';
import { Widget } from '@renderer/b2/controllers/widget';
import { saveSnapshot } from '@renderer/utils/saveSnapshot';
import { base64ToBlob, doDownload } from "@renderer/utils";
import domToImage from 'dom-to-image-more';
import i18next from 'i18next';
import axios from "axios";

const props = defineProps<{
  option: DefinedOptionWithParsedType,
  paths: string[]
}>();
const project = inject(PROJECT);
const activeBoardId = inject(ACTIVE_BOARD_ID);
const allBoard = inject(ALL_BOARD);
const allBoardDom = inject(ALL_BOARD_DOM);
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const element = inject(OPTION_ELEMENT);

const projectId = computed(() => unref(element)?.getBoard()?.projectId);
let handleProjectSnapshotted: (projectId: string) => void;
handleProjectSnapshotted = (projectId: string) => {
  if (window.opener) {
    try {
      window.opener.postMessage({ type: 'snapshot', data: { projectId } }, window.opener.origin);
    } catch (err) {
      console.log(err)
    }
  }
}

const isMultiple = computed(() => props.option.args?.hasOwnProperty("multiple"));
const isCover = computed(() => props.option.args?.hasOwnProperty("cover"));
const isHideMenu = computed(() => props.option.args?.hasOwnProperty("hideMenu"));
const handleSnapshotName = props.option.args?.handleSnapshot ?? (isCover.value ? 'snapshotForCover' : 'handleSnapshot');
const getButtonAlias = () => props.option.args?.buttonAlias ?? i18next.t("SnapshotOption.snapshot");

let files = ref<OptionRenderFileValue[]>([]);
const uploadRef = ref()
const isFileClear = ref()
const btnLoading = ref(false);

watch(() => getOptionValue(), (value: OptionFileValue) => {
  isFileClear.value = value? false : true;
  const defaultValue = {
    uid: unique(),
    isLink: false,
  };
  if (Array.isArray(value)) {
    files.value = (value ? value.map((item) => {
      return {
        ...item, uid: unique(), isLink: false,
      };
    }) : [defaultValue]) as OptionRenderFileValue[];
  } else {
    files.value = (value ? [{ ...value, ...defaultValue }] : [defaultValue]) as OptionRenderFileValue[];
  }
}, { immediate: true, deep: true });

const updateFileOption = () => {
  if (isMultiple.value) {
    updateOption(
      files.value.map((file) => {
        const { uid, isLink, ...rest } = file;
        return rest;
      })
    );
  } else {
    const { uid, isLink, ...rest } = files.value[0];
    updateOption(rest);
  }
}

const accept = [".jpg", ".png", ".gif", ".jpeg", ".bmp", ".svg", ".webp", ".di"];

const handleFilePath = (file: OptionRenderFileValue) => {
  return `${projectId.value}/${file.relativePath}?t=${Date.now()}`;
}

const hoveringImage = ref(false);
const handleMouseEnter = () => {
  hoveringImage.value = true;
}
const handleMouseLeave = () => {
  hoveringImage.value = false;
}

let overWrote = false;
const handleClick = () => {
  overWrote = false;
  uploadRef.value.clearFiles()
}
const handleChangeFile = async (uploadFile: UploadFile, uploadFiles: UploadFiles) => {
  if(!overWrote){
    overWrote = true;
    files.value = [];
  }
  const currentElement: Widget = unref(element) as Widget;
  const _isBoard = isBoard(currentElement);
  const filename = uploadFile.name;
  const res = await axios.post('project/snapshot', {
    file: uploadFile.raw,
    filename,
    projectId: projectId.value,
    elementId: currentElement.uid,
    isCover: isCover.value,
    isBoard: _isBoard,
  }, { headers: { 'Content-Type': 'multipart/form-data' } }).catch((err) => {
    console.log('snapshot save failed: ', err);
  })
  if (res && res.data.snapshotPath) {
    files.value.push({
      isLink: false,
      relativePath: res.data.snapshotPath,
      uid: unique(),
      __opt_type: 'file'
    })
    updateFileOption();
    if (_isBoard && isCover.value) {
      handleProjectSnapshotted(projectId.value);
    }
  }
}

const handleSnapShot = async (paths:string[]) => {
  btnLoading.value = true
  files.value = [];
  const currentElement: Widget = unref(element) as Widget;
  const _isBoard = isBoard(currentElement);
  
  if (_isBoard && isCover.value) {
    const coverPath = await saveSnapshot(projectId.value, allBoard, activeBoardId.value, project.value, allBoardDom.value);
    coverPath && files.value.push({
      isLink: false,
      relativePath: coverPath,
      uid: unique(),
      __opt_type: 'file'
    });
    updateFileOption();
    handleProjectSnapshotted(projectId.value);
    btnLoading.value = false
    ElMessage.success(i18next.t("SnapshotOption.snapshotSuccess"))
  } else {
    let _blobs = [];
    if (isCover.value) {
      let blob = await (currentElement as any)[handleSnapshotName]?.(paths);
      // 有返回截图的直接使用
      if (!blob) {
        // 没有截图的，使用通用截图
        const targetDom = currentElement.dom;
        const domSize = currentElement.size;
        // 保存组件截图
        blob = await domToImage.toBlob(targetDom, {
          width: domSize.width,
          height: domSize.height,
          filter: (node: HTMLElement) => {
            if (node.classList?.contains('b2widget-resize')) return false;
            return true;
          },
        }).catch(() => null);
      } else if (!(blob instanceof Blob)) {
        blob = base64ToBlob(blob);
      }
      blob && _blobs.push(blob);
    } else {
      let blobs = await (currentElement as any)[handleSnapshotName](paths);
      if (!blobs || !blobs.length) return btnLoading.value = false;
      if (Array.isArray(blobs)) {
        _blobs.push(...blobs);
      } else {
        _blobs.push(blobs);
      }
    }
    if (!_blobs.length) return btnLoading.value = false;
    const formData = new FormData();
    formData.append("projectId", projectId.value);
    formData.append("elementId", currentElement.uid);
    formData.append("elementName", currentElement.name);
    if(isCover.value) formData.append("isCover", "true");
    if(_isBoard) formData.append("isBoard", "true");
    for (const blob of _blobs) {
      formData.append("file", blob, blob["filename"] ?? 'snapshot');
    }
    const data = await axios.post("/project/save-element-snapshots", formData, { headers: { "Content-Type": "multipart/form-data" } }).then(({ data }) => data).catch(() => []);
    files.value = data;
    updateFileOption();
    btnLoading.value = false
  }
  
}

const download = async (files) => {
  if(isMultiple.value){
    const res = await axios.post('/project/pack-snapshot', {
      files: files,
      projectId: projectId.value
    })
    doDownload(res.data)
  }else{
    const info = {
      name: `${files[0].relativePath}`,
      url: `${projectId.value}/${files[0].relativePath}?t=${Date.now()}`
    }
    doDownload(info);
  }
}

const clear = () =>{
  const currentElement: Widget = unref(element) as Widget;
  currentElement.unsetOption(props.paths);
}

</script>

<style lang="scss" scoped>
.option-group-control {
  display: flex;
  position: relative;
  flex-direction: column;
  width: 100%;

  .preview {
    width: 200px;
    height: 122px;
    cursor: var(--cursor-pointer);

    :deep(.el-image) {
      width: 100%;
      height: 100%;
    }

    .error-image {
      width: 100%;
      height: 100%;
      background-color: #02040ca8;
    }

    .loading-img {
      width: 100%;
      height: 100%;
      outline: 1px solid #4c4d4f;
    }
  }

  .mask {
    display: flex;
    width: 200px;
    background-color: #02040ca8;
    justify-content: center;
    align-items: center;

    &:hover {
      outline: 1px solid #0089ff;
    }

    &.hover {
      position: absolute;
      top: 0;
      left: 0;
      width: 200px;
      height: calc(100% - 44px);
    }

    >div {
      :deep(.el-upload-dragger) {
        background-color: transparent;
        border-width: 0;
      }
    }
  }

  .placeholder {
    background: transparent;
    pointer-events: none;
    text-align: center;
  }

  .el-button {
    margin-top: 10px;
    &:focus {
      color: var(--el-button-text-color);
      border: var(--el-border);
      background-color: var(--el-button-bg-color);
      outline: none;
    }

    &:hover {
      color: var(--el-button-hover-text-color);
      border-color: var(--el-button-hover-border-color);
      background-color: var(--el-button-hover-bg-color);
      outline: none;
    }

    &.is-disabled {
      cursor: pointer;
      background-color: #52545b ;
      color: var(--el-disabled-text-color);
      border: var(--el-border);
      &:hover {
        background-color: #52545b;
        color: var(--el-disabled-text-color);
        border: var(--el-border);
      }
    }
  }

  .btn {
    &.is-duabled {
      background-color: #2c2c2c !important;
    }
  }
}
</style>
