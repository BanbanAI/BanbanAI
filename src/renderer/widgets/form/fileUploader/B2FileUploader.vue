<template>
  <b2-form-element v-bind="$attrs">
  <div class="file-uploader-container" :class="{'mobile': isMobileDevice}">

    <el-upload
      v-if="isMobileDevice"
      action="javascript:void(0);"
      drag
      ref="uploadRef"
      class="list-file-preview upload-button-wrapper"
      :class="{
        'isEdit': widget.isEditable
      }"
      v-model:file-list="widget.fileList"
      :multiple="widget.fileSelectMode === 'select-mulitple'"
      :before-upload="beforeUpload"
      :http-request="uploadFile"
      list-type="text"
      :on-remove="widget.beforeRemove"
      :on-success="handleSuccess"
      :on-progress="handleProgress"
      :on-change="handleChange"
      v-bind="$attrs"
      :show-file-list="false"
      :style="{
        display: showUploadBox ? 'block': 'none',
        marginTop: !fileList.length || !widget.isReadonly ? '' : '-20px',
        '--list-item-width': '100%',
        '--card-item-width': '100%'
      }"
      @paste="handlePaste"
    >
      <template #trigger v-if="!fileList.length || !widget.isReadonly">
        <div class="upload-container" @click.stop :title="$t('pasteTip')">
          <div type="primary" class="upload-button">
            <span  @click.stop="triggerUpload" class="upload-span" title="">
              <el-icon :size="16"><i-ven-icon-widget-form-file-uploader-file /></el-icon>
              {{ $t('uploadFile') }}&nbsp;
            </span>
          </div>
        </div>
      </template>
    </el-upload>

    <el-upload
      v-else
      drag
      ref="uploadRef"
      class="list-file-preview upload-button-wrapper"
      :class="{
        'list-in-subform': widget.isInSubForm,
        'isEdit': widget.isEditable
      }"
      v-model:file-list="widget.fileList"
      :multiple="widget.fileSelectMode === 'select-mulitple'"
      :before-upload="beforeUpload"
      :http-request="uploadFile"
      list-type="text"
      :on-remove="widget.beforeRemove"
      :on-success="handleSuccess"
      :on-progress="handleProgress"
      :on-change="handleChange"
      v-bind="$attrs"
      :show-file-list="false"
      :style="{
        display: showUploadBox ? 'block': 'none',
        marginTop: (!fileList.length && widget.isInSubForm) || (!widget.isReadonly && !widget.isInSubForm) ? '' : '-20px',
        '--list-item-width': widget.isInSubForm || isMobileDevice ? '100%' : widget.inputWidthStyle,
        '--card-item-width': widget.isInSubForm || isMobileDevice ? '100%' : '360px',
      }"
      @paste="handlePaste"
    >
      <template #trigger v-if="(!fileList.length && widget.isInSubForm) || (!widget.isReadonly && !widget.isInSubForm)">
        <div class="upload-container" @click.stop :title="i18next.t('pasteTip')">
          <div type="primary" class="upload-button">
            <span  @click.stop="triggerUpload" class="upload-span" title="">
              <el-icon :size="16"><i-ven-icon-widget-form-file-uploader-file /></el-icon>
              {{ i18next.t('uploadFile') }}&nbsp;
            </span>
            <span v-if="!isMobileDevice" style="color: var(--text-color-secondary); text-wrap: nowrap; min-width: 0; overflow: hidden; text-overflow: ellipsis;">
              {{ i18next.t('dragPaste') }}
            </span>
          </div>
        </div>
      </template>
      <div class="wrap-cell-image" v-if="widget.isInSubForm && fileList.length > 0" @click.stop>
        <cell-file ref="cellFileRef" :widget="widget" :fileList="fileList" :rowHeightLevel="FormTableRowHeight.SMALL">
          <template v-if="!widget.isReadonly" #popover-header>
            <el-button
              class="upload-button"
              type="primary"
              @click="triggerUpload"
            >
              <el-icon :size="16"><i-ven-icon-widget-form-file-uploader-file /></el-icon>
              {{ i18next.t('uploadFile') }}
            </el-button>
          </template>
          <template #list-item-option="{ file }">
            <el-button link @click.stop="widget.beforeRemove(file as any)">
              <el-icon :size="14" color="var(--el-color-danger)"><Delete /></el-icon>
            </el-button>
          </template>
        </cell-file>
      </div>
    </el-upload>

    <div
      class="list-file-preview upload-list-wrapper"
      v-if="widget.fileList?.length &&
        (!widget.isInSubForm || isMobileDevice)"
      :class="{
        'list-file-preview-Move': widget.isEditable
      }"
    >
      <Draggable
        class="el-upload-list"
        :list="fileList"
        :component-data="{
          tag: 'transition-group',
          type: 'transition-group',
          name: !drag ? 'flip-list' : null
        }"
        item-key="url"
        v-bind="dragOptions"
        @start="onStart"
        @end="onEnd"
      >
        <template #item="{ element: file }">
          <div class="el-upload-list__item">
            <div class="preview-file-list" @click="previewVideo(file)" element-loading-background="transparent">
              <img
                v-if="isImage(file)"
                class="file-thumbnail"
                :src="file.url || getBuiltinWidgetAsset('widget.form.file-uploader', 'fileTypeImg/image.png')"
              />
              <img v-else class="file-thumbnail" :src="getPreviewImg(file)" />
              <div class="file-data">
                <div class="file-name" :title="file.name">
                  <span class="file-name-val">{{ file.name?.substring(0, file.name.lastIndexOf(".")) }}</span>
                  <span class="file-suffix">{{ file.name?.substring(file.name.lastIndexOf(".")) }}</span>
                </div>
                <el-progress :percentage="(file.percentage ?? 100)" color="#4ba0fc" v-if="['ready', 'uploading'].includes(file.status) || file.loading" :show-text="false"/>
                <div class="file-size" v-if="['ready', 'uploading'].includes(file.status) || file.loading">
                  {{ file.percentage ?? 100 }}%
                </div>
                <div class="file-size" v-else>
                  {{ diskSize(file.size) }}
                </div>
              </div>
              <div class="btn-delete">
                <el-button link @click="downloadFile(file)">
                  <el-icon :size="14" color="var(--el-color-info)"><Download /></el-icon>
                </el-button>
                <el-button
                  v-if="!widget.isReadonly"
                  link
                  @click.stop="widget.beforeRemove(file)"
                >
                  <el-icon :size="14" color="var(--el-color-danger)"><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </template>
      </Draggable>
    </div>

    <sub-cell-file v-if="widget.isInSubForm && widget.isReadonly && fileList.length > 0" :widget="widget" :fileList="fileList"></sub-cell-file>
    <div class="value" :class="{'mobile': isMobileDevice}" v-if="placeholderVisible">{{ i18next.t('noContent') }}</div>
    <!-- <div class="file-readonly" v-else>
      <div class="file-item" v-for="file in widget.inputValue" :key="file.uid">
        <div class="wrap-data">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatFileSize(file.size) }}</span>
        </div>

        <el-button class="btn-download" link @click="downloadFile(file)">
          <el-icon :size="14" color="var(--el-color-success-dark-2)"
            ><Download
          /></el-icon>
        </el-button>
      </div>
    </div> -->
    <el-dialog
      v-model="dialogVisible"
      :append-to-body="!widget.isPlaying"
      align-center
      width="auto"
    >
      <img :src="dialogImageUrl" alt="Preview Image" />
    </el-dialog>

  </div>
  </b2-form-element>
  <teleport to="body">
    <table-media-viewer
      v-if="showPreview"
      :z-index="9000"
      :initial-index="currentIndex"
      :url-list="widget.fileList.filter(item => isMedia(item)).map(item => item.url)"
      :hide-on-click-modal="true"
      :infinite="true"
      :autoplay="false"
      @close="showPreview = false"
    />
  </teleport>
