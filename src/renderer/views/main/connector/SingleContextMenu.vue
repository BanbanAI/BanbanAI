<template>
  <div class="single-context-menu" :style="modal ? modalStyle : {}" v-show="modelValue">
    <el-menu mode="vertical" :class="['contextMenu', menuClass]" :style="{
      left: `${position?.x}px`,
      top: `${position?.y}px`,
    }" v-click-outside="handleClickOutside">
      <el-menu-item :class="item.className" v-for="item in menus" :key="item.label" @click="handleContextClick(item)" v-show="item.visible !== false">
        <template v-if="item.icon">
          <i class="icon" v-if="typeof (item.icon) === 'string'" :class="['fs', item.icon]"></i>
          <el-icon class="icon" v-else>
            <component :is="item.icon" :size="14"></component>
          </el-icon>
        </template>
        <span>{{ item.label }}</span>
      </el-menu-item>
    </el-menu>
  </div>
</template>

<script lang='ts' setup>
import { useWindowSize } from '@vueuse/core';
import { onUnmounted, watch, reactive, StyleValue } from 'vue';
import { ClickOutside as vClickOutside } from 'element-plus'
import { nextTick, Component as ComponentType } from 'vue';

type Menu = {
  label: string,
  className?: string,
  icon?: ComponentType | string,
  click: (...args: any[]) => void,
  visible?: boolean,
}

const props = withDefaults(defineProps<{
  event: MouseEvent,
  menus: Menu[],
  modelValue: boolean,
  modal?: boolean,
  menuClass?: string,
  menuWidth?: number,
  menuItemHeight?: number,
}>(), {
  modal: false,
  menuClass: '',
  menuWidth: 130,
  menuItemHeight: 25,
});
const modalStyle: StyleValue = {
  position: 'fixed',
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  'background-color': 'rgba(0, 0, 0, 0.4)',
  zIndex: 99,
}

const position = reactive({
  x: 0,
  y: 0,
})
const { width, height } = useWindowSize();
const setPosition = async () => {
  await nextTick();
  const event = props.event;

  if (!event?.target) return;
  
  // 不能拿event.x、y的值来用，需要考虑 resize 的情况，position得动态算
  const { x, y } = event.target.getBoundingClientRect();
  let expectX = event.offsetX + x;
  let expectY = event.offsetY + y;

  const visibleMenus = props.menus.filter(item => item.visible !== false);
  const dividerCount = visibleMenus.filter(item => String(item.className || '').includes('has-divider')).length;
  const menuHeight = visibleMenus.length * props.menuItemHeight + dividerCount * 8 + 2;
  const menuWidth = props.menuWidth;

  // 下
  if (expectY + menuHeight > height.value) {
    expectY = height.value - menuHeight;
  }

  // 右
  if (expectX + menuWidth > width.value) {
    expectX = width.value - menuWidth;
  }

  position.x = expectX;
  position.y = expectY;
}

watch(() => props.modelValue, (value) => {
  if (!value) return;
  setPosition();
})

const resizeCallback = () => {
  if (!props.modelValue) return;
  setPosition();
};
window.addEventListener('resize', resizeCallback);

onUnmounted(() => {
  window.removeEventListener('resize', resizeCallback);
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)
}>()

const handleContextClick = (item) => {
  const { click, ...rest } = item;
  emit('update:modelValue', false);
  click(rest);
}

const handleClickOutside = () => {
  if (!props.modelValue) return;
  emit('update:modelValue', false);
}

defineExpose({
  syncPosition: setPosition,
})

</script>

<style lang='scss' scoped>
.contextMenu {
  --el-menu-base-level-padding: 10px;
  --el-menu-item-height: 25px;
  --el-font-size-base: 12px;
  --el-menu-item-font-size: var(--el-font-size-base);
  --el-menu-bg-color: var(--bg-color-overlay);

  position: fixed;
  z-index: 9999;
  width: 130px;
  border: solid 1px var(--el-menu-border-color);

  .el-divider {
    margin: 2px 0;
  }

  :deep(.el-menu-item-group__title) {
    display: none;
  }

  .el-menu-item {

    .selectOptions {
      display: none;
      position: absolute;
      z-index: 9999;
      flex-direction: column;
      transform: translateX(-100%);
      top: 0;
      left: 0;
      width: 120px;
      border: solid 1px var(--el-menu-border-color);
      background-color: #2e2f33;

      .option {
        width: 100%;
        height: 25px;
        line-height: 25px;
        font-size: 12px;
        text-align: center;
        position: relative;

        i {
          position: absolute;
          top: 50%;
          left: 5px;
          transform: translateY(-50%);
        }

        &:hover {
          background-color: #18222c;
        }
      }

    }

    &:hover {
      .selectOptions {
        display: flex;
      }
    }
  }

  .icon {
    display: flex;
    width: 25px;
    height: 25px;
    font-size: 14px;
    justify-content: start;
    align-items: center;
  }

  .fs-arrow::before {
    padding-left: 13px;
  }

  &.nocode-editor-tree-context-menu {
    --el-menu-item-height: 36px;
    --el-font-size-base: 14px;
    --el-menu-item-font-size: var(--el-font-size-base);
    --el-menu-bg-color: #ffffff;

    width: 160px;
    padding: 4px;
    border: 1px solid #e5e6eb;
    border-radius: 8px;
    background-color: #ffffff;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);

    .el-menu-item {
      height: 36px;
      padding: 0 12px;
      margin: 0;
      border-radius: 4px;
      color: #1d2129;
      display: flex;
      align-items: center;
      column-gap: 8px;
      line-height: 22px;

      &:hover {
        background-color: #f7f8fa;
      }

      &.has-divider {
        margin-top: 8px;
        position: relative;

        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: -5px;
          width: 100%;
          height: 1px;
          background-color: #e5e6eb;
        }
      }
    }

    .icon {
      width: 16px;
      height: 16px;
      flex: 0 0 16px;
      justify-content: center;
      align-items: center;
      font-size: 16px;
    }
  }
}
</style>
