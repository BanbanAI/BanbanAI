<template>
  <div class="colored-array-option" style="width: 100%;">
    <div class="color-switch">
      <span>{{ $t("ColoredArrayOption.colored") }}</span><switch-button v-model="isColored" />
    </div>
    <component v-model="checkedValue" :is="groupComponent" text-color="#ccc">
      <template #default>
        <draggable :model-value="optionsValue" :item-key="draggableKey" :disabled="!isDraggable"
          @start="handleDragStart" @end="handleDragEnd" handle=".move" chosen-class="dragging"
          :component-data="{ class: 'tabs-content' }" animation="500" delay="60">
          <template #item="{ element, index }">
            <component :value="element.value" :is="itemComponent" :data-id="element.id" :key="element.id" @click.prevent="clickRadioItem(element.value)">
              <template #default>
                <div :key="element.id" ref="dragRef" class="tabs-content-item" @click.stop.prevent>
                  <div class="option-input">
                    <div :style="{opacity: isRepeat(element.value,'option') && focusedIndex === `${index}` ? 1 : 0}" class="tips">{{ $t("ColoredArrayOption.noRepeat") }}</div>
                    <el-input 
                      v-model="element.value" 
                      :placeholder="placeholder" 
                      :name="option.name"
                      @keyup.enter.native="inputEnterBlur" 
                      :class="{ warn: isRepeat(element.value,'option')}" 
                      :ref="(el) => inputArrRef[element.id] = el"
                      type="text" 
                      size="small"
                      style="margin-bottom: 5px;" 
                      @focus="focusedIndex = `${index}`" 
                      @blur="handleBlur(element.id)"
                      @change="(val) => updateOptionValueByIndex(val, index)"
                    >
                    </el-input>
                  </div>
                  <div class="picker" @click.stop.prevent="handlePickerVisible(true, element.id)" v-if="isColored">
                    <div class="color-box" :style="boxStyle(element.id)"></div>
                    <el-icon :size="15">
                      <i-ep-caret-bottom />
                    </el-icon>
                  </div>
                  <el-icon class="operate-icon move" :style="{color: isDragging ? '#ccc !important' : 'unset'}" :size="18" v-if="isDraggable"><i-icon-park-outline-drag /></el-icon>
                  <el-icon class="operate-icon delete" :size="16" @click.stop.prevent="removeOption(index)"><i-ep-delete /></el-icon>
                </div>
              </template>
            </component>
          </template>
        </draggable>
        <component :value="otherOptionId" :is="itemComponent" v-if="otherOptionVisible">
          <template #default>
            <div class="colored-array-option-other">
              <div :style="{opacity: isRepeat(otherOptionsName,'other') && focusedIndex === 'other' ? 1 : 0}" class="tips">{{ $t("ColoredArrayOption.noRepeat") }}</div>
              <el-input 
                v-model="otherOptionsName" 
                :placeholder="placeholder"
                :name="otherOptionsName"
                type="text"
                size="small"
                style="margin-bottom: 5px;"
                @focus="focusedIndex = 'other'"
                @blur="focusedIndex = null"
                @change="applyOptionChanges()"
                :class="{ warn: isRepeat(otherOptionsName,'other')}"
              >

              </el-input>
              <el-icon class="operate-icon delete" :size="16" @click="removeOtherOption"><i-ep-delete /></el-icon>
            </div>
          </template>
        </component>
      </template>
    </component>
    <div class="btns">
      <el-button type="primary" size="small" link @click="addOption(false)">{{ $t("ColoredArrayOption.addOption") }}</el-button>
      <el-button type="primary" size="small" link @click="addOption(true)" :disabled="otherOptionVisible">{{ $t("ColoredArrayOption.addOtherOption") }}</el-button>
      <el-button type="primary" size="small" link @click="openBatchEditOptionsDialog">{{ $t("ColoredArrayOption.BatchEditOptions") }}</el-button>
      <el-dialog v-model="batchEditOptions" :title="$t('ColoredArrayOption.BatchEditOptions')" width="700px" append-to-body class="batch-edit-options-dialog">
        <div>{{ $t("ColoredArrayOption.dialogText") }}</div>
        <el-input class="options-container" v-model="textareaValue" type="textarea" style="resize: none;">
        </el-input>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="batchEditOptions = false">{{ $t("ColoredArrayOption.cancel") }}</el-button>
            <el-button type="primary" @click="handleBatchEditOptions">{{ $t("ColoredArrayOption.confirm") }}</el-button>
          </span>
        </template>
      </el-dialog>
    </div>
  </div>
  <teleport to="body">
    <color-picker-dialog :colorValue="colorsValue.get(activeColor)" :pickerVisible="colorPickerVisible"
      @close="handlePickerVisible" @picked="handleOptionSave" @changed="handleOptionChange" :gradient="isGradient"
      v-if="colorPickerVisible">
    </color-picker-dialog>
  </teleport>
