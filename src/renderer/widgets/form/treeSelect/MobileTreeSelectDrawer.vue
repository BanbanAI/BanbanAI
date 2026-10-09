<template>
  <div>
    <teleport to="body">
      <div class="mobile-tree-select-drawer">
        <el-drawer
          v-model="visible"
          direction="btt"
          size="60%"
          :show-close="false"
          :before-close="handleClose"
          close-on-click-modal
        >
          <template #header>
            <span @click="handleClear" style="font-size: 14px; font-weight: 400; color: var(--color-primary);">{{ $t('clear') }}</span>
            <span @click="handleConfirm" v-if="isMultiple" style="font-size: 14px; font-weight: 400; color: var(--color-primary);">{{ $t('confirm') }}</span>
          </template>
          <div class="container">
            <div class="search">
              <el-input :placeholder="i18next.t('search')" v-model="searchValue" clearable>
                <template #prefix>
                  <el-icon :size="16"><i-ep-search /></el-icon>
                </template>
              </el-input>
            </div>
            <div class="single-select-list" v-if="!isMultiple">
              <el-radio-group class="radio-group" :modelValue="radio">
                <el-radio class="radio-item" v-for="item in filteredTreeList" :key="item.value" :value="item.value" @click="handleClickRadio(item.value)">{{ item.value }}</el-radio>
              </el-radio-group>
            </div>
            <div class="multiple-select-list" v-if="isMultiple">
              <el-checkbox class="select-all-checkbox" ref="selectAllRef" v-model="selectAll" @change="handleSelectAllChange" style="width: 100%; border-bottom: 1px solid #E6E6E6;"><span class="text">{{ i18next.t('selectAll') }}</span></el-checkbox>
              <el-checkbox-group class="checkbox-group" :modelValue="displayCheckList" @update:modelValue="handleMultipleChanged">
                <template v-for="item in filteredTreeList" :key="item.value">
                  <el-checkbox
                    v-if="item.value !== otherLabel"
                    class="checkbox-item"
                    :label="item.value">
                    <span class="text">{{ item.value }}</span>
                  </el-checkbox>

                  <!-- 其他选项 -->
                  <el-checkbox
                    v-else
                    class="checkbox-item other-option"
                    :label="otherLabel"
                    :value="item.value"
                    @click.stop.prevent="handleOtherOptionClick"
                  >
                    <div class="other-content">
                      <span class="other-text">{{ item.value }}</span>
                      <div class="other-input-wrap" @click.stop>
                        <el-input
                          ref="otherInputRef"
                          v-show="isShowOther"
                          v-model="otherInputValue"
                          class="other-input"
                          :placeholder="i18next.t('plsInput')"
                          @input="handleOtherInput"
                        />
                      </div>
                    </div>
                  </el-checkbox>
                </template>
              </el-checkbox-group>
              <div v-if="canAddCustomOption" class="custom-option-block">
                <el-button v-if="!isShowAddOptionInput" link type="primary" class="custom-option-trigger" @click="openAddOptionInput">
                  <el-icon style="margin-right: 4px;"><i-ep-plus /></el-icon>
                  {{ i18next.t('addOption') }}
                </el-button>
                <div v-else class="custom-option-editor" @click.stop>
                  <el-input
                    ref="customOptionInputRef"
                    v-model.trim="customOptionName"
                    :placeholder="i18next.t('plsInputOption')"
                    @keydown.enter.stop.prevent="confirmAddOption"
                  />
                  <div class="custom-option-actions">
                    <el-button text @click="cancelAddOption" bg>{{ i18next.t('cancel') }}</el-button>
                    <el-button type="primary" @click="confirmAddOption">{{ i18next.t('confirm') }}</el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-drawer>
      </div>
    </teleport>
  </div>
</template>

<script lang='ts' setup>
import { ref, watch, computed, nextTick } from 'vue';
import IEpSearch from "~icons/ep/search";
import IEpPlus from "~icons/ep/plus";
import { ElInput } from 'element-plus';
import i18next, { $t } from "@renderer/widgets/i18next";

// 单选的"其他"选项是在TreeSelect处理的

const props = defineProps<{
  treeList: any,
  isMultiple: boolean,
  defaultValue?: any,
  otherLabel?: string,
  defaultOtherInputVal?: string,
  canAddCustomOption?: boolean,
}>();
const emit = defineEmits<{
  (event: "selectConfirm", value: any);
  (event: "otherInputChange", value: string);
  (event: "clean");
  (event: "addCustomOption", payload: {
    value: string;
    done: () => void;
    fail: (error?: unknown) => void;
  }): void;
}>();

