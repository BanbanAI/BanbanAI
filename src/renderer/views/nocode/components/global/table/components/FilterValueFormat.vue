<template>
  <div class="filter-value-format">
    <template v-if="configurations?.subType === 'status'">
      <el-select
        :model-value="modelValue.filter(value => statusOptions.findIndex(status => status.value === value) !== -1)"
        @update:model-value="emit('update:modelValue', $event)"
        :append-to="appendTo"
        :teleported="teleported"
        clearable
        multiple
        collapse-tags
        v-if="type === RuleFuncValue.SELECT_MULTIPLE"
      >
        <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value">
          <el-tag :hit="false" effect="dark" :color="item.color" style="border: none;">{{ item.label }}</el-tag>
        </el-option>
        <template #tag>
          <el-tag
            v-for="value in modelValue.filter((item, index) => index < 3)"
            :hit="false"
            effect="dark"
            :color="statusOptions.find(status => status.value === value)?.color"
            style="border: none;"
          >
            {{ statusOptions.find(status => status.value === value)?.label }}
          </el-tag>
        </template>
      </el-select>
      <el-select
        :model-value="statusOptions.findIndex(status => status.value === modelValue) !== -1 ? modelValue : null"
        @update:model-value="emit('update:modelValue', $event)"
        :append-to="appendTo"
        :teleported="teleported"
        clearable
        v-else
      >
        <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value">
          <el-tag :hit="false" effect="dark" :color="item.color" style="border: none;">{{ item.label }}</el-tag>
        </el-option>
        <template #label="{ label }">
          <el-tag
            :hit="false"
            effect="dark"
            :color="statusOptions.find(status => status.value === modelValue)?.color"
            style="border: none;"
            v-if="statusOptions.findIndex(status => status.value === modelValue) !== -1"
          >
            {{ statusOptions.find(status => status.value === modelValue)?.label }}
          </el-tag>
        </template>
      </el-select>
    </template>
    <template v-else-if="type === RuleFuncValue.RANGE">
      <div class="number-range" v-if="configurations?.subType === 'number'">
        <el-input :model-value="getPercentValue(modelValue[0])" @update:model-value="emit('update:modelValue', [getNumberValue($event as any), modelValue[1]])" type="number" :placeholder="$t('FilterValueFormat.min')">
          <template #suffix v-if="column?.extra?.isPercent">
            <span>%</span>
          </template>
        </el-input> ~
        <el-input :model-value="getPercentValue(modelValue[1])" @update:model-value="emit('update:modelValue', [modelValue[0], getNumberValue($event as any)])" type="number" :placeholder="$t('FilterValueFormat.min')">
          <template #suffix v-if="column?.extra?.isPercent">
            <span>%</span>
          </template>
        </el-input>
      </div>
      <el-date-picker class="date-range" :append-to="appendTo" :teleported="teleported" :format="dateDisplayFormat"  :value-format="'YYYY-MM-DD HH:mm:ss'" range-separator="~" v-else-if="configurations?.subType === 'date'"
       :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
        :type="dateRangePickerType"
      />
    </template>
    <template v-else-if="type === RuleFuncValue.DATE">
      <el-date-picker class="date-range" :append-to="appendTo" :teleported="teleported" :format="dateDisplayFormat" :value-format="'YYYY-MM-DD HH:mm:ss'"
       :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
        :type="datePickerType"
      />
    </template>
    <template v-else-if="type === RuleFuncValue.SELECT">
      <el-select-v2
        :append-to="appendTo"
        :teleported="teleported"
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        :empty-values="['', null, undefined]"
        clearable
        filterable
        :options="selectOptions" 
        :props="selectProps"
        :remote-show-suffix="true"
        :loading="isLoading"
        :remote-method="remoteMethod"
        :remote="true"
      >
      </el-select-v2>
    </template>
    <template v-else-if="type === RuleFuncValue.SELECT_MULTIPLE">
      <el-select-v2
        :append-to="appendTo"
        :teleported="teleported"
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        :collapse-tags="true"
        clearable
        filterable
        multiple
        :options="selectOptions"
        :props="selectProps"

        :remote-show-suffix="true"
        :loading="isLoading"
        :remote-method="remoteMethod"
        :remote="true"
      >
        <template #tag v-if="modelValue?.length">
          <span class="label" :title="multipleSelectLabel">{{ multipleSelectLabel }}</span>
        </template>
      </el-select-v2>
    </template>
    <template v-else-if="type === RuleFuncValue.ADDRESS">
      <el-tree-select class="drop-down" :append-to="appendTo" ref="addressRef"
        :modelValue="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        lazy :load="loadNode" node-key="value"
        :render-after-expand="false"
        clearable filterable check-strictly :teleported="teleported"
        :highlight-current="true" :show-path="true" :empty-text="$t('FilterValueFormat.noData')" :props="{
          label: 'label',
          value: 'value',
          children: 'children',
          isLeaf: 'isLeaf',
        }">
      </el-tree-select>
    </template>
    <el-input :modelValue="getPercentValue(modelValue)" @update:model-value="emit('update:modelValue', getNumberValue($event as any))" type="number" :placeholder="$t('FilterValueFormat.input')" v-else-if="type === RuleFuncValue.NUMBER">
      <template #suffix v-if="column?.extra?.isPercent">
        <span>%</span>
      </template>
    </el-input>
    <date-dynamic-filter-value-select :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :append-to="appendTo" :teleported="teleported" v-else-if="configurations?.subType === 'date' && type === RuleFuncValue.STRING">
    </date-dynamic-filter-value-select>
    <el-input :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="$t('FilterValueFormat.input')" v-else />
  </div>
