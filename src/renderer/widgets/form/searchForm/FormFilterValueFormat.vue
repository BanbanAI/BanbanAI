<template>
  <div class="filter-value-format">
    <template v-if="type === RuleFuncValue.RANGE">
      <div class="number-range" v-if="configurations?.subType === 'number'">
        <el-input :model-value="getPercentValue(modelValue[0])" @update:model-value="emit('update:modelValue', [getNumberValue(Number($event)), modelValue[1]])" type="number" :placeholder="$t('minValue')" style="width: 100px;">
          <template #suffix v-if="columnField?.meta?.extra?.isPercent">
            <span>%</span>
          </template>
        </el-input> ~
        <el-input :model-value="getPercentValue(modelValue[1])" @update:model-value="emit('update:modelValue', [modelValue[0], getNumberValue(Number($event))])" type="number" :placeholder="i18next.t('maxValue')" style="width: 100px;">
          <template #suffix v-if="columnField?.meta?.extra?.isPercent">
            <span>%</span>
          </template>
        </el-input>
      </div>
      <el-date-picker class="date-range" :value-format="'YYYY-MM-DD HH:mm:ss'" range-separator="~" v-else-if="configurations?.subType === 'date'"
       :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :format="'YYYY-MM-DD'"
        type="daterange"
      />
    </template>
    <template v-else-if="type === RuleFuncValue.DATE">
      <el-date-picker :value-format="'YYYY-MM-DD HH:mm:ss'" :format="'YYYY-MM-DD'"
       :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
        type="date"
      />
    </template>
    <template v-else-if="type === RuleFuncValue.TIME">
      <el-time-picker :value-format="'HH:mm:ss'" :format="'HH:mm:ss'"
       :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
      />
    </template>
    <template v-else-if="type === RuleFuncValue.SELECT">
      <field-select
        :model-value="selectOptions.length>0 ? modelValue : undefined"
        @update:model-value="emit('update:modelValue', $event)"
        :no-data-text="i18next.t('noData')"
        :clearable="true"
        :placeholder="i18next.t('pleaseSelect')"
        :options="selectOptions"
        :props="selectProps"
      >
      </field-select>
    </template>
    <template v-else-if="type === RuleFuncValue.SELECT_MULTIPLE">
      <field-select
        :model-value="selectOptions.length>0 ? modelValue : undefined"
        @update:model-value="emit('update:modelValue', $event)"
        :collapse-tags="true"
        :no-data-text="i18next.t('noData')"
        :multiple="true"
        :clearable="true"
        :options="selectOptions"
        :props="selectProps"
        :placeholder="i18next.t('pleaseSelect')"
      >
      </field-select>
    </template>
    <template v-else-if="type === RuleFuncValue.TAGS">
      <el-input-tag collapse-tags collapse-tags-tooltip tag-type="primary" filterable :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="i18next.t('enterToAddValue')" />
    </template>
    <template v-else-if="type === RuleFuncValue.ADDRESS">
      <el-tree-select class="drop-down" ref="addressRef"
        :modelValue="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        lazy :load="loadNode" node-key="value"
        :render-after-expand="false"
        clearable filterable check-strictly
        :highlight-current="true" :show-path="true" :no-data-text="i18next.t('noData')" :props="{
          label: 'label',
          value: 'value',
          children: 'children',
          isLeaf: 'isLeaf',
        }">
      </el-tree-select>
    </template>
    <el-input :model-value="getPercentValue(modelValue)" @update:model-value="emit('update:modelValue', getNumberValue(Number($event)))" type="number" :placeholder="i18next.t('pleaseInput')" v-else-if="type === RuleFuncValue.NUMBER">
      <template #suffix v-if="columnField?.meta?.extra?.isPercent">
        <span>%</span>
      </template>
    </el-input>
    <date-dynamic-filter-value-select class="dynamic-filter-select" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :append-to="'body'" :teleported="true" v-else-if="configurations?.subType === 'date' && type === RuleFuncValue.STRING">
    </date-dynamic-filter-value-select>
    <el-input :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="i18next.t('pleaseInput')" v-else />
  </div>
</template>

<script lang='ts' setup>
import { FieldUID, ProcessNodeStatus } from '@common/types/project';
import { FormElementConfiguration, RuleFuncValue, ProcessNodeStatusMapping } from '@common/types/nocode';
import { getSystemColumnConfigurations } from '@common/utils/connection';
import { FormElement } from '@renderer/b2/controllers/form';
import { getChinaAddressData } from '@renderer/utils/township';
import { computed, ref, reactive, watch } from 'vue';
import { SearchForm } from './searchForm';
import { fetchDistinct } from '../_common/distinct';
import i18next, { $t } from "@renderer/widgets/i18next";
import axios from "axios";

const props = defineProps<{
  modelValue: any,
  type: RuleFuncValue,
  fieldId: FieldUID,
  element: FormElement,
  widget: SearchForm,
  selectElementUid: string,
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: any): void
}>();

