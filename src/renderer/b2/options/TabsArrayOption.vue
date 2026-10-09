<template>
  <div class="tabs-array-option" style="width: 100%">
    <div class="tabs-add-btn">
      <el-button
        type="primary"
        size="small"
        link
        @click="addOption(false)"
        :icon="Plus"
        >{{ $t("TabsArrayOption.addOption") }}</el-button
      >
    </div>
    <component v-model="checkedValue" :is="groupComponent" text-color="#ccc">
      <template #default>
        <draggable
          :model-value="optionsValue"
          :item-key="draggableKey"
          :disabled="!isDraggable"
          @start="handleDragStart"
          @end="handleDragEnd"
          handle=".move"
          chosen-class="dragging"
          :component-data="{ class: 'tabs-content' }"
          animation="500"
          delay="60"
        >
          <template #item="{ element, index }">
            <component
              :value="element.value"
              :is="itemComponent"
              :data-id="element.id"
              :key="element.id"
              @click.prevent="clickRadioItem(element.value)"
            >
              <template #default>
                <div
                  :key="element.id"
                  ref="dragRef"
                  class="tabs-content-item"
                  @click.stop.prevent
                >
                  <div class="option-input">
                    <div :style="{opacity: isRepeat(element.value,'option') && focusedIndex === `${index}` ? 1 : 0}" class="tips">{{ $t("TabsArrayOption.noRepeat") }}</div>
                    <el-input
                      v-model="localOptions[index].value"
                      :placeholder="placeholder"
                      :name="option.name"
                      :class="{ warn: isRepeat(element.value,'option')}" 
                      @keyup.enter.native="inputEnterBlur"
                      :ref="(el) => (inputArrRef[element.id] = el)"
                      type="text"
                      size="small"
                      style="margin-bottom: 5px"
                      @focus="focusedIndex = `${index}`"
                      @blur="handleBlur(element.id, element.value)"
                    >
                    </el-input>
                  </div>
                  <div
                    class="picker"
                    @click.stop.prevent="handlePickerVisible(true, element.id)"
                    v-if="isColored"
                  >
                    <div class="color-box" :style="boxStyle(element.id)"></div>
                    <el-icon :size="15">
                      <i-ep-caret-bottom />
                    </el-icon>
                  </div>
                  <el-icon
                    class="operate-icon move"
                    :style="{ color: isDragging ? '#111 !important' : 'unset' }"
                    :size="16"
                    v-if="isDraggable"
                    ><i-icon-park-outline-drag
                  /></el-icon>
                  <el-icon
                    class="operate-icon copy"
                    :size="16"
                    @click.stop.prevent="copyOption(index)"
                    ><CopyDocument
                  /></el-icon>
                  <el-popconfirm placement="bottom-end" :confirm-button-text="$t('TabsArrayOption.delete')"
                    :cancel-button-text="$t('TabsArrayOption.cancel')" @confirm="removeOption(index)"
                    confirm-button-type="danger" cancel-button-type="default" :hide-icon="true"
                    :title="deleteTip" :width="200"
                  >
                    <template #reference>
                      <el-icon
                        class="operate-icon delete"
                        :size="16"
                        ><i-ep-delete
                      /></el-icon>
                    </template>
                  </el-popconfirm>
                </div>
              </template>
            </component>
          </template>
        </draggable>
      </template>
    </component>
  </div>
  <teleport to="body">
    <color-picker-dialog
      :colorValue="colorsValue.get(activeColor)"
      :pickerVisible="colorPickerVisible"
      @close="handlePickerVisible"
      @picked="handleOptionSave"
      @changed="handleOptionChange"
      :gradient="isGradient"
      v-if="colorPickerVisible"
    >
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
import { INPUT_ENTER_BLUR } from "@renderer/types";
import { computed, inject, nextTick, ref, watch } from "vue";
import { unique } from "@common/utils/unique";
import { DefinedOptionWithParsedType, TabsArrayOptionValue } from "../types";
import { ColorValue, Color } from "@renderer/b2/color";
import { deepClone } from "@common/utils/object";
import draggable from "vuedraggable";
import i18next from "i18next";
import { Plus, CopyDocument } from "@element-plus/icons-vue";

