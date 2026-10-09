<template>
  <b2-form-element>
    <el-upload
    ref="uploadRef"
    :http-request="uploadFile"
    list-type="picture"
    :on-preview="handlePictureCardPreview"
    :on-remove="beforeRemove"
    v-bind="$attrs"
    :disabled="widget.isReadonly"
  >
  <el-button type="primary" :disabled="widget.isReadonly">{{ $t('buttonName') }}</el-button>
    <el-icon><Plus /></el-icon>
  </el-upload>
    <el-dialog v-model="dialogVisible" :append-to-body="!widget.isPlaying" align-center width="auto">
      <img :src="dialogImageUrl" alt="Preview Image" />
    </el-dialog>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { OptionFontValue, useWidget } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { PROJECT_ID, REPORT_ID } from "@renderer/types/inject";
import { ref, inject } from "vue";
import { ElMessage, UploadFile, UploadFiles, UploadInstance, UploadProgressEvent, UploadProps, UploadRawFile, UploadRequestOptions } from "element-plus";
import { Plus } from '@element-plus/icons-vue';
import { Uploader, CustomUploadFile } from "./uploader";
import i18next, { $t } from "@renderer/widgets/i18next";

const projectId = inject(PROJECT_ID);
const reportId = inject(REPORT_ID);
const widget = useWidget<Uploader>();
const uploadRef = ref<UploadInstance>();
widget.reportId = reportId;
const uploadFile = widget.uploadFile;

const imgType = "bmp,jpg,jpeg,png,tif,gif,pcx,tga,exif,fpx,svg,psd,cdr,pcd,dxf,ufo,eps,ai,raw,WMF,webp,avif,apng";

const dialogImageUrl = ref("");
const dialogVisible = ref(false);
const handlePictureCardPreview: UploadProps["onPreview"] = (uploadFile) => {
  dialogImageUrl.value = uploadFile.url!;
  dialogVisible.value = true;
};

const beforeRemove = (uploadFile: CustomUploadFile, uploadFiles: UploadFiles) => {
  widget.overrideValue.value = widget.overrideValue.value.filter((item) => item.name !== uploadFile.response.data.url);
};
</script>

<style lang="scss" scoped>
.el-uploader{
  width: 148;
}

.el-dialog {
  .el-dialog__body {
    img {
      width: 100%;
      height: 100%;
      max-width: 1200px;
      max-height: 800px;
    }
  }
}
</style>
