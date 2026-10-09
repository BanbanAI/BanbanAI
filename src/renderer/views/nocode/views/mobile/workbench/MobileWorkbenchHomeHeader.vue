<template>
  <div class="mobile-workbench-home-header">
    <div class="header-left">
      <img class="logo" src="@renderer/assets/image/workbench/company-logo.svg" />
      <div class="name">{{ companyName }}</div>
    </div>
    <div class="header-right">
      <MobileWorkbenchUserCard @clickAvatar="emit('clickAvatar')"></MobileWorkbenchUserCard>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { useSettingStore } from '@renderer/stores';

const emit = defineEmits<{
  (e: 'clickAvatar'): void
}>();

const settingState = useSettingStore();
const companyName = computed(() => settingState.companyName);
</script>

<style scoped lang='scss'>
.mobile-workbench-home-header {
  height: 40px;
  display: flex;
  justify-content: space-between;

  .header-left {
    display: flex;
    align-items: center;
    
    .logo {
      width: 24px;
      height: 24px;
      margin-right: 8px;
    }
    .name {
      font-size: 18px;
      font-weight: 500;
      max-width: calc(100vw - 112px);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  .header-right {
    margin-right: 8px;
  }
}
</style>
