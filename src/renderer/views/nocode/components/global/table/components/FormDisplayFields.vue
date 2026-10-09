<template>
  <div class="table-display-fields">
    <el-popover ref="popoverRef"
      :virtual-ref="btnRef"
      trigger="click"
      placement="bottom-end"
      :width="288"
      :offset="6"
      :hide-after="0"
      @before-enter="popoverShow"
      @before-leave="popoverHide"
      popper-class="table-display-fields-popover">
      <p class="title">{{ $t('FormDisplayFields.displayFields') }}</p>
      <div class="table-display-fields-content">
        <el-input class="search-fields" v-model="searchValue" :placeholder="$t('FormDisplayFields.searchFields')" />

        <div class="fields-list">
          <el-checkbox v-model="checkAll" :indeterminate="isIndeterminate">
            {{ $t('FormDisplayFields.selectAll') }} {{ selectedColumnIds.length }}/{{ availableColumnIds.length }}
          </el-checkbox>

          <el-scrollbar class="fields-list-scrollbar" noresize>
            <el-tree
              ref="treeRef"
              :data="allColumns"
              node-key="uid"
              default-expand-all
              :props="treeProps"
              show-checkbox
              highlight-current
              :expand-on-click-node="false" check-on-click-node :default-checked-keys="checkedColumns"
              :filter-node-method="filterNodeMethod">
              <template #default="{ node, data }">
                <div>
                  {{ data.alias }}
                </div>
              </template>
            </el-tree>
          </el-scrollbar>
        </div>
      </div>

      <template #reference>
        <div class="btn" link :class="{ 'changed': isChanged, 'mobile': isMobile() }" ref="btnRef" v-click-outside="handleClickOutside">
          <el-icon size="16"><i-table-display-fields /></el-icon><span class="btn-text" style="margin-left: 4px;">{{ $t('FormDisplayFields.displayFields') }}</span>
        </div>
      </template>
    </el-popover>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, unref, watch } from 'vue';
import { ClickOutside as vClickOutside } from 'element-plus';
import { useTable } from '../hooks';
import { isMobile } from "@renderer/utils";
import { SystemField } from "@common/utils/connection";

const props = defineProps<{
  preHiddenColumnIds?: string[];
}>();

const emit = defineEmits<{
  (event: "update:hiddenColumnIds", value: string[]): void;
}>();

const searchValue = ref('');
const treeRef = ref();
const btnRef = ref();
const popoverRef = ref();
const visible = ref(false);

const widget = useTable();

const flatColumnIds = computed(() => {
  const showSystemFields: string[] = [
    SystemField.DATA_TITLE,
    SystemField.DATA_OWNER,
    SystemField.CREATE_OWNER,
    SystemField.CREATE_TIME,
    SystemField.UPDATE_OWNER,
    SystemField.UPDATE_TIME,
  ];
  const columns = widget.flatColumns || [];
  return columns
    .filter(column => !showSystemFields.includes(column.name))
    .map(column => column.uid);
});

const lockedHiddenColumnIds = computed(() => {
  const validColumnIds = new Set(flatColumnIds.value);
  return Array.from(new Set((props.preHiddenColumnIds || []).filter(id => validColumnIds.has(id))));
});

const availableColumnIds = computed(() => {
  const lockedHiddenColumnIdsSet = new Set(lockedHiddenColumnIds.value);
  return flatColumnIds.value.filter(id => !lockedHiddenColumnIdsSet.has(id));
});

const allColumns = computed(() => {
  const showSystemFields: string[] = [
    SystemField.DATA_TITLE,
    SystemField.DATA_OWNER,
    SystemField.CREATE_OWNER,
    SystemField.CREATE_TIME,
    SystemField.UPDATE_OWNER,
    SystemField.UPDATE_TIME,
  ];
  const lockedHiddenColumnIdsSet = new Set(lockedHiddenColumnIds.value);
  const appendDisabledState = (column) => {
    const subColumns = Array.isArray(column.subColumns)
      ? column.subColumns.map(appendDisabledState)
      : undefined;
    const allSubColumnsDisabled = Array.isArray(subColumns) && subColumns.length > 0 && subColumns.every(item => item.disabled);
    return {
      ...column,
      disabled: lockedHiddenColumnIdsSet.has(column.uid) || allSubColumnsDisabled,
      subColumns,
    };
  };
  return widget.allColumns
    .filter(item => !showSystemFields.includes(item.name))
    .map(appendDisabledState);
});

const checkableColumnIds = computed(() => {
  return allColumns.value.flatMap(column => {
    if (Array.isArray(column.subColumns) && column.subColumns.length > 0) {
      return column.subColumns.map(subColumn => subColumn.uid);
    }
    return [column.uid];
  });
});

const treeProps = {
  children: 'subColumns',
  label: 'alias',
  id: 'uid',
  disabled: 'disabled',
};

