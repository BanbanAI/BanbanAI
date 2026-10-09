<template>
  <div class="filter-value-format">
    <el-config-provider :locale="locale">
      <template v-if="type === RuleFuncValue.RANGE">
        <div class="number-range" v-if="props.configurations?.subType === 'number'">
          <el-input class="common-input" :readonly="readonly" :disabled="disabled" :model-value="modelValue[0]" @update:model-value="emit('update:modelValue', [Number($event), modelValue[1]])" type="number" :placeholder="$t('LinkageTableFilterValueFormat.min')" style="width: 75px;">
          </el-input> ~
          <el-input class="common-input" :readonly="readonly" :disabled="disabled" :model-value="modelValue[1]" @update:model-value="emit('update:modelValue', [modelValue[0], Number($event)])" type="number" :placeholder="$t('LinkageTableFilterValueFormat.max')" style="width: 75px;">
          </el-input>
        </div>
        <el-date-picker :readonly="readonly" :disabled="disabled" class="date-range" :value-format="'YYYY-MM-DD HH:mm:ss'" range-separator="~" v-else-if="props.configurations?.subType === 'date'"
         :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
          type="datetimerange"
        />
      </template>
      <template v-else-if="type === RuleFuncValue.DATE">
        <el-date-picker :readonly="readonly" :disabled="disabled" :value-format="'YYYY-MM-DD HH:mm:ss'"
         :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
          type="datetime"
        />
      </template>
      <template v-else-if="type === RuleFuncValue.TIME">
        <el-time-picker :readonly="readonly" :disabled="disabled" :value-format="'HH:mm:ss'"
         :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
        />
      </template>
      <template v-else-if="type === RuleFuncValue.SELECT">
        <el-select-v2 class="common-select" :popper-class="'custom-popper-small ' + styleOptions.popperClass" :readonly="readonly" :disabled="disabled" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :no-data-text="$t('LinkageTableFilterValueFormat.noData')" clearable filterable :options="selectOptions" :props="selectProps">
        </el-select-v2>
      </template>
      <template v-else-if="type === RuleFuncValue.SELECT_MULTIPLE">
        <el-select-v2 class="common-select" :popper-class="'custom-popper-small ' + styleOptions.popperClass" :readonly="readonly" :disabled="disabled" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
        :collapse-tags="true" :no-data-text="$t('LinkageTableFilterValueFormat.noData')"
        clearable filterable multiple :options="selectOptions" :props="selectProps">
          <template #tag v-if="modelValue?.length">
            <span class="label" :title="multipleSelectLabel">{{ multipleSelectLabel }}</span>
          </template>
        </el-select-v2>
      </template>
      <template v-else-if="type === RuleFuncValue.TAGS">
        <el-input-tag :readonly="readonly" :disabled="disabled" collapse-tags collapse-tags-tooltip tag-type="primary" filterable :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="$t('LinkageTableFilterValueFormat.enterAdd')" />
      </template>
      <template v-else-if="type === RuleFuncValue.ADDRESS">
        <el-tree-select :readonly="readonly" :disabled="disabled" class="drop-down common-select" ref="addressRef"
          :modelValue="modelValue"
          @update:model-value="emit('update:modelValue', $event)"
          lazy :load="loadNode" node-key="value"
          :render-after-expand="false"
          clearable filterable check-strictly
          :popper-class="'custom-popper-small ' + styleOptions.popperClass"
          :highlight-current="true" :show-path="true" :no-data-text="$t('LinkageTableFilterValueFormat.noData')" :props="{
            label: 'label',
            value: 'value',
            children: 'children',
            isLeaf: 'isLeaf',
          }">
        </el-tree-select>
      </template>
      <template v-else-if="type === RuleFuncValue.NULL">
        <el-input class="common-input" :readonly="true" :disabled="disabled" :model-value="null" placeholder="Null"></el-input>
      </template>
      <el-input class="common-input" :readonly="readonly" :disabled="disabled" :model-value="modelValue" @update:model-value="emit('update:modelValue', Number($event))" type="number" :placeholder="$t('LinkageTableFilterValueFormat.plsInput')" v-else-if="type === RuleFuncValue.NUMBER">
      </el-input>
      <date-dynamic-filter-value-select class="dynamic-filter-select" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :append-to="'body'" :teleported="true" v-else-if="configurations?.subType === 'date' && type === RuleFuncValue.STRING">
      </date-dynamic-filter-value-select>
      <el-input class="common-input" :readonly="readonly" :disabled="disabled" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="$t('LinkageTableFilterValueFormat.plsInput')" v-else />
    </el-config-provider>
  </div>
