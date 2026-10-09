<template>
  <b2-form-element v-bind="$attrs">
    <div v-if="!widget.isReadonly">
      <el-input
        v-if="widget.linkType != 'form'"
        :class="{'mobile': isMobileDevice}"
        :ref="(el) => widget.inputInstance = el"
        size="default"
        v-model="widget.inputValue"
        :placeholder="widget.placeholder"
        clearable
        @keydown.enter.prevent="handleEnter"
        @change="handleChanged">
      </el-input>
      <el-select
        :teleported="true"
        append-to="body"
        v-model="widget.inputValue"
        v-else
        :placeholder="$t('pleaseSelect')"
        clearable
        @clear="widget.inputValue = ''"
      >
        <el-option
          v-for="option in widget.tableChoices"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
    </div>
    <div
      class="value"
      :class="{'mobile': isMobileDevice}"
      v-else
      :style="{ color: widget.inputValue ? 'unset' : 'var(--text-color-inactive)' }"
    >
      <span>
        <div v-if="widget.inputValue" :title="getUrlLabel()">
          <el-link v-if="widget.openFormType === 'blank'" :href="widget.linkHref" target="_blank" type="primary" :underline="false" @click.stop>{{ getUrlLabel() }}</el-link>
          <span v-else-if="widget.linkType !== 'form'" class="dialog-link" @click="textLinkDialogVisible = true">{{ getUrlLabel() }}</span>
          <span v-else class="dialog-link" @click="dataViewDialogVisible = true">{{ getUrlLabel() }}</span>
        </div>
        <div v-else :title="$t('noContent')">
          {{ $t('noContent') }}
        </div>
      </span>
    </div>
  </b2-form-element>

  <teleport  to="body">
    <data-view-dialog
      v-model="dataViewDialogVisible"
      :nocodeId="widget.getBoard().nocodeId"
      :tableId="widget.inputValue?.split(',')[1] || ''"
      v-if="dataViewDialogVisible"
    />

    <hyperlink-dialog
      v-if="textLinkDialogVisible"
      v-model="textLinkDialogVisible"
      :url="widget.linkHref"
      :title="getUrlLabel()"
    />
  </teleport>
</template>

<script lang="ts" setup>
import i18next, { $t } from "@renderer/widgets/i18next";
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { Hyperlink } from "./hyperlink";
import { injectAutoSubmitEmitter, injectEnterPress } from "../subForm/utils";
import { ref } from "vue";

const isMobileDevice = isMobile();
const widget = useWidget<Hyperlink>();
const dataViewDialogVisible = ref(false);
const textLinkDialogVisible = ref(false);

const enterPress = injectEnterPress();
const autoSubmitEmitter = injectAutoSubmitEmitter();

const handleChanged = () => {
  widget.validate();
};

const getUrlLabel = () => {
  if(widget.linkType === 'form') {
    return widget.tableChoices.find((item) => item.value === widget.inputValue)?.label || widget.inputValue;
  }
  return widget.inputValue;
}

const handleEnter = (e: Event) => {
  const keyboardEvent = e as KeyboardEvent;
  if (keyboardEvent.isComposing || keyboardEvent.keyCode === 229) {
    return;
  }
  if (!widget.isInSubForm) {
    autoSubmitEmitter && autoSubmitEmitter({
      type: 'fieldEnter',
      fieldUid: widget.fieldId,
      value: widget.inputValue,
    });
  }
  enterPress && enterPress(widget.uid);
};
</script>

<style lang="scss" scoped>
.el-input {
  --el-input-border-radius: 4px;
}

:deep(.el-select) {
  .el-select__wrapper {
    border-radius: 4px;
    height: 32px;
  }
}

.value {
  display: flex;
  height: 32px;
  line-height: 24px;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 4px 8px;

  span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    width: 100%;
  }
}

:deep(.el-input.mobile) {
  .el-input__wrapper {
    border-radius: 4px;
    background-color: #fff;
    height: 40px;
    padding: 0 12px;
  }
}
.value.mobile {
  height: 40px;
  border-radius: 4px;
  padding: 0 12px !important;
  line-height: 40px;
}

.dialog-link {
  color: var(--color-primary);
  cursor: pointer;

  &:hover {
    color: var(--color-primary-light-3);
  }
}
</style>

