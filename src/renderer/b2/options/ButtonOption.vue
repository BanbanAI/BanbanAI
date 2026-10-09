<template>
  <div class="option-group-control">
    <el-button class="btn" @click="handleButtonClick" :disabled="btnLoading" :color="color" :size="size" :style="buttonStyle">{{ buttonAlias }}</el-button>
  </div>
</template>

<script lang="ts" setup>

import { ACTIVE_ELEMENT } from '@renderer/types';
import { computed, inject, ref, } from 'vue';
import { DefinedOptionWithParsedType } from '../types';
import i18next from 'i18next';

type Size = "" | "default" | "small" | "large";

const props = defineProps<{
  option: DefinedOptionWithParsedType,
  paths: string[]
}>();

const buttonText = computed(() => {
  if (typeof props.option?.buttonText === "function") {
    return props.option?.buttonText(activeElement.value, props.paths);
  }
  return props.option?.buttonText || "";
})

const buttonAlias = computed(() => props.option.args?.buttonAlias ?? buttonText.value ?? i18next.t("ButtonOption.buttonAlias"));

const buttonStyle = computed(() => {
  if (typeof props.option?.buttonStyle === "function") {
    return props.option?.buttonStyle(activeElement.value, props.paths);
  }
  return props.option?.buttonStyle || {}
})

const size = computed(() => props.option.args?.size as Size ?? "default");

const color = computed(() => props.option.args?.color ?? "");

const btnLoading = ref(false);

const activeElement = inject(ACTIVE_ELEMENT);

const handleButtonClick = async () => {
  if (props.option?.buttonClick) {
    props.option?.buttonClick?.(activeElement.value, props.paths);
  }
}

</script>

<style lang="scss" scoped>

.option-group-control {
  display: flex;
  position: relative;
  flex-direction: column;
  width: 100%;
}

</style>