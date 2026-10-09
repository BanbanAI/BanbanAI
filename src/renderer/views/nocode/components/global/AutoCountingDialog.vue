<template>
  <div class="auto-counting-container">
    <el-dialog :modelValue="isVisible" @update:modelValue="emit('update:modelValue', $event)" @open="onOpen" width="560"
      :title="$t('AutoCountingDialog.countSetting')" :align-center="true" destroy-on-close :close-on-click-modal="false" ref="dialogRef">
      <div class="container">
        <el-form :model="countingRuleForm" label-width="auto" >
          <el-form-item :label="$t('AutoCountingDialog.countDigit')">
            <el-input-number v-model="countingRuleForm.digitLength" />
          </el-form-item>
          <el-form-item :label="$t('AutoCountingDialog.digitFixed')">
            <el-switch v-model="countingRuleForm.digitFixed" />
          </el-form-item>
          <el-form-item :label="$t('AutoCountingDialog.resetCycle')">
            <el-select v-model="countingRuleForm.resetCycle" >
              <el-option
                v-for="item in resetCycleOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('AutoCountingDialog.startValue')">
            <el-input type="number" v-model="countingRuleForm.startValue" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="footer">
          <el-button class="cancel" type="default" @click="dialogClosed">{{ $t('AutoCountingDialog.cancel') }}</el-button>
          <el-button class="confirm" type="primary" @click="confirm">{{ $t('AutoCountingDialog.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import { CountingRuleValue, resetCycleOptions } from "../../types";
import { deepClone } from "@common/utils/object";

const props = defineProps<{
  modelValue: boolean;
  value: CountingRuleValue;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: CountingRuleValue): void;
}>();

const isVisible = computed(() => {
  return props.modelValue;
});

const countingRuleForm = ref<CountingRuleValue>({
  digitLength: 0,
  digitFixed: false,
  resetCycle: 'none',
  startValue: 0
});

const onOpen = () => {
  if (props.value) countingRuleForm.value = deepClone(props.value);
  countingRuleForm.value.startValue = Number(countingRuleForm.value.startValue);
}

const dialogRef = ref();

const dialogClosed = () => {
  emit("update:modelValue", false);
};


const confirm = () => {
  emit("update", countingRuleForm.value);
  dialogClosed();
}

</script>

<style lang="scss" scoped>
.auto-counting-container {
  :deep(.el-dialog) {
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--color-white);
    border-radius: 4px;

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

    .el-dialog__footer {
      padding: 16px;
    }

  }
}

.container {
  padding: 24px 16px;

  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background-color: #555355;
  }

  ::-webkit-scrollbar-corner {
    background: transparent
  }
}
</style>