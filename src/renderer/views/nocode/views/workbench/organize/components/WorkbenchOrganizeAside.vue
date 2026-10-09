<template>
  <div class="workbench-organize-aside">
    <div class="aside-content">
      <!-- 通讯录 -->
      <span>{{ $t("WorkbenchOrganizeAside.contacts") }}</span>
      <vn-stack-tab  v-for="tab in tabList.Address" :key="tab.name" :name="tab.name">
        <el-icon :size="20" color="var(--color-primary)">
          <component :is="tab.icon"></component>
        </el-icon>
        <div class="tab-text">{{ tab.label }}</div>
      </vn-stack-tab>

      <!-- 系统管理 -->
      <span>{{ $t("WorkbenchOrganizeAside.systemManagement") }}</span>
      <vn-stack-tab  v-for="tab in tabList.admin" :key="tab.name" :name="tab.name">
        <el-icon :size="20" color="var(--color-primary)">
          <component :is="tab.icon"></component>
        </el-icon>
        <div class="tab-text">{{ tab.label }}</div>
      </vn-stack-tab>

      <span>{{ $t("WorkbenchOrganizeAside.aiSettings") }}</span>
      <vn-stack-tab v-for="tab in tabList.ai" :key="tab.name" :name="tab.name">
        <el-icon :size="20" color="var(--color-primary)">
          <component :is="tab.icon"></component>
        </el-icon>
        <div class="tab-text">{{ tab.label }}</div>
      </vn-stack-tab>
    </div>
    <div class="version-info">
      <span class="version">{{ $t("productName") }}</span>
      <span class="version">v{{ version }}</span>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { usePassportStore } from '@renderer/stores';
import i18next from 'i18next';
const passportState = usePassportStore();

const version = __APP_VERSION__;
const isWebAdmin = computed(() => passportState.isMainAccount);
const canManageAiModelSettings = computed(() => Boolean(passportState.account?.isAdmin));

const tabList = computed(()=>{
  const Address = [
    {
      label: `${i18next.t("WorkbenchOrganizeAside.contactsManagement")}`,
      name: "member",
      icon: IWorkbenchOrganizeUser,
    },
  ];
  const admin = [
    {
      label: `${i18next.t("WorkbenchOrganizeAside.enterpriseInfo")}`,
      name: "company",
      icon: IWorkbenchOrganizeAdmin
    },
    {
      label: `${i18next.t("WorkbenchOrganizeAside.adminSetting")}`,
      name: "admin",
      icon: IWorkbenchOrganizeAdmin,
      get visible() {
        return isWebAdmin.value;
      }
    }
  ]
  const ai = [
    {
      label: i18next.t("WorkbenchOrganizeAside.aiPermissionManagement"),
      name: "aiPermission",
      icon: IEpLock,
      visible: Boolean(passportState.account?.isAdmin),
    },
    {
      label: i18next.t("WorkbenchOrganizeAside.aiModelManage"),
      name: "aiModelManage",
      icon: IWorkbenchModelManage,
      visible: canManageAiModelSettings.value,
    },
    {
      label: i18next.t("WorkbenchOrganizeAside.conversationManage"),
      name: "conversation",
      icon: IWorkbenchOrganizeMessage,
      visible: false,
    },
  ].filter(item => item.visible !== false);

  return {
    Address,
    admin,
    ai
  };
})

</script>

<style scoped lang='scss'>
.workbench-organize-aside {
  width: 100%;
  height: 100%;
  background-color: #ffffff;
  color: #000;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;

  .aside-content {
    width: 100%;

    > span {
      padding: 8px 16px;
      display: block;
      color: var(--text-color-secondary);
    }

    .vn-stack-tab {
      width: 100%;
      height: 44px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      column-gap: 8px;
      cursor: var(--cursor-pointer);

      &:hover,
      &.active {
        background-color: var(--bg-color-overlay);
      }

      .tab-text {
        flex: 1;
        min-width: 0;
        font-size: 14px;
        line-height: 20px;
        font-weight: 500;
        color: rgba(30, 30, 30, 1);
      }

      .deprecated-badge {
        flex: none;
        cursor: var(--cursor-pointer);
      }
    }
  }

  .version-info {
    color: var(--text-color-secondary);
    font-size: 12px;
    display: flex;
    align-items: center;
    padding: 16px;

    .version {
      margin-left: 2px;
      font-weight: 500;
      white-space: nowrap;
    }
  }
}
</style>
