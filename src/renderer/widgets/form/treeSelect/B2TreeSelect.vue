<template>
  <b2-form-element>
    <div v-if="!widget.isReadonly" class="drop-body" :class="{'is-in-subform': widget.isInSubForm}" :style="treeSelectCssVar">
      <teleport to="body">
        <div class="tree-select-popper" :class="{'is-in-subform': widget.isInSubForm}" :style="treeSelectCssVar" :id="`popper-${widget.uid}`"></div>
      </teleport>

      <el-select-v2
        class="drop-down"
        ref="treeSelectRef"
        :teleported="true"
        :append-to="`#popper-${widget.uid}`"
        :modelValue="inputValue"
        @update:modelValue="handleInputValue"
        :options="widget.treeList"
        filterable
        :placeholder="widget.placeholder"
        :no-data-text="$t('noAvailableData')"
        :no-match-text="$t('noMatchedData')"
        :highlight-current="true"
        :show-checkbox="widget.isMultiple"
        :multiple="widget.isMultiple"
        value-key="value"
        :props="{label: 'value', value: 'value'}"
        @change="onChange"
        v-if="!isMobile()"
        :clearable="true"
        @clear="handleClear"
        @visible-change="handleVisibleChange"
        :remote-show-suffix="true"
        :remote-method="remoteMethod"
        :remote="isRemote"
      >
        <template #default="{item}">
          <!-- 子表单: 单选的其他选项 -->
          <div
            v-if="widget.isInSubForm && !widget.isMultiple && isAllowOther && otherLabel === item.value"
            class="option-not-event other-option-wrapper"
            @click.stop.prevent="(e) => handleOptionClick(item.value, e)"
          >
            <el-tag :class="['option-name', { multiple: widget.isMultiple }]" :color="item.color" :title="getPercentValue(item.value)" v-if="widget.openBgColor">{{ otherLabel }}</el-tag>
            <span class="other-label" v-else>{{ otherLabel }}</span>
            <div class="other-input-container" @click.stop.prevent>
              <el-input
                ref="otherInputRef"
                v-show="isShowOtherInput"
                v-model="widget.otherInputVal"
                @blur="handleBlurInput"
                :placeholder="$t('plsInput')"
              ></el-input>
            </div>
          </div>
          <!-- 多选的 其他 选项 -->
          <div
            v-else-if="widget.isMultiple && isAllowOther && otherLabel === item.value"
            class="tree-label other-option-wrapper"
            :class="{ 'is-selected': isChecked(item.value) }"
            @click.stop.prevent="(e) => handleOptionClick(item.value, e)"
          >
            <el-checkbox :modelValue="isChecked(item.value)"></el-checkbox>
            <el-tag :class="['option-name', { multiple: widget.isMultiple }]" :color="item.color" v-if="widget.openBgColor">{{ item.value }}</el-tag>
            <span :class="['option-name', { multiple: widget.isMultiple }]" v-else>{{ item.value }}</span>

            <div @click.stop.prevent class="other-input-container">
              <el-input
                ref="otherInputRef"
                v-show="isShowOtherInput"
                v-model="widget.otherInputVal"
                :placeholder="$t('plsInput')"
                @blur="handleMultipleOtherInputBlur"
              ></el-input>
            </div>
          </div>
          <!-- 表单: 单选/多选 -->
          <div v-else
            class="tree-label" :class="{ 'other-option-wrapper': isAllowOther && otherLabel === item.value }"
            :style="{
              '--text-bg-color': widget.openBgColor ? item.color : 'transparent',
              '--font-color': widget.openBgColor ? isCustomOption(item.id) ? '#fff' : 'var(--text-color-regular)' : 'var(--text-color-regular)'
            }"
            @click.stop.prevent="(e) => handleOptionClick(item.value, e)"
          >
            <el-checkbox :modelValue="isChecked(item.value)" v-if="widget.isMultiple">
            </el-checkbox>
            <el-tag :class="['option-name', { multiple: widget.isMultiple }]" :color="item.color" :title="getPercentValue(item.value)" v-if="widget.openBgColor">{{ getPercentValue(item.value) }}</el-tag>
            <span :class="['option-name', { multiple: widget.isMultiple }]" :title="getPercentValue(item.value)" v-else>{{ getPercentValue(item.value) }}</span>
          </div>
        </template>
        <template #label="{ value }" v-if="!widget.isMultiple">
          <div
            class="tree-name"
            :title="getPercentValue(otherLabel !== value ? getLabel(value) : (widget.otherInputVal || getLabel(value)))"
            :style="{
              '--text-bg-color': widget.openBgColor ? getOptionColor(value) : 'transparent',
              '--font-color': widget.openBgColor ? isCustomOption(value) && !widget.isInSubForm ? 'var(--text-color-regular)' : '#fff' : 'var(--text-color-regular)'
            }"
          >
            {{ getPercentValue(otherLabel !== value ? getLabel(value) : (widget.otherInputVal || getLabel(value))) }}
          </div>
        </template>

        <template #tag v-if="widget.openBgColor">
          <div class="tags-wrapper">
            <el-tag
              v-for="option in selectedOptions"
              :key="option.value"
              :color="option.color"
              effect="dark"
              :title="getPercentValue(option.value)"
              :disable-transitions="true"
            >
              {{ getPercentValue(option.label || option.value) }}
            </el-tag>
          </div>
        </template>

        <template #tag v-else>
          <div class="tree-name" :title="selectedOptions.map(opt => getPercentValue(opt.label || opt.value)).join(', ')">
            {{ selectedOptions.map(opt => getPercentValue(opt.label || opt.value)).join(', ') }}
          </div>
        </template>
        <template #footer v-if="canAddCustomOption">
          <div class="add-option-footer" @click.stop>
            <el-button class="add-option-trigger" link type="primary" v-if="!isShowAddOptionInput" @click="openAddOptionInput">
              <el-icon><Plus /></el-icon>
              <span>{{ i18next.t('addOption') }}</span>
            </el-button>
            <div v-else class="add-option-editor">
              <el-input
                ref="customOptionInputRef"
                v-model.trim="customOptionName"
                :placeholder="i18next.t('plsInputOption')"
                @keydown.enter.stop.prevent="confirmAddOption"
              />
              <div class="add-option-actions">
                <el-button text @click="cancelAddOption">{{ i18next.t('cancel') }}</el-button>
                <el-button type="primary" @click="confirmAddOption">{{ i18next.t('confirm') }}</el-button>
              </div>
            </div>
          </div>
        </template>
      </el-select-v2>

      <div v-if="isMobileDevice">
        <div class="mobile-select" @click="mobileDeviceClick">
          <span
            class="select-inner"
            :class="{ 'placeholder': !mobileSelectText }"
          >
            {{ mobileSelectText || i18next.t('toChoice') }}
          </span>
          <el-icon class="el-input__icon"><ArrowDown /></el-icon>
        </div>
        <mobile-tree-select-drawer
          ref="selectDrawerRef"
          :defaultValue="widget.inputValue"
          :treeList="widget.treeList"
          :isMultiple="widget.isMultiple"
          :otherLabel="otherLabel"
          :defaultOtherInputVal="widget.otherInputVal"
          :canAddCustomOption="canAddCustomOption"
          @select-confirm="handleConfirm"
          @other-input-change="handleOtherInputChange"
          @add-custom-option="handleMobileAddCustomOption"
          @clean="widget.cleanSelected()">
        </mobile-tree-select-drawer>
      </div>
      <!-- 表单: 单选的其他选项 -->
      <template v-if="isMobileDevice">
        <el-input
          class="other-input mobile"
          ref="otherInputRef"
          v-model="widget.otherInputVal"
          v-show="widget.otherInputVal"
          v-if="!widget.isMultiple && isAllowOther"
          @blur="handleBlurInput"
        />
      </template>
      <template v-else>
        <el-input
          class="other-input"
          ref="otherInputRef"
          v-model="widget.otherInputVal"
          v-show="isShowOtherInput"
          v-if="!widget.isInSubForm && !widget.isMultiple && isAllowOther"
          @blur="handleBlurInput"
        />
      </template>
    </div>
    <div class="value" v-else :class="{'mobile': isMobileDevice}">
      <div :class="['value-wrapper', {flex: widget.openBgColor }]" v-if="arrayValue.length != 0" :title="!widget.openBgColor ? arrayValue.join(', ') : null">
        <template v-if="!widget.openBgColor">{{ arrayValue.join(" , ") }}</template>
        <el-tag v-else v-for="item in arrayValue" effect="dark" :color="getTagBgColor(item)" :title="item">{{ item }}</el-tag>
      </div>
      <div v-else style="color: var(--text-color-inactive);">
        {{ i18next.t('noContent') }}
      </div>
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, nextTick, onMounted, ref, watch } from 'vue';
import { FormConditionValueType } from '@common/types/nocode';
import { useWidget } from '@renderer/b2/types';
import { FormElement } from '@renderer/b2/controllers/form';
import { ElTreeSelect, ElInput, ElMessage, usePopperContainerId } from 'element-plus';
import { TreeSelect, TreeSelectGroupItem } from './treeSelect';
import { TheWidget as TreeMultipleSelect } from '@renderer/widgets/form/treeMultipleSelect';
import { isEmpty } from '@common/utils/object';
import { debounce, set } from "lodash";
import { isMobile } from "@renderer/utils/pure";
import MobileTreeSelectDrawer from './MobileTreeSelectDrawer.vue';
import { ArrowDown, Plus } from '@element-plus/icons-vue'
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const widget = useWidget<TreeSelect | TreeMultipleSelect>();
const treeSelectCssVar = ref<Record<string, any>>({});
const treeSelectRef = ref<InstanceType<typeof ElTreeSelect>>();
const otherInputRef = ref<InstanceType<typeof ElInput>>();
const customOptionInputRef = ref<InstanceType<typeof ElInput>>();
const isShowOtherInput = ref<boolean>(false);
const isShowAddOptionInput = ref(false);
const customOptionName = ref("");

