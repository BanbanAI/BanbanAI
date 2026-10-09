<template>
  <div :class="['option-group-control', { 'select-warn': borderWarnVisible }]">
    <el-select :modelValue="selectValue" @update:modelValue="updateValue($event)" filterable ref="treeSelect" :placeholder="$t('selectPlaceholder')"
          collapse-tags collapse-tags-tooltip :filter-method="selectFilter" :multiple="multiple"  @change="selectChange" size="small"
          popper-class="element-option-group-popper" :empty-values="['']" @visible-change="collapseTree" placement="bottom-end" :popper-options="{
            modifiers: [
              { name: 'offset', options: { offset: [0, 8] } },
            ],
          }">
        <template #label="{ label, value }">
          <span :title="label">{{ getLabel(label, value) }}</span>
        </template> 
      <template #prefix>
        <el-icon :size="14" :color="'#fff'" @click.stop="clearElementOption" v-if="selectValue && !multiple"><i-ep-circle-close /></el-icon>
      </template>
      <el-option class="current-widget" :value="activeElementChoice.value" :label="activeElementChoice.label" :title="activeElementChoice.label" v-if="useCurrentWidget && activeElementChoice" />
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
            :current-node-key="(selectValue as string)"
            :default-checked-keys="(selectValue as string[])"
            :check-on-click-node="true"
            :expand-on-click-node="false"
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
import { ALL_BOARD, ACTIVE_ELEMENT, PICKED_ELEMENT, IS_PICKING_ELEMENT} from "@renderer/types";
import { inject, computed, ref, onMounted, watch } from "vue";
import { DefinedOptionWithParsedType } from "../types";
import { Widget } from "@renderer/b2/controllers/widget";
import { Board } from "@renderer/b2/controllers/board";
import { useMagicKeys } from "@vueuse/core";
import { TreeNode, TreeNodeData } from "element-plus/es/components/tree-v2/src/types";
import i18next from "i18next";
import {isEmpty} from '@common/utils/object'

interface TreeIter {
  value: string
  label: string
  path: string
  children?: TreeIter[]
}

const props = defineProps<{
  option: DefinedOptionWithParsedType,
  allowPick: boolean,
}>();

const multiple = props.option.args?.hasOwnProperty("multiple");
const types = props.option.args?.types ? props.option.args?.types.split(",") : undefined;
const useCurrentWidget = props.option.args?.hasOwnProperty("currentWidget");

const allBoard = inject(ALL_BOARD, {});
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);
const activeElement = inject(ACTIVE_ELEMENT);

const clearElementOption = () => {
  updateOption(null);
}

