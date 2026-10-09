<template>
  <div class="color-picker" v-if="pickerVisible">
    <el-dialog :model-value="pickerVisible" :modal="false" :title="$t('optionColorTitle')" @close="handleClose" draggable>
      <color-picker :color-value="colorValue" :gradient="gradient" @changed="handleColorChanged"
        ref="colorSelectorRef"></color-picker>
      <template v-if="!instantApply" #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="handlePicked">{{ $t("optionColorConfirm") }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import type { PropType } from 'vue';
import { nextTick, ref, watch } from 'vue';
import { ColorValue } from './color';

const props = defineProps({
  pickerVisible: {
    type: Boolean,
    default: false,
  },
  colorValue: {
    type: [String, Object] as PropType<string | ColorValue>,
    default: undefined,
  },
  gradient: {
    type: Boolean,
    default: false,
  },
  instantApply: {
    type: Boolean,
    default: false,
  },
  autoFocusHexInput: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(['close', 'picked', 'changed']);

const handlePickerVisible = (visible: boolean) => {
  emit('close', visible);
}

const handleColorChanged = (color: string | ColorValue) => {
  emit('changed', color);
}

const colorSelectorRef = ref();
const handleClose = function () {
  if (!props.instantApply) {
    colorSelectorRef.value?.cancel?.();
  }
  handlePickerVisible(false);
}
const handlePicked = function () {
  const color = colorSelectorRef.value.confirm();
  emit('picked', color);
  handlePickerVisible(false);
}

watch(() => props.pickerVisible, async (visible) => {
  if (!visible || !props.autoFocusHexInput) {
    return;
  }
  await nextTick();
  colorSelectorRef.value?.focusHexInput?.();
}, { immediate: true });
</script>

<style lang="scss" scoped>
.color-picker {
  :deep(.el-dialog) {
    width: 390px;
    background-color: var(--bg-color-overlay);
    border-radius: 10px;
    user-select: none;

    .el-dialog__body {
      pointer-events: all;
    }
  }
}
</style>
