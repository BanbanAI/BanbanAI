<template>
  <div class="mobile-form-display-fields">
    <el-drawer
      ref="popoverRef"
      v-model="visible"
      direction="btt"
      size="60%"
      :show-close="false"
      close-on-click-modal
      @open="popoverShow"
    >
      <template #header>
        <div class="title">{{ $t('MobileFormDiaplayFields.displayFields') }}</div>
      </template>
      <div class="mobile-form-display-fields-content">
        <div class="content">
          <el-input v-model="searchValue" :placeholder="$t('MobileFormDiaplayFields.search')" />
          <div class="fields-list">
            <div class="check-all">
              <el-checkbox v-model="checkAll" :indeterminate="isIndeterminate">
                {{ $t('MobileFormDiaplayFields.selectAll') }}
              </el-checkbox>
            </div>
            <el-scrollbar class="fields-list-scrollbar">
              <el-tree
                ref="treeRef"
                :data="allColumns"
                node-key="uid"
                default-expand-all
                :props="treeProps"
                show-checkbox
                highlight-current
                :expand-on-click-node="false" check-on-click-node :default-checked-keys="checkedColumns"
                :filter-node-method="filterNodeMethod" >
                <template #default="{ node, data }">
                  <div>
                    {{ data.alias }}
                  </div>
                </template>
              </el-tree>
            </el-scrollbar>
          </div>
        </div>
        <div class="footer">
          <el-button class="filter" size="small" type="primary" @click="handleConfirm">{{ $t('MobileFormDiaplayFields.confirm') }}</el-button>
        </div>
      </div>
    </el-drawer>

    <div class="btn" :class="{ 'changed': isChanged }" @click="visible = !visible" ref="btnRef">
      <el-icon size="16"><i-table-display-fields /></el-icon>
      {{ $t('MobileFormDiaplayFields.displayFields') }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useTable } from '../hooks';
import { SystemField } from "@common/utils/connection";

const props = defineProps<{
  preHiddenColumnIds?: string[];
}>();

const searchValue = ref('');
const treeRef = ref();
const btnRef = ref<HTMLElement>();
const visible = ref(false);
const popoverRef = ref();

const widget = useTable();

const emit = defineEmits<{
  (event: "update:hiddenColumnIds", value: string[]): void;
}>();

const flatColumnIds = computed(() => {
  const showSystemFields: string[] = [
    SystemField.DATA_TITLE,
    SystemField.DATA_OWNER,
    SystemField.CREATE_OWNER,
    SystemField.CREATE_TIME,
    SystemField.UPDATE_OWNER,
    SystemField.UPDATE_TIME,
  ];
  return (widget.flatColumns || [])
    .filter(column => !showSystemFields.includes(column.name))
    .map(column => column.uid);
})

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
})

const checkableColumnIds = computed(() => {
  return allColumns.value.flatMap(column => {
    if (Array.isArray(column.subColumns) && column.subColumns.length > 0) {
      return column.subColumns.map(subColumn => subColumn.uid);
    }
    return [column.uid];
  });
});

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

const treeProps = {
  children: 'subColumns',
  label: 'alias',
  id: 'uid',
  disabled: 'disabled',
};

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

watch(searchValue, (val) => {
  treeRef.value!.filter(val);
})

const filterNodeMethod = (value: string, data) => {
  if (!value) return true;
  const nodeTitle = data.alias || data.name || '';
  return nodeTitle.includes(value);
};

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
  const hiddenIds = availableColumnIds.value.filter((id) => !selectedColumnIds.value.includes(id));
  const result = JSON.parse(localStorage.getItem('hiddenDateFormColumnIds')) ?? {};
  result[widget.uid] = hiddenIds;
  localStorage.setItem('hiddenDateFormColumnIds', JSON.stringify(result));
  localHiddenColumnIds.value = hiddenIds;
  emitHiddenColumnIds();
}

const handleConfirm = () => {
  popoverHide();
}

const popoverShow = () => {
  syncCheckedColumns();
}

updateHiddenColumnIds();
emitHiddenColumnIds();

watch([lockedHiddenColumnIds, flatColumnIds], () => {
  updateHiddenColumnIds();
  emitHiddenColumnIds();
}, { deep: true })
</script>

<style lang="scss" scoped>
.mobile-form-display-fields {
  margin-right: 8px;
  text-align: left;
  :deep(.el-drawer) {
    background-color: #fff;
    border-radius: 4px;
    display: flex;
    flex-direction: column;

    .el-drawer__header {
      margin-bottom: 0;
      .title {
        color: #141414;
        font-size: 14px;
      }
    }
    
    .el-drawer__body {
      padding: 0;
    }
  }
  .title {
    font-size: 14px;
    font-weight: 400;
  }

  .mobile-form-display-fields-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    .content {
      height: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;

      :deep(.el-input) {
        border: none;
        .el-input__wrapper {
          width: 370px;
          height: 40px;
          border-radius: 8px;
          background-color: #F5F6F7;
          box-shadow: none;
        }
      }

      :deep(.fields-list) {
        height: 100%;
        display: flex;
        flex-direction: column;
        padding-bottom: 60px;

        .check-all {
          padding: 8px 0;
          border-bottom: 1px solid var(--border-color);
          &:active {
            background: var(--bg-color-overlay);
          }
          .el-checkbox {
            height: 40px;
            width: 100%;
            margin: 0;
            font-size: 13px;
            -webkit-tap-highlight-color: transparent;
            --el-checkbox-checked-text-color: var(--text-color-primary);
          }
        }

        .fields-list-scrollbar {
          height: 100%;

          .el-scrollbar__bar {
            width: 4px;
          }

          .el-tree {
            background-color: transparent;

            .el-tree-node__content {
              height: 40px;
              padding: 8px;
              padding: 8px;
              border-bottom: 1px solid var(--border-color);
              box-sizing: content-box;
              background: none;
              -webkit-tap-highlight-color: transparent;
              &:active {
                background: var(--bg-color-overlay);
              }
              >.el-tree-node__expand-icon {
                display: none;
              }
            }
          }
        }
      }
    }
    .footer {
      border-top: 1px solid #E6E6E6;
      padding: 16px;
      :deep(.el-button){
        width: 100%;
        height: 40px;
        border-radius: 4px;
      }
    }
  }

  .btn {
    display: flex;
    align-items: center;
    column-gap: 4px;
    white-space: nowrap;
    padding: 0;
    background: none;
    color: #373737;
    font-size: 14px;

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
</style>
