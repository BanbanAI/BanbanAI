<template>
  <div class="workbench-conversation-manage">
    <div class="conversation-card">
      <div class="conversation-toolbar">
        <el-select
          v-model="selectedThreadId"
          class="app-select"
          popper-class="conversation-manage-select-popper"
          :no-data-text="$t('WorkbenchConversationManage.noData')"
        >
          <el-option
            v-for="item in agentOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <recharge-date-range-picker v-model="dateRange" />
      </div>

      <div class="conversation-table-header">
        <div class="user-column">{{ $t('WorkbenchConversationManage.userInfo') }}</div>
        <div class="time-column">{{ $t('WorkbenchConversationManage.conversationTime') }}</div>
      </div>

      <div class="conversation-table-body">
        <template v-if="pagedConversationList.length > 0">
          <div
            v-for="record in pagedConversationList"
            :key="record.id"
            class="conversation-row"
            @click="openDetail(record)"
          >
            <div class="user-info">
              <div class="user-avatar">
                <el-icon :size="18"><i-ven-ai-computer /></el-icon>
              </div>
              <div class="user-meta">
                <div class="user-id">{{ record.userId }}</div>
                <div class="user-location">{{ record.location }}（{{ record.ip }}）</div>
                <div class="terminal-list">
                  <img :src="getSystemIconPath(record.systemCode)" class="terminal-icon" alt="system" />
                  <img :src="getBrowserIconPath(record.browserCode)" class="terminal-icon" alt="browser" />
                </div>
              </div>
            </div>
            <div class="time-info">
              <div class="time-text">{{ record.startTime }}</div>
              <div class="time-text">{{ record.endTime }}</div>
              <div class="time-text duration-text">{{ record.duration }}</div>
            </div>
          </div>
        </template>
        <div v-else class="empty-container">
          <el-empty :description="$t('WorkbenchConversationManage.noData')" :image-size="120" />
        </div>
      </div>

      <div class="conversation-pagination">
        <el-config-provider :locale="elementPlusLocale">
          <el-pagination
            background
            layout="sizes, total, prev, pager, next"
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="totalRecords"
          >
            <span style="margin: 0 12px; font-size: 14px">
              {{ $t('WorkbenchRechargeManagement.total') }}{{ totalRecords }}{{ $t('WorkbenchRechargeManagement.record') }}
            </span>
          </el-pagination>
        </el-config-provider>
      </div>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="detailTitle"
      size="960px"
      class="conversation-detail-drawer"
      destroy-on-close
      :show-close="false"
    >
      <div class="conversation-detail-wrapper">
        <div class="detail-chat">
          <workbench-ai-chat
            ref="aiChatRef"
            ai-chat-visible
            readonly
          />
        </div>
        <workbench-conversation-manage-user-panel :record="currentRecord" @close="drawerVisible = false" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue';
import i18next from 'i18next';
import WorkbenchConversationManageUserPanel from './components/WorkbenchConversationManageUserPanel.vue';
import axios from 'axios';
import RechargeDateRangePicker from '@renderer/views/nocode/views/workbench/rechargeManagement/components/RechargeDateRangePicker.vue';
import WorkbenchAiChat from '@renderer/views/nocode/views/workbench//AI/WorkbenchAiChat.vue';
import { dayjs } from 'element-plus';
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale';

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

type SharedThreadOption = {
  id: string,
  title?: string,
};

type IpLocationResponse = {
  pro?: string,
  city?: string,
  addr?: string,
};

type VisitorThreadRequestParams = {
  limit: number,
  offset: number,
  startTime?: number,
  endTime?: number,
};

type VisitorThreadProfile = {
  location?: string,
  ip?: string,
  os?: string,
  browser?: string,
};

type VisitorThreadResponseItem = {
  id: string,
  visitorKey?: string,
  visitorProfile?: VisitorThreadProfile | null,
  createTime?: number,
  updateTime?: number,
  totalConversationDuration?: number,
};

