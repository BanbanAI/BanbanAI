<template>
  <div class="filter-rule">
    <div class="filter-rule-title">{{ $t('FormulaFilterRule.title') }}</div>

    <div class="wrapper-filter-group">
      <div class="filter-rule-content" v-for="(rule, tableUID, index) in formulaFilterMap">
        <div class="table-alias">{{ $t('FormulaFilterRule.alias') }}<span class="alias-text">{{ getTableAlias(tableUID) }}</span></div>
        <div class="rule-logic">
          <span>{{ $t('FormulaFilterRule.conditionTip') }}</span>
          <el-select class="logic-select" size="small" v-model="rule.logic"
            :no-data-text="$t('LinkFormFilterDialog.noData')" popper-class="custom-popper-small" :offset="4">
            <el-option v-for="item in logicOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <span>{{ $t('FormulaFilterRule.conditionTipAddition') }}</span>
        </div>
        <template v-for="(condition, index) in rule.conditions" :key="index">
          <formula-filter-condition :tableUID="tableUID" :condition="condition"
            :configurationsCache="configurationsCache" :widget="widget"
            @delete="handleDeleteCondition(tableUID, index)"></formula-filter-condition>
        </template>
        <div class="wrapper-add-btn">
          <el-button class="add-btn" :type="'primary'" :icon="Plus" link @click="handleAddCondition(tableUID)">{{ $t('FormulaFilterRule.add') }}</el-button>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { SystemField } from "@common/utils/connection";
import { RuleFunc, FormElementConfiguration, RuleFuncValue } from "@common/types/nocode";
import { LogicalOperator } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import { TableUID } from "@common/types/project";
import i18next from "i18next";
import { FilterRule } from "@common/types/nocode";
import { parseFormulaTableUID } from "@common/utils/connection";
import FormulaFilterCondition from "./FormulaFilterCondition.vue";
import { Plus } from "@element-plus/icons-vue";

const props = withDefaults(defineProps<{
  formulaFilterMap: Record<TableUID, FilterRule>;
  widget: FormElement
}>(), {
  formulaFilterMap: () => ({})
});

const logicOptions = [
  {
    value: LogicalOperator.AND,
    get label() { return i18next.t('LinkFormFilterDialog.and') },
  },
  {
    value: LogicalOperator.OR,
    get label() { return i18next.t('LinkFormFilterDialog.or') },
  },
];
const HISTORY_TABLE_UID_PREFIX = "hist_";
const getReferencedTableUID = (tableUID: TableUID) => {
  return tableUID?.startsWith(HISTORY_TABLE_UID_PREFIX)
    ? tableUID.slice(HISTORY_TABLE_UID_PREFIX.length) as TableUID
    : tableUID;
}
const isHistoryTableUID = (tableUID: TableUID) => {
  return tableUID?.startsWith(HISTORY_TABLE_UID_PREFIX);
}

const resolveTableReference = (tableUID: TableUID) => {
  const { connectionUID, tableUID: parsedTableUID } = parseFormulaTableUID(tableUID, props.widget.topForm.tableUID[0]);
  const referencedTableUID = getReferencedTableUID(parsedTableUID as TableUID);
  return {
    connectionUID,
    tableUID: parsedTableUID as TableUID,
    referencedTableUID,
    isHistoryData: isHistoryTableUID(parsedTableUID as TableUID),
  };
}

const getTable = (tableUID: TableUID) => {
  const { connectionUID, referencedTableUID } = resolveTableReference(tableUID);
  if (!connectionUID || !referencedTableUID) return undefined;
  return props.widget.getTable([connectionUID, referencedTableUID])
}

const getTableAlias = (tableUID: TableUID) => {
  const { connectionUID, isHistoryData } = resolveTableReference(tableUID);
  const table = getTable(tableUID);
  if (!table) return tableUID;
  const baseAlias = isHistoryData ? `${table.alias}-${i18next.t('FormulaEditer.historyData')}` : table.alias;
  const connection = props.widget.getBoard().getConnections()?.find(item => item.uid === connectionUID);
  return connectionUID && connectionUID !== props.widget.topForm.tableUID[0] && connection?.name
    ? `[${connection.name}]${baseAlias}`
    : baseAlias;
}

const configurationsCache: Record<string, FormElementConfiguration> = {
  default: {
    funcInfo: {
      [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
      [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    },
    editFuncInfo: {
      [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
      [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
      [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
      [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
      [RuleFunc.EMPTY]: RuleFuncValue.NULL,
      [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
    }
  }
};

const handleDeleteCondition = (tableUID: TableUID, index: number) => {
  props.formulaFilterMap[tableUID].conditions.splice(index, 1);
}

const handleAddCondition = (tableUID: TableUID) => {
  props.formulaFilterMap[tableUID].conditions.push({
    uid: null,
    func: null,
    value: null,
  })
}
</script>
<style lang="scss" scoped>
.filter-rule {
  .filter-rule-title {
    font-size: 12px;
    color: var(--text-color-placeholder);
    margin-bottom: 8px;
  }

  .wrapper-filter-group {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .filter-rule-content {
      width: 100%;
      height: fit-content;
      display: inline-flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      box-sizing: border-box;
      font-size: 14px;

      .table-alias {
        display: flex;

        .alias-text {
          display: inline-block;
          color: var(--color-primary);
          flex: 1;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
      }

      .rule-logic {
        display: flex;
        align-items: center;
        gap: 8px;

        .logic-select {
          width: 72px;

          :deep(.el-select__wrapper) {
            height: 28px;
            background-color: var(--bg-color-overlay);
            border-radius: 4px;
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
      }

      .wrapper-add-btn {
        height: 28px;
        line-height: 28px;

      }
    }
  }

}
</style>
