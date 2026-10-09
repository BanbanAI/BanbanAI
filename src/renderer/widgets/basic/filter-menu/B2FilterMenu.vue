<template>
  <b2-widget>
    <div class="drop-down-wrap" v-if="widget.styleCategory === 'select'">
      <teleport to="body">
        <div class="tree-select-popper" :id="`popper-${widget.uid}`"></div>
      </teleport>
      <el-select-v2
        v-if="!isMobileDevice"
        class="drop-down"
        popper-class="fliter-menu-popper"
        ref="treeSelectRef"
        :teleported="true"
        :append-to="`#popper-${widget.uid}`"
        :modelValue="widget.selectedItemKey"
        value-key="id"
        @update:modelValue="updateSelected"
        :options="widget?.menuItemList"
        :no-data-text="$t('noSelectData')"
        :highlight-current="true"
        :props="{ label: 'value', value: 'id' }"
        :placeholder="widget.dropdownNoData"
        :clearable="true"
      ></el-select-v2>
      <div v-else class="mobile-select-wrap" ref="buttonsRef">
        <div class="mobile-select" @click="mobileSelectDrawerVisible = true">
          <span
            class="select-inner"
            :class="{ 'placeholder': !widget?.currentValue?.value }"
          >
            {{ widget?.currentValue?.value || $t('plsSelect') }}
          </span>
          <el-icon class="el-input__icon"><ArrowDown /></el-icon>
        </div>
        <mobile-select-drawer
          v-model="mobileSelectDrawerVisible"
          :selectedItemKey="(widget.selectedItemKey as string)"
          :dataList="widget.menuItemList"
          @select-confirm="handleMobileSelectConfirm"
        />
      </div>
    </div>

    <div v-else class="filter-menu classic" ref="buttonsRef">
      <div class="item-container" v-for="(buttonItem, buttonIndex) of tagItems" :key="buttonItem.id">
        <div
          v-if="!isMobileDevice && buttonItem.show"
          :class="{
            'button-item': true,
            'selected': buttonItem.id == widget.selectedItemKey,
            'useSelectedStyle': buttonItem.useSelectedStyle,
            'useHoverStyle': buttonItem.useHoverStyle,
            'vertical': widget.getOption('text-arrangement') === 'vertical',
          }"
          :data-key="buttonItem.id"
        >
          <div
            class="item-content"
            v-if="!buttonItem.isEmpty"
            :style="buttonItem.style"
            @click.stop="handleClick(buttonItem.id)"
            @click.right="handleClickRight"
          >
            <div class="button-label">{{ buttonItem.label }}</div>
          </div>
        </div>
        <template v-if="isMobileDevice && buttonItem.show">
          <div
            v-if="buttonIndex < 2"
            :class="{
              'button-item': true,
              'selected': buttonItem.id == widget.selectedItemKey,
              'useSelectedStyle': buttonItem.useSelectedStyle,
              'useHoverStyle': buttonItem.useHoverStyle,
              'vertical': widget.getOption('text-arrangement') === 'vertical',
            }"
            :data-key="buttonItem.id"
            >
            <div
              class="item-content"
              v-if="!buttonItem.isEmpty"
              :style="buttonItem.style"
              @click.stop="handleClick(buttonItem.id)"
              @click.right="handleClickRight"
              >
              <div class="button-label">{{ buttonItem.label }}</div>
            </div>
          </div>
          <div v-else-if="buttonIndex === 2 && buttonItems.length > 3"
            :class="{
              'more-btn': true,
              'button-item': true,
              'selected': isSelectedMore,
              'useSelectedStyle': buttonItem.useSelectedStyle,
              'useHoverStyle': buttonItem.useHoverStyle,
              'vertical': widget.getOption('text-arrangement') === 'vertical',
            }"
          >
            <div
              class="item-content"
              @click.stop="handleClickMore"
            >
              <div class="button-label">{{ moreBtnText }}</div>
              <el-icon class="el-input__icon"><ArrowDown /></el-icon>
            </div>
          </div>
        </template>
      </div>
    </div>
    <mobile-select-drawer
      v-if="isMobileDevice && widget.styleCategory === 'card'"
      v-model="mobileMoreDrawerVisible"
      :selectedItemKey="(widget.selectedItemKey as string)"
      :dataList="moreItems"
      @select-confirm="handleMobileMoreConfirm"
    />
  </b2-widget>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch, onUnmounted, nextTick, computed } from "vue";