</template>

<script lang="ts" setup>
import { diskSize } from "@common/utils/other";
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { REPORT_ID } from "@renderer/types/inject";
import { ref, inject, onMounted, watch, computed, nextTick } from "vue";
import { FormTableRowHeight } from "../_common/type";
import CellFile from "./CellFile.vue";
import { CellFile as SubCellFile } from "../_common/table/index";
import { UploadFile, UploadInstance, UploadProps, ElMessage } from "element-plus";
import { FileUploader, CustomUploadFile } from "./fileUploader";
import { Uploader } from "@renderer/widgets/form/uploader/uploader";
import { Download, CircleClose, Document, Delete } from "@element-plus/icons-vue";
import IVenIconFile from "~icons/ven-icon/widget-form-file-uploader-file";
import Draggable from 'vuedraggable'
import type { Sortable } from 'sortablejs'
import i18next, { $t } from "@renderer/widgets/i18next";
import { getBuiltinWidgetAsset } from "@renderer/widgets/assets";

const isMobileDevice = isMobile();

const uploader = useWidget<Uploader>();
const uploadFile = uploader.uploadFile;
const showPreview = ref(false);

const reportId = inject(REPORT_ID);
const widget = useWidget<FileUploader>();
const uploadRef = ref<UploadInstance>();
const cellFileRef = ref();
widget.reportId = reportId;

