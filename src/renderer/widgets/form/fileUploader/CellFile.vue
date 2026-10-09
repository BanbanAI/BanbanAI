<template>
  <div class="file-preview-toolbar" ref="toolbarRef" v-if="fileList?.length">
    <div class="thumbnail-container">
      <teleport to="body">
        <table-media-viewer
          v-if="showPreview"
          :z-index="9000"
          :initial-index="currentIndex"
          :url-list="fileData.filter(item => isMedia(item)).map(item => item.url)"
          :hide-on-click-modal="true"
          :infinite="true"
          :autoplay="false"
          @close="showPreview = false"
        ></table-media-viewer>
      </teleport>

      <el-popover
        class="box-item"
        :content="item.name"
        placement="top"
        v-for="item in fileData"
        :show-arrow="true"
      >
        <template #reference>
          <div class="video-box" :style="{
            height: '27px',
            width: '27px',
          }" v-if="isVideo(item)">
            <video :src="item.url" preload="metadata"
              :autoplay="false"
              disablePictureInPicture
              :controls="false"
              @click.stop="previewVideo(item)"
            ></video>
            <el-icon class="play-icon">
              <i-icon-park-outline-play-one></i-icon-park-outline-play-one>
            </el-icon>
          </div>
          <img
            :src="getPreviewImg(item)"
            @click.stop="previewVideo(item)"
            v-else
            :style="{
              height: 27 + 'px',
              width: 27 + 'px',
            }"
          >

        </template>
      </el-popover>
    </div>

    <el-button link :icon="ArrowDown" @click.stop="togglePopover" v-if="fileData.length > 0"></el-button>

    <teleport to="body">
      <el-popover
        :virtual-ref="toolbarRef"
        v-model:visible="isPopoverVisible"
        trigger="click"
        width="400px"
        placement="bottom-start"
        :show-arrow="false"
        :offset="2"
        :popper-style="{ background: 'var(--el-color-white)' }"
        popper-class="file-popover"
      >
        <div class="popover-file-list">
          <el-scrollbar max-height="340px">
            <div class="popover-header-wrapper">
              <slot slot name="popover-header"></slot>
            </div>
            <div class="popover-grid">
              <div v-for="(file, index) in fileData" :key="file.uid" class="popover-file-item">
                <img
                  :src="getPreviewImg(file)"
                  @click.stop="previewVideo(file)"
                  :style="{
                    height: imgHeight[rowHeightLevel] + 'px',
                    width: imgHeight[rowHeightLevel] + 'px',
                  }"
                >
                <div class="item-right">
                  <span class="file-name" :title="file.name">{{ file.name }}</span>
                  <span class="file-size">
                    {{ diskSize(file.size) }}
                  </span>
                </div>

                <div class="file-option-wrap" :style="{
                  justifyContent: 'center'
                }">
                  <slot name="list-item-option" :file="file"></slot>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </el-popover>
    </teleport>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, onMounted, ref, watch } from "vue";
import { diskSize } from "@common/utils/other";
import {
  ArrowDown,
  Document
} from "@element-plus/icons-vue";
import { FormTableRowHeight } from "../_common/type";
import type { Sortable } from 'sortablejs'
import { FileUploader } from "./fileUploader";
import { getBuiltinWidgetAsset } from "@renderer/widgets/assets";

type FileFile = {
  uid: string;
  name: string;
  status: string;
  size: number;
  url: string;
};

const props = defineProps<{
  widget: FileUploader
  fileList: FileFile[];
  rowHeightLevel: FormTableRowHeight;
}>();

const imgHeight = ref({
  [FormTableRowHeight.SMALL]: 42,
  [FormTableRowHeight.MEDIUM]: 84,
  [FormTableRowHeight.LARGE]: 128,
  [FormTableRowHeight.AUTO]: 42,
})

const toolbarRef = ref(null);
const isPopoverVisible = ref(false);
const showPreview = ref(false)
const fileData = computed(()=>{
  return props.fileList.filter(item=>typeof item === "object");
});

const currentIndex = ref(0)

const togglePopover = (): void => {
  isPopoverVisible.value = true;
};

const downloadFile = (index: number): void => {
  const file = fileData.value[index];
  if (!file) return;

  fetch(file.url)
    .then((response) => response.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(blobUrl);
      link.remove();
    });
};

const wordExtenstions = [
  "docx",
  "doc",
  "dotx",
  "docm",
]
const excelExtenstions = [
  "xlsx",
  "xls",
  "xlsm",
  "xml",
]
const pptExtenstions = [
  "ppt",
  "pptx",
  "pptm",
  "pptx",
]
const pdfExtenstions = [
  "pdf",
]
const audioExtenstions = [
  "wav",
  "mp3",
  "wma",
  "ape",
  "flac",
  "ogg",
  "aac",
]
const videoExtenstions = [
  "mp4",
  "avi",
  "mov",
  "rmvb",
  "mkv",
  "wmv",
  "flv",
  "avchd",
  "webm"
]
const zipExtenstions = [
  "zip",
  "rar",
  "7z",
  "gzip",
  "bzip2",
]
const imageExtensions = [
  "bmp",
  "jpg",
  "jpeg",
  "png",
  "tif",
  "gif",
  "pcx",
  "tga",
  "exif",
  "fpx",
  "svg",
  "psd",
  "cdr",
  "pcd",
  "dxf",
  "ufo",
  "eps",
  "ai",
  "raw",
  "WMF",
  "webp",
  "avif",
  "apng",
];

