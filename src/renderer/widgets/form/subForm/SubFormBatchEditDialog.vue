<template>
  <div class="field-eidt-option-dialog-wrap">
    <el-dialog
      class="field-eidt-option-dialog"
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      @open="onOpen"
      :title="$t('batchEditTitle')"
      align-center
      width="680"
      destroy-on-close
      :close-on-click-modal="false"
      draggable
      append-to-body
    >
      <div class="list-title">
        <div class="switch-mode">
          <div class="switch-child" :class="{'active': fieldMode === FieldMode.Multi}" @click="fieldMode = FieldMode.Multi">{{ $t('multiField') }}</div>
          <div class="switch-child" :class="{'active': fieldMode === FieldMode.Single}" @click="fieldMode = FieldMode.Single">{{ $t('singleField') }}</div>
        </div>
        <el-button class="btn-add-field" type="primary" link @click="handleAddField" v-if="fieldMode === FieldMode.Multi && getFields.length > fieldEditOptions.length">
          <el-icon :size="14"><i-ep-plus /></el-icon>{{ $t('addField') }}
        </el-button>
      </div>
      <div class="list-header">
        <span>{{ $t('fieldsToModify') }}</span>
        <span>{{ $t('batchEdit') }}</span>
      </div>
      <el-scrollbar class="container-scrollbar">
        <el-form class="container" :rules="formRules" :model="fieldEditOptions" ref="formRef">
          <ul class="field-list">
            <li class="field-item" v-for="(fieldEditOption, index) in fieldEditOptions">
              <el-form-item prop="fieldId" :rules="getConditionFormRules(fieldEditOption, 'fieldId')">
                <el-select class="field-select" v-model="fieldEditOption.fieldId" :show-arrow="false" :offset="4"
                  :no-data-text="$t('noField')" :placeholder="$t('plsSelectField')" popper-class="data-filiter-rule-select-popper">
                  <el-option
                    v-for="child in getFields"
                    :key="child.uid"
                    :label="child.title"
                    :value="child.fieldId"
                    :disabled="fieldEditOptions.some(option => option.fieldId === child.fieldId)"
                  />
                </el-select>
              </el-form-item>

              <span style="display: flex; align-items: center;">{{ $t('modifyTo') }}</span>

              <div class="edit-option-wrapper">
                <el-select
                  class="edit-option-select"
                  v-model="fieldEditOption.editOption"
                  :suffix-icon="CaretBottom"
                  :show-arrow="false"
                  :offset="4"
                  popper-class="data-filiter-rule-select-popper"
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

              <el-form-item style="flex: 1;" v-if="fieldEditOption.editOption === EditOption.Modify" prop="value" :rules="getConditionFormRules(fieldEditOption, 'value')">
                <el-input class="value-input" v-model="fieldEditOption.value" :placeholder="$t('plsInput')"></el-input>
              </el-form-item>

              <el-form-item style="flex: 1;" v-if="fieldEditOption.editOption === EditOption.Clear">
                <el-input class="value-input" placeholder="null" disabled></el-input>
              </el-form-item>

              <el-form-item style="flex: 1;" v-if="fieldEditOption.editOption === EditOption.Formula" prop="value">
                <el-button
                  :class="['formula-button', fieldEditOption.value ? 'has-formula' : '']"
                  :style="{color: fieldEditOption.value ? 'var(--color-primary)' : 'var(--text-color-regular)'}"
                  @click="handleEditFormula(fieldEditOption.value)"
                >
                  {{ fieldEditOption.value ? $t('formulaSet') : $t('formulaEdit') }}
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
        <div class="operation-prompt">
          <el-icon class="icon-prompt" :size="14" :color="'var(--text-color-placeholder)'"><i-ep-warning /></el-icon>
          <span>{{ $t('batchEditTip') }}</span>
        </div>
        <div class="wrapper-btns">
          <el-button @click="handleCancel">{{ $t('cancel') }}</el-button>
          <el-button type="primary" @click="handleConfirm">{{ $t('confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
  <teleport to="body">
    <form-default-value-formula-dialog
      ref="formulaDialogRef"
      v-model="visible"
      :value="formulaValue"
      :isLimitSubform="true"
      @update="(value) => {
        fieldEditOptions[0].value = value
      }"
    />
  </teleport>
</template>

<script lang='ts' setup>
import { computed, provide, reactive, ref, watch } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { CaretBottom } from "@element-plus/icons-vue";
import { SubForm } from './subForm';
import IEpPlus from "~icons/ep/plus";
import IEpDelete from "~icons/ep/delete";
import IEpWarning from "~icons/ep/warning";
import { replaceByFormula, createFormulaRuntimeByWidget } from "@common/utils/formula";
import { ACTIVE_ELEMENT } from "@renderer/types/inject";
import { FormElement } from "@renderer/b2/controllers/form";
import i18next, { $t } from "@renderer/widgets/i18next";

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
  value: string,
}

const props = defineProps<{
  modelValue: boolean,
  subForm: SubForm;
  selectedRows: any[];
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
}>();

const fieldMode = ref<FieldMode>(FieldMode.Multi)

const formRef = ref<FormInstance>();
const editOptions = computed(() => {
  const option = [
    {
      label: i18next.t('customValue'),
      value: EditOption.Modify,
      visible: true
    },
    {
      label: i18next.t('formulaEdit'),
      value: EditOption.Formula,
      visible: fieldMode.value === FieldMode.Single
    },
    {
      label: i18next.t('emptyValue'),
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
        callback();
      }
    }
  ]
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

const getFields = computed(() => {
  return props.subForm?.children?.filter(w => {
    if(w.isHidden || w.isReadonly) return false
    return true
  })
})

const onOpen = () => {
  if (fieldEditOptions.value.length === 0) handleAddField();
}

const handleConfirm = () => {
  formRef.value.validate((valid) => {
    if (!valid) {
      ElMessage.warning(i18next.t('pleaseCompleteBatchEditCondition'));
      return;
    }

    for(const index of props.selectedRows) {
      const subformRow = props.subForm?.tableData?.[index] || null;
      if (!subformRow) continue;
      for(const option of fieldEditOptions.value) {
        const widget = subformRow.children?.find(c => c.fieldId === option.fieldId);
        if (!widget) continue;
        if (option.editOption === EditOption.Modify && option.value !== undefined) {
          widget.inputValue = option.value;
        } else if (option.editOption === EditOption.Clear) {
          props.subForm.inputValue[index][option.fieldId] = undefined;
          widget.inputValue = undefined;
        } else if (option.editOption === EditOption.Formula && option.value !== undefined) {
          const formula = replaceByFormula(option.value, (keys) => {
            const [tableUID, widgetId, subWidgetId] = keys;
            if(subWidgetId) {
              const subFieldId = props.subForm.children?.find(c => c.uid === subWidgetId).fieldId;
              const subWidget = subformRow.children?.find(c => c.fieldId === subFieldId);
              if(subWidget) {
                return subWidget.inputValue || "";
              }
            } else {
              return (props.subForm.form?.children?.find(c => c.uid === widgetId) as FormElement)?.inputValue || "";
            }
          });
          try {
            const formulaRuntime = createFormulaRuntimeByWidget(widget);
            widget.inputValue = formulaRuntime?.evaluate(formula) ?? '';
          } catch (err) {
            return;
          }
        }
      }
    }
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

provide(ACTIVE_ELEMENT, computed(() => props.subForm as unknown as Element))
</script>

<style lang="scss">
.data-filiter-rule-select-popper {
  --el-bg-color-overlay: var(--bg-color-page);
}

.field-eidt-option-dialog {
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
    height: 408px;
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

    .operation-prompt {
      display: flex;
      align-items: center;
      gap: 2px;
      color: var(--text-color-placeholder);
      margin-right: auto;

      .icon-prompt {
        font-size: 14px;
        line-height: 20px;
      }
    }


    .el-button {
      border-radius: 4px;
    }
  }
}
</style>
