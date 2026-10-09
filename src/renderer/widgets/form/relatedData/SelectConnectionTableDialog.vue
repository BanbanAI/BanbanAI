<template>
  <div class="select-connection-table-dialog">
    <el-dialog
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      :close-on-press-escape="false"
      :title="$t('dialogTitle')"
      width="35%"
      :close-on-click-modal="false"
      align-center
      class="table-dialog"
      draggable
    >
      <span class="title">{{ $t('dialogSubtitle') }}</span>
      <el-tree-select
        node-key="value"
        :default-expanded-keys="defaultExpandedKeys"
        :teleported="true"
        append-to=".select-connection-table-dialog"
        v-model="selectedTable"
        :data="widget.tableChoices"
        :render-after-expand="false"
        :placeholder="$t('selectFormPlaceholder')"
        filterable
      />
      <template #footer>
        <span class="dialog-footer">
          <el-button class="cancel-button" type="primary" @click="handleCancel">
            {{ $t('cancel') }}
          </el-button>
          <el-button class="confirm-button" type="primary" @click="handleConfirm">
            {{ $t('confirm') }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { computed, ref } from 'vue';
import { useWidget } from '@renderer/b2/types';
import { RelatedData } from './relatedData';
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  modelValue: boolean
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
}>();

const widget = useWidget<RelatedData>();
const defaultExpandedKeys = computed(() => {
  const firstGroup = widget.tableChoices.find(item => item?.children?.length);
  return firstGroup ? [firstGroup.value] : [];
});

const selectedTable = ref(null);
const handleConfirm = () => {
  widget.setConnectionTable(selectedTable.value);
  emit('update:modelValue', false);
}

const handleCancel = () => {
  emit('update:modelValue', false);
}
</script>

<style lang='scss' scoped>

:deep(.table-dialog) {
  height: 360px;
  border-radius: 4px;
  background-color: var(--color-white);
  padding: 0px;
  display: flex;
  flex-direction: column;

  .el-dialog__header {
    border-bottom: 1px solid var(--border-color);
    padding: 10px;

    span {
      display: flex;
      width: 100%;
      justify-content: center;
      font-family: Noto Sans SC;
      font-weight: 400;
      font-style: Regular;
      font-size: 14px;
      color: var(--text-color-primary);
    }
  }

  .el-dialog__body {
    flex: 1;
    padding: 24px;

    span {
      font-family: Noto Sans SC;
      font-weight: 400;
      font-style: Regular;
      font-size: 14px;
      color: var(--text-color-primary);
      transition: all 0.2s ease;
    }

    .el-select__placeholder.is-transparent {
      span {
        color: var(--text-color-placeholder);
      }
    }

    .el-select {
      margin-top: 8px;

      .el-select__wrapper {
        height: 32px;
        border-radius: 4px;
        background-color: var(--bg-color-overlay);
      }
    }
  }

  .el-dialog__footer {
    border-top: 1px solid var(--border-color);
    padding: 24px;

    .confirm-button {
      width: 60px;
      height: 32px;
      background-color: var(--color-primary);
      border-radius: 4px;
      border: 1px solid var(--color-primary);
      transition: all 0.3s ease;

      &:hover {
        background-color: var(--color-primary-light-3);
        border: 1px solid var(--color-primary-light-3);
      }
    }

    .cancel-button {
      width: 60px;
      height: 32px;
      background-color: var(--color-white);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-color-primary);
      transition: background-color 0.3s ease;

      &:hover {
        background-color: var(--bg-color-overlay);
      }
    }

  }
}

:deep(.el-popper__arrow) {
  display: none;
}

:deep(.el-select-dropdown__wrap) {
  ul {
    padding: 4px;
    background-color: var(--color-white);

    .el-tree-node__content {
      min-height: 32px;
      padding-right: 12px !important;
      box-sizing: border-box;
    }

    .el-tree-node__expand-icon {
      display: inline-flex;
      color: var(--text-color-placeholder);
      margin-right: 4px;
    }

    .el-tree-node__label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

:deep(.el-popper) {
  overflow: hidden;

  .el-tree {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .el-tree-node {
      border-radius: 2px;
      overflow: hidden;

      .el-tree-node__content {
        transition: background-color 0.3s ease;
      }
    }
  }


}


</style>
