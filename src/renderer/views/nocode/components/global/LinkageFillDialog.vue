<template>
  <div class="linkage-fill-dialog">
    <el-dialog 
      class="form-visibility-dialog" 
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)" 
      :title="$t('LinkageFillDialog.linkFillSet')" 
      width="680" 
      align-center 
      destroy-on-close
      :close-on-click-modal="false" 
      @open="onOpen"
      draggable
    >
      <el-scrollbar class="container-scrollbar">
        <el-form class="container" :rules="formRules" :model="rule" ref="formRef">
          <div class="warning-banner">
            <el-icon :size="16"><i-ep-warning /></el-icon>
            <span>{{ $t('LinkageFillDialog.typeMatchTip') }}</span>
          </div>
          <div class="linkage-form">
            <div class="header">
              <div class="label">{{ $t('LinkageFillDialog.linkForm') }}</div>
              <div class="buttons" v-if="!isForm(widget)">
                <el-button type="primary" link @click="handleClear">
                  <el-icon :size="16" style="margin-right: 4px;">
                    <i-ep-delete />
                  </el-icon>
                  {{ $t('LinkageFillDialog.clear') }}
                </el-button>
              </div>
            </div>
            <el-form-item prop="linkageTable">
              <field-select class="linkage-table-select" :model-value="rule.linkageTable?.join(',')" @update:modelValue="handleChangeLinkageTable"
                :options="tableChoices" :isGroups="hasMultipleConnections" :placeholder="$t('LinkageFillDialog.plsSelectLinkForm')" />
            </el-form-item>
            <div class="missing-linkage-table-tip" v-if="isLinkageTableMissing">
              <el-icon :size="16"><i-ep-warning /></el-icon>
              <span>{{ $t('LinkageFillDialog.linkTableMissingTip') }}</span>
            </div>
          </div>
          <div class="linkage-setting linkage-sub-setting" v-if="!isEmpty(rule.linkageTable) && !isLinkageTableMissing && isShowSubTableSetting">
            <div class="linkage-trigger">
              <div class="logic">
                <span class="primary-table-logic-text">
                  {{ $t('LinkageFillDialog.filterPrimaryTable') }}
                  <span class="name-tag">{{ getPrimaryTableName }}</span>
                  {{ $t('LinkageFillDialog.ifPrimaryTableFieldMeet') }}
                </span>
                <el-select
                  class="logic-select"
                  size="small"
                  :modelValue="rule.subTableSetting?.logic || LogicalOperator.AND"
                  @update:modelValue="($event) => {
                    if(!rule.subTableSetting) {
                      rule.subTableSetting = {
                        logic: $event,
                        conditions: []
                      }
                    }
                    rule.subTableSetting.logic = $event
                  }"
                  :suffix-icon="CaretBottom"
                  :no-data-text="$t('LinkageFillDialog.noData')"
                >
                  <el-option
                    v-for="item in logicOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
                <div class="logic-text">{{ $t('LinkageFillDialog.conditionData') }}</div>
                <div class="buttons">
                  <el-button type="primary" link @click="handleAddSubTableCondition">
                    <el-icon :size="16" style="margin-right: 4px;">
                      <i-ep-plus />
                    </el-icon>
                    {{ $t('LinkageFillDialog.addCondition') }}
                  </el-button>
                </div>
              </div>
              <ul class="condition-list">
                <li
                  class="condition-item"
                  v-for="(condition, index) in (rule.subTableSetting?.conditions || [])"
                  :key="condition.id"
                >
                  <div class="current-field-wrapper">
                    <p class="label" v-if="index === 0">{{ $t('LinkageFillDialog.linkPrimaryTableField') }}</p>
                    <div class="field-centent">
                      <el-form-item prop="uid" :rules="getConditionFormRules(condition, 'uid')">
                        <!-- 联动表单 -->
                        <el-select 
                          class="value-select"
                          popper-class="linkage-fill-select-popper"
                          v-model="condition.uid"
                          filterable :no-data-text="$t('LinkageFillDialog.noData')"
                          :no-match-text="$t('LinkageFillDialog.noData')"
                          :placeholder= "$t('LinkageFillDialog.plsSelectLinkPrimaryTableField')"
                          :offset="4"
                          @change="handleCurrentFormElementChange(condition)"
                        >
                          <el-option
                            v-for="field in subTableSettingFields"
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
                      :no-data-text="$t('LinkageFillDialog.noData')"
                      :disabled="!condition.uid"
                      :offset="4"
                      @change="handleFuncChange(condition)"
                    >
                      <el-option
                        v-for="value, key in (conditionsAllOptions[index] ? conditionsAllOptions[index].funcOptions : {[RuleFunc.EQUAL]: RuleFuncTextMapping[RuleFunc.EQUAL]})"
                        :key="key"
                        :label="RuleFuncTextMapping[key]"
                        :value="key"
                      />
                    </el-select>
                  </div>

                  <div class="linkage-table-field-wrapper">
                    <p class="label" v-if="index === 0">{{ $t('LinkageFillDialog.currFormFieldOrCustom') }}</p>
                    <div class="field-centent">
                      <el-select
                        class="type-select"
                        popper-class="linkage-fill-select-popper"
                        size="small"
                        :disabled="disabledSubTableFieldWrapper(condition)"
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
                          :placeholder="$t('LinkageFillDialog.plsSelectCurrFormField')"
                          :no-data-text="$t('LinkageFillDialog.noData')"
                          popper-class="linkage-fill-select-popper"
                          :offset="4"
                          :disabled="true"
                        >
                        </el-select>
                      </el-form-item>
                      <el-form-item prop="uid" :rules="getConditionFormRules(condition, condition.type === FormConditionValueType.FORM ? 'value' : 'fixedValue')" v-else>
                        <field-tree-select
                          v-if="condition.type === FormConditionValueType.FORM"
                          class="field-select"
                          v-model="condition.value"
                          filterable
                          :placeholder="$t('LinkageFillDialog.plsSelectCurrFormField')"
                          :no-data-text="$t('LinkageFillDialog.noData')"
                          :options="tablesGroupOptions(subTableSettingFields.find(option=> option.uid === condition.uid), condition, true)"
                          :disabled="!condition.uid || ((condition.func as any) === RuleFunc.NOT_EMPTY || (condition.func as any) === RuleFunc.EMPTY)"
                        ></field-tree-select>
                        <el-config-provider v-else :locale="locale">
                          <form-filter-value-format class="custom-input" v-model="condition.fixedValue" :element="conditionsAllOptions[index]?.selectedElement" :otherTableFieldUID="rule.linkageTable" :selectElementUid="subTableSettingFields.find(option => option.uid === condition.uid).meta?.uid" :fieldId="condition.uid" :type="conditionsAllOptions[index]?.selectedElementTpye" :placeholder="$t('LinkageFillDialog.inputPlaceholder')" :widget="props.widget" />
                        </el-config-provider>
                      </el-form-item>
                      
                    </div>
                  </div>

                  <div :class="['delete']">
                    <el-icon :size="16" @click="handleDeleteSubTableCondition(condition)">
                      <i-ep-delete />
                    </el-icon>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <hr v-if="!isEmpty(rule.linkageTable) && !isLinkageTableMissing && isShowSubTableSetting"/>

          <div class="linkage-setting" v-if="!isEmpty(rule.linkageTable) && !isLinkageTableMissing">
            <div class="linkage-trigger">
              <div class="logic">
                <span class="logic-text">{{ $t('LinkageFillDialog.ifLinkFormFieldMeet') }}</span>
                <el-select
                  class="logic-select"
                  size="small"
                  v-model="rule.logic"
                  :suffix-icon="CaretBottom"
                  :no-data-text="$t('LinkageFillDialog.noData')"
                >
                  <el-option
                    v-for="item in logicOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
                <div class="logic-text">{{ $t('LinkageFillDialog.condition') }}</div>
                <div class="buttons">
                  <el-button type="primary" link @click="handleAddCondition">
                    <el-icon :size="16" style="margin-right: 4px;">
                      <i-ep-plus />
                    </el-icon>
                    {{ $t('LinkageFillDialog.addCondition') }}
                  </el-button>
                </div>
              </div>
              <ul class="condition-list">
                <li
                  class="condition-item"
                  v-for="(condition, index) in rule.conditions"
                  :key="condition.id"
                >
                  <div class="current-field-wrapper">
                    <p class="label" v-if="index === 0">{{ $t('LinkageFillDialog.linkFormField') }}</p>
                    <div class="field-centent">
                      <el-form-item prop="uid" :rules="getConditionFormRules(condition, 'uid')">
                        <!-- 联动表单 -->
                        <el-select 
                          class="value-select"
                          popper-class="linkage-fill-select-popper"
                          v-model="condition.uid"
                          filterable :no-data-text="$t('LinkageFillDialog.noData')"
                          :no-match-text="$t('LinkageFillDialog.noData')"
                          :placeholder= "$t('LinkageFillDialog.plsSelectLinkFormField')"
                          :offset="4"
                          @change="handleCurrentFormElementChange(condition)"
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
                      :no-data-text="$t('LinkageFillDialog.noData')"
                      :disabled="!condition.uid"
                      :offset="4"
                      @change="handleFuncChange(condition)"
                    >
                      <el-option
                        v-for="value, key in (conditionsAllOptions[index] ? conditionsAllOptions[index].funcOptions : {[RuleFunc.EQUAL]: RuleFuncTextMapping[RuleFunc.EQUAL]})"
                        :key="key"
                        :label="RuleFuncTextMapping[key]"
                        :value="key"
                      />
                    </el-select>
                  </div>

                  <div class="linkage-table-field-wrapper">
                    <p class="label" v-if="index === 0">{{ $t('LinkageFillDialog.currFormFieldOrCustom') }}</p>
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
                          :placeholder="$t('LinkageFillDialog.plsSelectCurrFormField')"
                          :no-data-text="$t('LinkageFillDialog.noData')"
                          popper-class="linkage-fill-select-popper"
                          :offset="4"
                          :disabled="true"
                        >
                        </el-select>
                      </el-form-item>
                      <el-form-item prop="uid" :rules="getConditionFormRules(condition, condition.type === FormConditionValueType.FORM ? 'value' : 'fixedValue')" v-else>
                        <field-select class="field-select" v-if="condition.type === FormConditionValueType.FORM && isEmpty(curFormRelatedTables)" :modelValue="condition.value" :fit-input-width="true" :isGroups="false" :options="tablesGroupOptions(linkageTableFields.find(option=> option.uid === condition.uid), condition)" @update:modelValue="(val) => condition.value = val"
                        filterable :placeholder="$t('LinkageFillDialog.plsSelectCurrFormField')" :no-data-text="$t('LinkageFillDialog.noData')" :no-match-text="$t('LinkageFillDialog.noData')" :show-arrow="false" :offset="4" @change="changeCurrent(condition, rule.conditions, linkageTableFields.find(option=> option.uid === condition.uid))"
                        :disabled="!condition.uid || (condition.func as any) === RuleFunc.NOT_EMPTY || (condition.func as any) === RuleFunc.EMPTY"></field-select>
                        <field-tree-select
                          v-else-if="condition.type === FormConditionValueType.FORM"
                          class="field-select"
                          v-model="condition.value"
                          filterable
                          :placeholder="$t('LinkageFillDialog.plsSelectCurrFormField')"
                          :no-data-text="$t('LinkageFillDialog.noData')"
                          :options="tablesGroupOptions(linkageTableFields.find(option=> option.uid === condition.uid), condition)"
                          @change="changeCurrent(condition, rule.conditions, linkageTableFields.find(option=> option.uid === condition.uid))"
                          :disabled="!condition.uid || ((condition.func as any) === RuleFunc.NOT_EMPTY || (condition.func as any) === RuleFunc.EMPTY)"
                        ></field-tree-select>
                        <el-config-provider v-else :locale="locale">
                          <form-filter-value-format class="custom-input" v-model="condition.fixedValue" :element="conditionsAllOptions[index]?.selectedElement" :otherTableFieldUID="rule.linkageTable" :selectElementUid="linkageTableFields.find(option => option.uid === condition.uid).meta?.uid" :fieldId="condition.uid" :type="conditionsAllOptions[index]?.selectedElementTpye" :placeholder="$t('LinkageFillDialog.inputPlaceholder')" :widget="props.widget" />
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
            <hr/>
            <div class="linkage-action">
              <p class="label">
                <span>{{ $t('LinkageFillDialog.triggerLinkFillField') }}</span>
                <el-button type="primary" link @click="handleAddFillField" v-if="isFillValue && !isSelectSubForm">
                  <el-icon :size="16" style="margin-right: 4px;">
                    <i-ep-plus />
                  </el-icon>
                  {{ $t('LinkageFillDialog.addField') }}
                </el-button>
              </p>
              <div class="field-wrapper">
                <template v-for="(item, index) in rule.fillWidgets" :key="index">
                  <div class="fill-field-item">
                    <div class="current-field">
                      <p class="label" v-if="index === 0">{{ $t('LinkageFillDialog.currFormField') }}</p>
                      <div class="field">
                        <el-form-item prop="fillWidget" :rules="getConditionFormRules(item, 'fillWidget')">
                          <el-select
                            class="fill-field-select"
                            v-model="item.fillWidget"
                            :placeholder="$t('LinkageFillDialog.plsSelectCurrFormField')"
                            @change="handleChangeFillElement(item)"
                            filterable
                            :no-data-text="$t('LinkageFillDialog.noData')"
                            :no-match-text="$t('LinkageFillDialog.noData')"
                            :disabled="!isFillValue || (isSelectSubForm === item.fillWidget && isSelectSubForm != '')"
                            popper-class="linkage-fill-select-popper"
                            :offset="4"
                          >
                            <el-option
                              v-for="field in currentFormElements"
                              :key="field.uid"
                              :label="getFieldLabel(field)"
                              :value="getFieldValue(field)"
                              :disabled="isFillFieldDisabled(field, item.fillWidget) || isMutipleSubForm(field)"
                            >
                              {{ getFieldLabel(field) }}
                            </el-option>
                            <template #label="{ label, value }">
                              <span :class="{ error: label === value }">
                                {{ label === value ? errorText : label }}
                              </span>
                            </template>
                          </el-select>
                        </el-form-item>
                      </div>
                    </div>
                    <p class="text">{{ $t('LinkageFillDialog.fillAs') }}</p>
                    <div class="linkage-field">
                      <p class="label" v-if="index === 0">{{ $t('LinkageFillDialog.linkFormField') }}</p>
                      <div class="field">
                        <el-form-item prop="linkageField" :rules="getConditionFormRules(item, 'linkageField')">
                          <el-select
                            class="linkage-field-select"
                            popper-class="linkage-fill-select-popper"
                            :disabled="!item.fillWidget || isShowSubField(item.fillWidget)"
                            v-model="item.linkageField"
                            :placeholder="isShowSubField(item.fillWidget) ? $t('LinkageFillDialog.plsSetFieldBelow') : $t('LinkageFillDialog.plsSelectLinkFormField')"
                            filterable
                            :no-data-text="$t('LinkageFillDialog.noData')"
                            :no-match-text="$t('LinkageFillDialog.noData')"
                            :offset="4"
                          >
                            <el-option
                              v-for="field in getTargetLinkageTableFields(item)"
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
                        <span>{{ $t('LinkageFillDialog.val') }}</span>
                      </div>
                    </div>
                    <div :class="['delete', { disabled: rule.fillWidgets.length === 1 }]">
                      <el-icon :size="16" @click="rule.fillWidgets.splice(index, 1)">
                        <i-ep-delete />
                      </el-icon>
                    </div>
                  </div>
                  <div class="sub-form-field-wrapper" v-if="isShowSubField(item.fillWidget)">
                    <div class="left-line"></div>
                    <div class="field-item-title">
                      <p class="current-field-title label">{{ $t('LinkageFillDialog.subFormField') }}</p>
                      <p class="linkage-field-title label" v-if="index === 0">{{ $t('LinkageFillDialog.linkFormField') }}</p>
                    </div>
                    <div class="sub-field-wrapper">
                      <div class="field-item" v-for="(subItem, subIndex) in item.linkageSubFields || []"
                        :key="subItem.fillWidget">
                        <div class="current-sub-field">
                          <div class="field">
                            <el-form-item prop="fillWidget" :rules="getConditionFormRules(subItem, 'fillWidget')">
                              <el-select
                                class="fill-field-select"
                                popper-class="linkage-fill-select-popper"
                                v-model="subItem.fillWidget"
                                :placeholder="$t('LinkageFillDialog.plsSelectSubFormField')"
                                filterable
                                :no-data-text="$t('LinkageFillDialog.noData')"
                                :no-match-text="$t('LinkageFillDialog.noData')"
                                :offset="4"
                                @change="() => {subItem.linkageField = null}"
                              >
                                <el-option
                                  v-for="option in getSubFieldOptions(item)"
                                  :key="option.value"
                                  :label="option.label"
                                  :disabled="getDisabledSubFieldsMap(item)[option.value] || isSubFillFieldDisabled(option.value, subItem.fillWidget, item.fillWidget)"
                                  :value="option.value"
                                >
                                  {{ option.label }}
                                </el-option>
                                <template #label="{ label, value }">
                                  <span :class="{ error: label === value }">
                                    {{ label === value ? errorText : label }}
                                  </span>
                                </template>
                              </el-select>
                            </el-form-item>
                          </div>
                        </div>
                        <p class="text">{{ $t('LinkageFillDialog.fillAs') }}</p>
                        <div class="linkage-sub-field">
                          <div class="field">
                            <el-form-item prop="linkageField" :rules="getConditionFormRules(subItem, 'linkageField')">
                              <el-select
                                class="linkage-field-select"
                                popper-class="linkage-fill-select-popper"
                                v-model="subItem.linkageField"
                                :placeholder="$t('LinkageFillDialog.linkSubFormField')"
                                filterable
                                :no-data-text="$t('LinkageFillDialog.noData')"
                                :no-match-text="$t('LinkageFillDialog.noData')"
                                :disabled="!subItem.fillWidget"
                                :offset="4"
                              >
                                <el-option
                                  v-for="field in getLinkageSubTableFields(item, subItem)"
                                  :key="field.uid"
                                  :label="field.alias"
                                  :value="field.uid"
                                  :disabled="getLinkageSubTableOptionDisabled(field.uid, item.linkageSubFields)"
                                />
                                <template #label="{ label, value }">
                                  <span :class="{ error: label === value }">
                                    {{ label === value ? errorText : label }}
                                  </span>
                                </template>
                              </el-select>
                            </el-form-item>
                            <span>{{ $t('LinkageFillDialog.val') }}</span>
                          </div>
                        </div>
                        <div class="delete">
                          <el-icon :szie="16" @click="rule.fillWidgets[index].linkageSubFields.splice(subIndex, 1)">
                            <i-ep-delete />
                          </el-icon>
                        </div>
                      </div>
                    </div>
                    <div @click="item.linkageSubFields.push({})" class="add-sub-field">
                      <el-icon :size="16">
                        <i-ep-plus/>
                      </el-icon>
                      {{ $t('LinkageFillDialog.addSubField') }}
                    </div>
                  </div>
                </template>
              </div>

            </div>
          </div>
        </el-form>
      </el-scrollbar>

      <template #footer>
        <p class="filter-select-tips" v-if="!isForm(widget)">
          <el-icon :size="16">
            <i-ven-exclamatory />
          </el-icon>
          {{ $t('LinkageFillDialog.tipsIfNoCurrField') }}
        </p>
        <el-button @click="emit('update:modelValue', false)">{{ $t('LinkageFillDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t('LinkageFillDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
  <tip-dialog ref="tipDialogRef" :title="$t('DataSourceFilterRuleDialog.clearTilte')" :content="$t('DataSourceFilterRuleDialog.clearContent')" :confirmText="$t('DataSourceFilterRuleDialog.confirm')" :cancelText="$t('DataSourceFilterRuleDialog.cancel')" :closeOnClickModal="true" />
  <tip-dialog ref="saveConflictTipDialogRef" :title="$t('LinkageFillDialog.saveConflictTitle')" :content="$t('LinkageFillDialog.saveConflictContent')" :confirmText="$t('LinkageFillDialog.confirm')" :cancelText="$t('LinkageFillDialog.cancel')" :closeOnClickModal="true" />
</template>

<script lang='ts' setup>
import { computed, inject, reactive, ref } from 'vue';
import { CaretBottom } from "@element-plus/icons-vue";
import { deepClone, equals, isEmpty } from '@common/utils/object';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Field, Table } from '@common/types/project';
import { isNocodeFormData, isSystemField } from '@common/utils/connection';
import { RuleFunc, RuleFuncTextMapping, RuleFuncValue } from '@common/types/nocode';
import { unique } from '@common/utils/unique';
import { FormLinkageCondition, FormLinkageRule, FormSelectGroupOption, FormTreeOption, LogicalOperator, SelectIdOfForm } from '@renderer/b2/types';
import { AbstractForm, FormElement, isSubForm } from '@renderer/b2/controllers/form';
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";
import FormFilterValueFormat from "./FormFilterValueFormat.vue"
import { getSystemColumnConfigurations } from './table/utils';
import { AggregateTable, FormConditionValueType } from '@common/types/nocode';
import { formElementInstances } from '@renderer/utils/instance';
import i18next from 'i18next';
import { NOCODE, ORGANIZE_UTIL } from '@renderer/types';
import { canReadNocodeTableDataByBody } from '@renderer/views/nocode/utils/data-permission';
import { hasInvalidMultipleSubFormRule, isMissingLinkageTable } from './linkageFillRuleState';
import { flattenLinkageFillFormElements } from './linkageFillFieldOptions';

type FillItem = FormLinkageRule["fillWidgets"][number];

const isSubTable = (table: Table) => {
  return !isEmpty(table.meta?.extra?.primaryTable);
}

const props = withDefaults(defineProps<{
  modelValue: boolean;
  widget: AbstractForm | FormElement;
  value?: FormLinkageRule;
  isFillValue?: boolean;
}>(), {
  isFillValue: true,
});

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: any);
}>();

