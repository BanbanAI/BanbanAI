<template>
  <div
    class="workbench-home-ai-sidebar"
    :class="{ 'is-resizing': isResizing }"
    :style="sidebarStyle"
  >
    <workbench-ai-nav
      ref="aiNavRef"
      :active-thread-id="currentThreadId"
      @new-chat="handleNewChat"
      @select-thread="handleSelectThread"
      @apps-click="handleAppsClick"
      @resources-click="handleResourcesClick"
      @expanded-change="handleExpandedChange"
    />
    <div v-show="aiChatVisible" class="workbench-home-ai-chat">
      <component
        :is="aiChatComponent"
        v-if="aiChatComponent"
        ref="aiChatRef"
        class="ai-sidebar-chat"
        :aiChatVisible="aiChatVisible"
        @close="handleCloseSidebar"
        @thread-change="handleThreadChange"
        @thread-list-change="handleThreadListChange"
      />
      <div v-else-if="aiChatLoading" class="workbench-home-ai-chat__loading" role="status" aria-live="polite">
        <el-icon :size="20" class="is-loading"><i-ep-loading /></el-icon>
        <span>{{ $t('workbenchAiChat.loading') }}</span>
      </div>
      <div v-else-if="aiChatLoadError" class="workbench-home-ai-chat__load-error">
        <span>{{ $t('WorkbenchAiChat.assistantError') }}</span>
        <el-button link type="primary" @click="retryLoadAiChat">
          {{ $t('WorkbenchAiChat.retry') }}
        </el-button>
      </div>
    </div>
    <div
      v-if="aiChatVisible"
      ref="resizeHandleRef"
      class="workbench-home-ai-sidebar__resize-handle"
      @pointerdown="handleResizePointerDown"
    ></div>
  </div>
</template>

<script setup lang='ts'>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AiThreadSummary } from './types'
import type { AiAttachment } from '@common/types/aiAttachment'
import { loadWorkbenchAiChat } from './workbenchAiChatLoader'
import {
  shouldCollapseWorkbenchAiNav,
  shouldCollapseWorkbenchAiSidebar,
  isWorkbenchAiSidebarEditorRoute,
} from './workbenchAiSidebarRoute'
import { resolveWorkbenchAiSidebarLayout } from './workbenchAiSidebarLayout'
import {
  WORKBENCH_AI_CHAT_MIN_WIDTH,
  WORKBENCH_AI_CHAT_PREFERRED_MAX_WIDTH,
  WORKBENCH_AI_SIDEBAR_WIDTH_STORAGE_KEY,
  clampWorkbenchAiSidebarChatWidth,
  createWorkbenchAiSidebarWidthStorageState,
  normalizeWorkbenchAiSidebarPreferredWidth,
  resolveWorkbenchAiSidebarResizeBounds,
  resolvePersistedWorkbenchAiSidebarPreferredWidth,
} from './workbenchAiSidebarResize'

type WorkbenchAiNavRef = {
  refreshThreadList: () => Promise<void>
  resetMenuActive: () => void
  collapse: () => void
}

type WorkbenchAiChatRef = {
  openWithMessage: (message: string, appIds?: string[]) => Promise<void>
  submitWithAttachments: (message: string, attachments: AiAttachment[]) => Promise<void>
  startNewChat: (appIds?: string[]) => void
  selectThread: (threadOrId: string | AiThreadSummary) => Promise<void>
  focusTextarea?: () => Promise<void>
}

const WORKBENCH_AI_SIDEBAR_RESIZE_DRAG_THRESHOLD = 8

