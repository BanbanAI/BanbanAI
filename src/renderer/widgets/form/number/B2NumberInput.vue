<template>
  <b2-form-element>
    <el-input
      v-if="!widget.isReadonly"
      :ref="(el) => widget.inputInstance = el"
      :class="{'mobile': isMobileDevice}"
      v-model="displayValue"
      size="default"
      :placeholder="widget.placeholder"
      @focus="handleFocus"
      @blur="handleBlur"
      @input="handleInput"
      @change="handleChange"
      @keydown.enter="handleEnter"
      >
      <template #suffix>
        <span v-if="widget.numberType === 'percent'">%</span>
        <span v-if="widget.unitPosition === 'suffix' && widget.numberType === 'number'"> {{ widget.unit }}</span>
      </template>
      <template #prefix>
        <span v-if="widget.unitPosition === 'prefix' && widget.numberType === 'number'"> {{ widget.unit }}</span>
      </template>
    </el-input>

    <div
      v-else
      class="value"
      :class="{'mobile': isMobileDevice}"
      :style="{ color: widget.inputValue ? 'unset' : 'var(--text-color-inactive)' }"
      :title="numberTitle"
    >
      <span class="unit-prefix" v-if="readonlyValue && widget.unitPosition === 'prefix' && widget.numberType === 'number'">{{ widget.unit }}</span>
      {{ readonlyValue ? readonlyValue : i18next.t('noContent') }}
      <span class="percent" v-if="readonlyValue && widget.numberType === 'percent'">%</span>
      <span class="unit-suffix" v-if="readonlyValue && widget.unitPosition === 'suffix' && widget.numberType === 'number'">{{ widget.unit }}</span>
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { NumberInput } from "./numberInput";
import { ref, watch, computed } from "vue";
import { injectAutoSubmitEmitter, injectEnterPress } from "../subForm/utils";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();
const widget = useWidget<NumberInput>();

const displayValue = ref('');
const isFocused = ref(false);

const enterPress = injectEnterPress();
const autoSubmitEmitter = injectAutoSubmitEmitter();

// 格式化数字
const formatValueToDisplay = (val: number | null | undefined, applyThousand: boolean): string => {
  if (val === null || val === undefined || val === '' as any) return '';

  let num = Number(val);
  if (!Number.isFinite(num)) return '';

  if (widget.numberType === 'percent') {
    num = num * 100;
  }

  return widget.formatDisplayValue(num, applyThousand);
};

// 转为数字
const parseDisplayToValue = (str: string): number | undefined => {
  if (!str) return undefined;
  let cleanStr = str.replace(/,/g, '');

  let num = Number(cleanStr);
  if (Number.isNaN(num)) {
    return undefined;
  }

  if (widget.numberType === 'percent') {
    return num / 100;
  }

  return num;
};

watch(() => widget.inputValue, (newVal) => {
  if (!isFocused.value) {
    const useSeparator = widget.isThousandSeparator;
    displayValue.value = formatValueToDisplay(newVal, useSeparator);
  }
}, { immediate: true });

const handleFocus = () => {
  isFocused.value = true;
  displayValue.value = formatValueToDisplay(widget.inputValue, false);
};

const handleInput = (val: string) => {
  const filtered = val.replace(/[^\d.\-+]/g, '');

  if (filtered !== val) {
    displayValue.value = filtered;
  }

  const parsed = parseDisplayToValue(displayValue.value);
  if (parsed !== undefined && !Number.isNaN(parsed)) {
     widget.inputValue = parsed;
  }
};

const handleBlur = () => {
  isFocused.value = false;
  processFinalValue();
};

const handleChange = () => {
  if (!isFocused.value) {
    processFinalValue();
  }
};

const processFinalValue = () => {
  const finalNum = parseDisplayToValue(displayValue.value);
  widget.inputValue = finalNum;
  widget.validate();

  // 格式化回显
  const useSeparator = widget.isThousandSeparator;
  displayValue.value = formatValueToDisplay(widget.inputValue, useSeparator);
};

// 只读
const readonlyValue = computed(() => {
  const useSeparator = widget.isThousandSeparator;
  return formatValueToDisplay(widget.inputValue, useSeparator);
});

const numberTitle = computed(() => {
  if(readonlyValue.value && widget.numberType === 'percent') {
    return `${readonlyValue.value}%`
  } else if (readonlyValue.value && (widget.unitPosition === 'prefix' || widget.unitPosition === 'prefix')){
    return `${widget.unit || '' + readonlyValue.value + widget.unit || ''}`
  }
  return readonlyValue.value || ''
})

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
</script>

<style lang="scss" scoped>
.el-input {
  width: 100%;
}

:deep(.el-input__wrapper) {
  border-radius: 4px;
}

:deep(.el-input__inner) {
  text-align: left;
  margin-left: -5px;
}

:deep(.el-input__inner::placeholder) {
  text-align: left;
  margin-left: -5px;
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
  .unit-prefix {
    margin-right: 4px;
    color: var(--text-color-secondary);
  }
  .unit-suffix {
    margin-left: 4px;
    color: var(--text-color-secondary);
  }
  .percent {
    margin-left: 4px;
    color: var(--text-color-secondary);
  }
}

:deep(.el-input.mobile) {
  .el-input__wrapper {
    border-radius: 4px;
    background-color: #fff;
    height: 40px;
    padding: 0 12px;
  }
  .el-input__inner {
    margin-left: 0;
  }
}
.value.mobile {
  height: 40px;
  border-radius: 4px;
  padding: 0 12px !important;
  line-height: 40px;
}

:deep(.el-input__suffix-inner) {
  pointer-events: none;
}
</style>