</template>

<script lang='ts' setup>
import { RuleFuncValue } from '@common/types/nocode';
import { FormElement } from '@renderer/b2/controllers/form';
import { getChinaAddressData } from '@renderer/utils/township';
import { computed, ref, reactive, onBeforeMount } from 'vue';
import { useTable } from '../hooks';
import { getSystemColumnConfigurations } from '../utils';
import { ProcessNodeStatus } from '@common/types/project';
import i18next from 'i18next';
import DateDynamicFilterValueSelect from '../../DateDynamicFilterValueSelect.vue';
import { getTableDateDisplayFormat, getTableDatePickerType, getTableDateRangePickerType } from '../date-filter';
import { getUserDisplayName } from '@renderer/utils/other';
import { formDataApi } from '@renderer/utils/api';

const props = defineProps<{
  modelValue: any,
  type: RuleFuncValue,
  fieldId: string,
  element: FormElement,
  teleported?: boolean,
  appendTo?: string,
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: any): void
}>();

const widget = useTable();
const addressRef = ref();
const column = computed(() => {
  const fieldIdArr = props.fieldId?.split(".");
  const column = widget.allColumns.findLast(item => item.uid === fieldIdArr?.[0])
  if (fieldIdArr?.length > 1) {
    return column.subColumns.findLast(item => item.uid === fieldIdArr?.[1])
  }
  return column;
});
const sysColumn = computed(() => {
  if (!props.element && props.fieldId) {
    return column.value;
  }
})
const configurations = computed(() => {
  if (!props.element) {
    return getSystemColumnConfigurations(sysColumn.value?.name);
  }
  return props.element.getConfigurations();
});

const datePickerType = computed(() => {
  return getTableDatePickerType(props.element, column.value?.extra);
});

const dateRangePickerType = computed(() => {
  return getTableDateRangePickerType(props.element, column.value?.extra);
});

