<template>
  <div class="recharge-date-range-picker">
    <div class="quick-range-list">
      <button
        v-for="item in quickRangeOptions"
        :key="item.value"
        type="button"
        class="quick-range-button"
        :class="{ active: activeQuickRange === item.value }"
        @click="handleQuickRangeSelect(item.value)"
      >
        {{ item.label }}
      </button>
    </div>
    <el-config-provider :locale="elementPlusLocale">
      <el-date-picker
        :model-value="modelValue"
        type="daterange"
        class="date-range-picker-input"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        range-separator="~"
        :start-placeholder="$t('RechargeDateRangePicker.startDate')"
        :end-placeholder="$t('RechargeDateRangePicker.endDate')"
        :clearable="true"
        :editable="false"
        placement="bottom-end"
        popper-class="recharge-date-range-picker-popper"
        :disabled-date="disabledDate"
        @update:model-value="handleChange"
      ></el-date-picker>
    </el-config-provider>
  </div>
</template>

<script setup lang="ts">
import { dayjs } from "element-plus";
import { computed } from "vue";
import i18next from "i18next";
import { elementPlusLocale } from "@renderer/utils/elementPlusLocale";

type DateRangeValue = [string, string] | null;

const props = defineProps<{
  modelValue: DateRangeValue;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: DateRangeValue): void;
}>();

const minSelectableDate = dayjs().subtract(3, "month").startOf("month");
const quickRangeOptions = [
  { get label() { return i18next.t("RechargeDateRangePicker.days3") }, value: 3 },
  { get label() { return i18next.t("RechargeDateRangePicker.days7") }, value: 7 },
  { get label() { return i18next.t("RechargeDateRangePicker.days30") }, value: 30 },
];

const createRecentRange = (days: number): [string, string] => {
  return [
    dayjs().subtract(days - 1, "day").format("YYYY-MM-DD"),
    dayjs().format("YYYY-MM-DD"),
  ];
};

const disabledDate = (date: Date) => {
  const currentDate = dayjs(date);
  return currentDate.isBefore(minSelectableDate, "day");
};

const activeQuickRange = computed(() => {
  if (!props.modelValue?.[0] || !props.modelValue?.[1]) {
    return 0;
  }

  const [startDate, endDate] = props.modelValue;
  return quickRangeOptions.find((item) => {
    const [expectedStartDate, expectedEndDate] = createRecentRange(item.value);
    return startDate === expectedStartDate && endDate === expectedEndDate;
  })?.value || 0;
});

const handleChange = (value: string[] | null) => {
  if (!value || value.length !== 2) {
    emit("update:modelValue", null);
    return;
  }

  emit("update:modelValue", [value[0], value[1]]);
};

const handleQuickRangeSelect = (days: number) => {
  emit("update:modelValue", createRecentRange(days));
};
</script>

<style scoped lang="scss">
.recharge-date-range-picker {
  display: flex;
  align-items: center;
  gap: 12px;

  .quick-range-list {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    height: 28px;
    gap: 3px;
    border-radius: 4px;
    padding: 0 3px;
    background-color: #F2F3F5;
  }

  .quick-range-button {
    min-width: 28px;
    height: 22px;
    padding: 0 8px;
    border: 0;
    border-radius: 2px;
    color: #4e5969;
    background-color: transparent;
    font-size: 14px;
    line-height: 22px;
    cursor: var(--cursor-pointer);
    transition: color 0.2s ease, background-color 0.2s ease;

    &:hover {
      color: #0873FF;
      background: #fff;
    }

    &.active {
      color: #0873FF;
      background: #fff;
    }
  }

  :deep(.date-range-picker-input.el-date-editor.el-input__wrapper) {
    width: 240px;
    min-height: 32px;
    padding: 0 11px;
    background: #f2f3f5;
    box-shadow: none;
    border-radius: 4px;

    .el-range__icon {
      display: none;
    }

    .el-range-separator {
      flex: initial;
    }

    &:hover {
      box-shadow: 0 0 0 1px #c9cdd4 inset;
    }

    &.is-active {
      box-shadow: 0 0 0 1px var(--color-primary) inset;
      background: #ffffff;
    }
  }

  :deep(.date-range-picker-input .el-range-separator),
  :deep(.date-range-picker-input .el-range-input),
  :deep(.date-range-picker-input .el-input__icon) {
    color: #4e5969;
    font-size: 14px;
  }
}
</style>

<style lang="scss">
.recharge-date-range-picker-popper {
  width: 560px;
  padding: 0 !important;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  box-sizing: border-box;
  box-shadow: 0 8px 24px rgba(29, 33, 41, 0.12);
  overflow: hidden;
  background: #ffffff;

  .el-date-range-picker,
  .el-date-range-picker.has-sidebar {
    width: 100%;
    box-sizing: border-box;
    background: #ffffff;
  }

  .el-popper__arrow {
    display: none;
  }

  .el-picker-panel__body-wrapper {
    display: flex;
    align-items: stretch;
  }

  .el-picker-panel__sidebar {
    display: none;
  }

  .el-picker-panel__shortcut {
    display: none;
  }

  .el-picker-panel__body {
    display: flex;
    min-width: 0 !important;
    width: 100%;
    box-sizing: border-box;
    margin-left: 0;
    background: #fff;
  }

  .el-date-range-picker__content {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
    padding: 14px 12px 12px;
    box-sizing: border-box;
  }

  .el-date-range-picker__content.is-left {
    border-right: 1px solid #f2f3f5;
  }

  .el-date-range-picker__header {
    height: 32px;
    margin-bottom: 8px;
    line-height: 32px;
  }

  .el-date-range-picker__header div {
    margin: 0 36px;
    color: #1d2129;
    font-size: 14px;
    font-weight: 500;
  }

  .el-picker-panel__icon-btn {
    margin-top: 9px;
    padding: 0 4px;
    color: #4e5969;
  }

  .el-date-table th {
    height: 32px;
    padding: 0;
    border-bottom: 0;
    color: #86909c;
    font-size: 13px;
    font-weight: 400;
  }

  .el-date-table td {
    height: 36px;
    padding: 2px 0;
  }

  .el-date-table td .el-date-table-cell {
    height: 32px;
  }

  .el-date-table td .el-date-table-cell__text {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    color: #1d2129;
    line-height: 26px;
    font-size: 14px;
  }

  .el-date-table td.today .el-date-table-cell__text {
    color: var(--color-primary);
    font-weight: 500;
  }

  .el-date-table td.in-range .el-date-table-cell {
    background: rgba(22, 93, 255, 0.08);
  }

  .el-date-table td.start-date .el-date-table-cell__text,
  .el-date-table td.end-date .el-date-table-cell__text {
    color: #ffffff;
    background: var(--color-primary);
  }

  .el-date-table td.available:hover {
    color: var(--color-primary);
  }

  .el-date-table td.available:hover .el-date-table-cell__text {
    background: rgba(22, 93, 255, 0.2);
  }
}
</style>