const props = defineProps<{ option: DefinedOptionWithParsedType }>();

const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const inputEnterBlur = inject(INPUT_ENTER_BLUR);

const isColored = ref(false);
const activeColor = ref("");
const colorPickerVisible = ref(false);
const otherOptionsName = ref(i18next.t("ColoredArrayOption.other"));
const otherOptionVisible = ref(false);
const shouldSyncOptions = ref(false);
const isDragging = ref(false);
const focusedIndex = ref();
const inputArrRef = ref([]);

const isMultiple = computed(() => props.option.args?.hasOwnProperty("multiple"));
const deleteTip = computed(() => props.option.args?.deleteTip ?? i18next.t("TabsArrayOption.deleteTip"));
const groupComponent = computed(() => {
  return isMultiple.value ? "el-checkbox-group" : "el-radio-group";
});

const itemComponent = computed(() => {
  return isMultiple.value ? "el-checkbox" : "el-radio";
});

const isDraggable = computed(() => props.option.args?.hasOwnProperty("draggable"));
const isGradient = computed(() => props.option.args.gradient === "true");
const placeholder = props.option?.placeholder ?? "";
const defaultString = props.option.args?.defaultString ?? "";
const draggableKey = computed(() => props.option.args?.draggableKey ?? "id");
const otherOptionId = computed(() => getOptionValue()?.otherOptions?.id ?? unique());

const optionsValue = computed<TabsArrayOptionValue["options"]>(() => getOptionValue()?.options || []);
const localOptions = ref(
  deepClone(optionsValue.value).map((item, index) => ({
    ...item,
    id: item.id ?? `option-${index}`, // 自动补上 id（如果没有）
  }))
);
const checkedValue = ref<string | string[]>();
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
  "rgba(16, 204, 85, 1)",
  "rgba(18, 184, 178, 1)",
  "rgba(31, 128, 255, 1)",
  "rgba(127, 102, 255, 1)",
  "rgba(202, 94, 235, 1)",
  "rgba(242, 97, 189, 1)",
  "rgba(255, 92, 97, 1)",
  "rgba(255, 158, 31, 1)",
  "rgba(178, 209, 25, 1)",
  "rgba(89, 214, 51, 1)",
];

const generateColorByIndex = (index: number): string => {
  return colors[index % colors.length];
};

const buildColorMap = (options: TabsArrayOptionValue["options"]) => {
  const map = new Map<string, string | ColorValue>();
  options.forEach((opt, index) => {
    map.set(
      opt.id,
      colorsValue.value.get(opt.id) ?? generateColorByIndex(index)
    );
  });
  return map;
};

const syncColorsValue = () => {
  colorsValue.value = buildColorMap(localOptions.value);
};

// 拖拽
const handleDragStart = () => (isDragging.value = true);
const handleDragEnd = ({
  oldIndex,
  newIndex,
}: {
  oldIndex: number;
  newIndex: number;
}) => {
  if (oldIndex === newIndex) return;
  const moved = localOptions.value.splice(oldIndex, 1)[0];
  localOptions.value.splice(newIndex, 0, moved);
  applyOptionChanges();
  isDragging.value = false;
};

// 复制
const copyOption = (index: number) => {
  let id = unique();
  localOptions.value.splice(index + 1, 0, {
    id,
    value: defaultString ? `${localOptions.value[index].value}${i18next.t("TabsArrayOption.copySuffix")}` : "",
  });
  shouldSyncOptions.value = true;
  applyOptionChanges();
  nextTick(() => {
    inputArrRef.value?.[id]?.focus();
  });
};

// 选项操作
const addOption = (isOther = false) => {
  let id = unique();
  if (isOther) {
    otherOptionVisible.value = true;
  } else {
    localOptions.value.push({
      id,
      value: defaultString ? getOptionByName() : "",
    });
    shouldSyncOptions.value = true;
  }
  applyOptionChanges();
  nextTick(() => {
    inputArrRef.value?.[id]?.focus();
  });
};

