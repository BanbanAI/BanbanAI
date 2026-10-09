<template>
  <div class="field-tree-select">
    <el-select
      ref="selectRef"
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
      @visible-change="handleVisibleChange"
      v-bind="attrs"
      popper-class="global-field-tree-select-popper"
      :multiple="multiple"
      :show-arrow="false"
      :offset="4"
      :props="{ label: 'alias', value: 'value' }"
      :empty-values="['', null, undefined]"
      :disabled="disabled"
      :placeholder="placeholder"
      :no-data-text="noDataText"
    >
      <template #prefix v-if="$slots.prefix">
        <slot name="prefix"></slot>
      </template>

      <template #header v-if="filterable">
        <el-input v-model="searchValue" clearable :placeholder="$t('FieldTreeSelect.search')" @input="handleSearch()">
          <template #prefix>
            <el-icon :size="16">
              <i-ep-search></i-ep-search>
            </el-icon>
          </template>
        </el-input>
      </template>
      <el-option-group
        v-for="group in options"
        :key="group.label"
      >
        <template v-if="(group?.options[0] as FormTreeOption)?.children ? (group?.options[0] as FormTreeOption)?.children?.length : group?.options?.length">
          <span class="el-select-group__title label_span" :title="`${group.label}`">{{ group.label }}</span>
          <el-option v-show="false" :label="group.label" :value="group.label"/>
          <el-tree
            :data="group.options"
            :props="{
              children: 'children',
              label: 'label',
              disabled: 'disabled',
            }"
            :node-key="'value'"
            :current-node-key="fieldOfSelected?.value"
            :filter-node-method="filterNode"
            highlight-current
            check-on-click-node
            check-on-click-leaf
            @node-click="handleSwitchField"
            :default-expanded-keys="defaultExpandedKeys"
            ref="treeRefs"
          >
            <template #default="{ node, data }">
              <span
                :data-value="data.value"
                :class="{ 'is-disabled': data.disabled, 'keep-disabled-text-color': data.keepDisabledTextColor && data.disabled }"
                :title="data.optionLabel ?? node.label"
                :style="{color: data.value === fieldOfSelected?.value ? 'var(--color-primary)' : data.disabled && !data.keepDisabledTextColor ? 'var(--el-text-color-placeholder)' :  'var(--text-color-regular)'}"
              >
                {{ data.optionLabel ?? node.label }}
              </span>
            </template>
          </el-tree>
        </template>
        <template v-else>
          <span>{{ noDataText }}</span>
        </template>
      </el-option-group>
      <template #label="scope">
        <span v-if="getLabel(scope)">
          {{ getLabel(scope) }}
        </span>
        <span v-else style="color: #FF4D4F;">
          {{ $t('FieldTreeSelect.fieldDeleted') }}
        </span>
      </template>
    </el-select>
  </div>
</template>

<script lang='ts' setup>
import { FormSelectGroupOption, FormTreeOption } from '@renderer/b2/types';
import { computed, nextTick, ref, useAttrs, watch } from 'vue';
import { FilterNodeMethodFunction, TreeInstance } from 'element-plus';
import i18next from 'i18next';

type FieldUIDWithSource = `${string}.${string}` | `${string}.${string}.${string}`

const props = withDefaults(defineProps<{
  modelValue: FieldUIDWithSource,
  filterable?: boolean,
  multiple?: boolean,
  disabled?: boolean,
  options?: FormSelectGroupOption[],
  placeholder?: string,
  noDataText?: string
}>(), {
  filterable: true,
  multiple: false,
  disabled: false,
  placeholder: () => i18next.t('FieldTreeSelect.select'),
  noDataText: () => i18next.t('FieldTreeSelect.noData'),
  options: () => [],
});
const emit = defineEmits<{
  (event: "update:modelValue", value: string): void
  (event: "change", value: string): void
}>();

const attrs = useAttrs();
const searchValue = ref<string>('');
const selectRef = ref();
const treeRefs = ref<TreeInstance[]>();
const filterGroups = computed(() => {
  return props.options;
  // const groups = props.defaultTables.map(t => {
  //   const currentTableOption = getFieldOption(t, false);
  //   if (props.filterable && currentTableOption.children.length) {
  //     return {
  //       label: t.label,
  //       options: [currentTableOption],
  //     };
  //   }
  // })?.filter(Boolean);
  
  // const tablesOption = props.tables.reduce((acc, t) => {
  //   const option = getFieldOption(t, true);

  //   if (props.filterable && option.children.length) {
  //     acc.push(option);
  //   }
  //   return acc;
  // }, [])
  // if (props.filterable && tablesOption.length) {
  //   groups.push({
  //     label: props.otherTableLabel,
  //     options: tablesOption
  //   })
  // }

  // return groups;
})

