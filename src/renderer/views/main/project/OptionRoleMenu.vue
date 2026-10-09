<template>
  <div class="option-role-menu" v-click-outside="hideOptionRoleMenu" v-if="dialogStorage.optionRoleMenuVisible">
    <el-popover :virtual-ref="virtualRef" trigger="click" :visible="true" :teleported="false">
      <el-menu class="option-menu" mode="vertical">
        <template v-for="item in optionMenus">
          <el-menu-item @click="handleClick(item)" v-if="isShowMenuItem(item)" :class="{'not-allowed': item.disabled}">
            <el-icon size="16"><component :is="item.icon"></component></el-icon>
            <span>{{item.label}}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-popover>
  </div>
</template>
<script lang="ts" setup>
import { computed, inject, ref } from 'vue';
import { OptionMenuRole, OptionRoleMenuInstance } from "@renderer/b2/types";
import { PROJECT_ID } from "@renderer/types/inject";
import { Element } from "@renderer/b2/controllers/element";
import { useProjectDialogStore } from '@renderer/stores';
import { ClickOutside as vClickOutside } from 'element-plus'

const projectId = inject(PROJECT_ID);

const projectDialogState = useProjectDialogStore();
const dialogStorage = projectDialogState.getStorage(projectId);

const optionMenus = ref<OptionMenuRole[]>([]);

const isShowMenuItem = computed(() => (item: OptionMenuRole)=>{
  if(!('visible' in item)) return true;
  return typeof item.visible === 'function' ? item.visible() : item.visible;
})

const _element = ref<Element>();
const _paths = ref<string[]>([]);
const handleClick = (item: OptionMenuRole) => {
  if (_element.value) {
    item.callback(_element.value, _paths.value, _element.value.getOption(_paths.value));
  } else {
    item.callback();
  }
  hideOptionRoleMenu();
}

const virtualRef = ref<HTMLElement>();

defineExpose({
  get virtualRef() {
    return virtualRef.value;
  },
  get visible() {
    return dialogStorage.optionRoleMenuVisible;
  },
  show(targetElement, menus, element, paths) {
    optionMenus.value = menus;
    virtualRef.value = targetElement;
    _element.value = element;
    _paths.value = paths;
    dialogStorage.show('optionRoleMenuVisible');
  }
} as OptionRoleMenuInstance)

const hideOptionRoleMenu = () => {
  dialogStorage.hide('optionRoleMenuVisible');
  virtualRef.value = null;
  optionMenus.value = [];
}

</script>

<style lang="scss" scoped>
.option-role-menu {
  --popover-offset-x: 40px;
  :deep(.el-popover) {
    min-width: 130px;
    width: unset !important;
    margin-left: var(--popover-offset-x);

    --el-popover-padding: 5px 0;
    .el-popper__arrow::before {
      margin-right: var(--popover-offset-x);
    }

    .option-menu {
      --el-menu-base-level-padding: 15px;
      --el-menu-level-padding: 15px;
      
      z-index: 99;
    

    
      .el-menu-item {
        padding: 0 10px;
        height: 25px;
        line-height: 25px;
        font-size: 12px;
      }

      .not-allowed {
        pointer-events: none;
      }
    }
  }
}
</style>