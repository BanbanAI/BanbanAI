<template>
  <div class="cross-table-execution-mode-option">
    <div class="setting-label">{{ $t('NodeOptionDrawer.crossTableExecutionMode') }}</div>
    <el-radio-group v-model="mode">
      <el-radio :value="CrossTableExecutionMode.IMMEDIATE">
        {{ $t('NodeOptionDrawer.crossTableImmediate') }}
      </el-radio>
      <el-radio :value="CrossTableExecutionMode.POST_FINISH">
        {{ $t('NodeOptionDrawer.crossTablePostFinish') }}
      </el-radio>
    </el-radio-group>
    <div class="tip">
      {{ mode === CrossTableExecutionMode.IMMEDIATE
        ? $t('NodeOptionDrawer.crossTableImmediateTip')
        : $t('NodeOptionDrawer.crossTablePostFinishTip') }}
    </div>
    <template v-if="props.showWaitOption && mode === CrossTableExecutionMode.IMMEDIATE">
      <div class="setting-label wait-label">{{ $t('NodeOptionDrawer.waitCrossTableFlowCompletion') }}</div>
      <el-radio-group v-model="waitFlowCompletion">
        <el-radio :value="true">{{ $t('NodeOptionDrawer.yes') }}</el-radio>
        <el-radio :value="false">{{ $t('NodeOptionDrawer.no') }}</el-radio>
      </el-radio-group>
      <div class="tip">{{ $t('NodeOptionDrawer.waitCrossTableFlowCompletionTip') }}</div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { CrossTableExecutionMode, ProcessFlowOptions, getCrossTableExecutionMode } from '@common/types/project';

const props = withDefaults(defineProps<{
  options: ProcessFlowOptions,
  showWaitOption?: boolean,
}>(), {
  showWaitOption: false,
});

const mode = computed({
  get: () => getCrossTableExecutionMode(props.options),
  set: (value: CrossTableExecutionMode) => {
    props.options.crossTableExecutionMode = value;
  },
});

const waitFlowCompletion = computed({
  get: () => props.options.waitCrossTableFlowCompletion === true,
  set: (value: boolean) => {
    props.options.waitCrossTableFlowCompletion = value;
  },
});

</script>

<style lang="scss" scoped>
.cross-table-execution-mode-option {
  .setting-label {
    margin-bottom: 8px;
    font-size: 14px;
    line-height: 20px;
  }

  .el-radio-group {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
  }

  .tip {
    color: var(--text-color-secondary);
    font-size: 12px;
    line-height: 18px;
  }

  .wait-label {
    margin-top: 12px;
  }
}
</style>
