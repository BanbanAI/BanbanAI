<template>
  <div class="flow-node-container" v-if="props.nodes.length">
    <add-branch-node
      v-if="structureEditable && isBranchNode(props.currentFlow?.type)"
      @click="onClickNode(findNode(props.currentFlow))"
      :node="findNode(props.currentFlow)"
      :class="[
        'add-branch-node',
        {
          'can-drag': isNodeDraggable(findNode(props.currentFlow)),
          'is-dragging': isDraggingNode(findNode(props.currentFlow)),
        }
      ]"
      :draggable="isNodeDraggable(findNode(props.currentFlow))"
      @pointerdown.stop
      @dragstart="handleDragStart($event, findNode(props.currentFlow))"
      @dragend="handleDragEnd"
    />
    <div class="branch-container" :class="{ isBranch: props.isBranch }" v-for="(branch, index) in props.branches" :key="branch.uid">
      <div class="node-container" v-for="flow in branch.flows" :key="flow.uid">
        <div
          class="node-wrapper"
          :data-node-uid="findNode(flow)?.uid || ''"
          :class="getNodeWrapperClass(findNode(flow))"
          @dragenter.prevent.stop="handleBranchOrderDragEnter(findNode(flow))"
          @dragover.prevent.stop="handleBranchOrderDragOver($event, findNode(flow))"
          @drop.prevent.stop="handleBranchOrderDrop(findNode(flow))"
        >
          <div class="node" :style="{ transform: flow.type === ProcessNodeType.CONDITION_BRANCH ? 'translateY(50%)' : 'translateY(0%)' }">
            <div
              class="node-interactive"
              :class="getNodeClass(findNode(flow), flow)"
              :draggable="isFlowDraggable(findNode(flow), flow)"
              @pointerdown.stop
              @dragstart="handleDragStart($event, findNode(flow))"
              @dragend="handleDragEnd"
            >
              <starting-node
                @delete="deleteNode"
                :node="findNode(flow)"
                v-if="[ProcessNodeType.START, ProcessNodeType.END].includes(flow.type)"
              />
              <add-branch-node
                @delete="deleteNode"
                :node="findNode(flow)"
                v-else-if="flow.type === ProcessNodeType.CONDITION_BRANCH || flow.type === ProcessNodeType.PARALLEL_BRANCH"
                style="opacity: 0;"
              />
              <branch-setting-node
                @click="onClickNode(findNode(flow))"
                @copy="copyNode"
                @delete="deleteNode"
                :node="findNode(flow)"
                v-else-if="flow.type === ProcessNodeType.BRANCH_SETTING"
              />
              <rectangle-node
                @click="onClickNode(findNode(flow))"
                @copy="copyNode"
                @delete="deleteNode"
                :node="findNode(flow)"
                v-else
              />
            </div>
          </div>
        </div>
        <div
          class="edge"
          v-if="flow.type != ProcessNodeType.END && flow.type != ProcessNodeType.CONDITION_BRANCH && flow.type != ProcessNodeType.PARALLEL_BRANCH"
          :class="getEdgeClass(findNode(flow))"
          @dragenter.prevent.stop="handleAfterNodeDragEnter(findNode(flow))"
          @dragover.prevent.stop="handleAfterNodeDragOver($event, findNode(flow))"
          @drop.prevent.stop="handleAfterNodeDrop(findNode(flow))"
        >
          <add-Node-edge
            v-if="structureEditable"
            :node="findNode(flow)"
            @click="addNode($event, findNode(flow))"
          />
        </div>
        <template v-if="flow.branches?.length">
          <div v-if="flow.branches?.length" class="branch">
            <flow-node-container
              :nodes="props.nodes"
              :isBranch="flow.branches?.length > 1"
              :branches="flow.branches"
              :currentFlow="flow"
              :draggingNode="props.draggingNode"
              :dropTarget="props.dropTarget"
              @add-node="addNode"
              @delete-node="deleteNode"
              @copy-node="copyNode"
              @click-node="onClickNode"
              @drag-node-start="emit('drag-node-start', $event)"
              @drag-node-end="emit('drag-node-end')"
              @drag-target-change="emit('drag-target-change', $event)"
              @drop-node="emit('drop-node', $event)"
            />
          </div>
          <div
            class="edge"
            v-if="flow.type !== ProcessNodeType.START || flow.branches?.length > 1"
            :class="getEdgeClass(findNode(flow))"
            @dragenter.prevent.stop="handleAfterNodeDragEnter(findNode(flow))"
            @dragover.prevent.stop="handleAfterNodeDragOver($event, findNode(flow))"
            @drop.prevent.stop="handleAfterNodeDrop(findNode(flow))"
          >
            <add-Node-edge
              v-if="structureEditable && flow.type !== ProcessNodeType.START"
              :node="findNode(flow)"
              @click="addNode($event, findNode(flow))"
            />
          </div>
        </template>
      </div>
      <div class="left-cover" v-if="index === 0 && props.isBranch">
        <div class="left-top-cover"></div>
        <div class="left-bottom-cover"></div>
      </div>
      <div class="right-cover" v-if="index === props.branches.length - 1 && props.isBranch">
        <div class="right-top-cover"></div>
        <div class="right-bottom-cover"></div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ProcessFlow, ProcessBranch, ProcessNodeType } from '@common/types/project';