const nocode = inject(NOCODE, ref());
const organizeUtil = inject(ORGANIZE_UTIL, null);

const logicOptions = [
  {
    value: LogicalOperator.AND,
    get label() { return i18next.t('LinkageFillDialog.and') },
  },
  {
    value: LogicalOperator.OR,
    get label() { return i18next.t('LinkageFillDialog.or') },
  },
];

const conditionTypeOptions = [
  {
    get label() { return i18next.t('LinkageFillDialog.field') },
    value: FormConditionValueType.FORM,
  },
  {
    get label() { return i18next.t('LinkageFillDialog.customVal') },
    value: FormConditionValueType.CUSTOM,
  }
]

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
  } else if (condition.func === RuleFunc.DYNAMIC) {
    condition.type = FormConditionValueType.CUSTOM;
    return true;
  } else {
    return !condition.uid || isSelectSubForm.value != '' || condition.func === RuleFunc.NOT_EMPTY || condition.func === RuleFunc.EMPTY;
  }
}

const disabledSubTableFieldWrapper = (condition) => {
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

// 判断field和element是否同一类型
const isSameElementType = (field: Field, element: FormElement) => {
  if (!field || !element) return false;
  if ((field.type === element.fieldType && (element.resolveFormSetting().subType === field.meta?.subType || (equivalentGroups.includes(element.resolveFormSetting().subType) && equivalentGroups.includes(field.meta?.subType))))) {
    return true;
  }
  return false;
}

const formRef = ref<FormInstance>();
const rule = ref<FormLinkageRule>({
  id: unique(),
  linkageTable: null,
  logic: LogicalOperator.AND,
  conditions: [],
  fillWidgets: [
    {
      fillWidget: null,
      linkageField: null,
    }
  ],
  subTableSetting: {
    logic: LogicalOperator.AND,
    conditions: [],
  },
})

const isCurrentFormElementDisabled = (element) => {
  if (isForm(props.widget)) return false;
  if (props.isFillValue) {
    return props.widget.uid !== element.uid;
  }
  return props.widget.uid === element.uid;
}

const handleChangeLinkageTable = (value: string) => {
  rule.value.linkageTable = value?.split(",") as any;
  rule.value.conditions = [];
  handleAddCondition();
}

const handleAddFillField = () => {
  rule.value.fillWidgets.push({
    fillWidget: null,
    linkageField: null,
  })
}

const isForm = (widget: any) => {
  return widget instanceof AbstractForm;
}

const getForm = () => {
  if (isForm(props.widget)) {
    return props.widget;
  }
  return props.widget.topForm as AbstractForm;
}

const getCurrentSubForm = () => {
  if (isForm(props.widget)) return null;
  const widget = props.widget as FormElement;
  return widget.isInSubForm ? widget.form as FormElement : null;
}

const getLinkageTableByRule = () => {
  if (isEmpty(rule.value?.linkageTable)) return null;
  return props.widget.getTable(rule.value.linkageTable);
}

const isLinkageTableMissing = computed(() => isMissingLinkageTable(rule.value, props.widget));

const linkageTableConnections = computed(() => {
  return props.widget.getBoard().getConnections()?.filter(c => isNocodeFormData(c)) || [];
});

const hasMultipleConnections = computed(() => linkageTableConnections.value.length > 1);

const tableChoices = computed(() => {
  const form = (props.widget.getSoul()?.type === "widget.form.form" ? props.widget : (props.widget as FormElement).topForm) as AbstractForm;
  const connections = linkageTableConnections.value;
  const currentConnection = form?.tableUID?.[0];
  const currentTable = form?.tableUID?.[1];
  const departments = organizeUtil?.departments || [];
  const isViewable = (tableId: string) => canReadNocodeTableDataByBody(nocode?.value?.body, tableId, departments);

  if (connections.length === 1) {
    return connections?.[0]?.tables
      ?.filter(t => isViewable(t.uid))
      ?.map(t => {
        if (isSubTable(t)) {
          const primaryTableUID = t.meta?.extra?.primaryTable[1];
          if (!isViewable(primaryTableUID)) return null;
          const primaryTable = connections?.[0]?.tables?.find(table => table.uid === primaryTableUID);
          if (!primaryTable) return null;
          const subField = primaryTable.fields?.find(f => f.meta?.extra?.subTableUID?.[1] === t.uid);
          return {
            label: `${primaryTable?.alias}.${subField?.alias}`,
            value: [connections[0].uid, t.uid].join(","),
            isCurrent: t.uid === currentTable ? 1 : 0
          };
        }
        return {
          label: t.uid === currentTable ? i18next.t('LinkageFillDialog.currForm') : t.alias,
          value: [connections[0].uid, t.uid].join(","),
          isCurrent: t.uid === currentTable ? 1 : 0
        };
      })?.filter(Boolean)
      ?.sort((a, b) => b.isCurrent - a.isCurrent);
  }

  return connections.map(connection => {
    return {
      label: connection.name,
      options: connection.tables
        ?.filter(t => isViewable(t.uid))
        ?.map(t => {
          if (isSubTable(t)) {
            const primaryTableUID = t.meta?.extra?.primaryTable[1];
            if (!isViewable(primaryTableUID)) return null;
            const primaryTable = connection.tables?.find(table => table.uid === primaryTableUID);
            if (!primaryTable) return null;
            const subField = primaryTable.fields?.find(f => f.meta?.extra?.subTableUID?.[1] === t.uid);
            return {
              label: `${primaryTable?.alias}.${subField?.alias}`,
              value: [connection.uid, t.uid].join(","),
              isCurrent: connection.uid === currentConnection && t.uid === currentTable ? 1 : 0
            };
          }
          return {
            label: connection.uid === currentConnection && t.uid === currentTable ? i18next.t('LinkageFillDialog.currForm') : t.alias,
            value: [connection.uid, t.uid].join(","),
            isCurrent: connection.uid === currentConnection && t.uid === currentTable ? 1 : 0
          };
        })
        ?.filter(Boolean)
        ?.sort((a, b) => b.isCurrent - a.isCurrent),
      isCurrent: connection.uid === currentConnection && connection.tables?.some(t => isViewable(t.uid)) ? 1 : 0,
    };
  }).filter(item => item.options?.length).sort((a, b) => b.isCurrent - a.isCurrent);
});

const isShowSubTableSetting = computed(() => {
  if (isLinkageTableMissing.value) return false;
  const table = getLinkageTableByRule();
  return isSubTable(table);
})

const isChangeOptions = ref(false)
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

const handleCurrentFormElementChange = async (condition) => {
  const funcs = await filterMenus(condition.uid);
  condition.func = (Object.keys(funcs)[0]) as RuleFunc || RuleFunc.EQUAL;
  isChangeOptions.value = !isChangeOptions.value;
  const selectElement = currentTriggerFormElements.value.find(item => getFieldValue(item) === condition.value);
  const selectField = linkageTableFields.value.find(item => item.uid === condition.uid);
  if (selectElement && selectField && !isSameElementType(selectField, selectElement)) {
    condition.value = null;
  }
  handleFuncChange(condition);
}

const handleFuncChange = async (condition) => {
  if(condition.func === RuleFunc.NOT_EMPTY || condition.func === RuleFunc.EMPTY) {
    condition.type = FormConditionValueType.FORM
    condition.value = null
  };
  condition.type = FormConditionValueType.FORM;
  handleFieldTypeChange(condition)
}

const handleFieldTypeChange = async (condition) => {
  const funcs = await filterMenus(condition.uid);
  const type = !isEmpty(funcs) ? funcs[condition.func] : 'string';
  if ([RuleFuncValue.SELECT_MULTIPLE, RuleFuncValue.RANGE, RuleFuncValue.TAGS].includes(type)) {
    condition.fixedValue = [];
  } else {
    condition.fixedValue = "";
  }
  isChangeOptions.value = !isChangeOptions.value;
}

const getFillElement = (elementId: string) => {
  return getForm()?.getChildElement(elementId);
}

const isMultipleSubFormById = (elementId: string) => {
  if (!elementId) return false;
  const element = getFillElement(elementId);
  return !!element && isMutipleSubForm(element as FormElement);
}

const isShowSubField = (elementId: string) => {
  if (!elementId) return false;
  return isSubForm(getFillElement(elementId));
}

const allLinkageTableFields = computed(() => {
  if (!rule.value.linkageTable || isLinkageTableMissing.value) return [];
  const table = props.widget.getTable(rule.value.linkageTable);
  if (!table?.fields) return [];
  const { baseFields, subFields } = table.fields.reduce<{ baseFields: Field[], subFields: Field[] }>((prev, f) => {
    if (isSystemField(f)) return prev;
    if (f.meta.subType === "subForm") {
      prev.subFields.push(f);
    } else {
      prev.baseFields.push(f);
    }
    return prev;
  }, { baseFields: [], subFields: [] });
  const subFormFields = subFields.map(f => {
    const subTable = props.widget.getTable(f.meta.extra.subTableUID);
    return (subTable?.fields || []).filter(sf => !isSystemField(sf)).map(sf => {
      return {
        ...sf,
        alias: `${f.alias}.${sf.alias}`,
        uid: `${f.uid}.${sf.uid}`,
      }
    })
  })?.flat(Infinity) as Field[];

  return [...baseFields, ...subFields, ...subFormFields];
});

const linkageTableFields = computed(() => {
  if (!rule.value.linkageTable || isLinkageTableMissing.value) return [];
  if(equals(getForm().tableUID, rule.value.linkageTable)) {
    setTimeout(async () => {
      await getForm().getBoard().saveFormData();
    }, 100);
  }
  const table = props.widget.getTable(rule.value.linkageTable);
  return table?.fields?.filter(f => !isSystemField(f) && f.meta.subType !== "subForm" && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)) || [];
})