const selectDrawerVisible = ref(false);
const selectDrawerRef = ref();

const onChange = () => {
  widget.validate();
};

const mobileSelectText = computed(() => {
  let value = widget.inputValue;
  if (Array.isArray(value)) {
    value = value.join(', ');
  }
  return value;
});

const otherLabel = computed(() => {
  const value = widget.customOption.otherOptions?.value;
  return typeof value === "string" ? value : "";
})

const isAllowOther = computed(() => {
  return widget.choicesType === "custom" && otherLabel.value.trim().length > 0;
})

const canAddCustomOption = computed(() => {
  return widget.isMultiple && widget.canAddCustomOptionInRuntime;
});

const handleOptionClick = (value: string, e:Event) => {
  if (widget.isMultiple) {
    // 点击多选的"其他"选项
    if (isAllowOther.value && otherLabel.value && value === otherLabel.value) {
      isShowOtherInput.value = !isShowOtherInput.value;
      if (isShowOtherInput.value) {
        widget.otherInputVal = widget.otherInputVal || otherLabel.value;
        nextTick(() => {
          otherInputRef.value?.focus?.();
          otherInputRef.value?.select?.();
        });
      } else {
        widget.otherInputVal = "";
      }
      return;
    }
    // 普通选项
    const options = widget.inputValue as string[];
    if (!options.includes(value)) {
      options.push(value)
      widget.inputValue = options;
    } else {
      handleTagClose(value)
    }
  } else {
    // 单选
    if (otherLabel.value !== value) {
      widget.inputValue = value;
      isShowOtherInput.value = false;
      treeSelectRef.value?.blur();
    } else {
      // 其他选项
      e.stopPropagation();
      isShowOtherInput.value = !isShowOtherInput.value;
      widget.inputValue = otherLabel.value ?? "";
      widget.otherInputVal = otherLabel.value ?? "";
      requestIdleCallback(() => {
        otherInputRef.value?.focus?.();
        otherInputRef.value?.select?.();
      });
      if (!widget.isInSubForm) {
        treeSelectRef.value?.blur();
      }
    }
  }
};

