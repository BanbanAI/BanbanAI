<template>
  <div class="nocode-guide-content server-welcome">
    <div class="header">
      <p class="title">{{ title }}</p>
      <p class="subtitle">{{ subtitle }}</p>
    </div>
    <div class="wrapper-main app-no-drag">
        <slot name="main"></slot>
    </div>
    <div class="wrapper-footer app-no-drag">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup lang='ts'>
const props = defineProps<{
  title: string,
  subtitle: string,
}>();
</script>

<style scoped lang='scss'>
.nocode-guide-content {
  width: 100%;
  height: 100%;

  .header {
    width: 100%;

    .title {
      font-size: 32px;
      font-weight: 500;
      line-height: 40px;
      color: var(--text-color-primary);
    }

    .subtitle {
      color: var(--text-color-secondary);
      font-size: 16px;
      line-height: 24px;
      margin-top: 12px;
    }
  }

  .wrapper-main {
    padding-top: 96px;
    width: 100%;
    position: relative;
  }

  .wrapper-footer {
    width: 100%;
  }
}
.server-welcome {
  width: 1440px !important;
  padding: 0 176px;
  margin: 0 auto;
}
</style>
