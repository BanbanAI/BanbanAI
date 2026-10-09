<template>
  <div class="option-group-control">
    <el-button class="btn" @click="handleButtonClick" :color="color" :size="size" :style="buttonStyle">{{ buttonText }}</el-button>
    <teleport to="body" v-if="dialogComponent">
      <component :is="dialogComponent" :widget="activeElement" :value="getOptionValue()" v-model="dialogVisible" @update="updateOption" v-bind="componentProps" />
    </teleport>
  </div>
</template>
<script lang="ts">
export default {
  isBigContent: (args: Record<string, unknown>) => {
    return !!args?.bigButton;
  },
};
</script>
<script lang="ts" setup>

import { ACTIVE_ELEMENT } from '@renderer/types';
import { computed, inject, markRaw, ref, type PropType, shallowRef, toRaw, watch, } from 'vue';
import { GET_OPTION_VALUE, UPDATE_OPTION } from '@renderer/b2/inject';
import type { DefinedOptionWithParsedType } from '../types';
import type { FormElement } from '@renderer/b2/controllers/form';
import type { FormulaConfig } from '@common/utils/formula';
import i18next from 'i18next';

const props = defineProps({
  option: {
    type: Object as PropType<DefinedOptionWithParsedType>,
    required: true,
  },
  paths: {
    type: Array as PropType<string[]>,
    required: true,
  },
});

const activeElement = inject(ACTIVE_ELEMENT);
const updateOption = inject(UPDATE_OPTION);
const getOptionValue = inject(GET_OPTION_VALUE);
const openDefaultFormulaOverlay = inject<(payload: {
  formWidget: FormElement;
  value?: string | FormulaConfig;
  componentProps?: Record<string, unknown>;
  onConfirm: (value: FormulaConfig) => void;
}) => boolean>('nocode-editor-default-formula-overlay-host', () => false);

const dialogVisible = ref(false);
const size = computed(()=>{
  return props.option.args?.bigButton ? "default" : "small";
});
const color = computed(() => props.option.args?.color ?? "");

const dialog = computed(() => props.option?.dialog || {} as typeof props.option.dialog);
const dialogComponent = shallowRef();

watch(() => dialog.value?.component, (component) => {
  if (typeof component === "string") {
    dialogComponent.value = component;
    return;
  }
  dialogComponent.value = component ? markRaw(toRaw(component)) : undefined;
}, { immediate: true });

const buttonText = computed(() => {
  if (typeof dialog.value.buttonText === "function") {
    return dialog.value.buttonText(activeElement.value, props.paths);
  }
  return dialog.value?.buttonText || i18next.t("DialogOption.set");
})

const buttonStyle = computed(() => {
  if (typeof dialog.value.buttonStyle === "function") {
    return dialog.value.buttonStyle(activeElement.value, props.paths);
  }
  return dialog.value?.buttonStyle || {}
})

const componentProps = computed(() => {
  if (typeof dialog.value.componentProps === "function") {
    return dialog.value.componentProps(activeElement.value, props.paths);
  }
  return dialog.value?.componentProps || {}
})

type DialogComponentCandidate = {
  name?: string;
  __name?: string;
  __asyncResolved?: {
    name?: string;
    __name?: string;
  };
}

const resolveDialogComponentName = (component: unknown) => {
  if (typeof component === "string") return component;
  const candidate = component as DialogComponentCandidate | undefined;
  return candidate?.name || candidate?.__name || candidate?.__asyncResolved?.name || candidate?.__asyncResolved?.__name || "";
}

const isDefaultFormulaDialog = computed(() => {
  return props.option?.name === "default-formula" || resolveDialogComponentName(dialog.value?.component) === "FormDefaultValueFormulaDialog";
})

const handleButtonClick = async () => {
  if (isDefaultFormulaDialog.value && activeElement?.value) {
    const handled = openDefaultFormulaOverlay({
      formWidget: activeElement.value as FormElement,
      value: getOptionValue(),
      componentProps: componentProps.value,
      onConfirm: (value) => {
        updateOption?.(value);
      },
    });

    if (handled) return;
  }

  dialogVisible.value = true;
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
