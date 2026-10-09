<template>
  <div class="target-form-field">
    <div class="title">
      <span class="title-text">
        <span style="color: #f56c6c; font-size: 16px;">
          *
        </span>
        {{ props.titleText || $t('TargetFormField.setTargetFormFieldValue') }}
      </span>
      <el-tooltip
        effect="light"
        :content="$t('TargetFormField.dataOwnerFieldTip')"
        placement="bottom"
      >
        <el-icon class="title-tip-icon">
          <i-ant-design-question-circle-outlined/>
        </el-icon>
      </el-tooltip>
      <div
        class="add-button"
        v-if="props.mode === 'edit' && displayTargetFields?.length < targetFieldOption?.length"
        @click="addTargetField"
      >
        <el-icon>
          <i-ep-plus/>
        </el-icon>
        <span>
          {{ $t('TargetFormField.addField') }}
        </span>
      </div>
    </div>
    <div class="container">
      <el-form
        class="item"
        v-for="({ field, index: fieldIndex }) in displayTargetFields"
        :key="`${fieldIndex}-${field.fieldUID || 'empty'}-${field.type || 'type'}`"
        :model="field"
        :rules="rules"
        ref="formRef"
      >
        <div style="display: flex; gap: 4px;">
          <span
            style="color: #f56c6c; font-size: 20px;"
            :style="{
              opacity: isTargetFieldRequired(field.fieldUID) ? 1 : 0,
            }"
          >
            *
          </span>
          <el-form-item v-if="props.mode != 'add'" prop="fieldUID">
            <el-select
              class="target-field"
              v-model="field.fieldUID"
              :no-data-text="$t('TargetFormField.noField')"
              :placeholder="$t('TargetFormField.selectField')"
              @change="handleTargetFieldChange(field)"
            >
              <el-option
                v-for="item in targetFieldOption"
                :key="item.uid"
                :value="item.uid"
                :label="item.alias"
                :disabled="item.disabled"
              />
              <template #label="{ label, value }">
                <span v-if="label === value" style="color: var(--el-color-danger);">{{ $t('TargetFormField.fieldDeleted') }}</span>
                <span v-else>{{ label }}</span>
              </template>
            </el-select>
          </el-form-item>
          <div v-else class="target-field-disable" :title="getFieldAlias(field.fieldUID)" :class="{ 'field-deleted': !targetFieldOption.find(item => item.uid === field.fieldUID) }">
            {{ getFieldAlias(field.fieldUID) }}
          </div>
        </div>
        <span class="sign">=</span>
        <div class="auto-related" v-if="field.type === TargetFieldFillType.AUTO_RELATED">{{ targetFieldFillTypeName[TargetFieldFillType.AUTO_RELATED] }}</div>
        <el-select v-else
          class="value-type"
          v-model="field.type"
          @change="field.value = null"
          :disabled="isFillTypeDisabled(field)"
        >
          <slot name="fillType" :field="field">
            <template v-for="value,key in TargetFieldFillType" :key="key">
              <el-option
                v-if="isAvailableFillType(field, value)"
                :label="targetFieldFillTypeName[value]"
                :value="value"
                :disabled="value === TargetFieldFillType.EMPTY && isTargetFieldRequired(field.fieldUID)"
              >
              </el-option>
            </template>
          </slot>
        </el-select>

        <div class="custom-value" v-if="field.type === TargetFieldFillType.CUSTOM">
          <el-form-item prop="value" v-if="getFuncValue(field)?.subType === 'account'">
            <el-button
              class="account-button"
              :class="{'active': field.value?.length}"
              @click="openSelectDialog('member', field.value, fieldIndex, field)"
            >
              {{ field.value?.length ? $t('TargetFormField.memberSelected') : $t('TargetFormField.selectMember') }}
            </el-button>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(field)?.subType === 'department'">
            <el-button
              class="department-button"
              :class="{'active': field.value?.length}"
              @click="openSelectDialog('department', field.value, fieldIndex, field)"
            >
              {{ field.value?.length ? $t('TargetFormField.deptSelected') : $t('TargetFormField.selectDept') }}
            </el-button>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(field)?.type === RuleFuncValue.RANGE">
            <div class="number-range" v-if="getFuncValue(field)?.subType === 'number' && field?.value?.length === 2">
              <el-input v-model="field.value[0]" type="number" :placeholder="$t('TargetFormField.minValue')" />
              <span> ~ </span>
              <el-input v-model="field.value[1]" type="number" :placeholder="$t('TargetFormField.maxValue')" />
            </div>
            <el-config-provider
              :locale="elementPlusLocale"
              v-else-if="getFuncValue(field)?.subType === 'date'"
            >
              <el-date-picker
                class="date-range"
                :value-format="'YYYY-MM-DD HH:mm:ss'"
                range-separator="~"
                v-model="field.value"
                type="daterange"
              />
            </el-config-provider>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(field)?.type === RuleFuncValue.DATE">
            <el-config-provider :locale="elementPlusLocale">
              <el-date-picker
                class="date-range"
                :value-format="'YYYY-MM-DD HH:mm:ss'"
                v-model="field.value"
                type="date"
              />
            </el-config-provider>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(field)?.type === RuleFuncValue.SELECT">
            <!-- <el-select-v2
              v-model="field.value"
              clearable
              filterable
              :options="selectOptions(field)"
              :placeholder="$t('TargetFormField.selectContent')"
            /> -->
            <el-input
              v-model="field.value"
              :placeholder="$t('TargetFormField.inputContent')"
              clearable
            />
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(field)?.type === RuleFuncValue.SELECT_MULTIPLE">
            <!-- <el-select-v2
              v-model="field.value"
              :collapse-tags="true"
              clearable
              filterable
              multiple
              :options="selectOptions(field)"
              :placeholder="$t('TargetFormField.selectContent')"
            /> -->
            <el-input-tag v-model="field.value" collapse-tags collapse-tags-tooltip tag-type="primary" filterable :placeholder="$t('TargetFormField.tagInputContent')"></el-input-tag>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(field)?.type === RuleFuncValue.ADDRESS">
            <el-tree-select
              :placeholder="$t('TargetFormField.selectContent')"
              class="drop-down"
              ref="addressRef"
              v-model="field.value"
              lazy
              :load="loadNode"
              node-key="value"
              :render-after-expand="false"
              clearable filterable check-strictly
              :highlight-current="true" :show-path="true" :empty-text="$t('TargetFormField.noData')" :props="{
                label: 'label',
                value: 'value',
                children: 'children',
                isLeaf: 'isLeaf',
              }">
            </el-tree-select>
          </el-form-item>
          <el-form-item prop="value" v-else-if="getFuncValue(field)?.type === RuleFuncValue.NUMBER">
            <el-input
              v-model="field.value"
              :placeholder="$t('TargetFormField.inputContent')"
              type="number"
            />
          </el-form-item>
          <el-form-item prop="value" v-else>
            <el-input
              v-model="field.value"
              :placeholder="$t('TargetFormField.inputContent')"
              clearable
            />
          </el-form-item>
        </div>

        <div class="field-value" v-else-if="field.type === TargetFieldFillType.FIELD">
          <el-form-item
            prop="value"
            :rules="fieldValueRule"
          >
            <el-select
              v-if="isDataOwnerTargetField(field)"
              v-model="field.value"
              clearable
              filterable
              :class="{ lost: !!getInvalidDataOwnerFieldOption(field.value) }"
              :placeholder="$t('TargetFormField.selectField')"
            >
              <el-option
                v-for="item in getDataOwnerFieldSelectOptions(field.value)"
                :key="item.value"
                :label="item.label"
                :value="item.value"
                :disabled="item.disabled"
              />
            </el-select>
            <field-tree-select
              v-else
              v-model="field.value"
              clearable
              :placeholder="$t('TargetFormField.selectField')"
              :options="getFormSelectOptions(field)"
            />
          </el-form-item>
        </div>

        <div class="formula-value" v-else-if="field.type === TargetFieldFillType.FORMULA">
          <el-form-item prop="value" >
            <el-button
              :class="['formula-button', field.value ? 'has-formula' : '']"
              @click="handleEditFormula(field, fieldIndex)"
              :style="{color: field.value ? 'var(--color-primary)' : 'var(--text-color-regular)'}"
            >
              {{ field.value ? $t('TargetFormField.formulaSet') : $t('TargetFormField.setFormula') }}
            </el-button>
          </el-form-item>
        </div>

        <el-icon
          class="delete-button"
          v-if="props.mode === 'edit'"
          @click="deleteTargetField(fieldIndex)"
        >
          <i-ep-delete/>
        </el-icon>
      </el-form>
    </div>
    <source-table-formula-dialog
      v-model="visible"
      @update="handleUpdate"
      :value="tempFormula"
      :defaultTables="defaultTables"
      :tables="sourceTablesLocal"
      :otherTableLabel="Boolean(props.showTargetTable) ? $t('TargetFormField.targetForm') : $t('TargetFormField.dataSourceForm')"
      :hiddenCurrentTable="Boolean(props.showTargetTable)"
    />
    <organize-manager-dialog
      ref="organizeManageDialogRef"
      :isInWidget="false"
      :multiple="organizeIsMultiple"
      :currentType="currentType"
      :dialogTitle="currentType === 'department' ? $t('TargetFormField.chooseDept') : $t('TargetFormField.chooseMember')"
      :tableList="tableList"
      @confirm="closeSelectDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { 
  FormWidgetType,
  RuleFunc,
  RuleFuncValue,
} from '@common/types/nocode'
import { getSystemColumnConfigurations, hasConfiguredValue, isSystemField, shouldTreatFieldAsStaticRequired } from '@common/utils'
import { computed, inject, onMounted, reactive, ref, watch, nextTick } from 'vue'
import { getChinaAddressData } from "@renderer/utils/township"
import { NOCODE, ORGANIZE_UTIL } from '@renderer/types'
import { Field, FieldUID, FLOW_DATA_OWNER_SOURCE_SUBMITTER, SourceTable, Table, TableUID, TargetFieldFillRule, TargetFieldFillType, getProcessTargetSourceUID } from '@common/types/project'
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale'
import { useFormFields, useFormTable } from '../../../hooks'
import { formElementInstances } from '@renderer/utils/instance'
import { getUUIDSystemField, SystemField } from '@common/utils/connection';
import { FormSelectGroupOption, FormTreeOption } from '@renderer/b2/types';
import { cloneDeep as deepClone, isEqual } from "lodash";
import i18next from 'i18next'
import { getNocodeDataSourceConnections, getNocodeDataSourceTableByUID, isDataOwnerEnabledTable } from '@common/utils/connection'
import { getFlowFieldWritePolicy } from '../../flowFieldPolicy'