const handleTagClose = (value: string) => {
  if (widget.isMultiple) {
    const newValue = (widget.inputValue as string[]).filter(v => v !== value);
    widget.inputValue = newValue;
  }
};

const handleBlurInput = () => {
  let hasOther = widget.treeList.find(item => item.value == widget.otherInputVal)
  if (hasOther) {
    widget.inputValue = hasOther.value;
  }
}

const handleMultipleOtherInputBlur = () => {
  if (widget.isMultiple) {
    (widget as TreeMultipleSelect).updateOtherInputValue(widget.otherInputVal);
  }
}


const inputValue = computed(() => {
  if (isAllowOther.value) {
    if (widget.isMultiple) {
      // 多选
      const val = (widget.inputValue as string[]) || [];
      const optionValues = widget.primaryTreeList.map(i => i.value);

      return val.map(v => {
        if (optionValues.includes(v)) return v;
        // 只要存在"其他"选项, 就映射为 otherLabel (为了ui的选中效果)
        if (otherLabel.value) return otherLabel.value;
        return v;
      });
    } else {
      // 单选
      const inOption = widget.primaryTreeList.some(item => item.value === widget.inputValue);
      if (inOption) {
        return widget.inputValue;
      } else if (![null, undefined, ""].includes(widget.inputValue as string)) {
        return otherLabel.value;
      }
    }
  }
  return widget.inputValue;
})

