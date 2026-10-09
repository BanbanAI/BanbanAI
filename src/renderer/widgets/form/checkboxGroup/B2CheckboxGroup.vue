<template>
  <b2-form-element>
    <template v-if="!widget.isReadonly">
      <div v-if="widget.isInSubForm && !isMobileDevice" class="wrap-checkbox-group-select" :class="{'mobile': isMobileDevice}">
        <!-- 子表单中 -->
        <el-select
          popper-class="checkbox-group-select-popver"
          :model-value="displayValue"
          clearable
          multiple
          placeholder=""
          :show-arrow="false"
          :offset="4"
          @update:modelValue="handleChanged"
          @clear="handleClear"
          @visible-change="handleSelectVisibleChange"
        >
          <template #prefix>
            <el-icon :size="16" class="select-prefix-icon">
              <i-ven-icon-widget-form-checkbox-group-checkbox-selected v-if="displayValue?.length > 0"/>
              <i-ven-icon-widget-form-checkbox-group-checkbox-selected-no-color v-else/>
            </el-icon>
          </template>
          <el-option
            v-for="item in widget.checkboxList"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
            <el-icon :size="16">
              <i-ven-icon-widget-form-checkbox-group-checkbox-selected v-if="displayValue.includes(item.value)" />
              <i-ven-icon-widget-form-checkbox-group-checkbox-unselected v-else/>
            </el-icon>
            <el-tag v-if="widget.openBgColor" :color="item.color">{{ item.value }}</el-tag>
            <span v-else>{{ item.value }}</span>
          </el-option>

          <!-- 其他选项 -->
          <el-option
            v-if="otherLabel"
            :value="otherLabel"
            class="other-option option-not-event"
            >
            <div class="wrap-other-option-items" @click.stop.prevent="handleOtherOptionClick">
              <el-icon :size="16">
                <i-ven-icon-widget-form-checkbox-group-checkbox-selected v-if="displayValue.includes(otherLabel)" />
                <i-ven-icon-widget-form-checkbox-group-checkbox-unselected v-else/>
              </el-icon>
              <span>{{ otherLabel }}</span>
              <div class="input" @click.stop.prevent>
                <el-input
                  ref="otherInputRef"
                  v-show="isShowOther"
                  v-model="widget.otherInputVal"
                  :placeholder="i18next.t('plsInput')"
                  @blur="handleOtherInputBlur"
                ></el-input>
              </div>
            </div>
          </el-option>

          <template #label="{ value }">
            <template v-if="value === otherLabel || !displayValue.includes(value)">
               <el-tag v-if="widget.openBgColor" :color="getTagBgColor(value)">{{ widget.otherInputVal || value }}</el-tag>
               <span class="default-tag" v-else>{{ widget.otherInputVal || value }}</span>
            </template>
            <template v-else>
               <el-tag v-if="widget.openBgColor" :color="getTagBgColor(value)">{{ value }}</el-tag>
               <span class="default-tag" v-else>{{ value }}</span>
            </template>
          </template>
          <template #footer v-if="canAddCustomOption">
            <!-- 数据管理表的单元格里 -->
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
                ></el-input>
                <div class="add-option-actions">
                  <el-button text @click="cancelAddOption" bg>{{ i18next.t('cancel') }}</el-button>
                  <el-button type="primary" @click="confirmAddOption">{{ i18next.t('confirm') }}</el-button>
                </div>
              </div>
            </div>
          </template>
        </el-select>
      </div>
      <!-- 表单中 -->
      <div v-else class="checkbox-group" :class="{'mobile': isMobileDevice}">
        <el-checkbox-group :model-value="displayValue" @update:modelValue="handleChanged" :style="{'flex-direction': widget.boxLayout}">
          <el-checkbox v-for="item in widget.checkboxList" :key="item.value" :label="item.value" :value="item.value"
          :style="{ '--text-bg-color': widget.openBgColor ? item.color : 'transparent' ,'--font-color': widget.openBgColor ? 'white' : 'black'}" />

          <!-- 其他选项 -->
          <div class="other-option" v-if="otherLabel" @click.stop.prevent="handleOtherOptionClick">
            <el-checkbox
              class="checkboxItem"
              :label="otherLabel"
              :value="otherLabel"
            >
              <span>{{ otherLabel }}</span>
              <div class="input" @click.stop.prevent>
                <el-input
                  ref="otherInputRef"
                  v-show="isShowOther"
                  v-model="widget.otherInputVal"
                  :placeholder="i18next.t('plsInput')"
                  @blur="handleOtherInputBlur"
                ></el-input>
              </div>
            </el-checkbox>
          </div>
          <div class="custom-option-item" v-if="canAddCustomOption">
            <el-popover
              :visible="isShowAddOptionInput"
              placement="bottom-start"
              width="260"
              trigger="manual"
              :show-arrow="false"
              popper-class="checkbox-group-custom-option-popover"
              @hide="cancelAddOption"
            >
              <div ref="customOptionPopoverContentRef" class="custom-option-editor" @click.stop>
                <el-input
                  ref="customOptionInputRef"
                  v-model.trim="customOptionName"
                  :placeholder="i18next.t('plsInputOption')"
                  @keydown.enter.stop.prevent="confirmAddOption"
                ></el-input>
                <div class="add-option-actions">
                  <el-button text @click="cancelAddOption" bg>{{ i18next.t('cancel') }}</el-button>
                  <el-button type="primary" @click="confirmAddOption">{{ i18next.t('confirm') }}</el-button>
                </div>
              </div>
              <template #reference>
                <el-button ref="customOptionTriggerRef" link type="primary" class="custom-option-trigger" @click="openAddOptionInput">
                  <el-icon><Plus /></el-icon>
                  <span>{{ i18next.t('addOption') }}</span>
                </el-button>
              </template>
            </el-popover>
          </div>
        </el-checkbox-group>
      </div>
    </template>
    <div class="value" v-else>
      <div v-if="arrayValue.length != 0">
        <template v-if="!widget.openBgColor" :title="arrayValue.join(' , ')">
          {{ arrayValue.join(" , ") }}
        </template>
        <template v-else>
          <el-tag v-for="item in arrayValue" effect="dark" :color="getTagBgColor(item)" :title="item" >{{ item }}</el-tag>
        </template>
      </div>
      <span
        v-else
        style="color: var(--text-color-inactive);"
        :title="i18next.t('noContent')"
      >
        {{ i18next.t('noContent') }}
      </span>
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { CheckboxGroup } from "./checkboxGroup";
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { onClickOutside } from "@vueuse/core";
import { ElInput, ElMessage } from "element-plus";
import IVenIconCheckboxSelected from '~icons/ven-icon/widget-form-checkbox-group-checkbox-selected';
import IVenIconCheckboxUnselected from '~icons/ven-icon/widget-form-checkbox-group-checkbox-unselected';
import IVenIconCheckboxSelectedNoColor from '~icons/ven-icon/widget-form-checkbox-group-checkbox-selected-no-color';
import i18next, { $t } from "@renderer/widgets/i18next";
import { Plus } from '@element-plus/icons-vue';

