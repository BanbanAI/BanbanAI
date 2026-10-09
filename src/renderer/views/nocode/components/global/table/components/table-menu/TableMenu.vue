<template>
  <div class="table-menu">
    <el-menu class="menu" mode="horizontal" :menu-trigger="trigger" :ellipsis="false" :unique-opened="true" :close-on-click-outside="true" :persistent="false" ref="menuRef" @open="handleMenuOpen" @close="handleMenuClose">
      <el-sub-menu class="first-sub-menu" popper-class="widget-table-menu-popper" index="0">
        <template #title>
          <slot name="title">
            <el-icon :size="16">
              <i-table-more></i-table-more>
            </el-icon>
          </slot>
        </template>
        <slot v-if="visible">
          <table-sub-menu :menus="menus" />
        </slot>
      </el-sub-menu>
    </el-menu>
  </div>
</template>

<script lang='ts' setup>
import TableSubMenu from './TableSubMenu.vue';
import { Menus, provideTableMenu } from './types';
import { onBeforeUnmount, ref } from "vue";
import { MenuInstance } from "element-plus";

const props = withDefaults(defineProps<{
  trigger?: "click" | "hover",
  menus?: Menus,
}>(), {
  trigger: 'hover',
  menus: () => [],
});
const emit = defineEmits<{
  (event: 'open'): void;
  (event: 'close'): void;
}>();

const visible = ref(false);
const menuRef = ref<MenuInstance>();

const syncRootMenuVisible = (nextVisible: boolean) => {
  if (visible.value === nextVisible) {
    return;
  }
  visible.value = nextVisible;
  emit(nextVisible ? "open" : "close");
};

const handleMenuOpen = (index: string) => {
  if (index === '0') {
    syncRootMenuVisible(true);
  }
};
const handleMenuClose = (index: string, indexes: string[]) => {
  if (index === "0" || indexes?.length <= 1) {
    syncRootMenuVisible(false);
  }
};

provideTableMenu(menuRef);

onBeforeUnmount(() => {
  syncRootMenuVisible(false);
  menuRef.value?.close?.("0");
});

defineExpose({
  openRootMenu: () => {
    syncRootMenuVisible(true);
    menuRef.value?.open?.("0");
  },
  closeRootMenu: () => {
    syncRootMenuVisible(false);
    menuRef.value?.close?.("0");
  },
  toggleRootMenu: () => {
    if (visible.value) {
      syncRootMenuVisible(false);
      menuRef.value?.close?.("0");
      return;
    }
    syncRootMenuVisible(true);
    menuRef.value?.open?.("0");
  },
  isRootMenuOpen: () => visible.value,
});
</script>

<style lang='scss' scoped>
.table-menu {
  --el-menu-item-height: 32px;
  --el-menu-bg-color: transparent;

  :deep(.menu) {
    --el-menu-horizontal-height: var(--el-menu-item-height);
    border: none;
    .first-sub-menu {
      padding: 0 8px;
      &.is-opened {
        background-color: var(--bg-color-overlay)
      }
      .el-sub-menu__title {
        color: var(--text-color-primary);
        border: none;
        padding: 0;
        &:hover {
          background-color: transparent;
        }
      }
      .el-sub-menu__icon-arrow {
        display: none;
      }
    }
  }
}

</style>

<style lang="scss">
.el-popper.widget-table-menu-popper{
  transform: translateX(-8px);
}
.widget-table-menu-popper.el-menu--horizontal.el-menu--popup-container .el-menu {

  .el-sub-menu {

    &.is-opened .sub-menu-title {
      background-color: var(--el-menu-hover-bg-color);
      color: var(--el-menu-hover-text-color);
    }

    .el-sub-menu__title {
      padding: 0;
      color: var(--text-color-primary);

      .sub-menu-title {
        color: var(--text-color-primary);
        padding: 0 10px;
        width: 100%;
        display: flex;
        align-items: center;
        transition: border-color var(--el-transition-duration), background-color var(--el-transition-duration), color var(--el-transition-duration);


        &:hover {
          background-color: var(--el-menu-hover-bg-color);
          color: var(--el-menu-hover-text-color);
        }
        .sub-menu-arrow {
          margin-left: auto;
        }
      }
    }
    .el-sub-menu__icon-arrow {
      display: none;
    }

  }
  .el-menu-item {
    width: 100%;
    padding: 0;
    height: max-content;
    min-height: var(--el-menu-horizontal-sub-item-height);

    .menu-item-wrapper {
      color: var(--text-color-primary);
      width: 100%;
      padding: 0 10px;
      --el-menu-icon-width: 16px;
    }


    &:not(.is-disabled):hover .menu-item-wrapper{
      color: var(--el-menu-hover-text-color);
    }
  }
}
</style>
