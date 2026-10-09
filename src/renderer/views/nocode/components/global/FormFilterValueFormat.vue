<template>
  <div class="filter-value-format">
    <el-config-provider :locale="locale">
      <template v-if="type === RuleFuncValue.RANGE">
        <div class="number-range" v-if="configurations?.subType === 'number'">
          <el-input :disabled="disabled" :model-value="getPercentValue(modelValue[0])" @update:model-value="emit('update:modelValue', [parseNumberValue($event), modelValue[1]])" type="number" :placeholder="$t('FormFilterValueFormat.minVal')" style="width: 75px;">
            <template #suffix v-if="columnField?.meta?.extra?.isPercent">
              <span>%</span>
            </template>
          </el-input> ~
          <el-input :disabled="disabled" :model-value="getPercentValue(modelValue[1])" @update:model-value="emit('update:modelValue', [modelValue[0], parseNumberValue($event)])" type="number" :placeholder="$t('FormFilterValueFormat.maxVal')" style="width: 75px;">
            <template #suffix v-if="columnField?.meta?.extra?.isPercent">
              <span>%</span>
            </template>
          </el-input>
        </div>
        <el-date-picker :disabled="disabled" class="date-range" :value-format="TABLE_DATE_VALUE_FORMAT" range-separator="~" v-else-if="configurations?.subType === 'date'"
         :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :format="'YYYY-MM-DD'"
          :type="rangeDateType"
        />
      </template>
      <template v-else-if="type === RuleFuncValue.DATE">
        <el-date-picker :disabled="disabled" :value-format="TABLE_DATE_VALUE_FORMAT" :format="'YYYY-MM-DD'"
         :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
          :type="dateType"
        />
      </template>
      <template v-else-if="type === RuleFuncValue.TIME">
        <el-time-picker :disabled="disabled" :value-format="TABLE_TIME_VALUE_FORMAT" :format="TABLE_TIME_VALUE_FORMAT"
         :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
          :type="dateType"
        />
      </template>
      <template v-else-if="type === RuleFuncValue.SELECT">
        <div v-if="showOrganizeSelector" class="department-container" @click="handleOpenOrganize()" :style="{ color: modelValue?.length ? 'var(--color-primary)' : 'var(--el-color-text-2)' }">
          {{ modelValue?.length ? $t('FormFilterValueFormat.selected') : $t('FormFilterValueFormat.select') }}{{ configurations?.subType === 'department' ? $t('FormFilterValueFormat.dept') : $t('FormFilterValueFormat.member') }}
        </div>
        <field-select
          :disabled="disabled"
          :model-value="selectOptions.length>0 ? modelValue : undefined"
          @update:model-value="emit('update:modelValue', $event)"
          :empty-values="['', null, undefined]"
          :no-data-text="$t('FormFilterValueFormat.noData')"
          :clearable="true"
          :placeholder="$t('FormFilterValueFormat.plsSelect')"
          :options="selectOptions"
          :props="selectProps"
          v-else
        >
        </field-select>
      </template>
      <template v-else-if="type === RuleFuncValue.SELECT_MULTIPLE">
        <div v-if="showOrganizeSelector" class="department-container" @click="handleOpenOrganize()" :style="{ color: modelValue?.length ? 'var(--color-primary)' : 'var(--el-color-text-2)' }">
          {{ modelValue?.length ? $t('FormFilterValueFormat.selected') : $t('FormFilterValueFormat.select') }}{{ configurations?.subType === 'department' ? $t('FormFilterValueFormat.dept') : $t('FormFilterValueFormat.member') }}
        </div>
        <field-select
          :disabled="disabled"
          :model-value="selectOptions.length>0 ? modelValue : undefined"
          @update:model-value="emit('update:modelValue', $event)"
          :empty-values="['', null, undefined]"
          :collapse-tags="true"
          :no-data-text="$t('FormFilterValueFormat.noData')"
          :multiple="true"
          :clearable="true"
          :options="selectOptions"
          :props="selectProps"
          :placeholder="$t('FormFilterValueFormat.plsSelect')"
          :allowAllCheck="true"
          v-else
        >
        </field-select>
      </template>
      <template v-else-if="type === RuleFuncValue.TAGS">
        <el-input-tag :disabled="disabled" collapse-tags collapse-tags-tooltip tag-type="primary" filterable :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="$t('FormFilterValueFormat.enterAdd')" />
      </template>
      <template v-else-if="type === RuleFuncValue.ADDRESS">
        <el-tree-select :disabled="disabled" class="drop-down" ref="addressRef"
          :modelValue="modelValue"
          @update:model-value="emit('update:modelValue', $event)"
          lazy :load="loadNode" node-key="value"
          :render-after-expand="false"
          clearable filterable check-strictly
          :highlight-current="true" :show-path="true" :no-data-text="$t('FormFilterValueFormat.noData')" :props="{
            label: 'label',
            value: 'value',
            children: 'children',
            isLeaf: 'isLeaf',
          }">
        </el-tree-select>
      </template>
      <el-input :disabled="disabled" :model-value="getPercentValue(modelValue)" @update:model-value="emit('update:modelValue', parseNumberValue($event))" type="number" :placeholder="$t('FormFilterValueFormat.plsInput')" v-else-if="type === RuleFuncValue.NUMBER">
        <template #suffix v-if="columnField?.meta?.extra?.isPercent">
          <span>%</span>
        </template>
      </el-input>
      <date-dynamic-filter-value-select class="dynamic-filter-select" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :append-to="'body'" :teleported="true" v-else-if="configurations?.subType === 'date' && type === RuleFuncValue.STRING">
      </date-dynamic-filter-value-select>
      <el-input :disabled="disabled" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="$t('FormFilterValueFormat.plsInput')" v-else />
    </el-config-provider>

    <teleport to="body">
      <organize-manager-dialog
        ref="organizeManageDialogRef"
        v-if="(type === RuleFuncValue.SELECT || type === RuleFuncValue.SELECT_MULTIPLE) && showOrganizeSelector"
        :isInWidget="true"
        :isShowQuick="false"
        :currentType="configurations?.subType === 'department' ? 'department' : 'member'"
        :dialogTitle="configurations?.subType === 'department' ? $t('FormFilterValueFormat.selectDept') : $t('FormFilterValueFormat.selectMember')"
        :multiple="type != RuleFuncValue.SELECT"
        @confirm="handleClosed"
        :tableList="tableList"
      ></organize-manager-dialog>
    </teleport>
  </div>