const dialogImageUrl = ref("");
const dialogVisible = ref(false);

const drag = ref(false)
const fileList = computed<any>(() => {
  return widget.fileList;
})
const showUploadBox = computed(() => {
  // // 是 isInSubForm 直接不展示
  // if (widget.isInSubForm) return false
  // 不是编辑 直接不展示
  if (widget.isReadonly) return false
  return true
})

const placeholderVisible = computed(() => {
  return widget.isReadonly && !fileList.value?.length;
})
const isFocus = ref(false)
const handlePaste = (e) => {
  if(!isFocus.value || widget.isEditable) {
    return
  }
  const items = e.clipboardData.items
  const filteredItems = []
  for(const item of items) {
    if(item.kind === "file"){
      filteredItems.push(item)
    }
  }
  const totalFileCount = fileList.value.length + filteredItems.length
  // 检查limit-count限制
  if (widget.getOption("limit-count")) {
    const range = widget.getOption("limit-count-range");
    if (range && totalFileCount > range[1]) {
      ElMessage.error(i18next.t('maxFileCount', { count: range[1] }));
      return;
    }
  }

  for (const item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile()
      uploadRef.value.handleStart(file)
      uploadRef.value.submit()
    }
  }
}

const downloadFile = (file: UploadFile): void => {
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

const dragOptions = computed(()=>{
  return {
    animation: 200,
    group: "description",
    disabled: widget.isReadonly,
    ghostClass: "ghost"
  }
})

const onStart = () => {
  drag.value = true
}
const onEnd = (event: Sortable.SortableEvent) => {
  drag.value = false
  const newIndex = event.newIndex
  const oldIndex = event.oldIndex

  uploader.MoveValue(oldIndex, newIndex)
}
const triggerUpload = () => {
  if(widget.isEditable) {
    return
  }
  if (uploadRef.value) {
    cellFileRef.value?.changePopoverVisible(false);

    const triggerEl = uploadRef.value?.$el?.querySelector('.el-upload__input');
    if (triggerEl) {
      triggerEl.click();
    } else {
      uploadRef.value?.submit();
    }
  }
};

onMounted(async () => {
  // watch(() => widget.inputValue, () => {
  //   if (widget.inputValue) {
  //     widget.fileList = widget.inputValue.map((file) => {
  //       return {
  //         name: file.name,
  //         uid: file.uid,
  //         status: "success",
  //         size: file.size,
  //         url: file.url,
  //       };
  //     });
  //   }
  // }, {deep: true, immediate: true});

  await nextTick();
  if (uploadRef.value && uploadRef.value.$el) {
    const uploadEl = uploadRef.value.$el.querySelector('.el-upload');

    if (uploadEl) {
      uploadEl.addEventListener('focusin', () => {
        isFocus.value = true
      });
      uploadEl.addEventListener('focusout', () => {
        isFocus.value = false
      });
    }
  }

  if (!isMobileDevice) {
    if (widget.isInTable) {
      cellFileRef.value?.show();
    }
  }
});

const removeFileState = (uid: number) => {
  const idx = widget.fileList.findIndex((f) => f.uid === uid);
  if (idx !== -1) {
    widget.fileList.splice(idx, 1);
    widget.readyFilesNum = widget.fileList.filter(f => f.status === "ready").length;
  }
};

const beforeUpload: UploadProps["beforeUpload"] = (rawFile) => {
  return new Promise((resolve, reject) => {
    const totalFileCount = widget.readyFilesNum + fileList.value.length;
    if (widget.getOption("limit-count")) {
      const range = widget.getOption("limit-count-range");
      if (range && totalFileCount > range[1]) {
        ElMessage.error(i18next.t('maxFileCount', { count: range[1] }));
        removeFileState(rawFile.uid);
        return reject(false);
      }
    }

    setTimeout(() => {
      resolve(true);
    }, 100);
  });
};

const handleSuccess: UploadProps["onSuccess"] = (
  response,
  uploadFile,
  uploadFiles
) => {

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const allFileNames = widget.fileList.filter(f => f.status === "success").map((f) => f.name);
      allFileNames.splice(allFileNames.indexOf(uploadFile.name), 1);
      // 释放本地内存
      if (uploadFile.url?.startsWith("blob:")) {
        URL.revokeObjectURL(uploadFile.url);
      }
      // 更新fileList中的对应文件
      const target = widget.fileList.find((f) => f.uid === uploadFile.uid) as CustomUploadFile | undefined;
      if (target) {
        target.status = "success";
        target.url = response.data.url;
        target.name = generateUniqueName(target.name, allFileNames);
        target.size = response.data.fileSize || uploadFile.size;
        delete target.previewUrl;
        target.loading = false;
      }

      widget.inputValue = widget.fileList.map((f: CustomUploadFile) => {
        if(f.status === "success") {
          return {
            name: f.name,
            uid: f.uid,
            status: f.status,
            size: f.size || f.raw?.size || 0,
            url: f.response?.data?.url || f.url,
            md5: f.response?.data?.md5 || f.md5,
            previewUrl: f.raw && URL.createObjectURL(f.raw) || f.previewUrl,
          }
        }
        return null
      }).filter(Boolean);

      nextTick(() => {
        widget.validate()
      })

    }, 700);
  });
}

