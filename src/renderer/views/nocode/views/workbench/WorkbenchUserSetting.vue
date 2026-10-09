<template>
  <vn-stack class="workbench" v-model="activeOrganizeTab">
    <el-container class="workbench-container">
      <el-header>
        <div class="workbench-header">
          <div class="header-left">
            <router-link to="/apps">
              <el-icon :size="24" color="var(--text-color-primary)"><i-workbench-back /></el-icon>
            </router-link>
            <div class="header-left-text">{{ $t("WorkbenchUserSetting.title") }}</div>
          </div>
          <div class="header-right">
            <div class="title">{{ tabList.find(item => item.name === activeOrganizeTab)?.label }}</div>
            <WorkBenchUserCard></WorkBenchUserCard>
          </div>
        </div>
      </el-header>
      <el-container class="workbench-content">
        <el-aside width="300px">
          <div class="workbench-aside">
            <div class="aside-content">
              <vn-stack-tab v-for="tab in tabList" :key="tab.name" :name="tab.name">
                <el-icon :size="20" color="var(--color-primary)">
                  <component :is="tab.icon"></component>
                </el-icon>
                <div class="tab-text">{{ tab.label }}</div>
              </vn-stack-tab>
            </div>
          </div>
        </el-aside>
        <el-main class="workbench-main">
          <div class="workbench-organize-main">
            <vn-stack-layer name="user">
              <WorkbenchHomeUser />
            </vn-stack-layer>
            <vn-stack-layer name="setting">
              <WorkbenchHomeSetting />
            </vn-stack-layer>
            <vn-stack-layer name="api">
              <WorkbenchHomeApiTokens />
            </vn-stack-layer>
          </div>
        </el-main>
      </el-container>
    </el-container>
  </vn-stack>
</template>

<script setup lang='ts'>
import { computed, provide, ref } from 'vue'
import i18next from 'i18next'
import { usePassportStore } from '@renderer/stores'
import { ORGANIZE_UTIL } from '@renderer/types'
import { OrganizeUtil } from '@renderer/views/nocode/utils'
import { provideActiveOrganizeTab } from './organize/hooks'
import WorkbenchHomeApiTokens from './WorkbenchHomeApiTokens.vue'
import WorkbenchHomeSetting from './WorkbenchHomeSetting.vue'
import WorkbenchHomeUser from './WorkbenchHomeUser.vue'

const activeOrganizeTab = ref<string>('user')
const organizeUtil = new OrganizeUtil()
const passportState = usePassportStore()
passportState.init()

provide(ORGANIZE_UTIL, organizeUtil)
provideActiveOrganizeTab(activeOrganizeTab)

const tabList = computed(() => ([
  {
    label: `${i18next.t('WorkbenchUserSetting.userInfo')}`,
    name: 'user',
    icon: IWorkbenchOrganizeUser,
  },
  {
    label: `${i18next.t('WorkbenchUserSetting.preference')}`,
    name: 'setting',
    icon: IWorkbenchOrganizePermission,
  },
  {
    label: `${i18next.t('WorkbenchUserSetting.api')}`,
    name: 'api',
    icon: INocodeAppSettingUnion,
  }
]))
</script>

<style scoped lang='scss'>
.workbench {
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

    .workbench-content {
      height: calc(100% - 64px);
    }

    .el-main.workbench-main {
      padding: 16px;

      .workbench-organize-main {
        height: 100%;
      }
    }
  }

  .workbench-header {
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

  .workbench-aside {
    width: 100%;
    height: 100%;
    background-color: #ffffff;
    color: #000;
    border-right: 1px solid var(--border-color);

    .aside-content {
      width: 100%;

      .vn-stack-tab {
        width: 100%;
        height: 44px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        column-gap: 8px;
        cursor: var(--cursor-pointer);

        &.active {
          background-color: var(--bg-color-overlay);
        }

        .tab-text {
          font-size: 14px;
          line-height: 20px;
          font-weight: 500;
          color: rgba(30, 30, 30, 1);
        }
      }
    }
  }
}

:deep(.vn-stack-layer) {
  height: 100%;
}
</style>
