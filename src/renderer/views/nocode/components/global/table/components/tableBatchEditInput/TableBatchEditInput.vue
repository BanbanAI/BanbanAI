<template>
  <template v-if="[FormWidgetType.DEPARTMENT_SELECT, FormWidgetType.MEMBER_SELECT].includes(widgetType)">
    <div
      class="department-container"
      :class="{ disabled }"
      @click="!disabled && handleOpenOrganize()"
      :style="{ 
        color: (modelValue && modelValue.length) ? 'var(--color-primary)' : 'var(--el-color-text-2)'
      }"
    >
      {{
        (modelValue && modelValue.length)
        ? $t('TableBatchEditDialog.selected') 
        : $t('TableBatchEditDialog.select')
      }}{{
        widgetType === FormWidgetType.DEPARTMENT_SELECT
        ? $t('TableBatchEditDialog.dept')
        : $t('TableBatchEditDialog.member')
      }}
    </div>
  </template>
  <template v-else-if="[FormWidgetType.DATE_RANGE_PICKER].includes(widgetType)">
    <el-config-provider :locale="elementPlusLocale">
      <el-date-picker
        :model-value="modelValue"
        :disabled="disabled"
        @update:model-value="(value: any) => emit('change', value)"
        class="value-input"
        :prefix-icon="Calendar"
        :type="dateRangePickerType"
        :format="dateRangePickerFormat"
        :value-format="dateValueFormat"
        range-separator="-"
        :start-placeholder="$t('TableBatchEditDialog.choose')"
        :end-placeholder="$t('TableBatchEditDialog.choose')"
      />
    </el-config-provider>
  </template>
  <template v-else-if="[FormWidgetType.DATE_PICKER].includes(widgetType)">
    <el-config-provider :locale="elementPlusLocale">
      <el-date-picker
        :model-value="modelValue"
        :disabled="disabled"
        @update:model-value="(value: any) => emit('change', value)"
        class="value-input"
        :prefix-icon="Calendar"
        :type="datePickerType"
        :format="datePickerFormat"
        :value-format="dateValueFormat"
        :placeholder="$t('TableBatchEditDialog.choose')"
      />
    </el-config-provider>
  </template>
  <template v-else-if="[FormWidgetType.TIME_PICKER].includes(widgetType)">
    <el-config-provider :locale="elementPlusLocale">
      <el-time-picker
        :model-value="modelValue"
        :disabled="disabled"
        @update:model-value="(value: any) => emit('change', value)"
        class="value-input"
        :format="timePickerFormat"
        :value-format="timeValueFormat"
        :placeholder="$t('TableBatchEditDialog.choose')"
      />
    </el-config-provider>
  </template>
  <template
    v-else-if="
      [
        FormWidgetType.TREE_MULTIPLE_SELECT,
        FormWidgetType.CHECKBOX_GROUP,
        FormWidgetType.TREE_SELECT,
        FormWidgetType.RADIO_GROUP,
      ].includes(widgetType)
    "
  >
    <el-select
      class="value-input"
      :model-value="modelValue"
      :disabled="disabled"
      @update:model-value="(value: any) => emit('change', value)"
      :multiple="[FormWidgetType.TREE_MULTIPLE_SELECT, FormWidgetType.CHECKBOX_GROUP].includes(widgetType)"
      collapse-tags
      :placeholder="$t('TableBatchEditDialog.choose')"
    >
      <el-option
        v-for="item in options"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
  </template>
  <el-select
    v-else-if="widgetType === FormWidgetType.HYPERLINK && hyperlinkLinkType === 'form'"
    class="value-input"
    :model-value="modelValue"
    :disabled="disabled"
    :loading="hyperlinkFormOptionsLoading"
    @update:model-value="(value: string) => emit('change', value)"
    :placeholder="$t('TableBatchEditDialog.choose')"
  >
    <el-option
      v-for="item in hyperlinkFormOptions"
      :key="item.value"
      :label="item.label"
      :value="item.value"
    />
  </el-select>
  <el-input
    class="value-input"
    v-else-if="[
      FormWidgetType.NUMBER_INPUT,
      FormWidgetType.AMOUNT_INPUT,
    ].includes(widgetType)"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="(value: any) => emit('change',value)"
    :placeholder="$t('TableBatchEditDialog.input')"
    oninput="value = value.replace(/[^0-9.]/g, '')"
    @blur="handleBlur"
  ></el-input>
  <el-input
    v-else
    class="value-input"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="(value: any) => emit('change',value)"
    :placeholder="$t('TableBatchEditDialog.input')"
  ></el-input>
  <teleport to="body">
    <organize-manager-dialog
      ref="organizeManageDialogRef"
      :isInWidget="true"
      :isShowQuick="false"
      :currentType="organizeDialogProps.type"
      :dialogTitle="organizeDialogProps.title"
      :multiple="true"
      @confirm="handleOrganizeConfirm"
      :tableList="organizeDialogProps.tableList"
    />
  </teleport>
