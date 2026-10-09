<template>
  <div class="workbench-ai-nav" :class="{ 'is-expanded': expanded }">
    <div class="ai-nav__header" @click="toggleExpand">
      <div class="ai-nav__logo-wrapper">
        <img :src="expandedLogo" alt="Logo" class="ai-nav__logo" v-if="expanded" />
        <img :src="aiSidebarLogoSmall" alt="Logo" class="ai-nav__logo-small" v-else />
      </div>
      <button
        class="ai-nav__collapse-btn"
        :title="expanded ? $t('WorkbenchAiNav.collapseSidebar') : $t('WorkbenchAiNav.expandSidebar')"
        @click.stop="toggleExpand"
      >
        <el-icon size="16"><i-ven-ai-sidebar-icon /></el-icon>
      </button>
    </div>

    <div class="ai-nav__menu">
      <div
        class="ai-nav__menu-item ai-nav__menu-item--new-chat"
        :class="{ 'is-active': isNewChatActive }"
        @click="handleNewChat"
        :title="$t('WorkbenchAiNav.newlyCreatedConversation')"
      >
        <el-icon class="ai-nav__menu-icon"><i-ven-ai-sidebar-edit /></el-icon>
        <span class="ai-nav__menu-text" v-if="expanded">{{ $t('WorkbenchAiNav.newlyCreatedConversation') }}</span>
      </div>
      <div
        class="ai-nav__menu-item ai-nav__menu-item--apps"
        :class="{ 'is-active': isAppsActive }"
        @click="handleAppsClick"
        :title="$t('WorkbenchAiNav.application')"
      >
        <el-icon class="ai-nav__menu-icon"><i-ven-ai-sidebar-apps /></el-icon>
        <span class="ai-nav__menu-text" v-if="expanded">{{ $t('WorkbenchAiNav.application') }}</span>
      </div>
      <div
        v-if="isChineseLanguage"
        class="ai-nav__menu-item ai-nav__menu-item--resources"
        :class="{ 'is-active': isResourcesActive }"
        @click="handleResourcesClick"
        :title="$t('WorkbenchAiNav.resourceCenter')"
      >
        <el-icon class="ai-nav__menu-icon"><i-ven-ai-sidebar-resources /></el-icon>
        <span class="ai-nav__menu-text" v-if="expanded">{{ $t('WorkbenchAiNav.resourceCenter') }}</span>
      </div>
    </div>

    <div v-if="hasRenderedThreadList" v-show="expanded" class="ai-nav__chats">
      <div
        class="ai-nav__chats-header"
        :class="{ 'is-hovered': batchDropdownVisible }"
        @click="toggleThreadsExpanded"
      >
        <div class="ai-nav__chats-main">
          <span class="ai-nav__chats-title">{{ $t('WorkbenchAiNav.allConversations') }}</span>
          <el-icon class="ai-nav__chats-arrow" :class="{ 'is-rotated': !threadsExpanded }">
            <i-ep-arrow-down />
          </el-icon>
        </div>
        <div class="ai-nav__chats-actions" @click.stop>
          <workbench-ai-nav-batch-dropdown
            @command="handleBatchCommand"
            @visible-change="batchDropdownVisible = $event"
          />
        </div>
      </div>
      <div class="ai-nav__chats-list" v-show="threadsExpanded">
        <div
          v-for="(thread, index) in threadList"
          :key="thread.id"
          class="ai-nav__chat-item"
          :class="{
            'is-active': props.activeThreadId === thread.id,
            'is-hovered': openedDropdownThreadId === thread.id,
            'is-last-pinned': Boolean(thread.pinned) && !threadList[index + 1]?.pinned,
          }"
          @click="selectThread(thread)"
          @mouseenter="handleThreadHoverChange(thread.id, true)"
          @mouseleave="handleThreadHoverChange(thread.id, false)"
        >
          <span class="ai-nav__chat-text">{{ thread.title || $t('WorkbenchAiNav.newConversation') }}</span>
          <div class="ai-nav__chat-actions">
            <workbench-ai-nav-chat-dropdown
              v-if="shouldRenderChatActions(thread.id)"
              :pinned="Boolean(thread.pinned)"
              :active="props.activeThreadId === thread.id"
              @command="handleThreadCommand(thread, $event)"
              @visible-change="handleThreadDropdownVisibleChange(thread.id, $event)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="ai-nav__footer" v-if="expanded">
      <div
        v-if="passportState.isLoginUser"
        class="ai-nav__footer-item ai-nav__footer-balance"
      >
        <div class="ai-nav__balance">
          <el-icon class="ai-nav__recharge-btn-icon" :size="20" color="#3793ff"><i-ven-ai-score-icon /></el-icon>
          <span class="ai-nav__balance-label">{{ $t('WorkbenchAiNav.score') }}:</span>
          <span class="ai-nav__balance-value">{{ balanceValue }}</span>
        </div>
        <button class="ai-nav__recharge-btn" @click="handleOpenRechargeManagement">{{ $t('WorkbenchAiNav.recharge') }}</button>
      </div>
    </div>
  </div>
  <input-tip-dialog
    ref="renameDialogRef"
    :title="$t('WorkbenchAiNav.rename')"
    :label="$t('WorkbenchAiNav.conversationName')"
    :placeholder="$t('WorkbenchAiNav.enterConversationName')"
    :requiredMessage="$t('WorkbenchAiNav.enterConversationName')"
  />
  <tip-dialog
    ref="deleteThreadDialogRef"
    :title="$t('WorkbenchAiNavChatDropdown.deleteTitle')"
    :content="$t('WorkbenchAiNavChatDropdown.deleteTip')"
    :confirmText="$t('WorkbenchAiNavChatDropdown.confirmText')"
    :cancelText="$t('WorkbenchAiNavChatDropdown.cancelText')"
    :closeOnClickModal="true"
  />
