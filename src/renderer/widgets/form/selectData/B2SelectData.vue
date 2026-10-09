<template>
  <b2-form-element>
    <el-button 
      class="select-data-button"
      :class="{
        'mobile': isMobileDevice,
        'disabled-style': isConnectionTableEmpty || widget.isEditable
      }"
      size="default"
      @click="handleClick"
      :title="widget.buttonText"
      v-bind="attrs"
      v-if="!widget.isReadonly"
    >
      <slot>
        <el-icon :size="16" :class="{'seleted': showButtonText === widget.selectedButtonText }"><i-icon-park-outline-database-success /></el-icon>
        <span class="text" :class="{'seleted': showButtonText === widget.selectedButtonText }">{{ showButtonText }}</span>
      </slot>
    </el-button>
    <div class="value" v-else :class="{'mobile': isMobileDevice, 'seleted': showButtonText === widget.selectedButtonText}">{{ showButtonText }}</div>
    <teleport to="body">
      <mobile-select-data-dialog v-if="isMobileDevice" v-model="dialogVisible" @select="widget.onFillData($event)" />
      <select-data-dialog v-else v-model="dialogVisible" @select="widget.onFillData($event)" />
    </teleport>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { computed, onBeforeUnmount, ref, useAttrs } from "vue";
import { SelectData } from "./selectData";
import SelectDataDialog from "./SelectDataDialog.vue";
import MobileSelectDataDialog from "./MobileSelectDataDialog.vue";
import IIconParkOutlineDatabaseSuccess from "~icons/icon-park-outline/database-success";
import { isEmpty } from "@common/utils/object";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

export type FieldOption = {
  label: string;
  value: string;
};
const attrs = useAttrs();
const widget: SelectData = useWidget() as any;
const dialogVisible = ref(false);

(widget as SelectData & {
  showSelectDataDialog?: () => void;
  hideSelectDataDialog?: () => void;
}).showSelectDataDialog = () => {
  _showSelectDataDialog();
};

(widget as SelectData & {
  showSelectDataDialog?: () => void;
  hideSelectDataDialog?: () => void;
}).hideSelectDataDialog = () => {
  dialogVisible.value = false;
};

onBeforeUnmount(() => {
  delete (widget as SelectData & {
    showSelectDataDialog?: () => void;
    hideSelectDataDialog?: () => void;
  }).showSelectDataDialog;
  delete (widget as SelectData & {
    showSelectDataDialog?: () => void;
    hideSelectDataDialog?: () => void;
  }).hideSelectDataDialog;
});

const showButtonText = computed(() => {
  if (isConnectionTableEmpty.value) {
    return i18next.t("unconfiguredSelectForm")
  }
  if (widget.selectedRows && !isEmpty(widget.selectedRows)) {
    return widget.selectedButtonText;
  } else {
    return widget.buttonText;
  }
})
// 是否有连接表
const isConnectionTableEmpty = computed(() => {
  return isEmpty(widget.connectionTable)
})
const _showSelectDataDialog = () => {
  if (isConnectionTableEmpty.value || widget.isEditable) {
    return;
  }
  dialogVisible.value = true;
};
const handleClick = () => {
  _showSelectDataDialog();
};
</script>

<style lang="scss" scoped>
.select-data-button {
  width: 100%;
  max-width: 100%;
  :deep(> span) {
    width: 100%;
    line-height: 1.5;
    display: flex;
    justify-content: center;
    .text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .seleted {
      color: var(--color-primary);
    }
  }
}
.select-data-button.disabled-style {
  background-color: var(--el-bg-color-overlay);
  color: var(--el-text-color-placeholder);
  border-color: var(--border-color);
}
.value {
  display: flex;
  height: 32px;
  align-items: center;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 0 8px;
  line-height: 20px;

  .seleted {
    color: var(--color-primary);
  }
}

.select-data-button.mobile {
  border-radius: 4px;
  background-color: #fff;
  height: 40px;
  padding: 0 12px;
}
.value.mobile {
  height: 40px;
  border-radius: 4px;
  padding: 0 12px !important;
  line-height: 40px;
}
</style>
