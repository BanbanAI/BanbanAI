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
      <template #prefix>
        <div class="prefix-wrap"
          :title="isNegative && !isFocused ? `-${widget.prefixValue}` : widget.prefixValue"
          :style="{
            maxWidth: widget.isInSubForm ? '60px' : '100px'
          }">
          <span v-if="isNegative && !isFocused">-</span>
          <span v-if="widget.prefix"> {{ widget.prefixValue }}</span>
        </div>
      </template>
      <template #suffix>
        <div class="suffix-wrap"
          :title="widget.suffixValue"
          :style="{
            maxWidth: widget.isInSubForm ? '60px' : '100px'
          }">
          <span v-if="widget.suffix"> {{ widget.suffixValue }}</span>
        </div>
      </template>
    </el-input>

    <div
      v-else
      class="value"
      :class="{'mobile': isMobileDevice}"
      :style="{ color: widget.inputValue ? 'unset' : 'var(--text-color-inactive)' }"
      :title="widget.getDisplayValue()"
    >
      {{ readonlyValue }}
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { AmountInput } from "./amountInput";
import { ref, watch, computed } from "vue";
import { injectAutoSubmitEmitter, injectEnterPress } from "../subForm/utils";
import i18next, { $t } from "@renderer/widgets/i18next";
import { isEmpty } from "@common/utils/object";

const isMobileDevice = isMobile();
const widget = useWidget<AmountInput>();

const displayValue = ref('');
const isFocused = ref(false);
const isNegative = ref(false);

const enterPress = injectEnterPress();
const autoSubmitEmitter = injectAutoSubmitEmitter();
// 格式化数字
const formatValueToDisplay = (val: number | null | undefined, applyThousand: boolean): string => {
  if (val === null || val === undefined || val === '' as any) {
    isNegative.value = false;
    return '';
  }

  isNegative.value = +val < 0;
  const num = Math.abs(Number(val));
  if (!Number.isFinite(num)) return '';

  let formatted = '';
  if (applyThousand) {
    formatted = widget.getNumberWithCommas(num);
  } else if (widget.isDecimalPadding) {
    const decimals = widget.decimal ?? 0;
    formatted = num.toFixed(decimals).replace('.', widget.decimalSeparator);
  } else {
    formatted = parseFloat(num.toFixed(decimals)).toString().replace('.', widget.decimalSeparator);
  }

  return isFocused.value && isNegative.value ? `-${formatted}` : formatted;
};

// 转为数字
const parseDisplayToValue = (str: string): number | undefined => {
  if (!str) return undefined;
  let cleanStr = str.replaceAll(widget.thousandSeparator, '');
  cleanStr = str.replaceAll(widget.decimalSeparator, '.');

  const num = Number(cleanStr);
  if (Number.isNaN(num)) {
    return undefined;
  }
  return num;
};

const handleFocus = () => {
  isFocused.value = true;
  displayValue.value = formatValueToDisplay(widget.inputValue, false);
};

const handleInput = (val: string) => {
  // 保留首位负号并更新显示值
  const escapedSeparator = widget.decimalSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`[^\\d${escapedSeparator}]`, 'g');
  const sign = val.startsWith('-') ? '-' : '';
  const cleanVal = val.replace(regex, '');

  // 保留第一个小数点
  const parts = cleanVal.split(widget.decimalSeparator);
  let finalDisplayStr = sign + parts[0];
  if (parts.length > 1) {
    finalDisplayStr += widget.decimalSeparator + parts.slice(1).join('');
  }

  // 更新显示值(去除符号的)
  if (displayValue.value !== finalDisplayStr) {
    displayValue.value = finalDisplayStr;
  }

  const parsed = parseDisplayToValue(displayValue.value);
  if (parsed !== undefined && !Number.isNaN(parsed)) {
    isNegative.value = parsed < 0;
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
  let finalNum = parseDisplayToValue(displayValue.value);

  widget.inputValue = finalNum;
  widget.validate();

  const useSeparator = widget.isThousandSeparator;
  displayValue.value = formatValueToDisplay(widget.inputValue, useSeparator);
};

// 只读
const readonlyValue = computed(() => {
  const value = widget.getDisplayValue();
  if (widget.isUppercase) {
    return isEmpty(widget.relatedLowerAmount) ? i18next.t('noLowerAmount') : value;
  } else {
    return value || i18next.t('noContent');
  }
});

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

watch(() => widget.inputValue, (newVal) => {
  if (!isFocused.value) {
    const useSeparator = widget.isThousandSeparator;
    displayValue.value = formatValueToDisplay(newVal, useSeparator);
  }
}, { immediate: true });
</script>

<style lang="scss" scoped>
.el-input {
  width: 100%;
}

:deep(.el-input__wrapper) {
  border-radius: 4px;
  .el-input__prefix-inner {
    .prefix-wrap {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    // span {
    //   color: var(--text-color-regular);
    // }
  }
  .el-input__suffix-inner {
    .suffix-wrap {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    // span {
    //   color: var(--text-color-regular);
    // }
  }
}

:deep(.el-input__inner) {
  text-align: left;
  margin-left: -3px;
}

:deep(.el-input__inner::placeholder) {
  text-align: left;
  margin-left: -3px;
}
.value {
  display: flex;
  min-height: 32px;
  align-items: center;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 5px 8px;
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
    padding: 5px 12px;
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

