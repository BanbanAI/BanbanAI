<template>
  <div class="workbench-organize-header">
    <div class="header-left">
      <router-link to="/apps">
        <el-icon :size="24" color="var(--text-color-primary)"><i-workbench-back /></el-icon>
      </router-link>
      <div class="header-left-text">{{ $t("WorkbenchOrganizeHeader.title") }}</div>
    </div>
    <div class="header-right">
      <div class="title">{{ title }}</div>
      <WorkBenchUserCard></WorkBenchUserCard>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { useActiveOrganizeTab } from '../hooks';
import { useRouter } from 'vue-router';
import i18next from 'i18next';

const activeOrganizeTab = useActiveOrganizeTab();
const router = useRouter();
const title = computed(() => {
  if (activeOrganizeTab.value === 'member') return `${i18next.t("WorkbenchOrganizeHeader.contactsManagement")}`;
  else if (activeOrganizeTab.value === 'admin') return `${i18next.t("WorkbenchOrganizeHeader.adminSetting")}`;
  else if (activeOrganizeTab.value === 'company') return `${i18next.t("WorkbenchOrganizeHeader.enterpriseInfo")}`;
  else if (activeOrganizeTab.value === 'api') return `${i18next.t("WorkbenchOrganizeHeader.api")}`;
  else if (activeOrganizeTab.value === 'aiPermission') return `${i18next.t("WorkbenchOrganizeHeader.aiPermissionManagement")}`;
  else if (activeOrganizeTab.value === 'aiModelManage') return `${i18next.t("WorkbenchOrganizeHeader.aiModelManage")}`;
  else if (activeOrganizeTab.value === 'conversation') return `${i18next.t("WorkbenchOrganizeHeader.conversationManage")}`;
})
</script>

<style scoped lang='scss'>
.workbench-organize-header {
  width: 100%;
  height: 100%;
  background-color: #fff;
  display: flex;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);

  --title-font-size: 16px;
  --titie-font-color: var(--text-color-primary);
  
  .header-left {
    display: flex;
    align-items: center;
    padding: 20px 14px;
    width: 300px;
    height: 100%;
    border-right: 1px solid rgba(0, 0, 0, 0.1);
    column-gap: 6px;

    .el-icon {
      border-radius: 4px;
      cursor: var(--cursor-pointer);

      &:hover {
        background-color: var(--bg-color-overlay);
      }
    }
    .header-left-text {
      color: var(--titie-font-color);
      font-size: var(--title-font-size);
      line-height: 24px;
    }
  }

  .header-right {
    width: calc(100% - 300px);
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;

    .title {
      color: var(--titie-font-color);
      font-size: var(--title-font-size);
    }
  }
}
</style>