const props = withDefaults(defineProps<{
  tableUID: TableUID,
  mode: 'add' | 'edit',
  targetFields?: TargetFieldFillRule[],
  sourceTables: SourceTable[],
  defaultTables?: Table[],
  titleText?: string,
  showTargetTable?: TableUID,
  isFillTypeDisabled?: (field: TargetFieldFillRule) => boolean,
  allowedFillTypes?: TargetFieldFillType[],
  disallowAutoRelated?: boolean,
  allowDataOwnerField?: boolean,
}>(), {
  targetFields: () => [], // 默认值
  titleText: () => i18next.t('TargetFormField.setTargetFormFieldValue'),
  isFillTypeDisabled: () => false,
  allowedFillTypes: undefined,
  disallowAutoRelated: false,
  allowDataOwnerField: false,
})

const emit = defineEmits<{
  (e: "update", value)
}>();
const localTargetFields = ref<TargetFieldFillRule[]>(deepClone(props.targetFields));
const nocode = inject(NOCODE)
const table = useFormTable();
const currentFormFields = useFormFields();
const organizeUtil = inject(ORGANIZE_UTIL)
const currentFormFieldList = computed(() => currentFormFields?.value || [])

const getDataSourceTable = (tableUID?: string | null) => {
  return getNocodeDataSourceTableByUID(nocode.value?.body, tableUID || undefined, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }, true)
}

