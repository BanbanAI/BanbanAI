<template>
  <div :class="['option-group-control', { 'select-warn': borderWarnVisible }]">
    <template v-if="isRadioGroup">
      <el-radio-group :class="['option-radio-group', { 'is-five-per-row': isFivePerRowRadioGroup }]" style="width: 100%;" :modelValue="selectValue" @update:modelValue="updateValue" size="small" :disabled="isOptionGroupDisable">
        <template v-for="choice in selectChoices" :key="choice.value">
          <el-radio-button
            v-if="isShowOption(choice)"
            :style="{ width: isFivePerRowRadioGroup ? '20%' : `calc(100% / ${selectChoices.length})` }"
            :value="choice.value"
            :disabled="!!choice.disabled"
          >
            <span class="choice" :title="choice.label">{{ choice.label }}</span>
          </el-radio-button>
        </template>
      </el-radio-group>
    </template>
    <template v-else-if="isTree">
      <el-tree-select :clearable="props.option.clearable" :indent="10" :modelValue="selectValue" :multiple="isMultiple" @update:modelValue="updateValue" filterable
        :show-checkbox="false" :check-strictly="!isOnlyCheckLeaf" :placeholder="props.option.placeholder ?? $t('selectPlaceholder')" popper-class="option-group-popper"
        :name="option.name" :data="selectChoices" :empty-text="$t('treeEmpty')" :no-match-text="$t('treeEmpty')" fit-input-width
        collapse-tags collapse-tags-tooltip size="small" :disabled="isOptionGroupDisable" style="background-color: transparent;">
        <template #header v-if="isAllCheck && isMultiple">
          <div :class="['check-all-tree-option', { 'is-check-all-active': checkAll }]" @click="handleCheckAll(!checkAll)">
            {{ $t('SelectOption.selectAll') }}
            <el-icon v-if="checkAll"><Select /></el-icon>
          </div>
        </template>
        <template #default="{ data }">
          <span class="tree-option-label" :title="data.label">{{ data.label }}</span>
        </template>
        <template #label="{ label, value }">
          <span :class="{isDeleted: isDeleted(label, value)}">{{ getLabel(label, value) }}</span>
        </template>
      </el-tree-select>
    </template>
    <template v-else>
      <div class="select-content" v-if="!isInputValue || selectChoices.length">
        <el-select :clearable="props.option.clearable as boolean" :modelValue="selectValue" @update:modelValue="updateValue" filterable effect="light" :placeholder="props.option.placeholder ?? $t('selectPlaceholder')" :no-data-text="$t('selectNone')"
          popper-class="option-group-popper" :name="option.name" :multiple="isMultiple" :disabled="isOptionGroupDisable" size="small" collapse-tags collapse-tags-tooltip
          :popper-options="{
            modifiers: [
              { name: 'offset', options: { offset: [0, 8] } },
            ],
          }">
          <template #label="{ label, value }">
            <span class="select-value-tag-text" :class="{isDeleted: isDeleted(label, value)}">{{ getLabel(label, value) }}</span>
          </template>
          <el-option v-if="isAllCheck && isMultiple" :class="['check-all-option', { 'is-check-all-active': checkAll }]" :label="$t('selectOption.selectAll')" value="allchoices" style="display: flex;align-items: center;column-gap: 4px;" :title="$t('selectOption.selectAll')" @click="handleCheckAll(!checkAll)">
            {{ $t('SelectOption.selectAll') }}
            <el-icon v-if="checkAll"><Select /></el-icon>
          </el-option>
          <template v-for="choice in selectChoices" :key="choice.value">
            <el-option :label="choice.label" :value="choice.value" style="display: flex;align-items: center;column-gap: 4px;" :title="choice.label" v-if="isShowOption(choice)">
              {{ choice.label }}
              <el-tooltip placement="top" effect="light" v-if="choice.tip">
                <template #content>
                  <div style="max-width: 200px;">{{ choice.tip }}</div>
                </template>
                <div class="tip-icon" style="display: flex;">
                  <el-icon size="14"><i-ant-design-question-circle-outlined /></el-icon>
                </div>
              </el-tooltip>
            </el-option>  
          </template>
        </el-select>
        <div class="icon-wrapper" @click.stop="showDataConditionDialog" :title="$t('showConditionDialogTitle')" v-if="isShowConditionBtn">
          <el-icon class="icon-data-condition" :size="12"><i-ven-condition /></el-icon>
        </div>
      </div>
      <div class="input-content" v-else>
        <el-input :model-value="selectValue"  @update:modelValue="updateInputValue" ></el-input>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, IS_OPTION_GROUP_DISABLE, OPTION_ELEMENT, UPDATE_OPTION } from "../inject";
