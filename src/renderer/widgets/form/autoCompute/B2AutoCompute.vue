<template>
  <b2-form-element>
    <!-- 数字 -->
    <template v-if="widget.resultFormat === 'number'">
      <el-input
        v-if="!widget.isReadonly"
        :ref="(el) => widget.inputInstance = el"
        :class="{'mobile': isMobileDevice}"
        v-model="displayValue"
        size="default"
        :placeholder="widget.placeholder"
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
    </template>
    <!-- 文本 -->
    <template v-else>
      <el-input
        v-if="!widget.isReadonly"
        :class="{'mobile': isMobileDevice}"
        v-model="textValue"
        size="default"
        :placeholder="widget.placeholder"
      >
      </el-input>

      <div
        v-else
        class="value"
        :class="{'mobile': isMobileDevice}"
        :style="{ color: readonlyValue ? 'unset' : 'var(--text-color-inactive)' }"
        :title="numberTitle"
      >
        {{ readonlyValue ? readonlyValue : i18next.t('noContent') }}
      </div>
    </template>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { AutoCompute } from "./autoCompute";
import { ref, watch, computed } from "vue";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();
const widget = useWidget<AutoCompute>();

const displayValue = ref('');

const textValue = ref(widget.inputValue as string);

// 格式化数字
const formatValueToDisplay = (val: number, applyThousand: boolean): string => {
  if (val === null || val === undefined || val === '' as any) return '';

  let num = Number(val);
  if (!Number.isFinite(num)) return '';

  if (widget.numberType === 'percent') {
    num = num * 100;
  }

  if (applyThousand) {
    return widget.getNumberWithCommas(num);
  }

  if (widget.isDecimalPadding) {
    const decimals = widget.decimal ?? 0;
    return num.toFixed(decimals);
  } else {
    return parseFloat(num.toFixed(widget.decimal ?? 0)).toString();
  }
};

// 只读
const readonlyValue = computed(() => {
  if (widget.resultFormat === 'number') {
    const useSeparator = widget.isThousandSeparator;
    const result = formatValueToDisplay(widget.inputValue as number, useSeparator);
    return result ?? "";
  } else {
    return widget.inputValue as string ?? "";
  }
});

const numberTitle = computed(() => {
  if(readonlyValue.value && widget.numberType === 'percent') {
    return `${readonlyValue.value}%`
  } else if (readonlyValue.value && (widget.unitPosition === 'prefix' || widget.unitPosition === 'prefix')){
    return `${(widget.unit || '') + readonlyValue.value + (widget.unit || '')}`
  }
  return readonlyValue.value || ''
})

watch(() => widget.inputValue, (newVal) => {
  if (widget.resultFormat === 'number') {
    const useSeparator = widget.isThousandSeparator;
    displayValue.value = formatValueToDisplay(newVal as number, useSeparator);
  }
  if (widget.resultFormat === 'text') {
    textValue.value = newVal as string;
  }
}, { immediate: true });
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
