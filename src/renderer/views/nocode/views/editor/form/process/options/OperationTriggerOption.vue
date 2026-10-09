<template>
  <el-form class="operation-trigger-option" :model="options" :rules="rules" ref="formRef" label-position="top">
    <option-item :title="$t('OperationTriggerOption.nodeName')">
      <el-form-item prop="name">
        <el-input v-model="options.name" :placeholder="$t('OperationTriggerOption.nodeNamePlaceholder')" />
      </el-form-item>
    </option-item>

    <option-item hideTitle>
      <div class="trigger-mode-header">
        <span class="required-mark">*</span>
        <span>{{ $t("OperationTriggerOption.triggerMode") }}</span>
      </div>
      <el-form-item class="trigger-mode-form-item">
        <el-radio-group v-model="triggerMode" class="trigger-mode-group">
          <el-radio :value="OperationTriggerMode.EACH_RECORD">{{ $t("OperationTriggerOption.eachRecord") }}</el-radio>
          <el-radio :value="OperationTriggerMode.VIEW_CONTEXT_ONCE">{{ $t("OperationTriggerOption.viewContextOnce") }}</el-radio>
        </el-radio-group>
      </el-form-item>
      <div class="tip">
        {{ $t("OperationTriggerOption.triggerModeTip") }}
      </div>
    </option-item>
    <option-item hideTitle>
      <cross-table-execution-mode-option :options="props.options" />
      <el-checkbox v-model="props.options.allowCancel" :label="$t('NodeOptionDrawer.allowCancel')" />
    </option-item>
  </el-form>
</template>

<script lang="ts" setup>
import { OperationTriggerMode, OperationTriggerNodeOptions, ProcessFlowOptions, getOperationTriggerMode } from "@common/types/project";
import { FormInstance, FormRules } from "element-plus";
import { computed, reactive, ref } from "vue";
import i18next from "i18next";
import { ProcessNode } from "../process";

const props = defineProps<{
  node: ProcessNode,
  options: ProcessFlowOptions & OperationTriggerNodeOptions,
}>();

const formRef = ref<FormInstance>();
const rules = reactive<FormRules<ProcessFlowOptions & OperationTriggerNodeOptions>>({
  name: [
    {
      validator: (rule, value, callback) => value
        ? callback()
        : callback(new Error(i18next.t("OperationTriggerOption.nodeNameRequired"))),
      trigger: "blur",
    },
  ],
});

const triggerMode = computed({
  get() {
    return getOperationTriggerMode(props.options);
  },
  set(value: OperationTriggerMode) {
    props.options.triggerMode = value;
    props.options.allowViewContextOnce = value === OperationTriggerMode.VIEW_CONTEXT_ONCE;
  },
});

const save = async () => {
  return new Promise<boolean>((resolve) => {
    formRef.value?.validate((valid) => {
      resolve(!!valid);
    });
  });
};

defineExpose({
  save,
});
</script>

<style lang="scss" scoped>
.operation-trigger-option {
  padding: 12px;

  .option-item:not(:first-of-type) {
    margin-top: 16px;
  }

  .trigger-mode-header {
    display: flex;
    align-items: center;
    gap: 4px;
    line-height: 20px;
    font-size: 14px;
    .required-mark {
      color: var(--el-color-danger);
    }
  }


  :deep(.el-form-item) {
    margin-bottom: 0;
  }

  :deep(.el-input) {
    .el-input__wrapper {
      box-shadow: none;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
    }
  }

  .trigger-mode-form-item {
    margin-bottom: 0;
  }

  :deep(.trigger-mode-group) {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;

    .el-radio {
      margin-right: 0;
    }

    .el-radio__label {
      padding-left: 8px;
      font-size: 14px;
    }
  }

  .tip {
    color: var(--text-color-secondary);
    font-size: 12px;
  }
}
</style>
