<template>
  <b2-form-element class="textarea-input">
    <template v-if="widget.isInTable && !widget.isReadonly">
      <el-popover :visible="visible" placement="bottom" :width="300">
        <template #reference>
          <div class="isInSubForm-input" @click="handleOpenDialog">{{ widget.inputValue }}</div>
        </template>
        <div class="textarea-input-isInSubForm-input-content">
          <el-input
            v-if="!widget.isReadonly"
            :class="{'is-in-subform': widget.isInSubForm}"
            v-model="widget.inputValue"
            type="textarea"
            :placeholder="widget.placeholder"
            :minlength="widget.length?.min"
            :maxlength="widget.length?.max"
            :show-word-limit="widget.wordLimit"
            :lable="widget.title"
            :autosize="autosize"
            :input-style="widget.isInSubForm ? { lineHeight: '20px', padding: '12px'} : {}"
            resize="none"
            @change="handleChanged">
          </el-input>
          <div class="dialog-buttons">
            <el-button @click="handleCancel">{{ i18next.t('cancel') }}</el-button>
            <el-button type="primary" @click="handleOk">{{ i18next.t('confirm') }}</el-button>
          </div>
        </div>
      </el-popover>
    </template>
    <template v-else>
      <el-input
        v-if="!widget.isReadonly"
        :class="{'is-in-subform': widget.isInSubForm}"
        v-model="widget.inputValue"
        type="textarea"
        :placeholder="widget.placeholder"
        :minlength="widget.length?.min"
        :maxlength="widget.length?.max"
        :show-word-limit="widget.wordLimit"
        :lable="widget.title"
        :autosize="autosize"
        :input-style="widget.isInSubForm ? { lineHeight: '20px', padding: '12px'} : {}"
        resize="none"
        @change="handleChanged">
      </el-input>
      <div
        class="value"
        :class="{'is-in-subform': widget.isInSubForm}"
        v-else
        :style="{ color: widget.inputValue ? 'unset' : 'var(--text-color-inactive)' }"
        :title="widget.inputValue || i18next.t('noContent')"
      >
        <pre>{{ widget.inputValue || i18next.t('noContent') }}</pre>
      </div>
    </template>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { TextareaInput } from "./textareaInput";
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import i18next, { $t } from "@renderer/widgets/i18next";

const widget = useWidget<TextareaInput>();
const visible = ref(false);
const originValue = ref('');

const autosize = computed(() => {
  if (widget.isInSubForm && !isMobile()) {
    return { minRows: 3, maxRows: 3 };
  }
  return { minRows: 6 };
})

function handleChanged() {
    widget.validate();
}
const handleOpenDialog = () => {
  if (widget.isReadonly) return;
  visible.value = true;
}
const handleCancel = () => {
  widget.inputValue = originValue.value;
  visible.value = false;
}
const handleOk = () => {
  visible.value = false;
}
onMounted(() => {
  if (widget.isInTable && !widget.isReadonly) {
    nextTick(() => {
      originValue.value = widget.inputValue;
      visible.value = true;
    })
  }
})
onUnmounted(() => {
  handleOk();
})
</script>

<style lang="scss" scoped>
.textarea-input {
  .isInSubForm-input {
    height: 32px;
    box-sizing: border-box;
    padding: 0px 12px;
    display: flex;
    border-radius: 4px;
    border: 1px solid var(--border-color, #dcdfe6);
    background-color: var(--color-white);
    cursor: pointer;
    overflow: hidden;
    line-height: 32px;
    // box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  }
}
.textarea-input-isInSubForm-input-content {
  .dialog-buttons {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    .el-button {
      height: 24px;
      width: fit-content;
      padding: 0px 8px;
      margin: 0px;
      font-size: 12px;
      border-radius: 4px;
    }
  }
}
:deep(.el-textarea__inner) {
  border-radius: 4px;
  // max-width: 720px;
}

:deep(.el-textarea.is-in-subform) {
  .el-textarea__inner {
    height: 100%;
    padding: 14px;
  }
}

.value {
  min-height: 32px;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 4px 8px;
  line-height: 20px;

  pre {
    width: 100%;
    white-space: pre-wrap;
    white-space: -moz-pre-wrap;
    word-wrap: break-word;
  }

  &.is-in-subform {
    height: 86px;
    overflow-y: auto;
    padding: 12px;
    box-sizing: border-box;
  }
}
</style>
