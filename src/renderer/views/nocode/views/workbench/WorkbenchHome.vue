<template>
  <div class="workbench-home">
    <div class="workbench-home-shell">
      <section class="workbench-home-stage">
        <el-header class="workbench-home-page-header">
          <workbench-home-header />
        </el-header>
        <el-main class="workbench-home-page-main">
          <div class="workbench-home-page-content">
            <router-view />
          </div>
        </el-main>
      </section>
    </div>
  </div>
  <occupy-dialog />
</template>

<script setup lang='ts'>
import { usePassportStore } from '@renderer/stores';
import i18next from 'i18next';
import { useLocalizedDocumentTitle } from '@renderer/hooks/useLocalizedDocumentTitle';

useLocalizedDocumentTitle(() => `${i18next.t('WorkbenchHome.workbench')} - ${i18next.t("productName")}`);
const passportState = usePassportStore();
passportState.init();
</script>

<style scoped lang='scss'>
.workbench-home {
  width: 100%;
  height: 100vh;
  min-width: 1040px;
  background-color: #f2f3f5;
  overflow: hidden;

  .workbench-home-shell {
    width: 100%;
    height: 100%;
    display: flex;
    transition: grid-template-columns 0.24s ease;
  }

  .workbench-home-stage {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    margin: 0 auto;
    flex-direction: column;
    background-color: #f2f3f5;
    overflow: hidden;
    position: relative;
  }

  .workbench-home-page-header {
    width: 100%;
    height: 60px;
    flex-shrink: 0;
    --el-header-padding: 0;
    box-shadow: 0 3px 10px rgba(29, 33, 41, 0.05);
    z-index: 20;
  }

  .workbench-home-page-main {
    padding: 0 !important;
  }

  .workbench-home-page-content {
    flex: 1;
    min-height: 100%;

    :deep(.workbench-home-main-scrollbar) {
      height: 100%;
    }
  }
}
</style>
