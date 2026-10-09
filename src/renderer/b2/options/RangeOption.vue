<template>
  <div class="range-option">
    <div class="range-input" v-if="showInput">
      <el-input type="number" key="start" :modelValue="start" @update:model-value="handleChangeStart" @wheel.stop />
    </div>
    <div class="range-input" v-else-if="showLimit">
      {{ start }}
    </div>
    <div class="slider-track" ref="trackRef" @click.self.stop="insertValue" v-if="!hideSlider">
      <div class="slider-handle" v-for="(value, index) in values" :key="index"
        :style="{ left: valuePercent(value) + '%' }" v-click-outside="onClickOutside">
        <el-popover :visible="selectedIndex === index" trigger="click" placement="top" popper-class="range-popover-container" ref="popoverRef">
          <template #reference>
            <div class="item-label" :class="selectedIndex === index ? 'selected' : ''" :title="value" @mousedown.capture.stop="handleLabelDown($event, index)"></div>
          </template>
          <el-input type="number" class="range-value-input" v-model="values[index]" :step="option.args.step || 1"
            @change="handleValueChange($event, index)"  @wheel.stop @input="updatePopover" />
        </el-popover>
        <el-icon :size="10" class="close" @click.capture.stop="deleteValue(index)" v-show="selectedIndex === index">
          <i-ep-close></i-ep-close>
        </el-icon>
      </div>
    </div>
    <div v-else>
      -
    </div>
    <div class="range-input" v-if="showInput">
      <el-input type="number" key="end" :modelValue="end" @update:model-value="handleChangeEnd"  @wheel.stop />
    </div>
    <div class="range-input" v-else-if="showLimit">
      {{ end }}
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ref, watch, inject, computed } from 'vue';
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { DefinedOptionWithParsedType } from '../types';
import { fixFloat } from '@common/utils/math'
import { ClickOutside as vClickOutside } from 'element-plus';
import { NOT_USING_INPUT } from '@renderer/types';

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const notUsingInput = inject(NOT_USING_INPUT);

const trackRef = ref();
const optionValue = ref([]);
const values = ref([]);
const start = ref(0);
const end = ref(100);
const popoverRef = ref<any[]>();

const showLimit = computed(() => !!props.option.args?.showLimit);
const hideSlider = computed(() => !!props.option.args?.hideSlider);
const showSlider = computed(() => !!props.option.args?.showSlider);
const showInput = computed(() => !!props.option.args?.showInput && !showLimit.value);

const valuesSort = () => {
  values.value = values.value.sort((a, b) => a - b);
}

const insertValue = (ev: MouseEvent) => {
  const percent = ev.offsetX / trackRef.value.offsetWidth;
  const value = +(start.value + (end.value - start.value) * percent).toFixed(2);
  values.value.push(value);
  valuesSort();
  selectedIndex.value = values.value.findIndex(val => val === value);
  updateOption([start.value, ...values.value, end.value]);
}

const updatePopover = () => {
  if (selectedIndex.value === -1) return;
  const instance = popoverRef.value[selectedIndex.value];
  if (!instance) return;
  instance?.popperRef?.popperInstanceRef?.update()
}

const deleteValue = (index: number) => {
  values.value.splice(index, 1);
}
const onClickOutside = () => {
  if (!notUsingInput.value) return;
  selectedIndex.value = -1;
}

const handleValueChange = (_value: string, index: number) => {
  const value = Number(_value);
  changeValue(value, index);
}

const changeValue = (value: number, index: number, doSave = true) => {
  if (value < start.value) {
    value = start.value;
  } else if (value > end.value) {
    value = end.value;
  }
  values.value[index] = value;
  if (doSave) {
    updateOption([start.value, ...values.value, end.value]);
  }
}

let startX: number;
let downingIndex: number;
let draggingValue: number;
const selectedIndex = ref<number>(-1);

const handleLabelDown = (ev: MouseEvent, index: number) => {
  ev.stopPropagation();
  ev.preventDefault();
  startX = ev.clientX;
  downingIndex = index;
  document.addEventListener('mousemove', handleLabelMove, false);
  document.addEventListener('mouseup', handleLabelUp, false);
  selectedIndex.value = -1;
  draggingValue = null;
}

