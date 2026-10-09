<template>
  <vn-stack v-if="isOrganizeReady" class="workbench-organize" v-model="activeOrganizeTab">
    <el-container class="workbench-organize-container">
      <el-header>
        <workbench-organize-header></workbench-organize-header>
      </el-header>
      <el-container class="workbench-organize-content">
        <el-aside width="300px">
          <workbench-organize-aside></workbench-organize-aside>
        </el-aside>
        <el-main class="workbench-organize-main">
          <workbench-organize-main></workbench-organize-main>
        </el-main>
      </el-container>
    </el-container>
  </vn-stack>
</template>

<script setup lang='ts'>
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { ORGANIZE_UTIL } from '@renderer/types';
import { ref, computed, provide, watch } from 'vue';
import { provideActiveOrganizeTab } from './hooks';
import { usePassportStore } from '@renderer/stores';
import { useRoute, useRouter } from 'vue-router';

const DEFAULT_ORGANIZE_TAB = 'member';
const ORGANIZE_TABS = new Set([
  'member',
  'company',
  'admin',
  'aiPermission',
  'aiModelManage',
]);

const activeOrganizeTab = ref<string>(DEFAULT_ORGANIZE_TAB);
const isOrganizeReady = ref(false);
const organizeUtil = new OrganizeUtil();
const passportState = usePassportStore();
const route = useRoute();
const router = useRouter();
const canManageAiModelSettings = computed(() => Boolean(passportState.account?.isAdmin));

const syncRequestedTab = () => {
  const requestedTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab;
  if (!requestedTab || !ORGANIZE_TABS.has(requestedTab)) return;
  if (requestedTab === 'aiModelManage' && !canManageAiModelSettings.value) return;

  activeOrganizeTab.value = requestedTab;
};

passportState.init()
  .catch(() => undefined)
  .finally(() => {
    syncRequestedTab();
    isOrganizeReady.value = true;
  });

watch(() => route.query.tab, syncRequestedTab);

watch(activeOrganizeTab, (tab) => {
  if (!tab || route.query.tab === tab) return;

  void router.replace({
    query: {
      ...route.query,
      tab,
    },
  });
});

watch([activeOrganizeTab, canManageAiModelSettings], ([tab, canManage]) => {
  if (!tab) {
    activeOrganizeTab.value = DEFAULT_ORGANIZE_TAB;
    return;
  }

  if (!canManage && tab === 'aiModelManage') {
    activeOrganizeTab.value = DEFAULT_ORGANIZE_TAB;
  }
}, { immediate: true });

provide(ORGANIZE_UTIL, organizeUtil);
provideActiveOrganizeTab(activeOrganizeTab);
</script>

<style scoped lang='scss'>
.workbench-organize {
  width: 100%;
  height: 100%;
  background-color: var(--bg-color-overlay);

  :deep(.el-container) {
    width: 100%;
    height: 100%;

    .el-header {
      padding: 0 !important;

      --el-header-height: 64px;
    }

    .workbench-organize-content {
      height: calc(100% - 64px);
    }

    .el-main.workbench-organize-main {
      padding: 0;
    }
  }
}
</style>
