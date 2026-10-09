<template>
  <div class="option-group-control">
    <div class="slider-area" v-if="isSlider">
      <el-slider :modelValue="numberValue" @input="updateValue" @change="handleSliderChange"
        :class="{ 'beyond-warn': (max > baseMax || min < baseMin) && (exceedMinLimit || exceedMaxLimit), 'show-input': showInput }"
        :min="minValue" :max="maxValue" :step="step" size="small" :disabled="isOptionGroupDisable">
      </el-slider>
      <el-input v-if="showInput" type="number" :step="step" v-model="tempNumberValue" @blur="handleBlur" @wheel.stop @input="handleInput" @change="updateValue" @keyup.enter.native="inputEnterBlur">
        <template v-if="option.args?.unit" #suffix>{{ option.args.unit }}</template>
      </el-input>
    </div>
    <el-input v-else v-model="numberValue" :placeholder="props.option.placeholder ?? $t('NumberOption.pleaseInput')" @blur="handleBlur" @wheel.stop @change="updateValue" @input="handleInput" @keyup.enter.native="inputEnterBlur" type="number" step="any" :name="option.name" size="small">
      <template v-if="option.args?.unit" #suffix>{{ option.args.unit }}</template>
    </el-input>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, UPDATE_OPTION, IS_OPTION_GROUP_DISABLE } from "../inject";
import { INPUT_ENTER_BLUR } from '@renderer/types';
import { computed, inject, ref, watch } from 'vue';
import { DefinedOptionWithParsedType } from '../types';

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const inputEnterBlur = inject(INPUT_ENTER_BLUR)
const isOptionGroupDisable = inject(IS_OPTION_GROUP_DISABLE);

const isSlider = computed(() => props.option.args?.min && props.option.args?.max);
const digits = computed(() => props.option.args?.digits ? Number(props.option.args?.digits) : 0); // 小数位数
const step = computed(() => props.option.args.step ? Number(props.option.args.step) : (props.option.generics?.hasOwnProperty("float") ? (digits.value ? 1 / Math.pow(10, digits.value) : 0.1) : 1));
const showInput = computed(() => !!props.option.args?.showInput);
const exceedMaxLimit = computed(() => props.option.args?.exceedMaxLimit);
const exceedMinLimit = computed(() => props.option.args?.exceedMinLimit);
const forbidTransient = computed(() => !!props.option.args?.forbidTransient);

const nullable = computed(()=>!!props.option.args?.nullable);

const baseMax = computed(() => Number(props.option.args.max ?? Infinity));
const baseMin = computed(() => Number(props.option.args.min ?? -Infinity));

const max = ref<number>(getOptionValue())
const min = ref<number>(getOptionValue())
const maxValue = computed(() => {
  if (max.value > baseMax.value && exceedMaxLimit.value) {
    return max.value
  } else {
    return baseMax.value
  }
})
const minValue = computed(() => {
  if (min.value < baseMin.value && exceedMinLimit.value) {
    return min.value
  } else {
    return baseMin.value
  }
})

function isFloat(value) {
  return ~~value !== value;
}
let formatter = parseInt;
if (props.option.generics?.hasOwnProperty("float") || isFloat(step.value)) {
  formatter = (string: string) => {
    if (digits.value) {
      string = Number(string).toFixed(digits.value);
    }
    return parseFloat(string);
  };
}

/**
 * input事件中把 doNotSyncInput 设置为true
 * input事件结束后，等新的值更新到option后， doNotSyncInput 的值还原为false
 */
let doNotSyncInput = false;
const numberValue = ref(0);
const tempNumberValue = ref(0)
watch(()=>getOptionValue(), (value)=>{
  // console.debug("option value changed", doNotSyncInput);
  if (!doNotSyncInput) {
    numberValue.value = value;
    tempNumberValue.value = value;
  } else {
    doNotSyncInput = false;
  }
}, {immediate: true});

function updateValue(value: any) {
  // console.debug("updateValue", value, doNotSyncInput);
  let val = formatter(value || '0') || 0;
  if (nullable.value && value === "") {
    val = null;
  }
  if (val !== null) {
    if (val > baseMax.value) {
      if (exceedMaxLimit.value) {   // 允许超过最大值
        max.value = val
      } else {
        val = baseMax.value
      }
    } else if (val < baseMin.value) {
      if (exceedMinLimit.value) {
        min.value = val
      } else {
        val = baseMin.value;
      }
    } else {
      max.value = baseMax.value
      min.value = baseMin.value
    }
  }
  if (!doNotSyncInput) {
    numberValue.value = val;
    tempNumberValue.value = val;
  }
  // console.debug("check updateOption", val, getOptionValue());
  if (val !== getOptionValue() && !forbidTransient.value) {
    updateOption(val, "transient");
  } else {
    doNotSyncInput = false;
  }
}

const handleInput = (value: string) => {
  doNotSyncInput = true;
  updateValue(value);
}
const handleSliderChange = () => {
  updateOption(Number(numberValue.value));
  (document.activeElement as HTMLElement).blur();
}
const handleBlur = ()=>{
  let value = numberValue.value;
  if (!nullable.value || value !== null) {
    value = Number(value);
  }
  updateOption(value);
}
</script>

<style lang="scss" scoped>
.option-group-control {
  width: 100%;
  .slider-area{
    display: flex;

    :deep(.el-input) {
      width: 64px;
      font-size: inherit;
      .el-input__wrapper {
        padding: 0 4px;
      }
      .el-input__inner {
        height: 100%;
        text-align: center;
      }
    }
  }
  .el-slider {
    flex: 1;
    --el-slider-button-wrapper-size: 14px !important;
    --el-slider-button-wrapper-offset: -5px;

    :deep(.el-slider__button-wrapper) {
      transform: translateX(-40%);
      .el-slider__button {
        width: 14px;
        height: 14px;
      }
    }

    &.beyond-warn{
      --el-slider-main-bg-color: #ff3d00;
    }

    &.show-input{
      margin-right: 12px;
    }
  }
  .el-input{
    :deep(.el-input__inner::-webkit-inner-spin-button) {
      all: unset;
    }
    :deep(.el-input__inner::-webkit-input-placeholder) {
      font-size: 12px !important;
      line-height: 16px !important;
    }
  }
  &.blur{
    .el-slider {
      :deep(.el-slider__button-wrapper) {
        display: none;
      }
    }
  }
}
</style>