const getTableByUID = (uid?: string | null) => {
  if (!uid) {
    return null;
  }
  return getNocodeDataSourceTableByUID(nocode.value?.body, uid, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
  }, true)?.table || null;
};

const resolveFieldByTargetFieldUID = (fieldUID?: string | null) => {
  if (!fieldUID) {
    return null;
  }
  const [fieldUIDMain, fieldUIDSub] = String(fieldUID).split(".");
  const field = formFields.value.find(item => item.uid === fieldUIDMain);
  if (!field || !fieldUIDSub) {
    return field || null;
  }
  const subTableUID = field.meta?.extra?.subTableUID?.[1];
  if (!subTableUID) {
    return null;
  }
  const subTable = getTableByUID(subTableUID);
  return subTable?.fields?.find(item => item.uid === fieldUIDSub) || null;
};

const isTargetFieldRequired = (fieldUID?: string | null) => {
  return shouldTreatFieldAsStaticRequired(resolveFieldByTargetFieldUID(fieldUID));
};

const isConfiguredValue = (value: any) => hasConfiguredValue(value);
const shouldValidateRuleValue = (field?: TargetFieldFillRule | null) => {
  if (!field) {
    return false;
  }
  return field.type !== TargetFieldFillType.EMPTY
    && field.type !== TargetFieldFillType.DEFAULT
    && field.type !== TargetFieldFillType.AUTO_RELATED;
};

const getTargetFieldDefaultType = (fieldUID?: string | null, field?: Field | null) => {
  if (isTargetFieldRequired(fieldUID)) {
    return TargetFieldFillType.CUSTOM;
  }
  if (field && isRelatedCurrentTable(field) && !props.disallowAutoRelated) {
    return TargetFieldFillType.AUTO_RELATED;
  }
  return TargetFieldFillType.EMPTY;
};

const rules = {
  fieldUID: [
    {
      validator: (rule, value, callback) => {
        if(!isConfiguredValue(value)) {
          return callback(new Error(i18next.t('TargetFormField.selectTargetFormFieldValue')))
        }
        callback()
      },
    }
  ],
  value: [
    {
      validator: (rule, value, callback, source: TargetFieldFillRule) => {
        if (!shouldValidateRuleValue(source)) {
          return callback();
        }
        if (!isConfiguredValue(value)) {
          return callback(new Error(i18next.t('TargetFormField.inputCustomValue')))
        }
        callback()
      },
    }
  ],
  fieldValue: [
    {
      validator: (rule, value, callback, source: TargetFieldFillRule) => {
        if (!shouldValidateRuleValue(source)) {
          return callback();
        }
        if (!isConfiguredValue(value)) {
          return callback(new Error(i18next.t('TargetFormField.inputCustomValue')))
        }
        callback()
      },
    }
  ],
}

const fieldValueRule = [
  {
    validator: (rule, value, callback, source: TargetFieldFillRule) => {
      if (!shouldValidateRuleValue(source)) {
        return callback();
      }
      if (!isConfiguredValue(value)) {
        return callback(new Error(i18next.t('TargetFormField.inputCustomValue')))
      }
      callback()
    },
  }
]

const formRef = ref(null)
const visible = ref(false)

const isEditableSystemField = (field?: Field | null) => {
  return props.allowDataOwnerField && field?.meta?.name === SystemField.DATA_OWNER;
}

const appendDataOwnerField = (table?: Table | null, fields: Field[] = []) => {
  if (!props.allowDataOwnerField || !isDataOwnerEnabledTable(table)) {
    return fields.filter(field => field.meta?.name !== SystemField.DATA_OWNER);
  }
  if (fields.some(field => field.meta?.name === SystemField.DATA_OWNER)) {
    return fields;
  }
  return [
    ...fields,
    {
      uid: SystemField.DATA_OWNER,
      alias: i18next.t('commonConnection.dataOwner'),
      type: 'string',
      meta: {
        name: SystemField.DATA_OWNER,
        uid: SystemField.DATA_OWNER,
        subType: 'account',
        extra: {},
        isSystem: true,
      }
    } as any,
  ]
}