const addressRef = ref();
const sysColumn = computed(() => {
  if (!props.element && props.fieldId) {
    return props.widget.selectSearchFormFields.findLast(item => item.uid === props.fieldId);
  }
})
const columnField = computed(() => {
  return props.widget.selectSearchFormFields.findLast(item => item.uid === props.fieldId);
})
const configurations = computed(() => {
  if (!props.element) {
    return getSystemColumnConfigurations(sysColumn.value?.meta?.name);
  }
  return props.element.getConfigurations();
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
  const townshipData = await getChinaAddressData();
  if (!node?.label) {
    resolve(townshipData.map(({ children, ...rest }) => ({
      ...rest,
      isLeaf: !children || children.length === 0
    })));
  } else if (node.data?.value) {
    const match = findNodeByValue(townshipData, node.data.value);

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
const selectOptions = computed(() => {
  const columnId = props.element?.uid || props.selectElementUid || sysColumn.value?.meta?.name;
  if (cacheSelectOptions[columnId]) return cacheSelectOptions[columnId];
  const [connectionUID, tableUID] = props.widget.selectSearchForm;
  const connections = props.widget.getBoard().getConnections();
  const connection = connections.find(c => c.uid === connectionUID);
  let table = connection.tables.find(t => t.uid === tableUID);
  for(const field of table.fields) {
    // 子表单的字段要在子表单中查询
    const subTable = connection.tables.find(t => t.uid === field.meta?.extra?.subTableUID?.[1]);
    if (field.meta.subType === "subForm" && subTable?.fields?.find(sItem => sItem.meta?.uid === columnId)) {
      table = connection.tables.find(t => t.meta?.name.includes(field.meta.uid));
      break;
    }
  }
  const columnField = table.fields.find(field => field.meta.uid === columnId)
  fetchDistinct({
    nocodeId: (connection as any)?.nocodeId || props.widget.getBoard().nocodeId,
    tableUID: table.uid,
    columnId: columnField.uid,
  }, axios).then(async (data) => {
    if (data) {
      if (configurations.value.subType === "account") {
        cacheSelectOptions[columnId] = await Promise.all(data?.map(async (item) => {
          const account = await props.widget.getBoard().getOrganizationAccount(item);
          const label = account?.realname || account?.user || i18next.t("unknownMember");
          return {
            label,
            value: item,
          }
        }))
      } else if (configurations.value.subType === "department") {
        cacheSelectOptions[columnId] = await Promise.all(data?.map(async item => {
          const department = await props.widget.getBoard().getOrganizationDepartment(item)
          return {
            label: department?.name || i18next.t("unknownDepartment"),
            value: item,
          }
        }))
      } else if (configurations.value.subType === "status") {
        const statusOptions = [
          {
            value: ProcessNodeStatus.QUEUED,
            label: ProcessNodeStatusMapping[ProcessNodeStatus.QUEUED],
            color: '#409eff',
          },
          {
            value: ProcessNodeStatus.IN_PROGRESS,
            label: ProcessNodeStatusMapping[ProcessNodeStatus.IN_PROGRESS],
            color: 'orange',
          },
          {
            value: ProcessNodeStatus.FINISHED,
            label: ProcessNodeStatusMapping[ProcessNodeStatus.FINISHED],
            color: '#5ec431',
          },
          {
            value: ProcessNodeStatus.REJECTED,
            label: ProcessNodeStatusMapping[ProcessNodeStatus.REJECTED],
            color: '#f9484e',
          },
          {
            value: ProcessNodeStatus.CANCELED,
            label: ProcessNodeStatusMapping[ProcessNodeStatus.CANCELED],
            color: '#a1a1a1',
          }
        ]

        cacheSelectOptions[columnId] = statusOptions;
      } else {
        cacheSelectOptions[columnId] = data?.map(item => ({ label: item, value: item }));
      }
    }
  }).catch((err) => {
    console.log("error", err)
  })
  return cacheSelectOptions[columnId] || [];
});

const columnType = computed(() => {
  const columnId = props.element?.uid || props.selectElementUid || sysColumn.value?.meta?.name;
  // 拿关联表单的数据
  const [connectionUID, tableUID] = props.widget.selectSearchForm;
  const connections = props.widget.getBoard().getConnections();
  const connection = connections.find(c => c.uid === connectionUID);
  let formOption = connection.formOptions[tableUID];
  const type = formOption.widget.widgets.filter(item => item.uid === columnId)[0]?.type;
  return type;
})

// 数值转百分比值
const getPercentValue = (value: number) => {
  if (columnField.value?.meta?.extra?.isPercent) return value * 100;
  return value;
}
// 百分比值转数值
const getNumberValue = (value: number) => {
  if (columnField.value?.meta?.extra?.isPercent) return value / 100;
  return value;
}
</script>

<style lang='scss' scoped>
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
  :deep(.el-select__wrapper) {
    .el-select__selection {
      margin: 0;
      .label {
        position: absolute;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &.is-focused .el-select__selection .label {
      opacity: 0;
    }
  }

  :deep(.dynamic-filter-select) {
    width: 100%;
    background-color: #fff;
    font-size: 12px;
    .show-type-popover-btn {
      border: none !important;
      background-color: var(--bg-color-overlay) !important;
    }
    .el-input__wrapper {
      width: auto !important;
      border-radius: 4px !important;
      background-color: var(--bg-color-overlay) !important;
    }
  }
}
</style>
