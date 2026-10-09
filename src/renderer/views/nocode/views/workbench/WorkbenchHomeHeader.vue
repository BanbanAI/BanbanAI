<template>
  <div class="workbench-home-header">
    <div class="header-left">
      <el-icon color="var(--text-color-regular)" :size="24" class="to-home"  @click="handleToHome" v-if="!isHomeRoute"><i-workbench-back /></el-icon>
      <div class="logo">
        <el-icon :size="16" color="white"><i-workbench-workbench /></el-icon>
        <div class="header-left-text">{{ $t('WorkbenchHomeHeader.workbench') }}</div>
      </div>
      <div class="firms-name" :title="companyName">{{ companyName }}</div>
    </div>
    <div class="header-right">
      <el-link class="contact-us" href="https://www.banban.work/community/" underline="never" target="_blank">
        <el-icon :size="16" style="margin-right: 4px">
          <i-ant-design-question-circle-outlined />
        </el-icon>
        {{ $t('WorkbenchHomeHeader.consultCustomerService') }}
      </el-link>
      <div class="header-right-middle"></div>
      <WorkBenchUserCard></WorkBenchUserCard>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { useRoute, useRouter } from 'vue-router';
import { useSettingStore } from '@renderer/stores';
import { computed, onMounted } from 'vue';

const router = useRouter();
const route = useRoute();
const settingState = useSettingStore();
const companyName = computed(() => settingState.companyName);
const isHomeRoute = computed(() => route.path === '/' || route.path === '/apps');

onMounted(() => {
  void settingState.getCompanyName().catch(() => undefined);
});

const handleToHome = () => {
  router.push('/');
}
</script>

<style scoped lang='scss'>
.workbench-home-header {
  width: 100%;
  height: 60px;
  background-color: var(--bg-color-page);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 32px;

  .header-left {
    padding: 0 4px;
    height: 24px;
    display: flex;
    align-items: center;
    column-gap: 8px;

    .to-home {
      width: 32px;
      height: 32px;
      border-radius: 4px;
      cursor: var(--cursor-pointer);

      &:hover {
        background-color: var(--bg-color-overlay);
      }
    }

    .logo {
      display: flex;
      align-items: center;
      column-gap: 8px;
    }

    .header-left-text {
      min-width: 42px;
      color: var(--text-color-regular);
      font-size: 14px;
      line-height: 22px;
    }

    .firms-name {
      height: 24px;
      background-color: rgba(230, 245, 255, 1);
      border-radius: 4px;
      padding: 2px 6px;
      text-align: center;
      line-height: 20px;
      font-size: 12px;
      color: var(--el-color-primary);
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
      max-width: calc(100vw - 547px); // 100vw减去同一行其他元素的宽度总和
    }
  }

  .header-right {
    height: 36px;
    display: flex;
    align-items: center;
    column-gap: 16px;

    .header-right-organize {
      width: 88px;
      height: 24px;
      display: flex;
      align-items: center;
      column-gap: 4px;
      cursor: var(--cursor-pointer);
      color: var(--el-color-black);

      .header-right-organize-text {
        font-size: 15px;
        margin-top: 2px;
      }

      &:hover {
        color: var(--color-primary);
      }
    }

    .header-right-middle {
      width: 0px;
      height: 14px;
      border-left: 1px solid var(--border-color);
    }

    .header-right-user {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: var(--color-primary);
    }

    .contact-us {
      color: var(--el-color-primary);
    }

  }
}
</style>
