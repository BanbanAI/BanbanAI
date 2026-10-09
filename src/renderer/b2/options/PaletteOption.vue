<template>
  <div class="option-group-control">
    <draggable :model-value="colorArray" :item-key="draggableKey" :component-data="{ class: 'picker-content' }"
      animation="500" chosen-class="dragging" handle=".picker" @end="handleDragEnd">
      <template #item="{ element: colorItem, index }">
        <div class="picker" @click="showColorPicker(index)">
          <div class="color-box" :style="{ background: getCssColor(colorItem) }"></div>
          <div class="delete-color" @click.stop="deleteColor(index)">x</div>
        </div>
      </template>
    </draggable>
    <div class="add-color" @click="addColor">+</div>
    <teleport to="body">
      <color-picker-dialog v-if="colorPickerVisible" :colorValue="colorValue" :pickerVisible="colorPickerVisible"
        @close="colorPickerVisible = false" @changed="(value) => handleOptionSave(value, 'transient')" @picked="handleOptionSave" :gradient="isGradient">
      </color-picker-dialog>
    </teleport>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { deepClone } from "@common/utils/object";
import { inject, ref, computed, watch } from 'vue';
import { Color, ColorValue } from '../color';
import { unique } from '@common/utils/unique';
import { DefinedOptionWithParsedType } from '../types';
import draggable from 'vuedraggable'
const draggableKey = unique();

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);

const isGradient = computed(() => props.option.args?.gradient === "true");

// 此处获取配置颜色并将其转化为颜色值
// 配置颜色数组
const colorArray = ref(getOptionValue())
watch(() => getOptionValue(), (value) => {
  colorArray.value = value;
})
// 当前选中编辑颜色
const colorValue = ref()
// 当前选中编辑下标
const colorIndex = ref()
const getCssColor = (color: string | ColorValue) => {
  return new Color(color).toCssString();
}

const handleDragEnd = ({ oldIndex, newIndex })=>{
  if (oldIndex === newIndex) return;
  const color = colorArray.value.splice(oldIndex, 1)[0];
  colorArray.value.splice(newIndex, 0, color);
  const cloneArray = deepClone(colorArray.value);
  updateOption(cloneArray);
};

// 添加调色板
const addColor = function () {
  colorArray.value.push('#ffffff');
  showColorPicker(-1);
  updateOption(colorArray.value);
}

// 删除调色板
const deleteColor = function (deleteIndex) {
  colorArray.value.splice(deleteIndex, 1)
  updateOption(colorArray.value);
}

const colorPickerVisible = ref(false);
// 颜色选择器显示事件
const showColorPicker = function (index: number) {
  colorValue.value = (colorArray.value || [])[index];
  colorIndex.value = index;
  colorPickerVisible.value = true;
}

// 颜色选择器保存事件
const handleOptionSave = (value: any, type?: "transient") => {
  const cloneArray = deepClone(colorArray.value);
  cloneArray.splice(colorIndex.value, 1, value)
  updateOption(cloneArray, type);
}
</script>

<style lang="scss" scoped>
@mixin flex() {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.option-group-control {
  width: 100%;
  @include flex();
  .picker-content {
    @include flex();

    .picker {
      position: relative;
      margin-right: 2px;

      &.dragging.sortable-ghost {
      visibility: hidden;
      opacity: 0;
    }
      .color-box {
        height: 24px;
        width: 24px;
        cursor: var(--cursor-pointer);
        border: 4px var(--bg-color-overlay) solid;
      }

      .delete-color {
        position: absolute;
        top: 0;
        left: 0;
        height: 10px;
        width: 10px;
        background-color: #333333;
        color: #ffffff;
        font-size: 10px;
        line-height: 8px;
        text-align: center;
        cursor: var(--cursor-pointer);

        &:hover {
          background-color: var(--color-primary);
        }
      }
    }
    
  }

  .add-color {
    height: 24px;
    width: 24px;
    cursor: var(--cursor-pointer);
    border: 1px #666666 dashed;
    color: #ffffff;
    text-align: center;
    line-height: 24px;
    font-size: 18px;

    &:hover {
      border-color: #0089ff;
      color: #0089ff;
    }
  }


}
</style>
