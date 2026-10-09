<template>
  <div class="header">
    <div class="header-left">
      {{ customTitle }}
    </div>
    <div class="add-button" @click="addGroup">
      <el-icon>
        <i-ep-plus/>
      </el-icon>
      <span>{{ $t('ConditionItem.addConditionGroup') }}</span>
    </div>
  </div>

  <div class="body" v-for="(group, groupIndex) in props.options.conditions">
    <div class="relation-text" v-if="groupIndex > 0">
      {{ $t('ConditionItem.orSatisfy') }}
    </div>

    <div class="condition-group">
      <div class="group-header">
        <span>{{$t('ConditionItem.conditionGroup')}}{{ groupIndex+1 }}</span>
        <el-icon
          @click="removeGroup(groupIndex)"
          v-if="props.options?.conditions?.length > 1 || props.allowEmptyCondition"
        >
          <i-ep-delete/>
        </el-icon>
      </div>
      <div class="group-body">
        <div class="error-text" v-if="showErrorTip">
          <span class="error-text-label">{{ $t('ConditionItem.verifyFailTip') }}</span>
          <el-form-item prop="errorText" :style="{ flex: '1' }" :error="validateErrorText(group)" ref="validateErrorTextRef">
            <el-input style="width: 100%;" :modelValue="getErrorText(group)" @update:model-value="val => group[0].errorTip = val" clearable />
          </el-form-item>
        </div>
        <div class="condition-container" v-for="(condition,conditionIndex) in group">
          <div class="condition-container-header">
            <span>{{ conditionIndex === 0 ? $t('ConditionItem.when') : $t('ConditionItem.and') }}</span>
            <el-icon
              @click="removeCondition(groupIndex, conditionIndex)"
              v-if="group?.length > 1 || props.allowEmptyCondition"
            >
              <i-ep-delete/>
            </el-icon>
          </div>
          <el-form :model="condition" :rules="rules" ref="formRef">
            <div class="field-formula-container">
              <el-select
                class="type-select"
                :modelValue="condition.type || FormConditionValueType.FORM"
                @update:modelValue="val => condition.type = val"
                @change="changeType(condition)"
              >
                <slot name="condition-type-options">
                  <el-option :label="$t('ConditionItem.field')" :value="FormConditionValueType.FORM"/>
                  <el-option :label="$t('ConditionItem.formulaEdit')" :value="FormConditionValueType.FORMULA"/>
                  <el-option :label="$t('ConditionItem.node')" :value="FormConditionValueType.NODE"/>
                </slot>
              </el-select>
              <template v-if="condition.type != FormConditionValueType.FORMULA">
                <el-form-item
                  prop="uid"
                  :rules="[
                    {
                      validator: (rule, value, callback) => validateUid(rule, value, callback, condition.type),
                      trigger: 'change'
                    }
                  ]"
                >
                  <el-select
                    :placeholder="$t('ConditionItem.selectDataSource')"
                    v-model="condition.uid"
                    class="field-select"
                    @change="condition.func = RuleFunc.EQUAL"
                    v-if="condition.type === FormConditionValueType.FILTER_ROW"
                    :key="sourceTablesLocal.length + `${conditionIndex}`"
                    :no-data-text="$t('ConditionItem.noDataSource')"
                  >
                    <el-option
                      :label="sourceTable.alias || sourceTable.name || ''"
                      :value="sourceTable.uid || ''"
                      v-for="sourceTable in sourceTablesLocal"
                    />
                    <template #label="{ label, value }">
                      <span :class="{ error: label === value }">
                        {{ label === value ? $t('ConditionItem.dataSourceDeleted') : label }}
                      </span>
                    </template>
                  </el-select>
                  <field-of-tables-select
                    :modelValue="(condition.uid || '').split('.').length > 1 ? condition.uid : `${table.uid}.${condition.uid}`"
                    @update:modelValue="getConfiguration(condition, $event)"
                    filterable
                    :tables="getConditionSourceTables(condition)"
                    :defaultTables="getConditionDefaultTables(condition)"
                    :placeholder="$t('ConditionItem.selectField')"
                    ref="fieldValueRef"
                    :otherTableLabel="$t('ConditionItem.dataSourceForm')"
                    v-else-if="condition.type != FormConditionValueType.NODE"
                    :firstTableLabel="props.firstTableLabel"
                  />
                  <el-select
                    :placeholder="$t('ConditionItem.selectNode')"
                    v-model="condition.uid"
                    class="field-select"
                    @change="changeNode(condition)"
                    v-else
                  >
                    <el-option
                      v-for="item in nodeConditionOptions"
                      :key="item.uid"
                      :label="getNodeOptionLabel(item)"
                      :value="item.uid"
                    />
                  </el-select>
                </el-form-item>
                <el-select
                  v-if="isSubformCondition(condition)"
                  class="subform-match-mode-select"
                  :model-value="condition.subformMatchMode || SubformConditionMatchMode.ANY"
                  @update:model-value="value => condition.subformMatchMode = value"
                >
                  <el-option
                    :label="$t('ConditionItem.anyRowMatches')"
                    :value="SubformConditionMatchMode.ANY"
                  />
                  <el-option
                    :label="$t('ConditionItem.allRowsMatch')"
                    :value="SubformConditionMatchMode.ALL"
                  />
                </el-select>
              </template>
              <el-form-item prop="formula" v-else>
                <div
                  class="formula-button"
                  :class="[condition.formula ? 'active' : '']"
                  @click="setFormula(condition, conditionIndex, groupIndex)"
                >
                  {{ condition.formula ? $t('ConditionItem.formulaSet') : $t('ConditionItem.setFormula') }}
                </div>
              </el-form-item>
            </div>
            <el-form-item v-if="condition.type != FormConditionValueType.FORMULA" prop="func">
              <el-select
                v-model="condition.func"
                :placeholder="$t('ConditionItem.selectDataSourceFirst')"
                @change="(val) => {
                  if(val === RuleFunc.BETWEEN) {
                    condition.value = [null, null]
                  } else {
                    condition.value = null
                  }
                }"
                v-if="condition.type === FormConditionValueType.FILTER_ROW"
              >
                <el-option
                  v-for="func in funcOption(condition)"
                  :label="func.label"
                  :value="func.value"
                />
              </el-select>
              <el-select
                v-model="condition.func"
                :placeholder="$t('ConditionItem.selectFieldFirst')"
                @change="changeFunc(condition)"
                v-else-if="condition.type != FormConditionValueType.NODE"
              >
                <el-option
                  v-for="([key, value], index) in Object.entries(conditionFuncInfoMap.get((condition.uid || '').split('.').at(-1)) || {})"
                  :key="key"
                  :label="RuleFuncTextMapping[key]"
                  :value="key"
                />
              </el-select>
              <el-select
                v-model="condition.func"
                :placeholder="$t('ConditionItem.selectOperator')"
                v-else
              >
                <el-option
                  :label="$t('ConditionItem.equal')"
                  :value="RuleFunc.EQUAL"
                />
                <el-option
                  :label="$t('ConditionItem.notEqual')"
                  :value="RuleFunc.NOT_EQUAL"
                />
              </el-select>
            </el-form-item>
            <div v-if="condition.func && ![RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(condition.func) && (condition.type === FormConditionValueType.FORM || !condition.type)">
              <el-form-item prop="value" v-if="getFuncValue(condition)?.subType === 'account'">
                <el-button
                  :class="{'active': condition.value?.length}"
                  @click="openSelectDialog('member', condition.value, conditionIndex, groupIndex, condition)"
                >
                  {{ condition.value?.length ? $t('ConditionItem.memberSelected') : $t('ConditionItem.selectMember') }}
                </el-button>
              </el-form-item>
              <el-form-item prop="value" v-else-if="getFuncValue(condition)?.subType === 'department'">
                <el-button
                  :class="{'active': condition.value?.length}"
                  @click="openSelectDialog('department', condition.value, conditionIndex, groupIndex, condition)"
                >
                  {{ condition.value?.length ? $t('ConditionItem.deptSelected') : $t('ConditionItem.selectDept') }}
                </el-button>
              </el-form-item>
              <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.RANGE">
                <div class="number-range" v-if="getFuncValue(condition)?.subType === 'number' && condition?.value?.length === 2">
                  <el-input v-model="condition.value[0]" type="number" :placeholder="$t('ConditionItem.minValue')" />
                  <span> ~ </span>
                  <el-input v-model="condition.value[1]" type="number" :placeholder="$t('ConditionItem.maxValue')" />
                </div>
                <el-config-provider
                  :locale="elementPlusLocale"
                  v-else-if="getFuncValue(condition)?.subType === 'date'"
                >
                  <el-date-picker
                    class="date-range"
                    :value-format="'YYYY-MM-DD HH:mm:ss'"
                    :format="$t('ConditionItem.dateFormat')"
                    range-separator="~"
                    v-model="condition.value"
                    type="daterange"
                  />
                </el-config-provider>
              </el-form-item>
              <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.DATE">
                <el-config-provider :locale="elementPlusLocale">
                  <el-date-picker
                    class="date-range"
                    :value-format="'YYYY-MM-DD HH:mm:ss'"
                    :format="$t('ConditionItem.dateFormat')"
                    v-model="condition.value"
                    type="date"
                  />
                </el-config-provider>
              </el-form-item>
              <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.SELECT">
                <!-- <el-select-v2
                  v-model="condition.value"
                  clearable
                  filterable
                  :options="selectOptions(condition)"
                  placeholder="请选择"
                /> -->
                <el-input
                  v-model="condition.value"
                  :placeholder="$t('ConditionItem.inputContent')"
                  clearable
                />
              </el-form-item>
              <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.SELECT_MULTIPLE">
                <!-- <el-select-v2
                  v-model="condition.value"
                  :collapse-tags="true"
                  clearable
                  filterable
                  multiple
                  :options="selectOptions(condition)"
                  placeholder="请选择"
                /> -->
                <el-input-tag v-model="condition.value" tag-type="primary" filterable :placeholder="$t('ConditionItem.tagInputContent')"></el-input-tag>
              </el-form-item>
              <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.TAGS">
                <el-input-tag v-model="condition.value" tag-type="primary" filterable :placeholder="$t('ConditionItem.tagInputContent')"></el-input-tag>
              </el-form-item>
              <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.ADDRESS">
                <el-tree-select
                  :placeholder="$t('ConditionItem.selectContent')"
                  class="drop-down"
                  ref="addressRef"
                  v-model="condition.value"
                  lazy
                  :load="loadNode"
                  node-key="value"
                  :render-after-expand="false"
                  clearable filterable check-strictly
                  :highlight-current="true" :show-path="true" :empty-text="$t('ConditionItem.noData')" :props="{
                    label: 'label',
                    value: 'value',
                    children: 'children',
                    isLeaf: 'isLeaf',
                  }"/>
              </el-form-item>
              <el-form-item prop="value" v-else-if="getFuncValue(condition)?.type === RuleFuncValue.NUMBER">
                <el-input
                  v-model="condition.value"
                  :placeholder="$t('ConditionItem.inputContent')"
                  type="number"
                />
              </el-form-item>
              <el-form-item prop="value" v-else-if="getFuncValue(condition)?.subType === 'date' && getFuncValue(condition)?.type === RuleFuncValue.STRING">
                <date-dynamic-filter-value-select class="dynamic-filter-select" v-model="condition.value" :append-to="'body'" :teleported="true" />
              </el-form-item>
              <el-form-item prop="value" v-else>
                <el-input
                  v-model="condition.value"
                  :placeholder="$t('ConditionItem.inputContent')"
                  clearable
                />
              </el-form-item>
            </div>
            <el-form-item v-if="condition.type === FormConditionValueType.NODE" prop="value">
              <el-select
                v-model="condition.value"
                :placeholder="getNodeValuePlaceholder(condition)"
              >
                <el-option
                  v-for="option in getNodeValueOptions(condition)"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item v-if="condition.type === FormConditionValueType.FILTER_ROW" prop="value">
              <el-input
                v-model="condition.value"
                :placeholder="$t('ConditionItem.inputContent')"
                v-if="condition.func !== RuleFunc.BETWEEN"
                type="number"
              />
              <div class="number-range" v-else>
                <el-input v-model="condition.value[0]" type="number" :placeholder="$t('ConditionItem.minValue')" />
                <span> ~ </span>
                <el-input v-model="condition.value[1]" type="number" :placeholder="$t('ConditionItem.maxValue')" />
              </div>
            </el-form-item>
          </el-form>
        </div>
        <div class="add-condition-button-container">
          <div class="add-condition-button" @click="addCondition(group)">
            <el-icon>
              <i-ep-plus></i-ep-plus>
            </el-icon>
            <span>{{ $t('ConditionItem.addCondition') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <source-table-formula-dialog
    :modelValue="formulaVisible"
    @update:modelValue="v => formulaVisible = v"
    @update="updateFormula"
    :value="formulaValue"
    :defaultTables="defaultTables"
    :tables="sourceTablesLocal"
    :otherTableLabel="$t('ConditionItem.dataSourceForm')"
  />
  <organize-manager-dialog
    ref="organizeManageDialogRef"
    :isInWidget="false"
    :multiple="organizeIsMultiple"
    :currentType="currentType"
    :dialogTitle="currentType === 'department' ? $t('ConditionItem.chooseDept') : $t('ConditionItem.chooseMember')"
    :tableList="tableList"
    @confirm="closeSelectDialog"
  />
</template>

<script lang='ts' setup>
import { ConditionBranchCondition, ConditionBranchOptions, ProcessNodeType, DataChangeType, Field, Table, ProcessNodeStatus, ProcessFlow, SubformConditionMatchMode } from '@common/types/project';
import { FormInstance } from 'element-plus';
import { ref, reactive, watch, computed, inject, onMounted } from 'vue';
import { getFlowById, getOwnerBranchFlow } from '@common/utils/flow';
import { RuleFunc, RuleFuncTextMapping, RuleFuncValue } from '@common/types/nocode';
import { SystemField } from '@common/utils/connection';
import { useFormFields, useRootBranch, useFormTable } from '../../../hooks';
import { isSystemField } from '@common/utils';
import { getChinaAddressData } from "@renderer/utils/township";
import { ORGANIZE_UTIL } from '@renderer/types';
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale'
import { isEmpty } from "@common/utils/object";
import { FormConditionValueType, FormWidgetType } from '@common/types/nocode';
import { NOCODE } from '@renderer/types';
import { ProcessNode } from '../../process';
import { formElementInstances } from '@renderer/utils/instance';
import i18next from 'i18next';
import { getNocodeDataSourceTableByUID } from '@common/utils/connection';

const table = useFormTable();
const formFields = useFormFields();
const rootBranch = useRootBranch();
const organizeUtil = inject(ORGANIZE_UTIL)
const formulaVisible = ref(false)
const formulaValue = ref('')
const nocode = inject(NOCODE)
const formulaIndex = ref({
  conditionIndex: -1,
  groupIndex: -1,
})
const organizeManageDialogRef = ref()

const changeTypeText = {
  get [DataChangeType.ADD]() { return i18next.t("ConditionItem.addNew") },
  get [DataChangeType.EDIT]() { return i18next.t("ConditionItem.edit") },
  get [DataChangeType.DELETE]() { return i18next.t("ConditionItem.delete") }
}

const approvalStatusText = {
  get [ProcessNodeStatus.FINISHED]() { return i18next.t("ConditionItem.pass") },
  get [ProcessNodeStatus.REJECTED]() { return i18next.t("ConditionItem.reject") },
}

const props = withDefaults(defineProps<{
  node: ProcessNode,
  options: ConditionBranchOptions,
  allowEmptyCondition: boolean,
  targetTable?: Table,
  firstTableLabel?: string,
  showErrorTip?: boolean,
  defaultErrorTip?: string,
  customTitle?: string
}>(), {
  allowEmptyCondition: false,
  targetTable: null,
  firstTableLabel: () => i18next.t("ConditionItem.currentForm"),
  showErrorTip: false,
  defaultErrorTip: () => i18next.t("ConditionItem.completeConditionNotMet"),
  customTitle: () => i18next.t('ConditionItem.judgeConditionTip')
})

const validateErrorTextRef = ref([]);
const formRef = ref<FormInstance[]>([])

const validateUid = (rule, value, callback, type) => {
  if (isEmpty(value) || !value) {
    if (type === FormConditionValueType.NODE) {
      return callback(new Error(i18next.t("ConditionItem.selectOneNode")));
    }
    return callback(new Error(i18next.t("ConditionItem.selectOneField")));
  }
  callback();
}

const rules = reactive({
  node: [
    {
      validator: (rule, value, callback) => {
        if(isEmpty(value) || !value) {
          return callback(new Error(i18next.t("ConditionItem.selectOneNode")))
        }
        callback()
      },
    }
  ],
  value: [
    {
      validator: (rule, value, callback) => {
        if(isEmpty(value) || !value) {
          return callback(new Error(i18next.t("ConditionItem.numberNotEmpty")))
        }
        callback()
      },
    }
  ],
  formula: [
    {
      validator: (rule, value, callback) => {
        if(isEmpty(value) || !value) {
          return callback(new Error(i18next.t("ConditionItem.configFormula")))
        }
        callback()
      },
    }
  ],
  func: [
    {
      validator: (rule, value, callback) => {
        if(isEmpty(value) || !value) {
          return callback(new Error(i18next.t("ConditionItem.selectOneOperator")))
        }
        callback()
      },
    }
  ],
})
const getNodeConditionOptions = (flows: ProcessFlow[], stopUid: string): ProcessFlow[] => {
  const result: ProcessFlow[] = []
  const added = new Set<string>()

  const addFlow = (flow: ProcessFlow) => {
    if (![ProcessNodeType.TRIGGER_DATA_CHANGE, ProcessNodeType.APPROVAL].includes(flow.type)) return
    if (added.has(flow.uid)) return
    added.add(flow.uid)
    result.push(flow)
  }

  const walk = (currentFlows: ProcessFlow[] = []): boolean => {
    for (const flow of currentFlows) {
      if (flow.uid === stopUid) return true
      addFlow(flow)
      if (flow.branches) {
        for (const branch of flow.branches) {
          if (walk(branch.flows)) return true
        }
      }
    }
    return false
  }

  walk(flows)
  return result
}

const nodeConditionOptions = computed(() => {
  const flows = rootBranch.value.getFlows() || []
  const ownerBranchNode = getOwnerBranchFlow(flows, props.node.uid)
  if (!ownerBranchNode) return []
  return getNodeConditionOptions(flows, ownerBranchNode.uid)
})

const getConditionNode = (uid?: string): ProcessFlow | undefined => {
  if (!uid) return undefined
  return nodeConditionOptions.value.find(item => item.uid === uid) || getFlowById(rootBranch.value.getFlows(), uid)
}

const getNodeOptionLabel = (flow: ProcessFlow) => {
  const prefix = flow.type === ProcessNodeType.APPROVAL ? i18next.t("ConditionItem.approvalNode") : i18next.t("ConditionItem.triggerNode")
  return flow?.options?.name || prefix
}

const getNodeValueOptions = (condition: ConditionBranchCondition) => {
  const node = getConditionNode(condition.uid)
  if (node?.type === ProcessNodeType.APPROVAL) {
    return [
      {
        label: approvalStatusText[ProcessNodeStatus.FINISHED],
        value: ProcessNodeStatus.FINISHED,
      },
      {
        label: approvalStatusText[ProcessNodeStatus.REJECTED],
        value: ProcessNodeStatus.REJECTED,
      },
    ]
  }

  return Object.values(DataChangeType).map(type => ({
    label: changeTypeText[type],
    value: type,
  }))
}

const getNodeValuePlaceholder = (condition: ConditionBranchCondition) => {
  const node = getConditionNode(condition.uid)
  if (node?.type === ProcessNodeType.APPROVAL) {
    return i18next.t("ConditionItem.selectApprovalStatusFirst")
  }
  return i18next.t("ConditionItem.selectChangeTypeFirst")
}

const defaultTables = computed(() => {
  const _table = props.targetTable || table.value;
  return [
    {
      ..._table,
      label: props.firstTableLabel,
    }
  ]
})

const isAutoComputeField = (field?: Field) => {
  return field?.meta?.extra?.widgetType === FormWidgetType.AUTO_COMPUTE
}

const getConditionFieldUIDParts = (condition?: ConditionBranchCondition) => {
  const uid = condition?.uid
  if (!uid) {
    return {
      tableUID: null,
      fieldUID: null,
      subFieldUID: null,
    }
  }
  const uidList = uid.split('.')
  if (uidList.length > 1) {
    return {
      tableUID: uidList[0] || null,
      fieldUID: uidList[1] || null,
      subFieldUID: uidList[2] || null,
    }
  }
  return {
    tableUID: table.value?.uid || null,
    fieldUID: uid,
    subFieldUID: null,
  }
}

const isSubformCondition = (condition?: ConditionBranchCondition) => {
  return (condition?.type === FormConditionValueType.FORM || !condition?.type)
    && Boolean(getConditionFieldUIDParts(condition).subFieldUID);
}

const filterConditionTableFields = (targetTable: Table, condition?: ConditionBranchCondition) => {
  const currentFieldUID = getConditionFieldUIDParts(condition)
  return (targetTable?.fields || []).reduce((result, field) => {
    if (field.meta?.extra?.widgetType === "widget.form.subform") {
      const subTableFields = (field.subTableFields || []).filter(subField => {
        if (!isAutoComputeField(subField)) {
          return true
        }
        return currentFieldUID.tableUID === targetTable.uid && currentFieldUID.fieldUID === field.uid && currentFieldUID.subFieldUID === subField.uid
      })
      if (!subTableFields.length) {
        return result
      }
      result.push({
        ...field,
        subTableFields,
      })
      return result
    }

    if (!isAutoComputeField(field)) {
      result.push(field)
      return result
    }

    if (currentFieldUID.tableUID === targetTable.uid && currentFieldUID.fieldUID === field.uid && !currentFieldUID.subFieldUID) {
      result.push(field)
    }
    return result
  }, [] as Field[])
}

const getConditionDefaultTables = (condition?: ConditionBranchCondition) => {
  return defaultTables.value.map(item => ({
    ...item,
    fields: filterConditionTableFields(item, condition),
  }))
}

const getConditionSourceTables = (condition?: ConditionBranchCondition) => {
  return sourceTablesLocal.value.map(item => ({
    ...item,
    fields: filterConditionTableFields(item, condition),
  }))
}

const getErrorText = (group) => {
  if ([undefined, null].includes(group[0].errorTip)) {
    group[0].errorTip = props.defaultErrorTip;
  }
  return group[0].errorTip;
}

const validateErrorText = (group) => {
  return group[0]?.errorTip ? null : i18next.t("ConditionItem.verifyFailTipNotEmpty");
}

watch(() => props.options.conditions, (value) => {
  if(!value) {
    props.options.conditions = []
  }
},{ immediate: true, deep: true })

const addGroup = () => {
  props.options.conditions.push(
    [
      {
        uid: null,
        func: null,
        value: null,
        type: FormConditionValueType.FORM,
      }
    ]
  )
}

const addCondition = (group) => {
  group.push({
    uid: null,
    func: null,
    value: null,
    type: FormConditionValueType.FORMULA,
  })
}

const removeGroup = (groupIndex) => {
  props.options.conditions.splice(groupIndex, 1)
}

const removeCondition = (groupIndex, conditionIndex) => {
  props.options.conditions[groupIndex].splice(conditionIndex, 1)
}


const conditionFuncInfoMap = reactive(new Map())

const getFuncInfoByType = async (type) => {
  return await (await formElementInstances.getInstance(type)).getConfigurations().funcInfo
}

const initConditionFuncInfoMap = async (formFields) => {
  const targetTables = [table.value, ...(sourceTablesLocal.value || []), ...(props.targetTable ? [props.targetTable] : [])].filter(Boolean);
  const handledTableUIDs = new Set<string>();

  for (const table of targetTables) {
    if (!table?.uid || handledTableUIDs.has(table.uid)) continue;
    handledTableUIDs.add(table.uid);

    for(const field of table.fields || []){
      if (isSystemField(field)) continue
      const funcInfo = await getFuncInfoByType(field.meta?.extra?.widgetType)
      conditionFuncInfoMap.set(`${field.uid}`, funcInfo)
      if(field.meta?.extra?.widgetType === "widget.form.subform") {
        for(const subField of field.subTableFields || []){
          if (isSystemField(subField)) continue
          const funcInfo = await getFuncInfoByType(subField.meta?.extra?.widgetType)
          conditionFuncInfoMap.set(`${subField.uid}`, funcInfo)
        }
      }
    }
  }
}

onMounted(async () => {
  await initConditionFuncInfoMap(formFields.value)
})

const getFieldByCondition = (condition: ConditionBranchCondition): Field => {
  if (condition.uid?.split('.')?.length > 1) {
    const [tableUid = null, fieldId = null, subFieldId = null] = condition.uid?.split('.') || [];
    const allTables = [...(sourceTablesLocal.value || []), table.value, ...( props.targetTable ? [props.targetTable]: [])];
    const targetTable = allTables.find(table => table.uid === tableUid);
    if(!subFieldId) {
      return targetTable.fields?.find(field => field.uid === fieldId);
    } else {
      const targetField = targetTable.fields?.find(field => field.uid === fieldId);
      return targetField?.subTableFields?.find(subField => subField.uid === subFieldId);
    }
  } else {
    return formFields.value.find(field => field.uid === condition.uid);
  }
}

const getConfiguration = (condition: ConditionBranchCondition, uid: string) => {
  condition.uid = uid;
  if (isSubformCondition(condition)) {
    condition.subformMatchMode = condition.subformMatchMode || SubformConditionMatchMode.ANY;
  } else {
    delete condition.subformMatchMode;
  }
  const type = getFieldByCondition(condition)?.meta.extra.widgetType;
  formElementInstances.getInstance(type).then(widget => {
    return widget.getConfigurations()
  }).then(config => {
    conditionFuncInfoMap.set((condition.uid || '').split('.').at(-1), config.funcInfo)

    // 默认选第一个 func
    condition.func = Object.keys(config.funcInfo)[0] as RuleFunc || null

    // 根据 func 类型设置 value
    if (getFuncValue(condition)?.type === RuleFuncValue.RANGE && getFuncValue(condition)?.subType === 'number') {
      condition.value = [0, 0]
    } else {
      condition.value = null
    }
  })
}

const changeFunc = (condition) => {
  const type = getFieldByCondition(condition)?.meta.extra.widgetType

  formElementInstances.getInstance(type).then(widget => {
    return widget.getConfigurations()
  }).then(config => {
    conditionFuncInfoMap.set((condition.uid || '').split('.').at(-1), config.funcInfo)

    if (getFuncValue(condition)?.type === RuleFuncValue.RANGE && getFuncValue(condition)?.subType === 'number') {
      condition.value = [null, null]
    } else {
      condition.value = null
    }
  })
}

const getFuncValue = (condition) => {
  const field = getFieldByCondition(condition);
  if(!field) return
  // 使用condition.uid作为键
  const func = conditionFuncInfoMap.get((condition.uid || '').split('.').at(-1))?.[condition.func]
  return {
    type: func,
    subType: field?.meta.subType,
  }
}

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

const setFormula = (condition, conditionIndex, groupIndex) => {
  formulaVisible.value = true
  formulaIndex.value = {
    conditionIndex,
    groupIndex,
  }
  formulaValue.value = condition.formula || ''
}

const changeType = (condition) => {
  condition.value = null
  condition.formula = null
  condition.uid = null
  delete condition.subformMatchMode

  if(condition.type === FormConditionValueType.NODE) {
    condition.func = RuleFunc.EQUAL
  } else {
    condition.func = null
  }
}

const changeNode = (condition) => {
  condition.func = RuleFunc.EQUAL
  const options = getNodeValueOptions(condition)
  if (!options.some(item => item.value === condition.value)) {
    condition.value = options[0]?.value || null
  }
}

const updateFormula = (value) => {
  const { conditionIndex, groupIndex } = formulaIndex.value
  if (conditionIndex !== -1 && groupIndex !== -1) {
    props.options.conditions[groupIndex][conditionIndex].formula = value
  }
}

const sourceTablesLocal = computed(() => {
  return props.options.sourceTables?.reduce((acc, sourceTable) => {
    const tableSource = getNocodeDataSourceTableByUID(nocode.value?.body, sourceTable.tableUID, {
      nocodeId: nocode.value?.meta?.id,
      name: nocode.value?.meta?.name,
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

const tableList = ref({
  departments: [],
  roles: [],
  users: [],
  dynamic: [],
})

const currentType = ref()
const currentIndex = ref({
  conditionIndex: -1,
  groupIndex: -1,
})
const organizeIsMultiple = ref(false);

const resolveUsersByIds = (userIds = []) => {
  return (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean)
    .map(userId => organizeUtil?.findUserById(userId))
    .filter(Boolean)
}

const openSelectDialog = (type, value, conditionIndex, groupIndex, condition) => {
  currentType.value = type
  const field = getFieldByCondition(condition);
  if (field.meta?.extra?.isMultiple) {
    organizeIsMultiple.value = true;
  } else {
    organizeIsMultiple.value = false;
  }
  
  currentIndex.value = {
    conditionIndex,
    groupIndex,
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
  const condition = props.options.conditions[currentIndex.value.groupIndex][currentIndex.value.conditionIndex]

  if (currentType.value === "department") {
    condition.value = value.departments?.map(item => item.id) || []
  } else {
    condition.value = value.users?.map(item => item.id) || []
  }
}

const funcOption = (condition) => {
  return [
    {
      label: i18next.t("ConditionItem.equal"),
      value: getFuncValue(condition)?.subType === 'date' ? RuleFunc.TIME_EQUAL : RuleFunc.EQUAL,
    },
    {
      label: i18next.t("ConditionItem.notEqual"),
      value: getFuncValue(condition)?.subType === 'date' ? RuleFunc.TIME_NOT_EQUAL : RuleFunc.NOT_EQUAL,
    },
    {
      label: i18next.t("ConditionItem.greaterThan"),
      value: RuleFunc.GT,
    },
    {
      label: i18next.t("ConditionItem.greaterEqual"),
      value: RuleFunc.GTE,
    },
    {
      label: i18next.t("ConditionItem.lessThan"),
      value: RuleFunc.LT,
    },
    {
      label: i18next.t("ConditionItem.lessEqual"),
      value: getFuncValue(condition)?.subType === 'date' ? RuleFunc.TIME_LTE : RuleFunc.LTE,
    },
    {
      label: i18next.t("ConditionItem.selectRange"),
      value: getFuncValue(condition)?.subType === 'date' ? RuleFunc.TIME_BETWEEN : RuleFunc.BETWEEN,
    },
  ]
}

const validate = async () => {
  return new Promise((resolve, reject) => {
    if (!formRef.value?.length) {
      resolve(true)
      return
    }

    // 用 map 包一层 Promise
    const tasks = [];
    if (props.showErrorTip) {
      for (const item of validateErrorTextRef.value) {
        tasks.push(new Promise<boolean>((res, rej) => {
          if (item.validateState.value !== 'error') {
            res(true);
          } else {
            rej(false);
          }
        })) 
      }
    }
    for (const form of formRef.value) {
      tasks.push(new Promise<boolean>((res, rej) => {
        form.validate((isValid: boolean) => {
          if (isValid) {
            res(true)
          } else {
            rej(false)
          }
        })
      }))
    }

    // 等所有校验都通过
    Promise.all(tasks)
      .then(() => resolve(true))
      .catch(() => resolve(false))
  })
}
defineExpose({
  validate,
})
</script>

<style lang='scss' scoped>
.header {
  display: flex;
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0%;
  text-align: right;
  margin: 16px 0px 12px;

  .add-button {
    margin-left: auto;
    display: flex;
    align-items: center;
    color: var(--color-primary);
    cursor: pointer;
    
    .el-icon {
      margin-right: 3px;
    }
  }

  .header-right {
    margin-left: auto;
    color: var(--color-primary);
    cursor: pointer;
  }
}

.body {
  .relation-text {
    color: var(--text-color-secondary);
    
    font-weight: 400;
    
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    margin-bottom: 8px;
  }

  .condition-group {
    overflow: hidden;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    
    font-weight: 400;
    
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    margin: 0px 0px 16px;

    .group-header {
      height: 32px;
      display: flex;
      background-color: var(--bg-color-overlay);
      align-items: center;
      padding: 8px;
      border-bottom: 1px solid var(--border-color);

      span {
        color: var(--text-color-regular);
      }

      .el-icon {
        margin-left: auto;
        color: var(--text-color-secondary);
        cursor: pointer;
      }
    }

    .group-body {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .error-text {
        display: flex;
        gap: 8px;
        align-items: start;
        width: 100%;
        color: var(--text-color-secondary);

        .error-text-label {
          line-height: 32px;
        }
        span {
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
        }
        :deep(.el-form-item) {
          margin-bottom: 0px;
          .el-form-item__content {
            display: flex;
            flex-direction: column;
            align-items: start;
          }
        }

        :deep(.el-input) {
          flex: 1;
          --el-input-border-radius: 2px;
          .el-input__wrapper {
            box-shadow: none;
            background-color: var(--bg-color-overlay);
          }
        }
      }

      .condition-container {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .condition-container-header {
          display: flex;
          align-items: center;
          color: var(--text-color-secondary);

          .el-icon {
            margin-left: auto;
            cursor: pointer;
          }
        }

        :deep(.el-form) {
          gap: 14px;
          display: flex;
          flex-direction: column;

          .el-form-item {
            margin-bottom: 0px;

            .el-form-item__content {
              display: block;
              width: 100%;
            }
          }

          .field-formula-container {
            display: flex;
            flex-direction: row;
            gap: 8px;

            .el-form-item {
              flex: 1;
            }

            .formula-button {
              border-radius: 4px;
              border: 1px solid var(--border-color);
              display: flex;
              align-items: center;
              justify-content: center;
              flex: 1;
              cursor: pointer;
              height: 32px;
              transition: all 0.3s ease;

              &:hover {
                color: var(--color-primary);
                border: 1px solid var(--color-primary-light-5);
                background-color: var(--color-primary-light-9);
              }

              &.active {
                color: var(--color-primary);
              }
            }
          }
        }

        :deep(.el-select) {
          .el-select__wrapper {
            border-radius: 4px;
            background-color: var(--bg-color-overlay);
            box-shadow: none;
          }

          &.type-select {
            min-width: 88px;
            width: fit-content;
            height: 100%;

            .el-select__selected-item {
              position: unset;
              transform: none;

              &.is-hidden {
                position: absolute;
              }
            }

            .el-select__wrapper {
              height: 100%;
              padding: 0px 4px 0px 8px;
            }
          }

          &.field-select {
            flex: 1;
          }

          &.subform-match-mode-select {
            flex: 0 0 156px;
            width: 156px;
          }
        }

        :deep(.el-input) {
          .el-input__wrapper {
            border-radius: 4px;
            background-color: var(--bg-color-overlay);
            box-shadow: none;
          }

          .el-input__inner::-webkit-outer-spin-button,
          .el-input__inner::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }

          .el-input__inner[type="number"] {
            -moz-appearance: textfield;
            appearance: textfield;
          }
        }

        :deep(.el-input-tag) {
          &.el-input-tag__wrapper {
            border-radius: 4px;
            background-color: var(--bg-color-overlay);
            box-shadow: none;
          }

          .el-input-tag__inner::-webkit-outer-spin-button,
          .el-input-tag__inner::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
        }

        :deep(.el-button) {
          border-radius: 4px;
          width: 100%;

          &.active {
            color: var(--color-primary);
          }
        }

        :deep(.dynamic-filter-select) {
          width: 100%;
          border-radius: 4px;
          .show-type-popover-btn {
            background-color: var(--bg-color-overlay);
            border: none !important;
          }
        }

        .number-range {
          display: flex;
          align-items: center;

          span {
            margin: 0px 16px;
          }
        }

        :deep(.date-range) {
          background-color: var(--bg-color-overlay);
          box-shadow: none;
          border-radius: 4px;
          width: 100%;
        }
      }

      .add-condition-button-container {
        margin: 6px 12px 6px 8px;

        .add-condition-button {
          display: flex;
          align-items: center;
          color: var(--color-primary);
          cursor: pointer;
          width: fit-content;

          .el-icon {
            margin-right: 4px;
          }
        }
      }
    }
  }
}
  
.add-group-button {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  height: 32px;
  
  font-weight: 400;
  
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  color: var(--text-color-regular);

  .el-icon {
    margin-right: 4px;
    font-size: 16px;
    padding-top: 2px;
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