const aiChatVisible = ref(false)
const route = useRoute()
const router = useRouter()
const isNavExpanded = ref(!shouldCollapseWorkbenchAiNav(route.name))
const currentThreadId = ref('')
const aiNavRef = ref<WorkbenchAiNavRef | null>(null)
const aiChatRef = ref<WorkbenchAiChatRef | null>(null)
const aiChatComponent = shallowRef<Component | null>(null)
const aiChatLoading = ref(false)
const aiChatLoadError = ref(false)
let aiChatActionId = 0
const resizeHandleRef = ref<HTMLDivElement | null>(null)
const viewportWidthPx = ref(typeof window === 'undefined' ? 1920 : window.innerWidth)
const preferredChatWidthPx = ref(WORKBENCH_AI_CHAT_MIN_WIDTH)
const chatWidthPx = ref(WORKBENCH_AI_CHAT_MIN_WIDTH)
const isResizing = ref(false)
const resizeState = {
  pointerId: null as number | null,
  startX: 0,
  startWidthPx: WORKBENCH_AI_CHAT_MIN_WIDTH,
}
const readPersistedPreferredChatWidth = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return WORKBENCH_AI_CHAT_MIN_WIDTH
  }

  try {
    const rawValue = window.localStorage.getItem(WORKBENCH_AI_SIDEBAR_WIDTH_STORAGE_KEY)
    if (!rawValue) {
      return WORKBENCH_AI_CHAT_MIN_WIDTH
    }

    const parsedValue = JSON.parse(rawValue) as Record<string, unknown> | number
    return resolvePersistedWorkbenchAiSidebarPreferredWidth(parsedValue)
  } catch (error) {
    console.error(error)
  }

  return WORKBENCH_AI_CHAT_MIN_WIDTH
}
const writePersistedPreferredChatWidth = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    window.localStorage.setItem(
      WORKBENCH_AI_SIDEBAR_WIDTH_STORAGE_KEY,
      JSON.stringify(createWorkbenchAiSidebarWidthStorageState(preferredChatWidthPx.value)),
    )
  } catch (error) {
    console.error(error)
  }
}
const resolveCurrentResizeBounds = (navExpanded = isNavExpanded.value) => resolveWorkbenchAiSidebarResizeBounds({
  viewportWidthPx: viewportWidthPx.value,
  navExpanded,
})
const syncChatWidthToBounds = (
  nextPreferredWidthPx = preferredChatWidthPx.value,
  navExpanded = isNavExpanded.value,
) => {
  preferredChatWidthPx.value = normalizeWorkbenchAiSidebarPreferredWidth(nextPreferredWidthPx)
  const bounds = resolveCurrentResizeBounds(navExpanded)
  chatWidthPx.value = clampWorkbenchAiSidebarChatWidth(preferredChatWidthPx.value, bounds)
}
const resetResizeState = () => {
  if (
    resizeState.pointerId !== null
    && resizeHandleRef.value?.hasPointerCapture(resizeState.pointerId)
  ) {
    resizeHandleRef.value.releasePointerCapture(resizeState.pointerId)
  }

  resizeState.pointerId = null
  isResizing.value = false
  if (typeof document !== 'undefined') {
    document.body.classList.remove('workbench-ai-sidebar-resizing')
  }
}
const sidebarLayout = computed(() => resolveWorkbenchAiSidebarLayout({
  navExpanded: isNavExpanded.value,
  chatVisible: aiChatVisible.value,
  chatWidthPx: chatWidthPx.value,
}))
const sidebarStyle = computed(() => ({
  '--workbench-ai-sidebar-width': `${sidebarLayout.value.layoutWidthPx}px`,
  '--workbench-ai-chat-width': `${sidebarLayout.value.chatWidthPx}px`,
  '--workbench-ai-chat-content-max-width': `${WORKBENCH_AI_CHAT_PREFERRED_MAX_WIDTH}px`,
}))
const isEditorRoute = () => isWorkbenchAiSidebarEditorRoute(route.name)

const ensureAiChatRef = async () => {
  if (!aiChatComponent.value) {
    aiChatLoadError.value = false
    aiChatLoading.value = true
    try {
      aiChatComponent.value = markRaw(await loadWorkbenchAiChat())
    } catch (error) {
      console.error(error)
      aiChatLoadError.value = true
      return null
    } finally {
      aiChatLoading.value = false
    }
  }
  await nextTick()
  return aiChatRef.value
}

const retryLoadAiChat = async () => {
  await ensureAiChatRef()
}

const handleCloseSidebar = () => {
  aiChatActionId += 1
  aiChatVisible.value = false
  currentThreadId.value = ''
  aiNavRef.value?.resetMenuActive()
}

const handleAppsClick = () => {
  aiChatActionId += 1
  aiChatVisible.value = false
  currentThreadId.value = ''
  if (isEditorRoute()) {
    void router.push('/')
  }
}

const handleResourcesClick = () => {
  aiChatActionId += 1
  aiChatVisible.value = false
  currentThreadId.value = ''
}

const handleNewChat = async () => {
  const actionId = ++aiChatActionId
  currentThreadId.value = ''
  syncChatWidthToBounds()
  aiChatVisible.value = true
  const chat = await ensureAiChatRef()
  if (!chat || actionId !== aiChatActionId || !aiChatVisible.value) return
  chat?.startNewChat()
  if (isEditorRoute()) {
    await router.push('/')
  }
  if (actionId !== aiChatActionId || !aiChatVisible.value) return
  await chat?.focusTextarea?.()
}

const handleSelectThread = async (thread: AiThreadSummary) => {
  const actionId = ++aiChatActionId
  const threadId = String(thread.id || '').trim()
  currentThreadId.value = threadId
  syncChatWidthToBounds()
  aiChatVisible.value = true
  const chat = await ensureAiChatRef()
  if (!chat || actionId !== aiChatActionId || !aiChatVisible.value) return
  void chat?.selectThread(thread)
  if (isEditorRoute()) {
    await router.push('/')
  }
}

const handleThreadChange = (threadId: string) => {
  const normalizedThreadId = String(threadId || '').trim()
  currentThreadId.value = normalizedThreadId
}

const handleThreadListChange = () => {
  void aiNavRef.value?.refreshThreadList()
}

watch(
  () => route.name,
  (routeName) => {
    if (!shouldCollapseWorkbenchAiSidebar(routeName) || !aiChatVisible.value) {
      return
    }
    handleCloseSidebar()
  },
)