const handleChange: UploadProps["onChange"] = (file, fileList) => {};

watch(() => {
  return widget.fileList.filter((f: any) => ["ready", 'uploading'].includes(f.status) || f.loading).length
}, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    widget.readyFilesNum = newVal;
  }
}, {deep: true})

const handleProgress: UploadProps["onProgress"] = (event, uploadFile) => {
  uploadFile.percentage = Math.min(event.percent, uploadFile.percentage + 1);
  if (uploadFile.percentage === 100) {
    uploadFile['loading'] = false;
  } else {
    uploadFile['loading'] = true;
  }
};

// 生成唯一文件名（处理重名）
const generateUniqueName = (originalName, allNames) => {
  let newName = originalName;
  let counter = 0;

  // 提取文件名和扩展名（如 "image.jpg" → "image" 和 ".jpg"）
  const dotIndex = originalName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? originalName.substring(0, dotIndex) : originalName;
  const extension = dotIndex > 0 ? originalName.substring(dotIndex) : "";

  // 有重名才进入
  if (allNames.includes(newName)) {
    // 检查并递增数字后缀
    allNames.forEach((nameItem: string) => {
      if (nameItem && nameItem.indexOf(baseName) !== -1) {
        counter++;
      }
    });
  }

  if (counter > 0) {
    newName = `${baseName}_${counter}${extension}`;
  }

  return newName;
};

const currentIndex = ref(0)

const isMedia = (file) => {

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

  const pdfExtenstions = [
    "pdf",
  ]

  const fileName = file.name || "";
  const fileExtension = fileName.split(".").pop().toLowerCase();

  if ([...videoExtenstions, ...imageExtensions, ...pdfExtenstions].includes(fileExtension)) {
    return true
  }

  return false
}

