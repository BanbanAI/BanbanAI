<template>
  <div class="table-filter">
    <el-drawer
      v-model="visible"
      direction="btt"
      size="65%"
      :show-close="false"
      close-on-click-modal
      @open="drawerShow"
    >
      <template #header>
        <div class="title">{{ $t('MobileTableFilter.filter') }}</div>
      </template>
      <div class="drawer-container">
        <div class="content">
          <div class="logic" v-if="filterRule">
            <div class="logic-text">{{ $t('MobileTableFilter.filterSatisfy') }}</div>
            <el-select size="small" v-model="filterRule.logic" :suffix-icon="CaretBottom" :teleported="false"
              :no-data-text="$t('MobileTableFilter.noData')">
              <el-option v-for="item in logicOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <div class="logic-text">{{ $t('MobileTableFilter.conditionData') }}</div>
          </div>
          <el-scrollbar class="filter-scrollbar">
            <el-config-provider v-if="filterRule?.conditions?.length" :locale="locale">
              <ul class="filter-rule-list">
                <li class="filter-rule" v-for="(condition, index) in filterRule.conditions">
                  <el-select v-model="condition.uid" style="width: 100px; margin-right: 8px;" popper-class="table-filter-inner-popover" @change="handleFieldChange(condition)">
                    <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
      
                  <el-select v-model="condition.func" placeholder="Select" style="width: 100px; margin-right: 8px;" popper-class="table-filter-inner-popover" @change="handleFuncChange(condition)">
                    <el-option v-for="value, key in filterMenus(condition.uid)" :key="key"
                      :label="RuleFuncTextMapping[key]" :value="key" />
                  </el-select>
      
                  <filter-value-format v-model="condition.value" :element="getInstance(condition.uid)" :fieldId="condition.uid" :type="funcValue(condition.uid, condition.func)" style="flex: 1" :placeholder="$t('MobileTableFilter.input')" v-if="isShowValue(condition)" />
                  <div class="btn-del" @click="filterRule.conditions.splice(index, 1)">
                    <el-icon>
                      <Delete />
                    </el-icon>
                  </div>
                </li>
              </ul>
            </el-config-provider>
            <field-selector :options="options" :teleported="false" :close-on-select="true"
            @select="handleAdd">{{ $t('MobileTableFilter.addCondition') }}</field-selector>
          </el-scrollbar>
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <el-button class="clear" plain size="small" @click="handelClear">{{ $t('MobileTableFilter.clear') }}</el-button>
          <el-button class="filter" size="small" type="primary" @click="handleFilter">{{ $t('MobileTableFilter.filter') }}</el-button>
        </div>
      </template>
    </el-drawer>
    <div :class="['btn', { changed: widget.filterRule?.conditions?.length }]" @click="visible = !visible" ref="btnRef">
      <el-icon size="16"><i-table-filter /></el-icon>
      {{ $t('MobileTableFilter.filter') }}
    </div>
  </div>
</template>

<script lang='ts' setup>
import { computed, ref } from 'vue';
import { Delete, CaretBottom } from "@element-plus/icons-vue";
import { deepClone, equals } from '@common/utils/object';
import { useTable } from '../hooks';
import { FormCondition, RuleFunc, RuleFuncTextMapping, RuleFuncValue } from '@common/types/nocode';
import { LogicalOperator } from '@renderer/b2/types';
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";
import { FilterRule } from '@common/types/nocode';
import i18next from 'i18next';
import { FilterOption, buildFilterOptions, createOptionFilterTarget, getFilterDefaultValue, getFilterFuncInfo, getFilterFuncValue, isFilterValueVisible, useFilterElementResolver } from '../filter';

const widget = useTable();
const visible = ref(false)
const btnRef = ref<HTMLElement>();
const { getInstance: getResolvedInstance } = useFilterElementResolver((elementId) => {
  return elementId ? widget.getInstanceById(elementId) : undefined;
});

const logicOptions = [
  {
    value: LogicalOperator.AND,
    get label() { return i18next.t('MobileTableFilter.all') },
  },
  {
    value: LogicalOperator.OR,
    get label() { return i18next.t('MobileTableFilter.one') },
  },
];