const locationCache = new Map<string, string>();

const { t: $t } = { t: i18next.t };

const isPrivateIp = (ip: string) => {
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('169.254')) return true;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  return (parts[0] === 10) || (parts[0] === 172 && (parts[1] >= 16 && parts[1] <= 31)) || (parts[0] === 192 && parts[1] === 168);
};

const getIpLocation = (ip: string): Promise<string> => {
  if (!ip || ip === '-') return Promise.resolve($t('WorkbenchConversationManage.unknown'));
  if (isPrivateIp(ip)) return Promise.resolve($t('WorkbenchConversationManage.lan'));
  if (locationCache.has(ip)) return Promise.resolve(locationCache.get(ip)!);

  return new Promise((resolve) => {
    const cb = `IP_CB_${Math.random().toString(36).slice(2, 10)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => cleanup($t('WorkbenchConversationManage.unknown')), 5000);
    const callbackWindow = window as Window & Record<string, ((data?: IpLocationResponse) => void) | undefined>;
    const cleanup = (res: string) => {
      clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete callbackWindow[cb];
      resolve(res);
    };
    callbackWindow[cb] = (data?: IpLocationResponse) => {
      if (!data) return cleanup($t('WorkbenchConversationManage.unknown'));
      const { pro, city, addr } = data;
      const loc = (pro && city) ? (pro === city ? pro : pro + city) : (pro || city || addr?.trim().split(/\s+/)[0] || $t('WorkbenchConversationManage.unknown'));
      locationCache.set(ip, loc);
      cleanup(loc);
    };
    script.src = `https://whois.pconline.com.cn/ipJson.jsp?ip=${ip}&json=true&callback=${cb}`;
    script.onerror = () => cleanup($t('WorkbenchConversationManage.unknown'));
    document.body.appendChild(script);
  });
};

const selectedThreadId = ref('');
const dateRange = ref<[string, string] | null>([
  dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
  dayjs().format('YYYY-MM-DD')
]);
const currentPage = ref(1);
const pageSize = ref(10);

const drawerVisible = ref(false);
const currentRecord = ref<ConversationRecord | null>(null);
const aiChatRef = ref<InstanceType<typeof WorkbenchAiChat> | null>(null);

const detailTitle = computed(() => {
  return agentOptions.value.find(item => item.value === selectedThreadId.value)?.label || $t('WorkbenchConversationManage.detailTitle');
});

const openDetail = async (record: ConversationRecord) => {
  currentRecord.value = record;
  drawerVisible.value = true;
  await nextTick();
  aiChatRef.value?.selectThread?.(record.id);
};

const agentOptions = ref<{ label: string; value: string }[]>([]);
const conversationList = ref<ConversationRecord[]>([]);
const totalRecords = ref(0);

const mapOsToCode = (os?: string) => {
  const s = String(os || '').toLowerCase();
  if (s.includes('win')) return 'windows';
  if (s.includes('mac')) return 'macos';
  if (s.includes('linux')) return 'linux';
  return 'windows';
};

const mapBrowserToCode = (browser?: string) => {
  const b = String(browser || '').toLowerCase();
  if (b.includes('chrome')) return 'chrome';
  if (b.includes('edge')) return 'edge';
  if (b.includes('firefox')) return 'firefox';
  if (b.includes('safari')) return 'safari';
  if (b.includes('ie') || b.includes('internet explorer')) return 'ie';
  return 'chrome';
};