</template>

<script lang='ts' setup>
import { computed, ref, reactive, inject } from 'vue';
import { getChinaAddressData } from '@renderer/utils/township';
import { FieldUID, ProcessNodeStatus } from '@common/types/project';
import { FormElementConfiguration, RuleFuncValue } from '@common/types/nocode';
import { isSystemField } from '@common/utils/connection';
import { AbstractForm, FormElement } from '@renderer/b2/controllers/form';
import { getSystemColumnConfigurations } from './table/utils';
import { ORGANIZE_UTIL } from '@renderer/types';
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";
import { formDataApi } from '@renderer/utils';
import DateDynamicFilterValueSelect from './DateDynamicFilterValueSelect.vue';
import { ProcessNodeStatusMapping } from '@common/types/nocode';
import { getTableDatePickerType, getTableDateRangePickerType, TABLE_DATE_VALUE_FORMAT, TABLE_TIME_VALUE_FORMAT } from './table/date-filter';
import { findWidgetSoulByUID } from '@common/utils/element';
import { NocodeProcess, TableUID } from '@common/types/project';
import { getFlowById } from '@common/utils/flow';
import i18next from 'i18next';
import { getUserDisplayName } from '@renderer/utils/other';

const props = withDefaults(defineProps<{
  modelValue: any,
  type: RuleFuncValue,
  fieldId?: string,
  element: FormElement,
  widget: AbstractForm | FormElement,
  selectElementUid: string,
  otherTableFieldUID?: string[],
  disabled?: boolean,
  useDistinctEntityOptions?: boolean,
}>(), {
  disabled: false,
  useDistinctEntityOptions: false,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: any): void
}>();

