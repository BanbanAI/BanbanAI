<template>
  <nocode-panel :title="$t('CheckUpdate.checkUpdate')">
    <div class="wrapper">
      <div class="content-check-update">
        <div class="logo">
          <img src="@renderer/assets/image/logo.png" />
          <div class="product-name">{{ $t("productName") }}</div>
        </div>

        <div class="version">
          {{ $t('CheckUpdate.appVersion') }}: v{{ version }}
        </div>

        <div class="btn-group" v-if="env.inClient()">
          <el-button class="btn-official-download" @click="handleOfficialDownload">
            {{ $t('CheckUpdate.officialDownload') }}
            <el-icon class="btn-icon" :size="16"><i-material-symbols-open-in-new-rounded /></el-icon>
          </el-button>
          <el-button class="btn-github" @click="handleGithubDownload">
            <el-icon class="btn-icon" :size="16"><i-uil-github /></el-icon>
            {{ $t('CheckUpdate.github') }}
          </el-button>
        </div>
      </div>
    </div>
  </nocode-panel>
</template>

<script lang='ts' setup>
import { env } from '@renderer/utils/env';

const version = __APP_VERSION__;

const handleOfficialDownload = () => {
  window.open("https://www.banban.work/download", "browser");
}

const handleGithubDownload = () => {
  window.open("https://github.com/BanbanAI/BanbanAI/releases", "browser");
}
</script>

<style lang='scss' scoped>
.wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 400px;

  .content-check-update {
    display: flex;
    flex-direction: column;
    align-items: center;

    .logo {
      border-radius: 16px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      row-gap: 16px;
      justify-content: center;
      align-items: center;

      img {
        width: 56px;
      }

      .product-name {
        font-size: 24px;
        font-weight: bold;
        color: #000;
      }
    }

    .version {
      color: var(--text-color-secondary);
      margin-bottom: 32px;
    }

    .btn-group {
      display: flex;
      column-gap: 12px;

      .el-button {
        height: 32px;
        margin: 0;
        padding: 0 16px;
        border-radius: 4px;
        color: var(--text-color-regular);
        border-color: var(--border-color-light);
        background-color: var(--color-white);

        .btn-icon {
          margin: 0;
        }

        &.btn-official-download .btn-icon {
          margin-left: 4px;
        }

        &.btn-github .btn-icon {
          margin-right: 6px;
        }
      }
    }
  }
}
</style>