const handleClickOutside = () => {
  unref(popoverRef).popperRef?.delayHide?.();
}

watch(searchValue, (val) => {
  treeRef.value!.filter(val);
})

const filterNodeMethod = (value: string, data) => {
  if (!value) return true;
  const nodeTitle = data.alias || data.name || '';
  return nodeTitle.includes(value);
};

const checkedColumns = computed({
  get () {
    return treeRef.value?.getCheckedKeys() ?? [];
  },
  set (value) {
    treeRef.value?.setCheckedKeys(value);
  }
});

const selectedColumnIds = computed(() => {
  const availableColumnIdsSet = new Set(availableColumnIds.value);
  return Array.from(new Set([
    ...checkedColumns.value,
    ...(treeRef.value?.getHalfCheckedKeys?.() ?? []),
  ])).filter(id => availableColumnIdsSet.has(id));
});

const localHiddenColumnIds = ref<string[]>([]);
const mergedHiddenColumnIds = computed(() => {
  return Array.from(new Set([
    ...lockedHiddenColumnIds.value,
    ...localHiddenColumnIds.value,
  ]));
});

const syncCheckedColumns = () => {
  const availableColumnIdsSet = new Set(availableColumnIds.value);
  checkedColumns.value = checkableColumnIds.value.filter(id => {
    return availableColumnIdsSet.has(id) && !localHiddenColumnIds.value.includes(id);
  });
};

const isChanged = computed(() => {
  const _isChanged = mergedHiddenColumnIds.value.length > 0 || selectedColumnIds.value.length !== availableColumnIds.value.length;
  return _isChanged || widget.isChanged;
})

const isIndeterminate = computed(() => {
  const total = availableColumnIds.value.length;
  return selectedColumnIds.value.length > 0 && selectedColumnIds.value.length < total;
});

const checkAll = computed({
  get() {
    return selectedColumnIds.value.length === availableColumnIds.value.length;
  },
  set(val: boolean) {
    checkedColumns.value = val ? [...availableColumnIds.value] : [];
  }
});

const updateHiddenColumnIds = () => {
  const result = JSON.parse(localStorage.getItem('hiddenDateFormColumnIds')) ?? {};
  const lockedHiddenColumnIdsSet = new Set(lockedHiddenColumnIds.value);
  localHiddenColumnIds.value = ((result[widget.uid] ?? []) as string[]).filter(id => !lockedHiddenColumnIdsSet.has(id));
  syncCheckedColumns();
}

const emitHiddenColumnIds = () => {
  emit('update:hiddenColumnIds', mergedHiddenColumnIds.value);
};

const popoverHide = () => {
  visible.value = false;
  const hiddenIds = availableColumnIds.value.filter(id => !selectedColumnIds.value.includes(id));
  const result = JSON.parse(localStorage.getItem('hiddenDateFormColumnIds')) ?? {};
  result[widget.uid] = hiddenIds;
  localStorage.setItem('hiddenDateFormColumnIds', JSON.stringify(result));
  localHiddenColumnIds.value = hiddenIds;
  emitHiddenColumnIds();
}

const popoverShow = () => {
  visible.value = true;
  syncCheckedColumns();
}

updateHiddenColumnIds();
emitHiddenColumnIds();

watch([lockedHiddenColumnIds, flatColumnIds], () => {
  updateHiddenColumnIds();
  emitHiddenColumnIds();
}, { deep: true });
</script>

<style lang="scss">
.table-display-fields {
  display: flex;
  align-items: center;

  .btn {
    .el-icon {
      margin-right: 0px !important;
    }

    &:hover {
      color: var(--color-primary);
      background-color: var(--bg-color-overlay);
    }

    .btn-text {
      display: none;
    }

    &.mobile {
      background: none;
      color: #373737;
      .btn-text {
        display: block;
        color: #373737;
      }
      &:hover {
        color: #373737;
        background-color: transparent;
      }
    }
  }
  .changed {
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
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 420px;

  .title {
    font-size: 14px;
    color: var(--text-color-primary);
  }

  .table-display-fields-content {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .search-fields {
      flex: none;
      background-color: var(--bg-color-page);
      width: 256px;
      height: 32px;

      .el-input__wrapper {
        height: 32px;
        box-shadow: unset;
        border-radius: 4px;
        border: 1px solid var(--border-color);
      }
    }

    .fields-list {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .el-checkbox {
        padding: 0 8px;
        margin: 0;
        font-size: 13px;
        --el-checkbox-checked-text-color: var(--text-color-primary);
      }

      .fields-list-scrollbar {

        .el-scrollbar__bar {
          width: 4px;
        }

        .el-tree {
          background-color: transparent;

          .el-tree-node__content {
            height: 32px;
            padding: 8px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            margin: 4px 0;

            >.el-tree-node__expand-icon {
              display: none;
            }
          }
        }
      }
    }
  }

  .el-popper__arrow {
    display: none;
  }
}
</style>