</template>
<script lang="ts">
export default {
  isBigContent: (args: any) => true,
};
</script>
<script lang="ts" setup>
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { INPUT_ENTER_BLUR } from '@renderer/types';
import { computed, inject, nextTick, ref, watch } from 'vue';
import { unique } from '@common/utils/unique';
import { DefinedOptionWithParsedType, ColoredArrayOptionValue } from '../types';
import { ColorValue, Color } from '@renderer/b2/color';
import { deepClone } from '@common/utils/object';
import draggable from "vuedraggable";
import i18next from "i18next";

const props = defineProps<{ option: DefinedOptionWithParsedType }>();

const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const inputEnterBlur = inject(INPUT_ENTER_BLUR);

const isColored = ref(false);
const activeColor = ref('');
const colorPickerVisible = ref(false);
const otherOptionsName = ref(i18next.t("ColoredArrayOption.other"));
const otherOptionVisible = ref(false);
const shouldSyncOptions = ref(false);
const isDragging = ref(false);
const focusedIndex = ref();
const inputArrRef = ref([]);

const isMultiple = computed(() => props.option.args?.hasOwnProperty("multiple"));
const groupComponent = computed(() => {
  return isMultiple.value ? "el-checkbox-group" : "el-radio-group";
});

const itemComponent = computed(() => {
  return isMultiple.value ? "el-checkbox" : "el-radio";
});

const isDraggable = computed(() => props.option.args?.hasOwnProperty("draggable"));
const isGradient = computed(() => props.option.args.gradient === "true");
const placeholder = props.option?.placeholder ?? '';
const defaultString = props.option.args?.defaultString ?? '';
const draggableKey = computed(() => props.option.args?.draggableKey ?? 'id');
const otherOptionId = computed(() => getOptionValue()?.otherOptions?.id ?? unique());

const optionsValue = computed<ColoredArrayOptionValue["options"]>(() => getOptionValue()?.options || []);
const localOptions = ref(
  deepClone(optionsValue.value).map((item, index) => ({
    ...item,
    id: item.id ?? `option-${index}` // 自动补上 id（如果没有）
  }))
);
const checkedValue = ref<string | string[]>();
const batchEditOptions = ref(false);
const textareaValue = ref<string>();
const isRepeat = (val: string, type: 'option' | 'other') => {
  if (type === 'option') {
    const count = optionsValue.value.filter(opt => opt.value === val).length;
    return count > 1 || (val == otherOptionsName.value && otherOptionVisible.value);
  } else {
    const count = optionsValue.value.filter(opt => opt.value === otherOptionsName.value).length;
    return count > 0;
  }
  
};

// 颜色管理
const colorsValue = ref(new Map<string, string | ColorValue>());
const colors = [
  "rgba(16, 204, 85, 1)", "rgba(18, 184, 178, 1)", "rgba(31, 128, 255, 1)", "rgba(127, 102, 255, 1)", "rgba(202, 94, 235, 1)",
  "rgba(242, 97, 189, 1)", "rgba(255, 92, 97, 1)", "rgba(255, 158, 31, 1)", "rgba(178, 209, 25, 1)", "rgba(89, 214, 51, 1)",
];

const generateColorByIndex = (index: number): string => {
  return colors[index % colors.length];
};

const buildColorMap = (options: ColoredArrayOptionValue["options"]) => {
  const map = new Map<string, string | ColorValue>();
  options.forEach((opt, index) => {
    map.set(opt.id, colorsValue.value.get(opt.id) ?? generateColorByIndex(index));
  });
  return map;
};

const syncColorsValue = () => {
  colorsValue.value = buildColorMap(localOptions.value);
};

const ensureOptionIds = () => {
  const hasMissingId = optionsValue.value.some((item, index) => item.id !== localOptions.value[index]?.id);
  if (!hasMissingId) return;
  syncColorsValue();
  updateOption?.({
    ...getOptionValue(),
    options: localOptions.value.map(opt => ({
      ...opt,
      color: colorsValue.value.get(opt.id) ?? opt.color,
    })),
  } as ColoredArrayOptionValue, null);
};

// 拖拽
const handleDragStart = () => (isDragging.value = true);
const handleDragEnd = ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
  if (oldIndex === newIndex) return;
  const moved = localOptions.value.splice(oldIndex, 1)[0];
  localOptions.value.splice(newIndex, 0, moved);
  applyOptionChanges();
  isDragging.value = false;
};

