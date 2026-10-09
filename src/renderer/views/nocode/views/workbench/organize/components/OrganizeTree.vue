<template>
  <div class="organize-tree">
    <el-tree class="architecture" :data="groupList" node-key="id" :current-node-key="activeKey" :empty-text="emptyText" :indent="20"
    :expand-on-click-node="!expandOnClickNode" @node-click="handleNodeClick">
      <template #default="{ node, data }">
        <slot name="content" :data="data" class="icon-left"></slot> 
        <span :class="{ active: node.key === activeKey }">{{ data.label }}</span>
        <el-dropdown class="icon-right" v-if="!hiddenRightIcon" popper-class="custom-popper-small">
          <el-icon style="color:#000" size="16px">
            <i-workbench-right />
          </el-icon>
          <template #dropdown>
            <el-dropdown-menu >
              <template v-for="option in dropdownOptionList" :key="option.name">
                <el-dropdown-item :style="{
                  '--el-text-color-regular': option.className == 'delete' ? 'red': 'inherit',
                }" v-if="option.visible?.(data)" @click="option.click(data)" :disabled="option.disabled">
                  <div class="option-item">{{ option.name }}</div>
                </el-dropdown-item>
              </template>
            </el-dropdown-menu>
          </template>
        </el-dropdown>        
      </template>

      <template #empty>
        <slot name="empty"></slot>
      </template>
    </el-tree>
  </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, computed, reactive } from 'vue';
import i18next from 'i18next';

interface Group {
  label: string
  children?: Group[]
}
type EditList = {
  name: string,
  className?: string,
  disabled?: boolean,
  visible?: (data: Group) => boolean,
  click: (data) => void;
}[]
const props = withDefaults(defineProps<{
  groupList:Group[];
  editList: EditList;
  hiddenRightIcon?: boolean;
  activeKey?: string;
  expandOnClickNode?: boolean;
  currentNodeData?: Group;
  emptyText?: string,
  theme?: string;
}>(), {
  expandOnClickNode: false,
  emptyText: () => i18next.t('OrganizeTree.noData'),
  theme: "dark",
});
const emit = defineEmits<{
  (event: "update:activeKey", value: string): void;
  (event: "update:currentNodeData", value: string): void;
}>();

const dropdownOptionList = computed(()=>{
  const list = (props.editList ?? []).map((item)=>{
    if(item?.visible === void 0) {
      item.visible = ()=>{
        return true;
      }
    }
    return item;
  });
  return list;
})

const handleNodeClick = (data, node) => {
  if(data?.isGroup) return; // 角色中点击的是分组，不处理。 实现方式待优化
  if (props.expandOnClickNode || node.isLeaf) {
    emit("update:activeKey", data.id);
    emit("update:currentNodeData", data);
  }
}
</script>

<style scoped lang='scss'>
.organize-tree {
  width: 100%;
  height: 100%;
  cursor: var(--cursor-pointer);
  overflow: auto;

  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE 10+ */

  &::-webkit-scrollbar {
    display: none; /* Chrome/Safari/Edge */
    width: 0;
    height: 0;
  }

  :deep(.architecture){
    background-color: #fff;
    height: 100%;
    cursor: var(--cursor-default);
    .el-tree-node {
      --el-tree-node-hover-bg-color: transparent;
      margin-bottom: 4px;
      .el-tree-node__content {
        color:rgba(30, 30, 30, 1);
        font-size:14px;
        height: 32px;
        line-height:32px;
        text-indent:4px;
        padding: 2px 0px;
        border-radius: 4px;
        .el-icon{
          padding:4px 0px;
          margin-left: 4px;
        }

        .el-tree-node__expand-icon{
          color: var(--text-color-secondary);
        }

        &:hover {
          background-color: rgba(245, 245, 247, 1);
        }

        &:has(>.active) {
          color: var(--color-primary);
          background-color: #E7F1FF;
        }
      }
    }

    .el-tree__empty-block {
      cursor: var(--cursor-default);
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }

  :deep(.el-tree-node){
    background-color: #fff; 

    .is-focusable{
      background: none;
    }

    &:hover {
      background:none;
    } 
  }

  :deep(.el-tree-node__expand-icon){
    font-size:17px;
  }

  .icon-right:focus-visible,
  .el-tooltip__trigger:focus-visible {
    outline: none;
  }

  .icon-left {
    position: absolute;
    left: 0px;
    &:hover{
      border: none;
    }
    &:focus {
      border:none;
      outline: none;
    }
  }

  .icon-right{
    position: absolute;
    right:0px;

    &:focus-visible {
      outline: none;
    }
    &:hover{
      border: none;
    }
    &:focus {
      border:none;
      outline: none;
    }
  }
}
    
</style>