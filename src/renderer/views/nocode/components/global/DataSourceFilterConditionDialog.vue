<template>
  <div class="select-item-linkage-condition-dialog-wrap">
    <el-dialog 
      class="select-item-linkage-condition-dialog" 
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)" 
      :title="$t('DataSourceFilterConditionDialog.linkRule')" 
      width="1008" 
      align-center 
      destroy-on-close
      :close-on-click-modal="false" 
      @open="onOpen"
      draggable
    >
      <div class="container">
        <div class="container-col">
          <el-scrollbar class="container-content-scrollbar">
            <div class="setting-title">
              {{ $t('DataSourceFilterConditionDialog.linkOtherComp') }}
            </div>

            <el-checkbox
              v-model="isCheckAll"
              :indeterminate="isIndeterminate"
              @change="handleCheckAllChange"
            >
              {{ $t('DataSourceFilterConditionDialog.selectAll') }}
            </el-checkbox>
            <el-checkbox-group class="checkbox-linkage-widget" v-if="condition" v-model="condition.linkageWidgets" @change="handleCheckedWidgetsChange">
              <el-checkbox v-for="option in checkboxOptionOfLinkageWidgets" :key="option.value" :label="option.label" :value="option.value" />
            </el-checkbox-group>
          </el-scrollbar>
        </div>

        <el-divider direction="vertical"/>

        <div class="container-col">
          <el-scrollbar class="container-content-scrollbar">
            <div class="setting-title">
              {{ $t('DataSourceFilterConditionDialog.linkFormAndField') }}
            </div>
            <div v-if="condition" v-for="([tableUID, linkageOption], index) in Object.entries(condition.linkageFieldsMap)" class="linkage-field">
              <span>{{ getTableByUID(tableUID as TableUID)?.alias }}</span>
              <field-select
              :modelValue="linkageOption.fieldUID"
              @update:modelValue="(val) => condition.linkageFieldsMap[tableUID].fieldUID = val"
              :options="getLinkageFieldOption(tableUID as TableUID, index)"
              :disabled="!checkCanSelectField(index)"
              @change="handleFieldChange(index)"
              :placeholder="$t('DataSourceFilterConditionDialog.selectField')"
              :no-data-text="$t('DataSourceFilterConditionDialog.noFieldAvailable')"
              :show-arrow="false"
              :offset="4"
              ></field-select>
            </div>
          </el-scrollbar>
        </div>

        <el-divider direction="vertical"/>

        <div class="container-col">
          <el-scrollbar class="container-content-scrollbar">
            <div class="setting-title">
              {{ $t('DataSourceFilterConditionDialog.linkRule') }}
            </div>

            <div class="setting-content" v-if="condition && Object.values(condition.linkageFieldsMap).length && Object.values(condition.linkageFieldsMap)?.every(linkageOption => !isEmpty(linkageOption.fieldUID))">
              <el-select class="func" popper-class="custom-popper-small" :placeholder="$t('DataSourceFilterConditionDialog.plsSelect')" v-model="condition.func">
                <el-option v-for="(ruleFuncValue, ruleFunc) in conditionFuncInfos.editFuncInfo"
                  :key="ruleFunc" :label="RuleFuncTextMapping[ruleFunc]" :value="ruleFunc" />
              </el-select>

              <linkage-table-filter-value-format
                v-if="condition && Object.values(condition.linkageFieldsMap)?.every(linkageOption => !isEmpty(linkageOption.fieldUID)) && condition.func"
                :modelValue="condition.value"
                :func="condition.func"
                :linkageFieldsMap="condition.linkageFieldsMap"
                :configurations="conditionFuncInfos"
                :widget="props.widget"
                @update:modelValue="condition.value = $event;"
              ></linkage-table-filter-value-format>
            </div>
          </el-scrollbar>
        </div>
      </div>

      <template #footer>
        <el-button @click="handleClose">{{ $t('DataSourceFilterConditionDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t('DataSourceFilterConditionDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { computed, inject, reactive, ref, watch } from 'vue';
import { deepClone, isEmpty } from '@common/utils/object';
import { CheckboxInstance, CheckboxValueType, ElMessage, FormInstance, FormRules } from 'element-plus';
import { ConnectionUID, Field, Table, TableUID } from '@common/types/project';
import { isNocodeFormData, isSystemField, SystemField } from '@common/utils/connection';
import { RuleFunc, RuleFuncTextMapping, RuleFuncValue, FormElementConfiguration } from '@common/types/nocode';
import { unique } from '@common/utils/unique';
import { FieldUID, OptionFieldUID } from '@common/types/project';
import { FormLinkageCondition, FormLinkageRule, LogicalOperator, MenuItemOptions, MenuItem, DataSourceFilterRule, DataSourceFilterCondition, OptionFieldValue } from '@renderer/b2/types';
import { AbstractForm, FormElement } from '@renderer/b2/controllers/form';
import { Widget } from '@renderer/b2/controllers/widget';
import { formElementInstances } from '@renderer/utils/instance';
import LinkageTableFilterValueFormat from './LinkageTableFilterValueFormat.vue';
import i18next from 'i18next';
type LinkageFieldMapAttachTable = Record<TableUID, {connectionUID: ConnectionUID, fieldUID: `f_${string}` | `f_${string}.f_${string}`, chartUIDs: string[]}>;
type DataSourceFilterConditionAttachTable = {
  linkageWidgets: string[];
  linkageFieldsMap: LinkageFieldMapAttachTable;
  func: RuleFunc;
  value: string;
}

const props = withDefaults(defineProps<{
  modelValue: boolean;
  value?: DataSourceFilterCondition;
  widget: Widget;
}>(), {
});

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: any);
}>();

const condition = ref<DataSourceFilterConditionAttachTable>({
  linkageWidgets: [],
  linkageFieldsMap: {},
  func: null,
  value: null
})
const isCheckAll = ref(false);
const isIndeterminate = ref(true);
const systemFieldNameOfFilter = [ SystemField.CREATE_TIME, SystemField.UPDATE_TIME, SystemField.CREATE_OWNER, SystemField.DATA_OWNER ]

// 待补充
const filterTypes = ["widget.basic.filter", "widget.basic.filter-button", "widget.basic.filter-menu", "widget.basic.filter-input", "widget.basic.horizontal-filter-menu"]
const containerTypes = ["widget.group.panel-tab", "widget.group.panel"]
const linkWidgetsInCurrentBoard = computed(() => {
  return props.widget.getBoard().container.getChildWidgets(true, (widget) => {
    if (filterTypes.includes(widget.type)) return false;
    else if (containerTypes.includes(widget.type)) return undefined;
    else {
      const optionUID = getWidgetDataSource(widget as Widget);
      const connection = props.widget.getBoard().getConnections()?.find(c => c.uid === optionUID?.[0]);
      return connection && isNocodeFormData(connection);
    }
  })
});

const checkboxOptionOfLinkageWidgets = computed(() => {
  return linkWidgetsInCurrentBoard.value.map(widget => {
    return {
      label: widget.getOption("widget-title-text"),
      value: widget.uid
    }
  })
});

const getWidgetDataSource = (widget: Widget | string): OptionFieldUID => {
  if (typeof widget === "string") {
    widget = props.widget.getBoard().container.getChildWidget(widget) as Widget;
  }

  return widget?.getMetaData?.()?.axisValue?.find(option => {
    const [connectionUID, tableUID, fieldUIDs] = option.uid;
    const connection = widget.getBoard().getConnections()?.find(c => c.uid === connectionUID);
    const table = connection?.tables?.find(t => t.uid === tableUID);
    const [fieldUID, subFieldUID] = fieldUIDs?.split(".") || [];
    const field = table?.fields?.find(f => f.uid === fieldUID);
    if (!field) return false;

    if (subFieldUID) {
      const subTable = connection.tables.find(t => t.uid === field.meta?.extra?.subTableUID?.[1]);
      const subfield = subTable?.fields?.find(f => f.uid === subFieldUID);
      return subfield && !isSystemField(subfield);
    } else {
      return !isSystemField(field)
    }
  })?.uid;
}

const getTableByUID = (uid: TableUID) => {
  const linkageOption = condition.value.linkageFieldsMap[uid];
  return props.widget.getBoard().getConnections()?.find(c => c.uid === linkageOption.connectionUID)?.tables?.find(t => t.uid === uid);
}

const handleCheckAllChange = (val: CheckboxValueType) => {
  condition.value.linkageWidgets = val ? checkboxOptionOfLinkageWidgets.value.map(item => item.value) : [];
  isIndeterminate.value = false;
  updateLinkageFieldMap();
}
const handleCheckedWidgetsChange = (value: CheckboxValueType[]) => {
  const checkedCount = value.length;
  isCheckAll.value = checkedCount === checkboxOptionOfLinkageWidgets.value.length;
  isIndeterminate.value = checkedCount > 0 && checkedCount < checkboxOptionOfLinkageWidgets.value.length;

  updateLinkageFieldMap();
}

const updateLinkageFieldMap = () => {
  for (const widgetUID of condition.value.linkageWidgets) {
    const [connectionUID, tableUID] = getWidgetDataSource(widgetUID);
    if (condition.value.linkageFieldsMap[tableUID]) {
      const chartUIDs = condition.value.linkageFieldsMap[tableUID]?.chartUIDs
      if (!chartUIDs.includes(tableUID)) {
        chartUIDs.push(widgetUID);
      }
    } else {
      condition.value.linkageFieldsMap[tableUID] = {
        chartUIDs: [widgetUID],
        fieldUID: null,
        connectionUID: connectionUID
      }
      condition.value.value = null;
    }
  }

  for (const tableUID of Object.keys(condition.value.linkageFieldsMap)) {
    const option = condition.value.linkageFieldsMap[tableUID];
    option.chartUIDs = option.chartUIDs.filter(uid => condition.value.linkageWidgets.some(w => w === uid));
    if (!option.chartUIDs.length) delete condition.value.linkageFieldsMap[tableUID];
  }
}

const getTable = (tableUID: TableUID) => {
  const connections = props.widget.getBoard().getConnections() ?? [];
  for (const connection of connections) {
    const table = connection.tables?.find(item => item.uid === tableUID);
    if (table) return table;
  }
  return undefined;
}

const getSourceTable = (connectionUID: ConnectionUID, tableUID: TableUID) => {
  const tables = props.widget.getBoard().getConnections()?.find(c => c.uid === connectionUID)?.tables ?? [];
  return tables.find(table => table.uid === tableUID);
}

const specialTypes = ["department", "account", "number", "date"];

const checkIsSameType = (field: Field, comparisonField: Field) => {
  if (specialTypes.includes(comparisonField?.meta?.subType) && field?.meta?.subType === comparisonField?.meta?.subType) return true;
  else if (comparisonField?.meta?.extra?.widgetType === "widget.form.address") return field?.meta?.extra?.widgetType === "widget.form.address";
  else return linkageFields.value?.[0]?.type === field?.type
}

const getLinkageFieldOption = (tableUID: TableUID, index: number) => {
  const linkageOption = condition.value.linkageFieldsMap[tableUID];
  const connection = props.widget.getBoard().getConnections()?.find(c => c.uid === linkageOption.connectionUID);
  if (!connection) return [];

  const table = connection.tables?.find(t => t.uid === tableUID);
  if (!table) return [];
  const needRestricted = index !== 0;

  const baseFields = table.fields.reduce((prev, field) => {
    // isSystemField(field) && !systemFieldNameOfFilter.includes(field.meta.name as SystemField)
    if (isSystemField(field)) return prev;
    if (field?.meta?.extra?.widgetType !== "widget.form.subform") {
      prev.baseFields.push(field);
    } else {
      prev.subFields.push(field);
    }
    return prev;
  }, { subFields: [], baseFields: [] });

  const baseOptions = baseFields.baseFields
  .filter(field => !needRestricted || checkIsSameType(field, linkageFields.value?.[0]))
  .map(field => {
    // ${table.uid}.
    return {
      label: `${field.alias}`,
      value: `${field.uid}`,
      type: field.meta?.subType,
    }
  }) ?? [];

  const subOptions = baseFields.subFields.map(field => { 
    const subTable = connection.tables.find(t => t.uid === field.meta?.extra?.subTableUID?.[1]);
    // (!isSystemField(subField) || systemFieldNameOfFilter.includes(subField.meta.name as SystemField))
    return subTable?.fields
      .filter(subField => !isSystemField(subField) && (!needRestricted || checkIsSameType(subField, linkageFields.value?.[0])))
      .map(subField => {
        // ${table.uid}.
        return {
          label: `${field.alias}.${subField.alias}`,
          value: `${field.uid}.${subField.uid}`,
        }
      }) ?? [];
  })?.flat(Infinity) ?? [];

  return [...baseOptions, ...subOptions];
}

const linkageFields = computed(() => {
  if (!condition.value) return [];
  return Object.keys(condition.value.linkageFieldsMap).map((tableUID) => {
    const linkageOption = condition.value.linkageFieldsMap[tableUID];
    if (linkageOption.fieldUID === null) return null;

    const [fieldUID, subFieldUID] = linkageOption.fieldUID.split(".");
    const uids = getWidgetDataSource(linkageOption.chartUIDs[0]);
    const table = getSourceTable(uids[0], tableUID as TableUID);
    const field = table.fields.find(field => field.uid === fieldUID);
    if (subFieldUID) {
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      const subTable = getSourceTable(uids[0], subTableUID);
      return subTable.fields.find(field => field.uid === subFieldUID);
    }
    return field;
  })
})

const checkCanSelectField = (index) => {
  if (index === 0) return true;
  else if (!Object.values(condition.value.linkageFieldsMap).at(0).fieldUID) return false;
  else return true;
}

const handleFieldChange = (index) => {
  if (index === 0) {
    Object.keys(condition.value.linkageFieldsMap).forEach((TableUID, i) => {
      if (i > 0) {
        condition.value.linkageFieldsMap[TableUID].fieldUID = null;
      }
    });
    condition.value.value = null;
  };
}

const configurationsCache: Record<string, FormElementConfiguration> = {
  default: {
    funcInfo: {
      [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
      [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    },
    editFuncInfo: {
      [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
      [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    }
  }
};
const conditionFuncInfos = ref<FormElementConfiguration>({});
watch(() => linkageFields.value?.map(f => f?.meta?.extra?.widgetType), async (widgetTypes, oldVal) => { 
  if (!condition.value) return;

  if (widgetTypes.some(type => !type)) {
    conditionFuncInfos.value = {};
    return;
  }

  for (const field of linkageFields.value) {
    if (!configurationsCache[field.meta?.extra?.widgetType]) {
      const widget = await formElementInstances.getInstance(field.meta?.extra?.widgetType);
      configurationsCache[field.meta?.extra?.widgetType] = widget.getConfigurations();
    }
  }

  const isSpecial = specialTypes.includes(linkageFields.value?.[0]?.meta?.subType) || linkageFields.value?.[0]?.meta?.extra?.widgetType === "widget.form.address";
  if (isSpecial) {
    conditionFuncInfos.value = configurationsCache[linkageFields.value?.[0]?.meta?.extra?.widgetType];
  } else {
    conditionFuncInfos.value = configurationsCache.default;
  }

  if (oldVal?.some(type => !type) || !(condition.value?.func in conditionFuncInfos.value.editFuncInfo)) {
    condition.value.func = Object.keys(conditionFuncInfos.value.editFuncInfo)[0] as RuleFunc;
  }
}, { immediate: true })

const onOpen = () => {
  const conditionClone = deepClone(props.value);
  const newWidgets = [];
  const linkageFieldsMap:LinkageFieldMapAttachTable = conditionClone.linkageWidgets.reduce((prev, widgetUid) => {
    const widget = props.widget.getBoard().container.getChildWidget(widgetUid) as Widget;
    if (!widget) return prev; // 勾选的看板组件被删除，删除linkageWidgets中的组件

    const axisValue = widget?.getMetaData?.()?.axisValue;
    if (!axisValue) return prev;

    let sourceTable: Table = null;
    let connectionUID: ConnectionUID = null;
    axisValue.forEach(option => {
      const table = getSourceTable(option?.uid?.[0], option?.uid?.[1]);
      if (table) {
        sourceTable = table;
        connectionUID = option?.uid?.[0];
        return;
      }
    })

    // 获取勾选的组件最新的数据来源，若与筛选规则不匹配，说明数据来源被修改，删除linkageWidgets中的组件
    if (sourceTable) {
      // sourceTable
      const oldLinkageFieldUID = Object.keys(conditionClone.linkageFields).find(uid => conditionClone.linkageFields[uid].includes(widgetUid));
      if (!oldLinkageFieldUID) return prev;

      const [oldFieldUID, oldSubFieldUID] = oldLinkageFieldUID.split(".");
      if (oldSubFieldUID) {
        const optionTableUID = sourceTable.fields.find(field => field.uid === oldFieldUID)?.meta?.extra?.subTableUID;
        const subTable = getSourceTable(optionTableUID[0], optionTableUID[1]);
        if (subTable?.fields?.some(field => field.uid === oldSubFieldUID)) {
          if (prev[sourceTable.uid]) {
            prev[sourceTable.uid].chartUIDs.push(widgetUid);
          } else {
            prev[sourceTable.uid] = {
              connectionUID: connectionUID,
              fieldUID: oldLinkageFieldUID,
              chartUIDs: [widgetUid],
            }
          }
          newWidgets.push(widgetUid);
        }
      } else {
        if (sourceTable.fields.some(field => field.uid === oldFieldUID)) {
          if (prev[sourceTable.uid]) {
            prev[sourceTable.uid].chartUIDs.push(widgetUid);
          } else {
            prev[sourceTable.uid] = {
              connectionUID: connectionUID,
              fieldUID: oldLinkageFieldUID,
              chartUIDs: [widgetUid],
            }
          }
          newWidgets.push(widgetUid);
        }
      }
    }

    return prev;
  }, {});

  condition.value = {
    ...conditionClone,
    linkageWidgets: newWidgets,
    linkageFieldsMap: linkageFieldsMap
  };
  isIndeterminate.value = condition.value?.linkageWidgets?.length !== checkboxOptionOfLinkageWidgets.value?.length && condition.value?.linkageWidgets?.length !== 0;
  isCheckAll.value = condition.value?.linkageWidgets?.length === checkboxOptionOfLinkageWidgets.value?.length;
}

const handleClose = () => {
  emit("update:modelValue", false);
  condition.value = null;
}

const handleConfirm = () => {
  let warnText = null;
  if (!condition.value.linkageWidgets.length) {
    warnText = i18next.t('DataSourceFilterConditionDialog.plsSelectLinkComp');
  } else if (Object.values(condition.value.linkageFieldsMap).some(item => isEmpty(item.fieldUID))) {
    warnText = i18next.t('DataSourceFilterConditionDialog.plsSelectFilterField');
  } else if (!condition.value.func 
    || (![RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(condition.value.func) 
      && (Array.isArray(condition.value.value) ? !condition.value.value?.length : (isEmpty(condition.value.value) || condition.value.value === '')))
  ) {
    warnText = i18next.t('DataSourceFilterConditionDialog.plsSetLinkRule');
  }
  if (warnText) {
    ElMessage.warning(warnText);
    return;
  }

  const conditionClone = deepClone(condition.value);
  const conditionTransformed = {
    linkageWidgets: conditionClone.linkageWidgets,
    linkageFields: Object.values(conditionClone.linkageFieldsMap).reduce((prev, option) => {
      prev[option.fieldUID] = option.chartUIDs;
      return prev;
    }, {}),
    func: conditionClone.func,
    value: conditionClone.value
  }

  emit("update", conditionTransformed);
  handleClose();
}
</script>

<style lang='scss' scoped>
.select-item-linkage-condition-dialog-wrap {
  @mixin diy-select {
    width: max-content;
    min-width: 70px;
    max-width: 100%;
    border-radius: 4px;

    .el-select__wrapper {
      box-shadow: none;
      border: none;
      padding: 0 4px 0 0px;
      background-color: transparent;
      gap: 4px;
      font-size: 12px;

      .el-select__placeholder {
        position: unset;
        transform: unset;
      }

      .el-select__input-wrapper {
        display: none;
      }
    }
  }

  @mixin common-select {
    &:has(.is-disabled) {
      cursor: not-allowed;
    }

    .el-select__wrapper {
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
    }
  }

  :deep(.select-item-linkage-condition-dialog) {
    height: 640px;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--bg-color-page);
    --dialog-header-height: 40px;
    --dialog-footer-height: 64px;
    .el-dialog__header {
      height: var(--dialog-header-height);
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid var(--border-color);

      .el-dialog__title {
        font-size: 14px;
      }

      .el-dialog__headerbtn {
        width: var(--dialog-header-height);
        height: var(--dialog-header-height);
      }
    }


    .el-dialog__body {
      height: calc(100% - var(--dialog-header-height) - var(--dialog-footer-height));

      .el-form-item.is-error {
        .el-select__wrapper {
          box-shadow: 0 0 0 1px var(--color-danger) inset !important;
        }
      }

      .container {
        display: flex;
        padding: 16px;
        width: 100%;
        height: 100%;
        
        .container-col {
          flex: 1;
          height: 100%;

          .setting-title {
            height: 24px;
            line-height: 24px;
            font-size: 14px;
            display: flex;
            justify-content: space-between;
            color: var(--text-color-primary);
            margin-bottom: 16px;
          }

          .setting-content {
            .func {
              @include diy-select;
              margin-bottom: 8px;
            }
          }

          .el-checkbox {
            margin-bottom: 4px;
            padding-left: 8px;
          }

          .checkbox-linkage-widget {
            display: flex;
            flex-direction: column;

            .el-checkbox:last-child {
              margin-bottom: 0;
            }
          }

          .field-select {
            @include common-select;
          }

          .linkage-field {
            margin-bottom: 16px;

            &:last-child {
              margin-bottom: 0;
            }

            span {
              display: inline-block;
              line-height: 20px;
              margin-bottom: 4px;
            }
          }
        }

        .el-divider {
          font-size: 504px;
          margin: 0 24px;
        }
      }
    }

    .el-dialog__footer {
      height: var(--dialog-footer-height);
      padding: 16px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: end;
      align-items: center;
      position: relative;
      .filter-select-tips {
        position: absolute;
        left: 16px;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
        color: #A1A1A1;
      }

      .el-button {
        border-radius: 4px;
      }
    }
  }
}

:deep(.el-select) {
  .el-select__wrapper {
    .el-select__selected-item {
      span {
        &.error {
          color: var(--color-danger);
        }
      }
    }
  }
}
</style>
