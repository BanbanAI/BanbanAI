<template>
  <div class="view-action-edit-field-setting">
    <div class="title">
      <span>
        <span class="required-mark">*</span>
        {{ $t("ViewActionEditFieldSetting.editRecord") }}
      </span>
      <div
        v-if="localFields.length < fieldOptions.length"
        class="add-button"
        @click="handleAddField"
      >
        <el-icon><i-ep-plus /></el-icon>
        <span>{{ $t("ViewActionEditFieldSetting.addField") }}</span>
      </div>
    </div>

    <div class="container">
      <div
        v-for="(item, index) in localFields"
        :key="`${index}-${item.fieldId || 'empty'}-${item.mode}`"
        class="item"
      >
        <el-select
          v-model="item.fieldId"
          class="target-field"
          :placeholder="$t('ViewActionEditFieldSetting.fieldPlaceholder')"
          :no-data-text="$t('ViewActionEditFieldSetting.noFieldOptions')"
          @change="handleFieldChange(item)"
        >
          <el-option
            v-for="option in fieldOptions"
            :key="option.uid"
            :value="option.uid"
            :label="option.alias"
            :disabled="option.disabled"
          />
          <template #label="{ label, value }">
            <span v-if="label === value" class="deleted-field">{{ $t("ViewActionEditFieldSetting.fieldDeleted") }}</span>
            <span v-else>{{ label }}</span>
          </template>
        </el-select>

        <span class="sign">=</span>

        <el-select
          v-model="item.mode"
          class="value-type"
          @change="handleModeChange(item)"
        >
          <el-option :value="ViewActionEditFieldMode.CURRENT" :label="$t('ViewActionEditFieldSetting.keepCurrentValue')+''" />
          <el-option
            v-if="canFieldUseCustomValue(item.fieldId)"
            :value="ViewActionEditFieldMode.CUSTOM"
            :label="$t('ViewActionEditFieldSetting.customValue')+''"
          />
        </el-select>

        <div class="inline-value">
          <view-action-field-value-input
            v-if="item.mode === ViewActionEditFieldMode.CUSTOM"
            v-model="item.customValue"
            :field="getFieldById(item.fieldId)"
            :nocode-id="nocodeId"
          />
        </div>

        <el-icon class="delete-button" @click="handleDeleteField(index)">
          <i-ep-delete />
        </el-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import i18next from "i18next";
import { cloneDeep, isEqual } from "lodash";
import { NOCODE } from "@renderer/types";
import { isSystemField } from "@common/utils";
import { getNocodeDataSourceConnections } from "@common/utils/connection";
import { canViewActionEditFieldBeConfigured, canViewActionFieldUseCustomValue, isViewActionUploadFieldMultiple } from "@common/utils/viewAction";
import { findWidgetSoulByUID } from "@common/utils/element";
import { FormWidgetType, ViewActionEditField, ViewActionEditFieldMode, ViewActionFieldId } from "@common/types/nocode";
import { Field, Table as ProjectTable } from "@common/types/project";
import ViewActionFieldValueInput from "./ViewActionFieldValueInput.vue";

type LocalEditField = {
  fieldId: ViewActionFieldId | null,
  mode: ViewActionEditFieldMode,
  customValue?: any,
};

const props = withDefaults(defineProps<{
  table: ProjectTable,
  fields?: ViewActionEditField[],
}>(), {
  fields: () => [],
});

const emit = defineEmits<{
  (event: "update", value: ViewActionEditField[]): void,
}>();

const nocode = inject(NOCODE);
const localFields = ref<LocalEditField[]>([]);

const tables = computed(() => {
  return getNocodeDataSourceConnections(nocode.value?.body, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
  }).flatMap(source => source.tables || []);
});
const nocodeId = computed(() => nocode.value?.meta?.id || "");

const getWidgetOwnerTableUID = (tableId: string) => {
  const target = tables.value.find(table => table.uid === tableId);
  return target?.meta?.extra?.primaryTable?.[1] || tableId;
};