const isChecked = (value: string) => {
  if (widget.isMultiple && isAllowOther.value && otherLabel.value === value) {
    // 多选组件是否选中"其他"
    const val = (widget.inputValue as string[]) || [];
    const optionValues = widget.primaryTreeList.map(i => i.value);
    return val.some(v => !optionValues.includes(v) || v === value);
  }
  return Array.isArray(inputValue.value) ? inputValue.value.includes(value) : (inputValue.value === value);
}

watch(
  () => [
    widget.isEditable,
    isAllowOther.value,
    isAllowOther.value && isChecked(otherLabel.value),
  ] as const,
  ([isEditable, allowOther, isOtherChecked]) => {
    if (!isEditable || !allowOther) {
      isShowOtherInput.value = allowOther && isOtherChecked;
    }
  },
  { immediate: true },
)

const handleInputValue = (value: string | string[]) => {
  if (isAllowOther.value) {
    if (widget.isMultiple) {
      const newVal = value as string[];
      const optionValues = widget.primaryTreeList.map(i => i.value);

      const standard = newVal.filter(v => optionValues.includes(v));
      const isOtherSelected = newVal.includes(otherLabel.value);

      const res = [...standard];
      if (isOtherSelected && otherLabel.value) {
        res.push(widget.otherInputVal || otherLabel.value);
      }
      widget.inputValue = res;
      // widget.inputValue = value;
      return;
    }

    const inOption = widget.primaryTreeList.some(item => item.value === value);
    if (!inOption) {
      widget.inputValue = "";
      return;
    }
  }
  widget.inputValue = value;
}

const selectedOptions = computed(() => {
  const values = Array.isArray(widget.inputValue) ? widget.inputValue : [widget.inputValue];
  const options = widget.treeList || [];

  return values.map(value => {
    let item = options.find(opt => opt.value === value);
    if (item) return item;

    // 多选
    if (widget.isMultiple && otherLabel.value) {
      if (value === widget.otherInputVal || value === otherLabel.value || !options.find(o => o.value === value)) {
        const otherOpt = options.find(opt => opt.value === otherLabel.value);
        return {
          value: value,
          label: value,
          color: otherOpt?.color ?? "#ccc",
        }
      }
    }
    return null;
  }).filter(Boolean) as unknown as TreeSelectGroupItem[];
});

