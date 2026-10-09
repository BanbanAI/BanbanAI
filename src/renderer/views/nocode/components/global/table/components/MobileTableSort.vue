<template>
  <div class="table-sort">
    <el-drawer
      :model-value="modelValue"
      direction="btt"
      size="60%"
      :show-close="false"
      close-on-click-modal
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template #header>
        <div class="title">{{ $t('MobileTableSort.sort') }}</div>
      </template>
      <div class="sort-list-container">
        <div class="content">
          <vue-draggable v-model="sortFields" itemKey="field" :component-data="{ class: 'sort-list' }" handle=".drag" animation="500"
            delay="60">
            <template #item="{ element: item, index }">
              <div class="item" :key="item.field">
                <div class="item-box">
                  <span class="field-name" :title="getField(item.field)?.alias">{{ getField(item.field)?.alias }}</span>
                  <el-radio-group class="sort-type" v-model="item.value">
                    <el-radio :value="SortType.ASC">{{ $t('MobileTableSort.asc') }}</el-radio>
                    <el-radio :value="SortType.DESC">{{ $t('MobileTableSort.desc') }}</el-radio>
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
          <field-selector :options="options" :teleported="false" :closeOnSelect="true" @select="handleSelect" style="margin-bottom: 8px;">{{ $t('MobileTableSort.addSort') }}</field-selector>
        </div>
        <div class="footer">
          <el-button class="clear" @click.stop="sortFields = []">{{ $t('MobileTableSort.clear') }}</el-button>
          <el-button class="confirm" type="primary" @click.stop="handleSort">{{ $t('MobileTableSort.confirm') }}</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script lang='ts' setup>
import { computed, ref, watch } from 'vue';
import { SortType } from '../types';
import VueDraggable from 'vuedraggable';
import { ElMessage } from 'element-plus';
import { isEmpty } from '@common/utils/object';
import { useTable } from '../hooks';
import { deepClone } from '@common/utils/object';
import { FormSortField } from '@common/types/nocode';
import i18next from 'i18next';
import { isAutoComputeColumn, isSortDisabledSystemColumn } from '../column-capability';

const props = defineProps<{
  modelValue: boolean,
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean),
}>();

const table = useTable();
const sortFields = ref<FormSortField[]>([]);

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

const getField = (uid: string) => {
  return table.allColumns.find(item => item.uid === uid);
}

const handleSelect = (option) => {
  if (sortFields.value.length >= 5) {
    return ElMessage.warning(i18next.t('MobileTableSort.maxFive'));
  }
  sortFields.value.push({
    field: option.value,
    value: SortType.ASC,
  });
}

const handleSort = () => {
  table.sortFields = sortFields.value;
  emit('update:modelValue', false);
}

const onPopoverShow = () => {
  sortFields.value = deepClone(table.sortFields || []);
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    onPopoverShow();
  }
});
</script>

<style lang='scss' scoped>
.table-sort {
  width: 100%;

  :deep(.el-drawer) {
    background-color: #fff;
    border-radius: 4px;

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

  .sort-list-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-top: 8px;

    .content {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      padding-top: 8px;
      overflow-y: auto;
      &::-webkit-scrollbar {
        display: none;
      }
      scrollbar-width: none;
      -ms-overflow-style: none;

      .item {
        display: flex;
        height: 32px;
        align-items: center;
        column-gap: 8px;
        margin-bottom: 8px;

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
      padding: 16px;
      border-top: 1px solid #E6E6E6;
      display: flex;
      justify-content: center;
      align-items: center;

      .clear {
        width: 60px;
        height: 40px;
        border-radius: 4px;
      }
      .confirm {
        width: 100%;
        height: 40px;
        border-radius: 4px;
      }
    }
  }

  .trigger {
    width: 100%;
    display: flex;
    align-items: center;
  }
}
</style>