const { ctrl } = useMagicKeys();
const tree = ref(null);
const targetValueRef = ref(null);
const selectedNode = computed(() => tree.value?.getCheckedNodes()|| []);
const defaultExpandKeys = computed(() => {
  const expandKeys: string[] = [];
  if (multiple) {
    if (isEmpty(selectValue.value?.length)) return [];
    (selectValue.value as string[]).forEach((selectVal) => {
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
    const splitVal = (selectValue.value as string)?.split(',');
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
      tree.value.setChecked(child.value, nodeChecked, false);
    }
  }
  const checkedNodes = tree.value.getCheckedNodes();
  const optionVal = checkedNodes.map(node => node.value);
  updateValue(optionVal);
}
const selectChange = () => {
  tree.value.setCheckedKeys(selectChoices.value);
}

const selectFilter = (query:string) => {
  tree.value?.filter(query)
}
const treeFilter = (query:string, node: TreeNode) => {
  return node.label?.toString()?.indexOf?.(query) !== -1
}
const nodeClick = (data: TreeNodeData, node: TreeNode) => {
  if (!multiple && (!types || node.isLeaf)) {
    targetValueRef.value.$el.click();
    updateValue(data.value);
  }
}

const collapseTree = (visible) => {
  if (visible) {
    tree.value?.setExpandedKeys(defaultExpandKeys.value);
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

const selectValue = computed<string[] | string>(() => {
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

const activeElementChoice = computed(() => {
  if (!activeElement.value) return;
  let uidPath: string;
  if (activeElement.value instanceof Board) {
    uidPath = activeElement.value.uid;
  } else if (activeElement.value instanceof Widget) {
    uidPath = `${activeElement.value.getBoard().uid},${activeElement.value.uid}`;
  }
  return {
    label: i18next.t("ElementOption.currentElement"),
    value: uidPath,
    path: uidPath,
  }
});

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

  if(allBoard.foreBoard){
    selectChoices.push(getBoardChoicesTree(allBoard.foreBoard));
  }
  for (const uid in allBoard.boards) {
    const board = allBoard.boards[uid];
    selectChoices.push(getBoardChoicesTree(board));
  }
  if(allBoard.backBoard){
    selectChoices.push(getBoardChoicesTree(allBoard.backBoard));
  }
  return selectChoices;
});

const getBoardChoicesTree = (board: Board): TreeIter => {
  const choices = [];
  const widgets = useCurrentWidget ? board.container.getChildWidgets(true) : board.container.getChildWidgets(true).filter(widget => widget.uid !== activeElement.value.uid);
  for (const widget of widgets) {
    //TODO 考虑widget的父类
    if (types && !types.includes(widget.type)) {
      continue;
    }
    choices.push({
      label: widget.name,
      value: `${board.uid},${widget.uid}`,
      path: `${board.uid},${widget.uid}`,
    });
  }
  return {
    label: board.name,
    value: board.uid,
    path: board.uid,
    children: choices
  };
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

// 第一个选项的label文字
// const firstNodeLabel = computed<string>(() => {
//   const checkedNodes = tree.value?.getCheckedNodes();
//   if (isEmpty(checkedNodes)) return '';
//   return `"${checkedNodes[0].label}"`;
// })
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

if (props.allowPick) {
  const pickedElement = inject(PICKED_ELEMENT);
  const isPickingElement = inject(IS_PICKING_ELEMENT);
  watch(() => pickedElement.value, (value, oldValue) => {
    if (!isPickingElement.value) return;
    if (value && oldValue) {
      const key = value.elementUID.join();
      if (multiple) {
        if (selectValue.value.includes(key)) return;
      } else {
        if (selectValue.value === key) return;
      }
      tree.value.setChecked(key, true);
      if (multiple) {
        const checkedNodes = tree.value.getCheckedNodes();
        const optionVal = checkedNodes.map(node => node.value);
        updateValue(optionVal);
      } else {
        updateValue(key);
      }
    }
  })
}

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
    .el-select__selection {
      flex-wrap: nowrap;
    }

    .el-tag {
      padding-left: 3px;

      &.is-closable .el-tag__content .el-select__tags-text {
        position: relative;
        --popper-display: none;

        &:hover {
          --popper-display: block;
        }

        // @mixin pseudo-style {
        //   position: fixed;
        //   background: #1f1f22;
        //   border: 1px solid var(--el-border-color-light);
        //   z-index: 9999;
        //   display: var(--popper-display);
        // }
        // &::before {
        //   content: v-bind("firstNodeLabel");
        //   @include pseudo-style;
        //   width: max-content;
        //   font-size: 12px;
        //   left: 0;
        //   top: 29px;
        //   padding: 5px 10px;
        //   border-radius: 5px;
        //   color: var(--el-tag-text-color);
        //   max-width: 130px;
        //   white-space: wrap;
        // }

        // &::after {
        //   content: '';
        //   @include pseudo-style;
        //   width: 10px;
        //   height: 10px;
        //   left: 25px;
        //   transform: rotate(45deg);
        //   top: 24px;
        //   border-right-color: transparent;
        //   border-bottom-color: transparent;
        // }

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
<style lang="scss">
.el-popper.element-option-group-popper{
  --el-bg-color-overlay: var(--el-fill-color-blank);
  outline: none;
  .el-select-dropdown.element-option-group-popper {
    width: 320px;
    .el-scrollbar {
      width: 100%;
      .el-scrollbar__view {
        min-width: 100%;
        width: fit-content;
        .el-select-dropdown__item{
          height: fit-content;
          user-select: none;
          overflow-y: auto;
          padding: 0;

          &.current-widget {
            height: 26px;
            line-height: 26px;
            padding-left: 24px;
            
            &.is-hovering { // FIXME 这里应该是element-plus bug导致is-hovering的class一直存在
              background-color: unset;
            }
            &:hover { // 先用伪类实现鼠标hover时的背景色
              background-color: var(--el-fill-color-light);
            }
          }

          .tree-container {
            width: unset !important;
            .el-tree {
              height: fit-content;
              overflow-x: auto;

              .el-tree-node.is-current {
                color: var(--el-color-primary);
                font-weight: bold;
              }
            }
          }
        }
      }
    }
  }
}
</style>