const isCustomOption = (value: string) => {
  return value && !widget.customOption?.options?.some(item => item.value === value);
};

const getOptionColor = (value: string) => {
  return widget.customOption?.options?.find(opt => opt.value === value)?.color ?? '#ccc';
};

const getLabel = (value: string) => {
  return value
};

const arrayValue = computed(()=>{
  const value = widget.inputValue;
  if (Array.isArray(value)) {
    return value;
  } else if (value === undefined || value === null || value === "") {
    return [];
  } else {
    return [value];
  }
});
const getTagBgColor = (value: string)=>{
  const radio = widget.treeList.find((item) => item?.value === value);
  if (radio) return (radio as TreeSelectGroupItem)?.color ?? "#ccc";

  if (isAllowOther.value) {
    const otherOpt = widget.treeList.find(item => item.value === otherLabel.value);
    return (otherOpt as TreeSelectGroupItem)?.color ?? "#ccc";
  }

  return "#ccc";
};

// 监听筛选中所选的当前表单的字段值变化
const handleFilterRulesFieldsValue = () => {
  if (isEmpty(widget.optionFilter?.conditions)) return;
  widget.optionFilter.conditions.forEach(condition => {
    if (condition.type === FormConditionValueType.FORM && condition.comparisonUid) {
      // 考虑子表单字段根据主表字段变化使用topForm
      const comparisonForm = computed(() => widget.form.children.find((f: FormElement) => f.fieldId === condition.comparisonUid) ?? widget.topForm.children.find((f: FormElement) => f.fieldId === condition.comparisonUid));

      if (comparisonForm.value) {
        watch(() => (comparisonForm.value as FormElement).inputValue, (value) => {
          // 子表单根据主表单变化时，子表单已有字段下拉值调整
          if (value) {
            debounce(() => {
              widget.initSelectChoices();
            }, 500)();
          }
        })
      }
    }
  })
}
const mobileDeviceClick = () => {
  selectDrawerRef.value?.show();
  widget.initSelectChoices();
}
const isCustom = computed(() => {
  return widget.getOption("select-choices-type") === 'custom';
})
const isRemote = computed(() => {
  return !isCustom.value;
})
const isloading = ref(false);
const getOptions = async (query: string = '') => {
  if (isCustom.value) return;
  if (widget.isHidden) return;
  isloading.value = true;
  await widget.initSelectChoices();
  widget.changeSelectFilter(query);
  isloading.value = false;
}
const remoteMethod = (query: string) => {
  getOptions(query);
}

const handleConfirm = (selectedValues) => {
  if(widget.isMultiple) {
    widget.inputValue = selectedValues.join(',');
  } else {
    widget.inputValue = selectedValues;
  }
}

const handleMobileAddCustomOption = async (payload: { value: string; done: () => void; fail: (error?: unknown) => void; }) => {
  customOptionName.value = payload.value;
  try {
    await confirmAddOption();
    payload.done();
  } catch (error) {
    payload.fail(error);
  }
}

