<template>
  <div class="base-setting-panel">
    <div class="panel-header" :class="{ 'non-collapsible': !collapsible }" @click="toggleCollapse">
      <el-icon class="collapse-icon" :class="{ 'is-collapsed': isCollapsed && collapsible  }">
        <i-ep-caret-right></i-ep-caret-right>
      </el-icon>
      <h3 class="panel-title">{{ title }}</h3>
      <slot name="tip"></slot>
    </div>

    <div class="panel-content" v-show="!isCollapsed">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  collapsible?: boolean
}>(), {
  collapsible: false
});

const isCollapsed = ref(false);

const toggleCollapse = () => {
  if (!props.collapsible) return;
  isCollapsed.value = !isCollapsed.value;
}
</script>

<style lang='scss' scoped>
.base-setting-panel {
  width: 100%;
  user-select: none;

  .panel-header {
    display: flex;
    align-items: center;
    position: relative;
    margin-bottom: 0;
    cursor: var(--cursor-pointer);
    height: 16px;
    font-size: 12px;

    &.non-collapsible {
      cursor: var(--cursor-default);
    }

    .panel-title {
      font-size: 12px;
      display: inline-block;
      font-weight: 500;
      color: #727272;
    }

    .collapse-icon {
      color: var(--text-color-secondary);
      justify-content: start;
      transform: translateX(-25%);

      &.is-collapsed {
        svg {
          transform-origin: center center;
          transform: rotate(90deg);
        }
      }
    }
  }

  .panel-content {
    padding-top: 16px;
  }
}
</style>