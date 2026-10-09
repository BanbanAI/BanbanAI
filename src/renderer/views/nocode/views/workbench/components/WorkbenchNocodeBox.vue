<template>
  <div class="nocode-box" :class="{'selected': menuVisible, 'has-expire-info': !!expireInfo, 'is-expired': props.isExpired, 'is-broken': props.isBroken}" @click.stop="emit('preview')" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
    <el-tooltip v-if="props.warmupSummary" popper-class="nocode-box-warmup-tooltip" placement="top-start" :show-after="120">
      <template #content>
        <div class="nocode-box-warmup-tooltip__content">
          <div class="nocode-box-warmup-tooltip__title">{{ props.warmupSummary.label }}</div>
          <div class="nocode-box-warmup-tooltip__description">{{ props.warmupSummary.description }}</div>
          <div class="nocode-box-warmup-tooltip__phases">
            <div class="nocode-box-warmup-tooltip__phase-item">
              <span>catalog</span>
              <strong>{{ formatWarmupStatus(props.warmupSummary.phases.catalog) }}</strong>
            </div>
            <div class="nocode-box-warmup-tooltip__phase-item">
              <span>profile</span>
              <strong>{{ formatWarmupStatus(props.warmupSummary.phases.profile) }}</strong>
            </div>
            <div class="nocode-box-warmup-tooltip__phase-item">
              <span>deep</span>
              <strong>{{ formatWarmupStatus(props.warmupSummary.phases.deep) }}</strong>
            </div>
          </div>
          <div v-if="props.warmupSummary.lastWarmAt" class="nocode-box-warmup-tooltip__meta">
            {{ $t('WorkbenchNocodeBox.recentWarmup') }}{{ getI18nLabelColon() }}{{ formatWarmupTime(props.warmupSummary.lastWarmAt) }}
          </div>
          <div v-if="props.warmupSummary.lastError" class="nocode-box-warmup-tooltip__error">
            {{ $t('WorkbenchNocodeBox.recentError') }}{{ getI18nLabelColon() }}{{ props.warmupSummary.lastError }}
          </div>
        </div>
      </template>
      <div class="nocode-box-warmup-badge" :class="`is-${props.warmupSummary.tone}`">
        <span class="nocode-box-warmup-badge__dot"></span>
        <span class="nocode-box-warmup-badge__label">{{ props.warmupSummary.label }}</span>
      </div>
    </el-tooltip>
    <div class="nocode-box-content">
      <div class="nocode-box-content-header">
        <div class="icon" v-if="coverType === 'icon' && props.snapshot" :style="{ background: props.snapshot.color }">
          <el-icon :size="36" color="#fff">
            <component :is="props.snapshot.icon" />
          </el-icon>
        </div>
        <el-image v-else-if="coverType === 'image'" loading="lazy" style="width: 100%; height: 100%;" :src="getCoverImageURL(nocode?.id)" fit="cover">
          <template #error>
            <img src="@renderer/assets/image/report-default-cover.png" alt="">
          </template>
        </el-image>
        <img v-else src="@renderer/assets/image/report-default-cover.png" alt="">
      </div>
      <div class="nocode-box-content-title">{{ nocode?.name }}</div>
    </div>
    <div class="nocode-box-expire" v-if="expireInfo">
      <el-tooltip
        v-if="expireInfo.status === 'limited'"
        effect="light"
        placement="top-start"
        :offset="12"
        :content="`${i18next.t('WorkbenchNocodeBox.validity')}: ${expireInfo.formattedExpireAt}`"
        popper-class="workbench-nocode-expire-tooltip"
      >
        <div class="expire-corner">
          <el-icon :size="14">
            <i-workbench-app-not-expired />
          </el-icon>
        </div>
      </el-tooltip>
      <div class="expire-content expired" v-else>
        <el-icon :size="14">
          <i-workbench-app-expired />
        </el-icon>
        <span class="expire-time">
          {{ i18next.t('WorkbenchNocodeBox.expired') }}
        </span>
      </div>
    </div>
    <div class="setting-icon" ref="settingIconRef" v-if="!menuDisabled && menus.length" :class="{ 'active': menuVisible }">
      <el-popover
        trigger="click"
        :show-arrow="false"
        placement="bottom-start"
        :teleported="true"
        transition=""
        :show-after="0"
        :hide-after="0"
        :offset="4"
        popper-class="nocode-box-popover"
        width="200"
        v-model:visible="menuVisible"
      >
        <template #reference>
          <div class="more-menu-icon" @click.stop>
            <el-icon :size="24" color="#4E5969"><i-workbench-box-more-menu /></el-icon>
          </div>
        </template>
        <div class="mask-setting-menu">
          <template v-for="(menu, index) in menus" :key="menu.label">
            <div class="mask-setting-menu-item-line" v-if="menu.label === $t('WorkbenchNocodeBox.delete') && index > 0"></div>
            <div class="mask-setting-menu-item" :class="{'delete-active': menu.label === $t('WorkbenchNocodeBox.delete')}" @click="menuClick(menu)">
              <component :is="menu.icon" :size="16" />
              <span>{{ menu.label }}</span>
            </div>
          </template>
        </div>
      </el-popover>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { NocodeBody, NocodeCoverSummary, NocodeMeta } from '@common/types/nocode';