const formFields = computed(() => {
  const targetTable = getDataSourceTable(props.tableUID)?.table
  if(!targetTable) {
    return []
  }
  const fields = appendDataOwnerField(targetTable, targetTable.fields)
  return fields.filter(field => { 
    return (!isSystemField(field) || isEditableSystemField(field)) && field.meta?.extra?.widgetType != 'widget.form.dateRangePicker' && !field.meta?.extra?.relatedTableUID
  })
})

const isAutoComputeField = (field?: Field) => {
  return field?.meta?.extra?.widgetType === FormWidgetType.AUTO_COMPUTE
}

const getTargetFieldByUID = (fieldUID?: FieldUID) => {
  if (!fieldUID || !targetTable.value) {
    return null
  }
  const [mainFieldUID, subFieldUID] = fieldUID.split(".")
  const field = targetTable.value.fields?.find(item => item.uid === mainFieldUID)
  if (!field || !subFieldUID) {
    return field || null
  }
  const subTableUID = field.meta?.extra?.subTableUID?.[1]
  const subTable = tables.value?.find(item => item.uid === subTableUID)
  return subTable?.fields?.find(item => item.uid === subFieldUID) || null
}

const displayTargetFields = computed(() => {
  return localTargetFields.value.reduce((result, field, index) => {
    if (field.fieldUID && isAutoComputeField(getTargetFieldByUID(field.fieldUID))) {
      return result
    }
    result.push({ field, index })
    return result
  }, [] as { field: TargetFieldFillRule, index: number }[])
})

const defaultTables = computed(() => {
  if (props.defaultTables) return props.defaultTables;
  return [
    {
      ...table.value,
      label: `${i18next.t('TargetFormField.currentForm')}-${i18next.t('TargetFormField.thisData')}`,
    }
  ]
})

const sourceTablesLocal = computed(() => {
  if(props.showTargetTable) {
    const targetTableSource = getDataSourceTable(props.showTargetTable)
    const targetTable = targetTableSource?.table
    if (!targetTable) {
      return [];
    }
    return [{
      ...targetTable,
      connectionUID: targetTableSource?.connection?.uid,
      sourceConnectionUID: targetTableSource?.connection?.uid,
      sourceTableUID: targetTable.uid,
      uid: getProcessTargetSourceUID(props.showTargetTable, table.value.uid),
      name: targetTable.alias
    }];
  }
  return (props.sourceTables || []).reduce((acc, sourceTable) => {
    const tableSource = getNocodeDataSourceTableByUID(nocode.value?.body, sourceTable.tableUID, {
      nocodeId: nocode.value?.meta?.id,
      name: nocode.value?.meta?.name,
      includeSchemaSources: true,
    }, true);
    if (tableSource?.table) {
      acc.push({
        ...tableSource.table,
        connectionUID: tableSource.connection?.uid,
        sourceConnectionUID: tableSource.connection?.uid,
        sourceTableUID: tableSource.table.uid,
        name: sourceTable.alias || sourceTable.name,
        uid: sourceTable.uid
      })
    }
    return acc
  }, [])
})

const isShowFillType = (value: string) => {
  if (props.allowedFillTypes?.length && !props.allowedFillTypes.includes(value as TargetFieldFillType)) {
    return false;
  }
  if (value === TargetFieldFillType.DEFAULT) return props.mode === 'edit';
  if (value === TargetFieldFillType.AUTO_RELATED) return false;
  return true;
}

const isDataOwnerTargetField = (field?: Pick<TargetFieldFillRule, 'fieldUID'> | null) => {
  const fieldUID = field?.fieldUID;
  if (!fieldUID) {
    return false;
  }
  if (fieldUID === SystemField.DATA_OWNER) {
    return true;
  }
  const targetField = appendDataOwnerField(targetTable.value, targetTable.value?.fields || []).find(item => item.uid === fieldUID);
  return targetField?.meta?.name === SystemField.DATA_OWNER;
}

const isAvailableFillType = (field: TargetFieldFillRule, value: TargetFieldFillType) => {
  if (!isShowFillType(value)) {
    return false;
  }
  if (isDataOwnerTargetField(field)) {
    if (value === TargetFieldFillType.FIELD) {
      return true;
    }
    return value === TargetFieldFillType.CUSTOM;
  }
  return true;
}

const normalizeTargetFieldFillType = (field?: TargetFieldFillRule | null) => {
  if (!field || !isDataOwnerTargetField(field) || [TargetFieldFillType.CUSTOM, TargetFieldFillType.FIELD].includes(field.type)) {
    return false;
  }
  field.type = TargetFieldFillType.FIELD;
  field.value = getDataOwnerFieldDefaultValue();
  return true;
}

const getDataOwnerFieldDefaultValue = () => {
  return FLOW_DATA_OWNER_SOURCE_SUBMITTER;
}

const getDataOwnerFormFieldOptions = () => {
  return (currentFormFieldList.value || []).filter(field => {
    return field?.meta?.extra?.widgetType === FormWidgetType.MEMBER_SELECT
      && field?.meta?.extra?.isMultiple !== true;
  });
}

const getDataOwnerFieldByUID = (fieldUID?: string | null) => {
  if (!fieldUID) {
    return undefined;
  }
  return currentFormFieldList.value.find(field => field?.uid === fieldUID);
}

