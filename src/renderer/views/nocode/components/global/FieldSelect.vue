<template>
  <div class="field-select">
    <el-select :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)" @change="emit('change', $event)"
     @visible-change="handleVisibleChange"
     v-bind="attrs" :popper-class="mergedPopperClass" :multiple="multiple">
      <template #prefix v-if="$slots.prefix">
        <slot name="prefix"></slot>
      </template>

      <template #header v-if="filterable">
        <el-input v-model="searchValue" clearable :placeholder="$t('FieldSelect.search')">
          <template #prefix>
            <el-icon :size="16">
              <i-ep-search></i-ep-search>
            </el-icon>
          </template>
        </el-input>
      </template>
      <template #label="{ label, value }">
        <span 
          v-if="!!props.options.find(item => {
            if(isGroups) {
              return !!(item as FormSelectGroupOption).options?.find(option => option.value == value)
            } else {
              return (item as FieldSelectOption).value == value
            }
          })"
        >
          {{ label }}
        </span>
        <span v-else style="color: #FF4D4F;">
          {{ $t('FieldSelect.fieldDeleted') }}
        </span>
      </template>
      <template v-if="!isGroups">
        <div class="el-select-dropdown__item" v-if="multiple && allowAllCheck" :class="{ 'is-hover': isAllHovering }"
          @mouseenter="isAllHovering = true" @mouseleave="isAllHovering = false" @click="handleCheckAll(!checkAll)">
          <el-checkbox v-model="checkAll" :indeterminate="indeterminate" @change="handleCheckAll" @click.stop>{{ $t('FieldSelect.selectAll') }}</el-checkbox>
        </div>

        <el-option
          v-for="item in filterOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
          :title="item.label"
          :disabled="item.disabled"
          :class="{ 'is-hover': !isAllHovering && item.hovering }"
          @mouseenter="item.hovering = true"
          @mouseleave="item.hovering = false"
        >
          <el-checkbox
            :modelValue="(modelValue as FieldSelectOption['value'][])?.includes(item.value)"
            v-if="multiple"
          />
          <slot name="option-icon" :item="item"></slot>
          <span>{{ item.label }}</span>
        </el-option>
      </template>
      <template v-else>
        <el-option-group
          v-for="group in filterOptions"
          :key="group.label" 
          :label="group.label"
          :title="group.label"
        >
          <el-option
            v-for="item in group.options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
            :disabled="item.disabled"
            :title="item.label"
          >
            <el-checkbox
              :modelValue="(modelValue as FieldSelectOption['value'][])?.includes(item.value)"
              v-if="multiple"
            />
            <slot name="option-icon" :item="item"></slot>
            <span>{{ item.label }}</span>
          </el-option>
        </el-option-group>
      </template>
    </el-select>
  </div>
</template>

<script lang='ts' setup>
import { FieldSelectOption, FormSelectGroupOption } from '@renderer/b2/types';
import { computed, ref, watch, useAttrs } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: FieldSelectOption['value'] | FieldSelectOption['value'][],
  filterable?: boolean,
  multiple?: boolean,
  isGroups?: boolean,
  allowAllCheck?: boolean,
  options?: FieldSelectOption[] | FormSelectGroupOption[],
}>(), {
  filterable: true,
  multiple: false,
  isGroups: false,
  allowAllCheck: false,
  options: () => [],
});
const emit = defineEmits<{
  (event: "update:modelValue", value: string): void
  (event: "change", value: string): void
}>();

const attrs = useAttrs();
const searchValue = ref<string>('');
const checkAll = ref<boolean>(false);
const indeterminate = ref(false);
const mergedPopperClass = computed(() => {
  return ['global-field-select-popper', attrs['popper-class'] || attrs.popperClass].filter(Boolean);
});

const filterOptions = computed(() => {
  if (!props.filterable) return props.options;
  if (props.isGroups) {
    const tempOptions = props.options.map(group => {
      const itemOptions = group.options.filter(item => {
        if (item.label === null || item.label === undefined) {
          return ''.includes(searchValue.value);
        }
        return item.label.includes(searchValue.value)
      });
      if (itemOptions.length > 0) {
        return {
          ...group,
          options: itemOptions,
        }
      }
    }).filter(item => item);
    return tempOptions;
  }
  return props.options.filter(item => {
    if (item.label === null || item.label === undefined) {
      return ''.includes(searchValue.value);
    }
    return item.label.includes(searchValue.value)
  });
})

const isAllHovering = ref(false);
const handleVisibleChange = (visible: boolean) => {
  if (!visible) {
    searchValue.value = '';
  }
}

const handleCheckAll = (val) => {
  indeterminate.value = false;
  checkAll.value = val;
  if (val) {
    emit('update:modelValue', (filterOptions.value.map(item => item.value) as any));
  } else {
    emit('update:modelValue', null);
  }
}

watch(() => props.modelValue, (val: any) => {
  if (val?.length === 0 || !val) {
    checkAll.value = false;
    indeterminate.value = false;
  } else if (val?.length === filterOptions.value.length) {
    checkAll.value = true;
    indeterminate.value = false;
  } else {
    indeterminate.value = true;
  }
})
</script>

<style lang='scss' scoped>
.field-select {
  width: 100%;
}
</style>
<style lang="scss">
.global-field-select-popper {
  --el-bg-color-overlay: var(--bg-color-page);
  .el-select-dropdown__header {
    padding: 8px;
  }
  .all-check-el-option {
    padding: 0 32px 0 20px;
  }
  .is-hover {
    background-color: var(--el-fill-color-light) !important;
  }
  .el-select-dropdown__item {
    display: flex;
    align-items: center;
    column-gap: 8px;
    span {
      display: inline-block;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    // 禁用原本的hover样式
    &.is-hovering {
      background-color: transparent;
    }
    &::after {
      display: none;
    }
  }
}
</style>