import { ProcessNode } from './process';
import { isBranchNode } from '@common/utils/flow';
import { canDragProcessNode, canMoveProcessNodeToAfter, canReorderBranchSettingNode, isSameDropTarget, ProcessDropTarget } from './flow-rules';
import { useProcessStructureEditable } from '../hooks';

const emit = defineEmits<{
  (event: "add-node", e: MouseEvent, node: ProcessNode): void,
  (event: "delete-node", node: ProcessNode): void,
  (event: "copy-node", node: ProcessNode): void,
  (event: "click-node", node: ProcessNode): void,
  (event: "drag-node-start", node: ProcessNode): void,
  (event: "drag-node-end"): void,
  (event: "drag-target-change", target: ProcessDropTarget | null): void,
  (event: "drop-node", target: ProcessDropTarget): void,
}>();
const props = defineProps<{
  branches: ProcessBranch[];
  isBranch: boolean;
  nodes: ProcessNode[];
  currentFlow?: ProcessFlow;
  draggingNode?: ProcessNode | null;
  dropTarget?: ProcessDropTarget | null;
}>();
const structureEditable = useProcessStructureEditable();

const findNode = (flow?: ProcessFlow) => {
  return props.nodes.find(node => node.getFlow().uid === flow?.uid);
}

const addNode = (e: MouseEvent, node?: ProcessNode | null) => {
  if (!node) return;
  emit('add-node', e, node);
}

const deleteNode = (data?: ProcessNode | null) => {
  if (!data) return;
  emit('delete-node', data);
}

const copyNode = (data?: ProcessNode | null) => {
  if (!data) return;
  emit('copy-node', data);
}

const onClickNode = (node?: ProcessNode | null) => {
  if (!node) return;
  emit('click-node', node);
}

const isNodeDraggable = (node?: ProcessNode | null) => {
  return !!structureEditable?.value && canDragProcessNode(node);
}

const isFlowDraggable = (node?: ProcessNode | null, flow?: ProcessFlow) => {
  return isNodeDraggable(node) && !isBranchNode(flow?.type);
}

const isDraggingNode = (node?: ProcessNode | null) => {
  return !!node && props.draggingNode?.uid === node.uid;
}

const isAfterNodeTarget = (node?: ProcessNode | null) => {
  if (!node) return false;
  return isSameDropTarget(props.dropTarget, {
    mode: "after-node",
    nodeUid: node.uid,
  });
}

const isBranchOrderTarget = (node?: ProcessNode | null) => {
  if (!node) return false;
  return isSameDropTarget(props.dropTarget, {
    mode: "branch-order",
    nodeUid: node.uid,
  });
}

const canDropAfterNode = (node?: ProcessNode | null) => {
  return canMoveProcessNodeToAfter(props.draggingNode, node);
}

const canDropOnBranchOrder = (node?: ProcessNode | null) => {
  return canReorderBranchSettingNode(props.draggingNode, node);
}

const handleDragStart = (event: DragEvent, node?: ProcessNode | null) => {
  if (!isNodeDraggable(node)) {
    event.preventDefault();
    return;
  }
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', node.uid);
  }
  emit('drag-node-start', node);
}

const handleDragEnd = () => {
  emit('drag-node-end');
}

const handleAfterNodeDragEnter = (node?: ProcessNode | null) => {
  if (!node || !canDropAfterNode(node)) return;
  emit('drag-target-change', {
    mode: "after-node",
    nodeUid: node.uid,
  });
}

const handleAfterNodeDragOver = (event: DragEvent, node?: ProcessNode | null) => {
  if (!node || !canDropAfterNode(node)) {
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'none';
    }
    return;
  }
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  emit('drag-target-change', {
    mode: "after-node",
    nodeUid: node.uid,
  });
}

