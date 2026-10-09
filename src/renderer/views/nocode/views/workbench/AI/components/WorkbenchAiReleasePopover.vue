<template>
  <el-popover
    placement="bottom-end"
    :width="300"
    trigger="click"
    :show-arrow="false"
    popper-class="workbench-ai-release-popper"
    transition="el-zoom-in-top"
  >
    <template #reference>
      <button
        type="button"
        class="ai-release-trigger"
        :aria-label="$t('WorkbenchAiReleasePopover.release')"
        v-if="false"
      >
        <el-icon :size="16">
          <i-ven-ai-chat-release />
        </el-icon>
      </button>
    </template>

    <div class="ai-release-popover">
      <div class="ai-release-popover__header">
        <span class="ai-release-popover__title">{{ $t('WorkbenchAiReleasePopover.release') }}</span>
        <span
          class="ai-release-popover__status"
          :class="{ 'is-published': enabled }"
        >
          <span class="ai-release-popover__status-dot"></span>
          {{ enabled ? $t('WorkbenchAiReleasePopover.released') : $t('WorkbenchAiReleasePopover.notReleased') }}
        </span>
      </div>

      <template v-if="enabled">
        <div class="ai-release-popover__section">
          <div class="ai-release-popover__label">{{ $t('WorkbenchAiReleasePopover.directAccessUrl') }}</div>
          <div class="ai-release-popover__url-row">
            <div class="ai-release-popover__url-card">
              <div class="ai-release-popover__url-text" :title="shareUrl">{{ shareUrl }}</div>
              <button
                type="button"
                class="ai-release-popover__icon-button ai-release-popover__code-copy"
                :aria-label="$t('WorkbenchAiReleasePopover.copyLink')"
                @click="handleCopy(shareUrl)"
              >
                <el-icon :size="16">
                  <i-ven-ai-release-copy />
                </el-icon>
              </button>
            </div>
            <el-popover
              placement="bottom-end"
              :width="160"
              trigger="click"
              :teleported="false"
              :offset="4"
              :show-arrow="false"
              popper-class="workbench-ai-release-qrcode-popper"
              transition="el-zoom-in-top"
            >
              <template #reference>
                <button
                  type="button"
                  class="ai-release-popover__icon-button"
                  :aria-label="$t('WorkbenchAiReleasePopover.viewQrCode')"
                >
                  <el-icon :size="16">
                    <i-ven-qr-code />
                  </el-icon>
                </button>
              </template>
              <div class="ai-release-popover__qrcode">
                <Qrcode :size="140" :value="shareUrl" level="L" />
              </div>
              <div class="ai-release-popover__tip">{{ $t('WorkbenchAiReleasePopover.scanToAccess') }}</div>
            </el-popover>
          </div>
        </div>

        <div class="ai-release-popover__section">
          <div class="ai-release-popover__label">{{ $t('WorkbenchAiReleasePopover.iFrameIntegration') }}</div>
          <div class="ai-release-popover__code-card">
            <div class="ai-release-popover__code-text">{{ iframeCode }}</div>
            <button
              type="button"
              class="ai-release-popover__icon-button ai-release-popover__code-copy"
              :aria-label="$t('WorkbenchAiReleasePopover.copyIFrameCode')"
              @click="handleCopy(iframeCode)"
            >
              <el-icon :size="16">
                <i-ven-ai-release-copy />
              </el-icon>
            </button>
          </div>
        </div>

        <div class="ai-release-popover__section">
          <div class="ai-release-popover__label">{{ $t('WorkbenchAiReleasePopover.sdkAccess') }}</div>
          <div class="ai-release-popover__code-card">
            <div class="ai-release-popover__code-text">{{ sdkCode }}</div>
            <button
              type="button"
              class="ai-release-popover__icon-button ai-release-popover__code-copy"
              :aria-label="$t('WorkbenchAiReleasePopover.copySdkCode')"
              @click="handleCopy(sdkCode)"
            >
              <el-icon :size="16">
                <i-ven-ai-release-copy />
              </el-icon>
            </button>
          </div>
        </div>
      </template>

      <div class="ai-release-popover__section">
        <div class="ai-release-popover__label">{{ $t('WorkbenchAiReleasePopover.visibility') }}</div>
        <div class="ai-release-popover__visibility">
          <el-icon :size="16">
            <i-ven-ai-lang />
          </el-icon>
          <span>{{ $t('WorkbenchAiReleasePopover.anyoneWithLink') }}</span>
        </div>
      </div>

      <button
        type="button"
        class="ai-release-popover__submit"
        :class="{ 'is-stop': enabled }"
        :disabled="submitting"
        @click="handleToggleSharing"
      >
        {{ enabled ? $t('WorkbenchAiReleasePopover.stopRelease') : $t('WorkbenchAiReleasePopover.release') }}
      </button>
    </div>
  </el-popover>
