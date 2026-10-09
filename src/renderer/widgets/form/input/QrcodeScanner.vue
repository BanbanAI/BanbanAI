<template>
  <!-- 扫码弹窗 -->
  <el-dialog
    v-model="isScannerVisible"
    fullscreen
    :show-close="false"
    :modal="false"
    class="text-input-qrcode-scanner-dialog"
    append-to-body
    destroy-on-close
    @close="stopCameraScan"
  >
    <div class="scanner-wrapper">
      <div :id="readerId" class="reader-box"></div>
      <div class="scan-overlay">
        <div class="overlay-top">
          <div class="scan-tip">{{ $t('alignToScanFrame', { type: scanTypeText }) }}</div>
        </div>

        <div :class="`overlay-center scan-type-${scanInputType}`">
          <div class="overlay-left"></div>

          <div :class="`scan-window scan-type-${scanInputType}`">
            <div class="scan-line"></div>
            <span class="corner top-left"></span>
            <span class="corner top-right"></span>
            <span class="corner bottom-left"></span>
            <span class="corner bottom-right"></span>
          </div>

          <div class="overlay-right"></div>
        </div>
      </div>

      <div class="scan-controls">
        <div class="control-btn back-btn" @click="isScannerVisible = false">
          <el-icon size="24"><ArrowLeft /></el-icon>
        </div>

        <div class="control-bar" v-if="false">
          <div class="album-btn" @click="triggerFileSelect('file')">
            <div class="icon-circle">
                <el-icon size="20"><Picture /></el-icon>
            </div>
            <span>{{ $t('album') }}</span>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>

  <!-- 拍照上传 -->
  <input
    type="file"
    ref="cameraInputRef"
    accept="image/*"
    capture="environment"
    style="display: none"
    @change="handleFileScan"
    :disabled="!isCameraUploadEnabled"
  />
  <!-- 文件上传 -->
  <input
    type="file"
    ref="fileInputRef"
    accept="image/*"
    style="display: none"
    @change="handleFileScan"
    :disabled="!isFileUploadEnabled"
  />

  <!-- 文件解析 -->
  <div :id="readerHiddenId" style="display: none;"></div>

  <!-- 子表单连续扫码 -->
  <continuous-scan-dialog
    v-if="widget.isInSubForm && widget.isScanInputContinuous"
    v-model:visible="isContinuousScanDialogVisible"
    :value="widget.inputValue"
    @next="handleContinuousNext"
    @rescan="handleContinuousRescan"
  />
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { TextInput } from "./textInput";
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from "vue";
import { ArrowLeft, Picture } from '@element-plus/icons-vue';
import { Html5Qrcode } from 'html5-qrcode';
import { ElMessage, ElLoading } from 'element-plus';
import { compressImage } from './utils';
import ContinuousScanDialog from './ContinuousScanDialog.vue';
import { injectAutoSubmitEmitter } from "../subForm/utils";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const props = defineProps({
  widget: TextInput,
  isCameraUploadEnabled: {
    type: Boolean,
    default: true
  },
  isFileUploadEnabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits<{
  (event: "next-scan-code", value: string): void;
}>();

const widget = props.widget;
const autoSubmitEmitter = injectAutoSubmitEmitter();

const isScannerVisible = ref(false);
const isContinuousScanDialogVisible = ref(false);
const cameraInputRef = ref<HTMLInputElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

let html5QrCode: Html5Qrcode | null = null;

const readerId = `reader-${widget.uid}`;
const readerHiddenId = `reader-hidden-${widget.uid}`;

const scanInputType = computed(() => widget.scanInputType);

const scanTypeText = computed(() => {
  if (scanInputType.value === 'qrcode') return i18next.t('qrcode');
  if (scanInputType.value === 'barcode') return i18next.t('barcode');
  return i18next.t('qrcodeOrBarcode');
});

// 扫码逻辑
const handleStartScan = async () => {
  if (!isMobileDevice && widget.isScanInput && !widget.isScanInputEditable) {
    ElMessage.warning(i18next.t('openOnMobile'));
    return;
  }

  await stopCameraScan();

  const hasNavSupport = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  // isScannerVisible.value = true; // 测试

  if (!hasNavSupport || !isMobileDevice) {
    console.warn(i18next.t('cameraUnsupportedUpload'));
    if (isMobileDevice) {
      if (props.isCameraUploadEnabled) {
        triggerFileSelect('camera');
      } else {
        triggerFileSelect('file');
      }
    } else {
      triggerFileSelect('file');
    }
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    stream.getTracks().forEach(track => track.stop());

    isScannerVisible.value = true;
    await nextTick();
    startCameraLib();
  } catch (err) {
    ElMessage.warning(i18next.t('cameraPermissionFailed'));
    triggerFileSelect('file', false);
  }
};

const handleResize = async () => {
  // 重启
  if (isScannerVisible.value && html5QrCode) {
    await stopCameraScan();
    await startCameraLib();
  }
};

// 实时扫码
const startCameraLib = async () => {
  try {
    html5QrCode = new Html5Qrcode(readerId);

    const width = window.innerWidth;
    const height = window.innerHeight;
    // 确保横屏时的比例正确
    const aspectRatio = parseFloat((Math.max(height, width) / Math.min(height, width)).toFixed(2));

    const targetHeight = widget.scanInputType === 'barcode' ? 110 : 260;
    const targetWidth = widget.scanInputType === 'barcode' ? 280 : 260;

    const boxWidth = Math.min(targetWidth, width - 40);
    const boxHeight = Math.min(targetHeight, height - 40);

    const config = {
      fps: 15,
      qrbox: { width: boxWidth, height: boxHeight },
      aspectRatio: aspectRatio,
      formatsToSupport: widget.getScanFormats()
    };

    await html5QrCode.start(
      { facingMode: "environment" },
      config,
      onCameraScanSuccess,
      (e) => {}
    );

    setTimeout(() => {
       cameraEnhancements();
    }, 500);
  } catch (err) {
    console.warn(i18next.t('startFailed'), err);
    isScannerVisible.value = false;
    triggerFileSelect('file');
  }
};

// 摄像头增强功能
const cameraEnhancements = async () => {
  if (!html5QrCode) return;
  try {
    // 获取当前摄像头的能力
    const track: any = html5QrCode.getRunningTrackCameraCapabilities();

    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    const constraintsToApply: any = {};

    // 开启连续对焦
    if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
      constraintsToApply.focusMode = 'continuous';
    }

    if (Object.keys(constraintsToApply).length > 0) {
      await html5QrCode.applyVideoConstraints(constraintsToApply);
      console.log('已启用摄像头增强配置', constraintsToApply);
    }
  } catch (e) {
    console.log('启用摄像头增强配置失败，使用默认配置', e);
  }
}

// 拍照上传 文件上传
const triggerFileSelect = (scanType: 'file' | 'camera' = 'camera', isShowMessage = true) => {
  if (scanType === 'file' && !props.isFileUploadEnabled && isShowMessage) {
    ElMessage.warning(i18next.t('cameraPermissionFailed'));
    return;
  }
  if (scanType === 'file') {
    fileInputRef.value?.click();
  } else {
    cameraInputRef.value?.click();
  }
};

const handleFileScan = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  let file = input.files?.[0];
  try {
    await fileScan(file);
  } finally {
    input.value = '';
  }
};

