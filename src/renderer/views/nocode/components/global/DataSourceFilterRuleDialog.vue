<template>
  <div class="select-option-linkage-dialog-wrap">
    <el-dialog 
      class="select-option-linkage-dialog" 
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)" 
      :title="$t('DataSourceFilterRuleDialog.linkSetting')" 
      width="680" 
      align-center 
      destroy-on-close
      :close-on-click-modal="false" 
      :before-close="handleBeforeClose"
      @open="onOpen"
      draggable
    >
      <vn-stack class="dialog-stack">
        <div class="container">
            <div class="setting-left">
              <el-scrollbar class="container-scrollbar">
                <div class="setting-title">
                  {{ $t('DataSourceFilterRuleDialog.menuOption') }}
                </div>

                <template v-for="(option, index) in menuItemOption?.options" :key="option.id">
                  <vn-stack-tab class="tab-option-item" :name="option.id" @click="handleSelect(option.id)">
                    <div>{{ option.value }}</div>
                  </vn-stack-tab>
                </template>
              </el-scrollbar>
            </div>
  
            <el-divider direction="vertical"/>
  
            <div class="setting-right">
              <el-scrollbar class="container-scrollbar">
              <div class="setting-title">
                {{ $t('DataSourceFilterRuleDialog.linkRule') }}
                <el-button type="primary" link :icon="Plus" @click="handleAddCondition">{{ $t('DataSourceFilterRuleDialog.add') }}</el-button>
              </div>
  
              <template v-for="(option, index) in menuItemOption?.options" :key="option.id">
                <vn-stack-layer :name="option.id" v-if="selectedOption?.id === option.id">
                  <div class="rule-item" v-for="(item, itemIndex) in rule[option.id]" :key="itemIndex">
                    <div class="item-label">
                      <div class="item-left">
                        {{ $t('DataSourceFilterRuleDialog.field') }}
                        <div class="fields-alias-wrap" :title="getFieldAlias(item.linkageFields)?.join('，')">
                          <span v-for="alias in getFieldAlias(item.linkageFields)">{{ alias }}</span>
                        </div>
                      </div>
      
                      <div class="item-right">
                        <el-select v-if="configurationsCache[getTypedFieldByCondition(item)?.meta.extra.widgetType]" class="func" :placeholder="$t('DataSourceFilterRuleDialog.select')" v-model="item.func">
                          <el-option v-for="(ruleFuncValue, ruleFunc) in configurationsCache[getTypedFieldByCondition(item)?.meta.extra.widgetType]?.editFuncInfo"
                          :key="ruleFunc" :label="RuleFuncTextMapping[ruleFunc]" :value="ruleFunc" />
                        </el-select>
                      </div>
                    </div>
                    <div class="item-value">
                      <linkage-table-filter-value-format
                        v-if="Object.values(item.linkageFields)[0]"
                        v-model="item.value"
                        :func="item.func"
                        :linkageFieldsMap="transformLinkageFieldsMap(item)"
                        :configurations="configurationsCache[getTypedFieldByCondition(item)?.meta.extra.widgetType]"
                        :widget="props.widget"
                      ></linkage-table-filter-value-format>
                      <el-select v-else v-model="item.value" placeholder="Select" readonly style="width: 240px">
                      </el-select>
      
                      <el-button @click="handleEditCondition(itemIndex)" link><el-icon size="16"><i-ven-edit /></el-icon></el-button>
                      <el-button @click="handleDeleteCondition(itemIndex)" :icon="Delete" link></el-button>
                    </div>
                  </div>
                </vn-stack-layer>
              </template>
              </el-scrollbar>
            </div>
          </div>
        </vn-stack>

      <template #footer>
        <el-button @click="handleClose()">{{ $t('DataSourceFilterRuleDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t('DataSourceFilterRuleDialog.confirm') }}</el-button>
      </template>
    </el-dialog>

    <data-source-filter-condition-dialog ref="linkageConditionDialogRef" 
    v-model="visible" :value="indexOfEditing === null ? conditionOfAdding : ruleOfSeletedOption[indexOfEditing]" :widget="widget"
    @update:model-value="handleUpdateVisible" 
    @update="handleUpdateCondition" ></data-source-filter-condition-dialog>
    <tip-dialog ref="tipDialogRef" :content="$t('DataSourceFilterRuleDialog.isSave')" :confirmText="$t('DataSourceFilterRuleDialog.save')" :cancelText="$t('DataSourceFilterRuleDialog.cancel')" :closeOnClickModal="true" />
  </div>
</template>

<script lang='ts' setup>
import { computed, ref, watch, nextTick } from 'vue';
import { deepClone, isEmpty, equals } from '@common/utils/object';
import { ConnectionUID, Field, Table } from '@common/types/project';
import { isNocodeFormData, isSystemField } from '@common/utils/connection';
import { RuleFunc, RuleFuncTextMapping, RuleFuncValue, FormElementConfiguration } from '@common/types/nocode';
import { FieldUID, OptionFieldUID } from '@common/types/project';
import { MenuItemOptions, MenuItem, DataSourceFilterRule, DataSourceFilterCondition } from '@renderer/b2/types';
import { Widget } from '@renderer/b2/controllers/widget';
import { formElementInstances } from '@renderer/utils/instance';
import { Delete, Plus } from '@element-plus/icons-vue'
import DataSourceFilterConditionDialog from './DataSourceFilterConditionDialog.vue';
import LinkageTableFilterValueFormat from './LinkageTableFilterValueFormat.vue';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  widget: Widget;
  value?: DataSourceFilterRule;
  isFillValue?: boolean;
}>(), {
  isFillValue: true,
});

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: any);
}>();

