<template>
  <div class="time-option">
    <el-config-provider :locale="locale">
      <el-time-picker
        :modelValue="timeValue"
        :placeholder="props.option.placeholder ?? $t('DateOption.pleaseSelect')"
        @update:modelValue="updateValue"
        :value-format="'HH:mm:ss'"
        :format="'HH:mm:ss'"
        placement="bottom-end"
      />
    </el-config-provider>
  </div>
</template>

<script setup lang='ts'>
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";
import { DefinedOptionWithParsedType } from "../types";
import { GET_OPTION_VALUE, UPDATE_OPTION } from "@renderer/b2/inject";
import { computed, inject, unref } from "vue";
import { OPTION_ELEMENT } from "../inject";

const getOptionValue = inject(GET_OPTION_VALUE);
const timeValue = computed(() => getOptionValue());
const updateOption = inject(UPDATE_OPTION);
const element = inject(OPTION_ELEMENT);
const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();

const updateValue = (value) => {
  updateOption(value);
}
</script>

<style lang='scss' scoped>
.time-option {
  width: 100%;
  position: relative;
  :deep(.el-input) {
    --el-time-editor-width: 186px;
    width: var(--el-time-editor-width);
    &.el-time-editor {
      width: var(--el-time-editor-width);
    }
    .el-input__inner::-webkit-input-placeholder {
      font-size: 12px !important;
      line-height: 16px !important;
    }
  }
}
</style>
