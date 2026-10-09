<template>
  <div class="fill-rules-dialog">
    <el-dialog :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)" :title="$t('fillRulesTitle')"
      width="680" align-center :close-on-click-modal="false" @open="onOpen" draggable>
      <el-container class="container">
        <el-header class="container-header" height="20px">
          <span class="container-header-span">{{ $t("fillRuleHeader") }}</span>
          <el-button type="primary" @click="handleAddField" link>
            <el-icon :size="14" style="margin-right: 4px;"><i-ep-plus /></el-icon>
            {{ $t("addField") }}
          </el-button>
        </el-header>
        <el-main>
          <el-scrollbar>
            <div class="rules">
              <template v-for="(item, index) in rules" :key="index">
                <div class="rule">
                  <div class="current">
                    <div class="title" v-if="index === 0">{{ $t("currentFormField") }}</div>
                    <div class="field">
                      <el-select class="field-select" size="default" v-model="item.targetUID" :placeholder="$t('pleaseSelectCurrentFormField')" filterable placement="bottom-start" :fallback-placements="[]" :teleported="false" @change="onTargetUIDChange(item)">
                        <el-option :key="NEW_FIELD" :label="$t('addNewField')" :value="NEW_FIELD"
                          style="display: flex; align-items: center; column-gap: 4px;">
                          <el-tooltip placement="top" effect="light">
                            <template #content>
                              <div style="max-width: 200px;">{{ $t("addNewFieldTip") }}</div>
                            </template>
                            <el-icon size="14"><i-ant-design-question-circle-outlined /></el-icon>
                          </el-tooltip>
                          {{ i18next.t("addNewField") }}
                        </el-option>
                        <el-option
                          v-for="field in currentFormFieldOptions"
                          :key="field.value"
                          :label="getOptionFilterLabel(field.label, field.value)"
                          :value="field.value"
                          :disabled="mainOptionDisabled(item, field.value, SelectBelongFormOperator.TARGET) || isFillFieldDisabled(field.value)"
                        >
                          {{ getLabel({sourceUID: null, targetUID: field.value}, field.label, field.value) }}
                        </el-option>
                        <template #label="{ label, value }">
                          <span :class="{ deleted: isDeleted(item.sourceUID, value) }">
                            {{ getLabel(item, label, value) }}
                          </span>
                        </template>
                      </el-select>
                      <span>{{ i18next.t("fillAs") }}</span>
                    </div>
                  </div>
                  <div class="target">
                    <div class="title" v-if="index === 0">{{ i18next.t("selectDataFieldTitle") }}</div>
                    <div class="field">
                      <el-select
                        class="field-select"
                        size="default"
                        v-model="item.sourceUID"
                        :placeholder="i18next.t('pleaseSelectDataField')"
                        filterable
                        :teleported="false"
                        :disabled="!item.targetUID"
                        @change="() => {
                          onSourceUIDChange(item)
                        }"
                      >
                        <el-option :value="field.uid" v-for="field in getFromFields(item.targetUID)" :key="field.uid" :label="getOptionFilterLabel(field.alias, field.uid)" :disabled="mainOptionDisabled(item, field.uid, SelectBelongFormOperator.LINKAGE)">{{ field.alias }}</el-option>
                        <template #label="{ label, value }">
                          <span :class="{ error: label === value }">
                              {{ getFromFieldLabel(item.targetUID, value, label) }}
                            </span>
                        </template>
                      </el-select>
                      <span>{{ i18next.t("fieldValueSuffix") }}</span>
                      <el-icon :size="16" @click="rules.splice(index, 1)">
                        <i-ep-delete></i-ep-delete>
                      </el-icon>
                    </div>
                  </div>
                </div>
                <div class="sub-form-field-rule" v-if="isShowSubSelect(item.targetUID, item.sourceUID)">
                  <div class="left-line"></div>
                  <div class="field-item-title">
                    <p class="current-field-title label">{{ i18next.t("subFormField") }}</p>
                    <p class="linkage-field-title label" v-if="index === 0">{{ i18next.t("linkageFormField") }}</p>
                  </div>
                  <div class="sub-field-wrapper">
                    <div class="field-item" v-for="subItem, subIndex in item.linkageSubFields || []" :key="subItem.subTargetUID || subIndex">
                      <div class="current-sub-field">
                        <div class="field">
                          <el-select
                            :key="`target-${item.targetUID || ''}-${subItem.subTargetUID || subIndex}`"
                            class="fill-field-select"
                            popper-class="linkage-fill-select-popper"
                            v-model="subItem.subTargetUID"
                            :placeholder="i18next.t('pleaseSelectSubFormField')"
                            filterable
                            :no-data-text="i18next.t('noData')"
                            :no-match-text="i18next.t('noData')"
                            :offset="4"
                            :teleported="false"
                            @change="() => {subItem.subSourceUID = null}"
                          >
                          <el-option v-for="option in getSubFieldOptions(item)" :key="`${subItem.subTargetUID || subIndex}-${option.value}`"
                              :label="getOptionFilterLabel(option.label, option.value)" :disabled="option.disabled"
                              :value="option.value">{{
                                option.label }}</el-option>
                            <template #label="{ label, value }">
                              <span :class="{ error: label === value }">
                                {{ getSubFieldLabel(item, value, label) }}
                              </span>
                            </template>
                          </el-select>
                        </div>
                      </div>
                      <p class="text">{{ i18next.t("fillAs") }}</p>
                      <div class="linkage-sub-field">
                        <div class="field">
                          <el-select
                              :key="`source-${item.sourceUID || ''}-${subItem.subTargetUID || subIndex}`"
                              class="linkage-field-select" popper-class="linkage-fill-select-popper" v-model="subItem.subSourceUID" :placeholder="i18next.t('linkedSubFormField')" filterable
                              :options="getLinkageSubTableSelectOptions(item, subItem.subTargetUID, item.linkageSubFields)"
                              :teleported="false"
                              :no-data-text="i18next.t('noData')" :no-match-text="i18next.t('noData')" :offset="4" :disabled="!subItem.subTargetUID">
                              <template #label="{ label, value }">
                                <span :class="{ error: label === value }">
                                  {{ getLinkageSubTableFieldLabel(item, subItem.subTargetUID, value, label) }}
                                </span>
                              </template>
                            </el-select>
                            <p>{{ i18next.t("fieldValueSuffix") }}</p>
                          </div>
                      </div>
                      <div class="delete">
                        <el-icon :szie="16" @click="rules[index].linkageSubFields.splice(subIndex, 1)">
                          <i-ep-delete />
                        </el-icon>
                      </div>
                    </div>
                  </div>
                  <div @click="addSubField(item)" class="add-sub-field">
                    <el-icon :size="16">
                      <i-ep-plus/>
                    </el-icon>
                    {{ i18next.t("addSubField") }}
                  </div>
                </div>
              </template>
            </div>
          </el-scrollbar>
        </el-main>
      </el-container>
      <template #footer>
        <el-button type="primary" @click="handleConfirm">{{ i18next.t("confirm") }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { computed, ref } from 'vue';
import IEpPlus from "~icons/ep/plus";
import IEpDelete from "~icons/ep/delete";
import { FillRule, FillRules, NEW_FIELD, SelectBelongFormOperator } from './types';
import IAntDesignQuestionCircleOutlined from "~icons/ant-design/question-circle-outlined";
import { deepClone, isEmpty } from '@common/utils/object';
import { FieldUID } from '@common/types/project';
import { isSystemField } from '@common/utils/connection';
import { AbstractForm, FormElement, isSubForm } from '@renderer/b2/controllers/form';
import { SelectData } from './selectData';
import { isSelect } from '../_common/utils';
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  modelValue: boolean,
  value: FillRules,
  widget: SelectData,
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "update", value: FillRules);
}>();