const isMobileDevice = isMobile();

const widget = useWidget<CheckboxGroup>();
const otherInputRef = ref<HTMLInputElement | null>(null);
const customOptionInputRef = ref<InstanceType<typeof ElInput>>();
const customOptionTriggerRef = ref();
const customOptionPopoverContentRef = ref<HTMLElement | null>(null);
const isShowOther = ref(!!widget.otherInputVal);
const isShowAddOptionInput = ref(false);
const customOptionName = ref("");

const otherLabel = computed(() => (widget.checkboxOption.otherOptions?.value ?? ""));
const canAddCustomOption = computed(() => widget.canAddCustomOptionInRuntime);

const displayValue = computed(() => {
  const optionValues = widget.checkboxList.map(i => i.value);
  const raw = widget.inputValue || [];
  const result: string[] = [];
  let hasOther = false;

  raw.forEach(v => {
    if (optionValues.includes(v)) {
      result.push(v);
    } else {
      if (otherLabel.value) {
        hasOther = true;
      }
    }
  });

  if (hasOther) {
    // 只要有 "其他" 就显示为 otherLabel (用于多选的选中效果)
    result.push(otherLabel.value);
  }

  return result;
  return [...new Set(result)];
});

const handleChanged = (newVal: string[]) => {
  const optionValues = widget.checkboxList.map(i => i.value);
  const realValues = newVal.filter(v => optionValues.includes(v));
  // 将 otherLabel 转为 实际的输入值
  if (newVal.find(v => !optionValues.includes(v))) {
    realValues.push(widget.otherInputVal);
  }
  widget.inputValue = realValues;
  widget.validate();
}

const handleOtherInputBlur = () => {
  widget.otherInputVal = widget.otherInputVal;
  widget.validate();
}

const handleClear = () => {
  widget.cleanInputValue();
  isShowOther.value = false;
  cancelAddOption();
}

