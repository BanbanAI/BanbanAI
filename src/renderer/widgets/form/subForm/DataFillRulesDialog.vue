<template>
  <div class="data-fill-rules-dialog">
    <el-dialog
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue',$event)"
      :title="$t('fillRulesTitle')"
      width="680"
      align-center
      draggable
      :close-on-click-modal="false"
    >
      <el-scrollbar height="100%">
        <el-form class="container" :model="rule" ref="formRef">
          <div class="warning-banner">
            <el-icon :size="16"><i-ep-warning /></el-icon>
            <span>{{ $t('typeMatchTip') }}</span>
          </div>
          <div class="linkage-form">
            <div class="header">
              <div class="label">{{ $t('sourceForm') }}</div>
              <div class="buttons">
                <el-button type="primary" link @click="handleClear">
                  <el-icon :size="16" style="margin-right: 4px;">
                    <i-ep-delete />
                  </el-icon>
                  {{ $t('clear') }}
                </el-button>
              </div>
            </div>
            <el-form-item prop="linkageTable">
              <field-select
                class="linkage-table-select"
                :model-value="sourceTableValue"
                @update:modelValue="handleChangeSourceTable"
                :options="tableChoices"
                :placeholder="$t('pleaseSelectSourceForm')"
              />
            </el-form-item>
          </div>
          <div class="trigger" v-if="rule.sourceTableUID">
            <div class="logic">
              <span class="logic-text">{{ $t('ifSourceFormFieldMeets') }}</span>
              <el-select
                class="logic-select"
                size="small"
                v-model="rule.logic"
                :suffix-icon="CaretBottom"
                :no-data-text="$t('noData')"
              >
                <el-option
                  v-for="item in logicOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <div class="logic-text">{{ $t('conditionSuffix') }}</div>
              <div class="buttons">
                <el-button type="primary" link @click="handleAddCondition">
                  <el-icon :size="16" style="margin-right: 4px;">
                    <i-ep-plus />
                  </el-icon>
                  {{ $t('addCondition') }}
                </el-button>
              </div>
            </div>
            <ul class="condition-list">
              <li class="condition-item" v-for="(condition, index) in rule.conditions" :key="condition.id">
                <div class="current-field-wrapper">
                  <p class="label" v-if="index === 0">{{ $t('sourceFormField') }}</p>
                  <div class="field-centent">
                    <el-form-item prop="uid" :rules="getConditionFormRules(condition, 'uid')">
                      <!-- 数据源表单 -->
                      <el-select
                        class="value-select"
                        popper-class="linkage-fill-select-popper"
                        v-model="condition.uid"
                        filterable
                        :no-data-text="$t('noData')"
                        :no-match-text="$t('noData')"
                        :placeholder="$t('plsSelectField')"
                        :offset="4"
                        @change="() => {condition.value = null}"
                      >
                        <el-option
                          v-for="field in linkageTableFields"
                          :key="field.uid"
                          :label="field.alias"
                          :value="field.uid"
                        />
                        <template #label="{ label, value }">
                          <span :class="{ error: label === value }">
                            {{ label === value ? errorText : label }}
                          </span>
                        </template>
                      </el-select>
                    </el-form-item>
                  </div>
                </div>

                <div class="rule-select-wrapper">
                  <el-select
                    class="rule-select"
                    popper-class="linkage-fill-select-popper"
                    v-model="condition.func"
                    :suffix-icon="CaretBottom"
                    :no-data-text="i18next.t('noData')"
                    :disabled="!condition.uid"
                    :offset="4"
                  >
                    <el-option
                      v-for="value, key in (conditionsAllOptions[index] ? conditionsAllOptions[index].funcOptions : { [RuleFunc.EQUAL]: RuleFuncTextMapping[RuleFunc.EQUAL] })"
                      :key="key"
                      :label="RuleFuncTextMapping[key]"
                      :value="key"
                    />
                  </el-select>
                </div>

                <div class="linkage-table-field-wrapper">
                  <p class="label" v-if="index === 0">{{ i18next.t('currentFormFieldOrCustomValue') }}</p>
                  <div class="field-centent">
                    <el-select
                      class="type-select"
                      popper-class="linkage-fill-select-popper"
                      size="small"
                      :disabled="disabledCurrentFieldWrapper(condition)"
                      v-model="condition.type"
                      :suffix-icon="CaretBottom"
                      :offset="4"
                      @change="handleFieldTypeChange(condition)"
                    >
                      <el-option
                        v-for="item in conditionTypeOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                    <!-- 当前表单 -->
                    <el-form-item v-if="condition.func === RuleFunc.NOT_EMPTY || condition.func === RuleFunc.EMPTY">
                      <el-select
                        class="field-select"
                        :placeholder="i18next.t('plsSelectField')"
                        :no-data-text="i18next.t('noData')"
                        popper-class="linkage-fill-select-popper"
                        :offset="4"
                        :disabled="true"
                      >
                      </el-select>
                    </el-form-item>
                    <el-form-item
                      prop="linkageWidget"
                      :rules="getConditionFormRules(condition, condition.type === FormConditionValueType.FORM ? 'value' : 'fixedValue')"
                      v-else
                    >
                      <field-select v-if="condition.type === FormConditionValueType.FORM && isEmpty(curFormRelatedTables)" :modelValue="condition.value" :fit-input-width="true" :isGroups="false" :options="tablesGroupOptions(linkageTableFields.find(option=> option.uid === condition.uid), condition)" @update:modelValue="(val) => condition.value = val"
                      filterable :placeholder="i18next.t('plsSelectField')" :no-data-text="i18next.t('noData')" :no-match-text="i18next.t('noData')" class="field-select" :show-arrow="false" :offset="4" @change="changeCurrent(condition, rule.conditions, linkageTableFields.find(option=> option.uid === condition.uid))"
                      :disabled="!condition.uid || (condition.func as any) === RuleFunc.NOT_EMPTY || (condition.func as any) === RuleFunc.EMPTY"></field-select>
                      <field-tree-select
                        v-else-if="condition.type === FormConditionValueType.FORM"
                        class="field-select"
                        v-model="condition.value"
                        filterable
                        :placeholder="i18next.t('plsSelectField')"
                        :no-data-text="i18next.t('noData')"
                        :options="tablesGroupOptions(linkageTableFields.find(option=> option.uid === condition.uid), condition)"
                        @change="changeCurrent(condition, rule.conditions, linkageTableFields.find(option=> option.uid === condition.uid))"
                        :disabled="!condition.uid || (condition.func as any) === RuleFunc.NOT_EMPTY || (condition.func as any) === RuleFunc.EMPTY"
                      ></field-tree-select>
                      <el-config-provider v-else :locale="elementPlusLocale">
                        <form-filter-value-format
                          class="custom-input"
                          v-model="condition.fixedValue"
                          :element="conditionsAllOptions[index]?.selectedElement"
                        :otherTableFieldUID="sourceTableOptionUID"
                          :selectElementUid="getConditionSelectElementUID(condition)"
                          :fieldId="condition.uid"
                          :type="conditionsAllOptions[index]?.selectedElementTpye"
                          :placeholder="i18next.t('plsInput')"
                          :widget="props.widget"
                        />
                      </el-config-provider>
                    </el-form-item>
                  </div>
                </div>
                <div :class="['delete', { disabled: rule.conditions.length === 1 }]">
                  <el-icon :size="16" @click="handleDeleteCondition(condition)">
                    <i-ep-delete />
                  </el-icon>
                </div>
              </li>
            </ul>
          </div>
          <div class="linkage-action" v-if="rule.sourceTableUID">
            <p class="label">
              <span>{{ i18next.t('triggerFieldsToFill') }}</span>
              <el-button
                type="primary"
                link
                @click="handleAddFillField"
              >
                <el-icon :size="16" style="margin-right: 4px;">
                  <i-ep-plus />
                </el-icon>
                {{ i18next.t('addField') }}
              </el-button>
            </p>
            <div class="field-wrapper">
              <template v-for="(item, index) in rule.fillWidgets" :key="index">
                <div class="fill-field-item">
                  <div class="current-field">
                    <p class="label" v-if="index === 0">{{ i18next.t('currentSubFormField') }}</p>
                    <div class="field">
                      <el-form-item prop="fillWidget" :rules="getConditionFormRules(item, 'fillWidget')">
                        <el-select
                          class="fill-field-select"
                          v-model="item.fillWidget"
                          :placeholder="i18next.t('pleaseSelectFilledField')"
                          filterable
                          :no-data-text="i18next.t('noData')"
                          :no-match-text="i18next.t('noData')"
                          popper-class="linkage-fill-select-popper"
                          :offset="4"
                        >
                          <el-option
                            v-for="field in props.widget.children"
                            :key="field.uid"
                            :label="field.title"
                            :value="field.uid"
                            :disabled="rule.fillWidgets.some(f => f.fillWidget === field.uid)"
                          />
                          <template #label="{ label, value }">
                            <span :class="{ error: label === value }">
                              {{ label === value ? errorText : label }}
                            </span>
                          </template>
                        </el-select>
                      </el-form-item>
                    </div>
                  </div>
                  <p class="text">{{ i18next.t('fillAs') }}</p>
                  <div class="linkage-field">
                    <p class="label" v-if="index === 0">{{ i18next.t('sourceFormOrCurrentFormField') }}</p>
                    <div class="field">
                      <el-form-item
                        prop="linkageWidget"
                        :rules="getConditionFormRules(item, 'linkageWidget')"
                      >
                        <!-- <el-select
                          class="linkage-field-select"
                          popper-class="linkage-fill-select-popper"
                          v-model="item.linkageWidget"
                          placeholder="请选择填充字段"
                          filterable
                          no-data-text="暂无数据"
                          no-match-text="暂无数据"
                          :offset="4"
                          :disabled="!item.fillWidget"
                          ref="fieldTreeSelectRef"
                        >
                          <template #prefix v-if="$slots.prefix">
                            <slot name="prefix"></slot>
                          </template>
                          <template #label="{ label, value }">
                            <span :class="{ error: getTreeSelectLabel(value) === value }">
                              {{ getTreeSelectLabel(value) === value ? errorText : getTreeSelectLabel(value) }}
                            </span>
                          </template>
                          <template #default>
                            <el-option-group :label="group.name" v-for="group in selectTreeData(item.fillWidget)">
                              <el-option v-show="false" label="当前表单" value="当前表单"/>
                              <el-tree
                                :data="group.data"
                                :props="{
                                  value: 'uid',        // 节点值字段
                                  label: 'alias',         // 显示文本字段
                                  children: 'children',     // 子节点字段
                                }"
                                node-key="uid"
                                :current-node-key="item.linkageWidget"
                                highlight-current
                                check-on-click-node
                                check-on-click-leaf
                                :default-expanded-keys="defaultExpandedKeys[`key${index}`]"
                                :expanded-keys="expandedKeys"
                                :auto-expand-parent="false"
                                @node-click="(nodeData, node, treeNode, event) => handleClickNode(item, node, treeNode)"
                              >
                                <template #default="{ node, data }">
                                  <span
                                    :data-value="data.value"
                                    :style="{
                                      color: data.uid === item.linkageWidget ? 'var(--color-primary)' : data.disabled ? 'var(--text-color-secondary)' : 'var(--text-color-regular)',
                                    }"
                                  >
                                    {{ data.optionLabel ?? node.label }}
                                  </span>
                                </template>
                              </el-tree>
                            </el-option-group>
                          </template>
                        </el-select> -->
                        <field-tree-select
                          class="linkage-field-select"
                          v-model="item.linkageWidget"
                          filterable
                          :placeholder="i18next.t('pleaseSelectFillField')"
                          :no-data-text="i18next.t('noData')"
                          :disabled="!item.fillWidget"
                          :options="selectTreeData(item.fillWidget)"
                          @change="handleClickNode(item)"
                        ></field-tree-select>
                      </el-form-item>
                      <span>{{ i18next.t('valueSuffix') }}</span>
                    </div>
                  </div>
                  <div :class="['delete', { disabled: rule.fillWidgets.length === 1 }]">
                    <el-icon :size="16" @click="rule.fillWidgets.splice(index, 1)">
                      <i-ep-delete />
                    </el-icon>
                  </div>
                </div>
              </template>
            </div>

          </div>
        </el-form>
      </el-scrollbar>
      <template #footer>
        <el-button type="primary" @click="handleUpdate">{{ i18next.t('confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { isNocodeFormData, isSystemField, SystemField, getSystemColumnConfigurations } from '@common/utils/connection';
import { RuleFunc, FormConditionValueType, RuleFuncValue, RuleFuncTextMapping } from '@common/types/nocode';
import { formElementInstances } from '@renderer/utils/instance';
import { LogicalOperator, FormLinkageCondition, SelectIdOfForm } from '@renderer/b2/types';
import { FormElement } from '@renderer/b2/controllers/form';
import { SubForm } from './subForm';
import { DataFillRule } from './type';
import { CaretBottom } from "@element-plus/icons-vue";
import { computed, nextTick, ref, watch } from 'vue';
import { Field, FieldMeta, OptionTableUID, Table, TableUID } from '@common/types/project';
import { deepClone, equals, isEmpty } from '@common/utils/object';
import { unique } from '@common/utils/unique';
import IEpPlus from "~icons/ep/plus";
import IEpDelete from "~icons/ep/delete";
import IEpWarning from "~icons/ep/warning";
import { ElMessage } from 'element-plus';
import i18next, { $t } from "@renderer/widgets/i18next";
import { elementPlusLocale } from "@renderer/widgets/utils/elementPlusLocale";

const props = defineProps<{
  modelValue: boolean,
  value?: DataFillRule;
  widget: SubForm;
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "update", value: DataFillRule): void;
}>();

const fieldTreeSelectRef = ref(null)

const logicOptions = [
  {
    value: LogicalOperator.AND,
    label: i18next.t("allConditions"),
  },
  {
    value: LogicalOperator.OR,
    label: i18next.t("anyCondition"),
  },
];

const conditionTypeOptions = [
  {
    label: i18next.t("field"),
    value: FormConditionValueType.FORM,
  },
  {
    label: i18next.t("customValue"),
    value: FormConditionValueType.CUSTOM,
  }
]

const errorText = i18next.t('fieldDeletedReSelect')

const rule = ref<DataFillRule>({
  sourceConnectionUID: undefined,
  sourceTableUID: null,
  logic: LogicalOperator.AND,
  conditions: [],
  fillWidgets: [],
});

watch(() => {
  return  {
    value: props.value,
    modelValue: props.modelValue,
  }
}, ({value}) => {
  if (value) {
    rule.value = deepClone(value);
  }
}, { immediate: true, deep: true })

const connections = computed(() => {
  return props.widget.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || [];
})

const currentFormConnection = computed(() => {
  return connections.value.find(connection => connection.uid === props.widget.topForm.tableUID[0]);
})

const currentFormTables = computed(() => {
  return currentFormConnection.value?.tables || [];
})

const sourceTableValue = computed(() => {
  if (!rule.value.sourceTableUID) return null;
  const sourceConnectionUID = rule.value.sourceConnectionUID || props.widget.topForm.tableUID[0];
  return [sourceConnectionUID, rule.value.sourceTableUID].join(",");
})

const sourceTableOptionUID = computed<OptionTableUID | []>(() => {
  if (!rule.value.sourceTableUID) return [];
  return [rule.value.sourceConnectionUID || props.widget.topForm.tableUID[0], rule.value.sourceTableUID];
})

const sourceConnection = computed(() => {
  return connections.value.find(connection => connection.uid === sourceTableOptionUID.value?.[0]);
})

const sourceTables = computed(() => {
  return sourceConnection.value?.tables || [];
})

const sourceTable = computed(() => {
  return sourceTables.value.find(table => table.uid === rule.value.sourceTableUID);
})

const sourceTableLabel = computed(() => {
  if (!sourceTable.value) return "";
  if (sourceConnection.value?.uid === props.widget.topForm.tableUID[0]) {
    return sourceTable.value.alias;
  }
  const sourceName = (sourceConnection.value as any)?.name;
  return sourceName ? `${sourceName}-${sourceTable.value.alias}` : sourceTable.value.alias;
})

const handleChangeSourceTable = (value: string) => {
  const [connectionUID, tableUID] = value?.split(",") || [];
  rule.value.sourceConnectionUID = connectionUID || undefined;
  rule.value.sourceTableUID = tableUID || null;
}

type LinkageField = {
  uid: string;
  alias: string;
  meta: FieldMeta;
  type: string;
};

// 判断field和element是否同一类型
const isSameElementType = (field: Field, element: FormElement) => {
  if (!field || !element) return false;
  if ((field.type === element.fieldType && (element.resolveFormSetting().subType === field.meta?.subType || (equivalentGroups.includes(element.resolveFormSetting().subType) && equivalentGroups.includes(field.meta?.subType))))) {
    return true;
  }
  return false;
}

const notAllowSelectTypes = ["widget.form.autoCompute", "widget.form.selectData", "widget.form.relatedData", "widget.form.searchForm", "widget.form.richTextEditor", "widget.form.markdownEditor", "widget.form.splitLine", "widget.form.file-uploader", "widget.form.image-uploader", "widget.form.titleBar", "widget.form.imageTextShow"];
const notAllowFillSelectTypes = ["widget.form.autoCompute", "widget.form.selectData", "widget.form.relatedData", "widget.form.searchForm", "widget.form.richTextEditor", "widget.form.markdownEditor", "widget.form.splitLine", "widget.form.titleBar", "widget.form.imageTextShow"];
const linkageTableFields = computed<LinkageField[]>(() => {
  const tables = sourceTables.value?.filter(t => !isSubTable(t)) || [];
  const table = tables?.find(t => t.uid === rule.value.sourceTableUID);
  const fields = table?.fields?.filter(f => !isSystemField(f) && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)) || []
  const result = fields.map(f => {
    if(f.meta?.subType === 'subForm') {
      const subTableFields = sourceTables.value?.find(t => t.uid === f.meta?.extra?.subTableUID[f.meta.extra.subTableUID.length - 1])?.fields || [];
      return subTableFields?.filter(f => !isSystemField(f) && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)).map(
        (subF) => {
          return {
            uid: `${f.uid}.${subF.uid}`,
            alias: `${f.alias}.${subF.alias}`,
            meta: subF.meta,
            type: subF.type,
          }
        }
      ) || []
    };
    return {
      uid: f.uid,
      alias: f.alias,
      meta: f.meta,
      type: f.type,
    }
  })
  return (result.flat(Infinity) as LinkageField[]) || []
})

