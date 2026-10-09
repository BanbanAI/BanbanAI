<template>
  <div>
    <template v-for="menu in menus" :key="menu.index">
      <el-sub-menu v-if="menu.children && menu.visible !== false" :index="menu.index" @mouseenter.stop="onMouseenter" @mouseleave.stop="onMouseleave">
        <template #title>
          <div class="sub-menu-title" :data-index="menu.index">
            <el-icon :size="16" v-if="menu.icon">
              <component :is="menu.icon" />
            </el-icon>
            <span>{{ menu.title }}</span>
            <el-icon :size="16" class="sub-menu-arrow">
              <i-ep-arrow-right />
            </el-icon>
          </div>
        </template>
        <table-sub-menu :menus="menu.children"></table-sub-menu>
      </el-sub-menu>
      <table-menu-item v-else-if="menu.visible !== false" v-bind="menu"></table-menu-item>
    </template>
  </div>

</template>

<script lang='ts' setup>
import { MenuItem, Menus, useTableMenu } from './types';
import { onBeforeUnmount } from 'vue';
import TableMenuItem from './TableMenuItem.vue';

const props = defineProps<{
  menus: Menus,
}>();

const menuRef = useTableMenu();
let delayCloseTimer: number;

onBeforeUnmount(() => {
  clearTimeout(delayCloseTimer);
});

const onMouseenter = ({target}) => {
  clearTimeout(delayCloseTimer);
  if (target.nodeName !== "LI" || !target.classList.contains("el-sub-menu")) return;
  const menuName = target.querySelector(".el-sub-menu__title > .sub-menu-title")?.dataset?.index;
  menuRef.value.open(menuName);
};

const onMouseleave = ({target}) => {
  if (target.nodeName !== "LI" || !target.classList.contains("el-sub-menu")) return;
  const menuName = target.querySelector(".el-sub-menu__title > .sub-menu-title")?.dataset?.index;
  delayCloseTimer = setTimeout(() => {
    menuRef.value.close(menuName);
  }, 60) as unknown as number;
};
</script>

<style lang='scss' scoped>

</style>
