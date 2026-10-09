<template>
  <el-menu-item :disabled="disabled">
    <div class="menu-item-wrapper" @click="handleClick">
      <slot>
        <el-icon :size="16" v-if="icon">
          <component :is="icon" />
        </el-icon>
        <span>{{ title }}</span>
      </slot>
    </div>
  </el-menu-item>
</template>

<script lang="ts">

</script>
<script lang='ts' setup>
import type { Component } from 'vue';
import { MenuItem } from './types';

const props = withDefaults(defineProps<{
 clickTrigger?: boolean
 title?: string,
 icon?: Component,
 click?: MenuItem['click'],
 disabled?: boolean,
}>(), {
  clickTrigger: true,
});


const handleClick = (ev: MouseEvent) => {
  if (props.disabled) return;
  if (props.clickTrigger === false) ev.stopPropagation();
  props.click?.(ev);
}
</script>

<style lang='scss' scoped></style>