const getConditionField = (condition) => {
  return linkageTableFields.value.find(option => option.uid === condition.uid);
}

const getConditionSelectElementUID = (condition) => {
  return getConditionField(condition)?.meta?.uid;
}
// 填充关联字段
const linkageTableFillFields = computed<LinkageField[]>(() => {
  const table = sourceTable.value;
  const fields = table?.fields?.filter(f => !isSystemField(f) && !notAllowFillSelectTypes.includes(f.meta?.extra?.widgetType)) || []
  const result = fields.map(f => {
    if(f.meta?.subType === 'subForm') {
      const subTableFields = sourceTables.value?.find(t => t.uid === f.meta?.extra?.subTableUID[f.meta.extra.subTableUID.length - 1])?.fields || [];
      return subTableFields?.filter(f => !isSystemField(f) && !notAllowFillSelectTypes.includes(f.meta?.extra?.widgetType)).map(
        (subF) => {
          return {
            uid: `${f.uid}.${subF.uid}`,
            alias: `${f.alias}.${subF.alias}`,
            meta: subF.meta,
            type: subF.type,
          }
        }
      ) || []
    };
    return {
      uid: f.uid,
      alias: f.alias,
      meta: f.meta,
      type: f.type,
    }
  })
  return (result.flat(Infinity) as LinkageField[]) || []
})