const getOptionByName = () => {
  let name = "";
  for (let i = 1; ; i++) {
    name = `${defaultString}${i}`;
    if (!localOptions.value.find((opt) => opt.value === name)) {
      break;
    }
  }
  return name;
};

const removeOption = (index: number) => {
  if (localOptions.value.length === 1) return
  localOptions.value.splice(index, 1);
  shouldSyncOptions.value = true;
  applyOptionChanges();
};

const updateOptionValueByIndex = (val: string, index: number) => {
  localOptions.value[index].value = val;
  applyOptionChanges();
};

const handleBlur = (id, oldVal) => {
  focusedIndex.value = null;
  if (inputArrRef.value && inputArrRef.value?.[id]?.input.value === "") {
    updateOptionValueByIndex(oldVal, localOptions.value.findIndex((opt) => opt.id === id))
    return
  }
  updateOptionValueByIndex(inputArrRef.value[id].input.value, localOptions.value.findIndex((opt) => opt.id === id))

  // applyOptionChanges();
};

const applyOptionChanges = (transient = false) => {
  const options = localOptions.value.map((opt) => ({
    ...opt,
    label: opt.value,
    color: colorsValue.value.get(opt.id),
  }));
  const otherOptions = otherOptionVisible.value
    ? { id: otherOptionId.value, value: otherOptionsName.value }
    : undefined;

  updateOption?.(
    {
      checkedValue: checkedValue.value,
      isColored: isColored.value,
      options,
      otherOptions,
    } as TabsArrayOptionValue,
    transient ? "transient" : null
  );
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
    backgroundColor:
      new Color(colorsValue.value.get(id)).toCssString() || "#FFFFFF",
  });
});

// 初始化逻辑
const initOptions = () => {
  isColored.value = getOptionValue()?.isColored ?? false;
  checkedValue.value = getOptionValue()?.checkedValue ?? undefined;
  otherOptionVisible.value = getOptionValue()?.otherOptions !== undefined;
  otherOptionsName.value =
    getOptionValue()?.otherOptions?.value ?? i18next.t("ColoredArrayOption.other");
  if (isColored.value) {
    for (const opt of optionsValue.value) {
      colorsValue.value.set(opt.id, opt.color);
    }
  }
  syncColorsValue();
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
watch(
  () => [checkedValue.value, isColored.value],
  () => applyOptionChanges()
);

const clickRadioItem = (val) => {
  val === checkedValue.value
    ? (checkedValue.value = "")
    : (checkedValue.value = val);
};
</script>


<style scoped lang="scss">
.tabs-array-option {
  position: relative;
  padding: 0 5px;
  border: 1px solid #ebebeb;
  border-radius: 4px;
  padding: 8px;

  .tabs-add-btn {
    position: absolute;
    right: 5px;
    top: -20px;
    display: flex;
    column-gap: 10px;
    font-size: 12px;
    line-height: 16px;
  }

  // .btns {
  //   padding: 2px 0 0 20px;

  //   .el-button {
  //     cursor: var(--cursor-pointer);
  //   }
  //   .el-button.is-disabled, .el-button.is-disabled:hover{
  //     cursor: not-allowed;
  //   }
  //   .el-button + .el-button {
  //     margin-left: 5px;
  //   }
  //   .el-button--primary.is-link.is-disabled {
  //     color: var(--el-text-color-disabled);
  //   }
  // }

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
      .el-radio__inner {
        display: none;
      }
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

  .tabs-content > .dragging.sortable-ghost {
    visibility: hidden;
    opacity: 1;
  }

  .tabs-content > :not(.dragging) {
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

      .copy {
        &:hover {
          color: #0089ff !important;
        }
      }

      .operate-icon {
        margin-left: 2px;
        color: #111 !important;
      }

      .delete {
        &:hover {
          color: #ff4d4f !important;
        }
      }
    }
  }

  :deep(.el-dialog) {
    height: 500px;
    border-radius: 8px;
    padding: 0px;

    .el-dialog__header {
      padding: 16px 20px;
      font-size: 18px;
      border-bottom: 1px solid #000;

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
}

.warn {
  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px red inset;
  }
}
</style>