const errorText = i18next.t("deletedFieldError");

const rules = ref<FillRules>([]);

const notAllowTypes = ["widget.form.connecter", "widget.form.selectData", "widget.form.relatedData"];
type CurrentFieldOption = {
  label: string,
  value: string,
  element: FormElement,
  fieldType: any,
  subType?: string,
  isDataFill?: boolean,
  isSubForm: boolean,
  isSelect: boolean,
  soulType?: string,
}
type SubFieldOption = CurrentFieldOption & {
  disabled?: boolean,
}
type LinkedSubTableFieldOption = {
  alias: string,
  uid: FieldUID,
  fieldType: any,
  subType?: string,
}
const createLinkedSubTableFields = (sourceUID: string): LinkedSubTableFieldOption[] => {
  const selectSubFields = props.widget.connectionTableFields.find(f => f.uid === sourceUID);
  const subTableUID = selectSubFields?.meta?.extra?.subTableUID;
  if (!selectSubFields || !subTableUID) return [];
  const table = props.widget.getTable(subTableUID);
  if (!table?.fields) return [];
  return table.fields.filter(f => {
    return !isSystemField(f) && !notAllowTypes.includes(f.meta?.extra?.widgetType);
  })?.map(f => {
    return {
      ...f,
      alias: `${f.alias}`,
      uid: `${selectSubFields.uid}.${f.uid}` as FieldUID,
      fieldType: f.revisedType || f.type,
      subType: f.meta?.subType,
    }
  });
}
const formFields = computed(() => {
  const fields = props.widget.connectionTableFields.filter(f => {
    return !isSystemField(f) && !notAllowTypes.includes(f.meta?.extra?.widgetType);
  });
  if (isSubForm(props.widget.parent)) {
    return fields.filter(f => f.meta?.extra?.widgetType !== "widget.form.subform");
  }
  return fields;
})
const formFieldMap = computed(() => {
  return formFields.value.reduce((prev, field) => {
    prev.set(field.uid, field);
    return prev;
  }, new Map<string, any>());
})

