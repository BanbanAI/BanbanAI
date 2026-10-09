<template>
  <div class="date-option">
    <el-config-provider :locale="locale">
      <el-date-picker :modelValue="dateValue" :placeholder="props.option.placeholder ?? $t('DateOption.pleaseSelect')" @update:modelValue="updateValue" :type="dateType" placement="bottom-end"></el-date-picker>
    </el-config-provider>
  </div>
</template>

<script setup lang='ts'>
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";
import { DefinedOptionWithParsedType } from "../types";
import { GET_OPTION_VALUE, UPDATE_OPTION } from "@renderer/b2/inject";
import { computed, inject, unref } from "vue";
import { DatePickerType } from "element-plus";
import { OPTION_ELEMENT } from "../inject";
import dayjs from "dayjs";

const getOptionValue = inject(GET_OPTION_VALUE);
const dateValue = computed(() => getOptionValue());
const updateOption = inject(UPDATE_OPTION);
const element = inject(OPTION_ELEMENT);
const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const dateType = computed(() => {
  const type = props.option.valueType;
  if (typeof type === 'function') {
    return type(unref(element)).replace(/range/g, '') as DatePickerType;
  }
  return (type.replace(/range/g, '') as DatePickerType) ?? 'date'
});

const updateValue = (value) => {
  if (value instanceof Date) {
    value = dayjs(value).format("YYYY-MM-DD HH:mm:ss");
  }
  updateOption(value);
}
</script>

<style lang='scss' scoped>
.date-option {
  width: 100%;
  position: relative;
  :deep(.el-input) {
    --el-date-editor-width: 186px;
    &.el-date-editor {
      width: var(--el-date-editor-width);
    }
    .el-input__inner::-webkit-input-placeholder {
      font-size: 12px !important;
      line-height: 16px !important;
    }
  }
}
</style>