const organizeManageDialogRef = ref(null)
const organizeUtil = inject(ORGANIZE_UTIL)
const addressRef = ref();
const getConnectionByUID = (connectionUID?: string) => {
  return props.widget.getBoard().getConnections()?.find(c => c.uid === connectionUID) as any;
}
const getConnectionNocodeId = (connectionUID?: string) => {
  return getConnectionByUID(connectionUID)?.nocodeId || props.widget.getBoard().nocodeId;
}
const normalizeIdentifier = (value?: string | null) => {
  if (!value) return "";
  const parts = String(value).split(".").filter(Boolean);
  return parts[parts.length - 1] || String(value);
}
const currentSelectFieldUid = computed(() => normalizeIdentifier(props.selectElementUid));
const currentFieldUid = computed(() => normalizeIdentifier(props.fieldId));
const findFieldByIdentifiers = (fields = []) => {
  const fieldIds = [props.fieldId, props.selectElementUid, currentFieldUid.value, currentSelectFieldUid.value].filter(Boolean);
  return fields.findLast((field: any) => {
    return fieldIds.includes(field?.uid)
      || fieldIds.includes(field?.meta?.uid)
      || fieldIds.includes(field?.meta?.name);
  });
}
const sysColumn = computed(() => {
  if (!props.element && props.fieldId) {
    return findFieldByIdentifiers((props.widget as any).connectionTableFields || []);
  }
})

const columnField = computed(() => {
  if ((props.widget as any).connectionTableFields) {
    return findFieldByIdentifiers((props.widget as any).connectionTableFields || []);
  } else if (props.otherTableFieldUID) {
    const [connectionUID, tableUID] = props.otherTableFieldUID;
    const connections = props.widget.getBoard().getConnections();
    const connection = connections.find(c => c.uid === connectionUID);
    const table = connection?.tables.find(t => t.uid === tableUID);
    if (table) {
      return findFieldByIdentifiers(table.fields || []);
    }
  }
})

const rangeDateType = computed(() => {
  return getTableDateRangePickerType(props.element, columnField.value?.meta?.extra);
})

const dateType = computed(() => {
  return getTableDatePickerType(props.element, columnField.value?.meta?.extra);
})

const systemFieldName = computed(() => {
  return sysColumn.value?.meta?.name || columnField.value?.meta?.name;
});
const currentColumnId = computed(() => {
  return props.element?.uid || currentSelectFieldUid.value || sysColumn.value?.meta?.uid || sysColumn.value?.meta?.name || props.selectElementUid;
});

const resolvedLocalFieldWidget = computed(() => {
  if (props.element) return props.element;
  const fieldUid = currentSelectFieldUid.value || currentFieldUid.value;
  if (!fieldUid) return null;
  return props.widget?.topForm?.getChildElement?.(fieldUid) || null;
});

const configurations = computed(() => {
  if (!props.element && !resolvedLocalFieldWidget.value) {
    return getSystemColumnConfigurations(systemFieldName.value);
  }
  return (props.element || resolvedLocalFieldWidget.value).getConfigurations();
});