const isSubTable = (table: Table) => {
  return !isEmpty(table.meta?.extra?.primaryTable);
}

const getInstance = async (fieldId: string) => {
  const option = linkageTableFields.value?.find(option => option.uid === fieldId);
  if (!option) return;
  const selfField = option
  if(selfField.meta?.extra?.widgetType) {
    const curElement = await formElementInstances.getInstance(selfField.meta?.extra?.widgetType)
    return curElement;
  }
}
const tableChoices = computed(() => {
  return connections.value.flatMap(connection => {
    return (connection.tables || []).filter(t => {
      const isCurrentTable = connection.uid === props.widget.topForm.tableUID[0] && t.fields?.some(f => f.meta?.uid === props.widget.uid);
      const canView = connection.uid !== props.widget.topForm.tableUID[0] || (props.widget.topForm as any)?.canReadLayerDataSync?.(t.uid);
      return !isSubTable(t) && !isCurrentTable && canView;
    }).map(t => {
      const connectionName = (connection as any)?.name;
      const label = connection.uid === props.widget.topForm.tableUID[0] || !connectionName
        ? t.alias
        : `${connectionName}-${t.alias}`;
      return {
        label,
        value: [connection.uid, t.uid].join(","),
      };
    });
  })
})

const handleAddCondition = () => {
  rule.value.conditions.push({
    id: unique(),
    uid: null,
    func: RuleFunc.EQUAL,
    value: null,
    type: FormConditionValueType.FORM,
  })
}

