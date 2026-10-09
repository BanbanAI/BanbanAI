<template>
  <b2-widget class='drop-body'>
    <div class="drop-body-header">
      <div class="drop-header-title">
        <span class="title" v-if="widget.customWidgetTitleEnabled" :style="titleStyle">{{ widget.widgetTitle }}</span>
      </div>
      <div class="func-dropdown-trigger" v-if="widget.linkageOut">
        <el-popover :visible="funcSelectPopoverVisible" trigger="click" :show-arrow="false" popper-class="func-dropdown-option-popper">
          <template #reference>
            <el-button link class="func-dropdown-trigger-btn" @click="funcSelectPopoverVisible = !funcSelectPopoverVisible">
              {{ RuleFuncTextMapping[selectedFunc] }}
              <el-icon :size="16"><CaretBottom /></el-icon>
            </el-button>
          </template>
          <template #default>
            <el-scrollbar max-height="200px">
              <div class="func-dropdown-option-item" :class="{ 'active-func': item.value === selectedFunc }"
                v-for="item in funcOptions" :key="item.value"
                @click="handleClickFuncItem(item.value)"
              >
                {{ item.label }}
              </div>
            </el-scrollbar>
          </template>
        </el-popover>
      </div>
    </div>
    <div class="drop-body-container" :style="paddingStyle">
      <slot name="container">
        <filter-widget-value-format v-show="!emptyFunc.includes((selectedFunc))" v-model="widget.selectedItem" :widget="widget" :type="widget.relationshipElementFunc[selectedFunc]"></filter-widget-value-format>
      </slot>
    </div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { RuleFunc, RuleFuncTextMapping } from "@common/types/nocode";
import { OptionFileValue, OptionFontValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { computed, CSSProperties, inject, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useWidget } from "@renderer/b2/types";
import { equals, isEmpty } from '@common/utils/object';
import { DataFilter } from "./filter";
import { CaretBottom } from '@element-plus/icons-vue'
import FilterWidgetValueFormat from "./FilterWidgetValueFormat.vue";

const widget = useWidget<DataFilter>();
const funcOptions = computed(() => {
  if (isEmpty(widget.relationshipElementFunc)) return [{ label: RuleFuncTextMapping[RuleFunc.EQUAL], value: RuleFunc.EQUAL }];
  return Object.keys(widget.relationshipElementFunc).map(key => { return { label: RuleFuncTextMapping[key], value: key } });
})

const paddingStyle = computed(()=>{
  let paddingTop = widget.getOption<string>("padding-top") == "auto" ? 4 : widget.getOption<number>("padding-top-diy");
  let paddingRight = widget.getOption<string>("padding-right") == "auto" ? 8 : widget.getOption<number>("padding-right-diy");
  let paddingBottom = widget.getOption<string>("padding-bottom") == "auto" ? 10 : widget.getOption<number>("padding-bottom-diy");
  let paddingLeft = widget.getOption<string>("padding-left") == "auto" ? 8 : widget.getOption<number>("padding-left-diy");
  return {
    paddingTop: `${paddingTop}px`,
    paddingBottom: `${paddingBottom}px`,
    paddingLeft: `${paddingLeft}px`,
    paddingRight: `${paddingRight}px`,
  }
})

// 右上角的func的面板弹窗控制
const funcSelectPopoverVisible = ref(false);
const selectedFunc = toRef(widget, 'relationshipFilterFunc');
const handleClickFuncItem = (value) => {
  selectedFunc.value = value;
  funcSelectPopoverVisible.value = false;
  if (widget.isRange) {
    widget.selectedItem = [];
  } else {
    widget.selectedItem = null;
  }
  if (emptyFunc.includes((selectedFunc.value))) {
    widget.applyFilter({
      value: widget.selectedItem,
      func: selectedFunc.value,
      linkageFields: widget.relationshipField.linkageFields,
    })
  } else if (!widget.selectedItem || isEmpty(widget.selectedItem)) {
    widget.withdrawFilter();
  }
}
const onClickOutSideFuncPopover = (ev) => {
  if (!funcSelectPopoverVisible.value) return;
  if (ev.target.closest(".func-dropdown-trigger-btn")) return;
  if (ev.target.closest(".func-dropdown-option-popper")) return;
  funcSelectPopoverVisible.value = false;
}
document.addEventListener("click", onClickOutSideFuncPopover, true);
onUnmounted(() => {
  document.removeEventListener("click", onClickOutSideFuncPopover, true);
});

const emptyFunc = [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE]
const selectSingleChange = (val) => {
  if (!isEmpty(val)) {
    if (widget.isRange && isEmpty(val[0]) && isEmpty(val[1])) {
      widget.withdrawFilter();
    } else {
      widget.applyFilter({
        value: val,
        func: selectedFunc.value,
        linkageFields: widget.relationshipField.linkageFields,
      })
    }
  } else {
    if (emptyFunc.includes((selectedFunc.value))) {
      widget.applyFilter({
        value: val,
        func: selectedFunc.value,
        linkageFields: widget.relationshipField.linkageFields,
      })
    } else {
      widget.withdrawFilter();
    }
  }
}

watch(() => widget.selectedItem, (val) => {
  selectSingleChange(val);
})

watch(() => widget.relationshipFilterFunc, (val, oldVal) => {
  if (val !== oldVal) {
    handleClickFuncItem(val);
  }
})

// 自定义标题样式
const titleStyle = computed<CSSProperties>(() => {
  const titleFont = widget.getOption<OptionFontValue>("custom-widget-font");

  return {
    fontFamily: titleFont.family,
    fontSize: titleFont.size + "px",
    color: titleFont.color as string,
    fontWeight: titleFont.bold ? 'bold' : 'normal',
    fontStyle: titleFont.italic ? 'italic' : 'normal',
    textDecoration: `${titleFont.underline ? "underline" : ""} ${titleFont["line-through"] ? "line-through" : ""}`,
    letterSpacing: widget.getOption("custom-widget-font-spacing") + "px"
  }
});
</script>

<style lang="scss" scoped>
:deep(.el-input__prefix-inner) {
  pointer-events: inherit !important;
}

.drop-body {
  :deep(.b2widget-body) {
    overflow: visible !important;
  }

  .drop-body-header {
    width: calc(100% - 16px);
    height: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 4px 8px 0 8px;
    .drop-header-title {
      .title {
        padding: 0;
      }
    }

    .func-dropdown-trigger {
      display: flex;
      justify-content: flex-end;
      .func-dropdown-trigger-btn {
        height: 24px;
        border-radius: 4px;
        .el-icon {
          margin-left: 4px;
        }
      }
    }
  }

}

</style>

<style lang="scss">
.func-dropdown-option-popper {
  padding: 6px !important;
  border-radius: 8px !important;
  background-color: #fff !important;
  .func-dropdown-option-item {
    width: 100%;
    height: 36px;
    display: flex;
    align-items: center;
    border-radius: 4px;
    padding: 0 12px;
    &:hover {
      background-color: #f2f3f5;
    }
    &.active-func {
      // background-color: #e7f1ff;
      color: var(--color-primary);
    }
  }
}
</style>