const options = computed<FilterOption[]>(() => {
  return buildFilterOptions(widget.allColumns);
})

const isShowValue = (condition: FormCondition) => {
  return isFilterValueVisible(condition.func);
}

const filterRule = ref<FilterRule>();
const drawerShow = async () => {
  await widget.ensureFormReady();
  filterRule.value = deepClone(widget.filterRule);
}

const filter = () => {
  if (equals(filterRule.value, widget.filterRule)) {
    return;
  }
  widget.filterRule = deepClone(filterRule.value);
  widget.refreshData();
}

const handleAdd = (option: FilterOption) => {
  const funcs = filterMenus(option.value);
  filterRule.value.conditions.push({
    uid: option.value,
    func: (Object.keys(funcs)[0]) as RuleFunc || RuleFunc.EQUAL,
    value: "",
  })
}

const handelClear = () => {
  filterRule.value.conditions = [];
}

const handleFilter = () => {
  filter()
  visible.value = false;
}

const handleFieldChange = (condition: FormCondition) => {
  const funcs = filterMenus(condition.uid);
  condition.func = (Object.keys(funcs)[0]) as RuleFunc || RuleFunc.EQUAL;
  handleFuncChange(condition);
}

const handleFuncChange = (condition: FormCondition) => {
  const type = funcValue(condition.uid, condition.func);
  condition.value = getFilterDefaultValue(type);
}
const getInstance = (fieldId: string) => {
  const option = options.value?.find(option => option.value === fieldId);
  if (!option) return;
  return getResolvedInstance(createOptionFilterTarget(fieldId, option));
}
const filterMenus = (fieldId: string) => {
  const option = options.value?.find(option => option.value === fieldId);
  if (!option) return {};
  const target = createOptionFilterTarget(fieldId, option);
  return getFilterFuncInfo(target, getInstance(fieldId));
}

const funcValue = (fieldId: string, key: RuleFunc): RuleFuncValue => {
  const option = options.value?.find(option => option.value === fieldId);
  const target = createOptionFilterTarget(fieldId, option);
  return getFilterFuncValue(target, key, getInstance(fieldId));
}
</script>

<style lang="scss" scoped>
.table-filter {
  margin-right: 8px;
  :deep(.el-drawer) {
    background-color: #fff;
    border-radius: 4px 4px 0 0 !important;

    .el-drawer__header {
      margin-bottom: 0;
    }

    .el-drawer__body {
      padding: 0;
    }

    .el-drawer__footer {
      border-top: 1px solid #E6E6E6;

      .footer {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;

        .el-button {
          margin: 0;
          font-size: 14px;
        }

        .clear {
          width: 60px;
          height: 40px;
          border-radius: 4px;
        }

        .filter {
          flex: 1;
          height: 40px;
          border-radius: 4px;
        }
      }
    }
  }

  .title {
    font-size: 14px;
    font-weight: 400;
  }

  .drawer-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    .filter-scrollbar {
      padding-top: 8px;
      padding-bottom: 16px;
      &::-webkit-scrollbar {
        display: none;
      }
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .content {
      height: 100%;
      padding: 16px;
      overflow-y: hidden;

      .logic {
        display: flex;
        align-items: center;

        .logic-text {
          font-size: 14px;
          font-weight: 400;
        }
        :deep(.el-select) {
          width: 60px;
          margin: 0 8px;
          .el-select__wrapper {
            background-color: var(--bg-color-overlay);
            border-radius: 4px;
          }
        }
      }

      .filter-scrollbar {
        .filter-rule-list {
          margin-top: 8px;
          
          .filter-rule {
            display: flex;
            align-items: center;
            margin-bottom: 8px;

            :deep(.el-select) {
              .el-select__wrapper {
                border-radius: 4px;
              }
            }

            .btn-del {
              margin-left: 8px;
            }
          }
        }
      }
    }

  }

  .btn {
    display: flex;
    align-items: center;
    column-gap: 4px;
  }
}
</style>
