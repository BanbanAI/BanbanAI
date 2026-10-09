<template>
  <b2-form-element>
    <div v-if="!widget.isReadonly">
      <!-- 扫码按钮 -->
      <el-button
        v-if="showBigScanButton"
        class="scan-trigger-btn"
        :class="{'mobile': isMobileDevice, 'disabled': isBigScanButtonDisabled}"
        type="primary"
        plain
        @click="startScan"
      >
        <el-icon class="el-icon--left" size="16"><i-ven-icon-widget-form-input-scan-qrcode /></el-icon>
        {{ $t('scanInput') }}
      </el-button>

      <!-- 输入框+扫码按钮 -->
      <div v-else class="input-group">
        <el-input
          :class="{'mobile': isMobileDevice, 'readonly': isScanInputReadonly, 'ellipsis': isShowEllipsis}"
          :ref="(el) => widget.inputInstance = el"
          size="default"
          v-model="widget.inputValue"
          :placeholder="placeholder"
          :clearable="widget.clearable"
          :maxlength="widget.maxLength"
          :show-word-limit="widget.wordLimit"
          :readonly="isScanInputReadonly"
          @focus="handleFocus"
          @blur="handleBlur"
          @keydown.enter.prevent="handleEnter"
          @change="handleChanged"
          >
          <!-- @click="handleBigScanButtonInputStartScan" -->
        </el-input>
        <el-button
          v-if="showSideScanButton && isMobileDevice"
          class="side-scan-btn"
          :class="{'mobile': isMobileDevice}"
          @click="startScan"
        >
          <el-icon size="16"><i-ven-icon-widget-form-input-scan-qrcode /></el-icon>
        </el-button>
      </div>
    </div>

    <div
      class="value"
      :class="{'mobile': isMobileDevice}"
      v-else
      :style="{ color: widget.inputValue ? 'unset' : 'var(--text-color-inactive)' }"
      :title="displayValue || $t('noContent')"
    >
      <span>{{ displayValue || $t('noContent') }}</span>
    </div>

    <qrcode-scanner v-if="widget.isScanInput" :widget="widget" ref="qrcodeScannerRef" @next-scan-code="handleNextScanCodeTrigger"></qrcode-Scanner>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { TextInput } from "./textInput";
import { computed, ref, inject, onMounted, onBeforeUnmount } from "vue";
import { ElMessage, ElLoading } from 'element-plus';
import IVenIconScanQrcode from '~icons/ven-icon/widget-form-input-scan-qrcode';
import QrcodeScanner from "./QrcodeScanner.vue";
import { injectAutoSubmitEmitter, injectEnterPress } from "../subForm/utils";
import i18next, { $t } from "@renderer/widgets/i18next";

const emit = defineEmits<{
  (event: "next-scan-code", value: string): void;
}>();

const isMobileDevice = isMobile();
const widget = useWidget<TextInput>();
const isShowEllipsis = ref(true);

const qrcodeScannerRef = ref(null);

const scannerRegistry = inject<any>('subform-scanner-registry', null);
const enterPress = injectEnterPress();
const autoSubmitEmitter = injectAutoSubmitEmitter();

const showBigScanButton = computed(() => widget.isScanInput && !widget.isScanInputEditable && !widget.inputValue);
// const showSideScanButton = computed(() => widget.isScanInput && widget.isScanInputEditable);
const showSideScanButton = computed(() => widget.isScanInput);
const isScanInputReadonly = computed(() => widget.isScanInput && !widget.isScanInputEditable);

const isBigScanButtonDisabled = computed(() => !isMobileDevice && widget.isScanInput && !widget.isScanInputEditable);

const placeholder = computed(() => {
  if (!isMobileDevice || !widget.isScanInput) return widget.placeholder;
  if (!showBigScanButton && widget.placeholder && widget.placeholder !== i18next.t('plsInput')) return widget.placeholder;
  return i18next.t('scanOrInput');
});