const isFieldExist = (tableId: string, field: Field) => {
  const widgetOwnerTableUID = getWidgetOwnerTableUID(tableId);
  const widget = nocode.value.body?.formData?.formOptions?.[widgetOwnerTableUID]?.widget;
  const fieldUID = field?.meta?.uid;
  if (!widget || !fieldUID) {
    return false;
  }
  return !!findWidgetSoulByUID([widget], fieldUID);
};

const getSubFieldOptions = (parentField: Field) => {
  const subTableUID = parentField.meta?.extra?.subTableUID?.[1];
  if (!subTableUID) return [];
  const subTable = tables.value.find(item => item.uid === subTableUID);
  if (!subTable) return [];

  return subTable.fields
    .filter(field => (
      !isSystemField(field)
      && canViewActionEditFieldBeConfigured(field)
      && isFieldExist(props.table.uid, field)
    ))
    .map(field => ({
      uid: `${parentField.uid}.${field.uid}` as ViewActionFieldId,
      alias: `${parentField.alias}.${field.alias}`,
      disabled: false,
    }));
};

const fieldOptions = computed(() => {
  const selectedFieldIds = localFields.value.map(item => item.fieldId).filter(Boolean);

  return props.table.fields
    .filter(field => (
      !isSystemField(field)
      && canViewActionEditFieldBeConfigured(field)
      && isFieldExist(props.table.uid, field)
    ))
    .flatMap((field) => {
      const children = getSubFieldOptions(field);
      if (children.length) {
        return children;
      }
      return [{
        uid: field.uid as ViewActionFieldId,
        alias: field.alias,
        disabled: false,
      }];
    })
    .map(item => ({
      ...item,
      disabled: selectedFieldIds.includes(item.uid),
    }));
});

const getFieldById = (fieldId?: ViewActionFieldId | null) => {
  if (!fieldId) return null;
  const segments = String(fieldId).split(".");
  const mainField = props.table.fields.find(field => field.uid === segments[0]);
  if (!mainField) return null;
  if (segments.length === 1) {
    return mainField;
  }

  const subTableUID = mainField.meta?.extra?.subTableUID?.[1];
  if (!subTableUID) return null;
  const subTable = tables.value.find(item => item.uid === subTableUID);
  return subTable?.fields?.find(field => field.uid === segments[1]) || null;
};

const canFieldUseCustomValue = (fieldId?: ViewActionFieldId | null) => {
  return canViewActionFieldUseCustomValue(getFieldById(fieldId));
};

const getDefaultCustomValue = (fieldId?: ViewActionFieldId | null) => {
  const field = getFieldById(fieldId);
  const widgetType = field?.meta?.extra?.widgetType as FormWidgetType | undefined;

  if (!field || !widgetType) return "";

  if ([FormWidgetType.FILE_UPLOADER, FormWidgetType.IMAGE_UPLOADER].includes(widgetType)) {
    return isViewActionUploadFieldMultiple(field) ? [] : null;
  }

  if ([FormWidgetType.MEMBER_SELECT, FormWidgetType.DEPARTMENT_SELECT].includes(widgetType)) {
    return [];
  }

  if ([
    FormWidgetType.CHECKBOX_GROUP,
    FormWidgetType.TREE_MULTIPLE_SELECT,
    FormWidgetType.TAG_INPUT,
  ].includes(widgetType)) {
    return [];
  }

  if ([
    FormWidgetType.DATE_PICKER,
    FormWidgetType.TIME_PICKER,
    FormWidgetType.TREE_SELECT,
    FormWidgetType.RADIO_GROUP,
    FormWidgetType.ADDRESS,
  ].includes(widgetType)) {
    return null;
  }

  if (widgetType === FormWidgetType.SWITCH) {
    return false;
  }

  if (widgetType === FormWidgetType.RATE) {
    return 0;
  }

  return "";
};

