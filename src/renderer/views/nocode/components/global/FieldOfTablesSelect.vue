<template>
  <div class="form-select">
    <el-select
      ref="selectRef"
      :modelValue="fieldOfSelected"
      @change="emit('change', $event)"
      @visible-change="handleVisibleChange"
      v-bind="attrs"
      popper-class="global-field-of-table-select-popper"
      :multiple="multiple"
      :show-arrow="false"
      :offset="4"
      :no-data-text="noDataText"
    >
      <template #prefix v-if="$slots.prefix">
        <slot name="prefix"></slot>
      </template>

      <template #header v-if="filterable">
        <el-input v-model="searchValue" clearable :placeholder="$t('FieldOfTablesSelect.search')">
          <template #prefix>
            <el-icon :size="16">
              <i-ep-search></i-ep-search>
            </el-icon>
          </template>
        </el-input>
      </template>
      <template #default>
        <el-option-group
          v-for="group in filterGroups"
          :key="group.label"
          v-show="Array.isArray(group.options) ? group.options.length > 0 : group.options"
        >
          <span class="el-select-group__title" style="padding: 0px">{{ group.label }}</span>
          <el-option v-show="false" :label="group.label" :value="group.label"/>
          <el-tree
            :data="group.options"
            :props="{
              children: 'children',
              label: 'label'
            }"
            :node-key="'value'"
            :current-node-key="fieldOfSelected?.value"
            highlight-current
            check-on-click-node
            check-on-click-leaf
            @node-click="handleSwitchField"
            :default-expanded-keys="expandedKeys"
          >
            <template #default="{ node, data }">
              <span :data-value="data.value" :style="{color: data.value === fieldOfSelected?.value ? 'var(--color-primary)' : 'var(--text-color-regular)'}">
                {{ data.optionLabel ?? node.label }}
              </span>
            </template>
          </el-tree>
        </el-option-group>
      </template>
    </el-select>
  </div>
</template>

<script lang='ts' setup>
import { Field, Table, TableWithSource } from '@common/types/project';
import { isBuiltinField } from '@common/utils';
import { computed, ref, useAttrs, watch, nextTick } from 'vue';
import i18next from 'i18next';

type FieldUIDWithSource = `${string}.${string}` | `${string}.${string}.${string}`
type FieldWithDisabled = Field & { disabled?: boolean }
type TableWithDisabled = Table & { fiedlds: FieldWithDisabled[], disabled?: boolean }
type SourceTableWithDisabled = TableWithSource & { fiedlds: FieldWithDisabled[], disabled?: boolean }
type DefaultTableWithDisabled = {
  label: string,
} & TableWithDisabled

const props = withDefaults(defineProps<{
  modelValue: FieldUIDWithSource,
  filterable?: boolean,
  multiple?: boolean,
  tables: SourceTableWithDisabled[],
  defaultTables: DefaultTableWithDisabled[],
  otherTableLabel: string,
  firstTableLabel: string,
  noDataText: string,
}>(), {
  filterable: true,
  multiple: false,
  tables: () => [],
  otherTableLabel: () => i18next.t('FieldOfTablesSelect.otherForm'),
  firstTableLabel: () => i18next.t('FieldOfTablesSelect.currentForm'),
  noDataText: () => i18next.t('FieldOfTablesSelect.noData'),
});
const emit = defineEmits<{
  (event: "update:modelValue", value: string): void
  (event: "change", value: string): void
}>();

const attrs = useAttrs();
const searchValue = ref<string>('');
const selectRef = ref();

const getFieldOption = (table: TableWithDisabled | SourceTableWithDisabled, isSourceTable: boolean) => {
  const tableChildren = (table.fields ?? []).reduce((acc, field: FieldWithDisabled) => {
    if (!isBuiltinField(field)) {
      if (field.meta.extra.widgetType === "widget.form.subform") {
        const subTableChildren = (field.subTableFields ?? []).reduce((subformAcc, subTableField: FieldWithDisabled) => {
          if (
            !isBuiltinField(subTableField) &&
            (!props.filterable || subTableField.alias.includes(searchValue.value)) //大小写
          ) {
            subformAcc.push({
              value: `${table.uid}.${field.uid}.${subTableField.uid}`,
              label: `${isSourceTable ? (table as SourceTableWithDisabled).name : table.alias}.${field.alias}.${subTableField.alias}`,
              optionLabel: subTableField.alias,
              disabled: subTableField.disabled,
              isLeaf: true
            });
          }
          return subformAcc;
        }, [])

        if (props.filterable && subTableChildren.length > 0) {
          acc.push({
            value: field.uid,
            label: field.alias,
            disabled: field.disabled,
            children: subTableChildren
          });
        }
      } else if (field.alias.includes(searchValue.value)) {
        acc.push({
          value: `${table.uid}.${field.uid}`,
          label: `${isSourceTable ? (table as SourceTableWithDisabled).name : table.alias}.${field.alias}`,
          optionLabel: field.alias,
          disabled: field.disabled,
          isLeaf: true
        })
      }
    }
    return acc;
  }, [])

  return {
    value: table.uid,
    label: isSourceTable ? (table as SourceTableWithDisabled).name : table.alias,
    disabled: table.disabled,
    children: tableChildren
  }
}

const filterGroups = computed(() => {
  const groups = props.defaultTables.map(t => {
    const currentTableOption = getFieldOption(t, false);
    if (props.filterable && currentTableOption.children.length) {
      return {
        label: t.label,
        options: [currentTableOption],
      };
    }
  })?.filter(Boolean);
  
  const tablesOption = props.tables.reduce((acc, t) => {
    const option = getFieldOption(t, true);

    if (props.filterable && option.children.length) {
      acc.push(option);
    }
    return acc;
  }, [])
  if (props.filterable && tablesOption.length) {
    groups.push({
      label: props.otherTableLabel,
      options: tablesOption
    })
  }

  return groups;
})

const findNodeByUID = (uid: string, nodes: any[]) => {
  for (const node of nodes) {
    if (node.value === uid) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findNodeByUID(uid, node.children);
      if (found) {
        return found;
      }
    }
    if (node.options && node.options.length > 0) {
      const found = findNodeByUID(uid, node.options);
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
const expandedKeys = computed(() => {
  if (!fieldOfSelected.value) return [];
  // 遍历所有分组，查找目标节点并返回其路径
  for (const group of filterGroups.value) {
    const keys = getExpandedKeys(group.options, fieldOfSelected.value.value);
    if (keys.length > 0) {
      return keys;
    }
  }
  return [];
});

const handleSwitchField = (node) => {
  if (node.isLeaf) {
    selectRef.value.blur();
    emit('update:modelValue', node.value)
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
  if (visible && fieldOfSelected.value) {
    setTimeout(() => {
        const nodeElement = document.querySelector(`[data-value="${fieldOfSelected.value.value}"]`);
        if (nodeElement) {
          nodeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
    }, 100);
  }
};

defineExpose({
  validate,
})

</script>

<style lang='scss' scoped>
.form-select {
  width: 100%;
}
</style>
<style lang="scss">
.global-field-of-table-select-popper {
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