const getConditionFormRules = <T>(condition: T, key: keyof T) => {
  return [
    {
      required: true,
      validator(rule, value, callback) {
        if (!condition[key] && condition[key] !== 0) return callback(new Error(''));
        callback();
      }
    }
  ]
}
const handleClear = () => {
  rule.value.sourceConnectionUID = undefined;
  rule.value.sourceTableUID = null;
  rule.value.conditions = [
    {
      id: unique(),
      uid: null,
      func: RuleFunc.EQUAL,
      value: null,
      type: FormConditionValueType.FORM,
    }
  ]
  rule.value.fillWidgets = [{
    fillWidget: null,
    linkageWidget: null,
  }];
}

const checkConditions = () => {
  const hasFormField = rule.value.conditions.some(c => c.type === FormConditionValueType.FORM);

  if (!hasFormField) throw new Error(i18next.t("atLeastOneCurrentFormField"));
}

const formRef = ref(null);

const handleUpdate = () => {
  if (!rule.value.sourceTableUID) {
    emit("update", null);
    emit("update:modelValue", false);
    return;
  }
  formRef.value.validate((valid) => {
    if (!valid || isEmpty(rule.value.conditions)) {
      ElMessage.warning(i18next.t("incompleteLinkageFillCondition"));
      return;
    }
    try {
      checkConditions();
    } catch (err) {
      ElMessage.warning(err.message);
      return;
    }

    // 判断其他的限制
    emit("update", deepClone(rule.value));
    emit("update:modelValue", false);
  });
}

const handleDeleteCondition = (condition: FormLinkageCondition) => {
  rule.value.conditions = rule.value.conditions.filter(c => c.id !== condition.id);
}