const normalizeFieldItem = (item: Partial<LocalEditField>): LocalEditField => {
  const fieldId = (item.fieldId as ViewActionFieldId) || null;
  const mode = item.mode === ViewActionEditFieldMode.CUSTOM && canFieldUseCustomValue(fieldId)
    ? ViewActionEditFieldMode.CUSTOM
    : ViewActionEditFieldMode.CURRENT;

  return {
    fieldId,
    mode,
    customValue: mode === ViewActionEditFieldMode.CUSTOM
      ? (item.customValue === undefined ? getDefaultCustomValue(fieldId) : cloneDeep(item.customValue))
      : undefined,
  };
};

const normalizeFields = (fields: ViewActionEditField[] = []) => {
  return fields
    .filter(item => !!item?.fieldId)
    .map(item => normalizeFieldItem(item));
};

const emitUpdate = () => {
  emit("update", localFields.value
    .filter(item => !!item.fieldId)
    .map(item => ({
      fieldId: item.fieldId as ViewActionFieldId,
      mode: item.mode,
      customValue: item.mode === ViewActionEditFieldMode.CUSTOM
        ? cloneDeep(item.customValue)
        : undefined,
    })));
};

const getFirstAvailableFieldId = () => {
  return fieldOptions.value.find(option => !option.disabled)?.uid || null;
};

const handleAddField = () => {
  const fieldId = getFirstAvailableFieldId();
  if (!fieldId) return;
  localFields.value.push({
    fieldId,
    mode: ViewActionEditFieldMode.CURRENT,
  });
};

const handleDeleteField = (index: number) => {
  localFields.value.splice(index, 1);
};

const handleFieldChange = (item: LocalEditField) => {
  if (!canFieldUseCustomValue(item.fieldId)) {
    item.mode = ViewActionEditFieldMode.CURRENT;
    item.customValue = undefined;
    return;
  }

  item.customValue = item.mode === ViewActionEditFieldMode.CUSTOM
    ? getDefaultCustomValue(item.fieldId)
    : undefined;
};

const handleModeChange = (item: LocalEditField) => {
  if (item.mode === ViewActionEditFieldMode.CUSTOM && !canFieldUseCustomValue(item.fieldId)) {
    item.mode = ViewActionEditFieldMode.CURRENT;
    item.customValue = undefined;
    return;
  }

  if (item.mode === ViewActionEditFieldMode.CUSTOM && item.customValue === undefined) {
    item.customValue = getDefaultCustomValue(item.fieldId);
  } else if (item.mode !== ViewActionEditFieldMode.CUSTOM) {
    item.customValue = undefined;
  }
};

watch(() => props.fields, (value) => {
  const nextFields = normalizeFields(value || []);
  if (isEqual(nextFields, localFields.value)) {
    return;
  }
  localFields.value = nextFields;
}, { immediate: true, deep: true });

watch(localFields, () => {
  emitUpdate();
}, { deep: true });
</script>

<style scoped lang="scss">
.view-action-edit-field-setting {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.title {
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.required-mark {
  color: #f56c6c;
  font-size: 16px;
  margin-right: 4px;
}

.add-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-color-primary);
  cursor: pointer;
  user-select: none;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;

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

  :deep(.el-textarea__inner),
  :deep(.el-input-tag) {
    background-color: var(--bg-color-overlay);
    box-shadow: none;
    border-radius: 4px;
  }

  :deep(.el-date-editor) {
    width: 100%;
  }

  :deep(.el-date-editor .el-input__wrapper),
  :deep(.el-time-editor .el-input__wrapper),
  :deep(.el-tree-select .el-select__wrapper) {
    background-color: var(--bg-color-overlay);
    box-shadow: none;
    border-radius: 4px;
  }
}

.target-field {
  width: 184px;
  min-width: 184px;
  flex: 0 0 184px;
}

.value-type {
  width: 100px;
  min-width: 94px;
  flex: 0 0 100px;
}

.value-type :deep(.el-select__wrapper) {
  padding: 8px;
}

.inline-value {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.sign {
  width: 24px;
  color: var(--text-color-secondary);
  text-align: center;
  flex-shrink: 0;
}

.delete-button {
  cursor: pointer;
  color: var(--text-color-secondary);
  flex-shrink: 0;
  margin-left: 0;
}

.deleted-field {
  color: var(--el-color-danger);
}
</style>