const subTableSettingFields = computed(() => {
  if (!rule.value.linkageTable || isLinkageTableMissing.value) return [];
  const table = props.widget.getTable(rule.value.linkageTable);
  if(!isSubTable(table)) return [];
  const primaryTable = props.widget.getTable(table.meta.extra.primaryTable);
  return primaryTable?.fields?.filter(f => !isSystemField(f) && f.meta.subType !== "subForm" && !notAllowSelectTypes.includes(f.meta?.extra?.widgetType)) || [];
})

const getTargetLinkageTableFields = (item: FillItem) => {
  const element = getFillElement(item.fillWidget);
  return allLinkageTableFields.value.filter(f => {
    if (isAggregateLinkageTable.value && !currentAggregateMetricUIDSet.value.has(f.uid)) return false;
    if (element) {
      return isSubForm(element) === (f.meta?.subType === "subForm") && isSameElementType(f, element);
    }
    return isSubForm(element) === (f.meta?.subType === "subForm")
  });
}

const getLinkageSubTableFields = (item: FillItem, subItem) => {
  if (isAggregateLinkageTable.value) {
    const subElement = getFillElement(subItem.fillWidget);
    return allLinkageTableFields.value.filter(f => {
      if (!currentAggregateMetricUIDSet.value.has(f.uid)) return false;
      if (subElement) {
        return isSameElementType(f, subElement);
      }
      return true;
    });
  }
  const element = getFillElement(item.fillWidget);
  const subElement = getFillElement(subItem.fillWidget);
  return allLinkageTableFields.value.filter(f => {
    if (subElement) {
      return isSubForm(element) === (f.meta?.subType !== "subForm") && isSameElementType(f, subElement);
    }
    return isSubForm(element) === (f.meta?.subType !== "subForm");
  });
}