const handleExpandedChange = (expanded: boolean) => {
  isNavExpanded.value = expanded
  syncChatWidthToBounds(preferredChatWidthPx.value, expanded)
}

const handleAssistantSend = async (payload: { content: string; appIds: string[]; attachments: AiAttachment[] }) => {
  const actionId = ++aiChatActionId
  currentThreadId.value = ''
  syncChatWidthToBounds()
  aiChatVisible.value = true
  const chat = await ensureAiChatRef()
  if (!chat || actionId !== aiChatActionId || !aiChatVisible.value) return
  chat.startNewChat(payload.appIds)
  if (payload.attachments.length) {
    await chat.submitWithAttachments(payload.content, payload.attachments)
  } else {
    await chat.openWithMessage(payload.content)
  }
}

const handleResizePointerDown = (event: PointerEvent) => {
  if (!aiChatVisible.value || event.button !== 0) return

  resizeHandleRef.value?.setPointerCapture(event.pointerId)
  resizeState.pointerId = event.pointerId
  resizeState.startX = event.clientX
  resizeState.startWidthPx = chatWidthPx.value
}

const handleDocumentPointerMove = (event: PointerEvent) => {
  if (resizeState.pointerId !== event.pointerId) return

  const offsetX = event.clientX - resizeState.startX
  if (!isResizing.value && Math.abs(offsetX) < WORKBENCH_AI_SIDEBAR_RESIZE_DRAG_THRESHOLD) {
    return
  }

  isResizing.value = true
  if (typeof document !== 'undefined') {
    document.body.classList.add('workbench-ai-sidebar-resizing')
  }

  const requestedWidthPx = resizeState.startWidthPx + offsetX
  preferredChatWidthPx.value = normalizeWorkbenchAiSidebarPreferredWidth(requestedWidthPx)
  const expandedBounds = resolveCurrentResizeBounds()
  if (expandedBounds.requiresNavCollapseBeforeGrow && requestedWidthPx > expandedBounds.maxWidthPx) {
    aiNavRef.value?.collapse()
  }

  const nextBounds = resolveCurrentResizeBounds()
  chatWidthPx.value = clampWorkbenchAiSidebarChatWidth(preferredChatWidthPx.value, nextBounds)
}

const handleDocumentPointerUp = (event: PointerEvent) => {
  if (resizeState.pointerId !== event.pointerId) return

  const shouldPersist = isResizing.value
  resetResizeState()
  if (shouldPersist) {
    writePersistedPreferredChatWidth()
  }
}

const handleWindowResize = () => {
  if (typeof window === 'undefined') return
  viewportWidthPx.value = window.innerWidth
  syncChatWidthToBounds()
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    viewportWidthPx.value = window.innerWidth
  }
  preferredChatWidthPx.value = readPersistedPreferredChatWidth()
  syncChatWidthToBounds()
  document.addEventListener('pointermove', handleDocumentPointerMove)
  document.addEventListener('pointerup', handleDocumentPointerUp)
  document.addEventListener('pointercancel', handleDocumentPointerUp)
  window.addEventListener('resize', handleWindowResize)
})

onBeforeUnmount(() => {
  resetResizeState()
  document.removeEventListener('pointermove', handleDocumentPointerMove)
  document.removeEventListener('pointerup', handleDocumentPointerUp)
  document.removeEventListener('pointercancel', handleDocumentPointerUp)
  window.removeEventListener('resize', handleWindowResize)
})

defineExpose({
  get aiChatVisible() {
    return aiChatVisible.value
  },
  get isNavExpanded() {
    return isNavExpanded.value
  },
  handleAssistantSend,
})
</script>

<style scoped lang='scss'>
.workbench-home-ai-sidebar {
  height: 100%;
  display: flex;
  flex-shrink: 0;
  width: var(--workbench-ai-sidebar-width);
  flex: 0 0 var(--workbench-ai-sidebar-width);
  background-color: #ffffff;
  position: relative;
  z-index: 100;

  &.is-resizing {
    user-select: none;
  }

  .workbench-home-ai-chat {
    height: 100%;
    width: var(--workbench-ai-chat-width);
    flex: 0 0 var(--workbench-ai-chat-width);
    overflow: hidden;
    background-color: #ffffff;

    .workbench-home-ai-chat__load-error {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 8px;
      color: var(--text-color-secondary);
      font-size: 14px;
    }

    .workbench-home-ai-chat__loading {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 8px;
      color: var(--text-color-secondary);
      font-size: 14px;
    }
  }

  .workbench-home-ai-sidebar__resize-handle {
    position: absolute;
    top: 0;
    right: -4px;
    width: 8px;
    height: 100%;
    cursor: col-resize;
    z-index: 2;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 2px;
      transform: translateX(-50%);
      background: transparent;
      transition: background-color 0.2s ease;
    }

    &:hover::before {
      background-color: rgba(22, 93, 255, 0.18);
    }
  }
}

:global(body.workbench-ai-sidebar-resizing) {
  cursor: col-resize;
  user-select: none;
}
</style>
