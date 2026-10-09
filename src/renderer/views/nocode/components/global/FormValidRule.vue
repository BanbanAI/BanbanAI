<template>
  <div class="form-valid-condition">
    <div class="content">
      <el-scrollbar class="form-valid-condition-scrollbar">
        <data-source-form
          :sourceTables="formValidRule.sourceTables"
          ref="dataSourceFormRef"
          :targetFields="[]"
          :title="$t('FormValidRule.valDataSrcForm')"
          :current-subform-options="currentSubformSourceOptions"
        />
        <valid-conditions ref="validConditionsRef" :table="currentTable" :targetTableUid="formValidRule.targetTableUID"
          :validConditions="formValidRule.validConditions"
          :sourceTables="formValidRule.sourceTables"></valid-conditions>
      </el-scrollbar>
      <div class="footer">
        <el-button link class="clear-button" :icon="Delete" @click="clearValue">{{ $t('FormValidRule.clear') }}</el-button>
        <div class="footer-right">
          <el-button class="close-button" @click="emit('close')">{{ $t('FormValidRule.cancel') }}</el-button>
          <el-button type="primary" class="close-button" @click="updateValue">{{ $t('FormValidRule.save') }}</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { computed, ComputedRef, provide, ref, watch } from "vue";
import { deepClone } from '@common/utils/object';
import { Connection, FormSubmitAllowNoticeMode, FormSubmitValidMode, FormValidRule, Table } from "@common/types/project";
import { FormConditionValueType } from "@common/types/nocode";
import { isSystemField, SystemField } from "@common/utils/connection";
import { unique } from "@common/utils/unique";
import { AbstractForm, isSubForm } from "@renderer/b2/controllers/form";
import { provideFormFields, provideFormTable } from "../../views/editor/form/hooks";
import { ElMessage } from "element-plus";
import { Delete } from "@element-plus/icons-vue";
import i18next from "i18next";

const props = defineProps<{
  widget: AbstractForm,
  value: FormValidRule,
}>();

const emit = defineEmits<{
  (e: "update", value: FormValidRule): void;
  (e: "close"): void;
}>();

const createFallbackTable = (): Table => ({
  uid: props.widget.tableUID?.[1] as Table["uid"],
  alias: "",
  meta: {},
  fields: [],
});

const replaceSubformFields = (tableReplaced: Table | undefined, tables: Table[]): Table => {
  if (!tableReplaced) {
    return createFallbackTable();
  }

  return {
    ...tableReplaced,
    fields: tableReplaced.fields.map(field => {
      if (field.subTableFields && field.meta?.extra?.subTableUID) {
        const subTable = tables.find(t => t.uid === field.meta.extra.subTableUID[1]);
        if (!subTable) return field;
        return {
          ...field,
          subTableFields: subTable.fields
        }
      }

      return field;
    })
  }
}

const createDefaultConditionalGroup = () => ({
  errorText: i18next.t('FormValidRule.submitFail'),
  conditions: [{
    uid: null,
    func: null,
    value: null,
    formula: null,
    type: FormConditionValueType.FORM,
  }],
  submitMode: FormSubmitValidMode.BLOCK,
  allowNoticeMode: FormSubmitAllowNoticeMode.DIALOG,
});

const connection: ComputedRef<Connection | undefined> = computed(() => {
  return props.widget.getBoard().getConnections().find(c => c.uid === props.widget.tableUID?.[0]);
});

const currentTable: ComputedRef<Table> = computed(() => {
  const tables = connection.value?.tables || [];
  const current = tables.find(table => table.uid === props.widget.tableUID?.[1]);
  return replaceSubformFields(current, tables);
});

const currentSubformSourceOptions = computed(() => {
  if (isSubForm(props.widget)) {
    return [];
  }
  return (currentTable.value?.fields || [])
    .filter(field => field.meta?.extra?.widgetType === "widget.form.subform" && field.meta?.extra?.subTableUID?.[1])
    .map(field => ({
      fieldUID: field.uid,
      tableUID: field.meta?.extra?.subTableUID?.[1],
      label: field.alias || field.uid,
    }));
});

