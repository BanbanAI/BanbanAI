<template>
  <div class="table-filter" :class="{'fixed-filter': displayMode === 'fixed'}">
    <!-- popover -->
    <template v-if="displayMode === 'popover'">
      <el-popover :visible="visible" :persistent="false" placement="bottom-end" :width="680" :popper-class="`table-filter-popover ${popoverClassId}`" :disabled="isDrawerVisible" @before-enter="popoverShow" @before-leave="popoverHide" ref="popoverRef"
        @show="handlePopoverShow"
      >
        <div class="header">
          <h4>{{ $t('TableFilter.filter') }}</h4>
          <div class="menus" v-if="tableProps.isChangeFilterDisplayMode && !isMobileDevice">
            <el-button link @click="widget.filterDisplayMode = 'fixed'">
              <el-icon :size="16"><i-table-fixed-right/></el-icon>
            </el-button>
          </div>
        </div>
        <div class="logic" v-if="filterRule">
          <span class="logic-text">{{ $t('TableFilter.filterSatisfy') }}</span>
          <el-select class="logic-select" size="small" v-model="filterRule.logic" :suffix-icon="CaretBottom" :teleported="false" :persistent="false"
            :no-data-text="$t('TableFilter.noData')">
            <el-option v-for="item in logicOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <div class="logic-text">{{ $t('TableFilter.conditionData') }}</div>
        </div>
        <el-scrollbar v-if="filterRule?.conditions?.length" class="filter-scrollbar" ref="filterScrollbarRef" noresize>
          <el-config-provider :locale="locale">
            <ul class="filter-rule-list">
              <li class="filter-rule" v-for="(condition, index) in filterRule.conditions">
                <field-select
                  v-model="condition.uid"
                  :options="options"
                  style="width: 160px"
                  popper-class="table-filter-inner-popover"
                  @change="handleFieldChange(condition)"
                />
    
                <el-select v-model="condition.func" placeholder="Select" style="width: 104px" popper-class="table-filter-inner-popover" :persistent="false" @change="handleFuncChange(condition)">
                  <el-option v-for="value, key in filterMenus(condition.uid)" :key="key"
                    :label="getFuncTextLabel(key, condition.uid)" :value="key" />
                </el-select>
    
                <filter-value-format
                  :appendTo="popoverEl"
                  :teleported="true"
                  v-model="condition.value"
                  :element="getInstance(condition.uid)"
                  :fieldId="condition.uid"
                  :type="funcValue(condition.uid, condition.func)"
                  style="flex: 1"
                  :placeholder="$t('TableFilter.input')"
                  v-if="isShowValue(condition)"
                />
                <div class="btn-del" @click="filterRule.conditions.splice(index, 1)">
                  <el-icon>
                    <Delete />
                  </el-icon>
                </div>
              </li>
            </ul>
          </el-config-provider>
        </el-scrollbar>

        <div class="button-container">
          <field-selector :options="options" :teleported="false" :close-on-select="true"
            @select="handleAdd">{{ $t('TableFilter.addFilterField') }}</field-selector>
          <el-button class="button clear" size="small" text @click="handelClear">{{ $t('TableFilter.clear') }}</el-button>
          <el-button class="button" size="small" type="primary" @click="visible = false">{{ $t('TableFilter.filter') }}</el-button>
        </div>
        <template #reference>
          <div :class="['btn', { changed: hasFilter, active: isDrawerFilterActive, 'icon-only': props.iconOnly }]" @click="handleButtonClick" ref="btnRef" :title="buttonText">
            <el-icon size="16"><i-table-filter /></el-icon>
            <span v-if="!props.iconOnly">{{ buttonText }}</span>
          </div>
        </template>
      </el-popover>
    </template>

    <!-- fixed -->
    <template v-if="tableProps.isChangeFilterDisplayMode && !isMobileDevice && displayMode === 'fixed'">
      <div class="table-filter-popover fixed-container" ref="popoverRef">
        <div class="header">
          <h4><el-icon size="16"><i-table-filter /></el-icon>{{ $t('TableFilter.filter') }}</h4>
          <div class="menus">
            <el-button link @click="widget.filterDisplayMode = 'popover'">
              <el-icon :size="16"><i-ep-close /></el-icon>
            </el-button>
          </div>
        </div>
        <div class="logic" v-if="filterRule">
          <span class="logic-text">{{ $t('TableFilter.filterSatisfy') }}</span>
          <el-select class="logic-select" size="small" v-model="filterRule.logic" :suffix-icon="CaretBottom" :teleported="false" :persistent="false"
            :no-data-text="$t('TableFilter.noData')">
            <el-option v-for="item in logicOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <div class="logic-text">{{ $t('TableFilter.conditionData') }}</div>
        </div>
        <el-scrollbar v-if="filterRule?.conditions?.length" class="filter-scrollbar" ref="filterScrollbarRef" noresize>
          <el-config-provider :locale="locale">
            <ul class="filter-rule-list">
              <li class="filter-rule" v-for="(condition, index) in filterRule.conditions">
                
                <div class="filter-field">
                  <field-select
                    v-model="condition.uid"
                    :options="options"
                    popper-class="table-filter-inner-popover"
                    @change="handleFieldChange(condition)"
                  />
      
                  <el-select v-model="condition.func" placeholder="Select" popper-class="table-filter-inner-popover" :persistent="false" @change="handleFuncChange(condition)">
                    <el-option v-for="value, key in filterMenus(condition.uid)" :key="key"
                      :label="getFuncTextLabel(key, condition.uid)" :value="key" />
                  </el-select>

                  <div class="btn-del" v-if="!isShowValue(condition)" @click="filterRule.conditions.splice(index, 1)">
                    <el-icon>
                      <Delete />
                    </el-icon>
                  </div>
                </div>
    
                <div class="filter-value" v-if="isShowValue(condition)">
                  <filter-value-format
                    :appendTo="popoverEl"
                    :teleported="true"
                    v-model="condition.value"
                    :element="getInstance(condition.uid)"
                    :fieldId="condition.uid"
                    :type="funcValue(condition.uid, condition.func)"
                    style="flex: 1"
                    :placeholder="$t('TableFilter.input')"
                  />
                  <div class="btn-del" @click="filterRule.conditions.splice(index, 1)">
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
            @select="handleAdd">{{ $t('TableFilter.addFilterField') }}</field-selector>
        </div>
        <div class="button-container">
          <el-button class="button clear" size="small" text @click="handelClear">{{ $t('TableFilter.clear') }}</el-button>
          <el-button class="button" size="small" type="primary" @click="popoverHide">{{ $t('TableFilter.filter') }}</el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang='ts' setup>