import { isMobile } from "@renderer/utils/pure";
import { useWidget, OptionFontValue, OptionFileValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { equals } from "@common/utils/object";
import { FilterMenu } from "./filterMenu";
import { TheWidget as HorizontalFilterMenu } from '@renderer/widgets/basic/horizontal-filter-menu';
import { ArrowDown } from '@element-plus/icons-vue';
import MobileSelectDrawer from "./MobileSelectDrawer.vue";
import i18next, { $t } from "@renderer/widgets/i18next";

type ButtonItem = {
  isEmpty: boolean,
  id: string,
  label: string,
  show: boolean,
  style?: Record<string, string>;
  useSelectedStyle?: boolean,
  useHoverStyle?: boolean,
}

const isMobileDevice = isMobile();

const widget = useWidget<FilterMenu | HorizontalFilterMenu>();
const buttonItems = ref<ButtonItem[]>([]);
const buttonsRef = ref(null);
const updateTime = ref(null);
const mobileSelectDrawerVisible = ref(false);
const mobileMoreDrawerVisible = ref(false);

const tagItems = computed(() => {
  if (isMobileDevice) {
    return buttonItems.value.slice(0, 3);
  }
  return buttonItems.value;
});

const moreItems = computed(() => {
  return widget.menuItemList.slice(2);
})

const isSelectedMore = computed(() => {
  const index = buttonItems.value.findIndex(i => i.id === widget.selectedItemKey);
  return index >= 2;
});

const moreBtnText = computed(() => {
  const index = buttonItems.value.findIndex(i => i.id === widget.selectedItemKey);
  return index < 2 ? "更多" : buttonItems.value[index].label;
});

const handleClick = (itemKey) => {
  if (widget.getBoard().status.isEditable && !widget.getBoard().isPlaying && !widget.status.isActive) return;
  selectItem(itemKey);
}

const handleClickRight = (ev) => {
  if(widget.getOption("allow-unselected")) {
    widget.setSelectedItem();
    widget.withdrawLinkage();
  }
}

const handleClickMore = () => {
  mobileMoreDrawerVisible.value = true;
}

const updateSelected = (k) => {
  widget.selectedItemKey = k;

}

const selectItem = (itemKey) => {
  if (!itemKey || itemKey === widget.selectedItemKey) {
    widget.setSelectedItem();
    widget.withdrawLinkage();
    widget.selectedItemKey = undefined;
  } else {
    widget.setSelectedItem(itemKey);
  }
}

const handleMobileSelectConfirm = (itemKey) => {
  if (itemKey !== widget.selectedItemKey) {
    selectItem(itemKey);
  }
  mobileSelectDrawerVisible.value = false;
}

const handleMobileMoreConfirm = (itemKey) => {
  if (itemKey !== widget.selectedItemKey) {
    selectItem(itemKey);
  }
  mobileMoreDrawerVisible.value = false;
}


const defaultStyle = ref<any>({});
watch(()=>{

},
()=>{
})

const optionReady = ref(false);
watch(() => {
  return widget.getBoard().isReady();
}, (val) => {
  optionReady.value = val;
}, { immediate: true })

if (widget.styleCategory === "card") {
  watch(() => {
    return {
      ready: widget.isReady(),
      inited: optionReady.value,
      updateTime: updateTime.value,
      menuItemList: widget.menuItemList
    }
  }, async (value, oldValue) => {
    const { ready, inited } = value;
    if (!equals(value, oldValue) && ready && inited) {
      let allowUnselected = widget.getOption("allow-unselected");
      buttonItems.value = widget.menuItemList?.map((item, itemIndex) => {
        let { label, id } = item;
        if (itemIndex === 0 && !widget.selectedItemKey && !allowUnselected) {
          if (widget.selectedItemKey !== id) {
            widget.setSelectedItem(id);
          }
        }
        return {
          isEmpty: false,
          id: id,
          label: label,
          show: true
          // show: itemIndex <= buttonCount - 1 || layoutSetting === "scroll" ? true : false
        };
      });
      if (buttonsRef) {
        buttonsRef.value.style.transform = "none";
      }
    }
  }, { immediate: true, deep: true });
} else {
  watch(() => {
    return {
      nameList: widget.menuItemList || []
    }
  }, (value, oldValue) => {
    if (equals(value.nameList, oldValue.nameList)) return;
    let count = value.nameList.length;
    let oldCount = oldValue?.nameList?.length || 0;
    if (count - oldCount < 0) {
      //刪除多余的配置项
    }
    updateTime.value = Date.now();
    let buttonInfo = widget.menuItemList.find(item => item.id == widget.selectedItemKey);
    if (buttonInfo?.id || !optionReady.value) return;
    widget.setSelectedItem();
  });
}

const styleOptions = ["font", "text-spacing", "text-align", "text-offset", "font-shadow-color", "font-shadow-blur", "font-shadow-offset", "border-color", "border-size", "border-radius", "border-style", "background-color", "background-image", "background-image-fill", "background-blur", "use-nine-patch", "nine-patch"];

// 如果由数据字段生成，值会随着数据加载完做一次更新，需要处理一次默认值
// let keyWatchHandle = watch(() => {
//   return {
//     key: widget.getOption<string>("selected-key"),
//     inited: optionReady.value
//   }
// }, async (val, oldVal) => {
//   if (val.key !== oldVal.key) {
//     let buttonInfo = widget.menuItemList.find(item => item.key == val.key);
//     if (buttonInfo?.key) {
//       widget.selectedItemKey = val.key;
//     } else {
//       widget.selectedItemKey = widget.menuItemList?.[0]?.key || "";
//     }
//   }
//   await nextTick();
//   keyWatchHandle();
// })

// let watchInit = watch(() => {
//   return {
//     ready: widget.getBoard().status.isProjectReady,
//     inited: optionReady.value,
//     visible: widget.status.isVisible
//   }
// }, async (val, oldVal) => {
//   if (val.inited && val.ready && val.visible) {
//     widget.setSelectedItem(widget.selectedItemKey);
//     await nextTick();
//     watchInit();
//   }
// }, { immediate: true })

</script>

<style lang="scss" scoped>
.drop-down-wrap {
  width: 100%;

  .drop-down {
    :deep(.el-select__wrapper) {
      height: 32px;
      border-radius: 4px;
    }
  }
}


.filter-menu {
  background-color: var(--bg-color-overlay);
  padding: 3px;
  display: flex;
  justify-items: center;
  align-items: center;
  width: 100%;
  height: 32px;
  gap: 3px;
  border-radius: 4px;

  &.scroll {
    display: flex;
  }

  .button-item:hover {
    cursor: var(--cursor-pointer);
  }

  &.editing .button-item:hover {
    cursor: n-resize;
  }

  &.editing.rowEdit .button-item:hover {
    cursor: e-resize;
  }

  .button-item {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 2px;
    background: transparent;

    .item-content {
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
      border-radius: 2px;
      padding: 7px;

      .button-label {
        width: 100%;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        pointer-events: none;
        color: var(--text-color-regular);
        font-size: 14px;
        text-align: center;
        -webkit-background-clip: text;
        filter: drop-shadow(var(--dropShadow-default));
      }
    }

    &.vertical {
      .button-label {
        height: 100%;
        width: auto;
        writing-mode: vertical-rl;
        text-orientation: upright;
      }
    }

    &.selected {
      background: var(--color-white);

      .item-content .button-label {
        color: var(--color-primary);
      }
    }

    &.hover {
      background: var(--color-white);
    }
  }

  .more-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;

    &.selected {
      :deep(.el-icon) {
        color: var(--text-color-secondary);
      }
    }
  }
}
.item-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.mobile-select-wrap {
  width: 100%;
  height: 100%;

  .mobile-select {
    height: 40px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0 12px;
    background-color: var(--color-white);
    display: flex;
    align-items: center;

    .select-inner {
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &.placeholder {
        color: var(--text-color-placeholder);
      }
    }
    :deep(.el-icon) {
      color: var(--text-color-placeholder);
    }
  }
}
</style>
<style lang="scss">
.fliter-menu-popper {
  border: none !important;

  &.is-light {
    background-color: var(--color-white);
  }

  .el-scrollbar {
    --el-scrollbar-bg-color: var(--color-white) !important;
  }

  .el-select-dropdown__wrap {
    background-color: var(--color-white);
  }

  .el-dropdown__list {
    padding: 0 !important;
  }

  .el-popper__arrow {
    display: none !important;
  }

  .el-scrollbar__view,
  .el-dropdown-menu {
    background-color: var(--color-white);
    padding: 2px;

    .el-select-dropdown__item,
    .el-dropdown-menu__item {
      height: 32px;
      line-height: 32px;
      margin-bottom: 2px;
      border-radius: 2px;

      &:last-child {
        margin-bottom: 0;
      }

      &.is-selected {
        background-color: var(--color-white);
      }

      &.is-hovering {
        background-color: var(--bg-color-overlay);
      }
    }
  }
}
</style>