import { SHOW_DATA_CONDITION_DIALOG } from '@renderer/types';
import { inject, computed, unref, nextTick, ref } from 'vue';
import { DefinedOptionWithParsedType, SelectChoice } from "../types";
import i18next from 'i18next';
import { isEmpty } from '@common/utils/object';
import { Select, SemiSelect } from '@element-plus/icons-vue';

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const element = inject(OPTION_ELEMENT);
const isOptionGroupDisable = inject(IS_OPTION_GROUP_DISABLE);
const showDataConditionDialog = inject(SHOW_DATA_CONDITION_DIALOG);
const selectChoices = computed(() => {
  const choices = props.option.selectChoices;
  if (typeof choices === 'function') {
    return choices(unref(element)) as SelectChoice[];
  }
  return choices as SelectChoice[] ?? [] ;
});
const isRadioGroup = computed(() => props.option.args?.hasOwnProperty('radioGroup'));
const isShowConditionBtn = computed(() => !isRadioGroup.value && props.option.args?.hasOwnProperty('condition'));
const isMultiple = computed(() => props.option.args?.multiple === 'true');
const isTree = computed(() => props.option.args?.hasOwnProperty('tree'));
const isOnlyCheckLeaf = computed(() => isTree.value && props.option.args?.hasOwnProperty('onlyCheckLeaf'));
const isAllCheck = computed(() =>  props.option.args?.hasOwnProperty('allCheck'));
const isInputValue = computed(() => props.option.args?.hasOwnProperty('inputValue'));
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const unknownOptionText = computed(() => props.option?.unknownOptionText ?? i18next.t("selectUnknownOption"));
const isFivePerRowRadioGroup = computed(() => {
  return isRadioGroup.value
    && props.option.name === "width-ratio"
    && selectChoices.value.length === 10;
});

