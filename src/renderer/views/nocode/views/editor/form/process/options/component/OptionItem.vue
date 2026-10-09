<template>
  <div class="option-item">
    <div v-if="!hideTitle" class="title">{{ title }}</div>
    <slot></slot>
  </div>
</template>

<script lang='ts' setup>
const props = defineProps<{
  title: string,
  hideTitle?: boolean,
}>();
</script>

<style lang='scss' scoped>
.option-item {
  display: flex;
  flex-direction: column;
  row-gap: 8px;
  .title {
    line-height: 20px;
    font-weight: bold;
  }
}
</style>