</template>

<script setup lang='ts'>
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'
import Qrcode from 'qrcode.vue'
import { useSettingStore } from '@renderer/stores'
import type { AiShareInfo } from '../types'
import i18next from 'i18next';


const props = withDefaults(defineProps<{
  agentId?: string
  enabled?: boolean
  shareToken?: string
}>(), {
  agentId: '',
  enabled: false,
  shareToken: '',
})

const emit = defineEmits<{
  (event: 'sharing-change', value: { enabled: boolean; shareToken: string }): void
}>()

const settingState = useSettingStore()
const { copy } = useClipboard({ legacy: true })
const submitting = ref(false)

const shareUrl = computed(() => {
  const token = String(props.shareToken || '').trim()
  if (!token) return ''
  return `${settingState.saas.domain}/#/chat/${token}`
})

const iframeCode = computed(() => {
  if (!shareUrl.value) return ''
  return `<iframe width=1600 height=900 src="${shareUrl.value}" frameborder=0 allowfullscreen=true></iframe>`
})

const sdkCode = computed(() => {
  if (!shareUrl.value) return ''
  return `<iframe width=1600 height=900 src="${shareUrl.value}" frameborder=0 allowfullscreen=true></iframe>`
})

const handleCopy = async (content: string) => {
  if (!content) {
    ElMessage.warning(i18next.t('WorkbenchAiReleasePopover.noContentToCopy'))
    return
  }

  try {
    await copy(content)
    ElMessage.success(i18next.t('WorkbenchAiReleasePopover.copySuccess'))
  } catch (error) {
    console.error('Copy share content failed:', error)
    ElMessage.error(i18next.t('WorkbenchAiReleasePopover.copyFail'))
  }
}

const handleToggleSharing = async () => {
  const agentId = String(props.agentId || '').trim()
  if (!agentId) {
    ElMessage.warning(i18next.t('WorkbenchAiReleasePopover.noContentToCopy'))
    return
  }

  const nextEnabled = !props.enabled
  submitting.value = true

  try {
    const { data } = await axios.post<AiShareInfo>(`/ai/agents/${agentId}/share`, {
      enabled: nextEnabled,
    })
    emit('sharing-change', {
      enabled: nextEnabled,
      shareToken: String(data?.shareToken || ''),
    })
    ElMessage.success(nextEnabled ? i18next.t('WorkbenchAiReleasePopover.releaseSuccess') : i18next.t('WorkbenchAiReleasePopover.stopReleaseSuccess'))
  } catch (error) {
    console.error(nextEnabled ? 'Enable share failed:' : 'Disable share failed:', error)
    ElMessage.error(nextEnabled ? i18next.t('WorkbenchAiReleasePopover.releaseFailed') : i18next.t('WorkbenchAiReleasePopover.stopReleaseFailed'))
  } finally {
    submitting.value = false
  }
}
</script>

