<template>
  <div
    class="edge-menu-popover"
    :style="{
      left: `${menuX}px`,
      top: `${menuY}px`,
    }"
    v-show="modelValue"
    ref="popoverRef"
  >
    <div class="menus-item" v-for="item in showMenus" :key="item.title">
      <div class="title">{{ item.title }}</div>
      <ul class="menus">
        <li
          class="menu"
          v-for="menu in item.menus"
          :key="menu.type"
          @click="handleClickMenu((menu as any))"
          :class="{ 'disabled': (menu as any).disabled ?? false }"
        >
          <div class="icon" :style="{ backgroundColor: menu.color }">
            <el-icon :size="16" color="var(--color-white)">
              <component :is="menu.icon" />
            </el-icon>
          </div>
          <span class="name" :title="menu.label">{{ menu.label }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { ProcessNodeType, isTimeTaskSingleTriggerMode } from '@common/types/project';
import { ref, computed, Ref } from 'vue';
import { useEventListener } from "@vueuse/core";
import i18next from 'i18next';
import { ProcessNode } from './process';
import { useFlowCanvasRef } from '../hooks';

type FlowMenu = typeof triggerMenus[number] & {
  meta?: any,
}

const props = defineProps<{
  modelValue: boolean,
  node?: ProcessNode | null,
}>();

const menuX = ref(0);
const menuY = ref(0);
const flowCanvasRef = useFlowCanvasRef();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "add", type: ProcessNodeType, meta: any): void
}>();

const popoverRef = ref<HTMLDivElement>();
const isTrigger = computed(() => props?.node?.getFlow()?.type === "start");
const sourceNode = computed(() => props?.node?.findSourceNode())

// true 表示是 单条触发模式
const isSingleTimeTask = computed(() => {
  if (!sourceNode.value) {
    return false;
  }
  if (
    sourceNode.value?.type === ProcessNodeType.TRIGGER_TIME_TASK &&
    isTimeTaskSingleTriggerMode(sourceNode.value.options)
  ) {
    return true;
  }
  return false;
})
const triggerMenus = [
  {
    get label() { return i18next.t('edgeMenuPopover.dataChange') },
    icon: INocodeFlowDataChange,
    type: ProcessNodeType.TRIGGER_DATA_CHANGE,
    color: "#7dbd4b",
    get disabled() {
      const branches = props.node?.getFlow()?.branches
      if(branches.some(item => item.flows?.some(i => i.type === ProcessNodeType.TRIGGER_DATA_CHANGE))) {
        return true
      }
      return false
    },
  },
  {
    get label() { return i18next.t('edgeMenuPopover.scheduled') },
    icon: INocodeFlowTimerTask,
    type: ProcessNodeType.TRIGGER_TIME_TASK,
    color: "#36becb",
  },
  {
    get label() { return i18next.t('edgeMenuPopover.operationTrigger') },
    icon: INocodeFlowInteraction,
    type: ProcessNodeType.TRIGGER_OPERATION,
    color: "#39c384",
  },
  // {
  //   label: "交互",
  //   icon: INocodeFlowInteraction,
  //   type: ProcessNodeType.TRIGGER_MANUAL,
  //   color: "#39c384",
  // },
];
const branchMenus = [
  {
    get label() { return i18next.t('edgeMenuPopover.conditionBranch') },
    icon: INocodeFlowConditionBranch,
    type: ProcessNodeType.CONDITION_BRANCH,
    color: "#dc84c6",
  },
  {
    get label() { return i18next.t('edgeMenuPopover.parallelBranch') },
    icon: INocodeFlowParallelBranch,
    type: ProcessNodeType.PARALLEL_BRANCH,
    color: "#d4c042",
  },
]
const manualMenus = [
  {
    get label() { return i18next.t('edgeMenuPopover.approval') },
    icon: INocodeFlowApproval,
    type: ProcessNodeType.APPROVAL,
    color: "#ff9a26",
    get disabled() {
      return isSingleTimeTask.value;
    },
  },
  {
    get label() { return i18next.t('edgeMenuPopover.transact') },
    icon: INocodeFlowHandle,
    type: ProcessNodeType.TRANSACT,
    color: "#ff7349",
    get disabled() {
      return isSingleTimeTask.value;
    },
  },
  {
    get label() { return i18next.t('edgeMenuPopover.notify') },
    icon: IVenNocodeFlowSend,
    type: ProcessNodeType.NOTIFY, 
    color: "#2d88ff",
  },
  {
    get label() { return i18next.t('edgeMenuPopover.reportData') },
    icon: INocodeFlowDataFilling,
    type: ProcessNodeType.REPORT_DATA,
    color: "#26b19e",
  },
]
const automationMenus = [
  {
    get label() { return i18next.t('edgeMenuPopover.dataProcessing') },
    icon: INocodeFlowDataProcess,
    type: ProcessNodeType.TRANSACT,
    color: "#6b6bfe",
  },
];
const dataProcessingMenus = [ 
  {
    get label() { return i18next.t('edgeMenuPopover.addData') },
    icon: INocodeFlowAddData,
    type: ProcessNodeType.ADD_DATA,
    color: "#f6b826",
  },
  {
    get label() { return i18next.t('edgeMenuPopover.editData') },
    icon: INocodeFlowEditData,
    type: ProcessNodeType.EDIT_DATA,
    color: "#4684ee",
  },
  {
    get label() { return i18next.t('edgeMenuPopover.deleteData') },
    icon: INocodeFlowDeleteData,
    type: ProcessNodeType.DELETE_DATA,
    color: "#ff736c",
  },
]
const showMenus = computed(() => {
  if (isTrigger.value) {
    const menus = [
      {
        title: i18next.t('edgeMenuPopover.triggerNode'),
        menus: triggerMenus,
      },
    ]
    return menus;
  }
  const menus = [
    {
      title: i18next.t('edgeMenuPopover.branchNode'),
      menus: branchMenus,
    },
    {
      title: i18next.t('edgeMenuPopover.humanNode'),
      menus: manualMenus,
    },
    {
      title: i18next.t('edgeMenuPopover.crossTableDataProcessing'),
      menus: dataProcessingMenus,
    },
    // {
    //   title: "自动化节点",
    //   menus: automationMenus,
    // },
  ];
  return menus;
})