import { computed, ref } from 'vue';
import i18next from 'i18next';
import { getWorkbenchNocodeExpireInfo, getWorkbenchNocodeMenuKeys, type WorkbenchNocodeMenuKey } from './workbenchNocodeBox.helper';
import { getI18nLabelColon } from '@common/utils/i18n';

type WorkbenchAiWarmupStatus = 'missing' | 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'expired';
type WorkbenchAiWarmupSummary = {
  tone: 'cold' | 'base' | 'ready' | 'deep' | 'running' | 'error',
  label: string,
  description: string,
  phases: {
    catalog: WorkbenchAiWarmupStatus,
    profile: WorkbenchAiWarmupStatus,
    deep: WorkbenchAiWarmupStatus,
  },
  lastWarmAt?: number,
  lastError?: string,
};

const props = withDefaults(
  defineProps<{
    nocode: NocodeMeta,
    snapshot?: NocodeBody['snapshot'],
    cover?: NocodeCoverSummary,
    warmupSummary?: WorkbenchAiWarmupSummary | null,
    isEditable: boolean,
    isDeletable: boolean,
    canCopy: boolean,
    canSaveAs?: boolean,
    isExpired?: boolean,
    isBroken?: boolean,
    canManageImportExpireAt?: boolean,
    menuDisabled?: boolean
  }>(),
  {
    menuDisabled: false,
    warmupSummary: null,
  }
) ;

const emit = defineEmits<{
  (e: "preview"),
  (e: "open"),
  (e: "replaceIcon"),
  (e: "rename"),
  (e: "copy"),
  (e: "delete"),
  (e: "saveAs"),
  (e: "manageExpireAt"),
}>();

const menuVisible = ref(false);
const maskVisible = ref(false);
const expireInfo = computed(() => getWorkbenchNocodeExpireInfo(props.nocode?.importRestriction?.expireAt, props.isExpired));
const coverType = computed<NocodeCoverSummary['type']>(() => props.cover?.type || (props.snapshot ? 'icon' : 'default'));

const handleMouseEnter = () => {
  maskVisible.value = true;
}

const handleMouseLeave = () => {
  maskVisible.value = false;
}

const resolveMenuConfigMap = (): Record<WorkbenchNocodeMenuKey, { label: string, icon: string, click: () => void }> => ({
  replaceIcon: {
    label: i18next.t('WorkbenchNocodeBox.setIcon'),
    icon: IWorkbenchSetting,
    click: () => {
      emit("replaceIcon");
    }
  },
  rename: {
    label: i18next.t('WorkbenchNocodeBox.rename'),
    icon: IWorkbenchRename,
    click: () => {
      emit("rename");
    }
  },
  copy: {
    label: i18next.t('WorkbenchNocodeBox.copy'),
    icon: IWorkbenchCopy,
    click: () => {
      emit("copy");
    }
  },
  saveAs: {
    label: i18next.t('WorkbenchNocodeBox.saveAs'),
    icon: IWorkbenchSave,
    click: () => {
      emit("saveAs");
    }
  },
  manageExpireAt: {
    label: i18next.t('WorkbenchNocodeBox.appValidity'),
    icon: IWorkbenchSetting,
    click: () => {
      emit("manageExpireAt");
    }
  },
  delete: {
    label: i18next.t('WorkbenchNocodeBox.delete'),
    icon: IWorkbenchDelete,
    click: () => {
      emit("delete");
    }
  },
});