const getDataOwnerFieldLabel = (field?: Field, fallbackValue?: string | null) => {
  return field?.alias || fallbackValue || "";
}

const getInvalidDataOwnerFieldOption = (fieldUID?: string | null) => {
  if (!fieldUID || fieldUID === FLOW_DATA_OWNER_SOURCE_SUBMITTER) {
    return null;
  }
  const field = getDataOwnerFieldByUID(fieldUID);
  if (field?.meta?.extra?.widgetType === FormWidgetType.MEMBER_SELECT && field?.meta?.extra?.isMultiple !== true) {
    return null;
  }
  return {
    label: i18next.t('TargetFormField.dataOwnerFieldUnavailableLabel', {
      field: getDataOwnerFieldLabel(field, fieldUID),
    }),
    value: fieldUID,
    disabled: true,
  };
}

const getDataOwnerFieldSelectOptions = (fieldUID?: string | null) => {
  const options = [
    {
      label: i18next.t('TargetFormField.submitter'),
      value: FLOW_DATA_OWNER_SOURCE_SUBMITTER,
    },
    ...getDataOwnerFormFieldOptions().map(field => ({
      label: field.alias || field.uid,
      value: field.uid,
    })),
  ];
  const invalidOption = getInvalidDataOwnerFieldOption(fieldUID);
  return invalidOption ? [...options, invalidOption] : options;
}

const normalizeDataOwnerTargetField = (field?: TargetFieldFillRule | null) => {
  if (!field || !isDataOwnerTargetField(field)) {
    return false;
  }
  const fieldOptions = getDataOwnerFormFieldOptions();
  if (field.type === TargetFieldFillType.FIELD) {
    const currentValue = field.value;
    const hasValidValue = fieldOptions.some(item => item.uid === currentValue);
    if (hasValidValue) {
      return false;
    }
    return false;
  }
  if (field.type === TargetFieldFillType.CUSTOM) {
    if (!hasConfiguredValue(field.value)) {
      field.type = TargetFieldFillType.FIELD;
      field.value = getDataOwnerFieldDefaultValue();
      return true;
    }
    if (!Array.isArray(field.value) && field.value && typeof field.value === 'object') {
      field.value = field.value.id ?? null;
      return true;
    }
    return false;
  }
  return normalizeTargetFieldFillType(field);
}

const normalizeLocalTargetFields = () => {
  return localTargetFields.value.reduce((updated, field) => {
    return normalizeDataOwnerTargetField(field) || normalizeTargetFieldFillType(field) || updated;
  }, false)
}

const targetFieldFillTypeName = {
  get [TargetFieldFillType.CUSTOM]() { return i18next.t('TargetFormField.customValue') },
  get [TargetFieldFillType.EMPTY]() {
    return props.mode === 'edit'
      ? i18next.t('TargetFormField.emptyValue')
      : i18next.t('TargetFormField.noAssignValue')
  },
  get [TargetFieldFillType.DEFAULT]() { return i18next.t('TargetFormField.defaultValue') },
  get [TargetFieldFillType.FIELD]() { return i18next.t('TargetFormField.field') },
  get [TargetFieldFillType.FORMULA]() { return i18next.t('TargetFormField.formulaEdit') },
  get [TargetFieldFillType.AUTO_RELATED]() { return i18next.t('TargetFormField.autoRelated') },
}

const notAllowSubTypes = ["daterange", "related"];
const hasEnabledDescendant = (options: FormTreeOption[] = []) => {
  return options.some(option => {
    if (!option.disabled) {
      return true;
    }
    return hasEnabledDescendant(option.children || []);
  });
}

const currentSourceTableUID = computed(() => {
  return props.defaultTables?.[0]?.uid || table.value?.uid || null;
})

const getFieldFilterByTargetField = (targetField: TargetFieldFillRule, sourceTableUID?: TableUID) => {
  const isSubTargetField = targetField?.fieldUID?.split(".")?.length > 1;
  if (!isSubTargetField) {
    return () => true;
  }
  if (sourceTableUID === currentSourceTableUID.value) {
    return () => true;
  }
  return (field: Field) => {
    return field.meta.subType === "subForm";
  };
}

const getFieldOption = (table: Table, parent?: FormTreeOption, filter?: (field: Field) => boolean): FormTreeOption[] => {
  return table.fields?.flatMap(field => {
    if (isSystemField(field) || notAllowSubTypes.includes(field.meta.subType) || isAutoComputeField(field)) {
      return [];
    }
    const option: FormTreeOption = {
      label: field.alias,
      alias: `${parent?.alias || table.alias}.${field.alias}`,
      value: `${parent?.value || table.uid}.${field.uid}`,
    }

    if (field.meta.subType === "subForm") {
      if (filter && !filter(field)) {
        return [];
      }
      const subTableUID = field.meta.extra.subTableUID;
      const subTable = tables.value?.find(t => t.uid === subTableUID[1]);
      if (subTable) {
        option.children = getFieldOption(subTable, option);
      } else {
        const subFields = field.subTableFields || [];
        if (subFields.length) {
          option.children = subFields.filter(item => {
            return !isSystemField(item) && !notAllowSubTypes.includes(item.meta.subType) && !isAutoComputeField(item);
          }).map(item => {
            return {
              label: item.alias,
              alias: `${option.alias}.${item.alias}`,
              value: `${option.value}.${item.uid}`,
            };
          });
        }
      }
      if (!option.children?.length) {
        return [];
      }
      option.disabled = true;
      option.keepDisabledTextColor = hasEnabledDescendant(option.children);
      return [option];
    }
    if (filter && !filter(field)) {
      return [];
    }
    return [option];
  })
}

