<template>
  <b2-form-element>
    <el-input v-if="!widget.isReadonly"
      class="phone-input"
      :class="{'mobile': isMobileDevice}"
      ref="input"
      v-model="widget.inputValue"
      type="text"
      :maxlength="11"
      :clearable="widget.clearable"
      :placeholder="widget.placeholder"
      @input="onInput"
      @keydown.enter.prevent="handleEnter">
      <template #suffix v-if="!widget.isInSubForm && !isMobileDevice">
        <el-icon size="16"><Iphone /></el-icon>
      </template>
      <template #prefix v-else>
        <el-icon size="16"><Iphone /></el-icon>
      </template>
    </el-input>
    <div
      class="value"
      :class="{'mobile': isMobileDevice}"
      v-else
      :style="{ color: widget.inputValue ? 'unset' : 'var(--text-color-inactive)' }"
      :title="widget.inputValue || i18next.t('noContent')"
    >
      {{ widget.inputValue || i18next.t('noContent') }}
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { PhoneInput } from "./phoneInput";
import { ref, onMounted, onBeforeUnmount } from "vue";
import { Iphone } from '@element-plus/icons-vue';
import { injectAutoSubmitEmitter, injectEnterPress } from "../subForm/utils";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const widget = useWidget<PhoneInput>();
const input = ref();

const enterPress = injectEnterPress();
const autoSubmitEmitter = injectAutoSubmitEmitter();

const onInput = (val: string) => {
  const filtered = val.replace(/\D/g, '').slice(0, 11);
  if (filtered !== widget.inputValue) {
    widget.inputValue = filtered;
  }
};

const handleEnter = (e: Event) => {
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
  widget.inputInstance = input.value;
});

onBeforeUnmount(() => {
  widget.inputInstance = null;
});
</script>

<style lang="scss" scoped>
.el-input {
  --el-input-border-radius: 4px;
  height: 32px;

  :deep(.el-input__suffix-inner) {
    pointer-events: none;
  }
}
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
}

:deep(.phone-input.mobile) {
  height: 40px;
  .el-input__wrapper {
    border-radius: 4px;
    background-color: #fff;
    height: 40px;
    padding: 0 12px;
  }
}
.value.mobile {
  height: 40px;
  border-radius: 4px;
  padding: 0 12px !important;
  line-height: 40px;
}
</style>

