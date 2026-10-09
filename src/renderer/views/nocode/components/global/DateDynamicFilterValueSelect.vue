<template>
  <div class="date-dynamic-filter-value-select" ref="dynamicValueRef">
    <el-popover :width="320" trigger="click" :visible="typePopoverVisible" :offset="4" :show-arrow="false" :teleported="teleported" 
      :append-to="appendTo" popper-class="date-dynamic-filter-value-select-popper">
      <template #reference>
        <div class="show-type-popover-btn" :class="{ 'is-disabled': disabled }" @click.stop="!disabled && (typePopoverVisible = !typePopoverVisible)">
          <el-icon v-if="filterDateValue.type === DateDynamicRuleType.CUSTOM" :size="16">
            <i-workbench-rename></i-workbench-rename>
          </el-icon>
          <span v-else>{{ filterDateValue.type ? DateDynamicRuleTypeMapping[filterDateValue.type] : '' }}</span>
          <el-icon>
            <i-ep-arrow-down v-if="!typePopoverVisible" />
            <i-ep-arrow-up v-else />
          </el-icon>
        </div>
      </template>
      <template #default>
        <div class="popover-option-content">
          <div class="popover-option-item" :class="{ 'custom-option-item': option === DateDynamicRuleType.CUSTOM }" v-for="option in DateDynamicRuleType" :key="option">
            <div class="popover-option-line" v-if="option === DateDynamicRuleType.CUSTOM"></div>
            <div class="popover-option-item-tag" :class="{ 'active': filterDateValue.type === option }" @click="handleUpdateTypeValue(option)">
              {{ DateDynamicRuleTypeMapping[option] }}
              <el-icon v-if="option === DateDynamicRuleType.CUSTOM" :size="16" style="margin-left: 8px;">
                <i-workbench-rename></i-workbench-rename>
              </el-icon>
            </div>
          </div>
          <div class="popover-option-item custom-option-item">
            <div class="popover-option-line"></div>
            <div class="popover-option-item-select">
              <span>{{ $t('DateDynamicFilterValueSelect.weekStartDate')}} </span>
              <el-select class="week-start-select" popper-class="week-start-select-popper" :model-value="filterDateValue.weekStart" :teleported="false" 
                :append-to="'.date-dynamic-filter-value-select'" :options="weekTypeOptions" @change="handleWeekStartChange" :disabled="disabled">
              </el-select>
            </div>
          </div>
        </div>
      </template>
    </el-popover>
    <el-cascader :model-value="filterDateValue.value.first" class="custom-cascader" v-if="filterDateValue.type === DateDynamicRuleType.CUSTOM" :offset="4" 
      :placeholder="$t('DateDynamicFilterValueSelect.customStartDatePlaceholder')" clearable :options="valueSelectOptions" :popper-append-to-body="false" :teleported="teleported" :append-to="appendTo" 
      separator="" @change="handleStartValueChange" :disabled="disabled">
    </el-cascader>
    <el-cascader :model-value="filterDateValue.value.last" class="custom-cascader" v-if="filterDateValue.type === DateDynamicRuleType.CUSTOM" :offset="4" 
      :placeholder="$t('DateDynamicFilterValueSelect.customEndDatePlaceholder')" clearable :options="valueSelectOptions" :popper-append-to-body="false" :teleported="teleported" :append-to="appendTo" 
      separator="" @change="handleEndValueChange" :disabled="disabled">
    </el-cascader>
  </div>
</template>

<script setup lang='ts'>
import { DateDynamicRuleType, DateDynamicRuleTypeMapping } from '@common/types/nocode';
import { isEmpty } from '@common/utils/object';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import i18next from 'i18next';

const props = defineProps<{
  modelValue: any,
  teleported?: boolean,
  appendTo?: string,
  disabled?: boolean,
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: any): void
}>();

const typePopoverVisible = ref(false);
const dynamicValueRef = ref();
const dynamicValueSelectWidth = ref();
onMounted(() => {
  if (dynamicValueRef.value) {
    dynamicValueSelectWidth.value = dynamicValueRef.value.offsetWidth;
  }
})

watch(() => props.disabled, (disabled) => {
  if (disabled) {
    typePopoverVisible.value = false;
  }
})


const filterDateValue = ref<{ type: DateDynamicRuleType, weekStart: 'isoWeek' | 'week', value: any}>({
  type: null,
  weekStart: 'isoWeek',
  value: null
})

const handleUpdateTypeValue = (val: DateDynamicRuleType) => {
  filterDateValue.value.type = val;
  if (val === DateDynamicRuleType.CUSTOM) {
    filterDateValue.value.value = { first: null, last: null };
  } else {
    filterDateValue.value.value = null;
  }
  emit('update:modelValue', JSON.stringify(filterDateValue.value));
  typePopoverVisible.value = false;
}
// 添加点击外部关闭popover的功能
const handleClickOutside = (ev) => {
  if (!typePopoverVisible.value) return;
  const target = ev.target;
  const weekSelect = document.querySelector('.week-start-select');
  const showTypePopoverBtn = document.querySelector('.show-type-popover-btn');
  
  // 如果点击的是popover内部元素，则不关闭popover
  if (showTypePopoverBtn.contains(target) || 
    target.classList.contains('popover-option-content') || 
    target.classList.contains('popover-option-item') || 
    weekSelect.contains(target)
  ) return;

  // 如果点击的是popover外部，则关闭popover
  typePopoverVisible.value = false;
};

