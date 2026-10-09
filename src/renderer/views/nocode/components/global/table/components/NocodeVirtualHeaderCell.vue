<template>
  <div
    class="nocode-virtual-header-cell"
    :class="{
      'is-menu-open': menuOpen,
      'is-clickable': props.showMenu,
      'is-single-line': props.singleLine,
    }"
    @click="handleRootClick"
  >
    <span class="nocode-virtual-header-cell__title-wrapper">
      <span class="nocode-virtual-header-cell__title" :title="headerTitle">{{ headerTitle }}</span>
    </span>
    <table-menu
      ref="tableMenuRef"
      v-if="showMenu"
      trigger="click"
      class="nocode-virtual-header-cell__menu"
      @open="handleMenuOpen"
      @close="handleMenuClose"
    >
      <template #title>
        <el-icon
          :size="16"
          class="nocode-virtual-header-cell__icon"
          :class="{ more: descriptor.indicatorKind === 'more' }"
        >
          <component :is="indicatorIcon" class="icon" />
        </el-icon>
      </template>
      <table-menu-item
        v-for="menu in menuItems"
        :key="menu.index"
        :menu="menu"
        :click="menu.click"
        :disabled="menu.disabled"
      >
        <el-icon :size="16">
          <component :is="menu.icon" />
        </el-icon>
        <span>{{ menu.title }}</span>
      </table-menu-item>
      <slot name="menu-extra"></slot>
    </table-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType, ref } from "vue";
import { Refresh, Top, Bottom } from "@element-plus/icons-vue";
import i18next from "i18next";
import TableMenu from "./table-menu/TableMenu.vue";
import TableMenuItem from "./table-menu/TableMenuItem.vue";
import { MenuItem } from "./table-menu/types";
import {
  NocodeHeaderActionKey,
  NocodeHeaderDescriptor,
} from "@renderer/components/virtual-table/nocode-header-contract";

const props = defineProps({
  descriptor: {
    type: Object as PropType<NocodeHeaderDescriptor>,
    required: true,
  },
  showMenu: {
    type: Boolean,
    default: true,
  },
  singleLine: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  (event: "action", actionKey: NocodeHeaderActionKey): void;
  (event: "menu-open"): void;
  (event: "menu-close"): void;
}>();

const menuOpen = ref(false);
const tableMenuRef = ref<{
  toggleRootMenu?: () => void;
} | null>(null);

const indicatorIcon = computed(() => {
  switch (props.descriptor.indicatorKind) {
    case "filter":
      return ITableFilter;
    case "sort-asc":
      return Top;
    case "sort-desc":
      return Bottom;
    case "filter-sort-asc":
      return ITableFilterTop;
    case "filter-sort-desc":
      return ITableFilterBottom;
    default:
      return ITableVerticalMore;
  }
});

const headerTitle = computed(() => {
  return props.descriptor.title || "";
});

const menuMetaMap: Record<NocodeHeaderActionKey, { title: string; icon: any }> = {
  "sort-asc": {
    get title() { return i18next.t("NocodeTable.asc") },
    icon: ITableAscending,
  },
  "sort-desc": {
    get title() { return i18next.t("NocodeTable.desc") },
    icon: ITableDescending,
  },
  freeze: {
    get title() { return i18next.t("NocodeTable.freezeColumn") },
    icon: ITableFreeze,
  },
  unfreeze: {
    get title() { return i18next.t("NocodeTable.Unfreeze") },
    icon: ITableFreeze,
  },
  hide: {
    get title() { return i18next.t("NocodeTable.hideColumn") },
    icon: ITableHidden,
  },
  "update-data": {
    get title() { return i18next.t("NocodeTable.updateData") },
    icon: Refresh,
  },
};

const menuItems = computed<MenuItem[]>(() => {
  return props.descriptor.actionKeys.map((actionKey, index) => {
    const meta = menuMetaMap[actionKey];
    return {
      index: String(index + 1),
      title: meta.title,
      icon: meta.icon,
      disabled: props.descriptor.disabledActionKeys?.includes(actionKey),
      click: () => emit("action", actionKey),
    };
  });
});

const handleMenuOpen = () => {
  menuOpen.value = true;
  emit("menu-open");
};

const handleMenuClose = () => {
  menuOpen.value = false;
  emit("menu-close");
};

const handleRootClick = (event: MouseEvent) => {
  if (!props.showMenu) {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (target?.closest(".nocode-virtual-header-cell__menu")) {
    return;
  }
  tableMenuRef.value?.toggleRootMenu?.();
};
</script>

<style scoped lang="scss">
.nocode-virtual-header-cell {
  display: inline-flex;
  align-items: center;
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  column-gap: 6px;

  &.is-clickable {
    box-sizing: border-box;
    width: calc(100% + 24px);
    margin: 0 -12px;
    padding: 0 12px;
    cursor: pointer;
  }

  &__title-wrapper {
    display: flex;
    align-items: center;
    min-width: 0;
    max-height: 60px;
    overflow: hidden;
    line-height: 20px;
  }

  &__title {
    display: -webkit-box;
    min-width: 0;
    max-height: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    white-space: normal;
    line-height: 20px;
    word-break: break-word;
    overflow-wrap: anywhere;
    pointer-events: none;
  }

  &.is-single-line &__title-wrapper {
    max-height: none;
    white-space: nowrap;
    line-height: normal;
  }

  &.is-single-line &__title {
    display: block;
    max-height: none;
    -webkit-line-clamp: unset;
    -webkit-box-orient: initial;
    white-space: nowrap;
    line-height: normal;
    word-break: normal;
    overflow-wrap: normal;
  }

  &__menu {
    position: absolute;
    inset: 0;

    :deep(.menu .first-sub-menu) {
      padding: 0;
    }

    :deep(.table-menu),
    :deep(.menu) {
      width: 100%;
      height: 100%;
    }

    :deep(.menu .el-sub-menu) {
      width: 100%;
      height: 100%;
      background-color: transparent !important;
    }

    :deep(.menu .el-sub-menu__title) {
      width: 100%;
      height: 100%;
      justify-content: flex-end;
      padding: 0;

      .el-icon {
        margin-right: 0;
      }
    }
  }

  &__icon {

    &.more {
      opacity: 0;
      transition: opacity 0.16s ease;
    }
  }

  &:hover &__icon.more,
  &.is-menu-open &__icon.more {
    opacity: 1;
  }
}
</style>