useEventListener('click', (event) => {
  if (!props.modelValue) return;
  if (popoverRef.value && !popoverRef.value.contains(event.target as Node)) {
    emit('update:modelValue', false);
  }
}, true);

const handleClickMenu = (item: FlowMenu) => {
  if (item.disabled ?? false) return;
  emit('add', item.type, item.meta);
  emit('update:modelValue', false);
}


defineExpose({
  setPosition(event) {
    const { clientX: x, clientY: y } = event as MouseEvent

    // 动态获取窗口宽高
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // 菜单的窗口宽高
    const rect = popoverRef.value?.getBoundingClientRect()
    const menuWidth = rect?.width
    const menuHeight = rect?.height

    // 画布的位置
    const canvasRect = flowCanvasRef.value?.getBoundingClientRect();

    // x轴偏移量
    const xOffset = canvasRect?.x || 0
    const xRightOffset = xOffset + menuWidth

    // y轴偏移量
    const yTopOffset = canvasRect?.y || 0 // 垂直方向边界
    const yOffset = yTopOffset + menuHeight

    menuX.value = x > viewportWidth - menuWidth ? x - xRightOffset : x - xOffset // 水平方向：判断是否超出右边界
    menuY.value = y > viewportHeight - menuHeight ? y - yOffset : y - yTopOffset // 垂直方向：判断是否超出下边界
  }
})
</script>

<style lang='scss' scoped>
.edge-menu-popover {
  width: 256px;
  padding: 0 8px;
  position: absolute;
  z-index: 99999999;
  background-color: var(--bg-color-page);
  box-shadow: 0px 8px 20px 0px #00000014;
  border-radius: 6px;
  top: 10px;

  .menus-item {
    padding: 8px 0;
    &:not(:last-of-type) {
      border-bottom: 1px solid var(--border-color);
    }
    .title {
      height: 24px;
      padding: 0 8px;
      line-height: 24px;
      color: var(--text-color-secondary);
    }
  
    .menus {
      display: flex;
      flex-wrap: wrap;
      column-gap: 8px;
      row-gap: 4px;
      margin-top: 4px;
  
      .menu {
        display: flex;
        align-items: center;
        column-gap: 8px;
        width: calc(50% - 4px);
        height: 36px;
        cursor: pointer;
        padding: 0 8px;
        border-radius: 4px;
        color: var(--text-color-regular);
        font-size: 14px;
  
        &:hover {
          background-color: var(--bg-color);
        }

        &.disabled {
          color: var(--text-color-disabled);
          cursor: not-allowed;
          background-color: var(--bg-color-disabled);
        }
  
        .icon {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }
  }
}
</style>
