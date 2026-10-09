<template>
  <div :class="['option-group-control', { 'select-warn': borderWarnVisible }]">
    <el-select :modelValue="selectValue" @update:modelValue="updateValue($event)" filterable ref="treeSelect" :placeholder="$t('selectPlaceholder')"
          collapse-tags collapse-tags-tooltip :filter-method="selectFilter" :multiple="multiple"  @change="selectChange"
          popper-class="element-option-group-popper" :empty-values="['']" @visible-change="collapseTree" placement="bottom-end" :popper-options="{
            modifiers: [
              { name: 'offset', options: { offset: [0, 8] } },
            ],
          }">
          <template #label="{ label, value }">
          <span>{{ getLabel(label, value) }}</span>
        </template>
      <template #prefix>
        <el-icon :size="14" :color="'#fff'" @click.stop="clearWidgetOption" v-if="selectValue && !multiple"><i-ep-circle-close /></el-icon>
      </template>
      <el-option :value="''" :label="''" ref="targetValueRef" style="pointer-events: none;">
        <div class="tree-container" :style="{ width: treeWrapperWidth }">
          <el-tree-v2
            ref="tree"
            :empty-text="$t('treeEmpty')"
            class="element-option-group-popper"
            collapse-tags collapse-tags-tooltip
            :data="selectChoices"
            :props="{ value: 'value' }"
            :check-strictly="true"
            :filter-method="treeFilter"
            :show-checkbox="multiple"
            :default-expanded-keys="defaultExpandKeys"
            :default-checked-keys="selectValue"
            :check-on-click-node="true"
            @check-change="checkChange"
            @node-click="nodeClick"
            @mousewheel.stop="handleListMouseWheel"
            style="pointer-events: all;"
            @click.prevent.stop
          ></el-tree-v2>
        </div>
      </el-option>
      <el-option :value="node.value" :label="node.label" :title="node.label" v-for="node in selectedNode" v-show="false"></el-option>
    </el-select>
  </div>
</template>


<script setup lang="ts">
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { ALL_BOARD } from "@renderer/types";
import { inject, ref, computed, onMounted } from "vue";
import { DefinedOptionWithParsedType } from "../types";
import { Board } from "@renderer/b2/controllers/board";
import { TreeNode, TreeNodeData } from "element-plus/es/components/tree-v2/src/types";
import { useMagicKeys } from "@vueuse/core";
import i18next from "i18next";
import { isEmpty } from "@common/utils/object";

interface TreeIter {
  value: string
  label: string
  children?: TreeIter[]
}

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();

const multiple = props.option.args?.hasOwnProperty("multiple");
const types = props.option.args?.types ? props.option.args?.types.split(",") : undefined;

const allBoard = inject(ALL_BOARD);
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);

const clearWidgetOption = () => {
  updateOption(null);
}
const { ctrl } = useMagicKeys();
const tree = ref(null);
const selectedNode = computed(() => tree.value?.getCheckedNodes()|| []);
const defaultExpandKeys = computed(() => {
  const expandKeys: string[] = [];
  if (multiple) {
    if (!selectValue.value) return [];
    selectValue.value.forEach((selectVal: string) => {
      const splitVal = selectVal.split(',');
      if (splitVal.length > 1) {
        splitVal.reduce((prev, cur, index) => {
          if (index === selectVal.length -1) return;
          if (prev) {
            expandKeys.push(prev + ',' + cur);
            return prev + ',' + cur;
          } else {
            expandKeys.push(cur);
            return cur;
          }
        }, '')
      }
    })
  } else {
    const splitVal = selectValue.value.split(',');
    if (splitVal.length > 1) {
      splitVal.reduce((prev, cur, index) => {
        if (index === selectValue.value.length -1) return;
        if (prev) {
          expandKeys.push(prev + ',' + cur);
          return prev + ',' + cur;
        } else {
          expandKeys.push(cur);
          return cur;
        }
      }, '')
    }
  }
  return [ ...new Set(expandKeys) ];
})

const checkChange = (data: TreeNodeData, nodeChecked: boolean) => {
  if(ctrl.value && data.children.length){
    for(const child of data.children){
      tree.value?.setChecked(child.value, nodeChecked, false);
    }
  }
  const checkedNodes = tree.value?.getCheckedNodes();
  const optionVal = checkedNodes.map(node => node.value);
  updateValue(optionVal);
}
const selectChange = () => {
  tree.value?.setCheckedKeys(selectChoices.value);
}

const selectFilter = (query:string) => {
  tree.value?.filter(query);
}
const treeFilter = (query:string, node: TreeNode) => {
  return node.label?.toString()?.indexOf?.(query) !== -1
}
const targetValueRef = ref(null);
const nodeClick = (data: TreeNodeData, node: TreeNode) => {
  if (!multiple && (!types || node.isLeaf)) {
    targetValueRef.value.$el.click();
    updateValue(data.value);
  }
}

const collapseTree = (visible) => {
  if (visible) {
    tree.value.setExpandedKeys(defaultExpandKeys.value);
  }
}

const isValueInChoices = (choices: any[], value: string) => {
  for (const choice of choices) {
    if (choice.value === value) {
      return choice;
    }
    if (choice.children?.length > 0) {
      const result = isValueInChoices(choice.children, value);
      if (result) return result;
    }
  }
  return false;
}

const getLabel = (label: string, value: any) => {
  if (!value) {
    return '';
  }
  if (label && label !== value) {
    return label;
  } else {
    const targetElement = isValueInChoices(selectChoices.value, value);
    if (value && !targetElement) {
      return i18next.t('unknownWidget');
    }
    return targetElement?.label;
  }
}