const getLinkageSubTableOptionDisabled = (item: string, linkageSubFields) => {
  let disabled = false;
  if (linkageSubFields.length === 1 && isEmpty(linkageSubFields[0].linkageField)) return disabled;
  const subFieldSelected = linkageSubFields.find(i => i.linkageField?.split(".").length > 1)
  if (!subFieldSelected) return false;
  if (item?.split(".").length > 1 && subFieldSelected.linkageField?.split(".")[0] !== item?.split(".")[0]) {
    disabled = true;
  }

  return disabled
}

const getDisabledSubFieldsMap = (fillItem: FillItem) => {
  const element = getFillElement(fillItem.fillWidget);
  return element.children.filter(w => fillItem.linkageSubFields.find(i => i.fillWidget === w.uid))?.reduce((prev, item) => {
    prev[item.uid] = true;
    return prev;
  }, {});
}

const getSubFieldOptions = (fillItem: FillItem) => {
  if (!fillItem.fillWidget) return [];
  const element = getFillElement(fillItem.fillWidget);
  if (isSubForm(element)) {
    const _disabledSubFieldsMap = getDisabledSubFieldsMap(fillItem);
    return element.children.map(w => {
      return {
        label: getFieldLabel(w, true),
        value: w.uid,
        disabled: _disabledSubFieldsMap[w.uid],
      }
    })
  }
  return [];
}