const filterMenus = async (fieldId: string) => {
  const option = linkageTableFields.value?.find(option => option.uid === fieldId);
  if (!option) return {};
  const selfField = option
  const instance = await getInstance(fieldId);
  if(instance) {
    const configurations = instance?.getConfigurations();
    // 开关填充时只有等于不等于
    if (selfField.meta.extra?.widgetType === "widget.form.switch") {
      return {
        [RuleFunc.EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.STRING,
      }
    }
    return configurations?.editFuncInfo || {};
  } else {
    const configurations = getSystemColumnConfigurations(selfField.meta.name);
    return configurations?.funcInfo || {};
  }
}

const funcValue = async (fieldId: string, key: RuleFunc): Promise<RuleFuncValue> => {
  const funcs = await filterMenus(fieldId)
  return funcs[key] || funcs[RuleFunc.EQUAL];
}

const disabledCurrentFieldWrapper = (condition) => {
  const field = linkageTableFields.value.find(option => option.uid === condition.uid);
  // 关联表单不允许选择自定义输入值
  if (field && field.meta?.extra?.widgetType === "widget.form.relatedData") {
    condition.type = FormConditionValueType.FORM;
    return true;
  } else if (condition.func === RuleFunc.BETWEEN) {
    condition.type = FormConditionValueType.CUSTOM;
    condition.value = [];
    return true;
  } else {
    return !condition.uid || condition.func === RuleFunc.NOT_EMPTY || condition.func === RuleFunc.EMPTY;
  }
}

const isChangeOptions = ref(false);

const conditionsAllOptions = computed(() => {
  const conditionsAllOptions = ref([])
  if (rule.value.conditions.length === 0) {
    conditionsAllOptions.value['default-show'] = {
      funcOptions: [],
      selectedElement: null,
      selectedElementTpye: null,
    };
    return conditionsAllOptions.value;
  };
  isChangeOptions.value
  rule.value.conditions.forEach(async (condition, index) => {
    if (condition.uid) {
      const funcs = await filterMenus(condition.uid);
      const element = await getInstance(condition.uid);
      const elementTpye = await funcValue(condition.uid, condition.func);
      conditionsAllOptions.value[index] = {
        funcOptions: funcs,
        selectedElement: element,
        selectedElementTpye: elementTpye,
      };
    }
  })
  return conditionsAllOptions.value;
})

const handleFieldTypeChange = async (condition) => {
  const funcs = await filterMenus(condition.uid);
  const type = !isEmpty(funcs) ? funcs[condition.func] : 'string';
  if ([RuleFuncValue.SELECT_MULTIPLE, RuleFuncValue.RANGE, RuleFuncValue.TAGS].includes(type)) {
    condition.fixedValue = [];
  } else {
    condition.fixedValue = null;
  }
  isChangeOptions.value = !isChangeOptions.value;
}

const handleAddFillField = () => {
  rule.value.fillWidgets.push({
    fillWidget: null,
    linkageWidget: null,
  })
}

const currentFormFields = computed(() => {
  const expendTree = (children) => {
    return children.flatMap((item: FormElement) => {
      if(item.children?.length > 0 && item.type !== 'widget.form.subform') {
        return expendTree(item.children)
      }
      return item
    }).filter(item => !['widget.form.tabPanel', 'widget.form.multipleTabs'].includes(item.type))
  }
  const fields = expendTree(props.widget.topForm.children).filter(c => !notAllowSelectTypes.includes(c.type)).map((item: FormElement) => {
    if(item.type === 'widget.form.subform') {
      return item.children.map((subItem: FormElement) => {
        return {
          uid: `${item.uid}.${subItem.uid}`,
          title: `${item.title}.${subItem.title}`,
          disabled: props.widget.uid == item.uid,
          selfField: subItem
        }
      })
    }
    return {
      uid: item.uid,
      title: item.title,
      selfField: item
    }
  })
  return fields.flat(Infinity) as any[]
})

const currentFormFillFields = computed(() => {
  const expendTree = (children) => {
    return children.flatMap((item: FormElement) => {
      if(item.children?.length > 0 && item.type !== 'widget.form.subform') {
        return expendTree(item.children)
      }
      return item
    }).filter(item => !['widget.form.tabPanel', 'widget.form.multipleTabs'].includes(item.type))
  }
  const fields = expendTree(props.widget.topForm.children).filter(c => !notAllowFillSelectTypes.includes(c.type)).map((item: FormElement) => {
    if(item.type === 'widget.form.subform') {
      return item.children.map((subItem: FormElement) => {
        return {
          uid: `${item.uid}.${subItem.uid}`,
          title: `${item.title}.${subItem.title}`,
          disabled: props.widget.uid == item.uid,
        }
      })
    }
    return {
      uid: item.uid,
      title: item.title,
    }
  })
  return fields.flat(Infinity) as any[]
})

const curFormRelatedTables = computed(() => {
  const currentFormRelatedFormElement = props.widget.topForm.children.filter(child => child.getSoul().type === "widget.form.relatedData");
  const currentFormRelatedTables = currentFormRelatedFormElement.map((child: any) => {
    const isSameSourceTable = sourceTableOptionUID.value.length > 0 && equals(child.connectionTable, sourceTableOptionUID.value);
    if (
      child.connectionTable
      && (props.widget.topForm as any)?.canReadLayerDataSync?.(child.connectionTable[1])
      && child.connectionTable[1] !== props.widget.topForm.tableUID[1]
      && !isSameSourceTable
    ) {
      const connectionTable = (props.widget as FormElement).getTable(child.connectionTable);
      if (!connectionTable) return null;
      return {
        relatedTitle: child.title,
        connectionTable
      };
    }
  }).filter(t => t);
  return currentFormRelatedTables
})
const equivalentGroups = ["text", "tag"];
const tablesGroupOptions = (selfField, condition) => {
  if (!rule.value.sourceTableUID) return [];
  const currentTable = currentFormTables.value.find(t => t.uid === props.widget.topForm.tableUID[1]) || props.widget.getTable(props.widget.topForm.tableUID);
  if (!currentTable) return [];
  const options = [
    {
      label: i18next.t("currentFormFieldLabel"),
      value: SelectIdOfForm.CURRENT,
      tip: null,
      options: [
        {
          label: currentTable.alias,
          value: currentTable.uid,
          children: currentFormFields.value.filter(c => {
            if (c.selfField.type === "widget.form.relatedData") {
              return (equals(c.selfField.resolveFormSetting().extra?.relatedTableUID, selfField?.meta?.extra?.relatedTableUID) && c.selfField.uid !== props.widget.uid) ? true : false;
            } else {
              if (selfField) {
                return isSameElementType(selfField, c.selfField)
              }
              return true;
            }
          }).map(el => {
            return {
              label: el.title,
              value: el.uid,
              disabled: selfField?.meta?.extra?.widgetType === "widget.form.relatedData" ? selfField.meta?.extra?.widgetType !== el.type : currentFormFieldsDisable(el.uid) || el.disabled ,
              selfField: el,
            }
          })
        }
      ],
      visible: currentFormFields.value.length > 0,
    },
  ]
  for (const tableItemObj of curFormRelatedTables.value) {
    const connectionTable = tableItemObj?.connectionTable;
    if (!connectionTable) continue;
    if (options.find(item => item.options[0].value === tableItemObj.connectionTable.uid)) continue;
    const childOptions = tableItemObj.connectionTable.fields.filter(f => !isSystemField(f) && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType) && f.meta.subType !== "subForm")
      .filter(f => f.type === selfField?.type && (f.meta?.subType === selfField.meta?.subType || (equivalentGroups.includes(f.meta?.subType) && equivalentGroups.includes(selfField.meta?.subType))))
      .filter(f => {
        if (f.meta?.extra?.widgetType === "widget.form.relatedData") {
          return equals(f.meta?.extra?.relatedTableUID, selfField.meta?.extra?.relatedTableUID) ? true : false;
        } else {
          return true;
        }
      })
      .map(f => {
        return {
          label: f.alias,
          value: f.uid,
          disabled: currentFormFieldsDisable(f.uid),
          selfField: f,
        }
      });
    if (childOptions.length > 0) {
      options.push({
        label: i18next.t("linkedFormFieldLabel", { title: tableItemObj.connectionTable.alias }),
        value: SelectIdOfForm.LINKAGE,
        tip: tableItemObj.relatedTitle,
        options: [
          {
            label: tableItemObj.connectionTable.alias,
            value: tableItemObj.connectionTable.uid,
            children: childOptions,
          }
        ],
        visible: childOptions.length > 0,
      })
    }
  }

  // 只有当前表单时不使用树状结构
  if (isEmpty(curFormRelatedTables.value)) {
    return options[0]?.options?.[0]?.children || [];
  }

  return options;
}

