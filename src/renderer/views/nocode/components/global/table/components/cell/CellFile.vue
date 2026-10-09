<template>
  <div class="file-preview-toolbar" ref="toolbarRef" v-if="fileList?.length">
    <div class="thumbnail-container">
      <!-- {{ fileList.map(img => img.name).join(', ') }} -->
      <teleport to="body">
        <table-media-viewer
          v-if="showPreview"
          :z-index="9000"
          :initial-index="currentIndex"
          :url-list="fileData.filter(item => isMedia(item)).map(item => getFileUrl(item)).filter(Boolean)"
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
            height: imgHeight[rowHeightLevel] + 'px',
            width: imgHeight[rowHeightLevel] + 'px',
          }" v-if="isVideo(item)">
            <img
              :src="getImageUrl(item)"
              @click.stop="previewVideo(item)"
              style="height: 100%; width: 100%"
            >
          </div>
          <img
            :src="getImageUrl(item)"
            @click.stop="previewVideo(item)"
            v-else
            :style="{
              height: imgHeight[rowHeightLevel] + 'px',
              width: imgHeight[rowHeightLevel] + 'px',
            }"
          >

        </template>
      </el-popover>
      
    </div>

    <el-button v-if="showArrowButton && fileData.length > 0" link :icon="ArrowDown" @click.stop="togglePopover"></el-button>

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
      >
        <div class="popover-file-list">
          <el-scrollbar max-height="340px">
            <div class="popover-grid">
              <div v-for="(file, index) in fileData" :key="file.uid" class="popover-file-item">
                <img
                  :src="getImageUrl(file)"
                  @click.stop="previewVideo(file)"
                  style="height: 42px; width: 42px"
                >
                <div class="item-right">
                  <span class="file-name" :title="file.name">{{ file.name }}</span>
                  <span class="file-size">
                    {{ diskSize(file.size) }}
                    <el-button type="primary" link @click="downloadFile(index)">
                      {{ $t('cellFile.download') }}
                    </el-button>
                  </span>
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
import { computed, ref } from "vue";
import { FormTableRowHeight } from "@common/types/nocode";
import { diskSize } from '@common/utils';
import {
  ArrowDown,
} from "@element-plus/icons-vue";
import WordPng from "@renderer/assets/image/fileTypeImg/word.png";
import ExcelPng from "@renderer/assets/image/fileTypeImg/excel.png";
import PptPng from "@renderer/assets/image/fileTypeImg/ppt.png";
import PdfPng from "@renderer/assets/image/fileTypeImg/pdf.png";
import AudioPng from "@renderer/assets/image/fileTypeImg/audio.png";
import VideoPng from "@renderer/assets/image/fileTypeImg/video.png";
import ZipPng from "@renderer/assets/image/fileTypeImg/zip.png";
import TxtPng from "@renderer/assets/image/fileTypeImg/txt.png";

type FileFile = {
  uid: string;
  name: string;
  status: string;
  size: number;
  url?: string;
  relativePath?: string;
};

const props = withDefaults(defineProps<{
  fileList: FileFile[];
  rowHeightLevel: FormTableRowHeight;
  showArrowButton: boolean;
}>(), {
  showArrowButton: true
});

const imgHeight = ref({
  [FormTableRowHeight.SMALL]: 32,
  [FormTableRowHeight.MEDIUM]: 66,
  [FormTableRowHeight.LARGE]: 110,
  [FormTableRowHeight.AUTO]: 32,
})

const toolbarRef = ref(null);
const isPopoverVisible = ref(false);
const showPreview = ref(false)
const fileData = computed(()=>{
  return props.fileList.filter(item=>item && typeof item === "object");
});

const currentIndex = ref(0)

const getFileUrl = (file?: FileFile): string => {
  const candidates = [file?.url, file?.relativePath];
  const validUrl = candidates.find((item) => {
    return typeof item === "string" && item.trim() && item !== "null" && item !== "undefined";
  });
  return validUrl || "";
}

const togglePopover = (): void => {
  isPopoverVisible.value = true;
};

const downloadFile = async (index: number): Promise<void> => {
  const file = fileData.value[index];
  if (!file) return;

  const fileUrl = getFileUrl(file);
  if (!fileUrl) return;

  const response = await fetch(fileUrl).catch(() => null);
  if (!response?.ok) return;

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(blobUrl);
  link.remove();
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

const getImageUrl = (file) => {
  const fileName = file.name || "";
  const fileExtension = fileName.split(".").pop().toLowerCase();
  if (wordExtenstions.includes(fileExtension)) {
    return WordPng;
  } else if (excelExtenstions.includes(fileExtension)) {
    return ExcelPng;
  } else if (pptExtenstions.includes(fileExtension)) {
    return PptPng;
  } else if (pdfExtenstions.includes(fileExtension)) {
    return PdfPng;
  } else if (audioExtenstions.includes(fileExtension)) {
    return AudioPng
  } else if (videoExtenstions.includes(fileExtension)) {
    return VideoPng
  } else if (zipExtenstions.includes(fileExtension)) {
    return ZipPng;
  } else if (imageExtensions.includes(fileExtension)) {
    return getFileUrl(file)
  } else {
    return TxtPng;
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
  const url = getFileUrl(item)
  const value = fileData.value.filter(it => isMedia(it)).map(it => getFileUrl(it)).filter(Boolean)
  currentIndex.value = value.findIndex(v => v === url) === -1 ? 0 : value.findIndex(v => v === url)
  showPreview.value = true
}
</script>

<style scoped lang="scss">
.file-preview-toolbar {
  width: 100%;
  height: fit-content;
  display: flex;
  align-items: center;
  position: absolute;
  position: static;

  .thumbnail-container {
    width: 100%;
    height: fit-content;
    line-height: 20px;
    gap: 4px;
    overflow: hidden;
    display: flex;
    flex-wrap: wrap;

    img {
      cursor: var(--cursor-pointer);
      object-fit: cover; /* 保持比例裁切，不拉伸 */
      border-radius: 2px;
    }

    .video-box {
      position: relative;
      cursor: var(--cursor-pointer);
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
