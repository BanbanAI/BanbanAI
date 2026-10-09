<template>
  <div class="option-group-control">
    <template v-for="(select, index) in selects" :key="index">
      <el-select :modelValue="selectValue[index]" @update:modelValue="updateValue($event, index)" filterable effect="light" :placeholder="$t('selectPlaceholder')" :no-data-text="$t('selectNone')"
        popper-class="option-group-popper" :name="option.name" size="small" collapse-tags collapse-tags-tooltip :style="{ width: selectSize[index] }"
        :popper-options="{
          modifiers: [
            { name: 'offset', options: { offset: [0, 8] } },
          ],
        }">
        <el-option v-for="choice in select" :key="choice.value" :label="choice.label || ($t('selectsOption.InvalidValue') as string)" :value="choice.value" :title="choice.label" />
      </el-select>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, OPTION_ELEMENT, UPDATE_OPTION } from "../inject";
import { inject, computed, unref } from 'vue';
import { DefinedOptionWithParsedType, Selects } from "../types";

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const element = inject(OPTION_ELEMENT);
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);


const selects = computed(() => {
  const choices = props.option.selectChoices;
  if (typeof choices === 'function') {
    return choices(unref(element)) as Selects;
  }
  return choices as Selects ?? [];
});


const selectValue = computed(() => {
  return getOptionValue() || [];
});

const selectSize = computed(() => props.option.args?.size?.split('-'));

const updateValue = (value: string, index: number) => {
  const values = unref(selectValue.value);
  values[index] = value;
  updateOption(values);
}




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