const handleLabelMove = (ev: MouseEvent) => {
  ev.stopPropagation();
  ev.preventDefault();
  const disX = ev.clientX - startX;
  const percent = disX / trackRef.value.offsetWidth;
  const value = ((end.value - start.value) * percent).toFixed(2);
  draggingValue = fixFloat(Number(values.value[downingIndex]) + Number(value));
  startX = ev.clientX;
  changeValue(draggingValue, downingIndex, false);
}

const handleLabelUp = (ev: MouseEvent) => {
  ev.stopPropagation();
  ev.preventDefault();
  document.removeEventListener('mousemove', handleLabelMove, false);
  document.removeEventListener('mouseup', handleLabelUp, false);
  valuesSort();
  const index = values.value.findIndex(value => value === draggingValue);
  selectedIndex.value = index === -1 ? downingIndex : index;
  updateOption([start.value, ...values.value, end.value]);
}

const handleChangeStart = (_value: string) => {
  const value = Number(_value);
  // 判断value中是否有不在这个区间的
  const inRangeValues = values.value.filter((item) => item > value);
  start.value = value;
  values.value = inRangeValues;
  updateOption([start.value, ...values.value, end.value]);
}

const handleChangeEnd = (_value: string) => {
  const value = Number(_value);
  const inRangeValues = values.value.filter((item) => item < value);
  end.value = value;
  values.value = inRangeValues;
  updateOption([start.value, ...values.value, end.value]);
}

const valuePercent = (value: number) => {
  if (value < start.value) return 0;
  else if (value > end.value) return 93;
  return (value - start.value) / (end.value - start.value) * 93;
};

// 初始化
const init = () => {
  const optionDefaultValue = getOptionValue();
  if (Array.isArray(optionDefaultValue)) {
    optionValue.value = optionDefaultValue?.sort?.((a: number, b: number) => a - b);
  } else {
    optionValue.value = [0, 100];
  }
  values.value = optionValue.value.slice(1, -1);
  start.value = optionValue.value[0];
  end.value = optionValue.value.at(-1);
}

init();
watch(() => getOptionValue(), (value) => {
  optionValue.value = value?.sort?.((a: number, b: number) => a - b) || [0, 100];
  values.value = optionValue.value.slice(1, -1);
  start.value = optionValue.value[0];
  end.value = optionValue.value.at(-1);
});
</script>

<style lang="scss" scoped>
.range-option {
  position: relative;
  width: 100%;
  height: 24px;
  user-select: none;

  display: flex;
  align-items: center;

  .slider-track {
    position: relative;
    background: #414243;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    cursor: var(--cursor-pointer);

    .slider-handle {
      position: absolute;
      cursor: var(--cursor-pointer);
      bottom: -4px;

      .item-label {
        width: 14px;
        height: 14px;
        background-color: #f0f0f0;
        border: 2px solid #252628;
        border-radius: 100%;
        cursor: var(--cursor-pointer);
        &:hover, &.selected {
          background-color: #0089ff;
          border-color: #f0f0f0;
        }
      }

      .close {
        position: absolute;
        bottom: -100%;
        left: 50%;
        transform: translateX(-50%);
        border-radius: 50%;
        box-sizing: unset;
        padding: 1px;
        background-color: #2e2f33;

        &:hover {
          background-color: #000;
        }
      }
    }
  }

  .range-input {
    display: flex;
    align-items: center;

    &:first-child{
      margin-right: 5px;
    }

    &:last-child{
      margin-left: 5px;
    }

    .el-input {
      width: 35px;
      :deep(.el-input__wrapper){
        padding: 1px 5px;
      }
    }

    span {
      margin: 0 2px;
    }
  }

}

:deep(.el-input__inner::-webkit-inner-spin-button) {
  all: unset;
}
</style>
<style lang="scss">
.el-popover.range-popover-container{
  width: unset !important;
  min-width: unset !important;
  padding: 4px !important;
  border-color: transparent !important;
  .range-value-input{
    width: 60px;
    background-color: #1f1f22;
    border-radius: 6px;
    .el-input__wrapper{
      background-color: #1f1f22;
      box-shadow: none !important;
      border-radius: 6px;
      input{
        border-radius: 6px;
      }
    }
  }

  .el-popper__arrow::before{
    background-color: #2e2f33;
    border-color: transparent !important;
  }
}
</style>