const getPreviewImg = (file) => {
  const fileName = file.name || "";
  const fileExtension = fileName.split(".").pop().toLowerCase();

  if (wordExtenstions.includes(fileExtension)) {
    return getBuiltinWidgetAsset("widget.form.file-uploader", "fileTypeImg/word.png")
  } else if (excelExtenstions.includes(fileExtension)) {
    return getBuiltinWidgetAsset("widget.form.file-uploader", "fileTypeImg/excel.png")
  } else if (pptExtenstions.includes(fileExtension)) {
    return getBuiltinWidgetAsset("widget.form.file-uploader", "fileTypeImg/ppt.png")
  } else if (pdfExtenstions.includes(fileExtension)) {
    return getBuiltinWidgetAsset("widget.form.file-uploader", "fileTypeImg/pdf.png")
  } else if (audioExtenstions.includes(fileExtension)) {
    return getBuiltinWidgetAsset("widget.form.file-uploader", "fileTypeImg/audio.png")
  } else if (videoExtenstions.includes(fileExtension)) {
    return getBuiltinWidgetAsset("widget.form.file-uploader", "fileTypeImg/video.png")
  } else if (zipExtenstions.includes(fileExtension)) {
    return getBuiltinWidgetAsset("widget.form.file-uploader", "fileTypeImg/zip.png")
  } else {
    return getBuiltinWidgetAsset("widget.form.file-uploader", "fileTypeImg/txt.png")
  }
}
const isMedia = (file) => {

  const fileName = file.name || "";
  const fileExtension = fileName.split(".").pop().toLowerCase();

  if (videoExtenstions.includes(fileExtension)) {
    return true
  }

  if (imageExtensions.includes(fileExtension)) {
    return true
  }

  if (pdfExtenstions.includes(fileExtension)) {
    return true
  }

  return false
}
const isVideo = (file) => {
  const fileName = file.name || "";
  const fileExtension = fileName.split(".").pop().toLowerCase();

  if (videoExtenstions.includes(fileExtension)) {
    return true
  }
  return false
}

// 点击缩略图预览视频
const previewVideo = (item) => {
  if(!isMedia(item)) {
    return
  }
  const url = item.url
  const value = fileData.value.filter(it => isMedia(it)).map(it => it.url)
  currentIndex.value = value.findIndex(v => v === url) === -1 ? 0 : value.findIndex(v => v === url)
  showPreview.value = true
}

defineExpose({
  changePopoverVisible: (visible) => {
    isPopoverVisible.value = visible;
  },
  show: () => {
    isPopoverVisible.value = true;
  },
})
</script>

<style scoped lang="scss">
.file-preview-toolbar {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  position: absolute;

  .thumbnail-container {
    width: calc(100% - 20px);
    height: 100%;
    line-height: 20px;
    gap: 4px;
    overflow: hidden;
    display: flex;
    flex-wrap: wrap;

    img {
      cursor: var(--cursor-pointer);
      object-fit: cover; /* 保持比例裁切，不拉伸 */
    }

    .video-box {
      position: relative;
      cursor: var(--cursor-pointer);
      video {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
        object-fit: cover;
      }
      .play-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 200%;
        color: rgba(255, 255, 255, 0.8);
        pointer-events: none;
        z-index: 3;
      }
    }
  }

  > .el-button {
    cursor: var(--cursor-pointer);
    width: 80px;
  }
}

.popover-file-list {
  width: 370px;
}

.popover-header-wrapper {
  padding: 4px;
}

.popover-grid {
  display: grid;
  grid-template-columns: repeat(1, 336px);
  row-gap: 12px;
  column-gap: 8px;
  padding: 4px;
}

.popover-file-item {
  width: 336px;
    height: 54px;
    display: flex;
    padding: 0 8px;
    border-radius: 4px;
    background-color: var(--bg-color-overlay);
    border: 1px solid var(--border-color);
    justify-content: space-between;
    align-items: center;

    .item-right {
      display: flex;
      flex-direction: column;
      flex: 1;
      margin-left: 16px;
      overflow: hidden;

      .file-name {
        color: var(--text-color-regular);
        display: inline-block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .file-size {
        color: var(--text-color-placeholder);
        display: flex;
        justify-content: space-between;
      }
    }

    .file-option-wrap {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
}

.video-thumb {
  position: relative;
  cursor: pointer;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .play-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 200%;
    color: rgba(255, 255, 255, 0.8);
    pointer-events: none;
  }
}
</style>

<style lang="scss">
.cell-file-video-dialog {
  padding: 0px;
  background-color: black;

  .el-dialog__header {
    color: #fff;
    font-size: 18px;
    padding: 0px;
    height: 40px;
  }

  .el-dialog__body {
    padding: 0px;
  }

  .el-dialog__footer {
    display: none; /* 如果不需要底部按钮 */
    padding: 0px;
  }
}
</style>
