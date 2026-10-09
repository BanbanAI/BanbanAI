<template>
  <div class="field-eidt-option-dialog-wrap">
    <el-dialog
      class="table-eidt-option-dialog"
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      @open="onOpen"
      :title="$t('TableBatchEditDialog.batchEdit')"
      align-center
      width="680"
      destroy-on-close
      :close-on-click-modal="false"
      draggable
    >
      <div class="rows-length">
        {{ $t('TableBatchEditDialog.willEdit') }}
        <span>
          {{ checkRows?.length ?? 0 }}{{ $t('TableBatchEditDialog.dataRows') }}
        </span>
      </div>
      <div class="tips">
        <span>
          {{ $t('TableBatchEditDialog.tip1') }}
        </span><br>
        <span>
          {{ $t('TableBatchEditDialog.tip2') }}
        </span><br>
        <span>
          {{ $t('TableBatchEditDialog.tip3') }}
        </span>
      </div>
      <div class="list-title">
        <div class="switch-mode">
          <div class="switch-child" :class="{'active': fieldMode === FieldMode.Multi}" @click="fieldMode = FieldMode.Multi">{{ $t('TableBatchEditDialog.multiFieldMode') }}</div>
          <div class="switch-child" :class="{'active': fieldMode === FieldMode.Single}" @click="fieldMode = FieldMode.Single">{{ $t('TableBatchEditDialog.singleFieldMode') }}</div>
        </div>

        <el-button class="btn-add-field" type="primary" link @click="handleAddField" v-if="fieldMode === FieldMode.Multi && getFields.length > fieldEditOptions.length">
          <el-icon :size="14"><i-ep-plus /></el-icon>{{ $t('TableBatchEditDialog.addField') }}
        </el-button>
        <div class="operation-prompt" v-else-if="fieldMode != FieldMode.Multi">
          <el-icon class="icon-prompt" :size="14" :color="'var(--text-color-placeholder)'"><i-ep-warning /></el-icon>
          <span>{{ $t('TableBatchEditDialog.singleModeTip') }}</span>
        </div>
      </div>
      <div class="list-header">
        <span>{{ $t('TableBatchEditDialog.selectEditField') }}</span>
        <span>{{ $t('TableBatchEditDialog.batchEdit') }}</span>
      </div>
      <el-scrollbar class="container-scrollbar">
        <el-form class="container" :rules="formRules" :model="fieldEditOptions" ref="formRef">
          <ul class="field-list">
            <li class="field-item" v-for="(fieldEditOption, index) in fieldEditOptions">
              <!-- field-select -->
              <el-form-item prop="fieldId" :rules="getConditionFormRules(fieldEditOption, 'fieldId')">
                <field-select
                  class="field-select"
                  v-model="fieldEditOption.fieldId"
                  :options="fieldSelectOptions"
                  :show-arrow="false"
                  :offset="4"
                  :no-data-text="$t('TableBatchEditDialog.noField')"
                  :placeholder="$t('TableBatchEditDialog.selectField')"
                  @change="handleChangeFieldId(index)"
                />
              </el-form-item>
              <!-- text -->
              <span style="display: flex; align-items: center;">{{ $t('TableBatchEditDialog.modifyTo') }}</span>
              <!-- edit-select -->
              <div class="edit-option-wrapper">
                <el-select
                  class="edit-option-select"
                  v-model="fieldEditOption.editOption"
                  :disabled="!fieldEditOption.fieldId"
                  :suffix-icon="CaretBottom"
                  :show-arrow="false"
                  :offset="4"
                  popper-class="table-data-filiter-rule-select-popper"
                  @change="() => {fieldEditOption.value = undefined}"
                >
                  <el-option
                    v-for="item in editOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </div>
              <!-- input -->
              <el-form-item style="flex: 1;" v-if="fieldEditOption.editOption === EditOption.Modify" prop="value" :rules="getConditionFormRules(fieldEditOption, 'value')">
                <table-batch-edit-input
                  :field="getEditField(fieldEditOption.fieldId)"
                  :model-value="fieldEditOption.value"
                  :disabled="!fieldEditOption.fieldId"
                  @change="handleChangeFieldOptions($event, index)"
                />
              </el-form-item>
              <!-- disabled -->
              <el-form-item style="flex: 1;" v-if="fieldEditOption.editOption === EditOption.Clear">
                <el-input class="value-input" placeholder="Null" disabled></el-input>
              </el-form-item>
              <!-- formula -->
              <el-form-item style="flex: 1;" v-if="fieldEditOption.editOption === EditOption.Formula" prop="value">
                <el-button
                  :class="['formula-button', fieldEditOption.value ? 'has-formula' : '']"
                  :style="{color: fieldEditOption.value ? 'var(--color-primary)' : 'var(--text-color-regular)'}"
                  :disabled="!fieldEditOption.fieldId"
                  @click="handleEditFormula(fieldEditOption.value)"
                >
                  {{ fieldEditOption.value ? $t('TableBatchEditDialog.setted') : $t('TableBatchEditDialog.setFormula') }}
                </el-button>
              </el-form-item>

              <el-button class="btn-delete-item" link @click="handleDeleteOption(index)" v-if="fieldMode === FieldMode.Multi">
                <el-icon :size="14"><i-ep-delete /></el-icon>
              </el-button>
            </li>
          </ul>
        </el-form>
      </el-scrollbar>

      <template #footer>
        <div class="wrapper-btns">
          <el-button @click="handleCancel">{{ $t('TableBatchEditDialog.cancel') }}</el-button>
          <el-button type="primary" @click="handleConfirm">{{ $t('TableBatchEditDialog.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
  <teleport to="body">
    <form-default-value-formula-dialog
      ref="formulaDialogRef"
      v-model="visible"
      :value="formulaValue"
      @update="(value) => {
        fieldEditOptions[0].value = value
      }"
      :includeSelf="true"
    />
  </teleport>
</template>

<script lang='ts' setup>
import { computed, provide, reactive, ref, watch, inject } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { CaretBottom } from "@element-plus/icons-vue";
import { useTable } from '../hooks';
import { createFormulaRuntimeByData, getUUIDSystemField, isSystemField, replaceByFormula, replaceColFieldsByFormula, SystemField } from '@common/utils';
import { Field, FieldUID, Row, TableUID } from '@common/types/project';
import { equals, isEmpty } from '@common/utils/object';
import { ACTIVE_ELEMENT, ORGANIZE_UTIL } from '@renderer/types';
import i18next from 'i18next';
import { FormWidgetType } from "@common/types/nocode";
import { FieldSelectOption } from '@renderer/b2/types';
import dayjs from 'dayjs';
import { TABLE_DATE_VALUE_FORMAT, TABLE_TIME_VALUE_FORMAT } from '../date-filter';
import { cloneDeep as deepClone } from 'lodash';

enum EditOption {
  Modify = "Modify",
  Clear = "Clear",
  Formula = "Formula",
}

enum FieldMode {
  Multi = "Multi",
  Single = "Single"
}

type FieldEditOption = {
  fieldId: string,
  editOption: EditOption,
  value: any,
}

type TableUpdateTask = {
  label: string,
  tableUID: TableUID,
  keyFieldUID: FieldUID,
  rows: Row[],
}

const props = defineProps<{
  modelValue: boolean,
  // subForm: SubForm;
  // selectedRows: any[];
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
}>();

const fieldMode = ref<FieldMode>(FieldMode.Multi)
const table = useTable();

const checkRows = computed(() => {
  return table.checkboxRow || []
});

const formRef = ref<FormInstance>();
const editOptions = computed(() => {
  const option = [
    {
      label: i18next.t('TableBatchEditDialog.customValue'),
      value: EditOption.Modify,
      visible: true
    },
    {
      label: i18next.t('TableBatchEditDialog.editFormula'),
      value: EditOption.Formula,
      visible: fieldMode.value === FieldMode.Single
    },
    {
      label: i18next.t('TableBatchEditDialog.null'),
      value: EditOption.Clear,
      visible: true
    }
  ]
  return option.filter(item => item.visible);
})

watch(() => fieldMode.value, () => {
  fieldEditOptions.value = [{
    fieldId: undefined,
    editOption: EditOption.Modify,
    value: undefined
  }]
})

const formRules = reactive<FormRules<FieldEditOption>>({
})
const fieldEditOptions = ref<FieldEditOption[]>([])

const getConditionFormRules = <T>(condition: T, key: keyof T) => {
  return [
    {
      required: true,
      validator(rule, value, callback) {
        if (!condition[key]) return callback(new Error(''));
        if (key === 'value') {
          const fieldEditOption = condition as FieldEditOption;
          const field = getEditField(fieldEditOption.fieldId);
          const isTextHyperlink = getFieldWidgetType(field) === FormWidgetType.HYPERLINK
            && field?.meta?.extra?.linkType !== 'form';
          const isFormHyperlink = getFieldWidgetType(field) === FormWidgetType.HYPERLINK
            && field?.meta?.extra?.linkType === 'form';
          if (fieldEditOption.editOption === EditOption.Modify && isTextHyperlink) {
            try {
              new URL(String(value));
            } catch (_) {
              return callback(new Error(i18next.t('TableBatchEditDialog.invalidUrl')));
            }
          }
          if (fieldEditOption.editOption === EditOption.Modify
            && isFormHyperlink
            && !getHyperlinkFormOptions(fieldEditOption.fieldId).some(item => item.value === value)) {
            return callback(new Error(i18next.t('TableBatchEditDialog.invalidLinkForm')));
          }
        }
        callback();
      }
    }
  ]
}

const handleChangeFieldId = (index: number) => {
  const fieldEditOption = fieldEditOptions.value[index];
  fieldEditOption.value = '';
  if (fieldEditOption.editOption === EditOption.Formula && isLinkFormField(fieldEditOption.fieldId)) {
    fieldEditOption.editOption = EditOption.Modify;
  }
}

const handleDeleteOption = (index: number) => {
  fieldEditOptions.value.splice(index, 1);
}

const handleAddField = () => {
  fieldEditOptions.value.push({
    fieldId: undefined,
    editOption: EditOption.Modify,
    value: undefined
  })
}

// 支持的组件
const useWidgetType = [
  FormWidgetType.TEXT_INPUT,
  FormWidgetType.TEXTAREA,
  FormWidgetType.NUMBER_INPUT,
  FormWidgetType.RADIO_GROUP,
  FormWidgetType.CHECKBOX_GROUP,
  FormWidgetType.TREE_SELECT,
  FormWidgetType.TREE_MULTIPLE_SELECT,
  FormWidgetType.TIME_PICKER,
  FormWidgetType.DATE_PICKER,
  FormWidgetType.DATE_RANGE_PICKER,
  FormWidgetType.DEPARTMENT_SELECT,
  FormWidgetType.MEMBER_SELECT,
  FormWidgetType.AMOUNT_INPUT,
  FormWidgetType.HYPERLINK,
]

const getFields = computed(() => {
  const fields = table.table?.fields?.filter(f => !isSystemField(f))?.map(f => {
    if(f?.meta?.subType === 'subForm') {
      const subTable = table.getTable(f?.meta?.extra?.subTableUID[1]);
      return subTable?.fields?.filter(subF => !isSystemField(subF)).map(subF => {
        return {
          ...subF,
          uid: `${f.uid}.${subF.uid}`,
          alias: `${f.alias}.${subF.alias}`
        }
      }) || []
    }
    return f
  })
  .flat(Infinity)
  .filter(f => useWidgetType.includes(getFieldWidgetType(f as Field) as FormWidgetType)) || []
  return (fields || []) as Field[]
})

const fieldSelectOptions = computed<FieldSelectOption[]>(() => {
  return getFields.value.map(field => ({
    label: field.alias,
    value: field.uid,
    disabled: fieldEditOptions.value.some(item => item.fieldId === field.uid),
  }));
})

const getEditField = (fieldId: string) => {
  return getFields.value.find(f => f.uid === fieldId)
}

const getFieldWidgetType = (field: Field) => {
  return field?.meta?.extra?.widgetType || '';
}

const isLinkFormField = (fieldId?: string) => {
  const field = getEditField(fieldId);
  return getFieldWidgetType(field) === FormWidgetType.HYPERLINK
    && field?.meta?.extra?.linkType === 'form';
}

const getHyperlinkFormOptions = (fieldId?: string): Array<{ label: string, value: string }> => {
  const field = getEditField(fieldId);
  if (!isLinkFormField(fieldId) || !field?.meta?.uid) {
    return [];
  }
  const widget = table.form?.getChildElement(field.meta.uid) as unknown as {
    tableChoices?: Array<{ label: string, value: string }>,
  };
  return Array.isArray(widget?.tableChoices) ? widget.tableChoices : [];
}

const normalizeDateValue = (value: any, format: string) => {
  if (Array.isArray(value)) {
    return value.map(item => normalizeDateValue(item, format));
  }
  if (value === '' || value === null || value === undefined) {
    return value;
  }
  const dateValue = dayjs(value);
  if (dateValue.isValid()) {
    return dateValue.format(format);
  }
  return value;
}

const normalizeFieldEditValue = (fieldId: string, value: any) => {
  const field = getEditField(fieldId);
  const widgetType = getFieldWidgetType(field) as FormWidgetType;
  if ([FormWidgetType.DATE_PICKER, FormWidgetType.DATE_RANGE_PICKER].includes(widgetType)) {
    return normalizeDateValue(value, TABLE_DATE_VALUE_FORMAT);
  }
  if (widgetType === FormWidgetType.TIME_PICKER) {
    return normalizeDateValue(value, TABLE_TIME_VALUE_FORMAT);
  }
  return value;
}

const getFormulaReferenceValue = (value: any, fallback: any = '') => {
  return value === undefined || value === null ? fallback : value;
}

const resolveFormulaField = (tableUID: string, widgetId: string) => {
  const sourceTable = table.getTable(tableUID) || table.table;
  const field = sourceTable?.fields?.find(item => (
    item.uid === widgetId || item.meta?.uid === widgetId
  ));
  const widget = table.form?.getChildElement?.(widgetId) || table.form?.children?.find(item => (
    item.uid === widgetId || item.fieldId === field?.uid
  ));
  return {
    fieldId: field?.uid || widget?.fieldId,
    widget,
  };
}

const onOpen = () => {
  if (fieldEditOptions.value.length === 0) handleAddField();
}

const handleChangeFieldOptions = (value, index: number) => {
  const fieldId = fieldEditOptions.value[index]?.fieldId;
  fieldEditOptions.value[index].value = fieldId ? normalizeFieldEditValue(fieldId, value) : value;
}

const buildMainTableDiffRows = (oldRows: Row[], rows: Row[], fieldIds: FieldUID[]) => {
  const uuidFieldUID = getUUIDSystemField(table.table.fields).uid;
  return rows.reduce<Row[]>((result, row, index) => {
    const oldRow = oldRows[index] || {};
    const diffRow = {
      [uuidFieldUID]: row[uuidFieldUID],
    } as Row;

    for (const fieldId of fieldIds) {
      if (equals(row?.[fieldId], oldRow?.[fieldId])) continue;
      diffRow[fieldId] = row?.[fieldId];
    }

    if (Object.keys(diffRow).length > 1) {
      result.push(diffRow);
    }
    return result;
  }, []);
}

const buildSubTableUpdateTasks = (
  oldRows: Row[],
  rows: Row[],
  subFieldGroups: Map<FieldUID, Set<FieldUID>>,
) => {
  const tasks: TableUpdateTask[] = [];
  const mainUUIDFieldUID = getUUIDSystemField(table.table.fields).uid;

  for (const [parentFieldUID, fieldIds] of subFieldGroups.entries()) {
    const parentField = table.table.fields.find(field => field.uid === parentFieldUID);
    const subTableUID = parentField?.meta?.extra?.subTableUID?.[1];
    if (!parentField || !subTableUID) continue;

    const subTable = table.getTable(subTableUID);
    if (!subTable) continue;

    const subUUIDFieldUID = getUUIDSystemField(subTable.fields).uid;
    const relationFieldUID = subTable.fields.find(field => field.meta?.name === SystemField.KEY)?.uid;
    const diffRows = rows.reduce<Row[]>((result, row, index) => {
      const oldRow = oldRows[index] || {};
      const oldSubRows = Array.isArray(oldRow?.[parentFieldUID]) ? oldRow[parentFieldUID] : [];
      const oldSubRowMap = new Map(oldSubRows.map(item => [item?.[subUUIDFieldUID], item]));
      const subRows = Array.isArray(row?.[parentFieldUID]) ? row[parentFieldUID] : [];

      for (const subRow of subRows) {
        const subRowUUID = subRow?.[subUUIDFieldUID];
        if (!subRowUUID) continue;

        const oldSubRow = oldSubRowMap.get(subRowUUID) || {};
        const diffRow = {
          [subUUIDFieldUID]: subRowUUID,
        } as Row;
        if (relationFieldUID) {
          diffRow[relationFieldUID] = subRow?.[relationFieldUID] ?? row?.[mainUUIDFieldUID];
        }

        let changed = false;
        for (const fieldId of fieldIds.values()) {
          if (equals(subRow?.[fieldId], oldSubRow?.[fieldId])) continue;
          diffRow[fieldId] = subRow?.[fieldId];
          changed = true;
        }

        if (changed) {
          result.push(diffRow);
        }
      }

      return result;
    }, []);

    if (!diffRows.length) continue;
    tasks.push({
      label: subTable.alias || parentField.alias,
      tableUID: subTableUID,
      keyFieldUID: subUUIDFieldUID,
      rows: diffRows,
    });
  }

  return tasks;
}

const buildUpdateTasks = (oldRows: Row[], rows: Row[], options: FieldEditOption[]) => {
  const tasks: TableUpdateTask[] = [];
  const mainFieldIds = new Set<FieldUID>();
  const subFieldGroups = new Map<FieldUID, Set<FieldUID>>();

  for (const option of options) {
    if (!option.fieldId) continue;
    if (!option.fieldId.includes('.')) {
      mainFieldIds.add(option.fieldId as FieldUID);
      continue;
    }

    const [parentFieldUID, subFieldUID] = option.fieldId.split('.') as [FieldUID, FieldUID];
    if (!subFieldGroups.has(parentFieldUID)) {
      subFieldGroups.set(parentFieldUID, new Set<FieldUID>());
    }
    subFieldGroups.get(parentFieldUID)?.add(subFieldUID);
  }

  const mainRows = buildMainTableDiffRows(oldRows, rows, Array.from(mainFieldIds));
  if (mainRows.length) {
    tasks.push({
      label: table.table.alias,
      tableUID: table.table.uid,
      keyFieldUID: getUUIDSystemField(table.table.fields).uid,
      rows: mainRows,
    });
  }

  tasks.push(...buildSubTableUpdateTasks(oldRows, rows, subFieldGroups));
  return tasks;
}

const handleConfirm = async () => {
  if (fieldEditOptions.value.some(option => (
    isLinkFormField(option.fieldId) || option.editOption === EditOption.Formula
  ))) {
    try {
      await table.ensureFormReady();
    } catch (_) {
      ElMessage.warning(i18next.t('TableBatchEditDialog.invalidLinkForm'));
      return;
    }
  }
  await formRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.warning(i18next.t('TableBatchEditDialog.batchEditCondition'));
      return;
    }
    const selectedRows = [...new Set(checkRows.value.map(i => i[table.rowKey]))]
    const rows = selectedRows.map(key => {
      return table.getRow(key)
    })
    const oldRows = deepClone(rows)
    for(const option of fieldEditOptions.value) {
      const isSubformField = option.fieldId.includes('.');
      if(!isSubformField) {
        if (option.editOption === EditOption.Modify && option.value !== undefined) {
          const nextValue = normalizeFieldEditValue(option.fieldId, option.value);
          for(const row of rows) {
            row[option.fieldId] = nextValue;
          }
        } else if (option.editOption === EditOption.Clear) {
          for(const row of rows) {
            row[option.fieldId] = undefined;
          }
        } else if (option.editOption === EditOption.Formula && option.value !== undefined) {
          for(const row of rows) {
            let colFormula = replaceColFieldsByFormula(option.value, (keys) => {
              const [tableUID, widgetId, subWidgetId] = keys;
              const { fieldId, widget } = resolveFormulaField(tableUID, widgetId);
              const fieldValue = row[fieldId];
              if (isEmpty(fieldValue)) return null;
              if (subWidgetId) {
                const subWidget = widget.children?.find(c => c.uid === subWidgetId);
                const subFieldId = subWidget?.fieldId;
                return fieldValue.map(i => i[subFieldId]);
              } else {
                return [fieldValue];
              }
            })
            const formula = replaceByFormula(colFormula, (keys) => {
              const [tableUID, widgetId, subWidgetId] = keys;
              const { fieldId, widget } = resolveFormulaField(tableUID, widgetId);
              if(subWidgetId) {
                const subFieldId = widget.children?.find(c => c.uid === subWidgetId).fieldId;
                const subRows = row[fieldId] || [];
                if(subRows) {
                  return getFormulaReferenceValue(subRows?.[0]?.[subFieldId], undefined);
                }
              } else {
                return getFormulaReferenceValue(row[fieldId]);
              }
            });
            try {
              const formulaRuntime = createFormulaRuntimeByData(row, table.getTable(table.formTableUID)?.fields);
              row[option.fieldId] = normalizeFieldEditValue(option.fieldId, formulaRuntime.evaluate(formula) ?? '');
            } catch (err) {
              return;
            }
          }
        }
      } else {
        const [fieldId, subFieldId] = option.fieldId.split('.');
        if (option.editOption === EditOption.Modify && option.value !== undefined) {
          const nextValue = normalizeFieldEditValue(option.fieldId, option.value);
          for(const row of rows) {
            const subRows = row[fieldId] || [];
            for(const subRow of subRows) {
              subRow[subFieldId] = nextValue;
            }
          }
        } else if (option.editOption === EditOption.Clear) {
          for(const row of rows) {
            const subRows = row[fieldId] || [];
            for(const subRow of subRows) {
              subRow[subFieldId] = undefined
            }
          }
        } else if (option.editOption === EditOption.Formula && option.value !== undefined) {
          for(const row of rows) {
            const subRows = row[fieldId] || [];
            for(const subRow of subRows) {
              let colFormula = replaceColFieldsByFormula(option.value, (keys) => {
                const [tableUID, widgetId, subWidgetId] = keys;
                const { fieldId: _fieldId, widget } = resolveFormulaField(tableUID, widgetId);
                const fieldValue = row[_fieldId];
                if (isEmpty(fieldValue)) return null;
                if (subWidgetId) {
                  const subWidget = widget.children?.find(c => c.uid === subWidgetId);
                  const subFieldId = subWidget?.fieldId;
                  return fieldValue.map(i => i[subFieldId]);
                } else {
                  return [fieldValue];
                }
              })
              const formula = replaceByFormula(colFormula, (keys) => {
                const [tableUID, widgetId, subWidgetId] = keys;
                const { fieldId: _fieldId, widget } = resolveFormulaField(tableUID, widgetId);
                if(subWidgetId) {
                  const subFieldId = widget.children?.find(c => c.uid === subWidgetId).fieldId;
                  if(_fieldId === fieldId) {
                    return getFormulaReferenceValue(subRow?.[subFieldId], undefined);
                  } else {
                    const _subRows = row[_fieldId] || [];
                    if(_subRows) {
                      return getFormulaReferenceValue(_subRows?.[0]?.[subFieldId], undefined);
                    }
                  }
                } else {
                  return getFormulaReferenceValue(row[fieldId]);
                }
              });
              try {
                const field = table.table.fields.find(f => f.uid === fieldId);
                const subTable = table.tables.find(t => t.uid === field?.meta?.extra?.subTableUID?.[1]);
                const formulaRuntime = createFormulaRuntimeByData(subRow, subTable.fields);
                subRow[subFieldId] = normalizeFieldEditValue(option.fieldId, formulaRuntime.evaluate(formula) ?? '');
              } catch (err) {
                return;
              }
            }
          }
        }
      }
    }
    const updateTasks = buildUpdateTasks(oldRows, rows, fieldEditOptions.value);

    if (updateTasks.length === 0) {
      emit("update:modelValue", false);
      fieldEditOptions.value = [];
      return;
    }

    let hasSubmittedTask = false;
    try {
      for (const task of updateTasks) {
        await table.updateTableRows({
          tableUID: task.tableUID,
          rows: task.rows,
          keyFieldUID: task.keyFieldUID,
        });
        hasSubmittedTask = true;
      }
    } catch (err) {
      if (hasSubmittedTask) {
        table.refreshData()
      }
      ElMessage.error(err.message);
      return;      
    }
    table.refreshData()
    emit("update:modelValue", false);
    fieldEditOptions.value = [];
  });
}