const handleOtherOptionClick = () => {
  isShowOther.value = !isShowOther.value;
  if (isShowOther.value) {
    widget.otherInputVal = widget.otherInputVal || otherLabel.value;
    nextTick(() => {
      otherInputRef.value?.focus?.();
      otherInputRef.value?.select?.();
    });
  } else {
    widget.otherInputVal = "";
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
    const existed = (widget.checkboxOption.options || []).some(item => item.value === value);
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

const arrayValue = computed(()=>{
  const value = widget.inputValue;
  if (Array.isArray(value)) {
    return value;
  } else if (!value) {
    return [];
  } else {
    return [value];
  }
});
const getTagBgColor = (value: string)=>{
  const radio = widget.checkboxList.find((item) => item.value === value);
  return radio?.color ?? "#ccc";
};

const isChecked = (value: string) => {
  // 多选组件是否选中"其他"
  const optionValues = widget.checkboxList.map(i => i.value);
  return widget.inputValue.some(v => !optionValues.includes(v) || v === value);
}

onMounted(() => {
  if (!widget.isEditable) {
    requestIdleCallback(() => {
      isShowOther.value = isChecked(otherLabel.value);
    });
  }
})

const handleSelectVisibleChange = (visible: boolean) => {
  if (!visible) {
    cancelAddOption();
  }
}

onClickOutside(customOptionTriggerRef, (event) => {
  if (!isShowAddOptionInput.value) return;
  const target = event.target as Node | null;
  if (target && customOptionPopoverContentRef.value?.contains(target)) {
    return;
  }
  cancelAddOption();
});
</script>

<style lang="scss" scoped>
.el-checkbox-group {
  display: flex;
  row-gap: 8px;
  column-gap: 32px;
  flex-wrap: wrap;
  .el-checkbox, .checkboxItem {
    margin-right: 0;
    z-index: 0;
    height: auto;
    min-height: 32px;

    :deep(.el-checkbox__input) {
      margin-right: 8px;

      .el-checkbox__inner {
        width: 14px;
        height: 14px;
      }
    }
    :deep(.el-checkbox__label) {
      display: flex;
      align-items: center;
      color: var(--font-color);
      padding: 4px 8px;
      font-size: 14px;
      background: var(--text-bg-color);
      border-radius: 4px;
      line-height: normal;
      flex: 1;
      white-space: wrap;
      word-break: break-all;
    }
  }
  :deep(.el-checkbox.is-checked .el-checkbox__label) {
    color: var(--font-color);
  }

  .other-option {
    display: flex;
    align-items: center;
    .checkboxItem {
      :deep(.el-checkbox__label) {
        background: transparent;
        padding: 0;
        color: var(--el-text-color-regular);
        span {
          padding: 4px 8px;
          border-radius: 4px;
        }
      }
    }
    .input {
      width: 200px;
      --el-border-radius-base: 2px;
    }
  }

  .custom-option-item {
    width: 100%;
  }

  .custom-option-trigger {
    padding-left: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
}

.wrap-checkbox-group-select {
  :deep(.el-select) {
    .el-select__wrapper {
      border-radius: 4px;
      height: 32px;
      gap: 8px;

      .el-select__selection {
        flex-wrap: nowrap;
        overflow: hidden;
        gap: 8px;

        .el-select__selected-item {
          background-color: transparent;

          & > .el-tag {
            padding: 0;
          }

          .el-tag {
            color: var(--color-white);
            height: 28px;
            font-size: 14px;
          }

          .default-tag {
            padding: 0 8px;
            color: var(--text-color-primary);
          }

          .el-tag__close {
            display: none;
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

.mobile {
  :deep(.el-checkbox-group) {
    display: flex;
    row-gap: 5px;
    width: 100%;

    .el-checkbox {
      -webkit-tap-highlight-color: transparent;
    }

    .other-option {
      width: 100%;
      .checkboxItem {
        width: 100%;
        :deep(.el-checkbox__label) {
          flex: 1;
        }
      }
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

  .el-tag {
    border: none;
  }
  .el-tag:not(:last-child) {
    margin-right: 2px;
  }
}
</style>
<style lang="scss">
.checkbox-group-select-popver {
  background-color: var(--bg-color-page);
  border-radius: 4px;

  .el-select-dropdown__list{
    padding: 2px;

    .el-select-dropdown__item {
      height: 36px;
      line-height: 20px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 4px;

      &:last-child {
        margin-bottom: 0;
      }

      &.is-hovering {
        background-color: var(--el-bg-color-overlay);
      }

      &.is-selected::after {
        display: none;
      }

      .el-tag {
        color: var(--color-white);
        height: 28px;
        font-size: 14px;
        padding: 4px 8px;
      }

      &.other-option {
        &.option-not-event {
          pointer-events: none;
        }
        .wrap-other-option-items {
          width: 100%;
          height: 100%;
          pointer-events: all;
          display: flex;
          align-items: center;
          gap: 8px;

          .input {
            // width: 200px;
            flex: 1;
          }

          .el-input__wrapper {
            border-radius: 4px;
            width: 100%;
          }
        }
      }
    }
  }
}
.checkbox-group-custom-option-popover {
  background-color: var(--bg-color-page) !important;
  border-radius: 8px !important;
  padding: 16px !important;

  .custom-option-editor {
    display: flex;
    flex-direction: column;
    gap: 24px;

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
</style>
