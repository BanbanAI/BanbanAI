<template>
  <div class="mobile-workbench-home">
    <el-header>
      <mobile-workbench-home-header @clickAvatar="isShowSettings = true" />
    </el-header>
    <el-main style="height: calc(100% - 34px)">
      <router-view />
    </el-main>
    <mobile-workbench-settings-dialog
      v-show="isShowSettings"
      @logout="isShowSettings = false"
      @closeSettings="isShowSettings = false"
    ></mobile-workbench-settings-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { usePassportStore } from "@renderer/stores";

const passportState = usePassportStore();
passportState.init();

const isShowSettings = ref(false);
</script>

<style lang="scss" scoped>
.mobile-workbench-home {
  padding: 24px 16px;
  width: 100%;
  height: 100%;
  background-color: #f5f5f7;
  :deep(.el-header) {
    height: max-content;
    --el-header-padding: 0;
  }
  :deep(.el-main) {
    padding: 0 !important;
    &::-webkit-scrollbar {
      display: none;
    }
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
}
</style>
