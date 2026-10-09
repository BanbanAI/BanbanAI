import type { Component } from 'vue'

type WorkbenchAiChatModule = { default: Component }
type WorkbenchAiChatImporter = () => Promise<WorkbenchAiChatModule>

export const createCachedWorkbenchAiChatLoader = (importChat: WorkbenchAiChatImporter) => {
  let chatComponentPromise: Promise<Component> | null = null

  return () => {
    if (!chatComponentPromise) {
      chatComponentPromise = importChat()
        .then(module => module.default)
        .catch((error) => {
          chatComponentPromise = null
          throw error
        })
    }
    return chatComponentPromise
  }
}

export const loadWorkbenchAiChat = createCachedWorkbenchAiChatLoader(
  () => import('./WorkbenchAiChat.vue'),
)