const getFormSelectOptions = (field: TargetFieldFillRule) => {
  const groups: FormSelectGroupOption[] = (props.defaultTables || [table.value])?.map(t => {
    return {
      label: t['label'] || `${i18next.t('TargetFormField.currentForm')}-${i18next.t('TargetFormField.thisData')}`,
      options: [{
        label: t.alias,
        value: t.uid,
        children: getFieldOption(t, null, getFieldFilterByTargetField(field, t.uid)),
      }],
    }
  }) || [];
  groups.push({
    label: i18next.t('TargetFormField.otherForm'),
    options: sourceTablesLocal.value.map(t => {
      return {
        label: t.alias,
        value: t.uid,
        children: getFieldOption(t, null, getFieldFilterByTargetField(field, t.uid)),
      }
    })
  })
  return groups;
}
const conditionFuncInfoMap = reactive(new Map())

const initConditionFuncInfoMap = async (formFields) => {
  for (const field of formFields) {
    if (isEditableSystemField(field)) {
      conditionFuncInfoMap.set(field.uid, getSystemColumnConfigurations(field.meta.name)?.funcInfo || {})
      continue
    }
    if (isSystemField(field)) continue
    const funcInfo = await getFuncInfoByType(field.meta?.extra?.widgetType)
    conditionFuncInfoMap.set(field.uid, funcInfo)
  }
}

onMounted(async () => {
  localTargetFields.value = [...props.targetFields];
  const isUpdate = updateTargetFields()
  if (isUpdate) {
    emit('update', localTargetFields.value)
  }
  initConditionFuncInfoMap(formFields.value)
})
const updateTargetFields = () => {
  // 当表单被删除时，使用props.targetFields作为localTargetFields的值
  if (!formFields.value || formFields.value.length === 0) {
    localTargetFields.value = [...props.targetFields];
    return normalizeLocalTargetFields();
  }
  
  const fieldOption = targetFieldOption.value;
  if (props.mode === 'add') {
    localTargetFields.value = fieldOption.map(option => {
      const item = localTargetFields.value.find(item => item.fieldUID === option.uid);
      return item || {
        fieldUID: option.uid,
        type: getTargetFieldDefaultType(option.uid, getTargetFieldByUID(option.uid)),
        value: null
      }
    })

  } else {
    for(let i = 0; i < localTargetFields.value.length; i++) {
      const item = localTargetFields.value[i];
      const option = fieldOption.find(option => option.uid === item.fieldUID);
      if(!option) {
        localTargetFields.value.splice(i, 1);
        i --;
        continue;
      }
    }
  }
  return normalizeLocalTargetFields();
}

const getFuncInfoByType = async (type) => {
  return (await formElementInstances.getInstance(type)).getConfigurations().funcInfo
}

const getFuncValue = (condition) => {
  const field = formFields.value.find(field => field.uid === condition.fieldUID)
  if(!field) return
  if (isEditableSystemField(field)) {
    const config = getSystemColumnConfigurations(field.meta.name)
    return {
      type: config?.funcInfo?.[RuleFunc.EQUAL],
      subType: config?.subType,
    }
  }
  // 使用condition.fieldUID作为键
  let func = conditionFuncInfoMap.get(condition.fieldUID)?.[RuleFunc.EQUAL]
  if (field.meta.subType === 'date') {
    func = conditionFuncInfoMap.get(condition.fieldUID)?.[RuleFunc.TIME_EQUAL]
  } else if (field.meta?.extra?.widgetType === FormWidgetType.ADDRESS) {
    func = RuleFuncValue.ADDRESS
  }
  
  return {
    type: func,
    subType: field?.meta.subType,
  }
}

const handleTargetFieldChange = (rule: TargetFieldFillRule) => {
  if (isDataOwnerTargetField(rule)) {
    rule.type = TargetFieldFillType.FIELD;
    rule.value = getDataOwnerFieldDefaultValue();
    return;
  }
  const arr = rule.fieldUID?.split(".");
  const isSubField = arr?.length > 1;
  let field = targetTable.value?.fields?.find(f => f.uid === arr[0]);
  if (isSubField) {
    const subTableUID = field?.meta?.extra?.subTableUID;
    if (!subTableUID) {
      rule.type = getTargetFieldDefaultType(rule.fieldUID);
      return;
    }
    const subTable = tables.value?.find(t => t.uid === subTableUID[1]);
    field = subTable?.fields?.find(f => f.uid === arr[1]);
  }
  rule.type = getTargetFieldDefaultType(rule.fieldUID, field);
}

// const selectOptions = computed(() => {
//   return (condition) => {
//     if(getFuncValue(condition)?.subType === 'account') {
//       return organizeUtil.users.map(item => ({
//         label: item.realname,
//         value: item.id,
//       }))
//     } else if(getFuncValue(condition)?.subType === 'department') {
//       return organizeUtil.departments.map(item => ({
//         label: item.name,
//         value: item.id,
//       }))
//     } else {
//       const field = formFields.value.find(field => field.uid === condition.fieldUID)
//       return field.meta.extra?.choices || []
//     }
//   }
// });

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

