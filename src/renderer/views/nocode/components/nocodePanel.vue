<template>
  <div class="title-panel">
    <div class="title-bar">
      <h2 class="title">{{ title }}</h2>
    </div>
    <el-divider class="divider"/>
    <div class="scroll-wrapper">
      <el-scrollbar class="content-scroll app-no-drag">
        <div class="content">
          <slot></slot>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
}>();
</script>

<style lang="scss" scoped>
.title-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;

  .title-bar {
    display: flex;
    flex-direction: column;

    .title {
      font-size: 20px;
      line-height: 32px;
      font-weight: 400;
      color: var(--text-color-primary);
    }
  }

  :deep(.divider) {
    width: calc(100% - 32px);
    background-color: var(--border-color-light);
  }

  .scroll-wrapper {
    max-height: calc(100% - 81px);
    position: relative;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;

    :deep(.content-scroll) {
      width: 100%;
      max-width: 100%;
      margin-right: 16px;
      flex: 1 0 auto;

      .el-scrollbar__wrap {
        overflow-x: hidden;
      }

      .el-scrollbar__view {
        width: 100%;
        max-width: 100%;
        min-width: 0;
      }

      .content {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        padding-right: 16px !important;
      }
    }
  }
}
</style>
