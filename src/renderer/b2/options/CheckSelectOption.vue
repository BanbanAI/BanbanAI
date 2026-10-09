<template>
  <div class="option-select-control">
    <!-- 下拉选择-树状 -->
    <template v-if="isTree">
      <el-tree-select
        :clearable="props.option.clearable"
        class="tree-select-type"
        :indent="10"
        :modelValue="selectValue"
        multiple
        @update:modelValue="updateValue"
        show-checkbox
        filterable
        :check-strictly="!isOnlyCheckLeaf"
        :placeholder="$t('selectPlaceholder')"
        popper-class="option-check-select-popper"
        :name="option.name"
        :data="selectChoices"
        :empty-text="$t('treeEmpty')"
        :no-match-text="$t('treeEmpty')"
        fit-input-width
        collapse-tags
        collapse-tags-tooltip
        size="small"
        default-expand-all
        :disabled="isOptionGroupDisable"
        style="background-color: transparent;"
      >
        <template #header v-if="isAllCheck">
          <div class="check-all-tree-select-option">
            <el-checkbox v-model="checkAll" :indeterminate="indeterminate" @change="handleCheckAll">
              {{ $t("CheckSelectOption.selectAll") }}
            </el-checkbox>
          </div>
        </template>
        <template #label="{ label, value }">
          <span>{{ getLabel(label, value) }}</span>
        </template>

        <template #tag>
          <el-tag v-if="selectValue?.length > 0" class="option-select-control-tag">{{ getOptionName(selectValue[0]) }}</el-tag>
          <el-tooltip
            class="box-item"
            effect="light"
            content="Bottom Right prompts info"
            placement="bottom-end"
            append-to=".option-select-control"
            v-if="containerReady"
          >
            <el-tag v-if="selectValue?.length > 1" class="option-select-control-tag">+{{ selectValue?.length - 1 }}</el-tag>
            <template #content>
              <div style="display: flex; flex-wrap: wrap; column-gap: 8px;">
                <el-tag v-for="(item, index) in selectValue" :key="item + 'tag'" class="option-select-control-tag">{{ getOptionName(item) }}</el-tag>
              </div>
            </template>
          </el-tooltip>
        </template>
      </el-tree-select>
    </template>
    <!-- 下拉选择-常规 -->
    <template v-else>
      <div class="select-content" v-if="!isInputValue || selectChoices?.length">
        <el-select :clearable="props.option.clearable as boolean" :modelValue="selectValue" @update:modelValue="updateValue" filterable effect="light" show-checkbox :placeholder="$t('selectPlaceholder')" :no-data-text="$t('selectNone')" popper-class="option-check-select-popper" :name="option.name" multiple :disabled="isOptionGroupDisable" size="small" collapse-tags collapse-tags-tooltip
          :popper-options="{
            modifiers: [
              { name: 'offset', options: { offset: [0, 8] } },
            ],
          }">
          <template #label="{ label, value }">
            <span>{{ getLabel(label, value) }}</span>
          </template>
          <template #header v-if="isAllCheck">
            <div class="check-all-tree-select-option">
              <el-checkbox v-model="checkAll" :indeterminate="indeterminate" @change="handleCheckAll">
                {{ $t("CheckSelectOption.selectAll") }}
              </el-checkbox>
            </div>
          </template>
          <template v-for="choice in selectChoices" :key="choice.value">
            <el-option :label="choice.label" :value="choice.value" style="display: flex; align-items: center;column-gap: 4px;" :title="choice.label" v-if="isShowOption(choice)">
              <el-checkbox :modelValue="selectValue.includes(choice.value)">
                {{ choice.label }}
              </el-checkbox>
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
  
<script setup lang='ts'>
import { computed, inject, nextTick, onMounted, ref, unref } from 'vue';
import { DefinedOptionWithParsedType, SelectChoice } from '../types';
import { GET_OPTION_VALUE, IS_OPTION_GROUP_DISABLE, OPTION_ELEMENT, UPDATE_OPTION } from '../inject';
import { SHOW_DATA_CONDITION_DIALOG } from '@renderer/types';
import { isEmpty } from '@common/utils/object';
import i18next from 'i18next';

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
const isShowConditionBtn = computed(() => props.option.args?.hasOwnProperty('condition'));
const isTree = computed(() => props.option.args?.hasOwnProperty('tree'));
const isOnlyCheckLeaf = computed(() => isTree.value && props.option.args?.hasOwnProperty('onlyCheckLeaf')); // 是否只有子节点可以选择
const isAllCheck = computed(() =>  props.option.args?.hasOwnProperty('allCheck'));
const isInputValue = computed(() => props.option.args?.hasOwnProperty('inputValue'));
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);

const selectValue = computed(() => getOptionValue());