const changeCurrent = (condition, conditions, selfField?) => {
  if (isEmpty(curFormRelatedTables.value)) {
    condition.comparisonOfForm = SelectIdOfForm.CURRENT;
    return;
  }
  const comparisonOptions = tablesGroupOptions(selfField, condition);
  const comparisonSelectedGroup = comparisonOptions.find((group: any) => group.options[0].children.find(option => option.uid === condition.value || option.value === condition.value));
  condition.comparisonOfForm = comparisonSelectedGroup?.value;
}

const selectTreeData = (elementId?: string) => {
  const selectElement = props.widget.children.find(item => item.uid === elementId)
  const table = sourceTable.value;
  const fields = table?.fields?.filter(f => !isSystemField(f) && !notAllowFillSelectTypes.includes(f.meta?.extra?.widgetType)).filter(f => {
    if (selectElement && f.meta?.subType !== 'subForm') return isSameElementType(f, selectElement);
    return true;
  }) || []
  const result = fields.map(f => {
    if(f.meta?.subType === 'subForm') {
      const subTableFields = sourceTables.value?.find(t => t.uid === f.meta?.extra?.subTableUID[f.meta.extra.subTableUID.length - 1])?.fields || [];
      return {
        uid: f.uid,
        alias: f.alias,
        meta: f.meta,
        value: f.uid,
        label: f.alias,
        isLeaf: false,
        children: subTableFields?.filter(sf => !isSystemField(sf) && !notAllowFillSelectTypes.includes(sf.meta?.extra?.widgetType)).filter(f => {
          if (selectElement) return isSameElementType(f, selectElement);
          return true;
        }).map(
          (subF) => {
            return {
              uid: `${f.uid}.${subF.uid}`,
              alias: `${subF.alias}`,
              meta: subF.meta,
              isLeaf: true,
              value: `${f.uid}.${subF.uid}`,
              label: subF.alias,
            }
          }
        ) || []
      }
    };
    return {
      uid: f.uid,
      alias: f.alias,
      meta: f.meta,
      isLeaf: true,
      value: f.uid,
      label: f.alias,
    }
  })
  const expendTree = (children) => {
    return children.flatMap((item: FormElement) => {
      if(item.children?.length > 0 && item.type !== 'widget.form.subform') {
        return expendTree(item.children)
      }
      return item
    }).filter(item => !['widget.form.tabPanel', 'widget.form.multipleTabs'].includes(item.type))
  }
  const _result = expendTree(props.widget.topForm.children).filter(item => item.uid !== props.widget.uid).filter(item => {
    if (selectElement && item.type !== 'widget.form.subform') {
      return !notAllowFillSelectTypes.includes(item.type) && item.fieldType === selectElement.fieldType && (item.resolveFormSetting().subType === selectElement.resolveFormSetting().subType || (equivalentGroups.includes(item.resolveFormSetting().subType) && equivalentGroups.includes(selectElement.resolveFormSetting().subType)));
    };
    return !notAllowFillSelectTypes.includes(item.type);
  }).map((item: FormElement) => {
    if(item.type === 'widget.form.subform') {
      return {
        uid: item.uid,
        alias: item.title,
        value: item.uid,
        label: item.title,
        disabled: currentSelectSubform.value != item.uid,
        children: item.children.filter(item => {
          if (selectElement) {
            return !notAllowFillSelectTypes.includes(item.type) && item.fieldType === selectElement.fieldType && (item.resolveFormSetting().subType === selectElement.resolveFormSetting().subType || (equivalentGroups.includes(item.resolveFormSetting().subType) && equivalentGroups.includes(selectElement.resolveFormSetting().subType)));
          };
          return !notAllowFillSelectTypes.includes(item.type);
        }).map((subItem: FormElement) => {
          return {
            uid: `${item.uid}.${subItem.uid}`,
            alias: `${subItem.title}`,
            disabled: currentSelectSubform.value != item.uid,
            isLeaf: true,
            value: `${item.uid}.${subItem.uid}`,
            label: subItem.title,
          }
        })
      }
    }
    return {
      uid: item.uid,
      alias: item.title,
      isLeaf: true,
      value: item.uid,
      label: item.title,
    }
  })

  return [
    {
      name: i18next.t('currentFormCurrentRow'),
      label: i18next.t('currentFormCurrentRow'),
      options: [
        {
          uid: i18next.t('currentForm'),
          label: i18next.t('currentForm'),
          alias: props.widget.topForm.name,
          children: _result,
        }
      ]
    },
    {
      name: i18next.t('sourceForm'),
      label: i18next.t('sourceForm'),
      options: [
        {
          uid: sourceTable.value?.uid || i18next.t('sourceForm'),
          label: sourceTableLabel.value,
          alias: sourceTableLabel.value,
          children: result || [],
        }
      ]
    },
  ]
}

