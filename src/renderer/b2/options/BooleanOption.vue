<template>
  <div class="option-group-control">
    <switch-button :modelValue="booleanValue" :disabled="isOptionGroupDisable" @update:modelValue="updateValue($event)" />
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, IS_OPTION_GROUP_DISABLE, UPDATE_OPTION } from "../inject";
import { computed, inject } from 'vue';
import { DefinedOptionWithParsedType } from '../types';

defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const isOptionGroupDisable = inject(IS_OPTION_GROUP_DISABLE);

const booleanValue = computed(() => getOptionValue());

const updateValue = (value) => {
  updateOption(value);
}
</script>