// 文件扫码
const fileScan = async (file: File) => {
  if (!file) return;

  const loading = ElLoading.service({
    text: i18next.t('recognizing'),
    background: 'rgba(0, 0, 0, 0.2)',
  });

  try {
    // 压缩
    if (file.size > 1 * 1024 * 1024) {
      console.log(i18next.t('compressing'), file.size / 1024 / 1024, 'MB');
      file = await compressImage(file, 1200, 0.6);
      // console.log('压缩后', file.size / 1024 / 1024, 'MB');
    }

    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode(readerHiddenId);
    }

    const result = await html5QrCode.scanFileV2(file, false);

    // 成功识别
    const detectedFormat = result.result.format?.format;
    if (detectedFormat !== undefined && !widget.checkScanFormatValidity(detectedFormat)) {
      const requiredName = scanInputType.value === 'qrcode' ? i18next.t('qrcode') : i18next.t('barcode');
      ElMessage.warning(i18next.t('scanOnly', { type: requiredName }));
    } else {
      onScanSuccess(result.decodedText);
    }

  } catch (err: any) {
    ElMessage.error(i18next.t('scanUnrecognized'));
    console.warn(i18next.t('scanUnrecognized'), err);
  } finally {
    loading.close();
  }
}

const onCameraScanSuccess = (decodedText: string, decodedResult: any) => {
  const detectedFormat = decodedResult?.result?.format?.format;
  // 如果能获取到格式，且格式不在允许范围内，则忽略
  if (detectedFormat !== undefined && !widget.checkScanFormatValidity(detectedFormat)) {
    return;
  }
  onScanSuccess(decodedText);
};

const onScanSuccess = (decodedText: string) => {
  widget.inputValue = decodedText;
  widget.validate();
  // 震动
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

  ElMessage.success(i18next.t('scanSuccess'));
  isScannerVisible.value = false;
  stopCameraScan();

  if (!widget.isInSubForm && isMobileDevice) {
    autoSubmitEmitter && autoSubmitEmitter({
      type: 'mobileScan',
      fieldUid: widget.fieldId,
      value: widget.inputValue,
    });
    emit('next-scan-code', widget.inputValue);
  }

  if (widget.isInSubForm && widget.isScanInputContinuous) {
    isContinuousScanDialogVisible.value = true;
  }
};

