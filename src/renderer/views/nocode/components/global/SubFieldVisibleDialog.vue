<template>
  <div class="sub-field-visible-rule-container">
    <el-dialog class="sub-field-visible-dialog"
      :modelValue="modelValue" 
      :title="$t('SubFieldVisibleDialog.visibleRule')"
      width="680"
      @update:modelValue="emit('update:modelValue', $event)" 
      align-center 
      destroy-on-close 
      :close-on-click-modal="false"
      @open="onOpen" 
      @closed="onClosed"
      draggable
    >
      <el-scrollbar class="container-scrollbar">
        <div class="container">
          <div class="header">
            <div class="title">
              <span class="text">{{ $t('SubFieldVisibleDialog.ifCurrField') }}</span>
              <span class="tag">{{ widget.title }}</span>
            </div>
            <div class="add-condition-button">
              <el-button type="primary" @click="handleAddRule" link>
                <el-icon style="margin-right: 4px"><i-ep-plus /></el-icon>
                {{ $t('SubFieldVisibleDialog.addRule') }}
              </el-button>
            </div>
          </div>

          <div class="rule-wrapper">
            <div class="rule-item" v-for="rule in rules" :key="rule.id">
              <div class="condition-rules" :class="{ 'disabled': !rule.conditions[0].uid }">
                <el-select v-model="rule.conditions[0].func"
                  :disabled="!rule.conditions[0].uid" @change="handleChangeRuleFunc(rule)">
                  <template #suffix>
                    <el-icon :size="16"><i-ep-caret-bottom /></el-icon>
                  </template>
                  <el-option v-for="value, key in getConditionRules(rule.conditions[0].uid)" :key="key"
                    :label="getFuncTextLabel(key, rule.conditions[0].uid)" :value="key" />
                </el-select>
              </div>
              <div class="target-value-wrapper">
                <form-filter-value-format
                  :disabled="[RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(rule.conditions[0].func) || !rule.conditions[0].uid"
                  class="custom-input"
                  v-model="rule.conditions[0].value"
                  :element="getSubForm().getChildElement(rule.conditions[0].uid?.split('.')?.[1])"
                  :otherTableFieldUID="getSubForm().tableUID"
                  :selectElementUid="rule.conditions[0].uid?.split('.')?.[1]"
                  :type="getSubForm().getChildElement(rule.conditions[0].uid?.split('.')?.[1])?.getConfigurations().editFuncInfo[rule.conditions[0].func]"
                  :placeholder="$t('SubFieldVisibleDialog.plsInput')"
                  :widget="widget"
                />
              </div>
              <div class="visible-type-select-wrapper">
                <el-select v-model="rule.visibleType" :suffix-icon="CaretBottom">
                  <el-option :label="$t('SubFieldVisibleDialog.show')+''" :value="VisibleType.SHOW" />
                  <el-option :label="$t('SubFieldVisibleDialog.hide')+''" :value="VisibleType.HIDE" />
                </el-select>
              </div>
              <div class="show-fields-wrapper">
                <field-select
                  v-model="rule.widgetIds"
                  :options="fieldDisplayOptions"
                  multiple
                  value-key="value" 
                  :placeholder="$t('SubFieldVisibleDialog.plsSelectField')" 
                  popper-class="field-display-select" 
                  collapse-tags
                  collapse-tags-tooltip
                  :max-collapse-tags="1"
                />
              </div>
              <div :class="['delete']">
                <el-icon :size="16" @click="handleRemoveRule(rule)">
                  <i-ep-delete />
                </el-icon>
              </div>
            </div>
          </div>
        </div>
      </el-scrollbar>

      <template #footer>
        <el-button class="cancel" type="default" @click="emit('update:modelValue', false)">{{ $t('SubFieldVisibleDialog.cancel') }}</el-button>
        <el-button class="confirm" type="primary" @click="handleConfirm">{{ $t('SubFieldVisibleDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { RuleFunc, RuleFuncTextMapping, RuleFuncValue } from '@common/types/nocode';
import { unique } from '@common/utils/unique';
import { FormVisibleRule, LogicalOperator, VisibleType } from '@renderer/b2/types';
import { AbstractSubForm, FormElement } from '@renderer/b2/controllers/form';
import { deepClone, isEmpty } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { computed, ref } from 'vue';
import { CaretBottom } from "@element-plus/icons-vue";


const props = defineProps<{
  modelValue: boolean;
  value?: FormVisibleRule[];
  widget: FormElement;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: FormVisibleRule[]): void;
}>();

const rules = ref<FormVisibleRule[]>([]);

const isSubForm = (widget: any) => {
  return widget instanceof AbstractSubForm;
}

const getSubForm = () => {
  if (isSubForm(props.widget)) {
    return props.widget;
  }
  return props.widget.form as AbstractSubForm;
}

const handleRemoveRule = (rule: FormVisibleRule) => {
  rules.value = rules.value.filter((c) => c.id !== rule.id);
}

const getConditionRules = (uid: string) => {
  const element = uid.split(".").length > 1 ? getSubForm().getChildElement(uid.split(".")[1]) : getSubForm().getChildElement(uid);
  if (!element) return {
    [RuleFunc.EQUAL]: RuleFuncValue.STRING,
  };
  const { editFuncInfo } = element.getConfigurations();
  // 开关显隐时只有开启关闭
  if (element.getSoul().type === "widget.form.switch") {
    return {
      [RuleFunc.TRUE]: RuleFuncValue.NULL,
      [RuleFunc.FALSE]: RuleFuncValue.NULL,
    }
  }
  return editFuncInfo || {};
}

const getFuncTextLabel = (key, uid) => {
  const element = getSubForm().getChildElement(uid.split(".")[1]);
  if (element?.getConfigurations()?.editFuncInfoText?.[key]) {
    return element?.getConfigurations()?.editFuncInfoText?.[key];
  }
  return RuleFuncTextMapping[key];
}

const fieldDisplayOptions = computed(() => {
  const children = getSubForm().children as FormElement[];
  return children.filter(e => e.uid !== props.widget.uid).map(field => {
    return {
      label: field.title,
      value: field.uid,
    };
  });
})

const hasConditionValue = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every(item => hasConditionValue(item));
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  return value !== null && value !== undefined;
}

const checkFormData = () => {
  for (const rule of rules.value) {
    const { logic, conditions, widgetIds } = rule;
    if (!logic || !conditions.length || !widgetIds.length) {
      return false;
    }
    for (const condition of conditions) {
      if (condition.func && !hasConditionValue(condition.value) && ![RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(condition.func)) {
        return false;
      }
    }
  }
  return true;
}

const handleChangeRuleFunc = (rule) => {
  const funcs = funcOption(rule.conditions[0].uid);
  const type = !isEmpty(funcs) ? funcs[rule.conditions[0].func] : RuleFuncValue.STRING
  if ([RuleFuncValue.SELECT_MULTIPLE, RuleFuncValue.RANGE, RuleFuncValue.TAGS].includes(type)) {
    rule.conditions[0].value = [];
  } else if (type === RuleFuncValue.NULL) {
    rule.conditions[0].value = null;
  } else {
    rule.conditions[0].value = null;
  }
}

const funcOption = (uid) => {
  return getSubForm().getChildElement(uid.split(".")[1])?.getConfigurations().editFuncInfo
}

const isShingWan = () => {
  // 子表单所有的显示隐藏规则
  const allSubFieldsVisibleRules = props.widget.form.getOption("sub-fields-visible") as FormVisibleRule[];
  if (isEmpty(allSubFieldsVisibleRules) || !Array.isArray(allSubFieldsVisibleRules)) {
    return false;
  }

  // 设置过显隐规则的字段的set集合
  const visibleSubFieldsMap = new Map<string, Set<string>>();
  allSubFieldsVisibleRules.forEach(item => {
    if (isEmpty(item.conditions) || isEmpty(item.widgetIds)) {
      return;
    }
    const { conditions, widgetIds } = item;
    const originWidgetId = conditions?.[0].uid?.split('.')?.[1] || conditions?.[0].uid;
    const currentWidgetIds = visibleSubFieldsMap.get(originWidgetId) || new Set<string>();
    widgetIds.forEach(widgetId => currentWidgetIds.add(widgetId));
    visibleSubFieldsMap.set(originWidgetId, currentWidgetIds);
  })
  if (visibleSubFieldsMap.size === 0) {
    return false;
  }

  // 添加新增规则
  for (const rule of rules.value) {
    const { widgetIds, conditions } = rule;
    if (isEmpty(conditions) || isEmpty(widgetIds)) {
      return false;
    }
    const currentWidgetIds = visibleSubFieldsMap.get(props.widget.uid) || new Set<string>();
    widgetIds.forEach(widgetId => currentWidgetIds.add(widgetId));
    visibleSubFieldsMap.set(props.widget.uid, currentWidgetIds);
  }

  const check = (widgetId: string) => {
    const visited = new Set<string>();
    const _check = (value: string) => {
      if (!visibleSubFieldsMap.has(value)) {
        return false;
      }
      if (visited.has(value)) {
        return true;
      }
      visited.add(value);

      const visibleSubWidgetIdsSet = visibleSubFieldsMap.get(value);
      for (const widgetId of visibleSubWidgetIdsSet) {
        if (_check(widgetId)) {
          return true;
        }
      }
      return false;
    }
    return _check(widgetId);
  }

  return check(props.widget.uid);
}

const handleConfirm = () => {
  if (!checkFormData()) {
    ElMessage.warning(i18next.t('SubFieldVisibleDialog.plsSetFullCondition'));
    return;
  }
  if (isShingWan()) {
    ElMessage.warning(i18next.t('SubFieldVisibleDialog.shingWanWarning'));
    return
  } 
  emit("update", deepClone(rules.value));
  emit("update:modelValue", false);
};

const handleAddRule = (option?) => {
  const funcs = getConditionRules(props.widget.uid)
  const type = !isEmpty(funcs) ? funcs[props.widget.uid ? (Object.keys(funcs)[0]) as RuleFunc : RuleFunc.EQUAL] : RuleFuncValue.STRING
  rules.value.push({
    id: unique(),
    logic: LogicalOperator.AND,
    conditions: [{
      uid: `${props.widget.form.uid}.${props.widget.uid}`,
      func: (Object.keys(funcs)[0]) as RuleFunc || RuleFunc.EQUAL,
      value: type === RuleFuncValue.NULL ? "Null" : null,
    }],
    widgetIds: [],
    visibleType: VisibleType.SHOW,
  })
}

const onOpen = () => {
  if (!isEmpty(props.value)) {
    rules.value = deepClone(props.value);
  } else {
    handleAddRule();
  }
}

const onClosed = () => {
  rules.value = [];
}
</script>

<style lang='scss' scoped>
.sub-field-visible-rule-container {
  @mixin diy-select {
    width: max-content;
    min-width: 60px;
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

      .el-select__placeholder {
        position: unset;
        transform: unset;
      }

      .el-select__input-wrapper {
        display: none;
      }
    }
  }

  :deep(.sub-field-visible-dialog) {
    height: 640px;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--bg-color-page);
    --dialog-header-height: 40px;
    --dialog-footer-height: 80px;
    
    .el-dialog__header {
      height: var(--dialog-header-height);
      display: flex;
      justify-content: center;
      align-items: center;
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
      padding: 8px;

      .container-scrollbar {
        .el-scrollbar__view {
          padding: 8px 16px;
        }

        .container {
          display: flex;
          flex-direction: column;
          row-gap: 16px;
          
          .header {
            height: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;

            .title {
              display: flex;
              column-gap: 16px;
              align-items: center;

              .text {
                color: var(--color-black);
              }

              .tag {
                line-height: 24px;
                padding: 4px;
                border-radius: 4px;
                background-color: var(--bg-color-overlay);
              }
            }
          }

          .rule-wrapper {
            display: flex;
            flex-direction: column;
            row-gap: 8px;

            .rule-item {
              display: flex;
              align-items: center;
              height: 32px;
              column-gap: 8px;
              
              .condition-rules {
                width: 92px;
                .el-select {
                  @include diy-select;
                }
              }

              .target-value-wrapper {
                width: 200px;
                .el-select {
                  @include diy-select;
                }
                .el-input {
                  width: 200px;
                }
              }

              .visible-type-select-wrapper {
                width: 60px;
                .el-select {
                  @include diy-select;
                }
              }

              .show-fields-wrapper {
                flex: 1;
              }

              .delete {
                display: flex;
                align-items: center;

                &.disabled {
                  pointer-events: none;
                  opacity: 0.6
                }

                .el-icon {
                  cursor: pointer;

                  &:hover {
                    color: var(--color-danger);
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
      padding: 0 24px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: end;
      align-items: center;


      .el-button {
        border-radius: 4px;
      }
    }
  }
}
</style>