import { computed, inject, onBeforeUnmount, onUnmounted, ref, onMounted, nextTick, watch } from 'vue';
import { Delete, CaretBottom } from "@element-plus/icons-vue";
import { deepClone, equals, isEmpty } from '@common/utils/object';
import { useTable, useTableProps } from '../hooks';
import { FormCondition, RuleFunc, RuleFuncValue } from '@common/types/nocode';
import { unique } from '@common/utils/unique';
import { LogicalOperator } from '@renderer/b2/types';
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";
import { FilterRule } from '@common/types/nocode';
import { PopoverInstance } from 'element-plus';
import { isMobile } from "@renderer/utils";
import i18next from 'i18next';
import { VIEW_SETTING_DRAWER_PANEL_STATE } from '@renderer/types';
import { FilterOption, buildFilterOptions, createOptionFilterTarget, getFilterDefaultValue, getFilterFuncInfo, getFilterFuncTextLabel, getFilterFuncValue, isFilterValueVisible, useFilterElementResolver } from '../filter';

const isMobileDevice = isMobile();

const props = withDefaults(defineProps<{
  labelKey?: string,
  iconOnly?: boolean,
}>(), {
  labelKey: 'TableFilter.filter',
  iconOnly: false,
});

const widget = useTable();
const tableProps = useTableProps();
const viewSettingDrawerPanelState = inject(VIEW_SETTING_DRAWER_PANEL_STATE, null);
const visible = ref(false)
const btnRef = ref<HTMLElement>();
const popoverRef = ref<PopoverInstance>();
const popoverClassId = unique();
const filterScrollbarRef = ref();
const { resolveInstance: resolveFilterInstance, getInstance: getResolvedInstance } = useFilterElementResolver((elementId) => {
  return elementId ? widget.getInstanceById(elementId) : undefined;
});
const logicOptions = [
  {
    value: LogicalOperator.AND,
    get label() { return i18next.t('TableFilter.all') },
  },
  {
    value: LogicalOperator.OR,
    get label() { return i18next.t('TableFilter.one') },
  },
];
const popoverEl = computed(() => {
  return popoverRef.value.popperRef?.contentRef;
})
const displayMode = computed(() => widget.filterDisplayMode);

const options = computed<FilterOption[]>(() => {
  return buildFilterOptions(widget.allColumns, {
    excludeCurrentOwner: true,
  });
})

const hasFilter = computed(() => {
  const hasFilter = widget.filterRule?.conditions.some(cond => (
    [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY].includes(cond.func)
    || !isEmpty(cond.value)
  ));
  return hasFilter;
})

const isDrawerVisible = computed(() => {
  return !!viewSettingDrawerPanelState?.value.visible;
})

const isDrawerFilterActive = computed(() => {
  return !!viewSettingDrawerPanelState?.value.visible && viewSettingDrawerPanelState.value.activeMenu === 'filter';
})

const buttonText = computed(() => i18next.t(props.labelKey));

const handleButtonClick = () => {
  if (isDrawerVisible.value) return;
  visible.value = !visible.value;
}

