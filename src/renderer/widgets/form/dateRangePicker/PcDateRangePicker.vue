<template>
  <div class="content">
    <div class="date-picker" ref="calendarWrapRef">
      <teleport to="body">
        <div class="date-picker-container" ref="teleportDom" :id="`popper-${widget.uid}`"></div>
      </teleport>
      <el-config-provider :locale="locale">
        <el-date-picker
          ref="datePickerRef"
          class="el-date-picker-preview" :class="{'not-in-subform': widget.isInSubForm}"
          popper-class="el-date-picker-popper"
          v-model="widget.calendarRangeValue"
          :type="widget.calendarType"
          :teleported="true"
          :append-to="`#popper-${widget.uid}`"
          :start-placeholder="widget.placeholders[0]"
          :end-placeholder="widget.placeholders[1]"
          :date-format="widget.dateFormat + ' ' + widget.weekFormat"
          :time-format="widget.timeFormat"
          :format="widget.format"
          :clearable="true"
          @change="calendarSelectChangeFn"
          @clear="handleClear"
          @calendar-change="calendarChangeFn"
          :prefix-icon="!widget.isInSubForm ? Calendar : undefined"
        >
        </el-date-picker>
      </el-config-provider>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { DateRangePicker } from "./dateRangePicker";
import { ref, watch } from "vue";
import { Calendar } from "@element-plus/icons-vue";
import { usePopperContainerId } from "element-plus";
import { dayjs as elDayjs } from 'element-plus';
import zhCnLocale from 'dayjs/locale/zh-cn';
import enLocale from 'dayjs/locale/en';
import { DateStyle } from "../datePicker/types";
import { elementPlusLocale as locale } from "@renderer/widgets/utils/elementPlusLocale";

const widget = useWidget<DateRangePicker>();
const { selector } = usePopperContainerId();

const calendarWrapRef = ref<HTMLElement>();
const datePickerRef = ref();
const calendarChangeFn = (val: [Date, null | Date]) => {
  datePickerRef.value.handleOpen();
};

const handleClear = () => {
  widget.resetValue();
};
const calendarSelectChangeFn = (val) => {
  widget.calendarRangeValue = val;
  widget.validate();
};

watch(
  () => widget.showFormat,
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
  .date-picker {
    position: relative;
    width: 100%;
    :deep(.el-date-editor.el-date-picker-preview) {
      width: 100%;
      height: 32px;
      border-radius: 4px;

      .el-input__wrapper {
        width: auto;
      }

      &.not-in-subform {
        .el-range__icon {
          display: none;
        }
      }
    }
  }
}

.date-picker-container {
  :deep(.el-picker-panel__body-wrapper) {
    background-color: #fff;
  }
}
</style>