const WARMUP_STATUS_LABEL_MAP: Record<WorkbenchAiWarmupStatus, string> = {
  get missing() { return i18next.t('WorkbenchNocodeBox.warmupMissing') },
  get queued() { return i18next.t('WorkbenchNocodeBox.warmupQueued') },
  get running() { return i18next.t('WorkbenchNocodeBox.warmupRunning') },
  get succeeded() { return i18next.t('WorkbenchNocodeBox.warmupSucceeded') },
  get failed() { return i18next.t('WorkbenchNocodeBox.warmupFailed') },
  get skipped() { return i18next.t('WorkbenchNocodeBox.warmupSkipped') },
  get expired() { return i18next.t('WorkbenchNocodeBox.warmupExpired') },
};

const formatWarmupStatus = (status: WorkbenchAiWarmupStatus) => WARMUP_STATUS_LABEL_MAP[status] || i18next.t('WorkbenchNocodeBox.warmupMissing');

const formatWarmupTime = (value?: number) => {
  const normalized = Math.round(Number(value || 0));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return '--';
  }
  const date = new Date(normalized);
  const pad = (item: number) => String(item).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
const menus = computed(() => {
  return getWorkbenchNocodeMenuKeys({
    isEditable: props.isEditable,
    isDeletable: props.isDeletable,
    canCopy: props.canCopy,
    isExpired: props.isExpired,
    isBroken: props.isBroken,
    canSaveAs: props.canSaveAs,
    canManageImportExpireAt: props.canManageImportExpireAt,
    hasImportExpireAt: !!props.nocode?.importRestriction?.expireAt,
  }).map(key => resolveMenuConfigMap()[key]);
});

const menuClick = (menu: { label: string, icon: string, click: () => void }) => {
  menu.click();
  menuVisible.value = false;
  maskVisible.value = false;
}

const coverVersion = ref(0);

const getCoverImageURL = (nocodeId: string) => {
  return props.cover?.imageUrl || `project/get-nocode-snapshot/${nocodeId}?t=${coverVersion.value}`;
};

defineExpose({
  updateCoverImage: () => {
    coverVersion.value++;
  },
})

</script>

