<!-- MobileDatePicker.vue -->
<template>
  <div class="content">
    <!-- 移动端触发器 -->
    <div class="mobile-date-picker-trigger" @click="drawerVisible = true">
      <span v-if="widget.inputValue" class="trigger-value">{{ widget.formatDateValue(widget.inputValue as string) }}</span>
      <span v-else class="trigger-placeholder">{{ widget.placeholder }}</span>
      <el-icon class="trigger-icon"><Calendar /></el-icon>
    </div>

    <!-- 抽屉组件 -->
    <el-drawer
      v-model="drawerVisible"
      :title="$t('pleaseSelectDate')"
      direction="btt"
      :with-header="true"
      :append-to-body="true"
      close-on-click-modal
      class="date-picker-mobile-drawer"
    >
      <div class="mobile-date-picker-wrapper">
        <el-config-provider :locale="locale">
          <el-date-picker-panel
            v-model="tempValue"
            :type="(widget.calendarType as DatePickerType)"
            :teleported="false"
            :border="false"
            :append-to="`#popper-${widget.uid}`"
            :date-format="widget.dateFormat + ' ' + widget.weekFormat"
            :time-format="widget.timeFormat"
            value-format="YYYY-MM-DD HH:mm:ss"
            :clearable="true"
            :empty-values="['', null, undefined, NaN]"
            :value-on-clear="''"
          />
        </el-config-provider>
      </div>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="handleClear">{{ $t('clear') }}</el-button>
          <el-button type="primary" @click="handleConfirm">{{ $t('confirm') }}</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import { Calendar } from "@element-plus/icons-vue";
import { ElDatePickerPanel, DatePickerType } from "element-plus";
import type { DatePicker } from "./datePicker";
import dayjs from 'dayjs';
import { dayjs as elDayjs } from 'element-plus';
import zhCnLocale from 'dayjs/locale/zh-cn';
import enLocale from 'dayjs/locale/en';
import { DateStyle } from "./types";
import i18next, { $t } from "@renderer/widgets/i18next";
import { elementPlusLocale as locale } from "@renderer/widgets/utils/elementPlusLocale";

const props = defineProps<{
  widget: DatePicker;
}>();

const drawerVisible = ref(false);

const tempValue = ref<Date | string | null>(null);

watch(drawerVisible, (isOpening) => {
  if (isOpening) {
    // 初始化
    tempValue.value = JSON.parse(JSON.stringify(props.widget.inputValue || null));
  }
});

// 清空按钮的逻辑
const handleClear = () => {
  props.widget.resetValue();
  tempValue.value = null;
  drawerVisible.value = false;
};

// 确定按钮的逻辑
const handleConfirm = () => {
  props.widget.inputValue = tempValue.value;
  props.widget.validate();
  drawerVisible.value = false;
};

watch(
  () => props.widget.showFormat,
  (val, oldVal) => {
    if ([DateStyle.EN_SHORT, DateStyle.EN_LONG].includes(val as DateStyle)) {
      elDayjs.locale(enLocale);
    } else {
      elDayjs.locale(zhCnLocale);
    }
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
.content {
  width: 100%;
}
.mobile-date-picker-trigger {
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 40px;
  padding: 0 12px;
  background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  cursor: pointer;

  .trigger-placeholder {
    color: var(--el-text-color-placeholder);
  }
  .trigger-value {
    color: var(--el-text-color-regular);
  }
  .trigger-icon {
    color: var(--el-text-color-secondary);
  }
}

.mobile-date-picker-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.drawer-footer {
  display: flex;
  justify-content: space-between;
  padding: 16px;
  border-top: 1px solid var(--el-border-color-light);
  .el-button {
    flex: 1;
    &:first-child {
      margin-right: 8px;
    }
    &:last-child {
      margin-left: 8px;
    }
  }
}
</style>

<style lang="scss">
// 全局样式
.date-picker-mobile-drawer {
  height: auto !important;

  .el-drawer__header {
    margin-bottom: 0;
    padding: 16px;
  }
  .el-drawer__body {
    padding: 0 !important;
    display: flex;
    flex-direction: column;
  }
  .el-drawer__footer {
    padding: 0;
    .drawer-footer {
      display: flex;
      justify-content: space-between;
      padding: 12px 16px;
      gap: 8px;
      // border-top: 1px solid var(--el-border-color-light);
      .el-button {
        flex: 1;
        height: 40px;
        border-radius: 4px;
        margin: 0;
        font-size: 14px;
      }
    }
  }

  .el-picker-panel {
    width: 100% !important;
    height: 100% !important;
    box-shadow: none !important;
    border: none !important;
    display: flex;
    flex-direction: column;

    .el-picker-panel__body-wrapper {
      flex: 1;
      .el-picker-panel__body {
        height: 100%;
        display: flex;
        flex-direction: column;

        .el-picker-panel__content {
          flex: 1;
          width: 100% !important;
          margin: 0;
          padding: 16px;
        }
      }
    }
    // 隐藏自带的按钮
    .el-picker-panel__footer {
      display: none;
    }
  }
}
</style>