const visible = ref(false);
const searchValue = ref('');
const radio = ref();
const checkList = ref<string[]>([]);
const selectAll = ref(false);
const selectAllRef = ref();
const otherInputRef = ref();
const otherInputValue = ref<string>("");
const isShowOther = ref<boolean>(false);
const customOptionInputRef = ref<InstanceType<typeof ElInput>>();
const isShowAddOptionInput = ref(false);
const customOptionName = ref("");

const optionValues = computed(() => {
  return props.treeList.map(i => i.value).filter(i => i !== props.otherLabel);
});
const standardValues = computed(() => {
  return checkList.value.filter(v => optionValues.value.includes(v));
});

const displayCheckList = computed(() => {
  const raw = checkList.value || [];
  const result: string[] = [];
  let hasOther = false;

  raw.forEach(v => {
    if (optionValues.value.includes(v)) {
      result.push(v);
    } else {
      if (props.otherLabel) {
        hasOther = true;
      }
    }
  });

  if (hasOther) {
    result.push(props.otherLabel);
  }
  return result;
});

watch(() => props.defaultOtherInputVal, (val) => {
  otherInputValue.value = val || "";
}, { immediate: true });

// 过滤树列表数据
const filteredTreeList = computed(() => {
  if (!searchValue.value) {
    return props.treeList;
  }
  return props.treeList.filter((item: any) => {
    if (props.isMultiple && item.value === props.otherLabel) {
      const otherValue = checkList.value.find(v => !standardValues.value.includes(v));
      if (otherValue) {
        return otherValue.includes(searchValue.value);
      }
    }
    return item.value.includes(searchValue.value);
  });
});

const init = () => {
  if (props.isMultiple) {
    // 多选模式
    checkList.value = Array.isArray(props.defaultValue) ? [...props.defaultValue] : []
    otherInputValue.value = "";
    if (props.otherLabel) {
      otherInputValue.value = props.defaultOtherInputVal || "";
      isShowOther.value = !!props.defaultOtherInputVal;
    }
  } else {
    // 单选模式
    radio.value = props.defaultValue;
  }
  searchValue.value = '';
  cancelAddOption();
}

// 处理全选/取消全选
const handleSelectAllChange = (val: boolean) => {
  if (val) {
    // 全选
    checkList.value = filteredTreeList.value.map((item: any) => item.value);
    otherInputValue.value = otherInputValue.value || props.otherLabel;
    isShowOther.value = true;
  } else {
    // 取消全选
    checkList.value = []
    isShowOther.value = false;
  }
}
// 监听 checkList 变化，更新全选状态
watch(checkList, (newVal) => {
  if (filteredTreeList.value.length > 0 && newVal.length === filteredTreeList.value.length) {
    selectAll.value = true
  } else {
    selectAll.value = false
  }
}, { deep: true })

const handleOtherOptionClick = () => {
  isShowOther.value = !isShowOther.value;
  if (isShowOther.value) {
    otherInputValue.value = otherInputValue.value || props.otherLabel;
    checkList.value = [...standardValues.value, otherInputValue.value];
    requestIdleCallback(() => {
      const inputRef = Array.isArray(otherInputRef.value) ? otherInputRef.value[0] : otherInputRef.value;
      inputRef?.focus?.();
      inputRef?.select?.();
    });
  } else {
    checkList.value = [...standardValues.value];
  }
}

const handleMultipleChanged = (newVal: string[]) => {
  const realValues = newVal.filter(v => optionValues.value.includes(v));
  // 将 otherLabel 转为 实际的输入值
  if (newVal.find(v => !optionValues.value.includes(v))) {
    realValues.push(otherInputValue.value);
  }
  checkList.value = realValues;
}

const handleOtherInput = (value) => {
  if (!props.isMultiple) return;
  if (props.otherLabel && value) {
    checkList.value = [...standardValues.value, value];
    otherInputValue.value = value;
  } else {
    checkList.value = [...standardValues.value];
    otherInputValue.value = "";
  }
}

const handleClose = () => {
  if(!props.isMultiple) {
    emit('selectConfirm', radio.value)
  }
  cancelAddOption();
  visible.value = false
}

const handleClear = () => {
  if (props.isMultiple) {
    checkList.value = []
    selectAll.value = false
    otherInputValue.value = "";
  } else {
    radio.value = ''
  }
  emit('clean')
}
const handleConfirm = () => {
  emit('selectConfirm', checkList.value);
  cancelAddOption();
  visible.value = false;
}