// 选项操作
const addOption = (isOther = false) => {
  let id = unique();
  if (isOther) {
    otherOptionVisible.value = true;
  } else {
    localOptions.value.push({
      id,
      value: defaultString ? getOptionByName() : '',
    });
    shouldSyncOptions.value = true;
  }
  applyOptionChanges();
  nextTick(() => {
    inputArrRef.value?.[id]?.focus();
  })
};

const getOptionByName = () => {
  let name = '';
  for (let i = 1;; i++) {
    name = `${defaultString}${i}`
    if (!localOptions.value.find(opt => opt.value === name)) {
      break;
    }
  }
  return name;
}

const removeOption = (index: number) => {
  localOptions.value.splice(index, 1);
  shouldSyncOptions.value = true;
  applyOptionChanges();
};

const removeOtherOption = () => {
  otherOptionVisible.value = false;
  applyOptionChanges();
};

const updateOptionValueByIndex = (val: string, index: number) => {
  localOptions.value[index].label = val;
  localOptions.value[index].value = val;
  applyOptionChanges();
};

const handleBlur = (id) => {
  focusedIndex.value = null;
  if (inputArrRef.value && inputArrRef.value?.[id]?.input.value === '') {
    inputArrRef.value[id].input.value = defaultString ?? i18next.t("ColoredArrayOption.default");
    localOptions.value.find(opt => opt.id === id).value = defaultString ?? i18next.t("ColoredArrayOption.default");
  }
  applyOptionChanges();
};


const handleBatchEditOptions = () => {
  const lines = [...new Set(textareaValue.value.split('\n').map(line => line.trim()).filter(line => line.length > 0))];
  localOptions.value = lines.map((line, index) => ({
    id: localOptions.value[index]?.id ?? unique(),
    label: line,
    value: line,
  }));
  shouldSyncOptions.value = true;
  applyOptionChanges();
  batchEditOptions.value = false;
}


const openBatchEditOptionsDialog = () => {
  textareaValue.value = [...new Set(localOptions.value)].map(opt => opt.value).join('\n');
  batchEditOptions.value = true;
}

const applyOptionChanges = (transient = false) => {
  const options = localOptions.value.map(opt => ({
    ...opt,
    color: colorsValue.value.get(opt.id),
  }));
  const otherOptions = otherOptionVisible.value
    ? { id: otherOptionId.value, value: otherOptionsName.value }
    : undefined;

  updateOption?.({
    checkedValue: checkedValue.value,
    isColored: isColored.value,
    options,
    otherOptions,
  } as ColoredArrayOptionValue, transient ? "transient" : null);
};

// Color picker 相关
const handlePickerVisible = (visible: boolean, id?: string) => {
  colorPickerVisible.value = visible;
  if (id) activeColor.value = id;
};

const handleOptionSave = (val: string | ColorValue) => {
  colorsValue.value.set(activeColor.value, val);
  applyOptionChanges();
};

const handleOptionChange = (val: string | ColorValue) => {
  colorsValue.value.set(activeColor.value, val);
  applyOptionChanges(true);
};

const boxStyle = computed(() => {
  return (id: string) => ({
    backgroundColor: new Color(colorsValue.value.get(id)).toCssString() || "#FFFFFF",
  });
});

// 初始化逻辑
const initOptions = () => {
  isColored.value = getOptionValue()?.isColored ?? false;
  checkedValue.value = getOptionValue()?.checkedValue ?? undefined;
  otherOptionVisible.value = getOptionValue()?.otherOptions !== undefined;
  otherOptionsName.value = getOptionValue()?.otherOptions?.value ?? i18next.t("ColoredArrayOption.other");
  if (isColored.value) {
    for (const opt of optionsValue.value) {
      colorsValue.value.set(opt.id, opt.color);
    }
  }
  syncColorsValue();
  ensureOptionIds();
};
initOptions();

// watch：当 shouldSyncOptions 触发变化时同步颜色
watch(
  () => shouldSyncOptions.value,
  (newVal, oldVal) => {
    if (!newVal) return;
    syncColorsValue();
    applyOptionChanges();
    shouldSyncOptions.value = false;
  },
  { immediate: true }
);
watch(() => [checkedValue.value, isColored.value], () => applyOptionChanges());

const clickRadioItem = (val: string) => {
  if (!isMultiple.value) {
    val === checkedValue.value ? checkedValue.value = '' : checkedValue.value = val
    return
  };
  const nextCheckedValue = Array.isArray(checkedValue.value) ? [...checkedValue.value] : [];
  const idx = nextCheckedValue.indexOf(val);
  if (idx > -1) {
    nextCheckedValue.splice(idx, 1);
  } else {
    nextCheckedValue.push(val);
  }
  checkedValue.value = nextCheckedValue;
};
</script>