const dateDisplayFormat = computed(() => {
  return getTableDateDisplayFormat(props.element, column.value?.extra);
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
      console.log('node.value === value', value);
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
const cacheSelectOptions = reactive({});
const getOptionsByDistinct = async () => {
  const columnId = column.value?.elementId || props.element?.uid || sysColumn.value?.name;
  if (!columnId) return [];
  if (cacheSelectOptions[columnId]) return cacheSelectOptions[columnId];
  const arr = props.fieldId?.split(".");
  let tableId = widget.formTableUID;
  let table = widget.table;
  if (arr.length > 1) {
    const field = table.fields.find(field => field.uid === arr[0]);
    tableId = field?.meta?.extra?.subTableUID?.[1];
    table = widget.getTable(tableId);
  }
  const field = table?.fields?.find(field => field.meta.uid === columnId || field.meta.name === columnId);
  if (!field) return [];
  try {
    const data = await formDataApi.distinct({
      nocodeId: widget.nocodeId,
      tableUID: table.uid,
      columnId: field.uid,
      options: {
        stage: widget.getQueryStage(table.uid),
      },
    })
    if (data) {
      if (column.value?.subType === "related") {
        cacheSelectOptions[columnId] = await widget.getRelatedFilterOptions(field.uid, data.filter(Boolean));
      } else if (configurations.value.subType === "account") {
        cacheSelectOptions[columnId] = await Promise.all(data?.filter(Boolean)?.map(async (item) => {
          const account = await widget.getOrganizationAccount(String(item));
          const label = getUserDisplayName(account, i18next.t('FilterValueFormat.unknownMember'));
          return {
            label,
            value: item,
          }
        }))
      } else if (configurations.value.subType === "department") {
        cacheSelectOptions[columnId] = await Promise.all(data?.filter(Boolean)?.map(async item => {
          const department = await widget.getDepartment(item)
          return {
            label: department?.name || i18next.t('FilterValueFormat.unknownDep'),
            value: item,
          }
        }))
      } else if (configurations.value.subType === "node") {
        cacheSelectOptions[columnId] = await Promise.all(data?.filter(Boolean)?.map(async item => {
          return {
            label: widget.getFlowLabel(item) || i18next.t('FilterValueFormat.unknownNode'),
            value: item,
          }
        }))
      } else {
        cacheSelectOptions[columnId] = data?.map(item => ({ label: item, value: item }));
      }
    }
  } catch (error) {
    console.log("error", error)
  }
  return cacheSelectOptions[columnId] || [];
}
const isLoading = ref(false);
const selectOptions = ref([]);
const setSelectOptions = async (query: string = '') => {
  const options = await getOptionsByDistinct();
  if (!query) {
    selectOptions.value = options;
    return;
  }
  if (!options?.length) {
    selectOptions.value = [];
    return;
  }
  selectOptions.value = options.filter(item => item.label?.includes(query) || item.value?.includes(query));
} 
const remoteMethod = (query: string = '') => {
  isLoading.value = true;
  setSelectOptions(query)
  isLoading.value = false;
}

// 人员、部门字段的选项 label 与 value 不同，需要预加载，否则回显只能显示 id
const preloadSubTypes = ['account', 'department'];
onBeforeMount(() => {
  if (preloadSubTypes.includes(configurations.value?.subType)) {
    setSelectOptions();
  }
});

// 数值转百分比值
const getPercentValue = (value: any) => {
  if (value === "" || value === null || value === undefined) return "";
  if (column.value?.extra?.isPercent) return value * 100;
  return value;
}
// 百分比值转数值
const getNumberValue = (value: number) => {
  if (column.value?.extra?.isPercent) return value / 100;
  return value;
}

const statusOptions = [
  {
    value: ProcessNodeStatus.QUEUED,
    get label() { return i18next.t('commonNocode.queued') },
    color: '#409eff',
  },
  {
    value: ProcessNodeStatus.IN_PROGRESS,
    get label() { return i18next.t('FilterValueFormat.proceeding') },
    color: 'orange',
  },
  {
    value: ProcessNodeStatus.FINISHED,
    get label() { return i18next.t('FilterValueFormat.done') },
    color: '#5ec431',
  },
  {
    value: ProcessNodeStatus.REJECTED,
    get label() { return i18next.t('FilterValueFormat.reject') },
    color: '#f9484e',
  },
  {
    value: ProcessNodeStatus.CANCELED,
    get label() { return i18next.t('FilterValueFormat.revoke') },
    color: '#a1a1a1',
  }
]
</script>

<style lang='scss' scoped>
.filter-value-format {
  // width: 100px;
  :deep(.el-input) {
    .el-input__inner::-webkit-inner-spin-button {
      all: unset;
    }
    .el-input__wrapper {
      border-radius: 4px;
    }
  }

  .number-range {
    display: flex;
    align-items: center;
    column-gap: 4px; 
  }
  :deep(.date-range) {
    border-radius: 4px;
    width: 100%;
  }
  :deep(.el-select__wrapper) {
    .el-select__selection {
      margin: 0;
      .label {
        position: absolute;
        width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &.is-focused .el-select__selection .label {
      opacity: 0;
    }
  }
}
</style>