const createCurrentFieldOption = (w: FormElement): CurrentFieldOption => {
  const setting = w.resolveFormSetting?.();
  return {
    label: w.title,
    value: w.uid,
    element: w,
    fieldType: w.fieldType,
    subType: setting?.subType,
    isDataFill: (w as any).isDataFill,
    isSubForm: isSubForm(w),
    isSelect: isSelect(w),
    soulType: w.getSoul?.().type,
  }
}
const currentFormFieldOptions = computed(() => {
  return props.widget.currentFormWidgets.map(createCurrentFieldOption);
})
const currentFieldMap = computed(() => {
  return currentFormFieldOptions.value.reduce((prev, field) => {
    prev.set(field.value, field);
    return prev;
  }, new Map<string, CurrentFieldOption>());
})
const subFieldOptionsByTargetUID = computed(() => {
  const map = new Map<string, SubFieldOption[]>();
  const targetUIDs = new Set(rules.value.map(item => item.targetUID).filter(Boolean));
  for (const targetUID of targetUIDs) {
    const targetElement = asMap<string, CurrentFieldOption>(currentFieldMap).get(targetUID)?.element;
    if (!isSubForm(targetElement)) continue;
    map.set(targetUID, targetElement.children.filter(f => !notAllowTypes.includes(f.getSoul().type)).map(createCurrentFieldOption));
  }
  return map;
})
const linkedSubTableFieldsBySourceUID = computed(() => {
  const map = new Map<string, LinkedSubTableFieldOption[]>();
  const sourceUIDs = new Set(rules.value.map(item => item.sourceUID).filter(Boolean));
  for (const sourceUID of sourceUIDs) {
    map.set(sourceUID, createLinkedSubTableFields(sourceUID));
  }
  return map;
})

const getLinkedSubTableFieldsBySourceUID = (sourceUID: string) => {
  const fields = asMap<string, LinkedSubTableFieldOption[]>(linkedSubTableFieldsBySourceUID).get(sourceUID) || [];
  return fields.length ? fields : createLinkedSubTableFields(sourceUID);
}

