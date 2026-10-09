<template>
  <div class="auto-counting-container">
    <el-dialog :modelValue="isVisible" @update:modelValue="emit('update:modelValue', $event)" @open="onOpen" width="680"
      :title="$t('SerialNumberRulesDialog.serialRule')" :align-center="true" destroy-on-close :close-on-click-modal="false" ref="dialogRef">
      <div class="container">
        <div class="preview-value" ><span>{{ previewValue }}</span></div>
        <draggable v-model="ruleOptions" item-key="id"
          handle=".move" chosen-class="dragging"
          :component-data="{ class: 'tabs-content' }" animation="500" delay="60">
          <template #item="{ element, index }">
          <div :key="element.id" ref="dragRef" class="rule-option-item"
            @click.stop.prevent>
            <span>{{ labels[element.type] }}</span>

            <el-input class="counting-rule-input" v-if="element.type === 'counting'" v-model="countingRuleSketch" @click="editCountingRule"
              :placeholder="$t('SerialNumberRulesDialog.searchField')" readonly
            >
              <template #suffix>
                <div class="edit-wrapper" @click="editCountingRule">
                  <!-- <el-icon :size="16"><i-ven-icon-edit /></el-icon> -->
                  <el-icon :size="16"><i-ep-edit /></el-icon>
                </div>
              </template>
            </el-input>

            <el-select v-else-if="element.type === 'date'" v-model="element.value.optionalFormat"
              placeholder="Select" popper-class="rule-select-popper" :show-arrow="false" :offset="-2"
            >
              <template #label="{ label, value }">
                <span v-if="value !=='custom'"> {{ label }} </span>
                <el-input v-else class="custom-date-format-input" v-model="element.value.customFormat" @click.stop :placeholder="$t('SerialNumberRulesDialog.inputCustomFormat')" />
              </template>
              <el-option
                v-for="item in dateFormats"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>

            <el-select v-else-if="element.type === 'field'" v-model="element.value"
              :placeholder="$t('SerialNumberRulesDialog.selectField')" popper-class="rule-select-popper"  :show-arrow="false" :offset="-2"
            >
              <template #header>
                <el-input v-model="keySearchFields"
                  :placeholder="$t('SerialNumberRulesDialog.searchKeyword')"
                >
                  <template #prefix>
                    <el-icon class="el-input__icon"><search /></el-icon>
                  </template>
                </el-input>
              </template>
              <el-option
                v-for="item in filterFields(fields)"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>

            <el-input v-else-if="element.type === 'prefix'" v-model="element.value"
              :placeholder="$t('SerialNumberRulesDialog.inputFixedChar')" />

            <div class="icons">
              <!-- <el-icon class="operate-icon move" :style="{color: isDragging ? '#ccc !important' : '#999'}" :size="16"><i-ven-icon-widget-form-serial-number-drag /></el-icon> -->
              <el-icon class="operate-icon move" :style="{color: isDragging ? '#ccc !important' : '#999'}" :size="16"><i-table-drag /></el-icon>
              <el-icon v-if="element.type !== 'counting'" class="operate-icon delete" :size="16" @click.stop.prevent="removeOption(index)"><Delete /></el-icon>
            </div>
          </div>
          </template>
        </draggable>
        <el-dropdown>
          <el-button class="btn-add" type="primary" link :icon="Plus">{{ $t('SerialNumberRulesDialog.add') }}</el-button>
          <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="ruleOption in addRuleMenu" @click="addRule(ruleOption.type)"
                :disabled="ruleOption.type === 'date' && ruleOptions.some(item => item.type === ruleOption.type)"
                >{{ ruleOption.label }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
        </el-dropdown>
      </div>
      <template #footer>
        <div class="footer">
          <el-button class="cancel" type="default" @click="dialogClosed">{{ $t('SerialNumberRulesDialog.cancel') }}</el-button>
          <el-button class="confirm" type="primary" @click="confirm">{{ $t('SerialNumberRulesDialog.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>

    <auto-counting-dialog v-model="isAutoCountingDialogVisible" :value="ruleOptions?.find(rule => rule.type === 'counting')?.value" @update="handleConfirm"/>
  </div>
</template>

<script lang="ts" setup>
import draggable from "vuedraggable";
import { ref, computed, watch } from "vue";
import { AbstractFormLayout, FormElement } from '@renderer/b2/controllers/form';
import { CountingRuleValue, resetCycleOptions, SerialNumberRule, SelectOption, SerialNumberRuleType } from "../../types";
import { Search, Plus, Delete } from '@element-plus/icons-vue'
import { deepClone } from "@common/utils/object";
import { unique } from "@common/utils/unique"
import { formatSerialNumber } from "../../utils";
import { ExcelFieldItem } from "@common/types/excel";
import i18next from "i18next";

const props = defineProps<{
  modelValue: boolean;
  value?: SerialNumberRule[];
  widget?: FormElement;
  serialNumberFormField?: ExcelFieldItem[];
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: SerialNumberRule[]): void;
}>();

const isVisible = computed(() => {
  return props.modelValue;
});

const previewValue = computed(() => {
  return i18next.t('SerialNumberRulesDialog.serialPreview') + formatSerialNumber(Number(ruleOptions.value?.find(rule => rule.type === 'counting')?.value.startValue ?? 0), ruleOptions.value, props.widget)
});

const countingRuleSketch = computed(() => {
  const countingRule = ruleOptions.value?.find(rule => rule.type === "counting");
  if (countingRule) {
    const { digitLength, digitFixed, resetCycle, startValue } = countingRule.value;
    const resetCycleText = resetCycleOptions.find(option => option.value === resetCycle)?.label;
    return `${digitLength}${i18next.t('SerialNumberRulesDialog.digitCount')}${ resetCycleText && '，' + resetCycleText}，${digitFixed ? '' : i18next.t('SerialNumberRulesDialog.no')}${i18next.t('SerialNumberRulesDialog.fixedDigitInit')}${startValue}`;
  }
});


const ruleOptions = ref<SerialNumberRule[]>([]);
const ruleOptionsWithDrag = ref<SerialNumberRule[]>([]);
const dialogRef = ref();
const isDragging = ref(false);
const labels = ref<Record<SerialNumberRuleType, string>>({
  get counting() { return i18next.t('SerialNumberRulesDialog.autoCount') },
  get date() { return i18next.t('SerialNumberRulesDialog.submitDate') },
  get field() { return i18next.t('SerialNumberRulesDialog.formField') },
  get prefix() { return i18next.t('SerialNumberRulesDialog.fixedChar') },
});
const dateFormats:SelectOption[] = [
  {
    value: 'YYYY',
    label: 'YYYY',
  },
  {
    value: 'YYYYMM',
    label: 'YYYYMM',
  },
  {
    value: 'YYYY-MM',
    label: 'YYYY-MM',
  },
  {
    value: 'YYYY/MM',
    label: 'YYYY/MM',
  },
  {
    value: 'YYYYMMDD',
    label: 'YYYYMMDD',
  },
  {
    value: 'YYYY-MM-DD',
    label: 'YYYY-MM-DD',
  },
  {
    value: 'YYYY/MM/DD',
    label: 'YYYY/MM/DD',
  },
  {
    value: 'custom',
    get label() { return i18next.t('SerialNumberRulesDialog.custom') },
  },
]
const fields = ref<SelectOption[]>([]);
const keySearchFields = ref("");
const isSubFormSerialNumber = computed(() => !!props.widget?.isInSubForm);
const addRuleMenu = computed<{ label: string, type: SerialNumberRuleType }[]>(() => {
  return Object.keys(labels.value)
    .filter((key) => key !== "counting")
    .filter((key) => !(isSubFormSerialNumber.value && key === "field"))
    .map((key: SerialNumberRuleType) => {
      return {
        label: labels.value[key],
        type: key,
      };
    });
});
const isAutoCountingDialogVisible = ref(false);

const filterFields = (fields: SelectOption[]) => {
  return fields.filter((field) => field.label.toLowerCase().includes(keySearchFields.value.toLowerCase()));
}

const getFieldLabel = (formElement: FormElement) => {
  const titles = [formElement.title];
  let parent = formElement.parent as any;

  while (parent && parent !== formElement.form) {
    if ((parent instanceof FormElement || parent instanceof AbstractFormLayout) && parent.title) {
      titles.unshift(parent.title);
    }
    parent = parent.parent;
  }

  return titles.join('.');
}

const notSelectableTypes = [
  'widget.form.multipleTabs',
  'widget.form.tabPanel',
];

const getSelectableFormFields = (widget: FormElement): SelectOption[] => {
  return (widget.form?.container?.getChildWidgets(true) ?? [])
    .filter((child): child is FormElement => {
      return child instanceof FormElement
        && child.uid !== widget.uid
        && !child.isInSubForm
        && !notSelectableTypes.includes(child.type)
        && (!!child.fieldId || child.isCreateField());
    })
    .map(formElement => {
      return {
        label: getFieldLabel(formElement),
        value: formElement.uid,
      };
    });
}

const addRule = (key: SerialNumberRuleType) => {
  if (isSubFormSerialNumber.value && key === "field") return;
  if (key === 'counting' || key === 'date' && ruleOptions.value.some(rule => rule.type === key)) return;

  switch (key) {
    case 'date':
      ruleOptions.value.push({
        id: unique(),
        type: 'date',
        value: {
          optionalFormat: 'YYYY',
          customFormat: ''
        },
      })
      break;
    default:
      ruleOptions.value.push({
        id: unique(),
        type: key,
        value: '',
      });
  }
}

const removeOption = (index: number) => {
  ruleOptions.value.splice(index, 1);
};

const editCountingRule = () => {
  isAutoCountingDialogVisible.value = true;
}

const handleConfirm = (value: CountingRuleValue) => {
  const countingRule = ruleOptions.value.find(rule => rule.type === 'counting');
  if (countingRule) {
    countingRule.value = value;
  }
}

const preloadFieldDisplaySources = async () => {
  if (!props.widget) return;

  const fieldRules = (ruleOptions.value || []).filter(rule => rule.type === "field");
  const targetWidgets = fieldRules
    .map(rule => props.widget.form.getChildElement(rule.value as string))
    .filter(Boolean) as any[];

  await Promise.all(targetWidgets.map(async (targetWidget) => {
    if (targetWidget.type === "widget.form.memberSelect" && !targetWidget.allUserList?.length) {
      targetWidget.allUserList = await targetWidget.getBoard().getOrganizeUsers();
    }

    if (targetWidget.type === "widget.form.departmentSelect" && !targetWidget.allDepartmentsList?.length) {
      targetWidget.allDepartmentsList = await targetWidget.getBoard().getOrganizeDepartments();
    }
  }));
}

const onOpen = async () => {
  keySearchFields.value = "";

  if(!props.value) {
    // 添加默认的计数规则
    ruleOptions.value = [{
      id: unique(),
      type: "counting",
      value: {
        digitFixed: false,
        digitLength: 5,
        resetCycle: "none",
        startValue: 0,
      }
    }];
  } else {
    ruleOptions.value = deepClone(props.value ?? []);
  }
  ruleOptionsWithDrag.value = deepClone(ruleOptions.value);
  
  if(props.widget) {
    fields.value = getSelectableFormFields(props.widget);
    await preloadFieldDisplaySources();
  } else if(props.serialNumberFormField) {
    fields.value = props.serialNumberFormField.map(field => {
      return {
        label: field.formFieldTitle,
        value: field.uid,
      }
    })
  }
}

watch(() => {
  return ruleOptions.value
    .filter(rule => rule.type === "field")
    .map(rule => rule.value)
    .join(",");
}, () => {
  void preloadFieldDisplaySources();
});

const dialogClosed = () => {
  emit("update:modelValue", false);
};

const confirm = () => {
  emit("update", ruleOptions.value);
  dialogClosed();
}
</script>

<style lang="scss" scoped>
.auto-counting-container {
  :deep(.el-dialog) {
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--color-white);
    border-radius: 4px;

    .el-dialog__header {
      height: 40px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;

      span {
        font-size: 14px;
      }
    }

    .el-dialog__footer {
      padding: 16px;
    }
  }
}

:deep(.el-select__wrapper), :deep(.el-input__wrapper) {
  border-radius: 4px;
}

.container {
  padding: 24px 16px;

  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background-color: #555355;
  }

  ::-webkit-scrollbar-corner {
    background: transparent
  }

  .preview-value {
    display: flex;
    background: var(--el-bg-color-overlay);
    color: var(--el-text-color-primary);
    border-radius: 2px;
    padding: 4px 8px;
    line-height: 28px;
    margin-bottom: 16px;

    span {
      overflow: hidden;
      text-align: center;
      width: 100%;
    }
  }

  .rule-option-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;

    .el-input, .el-select {
      flex: 1;
    }

    .icons {
      width: 56px;
      display: flex;
      align-items: center;
      gap: 16px;

      .el-icon {
        cursor: var(--cursor-pointer);
      }
      
      .move {
        cursor: move;
      }
    }

    .counting-rule-input :deep(.el-input__inner),
    :deep(.el-select__input),
    :deep(.el-select__wrapper),
    :deep(.el-select__wrapper) .el-select__caret {
      cursor: var(--cursor-pointer);
    }

    .counting-rule-input {
      :deep(.el-input__wrapper) {
        padding: 1px 0;

        input {
          padding: 0 11px;
        }

        .el-input__suffix {
          cursor: var(--cursor-pointer);
          pointer-events: all;

          .edit-wrapper {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            padding-right: 11px;
            margin-left: 0;
            padding: 8px;
          }
        }
      }
    }

    .custom-date-format-input {
      :deep() {
        .el-input__wrapper {
          padding: 0;
          box-shadow: none;

          .el-input__inner {
            cursor: var(--cursor-pointer);
          }
        }
      }
    }
  }

  .btn-add {
    line-height: 20px;
  }
}
</style>
<style lang="scss">
  .rule-select-popper {
    background-color: var(--color-white);
    border: 1px solid #0000001A;
    box-shadow: 0px 6px 16px 0px #00000014;

    .el-select-dropdown__header {
      border-bottom: none;
      padding: 4px;

      .el-input {
        height: 24px;

        .el-input__wrapper {
          background-color: var(--bg-color-overlay);
        }

        .el-input__prefix-inner {
          color: var(--text-color-regular);
        }
      }
    }

    .el-select-dropdown__item.is-hovering {
      background-color: var(--bg-color-overlay);
    }
  }
</style>
