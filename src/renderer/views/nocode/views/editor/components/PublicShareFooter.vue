<template>
  <div class="public-share-footer">
    <div class="brand" :class="{ light: lightText }">
      <img class="brand-logo" :class="{ light: lightText }" :src="aiSidebarLogoSmall" :alt="$t('PublicShareFooter.brandAlt') + ''">
      <el-button class="brand-link" link @click="handleOpenOfficialSite">
        {{ $t("PublicShareFooter.brandName") }}
      </el-button>
      <span class="brand-text">{{ $t("PublicShareFooter.supportSuffix") }}</span>
    </div>
    <el-button v-if="showReport" class="report-link" :class="{ light: lightText }" link @click="handleOpenReport">
      {{ $t("PublicShareFooter.report") }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import aiSidebarLogoSmall from '@renderer/assets/image/nocode/ai-sidebar-logo-icon.png';
import type { PropType } from 'vue';
import { computed } from 'vue';

const REPORT_BASE_URL = 'https://app.duosuan.tech/#/share/form/syemzzk2nd9j/t_jgqgfk966fee';
const OFFICIAL_SITE_URL = 'https://www.banban.work';

const props = defineProps({
  publisher: {
    type: Object as PropType<{
      userId?: string,
      user?: string,
      realname?: string,
    }>,
    default: undefined,
  },
  reportAccount: {
    type: String,
    default: "",
  },
  currentUrl: {
    type: String,
    default: undefined,
  },
  lightText: {
    type: Boolean,
    default: false,
  },
  showReport: {
    type: Boolean,
    default: true,
  },
});

const showReport = computed(() => props.showReport !== false);

const buildReportUrl = (reportAccount = '') => {
  const shareUrl = props.currentUrl || (typeof window !== 'undefined' ? window.location.href : '');
  const searchParams = new URLSearchParams();
  if (shareUrl) {
    searchParams.set('shareUrl', shareUrl);
  }
  if (reportAccount) {
    searchParams.set('reportAccount', reportAccount);
  }
  const queryString = searchParams.toString();
  return queryString ? `${REPORT_BASE_URL}?${queryString}` : REPORT_BASE_URL;
};

const reportAccount = computed(() => String(props.reportAccount || '').trim());
const reportUrl = computed(() => buildReportUrl(reportAccount.value));

const openLink = (url: string) => {
  if (!url || typeof window === 'undefined') {
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};

const handleOpenOfficialSite = () => {
  openLink(OFFICIAL_SITE_URL);
};

const handleOpenReport = () => {
  openLink(reportUrl.value);
};
</script>

<style scoped lang="scss">
.public-share-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: min(780px, 100%);
  margin: 12px auto 0;
  padding: 0 2px;
  box-sizing: border-box;
}

.brand {
  display: flex;
  align-items: center;
  gap: 2px;

  &.light {
    .brand-link,
    .brand-text {
      color: #ffffff;
    }

    .brand-link:hover {
      background-color: #FFFFFF1A !important;
    }
  }
}

.brand-logo {
  width: 14px;
  height: 14px;
  display: block;
  flex-shrink: 0;

  &.light {
    filter: brightness(0) invert(1);
  }
}

.brand-link {
  padding: 0;
  border: none;
  background: transparent;
  color: #86909c;
  font-size: 14px;
  line-height: 22px;
  text-decoration: none;
  transition: color 0.2s ease;
  cursor: pointer;
  padding: 0 4px;

  &:hover {
    background-color: #00000014 !important;
  }
}

.brand-text {
  color: #86909c;
  font-size: 14px;
  line-height: 22px;
}

.report-link {
  font-size: 14px;
  line-height: 22px;
  color: #86909c;
  padding: 0 4px;

  &:hover {
    background-color: #00000014 !important;
  }

  &.light {
    color: #ffffff;

    &:hover {
      background-color: #FFFFFF1A !important;
    }
  }
}

@media (max-width: 768px) {
  .public-share-footer {
    width: 100%;
    margin-top: 12px;
    padding: 0;
  }

  .brand {
    gap: 4px;
  }

  .brand-logo {
    height: 12px;
    width: 12px;
  }

  .brand-link {
    font-size: 12px;
  }

  .brand-text {
    font-size: 12px;
  }
}
</style>
