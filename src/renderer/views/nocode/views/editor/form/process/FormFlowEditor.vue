<template>
  <div
    ref="flowWrapperRef"
    class="canvas"
    style="width: 100%; height: 100%; position: relative;"
    @pointerdown="onPointerDown"
    @wheel="onWheel"
  >
    <div
      class="flow-canvas"
      :style="{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        transformOrigin: '0 0'
      }"
    >
      <flow-node-container
        :nodes="nodes"
        :isBranch="false"
        :branches="[rootBranch?.getBranch()]"
        :draggingNode="dragState.node"
        :dropTarget="dragState.target"
        @add-node="addNode"
        @delete-node="onNodeDelete"
        @copy-node="onNodeCopy"
        @click-node="onNodeClick"
        @drag-node-start="onDragNodeStart"
        @drag-node-end="onDragNodeEnd"
        @drag-target-change="onDragTargetChange"
        @drop-node="onDropNode"
      />
    </div>
  </div>
  <edge-menu-popover
    ref="edgeMenuPopoverRef"
    v-model="addNodePopoverInfo.visible"
    v-bind="addNodePopoverInfo"
    @add="onNodeAdd"
  />
  <teleport to="body">
    <node-option-drawer
      v-model="nodeOptionPopoverInfo.visible"
      v-bind="nodeOptionPopoverInfo"
    />
  </teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, shallowReactive, watch } from 'vue';
import { ProcessNodeType } from '@common/types/project';
import { isTriggerNode } from '@common/utils';
import { unique } from '@common/utils/unique';
import { useProcessStructureEditable, provideFlowCanvasRef, useRootBranch } from '../hooks';
import { isBranchNode } from '../utils';
import { ProcessNode, StartNode } from './process';
import { canMoveProcessNodeToAfter, canReorderBranchSettingNode, isSameDropTarget, ProcessDropTarget } from './flow-rules';

const flowWrapperRef = ref<HTMLDivElement>();
const edgeMenuPopoverRef = ref(null);

const addNodePopoverInfo = shallowReactive({
  visible: false,
  node: null,
});
const nodeOptionPopoverInfo = shallowReactive({
  visible: false,
  node: null,
});
const dragState = shallowReactive<{
  node: ProcessNode | null,
  target: ProcessDropTarget | null,
}>({
  node: null,
  target: null,
});

const rootBranch = useRootBranch();
const structureEditable = useProcessStructureEditable();

watch(structureEditable, (editable) => {
  if (editable) {
    return;
  }
  addNodePopoverInfo.visible = false;
  nodeOptionPopoverInfo.visible = false;
  clearDragState();
  stopCanvasDragging();
});

let ignoreNodeClickUntil = 0;

const clearDragState = () => {
  dragState.node = null;
  dragState.target = null;
  ignoreNodeClickUntil = Date.now() + 150;
};

const getNodes = (nodes = rootBranch.value?.nodes) => {
  const currentNodes: ProcessNode[] = [];
  for (const node of nodes || []) {
    currentNodes.push(node);
    if (isBranchNode(node)) {
      for (const branch of node.branches) {
        currentNodes.push(...getNodes(branch.nodes));
      }
    }
  }
  return currentNodes;
};

const nodes = computed(() => getNodes());

const findNodeByUid = (uid: string) => {
  return nodes.value.find(node => node.uid === uid) || null;
};

const onNodeClick = (node: ProcessNode) => {
  if (Date.now() < ignoreNodeClickUntil) {
    return;
  }
  if (node.type === ProcessNodeType.BRANCH_SETTING && node.isOtherBranch) {
    return;
  }
  if (isBranchNode(node)) {
    if (!structureEditable?.value) {
      return;
    }
    node.addBranch();
    return;
  }
  if (![ProcessNodeType.START, ProcessNodeType.END].includes(node.type)) {
    Object.assign(nodeOptionPopoverInfo, {
      visible: true,
      node,
    });
  }
};

const onNodeCopy = (node: ProcessNode) => {
  if (!structureEditable?.value) {
    return;
  }
  if (node.type === ProcessNodeType.BRANCH_SETTING) {
    node.parent.copy();
  } else {
    node.copy();
  }
};

const onNodeDelete = (node: ProcessNode) => {
  if (!structureEditable?.value) {
    return;
  }
  if (node.type === ProcessNodeType.BRANCH_SETTING || isTriggerNode(node.type)) {
    node.parent.remove();
  } else {
    node.remove();
  }
};

const addNode = (event: MouseEvent, node: ProcessNode) => {
  if (!structureEditable?.value) {
    return;
  }
  Object.assign(addNodePopoverInfo, {
    visible: true,
    node,
  });
  nextTick(() => {
    edgeMenuPopoverRef.value?.setPosition(event);
  });
};

const onNodeAdd = (type: ProcessNodeType, meta: any) => {
  if (!structureEditable?.value) return;
  const node = addNodePopoverInfo.node;
  if (!node) return;
  if (node.type === ProcessNodeType.START) {
    (node as StartNode).addBranch([{
      uid: unique(),
      type,
      meta,
    }]);
    return;
  }
  const index = node.parent.nodes.findIndex(item => item.uid === node.uid);
  node.parent.addNode({
    uid: unique(),
    type,
    meta,
  }, index + 1);
};

const onDragNodeStart = (node: ProcessNode) => {
  if (!structureEditable?.value) {
    return;
  }
  addNodePopoverInfo.visible = false;
  nodeOptionPopoverInfo.visible = false;
  dragState.node = node;
  dragState.target = null;
};