const showOrganizeSelector = computed(() => {
  return ['department', 'account'].includes(configurations.value?.subType) && !!props.element && !props.useDistinctEntityOptions;
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
const cacheSelectOptions = reactive({});
const selectedAccountOptionsCache = reactive({});
const selectedAccountUsersCache = reactive({});
const normalizeDistinctValue = (item: any) => {
  if (item && typeof item === 'object') {
    return item.id ?? item.value ?? item.uid ?? item.accountId ?? item.departmentId ?? item.key;
  }
  return item;
};
const normalizeCurrentValues = (value: any) => {
  return (Array.isArray(value) ? value : [value])
    .map(item => normalizeDistinctValue(item))
    .filter(item => item !== undefined && item !== null && item !== '');
};
const buildDefaultOption = (item: any) => {
  const value = normalizeDistinctValue(item);
  return {
    label: value,
    value,
  };
};
const buildAccountOptionById = async (value: string | number) => {
  const account = await props.widget.getBoard().getOrganizationAccount(String(value));
  return {
    label: getUserDisplayName(account, i18next.t('FilterValueFormat.unknownMember')),
    value,
  };
};
const loadAccountById = async (value: string | number) => {
  return await props.widget.getBoard().getOrganizationAccount(String(value));
};
const mergeAccountOptions = (columnId: string, options = []) => {
  const mergedMap = new Map<string, any>();
  [...options, ...(selectedAccountOptionsCache[columnId] || [])].forEach((item) => {
    mergedMap.set(String(item.value), item);
  });
  return Array.from(mergedMap.values());
};
const syncSelectedAccountOptions = async (columnId: string, options = []) => {
  if (configurations.value?.subType !== 'account') {
    selectedAccountOptionsCache[columnId] = [];
    return;
  }
  const currentValues = normalizeCurrentValues(props.modelValue);
  if (!currentValues.length) {
    selectedAccountOptionsCache[columnId] = [];
    return;
  }
  const missingValues = currentValues.filter(value => {
    return !options.some(item => String(item.value) === String(value));
  });
  if (!missingValues.length) {
    selectedAccountOptionsCache[columnId] = [];
    return;
  }
  selectedAccountOptionsCache[columnId] = await Promise.all(
    missingValues.map(async (value) => await buildAccountOptionById(value))
  );
};
const syncSelectedAccountUsers = async (columnId: string, values = []) => {
  if (configurations.value?.subType !== 'account') {
    selectedAccountUsersCache[columnId] = [];
    return;
  }
  const missingValues = values.filter(value => {
    return !organizeUtil?.users?.some(user => user.id === value);
  });
  if (!missingValues.length) {
    selectedAccountUsersCache[columnId] = [];
    return;
  }
  selectedAccountUsersCache[columnId] = (await Promise.all(
    missingValues.map(async (value) => await loadAccountById(value))
  )).filter(Boolean);
};
const loadDistinctOptions = async (columnId: string, searchNocodeId: string, searchTableUID: TableUID, searchField: FieldUID) => {
  const res = await formDataApi.distinct({
    nocodeId: searchNocodeId,
    tableUID: searchTableUID,
    columnId: searchField,
  });
  const values = (res || [])
    .map(item => normalizeDistinctValue(item))
    .filter(item => item !== undefined && item !== null && item !== '');
  if (configurations.value?.subType === 'account') {
    cacheSelectOptions[columnId] = await Promise.all(values.map(async item => {
      return await buildAccountOptionById(item);
    }));
    return;
  }
  if (configurations.value?.subType === 'department') {
    cacheSelectOptions[columnId] = await Promise.all(values.map(async item => {
      const department = await props.widget.getBoard().getOrganizationDepartment(String(item));
      return {
        label: department?.name || i18next.t('FilterValueFormat.unknownDep'),
        value: item,
      };
    }));
    return;
  }
  if (configurations.value?.subType === 'node') {
    const [connectionUID, tableUID] = props.otherTableFieldUID || (props.widget as AbstractForm & {
      otherTableFieldUID?: string[];
    }).otherTableFieldUID || [];
    const process = getConnectionByUID(connectionUID)?.formOptions?.[tableUID]?.process as NocodeProcess | undefined;
    const flowVersions = Object.values(process?.flowsByVersion || {});
    cacheSelectOptions[columnId] = values.map(item => ({
      label: flowVersions
        .map(flows => getFlowById(flows, String(item)))
        .find(Boolean)?.options?.name || String(item),
      value: item,
    }));
    return;
  }
  cacheSelectOptions[columnId] = (res || []).map(item => buildDefaultOption(item));
};

const selectOptions = computed(() => {
  const columnId = currentColumnId.value;
  if (cacheSelectOptions[columnId]) {
    if (configurations.value?.subType === 'account') {
      void syncSelectedAccountOptions(columnId, cacheSelectOptions[columnId]);
      return mergeAccountOptions(columnId, cacheSelectOptions[columnId]);
    }
    return cacheSelectOptions[columnId];
  }
  // 拿关联表单的数据
  const [connectionUID, tableUID] = props.otherTableFieldUID || (props.widget as any).otherTableFieldUID;
  const connection = getConnectionByUID(connectionUID);
  const mainTable = connection?.tables?.find(t => t.uid === tableUID);
  if (!connection || !mainTable) {
    return [];
  }
  // 如果是子表需要在子表中获取下拉的option值
  const currentFieldId = props.fieldId?.split(".");
  const subTableField = mainTable.fields?.find(f => f.uid === currentFieldId?.[0]);
  const searchTableUID = subTableField?.meta?.extra?.subTableUID ? subTableField.meta.extra.subTableUID[1] : tableUID;
  const searchField = currentFieldId?.length > 1
    ? currentFieldId?.[1] as FieldUID
    : currentFieldId?.[0] as FieldUID || mainTable.fields?.find(f => [columnId, currentSelectFieldUid.value, currentFieldUid.value].includes(f.meta.uid) || [columnId, currentSelectFieldUid.value, currentFieldUid.value].includes(f.meta.name) || [columnId, currentSelectFieldUid.value, currentFieldUid.value].includes(f.uid))?.uid;
  const searchNocodeId = getConnectionNocodeId(connectionUID);
  if (!searchField) {
    return [];
  }

  if (isSystemField(subTableField)) {
    if (configurations.value?.subType === "status") {
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
      void loadDistinctOptions(columnId, searchNocodeId, searchTableUID, searchField);
    }
  } else {
    const formOption = connection.formOptions?.[tableUID];
    const widgetIdentifiers = [columnId, currentSelectFieldUid.value, currentFieldUid.value].filter(Boolean);
    const fieldWidget =
      widgetIdentifiers.map(id => findWidgetSoulByUID([formOption?.widget as any], id)).find(Boolean) ||
      findWidgetSoulByUID([formOption?.widget as any], subTableField?.meta?.uid);
    if (!fieldWidget) {
      void loadDistinctOptions(columnId, searchNocodeId, searchTableUID, searchField);
      return cacheSelectOptions[columnId] || [];
    }
    void (async () => {
      switch (fieldWidget.type) {
          case "widget.form.treeSelect": // 下拉单选
            if (fieldWidget.options['select-choices-type'] === 'custom') {
              const options = (fieldWidget.options['treeselect-value-text-option'] as any)?.options?.map(item => ({ label: item.value, value: item.value })) || [];
              if (options.length > 0) {
                cacheSelectOptions[columnId] = options;
                break;
              }
            }
            await loadDistinctOptions(columnId, searchNocodeId, searchTableUID, searchField);
            break;
          case "widget.form.treeMultipleSelect": // 下拉多选
            if (fieldWidget.options['select-choices-type'] === 'custom') {
              const options = (fieldWidget.options['treeselect-value-text-option'] as any)?.options?.map(item => ({ label: item.value, value: item.value })) || [];
              if (options.length > 0) {
                cacheSelectOptions[columnId] = options;
                break;
              }
            }
            await loadDistinctOptions(columnId, searchNocodeId, searchTableUID, searchField);
            break;
          case "widget.form.radioGroup": // 单选
            {
              const options = (fieldWidget.options['radiogroup-value-text-color-option'] as any)?.options?.map(item => ({ label: item.value, value: item.value })) || [];
              if (options.length > 0) {
                cacheSelectOptions[columnId] = options;
                break;
              }
              await loadDistinctOptions(columnId, searchNocodeId, searchTableUID, searchField);
            }
            break;
          case "widget.form.checkboxGroup": // 多选
            {
              const options = (fieldWidget.options['checkbox-option'] as any)?.options?.map(item => ({ label: item.value, value: item.value })) || [];
              if (options.length > 0) {
                cacheSelectOptions[columnId] = options;
                break;
              }
              await loadDistinctOptions(columnId, searchNocodeId, searchTableUID, searchField);
            }
            break;
          case "widget.form.departmentSelect": {
            if (props.useDistinctEntityOptions) {
              await loadDistinctOptions(columnId, searchNocodeId, searchTableUID, searchField);
              break;
            }
            const departmentRes = organizeUtil?.departments?.length ? organizeUtil.departments : await props.widget.getBoard().getOrganizeDepartments();
            if (departmentRes.length > 0) {
              cacheSelectOptions[columnId] = departmentRes.map(item => ({ label: item.name, value: item.id }));
              break;
            }
            await loadDistinctOptions(columnId, searchNocodeId, searchTableUID, searchField);
            break;
          }
          case "widget.form.memberSelect": {
            if (props.useDistinctEntityOptions) {
              await loadDistinctOptions(columnId, searchNocodeId, searchTableUID, searchField);
              break;
            }
            const userRes = organizeUtil?.users?.length ? organizeUtil.users : await props.widget.getBoard().getOrganizeUsers();
            if (userRes.length > 0) {
              cacheSelectOptions[columnId] = userRes.map(item => ({ label: getUserDisplayName(item, i18next.t('FilterValueFormat.unknownMember')), value: item.id }));
              break;
            }
            await loadDistinctOptions(columnId, searchNocodeId, searchTableUID, searchField);
            break;
          }
          default:
            await loadDistinctOptions(columnId, searchNocodeId, searchTableUID, searchField);
            break;
        }
    })();
  }
  const options = cacheSelectOptions[columnId] || [];
  if (configurations.value?.subType === 'account') {
    void syncSelectedAccountOptions(columnId, options);
    return mergeAccountOptions(columnId, options);
  }
  return options;
});

const columnType = computed(() => {
  const columnId = props.element?.uid || currentSelectFieldUid.value || currentFieldUid.value || sysColumn.value?.meta?.uid || sysColumn.value?.meta?.name;
  if (resolvedLocalFieldWidget.value) return resolvedLocalFieldWidget.value.type;
  // 拿关联表单的数据
  const [connectionUID, tableUID] = props.otherTableFieldUID || (props.widget as any).otherTableFieldUID;
  const connection = getConnectionByUID(connectionUID);
  let formOption = connection?.formOptions?.[tableUID];
  if (!formOption?.widget?.widgets) return undefined;
  const type = findWidgetSoulByUID([formOption.widget as any], columnId)?.type;
  return type;
})

const parseNumberValue = (value: string | number | null | undefined) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const nextValue = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(nextValue)) {
    return null;
  }
  return getNumberValue(nextValue);
}

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