const getTreeSelectLabel = (value) => {
  const label1 = currentFormFillFields.value.find(item => item.uid === value)?.title || null
  const label2 = linkageTableFillFields.value.find(item => item.uid === value)?.alias || null
  return label1 || label2 || value
}

const clickCurrentNode = (node) => {
  if(!node.data?.isLeaf) return false
  if(node.data?.disabled) return false
  for(const treeSelect of fieldTreeSelectRef.value) {
    treeSelect.blur()
  }
  return true
}

const currentFormFieldsDisable = (uid) => {
  if(rule.value.conditions?.length < 2) {
    return false
  }
  if(uid?.split('.').length === 1) {
    return false
  }
  for(const condition of rule.value.conditions) {
    if((condition.value || '').split('.').length === 1) continue
    if((condition.value || '').split('.')[0] != uid?.split('.')[0]) {
      return true
    }
  }
  return false
}

const currentSelectSubform = computed(() => {
  for(const condition of rule.value?.conditions) {
    if(condition.value?.split('.').length === 2) {
      return condition.value?.split('.')[0]
    }
  }
  return null
})

watch(() => {
  return currentSelectSubform.value
}, (newVal, oldVal) => {
  if(newVal == oldVal) return
  rule.value.fillWidgets.forEach(item => {
    if(!item.linkageWidget?.startsWith("f_") && item.linkageWidget?.split('.').length > 1) {
      item.linkageWidget = null
    }
  })
})

watch(() => sourceTableValue.value, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    rule.value.conditions = [{
      id: unique(),
      uid: null,
      func: RuleFunc.EQUAL,
      value: null,
      type: FormConditionValueType.FORM,
    }]
    rule.value.fillWidgets = [{
      fillWidget: null,
      linkageWidget: null,
    }];
  }
})

const handleClickNode = (item) => {
  console.log('item',item);
}

const defaultExpandedKeys = ref({})
const getTreePath = (val) => {
  if(!val) return []
  const getPath = (treeData) => {
    for (const item of treeData) {
      if (item.uid === val) {
        return [item.uid]
      }

      // 如果有子节点，递归查找
      if (item.children?.length) {
        const childPath = getPath(item.children)
        if (childPath.length) {
          return [item.uid, ...childPath]
        }
      }
    }
    // 没找到返回空数组
    return []
  }
  for(const group of selectTreeData()) {
    const found = getPath(group.options)
    if(found.length) {
      return found
    }
  }
  return []
}
watch(() => rule.value.fillWidgets, (newVal, oldVal) => {
  if(newVal == oldVal) return
  for(let i = 0; i < newVal.length; i++) {
    const item = newVal[i]
    const targetUID = item.linkageWidget
    const defaultValue = targetUID ? getTreePath(targetUID) : []
    defaultExpandedKeys.value[`key${i}`] = defaultValue
  }
})
</script>

<style lang='scss' scoped>
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

@mixin delete {
  display: flex;
  align-items: center;
  cursor: pointer;

  &.disabled {
    cursor: not-allowed;
    pointer-events: none;
    opacity: 0.4;
  }

  .el-icon {
    &:hover {
      color: var(--color-danger);
    }
  }
}

