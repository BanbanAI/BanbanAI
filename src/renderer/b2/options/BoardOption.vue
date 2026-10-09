<template>
  <el-select :modelValue="selectValue" @update:modelValue="updateValue($event)" filterable :placeholder="$t('selectPlaceholder')"
    class="option-group-control" popper-class="option-group-popper" :name="option.name"  :no-data-text="$t('selectNone')" fit-input-width size="small"
    collapse-tags collapse-tags-tooltip>
    <el-option :label="choice.label" :value="choice.value" :title="choice.label" v-for="choice in selectChoices" :key="choice.value" />
  </el-select>
</template>

<script setup lang="ts">
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { ALL_BOARD } from "@renderer/types";
import { inject, ref, computed } from "vue";
import { DefinedOptionWithParsedType } from "../types";
import i18next from "i18next";


const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();

const ignoreForeboard = props.option.args?.foreboard === "false" ? true : false;
const ignoreBackboard = props.option.args?.backboard === "false" ? true : false;
const allBoard = inject(ALL_BOARD);
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);

const flatten = (arr: any[]): string[] => {
  return arr.reduce((pre, next) => {
    return pre.concat(next.children?.length > 0 && flatten(next.children), next.value);
  }, []).filter(item => item !== false)
}

const selectValue = computed(() => {
  let initValue = getOptionValue();
  if (initValue) {
    let addChoices = flatten(selectChoices.value)
  
    const elementPath = initValue?.elementPath;
    if (elementPath && addChoices.indexOf(elementPath.join(",")) === -1) {
      initValue = i18next.t("unknownKanban");
    } else {
      initValue = elementPath?.join(",");
    }
  }
  return initValue;
});
const updateValue = (value) => {
  const resultValue = {
    elementPath: value?.split(","),
    __opt_type: 'element',
  };
  updateOption(resultValue);
};


const selectChoices = computed(() => {
  const selectChoices = [];
  if(!ignoreForeboard && allBoard.foreBoard){
    selectChoices.push({
      label: allBoard.foreBoard.name,
      value: allBoard.foreBoard.uid
    });
  }
  const boards = Object.values(allBoard.boards);
  for (const board of boards) {
    selectChoices.push({
      label: board.name,
      value: board.uid
    });
  }
  if(!ignoreBackboard && allBoard.backBoard){
    selectChoices.push({
      label: allBoard.backBoard.name,
      value: allBoard.backBoard.uid
    });
  }
  return selectChoices;
});
</script>

<style lang="scss" scoped>
.option-group-item {

  :deep(.el-select) {

    .el-select__inner::placeholder {
      font-size: 12px;
    }
  }

}
</style>