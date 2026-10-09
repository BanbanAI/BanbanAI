<!-- DateRangePicker.vue -->
<template>
  <b2-form-element>
    <!-- 编辑状态 -->
    <template v-if="!widget.isReadonly">
      <MobileDateRangePicker v-if="isMobileDevice" :widget="widget" />
      <PcDateRangePicker v-else :widget="widget" />
    </template>

    <!-- 只读状态 -->
    <div
      class="value"
      :class="{'mobile': isMobileDevice}"
      v-else
      :style="{ color: widget.renderValue.filter(item => item).length != 0 ? 'unset' : 'var(--text-color-inactive)' }"
      :title="widget.renderValue.filter(item => item).length != 0 ? widget.renderValue?.join(' - ') : i18next.t('noContent')"
    >
      {{ widget.renderValue.filter(item => item).length != 0 ? widget.renderValue?.join(' - ') : i18next.t('noContent')}}
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { DateRangePicker } from "./dateRangePicker";
import PcDateRangePicker from "./PcDateRangePicker.vue";
import MobileDateRangePicker from "./MobileDateRangePicker.vue";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const widget = useWidget<DateRangePicker>();

</script>

<style lang="scss" scoped>
.value {
  display: flex;
  min-height: 32px;
  align-items: center;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 0 8px;
  line-height: 20px;
}
.value.mobile {
  min-height: 40px;
  border-radius: 4px;
  padding: 0 12px !important;
  line-height: 40px;
}
</style>