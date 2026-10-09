<template>
  <div class="string-options" style="width: 100%;" v-if="isMultiple">
    <draggable :model-value="textValue"
      :item-key="draggableKey"
      :disabled = "!isDraggable"
      @start="handleDragStart"
      @end="handleDragEnd"
      handle=".el-input__prefix"
      chosen-class="dragging"
      :component-data="{ class: 'tabs-content' }"
      animation="500" delay="60"
    >
      <template #item="{ element, index }">
        <div :key="element" ref="dragRef">
          <el-input :modelValue="element" :placeholder="placeholder" :name="option.name" @keyup.enter.native="inputEnterBlur"
            @update:modelValue="(val) => updateCurrentValue(val, index)" type="text" size="small" style="margin-bottom: 5px;"
            :class="isSelect ? 'select' : ''"
            >
            <template #prefix v-if="isDraggable">
              <i-ven-menu-move class="move-icon" />
            </template>
            <template #append>
              <el-button class="btn-delete" size="small" @click="removeCurrentString(index)">
                <el-icon :size="14"><i-ep-delete /></el-icon>
              </el-button>
            </template>
            <template #suffix v-if="!isEmpty(presets)">
              <el-dropdown size="small" trigger="click">
                <el-icon style="cursor: pointer;"><i-ep-arrow-down /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="preset in presets" :key="preset" @click="updateCurrentValue(preset, index)">{{ preset }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-input>
        </div>
      </template>
    </draggable>
    <el-button style="display: block;width: 100%;line-height: 0;" @click="addStringOption" size="small">+</el-button>
  </div>
  <div class="string-option" v-else>
    <el-input :modelValue="textValue" @keyup.enter.native="inputEnterBlur" @update:modelValue="updateValue"
      class="option-group-control" :class="isSelect ? 'select' : ''" type="text" size="small" :placeholder="placeholder"
      :name="option.name" @focus="isInputting = true" @blur="isInputting = false">
      <template v-if="selectChoices.length > 0" #append>
        <el-select :modelValue="textValue" @update:modelValue="updateValue" style="width: 30px">
          <el-option v-for="choice in selectChoices" :label="choice.label" :value="choice.value" />
        </el-select>
      </template>
    </el-input>
    <div class="select-tag" v-if="isSelect">
      <span>{{ selectedChoice.label }}</span>
      <el-icon @click.stop="updateValue('')">
        <i-ep-close />
      </el-icon>
    </div>
  </div>
</template>

<script lang="ts">
export default {
}
</script>

<script lang="ts" setup>
import { GET_OPTION_VALUE, OPTION_ELEMENT, UPDATE_OPTION } from "../inject";
import { INPUT_ENTER_BLUR } from '@renderer/types';
import { computed, inject, ref, unref } from 'vue';
import { unique } from '@common/utils/unique';
import { DefinedOptionWithParsedType, SelectChoice } from '../types';
import { deepClone, isEmpty } from '@common/utils/object';
import draggable from "vuedraggable";

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const isMultiple = computed(() => props.option.args?.hasOwnProperty("multiple"));
const defaultString = props.option.args?.defaultString ?? '';
const isDraggable = computed(() => props.option.args?.hasOwnProperty("draggable"));
const presets = computed(() => props.option.args?.presets?.split("|") || []);
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const inputEnterBlur = inject(INPUT_ENTER_BLUR)
const placeholder = props.option?.placeholder ?? ''; 

const textValue = computed(() => {
  const optionVal = getOptionValue()
  const isString = typeof optionVal === 'string'
  return isMultiple.value ? (isString ? [optionVal] : optionVal) : optionVal
});
const draggableKey = unique();
const isDragging = ref(false);
const handleDragStart = () => {
  isDragging.value = true;
}
const handleDragEnd = ({ oldIndex, newIndex }) => {
  if (oldIndex === newIndex) return;
  const stringArr = deepClone(textValue.value);
  const movedItem = stringArr.splice(oldIndex, 1)[0];
  stringArr.splice(newIndex, 0, movedItem);
  updateOption(stringArr);
  isDragging.value = false;
};

const updateValue = (value) => {
  updateOption(value);
}

const updateCurrentValue = (string: string ,index: number) => {
  const stringArr = textValue.value
  stringArr[index] = string
  updateOption(stringArr)
}

const addStringOption = () => {
  const stringArr = textValue.value || [];
  const nextValue = defaultString ? `${defaultString}${stringArr.length + 1}`: "";
  stringArr.push(nextValue);
  updateOption(stringArr)
}

const removeCurrentString = (index: number) => {
  const stringArr = textValue.value
  stringArr.splice(index, 1)
  updateOption(stringArr)
}

const element = inject(OPTION_ELEMENT);
const selectChoices = computed(() => {
  const choices = props.option.selectChoices;
  if (typeof choices === 'function') {
    return choices(unref(element)) as SelectChoice[];
  }
  return choices as SelectChoice[] ?? [];
});
const selectedChoice = computed(() => {
  return selectChoices.value.find(item => item.value === textValue.value && item.type !== 'replace')
});
const isInputting = ref(false);
const isSelect = computed(() => {
  return !isMultiple.value && !!selectedChoice.value && !isInputting.value;
});
</script>

<style scoped lang="scss">
.string-options {
  :deep(.el-input__prefix){
    opacity: 0;
    margin-left: -6px;
    margin-right: 2px;
    width: 10px;
    height: 24px;
    cursor: move;
    .move-icon{
      color: #7A7A7A;
      margin-left: 2px;
    }
    &:hover .move-icon{
      color: #8D8D8D;
    }
  }
  :deep(.el-input__wrapper){
    &:hover .el-input__prefix{
      opacity: 1;
    }
  }
  .string-option {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    .string-option-input {
      flex: 1;
      margin-right: 10px; 
    }
  }
  .tabs-content > .dragging.sortable-ghost {
      visibility: hidden;
      opacity: 1;
  }
  .tabs-content > :not(.dragging) {
      :deep(.el-input__wrapper){
        &:hover .el-input__prefix {
          opacity: v-bind("isDragging ? 0 : 1");
        }
      }
    }
  } 

.string-option {
  width: 100%;
  position: relative;

  :deep(.el-input).option-group-control {
    min-height: 24px;
    height: 100%;
    line-height: 24px;

    &.select {
      .el-select__inner {
        visibility: hidden;
      }
      .el-select__wrapper{
        pointer-events: none;
      }
    }

    .el-input--suffix {
      .el-input__inner {
        display: none;
      }
    }

    .el-input-group__append {
      padding: 0 15px;

      .el-select {
        height: 100%;
        cursor: pointer;

        .select-trigger {
          height: 100%;
        }

        .el-select--suffix {
          height: 100%;
        }

        .el-select__wrapper {
          justify-content: center;
          .el-select__selection {
            display: none;
          }
          .el-select__suffix {
            height: 100%;
  
            .el-input__wrapper {
              height: 100%;
            }

          }
        }

      }
    }
  }

  .select-tag {
    height: 70%;
    background-color: #3a3a40;
    padding: 0px 8px;
    display: flex;
    align-items: center;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: 8px;

    span {
      max-width: 80px;
      padding-right: 5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .el-icon {
      border-radius: 50%;
      cursor: var(--cursor-pointer);

      &:hover {
        background-color: #909399;
      }
    }
  }
}
</style>