const onDragNodeEnd = () => {
  clearDragState();
};

const onDragTargetChange = (target: ProcessDropTarget | null) => {
  if (isSameDropTarget(dragState.target, target)) {
    return;
  }
  dragState.target = target;
};

const onDropNode = (target: ProcessDropTarget) => {
  if (!structureEditable?.value) {
    clearDragState();
    return;
  }
  const draggingNode = dragState.node;
  if (!draggingNode) {
    clearDragState();
    return;
  }

  const targetNode = findNodeByUid(target.nodeUid);
  if (!targetNode) {
    clearDragState();
    return;
  }

  if (target.mode === 'after-node') {
    if (!canMoveProcessNodeToAfter(draggingNode, targetNode)) {
      clearDragState();
      return;
    }
    const targetIndex = targetNode.parent.nodes.findIndex(item => item.uid === targetNode.uid);
    draggingNode.parent.moveNode(draggingNode, targetNode.parent, targetIndex + 1);
  } else if (target.mode === 'branch-order') {
    if (!canReorderBranchSettingNode(draggingNode, targetNode)) {
      clearDragState();
      return;
    }
    const branchCount = targetNode.parent.getOwner()?.branches?.length || 0;
    const targetIndex = targetNode.isOtherBranch ? Math.max(branchCount - 2, 0) : targetNode.branchIndex;
    draggingNode.parent.changeIndex(targetIndex, draggingNode.branchIndex);
    draggingNode.parent.updateHistory('structure');
  }

  clearDragState();
};

const offset = reactive({ x: 0, y: 0 });
const scale = ref(1);

let draggingCanvas = false;
let startX = 0;
let startY = 0;
let originX = 0;
let originY = 0;

const stopCanvasDragging = () => {
  draggingCanvas = false;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
};

const onPointerDown = (event: PointerEvent) => {
  if (addNodePopoverInfo.visible || nodeOptionPopoverInfo.visible || dragState.node) {
    return;
  }
  draggingCanvas = true;
  startX = event.clientX;
  startY = event.clientY;
  originX = offset.x;
  originY = offset.y;
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
};

const onPointerMove = (event: PointerEvent) => {
  if (!draggingCanvas) return;
  offset.x = originX + (event.clientX - startX);
  offset.y = originY + (event.clientY - startY);
};

const onPointerUp = () => {
  stopCanvasDragging();
};

const onWheel = (event: WheelEvent) => {
  if (addNodePopoverInfo.visible || nodeOptionPopoverInfo.visible || dragState.node) {
    return;
  }
  const canvasRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const mouseX = event.clientX - canvasRect.left;
  const mouseY = event.clientY - canvasRect.top;

  const zoomSpeed = 0.0015;
  const nextScale = Math.min(2, Math.max(0.3, scale.value - event.deltaY * zoomSpeed));

  offset.x = mouseX - ((mouseX - offset.x) / scale.value) * nextScale;
  offset.y = mouseY - ((mouseY - offset.y) / scale.value) * nextScale;
  scale.value = nextScale;
};

onMounted(() => {
  const wrapper = flowWrapperRef.value;
  const content = document.querySelector('.flow-canvas');
  nextTick(() => {
    if (!wrapper || !content) {
      return;
    }
    const wrapperRect = wrapper.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const scaleValue = Math.max(
      Math.min(wrapperRect.width / contentRect.width, wrapperRect.height / contentRect.height) * 0.95,
      0.3,
    );
    scale.value = scaleValue;
    offset.x = (wrapperRect.width - contentRect.width * scaleValue) / 2;
    offset.y = Math.max((wrapperRect.height - contentRect.height * scaleValue) / 2, 20);
  });
});

const keepNodeInView = async (uid?: string | null) => {
  const nodeUid = String(uid || '').trim();
  const wrapper = flowWrapperRef.value;
  if (!nodeUid || !wrapper) {
    return false;
  }
  await nextTick();
  const nodeElement = wrapper.querySelector(`[data-node-uid="${nodeUid}"]`) as HTMLElement | null;
  if (!nodeElement) {
    return false;
  }
  const wrapperRect = wrapper.getBoundingClientRect();
  const nodeRect = nodeElement.getBoundingClientRect();
  const wrapperCenterX = wrapperRect.left + wrapperRect.width / 2;
  const wrapperCenterY = wrapperRect.top + wrapperRect.height / 2;
  const nodeCenterX = nodeRect.left + nodeRect.width / 2;
  const nodeCenterY = nodeRect.top + nodeRect.height / 2;
  offset.x += wrapperCenterX - nodeCenterX;
  offset.y += wrapperCenterY - nodeCenterY;
  return true;
}

const openNodeOptionsByUid = async (uid?: string | null) => {
  const nodeUid = String(uid || '').trim();
  if (!nodeUid) {
    return false;
  }
  await keepNodeInView(nodeUid);
  const node = findNodeByUid(nodeUid);
  if (!node || [ProcessNodeType.START, ProcessNodeType.END].includes(node.type)) {
    return false;
  }
  Object.assign(nodeOptionPopoverInfo, {
    visible: true,
    node,
  });
  return true;
}

defineExpose({
  keepNodeInView,
  openNodeOptionsByUid,
})

provideFlowCanvasRef(flowWrapperRef);
</script>

<style scoped lang="scss">
.canvas {
  cursor: grab;
  user-select: none;
  width: 100%;

  &:active {
    cursor: grabbing;
  }

  .flow-canvas {
    z-index: 0;
    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
}
</style>