const rule = ref<DataSourceFilterRule>();
const initialRule = ref<DataSourceFilterRule>();
const menuItemOption = ref<MenuItemOptions>()
const selectedOption = ref<MenuItem>();
const visible = ref(false);
const conditionOfAdding = ref<DataSourceFilterCondition>();
const linkageConditionDialogRef = ref();
const tipDialogRef = ref();

const ruleOfSeletedOption = computed<DataSourceFilterCondition[]>(() => {
  if (selectedOption.value?.id) {
    return rule.value?.[selectedOption.value.id];
  }

  return [];
});

const handleConfirm = () => {
  // 校验


  emit("update", deepClone(rule.value));
  emit("update:modelValue", false);
}

const handleBeforeClose = (done: () => void) => {
  handleClose(done);
}

const handleClose = async (done?: () => void) => {
  if (!equals(rule.value, initialRule.value)) {
    const isSave = await tipDialogRef.value.confirm();
    
    if (isSave === true) {
      handleConfirm();
      done?.();
    } else if (isSave === false) {
      emit('update:modelValue', false);
      done?.();
    }
  } else {
    emit('update:modelValue', false);
    done?.();
  }
}

const handleAddCondition = () => {
  conditionOfAdding.value = {
    linkageWidgets: [],
    linkageFields: {},
    func: RuleFunc.IN,
    value: undefined
  };

  visible.value = true;
}

const indexOfEditing = ref(null);
const handleEditCondition = (index: number) => {
  indexOfEditing.value = index;
  visible.value = true;
}

const handleDeleteCondition = (index: number) => {
  rule.value?.[selectedOption.value.id].splice(index, 1);
}

const getWidgetDataSource = (widget: Widget | string) => {
  if (!widget) return {connection: null, table: null};

  if (typeof widget === "string") {
    widget = props.widget.getBoard().container.getChildWidget(widget) as Widget;
    if (!widget) return {connection: null, table: null};
  }

  for (const option of widget?.getMetaData?.()?.axisValue) {
    const [connectionUID, tableUID, fieldUID] = option.uid;
    const connection = widget.getBoard().getConnections()?.find(c => c.uid === connectionUID);
    const table = connection?.tables?.find(t => t.uid === tableUID);
    if (table) return {connection: connection, table: table}
  }

  return {connection: null, table: null};
}

const getFieldAlias = (linkageFields: Record<FieldUID | `${FieldUID}.${FieldUID}`, string[]>): string[] => {
  return Object.entries(linkageFields).map(([fieldUids, chartUIDs]) => {
    const {table, connection} = getWidgetDataSource(chartUIDs[0]);
    const [fieldUID, subFieldUID] = fieldUids.split(".");
    const field = table?.fields.find(f => f.uid === fieldUID);
    if (subFieldUID) {
      const subTable = connection.tables.find(t => t.uid === field?.meta?.extra?.subTableUID?.[1]);
      const subField = subTable.fields.find(f => f.uid === subFieldUID);
      return `${field?.alias}.${subField?.alias}`
    }
    // ${table.alias}.
    return `${field?.alias}`
  })
}

