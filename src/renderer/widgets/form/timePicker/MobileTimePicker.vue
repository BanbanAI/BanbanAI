<template>
  <div class="mobile-time-picker">
    <div class="trigger-input" @click="handleOpenPicker">
      <div v-if="widget.timeValue" class="value">{{ widget.timeValue }}</div>
      <div v-else class="placeholder">{{ widget.placeholder || $t('plsSelectTime') }}</div>
    </div>

    <teleport to="body">
      <el-drawer
        v-model="visible"
        direction="btt"
        :with-header="false"
        :size="'auto'"
        destroy-on-close
        class="mobile-time-picker-drawer"
      >
        <van-time-picker
          v-model="pickerValue"
          :title="widget.placeholder || $t('selectTime')"
          :columns-type="columnsType"
          @confirm="handleConfirm"
          @cancel="visible = false"
        />
          <!-- :filter="filter" -->
      </el-drawer>
    </teleport>
  </div>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TimePicker } from "./timePicker";
import { ref, computed } from "vue";
import { TimePicker as vanTimePicker } from "vant";
import "vant/lib/index.css";
import "vant/lib/time-picker/style";
import i18next, { $t } from "@renderer/widgets/i18next";

const widget = useWidget<TimePicker>();
const visible = ref(false);
const pickerValue = ref<string[]>([]);

const columnsType = computed(() => {
  const format = widget.format || 'HH:mm';
  if (format.includes('ss')) {
    return ['hour', 'minute', 'second'];
  }
  return ['hour', 'minute'];
});

const handleOpenPicker = () => {
  if (widget.timeValue) {
    pickerValue.value = widget.timeValue.split(':');
  } else {
    // 默认选中当前时间
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    if (columnsType.value.length === 3) {
      pickerValue.value = [h, m, s];
    } else {
      pickerValue.value = [h, m];
    }
  }
  visible.value = true;
};

const handleConfirm = ({ selectedValues }: { selectedValues: string[] }) => {
  widget.timeValue = selectedValues.join(':');
  widget.validate();
  visible.value = false;
};

// // 步长
// const filter = (type: string, options: any[]) => {
//   if (type === 'minute') {
//     const step = widget.timeStep || 1;
//     if (step > 1) {
//       return options.filter((option) => Number(option.value) % step === 0);
//     }
//   }
//   return options;
// };
</script>

<style lang="scss" scoped>
.mobile-time-picker {
  width: 100%;
}

.trigger-input {
  display: flex;
  align-items: center;
  width: 100%;
  height: 40px;
  padding: 0 12px;
  background-color: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;

  &:active {
    border-color: var(--color-primary, #409eff);
  }

  .value {
    color: #303133;
  }

  .placeholder {
    color: #a8abb2;
  }
}
</style>

<style lang="scss">
.mobile-time-picker-drawer {
  .el-drawer__body {
    padding: 0;
  }
}
</style>
