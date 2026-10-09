<template>
  <el-input :modelValue="textValue" @update:modelValue="updateValue" class="option-group-control" type="textarea"
    :name="option.name" :rows="rows" />
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { computed, inject } from 'vue';
import { DefinedOptionWithParsedType } from '../types';

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const rows = computed(()=>{
  let rows = 1;
  if (props.option.args?.row) {
    rows = parseInt(props.option.args.row);
    if (isNaN(rows)) {
      rows = 1;
    }
  }
  return rows;
});

const textValue = computed(() => getOptionValue());

const updateValue = (value) => {
  updateOption(value);
}
</script>

<style lang="scss" scoped>
.option-group-control {
  :deep(.el-textarea__inner) {
    padding-left: 10px;
    padding-right: 10px;
  }
}
</style>