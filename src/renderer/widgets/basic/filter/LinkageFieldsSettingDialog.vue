<template>
  <div class="linkage-fields-setting-dialog-wrap">
    <el-dialog
      class="linkage-fields-setting-dialog"
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      :title="$t('linkageFieldSet')"
      width="680"
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      :before-close="handleBeforeClose"
      @open="onOpen"
      draggable
    >
      <div class="container">
        <div class="setting-left">
          <div class="setting-title">{{ $t('linkageOtherComp') }}</div>
          <el-scrollbar class="container-scrollbar" v-if="checkboxOptionOfLinkageWidgets?.length > 0">
            <el-checkbox
              v-model="isCheckAll"
              :indeterminate="isIndeterminate"
              @change="handleCheckAllChange"
            >
              {{ $t('selectAll') }}
            </el-checkbox>
            <el-checkbox-group class="checkbox-linkage-widget" v-if="rule" v-model="rule.linkageWidgets" @change="handleCheckedWidgetsChange">
              <el-checkbox v-for="option in checkboxOptionOfLinkageWidgets" :key="option.value" :label="option.label" :value="option.value" />
            </el-checkbox-group>
          </el-scrollbar>
          <div v-else class="no-data">
            {{ $t('noComp') }}
          </div>
        </div>

        <el-divider direction="vertical"/>

        <div class="setting-right">
          <div class="setting-title">{{ $t('linkageFormField') }}</div>
          <el-scrollbar class="container-scrollbar" v-if="tablesOfNeedFilter?.length > 0">
            <template v-if="rule">
              <div v-for="(table, index) in tablesOfNeedFilter" :key="table.uid" class="linkage-field">
                <span>{{ table?.alias }}</span>
                <field-select
                :modelValue="selectedTableFields[table.uid]"
                @update:modelValue="(val) => selectedTableFields[table.uid] = val"
                :options="getLinkageFieldOption(index)"
                :disabled="!checkCanSelectField(index)"
                @change="(val) => handleFieldChange(val, index)"
                :placeholder="$t('selectField')"
                :no-data-text="$t('noAvaField')"
                :show-arrow="false"
                :offset="4"
                ></field-select>
              </div>
            </template>
          </el-scrollbar>
          <div v-else class="no-data">
            {{ i18next.t('noComp') }}
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="handleClose()">{{ i18next.t('cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ i18next.t('confirm') }}</el-button>
      </template>
    </el-dialog>

    <tip-dialog ref="tipDialogRef" :content="i18next.t('isSave')" :confirmText="i18next.t('save')" :cancelText="i18next.t('cancel')" :closeOnClickModal="true" />
  </div>
</template>

<script setup lang='ts'>
import { FieldUID, OptionFieldUID } from '@common/types/project';
import { isNocodeFormData, isSystemField } from '@common/utils/connection';
import { WidgetMetaData } from '@renderer/b2/types';
import { Widget } from '@renderer/b2/controllers/widget';
import { deepClone, isEmpty, equals } from '@common/utils/object';
import { CheckboxValueType, ElMessage } from 'element-plus';
import { computed, ref, nextTick } from 'vue';
import i18next, { $t } from "@renderer/widgets/i18next";

type SelectItemField = {
  linkageWidgets: string[],
  linkageFields: Record<FieldUID, string[]>,
}
const props = withDefaults(defineProps<{
  modelValue: boolean;
  widget: Widget;
  value: SelectItemField;
}>(), {
});

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: any);
}>();
const isCheckAll = ref(false);
const isIndeterminate = ref(true);
const rule = ref<SelectItemField>()
const initialRule = ref<SelectItemField>();
const tipDialogRef = ref();

const handleConfirm = () => {
  let isLinkageFieldEmpty = false;
  for (const key of Object.keys(selectedTableFields.value)) {
    if (isEmpty(selectedTableFields.value[key])) {
      isLinkageFieldEmpty = true;
      break;
    }
  }
  if (!isEmpty(rule.value.linkageWidgets) && isLinkageFieldEmpty) {
    ElMessage.error(i18next.t('linkageFieldUnfinish'));
    return false;
  }
  // 校验
  emit("update", deepClone(rule.value));
  emit("update:modelValue", false);
  return true;
}

const onOpen = () => {
  rule.value = props.value ? deepClone(props.value) : {
    linkageWidgets: [],
    linkageFields: {},
  };
  isIndeterminate.value = rule.value?.linkageWidgets.length !== checkboxOptionOfLinkageWidgets.value.length && rule.value?.linkageWidgets.length !== 0;
  isCheckAll.value = (rule.value?.linkageWidgets.length === checkboxOptionOfLinkageWidgets.value.length) && (rule.value?.linkageWidgets.length !== 0);
  tablesOfNeedFilter.value.forEach(table => {
    Object.keys(rule.value.linkageFields).forEach((key: FieldUID) => {
      if (table.fields.find(f => f.uid === key)) {
        selectedTableFields.value[table.uid] = key;
      }
    })
  })

  nextTick(() => {
    initialRule.value = deepClone(rule.value);
  });
}

const handleBeforeClose = (done: () => void) => {
  handleClose(done);
}

const handleClose = async (done?: () => void) => {
  if (!equals(rule.value, initialRule.value)) {
    const isSave = await tipDialogRef.value.confirm();
    if (isSave === true) {
      if (handleConfirm()) {
        done?.();
      }
    } else if (isSave === false) {
      emit('update:modelValue', false);
      done?.();
    }
  } else {
    emit('update:modelValue', false);
    done?.();
  }
}

const filterTypes = ["widget.basic.filter", "widget.basic.filter-button", "widget.basic.filter-menu", "widget.basic.filter-input", "widget.basic.horizontal-filter-menu"]
const linkWidgetsInCurrentBoard = computed(() => {
 return (props.widget.getBoard().container.getChildWidgets(true) as Widget[]).filter(c => {
    if (filterTypes.includes(c.type)) return false;
    else if (c.uid === props.widget.uid) return false;

    const optionUID = getWidgetDataSource(c as Widget);
    const connection = props.widget.getBoard().getConnections()?.find(c => c.uid === optionUID?.[0]);
    return connection && isNocodeFormData(connection);
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

const tableWidgetType = ["widget.form.table", "widget.form.viewtable"];
const getWidgetDataSource = (widget: Widget | string): OptionFieldUID => {
  if (typeof widget === "string") {
    widget = props.widget.getBoard().container.getChildWidget(widget) as Widget;
  }
  if (tableWidgetType.includes(widget?.type)) {
    return (widget as any).formTableUID;
  }

  return widget?.getMetaData()?.axisValue?.find(option => {
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

const handleCheckAllChange = (val: CheckboxValueType) => {
  rule.value.linkageWidgets = val ? checkboxOptionOfLinkageWidgets.value.map(item => item.value) : [];
  isIndeterminate.value = false;
  updateLinkageFieldMap();
}
const handleCheckedWidgetsChange = (value: CheckboxValueType[]) => {
  const checkedCount = value.length;
  isCheckAll.value = checkedCount === checkboxOptionOfLinkageWidgets.value.length;
  isIndeterminate.value = checkedCount > 0 && checkedCount < checkboxOptionOfLinkageWidgets.value.length;
  updateLinkageFieldMap();
}

const tablesOfNeedFilter = computed(() => {
  const checkedLinkageWidgets = rule.value?.linkageWidgets.map(linkWidgetUID => {
    return linkWidgetsInCurrentBoard.value.find(widget => widget.uid === linkWidgetUID);
  })
  return checkedLinkageWidgets?.reduce((pre, widget, index) => {
    if (!checkIsSelectLinkageTable(index)) {
      const curLinkageTable = getLinkageTable(widget.uid);
      pre.push(curLinkageTable);
    }
    return pre;
  }, []);
});

const selectedTableFields = ref<Record<string, FieldUID>>({})

const rebuildLinkageFields = () => {
  const nextLinkageFields: Record<FieldUID, string[]> = {};
  tablesOfNeedFilter.value.forEach(table => {
    const selectedFieldId = selectedTableFields.value[table.uid];
    if (!selectedFieldId) return;
    const selectedWidgetUids = rule.value.linkageWidgets.filter(widgetUid => {
      const curTable = getLinkageTable(widgetUid);
      return curTable?.uid === table.uid;
    });
    if (!isEmpty(selectedWidgetUids)) {
      nextLinkageFields[selectedFieldId] = selectedWidgetUids;
    }
  });
  rule.value.linkageFields = nextLinkageFields;
}

const checkIsSelectLinkageTable = (index: number) => {
  const checkedLinkageWidgets = rule.value.linkageWidgets.map(linkWidgetUID => {
    return linkWidgetsInCurrentBoard.value.find(widget => widget.uid === linkWidgetUID);
  });
  if (checkedLinkageWidgets.length === 0) {
    return false;
  }
  let allSelectTables = checkedLinkageWidgets.map(widget => getLinkageTable(widget.uid));
  // 数据源使用同一张表的情况，右侧联动表单只显示一个
  if (allSelectTables.length === 0) {
    return false;
  } else {
    const seen = new Set();
    const tableIsFirstShowArr = allSelectTables.map(table => {
      if (seen.has(table)) {
        return true;
      } else {
        seen.add(table);
        return false;
      }
    })
    return tableIsFirstShowArr[index];
  }
}

const updateLinkageFieldMap = () => {
  const validTableUidSet = new Set(tablesOfNeedFilter.value.map(table => table.uid));
  Object.keys(selectedTableFields.value).forEach(tableUid => {
    if (!validTableUidSet.has(tableUid)) {
      delete selectedTableFields.value[tableUid];
    }
  });
  tablesOfNeedFilter.value.forEach(table => {
    if (!selectedTableFields.value[table.uid]) {
      selectedTableFields.value[table.uid] = null;
    }
  });
  rebuildLinkageFields();
}

const getLinkageTable = (linkWidgetUID: string) => {
  const curWidget = linkWidgetsInCurrentBoard.value.find(widget => widget.uid === linkWidgetUID);
  if (tableWidgetType.includes(curWidget?.type)) {
    return props.widget.getTable((curWidget as any).formTableUID)
  }
  const widgetMetaData = (curWidget as Widget)?.getMetaData() as WidgetMetaData;
  return props.widget.getTable([widgetMetaData.axisValue[0].uid[0], widgetMetaData.axisValue[0].uid[1]]);
}

const notAllowSelectTypes = ["widget.form.selectData", "widget.form.relatedData", "widget.form.richTextEditor", "widget.form.markdownEditor", "widget.form.splitLine", "widget.form.file-uploader", "widget.form.image-uploader", "widget.form.titleBar", "widget.form.imageTextShow"];
const getLinkageFieldOption = (index: number) => {
  const table = tablesOfNeedFilter.value[index];
  const filterFields = table?.fields.filter(f => !isSystemField(f) && f.meta?.subType !== 'subForm' && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)) || []
  let fieldOptions = [];
  for (const fieldItem of filterFields) {
    // 只有第一个选择字段的数据源表单可以选择所有的字段，其他的只能选择和第一个选择字段相同类型的字段
    if (fieldItem) {
      if (index === 0) {
        fieldOptions.push({
          label: fieldItem.alias,
          value: fieldItem.uid,
          selfField: fieldItem
        });
      } else {
        const firstSelectFieldUid = selectedTableFields.value[tablesOfNeedFilter.value[0]?.uid];
        if (!firstSelectFieldUid) continue;
        const firstSelectField = tablesOfNeedFilter?.value[0].fields.find(f => f.uid === firstSelectFieldUid);
        if (!firstSelectField) return [];
        if (fieldItem.type === firstSelectField.type && fieldItem.meta?.subType === firstSelectField.meta?.subType) {
          fieldOptions.push({
            label: fieldItem.alias,
            value: fieldItem.uid,
            selfField: fieldItem
          });
        }
      }
    }
  }
  return fieldOptions;
}

const checkCanSelectField = (index) => {
  if (rule.value.linkageWidgets.length > 0 && index !== 0 && !selectedTableFields.value[tablesOfNeedFilter.value[0]?.uid]) {
    return false;
  }
  return true;
}

const handleFieldChange = async (fieldId: string, index: number) => {
  for(const widgetUid of rule.value.linkageWidgets) {
    const curTable = getLinkageTable(widgetUid);
    if (rule.value.linkageFields[fieldId]) {
      if(curTable.fields.find(f => f.uid === fieldId) && !rule.value.linkageFields[fieldId]?.includes(widgetUid)) {
        rule.value.linkageFields[fieldId].push(widgetUid);
      }
    } else {
      if(curTable.fields.find(f => f.uid === fieldId) && selectedTableFields.value[curTable.uid] === fieldId) {
        rule.value.linkageFields[fieldId] = [widgetUid];
        for (const item of Object.keys(rule.value.linkageFields)) {
          if (item !== fieldId && curTable.fields.find(f => f.uid === item)) {
            delete rule.value.linkageFields[item];
          }
        }
      }
    }
  }

  if (index === 0) {
    for (const [itemIndex, item] of Object.keys(rule.value.linkageFields).entries()) {
      const curTable = getLinkageTable(rule.value.linkageFields?.[item][0]);
      if (item !== fieldId && selectedTableFields.value[curTable.uid] === item) {
        selectedTableFields.value[curTable.uid] = null;
        delete rule.value.linkageFields[item];
      }
    }
  }
  rebuildLinkageFields();
}
</script>

<style lang="scss" scoped>
.linkage-fields-setting-dialog-wrap {

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

  :deep(.linkage-fields-setting-dialog) {
    height: 558px;
    border-radius: 8px;
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

      .container {
        display: flex;
        padding: 24px 20px;
        height: 100%;

        .setting-title {
          font-weight: 500;
          font-size: 14px;
          color: #141414;
          margin-bottom: 16px;
        }

        .setting-left {
          flex: 1;
          height: calc(100% - 20px);

          .container-scrollbar {
            .checkbox-linkage-widget {
              display: flex;
              flex-direction: column;

              .el-checkbox:last-child {
                margin-bottom: 0;
              }
            }
          }

          .no-data {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            font-size: 14px;
            color: #86909C;
          }
        }

        .el-divider {
          font-size: 398px;
          margin: 0 24px;
        }

        .setting-right {
          flex: 1;
          height: calc(100% - 20px);

          .container-scrollbar {
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
                font-size: 14px;
                margin-bottom: 4px;
              }
            }
          }

          .no-data {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            font-size: 14px;
            color: #86909C;
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
</style>
