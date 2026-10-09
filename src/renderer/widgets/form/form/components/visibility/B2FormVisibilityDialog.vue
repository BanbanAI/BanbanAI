<template>
  <div class="fields-visibility-rule-container">
    <el-dialog class="form-visibility-dialog" :modelValue="modelValue" :title="$t('visibilityRuleTitle')" width="680"
      @update:modelValue="emit('update:modelValue', $event)" align-center destroy-on-close :close-on-click-modal="false"
      @open="onOpen">
      <el-scrollbar class="container-scrollbar">
        <div class="container">
          <div class="condition-manager">
            <div class="satisfy-conditions">
              <div class="satisfy-conditions-tip">{{ $t('ifCurrentFieldMatch') }}</div>
              <el-select class="satisfy-conditions-select" v-model="rule.logic" :suffix-icon="CaretBottom">
                <el-option v-for="item in logicalOperator" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
              <div class="satisfy-conditions-tip">{{ $t('conditionSuffix') }}</div>
              <div class="add-condition-button">
                <!-- <field-selector :options="selectorOptions" @select="handleAddCondition" /> -->
                <el-button type="primary" link @click="handleAddCondition()">
                  <el-icon :size="16" style="margin-right: 4px">
                    <Plus />
                  </el-icon>
                  {{ $t('addCondition') }}
                </el-button>
              </div>
            </div>

            <div class="condition-wrapper">
              <div class="condition" v-for="(condition, index) in rule.conditions">
                <div class="condition-field">
                  <span v-if="index == 0">{{ $t('currentFormField') }}</span>
                  <el-select v-model="condition.uid" filterable :placeholder="$t('plsSelectField')" @change="handleCurrentFieldChange(condition)">
                    <el-option
                      v-for="item in addConditionOptions"
                      :key="item.uid"
                      :label="item.title"
                      :value="item.uid"
                      :data="item"
                    />
                    <template #label="{ label, value }">
                      <span v-if="!!addConditionOptions.find(item => item.uid == value)">{{ label }}</span>
                      <span v-else style="color: #FF4D4F;">
                        {{ $t('fieldDeleted') }}
                      </span>
                    </template>
                  </el-select>
                </div>
                <div class="condition-rules" :class="{ 'disabled': !condition.uid }">
                  <el-select
                    v-model="condition.func"
                    :suffix-icon="CaretBottom"
                    :disabled="!condition.uid"
                    @change="handleConditionFuncChange(condition)"
                    v-if="addConditionOptions.find(item => item.uid == condition.uid)"
                  >
                    <el-option
                      v-for="value, key in getConditionRules(condition.uid)"
                      :key="key"
                      :label="getFuncTextLabel(key, condition.uid)"
                      :value="key"
                    />
                  </el-select>
                  <el-select
                    v-else
                    :disabled="true"
                    class="disabled-select"
                    placeholder=""
                  />
                </div>
                <div class="condition-value">
                  <span v-if="index == 0">{{ i18next.t('fieldValue') }}</span>
                  <form-filter-value-format :disabled="[RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(condition.func) || !condition.uid" class="custom-input" v-model="condition.value" :element="getForm().getChildElement(condition.uid)" :otherTableFieldUID="getForm().tableUID" :selectElementUid="condition.uid" :type="getForm().getChildElement(condition.uid)?.getConfigurations().editFuncInfo[condition.func]" :placeholder="i18next.t('plsInput')" :widget="widget" />
                </div>
                <div class="delete">
                  <el-icon :zie="16" @click="removeCondition(index)">
                    <Delete />
                  </el-icon>
                </div>
              </div>
            </div>
          </div>

          <div class="filed-visibility">
            <div class="field-visibility-label">
              <el-select v-model="rule.visibleType" size="small">
                <el-option :label="i18next.t('show')" :value="VisibleType.SHOW" />
                <el-option :label="i18next.t('hide')" :value="VisibleType.HIDE" />
              </el-select>
              {{ i18next.t('followingFields') }}
            </div>
            <div class="field-value">
              <field-select
                v-model="rule.widgetIds"
                :options="fieldDisplayOptions"
                multiple
                value-key="value"
                :placeholder="i18next.t('plsAddConditionFirst')"
                filterable
              />
            </div>
          </div>
        </div>
      </el-scrollbar>

      <template #footer>
        <el-button class="cancel" type="default" @click="emit('update:modelValue', false)">{{ i18next.t('cancel') }}</el-button>
        <el-button class="confirm" type="primary" @click="handleConfirm">{{ i18next.t('confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, computed, reactive } from "vue";
import { CaretBottom, Delete, Plus } from "@element-plus/icons-vue";
import { Form } from "../../form";
import { FormCondition, RuleFunc, RuleFuncTextMapping, RuleFuncValue } from "@common/types/nocode";
import { unique } from "@common/utils/unique";
import { FormVisibleRule, LogicalOperator, VisibleType } from "@renderer/b2/types";
import { AbstractForm, FormElement } from "@renderer/b2/controllers/form";
import { deepClone, isEmpty } from "@common/utils/object";
import { ElMessage } from "element-plus";
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  modelValue: boolean;
  rule?: FormVisibleRule;
  widget: Form | FormElement;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "confirm", value: FormVisibleRule): void;
}>();


const rule = ref<FormVisibleRule>({
  id: unique(),
  logic: LogicalOperator.AND,
  conditions: [{
    uid: null,
    func: RuleFunc.EQUAL,
    value: null,
  }],
  widgetIds: [],
  visibleType: VisibleType.SHOW,
});

const logicalOperator = [
  {
    value: LogicalOperator.AND,
    label: i18next.t('allConditions'),
  },
  {
    value: LogicalOperator.OR,
    label: i18next.t('anyCondition'),
  },
];
const addConditionOptions = computed(() => {
  const children = getForm().children as FormElement[];

  // 递归展开，并把 multipleTabs 和 tab 本身也加入结果
  const flattenWidgets = (elements: FormElement[]): FormElement[] => {
    return elements.flatMap(el => {
      if (el.type === 'widget.form.multipleTabs') {
        const tabs = el.widgets;
        const childrenWidgets = flattenWidgets(
          tabs.flatMap((tab: FormElement) => {
            return tab.widgets.map((widget: FormElement) => {
              const uid = widget.uid
              return {
                ...widget,
                uid: uid,
                title: `${el.title}.${tab.title}.${widget.title}`,
              } as FormElement;
            })
          })
        );

        return [...childrenWidgets];
      }

      return el;
    });
  };

  return flattenWidgets(children).filter((c) => {
    return !notAllowSelectTypes.includes(c.type) && c.title.includes(searchValue.value);
  });
});

const getFieldType = (uid: string) => {
  const field = addConditionOptions.value.find(item => item.uid === uid);
  return field?.type || "";
};

const defaultFieldOperatorMap = new Map<string, RuleFunc>([
  // 基础组件
  ['widget.form.textInput', RuleFunc.IN],                // 等于任意一个（∈）
  ['widget.form.textarea', RuleFunc.CONTAIN],            // 包含（⊃）
  ['widget.form.numberInput', RuleFunc.EQUAL],           // 等于（=）
  ['widget.form.amountInput', RuleFunc.EQUAL],           // 等于（=）
  ['widget.form.datePicker', RuleFunc.BETWEEN],          // 选择范围（~）
  ['widget.form.dateRangePicker', RuleFunc.BETWEEN],     // 选择范围（~）
  ['widget.form.timePicker', RuleFunc.BETWEEN],          // 选择范围（~）
  ['widget.form.radioGroup', RuleFunc.IN],               // 等于任意一个（∈）
  ['widget.form.checkboxGroup', RuleFunc.CONTAIN_ANY],   // 包含任意一个（⊃∃）
  ['widget.form.treeSelect', RuleFunc.IN],               // 等于任意一个（∈）
  ['widget.form.treeMultipleSelect', RuleFunc.CONTAIN_ANY], // 包含任意一个（⊃∃）
  ['widget.form.memberSelect', RuleFunc.IN],             // 等于任意一个（∈）
  ['widget.form.departmentSelect', RuleFunc.IN],         // 等于任意一个（∈）
  ['widget.form.switch', RuleFunc.EQUAL],                // 等于（=）
  ['widget.form.rate', RuleFunc.GTE],                    // 大于等于（≥）

  // 高级组件
  ['widget.form.image-uploader', RuleFunc.EMPTY],        // 为空/不为空（∅/!∅）默认可为 ∅，也可配合规则筛选
  ['widget.form.file-uploader', RuleFunc.EMPTY],
  ['widget.form.uploader', RuleFunc.EMPTY],
  ['widget.form.address', RuleFunc.IN],                  // 属于 ≈ 等于任意一个（∈）
  ['widget.form.position', RuleFunc.IN],
  ['widget.form.phoneInput', RuleFunc.IN],               // 等于任意一个（∈）

  // 关联组件
  // ['widget.form.relatedData', RuleFunc.EQUAL],
]);

const isForm = (widget: any) => {
  return widget instanceof AbstractForm;
}

const getForm = () => {
  if (isForm(props.widget)) {
    return props.widget;
  }
  return props.widget.form as AbstractForm;
}


const getConditionRules = (uid: string) => {
  const element = getForm().getChildElement(uid);
  if (!element) return {
    [RuleFunc.EQUAL]: RuleFuncValue.STRING,
  };
  const { editFuncInfo } = element?.getConfigurations();
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
  const element = getForm().getChildElement(uid);
  if (element?.getConfigurations()?.editFuncInfoText?.[key]) {
    return element?.getConfigurations()?.editFuncInfoText?.[key];
  }
  return RuleFuncTextMapping[key];
}

const handleCurrentFieldChange = (condition: FormCondition) => {
  const rules = getConditionRules(condition.uid);
  condition.func = isEmpty(rules) ? RuleFunc.EQUAL : (Object.keys(rules)[0]) as RuleFunc;
  handleConditionFuncChange(condition)
}
const handleConditionFuncChange = (condition: FormCondition) => {
  const funcs = funcOption(condition.uid);
  const type = !isEmpty(funcs) ? funcs[condition.func] : 'string' as RuleFuncValue;
  if ([RuleFuncValue.SELECT_MULTIPLE, RuleFuncValue.RANGE, RuleFuncValue.TAGS].includes(type)) {
    condition.value = [];
  } else if (type === RuleFuncValue.NULL) {
    condition.value = "Null";
  } else {
    condition.value = "";
  }
}
const funcOption = (uid) => {
  return getForm().getChildElement(uid)?.getConfigurations().editFuncInfo
}

const searchValue = ref("");
const notAllowSelectTypes = ["widget.form.subform", "widget.form.selectData", "widget.form.relatedData", "widget.form.richTextEditor", "widget.form.markdownEditor", "widget.form.splitLine", "widget.form.file-uploader", "widget.form.image-uploader", "widget.form.titleBar", "widget.form.imageTextShow"];
const selectorOptions = computed(() => {
  return (props.widget.children as FormElement[]).filter(field => {
    return !notAllowSelectTypes.includes(field.type);
  }).map(item => {
    return {
      label: item.title,
      value: item.uid,
    }
  })
});
const fieldDisplayOptions = computed(() => {
  const children = getForm().children as FormElement[]
  // 递归展开 multipleTabs 的 widgets
  const flattenWidgets = (elements: FormElement[]): FormElement[] => {
    return elements.flatMap(el => {
      if (el.type === 'widget.form.multipleTabs') {
        const tabs = el.widgets.map((tab: FormElement) => {
          const uid = tab.uid
          return {
            ...tab,
            uid: uid,
            title: `${el.title}.${tab.title}`,
          } as FormElement
        })
        // 展开每个 tab 下的 widgets
        const childrenWidgets = flattenWidgets(el.widgets.flatMap((tab: FormElement) => {
          return tab.widgets.map((w: FormElement) => {
            const uid = w.uid;
            return {
              ...tab,
              uid: uid,
              title: `${el.title}.${tab.title}.${w.title}`,
            } as FormElement
          })
        }))
        return [el, ...tabs, ...childrenWidgets]
      }
      return el
    })
  }

  return flattenWidgets(children).map(field => {
    const disabled = rule.value.conditions.some(c => c.uid === field.uid) || field.isHidden;
    return {
      label: field.title,
      value: field.uid,
      disabled,
    };
  })
});

const checkFormData = () => {
  const { logic, conditions, widgetIds } = rule.value;
  if (!logic || !conditions.length || !widgetIds.length) {
    return false;
  }
  for (const condition of conditions) {
    if (![RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(condition.func) && condition.func && !condition.value) {
      return false;
    }
  }
  return true;
}

const handleConfirm = () => {
  if (!checkFormData()) {
    ElMessage.warning(i18next.t('plsCompleteCondition'));
    return;
  }
  emit("confirm", deepClone(rule.value));
  emit("update:modelValue", false);
};

const attachWatcher = (condition: FormCondition) => {
  watch(
    () => condition.uid,
    (newVal, oldVal) => {
      if (newVal !== oldVal && !!newVal) {
        const selectedOption = addConditionOptions.value.find(item => item.uid === newVal);
        const fieldType = selectedOption?.type;
        // TODO 根据类型设置默认值
        condition.func = RuleFunc.EQUAL //defaultFieldOperatorMap.get(fieldType);
      }
    },
    { immediate: true }
  );
};

const handleAddCondition = (option?) => {
  const newCondition = reactive<FormCondition>({
    uid: option?.value,
    func: RuleFunc.EQUAL, //defaultFieldOperatorMap.get(field.type),
    value: null,
  });
  rule.value.conditions.push(newCondition);
  attachWatcher(newCondition);
};

const removeCondition = (index: number) => {
  rule.value.conditions.splice(index, 1);
};

const onOpen = () => {
  if (props.rule) {
    rule.value = deepClone(props.rule);
  } else {
    rule.value = {
      id: unique(),
      logic: LogicalOperator.AND,
      conditions: [{
        uid: null,
        func: RuleFunc.EQUAL,
        value: null,
      }],
      widgetIds: [],
      visibleType: VisibleType.SHOW,
    }
  }
}


</script>

<style lang="scss" scoped>
.fields-visibility-rule-container {

  @mixin diy-select {
    width: max-content;
    min-width: 60px;
    max-width: 100%;
    border-radius: 4px;
    background-color: var(--bg-color-overlay);

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

  :deep(.form-visibility-dialog) {
    height: 580px;
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
      padding: 16px;

      .container-scrollbar {

        .container {
          display: flex;
          flex-direction: column;
          row-gap: 32px;

          .condition-manager {
            display: flex;
            flex-direction: column;
            row-gap: 16px;

            .satisfy-conditions {
              display: flex;
              flex-direction: row;
              height: 30px;
              align-items: center;

              .satisfy-conditions-tip {
                font-size: 14px;
                color: var(--text-color-regular);
                margin-right: 10px;
              }

              .satisfy-conditions-select {
                width: 72px;
                height: 30px;
                margin-right: 12px;
                font-size: 14px;
                @include diy-select;
              }

              .add-condition-button {
                margin-left: auto;
              }
            }

            .condition-wrapper {
              display: flex;
              flex-direction: column;
              row-gap: 16px;

              .condition {
                display: flex;
                align-items: end;
                column-gap: 8px;

                .condition-field {
                  width: 148px;
                  display: flex;
                  flex-direction: column;
                  row-gap: 8px;

                  .el-select__wrapper {
                    border-radius: 4px;
                    align-items: center;
                  }
                }

                .condition-rules {
                  width: 120px;
                  height: 32px;
                  font-size: 14px;
                  text-align: center;

                  .el-select {
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

                      .el-select__placeholder {
                        position: unset;
                        transform: unset;
                      }

                      .el-select__input-wrapper {
                        display: none;
                        gap: 4px;

                        .el-select__selected-item {
                          text-overflow: unset;
                          width: max-content;
                        }
                      }
                    }

                  }

                  .disabled-select {
                    .el-select__wrapper {
                      background-color: var(--bg-color-overlay) !important;
                      border-radius: 4px;
                    }
                  }
                }

                .disabled {
                  cursor: not-allowed;

                  .el-select {
                    &:hover {
                      background-color: unset;
                    }
                  }
                }

                .condition-value {
                  display: flex;
                  flex-direction: column;
                  row-gap: 8px;
                  flex: 1;
                  .custom-input {
                    flex: 1;
                    background-color: var(--bg-color-overlay);
                    border-radius: 4px;
                    gap: 4px;
                    display: flex;
                    align-items: center;
                    height: 32px;
                    width: 326px;

                    &:hover {
                      box-shadow: 0 0 0 1px var(--border-color) inset;
                    }

                    &.is-focus {
                      box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
                    }
                    &:has(.is-disabled) {
                      cursor: not-allowed;
                    }

                    .el-select__wrapper, .el-input-tag__wrapper {
                      width: 326px;
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
                    .el-input {
                      height: 32px;
                      width: 100%;
                    }

                    .el-input__wrapper {
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

                .delete {
                  display: flex;
                  align-items: center;
                  height: 32px;

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

          .filed-visibility {
            display: flex;
            flex-direction: column;
            row-gap: 8px;

            .field-visibility-label {
              display: flex;
              align-items: center;
              column-gap: 8px;

              .el-select {
                @include diy-select;
              }
            }

            .field-value {
              .el-select {
                --el-border-radius-base: 4px;
              }
            }
          }
        }
      }

    }

    .el-dialog__footer {
      height: var(--dialog-footer-height);
      padding: 9px 16px;
      border-top: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: end;

      .el-button {
        border-radius: 4px;
      }
    }
  }
}


.add-condition-container {
  max-height: 560px;
  overflow-y: auto;
}
</style>
