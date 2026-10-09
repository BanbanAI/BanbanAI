<template>
  <div class="content">
    <div class="date-picker" ref="calendarWrapRef">
      <teleport to="body">
        <div class="date-picker-container" ref="teleportDom" :id="`popper-${widget.uid}`"></div>
      </teleport>
      <el-config-provider :locale="locale">
        <el-date-picker
          ref="datePickerRef"
          class="el-date-picker-preview"
          popper-class="poper-dialog"
          v-model="widget.inputValue"
          :type="widget.calendarType"
          :teleported="true"
          :append-to="`#popper-${widget.uid}`"
          :placeholder="widget.placeholder"
          :date-format="widget.dateFormat + ' ' + widget.weekFormat"
          :time-format="widget.timeFormat"
          :format="widget.format"
          :empty-values="['', null, undefined, NaN]"
          :value-on-clear="''"
          value-format="YYYY-MM-DD HH:mm:ss"
          :clearable="true"
          @change="calendarSelectChangeFn"
          @clear="handleClear"
          @calendar-change="calendarChangeFn"
          :prefix-icon="widget.isInSubForm ? IVenIconDate : Calendar"
        ></el-date-picker>
      </el-config-provider>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { DatePicker } from "./datePicker";
import { ref, watch } from "vue";
import { Calendar } from "@element-plus/icons-vue";
import { usePopperContainerId } from "element-plus";
import IVenIconDate from '~icons/ven-icon/widget-form-date-picker-date';
import { dayjs as elDayjs } from 'element-plus';
import zhCnLocale from 'dayjs/locale/zh-cn';
import enLocale from 'dayjs/locale/en';
import { DateStyle } from "./types";
import { elementPlusLocale as locale } from "@renderer/widgets/utils/elementPlusLocale";

const widget = useWidget<DatePicker>();
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
  widget.inputValue = val;
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
      .el-input__wrapper {
        width: auto;
        border-radius: 4px;
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

