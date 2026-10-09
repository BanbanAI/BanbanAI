<template>
  <div class="table-sort">
    <el-popover :visible="visible" :persistent="false" trigger="click" placement="bottom-end" :width="354" popper-class="widget-table-sort-popover" :popper-style="{
      '--el-bg-color-overlay': 'var(--bg-color-page)',
    }" @show="onPopoverShow">
      <div class="title">{{ $t('TableSort.sort') }}</div>
      <div class="sort-list-container">
        <field-selector :options="options" :teleported="false" @select="handleSelect">{{ $t('TableSort.addSortRule') }}</field-selector>

        <vue-draggable v-model="sortFields" itemKey="field" :component-data="{ class: 'sort-list' }" handle=".drag" animation="500"
          delay="60">
          <template #item="{ element: item, index }">
            <div class="item" :key="item.field">
              <div class="item-box">
                <span class="field-name" :title="getField(item.field)?.alias">{{ getField(item.field)?.alias }}</span>
                <el-radio-group class="sort-type" v-model="item.value">
                  <el-radio :value="SortType.ASC">{{ $t('TableSort.asc') }}</el-radio>
                  <el-radio :value="SortType.DESC">{{ $t('TableSort.desc') }}</el-radio>
                </el-radio-group>
                <el-icon class="drag" :size="16">
                  <i-table-sort-drag></i-table-sort-drag>
                </el-icon>
              </div>
              <el-button link @click.stop="sortFields.splice(index, 1)">
                <el-icon :size="16">
                  <i-ep-delete></i-ep-delete>
                </el-icon>
              </el-button>
            </div>
          </template>
        </vue-draggable>

        <div class="footer">
          <el-button @click.stop="sortFields = []" v-if="sortFields.length">{{ $t('TableSort.clear') }}</el-button>
          <el-button type="primary" @click.stop="handleSort">{{ $t('TableSort.confirm') }}</el-button>
        </div>
      </div>
      <template #reference>
        <div :class="['btn', { 'active': !isEmpty(table.sortFields)}]" @click="visible = !visible" ref="btnRef">
          <el-icon :size="16"><i-table-sort /></el-icon>{{ $t('TableSort.sort') }}
        </div>
      </template>
    </el-popover>
  </div>
</template>

<script lang='ts' setup>
import { computed, onBeforeUnmount, onUnmounted, ref, watch } from 'vue';
import { SortType } from '../types';
import VueDraggable from 'vuedraggable';
import { ElMessage } from 'element-plus';
import { isEmpty } from '@common/utils/object';
import { useTable } from '../hooks';
import { deepClone } from '@common/utils/object';
import { FormSortField } from '@common/types/nocode';
import i18next from 'i18next';
import { isAutoComputeColumn, isSortDisabledSystemColumn } from '../column-capability';

const visible = ref(false)
const table = useTable();
const sortFields = ref<FormSortField[]>([]);
const btnRef = ref<HTMLElement>();

const options = computed(() => {
  const selectColumns = sortFields.value;
  return table.allColumns.filter(item => {
    return !isSortDisabledSystemColumn(item)
      && !isAutoComputeColumn(item);
  }).map(item => {
    return {
      label: item.alias,
      value: item.uid,
      disabled: selectColumns.some(field => field.field === item.uid),
    }
  })
});

const onClickOutside = (ev) => {
  if (!visible.value) return;
  const target: HTMLElement = ev.target;
  if (btnRef.value?.contains(target)) return;
  const popovers = document.querySelectorAll(".widget-table-sort-popover");
  if (popovers) {
    for (const popover of popovers) {
      if (popover.contains(target)) return;
    }
  }
  const fieldSelectorPopovers = document.querySelectorAll(".global-field-selector-popover");
  if (fieldSelectorPopovers) {
    for (const popover of fieldSelectorPopovers) {
      if (popover.contains(target)) return;
    }
  }
  visible.value = false;
}
document.addEventListener('click', onClickOutside, true);
onBeforeUnmount(() => {
  visible.value = false;
});
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true);
});

const getField = (uid: string) => {
  return table.allColumns.find(item => item.uid === uid);
}

const handleSelect = (option) => {
  if (sortFields.value.length >= 5) {
    return ElMessage.warning(i18next.t('TableSort.mostFive'));
  }
  sortFields.value.push({
    field: option.value,
    value: SortType.ASC,
  });
}

const handleSort = () => {
  table.sortFields = sortFields.value;
  visible.value = false;
}

const onPopoverShow = () => {
  sortFields.value = deepClone(table.sortFields || []);
}

defineExpose({
  open: () => {
    visible.value = true;
  }
})

</script>

<style lang='scss' scoped>
.table-sort {
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

    &:hover {
      color: var(--color-primary);
      background-color: var(--bg-color-overlay);
    }

    &.active {
      color: var(--color-primary);
      background-color: var(--color-primary-light-9);
    }
  }
}
</style>
<style lang="scss">
.widget-table-sort-popover {
  .title {
    font-size: 14px;
  }
  .sort-list-container {
    margin-top: 16px;

    .field-selector {
      height: 32px;
      line-height: 32px;
    }

    .sort-list {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      row-gap: 8px;


      .item {
        display: flex;
        height: 32px;
        align-items: center;
        column-gap: 8px;

        .item-box {
          height: 100%;
          display: flex;
          align-items: center;
          flex: 1;
          border: 1px solid var(--border-color);
          padding: 0 8px;
          border-radius: 4px;

          .field-name {
            max-width: 125px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
          .sort-type {
            margin-left: auto;
            column-gap: 16px;

            .el-radio {
              margin: 0;
            }
          }
          .drag {
            cursor: move;
            margin-left: 16px;
          }
        }
      }
    }

    .footer {
      margin-top: 16px;
      display: flex;
      justify-content: end;
      column-gap: 8px;

      .el-button {
        border-radius: 4px;
        margin: 0;
      }
    }
  }
}
</style>