</template>

<script setup lang="ts">
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePassportStore } from '@renderer/stores'
import aiSidebarLogo from '@renderer/assets/image/nocode/ai-sidebar-logo.png'
import aiSidebarLogoEnglish from '@renderer/assets/image/nocode/logo-full-en.png'
import aiSidebarLogoSmall from '@renderer/assets/image/nocode/ai-sidebar-logo-icon.png'
import WorkbenchAiNavBatchDropdown from './components/WorkbenchAiNavBatchDropdown.vue'
import WorkbenchAiNavChatDropdown from './components/WorkbenchAiNavChatDropdown.vue'
import TipDialog from '@renderer/views/nocode/dialog/TipDialog.vue'
import type { AiThreadSummary } from './types'
import { resolveWorkbenchAiThreadListSyncAction } from './workbenchAiNavThreadListCache'
import { shouldRenderWorkbenchAiNavChatActions } from './workbenchAiNavChatActions'
import { shouldCollapseWorkbenchAiNav } from './workbenchAiSidebarRoute'
import i18next from 'i18next';

const props = defineProps({
  activeThreadId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['new-chat', 'select-thread', 'apps-click', 'resources-click', 'expanded-change'])

const router = useRouter()
const route = useRoute()
const passportState = usePassportStore()
passportState.init()
const expanded = ref(!shouldCollapseWorkbenchAiNav(route.name))
const activeMenu = ref<'apps' | 'threads' | 'resources' | ''>('')
const threadsExpanded = ref(true)
const hasRenderedThreadList = ref(false)
const hasLoadedThreadList = ref(false)
const threadListLoading = ref(false)
const threadListDirty = ref(false)
const threadListReloadAfterLoad = ref(false)
const threadList = ref<AiThreadSummary[]>([])
const openedDropdownThreadId = ref('')
const hoveredThreadId = ref('')
const batchDropdownVisible = ref(false)
const renameDialogRef = ref();
const deleteThreadDialogRef = ref();
const languageVersion = ref(0)

const balanceValue = computed(() => `${(Number(passportState.user.coin || 0)).toFixed(2)}`)
const isChineseLanguage = computed(() => {
  void languageVersion.value
  return /^zh(?:-|$)/i.test(i18next.resolvedLanguage || i18next.language || '')
})
const expandedLogo = computed(() => isChineseLanguage.value ? aiSidebarLogo : aiSidebarLogoEnglish)

const handleLanguageChanged = () => {
  languageVersion.value += 1
}

const loadThreadList = async () => {
  if (threadListLoading.value) return
  threadListLoading.value = true
  try {
    const { data } = await axios.get<AiThreadSummary[]>('/ai/threads', {
      params: {
        limit: 100,
      },
    })
    threadList.value = data || []
    hasLoadedThreadList.value = true
    threadListDirty.value = false
  } catch (error) {
    threadListDirty.value = true
    console.error('AI thread list request failed:', error)
  } finally {
    threadListLoading.value = false
  }

  if (!threadListReloadAfterLoad.value) {
    return
  }

  threadListReloadAfterLoad.value = false
  await syncThreadList(true)
}

const syncThreadList = async (force = false) => {
  const action = resolveWorkbenchAiThreadListSyncAction({
    expanded: expanded.value,
    threadsExpanded: threadsExpanded.value,
    hasLoaded: hasLoadedThreadList.value,
    loading: threadListLoading.value,
    dirty: threadListDirty.value,
    force,
  })

  if (action === 'mark-dirty') {
    threadListDirty.value = true
    return
  }

  if (action === 'queue-reload') {
    threadListReloadAfterLoad.value = true
    return
  }

  if (action !== 'load') {
    return
  }

  hasRenderedThreadList.value = true
  await loadThreadList()
}

onMounted(() => {
  i18next.on('languageChanged', handleLanguageChanged)
  if (expanded.value) {
    void syncThreadList()
  }
})

onBeforeUnmount(() => {
  i18next.off('languageChanged', handleLanguageChanged)
})

const isAppsActive = computed(() => {
  if (String(props.activeThreadId || '').trim()) return false;
  if (activeMenu.value === "apps") return true;
  // 只有在应用页且未选中对话时，默认高亮应用
  if ((route.path === "/" || route.path === "/apps") && activeMenu.value !== "threads") return true;
  return false;
});

const isResourcesActive = computed(() => route.path === '/market');

// 监听路由变化，若离开应用页则重置选中状态
watch(
  () => route.path,
  (path) => {
    if (path !== "/" && path !== "/apps" && activeMenu.value === "apps") {
      activeMenu.value = "";
    }
    if (path !== "/market" && activeMenu.value === "resources") {
      activeMenu.value = "";
    }
  },
);

watch(
  () => route.fullPath,
  () => {
    if (!shouldCollapseWorkbenchAiNav(route.name) || !expanded.value) return

    expanded.value = false
    emit('expanded-change', false)
  },
)

const isNewChatActive = computed(() => {
  return activeMenu.value === 'threads' && !String(props.activeThreadId || '').trim()
})

const toggleExpand = () => {
  expanded.value = !expanded.value
  if (expanded.value) {
    void syncThreadList()
  }
  emit('expanded-change', expanded.value)
}

const collapse = () => {
  if (!expanded.value) return
  expanded.value = false
  emit('expanded-change', false)
}

const toggleThreadsExpanded = () => {
  threadsExpanded.value = !threadsExpanded.value
  if (threadsExpanded.value) {
    void syncThreadList()
  }
}

const handleAppsClick = () => {
  activeMenu.value = 'apps'
  router.push('/')
  emit('apps-click')
}

const handleResourcesClick = () => {
  activeMenu.value = 'resources'
  router.push('/market')
  emit('resources-click')
}

const handleNewChat = () => {
  activeMenu.value = 'threads'
  emit('new-chat')
}

const normalizeIdList = (value?: string[] | null) => (
  Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : []
)

const selectThread = (thread: AiThreadSummary) => {
  activeMenu.value = 'threads'
  emit('select-thread', thread)
}

const buildThreadUpdatePayload = (thread: AiThreadSummary, patch: Record<string, unknown>) => {
  const payload: Record<string, unknown> = {
    ...patch,
  }

  if (thread.appScope !== undefined) {
    payload.appScope = thread.appScope
      ? {
        appIds: normalizeIdList(thread.appScope.appIds),
      }
      : null
  }

  return payload
}

const handleThreadDropdownVisibleChange = (threadId: string, visible: boolean) => {
  if (visible) {
    openedDropdownThreadId.value = threadId
    return
  }
  if (openedDropdownThreadId.value === threadId) {
    openedDropdownThreadId.value = ''
  }
}

const handleThreadHoverChange = (threadId: string, hovered: boolean) => {
  const normalizedThreadId = String(threadId || '').trim()
  if (!normalizedThreadId) {
    return
  }

  if (hovered) {
    hoveredThreadId.value = normalizedThreadId
    return
  }

  if (hoveredThreadId.value === normalizedThreadId) {
    hoveredThreadId.value = ''
  }
}

const shouldRenderChatActions = (threadId: string) => shouldRenderWorkbenchAiNavChatActions({
  threadId,
  activeThreadId: props.activeThreadId,
  hoveredThreadId: hoveredThreadId.value,
  openedDropdownThreadId: openedDropdownThreadId.value,
})

const toggleThreadPinned = async (thread: AiThreadSummary) => {
  try {
    await axios.post(`/ai/threads/${thread.id}/update`, buildThreadUpdatePayload(thread, {
      pinned: !thread.pinned,
    }))
    threadListDirty.value = true
    await syncThreadList(true)
    ElMessage.success(thread.pinned ? i18next.t('WorkbenchAiNav.cancelPin') : i18next.t('WorkbenchAiNav.pin'))
  } catch (error) {
    console.error('AI thread pinned update failed:', error)
    ElMessage.error(thread.pinned ? i18next.t('WorkbenchAiNav.cancelPinFailed') : i18next.t('WorkbenchAiNav.pinFailed'));
  }
}

const renameThread = async (thread: AiThreadSummary) => {
  const resolve = await renameDialogRef.value?.confirm(thread.title || '');
  if (typeof resolve !== 'string') return;
  const name = resolve.trim();

  if (!name || name === thread.title) return;
  try {
    await axios.post(`/ai/threads/${thread.id}/update`, buildThreadUpdatePayload(thread, {
      title: name,
    }))
    threadListDirty.value = true
    await syncThreadList(true)
    ElMessage.success(i18next.t('WorkbenchAiNav.renameSuccess'))
  } catch (error) {
    console.error('AI thread rename failed:', error)
    ElMessage.error(i18next.t('WorkbenchAiNav.renameFailed'));
  }
}

const deleteThread = async (thread: AiThreadSummary) => {
  try {
    await axios.post(`/ai/threads/${thread.id}/delete`)
    if (props.activeThreadId === thread.id) {
      handleNewChat()
    }
    threadListDirty.value = true
    await syncThreadList(true)
    ElMessage.success(i18next.t('WorkbenchAiNav.deleteSuccess'))
  } catch (error) {
    console.error('AI thread delete failed:', error)
    ElMessage.error(i18next.t('WorkbenchAiNav.deleteFailed'));
  }
}

const hideThread = async (thread: AiThreadSummary) => {
  try {
    await axios.post(`/ai/threads/${thread.id}/hide`)
    if (props.activeThreadId === thread.id) {
      handleNewChat()
    }
    threadListDirty.value = true
    await syncThreadList(true)
    ElMessage.success(i18next.t('WorkbenchAiNav.hideSuccess'))
  } catch (error) {
    console.error('AI thread hide failed:', error)
    ElMessage.error(i18next.t('WorkbenchAiNav.hideFailed'))
  }
}

const unhideAllThreads = async () => {
  try {
    await axios.post('/ai/threads/unhide-all')
    threadListDirty.value = true
    await syncThreadList(true)
    ElMessage.success(i18next.t('WorkbenchAiNav.showAllSuccess'))
  } catch (error) {
    console.error('AI threads unhide all failed:', error)
    ElMessage.error(i18next.t('WorkbenchAiNav.showAllFailed'))
  }
}

const deleteUnsharedThreads = async () => {
  const activeThread = threadList.value.find(thread => thread.id === props.activeThreadId)
  try {
    await axios.post('/ai/threads/delete-unshared')
    if (activeThread && !activeThread.sharing) {
      handleNewChat()
    }
    threadListDirty.value = true
    await syncThreadList(true)
    ElMessage.success(i18next.t('WorkbenchAiNav.deleteUnsharedSuccess'))
  } catch (error) {
    console.error('AI unshared thread delete failed:', error)
    ElMessage.error(i18next.t('WorkbenchAiNav.deleteUnsharedFailed'))
  }
}

const handleBatchCommand = async (command: string | number | object) => {
  const normalizedCommand = String(command || '')
  if (normalizedCommand === 'delete-unshared') {
    await deleteUnsharedThreads()
    return
  }
  if (normalizedCommand === 'unhide-all') {
    await unhideAllThreads()
  }
}

const handleThreadCommand = async (thread: AiThreadSummary, command: string | number | object) => {
  const normalizedCommand = String(command || '')
  if (normalizedCommand === 'toggle-pinned') {
    await toggleThreadPinned(thread)
    return
  }
  if (normalizedCommand === 'rename') {
    await renameThread(thread)
    return
  }
  if (normalizedCommand === 'hide') {
    await hideThread(thread)
    return
  }
  if (normalizedCommand === 'delete') {
    const confirmed = await deleteThreadDialogRef.value?.confirm()
    if (confirmed) {
      await deleteThread(thread)
    }
  }
}

const handleOpenRechargeManagement = async () => {
  await router.push('/recharge-management')
}

defineExpose({
  refreshThreadList: async () => {
    threadListDirty.value = true
    await syncThreadList(true)
  },
  resetMenuActive: () => {
    activeMenu.value = ''
  },
  collapse: () => {
    collapse()
  },
})
</script>

<style scoped lang="scss">
.workbench-ai-nav {
  width: 52px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border-right: 1px solid #e5e6eb;
  padding-top: 8px;
  padding-bottom: 8px;
  transition: width 0.3s ease;
  overflow: hidden;
  flex-shrink: 0;
  
  &.is-expanded {
    width: 256px;
  }
  
  .ai-nav__header {
    position: relative;
    height: 36px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    border-bottom: 1px solid transparent;
  }
  
  &:not(.is-expanded) .ai-nav__header {
    justify-content: start;
    padding-left: 8px;

    &:hover .ai-nav__collapse-btn {
      background-color: #f2f3f5;
    }
  }

  &:not(.is-expanded):hover {
    .ai-nav__collapse-btn {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      background-color: #fff;
    }
  }

  &.is-expanded .ai-nav__header {
    padding-right: 44px;

    .ai-nav__collapse-btn {
      opacity: 1;
      visibility: visible;
    }
  }

  .ai-nav__logo-wrapper {
    display: flex;
    align-items: center;
    height: 100%;
    padding-left: 8px;
    overflow: hidden;
  }

  .ai-nav__logo {
    height: 20px;
    object-fit: contain;
    // padding-left: 8px;
  }

  .ai-nav__logo-small {
    height: 20px;
    width: 20px;
    object-fit: contain;
    border-radius: 4px;
  }

  .ai-nav__collapse-btn {
    position: absolute;
    top: 0;
    right: 8px;
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    color: transparent;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease, background-color 0.2s ease;

    &:hover {
      background-color: #f2f3f5;
    }
  }

  .ai-nav__menu {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 8px;
    margin-top: 16px;
    gap: 4px;
  }

  .ai-nav__menu-item {
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    padding-left: 9px;
    cursor: pointer;
    color: #1d2129;
    transition: background-color 0.2s;
    white-space: nowrap;

    &:hover {
      background-color: #f2f3f5;
    }

    &.is-active {
      background-color: #e8f3ff;
      color: #165dff;
    }
  }

  &:not(.is-expanded) .ai-nav__menu {
    padding-left: 8px;
  }

  &:not(.is-expanded) .ai-nav__menu-item {
    width: 36px;
    height: 36px;
  }

  .ai-nav__menu-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  &:not(.is-expanded) .ai-nav__menu-icon {
    margin-right: 0;
  }

  .ai-nav__menu-text {
    font-size: 14px;
    font-weight: 500;
    margin-left: 10px;
  }

  .ai-nav__chats {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0 8px;
    margin-top: 16px;
    white-space: nowrap;
  }

  .ai-nav__chats-header {
    height: 36px;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    padding: 8px 8px 8px 12px;
    cursor: pointer;
    color: #86909c;
    font-size: 12px;
    user-select: none;

    &:hover {
      color: #4e5969;
    }
  }

  .ai-nav__chats-main {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .ai-nav__chats-title {
    min-width: 0;
  }

  .ai-nav__chats-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .ai-nav__chats-actions :deep(.ai-nav__chat-more-btn) {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
  }

  .ai-nav__chats-header:hover .ai-nav__chats-actions :deep(.ai-nav__chat-more-btn),
  .ai-nav__chats-header.is-hovered .ai-nav__chats-actions :deep(.ai-nav__chat-more-btn) {
    opacity: 1;
    pointer-events: auto;
  }

  .ai-nav__chats-arrow {
    transition: transform 0.3s;
    &.is-rotated {
      transform: rotate(-90deg);
    }
  }

  .ai-nav__chats-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
    
    &::-webkit-scrollbar {
      display: none; /* Chrome, Safari and Opera */
    }
  }

  .ai-nav__chat-item {
    height: 36px;
    min-height: 36px;
    position: relative;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 12px;
    padding-right: 6px;
    cursor: pointer;
    color: #4e5969;
    font-size: 13px;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover,
    &.is-hovered {
      background-color: #f2f3f5;
    }

    &.is-active {
      background-color: #e8f3ff;
      color: #165dff;
      font-weight: 500;
    }

    &.is-last-pinned {
      margin-bottom: 16px;
    }

    &.is-last-pinned::after {
      content: '';
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: -9px;
      height: 1px;
      background-color: #e5e6eb;
      pointer-events: none;
    }
  }

  .ai-nav__chat-text {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .ai-nav__chat-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #00b42a;
    flex-shrink: 0;
    margin-left: 8px;
  }

  .ai-nav__chat-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    min-width: 28px;
    justify-content: flex-end;
  }

  .ai-nav__chat-actions :deep(.ai-nav__chat-more-btn) {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
  }

  .ai-nav__chat-item:hover .ai-nav__chat-actions :deep(.ai-nav__chat-more-btn) {
    opacity: 1;
    pointer-events: auto;
  }

  .ai-nav__chat-item.is-hovered .ai-nav__chat-actions :deep(.ai-nav__chat-more-btn) {
    opacity: 1;
    pointer-events: auto;
  }

  .ai-nav__footer {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 8px;
  }

  .ai-nav__footer-item {
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: start;
    padding-left: 9px;
    color: #1d2129;
    white-space: nowrap;
  }

  .ai-nav__footer-balance {
    height: 52px;
    color: #1d2129;
    font-size: 14px;
    border: 1px solid #e5e6eb;
    padding: 0 12px;
    justify-content: space-between;
    gap: 4px;
  }

  .ai-nav__balance {
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .ai-nav__balance-label {
    flex-shrink: 0;
  }

  .ai-nav__balance-value {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ai-nav__recharge-btn {
    height: 28px;
    line-height: 22px;
    padding: 0 12px;
    border: none;
    background-color: #e8f3ff;
    color: #165dff;
    border-radius: 4px;
    font-size: 14px;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: #d4e8ff;
    }
  }

  .ai-nav__balance-icon {
    margin-right: 2px;
  }
}
</style>
