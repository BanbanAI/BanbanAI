<template>
  <b2-form-element>
    <template v-if="!widget.isReadonly">
      <!-- 子表单 -->
      <div v-if="widget.isInSubForm && !isMobileDevice" class="wrap-radio-group-select">
        <el-select
          :model-value="inputValue"
          @update:modelValue="handleInputValue"
          popper-class="radio-group-select-popver"
          :show-arrow="false"
          :offset="4"
          placeholder=""
          :clearable="true"
          @clear="handleClear"
        >
          <template #prefix>
            <el-icon :size="16" class="select-prefix-icon">
              <i-ven-icon-widget-form-radio-group-radio-group-selected v-if="!!widget.inputValue" />
              <i-ven-icon-widget-form-radio-group-radio-group-selected-no-color v-else/>
            </el-icon>
          </template>
          <el-option
            v-for="item in widget.radioList"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
            <el-icon :size="16">
              <i-ven-icon-widget-form-radio-group-radio-group-selected v-if="item.value === widget.inputValue" />
              <i-ven-icon-widget-form-radio-group-radio-group-unselected v-else/>
            </el-icon>
            <el-tag v-if="widget.openBgColor" :color="item.color">{{ item.value }}</el-tag>
            <span v-else>{{ item.value }}</span>
          </el-option>
          <el-option v-if="otherLabel" class="other-option" :class="{ 'option-not-event': !isShowOther }">
            <div class="wrap-other-option-items" @click.stop.prevent="handleOtherOptionClick">
              <el-icon :size="16">
                <i-ven-icon-widget-form-radio-group-radio-group-selected v-if="otherLabel === inputValue" />
                <i-ven-icon-widget-form-radio-group-radio-group-unselected v-else/>
              </el-icon>
              <span>{{ otherLabel }}</span>
              <div class="input" @click.stop.prevent>
                <el-input
                  ref="otherInputRef"
                  v-show="isShowOther"
                  v-model="widget.otherInputVal"
                  :placeholder="i18next.t('pleaseInput')"
                  @blur="widget.inputValue = widget.otherInputVal"
                ></el-input>
              </div>
            </div>
          </el-option>
          <template #label={item}>
            <el-tag v-if="widget.openBgColor" :color="widget.radioList.find((item) => item.value === inputValue)?.color ?? '#ccc'">
              {{ otherLabel !== inputValue ? inputValue : (widget.otherInputVal || inputValue) }}
            </el-tag>
            <span v-else>{{ otherLabel !== inputValue ? inputValue : (widget.otherInputVal || inputValue) }}</span>
          </template>
        </el-select>
      </div>
      <!-- 表单 -->
      <div v-else class="radio-group" :class="{'mobile': isMobileDevice}" ref="radioGroupRef" :style="{
        '--layout': widget.radioLayout === 'horizontal' ? 'row' : 'column',
        '--radioWidth': isMobileDevice && widget.radioLayout === 'vertical' ? '100%' : 'auto'
      }">
        <el-radio-group :model-value="inputValue" @update:modelValue="handleInputValue">
          <div class="default" :class="{'colored': widget.openBgColor}">
            <div v-for="(item, index) in widget.radioList" :style="{'--text-bg-color': item.color}" :key="`${item.value}-${index}`">
              <el-radio class="radioItem" :value="item.value" @click="handleOptionClick(item.value, $event)"> {{ item.value }}</el-radio>
            </div>
            <div class="other-option" v-if="otherLabel">
              <el-radio class="radioItem" :value="otherLabel" @click="handleOtherOptionClick">
                <span>{{ otherLabel }}</span>
                <div class="input" @click.stop.prevent>
                  <el-input
                    ref="otherInputRef"
                    v-show="isShowOther"
                    v-model="widget.otherInputVal"
                    :placeholder="i18next.t('pleaseInput')"
                    @blur="handleBlurInput"
                  ></el-input>
              </div></el-radio>
            </div>
          </div>
        </el-radio-group>
      </div>
    </template>
    <div class="value" v-else>
      <div v-if="widget.inputValue">
        <span v-if="!widget.openBgColor" :title="widget.inputValue">{{ widget.inputValue }}</span>
        <el-tag v-else-if="widget.inputValue" effect="dark" :color="tagBgColor" :title="widget.inputValue">{{ widget.inputValue }}</el-tag>
      </div>
      <div v-else style="color: var(--text-color-inactive);" :title="i18next.t('noContent')">
        {{ i18next.t('noContent') }}
      </div>
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { computed, onMounted, ref, nextTick } from "vue";
import { RadioGroup } from "./radioGroup";
import IVenIconRadioGroupSelected from '~icons/ven-icon/widget-form-radio-group-radio-group-selected';
import IVenIconRadioGroupUnselected from '~icons/ven-icon/widget-form-radio-group-radio-group-unselected';
import IVenIconRadioGroupSelectedNoColor from '~icons/ven-icon/widget-form-radio-group-radio-group-selected-no-color';
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const widget = useWidget<RadioGroup>();

