<template>
  <div class="time-picker" :class="{'is-in-subform': widget.isInSubForm}" ref="timePickerWrapRef">
    <teleport to="body">
      <div
        class="time-picker-container"
        :class="{ 'is-in-subform': widget.isInSubForm }"
        ref="teleportDom"
        :id="`popper-${widget.uid}`"
        :style="{
          '--max-width-subform': widget.isInSubForm ? `${widget.widthSubform}px` : '200px'
        }"
      ></div>
    </teleport>

    <el-config-provider :locale="locale">
      <el-time-picker
        ref="timePickerRef"
        class="el-time-picker-preview"
        popper-class="poper-dialog"
        v-model="widget.timeValue"
        :teleported="true"
        :append-to="`#popper-${widget.uid}`"
        :placeholder="widget.placeholder"
        :format="widget.format"
        :value-format="widget.format"
        :clearable="true"
        @change="handleChange"
        />
        <!-- :disabled-minutes="getDisabledMinutes" -->
        <!-- @visible-change="handleVisibleChange" -->
    </el-config-provider>
  </div>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TimePicker } from "./timePicker";
import { ref, computed, watch } from "vue";
import { usePopperContainerId } from "element-plus";
import { elementPlusLocale as locale } from "@renderer/widgets/utils/elementPlusLocale";

const widget = useWidget<TimePicker>();
const { selector } = usePopperContainerId();

const timePickerWrapRef = ref<HTMLElement>();
const timePickerRef = ref();

const handleChange = (val: any) => {
  widget.timeValue = val;
  widget.validate();
};

// const handleVisibleChange = () => {
//   hiddenMinuteByStep();
// }

// // 禁用的分钟 (步长)
// const getDisabledMinutes = () => {
//   const step = widget.timeStep;
//   if (!step || step === 1) return [];

//   const result: number[] = [];
//   for (let i = 0; i < 60; i++) {
//     if (i % step !== 0) {
//       result.push(i);
//     }
//   }
//   return result;
// };

// // 根据步长禁用分钟
// const hiddenMinuteByStep = () => {
//   if (!timePickerRef.value) return [];
//   const popperId = `popper-${widget.uid}`;
//   const popperContainer = document.getElementById(popperId);
//   if (!popperContainer) return;
//   const minuteBox = popperContainer.querySelector(".el-time-spinner__wrapper:nth-child(2) .el-time-spinner__list");
//   if (!minuteBox) return [];
//   Array.from(minuteBox.children).forEach((child: HTMLElement) => {
//     child.classList.remove("hidden");
//   })
//   getDisabledMinutes().forEach((minute: number) => {
//     const minuteDom = minuteBox.children[minute];
//     if (minuteDom) {
//       minuteDom.classList.add("hidden");
//     }
//   });
// }
</script>

<style lang="scss" scoped>
.time-picker {
  position: relative;
  width: 100%;
  font-size: 14px;

  :deep(.el-date-editor.el-time-picker-preview) {
    width: 100%;
    height: 32px;
    .el-input__wrapper {
      width: auto;
      border-radius: 4px;
    }
  }
}

.time-picker-container {
  :deep(.el-picker__popper) {
    width: 360px;

    .el-time-panel {
      width: 100%;
      background-color: var(--color-white);
    }

    .el-time-spinner__item {
      font-size: 14px;
    }
    .el-time-spinner__item.hidden {
      height: 0;
      opacity: 0;
      pointer-events: none;
      cursor: default;
    }

    .el-time-panel__btn {
      font-size: 14px;
    }

    .el-picker-panel__body-wrapper {
      background-color: var(--color-white);
    }
  }

  &.is-in-subform {
    :deep(.el-picker__popper) {
      width: 360px;
      max-width: var(--max-width-subform);
    }
  }
}
</style>