</template>

<script lang="ts" setup>
import { computed, inject, ref, watch } from 'vue';
import { findWidgetSoulByUID } from '@common/utils/element';
import { Field, FieldUID, OptionFieldUID, TableUID } from '@common/types/project';
import { ORGANIZE_UTIL } from '@renderer/types';
import i18next from 'i18next';
import { Calendar } from '@element-plus/icons-vue';
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale'
import { formatFloat } from "@common/utils/math";
import { formDataApi } from '@renderer/utils';
import { useTable } from '../../hooks';
import { FormWidgetType } from "@common/types/nocode";
import { getTableDateDisplayFormat, getTableDatePickerType, getTableDateRangePickerType, getTableTimeDisplayFormat, TABLE_DATE_VALUE_FORMAT, TABLE_TIME_VALUE_FORMAT } from '../../date-filter';

const organizeUtil = inject(ORGANIZE_UTIL);
const props = defineProps({
  modelValue: {
    type: String,
    default: () => '',
  },
  field: {
    type: Object as () => Field,
    default: () => {}
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(['change']);
const table = useTable();
const widgetField = computed(() => {
  const uid = props.field?.meta?.uid;
  const soul = table.form?.getSoul();
  if (!soul || !uid) {
    return null;
  }
  // 字段组件不一定挂在表单第一层，这里递归查找真实 widget 配置
  return findWidgetSoulByUID([soul as any], uid) as any;
})

const subType = computed(() => {
  return props.field?.meta?.subType || '';
})
const getFieldWidgetType = (field: Field) => {
  return field?.meta?.extra?.widgetType || '';
}
const widgetType = computed(() => {
  return getFieldWidgetType(props.field) as FormWidgetType;
})
const hyperlinkLinkType = computed(() => {
  return props.field?.meta?.extra?.linkType || 'text';
})
const hyperlinkFormOptions = ref<Array<{ label: string, value: string }>>([]);
const hyperlinkFormOptionsLoading = ref(false);
const loadHyperlinkFormOptions = async () => {
  const widgetUID = props.field?.meta?.uid;
  if (widgetType.value !== FormWidgetType.HYPERLINK || hyperlinkLinkType.value !== 'form' || !widgetUID) {
    hyperlinkFormOptions.value = [];
    hyperlinkFormOptionsLoading.value = false;
    return;
  }

  hyperlinkFormOptionsLoading.value = true;
  try {
    const form = await table.ensureFormReady();
    if (props.field?.meta?.uid !== widgetUID) return;
    const widget = form?.getChildElement(widgetUID) as unknown as {
      tableChoices?: Array<{ label: string, value: string }>,
    };
    hyperlinkFormOptions.value = Array.isArray(widget?.tableChoices) ? widget.tableChoices : [];
  } catch (_) {
    if (props.field?.meta?.uid === widgetUID) {
      hyperlinkFormOptions.value = [];
    }
  } finally {
    if (props.field?.meta?.uid === widgetUID) {
      hyperlinkFormOptionsLoading.value = false;
    }
  }
}
const widgetOptions = computed(() => {
  return {
    'date-format': 'datetime',
    'time-precision': TABLE_TIME_VALUE_FORMAT,
    ...(widgetField.value?.options || {})
  };
})
const dateRangePickerType = computed(() => {
  return getTableDateRangePickerType(undefined, widgetOptions.value);
})
const datePickerType = computed(() => {
  return getTableDatePickerType(undefined, widgetOptions.value);
})
const timePickerFormat = computed(() => {
  return getTableTimeDisplayFormat(undefined, widgetOptions.value);
})
const dateValueFormat = TABLE_DATE_VALUE_FORMAT;
const timeValueFormat = TABLE_TIME_VALUE_FORMAT;
const dateRangePickerFormat = computed(() => {
  return getTableDateDisplayFormat(undefined, widgetOptions.value);
})
const datePickerFormat = computed(() => {
  return getTableDateDisplayFormat(undefined, widgetOptions.value);
})
const isDepartment = computed(() => {
  return subType.value === 'department';
})
const isAccount = computed(() => {
  return subType.value === 'account';
})
const getOptionValue = (item: any) => {
  return item?.value ?? item?.id ?? item?.uid ?? item?.key ?? item?.label ?? item?.name ?? item?.alias ?? item?.text;
}
const getOptionLabel = (item: any) => {
  const value = item?.value;
  if (value !== null && value !== undefined && `${value}`.trim() !== '') {
    return `${value}`;
  }
  const label = item?.label ?? item?.name ?? item?.alias ?? item?.text ?? item?.id ?? item?.uid ?? item?.key;
  return label === null || label === undefined ? '' : `${label}`;
}
const normalizeDistinctValue = (item: any) => {
  if (item && typeof item === 'object') {
    return item.id ?? item.value ?? item.uid ?? item.accountId ?? item.departmentId ?? item.key;
  }
  return item;
}
const normalizeOptionItems = (items: any[] = [], prefix = ''): Array<{ label: string, value: any }> => {
  return items.flatMap((item: any) => {
    if (!item) return [];
    const currentLabel = getOptionLabel(item);
    const label = prefix && currentLabel ? `${prefix} / ${currentLabel}` : (currentLabel || prefix);
    if (Array.isArray(item.children) && item.children.length > 0) {
      // 树形选项在批量修改里展开为普通下拉项，便于统一渲染
      return normalizeOptionItems(item.children, label);
    }
    return [{
      label: label || `${getOptionValue(item) ?? ''}`,
      value: getOptionValue(item),
    }];
  });
}
const getStaticChoiceItems = () => {
  const currentWidgetOptions = widgetField.value?.options || {};
  const fallbackChoices = props.field?.meta?.extra?.choices || [];
  if ([FormWidgetType.TREE_SELECT, FormWidgetType.TREE_MULTIPLE_SELECT].includes(widgetType.value)) {
    return currentWidgetOptions['treeselect-value-text-option']?.options || fallbackChoices;
  }
  if (widgetType.value === FormWidgetType.RADIO_GROUP) {
    return currentWidgetOptions['radiogroup-value-text-color-option']?.options || fallbackChoices;
  }
  if (widgetType.value === FormWidgetType.CHECKBOX_GROUP) {
    return currentWidgetOptions['checkbox-option']?.options || fallbackChoices;
  }
  return fallbackChoices;
}
const getLinkedOptionFieldUID = () => {
  // 下拉选项源优先以 widget 配置为准，避免误用 extra 里的其他跨表字段配置
  const widgetOptionField = widgetField.value?.options?.['other-table-field'];
  if (typeof widgetOptionField === 'string') {
    return widgetOptionField.split('.').filter(Boolean) as OptionFieldUID;
  }

  const fallbackOptionFieldUID = props.field?.meta?.extra?.otherTableFieldUID;
  if (!Array.isArray(fallbackOptionFieldUID) || fallbackOptionFieldUID.length < 3) {
    return [] as string[];
  }

  return fallbackOptionFieldUID as OptionFieldUID;
}
const getCrossAppStoredNocodeId = (tableUID?: string) => {
  if (!tableUID) return undefined;
  const forms = table.nocodeBody?.settings?.crossApp?.forms || [];
  return forms.find((item: any) => item?.tableUID === tableUID)?.nocodeId;
}
const getLinkedOptionMeta = (linkedOptionFieldUID: OptionFieldUID, formInstance = table.form) => {
  const [connectionUID, tableUID] = linkedOptionFieldUID;
  const currentConnectionUID = formInstance?.tableUID?.[0];
  const connections = formInstance?.getBoard().getConnections?.() || [];

  const liveConnection = connections.find((item: any) => item?.uid === connectionUID);
  const liveTable = liveConnection?.tables?.find((item: any) => item?.uid === tableUID);

  // 参考 getOtherTableMeta：
  // 先查运行时已挂载的数据源，再回退到跨应用 schema 和 crossApp 设置里的 nocodeId。
  const schemaConnection = (!liveConnection || !liveTable)
    ? table.nocodeBody?.otherDataSourceSchemas?.find((item: any) => item?.uid === connectionUID)
    : null;
  const schemaTable = schemaConnection?.tables?.find((item: any) => item?.uid === tableUID);

  const connection = liveConnection || schemaConnection;
  const sourceTable = liveTable || schemaTable;
  const isCurrentConnection = !!connectionUID && connectionUID === currentConnectionUID;
  const nocodeId = connection?.nocodeId || (isCurrentConnection ? table.nocodeId : getCrossAppStoredNocodeId(tableUID));

  return {
    connection,
    table: sourceTable,
    nocodeId,
  };
}
const options = ref<Array<{ label: string, value: any }>>([]);
const loadOptions = async () => {
  if (!props.field) {
    options.value = [];
    return;
  }

  if (![
    FormWidgetType.TREE_MULTIPLE_SELECT,
    FormWidgetType.CHECKBOX_GROUP,
    FormWidgetType.TREE_SELECT,
    FormWidgetType.RADIO_GROUP,
  ].includes(widgetType.value)) {
    options.value = [];
    return;
  }

  const form = await table.ensureFormReady();

  const linkedOptionFieldUID = getLinkedOptionFieldUID();
  if (linkedOptionFieldUID.length >= 3) {
    const [, tableUID, fieldUID] = linkedOptionFieldUID;
    const sourceInfo = getLinkedOptionMeta(linkedOptionFieldUID as OptionFieldUID, form);
    const nocodeId = sourceInfo?.nocodeId || table.nocodeId;
    const sourceTableUID = sourceInfo?.table?.uid || tableUID;
    // 选项来自他表时，直接读取源字段的真实 distinct 值，
    // 避免继续使用本字段残留的“选项1/选项2/选项3”占位数据
    const distinctValues = await formDataApi.distinct({
      nocodeId,
      tableUID: sourceTableUID as TableUID,
      columnId: fieldUID as FieldUID,
    }).catch(() => []);
    options.value = (distinctValues || [])
      .map((item: any) => {
        const value = normalizeDistinctValue(item);
        if (value === undefined || value === null || value === '') {
          return null;
        }
        return {
          label: `${value}`,
          value,
        };
      })
      .filter(Boolean);
    return;
  }

  // 自定义选项场景继续沿用组件自身配置
  options.value = normalizeOptionItems(getStaticChoiceItems());
}

watch(() => [
  props.field?.uid,
  props.field?.meta?.uid,
  widgetType.value,
  widgetField.value?.uid,
], () => {
  loadOptions();
}, { immediate: true });

watch(() => [
  props.field?.uid,
  props.field?.meta?.uid,
  props.field?.meta?.extra?.linkType,
  props.field?.meta?.extra?.linkFormRange,
], () => {
  loadHyperlinkFormOptions();
}, { deep: true, immediate: true });

watch(() => props.field?.meta?.extra?.choices, async () => {
  await table.ensureFormReady()
  if (getLinkedOptionFieldUID().length >= 3) {
    return;
  }
  loadOptions();
}, { deep: true });

const organizeManageDialogRef = ref();
const buildDebugUsersByIds = (stage: string, userIds: any[] = []) => {
  const normalizedUserIds = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
  const organizeUsers = organizeUtil?.allUsers?.length ? organizeUtil.allUsers : (organizeUtil?.users || []);
  const matchedUsers = normalizedUserIds
    .map(id => organizeUsers.find(user => user.id === id))
    .filter(Boolean);

  return matchedUsers;
}

const handleOpenOrganize = () => {
  if (isAccount.value) {
    const value = props.modelValue || [];
    const ids = Array.isArray(value) ? value : [value];
    buildDebugUsersByIds('handleOpenOrganize', ids);
  }
  organizeManageDialogRef.value.show();
}
const organizeDialogProps = computed(() => {
  if (!props.field) {
    return {
      type: 'member',
      title: '',
      tableList: {},
    }
  }

  const value = props.modelValue || [];
  const ids = Array.isArray(value) ? value : [value];

  const tableList = {
    departments: [],
    roles: [],
    users: [],
    dynamic: []
  };

  if (isDepartment) {
    tableList.departments = ids.map(id => organizeUtil?.departments?.find(d => d.id === id)).filter(Boolean) || [];
  } else {
    tableList.users = buildDebugUsersByIds('organizeDialogProps.tableList.users', ids);
  }

  return {
    type: isDepartment.value ? 'department' : 'member',
    title: isDepartment.value ? i18next.t('TableBatchEditDialog.selectDept') : i18next.t('TableBatchEditDialog.selectMember'),
    tableList,
  }
})
const handleOrganizeConfirm = (data) => {
  let ids: string[] = [];
  if (isDepartment.value) {
    ids = data.departments.map(d => d.id);
  } else if (isAccount.value) {
    ids = data.users.map(u => u.id);
  }
  emit('change', ids);
}
const handleBlur = () => {
  if (!props.field) {
    return;
  }
  const { decimalPlaces, completeZero } = props.field?.meta?.extra || {};
  let resultText = formatFloat(Number(props.modelValue), decimalPlaces, completeZero);
  emit('change', resultText);
}
</script>

<style scoped lang="scss">
.tableBatchEditInput-container {
  flex: 1;
  width: 100%;
  display: flex;

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

    &.disabled {
      cursor: not-allowed;
      color: var(--text-color-placeholder);
      background-color: var(--bg-color-page);
    }

    &:not(.disabled):hover {
      border-color: #409EFF;
      color: #409EFF;
    }
  }
  
  .value-input {
    flex: 1;
    width: 100%;
    border-radius: 4px;
    // background-color: var(--bg-color-overlay);

    :deep(.el-input__wrapper) {
      border-radius: 4px;
      // background-color: var(--bg-color-overlay);
      box-shadow: unset;
      padding-top: 0;
      padding-bottom: 0;

      &:hover {
        box-shadow: 0 0 0 1px var(--border-color) inset;
      }

      &.is-focus {
        box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
      }

      .el-input__inner {
        font-size: 14px;
        height: 32px;

        &::placeholder {
          font-size: 12px;
        }
      }
    }
  }
}
</style>
