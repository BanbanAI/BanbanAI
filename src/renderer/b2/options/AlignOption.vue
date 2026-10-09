<template>
  <div class="option-group-control">
    <el-radio-group style="width: 100%;" :modelValue="selectValue" @update:modelValue="updateValue" size="small"
      :disabled="isOptionGroupDisable">
      <template v-if="!isVertical">
        <el-radio-button value="left" :title="$t('AlignOption.formatAlignLeftRounded')">
          <el-icon :size="14"><i-material-symbols-format-align-left-rounded /></el-icon>
        </el-radio-button>
        <el-radio-button value="center" :title="$t('AlignOption.formatAlignCenterRounded')">
          <el-icon :size="14"><i-material-symbols-format-align-center-rounded /></el-icon>
        </el-radio-button>
        <el-radio-button value="right" :title="$t('AlignOption.formatAlignRightRounded')">
          <el-icon :size="14"><i-material-symbols-format-align-right-rounded /></el-icon>
        </el-radio-button>
      </template>
      <template v-else>
        <el-radio-button value="start" :title="$t('AlignOption.alignStartRounded')">
          <el-icon :size="14"><i-material-symbols-align-start-rounded /></el-icon>
        </el-radio-button>
        <el-radio-button value="center" :title="$t('AlignOption.alignCenterRounded')">
          <el-icon :size="14"><i-material-symbols-align-center-rounded /></el-icon>
        </el-radio-button>
        <el-radio-button value="end" :title="$t('AlignOption.alignEndRounded')">
          <el-icon :size="14"><i-material-symbols-align-end-rounded /></el-icon>
        </el-radio-button>
      </template>
    </el-radio-group>
  </div>
</template>

<script lang="ts" setup>
import { GET_OPTION_VALUE, IS_OPTION_GROUP_DISABLE, UPDATE_OPTION } from "../inject";
import { inject, computed } from 'vue';
import { DefinedOptionWithParsedType } from "../types";

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const isOptionGroupDisable = inject(IS_OPTION_GROUP_DISABLE);
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const isVertical = computed(() => props.option.args?.hasOwnProperty('vertical'));

const selectValue = computed(() => {
  return getOptionValue();
});

const updateValue = (value) => {
  updateOption(value);
}
</script>
<style scoped lang="scss">
.option-group-control {
  display: flex;
  flex-direction: column;
  width: 100%;

  :deep(.el-radio-button) {
    --el-fill-color-blank: var(--el-bg-color-overlay);
    width: 25px;
    height: 23px;
    margin: 0 5px;

    .el-radio-button__inner {
      height: 23px;
      width: 100%;
      display: flex;
      justify-content: space-around;
      align-items: center;
      border: none;
      background: none;
      box-shadow: none;
      padding: 0;
    }

    &.is-active{
      .el-radio-button__inner{
        background-color: #484848;
        border-radius: 3px;
      }
    }
  }
}
</style>