const formatTime = (ts?: number) => {
  if (!ts) return '-';
  const date = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}.${m}.${d} ${h}:${min}:${s}`;
};

const formatDuration = (durationMs?: number) => {
  const diff = Math.max(0, Math.floor(Number(durationMs || 0) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  let res = '';
  if (h > 0) res += `${h}${$t('WorkbenchConversationManage.hour')}`;
  if (m > 0 || h > 0) res += `${m}${$t('WorkbenchConversationManage.minute')}`;
  res += `${s}${$t('WorkbenchConversationManage.second')}`;
  return res || `0${$t('WorkbenchConversationManage.second')}`;
};

const fetchConversationList = async () => {
  if (!selectedThreadId.value) return;
  try {
    const params: VisitorThreadRequestParams = {
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value,
    };

    if (dateRange.value?.[0] && dateRange.value?.[1]) {
      params.startTime = dayjs(dateRange.value[0]).startOf('day').valueOf();
      params.endTime = dayjs(dateRange.value[1]).endOf('day').valueOf();
    }

    const { data } = await axios.get<{ items: VisitorThreadResponseItem[], total: number }>(`/ai/threads/${selectedThreadId.value}/visitor-threads`, {
      params
    });
    conversationList.value = (data.items || []).map(item => {
      const profile = item.visitorProfile || {};
      return {
        id: item.id,
        userId: item.visitorKey || $t('workbenchService.anonymousUser'),
        location: profile.location || $t('WorkbenchConversationManage.unknown'),
        ip: profile.ip || '-',
        systemCode: mapOsToCode(profile.os),
        systemText: profile.os || 'Win',
        browserCode: mapBrowserToCode(profile.browser),
        browserText: profile.browser || 'Chr',
        startTime: formatTime(item.createTime),
        endTime: formatTime(item.updateTime),
        duration: formatDuration(item.totalConversationDuration),
      };
    });

    // 异步补全缺失的位置信息
    conversationList.value.forEach(async (record) => {
      if ((!record.location || record.location === $t('WorkbenchConversationManage.unknown')) && record.ip && record.ip !== '-') {
        const loc = await getIpLocation(record.ip);
        if (loc && loc !== $t('WorkbenchConversationManage.unknown')) {
          record.location = loc;
        }
      }
    });

    totalRecords.value = data.total || 0;
  } catch (error) {
    console.error('Failed to fetch conversation list:', error);
  }
};

const fetchAgentOptions = async () => {
  try {
    const { data } = await axios.get<SharedThreadOption[]>('/ai/threads', {
      params: {
        sharing: true,
        includeHidden: true,
      },
    });
    agentOptions.value = (data || []).map(item => ({
      label: item.title || $t('WorkbenchConversationManage.unnamedConversation'),
      value: item.id,
    }));
    if (agentOptions.value.length > 0 && !selectedThreadId.value) {
      selectedThreadId.value = agentOptions.value[0].value;
    }
  } catch (error) {
    console.error('Failed to fetch app options:', error);
  }
};

onMounted(() => {
  fetchAgentOptions();
});

watch(selectedThreadId, () => {
  currentPage.value = 1;
  fetchConversationList();
});

watch([currentPage, pageSize, dateRange], () => {
  fetchConversationList();
});

const pagedConversationList = computed(() => {
  return conversationList.value;
});

const getSystemIconPath = (code: string) => {
  const iconMap: Record<string, string> = {
    windows: 'windows-icon.png',
    macos: 'mac-icon.png',
    linux: 'linux-icon.png',
  };
  const fileName = iconMap[code] || 'windows-icon.png';
  return new URL(`../../../../../../assets/image/workbench/${fileName}`, import.meta.url).href;
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
  return new URL(`../../../../../../assets/image/workbench/${fileName}`, import.meta.url).href;
};

watch(pageSize, () => {
  currentPage.value = 1;
});
</script>

<style scoped lang="scss">
.workbench-conversation-manage {
  width: 100%;
  min-width: 768px;
  height: 100%;
  background-color: #fff;
  
  .conversation-card {
    width: 100%;
    height: 100%;
    padding: 12px 16px 16px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: none;
  }

  .conversation-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .app-select {
    width: 200px;

    :deep(.el-select__wrapper) {
      background-color: #f2f3f5;
      box-shadow: none !important;
      border-radius: 4px;
      padding: 0 12px;
      height: 32px;
      line-height: 32px;
      transition: all 0.2s;

      // &.is-focused {
      //   background-color: #fff;
      //   box-shadow: 0 0 0 1px var(--color-primary) !important;
      // }
    }

    :deep(.el-select__placeholder) {
      color: #1d2129;
      font-size: 14px;
    }

    :deep(.el-select__caret) {
      color: #86909c;
    }
  }

  .conversation-table-header {
    height: 36px;
    padding: 0 20px 0 16px;
    border-radius: 4px;
    background: #F7F8FA;
    display: flex;
    align-items: center;
    color: #4e5969;
    font-size: 14px;
    line-height: 22px;
  }

  .conversation-table-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: #ffffff;
    border-radius: 4px;

    .empty-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-bottom: 40px;
    }
  }

  .conversation-row {
    height: 102px;
    padding: 0 20px 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border-bottom: 1px solid #f2f3f5;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: #f2f3f5;
    }
  }

  .user-column,
  .user-info {
    flex: 1;
    min-width: 0;
  }

  .time-column,
  .time-info {
    width: 320px;
    flex-shrink: 0;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .user-avatar {
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

  .user-meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .user-id {
    color: #1d2129;
    font-size: 14px;
    font-weight: 500;
    line-height: 22px;
  }

  .user-location {
    color: #86909c;
    font-size: 14px;
    line-height: 22px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .terminal-list {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 2px;

    .terminal-icon {
      width: 20px;
      height: 20px;
      object-fit: contain;
    }
  }

  .time-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
  }

  .time-text {
    color: #1d2129;
    font-size: 14px;
    line-height: 20px;
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  }

  .duration-text {
    color: #4e5969;
  }

  .conversation-pagination {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;

    :deep(.el-pagination) {
      --el-pagination-button-bg-color: #ffffff;
      --el-pagination-hover-color: var(--color-primary);
      --el-pagination-text-color: #4e5969;
      --el-pagination-button-color: #4e5969;
      --el-pagination-border-radius: 4px;
      --el-border-radius-base: 4px;
      font-weight: 400;

      .el-select {
        width: 102px;
      }

      .el-pagination__total {
        margin-right: 16px;
        color: #86909c;
      }

      .el-pagination__jump {
        margin-left: 16px;
        color: #86909c;
      }

      .btn-prev,
      .btn-next,
      .el-pager li {
        background-color: #ffffff;
        border: 1px solid #e5e6eb;
        margin: 0 4px;

        &:hover {
          border-color: var(--color-primary);
        }

        &.is-active {
          background-color: var(--color-primary);
          border-color: var(--color-primary);
          color: #ffffff;
        }

        &:disabled {
          background-color: #f2f3f5;
          border-color: #e5e6eb;
          color: #c9cdd4;
        }
      }
    }
  }
}

.conversation-detail-wrapper {
  display: flex;
  height: 100%;
  overflow: hidden;
  background-color: #fff;

  .detail-chat {
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }
}
</style>

<style lang="scss">
.el-popper.conversation-manage-select-popper {
  border: 1px solid #e5e6eb !important;
  border-radius: 6px !important;
  padding: 4px 0 !important;

  .el-select-dropdown__item {
    font-size: 14px;
    padding: 0 12px;
    height: 36px;
    line-height: 36px;
    color: #1d2129;
    margin: 0 4px;
    border-radius: 4px;

    &.is-hovering {
      background-color: #f2f3f5 !important;
    }

    &.is-selected {
      color: var(--color-primary);
      font-weight: 500;
      background-color: #f2f3f5 !important;
    }
  }

  .el-popper__arrow {
    display: none;
  }

  .el-select-dropdown__list {
    padding: 0;
  }
}

.conversation-detail-drawer {
  max-width: 100%;
  .el-drawer__header {
    height: 0;
    padding: 0;
    margin: 0;
    border-bottom: none;
    overflow: hidden;
  }
  
  .el-drawer__body {
    padding: 0;
    overflow: hidden;
  }
}

.el-popper.conversation-manage-select-popper {
  background-color: #fff;
}
</style>