<style lang='scss' scoped>
.ai-release-trigger {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4e5969;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: var(--cursor-pointer);
  transition: background-color 0.2s ease, color 0.2s ease;

  &:hover {
    background-color: #f2f3f5;
    color: #1d2129;
  }
}
</style>
<style lang='scss'>
.el-popover.workbench-ai-release-popper {
  padding: 0;
  border-radius: 8px;
  border: 1px solid #e5e6eb;
  overflow: hidden;
  box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.08), 0 4px 12px 0 rgba(0, 0, 0, 0.04);

  .el-popover.workbench-ai-release-qrcode-popper {
    padding: 8px;
    border-radius: 12px;
    border: 1px solid #e5e6eb;
    box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.08), 0 4px 12px 0 rgba(0, 0, 0, 0.04);
  }

  .ai-release-popover {
    padding: 8px;
    background-color: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ai-release-popover__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .ai-release-popover__title {
    color: #1d2129;
    font-size: 14px;
    line-height: 28px;
    font-weight: 500;
  }

  .ai-release-popover__status {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    color: #86909c;
    font-size: 12px;
    line-height: 20px;
  }

  .ai-release-popover__status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #c9cdd4;
  }

  .ai-release-popover__status.is-published {
    color: #4e5969;

    .ai-release-popover__status-dot {
      background-color: #52c41a;
    }
  }

  .ai-release-popover__section {
    margin-top: 4px;
  }

  .ai-release-popover__label {
    margin-bottom: 8px;
    color: #86909c;
    font-size: 14px;
    line-height: 22px;
    font-weight: 500;
  }

  .ai-release-popover__url-row {
    height: 36px;
    display: flex;
    align-items: stretch;
    gap: 4px;
  }

  .ai-release-popover__url-card,
  .ai-release-popover__code-card,
  .ai-release-popover__visibility {
    border-radius: 6px;
    background-color: #f2f3f5;
  }

  .ai-release-popover__url-card {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    .ai-release-popover__code-copy {
      position: static;
      display: flex;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      margin-right: 4px;
    }
  }

  .ai-release-popover__url-text {
    padding: 0 12px;
    color: #1d2129;
    font-size: 14px;
    line-height: 36px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ai-release-popover__icon-button {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 6px;
    background-color: #f2f3f5;
    color: #4e5969;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: var(--cursor-pointer);
    transition: background-color 0.2s ease, color 0.2s ease;

    &:hover {
      background-color: #e5e6eb;
      color: #1d2129;
    }
  }

  .ai-release-popover__code-card {
    position: relative;
    padding: 10px 44px 10px 12px;
  }

  .ai-release-popover__code-text {
    color: #1D2129;
    font-size: 14px;
    line-height: 22px;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .ai-release-popover__code-copy {
    position: absolute;
    right: 8px;
    bottom: 8px;
    width: 28px;
    height: 28px;
    background: transparent;

    &:hover {
      background-color: #e5e6eb;
    }
  }

  .ai-release-popover__visibility {
    min-height: 36px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #1d2129;
    font-size: 14px;
    line-height: 22px;
  }

  .ai-release-popover__submit {
    width: 100%;
    height: 32px;
    margin-top: 4px;
    border: 0;
    border-radius: 6px;
    background-color: #0873ff;
    color: #ffffff;
    font-size: 14px;
    line-height: 22px;
    cursor: var(--cursor-pointer);
    transition: background-color 0.2s ease, opacity 0.2s ease;

    &:hover:not(:disabled) {
      background-color: #2d88ff;
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    &.is-stop {
      background-color: #ff4d4f;

      &:hover:not(:disabled) {
        background-color: #ff7875;
      }
    }
  }
}

.el-popover.workbench-ai-release-qrcode-popper {
  padding: 8px;
  background-color: #fff;
  border: 1px solid #E5E6EB;
  border-radius: 8px;

  .ai-release-popover__qrcode {
    width: 144px;
    height: 144px;
    padding: 5px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  }

  .ai-release-popover__tip {
    margin-top: 8px;
    font-size: 14px;
    line-height: 22px;
    color: #86909C;
    text-align: center;
  }
}
</style>