const filterNode: FilterNodeMethodFunction = (value, data) => {
  console.log(value, data, searchValue.value, treeRefs)
  if (!searchValue.value) return true
  return data.label.toLowerCase().includes(searchValue.value.trim().toLowerCase());
}
const applySearchFilter = () => {
  for (const treeRef of treeRefs.value || []) {
    treeRef.filter(searchValue.value);
  }
}
const searchTimer = ref(null)
const handleSearch = () => {
  if (searchTimer.value) {
    clearTimeout(searchTimer.value);
  }
  searchTimer.value = setTimeout(() => {
    applySearchFilter();
  }, 300);
}

watch(() => props.options, () => {
  nextTick(applySearchFilter);
}, { flush: 'post' });
const findNodeByUID = (uid: string, nodes: FormSelectGroupOption[]) => {
  for (const node of nodes) {
    if (node.options && node.options.length > 0) {
      const found = findNodeByUID(uid, node.options);
      if (found) {
        return found;
      }
    }
    if ((node as FormTreeOption).value === uid) {
      return node;
    }
    if ((node as FormTreeOption).children && (node as FormTreeOption).children.length > 0) {
      const found = findNodeByUID(uid, (node as FormTreeOption).children);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

const fieldOfSelected = computed(() => {
  return findNodeByUID(props.modelValue, filterGroups.value);
});

const getLabel = ({ value }) => {
  return fieldOfSelected.value?.alias || fieldOfSelected.value?.label;
}

// 添加展开路径计算函数
function getExpandedKeys(nodes: any[], targetValue: string): string[] {
  const stack: { node: any; path: string[] }[] = [];

  for (const node of nodes) {
    stack.push({ node, path: [] });
  }

  while (stack.length > 0) {
    const { node, path } = stack.pop()!;
    if (node.value === targetValue) {
      return path;
    }
    if (node.children && node.children.length > 0) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], path: [...path, node.value] });
      }
    }
  }
  return [];
}

// 计算需要展开的节点路径
const defaultExpandedKeys = ref([]);
const getDefaultExpandedKeys = () => {
  if (!fieldOfSelected.value) return [];
  // 遍历所有分组，查找目标节点并返回其路径
  for (const group of filterGroups.value) {
    const keys = getExpandedKeys(group.options, fieldOfSelected.value.value);
    if (keys.length > 0) {
      return keys;
    }
  }
  return [];
};

const handleSwitchField = (data: FormTreeOption, node, tree, event?: Event) => {
  if (data.disabled) {
    event?.preventDefault();
    event?.stopPropagation();
    return;
  }
  if (node.isLeaf) {
    event?.stopPropagation();
    emit('update:modelValue', data.value)
    emit('change', data.value)
    selectRef.value.blur();
  }
}

const validate = (uid) => {
  if(uid != props.modelValue) return true
  const val = fieldOfSelected.value
  if (!val) {
    return false
  }
  return true
}

const handleVisibleChange = (visible: boolean) => {
  if (!visible) {
    searchValue.value = '';
    return;
  }
  defaultExpandedKeys.value = getDefaultExpandedKeys();
  // if (visible && fieldOfSelected.value) {
  //   setTimeout(() => {
  //     const nodeElement = document.querySelector(`[data-value="${fieldOfSelected.value.value}"]`);
  //     if (nodeElement) {
  //       nodeElement.scrollIntoView({
  //         behavior: 'smooth',
  //         block: 'center',
  //         inline: 'nearest'
  //       });
  //     }
  //   }, 100);
  // }
};

defineExpose({
  validate,
})

</script>

<style lang='scss' scoped>
.field-tree-select {
  width: 100%;

  .is-disabled {
    color: var(--el-text-color-placeholder) !important;
    background: transparent;
    &:hover {
      background: transparent;
      cursor: not-allowed;
    }
  }

  .keep-disabled-text-color {
    color: var(--text-color-regular) !important;
  }
}
</style>
<style lang="scss">
.global-field-tree-select-popper {
  --el-bg-color-overlay: var(--bg-color-page);
  .el-select-dropdown__header {
    padding: 4px;

    .el-input__wrapper {
      height: 32px;
      border-radius: 4px;
      background-color: var(--bg-color-overlay);
        box-shadow: unset;

        &:hover {
          box-shadow: 0 0 0 1px var(--border-color) inset;
        }

        &.is-focus {
          box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
        }

        .el-input__prefix-inner {
          color: var(--text-color-regular);
        }

        .el-input__inner {
          font-size: 14px;
          height: 32px;

          &::placeholder {
            font-size: 14px;
          }
        }
    }
  }

  .el-scrollbar__view {
    padding: 6px;

    .el-select-group__title {
      padding: 0 6px;
      &.label_span {
        display: inline-block;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        line-height: 1;
      }
    }
  }

  .el-select-dropdown__item {
    display: flex;
    align-items: center;
    column-gap: 8px;

    &::after {
      display: none;
    }
  }

  .el-tree-node {
    span {
      display: inline-block;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    &.is-current > .el-tree-node__content {
      background: transparent;

      &:hover {
        background: var(--el-tree-node-hover-bg-color);
      }
    }

    &.is-current > .el-tree-node__content:has(.is-leaf) {
      color: var(--text-color-regular);
    }
  }
}
</style>