const equivalentGroups = ["text", "tag"];
const isEquivalentSubType = (left?: string, right?: string) => {
  return left === right || (equivalentGroups.includes(left || "") && equivalentGroups.includes(right || ""));
}
const asMap = <K, V>(source: any): Map<K, V> => {
  if (source?.value instanceof Map) return source.value;
  if (source instanceof Map) return source;
  return new Map<K, V>();
}
const getOptionFilterLabel = (label?: string, value?: string) => {
  return [label, value].filter(Boolean).join(" ");
}
const getFromFields = (uid: string) => {
  const element = asMap<string, CurrentFieldOption>(currentFieldMap).get(uid);
  return formFields.value.filter((field) => {
    if (!element) {
      if (field.meta.extra?.widgetType === "widget.form.serialNumber" && props.widget?.isInSubForm) return false;
      return true;
    }
    return ((field.revisedType || field.type) === element.fieldType && isEquivalentSubType(field.meta?.subType, element.subType)) || element.isDataFill;
  })
}

const onTargetUIDChange = (rule: FillRule) => {
  if (rule.sourceUID) {
    const fields = getFromFields(rule.targetUID);
    if (!fields.some(f => f.uid === rule.sourceUID)) {
      rule.sourceUID = null;
    }
  }
  normalizeRuleSubFields(rule);
}

const onSourceUIDChange = (rule: FillRule) => {
  rule.linkageSubFields = [];
  normalizeRuleSubFields(rule);
}

const handleAddField = () => {
  rules.value.push({
    targetUID: null,
    sourceUID: null,
  })
}
const onOpen = () => {
  rules.value = deepClone(props.value) || [];
  if (isEmpty(rules.value)) {
    handleAddField();
  }
  normalizeSubFieldRules();
}

const isForm = (widget: any) => {
  return widget instanceof AbstractForm;
}

const getForm = () => {
  if (isForm(props.widget)) {
    return props.widget;
  }
  return props.widget.form as AbstractForm;
}
const isDeleted = (uid: string, value: string) => {
  if (value === NEW_FIELD) return false;
  const fields = getFields(uid);
  return !fields.find(f => f.value === value);
}



const getLabel = (item: FillRule, label: string, value: string) => {
  if (value === NEW_FIELD) return label;
  const fields = asMap<string, CurrentFieldOption>(currentFieldMap);
  const element = fields.get(value) || fields.get(item.targetUID);
  if (!element) return i18next.t("deletedField");
  const displayLabel = element.label || label;
  return isDeleted(item.sourceUID, value) ? i18next.t("deletedField") : element.isSelect ? `${displayLabel}(${ element.isDataFill ? i18next.t("option") : i18next.t("value") })` : displayLabel;
}
const getFromFieldLabel = (targetUID: string, value: string, label: string) => {
  if (isEmpty(value)) return label;
  return getFromFields(targetUID).find(field => field.uid === value)?.alias || label || errorText;
}
const getFields = (uid: string) => {
  const field = asMap<string, any>(formFieldMap).get(uid);
  return currentFormFieldOptions.value.filter(w => {
    if (!field) return true;
    return (w.fieldType === (field.revisedType || field.type)) || w.isDataFill;
  })
}
const handleConfirm = async () => {
  const currentIndex = props.widget.parent.children.findIndex(w => w.uid === props.widget.uid);
  for (let index = 0; index < rules.value.length; index++) {
    const item = rules.value[index];
    if (item.targetUID === NEW_FIELD) {
      // 新加一个字段并绑定上
      const theWidget = await props.widget.addField(item.sourceUID, currentIndex + index + 1);
      if (!theWidget) continue;
      item.targetUID = theWidget.uid;
    }
  }
  rules.value = rules.value.filter(item => !isEmpty(item.sourceUID) && !isEmpty(item.targetUID));
  props.widget.fillRules = rules.value;
  emit("update:modelValue", false);
}

const isShowSubSelect = (targetUID: string, sourceUID: string) => {
  const targetElement = asMap<string, CurrentFieldOption>(currentFieldMap).get(targetUID);
  const sourceField = asMap<string, any>(formFieldMap).get(sourceUID);
  return !!(targetUID && sourceUID && targetElement?.isSubForm && sourceField?.meta?.subType === "subForm");
}