const addTargetField = () => { 
  localTargetFields.value.push({
    fieldUID: null,
    type: TargetFieldFillType.EMPTY,
    value: null
  })
}

const tables = computed(() => {
  return getNocodeDataSourceConnections(nocode.value?.body, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
    includeSchemaSources: true,
  }).flatMap(item => item.tables || [])
})
const targetTableSource = computed(() => getDataSourceTable(props.tableUID));
const targetTable = computed(() => targetTableSource.value?.table);
const targetTableRenderedFieldUIDs = computed(() => {
  const tableUID = targetTable.value?.uid;
  if (!tableUID) {
    return new Set<string>();
  }

  const tableSource = targetTableSource.value;
  const widgetOwnerTableUID = tableSource?.table?.meta?.extra?.primaryTable?.[1] || tableUID;
  const widget = tableSource?.connection?.formOptions?.[widgetOwnerTableUID]?.widget;
  const fieldUIDs = new Set<string>();
  const pending = widget ? [widget] : [];

  while (pending.length) {
    const soul = pending.pop();
    if (!soul) {
      continue;
    }
    if (soul.uid) {
      fieldUIDs.add(soul.uid);
    }
    if (soul.widgets?.length) {
      pending.push(...soul.widgets);
    }
  }

  return fieldUIDs;
});
const isFieldExist = (tableId: string, field: Field) => {
  const fieldUID = field?.meta?.uid;
  return Boolean(fieldUID && targetTable.value?.uid === tableId && targetTableRenderedFieldUIDs.value.has(fieldUID));
}
const isRelatedCurrentTable = (field: Field) => {
  return field?.meta?.extra?.relatedTableUID?.[1] === table.value?.uid;
}
const getTargetFieldWritePolicy = (field: Field) => {
  return getFlowFieldWritePolicy(field, {
    isEditableSystemField,
    isRenderedField: currentField => (
      isEditableSystemField(currentField)
      || Boolean(targetTable.value?.uid && isFieldExist(targetTable.value.uid, currentField))
    ),
    isRelatedCurrentTableField: isRelatedCurrentTable,
  })
}
const isWritableTargetField = (field: Field) => {
  return getTargetFieldWritePolicy(field) === 'writable'
}
const targetFieldOption = computed(() => {
  if (!targetTable.value) return [];
  const useField = localTargetFields.value.map(item => item.fieldUID).filter(Boolean)
  const fields = appendDataOwnerField(targetTable.value, targetTable.value?.fields || []).filter(field => {
    return isWritableTargetField(field);
  }).map(field => {
    const subTableUID = field.meta?.extra?.subTableUID;
    if (subTableUID) {
      const subTable = tables.value?.find(t => t.uid === subTableUID[1]);
      if (!subTable) {
        return [];
      }
      return subTable.fields.filter(f => isWritableTargetField(f)).map(item => {
        const uid: `${FieldUID}.${FieldUID}` = `${field.uid}.${item.uid}`;
        return {
          uid,
          alias: `${field.alias}.${item.alias}`,
          name: item.meta.name,
          disabled: useField.includes(uid),
          isRelated: isRelatedCurrentTable(item)
        }
      });
    }
    return {
      uid: field.uid,
      alias: field.alias,
      name: field.meta.name,
      disabled: useField.includes(field.uid),
      isRelated: isRelatedCurrentTable(field),
    };
  })?.flat();
  return fields;
})

const deleteTargetField = (index) => {
  localTargetFields.value.splice(index, 1)
}

const validate = async () => {
  if(!formRef.value) {
    emit('update', localTargetFields.value)
    return true
  }
  if (Array.isArray(formRef.value)) {
    // 多个子表单逐个校验
    const results = await Promise.all(
      formRef.value.map(form =>
        new Promise((resolve) => {
          form.validate((valid) => resolve(valid))
        })
      )
    )
    if(results.every(Boolean)) {
      emit('update', localTargetFields.value)
    }
    return results.every(Boolean)
  } else {
    // 单个表单
    const result = await new Promise<boolean>((resolve) => {
      formRef.value.validate((valid: boolean) => resolve(valid))
    })
    if(result) {
      emit('update', localTargetFields.value)
    }
    return result
  }
}

const tempFormula = ref("")
const indexOfFieldEditingFormula = ref()
const handleEditFormula = (field, index) => {
  tempFormula.value = field.value
  indexOfFieldEditingFormula.value = index
  visible.value = true
}

const handleUpdate = (value) => {
  if (indexOfFieldEditingFormula.value < localTargetFields.value.length) {
    localTargetFields.value[indexOfFieldEditingFormula.value].value = value
  }
}

const organizeManageDialogRef = ref()
const tableList = ref({
  departments: [],
  roles: [],
  users: [],
  dynamic: [],
})

const currentType = ref()
const currentIndex = ref()
const organizeIsMultiple = ref(false);

const resolveUsersByIds = (userIds = []) => {
  return (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean)
    .map(userId => organizeUtil?.findUserById(userId))
    .filter(Boolean)
}

