<template>
  <div class="mapping-container">
    <div class="mapping-item" v-for="mappingItem in mappingList">
      <div class="mapping-key">{{ mappingItem.label }}</div>
      <div class="mapping-input">
        <el-input :modelValue="mappingItem.value" @update:modelValue="(val) => updateMappingOption(mappingItem.key, val)" type="text"
          size="small">
        </el-input>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="">
import { OPTION_ELEMENT, GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { ref, computed, watch, unref, inject } from "vue";
import { DefinedOptionWithParsedType, SelectChoice } from "../types";

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();

const element = inject(OPTION_ELEMENT);

const keyList = computed<SelectChoice[]>(() => {
  const keys = props.option.keys;
  let list: SelectChoice[];
  let keyList: string[] | SelectChoice[];
  if (typeof keys === 'function') {
    keyList = keys(unref(element));
  } else {
    keyList = keys;
  }
  if (keyList) {
    list = keyList.map((item: string | SelectChoice) => {
      if (typeof item === 'string') {
        return {
          value: item,
          label: item
        };
      } else {
        return item;
      }
    });
  }
  return list ?? [];
});

const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);

const mappingList = ref<{ key: string, label: string, value: string }[]>([]);
watch(() => getOptionValue(), (value) => {
  mappingList.value = [];
  if (typeof value !== 'object') {
    keyList.value.forEach((item) => {
      mappingList.value.push({ key: item.value as string, label: item.label,  value: '' });
    })
  } else {
    keyList.value.forEach((item) => {
      if (value.hasOwnProperty(item.value)) {
        mappingList.value.push({ key: item.value as string, label: item.label, value: value[item.value] })
      } else {
        mappingList.value.push({ key: item.value as string, label: item.label, value: '' });
      }
    })
  }
}, { immediate: true, deep: true });
const updateMappingOption = (key: string, value: string) => {
  const mappingValue = {};
  mappingList.value.forEach(item => {
    if (item.key === key) {
      mappingValue[item.key] = value;
    } else {
      mappingValue[item.key] = item.value;
    }
  })
  updateOption(mappingValue);
}
</script>
<style lang="scss" scoped>
.mapping-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5px;

  .mapping-item {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
  }
}
</style>