const normalizeRuleSubFields = (rule: FillRule) => {
  if (isShowSubSelect(rule.targetUID, rule.sourceUID)) {
    if (!Array.isArray(rule.linkageSubFields) || isEmpty(rule.linkageSubFields)) {
      rule.linkageSubFields = [{}];
    }
    return;
  }
  rule.linkageSubFields = [];
}

const normalizeSubFieldRules = () => {
  rules.value.forEach(normalizeRuleSubFields);
}

const addSubField = (rule: FillRule) => {
  if (!Array.isArray(rule.linkageSubFields)) {
    rule.linkageSubFields = [];
  }
  rule.linkageSubFields.push({});
}

// 已选过的当前填充字段禁用
const isFillFieldDisabled = (optionUID: string) => {
  if (isEmpty(rules.value)) return false;
  return rules.value.some(item => item.targetUID === optionUID || item.sourceUID === optionUID);
}
// 选项禁用
const mainOptionDisabled = (selectItem: FillRule, optionUID: string, type: SelectBelongFormOperator) => {
  const currentFields = asMap<string, CurrentFieldOption>(currentFieldMap);
  const formFieldsMap = asMap<string, any>(formFieldMap);
  const targetElement = currentFields.get(selectItem.targetUID);
  const sourceField = formFieldsMap.get(selectItem.sourceUID);
  // 选中子表禁用另一个选择的主表选项，选用主表禁用另一个选择的子表选项
  if (targetElement && type === SelectBelongFormOperator.LINKAGE) {
    const optionField = formFieldsMap.get(optionUID);
    if (!optionField) return false;
    return targetElement.isSubForm ? optionField.meta?.subType !== "subForm" : optionField.meta?.subType === "subForm";
  }
  if (sourceField && type === SelectBelongFormOperator.TARGET) {
    const optionElement = currentFields.get(optionUID);
    if (!optionElement) return false;
    return sourceField.meta?.subType === "subForm" ? !optionElement.isSubForm : optionElement.isSubForm;
  }
  return false;
}

const getDisabledSubFieldsMap = (fillItem: FillRule) => {
  return fillItem.linkageSubFields?.reduce((prev, item) => {
    if (item.subTargetUID) {
      prev[item.subTargetUID] = true;
    }
    return prev;
  }, {} as Record<string, boolean>) || {};
}
// 选中的当前子表单字段填充的选项
const getSubFieldOptions = (fillItem: FillRule) => {
  const options = asMap<string, SubFieldOption[]>(subFieldOptionsByTargetUID).get(fillItem.targetUID) || [];
  const disabledSubFieldsMap = getDisabledSubFieldsMap(fillItem);
  return options.map(option => {
    return {
      ...option,
      disabled: !!disabledSubFieldsMap[option.value],
    }
  });
}
const getSubFieldLabel = (fillItem: FillRule, value: string, label: string) => {
  if (isEmpty(value)) return label;
  return getSubFieldOptions(fillItem).find(option => option.value === value)?.label || label || errorText;
}

// 选中的关联子表单字段填充的选项
const getLinkageSubTableOptionDisabled = (item: string, linkageSubFields) => {
  let disabled = false;
  if (linkageSubFields?.length === 1 && isEmpty(linkageSubFields[0].subSourceUID)) return disabled;
  const subFieldSelected = linkageSubFields?.find(i => i.subSourceUID?.split(".").length > 1)
  if (!subFieldSelected) return false;
  if (item?.split(".").length > 1 && subFieldSelected.subSourceUID?.split(".")[0] !== item?.split(".")[0]) {
    disabled = true;
  }

  return disabled
}
const getLinkageSubTableFields = (item: FillRule, subItemUID: string) => {
  const fields = getLinkedSubTableFieldsBySourceUID(item.sourceUID);
  const targetSubElement = asMap<string, SubFieldOption[]>(subFieldOptionsByTargetUID).get(item.targetUID)?.find(f => f.value === subItemUID);
  if (isEmpty(targetSubElement?.value)) return fields;
  return fields.filter(f => {
    return f.fieldType === targetSubElement.fieldType && isEquivalentSubType(f.subType, targetSubElement.subType);
  });
}
const getLinkageSubTableSelectOptions = (item: FillRule, subItemUID: string, linkageSubFields = []) => {
  return getLinkageSubTableFields(item, subItemUID).map(field => ({
    label: field.alias,
    value: field.uid,
    disabled: getLinkageSubTableOptionDisabled(field.uid, linkageSubFields),
  }));
}
const getLinkageSubTableFieldLabel = (item: FillRule, subItemUID: string, value: string, label: string) => {
  if (isEmpty(value)) return label;
  return getLinkageSubTableFields(item, subItemUID).find(field => field.uid === value)?.alias || label || errorText;
}
</script>

