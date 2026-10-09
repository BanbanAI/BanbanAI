<template>
  <div class="table-display-fields">
    <el-drawer
      v-model="visible"
      direction="btt"
      size="60%"
      :show-close="false"
      close-on-click-modal
      @open="popoverShow"
    >
      <template #header>
        <div class="title">{{ $t('MobileTableDisplayFields.displayFields') }}</div>
      </template>
      <div class="table-display-fields-content">
        <div class="content">
          <el-input v-model="searchValue" :placeholder="$t('MobileTableDisplayFields.search')" />
          <div class="fields-list">
            <div class="check-all">
              <el-checkbox v-model="checkAll" :indeterminate="isIndeterminate">
                {{ $t('MobileTableDisplayFields.selectAll') }} {{ checkedColumns.length }}/{{ flatColumnIds.length }}
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
          <el-button class="filter" size="small" type="primary" @click="handleConfirm">{{ $t('MobileTableDisplayFields.confirm') }}</el-button>
        </div>
      </div>
    </el-drawer>

    <div class="btn" :class="{ 'changed': isChanged }" @click="visible = !visible" ref="btnRef">
      <el-icon size="16"><i-table-display-fields /></el-icon>
      {{ $t('MobileTableDisplayFields.displayFields') }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onUnmounted, ref, unref, watch } from 'vue';
import { useTable } from '../hooks';

const searchValue = ref('');
const treeRef = ref();
const btnRef = ref<HTMLElement>();
const visible = ref(false);

const widget = useTable();

const allColumns = computed(() => {
  return widget.allColumns;
})
const checkedColumns = computed({
  get () {
    return treeRef.value?.getCheckedKeys() ?? [];
  },
  set (value) {
    treeRef.value?.setCheckedKeys(value);
  }
})
;

const treeProps = {
  children: 'subColumns',
  label: 'alias',
  id: 'uid',
};

const isChanged = computed(() => {
  const _isChanged = checkedColumns.value?.length !== flatColumnIds.value.length;
  return visible.value ? _isChanged : widget.isChanged;
})

const onClickOutside = (ev) => {
  if (!visible.value) return;
  const target: HTMLElement = ev.target;
  if (btnRef.value?.contains(target)) return;
  const popover = document.querySelector(".table-display-fields-popover");
  if (popover && popover.contains(target)) return;
  // visible.value = false;
}
document.addEventListener('click', onClickOutside, true);
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true);
});

watch(searchValue, (val) => {
  treeRef.value!.filter(val);
})

const filterNodeMethod = (value: string, data,) => {
  if (!value) return true;
  return data.alias.includes(value);
};
const flatColumnIds = computed(() => {
  return widget.flatColumns.map(c => c.uid);
})

const isIndeterminate = computed(() => {
  const total = flatColumnIds.value.length;
  return checkedColumns.value.length > 0 && checkedColumns.value.length < total;
});

const checkAll = computed({
  get() {
    return checkedColumns.value.length === flatColumnIds.value.length;
  },
  set(val: boolean) {
    const newChecked = val ? [...flatColumnIds.value] : [];
    checkedColumns.value = newChecked;
  }
});

const handleConfirm = () => {
  const hiddenIds = flatColumnIds.value.filter((id) => !checkedColumns.value.includes(id));
  widget.hiddenColumnIds = hiddenIds;

  visible.value = false;
}

const popoverShow = () => {
  checkedColumns.value = flatColumnIds.value.filter((id) => !widget.hiddenColumnIds?.includes(id));
}
</script>

<style lang="scss" scoped>
.table-display-fields {
  margin-right: 8px;
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
        font-weight: 400;
      }
    }
    
    .el-drawer__body {
      padding: 0;
    }
  }

  .table-display-fields-content {
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
        font-size: 14px;
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
