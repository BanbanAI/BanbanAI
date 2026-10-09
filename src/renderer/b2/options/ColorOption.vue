<template>
  <div class="option-group-control">
    <div class="picker" @click="handlePickerVisible(true)">
      <div class="color-box" :style="boxStyle"></div>
      <el-icon :size="15">
        <i-ep-caret-bottom />
      </el-icon>
    </div>
    <teleport to="body">
      <color-picker-dialog :colorValue="colorValue" :pickerVisible="colorPickerVisible" @close="handlePickerVisible"
        @picked="handleOptionSave" @changed="handleOptionChange" :gradient="isGradient" v-if="colorPickerVisible">
      </color-picker-dialog>
    </teleport>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { deepClone } from "@common/utils/object";
import { Ref, computed, inject, ref, watch } from 'vue';
import { Color, ColorValue } from '../color';
import { DefinedOptionWithParsedType } from '../types';

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);

const isGradient = computed(() => props.option.args.gradient === "true");

const colorPickerVisible = ref(false);
const handlePickerVisible = function(visible) {
  colorPickerVisible.value = visible;
}
const handleOptionSave = function(value: string | ColorValue) {
  updateOption(value);
}
const handleOptionChange = (value: string | ColorValue) => {
  updateOption(value, 'transient');
}

const colorValue: Ref<string|ColorValue> = ref(getOptionValue());
let colorInfo = new Color(colorValue.value);
const boxStyle = ref({
  background: colorInfo.toCssString()
});


watch(() => getOptionValue(), (value: string | ColorValue) => {
  colorInfo = new Color(value);
  colorValue.value = deepClone(value);
  boxStyle.value = { background: colorInfo.toCssString() };
})
</script>

<style lang="scss" scoped>
  .option-group-control {
    user-select: none;
    .picker {
      display: flex;
      padding-left: 5px;
      align-items: center;
      height: 24px;
      width: 40px;

      cursor: var(--cursor-pointer);
      border: 1px var(--el-border-color) solid;
      border-radius: 4px;
      .color-box {
        width: 15px;
        height: 15px;
      }
    }
    .picker:hover {
      border-color: var(--el-border-color-darker);
    }
  }
</style>
