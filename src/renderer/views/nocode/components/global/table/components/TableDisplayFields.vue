<template>
  <div class="table-display-fields">
    <el-popover
      :visible="visible"
      trigger="click"
      placement="bottom-end"
      :width="288"
      :offset="6"
      :hide-after="0"
      :persistent="false"
      :disabled="isDrawerVisible"
      popper-class="table-display-fields-popover"
      ref="tableDisplayFieldsPopoverRef"
    >
      <div class="table-display-fields-content">
        <fields-drag-display-setting
          ref="fieldsDragDisplaySettingRef"
          :active="visible"
          :columns="displayColumns"
          :tableUid="widget.uid"
          :allowReorder="props.allowReorder"
        />
      </div>

      <template #reference>
        <div class="btn" :class="{ changed: hasManagedHiddenColumns, active: isDrawerFieldActive, 'icon-only': props.iconOnly }" @click="handleButtonClick" ref="btnRef" :title="buttonText">
          <el-icon size="16"><i-table-display-fields /></el-icon>
          <span v-if="!props.iconOnly" style="margin-left: 4px;">{{ buttonText }}</span>
        </div>
      </template>
    </el-popover>
  </div>
</template>

<script lang="ts" setup>
import type { FormTableColumnOrder } from '@common/types/nocode';
import type { FieldUID } from '@common/types/project';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VIEW_SETTING_DRAWER_PANEL_STATE } from '@renderer/types';
import { useTable, useTableProps } from '../hooks';
import i18next from 'i18next';

const props = withDefaults(defineProps<{
  iconOnly?: boolean,
  allowReorder?: boolean,
  buttonTextKey?: string,
}>(), {
  iconOnly: false,
  allowReorder: true,
  buttonTextKey: 'TableDisplayFields.displayField',
});

type DisplayFieldsValue = {
  hiddenColumnIds: FieldUID[];
  columnOrders: FormTableColumnOrder;
};

const visible = ref(false);
const btnRef = ref<HTMLElement>();
const tableDisplayFieldsPopoverRef = ref();
const fieldsDragDisplaySettingRef = ref();
const pendingPopoverValue = ref<DisplayFieldsValue | null>(null);

const widget = useTable();
const tableProps = useTableProps();
const viewSettingDrawerPanelState = inject(VIEW_SETTING_DRAWER_PANEL_STATE, null);

const displayColumns = ref<typeof widget.allColumns>([]);
const filterManagedColumns = <T extends { uid: FieldUID, subColumns?: T[] }>(columns: T[] = [], hiddenSet: Set<FieldUID>) => {
  return columns.reduce<T[]>((result, column) => {
    if (!column) return result;
    if (!column.subColumns?.length) {
      if (!hiddenSet.has(column.uid)) {
        result.push(column);
      }
      return result;
    }

    const nextSubColumns = filterManagedColumns(column.subColumns, hiddenSet);
    if (!nextSubColumns.length) {
      return result;
    }

    result.push({
      ...column,
      subColumns: nextSubColumns,
    });
    return result;
  }, []);
};
const managedHiddenSet = computed(() => new Set(tableProps.preHiddenColumns || []));

const managedColumns = computed(() => {
  return filterManagedColumns(widget.renderColumns, managedHiddenSet.value);
});

const managedColumnIds = computed(() => {
  const ids = new Set<string>();
  for (const column of managedColumns.value) {
    ids.add(column.uid);
    for (const subColumn of column.subColumns || []) {
      ids.add(subColumn.uid);
    }
  }
  return ids;
});

const hasManagedHiddenColumns = computed(() => {
  return (widget.hiddenColumnIds || []).some((uid) => managedColumnIds.value.has(uid));
});

const isDrawerVisible = computed(() => {
  return !!viewSettingDrawerPanelState?.value.visible;
});

const isDrawerFieldActive = computed(() => {
  return !!viewSettingDrawerPanelState?.value.visible && viewSettingDrawerPanelState.value.activeMenu === 'field';
});

const buttonText = computed(() => i18next.t(props.buttonTextKey));

const syncDisplayColumns = () => {
  displayColumns.value = filterManagedColumns(widget.allColumns, managedHiddenSet.value);
};

const initPopoverDisplayFields = async () => {
  syncDisplayColumns();
  pendingPopoverValue.value = null;
  await nextTick();
  fieldsDragDisplaySettingRef.value?.initValue(widget.hiddenColumnIds ?? []);
};

const handleButtonClick = () => {
  if (isDrawerVisible.value) return;
  visible.value = !visible.value;
};

const onClickOutside = (ev: MouseEvent) => {
  if (!visible.value) return;
  const target = ev.target as HTMLElement;
  if (btnRef.value?.contains(target)) return;
  const popover = tableDisplayFieldsPopoverRef.value?.popperRef?.contentRef ?? document.querySelector('.table-display-fields-popover');
  if (popover && popover.contains(target)) return;
  visible.value = false;
};

const applyPopoverDisplayFields = () => {
  const result = fieldsDragDisplaySettingRef.value?.getValue() ?? null;
  pendingPopoverValue.value = result;
  if (!result) {
    widget.setDisplaySettingApplying(false);
    return;
  }
  if (widget.hasDisplaySettingsChanged(result)) {
    widget.setDisplaySettingApplying(true);
  }
  widget.setDisplaySettings(result);
  pendingPopoverValue.value = null;
};

watch(isDrawerVisible, (value) => {
  if (value) {
    visible.value = false;
  }
}, { immediate: true });

watch(
  () => [widget.allColumns, tableProps.preHiddenColumns],
  () => {
    if (!visible.value) return;
    void initPopoverDisplayFields();
  },
  { deep: true }
);

watch(visible, (value, oldValue) => {
  if (value) {
    void initPopoverDisplayFields();
    return;
  }
  if (!oldValue) return;
  applyPopoverDisplayFields();
});

onMounted(() => {
  document.addEventListener('click', onClickOutside, true);
});

onBeforeUnmount(() => {
  visible.value = false;
  document.removeEventListener('click', onClickOutside, true);
});

defineExpose({
  open: () => {
    if (isDrawerVisible.value) return;
    visible.value = true;
  },
});
</script>

<style lang="scss">
.table-display-fields {
  .btn {
    padding: 6px 8px;
    border-radius: 4px;
    display: flex;
    font-size: 14px;
    align-items: center;
    transition: all 0.3s ease;

    .el-icon {
      margin-right: 3px;
    }

    &.icon-only {
      padding: 6px;

      .el-icon {
        margin-right: 0;
      }
    }

    &:hover {
      color: var(--color-primary);
      background-color: var(--bg-color-overlay);
    }
  }

  .changed,
  .active {
    color: var(--color-primary);
    background-color: var(--color-primary-light-9);
  }
}

.table-display-fields-popover {
  --el-bg-color-overlay: var(--bg-color-page);
  --el-popover-border-radius: 4px;
  --el-popover-padding: 16px;
  --el-border-color-light: var(--border-color);
  box-shadow: 0px 6px 16px 0px #00000014 !important;
  max-height: 420px;

  .table-display-fields-content {
    display: flex;
    flex-direction: column;
    height: 388px;
    min-height: 320px;
    max-height: 388px;

    > * {
      flex: 1;
      min-height: 0;
    }
  }

  .el-popper__arrow {
    display: none;
  }
}
</style>