.data-fill-rules-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    --el-dialog-bg-color: var(--bg-color-page);
    --el-dialog-padding-primary: 0;

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      line-height: 50px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;

      .el-dialog__headerbtn {
        height: 50px;
        width: 50px;
        font-size: 16px;
        border-top-right-radius: 4px;
        top: 0;

        .el-dialog__close {
          font-size: 18px;
        }

      }
    }

    .el-dialog__body {
      height: 640px;
      padding: 16px;

      .warning-banner {
        height: 38px;
        padding: 8px 12px;
        border-radius: 4px;
        background: #fff8e6;
        color: #c28b00;
        font-size: 14px;
        line-height: 22px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .container {
        display: flex;
        flex-direction: column;
        row-gap: 16px;

        .el-form-item {
          margin: 0;
        }

        .linkage-form {
          .header {
            display: flex;
            align-items: center;
            margin-bottom: 16px;

            .label {
              color: var(--text-color-primary);
            }
          }

          .linkage-table-select {
            @include common-select;
          }

          .buttons {
            margin-left: auto;

            .el-button {
              font-size: 12px;
            }
          }
        }

        .trigger {
          .logic {
            display: flex;
            align-items: center;
            column-gap: 4px;
            color: var(--text-color-primary);

            .logic-select {
              width: 70px;
              @include diy-select;
              background-color: var(--bg-color-overlay);
            }

            .buttons {
              margin-left: auto;
            }

          }

          .condition-list {
            display: flex;
            flex-direction: column;
            row-gap: 8px;
            margin-top: 16px;

            .condition-item {
              display: flex;
              align-items: end;
              position: relative;

              .current-field-wrapper,
              .linkage-table-field-wrapper {
                display: flex;
                flex-direction: column;
                row-gap: 8px;
                width: 246px;

                .label {
                  color: var(--text-color-primary);
                  font-size: 12px;
                }

                .field-centent {
                  display: flex;
                  gap: 8px;
                  align-items: center;

                  .el-form-item {
                    flex: 1;
                  }

                  .type-select {
                    @include diy-select;
                    width: 90px;
                    height: 32px;
                    background-color: var(--bg-color-overlay);

                    .el-select__wrapper {
                      height: 100%;
                      border-radius: 4px;
                    }
                  }
                }

                .el-form-item__content {
                  display: flex;
                  gap: 8px;

                  .value-select,
                  .field-select,
                  .custom-input {
                    @include common-select;
                    width: 148px;
                    flex: 1;
                  }

                  .custom-input {
                    flex: 1;
                    background-color: var(--bg-color-overlay);
                    border-radius: 4px;
                    gap: 4px;
                    display: flex;
                    align-items: center;
                    height: 32px;

                    &:hover {
                      box-shadow: 0 0 0 1px var(--border-color) inset;
                    }

                    .el-input__wrapper,
                    .el-input-tag__wrapper {
                      width: 148px;
                      box-shadow: none;
                      border: none;
                      background: transparent;

                      .el-input__inner {
                        font-size: 12px;
                      }
                    }
                  }
                }
              }


              .rule-select-wrapper {
                width: 120px;
                text-align: center;

                .rule-select {
                  @include diy-select;
                }
              }

              .delete {
                height: 32px;
                @include delete;
                position: absolute;
                right: 8px;
              }
            }

          }
        }

        @mixin field {
          display: flex;
          column-gap: 8px;
          align-items: center;

          .el-select {
            width: 248px;
          }
        }

        .linkage-action {
          display: flex;
          flex-direction: column;
          row-gap: 16px;

          .label {
            display: flex;
            align-items: center;
            color: var(--text-color-primary);

            .el-button {
              margin-left: auto;
            }
          }

          .field-wrapper {
            display: flex;
            flex-direction: column;
            row-gap: 8px;

            .fill-field-item {
              display: flex;
              align-items: end;
              font-size: 12px;
              position: relative;

              .text {
                width: 120px;
                height: 32px;
                line-height: 32px;
                text-align: center;
              }

              .current-field,
              .linkage-field {
                width: 248px;
                display: flex;
                flex-direction: column;
                row-gap: 8px;
              }

              .current-field .field {
                @include field;
              }

              .linkage-field .field {
                display: flex;
                align-items: center;
                column-gap: 8px;
                .el-select {
                  width: 200px;
                }

                .el-form-item {
                  // flex: 1;
                  width: 200px;
                  margin-right: 8px;
                }
              }

              .delete {
                @include delete;
                height: 32px;
                position: absolute;
                right: 8px;
              }
            }

            .fill-field-select, .linkage-field-select {
              @include common-select();
              width: 208px;
            }
          }

          .sub-form-field-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            margin-left: 24px;
            padding: 8px;
            position: relative;
            .left-line {
              width: 12px;
              height: 50%;
              position: absolute;
              top: 0;
              left: -12px;
              border-left: 1px solid var(--border-color);
              border-bottom: 1px solid var(--border-color);
            }

            .field-item-title {
              display: flex;
              flex-direction: row;
              .label {
                color: var(--text-color-primary);
                font-size: 12px;
              }
              .current-field-title {
                width: 224px;
              }
              .linkage-field-title {
                width: 248px;
                margin-left: 112px;
              }
            }

            .sub-field-wrapper {
              display: flex;
              flex-direction: column;
              row-gap: 8px;
              .field-item {
                display: flex;
                align-items: end;
                font-size: 12px;

                .field {
                  @include field;
                }

                .text {
                  width: 120px;
                  height: 32px;
                  line-height: 32px;
                  text-align: center;
                }
                .current-sub-field {
                  width: 216px;
                  display: flex;
                  flex-direction: column;
                  row-gap: 8px;
                  .field {
                    display: flex;
                    column-gap: 8px;
                    align-items: center;

                    .el-select {
                      width: 216px;
                    }
                  }
                }

                .linkage-sub-field {
                  width: 248px;
                  display: flex;
                  flex-direction: column;
                  row-gap: 8px;
                  .field {
                    display: flex;
                    align-items: center;
                    column-gap: 8px;
                    .el-select {
                      width: 200px;
                    }

                    .el-form-item {
                      width: 200px;
                      margin-right: 8px;
                    }
                  }
                }
                .delete {
                  @include delete;
                  height: 32px;
                  font-size: 16px;
                  position: absolute;
                  right: 8px;
                }
              }
            }

            .add-sub-field {
              display: flex;
              align-items: center;
              gap: 4px;
              color: var(--color-primary);
              padding: 2px;
              cursor: pointer;
              width: fit-content;

              &:hover {
                color: var(--el-color-primary-light-5);
              }
            }
          }
        }
      }
    }

    .el-dialog__footer {
      padding: 16px;
      border-top: 1px solid var(--border-color);
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

