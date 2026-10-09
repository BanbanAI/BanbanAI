<template>
  <el-drawer
    class="mobile-form-filter-row-height-drawer"
    :model-value="modelValue"
    direction="btt"
    :show-close="false"
    :with-header="false"
    @close="handleClose"
    append-to-body
    close-on-click-modal
    >
    <div class="container">
      <el-radio-group v-model="rowHeightRadio" @change="changeRowHeight">
        <el-radio :value="FormTableRowHeight.LARGE"
          >{{ $t("rowHeightLarge") }}</el-radio
        >
        <el-radio :value="FormTableRowHeight.MEDIUM"
          >{{ $t("rowHeightMedium") }}</el-radio
        >
        <el-radio :value="FormTableRowHeight.SMALL"
          >{{ $t("rowHeightSmall") }}</el-radio
        >
        <el-radio :value="FormTableRowHeight.AUTO"
          >{{ $t("rowHeightAuto") }}</el-radio
        >
      </el-radio-group>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { FormTableRowHeight } from "./types";
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  modelValue: boolean;
  rowHeightLevel: FormTableRowHeight;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "changeRowHeight", value: FormTableRowHeight): void;
}>();

const handleClose = () => {
  emit("update:modelValue", false);
};

const rowHeightRadio = ref(props.rowHeightLevel);
const changeRowHeight = (value) => {
  emit("changeRowHeight", value);
  emit("update:modelValue", false);
};
</script>

<style lang="scss">
.mobile-form-filter-row-height-drawer {
  height: auto !important;
  .el-drawer__header {
    display: none;
  }
  .el-drawer__body {
    padding-top: 8px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    .container {
      width: 100%;
    }

    &::-webkit-scrollbar {
      display: none;
    }
    scrollbar-width: none;
    -ms-overflow-style: none;

    .el-radio-group {
      width: 100%;
    }

    .el-radio {
      height: 40px;
      width: 100%;
      padding: 8px 0;
      margin: 0;
      font-size: 14px;
      border-bottom: 1px solid var(--border-color);
      box-sizing: content-box;
      -webkit-tap-highlight-color: transparent;
      &.is-checked .el-radio__label {
        color: inherit;
      }
    }
  }
}
</style>
