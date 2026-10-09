<template>
  <vn-stack class="related-sub-form-stack" v-model="stack">
    <div class="tabs-wrapper" ref="tabsWrapperRef" v-show="isViewing && relatedSubFormEntries.length">
      <div class="scroll-button-overlay left" v-if="showLeftButton">
        <el-button link class="scroll-button" @click="scrollTab(-300)">
          <el-icon :size="16" :class="{ disabled: scrollLeft <= 0 }"><i-ep-arrow-left /></el-icon>
        </el-button>
      </div>
      <el-scrollbar ref="scrollbarRef" @scroll="onScroll">
        <div class="tabs">
          <vn-stack-tab class="form-tab" name="form">
            {{ $t("RelatedSubFormStack.currentForm") }}
            <div class="division"></div>
          </vn-stack-tab>
          <vn-stack-tab v-for="[key, value] in relatedSubFormEntries" :key="key" :name="key" lazy>
            <span :title="value.name">{{ value.name }}</span>
          </vn-stack-tab>
        </div>
      </el-scrollbar>
      <div class="scroll-button-overlay right" v-if="showRightButton">
        <el-button link class="scroll-button" @click="scrollTab(300)">
          <el-icon :class="{ disabled: scrollLeft + clientWidth >= scrollWidth }"><i-ep-arrow-right /></el-icon>
        </el-button>
      </div>
    </div>
    <div class="layers">
      <vn-stack-layer class="form-layer" name="form">
        <slot></slot>
      </vn-stack-layer>
      <vn-stack-layer v-for="[key, value] in relatedSubFormEntries" :key="key" :name="key" lazy>
        <pre-row-provider :value="preInfos[key]?.preRow" v-if="preInfos[key]">
          <nocode-permission-table :nocodeId="table.nocodeId" :tableUID="key" :addNewRowData="curAddFormDataRow"
            :preFilterRule="preInfos[key]?.preFilterRule" :isShowAggregateRow="false" :isImportDataAble="false"
            :isExportDataAble="false" :isShowTableHeaderMenu="false" permissionMode="data"
            :uid="`${table.formTableUID}-related-sub-form-${key}`"></nocode-permission-table>
        </pre-row-provider>
      </vn-stack-layer>
    </div>
  </vn-stack>
</template>

<script lang="ts" setup>
import { FormConditionValueType, LogicalOperator, RuleFunc } from '@common/types/nocode';
import { Row, TableUID } from '@common/types/project';
import { isEmpty } from '@common/utils/object';
import { useTable } from '../hooks';
import { ref, onMounted, computed, watch } from 'vue';
import { ScrollbarInstance } from 'element-plus';
import { useResizeObserver } from '@vueuse/core';
import { createFormulaRuntimeByData, evaluateFormulaWithRuntime, replaceByFormula } from '@common/utils';
import { AbstractForm } from '@renderer/b2/controllers/form';

const props = withDefaults(defineProps<{
  row: Row,
  isViewing: boolean,
  showRelatedTabs?: boolean,
}>(), {
  showRelatedTabs: true,
});

const stack = ref('form');
const table = useTable();
const scrollbarRef = ref<ScrollbarInstance>()
const tabsWrapperRef = ref<HTMLDivElement>()
const formRef = ref<AbstractForm>()
let formReadyPromise: Promise<AbstractForm> | null = null;
const relatedSubFormEntries = computed(() => {
  if (props.showRelatedTabs === false || isEmpty(table.relatedSubForm)) {
    return [];
  }
  return Object.entries(table.relatedSubForm);
})
const preInfos = computed(() => {
  const info: Record<TableUID, ReturnType<typeof getPreFilterRule>> = {};
  for (const [key, value] of relatedSubFormEntries.value) {
    info[key] = getPreFilterRule(key, value);
  }
  return info;
})
const getPreFilterRule = (key: string, value: (typeof table.relatedSubForm)[keyof typeof table.relatedSubForm]) => {
  if (isEmpty(props.row)) return null;
  const preRow = value.fields.reduce((prev, item) => {
    prev[item.uid] = [props.row[table.rowKey]];
    return prev;
  }, {});
  return {
    preRow,
    preFilterRule: {
      login: LogicalOperator.OR,
      conditions: value.fields.map(field => {
        return {
          uid: field.uid,
          func: RuleFunc.CONTAIN_ANY,
          value: [props.row?.[table.rowKey]]
        }
      })
    }
  }
}
const scrollLeft = ref(0);
const scrollWidth = ref(0);
const clientWidth = ref(0);
const hasScrollbar = ref(false);
const showLeftButton = computed(() => hasScrollbar.value && (scrollLeft.value > 0));
const showRightButton = computed(() => hasScrollbar.value && ((scrollLeft.value + clientWidth.value) < scrollWidth.value));
let timer: number | null = null;

const onScroll = (ev: { scrollLeft: number }) => {
  if (timer) clearTimeout(timer);
  timer = window.setTimeout(() => {
    scrollLeft.value = ev.scrollLeft;
  }, 100)
}

const scrollTab = (delta: number) => {
  if (!scrollbarRef.value) return;
  const left = scrollbarRef.value.wrapRef?.scrollLeft || 0;
  scrollbarRef.value.scrollTo({
    left: left + delta,
    behavior: "smooth",
  });
};

const updateScrollInfo = () => {
  if (scrollbarRef.value?.wrapRef) {
    scrollWidth.value = scrollbarRef.value.wrapRef.scrollWidth;
    clientWidth.value = scrollbarRef.value.wrapRef.clientWidth;
    scrollLeft.value = scrollbarRef.value.wrapRef.scrollLeft;
    hasScrollbar.value = scrollWidth.value > clientWidth.value;
  }
};

