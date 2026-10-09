<template>
  <div class="dataManagement-filter-setting">
    <div class="logic" v-if="filterRule">
      <span class="logic-text">{{ $t('DataManagementFilterSetting.filterSatisfy') }}</span>
      <el-select class="logic-select" size="small" v-model="filterRule.logic" :suffix-icon="CaretBottom"
        :no-data-text="$t('DataManagementFilterSetting.noData')">
        <el-option v-for="item in logicOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <div class="logic-text">{{ $t('DataManagementFilterSetting.conditionData') }}</div>
    </div>

    <el-scrollbar class="filter-scrollbar" ref="filterScrollbarRef">
      <el-config-provider :locale="locale">
        <ul class="filter-rule-list">
          <li class="filter-rule" v-for="(condition, index) in filterRule.conditions">
            <div class="filter-field">
              <el-select v-model="condition.uid" popper-class="table-filter-inner-popover" @change="handleFieldChange(condition)">
                <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
  
              <el-select v-model="condition.func" placeholder="Select" popper-class="table-filter-inner-popover" @change="handleFuncChange(condition)">
                <el-option v-for="value, key in filterMenus(condition.uid)" :key="key"
                  :label="getFuncTextLabel(key, condition.uid)" :value="key" />
              </el-select>

              <div class="btn-del" v-if="!isShowValue(condition)" @click.stop="filterRule.conditions.splice(index, 1)">
                <el-icon>
                  <Delete />
                </el-icon>
              </div>
            </div>

            <div class="filter-value" v-if="isShowValue(condition)">
              <form-filter-value-format
                v-if="props.widget"
                v-model="condition.value"
                :element="getInstance(condition.uid)"
                :selectElementUid="options.find(item => item.value === condition.uid)?.column?.elementId"
                :fieldId="condition.uid"
                :type="funcValue(condition.uid, condition.func)"
                :widget="props.widget"
                style="flex: 1"
                :otherTableFieldUID="props.widget?.tableUID"
                :placeholder="$t('DataManagementFilterSetting.input')"
                :useDistinctEntityOptions="true"
              />
              <div class="btn-del" @click.stop="filterRule.conditions.splice(index, 1)">
                <el-icon>
                  <Delete />
                </el-icon>
              </div>
            </div>
          </li>
        </ul>
      </el-config-provider>
    </el-scrollbar>
    
    <div class="add-container">
      <field-selector :options="options" :teleported="false" :close-on-select="true"
        @select="handleAdd">{{ $t('DataManagementFilterSetting.addFilterField') }}</field-selector>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { FilterRule, FormCondition, LogicalOperator, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";
import { cloneDeep } from "lodash";
import { computed, nextTick, ref, watch } from "vue";
import { Delete, CaretBottom } from "@element-plus/icons-vue";
import i18next from "i18next";
import type { Column } from "../table";
import { TableUID } from "@common/types/project";
import type { AbstractForm } from "@renderer/b2/controllers/form";
import { FilterOption, buildFilterOptions, createOptionFilterTarget, getFilterDefaultValue, getFilterFuncInfo, getFilterFuncTextLabel, getFilterFuncValue, isFilterValueVisible, useFilterElementResolver } from "../filter";

const props = defineProps<{
  tableUid: TableUID,
  columns: Column[],
  widget?: AbstractForm;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: FilterRule];
}>();

const logicOptions = [
  {
    value: LogicalOperator.AND,
    get label() { return i18next.t('DataManagementFilterSetting.all') },
  },
  {
    value: LogicalOperator.OR,
    get label() { return i18next.t('DataManagementFilterSetting.one') },
  },
];
const filterScrollbarRef = ref();
const filterRule = ref<FilterRule>({
  logic: LogicalOperator.AND,
  conditions: []
});
const { resolveInstance: resolveFilterInstance, getInstance: getResolvedInstance } = useFilterElementResolver((elementId) => {
  return elementId ? props.widget?.getChildElement?.(elementId) : undefined;
});

// 监听 filterRule 变化，触发 v-model 更新
watch(filterRule, (newVal) => {
  emit('update:modelValue', cloneDeep(newVal));
}, { deep: true });
const options = computed<FilterOption[]>(() => {
  return buildFilterOptions(props.columns, {
    excludeTopLevelRelated: true,
    excludeCurrentOwner: true,
  });
});

const resolveInstance = async (fieldId: string) => {
  const option = options.value?.find(item => item.value === fieldId);
  await resolveFilterInstance(createOptionFilterTarget(fieldId, option));
};

const getInstance = (fieldId: string) => {
  const option = options.value?.find(option => option.value === fieldId);
  return getResolvedInstance(createOptionFilterTarget(fieldId, option));
};
const isShowValue = (condition: FormCondition) => {
  return isFilterValueVisible(condition.func, [RuleFunc.TRUE, RuleFunc.FALSE]);
}

const handleAdd = (option: FilterOption) => {
  const funcs = filterMenus(option.value);
  filterRule.value.conditions.push({
    uid: option.value,
    func: (Object.keys(funcs)[0]) as RuleFunc || RuleFunc.EQUAL,
    value: "",
  })

  nextTick(() => {
    const scrollbar = filterScrollbarRef.value;
    if (scrollbar && scrollbar.wrapRef) {
      scrollbar.wrapRef.scrollTop = scrollbar.wrapRef.scrollHeight;
    }
  });
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

const getFuncTextLabel =(key, fieldId) => {
  return getFilterFuncTextLabel(key, getInstance(fieldId));
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
watch(
  () => filterRule.value.conditions.map(condition => condition.uid),
  (uids) => {
    uids.forEach((uid) => {
      void resolveInstance(uid);
    });
  },
  { immediate: true }
);

// 暴露给父组件的方法
defineExpose({
  initValue: (value?: FilterRule) => {
    if (value) {
      filterRule.value = {
        logic: value.logic || LogicalOperator.AND,
        conditions: value.conditions ? cloneDeep(value.conditions) : []
      };
      emit('update:modelValue', cloneDeep(filterRule.value));
    }
  },
  getValue: (): FilterRule => {
    return cloneDeep(filterRule.value);
  },
  clearValue: () => {
    filterRule.value = {
      logic: LogicalOperator.AND,
      conditions: []
    };
    emit('update:modelValue', cloneDeep(filterRule.value));
  }
});


</script>

<style lang="scss" scoped>
.dataManagement-filter-setting {
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
  
  .logic {
    display: flex;
    align-items: center;
    column-gap: 4px;
    margin-bottom: 8px;
    font-size: 14px;
    line-height: 22px;

    :deep(.logic-select) {
      width: 60px;
      @include diy-select;
      background-color: var(--bg-color-overlay);
    }
  }

  .filter-scrollbar {
    height: auto;
    max-height: unset;
    :deep(.el-scrollbar__wrap) {
      --offset: calc(100vh - 200px);
      max-height: 100%;

      .filter-rule-list {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .filter-rule {
          display: flex;
          gap: 8px;
          flex-direction: column;
          
          > div {
            display: flex;
            gap: 8px;
          }
          
          .filter-field > div:nth-child(2) {
            max-width: 128px;
            width: 100%;
          }

          .logic {
            width: 46px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .el-select {
            .el-select__wrapper {
              border-radius: 4px;
            }
          }

          .el-input {
            .el-input__wrapper {
              border-radius: 4px;
            }
          }

          .btn-del {
            height: 32px;
            width: 32px;
            border-radius: 4px;
            transition: all 0.3s ease;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-left: auto;
            flex-shrink: 0;

            &:hover {
              background-color: var(--bg-color-overlay);
            }
          }
        }
      }
    }
  }
}
</style>
