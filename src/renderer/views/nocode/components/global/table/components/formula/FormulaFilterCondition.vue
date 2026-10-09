<template>
  <div class="condition-group">
    <div class="condition-field">
      <field-select :modelValue="condition.uid" :options="getFieldOption(tableUID)"
        @update:modelValue="(val) => condition.uid = val" @change="handleSelectLinkageField(condition)" filterable
        :placeholder="$t('FilterConditionDialog.plsSelectRelField')" :no-data-text="$t('FilterConditionDialog.noData')"
        :show-arrow="false" :offset="4">
      </field-select>

      <el-select class="func" popper-class="custom-popper-small condition-value-popper" :disabled="!condition.uid"
        :placeholder="$t('DataSourceFilterConditionDialog.plsSelect')" v-model="condition.func">
        <el-option v-for="(ruleFuncValue, ruleFunc) in conditionFuncInfos.editFuncInfo" v-if="conditionFuncInfos"
          :key="ruleFunc" :label="RuleFuncTextMapping[ruleFunc]" :value="ruleFunc" />
      </el-select>
    </div>
    <div class="condition-value">
      <linkage-table-filter-value-format v-if="condition" :disabled="!condition.uid || !condition.func"
        :modelValue="condition.value" :func="condition.func"
        :linkageFieldsMap="getConditionUidPath(tableUID, condition)" :configurations="conditionFuncInfos"
        :widget="widget" @update:modelValue="condition.value = $event;"
        :styleOptions="{ popperClass: 'condition-value-popper' }">
      </linkage-table-filter-value-format>

      <el-button class="delete-btn" :icon="Delete" link @click="handleDelete"></el-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { FieldUID } from "@common/types/project";
import { isSystemField, SystemField } from "@common/utils/connection";
import { RuleFunc, FormCondition, FormElementConfiguration, RuleFuncTextMapping } from "@common/types/nocode";
import { formElementInstances } from "@renderer/utils/instance";
import { FormElement } from "@renderer/b2/controllers/form";
import { TableUID } from "@common/types/project";
import { ref, watch } from 'vue';
import { Delete } from "@element-plus/icons-vue";
import { parseFormulaTableUID } from "@common/utils/connection";

const props = withDefaults(defineProps<{
  tableUID: TableUID;
  condition: FormCondition;
  widget: FormElement;
  configurationsCache: Record<string, FormElementConfiguration>;
}>(), {

});

const emit = defineEmits<{
  (event: "delete"): void
}>();
const HISTORY_TABLE_UID_PREFIX = "hist_";
const getReferencedTableUID = (tableUID: TableUID) => {
  return tableUID?.startsWith(HISTORY_TABLE_UID_PREFIX)
    ? tableUID.slice(HISTORY_TABLE_UID_PREFIX.length) as TableUID
    : tableUID;
}

const resolveTableReference = (tableUID: TableUID) => {
  const { connectionUID, tableUID: parsedTableUID } = parseFormulaTableUID(tableUID, props.widget.topForm.tableUID[0]);
  const referencedTableUID = getReferencedTableUID(parsedTableUID as TableUID);
  return {
    connectionUID,
    tableUID: parsedTableUID as TableUID,
    referencedTableUID,
  };
}

const getTable = (tableUID: TableUID) => {
  const { connectionUID, referencedTableUID } = resolveTableReference(tableUID);
  if (!connectionUID || !referencedTableUID) return undefined;
  return props.widget.getTable([connectionUID, referencedTableUID])
}

// const systemFieldNameOfFilter = [SystemField.CREATE_TIME, SystemField.UPDATE_TIME, SystemField.CREATE_OWNER]
const getFieldOption = (tableUID: TableUID) => {
  const table = getTable(tableUID);
  const fields = table?.fields?.filter(f => !isSystemField(f) && f.meta.subType !== "subForm") || [];
  return fields.map(f => {
    return {
      label: f.alias,
      value: f.uid
    }
  })
}

const handleSelectLinkageField = (condition) => {
  condition.func = RuleFunc.EQUAL;
  condition.value = undefined;
}

const getConditionUidPath = (tableUID: TableUID, condition: FormCondition) => {
  const { connectionUID } = resolveTableReference(tableUID);
  return {
    [tableUID]: {
      connectionUID,
      fieldUID: condition.uid
    }
  }
}

const handleDelete = () => {
  emit("delete");
}

const specialTypes = ["department", "account", "number", "date"];
const conditionFuncInfos = ref<FormElementConfiguration>({});
watch(() => [props.condition.uid, props.tableUID] as const, async ([uid], oldVal) => {
  if (!uid) return;
  const { connectionUID, referencedTableUID } = resolveTableReference(props.tableUID);
  if (!connectionUID || !referencedTableUID) return;

  const field = props.widget.getField([connectionUID, referencedTableUID, uid as FieldUID]);
  if (!field) return;
  if (!props.configurationsCache[field.meta?.extra?.widgetType]) {
    const widget = await formElementInstances.getInstance(field.meta?.extra?.widgetType);
    props.configurationsCache[field.meta?.extra?.widgetType] = widget.getConfigurations();
  }

  const isSpecial = specialTypes.includes(field.meta.subType) || field.meta.extra.widgetType === "widget.form.address";
  if (isSpecial) {
    conditionFuncInfos.value = props.configurationsCache[field.meta.extra.widgetType];
  } else {
    conditionFuncInfos.value = props.configurationsCache.default;
  }

  if (oldVal?.[0] || !props.condition.func) props.condition.func = Object.keys(conditionFuncInfos.value.editFuncInfo)[0] as RuleFunc;
}, { immediate: true })

</script>
<style lang="scss" scoped>
@mixin common-select-mixin {
  &:has(.is-disabled) {
    cursor: not-allowed;
  }

  :deep(.el-select__wrapper) {
    width: 100%;
    height: 28px;
    min-height: 28px;
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

    .el-select__selection.is-near {
      margin-left: -4px;
      flex-wrap: nowrap;

      span {
        display: inline-block;
        max-width: 290px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .el-select__input-wrapper {
        min-width: 20px;
        flex: 1;
      }
    }
  }
}

.condition-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .condition-field {
    display: flex;
    gap: 8px;

    .field-select {
      @include common-select-mixin;
      width: 232px;
    }

    .func {
      @include common-select-mixin;
      flex: 1;
    }
  }

  .condition-value {
    display: flex;
    justify-content: end;
    align-items: center;
    height: 28px;
    gap: 8px;

    .filter-value-format {
      :deep(.el-input__wrapper) {
        height: 28px !important;
        min-height: 28px !important;
      }

      :deep(.el-input__inner) {
        height: 28px !important;
        min-height: 28px !important;
      }

      :deep(.el-select__wrapper) {
        height: 28px !important;
        min-height: 28px !important;
      }
    }

    :deep(.delete-btn) {
      width: 24px;

      .el-icon {
        color: var(--text-color-regular);
      }

      &:hover .el-icon {
        color: var(--color-danger);
      }
    }
  }


}
</style>

<style lang="scss">
.condition-value-popper {
  background-color: var(--bg-color-page) !important;
  border-radius: 4px !important;
}
</style>