// 更新选中值
const updateValue = (value) => {
  updateOption(value);
  iniCheckState(value);
}

// 全选逻辑
const checkAll = ref(false);
const indeterminate = ref(false);
const handleCheckAll = (val) => {
  checkAll.value = val;
  if (val) {
    if (isTree) {
      // treeSelect还有子项，全部选中才是全选
      let allChoicesValue = [];
      selectChoices.value.forEach((item) => {
        allChoicesValue.push(item);
        if (item.children) {
          allChoicesValue = allChoicesValue.concat(item.children);
        }
      });
      updateValue(allChoicesValue.map((item) => item.value));
    } else {
      updateValue(selectChoices.value.map((item) => item.value));
    }
  } else {
    updateValue([]);
  }
}

const iniCheckState = (value) => {
  // treeSelect还有子项，全部选中才是全选
  let allChoicesValue = [];
  selectChoices.value.forEach((item) => {
    allChoicesValue.push(item);
    if (item.children) {
      allChoicesValue = allChoicesValue.concat(item.children);
    }
  });

  if (value?.length === 0) {
    checkAll.value = false;
    indeterminate.value = false;
  } else if (isTree && value?.length === allChoicesValue?.length) {
    checkAll.value = true;
    indeterminate.value = false;
  } else if (!isTree && value?.length === selectChoices.value?.length) {
    checkAll.value = true;
    indeterminate.value = false;
  } else {
    checkAll.value = false;
    indeterminate.value = true;
  }
}

const isValueInChoices = (choices: any[], value: string | string[]): boolean => {
  if (Array.isArray(value)) {
    return value.some(val => isValueInChoices(choices, val));
  }
  for (let node of choices) {
    if (node.value === value) {
      return true;
    }
    if (node.children?.length > 0) {
      if (isValueInChoices(node.children, value)) {
        return true;
      }
    }
  }
  return false;
};

const getLabel = (label: string, value: string | string[]) => {
  if (label !== value) {
    return label;
  } else {
    let exist = false;
    let isArray = false;
    if (Array.isArray(value)) {
      isArray = true;
      if (isEmpty(value)) {
        exist = true;
      } else {
        exist = isValueInChoices(selectChoices.value, value);
      }
    } else {
      exist = isValueInChoices(selectChoices.value, value);
    }
    if (getOptionValue() && !exist) {
      const unknownOptionText = i18next.t("selectUnknownOption");
      return isArray ? [unknownOptionText] : unknownOptionText;
    }
    return getOptionValue();
  }
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

const getOptionName = (
  value: string, 
  choices: SelectChoice[] = selectChoices.value
): string => {
  const findInChoices = (choicesList: SelectChoice[]): string | null => {
    for (const item of choicesList) {
      if (item.value === value) {
        return item.label;
      }
      
      if (item.children?.length) {
        const found = findInChoices(item.children);
        if (found) return found;
      }
    }
    return null;
  };
  
  const result = findInChoices(choices);
  return result !== null ? result : value;
};

const containerReady = ref(false)

onMounted(() => {
  containerReady.value = true;
  iniCheckState(selectValue.value)
})
</script>
  
<style scoped lang="scss">
.option-select-control {
  display: flex;
  flex-direction: column;
  width: 100%;

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


:deep(.option-select-control-tag) {
  height: 20px;
  background-color: var(--bg-color-overlay);
  color: var(--text-color-secondary);
  border: 1px solid var(--border-color);
}
</style>
<style lang="scss">
.check-all-tree-select-option {
  align-items: center;
  color: black;
  margin: -10px;
  height: 26px;
  padding: 0 10px;
  .el-checkbox {
    height: 26px;
    line-height: 26px;
    .el-checkbox__label {
      font-size: 11px;
      color: var(--color-primary);
      font-weight: 600;
    }
  }
  &:hover {
    background-color: var(--el-fill-color-light);
    cursor: var(--cursor-pointer);;
  }
}

.option-check-select-popper {
  .el-select-dropdown__header {
    height: 26px;
    line-height: 26px;
    margin-bottom: -6px;
    border-bottom: none;
  }
  .el-select-dropdown__item {
    font-size: 11px;
    padding: 0 10px;
    height: 26px;
    line-height: 26px;
    .el-checkbox {
      height: 26px;
      line-height: 26px;
      .el-checkbox__label {
        font-size: 11px;
      }
    }
  }
  .el-tree-node__expand-icon {
    display: none;
  }
  .el-select-dropdown__item.is-selected {
    color: var(--el-text-color-regular);
  }
  .el-select-dropdown__item.is-selected::after {
    display: none;
  }
  .el-tree{
    .el-tree-node__content {
      .el-checkbox {
        margin-left: 10px;
      }
    }
    .el-select-dropdown__item {
      padding: 0 1px;
    }
  }
}
</style>