const handleOtherInputChange = (val: string) => {
  widget.otherInputVal = val;
  if (val) {
    requestIdleCallback(() => {
      otherInputRef.value?.focus?.();
      otherInputRef.value?.select?.();
    });
  }
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

const getErrorMessage = (err: any) => {
  return err?.response?.data?.message || (err instanceof Error ? err.message : i18next.t('addOptionFailed'));
}

const confirmAddOption = async () => {
  const value = customOptionName.value?.trim?.();
  if (!value) {
    ElMessage.warning(i18next.t('plsInputOption'));
    return;
  }

  try {
    const existed = (widget.customOption.options || []).some(item => item.value === value);
    if (!existed) {
      await widget.persistCustomOption(value);
    }

    const currentValue = Array.isArray(widget.inputValue) ? [...widget.inputValue] : [];
    if (!currentValue.includes(value)) {
      currentValue.push(value);
      widget.inputValue = currentValue;
    }
    await widget.validate();
    cancelAddOption();
  } catch (err) {
    ElMessage.error(getErrorMessage(err));
  }
}


onMounted(() => {
  if (!widget.isEditable) {
    handleFilterRulesFieldsValue()
  }
})

// 数值转百分比值
const getPercentValue = (value) => {
  const linkageFillField = widget.connectionTableFields.find(item => item.uid === widget.otherTableFieldUID[2]);
  if (value && linkageFillField?.meta?.extra?.isPercent) return `${value * 100}%`;
  return value;
}

const handleClear = () => {
  widget.cleanSelected();
  isShowOtherInput.value = false;
  cancelAddOption();
}

const handleVisibleChange = (visible: boolean) => {
  if (widget.isMultiple) {
    isShowOtherInput.value = isChecked(otherLabel.value);
  }
  if (!visible) {
    cancelAddOption();
  }
}
</script>

<style lang="scss" scoped>

:deep(.drop-body) {
  .el-select__wrapper {
    height: 32px;
    padding: 1px 11px;
    .is-near {
      margin-left: 0;

      .tree-name {
        width: 100%;
        position: absolute;
        padding: 0 4px !important;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tags-wrapper {
        display: flex;
        position: absolute;
        width: 100%;
        overflow: hidden;
        column-gap: 4px;
      }
    }
    &.is-focused {
      .tree-name {
        opacity: 0.5;
      }
    }
  }

  &.is-in-subform {
    .el-select__selection {
      display: flex;
      overflow: visible;
      flex-wrap: nowrap;
      justify-content: flex-start;
      scroll-behavior: auto !important;

      .el-tag {
        font-size: 14px;
        padding: 0 4px 0 8px;

        i {
          margin-left: 4px;
        }
      }
    }
  }
}
.drop-down {
  --el-border-radius-base: 4px;

  :deep(.el-select__selected-item) {
    // width: unset !important;

    .tree-name {
      width: max-content;
      max-width: 100%;
      padding: 0 4px !important;
      border-radius: 4px !important;
      background-color: var(--text-bg-color);
      color: var(--font-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  :deep(.el-select-v2) {
    .el-select__selection {
      .el-tag .el-tag__content {
        color: var(--font-color);
      }
    }
  }
}

.tree-select-popper {
  display: block;

  :deep(.el-popper) {
    .el-select-dropdown__item {
      display: flex;
      align-items: center;
      overflow: hidden;
      padding: 0px;
      text-overflow: unset;

      .tree-label {
        padding: 0 8px;
        border-radius: 4px;
        width: 100%;
        display: flex;
        align-items: center;
        column-gap: 6px;

        .el-checkbox {
          pointer-events: none;
        }
        .option-name {
          max-width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          &.multiple {
            max-width: calc(100% - 50px);
          }
          &.el-tag {
            color: var(--font-color);

            .el-tag__content {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }

        &.other-option-wrapper {
          display: flex;
          align-items: center;
          gap: 6px;

          .option-name {
             flex: 0 0 auto;
             max-width: 100px;
          }


          .el-checkbox .el-checkbox__label {
            display: none;
          }

          .other-input-container {
            flex: 1;
            width: 100%;
            min-width: 80px;
            display: flex;
            align-items: center;


            .el-input__wrapper {
              height: 32px;
              line-height: 32px;
              border-radius: 4px;
              padding: 1px 8px;
              padding-right: 36px;
            }
          }
        }
      }
    }

    .el-select__wrapper {
      gap: 0px !important;
      position: relative;
      background: transparent;
      box-shadow: unset !important;
      background: transparent;
      border-radius: 5px;
      box-sizing: border-box;
      background: var(--top-bg-color);
      padding: 0px;
      height: 32px;

      .el-select__input {
        width: 100% !important;
        padding: 0px;
      }

      .el-select__suffix {
        display: none;
      }
    }

    &.el-select__popper {
      // width: 100%;
      // left: 0 !important;
      background: var(--bg-color-page);
      border: none;

      .el-popper__arrow {
        display: none !important;
      }

      .el-select-dropdown {
        overflow: hidden;
        // min-width: unset !important;
        // height: 90px;
        border-radius: 4px;
      }

      .el-select-dropdown__footer {
        border-top: 1px solid var(--border-color-light);
        padding: 12px;
        background: var(--bg-color-page);
      }

      .el-select-dropdown__empty {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--bg-color-page);
        border-radius: 4px;
      }
    }

    .el-select-dropdown__wrap {
      border-radius: 4px;
      background-color: var(--bg-color-page);
      padding: 4px;

      .el-select-dropdown__list {
        margin: 0px !important;
        padding: 0px !important;

        .el-tree {
          position: relative !important;
        }
      }

      .el-select-group__wrap {
        display: block !important;
      }
    }

    .el-popper__arrow::before {
      background-color: var(--bg-color-page);
    }

    &.el-popper {
      // box-shadow: none !important;

      .el-scrollbar__bar.is-vertical {
        .el-scrollbar__thumb {
          opacity: 1;
        }
      }
    }
  }

  &.is-in-subform {
    :deep(.el-popper) {
      .el-select-dropdown__wrap {
        padding: 2px !important;
      }

      .el-select-dropdown__list {
        padding: 2px;

        .other-option-wrapper {
          flex: 1;
        }

        .other-input-container {
          height: 100%;
          display: flex;
          align-items: center;

          .el-input__wrapper {
            border-radius: 4px;
            width: 100%;
          }
        }

        .option-not-event {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0 8px;
        }

        .el-tree-node {
          height: 36px;
          line-height: 20px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0;
          border-radius: 4px;

          .el-tree-node__content {
            padding-left: 10px !important;
            height: 100%;
            width: 100%;

            &:hover {
              background-color: var(--bg-color-overlay);
            }

            .el-select-dropdown__item {
              height: 100%;

              &.is-hovering, &.is-selected {
                background: transparent !important;
              }

              &.is-selected::after {
                display: none;
              }

              & > div {
                height: 100%;
                display: flex;
                align-items: center;

                &.tree-label {
                  height: 28px;
                  padding: 0 9px;
                  font-size: 14px;
                  line-height: 20px;
                }

                .other-label {
                  padding: 0 9px;
                }

                .el-input__wrapper {
                  border-radius: 4px;
                  width: 120px;
                }
              }
            }
          }

          &:last-child {
            margin-bottom: 0;
          }

          &:has(.option-not-event) {
            pointer-events: none !important;
          }

          .option-not-event {
            pointer-events: all;
            width: 100%;
          }
        }
      }
    }
  }
}

.add-option-footer {
  .add-option-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  :deep(.add-option-editor) {
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

    .add-option-actions {
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

.mobile-select {
  height: 40px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0 12px;
  background-color: #fff;
  display: flex;
  align-items: center;
  .select-inner {
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    &.placeholder {
      color: var(--text-color-placeholder);
    }
  }

  :deep(.el-icon) {
    color: var(--text-color-placeholder);
  }
}

.other-input {
  :deep(.el-input__wrapper) {
    border-radius: 4px;
    margin-top: 4px;
  }
  &.mobile {
    :deep(.el-input__wrapper) {
      height: 40px;
    }
  }
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

  .value-wrapper {
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    &.flex {
      display: flex;
      column-gap: 6px;
    }
  }
  .el-tag {
    border: none;
  }
  .el-tag:not(:last-child) {
    margin-right: 2px;
  }
}

:deep(.el-select-dropdown__item.is-selected) {
  font-weight: unset;
}

.value.mobile {
  height: 40px;
  border-radius: 4px;
  padding: 0 12px !important;
  line-height: 40px;
}
</style>