function createDefaultFormValidRule(): FormValidRule {
  return {
    id: unique(),
    targetTableUID: currentTable.value?.uid || createFallbackTable().uid,
    sourceTables: [],
    validConditions: [],
  };
}

const normalizeFormValidRule = (value?: FormValidRule): FormValidRule => {
  const rule = value ? deepClone(value) : createDefaultFormValidRule();
  const legacySubmitMode = rule.submitMode === FormSubmitValidMode.ALLOW ? FormSubmitValidMode.ALLOW : FormSubmitValidMode.BLOCK;
  const legacyAllowNoticeMode = rule.allowNoticeMode === FormSubmitAllowNoticeMode.TOAST ? FormSubmitAllowNoticeMode.TOAST : FormSubmitAllowNoticeMode.DIALOG;
  rule.targetTableUID ||= currentTable.value?.uid || createFallbackTable().uid;
  rule.sourceTables ||= [];
  rule.validConditions = (rule.validConditions || []).map(group => ({
    ...createDefaultConditionalGroup(),
    ...(group || {}),
    submitMode: group?.submitMode === FormSubmitValidMode.ALLOW ? FormSubmitValidMode.ALLOW : (group?.submitMode === FormSubmitValidMode.BLOCK ? FormSubmitValidMode.BLOCK : legacySubmitMode),
    allowNoticeMode: group?.allowNoticeMode === FormSubmitAllowNoticeMode.TOAST ? FormSubmitAllowNoticeMode.TOAST : (group?.allowNoticeMode === FormSubmitAllowNoticeMode.DIALOG ? FormSubmitAllowNoticeMode.DIALOG : legacyAllowNoticeMode),
    conditions: Array.isArray(group?.conditions) ? group.conditions : [],
  }));

  if (rule.validConditions.length === 0) {
    rule.validConditions.push(createDefaultConditionalGroup());
  }

  rule.submitMode = undefined;
  rule.allowNoticeMode = undefined;

  return rule;
};

const formValidRule = ref<FormValidRule>(createDefaultFormValidRule());
const validConditionsRef = ref();
const dataSourceFormRef = ref();

const formFields = computed(() => {
  return currentTable.value?.fields?.filter(field => {
  return !isSystemField(field) || [SystemField.CREATE_OWNER, SystemField.DATA_OWNER, SystemField.CREATE_TIME, SystemField.UPDATE_TIME].includes(field.meta.name as SystemField);
  }) || [];
})

const updateValue = async() => {
  const validOfSourceForm = await dataSourceFormRef.value.validate();
  const validOfConditions = await validConditionsRef.value.validate();
  if (!validOfSourceForm || !validOfConditions) {
    ElMessage.error(i18next.t('FormValidRule.fillAll'));
    return;
  }
  emit("update", {
    ...formValidRule.value,
    submitMode: undefined,
    allowNoticeMode: undefined,
  });
  emit("close")
}

const clearValue = () => {
  formValidRule.value.sourceTables = [];
  formValidRule.value.validConditions = [];
}

watch(() => props.value, (value) => {
  // Normalize incoming data before first render.
  formValidRule.value = normalizeFormValidRule(value);
}, { immediate: true, deep: true });

provide("widget", props.widget);
provideFormFields(formFields);
provideFormTable(currentTable);
</script>

<style lang='scss' scoped>
.form-valid-condition {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  justify-content: center;
  background-color: var(--bg-color-overlay);

  .content {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    width: 1024px;
    max-width: 80%;
    background-color: var(--bg-color-page);

    :deep(.el-scrollbar) {
      width: 100%;

      .el-scrollbar__wrap {
        padding: 16px;

        .el-scrollbar__view {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
      }
    }

    .footer {
      width: 100%;
      display: flex;
      justify-content: space-between;
      padding: 16px;

      .el-button + .el-button {
          margin-left: 8px;
      }

      :deep(.clear-button) {
        &.is-link:hover {
          color: var(--color-primary);
        }

        .el-icon {
          font-size: 16px;
        }

        span {
          margin-left: 4px;
        }
      }

      .footer-right {
        display: flex;

        .close-button {
          border-radius: 4px;
          width: fit-content;
        }
      }
    }

  }
}
</style>