const handleCancel = () => {
  emit('update:modelValue', false);
  fieldEditOptions.value = [];
}

const visible = ref(false)
const formulaValue = ref("")
const handleEditFormula = (formula) => {
  visible.value = true
  formulaValue.value = formula
}
provide(ACTIVE_ELEMENT, computed(() => table.form.children[0] as any))
</script>

<style lang="scss" scoped>
:deep(.table-data-filiter-rule-select-popper) {
  --el-bg-color-overlay: var(--bg-color-page);
}

:deep(.table-eidt-option-dialog) {
  --el-dialog-padding-primary: 0;
  --el-dialog-bg-color: var(--bg-color-page);
  --dialog-header-height: 40px;
  --dialog-footer-height: 64px;
  border-radius: 4px;
  
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
    height: 662px;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    
    .el-select__wrapper {
      height: 32px;
      background-color: var(--bg-color-overlay);
      border-radius: 4px;
      box-shadow: 0 0 0 0px var(--border-color) inset;
      
      &:hover {
        box-shadow: 0 0 0 1px var(--border-color) inset;
      }
      
      &.is-focused {
        box-shadow: 0 0 0 1px var(--color-primary) inset !important;
      }
      
      .el-select__selected-item.is-transparent span {
        font-size: 12px;
      }
    }

    .rows-length {
      margin-bottom: 12px;
      color: #4e5969;
      line-height: 22px;
      font-size: 14px;
    }

    .tips {
      padding: 9px 8px;
      background-color: #fffbe9;
      border-radius: 4px;
      color: #CF870C;
      margin-bottom: 12px;
      line-height: 22px;
    }
    
    .list-title {
      display: flex;
      margin-bottom: 24px;
      
      .switch-mode {
        border-radius: 4px;
        padding: 3px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 3px;
        background-color: var(--bg-color-overlay);
        width: fit-content;
        
        .switch-child {
          cursor: pointer;
          height: 26px;
          width: 62px;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 14px;
          color: var(--text-color-regular);
          border-radius: 2px;
          transition: all 0.3s ease-in-out;
          
          &.active {
            background-color: #fff;
            color: var(--color-primary);
          }
        }
      }

      .btn-add-field {
        margin-left: auto;
      }

      .operation-prompt {
        display: flex;
        align-items: center;
        gap: 2px;
        color: var(--text-color-placeholder);
        margin-left: auto;
      
        .icon-prompt {
          font-size: 14px;
          line-height: 20px;
        }
      }
    }


    .list-header {
      span {
        display: inline-block;
        width: 270px;
        margin-right: 8px;
        margin-bottom: 8px;
      }
    }

    .container-scrollbar {
      flex-grow: 1;
      flex-shrink: 1;
      flex-basis: 0%;

      .container {
        display: flex;
        flex-direction: column;
        align-items: start;

        .field-list {
          display: flex;
          flex-direction: column;
          row-gap: 8px;
          width: 100%;

          .field-item {
            display: flex;
            gap: 8px;
            width: 100%;
            position: relative;

            .el-form-item {
              margin-bottom: 0;

              &.is-error {
                .el-select__wrapper, .el-input__wrapper {
                  box-shadow: 0 0 0 1px var(--color-danger) inset !important;
                }
              }
            }

            .field-select {
              width: 216px;
            }

            .edit-option-select {
              width: 104px;

              .el-select__wrapper {
                padding: 8px 4px 8px 8px;
                gap: 4px;

                .el-select__selected-item span {
                  font-size: 12px;
                }

                .el-select__suffix {
                  font-size: 16px;
                }
              }
            }

            .value-input {
              flex: 1;
              width: 100%;
              border-radius: 4px;
              background-color: var(--bg-color-overlay);

              .el-input__wrapper {
                border-radius: 4px;
                background-color: var(--bg-color-overlay);
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

            .formula-button {
              width: 100%;
              border-radius: 4px;

              &.has-formula :deep(span) {
                color: var(--color-primary);
              }
            }

            .btn-delete-item {
              margin-left: auto;

              &:hover {
                color: var(--color-danger);
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
    justify-content: flex-end;
    align-items: center;


    .el-button {
      border-radius: 4px;
    }
  }
}
</style>