const ensureFormRefReady = async () => {
  if (formRef.value) return formRef.value;
  if (!formReadyPromise) {
    formReadyPromise = table.ensureFormReady().then((form) => {
      formRef.value = form;
      return form;
    }).finally(() => {
      formReadyPromise = null;
    });
  }
  return await formReadyPromise;
};

// 计算当前关联的表的添加的行数据
const curAddFormDataRow = computed(() => {
  if (isEmpty(props.row)) return null;
  const form = formRef.value;
  if (!form) return null;
  const allFillRules = form.getOption<any>("setting-related-form-fill");
  const activeFormFillRules = allFillRules?.[stack.value];
  if (isEmpty(activeFormFillRules)) return null;
  let addNewRowData: Row = {};
  for (const item of activeFormFillRules) {
    if (item.type === FormConditionValueType.FORM) {
      const curFieldId = form.getChildElement(item.currentWidget).fieldId;
      addNewRowData[item.linkageField] = props.row[curFieldId];
    } else if (item.type === FormConditionValueType.FORMULA) {
      // 公式编辑需要先计算出值
      const tempFormula = replaceByFormula(item.formula, (keys) => {
        const [sourceUID, fieldId, subFieldId] = keys;
        let fieldValue = props.row[fieldId];
        if (subFieldId) {
          const subWidgetValue = props.row[fieldId];
          fieldValue = subWidgetValue.map(subItem => {
            return subItem[subFieldId];
          })
        }
        return fieldValue;
      })
      try {
        const formulaRuntime = createFormulaRuntimeByData(props.row, form.getTableFields(form.tableUID));
        addNewRowData[item.linkageField] = evaluateFormulaWithRuntime(tempFormula, formulaRuntime);
      } catch (err) {
      }
    } else {
      addNewRowData[item.linkageField] = item.value;
    }
  }
  return addNewRowData;
})

watch(() => props.isViewing, (value) => {
  if (!value) {
    stack.value = 'form';
  }
}, { immediate: true })

watch(() => props.showRelatedTabs, (value) => {
  if (value === false) {
    stack.value = 'form';
  }
}, { immediate: true })

watch(() => stack.value, (value) => {
  if (value === 'form') return;
  if (!props.isViewing || props.showRelatedTabs === false) return;
  void ensureFormRefReady();
})

useResizeObserver(tabsWrapperRef, updateScrollInfo)

onMounted(() => {
  window.setTimeout(updateScrollInfo, 100);
});
</script>

<style lang="scss" scoped>
.related-sub-form-stack {
  height: 100%;
  min-height: 248px;
  background-color: var(--bg-color-page);
  margin-left: -12px;
  margin-right: -12px;
  padding: 0 12px;

  .tabs-wrapper {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    position: relative;

    .scroll-button-overlay {
      width: 40px;
      height: 100%;
      position: absolute;
      top: 0;
      z-index: 99;
      background-color: var(--bg-color-page);
      display: flex;
      align-items: center;
      justify-content: center;

      .scroll-button {
        width: 24px;
        height: 24px;
        outline: none;
        border-radius: 4px;
        &:hover {
          background-color: var(--bg-color-hover);
          color: var(--text-color-regular);
        }

        .el-icon {
          margin: 0 3px;
          cursor: var(--cursor-pointer);

          &.disabled {
            color: var(--text-color-disabled);
            cursor: not-allowed;
          }
        }
      }

      &.left {
        left: 0;
        box-shadow: 4px 0px 8px rgba(0, 0, 0, 0.08);
        &::before {
          content: "";
          position: absolute;
          width: 100%;
          height: 100%;
          left: -80%;
          pointer-events: none;
          z-index: 999;
          background-color: var(--bg-color-page);
        }
      }

      &.right {
        right: 0;
        box-shadow: -4px 0px 8px rgba(0, 0, 0, 0.08);
        &::after {
          content: "";
          position: absolute;
          width: 100%;
          height: 100%;
          right: -80%;
          pointer-events: none;
          z-index: 999;
          background-color: var(--bg-color-page);
        }
      }
    }

    .el-scrollbar {
      flex: 1;

      :deep(.el-scrollbar__bar) {
        display: none !important;
      }

      .tabs {
        width: fit-content;
        height: 40px;
        line-height: 40px;
        display: flex;
        align-items: center;
        column-gap: 18px;
        overflow-x: auto;
        overflow-y: hidden;

        .vn-stack-tab {
          display: block;
          cursor: pointer;
          padding: 0 6px;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;

          &.active {
            position: relative;
            color: var(--color-primary);

            &::after {
              content: '';
              position: absolute;
              width: 100%;
              height: 2px;
              bottom: 0px;
              left: 0;
              background-color: var(--color-primary);
            }
          }

          &.form-tab {
            display: flex;
            align-items: center;
            position: relative;
            overflow: unset;

            .division {
              position: absolute;
              right: -15px;
              top: 50%;
              transform: translateY(-50%);
              border-left: 1px solid var(--border-color-light);
              margin: 0 5px;
              height: 20px;
            }
          }
        }
      }
    }
  }

  .layers {
    height: 100%;

    .vn-stack-layer {
      height: calc(100% - 40px);
      padding: 12px 0;

      &.form-layer {
        height: 100%;
        margin: 0 -16px;
        padding: 0;
      }
    }
  }
}
</style>