const otherInputRef = ref<HTMLInputElement | null>(null);
const radioGroupRef = ref<HTMLElement | null>(null);
const isShowOther = ref(!!widget.otherInputVal);

const otherLabel = computed(() => {
  return widget.customOption.otherOptions?.value ?? "";
});

const inputValue = computed(() => {
  if (!widget.inputValue) {
    return null;
  }
  const inOption = widget.customOption.options.some(item => item.value === widget.inputValue);
  if (!inOption && widget.inputValue) {
    return otherLabel.value;
  }
  return widget.inputValue;
});

const handleInputValue = (value: string) => {
  if (!value) {
    widget.inputValue = "";
    return;
  }
  const inOption = widget.customOption.options.some(item => item.value === value);
  if (!inOption) {
    widget.inputValue = widget.otherInputVal;
    widget.validate();
  } else {
    widget.inputValue = value;
  }
}

const handleBlurInput = () => {
  if (inputValue.value === otherLabel.value) {
    widget.inputValue = widget.otherInputVal;
  }
}

const tagBgColor = computed(()=>{
  const radio = widget.radioList.find((item) => item.value === inputValue.value);
  return radio?.color ?? "#ccc";
});

const handleClear = () => {
  widget.cleanInputValue();
  isShowOther.value = false;
}

const focusOtherInput = () => {
  if (otherInputRef.value) {
    requestIdleCallback(() => {
      otherInputRef.value.focus();
      otherInputRef.value.select();
    });
  }
}

const handleOptionClick = (value: string, event?: Event) => {
  if (value === inputValue.value) {
    if (event) event.preventDefault();
    handleClear();
  }
  isShowOther.value = false;
}

const handleOtherOptionClick = () => {
  isShowOther.value = !isShowOther.value;
  if (isShowOther.value) {
    widget.otherInputVal = widget.otherInputVal || otherLabel.value;
    widget.inputValue = widget.otherInputVal;
    focusOtherInput();
  }
   else {
    widget.inputValue = "";
    // widget.otherInputVal = "";
  }
};

onMounted(() => {
  if (!widget.isEditable) {
    requestIdleCallback(() => {
      isShowOther.value = !!widget.otherInputVal;
    });
  }
})
</script>
<style lang="scss" scoped>
.radio-group {
  .default {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    align-items: normal;
    flex-direction: var(--layout);
    column-gap: 32px;
    row-gap: 8px;

    :deep(.el-radio) {
      display: flex;
      align-items: center;
      z-index: 0;
      height: auto;
      min-height: 32px;

      .el-radio__input {
        margin-right: 8px;

        .el-checkbox__inner {
          width: 14px;
          height: 14px;
        }
      }

      .el-radio__label {
        display: flex;
        align-items: center;
        color: #141E31;
        padding: 4px 8px;
        font-size: 14px;
        border-radius: 4px;
        line-height: normal;
        flex: 1;
        white-space: wrap;
        word-break: break-all;
      }
    }
    &.colored {
      :deep(.el-radio) {
        .el-radio__label {
          color: #ffffff;
          background: var(--text-bg-color);
        }
      }
    }
  }
  .other-option {
    display: flex;
    align-items: center;

    :deep(.el-radio) {
      .el-radio__label {
        color: var(--text-color-regular) !important;
        padding: 0 !important;
        span {
          padding: 4px 8px;
          border-radius: 4px;
        }
      }
      .input {
        width: 200px;
        --el-border-radius-base: 2px;
      }
    }
  }
}

.wrap-radio-group-select {
  :deep(.el-select) {
    .el-select__wrapper {
      border-radius: 4px;
      height: 32px;
      gap: 8px;

      .el-tag {
        color: var(--color-white);
        height: 28px;
        font-size: 14px;
        padding: 4px 8px;
      }
    }
  }
}

.radio-group.mobile {
  :deep(.el-radio-group) {
    width: 100%;
  }
  .default {
    width: 100%;
    display: flex;
    flex-direction: column;
    row-gap: 5px;
    > div {
      width: var(--radioWidth);
    }

    :deep(.el-radio) {
      -webkit-tap-highlight-color: transparent;
    }
  }

  .other-option {
    width: 100%;

    :deep(.el-radio) {
      width: 100%;
      .el-radio__label {
        flex: 1;
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
}
</style>
<style lang="scss">
.radio-group-select-popver {
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

          .el-input__wrapper {
            border-radius: 4px;
            width: 120px;
          }
        }
      }
    }
  }
}
</style>