</template>

<script lang='ts' setup>
import { computed, ref, reactive, inject, watch } from 'vue';
import { getChinaAddressData } from '@renderer/utils/township';
import { FieldUID } from '@common/types/project';
import { FormElementConfiguration, RuleFunc, RuleFuncValue } from '@common/types/nocode';
import { isNocodeFormData } from '@common/utils/connection';
import { AbstractForm, FormElement } from '@renderer/b2/controllers/form';
import { Widget } from '@renderer/b2/controllers/widget';
import { ORGANIZE_UTIL } from '@renderer/types';
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";
import { ConnectionUID, TableUID } from '@common/types/project';
import { isEmpty } from '@common/utils/object';
import { formDataApi } from '@renderer/utils/api';

const props = withDefaults(defineProps<{
  modelValue: any,
  func: RuleFunc,
  linkageFieldsMap: Record<TableUID, {connectionUID: ConnectionUID, fieldUID: `f_${string}` | `f_${string}.f_${string}`, chartUIDs: string[]}>,
  configurations: FormElementConfiguration,
  widget: Widget,
  // selectElementUid: string,
  readonly?: boolean,
  disabled?: boolean,
  styleOptions?: {
    popperClass?: string
  }
}>(), {
  readonly: false,
  styleOptions: () => ({ popperClass: "" })
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: any): void
}>();

const organizeUtil = inject(ORGANIZE_UTIL)
const addressRef = ref();

const type = computed(() => {
  return props.configurations?.editFuncInfo?.[props.func] as RuleFuncValue;
});

const multipleSelectLabel = computed(() => {
  if (Array.isArray(props.modelValue)) {
    return props.modelValue.map(item => {
      const option = selectOptions.value.find(option => option.value === item);
      return option?.label || item;
    }).join("，");
  }
  return "";
});


const findNodeByValue = (data, value) => {
  for (const node of data) {
    if (node.value === value) {
      return node;
    }
    if (node.children) {
      const found = findNodeByValue(node.children, value);
      if (found) return found;
    }
  }
  return null;
};
const loadNode = async (node, resolve: (data) => void) => {
  const chinaAddressData = await getChinaAddressData();
  if (!node?.label) {
    resolve(chinaAddressData.map(({ children, ...rest }) => ({
      ...rest,
      isLeaf: !children || children.length === 0
    })));
  } else if (node.data?.value) {
    const match = findNodeByValue(chinaAddressData, node.data.value);

    if (match && match.children) {
      resolve(match.children.map(({ children, ...rest }) => ({
        ...rest,
        isLeaf: !children || children.length === 0
      })));
    } else {
      resolve([]);
    }
  } else {
    resolve([]);
  }
};

