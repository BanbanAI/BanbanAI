<template>
  <div class="ai-chat-share-page">
    <workbench-ai-chat
      :ai-chat-visible="true"
      :is-share-page="true"
      :share-token="shareToken"
      :visitor-key="visitorKey"
      :placeholder="$t('chat.inputPlaceholder')"
    />
  </div>
</template>

<script lang='ts' setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { unique } from '@common/utils/unique'
import WorkbenchAiChat from './WorkbenchAiChat.vue'
import { chatVisitorInfoStore } from '@renderer/utils/storage'

const route = useRoute()
const shareToken = computed(() => String(route.params.chatId || '').trim())

const visitorKey = computed(() => {
  const current = chatVisitorInfoStore.get() || {}
  if (current.visitorKey) {
    return String(current.visitorKey)
  }
  const nextVisitorKey = unique()
  chatVisitorInfoStore.set({
    ...current,
    visitorKey: nextVisitorKey,
  })
  return nextVisitorKey
})
</script>

<style lang='scss' scoped>
.ai-chat-share-page {
  width: 100vw;
  max-width: 1280px;
  margin: 0 auto;
  height: 100vh;
  padding: 0 20px;
  background-color: #fff;
  @media (max-width: 768px) {
    padding: 0;
    // padding-top: 44px;
  }
}
</style>