const handleChangeFillElement = (item: FillItem) => {
  const element = getFillElement(item.fillWidget);
  if (isSubForm(element)) {
    item.linkageSubFields = [{}];
    item.linkageField = undefined;
  } else {
    delete item.linkageSubFields;
    item.linkageField = undefined;
  }

  if (!canSelectFillWidget(rule.value,item.fillWidget,getForm()?.fieldsFilling)) {
    ElMessageBox(
      {
        title: i18next.t('DataSourceFilterRuleDialog.clearTilte'),
        message: i18next.t('DataSourceFilterRuleDialog.clearContent'),
        confirmButtonText: i18next.t('DataSourceFilterRuleDialog.confirm'),
        type: 'warning',
        callback: () => {
          rule.value.fillWidgets = rule.value.fillWidgets.map(fillRule => {
            if(fillRule.fillWidget === item.fillWidget) {
              fillRule.fillWidget = void 0;
            }
            return fillRule
          });
        }
      }
    )
  }
}

const isFillFieldDisabled = (element: FormElement, currentElementId: string) => {
  if (!isForm(props.widget)) {
    if (props.isFillValue) {
      const disabled = props.widget.uid === element.uid;
      if (disabled) return true;
    }
  }
  return rule.value.conditions.some(c => c.value === element.uid) || rule.value.fillWidgets.some(f => f.fillWidget === element.uid && f.fillWidget !== currentElementId);
}

const isSubFillFieldDisabled = (elementUID: string, currentElementId: string, subformId: string) => {
  return rule.value.conditions.some(c => c.value?.split(".")[1] === elementUID) || rule.value.fillWidgets.some(f => f.fillWidget === elementUID && f.fillWidget !== currentElementId);
}

const validate = (rule: any, value: any, callback: any) => {
  if (!value) {
    callback(new Error(''))
  } else {
    callback()
  }
}