const selectProps = {
  label: "label",
  value: "value",
  options: "get"
}
const HISTORY_TABLE_UID_PREFIX = "hist_";
const getReferencedTableUID = (tableUID: TableUID) => {
  return tableUID?.startsWith(HISTORY_TABLE_UID_PREFIX)
    ? tableUID.slice(HISTORY_TABLE_UID_PREFIX.length) as TableUID
    : tableUID;
}
const cacheSelectOptions = reactive({});
const selectOptions = ref([]);
watch(() => {
  return { 
    linkageUids: Object.keys(props.linkageFieldsMap ?? {}).map((tableUID) => {
      return {
        connectionUID: props.linkageFieldsMap[tableUID].connectionUID,
        tableUID,
        fieldUID: props.linkageFieldsMap[tableUID].fieldUID,
      }
    }),
    type: type.value, 
    configurations: props.configurations 
  }
}, async (value) => {
  if (value?.linkageUids.some(uids => isEmpty(uids.fieldUID)) || !type.value) return;

  if (props.configurations.subType === "department") {
    const res = await organizeUtil.getDepartments();
    if (!cacheSelectOptions['department']) {
      cacheSelectOptions['department'] = res.map(department => {
        return {
          label: department.name,
          value: department.id,
        }
      })
    }

    selectOptions.value = cacheSelectOptions['department'];
  } else if (props.configurations.subType === "account") {
    const res = await organizeUtil.getUsers();
    if (!cacheSelectOptions['account']) {
      cacheSelectOptions['account'] = res.map(department => {
        return {
          label: department.realname,
          value: department.id,
        }
      })
    }

    selectOptions.value = cacheSelectOptions['account'];
  } else {
    const options = [];
    for (const uids of value.linkageUids) {
      const rawTableUID = uids.tableUID;
      const tableUID = getReferencedTableUID(rawTableUID);
      const cacheKey = `${rawTableUID}.${uids.fieldUID}`;
      if (!cacheSelectOptions[cacheKey]) {
        const [fieldUID, subFieldUID] = uids.fieldUID.split(".");
        const connection = props.widget.getBoard().getConnections()?.find(c => c.uid === uids.connectionUID) as any;
        const distinctOption = {
          nocodeId: connection?.nocodeId || props.widget.getBoard().nocodeId
        };

        if (subFieldUID) {
          const tables = connection?.tables ?? [];
          const subformField = tables?.find(table => table.uid === tableUID)?.fields.find(field => field.uid === fieldUID);
          const subTable = tables?.find(table => table.uid === subformField.meta?.extra?.subTableUID?.[1]);
          if (!subTable) continue;
          distinctOption['tableUID'] = subTable.uid;
          distinctOption['columnId'] = subFieldUID;
        } else {
          distinctOption['tableUID'] = tableUID;
          distinctOption['columnId'] = fieldUID;
        }

        cacheSelectOptions[cacheKey] = await formDataApi.distinct(distinctOption as any) ?? [];
      }

      options.push(...cacheSelectOptions[cacheKey]);
    }

    selectOptions.value = Array.from(new Set(options)).map(value => {
      return {
        label: value,
        value
      };
    });
  }
}, {immediate: true})
</script>

<style lang='scss' scoped>
@mixin common-select-mixin {
  &:has(.is-disabled) {
    cursor: not-allowed;
  }

  :deep(.el-select__wrapper) {
    width: 100%;
    height: 32px;
    background-color: var(--bg-color-overlay);
    border-radius: 4px;
    box-shadow: 0 0 0 0px var(--border-color) inset;
    font-size: 12px;

    &:hover {
      box-shadow: 0 0 0 1px var(--border-color) inset;
    }

    &.is-focused {
      box-shadow: 0 0 0 1px var(--color-primary) inset !important;
    }
    
    .el-select__selection.is-near {
      margin-left: -4px;
      flex-wrap: nowrap;

      span {
        display: inline-block;
        max-width: 290px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .el-select__input-wrapper {
        min-width: 20px;
        flex: 1;
      }
    }
  }
}

@mixin common-input-mixin {
    :deep(.el-input__wrapper) {
      border-radius: 4px;
      background-color: var(--bg-color-overlay);
      box-shadow: unset;

      &:hover {
        box-shadow: 0 0 0 1px var(--border-color) inset;
      }

      &.is-focus {
        box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
      }

      .el-input__inner {
        font-size: 12px;
        height: 32px;
        color: var(--text-color-regular);

        &::placeholder {
          font-size: 12px;
        }
      }
    }
  }
.filter-value-format {
  width: 100%;
  :deep(.el-input) {
    .el-input__inner::-webkit-inner-spin-button {
      all: unset;
    }
  }

  .number-range {
    display: flex;
    align-items: center;
    column-gap: 4px;
  }
  :deep(.date-range) {
    width: 100%;
  }
  :deep(.el-input-tag) {
    width: 100%;
    .el-input-tag__inner {
      overflow: hidden;
      white-space: nowrap;
      flex-wrap: nowrap;
      justify-content: end;
    }
  }

  .common-select {
    @include common-select-mixin;
  }

  .common-input {
    @include common-input-mixin;
  }
}
</style>