const selectValue = computed(() => {
  if (multiple) {
    const selectElementPathArr = getOptionValue()?.map((val) => {
      const elementPathStr = val.elementPath.join(',');
      const targetElement = isValueInChoices(selectChoices.value, elementPathStr);
      if (elementPathStr && !targetElement) {
        return i18next.t('unknownWidget');
      }
      return targetElement?.value;
    })
    return selectElementPathArr;
  } else {
    const selectElementPathStr = getOptionValue()?.elementPath?.join(',') || "";
    return selectElementPathStr;
  }
});

const borderWarnVisible = computed(() => {
  return Array.isArray(selectValue.value) ? selectValue.value.includes(i18next.t("unknownWidget")) : selectValue.value === i18next.t("unknownWidget");
})

const updateValue = (value) => {
  let resultValue;
  if(multiple){
    resultValue = value.map((val)=>{
      return {
        elementPath: val?.split(","),
        __opt_type: 'element',
      }
    });
  }else{
    resultValue = {
      elementPath: value?.split(","),
      __opt_type: 'element',
    };
  }
  updateOption(resultValue);
};

const selectChoices = computed(() => {
  const selectChoices: TreeIter[] = [];

  if(allBoard.foreBoard && getBoardChoicesTree(allBoard.foreBoard)){
    selectChoices.push(getBoardChoicesTree(allBoard.foreBoard));
  }
  for (const uid in allBoard.boards) {
    const board = allBoard.boards[uid];
    if (getBoardChoicesTree(board)) {
      selectChoices.push(getBoardChoicesTree(board));
    }
  }
  if(allBoard.backBoard && getBoardChoicesTree(allBoard.backBoard)){
    selectChoices.push(getBoardChoicesTree(allBoard.backBoard));
  }
  return selectChoices;
});

const getBoardChoicesTree = (board: Board): TreeIter => {
  const choices = [];
  const widgets = board.container.getChildWidgets(true);
  for (const widget of widgets) {
    //TODO 考虑widget的父类
    if (types && !types.includes(widget.type)) {
      continue;
    }
    choices.push({
      label: widget.name,
      value: `${board.uid},${widget.uid}`
    });
  }
  if (choices.length > 0) {
    return {
      label: board.name,
      value: board.uid,
      children: choices
    };
  }
}

const handleListMouseWheel = (ev) => {
  if(!ev.ctrlKey) return;
  //ctrl键左右滚动
  const delta = ev.deltaY > 0 ? 10 : -10;
  const scrollBarDom = document.querySelector(".el-select-dropdown.element-option-group-popper .el-scrollbar .el-select-dropdown__wrap");
  scrollBarDom.scrollLeft += delta;
}

const  getMaxLevel = (arr: TreeIter[]) => {
  let maxLevel = 0;
  for (let item of arr) {
    if (Array.isArray(item.children)) {
      // 如果当前元素是一个数组，递归获取子数组的最高层级
      const childLevel = getMaxLevel(item.children);
      if (childLevel > maxLevel) {
        // 如果子数组的最高层级比当前最高层级还高，更新最高层级
        maxLevel = childLevel;
      }
    }
  }
  // 返回最高层级加上当前层级（1）
  return maxLevel + 1;
}
const firstNodeLabel = computed<string>(() => {
  const checkedNodes = tree.value?.getCheckedNodes();
  if (isEmpty(checkedNodes)) return '';
  return `"${checkedNodes[0].label}"`;
})
const treeWrapperWidth = ref('');
onMounted(() => {
  const treeLevel = getMaxLevel(selectChoices.value);
  if (treeLevel < 4) {
    treeWrapperWidth.value = '100%';
  } else {
    const restLevel = treeLevel - 3;
    treeWrapperWidth.value = `${ 158 + restLevel * 16 }px`
  }
})

</script>
<style lang="scss" scoped>
.option-group-control {
  display: flex;
  flex-direction: column;
  width: 100%;

  :deep(.el-select) {
    position: relative;
    .el-select__wrapper:hover .el-select__prefix{
      opacity: 1;
    }
    .el-select__prefix {
      opacity: 0;
      position: absolute;
      top: 50%;
      right: 30px;
      transform: translate(0, -50%);
      z-index: 99;
    }
  .el-tag {
    padding-left: 3px;

    &.is-closable .el-tag__content .el-select__tags-text {
      position: relative;
      --popper-display: none;

      &:hover {
        --popper-display: block;
      }

      @mixin pseudo-style {
        position: fixed;
        background: #1f1f22;
        border: 1px solid var(--el-border-color-light);
        z-index: 9999;
        display: var(--popper-display);
      }
      &::before {
        content: v-bind("firstNodeLabel");
        @include pseudo-style;
        width: max-content;
        font-size: 12px;
        left: 0;
        top: 29px;
        padding: 5px 10px;
        border-radius: 5px;
        color: var(--el-tag-text-color);
        max-width: 130px;
        white-space: wrap;
      }

      &::after {
        content: '';
        @include pseudo-style;
        width: 10px;
        height: 10px;
        left: 25px;
        transform: rotate(45deg);
        top: 24px;
        border-right-color: transparent;
        border-bottom-color: transparent;
      }

    }
    .el-select__tags-text {
      max-width: 50px !important;
    }
    .el-tag__close {
      margin-left: 2px;
    }
  }
}
}
</style>