const handleUpdateCondition = (condition: DataSourceFilterCondition) => {
  if (isEmpty(indexOfEditing.value)) {
    conditionOfAdding.value = condition;
    rule.value?.[selectedOption.value.id].push(conditionOfAdding.value);
  } else {
    rule.value[selectedOption.value.id][indexOfEditing.value] = condition;
    indexOfEditing.value = null;
  }
}

const handleUpdateVisible = () => {
  indexOfEditing.value = null;
}

const onOpen = () => {
  menuItemOption.value = props.widget.getOption("menu-item-option");
  selectedOption.value = menuItemOption.value.options[0];
  if (props.value) {
    rule.value = deepClone(props.value);
    for (const id of Object.keys(rule.value)) {
      if (menuItemOption.value.options.every(option => option.id !== id)) delete rule.value[id]
    }
    for (const option of menuItemOption.value.options) {
      if (!rule.value[option.id]) rule.value[option.id] = [];
    }

  } else {
    rule.value = menuItemOption.value.options.reduce((prev, option) => {
      prev[option.id] = [];
      return prev;
    }, {});
  }

  nextTick(() => {
    initialRule.value = deepClone(rule.value);
  });
}

const handleSelect = (id: string) => {
  selectedOption.value = menuItemOption.value?.options.find(option => option.id === id);
  if (selectedOption.value?.id && !rule.value[selectedOption.value?.id]) {
    rule.value[selectedOption.value?.id] = [];
  }
}

const configurationsCache = ref<Record<string, FormElementConfiguration>>({
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
});

const specialTypes = ["department", "account", "number", "date"];
const saveConfigurationsByField = async (field: Field) => {
  if (!configurationsCache.value[field.meta?.extra?.widgetType]) {
    const isSpecial = specialTypes.includes(field.meta?.subType) || field?.meta?.extra?.widgetType === "widget.form.address";
    if (isSpecial) {
      const widget = await formElementInstances.getInstance(field.meta?.extra?.widgetType);
      configurationsCache.value[field.meta?.extra?.widgetType] = widget.getConfigurations();
    } else {
      configurationsCache.value[field.meta?.extra?.widgetType] = configurationsCache.value.default;
    }
  }
}

const getTypedFieldByCondition = (condition: DataSourceFilterCondition) => {
  if (!condition?.linkageFields) return null;
  const uids = Object.keys(condition.linkageFields)[0];
  const chartUIDs = condition.linkageFields[uids];
  const {connection, table} = getWidgetDataSource(chartUIDs?.[0]);
  const [fieldUID, subFieldUID] = uids.split(".");
  const field = table?.fields.find(field => field.uid === fieldUID);
  if (subFieldUID) {
    const subTable = connection.tables?.find(t => t.uid === field.meta?.extra?.subTableUID?.[1]);
    const subField = subTable?.fields?.find(f => f.uid === subFieldUID);
    return subField;
  } else {
    return field;
  }
}

const transformLinkageFieldsMap = (condition: DataSourceFilterCondition) => {
  if (!condition?.linkageFields) return {};
  return Object.keys(condition.linkageFields).reduce((prev, fieldUID) => { 
    const chartUIDs = condition.linkageFields[fieldUID];
    const {connection, table} = getWidgetDataSource(chartUIDs?.[0]);
    if (!connection || !table) return prev;
    prev[table.uid] = {
      fieldUID: fieldUID,
      chartUIDs: chartUIDs,
      connectionUID: connection.uid,
    }
    return prev;
  }, {});
}

const typedFieldsInSelectedOption = computed(() => {
  if (!rule.value || !selectedOption.value?.id) return [];
  return rule.value?.[selectedOption.value?.id]?.map(condition => getTypedFieldByCondition(condition));
})

watch(() => typedFieldsInSelectedOption.value.map(field => field?.meta?.extra?.widgetType), async () => {
  for (const field of typedFieldsInSelectedOption.value) {
    const widgetType = field?.meta?.extra?.widgetType;
    if (widgetType && !configurationsCache[widgetType]) await saveConfigurationsByField(field);
  }
}, {immediate: true})

