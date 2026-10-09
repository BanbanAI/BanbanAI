<template>
  <div class="formula-container" :class="{ 'is-embedded': embedded }">
    <el-dialog 
      class="form-formula-dialog" 
      :modelValue="isVisible" 
      @update:modelValue="emit('update:modelValue', $event)" 
      :title="$t('FormDefaultValueFormulaDialog.title')" 
      :align-center="true" 
      width="1008"
      destroy-on-close 
      :close-on-click-modal="false"
      :draggable="!embedded"
      :modal="!embedded"
      :append-to-body="false"
      :lock-scroll="!embedded"
      :show-close="!embedded"
    >
      <form-default-value-formula-panel
        ref="formulaPanel"
        :formWidget="widget"
        :value="value"
        :isLimitSubform="isLimitSubform"
        :includeSelf="includeSelf"
      ></form-default-value-formula-panel>
      <template #footer>
        <div class="footer">
          <el-button class="cancel" type="default" @click="dialogClosed">{{ $t('FormDefaultValueFormulaDialog.cancel') }}</el-button>
          <el-button class="confirm" type="primary" @click="confirm">{{ $t('FormDefaultValueFormulaDialog.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import FormDefaultValueFormulaPanel from "./FormDefaultValueFormulaPanel.vue";
import type { FormElement } from "@renderer/b2/controllers/form";
import type { FormulaConfig } from "@common/utils/formula";

const props = withDefaults(defineProps<{
  modelValue: boolean;
  widget?: FormElement;
  value?: string | FormulaConfig;
  isLimitSubform?: boolean;
  includeSelf?: boolean;
  embedded?: boolean;
}>(), {
  isLimitSubform: false,
  includeSelf: false,
  embedded: false,
});

const emit = defineEmits(["update:modelValue", "update"]);

const formulaPanel = ref();

const isVisible = computed(() => {
  return props.modelValue;
})

const dialogClosed = () => {
  formulaPanel.value?.clear?.();
  emit("update:modelValue", false);
};

const confirm = () => {
  emit("update", formulaPanel.value?.getValue?.());
  dialogClosed();
}

defineExpose({
  clear: () => formulaPanel.value?.clear?.(),
  getValue: () => formulaPanel.value?.getValue?.(),
  setAiFormulaDraft: (value: unknown) => formulaPanel.value?.setAiFormulaDraft?.(value),
  getAiTaskContext: () => formulaPanel.value?.getAiTaskContext?.(),
  getAiSettingTargetContext: () => formulaPanel.value?.getAiSettingTargetContext?.(),
  getAiContext: () => formulaPanel.value?.getAiContext?.(),
});
</script>

<style lang="scss" scoped>
.formula-container {
  :deep(.el-dialog) {
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--color-white);
    border-radius: 4px;
    max-height: 90vh;

    .el-dialog__header {
      height: 40px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;

      span {
        font-size: 14px;
      }
    }

    .el-dialog__body {
      padding: 16px;
      height: 586px;
      box-sizing: border-box;
    }

    .el-dialog__footer {
      padding: 8px 16px 16px;

      .el-button {
        border-radius: 4px;
        height: 32px;
      }
    }
  }

  &.is-embedded {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background-color: var(--el-overlay-color-lighter);

    :deep(.el-modal-dialog) {
      position: absolute !important;
      inset: 0 !important;
      top: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      left: 0 !important;
      z-index: auto !important;
    }

    :deep(.el-overlay) {
      position: absolute;
      background-color: transparent;
    }

    :deep(.el-overlay-dialog) {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    :deep(.el-dialog) {
      margin: 0;
    }
  }
}
</style>