// 点击缩略图预览视频
const previewVideo = (item) => {
  if(item.loading || !isMedia(item)) {
    return
  }
  const url = item.url
  const value = widget.fileList.filter(it => isMedia(it)).map(it => it.url)
  currentIndex.value = value.findIndex(v => v === url) === -1 ? 0 : value.findIndex(v => v === url)
  showPreview.value = true
}

// 判断是否是图片--选择预览小图样式
const isImage = (file) => {
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
  const fileName = file.name || "";
  const fileExtension = fileName.split(".").pop().toLowerCase();
  return imageExtensions.includes(fileExtension);
};

// 非图片文件--预览样式
const getPreviewImg = (file) => {
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
  const txtExtenstions = [
    "txt",
  ]
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
  } else if (txtExtenstions.includes(fileExtension)) {
    return getBuiltinWidgetAsset("widget.form.file-uploader", "fileTypeImg/txt.png")
  } else {
    return getBuiltinWidgetAsset("widget.form.file-uploader", "fileTypeImg/unrecognized.png")
  }
}
</script>
<style lang="scss" scoped>
.value {
  display: flex;
  height: 32px;
  align-items: center;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 0 8px;
  line-height: 20px;
  color: var(--text-color-inactive);
}

.preview-file-list {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  position: relative;
  overflow: hidden;
  height: 56px;
  padding: 8px;
  background-color: var(--bg-color-overlay);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  &:hover .file-name {
    color: var(--color-primary);
  }
  :deep(.el-loading-mask) {
    height: 100%;
    .el-loading-spinner {
      top: calc(50% + 5px);
      .circular {
        width: 20px;
        height: 20px;
      }
    }
  }
  .loading-progress {
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    position: absolute;
    top: 0;
    left: 0;
    z-index: 10;
    transition: height 0.5s ease;
    span {
      position: absolute;
      left: calc(50% - 10px);
      top: 34px;
      color: var(--color-primary);
    }
  }
  .file-thumbnail {
    width: 40px;
    height: 40px;
    object-fit: cover;
    margin-right: 16px;
    border-radius: 2px;
  }

  .file-data {
    height: 100%;
    width: calc(100% - 96px);

    .file-name {
      width: 100%;
      // white-space: nowrap;
      // overflow: hidden;
      // text-overflow: ellipsis;
      line-height: 20px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      justify-content: flex-start;

      .file-name-val{
        max-width: calc(100% - 80px);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: inline-block;
      }
      .file-suffix {
        display: inline-block;
      }
    }
    :deep(.el-progress) {
      position: unset !important;
    }
    .file-size {
      color: var(--el-color-info);
      font-size: 12px;
      line-height: 16px;
    }
    .file-loading {
      position: relative;
      width: 100%; // 父容器宽度
      height: 4px; // 进度条高度
      background-color: rgba(0,0,0,0.1); // 进度条背景
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 4px;

      .loading {
        height: 100%;
        width: 0%; // 初始宽度
        background-color: var(--color-primary); // 进度条颜色
        transition: width 0.3s ease; // 动画平滑
        border-radius: 3px 0 0 3px;
      }

      span {
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        font-size: 12px;
        color: var(--text-color-primary);
        margin-left: 8px;
      }
    }
  }
  .btn-delete {
    display: flex;

    .el-button {
      margin: 0px;
    }
  }
}
:deep(.list-file-preview) {
  // --list-item-width: 360px;
  --list-item-min-width: 360px;
  // --list-item-max-width: 450px;
  --list-item-max-width: 100%;
  --card-item-width: calc(25% - 16px);
  --card-item-min-width: 100px;
  --card-item-max-width: 200px;


  &.list-file-preview-Move {
    transition: transform 0.5s;
    .el-upload-list__item {
      cursor: move;
    }

    .ghost {
      opacity: 0.5;
    }
  }

  .flip-list-move {
    transition: transform 0.5s;
  }
  // max-width: 360px;

  .el-upload {
    width: 100%;
    justify-content: flex-start;
    pointer-events: none;
  }

  .el-upload-list {
    width: 100%;
    display: flex;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 16px;
    .el-upload-list__item {
      width: var(--list-item-min-width);
      max-width: var(--list-item-max-width);
      transition: none !important;
      margin: 0;
    }
  }

  .el-upload-dragger {
    pointer-events: none;
    height: 32px;
    width: var(--list-item-width);
    max-width: var(--list-item-max-width);
    border-radius: 4px;
    color: var(--text-color-regular);
    padding: 0px;
  }

  .upload-container {
    pointer-events: all;
    height: 32px;
    width: var(--list-item-width);
    max-width: var(--list-item-max-width);
    cursor: var(--cursor-default);
  }

  .upload-button {
    display: flex;
    align-items: center;
    height: 100%;
    justify-content: center;

    .upload-span {
      color: var(--color-primary);
      cursor: var(--cursor-pointer);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      text-wrap: nowrap;
    }
  }

  &.list-in-subform {
    margin-top: 0 !important;

    .el-upload {
      width: 100%;

      .wrap-cell-image {
        height: 32px;
        display: flex;
        align-items: center;
        width: 100%;
        pointer-events: all;

        &.mobile {
          height: auto;
        }

        .image-preview-toolbar {
          .el-button {
            pointer-events: all;
          }
        }
      }

      .upload-button {
        width: calc(100%);
        height: 32px;
        min-width: 78px;
        padding: 0px 8px;
    }
  }
}
}

