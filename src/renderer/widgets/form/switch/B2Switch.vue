<template>
  <b2-form-element>
    <el-switch v-if="!widget.isReadonly"
      v-model="widget.inputValue"
      :active-text="widget.inputValue ? widget.activeText : widget.inactiveText"
      :inline-prompt="widget.inlinePrompt"
      @change="handleChanged" />
    <div class="value" v-else :title="displayText">{{ displayText }}</div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { Switch } from "./switch";
import { computed } from "vue";
import i18next, { $t } from "@renderer/widgets/i18next";

const widget = useWidget<Switch>();
const displayText = computed(() => widget.inputValue ? widget.activeText || i18next.t('activeStateText') : widget.inactiveText || i18next.t('inactiveStateText'));

function handleChanged(val: boolean | string | number) {

}
</script>

<style lang="scss" scoped>
.value {
  display: flex;
  height: 32px;
  align-items: center;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 0 8px;
  line-height: 20px;
}
</style>