const buildDebugUsersByIds = (stage: string, userIds: any[] = [], columnId = currentColumnId.value) => {
  const normalizedUserIds = normalizeCurrentValues(userIds);
  const organizeUsers = organizeUtil?.allUsers?.length ? organizeUtil.allUsers : (organizeUtil?.users || []);
  const cachedUsers = selectedAccountUsersCache[columnId] || [];
  const matchedUsers = normalizedUserIds.map(item => {
    return organizeUsers.find(user => user.id === item)
      || cachedUsers.find(user => user.id === item);
  }).filter(Boolean);

  return matchedUsers;
}

const handleOpenOrganize = () => {
  if (configurations.value?.subType === 'account') {
    buildDebugUsersByIds('handleOpenOrganize');
  }
  organizeManageDialogRef.value.show();
}

const handleClosed = (data) => {
  let inputValue = []
  if (configurations.value?.subType === "department") {
    inputValue = data.departments.map(item => item.id);
  } else {
    inputValue = data.users.map((user)=> user.id);
  }
  emit('update:modelValue', props.type === RuleFuncValue.SELECT ? inputValue.length ? inputValue[0] : '' : inputValue);
}

const tableList = computed(() => {
  const columnId = currentColumnId.value;
  let value
  if(props.type !== RuleFuncValue.SELECT) {
    value = props.modelValue || [];
  } else {
    value = props.modelValue ? [props.modelValue] : [];
  }
  let inputValue = {
    departments: [],
    roles: [],
    users: [],
    dynamic: [],
  }
  if (configurations.value?.subType === "department") {
    inputValue.departments = (value || []).map(item => organizeUtil.departments.find(department => department.id === item));
  } else {
    const currentValues = normalizeCurrentValues(value);
    void syncSelectedAccountUsers(columnId, currentValues);
    inputValue.users = buildDebugUsersByIds('tableList.users', currentValues, columnId);
  }
  return inputValue
})
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

  .department-container {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: 4px;
    border: 1px solid #DCDFE6;
    height: 32px;
    border-radius: 4px;
    background-color: #fff;
    cursor: pointer;

    &:hover {
      border-color: #409EFF;
      color: #409EFF;
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