:deep(.isEdit) {
  .el-upload:focus {
    .el-upload-dragger {
      border-color: var(--el-border-color) !important;
    }
  }

  .el-upload:hover {
    .el-upload-dragger {
      border-color: var(--el-border-color) !important;
    }
  }

  .upload-container {
    cursor: pointer !important;

    .upload-span {
      cursor: pointer !important;
    }
  }
}

:deep(.isEdit) {
  .el-upload:focus {
    .el-upload-dragger {
      border-color: var(--el-border-color) !important;
    }
  }

  .el-upload:hover {
    .el-upload-dragger {
      border-color: var(--el-border-color) !important;
    }
  }

  .upload-container {
    cursor: pointer !important;

    .upload-span {
      cursor: pointer !important;
    }
  }
}

.file-readonly {
  --list-item-width: calc(50% - 16px);
  --list-item-min-width: 300px;
  --list-item-max-width: 450px;
  --card-item-width: calc(25% - 16px);
  --card-item-min-width: 100px;
  --card-item-max-width: 200px;

  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .file-item {
    width: var(--list-item-min-width);
    max-width: var(--list-item-max-width);
    height: 54px;
    display: flex;
    padding: 0 8px;
    border-radius: 4px;
    background-color: var(--bg-color-overlay);
    border: 1px solid var(--border-color);
    align-items: center;

    &:hover .btn-download {
      display: block;
    }

    .wrap-data {
      height: 100%;
      width: calc(100% - 18px);
      display: flex;
      flex-direction: column;
      justify-content: space-evenly;
      padding-right: 8px;
      font-size: 12px;

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
      }
    }

    .btn-download {
      display: none;

      .el-icon {
        cursor: var(--cursor-pointer);
      }
    }
  }
}

.file-uploader-container.mobile {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;

  .upload-list-wrapper {
    :deep(.el-upload-list) {
      margin-top: 0;
      gap: 8px;
      .el-upload-list__item {
        background: none;
        min-width: 0;
        width: 100%;
      }
      .preview-file-list {
        background: none;
        img {
          border-radius: 4px;
        }
      }
    }
  }

  .upload-button-wrapper {
    width: 100%;
    height: 40px;
    :deep(.el-upload-dragger) {
      width: 100%;
      height: 40px;
      border: 1px solid var(--el-border-color);
      .upload-container {
        width: 100%;
        height: 100%;
      }
      .upload-button {
        width: 100%;
        height: 100%;
      }
      .upload-span {
        width: 100%;
        height: 100%;
        font-size: 14px;
        color: var(--el-text-color-regular);
      }
    }
  }
}

.value.mobile {
  height: 40px;
  border-radius: 4px;
  padding: 0 12px !important;
  line-height: 40px;
}

</style>