const openSelectDialog = (type, value, conditionIndex, field) => {
  currentType.value = type;
  currentIndex.value = conditionIndex;
  const _field = formFields.value.find(item => item.uid === field.fieldUID)
  if (_field.meta?.extra?.isMultiple) {
    organizeIsMultiple.value = true;
  } else {
    organizeIsMultiple.value = false;
  }
  
  tableList.value = {
    departments: [],
    roles: [],
    users: [],
    dynamic: [],
  }
  if(!Array.isArray(value)) {
    value = [value].filter(Boolean)
  }
  if(type === 'department') {
    tableList.value.departments = value.map(item => organizeUtil.departments.find(user => user.id === item)).filter(Boolean) || []
  } else if(type === 'member') {
    tableList.value.users = resolveUsersByIds(value)
  }
  organizeManageDialogRef.value.show()
}

const closeSelectDialog = (value) => {
  const condition = localTargetFields.value[currentIndex.value]

  if (currentType.value === "department") {
    condition.value = value.departments?.map(item => item.id) || []
  } else {
    condition.value = value.users?.map(item => item.id) || []
  }
}

const getFieldAlias = (fieldUID) => {
  const option = targetFieldOption.value.find(item => item.uid === fieldUID)
  if (option) {
    return option.alias
  } else {
    return i18next.t('TargetFormField.fieldDeleted')
  }
}

watch(() => props.tableUID, () => {
  updateTargetFields();
})

watch(() => props.targetFields, (value) => {
  if (isEqual(value || [], localTargetFields.value)) {
    return;
  }
  localTargetFields.value = deepClone(value || []);
  updateTargetFields();
}, { deep: true });

watch(currentFormFieldList, () => {
  const isUpdated = normalizeLocalTargetFields();
  if (isUpdated) {
    emit('update', deepClone(localTargetFields.value));
  }
}, { deep: true });

watch(localTargetFields, (value) => {
  if (isEqual(value, props.targetFields || [])) {
    return;
  }
  emit('update', deepClone(value));
}, { deep: true });

defineExpose({
  get targetFields() {
    return localTargetFields.value;
  },
  validate,
  changeFillType: (key: string, value: TargetFieldFillType) => {
    const item = localTargetFields.value.find(item => item.fieldUID === key)
    if (!item) {
      return;
    }
    if (isDataOwnerTargetField(item)) {
      item.type = value;
      item.value = value === TargetFieldFillType.FIELD ? getDataOwnerFieldDefaultValue() : null;
      return;
    }
    item.type = value;
  }
})
</script>

<style scoped lang="scss">
.target-form-field {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 8px;

  .title {
    font-weight: 500;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    display: flex;
    align-items: center;

    .title-text {
      display: inline-flex;
      align-items: center;
    }

    .title-tip-icon {
      margin-left: 4px;
      color: var(--text-color-secondary);
      cursor: pointer;
      font-size: 14px;
    }

    .add-button {
      color: var(--color-primary);
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
    }
  } 

  .container {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;

    .item {
      display: flex;
      gap: 8px;
      align-items: center;
      height: 32px;

      :deep(.el-select) {
        .el-select__wrapper {
          background-color: var(--bg-color-overlay);
          box-shadow: none;
          border-radius: 4px;
        }
      }

      :deep(.el-input) {
        .el-input__wrapper {
          background-color: var(--bg-color-overlay);
          box-shadow: none;
          border-radius: 4px;
        }
      }
      
      :deep(.el-input-tag) {
        background-color: var(--bg-color-overlay);
        box-shadow: none;
        border-radius: 4px;
      }

      :deep(.el-date-editor) {
        width: 100%;
      }

      :deep(.target-field) {
        width: 184px;
        min-width: 184px;
      }

      .target-field-disable {
        width: 184px;
        height: 32px;
        background-color: var(--bg-color-overlay);
        border-radius: 4px;
        padding: 0px 8px;
        font-weight: 400;
        font-size: 14px;
        line-height: 32px;
        letter-spacing: 0%;
        align-items: center;
        text-overflow: ellipsis;
        overflow: hidden;
        word-break: break-all;
        white-space: nowrap;

        &.field-deleted {
          color: var(--el-color-danger);
        }
      }

      .sign {
        width: 24px;
        display: flex;
        justify-content: center;
      }

      :deep(.value-type) {
        width: 100px;
        min-width: 94px;

        .el-select__wrapper {
          padding: 8px;
        }
      }
      .auto-related {
        background-color: var(--bg-color-overlay);
        text-align: center;
        padding: 0 8px;
        color: var(--el-input-text-color, var(--el-text-color-regular));;
      }

      .custom-value, .field-value, .formula-value {
        flex: 1;

        :deep(.account-button) {
          width: 100%;
          border-radius: 4px;
          
          &:hover {
            color: var(--color-primary);
            border: 1px solid var(--color-primary-light-5);
            background-color: var(--color-primary-light-9);
          }

          &.active {
            color: var(--color-primary);
          }
        }
        :deep(.department-button) {
          width: 100%;
          border-radius: 4px;
          
          &:hover {
            color: var(--color-primary);
            border: 1px solid var(--color-primary-light-5);
            background-color: var(--color-primary-light-9);
          }

          &.active {
            color: var(--color-primary);
          }
        }

        .formula-button {
          width: 100%;
          border-radius: 4px;

          &.has-formula :deep(span) {
            color: var(--color-primary);
          }
        }

        :deep(.lost) {
          --el-input-text-color: var(--color-danger);
          .el-select__wrapper {
            box-shadow: 0 0 0 1px var(--el-input-text-color) inset;
          }
        }
      }

      .field-value {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .delete-button {
        color: var(--text-color-secondary);
        cursor: pointer;
      }
    }
  }
}
</style>