const findChoiceByValue = (choices: SelectChoice[], value: string | number): SelectChoice | null => {
  for (const node of choices) {
    if (node.value === value || node.legacyValue === value) {
      return node;
    }
    if (node.children?.length) {
      const found = findChoiceByValue(node.children, value);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

const normalizeChoiceValue = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(item => normalizeChoiceValue(item));
  }
  const choice = findChoiceByValue(selectChoices.value, value);
  return choice?.value ?? value;
};

// 全选逻辑
const checkAll = ref(false);
const handleCheckAll = (val) => {
  checkAll.value = val;
  if (val) {
    updateValue(selectChoices.value.map((item) => item.value));
  } else {
    updateValue([]);
  }
}

const isValueInChoices = (choices: any[], value: string | string[]): boolean => {
  if (Array.isArray(value)) {
    return value.some(val => isValueInChoices(choices, val));
  }
  return !!findChoiceByValue(choices as SelectChoice[], value);
};
const getLabel = (label: string, value: string | string[]) => {
  if (label !== value) {
    return label;
  } else {
    let exist = false;
    const isArray = Array.isArray(value);
    if (isArray) {
      if (isEmpty(value)) {
        exist = true;
      } else {
        exist = isValueInChoices(selectChoices.value, value);
      }
    } else {
      exist = isValueInChoices(selectChoices.value, value);
    }
    if (getOptionValue() && !exist) {
      return isArray ? [unknownOptionText.value] : unknownOptionText.value;
    }
    return label;
  }
}

const isDeleted = (label: string, value: string | string[]) => {
  if (label !== value) {
    return false;
  } else {
    let exist = false;
    if (Array.isArray(value)) {
      if (isEmpty(value)) {
        exist = true;
      } else {
        exist = isValueInChoices(selectChoices.value, value);
      }
    } else {
      exist = isValueInChoices(selectChoices.value, value);
    }
    if (getOptionValue() && !exist) {
      return true
    }
    return false
  }
}

const selectValue = computed(() => normalizeChoiceValue(getOptionValue()));

const updateValue = async (value) => {
  if (props.option.beforeChange) {
    const shouldChange = await props.option.beforeChange(unref(element), value);
    if (shouldChange === false) {
      return;
    }
  }
  updateOption(value);

  // treeSelect还有子项，全部选中才是全选
  let allChoicesValue = [];
  selectChoices.value.forEach((item) => {
    allChoicesValue.push(item);
    if (item.children) {
      allChoicesValue = allChoicesValue.concat(item.children);
    }
  });
  if (value.length === 0) {
    checkAll.value = false;
  } else if (isTree.value && value.length === allChoicesValue.length) {
    checkAll.value = true;
  } else if (!isTree.value && value.length === selectChoices.value.length) {
    checkAll.value = true;
  }
  
  if (isMultiple.value) return;
  nextTick(() => {
    // 这里需要两个nextTick，对于select的情况
    nextTick(() => {
      (document.activeElement as HTMLElement).blur();
    })
  })
}
const updateInputValue = (value) => {
  const saveValue = Number(value) == value ? Number(value) : value;
  updateOption(saveValue);
}

const isShowOption = (choice: SelectChoice) => {
  if (choice.unUse) {
    return selectValue.value === choice.value;
  }
  return true;
}

const borderWarnVisible = computed(() => {
  return Array.isArray(selectValue.value) ? selectValue.value.includes(unknownOptionText.value) : selectValue.value === unknownOptionText.value;
})
</script>
<style scoped lang="scss">
.check-all-tree-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: black;
  font-weight: 700;
  margin: -10px;
  padding: 0 10px;
  &:hover {
    background-color: var(--el-fill-color-light);
    cursor: var(--cursor-pointer);;
  }
}
.check-all-option {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: black;
  font-weight: 700;
  &:hover {
    background-color: var(--el-fill-color-light);
    cursor: var(--cursor-pointer);;
  }
}
.is-check-all-active { 
  color: var(--color-primary);
}
.option-group-control {
  display: flex;
  flex-direction: column;
  width: 100%;

  :deep(.option-radio-group.is-five-per-row){
    display: flex;
    flex-wrap: wrap;
  }

  :deep(.el-radio-button){
    --el-fill-color-blank: var(--el-bg-color-overlay);
    .el-radio-button__inner{
      width: 100%;
      overflow: hidden;
      white-space: nowrap; 
      text-overflow: ellipsis;
      font-size: 11px;
      padding: 5px 2px;
    }
  }

  :deep(.option-radio-group.is-five-per-row .el-radio-button){
    margin-right: 0;
    margin-bottom: -1px;
  }

  :deep(.option-radio-group.is-five-per-row .el-radio-button:nth-child(5n + 1) .el-radio-button__inner){
    border-left: var(--el-border);
    border-radius: var(--el-border-radius-base) 0 0 var(--el-border-radius-base);
  }

  :deep(.option-radio-group.is-five-per-row .el-radio-button:nth-child(5n) .el-radio-button__inner){
    border-radius: 0 var(--el-border-radius-base) var(--el-border-radius-base) 0;
  }

  :deep(.option-radio-group.is-five-per-row .el-radio-button:nth-child(n + 6) .el-radio-button__inner){
    margin-left: -1px;
  }

  .select-content {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: flex-start;
    :deep(.el-select) {
      flex: 1;
      height: 100%;
      .el-tag {
        padding-left: 3px;
        color: var(--el-select-multiple-input-color);
        .el-select__tags-text {
          max-width: 50px !important;
        }
        .el-tag__close {
          margin-left: 2px;
          color: inherit;
        }
      }
    }

    .icon-wrapper{
      display: flex;
      width: 24px;
      height: 24px;
      align-items: center;
      justify-content: center;
      background-color: var(--bg-color-overlay);
      margin-left: 5px;
      border-radius: 4px;
      box-shadow: 0 0 0 1px var(--el-input-border-color, var(--el-border-color)) inset;
      cursor: var(--cursor-pointer);
      &:hover{
        box-shadow: 0 0 0 1px var(--color-primary) inset;
        .icon-data-condition {
          color: #fff;
        }
      }
    }
  }
}

.isDeleted {
  color: var(--color-danger);
}

.tree-option-label {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>

<style lang="scss">
.el-popper[role="tooltip"]:has(.select-value-tag-text) {
  width: 280px;
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  .el-tag {
    border: 1px solid var(--el-border-color);
  }
}
</style>
