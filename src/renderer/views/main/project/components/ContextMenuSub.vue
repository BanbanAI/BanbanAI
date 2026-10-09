<template>
  <template v-for="menu,index in menus" :key="index">
    <div class="el-menu-item" @click.stop="handleClick(menu.widget)">
      <img class="icon" :src="menu.widget.icon" alt="">
      <span class="widget-name">{{ menu.widget.name }}</span>
    </div>
    <div class="group-children" v-if="menu.children?.length">
      <context-menu-sub :paddingLeft="paddingLeft + 12" :selectedUid="selectedUid" :menus="menu.children" @selected="handleClick"></context-menu-sub>
    </div>
  </template>
</template>


<script lang="ts" setup>
import { Widget } from '@renderer/b2/controllers/widget';

type Menu = {
  widget: Widget,
  children?: Menu[],
}
withDefaults(defineProps<{
  selectedUid: string,
  menus: Menu[],
  paddingLeft?: number,
}>(), {
  paddingLeft: 10,
});

const emit = defineEmits<{
  (event: 'selected', widget: Widget),
}>()

const handleClick = (widget: Widget) => {
  emit('selected', widget);
}
</script>

<style lang="scss" scoped>
.el-menu-item {
  height: 25px;
  display: flex;
  align-items: center;
  padding-left: v-bind("paddingLeft + 'px'") !important;
  position: relative;

  .select-icon {
    width: 12px;
    position: unset;
    svg {
      position: absolute;
      left: 10px;
    }
  }
  .icon {
    width: 25px;
    height: 25px;
    filter: brightness(1.2) saturate(0%);
  }

  .widget-name {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
  }
}
.group-children {
  display: flex;
  flex-direction: column;
}
</style>