// 在组件挂载时添加点击事件监听器
onMounted(() => {
  document.addEventListener('click', handleClickOutside, true);
  if (!isEmpty(props.modelValue) && props.modelValue !== '') {
    try {
      filterDateValue.value = JSON.parse(props.modelValue);
    } catch {
      filterDateValue.value = { type: null, weekStart: 'isoWeek', value: null };
    }
  } else {
    filterDateValue.value = { type: null, weekStart: 'isoWeek', value: null };
  }
});

// 在组件卸载前移除点击事件监听器，避免内存泄漏
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true);
});

const unitChildren = [
  {
    value: 'day',
    get label() { return i18next.t('DateDynamicFilterValueSelect.unitDay') },
  },
  {
    value: 'week',
    get label() { return i18next.t('DateDynamicFilterValueSelect.unitWeek') },
  },
  {
    value: 'month',
    get label() { return i18next.t('DateDynamicFilterValueSelect.unitMonth') },
  },
  {
    value: 'quarter',
    get label() { return i18next.t('DateDynamicFilterValueSelect.unitQuarter') },
  },
  {
    value: 'year',
    get label() { return i18next.t('DateDynamicFilterValueSelect.unitYear') },
  },
]

const countChildren = (count: number) => {
  let children = [];
  for (let i = 0; i < count; i++) {
    children.push({
      value: i + 1,
      label: `${i + 1}`,
      children: unitChildren
    })
  }
  return children;
}

const valueSelectOptions = [
  {
    value: 'this',
    get label() { return i18next.t('DateDynamicFilterValueSelect.valueThisSelect') },
    children: countChildren(1)
  },
  {
    value: 'last',
    get label() { return i18next.t('DateDynamicFilterValueSelect.valueLastSelect') },
    children: countChildren(90)
  },
  {
    value: 'next',
    get label() { return i18next.t('DateDynamicFilterValueSelect.valueNextSelect') },
    children: countChildren(90)
  },
]

const weekTypeOptions = [
  {
    value: 'isoWeek',
    get label() { return i18next.t('DateDynamicFilterValueSelect.isoWeekType') },
  },
  {
    value: 'week',
    get label() { return i18next.t('DateDynamicFilterValueSelect.weekType') },
  }
]

const handleWeekStartChange = (val) => {
  filterDateValue.value.weekStart = val;
  emit('update:modelValue', JSON.stringify(filterDateValue.value));
}

const handleStartValueChange = (val) => {
  filterDateValue.value.value.first = val;
  emit('update:modelValue', JSON.stringify(filterDateValue.value));
}

const handleEndValueChange = (val) => {
  filterDateValue.value.value.last = val;
  emit('update:modelValue', JSON.stringify(filterDateValue.value));
}
</script>

<style lang='scss' scoped>
.date-dynamic-filter-value-select {
  position: relative;
  width: 100%;
  display: v-bind("filterDateValue.type === DateDynamicRuleType.CUSTOM ? 'grid' : 'flex'");
  grid-template-columns: v-bind("filterDateValue.type === DateDynamicRuleType.CUSTOM ?  '50px 1fr 1fr' : 'unset'");
  gap: 4px;
  
  .show-type-popover-btn {
    width: 100%;
    height: 32px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0px 6px 0px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    line-height: 24px;
    gap: 4px;
    span {
      display: inline-block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &:hover {
      cursor: pointer;
    }

    &.is-disabled {
      cursor: not-allowed;
      color: var(--text-color-placeholder);
    }
  }

  :deep(.custom-cascader) {
    .el-input__wrapper {
      padding: 0px 4px 0px 8px;
    }
  }
}
</style>
<style lang='scss'>
.date-dynamic-filter-value-select-popper {
  background-color: #fff !important;
  padding: 4px !important;
  .popover-option-content {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    row-gap: 8px;

    .popover-option-item {
      .popover-option-line {
        width: 100%;
        height: 1px;
        background-color: var(--border-color);
        margin-bottom: 8px;
      }

      .popover-option-item-tag {
        width: fit-content;
        border-radius: 4px;
        height: 36px;
        display: flex;
        align-items: center;
        width: 100%;
        padding: 0 8px 0 12px;
        font-size: 14px;
        line-height: 22px;
        &:hover {
          background-color: #F2F3F5;
          cursor: pointer;
        }
  
        &.active {
          color: #0873FF;
        }
      }

      .popover-option-item-select  {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 12px;
        span {
          display: inline-block;
          width: 100px;
        }

        .el-select__wrapper {
          flex: 1;
          border-radius: 4px;
        }
      }
    }

    .custom-option-item {
      grid-column: 1 / span 3;
    }
  }
}
</style>