</script>

<style lang='scss' scoped>
.select-option-linkage-dialog-wrap {
  @mixin diy-select {
    width: max-content;
    min-width: 70px;
    max-width: 100%;
    border-radius: 4px;

    &:hover {
      background-color: var(--bg-color-hover);
    }

    .el-select__wrapper {
      box-shadow: none;
      border: none;
      padding: 0 4px 0 10px;
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

  @mixin common-input {
    .el-input__wrapper {
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

  @mixin delete {
    display: flex;
    align-items: center;

    &.disabled {
      cursor: not-allowed;
      pointer-events: none;
      opacity: 0.4;
    }

    .el-icon {
      cursor: pointer;

      &:hover {
        color: var(--color-danger);
      }
    }
  }

  :deep(.select-option-linkage-dialog) {
    height: 464px;
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

      .dialog-stack {
        height: 100%;
        min-height: 0;
      }

      .el-form-item.is-error {
        .el-select__wrapper {
          box-shadow: 0 0 0 1px var(--color-danger) inset !important;
        }
      }

      .container {
          display: flex;
          padding: 16px 4px 16px 16px;
          height: 100%;
          min-height: 0;

          .container-scrollbar {
            flex: 1;
            min-height: 0;
          }

          .setting-title {
            height: 24px;
            line-height: 24px;
            font-size: 14px;
            display: flex;
            justify-content: space-between;
            color: var(--text-color-primary);
            margin-bottom: 16px;
          }

          .setting-left {
            font-size: 14px;
            width: 200px;
            height: 100%;
            min-height: 0;
            display: flex;
            flex-direction: column;

            .el-menu {
              border-right: 0px;
            }
            .tab-option-item {
              width: 100%;
              height: 32px;
              line-height: 32px;
              font-size: 14px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              padding-left: 8px;
              color: var(--text-color-regular);
              margin-bottom: 4px;
              border-radius: 4px;
              cursor: pointer;

              &:last-child {
                margin-bottom: 0;
              }

              &:hover,
              &.active {
                background-color: var(--bg-color-overlay);
              }
            }
          }

          .el-divider {
            font-size: 328px;
            margin: 0 16px;
          }

          .setting-right {
            flex: 1;
            height: 100%;
            min-width: 0;
            min-height: 0;
            display: flex;
            flex-direction: column;

            .el-scrollbar__wrap {
                padding-right: 12px;
            }

            .rule-item {
              width: 100%;
              margin-bottom: 24px;

              &:last-child { 
                margin-bottom: 0;
              }

              .item-label {
                width: 100%;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 4px;

                .item-left {
                  display: flex;
                  align-items: center;
                  height: 100%;
                  max-width: calc(100% - 40px);

                  .fields-alias-wrap {
                    height: 28px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px;
                    border-radius: 4px;
                    background-color: var(--bg-color-overlay);
                    overflow: hidden;

                    span {
                      background-color: var(--bg-color-page);
                      display: inline-block;
                      height: 20px;
                      line-height: 16px;
                      padding: 2px 4px;
                      border-radius: 2px;
                    }
                  }
                }

                .item-right {
                  .func {
                    @include diy-select;
                  }
                }
              }

              .item-value {
                display: flex;
                gap: 8px;

                .el-button + .el-button {
                  margin-left: 0;
                }
              }
            }
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

<style lang="scss">
.select-option-linkage-dialog-wrap-fill-widget-select-popper {
 .el-select-dropdown__list {
  .el-select-dropdown__item.is-disabled {
    color: var(--el-text-color-regular);
  }
 } 
}

.linkage-fill-select-popper {
  border: none !important;

  .el-scrollbar {
    --el-scrollbar-bg-color: var(--el-bg-color-page) !important;
  }

  .el-dropdown__list {
    padding: 0 !important;
  }

  .el-popper__arrow {
    display: none !important;
  }

  .el-scrollbar__view {
    background-color: var(--el-bg-color-page);
    padding: 4px;
  }

  ul {
    border-radius: 4px;

    li {
      border-radius: 2px;
    }
  }
}
</style>
