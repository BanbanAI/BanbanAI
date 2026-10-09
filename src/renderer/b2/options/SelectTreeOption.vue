<template>
  <div :class="['option-group-control', { 'select-warn': borderWarnVisible }]">
    <el-tree-select :indent="10" :modelValue="selectValue" @update:modelValue="updateValue($event)" filterable
      :show-checkbox="false" :check-strictly="true" :placeholder="$t('selectPlaceholder')" popper-class="option-group-popper"
      :name="option.name" :data="selectChoices" :empty-values="['']" :empty-text="$t('treeEmpty')" :no-match-text="$t('treeEmpty')" fit-input-width
      collapse-tags collapse-tags-tooltip size="small">
    </el-tree-select>
  </div>
</template>


<script setup lang="ts">
import { GET_OPTION_VALUE, UPDATE_OPTION, OPTION_ELEMENT } from "../inject";
import { inject, computed, unref } from "vue";
import { DefinedOptionWithParsedType } from "../types";
import i18next from 'i18next';


const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();

const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);

const isValueInChoices = (choices: any[], value: string) => {
  for (const choice of choices) {
    if (choice.value === value) {
      return choice;
    }
    if (choice.children?.length > 0) { 
      const result = isValueInChoices(choice.children, value);
      if (result) return result;
    }
  }
  return false;
}

const selectValue = computed(() => {
  const currentVal = getOptionValue()?.join(",");
  const addChoices = isValueInChoices(selectChoices.value, currentVal);
  if (currentVal && !addChoices) {
    return i18next.t("selectUnknownOption");
  }
  return currentVal;
});

const updateValue = (value) => {
  let resultValue = value?.split(",");
  updateOption(resultValue);
};

const element = inject(OPTION_ELEMENT);
const selectChoices = computed(() => {
  const choices = props.option.selectChoices;
  if (typeof choices === 'function') {
    return choices(unref(element));
  }
  return choices ?? [];
});

const borderWarnVisible = computed(() => {
  return Array.isArray(selectValue.value) ? selectValue.value.includes(i18next.t("selectUnknownOption")) : selectValue.value === i18next.t("selectUnknownOption");
})
</script>
<style scoped lang="scss">
.option-group-control {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  row-gap: 5px;

  .el-select {
    width: 100%;
  }
}
</style>