const displayValue = computed(() => {
  const value = widget.inputValue;
  if (!value) return '';

  // 如果没有启用加密功能，直接返回原值
  if (!widget.getOption<boolean>('enable-encrypt')) {
    return value;
  }

  // 获取加密配置
  const frontLength = widget.getOption<number>('front-number') || 0;
  const backLength = widget.getOption<number>('back-number') || 0;
  const encryptChar = widget.getOption<string>('encrypt-char') || '*';

  // 如果前缀和后缀长度之和大于等于文本长度，则不加密，全部显示
  if ((frontLength + backLength) >= value.length) {
    return value;
  }

  // 分别获取前缀、后缀和中间部分
  const prefix = value.substring(0, frontLength);
  const suffix = value.substring(value.length - backLength);
  const mask = encryptChar.repeat(value.length - frontLength - backLength);

  return prefix + mask + suffix;
});

const handleFocus = () => {
  isShowEllipsis.value = false;
};

const handleBlur = () => {
  isShowEllipsis.value = true;
}

const handleChanged = () => {
  widget.validate();
};

const startScan = async () => {
  await qrcodeScannerRef?.value.startScan();
}

const handleBigScanButtonInputStartScan = async () => {
  if (!isMobileDevice && widget.isScanInput && !widget.isScanInputEditable) {
    ElMessage.warning(i18next.t('openOnMobile'));
    return;
  }
  if (!widget.isScanInput || widget.isScanInputEditable) {
    return;
  }
  await startScan();
}

const handleNextScanCodeTrigger = (value: string) => {
  emit('next-scan-code', value);
  if (scannerRegistry && scannerRegistry.onNextScanCode) {
    scannerRegistry.onNextScanCode(widget.uid);
  }
};

const handleEnter = (e: Event) => {
  const keyboardEvent = e as KeyboardEvent;
  if (keyboardEvent.isComposing || keyboardEvent.keyCode === 229) {
    return;
  }
  if (!widget.isInSubForm) {
    autoSubmitEmitter && autoSubmitEmitter({
      type: 'fieldEnter',
      fieldUid: widget.fieldId,
      value: widget.inputValue,
    });
  }
  enterPress && enterPress(widget.uid);
};

onMounted(() => {
  // 如果是在子表单中，注册自己的扫码方法到父组件
  if (widget.isScanInput && widget.isInSubForm && scannerRegistry && scannerRegistry.registerScanner) {
    scannerRegistry.registerScanner(widget.uid, startScan);
  }
});

onBeforeUnmount(() => {
  if (widget.isScanInput && widget.isInSubForm && scannerRegistry && scannerRegistry.unregisterScanner) {
    scannerRegistry.unregisterScanner(widget.uid);
  }
});
</script>

<style lang="scss" scoped>
.el-input {
  --el-input-border-radius: 4px;
}

.input-group {
  display: flex;
  gap: 8px;
  width: 100%;
  align-items: center;

  .el-input {
    flex: 1;
  }

  :deep(.el-button.side-scan-btn) {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

}

.scan-trigger-btn {
  width: 100%;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: normal;
  border-radius: 2px;
  &.disabled, &.disabled:hover {
    cursor: not-allowed;
    color: var(--text-color-placeholder);
    background-color: var(--bg-color-overlay);
    border: 1px solid var(--border-color);
  }
}

.ellipsis {
  :deep(.el-input__inner) {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

.value {
  display: flex;
  min-height: 32px;
  line-height: 24px;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 4px 8px;

  span {
    // overflow: hidden;
    // white-space: nowrap;
    // text-overflow: ellipsis;
    word-break: break-all;
    width: 100%;
  }
}

// 移动端
:deep(.el-input.mobile) {
  .el-input__wrapper {
    border-radius: 4px;
    background-color: #fff;
    min-height: 40px;
    padding: 0 12px;
  }
  &.readonly {
    .el-input__wrapper {
      background-color: var(--bg-color-overlay);
      color: var(--text-color-regular);
      box-shadow: 0 0 0 1px var(--el-input-hover-border-color) inset;
    }
  }
}
.input-group .side-scan-btn.mobile {
  width: 40px;
  height: 40px;
}
.scan-trigger-btn.mobile {
  height: 40px;
  color: var(--text-color-regular);
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background-color: var(--fill-color-blank);
  -webkit-tap-highlight-color: transparent;
  &:hover {
    color: inherit;
  }
  &:active {
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
  }
}
.value.mobile {
  min-height: 40px;
  line-height: 40px;
  padding: 0 12px !important;
}
</style>

