<template>
  <div class="file-preview-toolbar" ref="toolbarRef" v-if="fileData.length">
    <div class="thumbnail-container">
      <teleport to="body">
        <table-media-viewer
          v-if="showPreview"
          :z-index="9000"
          :initial-index="currentIndex"
          :url-list="mediaUrls"
          :hide-on-click-modal="true"
          :infinite="true"
          :autoplay="false"
          @close="showPreview = false"
        ></table-media-viewer>
      </teleport>
      {{ fileData.map(file => file.name).join(", ") }}
    </div>

    <el-button
      v-if="showArrowButton && fileData.length > 0"
      link
      :icon="ArrowDown"
      @click.stop="togglePopover"
    ></el-button>

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
              <div
                v-for="(file, index) in fileData"
                :key="file.uid || `${file.name}-${index}`"
                class="popover-file-item"
              >
                <img
                  :src="getPreviewImg(file)"
                  class="popover-thumbnail"
                  @click.stop="previewFile(file)"
                >
                <div class="item-right">
                  <span class="file-name" :title="file.name">{{ file.name }}</span>
                  <span class="file-size">
                    {{ diskSize(file.size) }}
                    <el-button type="primary" link @click="downloadFile(index)">
                      {{ $t("download") }}
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
import { diskSize } from "@common/utils/other";
import { ArrowDown } from "@element-plus/icons-vue";
import { FormTableRowHeight } from "../type";
import { createWidgetI18n } from "@renderer/widgets/i18n";
import { getBuiltinWidgetAsset } from "@renderer/widgets/assets";

type FileFile = {
  uid?: string;
  name: string;
  status?: string;
  size: number;
  url?: string;
  relativePath?: string;
};

type FileWidget = {
  virtualPath?: string;
};

const props = withDefaults(defineProps<{
  fileList: FileFile[];
  rowHeightLevel?: FormTableRowHeight;
  showArrowButton?: boolean;
  widget?: FileWidget;
}>(), {
  rowHeightLevel: FormTableRowHeight.SMALL,
  showArrowButton: true,
});

const i18next = createWidgetI18n(props.widget.type);
const $t = i18next.t;
const toolbarRef = ref(null);
const isPopoverVisible = ref(false);
const showPreview = ref(false);
const currentIndex = ref(0);

const wordExtensions = ["docx", "doc", "dotx", "docm"];
const excelExtensions = ["xlsx", "xls", "xlsm", "xml"];
const pptExtensions = ["ppt", "pptx", "pptm"];
const pdfExtensions = ["pdf"];
const audioExtensions = ["wav", "mp3", "wma", "ape", "flac", "ogg", "aac"];
const videoExtensions = ["mp4", "avi", "mov", "rmvb", "mkv", "wmv", "flv", "avchd", "webm"];
const zipExtensions = ["zip", "rar", "7z", "gzip", "bzip2"];
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
  "wmf",
  "webp",
  "avif",
  "apng",
];

const fileData = computed(() => {
  return props.fileList.filter((item) => item && typeof item === "object");
});

const mediaUrls = computed(() => {
  return fileData.value
    .filter((item) => isMedia(item))
    .map((item) => getFileUrl(item))
    .filter(Boolean);
});

const togglePopover = (): void => {
  isPopoverVisible.value = true;
};

const getFileUrl = (file?: FileFile): string => {
  const candidates = [file?.url, file?.relativePath];
  const validUrl = candidates.find((item) => {
    return typeof item === "string" && item.trim() && item !== "null" && item !== "undefined";
  });
  return validUrl || "";
};

const getStaticIcon = (iconName: string): string => {
  return getBuiltinWidgetAsset("widget.form.file-uploader", `fileTypeImg/${iconName}`);
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

const getFileExtension = (file: FileFile): string => {
  return file.name?.split(".").pop()?.toLowerCase() || "";
};

const getPreviewImg = (file: FileFile): string => {
  const fileExtension = getFileExtension(file);

  if (wordExtensions.includes(fileExtension)) return getStaticIcon("word.png");
  if (excelExtensions.includes(fileExtension)) return getStaticIcon("excel.png");
  if (pptExtensions.includes(fileExtension)) return getStaticIcon("ppt.png");
  if (pdfExtensions.includes(fileExtension)) return getStaticIcon("pdf.png");
  if (audioExtensions.includes(fileExtension)) return getStaticIcon("audio.png");
  if (videoExtensions.includes(fileExtension)) return getStaticIcon("video.png");
  if (zipExtensions.includes(fileExtension)) return getStaticIcon("zip.png");
  if (imageExtensions.includes(fileExtension)) return getFileUrl(file);
  return getStaticIcon("txt.png");
};

const isMedia = (file: FileFile): boolean => {
  const fileExtension = getFileExtension(file);
  return videoExtensions.includes(fileExtension) || imageExtensions.includes(fileExtension) || pdfExtensions.includes(fileExtension);
};

const previewFile = (file: FileFile): void => {
  if (!isMedia(file)) return;

  const url = getFileUrl(file);
  if (!url) return;

  const index = mediaUrls.value.findIndex((item) => item === url);
  if (index === -1) return;

  currentIndex.value = index;
  showPreview.value = true;
};
</script>

<style scoped lang="scss">
.file-preview-toolbar {
  width: 100%;
  height: 20px;
  display: flex;
  align-items: center;
  position: static;

  .thumbnail-container {
    width: calc(100% - 20px);
    height: 20px;
    line-height: 20px;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  > .el-button {
    cursor: var(--cursor-pointer);
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
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  border-radius: 4px;
  background-color: var(--bg-color-overlay);
  border: 1px solid var(--border-color);

  .popover-thumbnail {
    width: 42px;
    height: 42px;
    border-radius: 2px;
    object-fit: cover;
    cursor: var(--cursor-pointer);
  }

  .item-right {
    display: flex;
    flex: 1;
    flex-direction: column;
    margin-left: 16px;
    overflow: hidden;

    .file-name {
      color: var(--text-color-regular);
      display: inline-block;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-size {
      color: var(--text-color-placeholder);
      display: flex;
      justify-content: space-between;
    }
  }
}
</style>