const getConditionFormRules = <T>(condition: T, key: keyof T) => {
  if(key === "linkageField" && isShowSubField((condition as any).fillWidget)) {
    return []
  }
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
const isLinkageTableFieldDisabled = (field: Field) => {
  return rule.value.conditions.some(c => c.uid === field.uid);
}
const formRules = reactive<FormRules<FormLinkageRule>>({
  // linkageTable: [{ required: true, validator: validate }],
})
const isSelect = (widget: any) => {
  return ["widget.form.treeSelect", "widget.form.treeMultipleSelect"].includes(widget.type);
}

const isInMultipleTabs = (element: FormElement) => {
  if(element.parent.type === 'widget.form.tabPanel') {
    return true
  }
  return false
}

const getFieldLabel = (element: FormElement, isInSubForm = false) => {
  let title = element.title;

  if(isInMultipleTabs(element)) {
    const tab = element.parent as FormElement
    const multipleTabs = tab.parent as FormElement
    title = `${multipleTabs.title}.${tab.title}.${title}`;
  }

  if (element.isInSubForm && !isInSubForm) {
    title = `${(element.form as FormElement).title}.${title}`;
  }
  if (isSelect(element)) {
    return `${title}${element['isDataFill'] ? i18next.t('LinkageFillDialog.optSuffix') : i18next.t('LinkageFillDialog.optValueSuffix')}`
  }
  return title;
}
const getFieldValue = (element: FormElement) => {
  if (element.isInSubForm) {
    return `${(element.form as FormElement).uid}.${element.uid}`;
  }
  return element.uid;
}

const isMutipleSubForm = (el: FormElement) => {
  if(el.type === 'widget.form.subform') {
    if(el.getOption('data-origin') === 'multiple') {
      return true
    }
    return false
  }
  return false
}

const notAllowSelectTypes = ["widget.form.selectData", "widget.form.searchForm", "widget.form.richTextEditor", "widget.form.markdownEditor", "widget.form.splitLine", "widget.form.file-uploader", "widget.form.image-uploader", "widget.form.titleBar", "widget.form.imageTextShow"];
const notAllowFillSelectTypes = ["widget.form.selectData", "widget.form.searchForm", "widget.form.relatedData", "widget.form.richTextEditor", "widget.form.markdownEditor", "widget.form.splitLine", "widget.form.titleBar", "widget.form.imageTextShow"];
const currentFormElements = computed(() => {
  const children = getForm().children as FormElement[]

  return flattenLinkageFillFormElements(children, {
    includeSubFormElement: true,
    includeSubFormChildren: false,
  }).filter(c => !notAllowFillSelectTypes.includes(c.type))
})

const aggregateTablesByConnection = computed<Record<string, AggregateTable[]>>(() => {
  const bodyData = props.widget.getBoard().getNocodeBodyData?.();
  const result: Record<string, AggregateTable[]> = {};
  if (bodyData?.formData?.uid) {
    result[bodyData.formData.uid] = bodyData.formData.aggregateTables || [];
  }
  (bodyData?.otherDataSources || []).forEach(source => {
    if (!source?.uid) return;
    result[source.uid] = (source as any).aggregateTables || [];
  });
  return result;
});

const currentAggregateTable = computed<AggregateTable | null>(() => {
  const [connectionUID, tableUID] = rule.value.linkageTable || [];
  if (!connectionUID || !tableUID) return null;
  const aggregateTables = aggregateTablesByConnection.value[connectionUID] || [];
  return aggregateTables.find(item => item.uid === tableUID) || null;
});

const isAggregateLinkageTable = computed(() => Boolean(currentAggregateTable.value));

const currentAggregateMetricUIDSet = computed(() => {
  return new Set((currentAggregateTable.value?.metrics || []).map(metric => metric.uid));
});

const currentTriggerFormElements = computed(() => {
  const children = getForm().children as FormElement[]

  const currentSubForm = getCurrentSubForm();
  const elements = flattenLinkageFillFormElements(children, {
    includeSubFormElement: false,
    includeSubFormChildren: subForm => currentSubForm?.uid === subForm.uid,
  }).filter(c => !notAllowSelectTypes.includes(c.type) && !isSubForm(c))

  return elements.filter(c => {
    if (!c.isInSubForm) return true;
    const subForm = c.form as FormElement;
    return !isMutipleSubForm(subForm) || currentSubForm?.uid === subForm.uid;
  })
})

const curFormRelatedTables = computed(() => {
  const currentFormRelatedFormElement = flattenLinkageFillFormElements(getForm().children as FormElement[], {
    includeSubFormElement: false,
    includeSubFormChildren: false,
  }).filter(child => child.getSoul().type === "widget.form.relatedData");
  const currentFormRelatedTables = currentFormRelatedFormElement.map((child: any) => {
    if (
      child.connectionTable
      && canReadNocodeTableDataByBody(nocode?.value?.body, child.connectionTable[1], organizeUtil?.departments || [])
      && child.connectionTable[1] !== getForm().tableUID[1]
      && child.connectionTable[1] !== rule.value.linkageTable[1]
    ) {
      return {
        relatedTitle: child.title,
        connectionTable: (props.widget as FormElement).getTable(child.connectionTable)
      };
    }
  }).filter(t => t);
  return currentFormRelatedTables
})

const equivalentGroups = ["text", "tag"];
const tablesGroupOptions = (selfField, condition, isSubTableSetting = false) => {
  if (!rule.value.linkageTable) return [];
  const currentTable = props.widget.getTable(getForm().tableUID);
  const options: any[] = [
    {
      label: i18next.t('LinkageFillDialog.currFormField'),
      value: SelectIdOfForm.CURRENT,
      tip: null,
      options: [
        {
          label: currentTable.alias,
          value: currentTable.uid,
          children: currentTriggerFormElements.value.filter(c => {
            if (c.type === "widget.form.relatedData") {
              const isEquals = equals(c.resolveFormSetting().extra?.relatedTableUID, selfField?.meta?.extra?.relatedTableUID)
              return isEquals && c.uid !== props.widget.uid;
            } else if (selfField) {
              return isSameElementType(selfField, c)
            }
            return true
          }).map(el => {
            return {
              label: getFieldLabel(el),
              value: getFieldValue(el),
              disabled: selfField?.meta?.extra?.widgetType === "widget.form.relatedData" ? selfField.meta?.extra?.widgetType !== el.type : isDisableCurrentForm(el, condition, isSubTableSetting) ,
              selfField: el,
            }
          })
        }
      ],
      visible: currentTriggerFormElements.value.length > 0,
    },
  ]
  for (const tableItemObj of curFormRelatedTables.value) {
    if (options.find(item => item.options[0].value === tableItemObj.connectionTable.uid)) continue;
    const childOptions = tableItemObj.connectionTable.fields
      .filter(f => {
        if(isSystemField(f)) return false;
        if(notAllowSelectTypes.includes(f.meta?.extra?.widgetType)) return false
        if(f.meta.subType === "subForm") return false;
        if(f.type !== selfField?.type) return false;
        if(f.meta?.subType != selfField.meta?.subType) {
          const isIncludes = equivalentGroups.includes(f.meta?.subType) && equivalentGroups.includes(selfField.meta?.subType)
          if(!isIncludes) return false;
        }
        if (f.meta?.extra?.widgetType === "widget.form.relatedData") {
          return equals(f.meta?.extra?.relatedTableUID, selfField.meta?.extra?.relatedTableUID)
        }
        return true;
      })
      .map(f => {
        return {
          label: f.alias,
          value: f.uid,
          disabled: isDisableCurrentForm(f, condition),
          selfField: f,
        }
      });
    if (childOptions.length > 0) {
      options.push({
        label: `【${tableItemObj.connectionTable.alias}】${i18next.t('LinkageFillDialog.formField')}`,
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
    return options[0].options[0].children;
  }

  return options;
}

const isSelectSubForm = ref('')

const getComparisonOfForm = (selfField, condition, comparisonUid?: string): SelectIdOfForm | undefined => {
  if (!comparisonUid) {
    return undefined;
  }

  const comparisonOptions = tablesGroupOptions(selfField, condition) as any[];
  const matchedCurrentField = comparisonOptions.find(option => option?.value === comparisonUid);
  if (matchedCurrentField) {
    return SelectIdOfForm.CURRENT;
  }

  const comparisonSelectedGroup = comparisonOptions.find((group: any) => {
    if (!Array.isArray(group?.options)) return false;
    return group.options.some((option: any) => {
      if (!Array.isArray(option?.children)) return false;
      return option.children.some((child: any) => child?.uid === comparisonUid || child?.value === comparisonUid);
    });
  });
  const comparisonOfForm = comparisonSelectedGroup?.value;
  return comparisonOfForm === SelectIdOfForm.CURRENT || comparisonOfForm === SelectIdOfForm.LINKAGE
    ? comparisonOfForm
    : undefined;
}

const changeCurrent = (condition, conditions, selfField?) => {
  const children = getForm().children as FormElement[]
  condition.comparisonOfForm = getComparisonOfForm(selfField, condition, condition.value)
  const currentSubForm = getCurrentSubForm();
  const formElements = flattenLinkageFillFormElements(children, {
    includeSubFormElement: true,
    includeSubFormChildren: true,
  })
  const currentValue = condition.value?.split('.');
  const currentElement = formElements.find(e => e.uid === currentValue?.at(-1));
  if (currentElement?.isInSubForm && isMutipleSubForm(currentElement.form as FormElement) && currentElement.form?.uid !== currentSubForm?.uid) {
    condition.value = null;
    return;
  }
  if(currentElement?.isInSubForm) {
    if(isSelectSubForm.value != currentValue[0]) {
      rule.value.fillWidgets = [{
        fillWidget: currentValue[0],
        linkageField: undefined,
        linkageSubFields: [{}]
      }]
    }
    isSelectSubForm.value = currentValue[0];
    rule.value.conditions = conditions.filter(c => c.value?.split('.')[0] === currentValue[0] && c.value);
  } else {
    if(isSelectSubForm.value) {
      rule.value.fillWidgets = [{
        fillWidget: undefined,
        linkageField: undefined,
        linkageSubFields: undefined
      }]
    }
    isSelectSubForm.value = '';
  }

  handleChangeFieldAfterCheckLoop()
}

const isDisableCurrentForm = (field, condition, isSubTableSetting = false) => {
  if(isSubTableSetting) {
    return false
  }
  
  if(isSelectSubForm.value === getFieldValue(field)?.split('.')[0]) {
    return false
  }

  if(isSelectSubForm.value === '') {
    return false
  }

  if(rule.value.conditions.filter(c => c.value).length <= 1 && condition.value) {
    return false
  }
  return true
}



const handleAddCondition = () => {
  const defaultValue = getSelectDefaultValue();
  rule.value.conditions.push({
    id: unique(),
    uid: null,
    func: RuleFunc.EQUAL,
    value: defaultValue,
    type: FormConditionValueType.FORM,
  })
  if (defaultValue !== null) {
    changeCurrent(rule.value.conditions.at(-1), rule.value.conditions)
  }
}

const handleAddSubTableCondition = () => {
  if(!rule.value.subTableSetting) {
    rule.value.subTableSetting = {
      logic: LogicalOperator.AND,
      conditions: [],
    }
  }
  rule.value.subTableSetting.conditions.push({
    id: unique(),
    uid: null,
    func: RuleFunc.EQUAL,
    value: getSelectDefaultValue(),
    type: FormConditionValueType.FORM,
  })
}

const getSelectDefaultValue = () => {
  if (!isForm(props.widget)) {
    return props.widget.isInSubForm ? `${(props.widget.form as FormElement).uid}.${props.widget.uid}` : props.widget.uid;
  } else {
    return null;
  }
}

const handleDeleteCondition = (condition: FormLinkageCondition) => {
  rule.value.conditions = rule.value.conditions.filter(c => c.id !== condition.id);
}

const handleDeleteSubTableCondition = (condition: FormLinkageCondition) => {
  rule.value.subTableSetting.conditions = rule.value.subTableSetting.conditions.filter(c => c.id !== condition.id);
}

const checkConditions = () => {
  const hasFormField = rule.value.conditions.some(c => !isEmpty(c.value));
  
  if (!hasFormField) throw new Error(i18next.t('LinkageFillDialog.plsSetAtLeastOneCurrField'));
}

const handleConfirm = () => {
  if (!rule.value.linkageTable) {
    emit("update", null);
    emit("update:modelValue", false);
    return;
  }
  if (isLinkageTableMissing.value) {
    ElMessage.warning(i18next.t('LinkageFillDialog.linkTableMissingTip'));
    return;
  }
  formRef.value.validate((valid) => {
    if (!valid || isEmpty(rule.value.conditions)) {
      ElMessage.warning(i18next.t('LinkageFillDialog.plsSetFullLinkFillCond'));
      return;
    }
    try {
      checkConditions();
    } catch (err) {
      ElMessage.warning(err.message);
      return;
    }

    // 判断其他的限制
    const conflictFillFields = getFillFieldConflictsWithOtherRules();
    if (conflictFillFields.fillWidgets.length || conflictFillFields.subFields.length) {
      saveConflictTipDialogRef.value.confirm().then(isConfirm => {
        if (isConfirm) {
          clearConflictFillFields(conflictFillFields);
        }
      })
      return;
    }

    emit("update", deepClone(rule.value));
    emit("update:modelValue", false);
  });
}

const errorText = i18next.t('LinkageFillDialog.fieldDeletedPlsReselect')

const resetRuleAfterInvalidMultipleSubForm = () => {
  isSelectSubForm.value = '';
  rule.value.conditions = [];
  rule.value.fillWidgets = [{
    fillWidget: null,
    linkageField: null,
  }];
}

const onOpen = () => {
  isSelectSubForm.value = ''
  if (!isEmpty(props.value)) {
    rule.value = deepClone(props.value);
    let isOldData = false
    for(let c of rule.value.conditions) {
      if(c.value?.split('.').length > 1) {
        isSelectSubForm.value = c.value?.split('.')[0]
      }
      if(isSelectSubForm.value && c.value?.split('.').length === 1) {
        rule.value.conditions = rule.value.conditions.filter(item => item.value?.split('.').length > 1 && isSelectSubForm.value === item.value?.split('.')[0])
        isOldData = true
        break
      }
    }
    if(isSelectSubForm.value) {
      // 去重
      rule.value.conditions = Array.from(
        new Map(rule.value.conditions.map(item => [`${item.value}${item.uid}`, item])).values()
      );
    }
    if(rule.value.fillWidgets.length !== rule.value.fillWidgets.filter(item => item.fillWidget.split('.').length === 1).length) {
      isOldData = true
    }
    rule.value.fillWidgets = rule.value.fillWidgets.filter(item => item.fillWidget.split('.').length === 1)
    if(isOldData && isSelectSubForm.value) {
      rule.value.fillWidgets = [{
        fillWidget: isSelectSubForm.value,
        linkageField: undefined,
        linkageSubFields: [{}]
      }]
    }
    if (hasInvalidMultipleSubFormRule(rule.value, getCurrentSubForm()?.uid, isMultipleSubFormById)) {
      resetRuleAfterInvalidMultipleSubForm();
    }
  } else {
    rule.value = {
      id: unique(),
      linkageTable: null,
      logic: LogicalOperator.AND,
      conditions: [],
      fillWidgets: [{
        fillWidget: !props.isFillValue ? props.widget.uid : null,
        linkageField: null,
      }],
      subTableSetting: {
        logic: LogicalOperator.AND,
        conditions: [],
      }
    }
  }
}

const handleClear = () => {
  rule.value = {
    id: unique(),
    linkageTable: null,
    logic: LogicalOperator.AND,
    conditions: [],
    fillWidgets: [
      {
        fillWidget: null,
        linkageField: null,
      }
    ],
    subTableSetting: {
      logic: LogicalOperator.AND,
      conditions: [],
    }
  }
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
    return configurations?.editFuncInfo || {};
  }
}

const funcValue = async (fieldId: string, key: RuleFunc): Promise<RuleFuncValue> => {
  const funcs = await filterMenus(fieldId)
  return funcs[key] || funcs[RuleFunc.EQUAL];
}

const getPrimaryTableName = computed(() => {
  if(isEmpty(rule.value.linkageTable) || !isShowSubTableSetting.value) return ''
  const table = getLinkageTableByRule();
  const primaryTable = props.widget.getTable(table?.meta?.extra?.primaryTable);
  return primaryTable?.alias || ''
})

function buildDependencyGraph(
  rules: FormLinkageRule[],
  excludeRuleId?: string
): Record<string, string[]> {
  const graph: Record<string, string[]> = {};

  for (const rule of rules) {
    if (rule.id && rule.id === excludeRuleId) continue;

    const conditionFieldIds =
      rule.conditions
        ?.filter(c => c.type === FormConditionValueType.FORM)
        ?.map(c => c.value)
        .filter(Boolean) as string[];

    rule.fillWidgets?.forEach(fw => {
      if (!fw.fillWidget) return;

      for (const condField of conditionFieldIds) {
        if (!graph[condField]) {
          graph[condField] = [];
        }
        graph[condField].push(fw.fillWidget);
      }
    });
  }

  return graph;
}

function hasPath(
  from: string,
  to: string,
  graph: Record<string, string[]>,
  visited = new Set<string>()
): boolean {
  if (from === to) return true;
  if (visited.has(from)) return false;

  visited.add(from);

  const nextNodes = graph[from] || [];
  for (const next of nextNodes) {
    if (hasPath(next, to, graph, visited)) {
      return true;
    }
  }
  return false;
}

function canSelectFillWidget(
  editingRule: FormLinkageRule,
  candidateFillWidget: string,
  allRules: FormLinkageRule[]
): boolean {
  if (!candidateFillWidget) return false;

  // 当前规则中的条件字段（当前表单字段）
  const conditionFieldIds =
    editingRule.conditions
      .filter(c => c.type === FormConditionValueType.FORM)
      ?.map(c => c.value)
      .filter(Boolean) as string[];

  // 不能自己填自己
  if (conditionFieldIds.includes(candidateFillWidget)) {
    return false;
  }

  // 构建已有规则的依赖图（不包含当前正在编辑的规则）
  const graph = buildDependencyGraph(allRules, editingRule.id);

  for (const conditionField of conditionFieldIds) {
    if (hasPath(candidateFillWidget, conditionField, graph)) {
      return false;
    }
  }

  return true;
}

const tipDialogRef = ref();
const saveConflictTipDialogRef = ref();

const getRuleFillFieldIds = (ruleItem: FormLinkageRule) => {
  const fillFieldIds: string[] = [];

  ruleItem.fillWidgets?.forEach(fillRule => {
    const fillElement = getFillElement(fillRule.fillWidget);
    if (fillRule.fillWidget && !isSubForm(fillElement)) {
      fillFieldIds.push(fillRule.fillWidget);
    }
    fillRule.linkageSubFields?.forEach(subField => {
      if (fillRule.fillWidget && subField.fillWidget) {
        fillFieldIds.push(`${fillRule.fillWidget}.${subField.fillWidget}`);
      }
    });
  });

  return fillFieldIds;
}

const getFillFieldConflictsWithOtherRules = () => {
  const fillFieldIdsOfOtherRules = new Set(
    (getForm()?.fieldsFilling || [])
      .filter(item => item.id !== rule.value.id)
      .flatMap(item => getRuleFillFieldIds(item))
      .filter(Boolean)
  );

  const conflictFillWidgets: FillItem[] = [];
  const conflictSubFields: any[] = [];

  rule.value.fillWidgets.forEach(fillRule => {
    const fillElement = getFillElement(fillRule.fillWidget);
    if (fillRule.fillWidget && !isSubForm(fillElement) && fillFieldIdsOfOtherRules.has(fillRule.fillWidget)) {
      conflictFillWidgets.push(fillRule);
      return;
    }

    fillRule.linkageSubFields?.forEach(subField => {
      if (fillRule.fillWidget && subField.fillWidget && fillFieldIdsOfOtherRules.has(`${fillRule.fillWidget}.${subField.fillWidget}`)) {
        conflictSubFields.push(subField);
      }
    });
  });

  return {
    fillWidgets: conflictFillWidgets,
    subFields: conflictSubFields,
  };
}

const clearConflictFillFields = (conflictFillFields: {
  fillWidgets: FillItem[];
  subFields: any[];
}) => {
  rule.value.fillWidgets = rule.value.fillWidgets.map(fillRule => {
    if (conflictFillFields.fillWidgets.includes(fillRule)) {
      return {
        ...fillRule,
        fillWidget: null,
        linkageField: null,
        linkageSubFields: undefined,
      };
    }

    if (!fillRule.linkageSubFields?.length) return fillRule;

    return {
      ...fillRule,
      linkageSubFields: fillRule.linkageSubFields.map(subField => {
        if (!conflictFillFields.subFields.includes(subField)) return subField;
        return {
          ...subField,
          fillWidget: null,
          linkageField: null,
        };
      })
    };
  });
}

const handleChangeFieldAfterCheckLoop = async() => {
  const fillWidgetsToBeDel = [];
  for (const fillRule of rule.value.fillWidgets) {
    if (fillRule.fillWidget && !canSelectFillWidget(rule.value, fillRule.fillWidget, getForm()?.fieldsFilling)) fillWidgetsToBeDel.push(fillRule);
  }

  if (fillWidgetsToBeDel.length) {
    tipDialogRef.value.confirm().then(isSave => {
      if (isSave) rule.value.fillWidgets = rule.value.fillWidgets.filter(fillRule => !fillWidgetsToBeDel.includes(fillRule));
    })
  }
}

</script>

<style lang='scss' scoped>
.linkage-fill-dialog {
  @mixin diy-select {
    width: 104px;
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

  :deep(.form-visibility-dialog) {
    height: 640px;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--bg-color-page);
    --dialog-header-height: 40px;
    --dialog-footer-height: 80px;
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
      padding: 16px 6px;

      .el-form-item.is-error {
        .el-select__wrapper {
          box-shadow: 0 0 0 1px var(--color-danger) inset !important;
        }
      }

      .container-scrollbar {
        padding: 0 10px;

        hr {
          border: none;
          border-top: 1px solid var(--border-color);
        }

        .container {
          display: flex;
          flex-direction: column;
          row-gap: 32px;

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

            .missing-linkage-table-tip {
              display: flex;
              align-items: center;
              gap: 6px;
              margin-top: 8px;
              color: var(--color-warning);
              font-size: 13px;
              line-height: 20px;
            }

            .buttons {
              margin-left: auto;
              .el-button{
                font-size: 12px;
              }
            }
          }

          .linkage-setting {
            display: flex;
            flex-direction: column;
            row-gap: 32px;

            &.linkage-sub-setting {
              border: 1px solid var(--border-color);
              padding: 8px;
              border-radius: 4px;

              .delete {
                right: -4px !important;
              }
            }

            .linkage-trigger {
              .logic {
                display: flex;
                align-items: center;
                column-gap: 4px;
                color: var(--text-color-primary);

                .primary-table-logic-text {
                  display: flex;
                  align-items: center;
                  gap: 4px;

                  .name-tag {
                    color: var(--color-primary);
                    padding: 5px 8px;
                    background-color: var(--bg-color-overlay);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                  }
                }


                .logic-select {
                  @include diy-select;
                  width: 70px;
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
                  gap: 8px;

                  .current-field-wrapper,
                  .linkage-table-field-wrapper {
                    display: flex;
                    flex-direction: column;
                    row-gap: 8px;

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
                          width: 90px;
                          height: 100%;
                          border-radius: 4px;
                        }
                      }
                    }

                    .el-form-item__content {
                      display: flex;
                      gap: 8px;

                      .value-select, .field-select, .custom-input {
                        @include common-select;
                        width: 148px;
                        flex: 1;
                      }
                      .field-select {
                        width: 238px;
                      }
                      .custom-input {
                        flex: 1;
                        background-color: var(--bg-color-overlay);
                        border-radius: 4px;
                        gap: 4px;
                        display: flex;
                        align-items: center;
                        height: 32px;
                        width: 238px;

                        &:hover {
                          box-shadow: 0 0 0 1px var(--border-color) inset;
                        }

                        .el-date-editor, .el-input__wrapper, .el-input-tag__wrapper {
                          width: 238px;
                          height: 32px;
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

                  .current-field-wrapper {
                    width: 160px !important;
                  }

                  .linkage-table-field-wrapper {
                    width: 328px;
                  }

                  .rule-select-wrapper {
                    width: 104px;
                    text-align: center;

                    .rule-select {
                      @include diy-select;
                      background-color: var(--bg-color-overlay);
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
                width: 272px;
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
                    width: 58px;
                    height: 32px;
                    line-height: 32px;
                    text-align: center;
                  }

                  .current-field,
                  .linkage-field {
                    display: flex;
                    flex-direction: column;
                    row-gap: 8px;
                  }

                  .current-field {
                    width: 272px;
                    .field {
                      @include field;
                    }
                  }

                  .linkage-field {
                    flex: 1;
                    .field {
                      display: flex;
                      align-items: center;
                      column-gap: 8px;
                      .el-select {
                        width: 242px;
                      }
  
                      .el-form-item {
                        // flex: 1;
                        width: 242px;
                        margin-right: 8px;
                      }
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
                    margin-left: 72px;
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
                      width: 58px;
                      height: 32px;
                      line-height: 32px;
                      text-align: center;
                    }
                    .current-sub-field {
                      width: 238px;
                      display: flex;
                      flex-direction: column;
                      row-gap: 8px;
                      .field {
                        display: flex;
                        column-gap: 8px;
                        align-items: center;

                        .el-select {
                          width: 238px;
                        }
                      }
                    }

                    .linkage-sub-field {
                      width: 288px;
                      display: flex;
                      flex-direction: column;
                      row-gap: 8px;
                      .field {
                        display: flex;
                        align-items: center;
                        column-gap: 8px;
                        .el-select {
                          width: 240px;
                        }
                      
                        .el-form-item {
                          width: 240px;
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
      }
    }

    .el-dialog__footer {
      height: var(--dialog-footer-height);
      padding: 9px 24px;
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
          color: #FF4D4F;
        }
      }
    }
  }
}
</style>

<style lang="scss">
.linkage-fill-dialog-fill-widget-select-popper {
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
