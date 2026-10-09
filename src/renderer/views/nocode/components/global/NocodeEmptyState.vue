<template>
  <div class="nocode-empty-state">
    <img class="nocode-empty-state__image" src="@renderer/assets/image/workbench/nocode-aggregate-empty.png" alt="">
    <div class="nocode-empty-state__text">{{ description || $t('AggregateEmptyState.noData') }}</div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  description?: string,
}>(), {
  description: '',
});
</script>

<style scoped lang="scss">
.nocode-empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.nocode-empty-state__image {
  display: block;
  width: 64px;
}

.nocode-empty-state__text {
  margin-top: 8px;
  color: #8f95a3;
  font-size: 14px;
  line-height: 22px;
  text-align: center;
}
</style>