const handleContinuousNext = () => {
  isContinuousScanDialogVisible.value = false;
  emit('next-scan-code', widget.inputValue);
};

const handleContinuousRescan = async () => {
  isContinuousScanDialogVisible.value = false;
  await nextTick();
  handleStartScan();
};

const stopCameraScan = async () => {
  if (html5QrCode) {
    try {
      if (html5QrCode.isScanning) {
        await html5QrCode.stop();
      }
      html5QrCode.clear();
    } catch (err) {}
    html5QrCode = null;
  }
};

const backHandler = (e) => {
  if (isScannerVisible.value) {
    isScannerVisible.value = false;
    stopCameraScan();
    history.pushState(null, '', location.href);
    e.preventDefault && e.preventDefault();
  }
};

onMounted(() => {
  window.addEventListener('popstate', backHandler);
  window.addEventListener('resize', handleResize);
})
onBeforeUnmount(() => {
  window.removeEventListener('popstate', backHandler);
  window.removeEventListener('resize', handleResize);
  stopCameraScan();
});

defineExpose({
  startScan: handleStartScan,
  startFileScan: triggerFileSelect,
  fileScan: fileScan,
  restartScan: handleResize,
  stopScan: stopCameraScan,
  continuousNextScan: handleContinuousNext,
  continuousRescan: handleContinuousRescan,
});
</script>

<style lang="scss">
.el-dialog.text-input-qrcode-scanner-dialog {
  background: #000 !important;
  padding: 0;
  display: flex;
  flex-direction: column;
  user-select: none;

  .el-dialog__header {
    display: none;
  }
  .el-dialog__body {
    padding: 0 !important;
    flex: 1;
    display: flex;
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .scanner-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
  }

  .reader-box {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;

    :deep(video) {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
    }
    // 隐藏默认扫描框
    #qr-shaded-region {
      display: none !important;
    }
  }

  .scan-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .overlay-top {
      display: flex;
      justify-content: center;
      align-items: center;
      padding-bottom: 20px;
      margin-top: -4.5vh;
      // margin-top: -32px;
    }
    .overlay-center {
      height: 260px;
      display: flex;
      flex-shrink: 0;
      &.scan-type-barcode {
        height: 110px;
        width: 280px;
      }
    }
    .overlay-left, .overlay-right {
      flex: 1;
      background: rgba(0, 0, 0, 0.6);
    }

    .scan-window {
      width: 280px;
      height: 100%;
      position: relative;
      // &.scan-type-barcode {
      //   .scan-line {
      //     display: none;
      //   }
      // }
    }

    .scan-tip {
      color: #fff;
      font-size: 14px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    }

    .scan-line {
      position: absolute;
      width: 100%;
      height: 2px;
      background: linear-gradient(to right, transparent, #409EFF, transparent);
      top: 0;
      animation: scanMove 2.5s linear infinite;
      box-shadow: 0 0 4px #409EFF;
    }

    @keyframes scanMove {
      0% { top: 0; opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { top: 100%; opacity: 0; }
    }

    .corner {
      position: absolute;
      width: 20px;
      height: 20px;
      border-color: #409EFF;
      border-style: solid;
    }
    .top-left { top: 0; left: 0; border-width: 3px 0 0 3px; }
    .top-right { top: 0; right: 0; border-width: 3px 3px 0 0; }
    .bottom-left { bottom: 0; left: 0; border-width: 0 0 3px 3px; }
    .bottom-right { bottom: 0; right: 0; border-width: 0 3px 3px 0; }
  }

  .scan-controls {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    z-index: 3;
    pointer-events: none;

    .control-btn {
      pointer-events: auto;
      position: absolute;
      color: #fff;
      padding: 10px;
      background: rgba(0,0,0,0.3);
      border-radius: 50%;
      cursor: pointer;
      backdrop-filter: blur(2px);
    }
    .back-btn {
      top: 20px;
      left: 16px;
      width: 40px;
      height: 40px;
      display: flex;
      justify-content: center;
      align-items: center;
      -webkit-tap-highlight-color: transparent;
    }

    .control-bar {
      width: 100%;
      // height: 20vh;
      height: 0;
      padding-top: 10px;
      position: absolute;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;

      background: rgba(0, 0, 0, 0.4);
    }

    .album-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      color: #fff;

      .icon-circle {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255, 255, 255, 0.4);
      }

      span {
        font-size: 12px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
    }

  }
}
</style>