const isShowValue = (condition: FormCondition) => {
  return isFilterValueVisible(condition.func, [RuleFunc.TRUE, RuleFunc.FALSE]);
}

const onClickOutside = (ev) => {
  if (!visible.value) return;
  const target: HTMLElement = ev.target;
  if (btnRef.value?.contains(target)) return;
  const innerPopovers = document.querySelectorAll(".table-filter-inner-popover");
  for (const innerPopover of innerPopovers) {
    if (innerPopover.contains(target)) return;
  }
  const popovers = document.querySelectorAll(`.table-filter-popover`);

  if (popovers) {
    for (const popover of popovers) {
      if (popover.contains(target)) return;
    }
  }
  visible.value = false;
}
document.addEventListener('click', onClickOutside, true);
onBeforeUnmount(() => {
  visible.value = false;
});
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true);
});

const filterRule = ref<FilterRule>();
const popoverShow = () => {
  filterRule.value = deepClone(widget.filterRule);
}

const popoverHide = () => {
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

  nextTick(() => {
    const scrollbar = filterScrollbarRef.value;
    if (scrollbar && scrollbar.wrapRef) {
      scrollbar.wrapRef.scrollTop = scrollbar.wrapRef.scrollHeight;
    }
  });
}

const handelClear = () => {
  filterRule.value.conditions = [];
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

const getFuncTextLabel = (key, fieldId) => {
  return getFilterFuncTextLabel(key, getInstance(fieldId));
}
const resolveInstance = async (fieldId: string) => {
  const option = options.value?.find(item => item.value === fieldId);
  await resolveFilterInstance(createOptionFilterTarget(fieldId, option));
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

watch(isDrawerVisible, (value) => {
  if (value) {
    visible.value = false;
  }
}, { immediate: true })

onMounted(() => {
  if (displayMode.value === "fixed") {
    popoverShow();
  }
});

const handlePopoverShow = async () => {
  await widget.ensureFormReady();
}

watch(
  () => filterRule.value?.conditions?.map(condition => condition.uid) || [],
  (uids) => {
    uids.forEach((uid) => {
      void resolveInstance(uid);
    });
  },
  { immediate: true }
)

defineExpose({
  open: () => {
    if (isDrawerVisible.value) return;
    visible.value = true;
  }
})
</script>

<style lang="scss" scoped>
.table-filter {
  .btn {
    padding: 6px 8px;
    border-radius: 4px;
    display: flex;
    font-size: 14px;
    align-items: center;
    transition: all 0.3s ease;

    .el-icon {
      margin-right: 3px;
    }

    &.icon-only {
      padding: 6px;

      .el-icon {
        margin-right: 0;
      }
    }

    &.changed,
    &.active {
      color: var(--color-primary);
      background-color: var(--color-primary-light-9);
    }

    &:hover {
      color: var(--color-primary);
      background-color: var(--bg-color-overlay);
    }

  }

  &.fixed-filter {
    height: 100%;
  }
}

.table-filter-popover.fixed-container {
  width: 360px;
  // width: calc(360px + 16px);
  height: 100%;
  padding: 24px 20px;
  padding-bottom: 64px;
  background-color: var(--bg-color-page);
  position: relative;

  .header {
    h4 {
      font-size: 14px;
      line-height: 20px;
      font-weight: 400;
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  .button-container {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    padding: 16px;
    border-top: 1px solid var(--border-color);
  }

  .filter-scrollbar {
    height: auto;
    max-height: unset;
    
    :deep(.el-scrollbar__wrap) {--offset: calc(100vh - 200px);
      max-height: calc(var(--offset, 100%) - 134px);

      .filter-rule-list {
        display: flex;
        gap: 24px;
        .filter-rule {
          flex-direction: column;
          > div {
            display: flex;
            gap: 8px;
          }
          .filter-field > div:nth-child(2) {
            max-width: 128px;
            width: 100%;
          }
        }
      }
    }
  }
}
</style>
<style lang='scss'>
.table-filter-popover {
  --el-bg-color-overlay: var(--bg-color-page);
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

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .logic {
    display: flex;
    align-items: center;
    column-gap: 4px;
    margin-bottom: 8px;

    .logic-select {
      width: 60px;
      @include diy-select;
      background-color: var(--bg-color-overlay);
    }

  }

  .filter-scrollbar {
    max-height: 312px;
    margin-bottom: 16px;

    .el-scrollbar__wrap {
      max-height: 312px;

      .filter-rule-list {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .filter-rule {
          display: flex;
          gap: 8px;

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



  .button-container {
    display: flex;
    align-items: flex-end;

    .button {
      border-radius: 4px;
      width: 60px;
      height: 32px;
      border: 1px solid var(--border-color);

      &.clear {
        margin-left: auto;
      }

      &.el-button--primary {
        border: 0px solid var(--border-color);
      }
    }

  }
}

</style>