<style lang='scss' scoped>
.fill-rules-dialog {
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
  :deep(.el-dialog) {
    height: 608px;
    max-height: min(100%, 608px);
    display: flex;
    flex-direction: column;
    background-color: #fff;
    --el-dialog-padding-primary: 0;
    --el-dialog-border-radius: 4px;
    --container-header-span-font-color: #141414;
    --main-title-font-color: #141414CC;

    .el-dialog__header {
      height: 40px;
      padding: 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      --el-dialog-title-font-size: 14px;
      --el-text-color-primary: var(--el-text-color-regular);

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
      }
    }

    .el-dialog__body {
      height: calc(100% - 104px);
      overflow: hidden;

      .container {
        height: 100%;
        padding: 16px;

        .container-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0;
          font-size: 14px;
          .container-header-span {
            color: var(--container-header-span-font-color);
          }
          .select-field {
            width: 76px;

            .el-select__wrapper {
              box-shadow: none;
              background: transparent;
              padding-left: 0;

              .el-select__selection {
                margin-left: 0;

                .el-select__selected-item {
                  display: none;
                }
              }

              .el-select__suffix {
                display: none;
              }
            }
          }
        }

        .el-main {
          height: calc(100% - 40px);
          padding: 0;
          margin-top: 16px;

          .rules {
            display: flex;
            flex-direction: column;
            row-gap: 8px;

            @mixin field {
              display: flex;
              column-gap: 8px;
              align-items: center;

              .el-select {
                width: 248px;
              }
            }

            .rule {
              display: flex;
              align-items: center;
              column-gap: 8px;

              .current {
                width: 368px;
                .title {
                  margin-bottom: 8px;
                  font-size: 12px;
                  color: var(--main-title-font-color);
                }
                .field {
                  display: flex;
                  align-items: center;
                  column-gap: 16px;
                  .field-select {
                    @include common-select();
                    width: 248px;
                    .el-select__selected-item .deleted {
                      color: var(--color-danger);
                    }
                  }
                  span {
                    flex: 1;
                    text-align: center;
                  }
                }
              }

              .target {
                flex: 1;
                .title {
                  margin-bottom: 8px;
                  font-size: 12px;
                  color: var(--main-title-font-color);
                }
                .field {
                  display: flex;
                  align-items: center;
                  column-gap: 16px;
                  .field-select {
                    @include common-select();
                    width: 192px;
                  }
                }
              }

              span {
                text-wrap: nowrap;
                font-size: 12px;
              }

              .el-icon {
                cursor: pointer;

                &:hover {
                  color: var(--color-danger);
                }
              }
            }
            .sub-form-field-rule {
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
                  font-size: 12px;
                  color: var(--main-title-font-color);
                }
                .current-field-title {
                  width: 224px;
                }
                .linkage-field-title {
                  width: 248px;
                  margin-left: 120px;
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
                    width: 128px;
                    height: 32px;
                    line-height: 32px;
                    text-align: center;
                    font-size: 12px;
                    color: var(--main-title-font-color);
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
                        @include common-select();
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
                      flex-direction: row;
                      row-gap: 8px;
                      .el-select {
                        @include common-select();
                        width: 192px;
                      }
                    }
                  }
                  .delete {
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

    .el-dialog__footer {
      height: 64px;
      padding: 16px;
      border-top: 1px solid var(--border-color);

      .el-button {
        border-radius: 4px;
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
}
</style>
