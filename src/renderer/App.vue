<template>
  <el-config-provider :locale="elementPlusLocale">
    <div class="app">
      <router-view></router-view>
    </div>
  </el-config-provider>
</template>
<script setup lang="ts">
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale';
</script>
<style lang='scss' scoped>
.app {
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow: auto hidden;
  position: relative;
}

</style>