const handleAfterNodeDrop = (node?: ProcessNode | null) => {
  if (!node || !canDropAfterNode(node)) return;
  emit('drop-node', {
    mode: "after-node",
    nodeUid: node.uid,
  });
}

const handleBranchOrderDragEnter = (node?: ProcessNode | null) => {
  if (!node || !canDropOnBranchOrder(node)) return;
  emit('drag-target-change', {
    mode: "branch-order",
    nodeUid: node.uid,
  });
}

const handleBranchOrderDragOver = (event: DragEvent, node?: ProcessNode | null) => {
  if (!node || !canDropOnBranchOrder(node)) {
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'none';
    }
    return;
  }
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  emit('drag-target-change', {
    mode: "branch-order",
    nodeUid: node.uid,
  });
}

const handleBranchOrderDrop = (node?: ProcessNode | null) => {
  if (!node || !canDropOnBranchOrder(node)) return;
  emit('drop-node', {
    mode: "branch-order",
    nodeUid: node.uid,
  });
}

const getNodeWrapperClass = (node?: ProcessNode | null) => {
  return {
    'branch-drop-available': !!props.draggingNode && canDropOnBranchOrder(node),
    'branch-drop-active': isBranchOrderTarget(node),
  };
}

const getNodeClass = (node?: ProcessNode | null, flow?: ProcessFlow) => {
  return {
    'can-drag': isFlowDraggable(node, flow),
    'is-dragging': isDraggingNode(node),
  };
}

const getEdgeClass = (node?: ProcessNode | null) => {
  return {
    'drop-available': !!props.draggingNode && canDropAfterNode(node),
    'drop-active': isAfterNodeTarget(node),
  };
}
</script>

<style scoped lang="scss">
.flow-node-container {
  display: flex;
  justify-content: center;
  background-color: #eeeeee;
  position: relative;

  :deep(.add-branch-node.can-drag) {
    cursor: grab;
  }

  :deep(.add-branch-node.is-dragging) {
    opacity: 0.55;
    cursor: grabbing;
  }

  .add-branch-node {
    position: absolute;
    top: -15px;
    z-index: 99999;
  }

  .branch-container {
    position: relative;
    
    &.isBranch {
      border-bottom: 2px solid #dcdfe6;
      border-top: 2px solid #dcdfe6;
      padding: 50px 0px;
    }

    .node-container {
      .node-wrapper {
        position: relative;
        display: flex;
        justify-content: center;

        &::after {
          content: "";
          position: absolute;
          inset: -8px 36px;
          border-radius: 16px;
          border: 2px dashed transparent;
          background-color: transparent;
          pointer-events: none;
          transition: border-color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease;
          opacity: 0;
        }

        &.branch-drop-available::after {
          opacity: 1;
          border-color: rgba(31, 119, 252, 0.25);
        }

        &.branch-drop-active::after {
          opacity: 1;
          border-color: rgba(31, 119, 252, 0.7);
          background-color: rgba(31, 119, 252, 0.08);
        }
      }

      .node {
        display: flex;
        justify-content: center;
        padding: 0px 50px;
        z-index: 99999;

        .node-interactive {
          display: flex;
          justify-content: center;

          &.can-drag {
            cursor: grab;
          }

          &.is-dragging {
            opacity: 0.55;
            cursor: grabbing;
          }
        }
      }

      .branch {
        z-index: -100;
      }

      .edge {
        position: relative;
        display: flex;
        justify-content: center;
        padding: 30px 20px;

        &::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 2px;
          border-radius: 999px;
          background-color: transparent;
          transform: translate(-50%, -50%);
          transition: width 0.15s ease, background-color 0.15s ease;
        }

        &.drop-available::before {
          width: 56px;
          background-color: rgba(31, 119, 252, 0.28);
        }

        &.drop-active::before {
          width: 148px;
          background-color: rgba(31, 119, 252, 0.72);
        }
      }
    }

    &::before {
      content: "";
      position: absolute;
      top: 0;
      height: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-left: 2px solid #dcdfe6;
    }

    .left-cover {
      div {
        position: absolute;
        height: 8px;
        width: 50%;
        background-color: #eeeeee;
        left: -1px;

        &.left-top-cover {
          top: -4px;
        }

        &.left-bottom-cover {
          bottom: -4px;
        }
      }
    }

    .right-cover {
      div {
        position: absolute;
        height: 8px;
        width: 50%;
        background-color: #eeeeee;
        right: -1px;

        &.right-top-cover {
          top: -4px;
        }

        &.right-bottom-cover {
          bottom: -4px;
        }
      }
    }
  }
}
</style>