<style scoped lang="scss">
.colored-array-option {
  position: relative;
  padding: 0 5px;

  .color-switch {
    position: absolute;
    right: 5px;
    top: -20px;
    display: flex;
    column-gap: 5px;
    &>span {
      line-height: 20px;
    }
  }

  .btns {
    padding: 2px 0 0 20px;

    .el-button {
      cursor: var(--cursor-pointer);
    }
    .el-button.is-disabled, .el-button.is-disabled:hover{
      cursor: not-allowed;
    }
    .el-button + .el-button {
      margin-left: 5px;
    }
    .el-button--primary.is-link.is-disabled {
      color: var(--el-text-color-disabled);
    }
  }

  :deep(.el-input__wrapper) {
    &:hover .el-input__prefix {
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

  :deep(.el-radio-group) {
    display: block;
    
    .el-radio {
      margin-right: 0;
      width: 100%;
      display: flex;
      column-gap: 8px;

      .el-radio__label {
        padding-left: 0;
        width: calc(100% - 14px - 8px);
      }
    }
  }

  :deep(.el-checkbox-group) {
    display: block;
    
    .el-checkbox {
      margin-right: 0;
      width: 100%;
      display: flex;
      column-gap: 8px;

      .el-checkbox__label {
        padding-left: 0;
        width: calc(100% - 14px - 8px);
      }
    }
  }

  .tabs-content>.dragging.sortable-ghost {
    visibility: hidden;
    opacity: 1;
  }

  .tabs-content> :not(.dragging) {
    :deep(.el-input__wrapper) {
      &:hover .el-input__prefix {
        opacity: v-bind("isDragging ? 0 : 1");
      }
    }
  }

  .tabs-content {
    
    .tabs-content-item {
      display: flex;
      align-items: center;
      column-gap: 4px;

      .option-input {
        position: relative;
        width: 100%;

        :deep(.el-input) {
          margin-bottom: 0 !important;
        }

        .tips {
          position: absolute;
          top: -25px;
          left: 0px;
          padding: 4px;
          width: 60%;
          color: rgba(235, 80, 80);
          font-size: 10px;
          background-color: rgba(253, 238, 238);
          border-radius: 2px;
          transition: all 0.3s ease;
          pointer-events: none;
        }

        .warn {
          :deep(.el-input__wrapper) {
            box-shadow: 0 0 0 1px red inset;
          }
        }
      }

      .picker {
        display: flex;
        padding-left: 5px;
        align-items: center;
        height: 24px;
        width: 40px;
        color: #ccc !important;
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

      .option-btn {
        height: 100%;
        margin: 0;
        cursor: var(--cursor-pointer);
      }

      .move {
        cursor: move;
        &:hover {
          color: #0089ff !important;
        }
      }

      .operate-icon {
        margin-left: 2px;
        color: #ccc !important;
      }

      .delete {
        &:hover {
          color: #FF4D4F !important;
        }
      }
    }
  }

}

</style>

<style lang="scss">
.batch-edit-options-dialog {
    height: 500px;
    border-radius: 8px;
    padding: 0px;

    .el-dialog__header {
      padding: 16px 20px;
      font-size: 18px;
      border-bottom: 1px solid var(--border-color);

      .el-dialog__title {
        color: var(--el-text-color);
      }

      .el-dialog__headerbtn {
        width: 24px;
        height: 24px;
        top: 16px;
        right: 20px;
        cursor: var(--cursor-pointer);

        &:hover .el-icon {
          color: var(--cursor-pointer);
        }
      }
    }

    .el-dialog__body {
      padding: 20px;
      padding-bottom: 0px;

      .options-container {
        margin-top: 4px;
        width: 660px;
        height: 339px;
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        gap: 8px;

        .el-textarea__inner {
          margin-top: 4px;
          padding: 4px 8px;
          height: 100%;
          border-radius: 4px;
          resize: none !important;
        }
      }
    }

    .el-dialog__footer {
      padding: 12px 20px;

      .dialog-footer {
        .el-button {
          border-radius: 4px;
        }
      }
    }
}

</style>

<style scoped lang="scss">
.colored-array-option-other {
  display: flex;
  align-items: center;
  column-gap: 4px;
  position: relative;

  .tips {
    position: absolute;
    top: -25px;
    left: 0px;
    padding: 4px;
    width: 60%;
    color: rgba(235, 80, 80);
    font-size: 10px;
    background-color: rgba(253, 238, 238);
    border-radius: 2px;
    transition: all 0.3s ease; 
    pointer-events: none;
  }

  :deep(.el-input) {
    height: 24px;
    width: 100%;
    margin-bottom: 0 !important;
  }
  .delete {
    cursor: var(--cursor-pointer);
    color: #ccc !important;
    &:hover {
      color: #FF4D4F !important;
    }
  }
}


.warn {
  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px red inset;
  }
}
</style>
