<template>
  <el-dropdown popper-class="dropDownStyle" trigger="click" :teleported="true"
    @command="(comment) => handleCommand(comment, data, node)"
    @visible-change="(flag) => handleVisibleChange(flag, data)">
    <span class="el-dropdown-link">
      <!--  -->
      <!-- @click.stop="append(node)" -->
      <span>
        <slot name="default"></slot>
      </span>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <template v-for="item in menuList" :key="item.command">
          <el-dropdown-item v-if="item.visibleJudger()" :command="item.command">
            {{ item.label }}
          </el-dropdown-item>
        </template>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { CommandHandles, TreeNode, CustomNodeData } from './type';
import i18next from 'i18next';

type MenuCommand = 'addCatalog' | 'addDocument' | 'addDocumentAbove' | 'addDocumentBelow' | 'rename' | 'delete' | 'copy';

type MenuList = {
  command: MenuCommand,
  label: string,
  visibleJudger: Function
}

const props = defineProps<{
  node: TreeNode,
  treeData: CustomNodeData[],
  iconVisible?: boolean,
  commandHandles: CommandHandles,
  isCategory?: boolean,
}>();

const emit = defineEmits(['handleMouseLeave', 'update:iconVisible']);

const canContainChildren = () => (
  props.node.level === 0
  || props.node.data.type === 'catalog'
  || props.node.data.canContainChildren === true
);

const menuList = ref<MenuList[]>([{
  command: 'addCatalog',
  get label() { return !props.isCategory ? i18next.t('HandleMenu.newCatalog') : i18next.t('HandleMenu.newCategory') },
  visibleJudger: canContainChildren
}, {
  command: 'addDocument',
  get label() { return i18next.t('HandleMenu.newDoc') },
  visibleJudger: () => (canContainChildren() && !props.isCategory)
}, {
  command: 'addDocumentAbove',
  get label() { return i18next.t('HandleMenu.addDocAbove') },
  visibleJudger: () => (props.node.data?.type === 'document')
}, {
  command: 'addDocumentBelow',
  get label() { return i18next.t('HandleMenu.addDocBelow') },
  visibleJudger: () => (props.node.data?.type === 'document')
}, {
  command: 'copy',
  get label() { return i18next.t('HandleMenu.copy') },
  visibleJudger: () => (props.node.data?.type === 'document')
}, {
  command: 'rename',
  get label() { return i18next.t('HandleMenu.rename') },
  visibleJudger: () => (props.node.level > 0)
}, {
  command: 'delete',
  get label() { return i18next.t('HandleMenu.delete') },
  visibleJudger: () => (props.node.level > 0)
}])

const data = computed<CustomNodeData>(() => {
  if (props.node.level === 0)
    return ({
      children: props.node.data
    }) as CustomNodeData;
  else
    return props.node.data as CustomNodeData;
});

const iconVisibleComp = computed<boolean>({
  get: () => props.iconVisible,
  set: (val) => emit('update:iconVisible', val)
});

const handleCommand = (command: MenuCommand, data: CustomNodeData, node) => {
  iconVisibleComp.value = true
  emit('handleMouseLeave', data);
  switch (command) {
    case 'addCatalog':
      props.commandHandles.addCatalog(data, node);
      break;

    case 'addDocument':
      props.commandHandles.addDocument(data, node);
      break;

    case 'addDocumentAbove':
      props.commandHandles.addDocumentAbove?.(data, node);
      break;

    case 'addDocumentBelow':
      props.commandHandles.addDocumentBelow?.(data, node);
      break;

    case 'copy':
      props.commandHandles.copyNode(data, node);
      break;

    case 'rename':
      props.commandHandles.renameNode(data, node);
      break;

    case 'delete':
      props.commandHandles.deleteNode(data, node);
      break;
    default:
      console.error(`${i18next.t('HandleMenu.unknownCmd')}: ${command}`);
  }
};

const handleVisibleChange = (flag, data) => {
  if (flag) {
    iconVisibleComp.value = false;
  } else {
    iconVisibleComp.value = true;
    resetAllHover(props.treeData);
    emit('handleMouseLeave', data);
  }
}

function resetAllHover(arr) {
  if (!Array.isArray(arr)) return;
  arr.forEach(item => {
    if (item.hasOwnProperty('hover')) {
      item.hover = false;
    }
    if (item.children && Array.isArray(item.children)) {
      resetAllHover(item.children);
    }
  });
}

</script>

<style scoped>
:deep(.el-tooltip__trigger:focus-visible) {
  outline: unset;
}

:global(.el-popper.is-light .el-popper__arrow::before) {
  display: none;
}

:global(.dropDownStyle .el-dropdown-menu) {
  background-color: #ffffff !important;
  border-radius: 6px;
}

:global(.dropDownStyle .el-dropdown-menu__item) {
  color: #262626 !important;
  background-color: #ffffff !important;
}

:global(.dropDownStyle .el-dropdown-menu__item:hover) {
  background-color: #eff0f0 !important;
  color: #262626
}
</style>
