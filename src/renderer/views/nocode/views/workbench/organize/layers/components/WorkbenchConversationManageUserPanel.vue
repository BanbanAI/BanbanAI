<template>
  <div class="detail-user-panel">
    <div class="panel-top">
      <div class="panel-header">{{ $t('WorkbenchConversationManage.user') }}</div>
      <div class="panel-close" @click="emit('close')">
        <el-icon :size="16"><i-ep-close /></el-icon>
      </div>
    </div>
    <div class="panel-user" v-if="record">
      <div class="user-avatar-large">
        <el-icon :size="18"><i-ven-ai-computer /></el-icon>
      </div>
      <div class="user-meta" v-if="record">
        <div class="user-location-text">{{ record.location }} ({{ record.ip }})</div>
      </div>
    </div>
    <div class="panel-info-list" v-if="record">
      <div class="info-item">
        <span class="info-label">{{ $t('WorkbenchConversationManage.source') }}</span>
        <span class="info-value">
          <img :src="getBrowserIconPath(record.browserCode)" class="item-icon" /> {{ record.browserText }}
        </span>
      </div>
      <div class="info-item">
        <span class="info-label">{{ $t('WorkbenchConversationManage.system') }}</span>
        <span class="info-value">
          <img :src="getSystemIconPath(record.systemCode)" class="item-icon" /> {{ record.systemText }}
        </span>
      </div>
      <div class="info-item">
        <span class="info-label">{{ $t('WorkbenchConversationManage.browser') }}</span>
        <span class="info-value">
          <img :src="getBrowserIconPath(record.browserCode)" class="item-icon" /> {{ record.browserText }}
        </span>
      </div>
      <div class="info-item">
        <span class="info-label">{{ $t('WorkbenchConversationManage.ip') }}</span>
        <span class="info-value">
          <el-icon :size="16"><i-ep-monitor /></el-icon> {{ record.ip }}
        </span>
      </div>
      <div class="info-item">
        <span class="info-label">{{ $t('WorkbenchConversationManage.browserLanguage') }}</span>
        <span class="info-value">{{ $t('WorkbenchConversationManage.zhCn') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import i18next from 'i18next';
const { t: $t } = { t: i18next.t };
type ConversationRecord = {
  id: string,
  userId: string,
  location: string,
  ip: string,
  systemCode: string,
  systemText: string,
  browserCode: string,
  browserText: string,
  startTime: string,
  endTime: string,
  duration: string,
};

defineProps<{
  record: ConversationRecord | null;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const getSystemIconPath = (code: string) => {
  const iconMap: Record<string, string> = {
    windows: 'windows-icon.png',
    macos: 'mac-icon.png',
    linux: 'linux-icon.png',
  };
  const fileName = iconMap[code] || 'windows-icon.png';
  return new URL(`../../../../../../../assets/image/workbench/${fileName}`, import.meta.url).href;
};

const getBrowserIconPath = (code: string) => {
  const iconMap: Record<string, string> = {
    chrome: 'chrome-icon.png',
    edge: 'edge-icon.png',
    firefox: 'firefox-icon.png',
    safari: 'safari-icon.png',
    ie: 'ie-icon.png',
  };
  const fileName = iconMap[code] || 'chrome-icon.png';
  return new URL(`../../../../../../../assets/image/workbench/${fileName}`, import.meta.url).href;
};
</script>

<style scoped lang="scss">
.detail-user-panel {
  width: 280px;
  flex-shrink: 0;
  background: #ffffff;
  padding: 0;
  display: flex;
  flex-direction: column;

  $pd: 16px;

  .panel-top {
    height: 48px;
    padding: $pd;
    padding-bottom: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24px;
    border-bottom: 1px solid #e5e6eb;
  }

  .panel-header {
    height: 100%;
    font-size: 14px;
    font-weight: 500;
    color: #1677ff;
    padding-bottom: 12px;
    border-bottom: 2px solid #1677ff;
    margin-bottom: -1px;
    cursor: pointer;
  }

  .panel-close {
    padding: 2px;
    color: #86909c;
    cursor: pointer;
    transition: color 0.2s;
    margin-top: -2px;

    &:hover {
      color: #1d2129;
    }
  }

  .panel-user {
    padding: 0 $pd;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 32px;

    .user-avatar-large {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #c9cdd4;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      flex-shrink: 0;
    }

    .user-location-text {
      font-size: 14px;
      color: #1d2129;
      font-weight: 500;
      line-height: 22px;
    }
  }

  .panel-info-list {
    border: 1px solid #E5E6EB;
    padding: 12px 16px;
    border-radius: 4px;
    margin: 0 $pd;
    display: flex;
    flex-direction: column;
    gap: 16px;

    .info-item {
      display: flex;
      font-size: 14px;
      line-height: 22px;

      .info-label {
        width: 80px;
        flex-shrink: 0;
        color: #86909c;
      }

      .info-value {
        flex: 1;
        color: #1d2129;
        display: flex;
        align-items: center;
        gap: 8px;

        .item-icon {
          width: 16px;
          height: 16px;
          object-fit: contain;
        }
      }
    }
  }
}
</style>
