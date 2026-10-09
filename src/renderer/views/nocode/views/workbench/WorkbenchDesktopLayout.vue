<template>
  <div class="workbench-desktop-layout">
    <workbench-ai-sidebar
      v-if="showAiWorkbenchUi"
      class="layout-ai-sidebar"
    />
    <div class="layout-page">
      <!-- 先注释掉 -->
      <!-- <router-view v-slot="{ Component }">
        <component :is="Component" :key="resolveWorkbenchRouteViewKey(route)" />
      </router-view> -->
      <router-view />
      <div ref="formOverlayHostRef" class="workbench-form-overlay-host"></div>
    </div>
    <nocode-login-dialog
      v-model="dialogState.loginDialogVisible"
      @update:modelValue="dialogState.loginDialogVisible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { useAiConfigStore, useDialogStore, usePassportStore } from '@renderer/stores';
import { useRoute } from 'vue-router';
import WorkbenchAiSidebar from './AI/WorkbenchAiSidebar.vue';
import {
  AI_WARMUP_ACTIVITY_REPORTER,
  installAiWarmupActivityReporter,
  type AiWarmupActivityReporter,
} from '../../utils/aiWarmupActivityReporter';
import {
  createWorkbenchAiFormFillContext,
  WORKBENCH_AI_FORM_FILL_CONTEXT,
} from './AI/workbenchAiFormFillContext';

const route = useRoute();
const dialogState = useDialogStore();
const formOverlayHostRef = ref<HTMLElement | null>(null);
provide(
  WORKBENCH_AI_FORM_FILL_CONTEXT,
  createWorkbenchAiFormFillContext(formOverlayHostRef),
);
const resolveWorkbenchRouteViewKey = (currentRoute: ReturnType<typeof useRoute>) => {
  const routeName = String(currentRoute.name || '').trim();
  if (routeName === 'NocodeEditor' || routeName === 'NocodeHome') {
    return `${routeName}:${String(currentRoute.params?.nocodeId || '').trim()}`;
  }
  return String(currentRoute.fullPath || currentRoute.path || '');
};
const hideWorkbenchAi = computed(() => route.matched.some(record => record.meta?.hideWorkbenchAi));
const aiConfigStore = useAiConfigStore();
const passportState = usePassportStore();
const showAiWorkbenchUi = computed(() => aiConfigStore.catalog.enabled && !hideWorkbenchAi.value);
let installedWarmupActivityReporter: ReturnType<typeof installAiWarmupActivityReporter> | null = null;
const warmupActivityReporter: AiWarmupActivityReporter = {
  report: type => installedWarmupActivityReporter?.report(type),
};
provide(AI_WARMUP_ACTIVITY_REPORTER, warmupActivityReporter);

watch(() => passportState.isLoginUser, (isLoggedIn, wasLoggedIn) => {
  if (!isLoggedIn || wasLoggedIn) return;
  void (async () => {
    await aiConfigStore.loadCatalog().catch(() => null);
    if (passportState.isLoginUser) {
      await aiConfigStore.loadCatalog(true).catch(() => null);
    }
  })();
});

onMounted(() => {
  installedWarmupActivityReporter = installAiWarmupActivityReporter({
    throttleMs: 12000,
    resolveAppId: () => String(route.params?.nocodeId || '').trim() || undefined,
  });
  void aiConfigStore.loadCatalog(true).catch(() => null);
});

onBeforeUnmount(() => {
  installedWarmupActivityReporter?.dispose();
  installedWarmupActivityReporter = null;
});
</script>

<style lang='scss' scoped>
:global(html.project-viewer-fullscreen .layout-ai-sidebar) {
  display: none;
}

.workbench-desktop-layout {
  width: 100%;
  height: 100%;
  min-height: 100%;
  display: flex;
  overflow: auto hidden;
  position: relative;

  .layout-ai-sidebar {
    height: 100%;
    flex-shrink: 0;
  }

  .layout-page {
    flex: 1;
    min-width: 0;
    height: 100%;
    position: relative;
  }

  .workbench-form-overlay-host {
    position: absolute;
    inset: 0;
    z-index: 2050;
    pointer-events: none;
  }
}
</style>