<style scoped lang='scss'>
.nocode-box {
  position: relative;
  height: 128px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--bg-color-page);
  padding: 24px 16px;
  border-radius: 8px;
  border: 1px solid #E5E6EB;
  cursor: var(--cursor-pointer);
  transition: box-shadow 0.3s ease-in-out;
  overflow: hidden;

  &:hover {
    border-color: #C9CDD4;
  }
  &.selected{
    border: 1px solid #0873FF;
  }

  &.is-broken {
    border-color: #f4b8b8;
    background: linear-gradient(180deg, #fff8f8 0%, #fff1f1 100%);

    &:hover {
      border-color: #f04438;
      box-shadow: 0 10px 24px rgba(240, 68, 56, 0.12);
    }

    .nocode-box-content-title {
      color: #b42318;
    }
  }

  .nocode-box-warmup-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 2;
    max-width: calc(100% - 52px);
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);

    &.is-cold {
      background: #f2f3f5;
      color: #4e5969;
    }

    &.is-base {
      background: #e8f3ff;
      color: #0b63ce;
    }

    &.is-ready {
      background: #e8fffb;
      color: #0f766e;
    }

    &.is-deep {
      background: #e6f7ff;
      color: #0369a1;
    }

    &.is-running {
      background: #fff7e8;
      color: #b45309;
    }

    &.is-error {
      background: #ffeceb;
      color: #c2410c;
    }
  }

  .nocode-box-warmup-badge__dot {
    width: 6px;
    height: 6px;
    flex: none;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.88;
  }

  .nocode-box-warmup-badge__label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    line-height: 16px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }


  .nocode-box-content {
    width: 100%;
    height: 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    row-gap: 10px;

    .nocode-box-content-header {
      width: 48px;
      height: 48px;

      .icon {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      img {
        width: 100%;
        height: 100%;
        border-radius: 8px;
        object-fit: cover;
      }

      .el-image {
        border-radius: 8px;
      }
    }

    .nocode-box-content-title {
      width: 100%;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      color: #4e5969;
      font-size: 14px;
      line-height: 22px;
      text-align: center
    }
  }

  .nocode-box-expire {
    position: absolute;
    inset: 0;
    pointer-events: none;

    .expire-corner {
      position: absolute;
      top: 0;
      left: 0;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      padding: 7px;
      color: #CF870C;
      pointer-events: auto;
      z-index: 2;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        border-top: 48px solid #FFFBE8;
        border-right: 48px solid transparent;
        z-index: -1;
      }
    }

    .expire-content {
      position: absolute;
      left: 50%;
      top: 50%;
      height: 22px;
      transform: translate(-50%, -50%);
      display: flex;
      align-items: center;
      justify-content: center;
      column-gap: 4px;
      padding: 3px 8px;
      border-radius: 4px;
      background-color: #FFEBE8;
      color: #FF4D4F;
      font-size: 12px;
      line-height: 18px;
      box-sizing: content-box;
      z-index: 2;

      .expire-time {
        white-space: nowrap;
      }
    }
  }

  &.is-expired {
    .nocode-box-content {
      filter: blur(4px);
      background-color: #FFFFFF33;
    }
  }

  &:hover .setting-icon,
  .setting-icon.active {
    visibility: visible;
    pointer-events: auto;
  }

  .setting-icon {
    position: absolute;
    top: 0;
    right: 0;
    width: 32px;
    height: 32px;
    visibility: hidden;
    pointer-events: none;
    padding: 4px;

    .more-menu-icon {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      display: flex;
      justify-content: center;
      align-items: center;

      &:hover {
        background-color: #F2F3F5;
      }
    }
  }
}
</style>

<style lang="scss">
.nocode-box-warmup-tooltip {
  max-width: 260px;
  box-sizing: border-box;

  .nocode-box-warmup-tooltip__content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nocode-box-warmup-tooltip__title {
    font-size: 12px;
    line-height: 18px;
    font-weight: 700;
    color: #fff;
  }

  .nocode-box-warmup-tooltip__description,
  .nocode-box-warmup-tooltip__meta,
  .nocode-box-warmup-tooltip__error {
    font-size: 12px;
    line-height: 18px;
    color: rgba(255, 255, 255, 0.88);
    word-break: break-word;
  }

  .nocode-box-warmup-tooltip__error {
    color: #fecaca;
  }

  .nocode-box-warmup-tooltip__phases {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
  }

  .nocode-box-warmup-tooltip__phase-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    line-height: 18px;
    color: rgba(255, 255, 255, 0.82);

    strong {
      color: #fff;
      font-weight: 600;
    }
  }
}

.el-popover.nocode-box-popover {
  padding: 6px;
  background-color: var(--bg-color-page);
  border: 1px solid #e5e6eb;
  box-shadow: 0px 4px 10px #0000001a;
  border-radius: 8px;
  min-width: unset;

  .mask-setting-menu {
    display: flex;
    padding: 0;
    flex-direction: column;
    align-items: center;
    row-gap: 8px;

    .mask-setting-menu-item-line {
      width: calc(100% - 24px);
      height: 1px;
      background-color: #E5E6EB;
    }

    .mask-setting-menu-item {
      padding: 8px 12px;
      width: 100%;
      height: 36px;
      display: flex;
      justify-content: start;
      align-items: center;
      font-size: 14px;
      column-gap: 8px;
      color: var(--text-color-primary);
      border-radius: 4px;
      cursor: pointer;

      &:hover {
        background-color: #F2F3F5;
      }
    }

    .delete-active:hover {
      background-color: #F2F3F5;
    }
  }
}

.workbench-nocode-expire-tooltip {
  border: none !important;
  border-radius: 4px !important;
  padding: 4px 12px !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08) !important;
  background-color: #FFFFFF !important;
  color: #CF870C !important;
  font-size: 12px !important;
  line-height: 20px !important;
  overflow: visible !important;

  &::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 12px;
    width: 0;
    height: 0;
    border-top: 5px solid #FFFFFF;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
  }
}
</style>

