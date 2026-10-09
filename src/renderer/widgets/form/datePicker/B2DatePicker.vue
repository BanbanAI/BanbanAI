<!-- DatePicker.vue -->
<template>
  <b2-form-element>
    <!-- 编辑状态 -->
    <template v-if="!widget.isReadonly">
      <MobileDatePicker v-if="isMobileDevice" :widget="widget" />
      <PcDatePicker v-else :widget="widget" />
    </template>

    <!-- 只读状态 -->
    <div
      class="value"
      :class="{'mobile': isMobileDevice}"
      v-else
      :style="{ color: widget.inputValue ? 'unset' : 'var(--text-color-inactive)' }"
      :title="widget.formatDateValue(widget.inputValue as string) || i18next.t('noContent')"
    >
      {{ widget.formatDateValue(widget.inputValue as string) || i18next.t('noContent') }}
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { DatePicker } from "./datePicker";
import PcDatePicker from "./PcDatePicker.vue";
import MobileDatePicker from "./MobileDatePicker.vue";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const widget = useWidget<DatePicker>();

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
.value.mobile {
  height: 40px;
  border-radius: 4px;
  padding: 0 12px !important;
  line-height: 40px;
}
</style>