const handleClickRadio = (value: string) => {
  if (radio.value === value) {
    handleClear();
  } else {
    radio.value = value
  }
  if (value === props.otherLabel) {
    emit('otherInputChange', value)
  } else {
    emit('otherInputChange', "")
  }
  handleClose();
}

const openAddOptionInput = () => {
  isShowAddOptionInput.value = true;
  customOptionName.value = "";
  nextTick(() => {
    customOptionInputRef.value?.focus?.();
    customOptionInputRef.value?.select?.();
  });
}

const cancelAddOption = () => {
  isShowAddOptionInput.value = false;
  customOptionName.value = "";
}

const confirmAddOption = async () => {
  const value = customOptionName.value?.trim?.();
  if (!value) return;
  await new Promise<void>((resolve, reject) => {
    emit("addCustomOption", {
      value,
      done: () => {
        if (!checkList.value.includes(value)) {
          checkList.value = [...checkList.value, value];
        }
        cancelAddOption();
        resolve();
      },
      fail: (error) => {
        reject(error);
      },
    });
  });
}

defineExpose({
  show: () => {
    init();
    visible.value = true;
  },
});
</script>

<style lang='scss' scoped>
.mobile-tree-select-drawer {
  width: 100%;
  height: 100%;
  :deep(.el-drawer) {
    background-color: #fff;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;

    .el-drawer__header {
      margin-bottom: 0;
    }
  }

  .container {
    width: 100%;
    height: 100%;
    .search {
      margin-bottom: 8px;

      :deep(.el-input) {
        width: 100%;
        height: 40px;

        .el-input__wrapper {
          border-radius: 8px;
          background-color: var(--bg-color-overlay);
        }
      }
    }
    .single-select-list {
      width: 100%;
      height: calc(100% - 50px);
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;

      .radio-group {
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        flex-wrap: nowrap;

        :deep(.el-radio.radio-item) {
          width: 100%;
          height: auto;
          min-height: 40px;
          padding-top: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-color);
          box-sizing: content-box;

          position: relative;
          left: 16px;

          .el-radio__label {
            height: auto;
            line-height: 1.25em;
            white-space: wrap;
            word-break: break-all;
          }
        }
        .el-radio:last-child {
          left: 1px;
          border-bottom: none;
        }
      }
    }
    .multiple-select-list {
      width: 100%;
      height: calc(100% - 50px);
      overflow: auto;
      display: flex;
      flex-direction: column;

      .text {
        font-size: 14px;
        font-weight: 400;
        color: #000;
      }
      .select-all-checkbox {
        height: auto;
        min-height: 40px;
        padding-top: 8px;
        padding-bottom: 8px;
        box-sizing: content-box;
      }
      .checkbox-group {
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        flex-wrap: nowrap;

        :deep(.el-checkbox.checkbox-item) {
          width: 100%;
          height: auto;
          min-height: 40px;
          padding-top: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-color);
          box-sizing: content-box;

          .el-checkbox__label {
            height: auto;
            line-height: 1.25em;
            white-space: wrap;
            word-break: break-all;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
        }

        .el-checkbox:last-child {
          border-bottom: none;
        }

        .other-option {
          .other-content {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;

            .other-input-wrap {
              flex: 1;
              margin: 0 16px;

              .other-input {
                width: 100%;
                height: 36px;
                font-size: 14px;
                :deep(.el-input__wrapper) {
                  border-radius: 4px;
                  background-color: #fff;
                  border: 1px solid var(--border-color);
                  box-shadow: none;
                }
              }
            }
          }
        }

      }

      .custom-option-block {
        .custom-option-trigger {
          display: inline-flex;
          align-items: center;
          color: var(--color-primary);
        }

        :deep(.custom-option-editor) {
          display: flex;
          flex-direction: column;
          gap: 8px;

          .el-input .el-input__wrapper {
            width: 100%;
            height: 32px;
            background-color: var(--bg-color-overlay);
            border-radius: 4px;
            box-shadow: 0 0 0 0px var(--border-color) inset;
            font-size: 12px;

            &:hover {
              box-shadow: 0 0 0 1px var(--border-color) inset;
            }

            &.is-focused {
              box-shadow: 0 0 0 1px var(--color-primary) inset !important;
            }
          }

          .custom-option-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;

            .el-button {
              margin: 0;
              border-radius: 4px;
            }
          }
        }
      }
    }
  }
}
</style>
