<template>
  <div
    class="workbench-ai-chat"
    :class="{ 'hidden': !aiChatVisible, 'is-share-page': isSharePage }"
    v-bind="attrs"
  >
    <div v-if="!isSharePage && !readonly" class="ai-sidebar__header">
      <workbench-ai-release-popover
        :agent-id="currentAgentId"
        :enabled="currentThreadSharing"
        :share-token="currentThreadShareToken"
        @sharing-change="handleSharingChange"
        v-if="currentThreadId"
      />
      <button
        type="button"
        class="ai-sidebar__close"
        :aria-label="$t('WorkbenchAiChat.closeAiSidebar')"
        @click="emit('close')"
      >
        <el-icon :size="16">
          <i-ep-close />
        </el-icon>
      </button>
    </div>
    <div class="ai-sidebar__content">
      <div ref="messagesContainerRef" class="ai-sidebar__messages" @scroll="handleScroll">
        <div v-if="curAiMessageList.length === 0 && !isInitialLoading" class="ai-sidebar__empty">
          {{ $t('WorkbenchAiChat.whatCanIHelpYouWith') }}
        </div>
        <div
          v-for="message in curAiMessageList"
          :key="message.id"
          class="ai-sidebar__message-row"
          :class="[
            `is-${message.role}`,
            { 'is-inline-editing': editingUserMessageId === message.id },
          ]"
        >
          <div
            class="ai-sidebar__message-content"
            @mouseenter="hoveredMessageId = message.id"
            @mouseleave="hoveredMessageId = ''"
          >
            <div
              v-if="message.role === AiMessageRole.USER && editingUserMessageId !== message.id && getUserAttachments(message).length"
              class="ai-sidebar__user-message-attachments"
            >
              <workbench-ai-excel-attachment-card
                v-for="attachment in getVisibleUserExcelAttachments(message)"
                :key="`${message.id}-${attachment.id}`"
                :attachment="attachment"
                :is-expired="isExcelAttachmentExpired(attachment)"
                :create-disabled="isHistoryAttachmentCreateDisabled(attachment)"
                @create-form-from-attachment="handleCreateFormFromHistoryAttachment"
                @add-attachment-to-composer="handleAddHistoryAttachmentToComposer"
              />
              <ai-message-attachment-list
                v-if="getUserGeneralAttachments(message).length"
                :attachments="getUserGeneralAttachments(message)"
                :content-url-resolver="getAttachmentContentUrl"
              />
            </div>
            <div
              v-if="message.role === AiMessageRole.ASSISTANT || editingUserMessageId === message.id || Boolean(message.content)"
              class="ai-sidebar__message-bubble-wrap"
            >
              <div
                class="ai-sidebar__message-bubble"
                :class="{ 'is-inline-editing': editingUserMessageId === message.id }"
              >
                <template v-if="message.role === AiMessageRole.ASSISTANT">
                  <div class="ai-sidebar__assistant-body">
                    <div
                      v-if="message.metadata?.contextCompaction?.status === 'running'"
                      class="ai-sidebar__thinking"
                      :class="{ 'ai-sidebar__thinking--process': shouldRenderAssistantProcess(message) }"
                    >
                      <span class="ai-sidebar__thinking-text">{{ i18next.t('WorkbenchAiChat.contextCompactionRunning') }}</span>
                      <span class="ai-sidebar__thinking-dots" aria-hidden="true">
                        <span class="ai-sidebar__thinking-dot">.</span>
                        <span class="ai-sidebar__thinking-dot">.</span>
                        <span class="ai-sidebar__thinking-dot">.</span>
                      </span>
                    </div>
                    <div
                      v-if="message.metadata?.contextCompaction?.status === 'completed'"
                      class="ai-sidebar__context-compaction-completed"
                    >
                      {{ i18next.t('WorkbenchAiChat.contextCompactionCompleted') }}
                    </div>
                    <details
                      v-if="shouldRenderAssistantProcess(message)"
                      class="ai-sidebar__process"
                      :class="{ 'is-initializing': isAssistantProcessInitializing(message) }"
                      :open="isAssistantProcessExpanded(message)"
                      @toggle="handleAssistantProcessToggle(message, $event)"
                    >
                      <summary class="ai-sidebar__process-summary">
                        <span class="ai-sidebar__process-summary-main">
                          <span class="ai-sidebar__process-label">{{ resolveAssistantProcessTitle(message) }}</span>
                          <span
                            v-if="shouldShowAssistantProcessPrimaryLine(message)"
                            class="ai-sidebar__process-primary"
                          >
                            {{ resolveAssistantProcessPrimaryLine(message) }}
                          </span>
                          <span
                            v-if="resolveAssistantProcessSecondaryLineItems(message).length"
                            class="ai-sidebar__process-secondary"
                          >
                            <span
                              v-for="item in resolveAssistantProcessSecondaryLineItems(message)"
                              :key="`${message.id}-${item}`"
                              class="ai-sidebar__process-secondary-item"
                            >
                              {{ item }}
                            </span>
                          </span>
                        </span>
                        <span class="ai-sidebar__process-arrow" aria-hidden="true"></span>
                      </summary>
                      <div class="ai-sidebar__process-body">
                        <template v-for="group in getMessageToolCallGroups(message)" :key="group.id">
                          <workbench-ai-tool-calls
                            :calls="resolveToolCallGroupCalls(message, group)"
                            :interim-texts="getMessageInterimTexts(message)"
                            :timeline="group.timeline || []"
                          />
                        </template>
                      </div>
                    </details>
                    <workbench-ai-dev-diagnostics
                      v-if="shouldRenderAssistantDevDiagnostics(message)"
                      :diagnostics="getMessageDevDiagnostics(message)"
                      :reset-key="currentThreadId"
                    />
                    <div
                      v-if="shouldShowAssistantThinking(message) && message.metadata?.contextCompaction?.status !== 'running'"
                      class="ai-sidebar__thinking"
                      :class="{ 'ai-sidebar__thinking--process': shouldRenderAssistantProcess(message) }"
                    >
                      <span class="ai-sidebar__thinking-text">{{ getAssistantStatusText(message) }}</span>
                      <span class="ai-sidebar__thinking-dots" aria-hidden="true">
                        <span class="ai-sidebar__thinking-dot">.</span>
                        <span class="ai-sidebar__thinking-dot">.</span>
                        <span class="ai-sidebar__thinking-dot">.</span>
                      </span>
                    </div>
                    <template v-if="hasRenderableAssistantBlocks(message)">
                      <template v-for="(item, index) in resolveAssistantRenderableBlocks(message)" :key="`${message.id}-block-${index}`">
                        <div
                          v-if="isMarkdownRenderableItem(item)"
                          class="ai-sidebar__message-markdown"
                          v-shadow-markdown="{
                            html: renderAssistantMessage(item.block.text),
                            onRouteClick: handleAssistantRouteClick,
                            onTableExpand: handleAssistantTableExpand,
                            tableExpandLabel: $t('WorkbenchAiChat.expandPreview'),
                          }"
                        ></div>
                        <workbench-ai-chart-block
                          v-else-if="isChartRenderableItem(item)"
                          class="ai-sidebar__message-chart"
                          :block="item.block"
                          :evidence="item.evidence"
                          @expand="handleAssistantChartExpand"
                          @route-click="handleAssistantRouteClick"
                        />
                        <workbench-ai-table-block
                          v-else-if="isTableRenderableItem(item)"
                          class="ai-sidebar__message-table"
                          :block="item.block"
                          :evidence="item.evidence"
                          :leading-summary-text="item.leadingSummaryText"
                          @expand="payload => handleAssistantStructuredTableExpand(item, payload)"
                          @route-click="handleAssistantRouteClick"
                        />
                      </template>
                    </template>
                    <workbench-ai-app-builder-handoff-card
                      v-if="getMessageAppBuilderHandoff(message)"
                      :handoff="getMessageAppBuilderHandoff(message)"
                      :submitting="handoffSubmittingId === getMessageAppBuilderHandoff(message)?.handoffId"
                      :clarifying="pendingHandoffClarificationId === getMessageAppBuilderHandoff(message)?.handoffId"
                      :readonly="readonly || isSharePage"
                      @add-attachment-to-composer="handleAddHistoryAttachmentToComposer"
                      @continue-create="handleContinueCreate"
                      @resolve-creation-mode="handleResolveCreationMode"
                      @request-target-app-selection="handleRequestTargetAppSelection"
                    />
                    <workbench-ai-app-builder-handoff-issue-card
                      v-else-if="getMessageAppBuilderHandoffIssue(message)"
                      :issue="getMessageAppBuilderHandoffIssue(message)"
                    />
                    <button
                      v-if="canUndoMessageFormFill(message)"
                      type="button"
                      class="ai-sidebar__form-fill-undo"
                      @click="handleUndoMessageFormFill(message)"
                    >
                      <el-icon :size="14"><i-ep-refresh-left /></el-icon>
                      <span>{{ $t('workbenchAiChat.undoFormFill') }}</span>
                    </button>
                  </div>
                </template>
                <template v-else>
                  <div
                    v-if="editingUserMessageId === message.id"
                    class="ai-sidebar__inline-edit"
                  >
                    <textarea
                      ref="inlineEditTextareaRef"
                      v-model="editingUserMessageDraft"
                      class="ai-sidebar__inline-edit-textarea"
                      rows="3"
                      :disabled="isAssistantResponding"
                    ></textarea>
                    <div class="ai-sidebar__inline-edit-actions">
                      <button type="button" class="ai-sidebar__inline-edit-cancel" @click="cancelEditUserMessage">{{ $t('workbenchAiChat.cancel') }}</button>
                      <button
                        type="button"
                        class="ai-sidebar__inline-edit-submit"
                        :disabled="isAssistantResponding || (!editingUserMessageDraft.trim() && !editingUserMessageAttachments.length)"
                        @click="submitEditedUserMessage"
                      >{{ $t('workbenchAiChat.send') }}</button>
                    </div>
                  </div>
                  <div v-else class="ai-sidebar__user-message-content">
                    <div v-if="message.content">{{ message.content }}</div>
                  </div>
                </template>
              </div>
            </div>
            <workbench-ai-message-toolbar
              v-if="editingUserMessageId !== message.id"
              :content="message.content"
              :copy-content="getCopyableMessageContent(message)"
              :loading="isAssistantResponding"
              :role="message.role"
              :create-time="message.createTime"
              :hovered="hoveredMessageId === message.id"
              :feedback-value="feedbackState[message.id] || ''"
              show-on-hover-only
              :can-edit="canEditUserMessage(message)"
              @feedback="handleFeedback(message.id, $event)"
              @edit="handleEditUserMessage(message)"
            />
          </div>
        </div>
      </div>

      <div
        v-if="!readonly"
        class="ai-sidebar__composer"
        :class="{ 'has-login-prompt': showLoginPrompt }"
      >
        <transition name="fade">
          <button
            v-if="!isAtBottom"
            type="button"
            class="ai-sidebar__scroll-bottom"
            @click="scrollToBottom(true)"
          >
            <el-icon :size="16"><i-ven-ai-bottom-arrow /></el-icon>
          </button>
        </transition>
        <workbench-ai-login-prompt
          v-if="showLoginPrompt"
          :admin-only="showAdminLoginPrompt"
          @login="handleLoginClick"
          @other-options="handleOtherOptionsClick"
        />
        <workbench-ai-chat-input
          ref="sidebarChatInputRef"
          v-model="sidebarTextareaValue"
          :attachments="sidebarAttachments"
          :attachment-upload-nocode-id="activeAttachmentUploadNocodeId"
          :attachment-accept="WORKBENCH_AI_ATTACHMENT_ACCEPT"
          :defer-attachment-upload="true"
          :loading="isAssistantResponding"
          :submitting="isAttachmentSubmitting"
          :show-attachment-button="!isSharePage"
          :show-model-selector="showModelSelector"
          :model-options="modelSelectorOptions"
          :selected-model-value="selectedModelValue"
          :model-label="currentModelLabel"
          :allow-model-selection="allowModelSelection && !isAttachmentSubmitting"
          :model-selection-loading="aiConfigStore.catalogLoading"
          :show-app-selector="!isSharePage"
          :app-ids="currentThreadAppIds"
          :placeholder="chatInputPlaceholder"
          v-bind="attrs"
          @submit="handleSend"
          @model-change="handleModelChange"
          @app-selector-close="handleAppSelectorClose"
          @select-attachment="handleSidebarAttachmentSelect"
          @remove-attachment="handleSidebarAttachmentRemove"
        />
      </div>
    </div>
    <data-view-dialog
      v-model="assistantDataViewVisible"
      :nocodeId="assistantDataViewState.appId"
      :tableId="assistantDataViewState.tableId"
      :filterPath="assistantDataViewState.filterPath"
      :title="assistantDataViewState.title"
      :z-index="AI_PREVIEW_DRAWER_Z_INDEX + 10"
      open-mode="drawer"
    />
    <el-dialog
      v-model="targetAppSelectionDialogVisible"
      class="workbench-ai-target-app-dialog"
      :title="$t('workbenchAiChat.selectTargetApp')"
      width="min(420px, calc(100vw - 32px))"
      append-to-body
      :close-on-click-modal="!targetAppSelectionSubmitting"
      :close-on-press-escape="!targetAppSelectionSubmitting"
      @closed="resetTargetAppSelection"
    >
      <div class="workbench-ai-target-app-dialog__body">
        <el-input
          v-model="targetAppSelectionSearchValue"
          class="workbench-ai-target-app-dialog__search"
          :placeholder="$t('workbenchAiChat.searchApps')"
          clearable
          :disabled="targetAppSelectionSubmitting"
        >
          <template #prefix>
            <el-icon :size="16"><i-ep-search /></el-icon>
          </template>
        </el-input>

        <div class="workbench-ai-target-app-dialog__options">
          <div v-if="handoffTargetAppOptionsLoading" class="workbench-ai-target-app-dialog__state">{{ $t('workbenchAiChat.loading') }}</div>
          <div v-else-if="handoffTargetAppOptionsLoadFailed" class="workbench-ai-target-app-dialog__state is-error">
            <span>{{ $t('workbenchAiChat.appListLoadFailed') }}</span>
            <el-button link type="primary" @click="retryLoadHandoffTargetApps">{{ $t('workbenchAiChat.retry') }}</el-button>
          </div>
          <template v-else>
            <section
              v-if="filteredRecommendedHandoffTargetAppOptions.length"
              class="workbench-ai-target-app-dialog__group"
            >
              <div class="workbench-ai-target-app-dialog__group-label">{{ $t('workbenchAiChat.recommendedApps') }}</div>
              <button
                v-for="app in filteredRecommendedHandoffTargetAppOptions"
                :key="app.key"
                type="button"
                class="workbench-ai-target-app-dialog__option"
                :class="{
                  'is-selected': app.available && selectedTargetAppId === app.id,
                  'is-unavailable': !app.available,
                }"
                :disabled="targetAppSelectionSubmitting || !app.available"
                @click="app.available && app.id ? selectedTargetAppId = app.id : null"
              >
                <span class="workbench-ai-target-app-dialog__option-icon">
                  <el-icon :size="14"><i-ven-ai-sidebar-apps /></el-icon>
                </span>
                <span class="workbench-ai-target-app-dialog__option-copy">
                  <span class="workbench-ai-target-app-dialog__option-name">{{ app.name }}</span>
                  <span v-if="!app.available" class="workbench-ai-target-app-dialog__option-note">{{ $t('workbenchAiChat.notInSelectableList') }}</span>
                </span>
                <el-icon
                  class="workbench-ai-target-app-dialog__option-check"
                  :class="{ 'is-visible': app.available && selectedTargetAppId === app.id }"
                  :size="16"
                >
                  <i-ep-check />
                </el-icon>
              </button>
            </section>
            <section
              v-if="filteredRemainingHandoffTargetAppOptions.length"
              class="workbench-ai-target-app-dialog__group"
            >
              <div class="workbench-ai-target-app-dialog__group-label">{{ $t('workbenchAiChat.allApps') }}</div>
              <button
                v-for="app in filteredRemainingHandoffTargetAppOptions"
                :key="app.id"
                type="button"
                class="workbench-ai-target-app-dialog__option"
                :class="{ 'is-selected': selectedTargetAppId === app.id }"
                :disabled="targetAppSelectionSubmitting"
                @click="selectedTargetAppId = app.id"
              >
                <span class="workbench-ai-target-app-dialog__option-icon">
                  <el-icon :size="14"><i-ven-ai-sidebar-apps /></el-icon>
                </span>
                <span class="workbench-ai-target-app-dialog__option-copy">
                  <span class="workbench-ai-target-app-dialog__option-name">{{ app.name }}</span>
                </span>
                <el-icon
                  class="workbench-ai-target-app-dialog__option-check"
                  :class="{ 'is-visible': selectedTargetAppId === app.id }"
                  :size="16"
                >
                  <i-ep-check />
                </el-icon>
              </button>
            </section>
            <div
              v-if="
                !filteredRecommendedHandoffTargetAppOptions.length
                && !filteredRemainingHandoffTargetAppOptions.length
              "
              class="workbench-ai-target-app-dialog__state"
            >{{ $t('workbenchAiChat.noMatchingApps') }}</div>
          </template>
        </div>
      </div>

      <template #footer>
        <el-button :disabled="targetAppSelectionSubmitting" @click="targetAppSelectionDialogVisible = false">{{ $t('workbenchAiChat.cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="targetAppSelectionSubmitting"
          :disabled="!selectedTargetApp || handoffTargetAppOptionsLoading"
          @click="confirmHandoffTargetAppSelection"
        >{{ $t('workbenchAiChat.addAndOpen') }}</el-button>
      </template>
    </el-dialog>
    <el-drawer
      class="ai-preview-drawer"
      :model-value="assistantPreviewVisible"
      @update:model-value="assistantPreviewVisible = $event"
      @opened="handleAssistantPreviewOpened"
      :z-index="AI_PREVIEW_DRAWER_Z_INDEX"
      append-to-body
      size="70%"
      :show-close="false"
      close-on-click-modal
    >
      <template #header>
        <div class="ai-preview-drawer__header">
          <span>{{ assistantPreviewTitle }}</span>
          <el-button link @click="assistantPreviewVisible = false">
            <el-icon><i-ep-close /></el-icon>
          </el-button>
        </div>
      </template>
      <div class="ai-preview-drawer__body">
        <div
          v-if="assistantPreviewState.type === 'markdown'"
          class="ai-preview-drawer__markdown"
          v-shadow-markdown="{
            html: assistantPreviewState.html,
            onRouteClick: handleAssistantRouteClick,
            enableTableExpand: false,
          }"
        ></div>
        <workbench-ai-chart-block
          v-else-if="assistantPreviewChartBlock"
          :key="assistantPreviewChartRenderKey"
          class="ai-preview-drawer__chart"
          :block="assistantPreviewChartBlock"
          :evidence="assistantPreviewState.evidence"
          :expandable="false"
          :preview-mode="true"
          :initial-primary-view-key="assistantPreviewState.primaryViewKey"
          :initial-table-view-key="assistantPreviewState.tableViewKey"
          @route-click="handleAssistantRouteClick"
        />
        <workbench-ai-table-block
          v-else-if="assistantPreviewTableBlock"
          class="ai-preview-drawer__table"
          :block="assistantPreviewTableBlock"
          :evidence="assistantPreviewState.evidence"
          :leading-summary-text="assistantPreviewState.leadingSummaryText"
          :expandable="false"
          :preview-mode="true"
          :initial-table-view-key="assistantPreviewState.tableViewKey"
          @route-click="handleAssistantRouteClick"
        />
      </div>
    </el-drawer>
    <ImportExcelDialog
      v-if="excelAnalysisDialogReady"
      ref="excelAnalysisDialogRef"
      v-model:dialogVisible="excelAnalysisDialogVisible"
      :contentSource="'nocodeCreateDataDialogValue'"
      :mode="'analysis'"
      @closeDialog="handleExcelDialogClosed"
    />
  </div>
</template>

<script setup lang='ts'>
import type {
  AiAssistantChartBlock,
  AiAssistantMessageBlock,
  AiAssistantPrimaryViewKey,
  AiAssistantTableBlock,
} from '@common/types/ai'
import type { AiThreadModelSelection } from '@common/types/ai-provider'
import { parseAiAssistantMessageContent, resolveAiAssistantMessageBlocks, resolveAiAssistantMessageText } from '@common/utils/aiMessageBlocks'
import { BUILTIN_AI_PROVIDER_ID, resolveThreadModelSelectorValue } from '@common/utils/aiProvider'
import { resolveReadAppDataDisplayName } from '@common/utils/aiToolDisplay'
import { isLikelyToolProtocolText, normalizeInterimText } from '@common/utils/aiToolProtocol'
import {
  normalizeWorkbenchAiFormFillToolInput,
  WORKBENCH_AI_FILL_CURRENT_FORM_TOOL,
  type WorkbenchAiFormFillResult,
} from '@common/utils/workbenchAiFormFill'
import axios from 'axios'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { computed, defineAsyncComponent, inject, nextTick, onMounted, provide, ref, useAttrs, watch } from 'vue'
import { isNavigationFailure, useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import MarkdownIt from 'markdown-it'
import { vShadowMarkdown } from './shadowMarkdownDirective'
import type { ShadowMarkdownExpandedTablePayload } from './shadowMarkdownDirective'
import type { ShadowMarkdownRouteTarget } from './shadowMarkdownRoute'
import {
  groupAiAssistantRenderableBlocks,
  normalizeWorkbenchAppBuilderHandoffIssue,
  normalizeWorkbenchAppBuilderHandoffPreview,
  resolveWorkbenchAppBuilderHandoffContinueIntent,
  shouldContinueWorkbenchAppBuilderHandoffAfterResolve,
  type AiAssistantMarkdownRenderableItem,
  type AiAssistantRenderableItem,
  type AiAssistantStructuredRenderableItem,
  type WorkbenchAiAppBuilderHandoffIssuePreview,
  type WorkbenchAiAppBuilderHandoffPreview,
  type WorkbenchAiAppBuilderHandoffResolvePayload,
  resolveAiAssistantStructuredTablePreviewContext,
} from './workbenchAiInsightPanelModel'
import type { AiAnalysisEvidenceSummary } from './workbenchAiInsightPanelModel'
import type {
  AiAttachment,
  AiAttachmentIntentHint,
  AiAttachmentReference,
} from '@common/types/aiAttachment'
import { WORKBENCH_AI_ATTACHMENT_ACCEPT } from '@common/utils/aiAttachmentFormats'
import {
  buildAiAttachmentFallbackRequestText,
  buildAiAttachmentIntentSummary,
  buildAiAttachmentMessageMetadata,
  buildAiAttachmentPromptLines,
  hasAiAttachmentUploadHandle,
  inferAiAttachmentKind,
  normalizeAiAttachmentReference,
  resolveAiAttachmentIntent,
  resolveAiAttachmentImportSourcePath,
  stripAiAttachmentFileExtension,
} from '@common/utils/aiAttachmentIntent'
import {
  cloneAiExcelAttachmentForComposer,
  collectAiExcelCreateCompletionAttachmentIds,
  isSameAiExcelImportSourceInstance,
  resolveAiExcelImportSourceInstance,
} from '@common/utils/aiExcelCreateFormState'
import {
  resolveAiExcelAnalysisContextAfterMessageLoad,
  resolveAiExcelAnalysisFollowupBehavior,
} from '@common/utils/aiExcelAnalysis'
import {
  applyThreadModelSelectionState,
  buildThreadModelSelectionRequest,
  ensureDraftThreadModelSelectionState,
  syncStreamModelSelectionState,
  useAiThreadViewState,
} from './useAiThreadViewState'
import type { AiThreadViewState } from './useAiThreadViewState'
import WorkbenchAiChartBlock from './components/WorkbenchAiChartBlock.vue'
import WorkbenchAiTableBlock from './components/WorkbenchAiTableBlock.vue'
import WorkbenchAiDevDiagnostics from './components/WorkbenchAiDevDiagnostics.vue'
import WorkbenchAiReleasePopover from './components/WorkbenchAiReleasePopover.vue'
import AiMessageAttachmentList from '@renderer/views/nocode/components/ai/AiMessageAttachmentList.vue'
import { AiMessageRole, AiStreamEventType } from './types'
import type {
  AiConversationProfile,
  AiChatStreamPayload,
  AiComposerAttachment,
  AiComposerAttachmentEventPayload,
  AiInterimTextTrace,
  AiMessage,
  AiMessageMetadata,
  AiRequestAttachmentMetadata,
  AiTurnDiagnostics,
  AiToolCallGroupTrace,
  AiToolCallGroupTimelineItem,
  AiToolCallTrace,
  AiShareBootstrapResult,
  AiShareStreamRequest,
  AiThreadMessage,
  AiThreadStreamRequest,
  AiThreadSummary,
} from './types'
import WorkbenchAiChatInput from './components/WorkbenchAiChatInput.vue'
import WorkbenchAiLoginPrompt from './components/WorkbenchAiLoginPrompt.vue'
import i18next from 'i18next';
import WorkbenchAiToolCalls from './components/WorkbenchAiToolCalls.vue'
import WorkbenchAiAppBuilderHandoffCard from './components/WorkbenchAiAppBuilderHandoffCard.vue'
import {
  buildHandoffTargetAppSections,
  type HandoffPreferredApp,
  type HandoffTargetAppRecommendation,
} from './components/workbench-ai-app-selector.loader'
import WorkbenchAiAppBuilderHandoffIssueCard from './components/WorkbenchAiAppBuilderHandoffIssueCard.vue'
import WorkbenchAiExcelAttachmentCard from './components/WorkbenchAiExcelAttachmentCard.vue'
import { createAccessibleAppOptionsLoader } from './components/workbench-ai-app-selector.loader'
import { useAiConfigStore, useDialogStore, usePassportStore } from "@renderer/stores";
import { NOCODE_ID } from '@renderer/types'
import { WORKBENCH_AI_FORM_FILL_CONTEXT } from './workbenchAiFormFillContext'
import { stageNocodeEditorBuilderModelSelection } from '@renderer/utils/nocodeEditorBuilderModelSelectionTransfer'

const ImportExcelDialog = defineAsyncComponent(() => import('@renderer/views/nocode/components/ImportExcelDialog.vue'))

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  aiChatVisible?: boolean
  isSharePage?: boolean
  shareToken?: string
  visitorKey?: string
  readonly?: boolean
  placeholder?: string
}>(), {
  aiChatVisible: false,
  isSharePage: false,
  shareToken: '',
  visitorKey: '',
  readonly: false,
  placeholder: '',
})

const attrs = useAttrs();

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'close'): void
  (event: 'thread-change', threadId: string): void
  (event: 'thread-list-change'): void
}>()

const getAssistantThinkingText = () => i18next.t('WorkbenchAiChat.assistantThinking');
const getAssistantErrorText = () => i18next.t('WorkbenchAiChat.assistantError');
const MESSAGE_PAGE_SIZE = 30;
const LOAD_MORE_HISTORY_THRESHOLD = 100;

type WorkbenchAiChatInputRef = {
  focusTextarea: () => Promise<void>
}

type ImportExcelDialogHandle = {
  prefillUploadedExcel?: (payload: {
    fullPath: string
    sessionId?: string
    name?: string
    formName?: string
  }) => Promise<boolean>
  setFormInfo: (name?: string, group?: string) => void
}

type AiAssistantTableRenderableItem = AiAssistantStructuredRenderableItem & {
  block: AiAssistantTableBlock
}

type AiAssistantChartRenderableItem = AiAssistantStructuredRenderableItem & {
  block: AiAssistantChartBlock
}

type ChartExpandPayload =
  {
    kind: 'chart'
    block: AiAssistantChartBlock
    evidence: AiAnalysisEvidenceSummary | null
    primaryViewKey: AiAssistantPrimaryViewKey
    tableViewKey: string
  }

type AiToolDisplayStatus = 'running' | 'success' | 'error' | 'skipped'

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const TOOL_NAME_LABEL_MAP: Record<string, string> = {
  get search_apps() { return i18next.t('workbenchAiChat.searchApps') },
  get get_app_memory() { return i18next.t('workbenchAiChat.analyzeAppStructure') },
  get fill_current_form() { return i18next.t('workbenchAiChat.fillCurrentForm') },
}

const TOOL_STATUS_TEXT_MAP: Record<AiToolDisplayStatus, string> = {
  get running() { return i18next.t('workbenchAiChat.running') },
  get success() { return i18next.t('workbenchAiChat.success') },
  get error() { return i18next.t('workbenchAiChat.error') },
  get skipped() { return i18next.t('workbenchAiChat.skipped') },
}
const AI_PREVIEW_DRAWER_Z_INDEX = 2100
const isDevelopmentMode = import.meta.env.DEV

const route = useRoute()
const router = useRouter()
const chatInputPlaceholder = computed(() => props.placeholder || (
  route.name === 'NocodeHome'
    ? i18next.t('WorkbenchAiChat.appChatInputPlaceholder')
    : i18next.t('WorkbenchAiChat.homeChatInputPlaceholder')
))
const passportState = usePassportStore();
const dialogState = useDialogStore();
const aiConfigStore = useAiConfigStore()
const workbenchNocodeId = computed(() => String(route.params.nocodeId || '').trim() || '')
provide(NOCODE_ID, workbenchNocodeId.value)
const workbenchAiFormFillContext = inject(WORKBENCH_AI_FORM_FILL_CONTEXT, null)
const sidebarTextareaValue = ref('')
const sidebarAttachments = ref<AiComposerAttachment[]>([])
const isAttachmentSubmitting = ref(false)
const editingUserMessageId = ref('')
const editingUserMessageDraft = ref('')
const editingUserMessageAttachments = ref<AiComposerAttachment[]>([])
const inlineEditTextareaRef = ref<HTMLTextAreaElement | HTMLTextAreaElement[] | null>(null)
const excelAnalysisDialogReady = ref(false)
const excelAnalysisDialogVisible = ref(false)
const excelAnalysisDialogRef = ref<ImportExcelDialogHandle | null>(null)
const sidebarChatInputRef = ref<WorkbenchAiChatInputRef | null>(null)
const messagesContainerRef = ref<HTMLElement | null>(null)
const isAtBottom = ref(true)
const hoveredMessageId = ref('')
const feedbackState = ref<Record<string, '' | 'like' | 'dislike'>>({})
const processExpandedState = ref<Record<string, boolean>>({})
const handoffSubmittingId = ref('')
const pendingHandoffClarificationId = ref('')
const targetAppSelectionDialogVisible = ref(false)
const targetAppSelectionSearchValue = ref('')
const targetAppSelectionSubmitting = ref(false)
const selectedTargetAppId = ref('')
const pendingTargetAppSelectionHandoff = ref<WorkbenchAiAppBuilderHandoffPreview | null>(null)
const threadSelectionTicket = ref(0)
const streamControllers = ref(new Map<AiThreadViewState, AbortController>())
const assistantDataViewVisible = ref(false)
const assistantDataViewState = ref({
  appId: '',
  tableId: '',
  filterPath: '',
  title: '',
})
const assistantPreviewVisible = ref(false)
const assistantPreviewChartRenderKey = ref(0)
let assistantPreviewChartRepaintFrame: number | null = null
let assistantPreviewChartRepaintFollowupFrame: number | null = null
const assistantPreviewState = ref<{
  type: '' | 'markdown' | 'chart' | 'table'
  title: string
  html: string
  chartBlock: AiAssistantChartBlock | null
  tableBlock: AiAssistantTableBlock | null
  evidence: AiAnalysisEvidenceSummary | null
  tableHtml: string
  tableText: string
  leadingSummaryText: string
  primaryViewKey: AiAssistantPrimaryViewKey
  tableViewKey: string
}>({
  type: '',
  title: '',
  html: '',
  chartBlock: null,
  tableBlock: null,
  evidence: null,
  tableHtml: '',
  tableText: '',
  leadingSummaryText: '',
  primaryViewKey: 'chart',
  tableViewKey: '',
})
const stoppedAssistantMessageIds = new Set<string>()
const latestFormFillOperation = ref<{
  assistantId: string
  operationId: string
  contextId: string
} | null>(null)

const getMessageFormFillOperation = (message: AiMessage) => {
  const value = message.metadata?.formFillOperation
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const operationId = String((value as Record<string, unknown>).operationId || '').trim()
  const contextId = String((value as Record<string, unknown>).contextId || '').trim()
  return operationId && contextId ? { operationId, contextId } : null
}

const canUndoMessageFormFill = (message: AiMessage) => {
  const operation = getMessageFormFillOperation(message)
  return Boolean(
    operation
    && latestFormFillOperation.value?.assistantId === message.id
    && latestFormFillOperation.value.operationId === operation.operationId
    && workbenchAiFormFillContext?.getSnapshot()?.contextId === operation.contextId,
  )
}

const handleUndoMessageFormFill = async (message: AiMessage) => {
  const operation = getMessageFormFillOperation(message)
  if (!operation || !workbenchAiFormFillContext) return
  const result = await workbenchAiFormFillContext.undoLatestFill(operation.operationId)
  latestFormFillOperation.value = null
  ensureMessageMetadata(message).formFillOperation = {
    ...operation,
    undone: true,
  }
  if (result.status === 'not_available') ElMessage.warning(result.summary)
  else ElMessage.success(result.summary)
}

const executeClientFormFillTool = async (
  streamState: AiThreadViewState,
  assistantMessage: AiMessage,
  data: AiChatStreamPayload,
) => {
  const conversationId = String(data.threadId || data.conversationId || streamState.threadId || '').trim()
  const callId = String(data.metadata?.toolCallId || '').trim()
  if (!conversationId || !callId) return

  const snapshot = workbenchAiFormFillContext?.getSnapshot() || null
  const expectedContextId = String(data.metadata?.formContextId || '').trim()
  const isCurrentContext = Boolean(snapshot)
    && (!expectedContextId || snapshot?.contextId === expectedContextId)
  const input = snapshot && isCurrentContext
    ? normalizeWorkbenchAiFormFillToolInput(data.metadata?.input, snapshot)
    : null
  let output: WorkbenchAiFormFillResult | undefined
  let error = ''
  if (!workbenchAiFormFillContext || !snapshot || !input) {
    error = !snapshot
      ? i18next.t('workbenchAiChat.noCurrentForm')
      : !isCurrentContext
        ? i18next.t('workbenchAiChat.formChanged')
        : i18next.t('workbenchAiChat.invalidFormFillFields')
  } else {
    try {
      output = await workbenchAiFormFillContext.applyFill(input)
      if (output.operationId) {
        ensureMessageMetadata(assistantMessage).formFillOperation = {
          operationId: output.operationId,
          contextId: output.contextId,
        }
        latestFormFillOperation.value = {
          assistantId: assistantMessage.id,
          operationId: output.operationId,
          contextId: output.contextId,
        }
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    }
  }

  await axios.post('/ai/threads/client-tool-result', {
    conversationId,
    callId,
    toolName: WORKBENCH_AI_FILL_CURRENT_FORM_TOOL,
    ok: Boolean(output),
    ...(output ? { output } : {}),
    ...(error ? { error } : {}),
    metadata: {
      executor: 'workbench-form-fill-context',
      contextId: snapshot?.contextId,
    },
  })
}
const {
  appOptions: handoffTargetAppOptions,
  appOptionsLoading: handoffTargetAppOptionsLoading,
  appOptionsLoadFailed: handoffTargetAppOptionsLoadFailed,
  ensureAppOptionsLoaded: ensureHandoffTargetAppOptionsLoaded,
  loadAppOptions: loadHandoffTargetAppOptions,
} = createAccessibleAppOptionsLoader(async () => {
  const { data } = await axios.get('/ai/threads/accessible-apps')
  return data
})
const preferredHandoffTargetApps = computed<HandoffPreferredApp[]>(() => {
  const handoff = pendingTargetAppSelectionHandoff.value
  if (!handoff) {
    return []
  }

  const preferredApps = new Map<string, HandoffPreferredApp>()
  const appendPreferredApp = (app?: HandoffPreferredApp | null) => {
    const id = String(app?.id || '').trim()
    const name = String(app?.name || '').trim()
    if (!id && !name) {
      return
    }

    const key = `${id}::${name}`
    if (!preferredApps.has(key)) {
      preferredApps.set(key, {
        ...(id ? { id } : {}),
        ...(name ? { name } : {}),
      })
    }
  }

  appendPreferredApp({
    id: handoff.targetApp?.appId,
    name: handoff.targetApp?.appName,
  })
  handoff.candidateApps?.forEach(app => {
    appendPreferredApp({
      id: app.appId,
      name: app.appName,
    })
  })

  return Array.from(preferredApps.values())
})
const filteredHandoffTargetAppSections = computed(() => {
  const keyword = targetAppSelectionSearchValue.value.trim().toLowerCase()
  const sections = buildHandoffTargetAppSections({
    appOptions: handoffTargetAppOptions.value,
    preferredApps: preferredHandoffTargetApps.value,
  })
  if (!keyword) {
    return sections
  }

  const matchesKeyword = (value: string) => value.toLowerCase().includes(keyword)
  return {
    ...sections,
    recommendedOptions: sections.recommendedOptions.filter(app => (
      matchesKeyword(app.name) || (app.id ? matchesKeyword(app.id) : false)
    )),
    remainingOptions: sections.remainingOptions.filter(app => (
      matchesKeyword(app.name) || matchesKeyword(app.id)
    )),
  }
})
const filteredRecommendedHandoffTargetAppOptions = computed<HandoffTargetAppRecommendation[]>(() => (
  filteredHandoffTargetAppSections.value.recommendedOptions
))
const filteredRemainingHandoffTargetAppOptions = computed(() => (
  filteredHandoffTargetAppSections.value.remainingOptions
))
const selectedTargetApp = computed(() => (
  handoffTargetAppOptions.value.find(app => app.id === selectedTargetAppId.value) || null
))
const clearAssistantPreviewChartRepaintFrames = () => {
  if (typeof window === 'undefined' || typeof window.cancelAnimationFrame !== 'function') {
    assistantPreviewChartRepaintFrame = null
    assistantPreviewChartRepaintFollowupFrame = null
    return
  }

  if (assistantPreviewChartRepaintFrame !== null) {
    window.cancelAnimationFrame(assistantPreviewChartRepaintFrame)
    assistantPreviewChartRepaintFrame = null
  }
  if (assistantPreviewChartRepaintFollowupFrame !== null) {
    window.cancelAnimationFrame(assistantPreviewChartRepaintFollowupFrame)
    assistantPreviewChartRepaintFollowupFrame = null
  }
}
const resetAssistantPreview = () => {
  clearAssistantPreviewChartRepaintFrames()
  assistantPreviewVisible.value = false
  assistantPreviewState.value = {
    type: '',
    title: '',
    html: '',
    chartBlock: null,
    tableBlock: null,
    evidence: null,
    tableHtml: '',
    tableText: '',
    leadingSummaryText: '',
    primaryViewKey: 'chart',
    tableViewKey: '',
  }
}
const queueAssistantPreviewChartRemount = () => {
  if (assistantPreviewState.value.type !== 'chart') {
    return
  }

  clearAssistantPreviewChartRepaintFrames()
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    assistantPreviewChartRenderKey.value += 1
    return
  }

  assistantPreviewChartRepaintFrame = window.requestAnimationFrame(() => {
    assistantPreviewChartRepaintFrame = null
    assistantPreviewChartRepaintFollowupFrame = window.requestAnimationFrame(() => {
      assistantPreviewChartRepaintFollowupFrame = null
      if (!assistantPreviewVisible.value || assistantPreviewState.value.type !== 'chart') {
        return
      }
      assistantPreviewChartRenderKey.value += 1
    })
  })
}
const resetSidebarComposer = () => {
  sidebarTextareaValue.value = ''
  sidebarAttachments.value = []
  editingUserMessageId.value = ''
  editingUserMessageDraft.value = ''
  editingUserMessageAttachments.value = []
}
const resetScrollBottomState = () => {
  isAtBottom.value = true
}
const normalizeAssistantMessageContent = (content: string) => {
  if (!passportState.account?.isAdmin) return content;
  return content.replaceAll(i18next.t('AiOpenaiService.insufficientPoints'), i18next.t('AiOpenaiService.rechargeLinkMarkdown'))
}
const renderAssistantMessage = (content: string) => markdown.render(normalizeAssistantMessageContent(content))
const isMarkdownRenderableItem = (item: AiAssistantRenderableItem): item is AiAssistantMarkdownRenderableItem => item.type === 'markdown'
const isChartRenderableItem = (item: AiAssistantRenderableItem): item is AiAssistantChartRenderableItem => (
  item.type === 'structured' && item.block.type === 'chart'
)
const isTableRenderableItem = (item: AiAssistantRenderableItem): item is AiAssistantTableRenderableItem => (
  item.type === 'structured' && item.block.type === 'table'
)
const handleAssistantRouteClick = (target: ShadowMarkdownRouteTarget) => {
  if (target.kind !== 'app_table') {
    return false
  }

  assistantDataViewState.value = {
    appId: target.appId,
    tableId: target.tableId,
    filterPath: target.filterPath,
    title: target.displayTitle || '',
  }
  assistantDataViewVisible.value = true
  return true
}

const assistantPreviewTitle = computed(() => (
  assistantPreviewState.value.title || i18next.t('WorkbenchAiChat.previewDrawerTitle')
))

const assistantPreviewChartBlock = computed<AiAssistantChartBlock | null>(() => {
  if (assistantPreviewState.value.type !== 'chart' || !assistantPreviewState.value.chartBlock) {
    return null
  }

  const block = assistantPreviewState.value.chartBlock
  const previewMinWidth = Number(block.minWidth || 0)

  return {
    ...block,
    height: Math.max(560, Math.min(760, Number(block.height || 320) + 220)),
    minWidth: previewMinWidth > 0 ? previewMinWidth : undefined,
    presentation: block.presentation,
  }
})

const assistantPreviewTableBlock = computed<AiAssistantTableBlock | null>(() => {
  if (assistantPreviewState.value.type !== 'table' || !assistantPreviewState.value.tableBlock) {
    return null
  }

  return assistantPreviewState.value.tableBlock
})

const handleAssistantTableExpand = (payload: ShadowMarkdownExpandedTablePayload) => {
  assistantPreviewState.value = {
    type: 'markdown',
    title: payload.title || i18next.t('WorkbenchAiChat.tablePreviewTitle'),
    html: payload.tableHtml,
    chartBlock: null,
    tableBlock: null,
    evidence: null,
    tableHtml: payload.tableHtml,
    tableText: '',
    leadingSummaryText: '',
    primaryViewKey: 'table',
    tableViewKey: '',
  }
  assistantPreviewVisible.value = true
}

const handleAssistantChartExpand = (payload: ChartExpandPayload) => {
  const block = payload.block
  assistantPreviewState.value = {
    type: 'chart',
    title: block.title || i18next.t('WorkbenchAiChat.chartPreviewTitle'),
    html: '',
    chartBlock: block,
    tableBlock: null,
    evidence: payload.evidence,
    tableHtml: '',
    tableText: '',
    leadingSummaryText: '',
    primaryViewKey: payload.primaryViewKey,
    tableViewKey: payload.tableViewKey,
  }
  assistantPreviewVisible.value = true
}

const handleAssistantStructuredTableExpand = (
  itemOrBlock: AiAssistantTableRenderableItem | AiAssistantTableBlock,
  payload: {
    title: string
    tableHtml: string
    tableText: string
    tableViewKey?: string
    evidence?: AiAnalysisEvidenceSummary | null
  },
) => {
  const previewContext = resolveAiAssistantStructuredTablePreviewContext(itemOrBlock, payload)
  assistantPreviewState.value = {
    type: 'table',
    title: previewContext.title || i18next.t('WorkbenchAiChat.tablePreviewTitle'),
    html: '',
    chartBlock: null,
    tableBlock: previewContext.block,
    evidence: previewContext.evidence,
    tableHtml: previewContext.tableHtml,
    tableText: previewContext.tableText,
    leadingSummaryText: previewContext.leadingSummaryText,
    primaryViewKey: 'table',
    tableViewKey: previewContext.tableViewKey,
  }
  assistantPreviewVisible.value = true
}
const handleAssistantPreviewOpened = () => {
  queueAssistantPreviewChartRemount()
}

const createMessageId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const normalizeIdList = (value?: string[] | null) => (
  Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : []
)
const normalizeOptionalIdList = (value?: string[] | null) => {
  const items = normalizeIdList(value)
  return items.length ? items : undefined
}
const normalizeAttachmentString = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || undefined
}
const normalizeAttachmentUploadHandle = (value: unknown) => {
  if (!isUnknownRecord(value)) {
    return undefined
  }

  const raw = value as Record<string, unknown>
  const id = normalizeAttachmentString(raw.id)
  const fullPath = normalizeAttachmentString(raw.fullPath)
  if (!id || !fullPath) {
    return undefined
  }

  return {
    id,
    fullPath,
    sessionId: normalizeAttachmentString(raw.sessionId),
    originFilePath: normalizeAttachmentString(raw.originFilePath),
  }
}
const normalizeSidebarAttachment = (value: unknown): AiComposerAttachment | null => {
  if (!isUnknownRecord(value)) {
    return null
  }

  const raw = value as Record<string, unknown>
  const normalizedReference = normalizeAiAttachmentReference({
    id: raw.id,
    name: raw.name,
    kind: raw.kind ?? inferAiAttachmentKind({
      fileName: raw.name,
      mimeType: raw.mimeType,
    }),
    mimeType: raw.mimeType,
    size: raw.size,
    extension: raw.extension,
    classification: raw.classification,
    remoteHandle: raw.remoteHandle,
  })

  if (!normalizedReference) {
    return null
  }

  const status = ['ready', 'uploading', 'error'].includes(String(raw.status || '').trim())
    ? String(raw.status || '').trim() as AiComposerAttachment['status']
    : 'ready'
  const source = ['local', 'uploaded'].includes(String(raw.source || '').trim())
    ? String(raw.source || '').trim() as AiComposerAttachment['source']
    : undefined

  return {
    ...normalizedReference,
    url: normalizeAttachmentString(raw.url),
    previewUrl: normalizeAttachmentString(raw.previewUrl),
    status,
    source,
    uploadHandle: normalizeAttachmentUploadHandle(raw.uploadHandle),
    ...(raw.file instanceof File ? { file: raw.file } : {}),
  }
}
const formatAttachmentSize = (size?: number) => {
  if (!Number.isFinite(Number(size)) || Number(size) <= 0) {
    return ''
  }

  const normalizedSize = Number(size)
  if (normalizedSize < 1024) {
    return `${normalizedSize} B`
  }
  if (normalizedSize < 1024 * 1024) {
    return `${(normalizedSize / 1024).toFixed(1)} KB`
  }
  return `${(normalizedSize / (1024 * 1024)).toFixed(1)} MB`
}
const buildSidebarAttachmentSummaryLines = (
  attachments: AiAttachmentReference[],
  attachmentIntent?: AiAttachmentIntentHint,
) => {
  if (!attachments.length) {
    return []
  }

  const summaryLines = attachments.map((attachment) => {
    const sizeLabel = formatAttachmentSize(attachment.size)
    return sizeLabel
      ? `${attachment.name} (${sizeLabel})`
      : attachment.name
  })

  if (attachmentIntent) {
    const summary = attachmentIntent.summary || buildAiAttachmentIntentSummary(attachmentIntent)
    if (summary) {
      summaryLines.push(summary)
    }
  }

  return summaryLines
}
const buildWorkbenchAttachmentRequestMetadata = (
  text: string,
  attachments: AiComposerAttachment[],
): AiRequestAttachmentMetadata | null => {
  const attachmentReferences = attachments
    .map(item => normalizeAiAttachmentReference(item))
    .filter(Boolean) as AiAttachmentReference[]

  if (!attachmentReferences.length) {
    return null
  }

  const attachmentIntent = resolveAiAttachmentIntent({
    text,
    attachments: attachmentReferences,
    generalAttachmentsDefaultToAnalyze: true,
  })
  const baseMetadata = buildAiAttachmentMessageMetadata(attachmentReferences, attachmentIntent)
  const summaryLines = buildSidebarAttachmentSummaryLines(attachmentReferences, attachmentIntent)
  const summaryText = summaryLines.join('\n')
  const userFacingContent = text.trim() || buildAiAttachmentFallbackRequestText(attachmentIntent)
  const providerPromptContent = [
    userFacingContent,
    ...buildAiAttachmentPromptLines(baseMetadata),
  ].filter(Boolean).join('\n\n')

  return {
    ...baseMetadata,
    attachmentSummary: summaryText,
    attachmentSummaryLines: summaryLines,
    userFacingContent,
    providerPromptContent,
  }
}

const buildWorkbenchExcelAnalysisFollowupMetadata = (
  text: string,
  options?: {
    baseMetadata?: AiMessageMetadata | null
    state?: AiThreadViewState
  },
): AiMessageMetadata | null => {
  const state = options?.state || currentViewState.value
  const context = state.activeExcelAnalysisContext || null
  if (!context) {
    return options?.baseMetadata || null
  }

  const trimmedText = String(text || '').trim()
  if (!trimmedText) {
    return options?.baseMetadata || null
  }

  const followupBehavior = resolveAiExcelAnalysisFollowupBehavior({
    context,
    baseRequestMetadata: options?.baseMetadata || null,
    disableToolFlag: 'disableBuiltinAppTools',
    userFacingContent: trimmedText,
  })
  if (!followupBehavior || followupBehavior.mode !== 'continue-analysis') {
    return options?.baseMetadata || null
  }

  return followupBehavior.requestPayload.requestMetadata as AiMessageMetadata
}

const {
  activeAssistantMessageId,
  activeExcelAnalysisContext,
  activeStreamState,
  activeStreamStateKey,
  curAiMessageList,
  currentAgentId,
  currentThreadAppIds,
  currentThreadId,
  currentThreadModel,
  currentThreadModelId,
  currentThreadModelSelectionSource,
  currentThreadProviderId,
  currentThreadShareToken,
  currentThreadSharing,
  currentViewState,
  ensureThreadViewState,
  hasMoreHistory,
  isAssistantResponding,
  isInitialLoading,
  isLoadingHistory,
  messageOffset,
  normalizeThreadStateKey,
  resetThreadViewState,
  resolveActiveStreamViewState,
  resolveShareVisitorMetadata,
  switchCurrentThreadState,
  syncCurrentThread,
  syncThreadViewState,
  updateThreadViewStateId,
} = useAiThreadViewState({
  emitThreadChange: (threadId) => emit('thread-change', threadId),
  normalizeIdList,
})

const resolveRouteNocodeIds = () => {
  const nocodeId = String(route.params.nocodeId || '').trim()
  return nocodeId ? [nocodeId] : []
}

const completedExcelCreateAttachmentIds = computed(() => (
  collectAiExcelCreateCompletionAttachmentIds(curAiMessageList.value)
))

const setPendingCreateRouteExcelSource = (traceId: string, source: ReturnType<typeof resolveAiExcelImportSourceInstance>) => {
  const normalizedTraceId = String(traceId || '').trim()
  if (!normalizedTraceId || !source) {
    return
  }

  currentViewState.value.pendingCreateRouteExcelByTraceId = {
    ...currentViewState.value.pendingCreateRouteExcelByTraceId,
    [normalizedTraceId]: source,
  }
}

const clearPendingCreateRouteExcelSource = (traceId?: string | null) => {
  const normalizedTraceId = String(traceId || '').trim()
  if (!normalizedTraceId || !currentViewState.value.pendingCreateRouteExcelByTraceId[normalizedTraceId]) {
    return
  }

  const nextPendingMap = {
    ...currentViewState.value.pendingCreateRouteExcelByTraceId,
  }
  delete nextPendingMap[normalizedTraceId]
  currentViewState.value.pendingCreateRouteExcelByTraceId = nextPendingMap
}

const resolvePendingCreateRouteExcelSource = (traceId?: string | null) => {
  const normalizedTraceId = String(traceId || '').trim()
  return normalizedTraceId
    ? currentViewState.value.pendingCreateRouteExcelByTraceId[normalizedTraceId] || null
    : null
}

const resolveRequestNocodeIds = () => {
  const appIds = normalizeIdList(currentThreadAppIds.value)
  if (appIds.length) {
    return appIds
  }
  const routeNocodeIds = resolveRouteNocodeIds()
  return routeNocodeIds.length ? routeNocodeIds : undefined
}

const activeAttachmentUploadNocodeId = computed(() => {
  const requestNocodeIds = resolveRequestNocodeIds()
  return String(requestNocodeIds?.[0] || '').trim()
})

const ensureExcelAnalysisDialogReady = async () => {
  if (excelAnalysisDialogReady.value) {
    return
  }
  excelAnalysisDialogReady.value = true
  await nextTick()
}

const modelSelectorOptions = computed(() => aiConfigStore.modelOptions
  .filter(option => passportState.isLoginUser || option.providerId !== BUILTIN_AI_PROVIDER_ID)
  .map(option => {
    const catalogItem = aiConfigStore.catalog.items.find(item => (
      item.providerId === option.providerId && item.modelId === option.modelId
    ))
    return {
      ...option,
      label: catalogItem?.displayName || option.label,
      groupLabel: catalogItem?.providerName || i18next.t('WorkbenchAiChatInput.otherModelGroup'),
      groupKey: `provider:${option.providerId || 'other'}`,
    }
  }))
const firstExplicitModelOption = computed(() => (
  modelSelectorOptions.value.find(item => item.modelSelectionSource === 'explicit') || null
))
const resolveSavedModelOption = (state: AiThreadViewState = currentViewState.value) => {
  if (state.modelSelectionSource !== 'explicit' && state.modelSelectionSource !== 'default') {
    return null
  }
  const providerId = state.providerId || (
    state.modelSelectionSource === 'default' ? aiConfigStore.catalog.defaultProviderId : ''
  )
  const modelId = state.modelId || (
    state.modelSelectionSource === 'default' ? aiConfigStore.catalog.defaultModelId : ''
  )
  const model = state.model || ''
  if (!providerId && !modelId && !model) {
    return null
  }
  return modelSelectorOptions.value.find(option => (
    (!providerId || option.providerId === providerId)
    && (modelId ? option.modelId === modelId : (!model || option.model === model))
  )) || null
}
const savedModelOption = computed(() => (
  resolveSavedModelOption(currentViewState.value)
))
const temporaryFallbackModelOption = computed(() => (
  savedModelOption.value ? null : firstExplicitModelOption.value
))
const effectiveModelOption = computed(() => (
  savedModelOption.value || temporaryFallbackModelOption.value
))
const hasExternalModelOption = computed(() => modelSelectorOptions.value.some(item => (
  item.modelSelectionSource === 'explicit' && item.providerId !== BUILTIN_AI_PROVIDER_ID
)))
const selectedModelValue = computed(() => resolveThreadModelSelectorValue(
  effectiveModelOption.value?.modelSelectionSource,
  effectiveModelOption.value,
))
const allowModelSelection = computed(() => (
  !props.isSharePage
  && !props.readonly
  && aiConfigStore.catalog.enabled
  && aiConfigStore.catalog.allowModelSelection
))
const showModelSelector = computed(() => allowModelSelection.value)
const showAdminLoginPrompt = computed(() => (
  passportState.isLoginAccount && !passportState.isMainAccount
))
const showLoginPrompt = computed(() => (
  !props.isSharePage
  && !aiConfigStore.catalogLoading
  && (!passportState.isLoginUser || showAdminLoginPrompt.value)
  && !hasExternalModelOption.value
))
const selectedModelOption = computed(() => (
  effectiveModelOption.value
))
const hasSendableModel = computed(() => Boolean(selectedModelOption.value))
const currentModelLabel = computed(() => (
  selectedModelOption.value?.label || ''
))
const modelSelectionChangeTokens = new Map<string, number>()
const modelSelectionSaveRequests = new Map<string, Promise<AiThreadModelSelection>>()

const showNoAvailableModelMessage = () => {
  ElMessage.warning(i18next.t('workbenchAiChat.noAvailableModel'))
}
const canSubmitAiMessage = () => {
  if (props.isSharePage || props.readonly) return true
  if (aiConfigStore.catalogLoading) return false
  if (hasSendableModel.value) return true
  showNoAvailableModelMessage()
  return false
}

const handleLoginClick = () => {
  dialogState.show('loginDialogVisible')
}

const handleOtherOptionsClick = () => {
  router.push({
    name: 'Organize',
    query: { tab: 'aiModelManage' },
  })
}

const normalizeConversationProfile = (value?: string | null): AiConversationProfile | '' => (
  ['records_query', 'cross_app_compare', 'cross_app_merge', 'cross_app_unresolved'].includes(String(value || '').trim())
    ? String(value || '').trim() as AiConversationProfile
    : ''
)

const applyModelSelectionToState = (
  value: { providerId?: string; modelId?: string; model?: string } | null | undefined,
  state: AiThreadViewState = currentViewState.value,
  source: AiThreadViewState['modelSelectionSource'] = 'explicit',
) => {
  applyThreadModelSelectionState(state, value, source)
}

const ensureDraftModelSelection = (state: AiThreadViewState = currentViewState.value) => {
  ensureDraftThreadModelSelectionState(state)
}

const buildEffectiveThreadModelSelectionRequest = (
  state: AiThreadViewState = currentViewState.value,
) => {
  const effectiveModel = resolveSavedModelOption(state) || firstExplicitModelOption.value
  return effectiveModel
    ? {
      providerId: effectiveModel.providerId,
      modelId: effectiveModel.modelId,
      model: effectiveModel.model,
    }
    : buildThreadModelSelectionRequest(state)
}

const applyFirstExplicitModelSelection = (state: AiThreadViewState = currentViewState.value) => {
  if (
    String(state.threadId || '').trim()
    || state.providerId
    || state.modelId
    || state.model
  ) {
    return
  }
  const option = firstExplicitModelOption.value
  if (option) {
    applyModelSelectionToState(option, state, 'explicit')
  }
}

const applyConversationProfileToState = (
  profile?: string | null,
  state: AiThreadViewState = currentViewState.value,
) => {
  const normalizedProfile = normalizeConversationProfile(profile)
  if (!state.runtimeState && !normalizedProfile) {
    return
  }
  state.runtimeState = {
    ...(state.runtimeState || {}),
    currentProfile: normalizedProfile || undefined,
  }
}

const resetMessageHistoryState = (state: AiThreadViewState = currentViewState.value) => {
  state.messageOffset = 0
  state.hasMoreHistory = false
  state.isLoadingHistory = false
}

const increaseMessageOffset = (count = 1, state: AiThreadViewState = currentViewState.value) => {
  if (count <= 0) return
  state.messageOffset += count
}

const decreaseMessageOffset = (count = 1, state: AiThreadViewState = currentViewState.value) => {
  if (count <= 0) return
  state.messageOffset = Math.max(0, state.messageOffset - count)
}

const findMessageById = (messageId: string, state: AiThreadViewState = currentViewState.value) => (
  state.messages.find(message => message.id === messageId)
)

const syncAuthoritativeUserMessageId = (state: AiThreadViewState, traceId: string, messageId: string) => {
  const normalizedTraceId = String(traceId || '').trim()
  const normalizedMessageId = String(messageId || '').trim()
  if (!normalizedTraceId || !normalizedMessageId || findMessageById(normalizedMessageId, state)) {
    return
  }
  const message = state.messages.find(item => (
    item.role === AiMessageRole.USER
    && String(item.traceId || item.metadata?.traceId || '').trim() === normalizedTraceId
  ))
  if (message) {
    message.id = normalizedMessageId
  }
}

const removeMessageById = (
  messageId: string,
  options?: { countOffset?: boolean },
  state: AiThreadViewState = currentViewState.value,
) => {
  const messageIndex = state.messages.findIndex(message => message.id === messageId)
  if (messageIndex !== -1) {
    state.messages.splice(messageIndex, 1)
    if (options?.countOffset) {
      decreaseMessageOffset(1, state)
    }
  }
}

const ensureAssistantMessage = (
  assistantId: string,
  options?: { countOffset?: boolean; traceId?: string },
  state: AiThreadViewState = currentViewState.value,
) => {
  const message = findMessageById(assistantId, state)
  if (message) {
    if (options?.traceId) {
      const metadata = ensureMessageMetadata(message)
      metadata.traceId = options.traceId
      message.traceId = options.traceId
    }
    return message
  }

  const assistantMessage: AiMessage = {
    id: assistantId,
    role: AiMessageRole.ASSISTANT,
    content: getAssistantThinkingText(),
    createTime: Date.now(),
    traceId: options?.traceId || undefined,
    metadata: {
      traceId: options?.traceId || undefined,
      toolCalls: [],
      toolCallGroups: [],
      interimTexts: [],
    },
  }
  state.messages.push(assistantMessage)
  if (options?.countOffset) {
    increaseMessageOffset(1, state)
  }
  return assistantMessage
}

const clearThinkingText = (message?: AiMessage) => {
  if (message && message.content === getAssistantThinkingText()) {
    message.content = ''
  }
}

const ensureMessageMetadata = (message: AiMessage) => {
  if (!message.metadata || typeof message.metadata !== 'object' || Array.isArray(message.metadata)) {
    message.metadata = {}
  }
  return message.metadata
}

const ensureMessageToolCalls = (message: AiMessage) => {
  const metadata = ensureMessageMetadata(message)
  if (!Array.isArray(metadata.toolCalls)) {
    metadata.toolCalls = []
  }
  return metadata.toolCalls as AiToolCallTrace[]
}

const ensureMessageToolCallGroups = (message: AiMessage) => {
  const metadata = ensureMessageMetadata(message)
  if (!Array.isArray(metadata.toolCallGroups)) {
    metadata.toolCallGroups = []
  }
  return metadata.toolCallGroups as AiToolCallGroupTrace[]
}

const ensureMessageInterimTexts = (message: AiMessage) => {
  const metadata = ensureMessageMetadata(message)
  if (!Array.isArray(metadata.interimTexts)) {
    metadata.interimTexts = []
  }
  return metadata.interimTexts as AiInterimTextTrace[]
}

const getMessageDevDiagnostics = (message?: AiMessage) => {
  const value = message?.metadata?.devDiagnostics
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as AiTurnDiagnostics
}

const normalizeRenderableInterimText = (text?: string) => {
  const normalized = normalizeInterimText(String(text || ''))
  if (!normalized || isLikelyToolProtocolText(normalized)) {
    return ''
  }
  return normalized
}

const getMessagePendingInterimText = (message?: AiMessage) => {
  const value = message?.metadata?.pendingInterimText
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const text = String(value.text || '')
  if (!text.trim()) {
    return null
  }

  return {
    id: String(value.id || '').trim() || createMessageId('assistant-delta'),
    text,
    round: Number(value.round || 0) || undefined,
    startLength: Math.max(0, Number(value.startLength || 0)),
  }
}

const setMessagePendingInterimText = (
  message: AiMessage,
  value: { id: string; text: string; round?: number; startLength: number } | null,
) => {
  const metadata = ensureMessageMetadata(message)
  if (!value || !String(value.text || '').trim()) {
    delete metadata.pendingInterimText
    return
  }
  metadata.pendingInterimText = {
    id: value.id,
    text: value.text,
    round: value.round,
    startLength: Math.max(0, Number(value.startLength || 0)),
  }
}

const getMessageToolCalls = (message?: AiMessage) => (
  Array.isArray(message?.metadata?.toolCalls)
    ? message?.metadata?.toolCalls as AiToolCallTrace[]
    : []
)

const getMessageVisibleToolCalls = (message?: AiMessage) => (
  getMessageToolCalls(message).filter(call => call.displayHidden !== true)
)

const shouldRenderAssistantDevDiagnostics = (message?: AiMessage) => (
  isDevelopmentMode && Boolean(getMessageDevDiagnostics(message))
)

const resolveToolCallDisplayName = (call: AiToolCallTrace) => {
  const displayName = String(call.displayName || '').trim()
  if (displayName) {
    return displayName
  }

  const toolName = String(call.name || '').trim()
  if (toolName === 'read_app_data') {
    return resolveReadAppDataDisplayName(call.input)
  }
  return TOOL_NAME_LABEL_MAP[toolName] || toolName || i18next.t('WorkbenchAiChat.unknownTool')
}

const resolveToolCallDisplayStatus = (call: AiToolCallTrace): AiToolDisplayStatus => {
  const displayStatus = String(call.displayStatus || '').trim()
  if (displayStatus === 'running' || displayStatus === 'success' || displayStatus === 'error' || displayStatus === 'skipped') {
    return displayStatus
  }
  if (call.policyBlocked) return 'skipped'
  if (call.ok === true) return 'success'
  if (call.ok === false) return 'error'
  return 'running'
}

const resolveToolCallDisplayStatusText = (call: AiToolCallTrace) => (
  TOOL_STATUS_TEXT_MAP[resolveToolCallDisplayStatus(call)]
)

const formatToolCallDuration = (durationMs?: number) => {
  if (!Number.isFinite(Number(durationMs)) || Number(durationMs) < 0) {
    return '--'
  }
  return `${Math.round(Number(durationMs))}ms`
}

const getMessageToolCallGroups = (message?: AiMessage) => {
  const groups = Array.isArray(message?.metadata?.toolCallGroups)
    ? message?.metadata?.toolCallGroups as AiToolCallGroupTrace[]
    : []

  if (groups.length) {
    return groups
  }

  const calls = getMessageToolCalls(message)
  if (!calls.length) {
    return []
  }

  return [{
    id: `tool-group-fallback-${message?.id || 'message'}`,
    callIds: calls.map(call => call.id),
    timeline: calls.map(call => ({
      id: `tool-group-fallback-item-${call.id}`,
      type: 'tool-call' as const,
      refId: call.id,
    })),
    closed: true,
  }]
}

const resolveToolCallGroupCalls = (message: AiMessage, group: AiToolCallGroupTrace) => {
  const calls = getMessageToolCalls(message)
  if (!group.callIds.length) {
    return calls
  }

  const callMap = new Map(calls.map(call => [call.id, call]))
  return group.callIds
    .map(callId => callMap.get(callId))
    .filter((call): call is AiToolCallTrace => Boolean(call))
}

const getMessageInterimTexts = (message?: AiMessage) => (
  Array.isArray(message?.metadata?.interimTexts)
    ? (message?.metadata?.interimTexts as AiInterimTextTrace[])
      .map(item => {
        const text = normalizeRenderableInterimText(item?.text)
        return text
          ? {
              ...item,
              text,
            }
          : null
      })
      .filter((item): item is AiInterimTextTrace => Boolean(item))
    : []
)

const resolveRenderableAssistantContent = (message?: AiMessage) => {
  if (!message) {
    return ''
  }

  const content = String(message.content || '')
  if (!content || content === getAssistantThinkingText()) {
    return ''
  }

  const pendingInterimText = getMessagePendingInterimText(message)
  const pendingInterimHasToolCall = pendingInterimText
    && getMessageToolCalls(message).some(call => (
      !pendingInterimText.round
      || Number(call.round || 0) === Number(pendingInterimText.round)
    ))
  if (
    pendingInterimText
    && pendingInterimHasToolCall
    && pendingInterimText.startLength <= content.length
    && content.slice(pendingInterimText.startLength, pendingInterimText.startLength + pendingInterimText.text.length) === pendingInterimText.text
  ) {
    return content.slice(0, pendingInterimText.startLength)
  }

  return content
}

const resolveAssistantMessageBlocks = (message?: AiMessage) => {
  if (!message) {
    return [] as AiAssistantMessageBlock[]
  }

  const metadataBlocks = resolveAiAssistantMessageBlocks(message.metadata?.blocks)
  if (metadataBlocks.length) {
    return metadataBlocks
  }

  const renderableContent = resolveRenderableAssistantContent(message)
  if (!renderableContent) {
    return [] as AiAssistantMessageBlock[]
  }

  return parseAiAssistantMessageContent(renderableContent).blocks
}

const resolveAssistantRenderableBlocks = (message?: AiMessage): AiAssistantRenderableItem[] => (
  groupAiAssistantRenderableBlocks(resolveAssistantMessageBlocks(message))
)

const hasRenderableAssistantBlocks = (message?: AiMessage) => (
  resolveAssistantRenderableBlocks(message).length > 0
)

const getMessageAppBuilderHandoff = (message?: AiMessage): WorkbenchAiAppBuilderHandoffPreview | null => {
  const preview = normalizeWorkbenchAppBuilderHandoffPreview(message?.metadata?.appBuilderHandoff)
  if (!preview || preview.actionType !== 'app-builder-handoff') {
    return null
  }
  return preview
}

const getMessageAppBuilderHandoffIssue = (message?: AiMessage): WorkbenchAiAppBuilderHandoffIssuePreview | null => {
  const issue = normalizeWorkbenchAppBuilderHandoffIssue(message?.metadata?.appBuilderHandoffIssue)
  if (!issue || issue.actionType !== 'app-builder-handoff-issue') {
    return null
  }
  return issue
}

const isUnknownRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeHandoffResponsePayload = (value: unknown) => {
  if (isUnknownRecord(value)) {
    const raw = value
    return raw.handoff || raw.appBuilderHandoff || raw
  }
  return value
}

const replaceMessageHandoffPreview = (value: unknown) => {
  const preview = normalizeWorkbenchAppBuilderHandoffPreview(normalizeHandoffResponsePayload(value))
  if (!preview) {
    return
  }

  curAiMessageList.value.forEach(message => {
    const currentPreview = normalizeWorkbenchAppBuilderHandoffPreview(message.metadata?.appBuilderHandoff)
    if (currentPreview?.handoffId !== preview.handoffId) {
      return
    }
    const metadata = ensureMessageMetadata(message)
    metadata.appBuilderHandoff = preview
  })
}

const getCopyableMessageContent = (message?: AiMessage) => {
  if (!message) {
    return ''
  }
  if (message.role === AiMessageRole.ASSISTANT) {
    return resolveAiAssistantMessageText(resolveRenderableAssistantContent(message), message.metadata?.blocks)
  }
  return String(message.content || '')
}

const hasExcelAttachmentHandle = (attachment: AiAttachmentReference) => (
  hasAiAttachmentUploadHandle(attachment)
  || Boolean(String(attachment.remoteHandle?.attachmentId || '').trim())
)

const isExcelAttachmentExpired = (attachment: AiAttachmentReference) => !hasExcelAttachmentHandle(attachment)

const getMessageTraceId = (message?: AiMessage) => (
  String(message?.traceId || message?.metadata?.traceId || '').trim()
)

const isEditedResendAssistantMessage = (
  message: AiMessage | undefined,
  state: AiThreadViewState,
  traceId?: string,
) => {
  const normalizedTraceId = getMessageTraceId(message) || String(traceId || '').trim()
  if (!normalizedTraceId) {
    return false
  }
  return state.messages.some(item => (
    item.role === AiMessageRole.USER
    && getMessageTraceId(item) === normalizedTraceId
    && Boolean(String(item.metadata?.editedFromMessageId || '').trim())
  ))
}

const findLatestAssistantHandoffByTraceId = (
  traceId?: string | null,
): WorkbenchAiAppBuilderHandoffPreview | null => {
  const normalizedTraceId = String(traceId || '').trim()
  if (!normalizedTraceId) {
    return null
  }

  for (let index = curAiMessageList.value.length - 1; index >= 0; index -= 1) {
    const message = curAiMessageList.value[index]
    if (message.role !== AiMessageRole.ASSISTANT) {
      continue
    }
    if (getMessageTraceId(message) !== normalizedTraceId) {
      continue
    }

    const handoff = getMessageAppBuilderHandoff(message)
    if (handoff) {
      return handoff
    }
  }

  return null
}

const shouldHideUserExcelAttachment = (
  message: AiMessage | undefined,
  attachment: AiAttachmentReference,
) => {
  const traceId = getMessageTraceId(message)
  const handoff = findLatestAssistantHandoffByTraceId(traceId)
  if (!handoff?.excelAttachment) {
    const pendingCreateRouteExcelSource = resolvePendingCreateRouteExcelSource(traceId)
    if (!pendingCreateRouteExcelSource) {
      return false
    }

    const attachmentSource = resolveAiExcelImportSourceInstance(attachment.uploadHandle)
    return isSameAiExcelImportSourceInstance(attachmentSource, pendingCreateRouteExcelSource)
  }

  const attachmentSource = resolveAiExcelImportSourceInstance(attachment.uploadHandle)
  const handoffAttachmentSource = resolveAiExcelImportSourceInstance(handoff.excelAttachment.uploadHandle)
  return isSameAiExcelImportSourceInstance(attachmentSource, handoffAttachmentSource)
}

const getUserAttachments = (message?: AiMessage): AiAttachmentReference[] => {
  if (!message || message.role !== AiMessageRole.USER) {
    return []
  }
  const metadata = message.metadata || {}
  return Array.isArray(metadata.attachments)
    ? metadata.attachments
      .map(item => normalizeAiAttachmentReference(item))
      .filter((item): item is AiAttachmentReference => Boolean(item))
    : []
}

const getUserExcelAttachments = (message?: AiMessage) => (
  getUserAttachments(message).filter(item => item.kind === 'excel')
)

const getUserGeneralAttachments = (message?: AiMessage) => (
  getUserAttachments(message).filter(item => item.kind !== 'excel')
)

const getAttachmentContentUrl = (attachment: AiAttachmentReference) => {
  const attachmentId = String(attachment.remoteHandle?.attachmentId || '').trim()
  return !props.isSharePage && currentThreadId.value && attachmentId
    ? `/ai/threads/${currentThreadId.value}/attachments/${attachmentId}/content`
    : undefined
}

const getVisibleUserExcelAttachments = (message?: AiMessage): AiAttachmentReference[] => (
  getUserExcelAttachments(message).filter(attachment => !shouldHideUserExcelAttachment(message, attachment))
)

const isSupersededMessage = (message?: AiMessage | null) => Boolean(message?.metadata?.supersededAt)

const getLastVisibleUserMessage = () => {
  for (let index = curAiMessageList.value.length - 1; index >= 0; index -= 1) {
    const message = curAiMessageList.value[index]
    if (message.role === AiMessageRole.USER && !isSupersededMessage(message)) {
      return message
    }
  }
  return null
}

const canEditUserMessage = (message: AiMessage) => (
  !props.readonly
  && !props.isSharePage
  && !isAssistantResponding.value
  && message.role === AiMessageRole.USER
  && !isSupersededMessage(message)
  && getLastVisibleUserMessage()?.id === message.id
)

const removeTurnMessagesByTraceId = (traceId?: string | null) => {
  const normalizedTraceId = String(traceId || '').trim()
  if (!normalizedTraceId) {
    return
  }
  currentViewState.value.messages = currentViewState.value.messages.filter(message => (
    String(message.traceId || message.metadata?.traceId || '').trim() !== normalizedTraceId
  ))
}

const resetInlineEditUserMessage = () => {
  editingUserMessageId.value = ''
  editingUserMessageDraft.value = ''
  editingUserMessageAttachments.value = []
}

const cancelEditUserMessage = () => {
  resetInlineEditUserMessage()
}

const focusInlineEditTextarea = async () => {
  await nextTick()
  const textarea = Array.isArray(inlineEditTextareaRef.value)
    ? inlineEditTextareaRef.value[0]
    : inlineEditTextareaRef.value
  textarea?.focus()
  textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
}

const handleEditUserMessage = async (message: AiMessage) => {
  if (!canEditUserMessage(message)) {
    return
  }
  const messageAttachments = getUserAttachments(message)
  const attachments = messageAttachments
    .map(attachment => (
      cloneAiExcelAttachmentForComposer(attachment)
      || normalizeSidebarAttachment({ ...attachment, source: 'uploaded', status: 'ready' })
    ))
    .filter(Boolean) as AiComposerAttachment[]
  if (attachments.length < messageAttachments.length) {
    ElMessage.warning(i18next.t('workbenchAiChat.someAttachmentsExpiredUploadAgain'))
  }
  editingUserMessageId.value = message.id
  editingUserMessageDraft.value = message.content || ''
  editingUserMessageAttachments.value = replaceSidebarExcelAttachment(attachments)
  await focusInlineEditTextarea()
}

const replaceSidebarExcelAttachment = (attachments: AiComposerAttachment[]) => attachments

const handleSidebarAttachmentSelect = (payload: AiComposerAttachmentEventPayload) => {
  const attachments = Array.isArray(payload?.attachments)
    ? payload.attachments
      .map(item => normalizeSidebarAttachment(item))
      .filter(Boolean) as AiComposerAttachment[]
    : []

  if (!attachments.length) {
    const attachment = normalizeSidebarAttachment(payload?.attachment)
    if (!attachment) {
      return
    }
    sidebarAttachments.value = replaceSidebarExcelAttachment([
      ...sidebarAttachments.value.filter(item => item.id !== attachment.id),
      attachment,
    ])
    return
  }
  sidebarAttachments.value = replaceSidebarExcelAttachment(attachments)
}

const handleSidebarAttachmentRemove = (payload: AiComposerAttachmentEventPayload) => {
  const attachments = Array.isArray(payload?.attachments)
    ? payload.attachments
      .map(item => normalizeSidebarAttachment(item))
      .filter(Boolean) as AiComposerAttachment[]
    : null

  if (attachments) {
    sidebarAttachments.value = attachments
    return
  }

  const attachmentId = String(payload?.attachment?.id || '').trim()
  if (!attachmentId) {
    return
  }

  sidebarAttachments.value = sidebarAttachments.value.filter(item => item.id !== attachmentId)
}

const resolveExcelCreateAttachmentFromComposer = (
  attachments: AiComposerAttachment[],
): AiAttachmentReference | null => {
  const excelAttachments = attachments
    .map(item => normalizeAiAttachmentReference(item))
    .filter(item => item?.kind === 'excel' && hasExcelAttachmentHandle(item)) as AiAttachmentReference[]
  return excelAttachments.length === 1 ? excelAttachments[0] : null
}

const prepareExcelCreatePayload = async (attachment: AiAttachmentReference) => {
  const remoteAttachmentId = String(attachment.remoteHandle?.attachmentId || '').trim()
  if (remoteAttachmentId && currentThreadId.value) {
    try {
      const response = await axios.post(
        `/ai/threads/${currentThreadId.value}/attachments/${remoteAttachmentId}/import-session`,
      )
      const fullPath = String(response?.data?.data?.fullPath || '').trim()
      if (!fullPath) throw new Error(i18next.t('workbenchAiChat.fileExpiredUploadAgain'))
      return {
        fullPath,
        sessionId: String(response?.data?.data?.sessionId || '').trim() || undefined,
        name: String(attachment.name || '').trim() || undefined,
        formName: stripAiAttachmentFileExtension(attachment.name) || undefined,
      }
    } catch (error) {
      ElMessage.error(resolveErrorMessage(error, i18next.t('workbenchAiChat.prepareExcelFailed')))
      return null
    }
  }

  const importSourcePath = resolveAiAttachmentImportSourcePath(attachment)
  if (!importSourcePath) {
    ElMessage.warning(i18next.t('workbenchAiChat.fileExpiredUploadAgain'))
    return null
  }

  try {
    const response = await axios.post('/nocode/create-import-session-from-path', {
      fullPath: importSourcePath,
      filename: String(attachment.name || '').trim() || undefined,
    })
    const fullPath = String(response?.data?.data?.fullPath || '').trim()
    if (!fullPath) {
      ElMessage.warning(i18next.t('workbenchAiChat.fileExpiredUploadAgain'))
      return null
    }

    return {
      fullPath,
      sessionId: String(response?.data?.data?.sessionId || '').trim() || undefined,
      name: String(attachment.name || '').trim() || undefined,
      formName: stripAiAttachmentFileExtension(attachment.name) || undefined,
    }
  } catch (error) {
    ElMessage.error(String(error?.response?.data?.message || error?.message || i18next.t('workbenchAiChat.prepareExcelFailed')))
    return null
  }
}

const isHistoryAttachmentCreateDisabled = (attachment: AiAttachmentReference) => (
  completedExcelCreateAttachmentIds.value.has(String(attachment.id || '').trim())
)

const openExcelCreateDialogFromAttachment = async (attachment: AiAttachmentReference) => {
  if (!hasExcelAttachmentHandle(attachment)) {
    ElMessage.warning(i18next.t('workbenchAiChat.fileExpiredUploadAgain'))
    return false
  }

  const preparedPayload = await prepareExcelCreatePayload(attachment)
  if (!preparedPayload?.fullPath) {
    return false
  }

  await ensureExcelAnalysisDialogReady()
  excelAnalysisDialogRef.value?.setFormInfo(preparedPayload.formName || String(attachment.name || '').trim(), '')
  excelAnalysisDialogVisible.value = true
  await nextTick()
  const prefillResult = await excelAnalysisDialogRef.value?.prefillUploadedExcel?.({
    fullPath: preparedPayload.fullPath,
    sessionId: preparedPayload.sessionId,
    name: preparedPayload.name,
    formName: preparedPayload.formName,
  }) || false
  return prefillResult
}

const handleCreateFormFromHistoryAttachment = async (attachment: AiAttachmentReference) => {
  await openExcelCreateDialogFromAttachment(attachment)
}

const handleAddHistoryAttachmentToComposer = (attachment: AiAttachmentReference) => {
  if (!hasExcelAttachmentHandle(attachment)) {
    ElMessage.warning(i18next.t('workbenchAiChat.fileExpiredUploadAgain'))
    return
  }

  const clonedAttachment = cloneAiExcelAttachmentForComposer(attachment)
    || normalizeSidebarAttachment({ ...attachment, source: 'uploaded', status: 'ready' })
  if (!clonedAttachment) {
    ElMessage.warning(i18next.t('workbenchAiChat.fileExpiredUploadAgain'))
    return
  }
  const normalizedAttachment = normalizeSidebarAttachment(clonedAttachment)
  if (!normalizedAttachment) {
    return
  }

  sidebarAttachments.value = replaceSidebarExcelAttachment([
    ...sidebarAttachments.value.filter(item => item.id !== normalizedAttachment.id),
    normalizedAttachment,
  ])
}

const handleExcelDialogClosed = () => {}

const shouldShowAssistantThinking = (message: AiMessage) => {
  if (message.metadata?.contextCompaction?.status === 'running') {
    return true
  }
  if (message.content === getAssistantThinkingText()) {
    return true
  }

  return (
    isAssistantResponding.value
    && activeAssistantMessageId.value === message.id
    && !resolveRenderableAssistantContent(message).trim()
    && getMessageToolCalls(message).length > 0
  )
}

const getAssistantStatusText = (message: AiMessage) => (
  message.metadata?.contextCompaction?.status === 'running'
    ? i18next.t('WorkbenchAiChat.contextCompactionRunning')
    : getAssistantThinkingText()
)

const shouldRenderAssistantProcess = (message?: AiMessage) => {
  if (!message) {
    return false
  }

  return getMessageVisibleToolCalls(message).length > 0
}

const isAssistantProcessInitializing = (message?: AiMessage) => {
  if (!message) {
    return false
  }

  return !getMessageVisibleToolCalls(message).length && shouldShowAssistantThinking(message)
}

const isAssistantProcessCompleted = (message?: AiMessage) => {
  if (!message || !getMessageVisibleToolCalls(message).length) {
    return false
  }

  const isActiveMessage = isAssistantResponding.value && activeAssistantMessageId.value === message.id
  const hasOpenGroup = getMessageToolCallGroups(message).some(group => group.closed === false)
  return !isActiveMessage && !hasOpenGroup
}

const isAssistantProcessExpanded = (message?: AiMessage) => {
  if (!message) {
    return false
  }

  const cached = processExpandedState.value[message.id]
  if (typeof cached === 'boolean') {
    return cached
  }

  return !isAssistantProcessCompleted(message)
}

const handleAssistantProcessToggle = (message: AiMessage, event: Event) => {
  const details = event.target as HTMLDetailsElement | null
  if (!details || !isAssistantProcessCompleted(message)) {
    return
  }
  processExpandedState.value = {
    ...processExpandedState.value,
    [message.id]: details.open,
  }
}

const getAssistantProcessCounts = (message?: AiMessage) => {
  const calls = getMessageVisibleToolCalls(message)
  return calls.reduce((result, call) => {
    const status = resolveToolCallDisplayStatus(call)
    result.total += 1
    if (status === 'running') result.running += 1
    if (status === 'success') result.success += 1
    if (status === 'error') result.error += 1
    if (status === 'skipped') result.skipped += 1
    return result
  }, {
    total: 0,
    running: 0,
    success: 0,
    error: 0,
    skipped: 0,
  })
}

const resolveAssistantRepresentativeToolCall = (message?: AiMessage) => {
  const calls = getMessageVisibleToolCalls(message)
  if (!calls.length) {
    return null
  }

  const lastErrorCall = [...calls].reverse().find(call => resolveToolCallDisplayStatus(call) === 'error')
  if (lastErrorCall) {
    return lastErrorCall
  }

  const lastSuccessCall = [...calls].reverse().find(call => resolveToolCallDisplayStatus(call) === 'success')
  if (lastSuccessCall) {
    return lastSuccessCall
  }

  return calls[calls.length - 1]
}

const resolveAssistantRepresentativeToolText = (message?: AiMessage) => {
  const representativeCall = resolveAssistantRepresentativeToolCall(message)
  if (!representativeCall) {
    return ''
  }

  return [
    resolveToolCallDisplayName(representativeCall),
    resolveToolCallDisplayStatusText(representativeCall),
    formatToolCallDuration(representativeCall.durationMs),
  ].join('｜')
}

const resolveAssistantProcessTitle = (message?: AiMessage) => (
  isAssistantProcessCompleted(message)
    ? i18next.t('workbenchAiChat.taskCompleted')
    : i18next.t('workbenchAiChat.toolsRunning')
)

const resolveAssistantProcessPrimaryLine = (message?: AiMessage) => {
  const counts = getAssistantProcessCounts(message)
  if (!counts.total) {
    return ''
  }

  const representativeText = resolveAssistantRepresentativeToolText(message)
  return representativeText
    ? i18next.t('workbenchAiChat.toolCallsWithRepresentative', { count: counts.total, representative: representativeText })
    : i18next.t('workbenchAiChat.toolCallsCount', { count: counts.total })
}

const shouldShowAssistantProcessPrimaryLine = (message?: AiMessage) => (
  Boolean(resolveAssistantProcessPrimaryLine(message))
)

const resolveAssistantProcessSecondaryLineItems = (message?: AiMessage) => {
  const counts = getAssistantProcessCounts(message)
  if (!counts.total) {
    return []
  }

  const items = [
    i18next.t('workbenchAiChat.runningToolCount', { count: counts.running }),
    i18next.t('workbenchAiChat.successToolCount', { count: counts.success }),
    i18next.t('workbenchAiChat.failedToolCount', { count: counts.error }),
  ]
  if (counts.skipped > 0) {
    items.push(i18next.t('workbenchAiChat.skippedToolCount', { count: counts.skipped }))
  }
  return items
}

const upsertMessageToolCall = (
  message: AiMessage,
  payload: Partial<AiToolCallTrace> & Pick<AiToolCallTrace, 'id'>,
) => {
  const normalizedPayload: Partial<AiToolCallTrace> & Pick<AiToolCallTrace, 'id'> = {
    id: payload.id,
    name: String(payload.name || i18next.t('WorkbenchAiChat.unknownTool')),
    displayName: String(payload.displayName || '').trim() || undefined,
    displayStatus: ['running', 'success', 'error', 'skipped'].includes(String(payload.displayStatus || '').trim())
      ? payload.displayStatus
      : undefined,
    displaySummary: String(payload.displaySummary || '').trim() || undefined,
    displayHidden: typeof payload.displayHidden === 'boolean' ? payload.displayHidden : undefined,
    groupId: String(payload.groupId || '').trim() || undefined,
    traceId: String(payload.traceId || '').trim() || undefined,
    input: payload.input ?? null,
    ok: payload.ok,
    outputPreview: payload.outputPreview,
    outputTruncated: payload.outputTruncated,
    historyPromptSnapshot: typeof payload.historyPromptSnapshot === 'string' ? payload.historyPromptSnapshot : undefined,
    historyPromptSnapshotTruncated: typeof payload.historyPromptSnapshotTruncated === 'boolean'
      ? payload.historyPromptSnapshotTruncated
      : undefined,
    error: payload.error,
    durationMs: payload.durationMs,
    round: payload.round,
    strategy: payload.strategy,
    batchSize: Number.isFinite(Number(payload.batchSize)) ? Number(payload.batchSize) : undefined,
    partial: typeof payload.partial === 'boolean' ? payload.partial : undefined,
    reused: typeof payload.reused === 'boolean' ? payload.reused : undefined,
    policyBlocked: typeof payload.policyBlocked === 'boolean' ? payload.policyBlocked : undefined,
    repeatedCall: typeof payload.repeatedCall === 'boolean' ? payload.repeatedCall : undefined,
    noNewInformation: typeof payload.noNewInformation === 'boolean' ? payload.noNewInformation : undefined,
    repeatNotice: String(payload.repeatNotice || '').trim() || undefined,
    repeatHint: String(payload.repeatHint || '').trim() || undefined,
    duplicateBlocked: typeof payload.duplicateBlocked === 'boolean' ? payload.duplicateBlocked : undefined,
    repeatedCount: Number.isFinite(Number(payload.repeatedCount)) ? Number(payload.repeatedCount) : undefined,
    consecutiveRepeatedCount: Number.isFinite(Number(payload.consecutiveRepeatedCount))
      ? Number(payload.consecutiveRepeatedCount)
      : undefined,
    queued: typeof payload.queued === 'boolean' ? payload.queued : undefined,
    executionGroup: String(payload.executionGroup || '').trim() || undefined,
    targetIds: normalizeOptionalIdList(payload.targetIds),
    succeededTargetIds: normalizeOptionalIdList(payload.succeededTargetIds),
    failedTargetIds: normalizeOptionalIdList(payload.failedTargetIds),
    searchConvergence: ['none', 'weak', 'clear'].includes(String(payload.searchConvergence || '').trim())
      ? payload.searchConvergence
      : undefined,
    topCandidateAppId: String(payload.topCandidateAppId || '').trim() || undefined,
    searchResultSignature: String(payload.searchResultSignature || '').trim() || undefined,
  }
  const toolCalls = ensureMessageToolCalls(message)
  const existing = toolCalls.find(item => item.id === normalizedPayload.id)
  if (existing) {
    Object.assign(existing, normalizedPayload)
    return existing
  }

  const nextToolCall: AiToolCallTrace = {
    id: normalizedPayload.id,
    name: normalizedPayload.name || i18next.t('WorkbenchAiChat.unknownTool'),
    displayName: normalizedPayload.displayName,
    displayStatus: normalizedPayload.displayStatus,
    displaySummary: normalizedPayload.displaySummary,
    displayHidden: normalizedPayload.displayHidden,
    groupId: normalizedPayload.groupId,
    traceId: normalizedPayload.traceId,
    input: normalizedPayload.input ?? null,
    ok: normalizedPayload.ok,
    outputPreview: normalizedPayload.outputPreview,
    outputTruncated: normalizedPayload.outputTruncated,
    historyPromptSnapshot: normalizedPayload.historyPromptSnapshot,
    historyPromptSnapshotTruncated: normalizedPayload.historyPromptSnapshotTruncated,
    error: normalizedPayload.error,
    durationMs: normalizedPayload.durationMs,
    round: normalizedPayload.round,
    strategy: normalizedPayload.strategy,
    batchSize: normalizedPayload.batchSize,
    partial: normalizedPayload.partial,
    reused: normalizedPayload.reused,
    policyBlocked: normalizedPayload.policyBlocked,
    repeatedCall: normalizedPayload.repeatedCall,
    noNewInformation: normalizedPayload.noNewInformation,
    repeatNotice: normalizedPayload.repeatNotice,
    repeatHint: normalizedPayload.repeatHint,
    duplicateBlocked: normalizedPayload.duplicateBlocked,
    repeatedCount: normalizedPayload.repeatedCount,
    consecutiveRepeatedCount: normalizedPayload.consecutiveRepeatedCount,
    queued: normalizedPayload.queued,
    executionGroup: normalizedPayload.executionGroup,
    targetIds: normalizedPayload.targetIds,
    succeededTargetIds: normalizedPayload.succeededTargetIds,
    failedTargetIds: normalizedPayload.failedTargetIds,
    searchConvergence: normalizedPayload.searchConvergence,
    topCandidateAppId: normalizedPayload.topCandidateAppId,
    searchResultSignature: normalizedPayload.searchResultSignature,
  }
  toolCalls.push(nextToolCall)
  return nextToolCall
}

const ensureOpenToolCallGroup = (message: AiMessage, groupId?: string) => {
  const groups = ensureMessageToolCallGroups(message)
  const normalizedGroupId = String(groupId || '').trim()
  const lastGroup = groups[groups.length - 1]

  if (normalizedGroupId) {
    const matchedGroup = groups.find(group => group.id === normalizedGroupId)
    if (matchedGroup) {
      if (!Array.isArray(matchedGroup.timeline)) {
        matchedGroup.timeline = []
      }
      matchedGroup.closed = false
      return matchedGroup
    }
  }

  if (lastGroup && lastGroup.closed === false) {
    if (!Array.isArray(lastGroup.timeline)) {
      lastGroup.timeline = []
    }
    return lastGroup
  }

  const nextGroup: AiToolCallGroupTrace = {
    id: normalizedGroupId || createMessageId('tool-group'),
    callIds: [],
    timeline: [],
    closed: false,
  }
  groups.push(nextGroup)
  return nextGroup
}

const closeOpenToolCallGroup = (message: AiMessage) => {
  const groups = ensureMessageToolCallGroups(message)
  const lastGroup = groups[groups.length - 1]
  if (lastGroup && lastGroup.closed === false) {
    lastGroup.closed = true
  }
}

const appendToolCallGroupTimelineItem = (
  toolGroup: AiToolCallGroupTrace,
  payload: Omit<AiToolCallGroupTimelineItem, 'id'>,
) => {
  if (!Array.isArray(toolGroup.timeline)) {
    toolGroup.timeline = []
  }

  const existing = toolGroup.timeline.find(item =>
    item.type === payload.type && item.refId === payload.refId,
  )
  if (existing) {
    return existing
  }

  const nextItem: AiToolCallGroupTimelineItem = {
    id: createMessageId('tool-group-item'),
    type: payload.type,
    refId: payload.refId,
  }
  toolGroup.timeline.push(nextItem)
  return nextItem
}

const archiveInterimRoundText = (
  message: AiMessage,
  toolGroup: AiToolCallGroupTrace,
  round?: number,
  anchorCallId?: string,
) => {
  const metadata = ensureMessageMetadata(message)
  const lastDeltaRound = Number(metadata.lastDeltaRound || 0)
  const lastDeltaInterim = Boolean(metadata.lastDeltaInterim)
  if (!lastDeltaInterim) {
    return
  }
  if (round && lastDeltaRound && lastDeltaRound !== round) {
    return
  }
  const pendingInterimText = getMessagePendingInterimText(message)
  const rawContent = String(pendingInterimText?.text || '')
  const normalizedContent = normalizeRenderableInterimText(rawContent)
  if (normalizedContent) {
    const interimText: AiInterimTextTrace = {
      id: pendingInterimText?.id || createMessageId('assistant-delta'),
      text: normalizedContent,
      round: pendingInterimText?.round || lastDeltaRound || round || undefined,
      anchorCallId: String(anchorCallId || '').trim() || undefined,
    }
    ensureMessageInterimTexts(message).push(interimText)
    appendToolCallGroupTimelineItem(toolGroup, {
      type: 'interim-text',
      refId: interimText.id,
    })
  }

  if (
    pendingInterimText
    && pendingInterimText.startLength <= message.content.length
    && message.content.slice(pendingInterimText.startLength, pendingInterimText.startLength + rawContent.length) === rawContent
  ) {
    message.content = message.content.slice(0, pendingInterimText.startLength)
  }
  setMessagePendingInterimText(message, null)
  metadata.lastDeltaInterim = false
  metadata.lastDeltaRound = 0
}

const archivePendingInterimText = (
  message: AiMessage,
  options?: {
    round?: number
    anchorCallId?: string
    toolGroup?: AiToolCallGroupTrace | null
  },
) => {
  const toolGroups = ensureMessageToolCallGroups(message)
  const toolGroup = options?.toolGroup || toolGroups[toolGroups.length - 1]
  if (!toolGroup) {
    const metadata = ensureMessageMetadata(message)
    const pendingInterimText = getMessagePendingInterimText(message)
    if (
      pendingInterimText
      && pendingInterimText.startLength <= message.content.length
      && message.content.slice(pendingInterimText.startLength, pendingInterimText.startLength + pendingInterimText.text.length) === pendingInterimText.text
    ) {
      message.content = message.content.slice(0, pendingInterimText.startLength)
    }
    setMessagePendingInterimText(message, null)
    metadata.lastDeltaInterim = false
    metadata.lastDeltaRound = 0
    return
  }

  const anchorCallId = String(options?.anchorCallId || '').trim()
    || toolGroup.callIds[toolGroup.callIds.length - 1]
    || undefined
  archiveInterimRoundText(message, toolGroup, options?.round, anchorCallId)
}

const clearPendingInterimText = (message: AiMessage) => {
  const metadata = ensureMessageMetadata(message)
  const pendingInterimText = getMessagePendingInterimText(message)
  if (
    pendingInterimText
    && pendingInterimText.startLength <= message.content.length
    && message.content.slice(pendingInterimText.startLength, pendingInterimText.startLength + pendingInterimText.text.length) === pendingInterimText.text
  ) {
    message.content = message.content.slice(0, pendingInterimText.startLength)
  }
  setMessagePendingInterimText(message, null)
  metadata.lastDeltaInterim = false
  metadata.lastDeltaRound = 0
}

const mapThreadMessages = (messages: AiThreadMessage[]) => {
  return [...(messages || [])]
    .reverse()
    .filter(item => item.role === AiMessageRole.USER || item.role === AiMessageRole.ASSISTANT)
    .filter(item => !item.metadata?.supersededAt)
    .map(item => ({
      id: item.id,
      role: item.role as AiMessageRole.USER | AiMessageRole.ASSISTANT,
      content: item.content,
      createTime: item.createTime,
      traceId: item.traceId || undefined,
      metadata: item.metadata || null,
    }))
}

const applyThreadMessages = (
  messages: AiThreadMessage[],
  options?: { assistantId?: string; prepend?: boolean; state?: AiThreadViewState },
) => {
  const state = options?.state || currentViewState.value
  const nextMessages = mapThreadMessages(messages)
  state.activeExcelAnalysisContext = resolveAiExcelAnalysisContextAfterMessageLoad({
    prepend: options?.prepend,
    loadedMessageMetadata: nextMessages.map(item => item.metadata || null),
    existingMessageMetadata: state.messages.map(item => item.metadata || null),
  })
  if (options?.prepend) {
    state.messages = [...nextMessages, ...state.messages]
    increaseMessageOffset(messages.length, state)
  } else {
    state.messages = nextMessages
    state.messageOffset = messages.length
  }
  state.hasMoreHistory = messages.length >= MESSAGE_PAGE_SIZE
  if (options?.assistantId && !options.prepend) {
    ensureAssistantMessage(options.assistantId, {
      countOffset: true,
    }, state)
  }
}

const handleScroll = () => {
  const container = messagesContainerRef.value
  if (!container) return

  const { scrollTop, scrollHeight, clientHeight } = container
  isAtBottom.value = scrollHeight - scrollTop - clientHeight < 50
  if (scrollTop <= LOAD_MORE_HISTORY_THRESHOLD) {
    void loadMoreHistory()
  }
}

const scrollToBottom = async (smooth = false) => {
  await nextTick();
  await new Promise(resolve => requestAnimationFrame(resolve));
  if (messagesContainerRef.value) {
    if (smooth) {
      messagesContainerRef.value.scrollTo({
        top: messagesContainerRef.value.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
    }
    isAtBottom.value = true;
  }
}

const restorePrependScrollPosition = async (previousScrollHeight: number, previousScrollTop: number) => {
  await nextTick()
  const container = messagesContainerRef.value
  if (!container) return

  const nextScrollTop = container.scrollHeight - previousScrollHeight + previousScrollTop
  const previousScrollBehavior = container.style.scrollBehavior
  container.style.scrollBehavior = 'auto'
  container.scrollTop = nextScrollTop
  container.style.scrollBehavior = previousScrollBehavior
}

const loadThreadMessages = async (
  assistantId?: string,
  options?: { prepend?: boolean; state?: AiThreadViewState; scrollToLatest?: boolean },
) => {
  const state = options?.state || currentViewState.value
  const requestThreadId = String(state.threadId || '').trim()
  const hadCachedMessages = state.messages.length > 0
  if (!requestThreadId) {
    if (!hadCachedMessages) {
      state.messages = []
      resetMessageHistoryState(state)
    }
    state.isInitialLoading = false
    return
  }

  const prepend = Boolean(options?.prepend)
  if (prepend) {
    if (state.isLoadingHistory || !state.hasMoreHistory) return
    state.isLoadingHistory = true
  } else {
    state.isInitialLoading = true
  }

  try {
    const request = props.isSharePage
      ? axios.get<AiThreadMessage[]>('/ai/share/messages', {
          params: {
            shareToken: props.shareToken,
            visitorKey: props.visitorKey,
            offset: prepend ? state.messageOffset : 0,
            limit: MESSAGE_PAGE_SIZE,
          },
        })
      : axios.get<AiThreadMessage[]>(`/ai/threads/${requestThreadId}/messages`, {
          params: {
            offset: prepend ? state.messageOffset : 0,
            limit: MESSAGE_PAGE_SIZE,
          },
        })
    const { data } = await request
    if (String(state.threadId || '').trim() !== requestThreadId) {
      return
    }
    const messages = data || []
    applyThreadMessages(messages, {
      assistantId,
      prepend,
      state,
    })
    if (!prepend && options?.scrollToLatest !== false && currentViewState.value === state) {
      await ensureMessagesScrollable()
      await scrollToBottom()
    }
  } catch (error) {
    if (!prepend && !hadCachedMessages && String(state.threadId || '').trim() === requestThreadId) {
      state.messages = []
      resetMessageHistoryState(state)
    }
    console.error('Load AI messages failed:', error)
  } finally {
    if (prepend) {
      state.isLoadingHistory = false
    } else {
      state.isInitialLoading = false
    }
  }
}

const ensureMessagesScrollable = async () => {
  let loopCount = 0

  while (loopCount < 20) {
    const container = messagesContainerRef.value
    if (!container || !currentThreadId.value || !hasMoreHistory.value || isLoadingHistory.value) {
      break
    }
    if (container.scrollHeight > container.clientHeight) {
      break
    }

    const previousScrollHeight = container.scrollHeight
    const previousScrollTop = container.scrollTop

    await loadThreadMessages(undefined, {
      prepend: true,
    })
    await restorePrependScrollPosition(previousScrollHeight, previousScrollTop)
    loopCount += 1
  }
}

const loadMoreHistory = async () => {
  if (!currentThreadId.value || !hasMoreHistory.value || isLoadingHistory.value || isAssistantResponding.value) return

  const container = messagesContainerRef.value
  const previousScrollHeight = container?.scrollHeight || 0
  const previousScrollTop = container?.scrollTop || 0

  await loadThreadMessages(undefined, {
    prepend: true,
  })

  if (!container) return

  await restorePrependScrollPosition(previousScrollHeight, previousScrollTop)
  await ensureMessagesScrollable()
  handleScroll()
}

const finalizeStoppedAssistantMessage = (
  assistantId: string,
  state: AiThreadViewState = currentViewState.value,
) => {
  const message = findMessageById(assistantId, state)
  if (!message) return

  clearThinkingText(message)
  archivePendingInterimText(message)
  closeOpenToolCallGroup(message)
  if (
    !message.content.trim()
    && !getMessageToolCalls(message).length
    && !getMessageInterimTexts(message).length
  ) {
    removeMessageById(assistantId, {
      countOffset: true,
    }, state)
  }
}

const resetAssistantRespondingState = (
  controller: AbortController,
  assistantId: string,
  state?: AiThreadViewState | null,
) => {
  if (!state) return
  const stateKey = normalizeThreadStateKey(state.threadId)
  if (streamControllers.value.get(state) !== controller) return

  state.isAssistantResponding = false
  if (state.activeAssistantMessageId === assistantId) {
    state.activeAssistantMessageId = ''
  }
  streamControllers.value.delete(state)

  if (activeStreamState.value === state && streamControllers.value.size === 0) {
    activeStreamState.value = null
  }
  if (activeStreamStateKey.value === stateKey && streamControllers.value.size === 0) {
    activeStreamStateKey.value = ''
  }
}

const applyAssistantErrorMessage = (
  assistantId: string,
  errorText: string,
  state: AiThreadViewState = currentViewState.value,
) => {
  const message = findMessageById(assistantId, state)
  if (!message) return

  const normalizedErrorText = String(errorText || '').trim() || getAssistantErrorText()
  archivePendingInterimText(message)
  closeOpenToolCallGroup(message)
  if (message.content === getAssistantThinkingText() || !message.content.trim()) {
    message.content = normalizedErrorText
    return
  }

  const lastLine = message.content.split('\n').map(item => item.trim()).filter(Boolean).pop()
  if (lastLine === normalizedErrorText) {
    return
  }
  message.content = `${message.content}\n${normalizedErrorText}`
}

const handleStreamPayload = async (
  streamState: AiThreadViewState,
  assistantId: string,
  eventName: AiStreamEventType,
  data: AiChatStreamPayload,
) => {
  const streamAgentId = String(data.metadata?.agentId || '').trim()
  const nextStreamThreadId = String(data.threadId || '').trim()
  const streamProviderId = String(data.metadata?.providerId || data.metadata?.modelSelection?.providerId || '').trim()
  const streamModelId = String(data.metadata?.modelId || data.metadata?.modelSelection?.modelId || '').trim()
  const streamModel = String(data.metadata?.model || data.metadata?.modelSelection?.model || '').trim()
  const streamModelSelectionSource = data.metadata?.modelSelectionSource === 'default'
    ? 'default'
    : data.metadata?.modelSelectionSource === 'explicit'
      ? 'explicit'
      : undefined
  const streamConversationProfile = normalizeConversationProfile(String(data.metadata?.conversationProfile || '').trim())
  const previousStreamThreadId = streamState.threadId
  if (nextStreamThreadId) {
    updateThreadViewStateId(streamState, nextStreamThreadId, {
      emitThreadChange: currentViewState.value === streamState,
    })
    if (!props.isSharePage && nextStreamThreadId !== previousStreamThreadId) {
      emit('thread-list-change')
    }
  }
  if (streamAgentId) {
    syncThreadViewState(streamState, {
      agentId: streamAgentId,
    })
  }
  if (streamProviderId || streamModelId || streamModel) {
    if (eventName === AiStreamEventType.START && !props.isSharePage && !props.readonly) {
      const streamThreadId = String(streamState.threadId || '').trim()
      modelSelectionChangeTokens.set(
        streamThreadId,
        (modelSelectionChangeTokens.get(streamThreadId) || 0) + 1,
      )
    }
    syncStreamModelSelectionState(streamState, {
      providerId: streamProviderId,
      modelId: streamModelId,
      model: streamModel,
    }, !props.isSharePage && !props.readonly ? streamModelSelectionSource || 'explicit' : undefined)
  }
  if (streamConversationProfile) {
    applyConversationProfileToState(streamConversationProfile, streamState)
  }
  const traceId = String(data.metadata?.traceId || '').trim()
  syncAuthoritativeUserMessageId(streamState, traceId, String(data.metadata?.userMessageId || '').trim())
  if (eventName === AiStreamEventType.CONTEXT_COMPACTION_START || eventName === AiStreamEventType.CONTEXT_COMPACTION_COMPLETED) {
    const message = findMessageById(assistantId, streamState)
    if (isEditedResendAssistantMessage(message, streamState, traceId)) {
      return
    }
    if (message) {
      const metadata = ensureMessageMetadata(message)
      metadata.contextCompaction = {
        ...(metadata.contextCompaction || {}),
        status: eventName === AiStreamEventType.CONTEXT_COMPACTION_START ? 'running' : 'completed',
        estimatedTokens: Number(data.metadata?.estimatedTokens || 0) || undefined,
        sourceMessageCount: Number(data.metadata?.sourceMessageCount || 0) || undefined,
      }
      if (eventName === AiStreamEventType.CONTEXT_COMPACTION_START && message.content === getAssistantThinkingText()) {
        message.content = getAssistantThinkingText()
      }
    }
    return
  }
  if (eventName === AiStreamEventType.START) {
    return
  }

  const message = findMessageById(assistantId, streamState)
  if (!message) return
  if (traceId) {
    const metadata = ensureMessageMetadata(message)
    metadata.traceId = traceId
    message.traceId = traceId
  }

  if (eventName === AiStreamEventType.DELTA) {
    clearThinkingText(message)
    if (data.metadata?.clearInterim === true) {
      clearPendingInterimText(message)
    }
    if (data.text) {
      const metadata = ensureMessageMetadata(message)
      const round = Number(data.metadata?.round || 0)
      const interim = Boolean(data.metadata?.interim)
      metadata.lastDeltaRound = Number(data.metadata?.round || 0)
      metadata.lastDeltaInterim = interim
      const previousContentLength = message.content.length
      if (interim) {
        const pendingInterimText = getMessagePendingInterimText(message)
        const nextPendingInterimText = pendingInterimText && pendingInterimText.round === (round || pendingInterimText.round)
          ? {
              ...pendingInterimText,
              text: `${pendingInterimText.text}${data.text}`,
            }
          : {
              id: createMessageId('assistant-delta'),
              text: data.text,
              round: round || undefined,
              startLength: previousContentLength,
            }
        setMessagePendingInterimText(message, nextPendingInterimText)
        if (isLikelyToolProtocolText(nextPendingInterimText.text)) {
          if (nextPendingInterimText.startLength <= message.content.length) {
            message.content = message.content.slice(0, nextPendingInterimText.startLength)
          }
        } else {
          message.content += data.text
        }
      } else {
        archivePendingInterimText(message)
        message.content += data.text
        setMessagePendingInterimText(message, null)
      }
      if (currentViewState.value === streamState && isAtBottom.value) {
        void scrollToBottom()
      }
    }
    return
  }

  if (eventName === AiStreamEventType.TOOL_CALL) {
    clearThinkingText(message)
    const round = Number(data.metadata?.round || 0)
    const toolCallId = String(data.metadata?.toolCallId || createMessageId('tool'))
    const toolGroup = ensureOpenToolCallGroup(message, String(data.metadata?.toolGroupId || '').trim())
    archiveInterimRoundText(message, toolGroup, round, toolCallId)
    if (!toolGroup.callIds.includes(toolCallId)) {
      toolGroup.callIds.push(toolCallId)
    }
    appendToolCallGroupTimelineItem(toolGroup, {
      type: 'tool-call',
      refId: toolCallId,
    })
    upsertMessageToolCall(message, {
      id: toolCallId,
      name: String(data.metadata?.toolName || '').trim() || i18next.t('WorkbenchAiChat.unknownTool'),
      displayName: String(data.metadata?.displayName || '').trim() || undefined,
      displayStatus: ['running', 'success', 'error', 'skipped'].includes(String(data.metadata?.displayStatus || '').trim())
        ? data.metadata?.displayStatus
        : undefined,
      displaySummary: String(data.metadata?.displaySummary || '').trim() || undefined,
      displayHidden: data.metadata?.displayHidden === undefined ? undefined : Boolean(data.metadata?.displayHidden),
      groupId: toolGroup.id,
      traceId,
      input: data.metadata?.input || null,
      round: round || undefined,
      strategy: data.metadata?.strategy,
      batchSize: Number(data.metadata?.batchSize || 0) || undefined,
      queued: data.metadata?.queued === undefined ? undefined : Boolean(data.metadata?.queued),
      executionGroup: String(data.metadata?.executionGroup || '').trim() || undefined,
      targetIds: normalizeOptionalIdList(data.metadata?.targetIds),
    })
    if (
      data.metadata?.target === 'client'
      && String(data.metadata?.toolName || '').trim() === WORKBENCH_AI_FILL_CURRENT_FORM_TOOL
    ) {
      await executeClientFormFillTool(streamState, message, data)
    }
    if (currentViewState.value === streamState && isAtBottom.value) {
      void scrollToBottom()
    }
    return
  }

  if (eventName === AiStreamEventType.TOOL_RESULT) {
    const toolCallId = String(data.metadata?.toolCallId || createMessageId('tool'))
    const toolGroup = ensureOpenToolCallGroup(message, String(data.metadata?.toolGroupId || '').trim())
    if (!toolGroup.callIds.includes(toolCallId)) {
      toolGroup.callIds.push(toolCallId)
    }
    appendToolCallGroupTimelineItem(toolGroup, {
      type: 'tool-call',
      refId: toolCallId,
    })
    upsertMessageToolCall(message, {
      id: toolCallId,
      name: String(data.metadata?.toolName || '').trim() || i18next.t('WorkbenchAiChat.unknownTool'),
      displayName: String(data.metadata?.displayName || '').trim() || undefined,
      displayStatus: ['running', 'success', 'error', 'skipped'].includes(String(data.metadata?.displayStatus || '').trim())
        ? data.metadata?.displayStatus
        : undefined,
      displaySummary: String(data.metadata?.displaySummary || '').trim() || undefined,
      displayHidden: data.metadata?.displayHidden === undefined ? undefined : Boolean(data.metadata?.displayHidden),
      groupId: toolGroup.id,
      traceId,
      input: data.metadata?.input || null,
      ok: data.metadata?.ok === undefined ? undefined : Boolean(data.metadata?.ok),
      outputPreview: typeof data.metadata?.outputPreview === 'string' ? data.metadata.outputPreview : '',
      outputTruncated: Boolean(data.metadata?.outputTruncated),
      historyPromptSnapshot: typeof data.metadata?.historyPromptSnapshot === 'string'
        ? data.metadata.historyPromptSnapshot
        : undefined,
      historyPromptSnapshotTruncated: data.metadata?.historyPromptSnapshotTruncated === undefined
        ? undefined
        : Boolean(data.metadata?.historyPromptSnapshotTruncated),
      error: String(data.metadata?.error || '').trim() || undefined,
      durationMs: Number(data.metadata?.durationMs || 0),
      round: Number(data.metadata?.round || 0) || undefined,
      strategy: data.metadata?.strategy,
      batchSize: Number(data.metadata?.batchSize || 0) || undefined,
      partial: data.metadata?.partial === undefined ? undefined : Boolean(data.metadata?.partial),
      reused: data.metadata?.reused === undefined ? undefined : Boolean(data.metadata?.reused),
      policyBlocked: data.metadata?.policyBlocked === undefined ? undefined : Boolean(data.metadata?.policyBlocked),
      repeatedCall: data.metadata?.repeatedCall === undefined ? undefined : Boolean(data.metadata?.repeatedCall),
      noNewInformation: data.metadata?.noNewInformation === undefined ? undefined : Boolean(data.metadata?.noNewInformation),
      repeatNotice: String(data.metadata?.repeatNotice || '').trim() || undefined,
      repeatHint: String(data.metadata?.repeatHint || '').trim() || undefined,
      duplicateBlocked: data.metadata?.duplicateBlocked === undefined ? undefined : Boolean(data.metadata?.duplicateBlocked),
      repeatedCount: Number.isFinite(Number(data.metadata?.repeatedCount))
        ? Number(data.metadata?.repeatedCount)
        : undefined,
      consecutiveRepeatedCount: Number.isFinite(Number(data.metadata?.consecutiveRepeatedCount))
        ? Number(data.metadata?.consecutiveRepeatedCount)
        : undefined,
      queued: data.metadata?.queued === undefined ? undefined : Boolean(data.metadata?.queued),
      executionGroup: String(data.metadata?.executionGroup || '').trim() || undefined,
      targetIds: normalizeOptionalIdList(data.metadata?.targetIds),
      succeededTargetIds: normalizeOptionalIdList(data.metadata?.succeededTargetIds),
      failedTargetIds: normalizeOptionalIdList(data.metadata?.failedTargetIds),
      searchConvergence: ['none', 'weak', 'clear'].includes(String(data.metadata?.searchConvergence || '').trim())
        ? data.metadata?.searchConvergence
        : undefined,
      topCandidateAppId: String(data.metadata?.topCandidateAppId || '').trim() || undefined,
      searchResultSignature: String(data.metadata?.searchResultSignature || '').trim() || undefined,
    })
    if (currentViewState.value === streamState && isAtBottom.value) {
      void scrollToBottom()
    }
    return
  }

  if (eventName === AiStreamEventType.ERROR) {
    archivePendingInterimText(message)
    closeOpenToolCallGroup(message)
    const errorText = resolveErrorMessage(
      new Error(String(data.error || '').trim()),
      getAssistantErrorText(),
    )
    if (message.content === getAssistantThinkingText() || !message.content.trim()) {
      message.content = errorText
    } else {
      message.content = `${message.content}\n${errorText}`
    }
    throw new Error(errorText)
  }

  if (eventName === AiStreamEventType.DONE) {
    archivePendingInterimText(message)
    closeOpenToolCallGroup(message)
    const metadata = ensureMessageMetadata(message)
    if (data.usage && typeof data.usage === 'object') {
      metadata.usage = data.usage
    }
    if (data.finishReason) {
      metadata.finishReason = String(data.finishReason || '').trim() || undefined
    }
    if (data.metadata?.devDiagnostics && typeof data.metadata.devDiagnostics === 'object' && !Array.isArray(data.metadata.devDiagnostics)) {
      metadata.devDiagnostics = data.metadata.devDiagnostics
    }
    if (typeof data.metadata?.finalContent === 'string') {
      message.content = data.metadata.finalContent
    }
    const blocks = resolveAiAssistantMessageBlocks(data.metadata?.blocks)
    if (blocks.length) {
      metadata.blocks = blocks
    }
    const appBuilderHandoff = normalizeWorkbenchAppBuilderHandoffPreview(data.metadata?.appBuilderHandoff)
    if (appBuilderHandoff) {
      metadata.appBuilderHandoff = appBuilderHandoff
    }
    const appBuilderHandoffIssue = normalizeWorkbenchAppBuilderHandoffIssue(data.metadata?.appBuilderHandoffIssue)
    if (appBuilderHandoffIssue) {
      metadata.appBuilderHandoffIssue = appBuilderHandoffIssue
    }
    clearPendingCreateRouteExcelSource(getMessageTraceId(message))
    if (
      message.content === getAssistantThinkingText()
      || (!message.content.trim() && !hasRenderableAssistantBlocks(message))
    ) {
      await loadThreadMessages(undefined, {
        state: streamState,
        scrollToLatest: currentViewState.value === streamState,
      })
    }
  }
}

const stopAssistantReply = (state?: AiThreadViewState) => {
  const streamState = state || currentViewState.value
  const controller = streamControllers.value.get(streamState)
  if (!controller) return

  if (streamState.activeAssistantMessageId) {
    stoppedAssistantMessageIds.add(streamState.activeAssistantMessageId)
  }
  streamState.activeAssistantMessageId = ''
  streamState.isAssistantResponding = false

  streamControllers.value.delete(streamState)
  controller.abort()
}

const appendAssistantReply = async (
  userMessage: string,
  traceId: string,
  requestMetadata?: AiMessageMetadata,
): Promise<'completed' | 'aborted' | 'failed'> => {
  const assistantId = createMessageId('assistant')
  const controller = new AbortController()
  let requestErrorHandled = false
  let submitResult: 'completed' | 'aborted' | 'failed' = 'completed'
  const streamState = currentViewState.value
  const requestNocodeIds = resolveRequestNocodeIds()
  const url = props.isSharePage ? '/ai/share/stream' : '/ai/threads/stream'
  const requestModelSelection = buildEffectiveThreadModelSelectionRequest(streamState)
  const currentFormFillContext = !props.isSharePage && !props.readonly
    ? workbenchAiFormFillContext?.getSnapshot() || null
    : null
  let request: AiThreadStreamRequest | AiShareStreamRequest
  if (props.isSharePage) {
    request = {
      shareToken: String(props.shareToken || ''),
      visitorKey: String(props.visitorKey || ''),
      message: userMessage,
      traceId,
      metadata: {
        ...resolveShareVisitorMetadata(),
        ...(requestMetadata || {}),
      },
    }
  } else {
    request = {
      threadId: currentThreadId.value || undefined,
      message: userMessage,
      nocodeIds: requestNocodeIds,
      ...requestModelSelection,
      traceId,
      ...(requestMetadata ? { metadata: requestMetadata } : {}),
      ...(!props.readonly ? {
        runtimeContext: {
          currentFormFillContext,
          currentFormFillUnavailable: !currentFormFillContext,
        },
      } : {}),
    }
  }

  if (!props.isSharePage && !currentThreadId.value) {
    currentThreadAppIds.value = requestNocodeIds || []
  }

  ensureAssistantMessage(assistantId, {
    countOffset: true,
    traceId,
  }, streamState)

  const stateKey = normalizeThreadStateKey(streamState.threadId)
  streamControllers.value.set(streamState, controller)
  activeStreamState.value = streamState
  activeStreamStateKey.value = stateKey
  streamState.activeAssistantMessageId = assistantId
  streamState.isAssistantResponding = true

  try {
    await fetchEventSource(url, {
      method: 'POST',
      signal: controller.signal,
      openWhenHidden: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      async onopen(response) {
        if (response.ok) {
          return
        }

        const text = await response.text()
        let message = getAssistantErrorText()
        try {
          const payload = JSON.parse(text)
          message = String(payload?.message || payload?.error || '').trim() || message
        } catch {
          message = String(text || '').trim() || message
        }
        throw new Error(resolveErrorMessage(new Error(message), message))
      },
      async onmessage(ev) {
        try {
          const data = JSON.parse(ev.data) as AiChatStreamPayload
          const eventName = (ev.event || data.event) as AiStreamEventType
          if (!eventName) return
          await handleStreamPayload(streamState, assistantId, eventName, data)
        } catch (error) {
          console.error('Parse AI stream payload failed:', error)
        }
      },
      onclose() {
        resetAssistantRespondingState(controller, assistantId, streamState)
      },
      onerror(error) {
        if (controller.signal.aborted) {
          return
        }

        const errorText = resolveErrorMessage(error, getAssistantErrorText())
        resetAssistantRespondingState(controller, assistantId, streamState)
        applyAssistantErrorMessage(assistantId, errorText, streamState)
        requestErrorHandled = true
        throw error
      },
    })
  } catch (error) {
    clearPendingCreateRouteExcelSource(traceId)
    if (!controller.signal.aborted) {
      submitResult = 'failed'
      const errorText = resolveErrorMessage(error, getAssistantErrorText())
      resetAssistantRespondingState(controller, assistantId, streamState)
      if (!requestErrorHandled) {
        applyAssistantErrorMessage(assistantId, errorText, streamState)
      }
      console.error('AI chat request failed:', error)
    } else {
      submitResult = 'aborted'
    }
  } finally {
    if (submitResult !== 'completed') {
      clearPendingCreateRouteExcelSource(traceId)
    }
    resetAssistantRespondingState(controller, assistantId, streamState)
    if (!props.isSharePage) {
      emit('thread-list-change')
    }
    if (stoppedAssistantMessageIds.has(assistantId)) {
      finalizeStoppedAssistantMessage(assistantId, streamState)
      stoppedAssistantMessageIds.delete(assistantId)
    }
  }
  return submitResult
}

const openWithMessage = async (
  message: string,
  appIds?: string[],
  options?: {
    attachments?: AiComposerAttachment[]
    editedFromMessageId?: string
  },
) => {
  const content = message.trim()
  if (!canSubmitAiMessage()) {
    return 'blocked' as const
  }
  const composerAttachments = Array.isArray(options?.attachments) ? options.attachments : []
  const attachmentMetadata = buildWorkbenchAttachmentRequestMetadata(content, composerAttachments)
  const excelAnalysisFollowupBehavior = !composerAttachments.length
    ? resolveAiExcelAnalysisFollowupBehavior({
      context: activeExcelAnalysisContext.value,
      baseRequestMetadata: attachmentMetadata,
      disableToolFlag: 'disableBuiltinAppTools',
      userFacingContent: content,
    })
    : null
  if (excelAnalysisFollowupBehavior?.mode === 'switch-to-create') {
    ElMessage.info(excelAnalysisFollowupBehavior.assistantReply)
    return 'blocked' as const
  }
  if (excelAnalysisFollowupBehavior?.mode === 'clarify') {
    ElMessage.info(excelAnalysisFollowupBehavior.assistantReply)
    return 'blocked' as const
  }
  const effectiveMetadata = !composerAttachments.length
    ? buildWorkbenchExcelAnalysisFollowupMetadata(content, {
      baseMetadata: attachmentMetadata,
    })
    : attachmentMetadata
  const userFacingContent = effectiveMetadata?.userFacingContent || content
  if (!userFacingContent.trim()) {
    return 'not_started' as const
  }
  const attachmentReferences = composerAttachments
    .map(item => normalizeAiAttachmentReference(item))
    .filter(Boolean) as AiAttachmentReference[]
  const attachmentIntent = resolveAiAttachmentIntent({
    text: content,
    attachments: attachmentReferences,
    generalAttachmentsDefaultToAnalyze: true,
  })
  const optimisticCreateRouteExcelSource = attachmentIntent.route === 'create'
    ? resolveAiExcelImportSourceInstance(resolveExcelCreateAttachmentFromComposer(composerAttachments)?.uploadHandle)
    : null
  const traceId = createMessageId('ai-turn')
  const editMetadata = options?.editedFromMessageId
    ? { editedFromMessageId: options.editedFromMessageId }
    : null
  setPendingCreateRouteExcelSource(traceId, optimisticCreateRouteExcelSource)

  if (appIds !== undefined) {
    currentThreadAppIds.value = normalizeIdList(appIds)
  }

  const userMessageMetadata: AiMessageMetadata = {
    traceId,
    ...(effectiveMetadata || {}),
    ...(editMetadata || {}),
  }

  if (editMetadata) {
    const sourceMessage = findMessageById(editMetadata.editedFromMessageId)
    removeTurnMessagesByTraceId(sourceMessage?.traceId || sourceMessage?.metadata?.traceId)
  }

  curAiMessageList.value.push({
    id: createMessageId('user'),
    role: AiMessageRole.USER,
    content: userFacingContent,
    createTime: Date.now(),
    traceId,
    metadata: userMessageMetadata,
  })
  increaseMessageOffset()
  void scrollToBottom()
  void appendAssistantReply(userFacingContent, traceId, userMessageMetadata)
  return 'submitted' as const
}

const startNewChat = (appIds?: string[]) => {
  threadSelectionTicket.value += 1
  const draftState = ensureThreadViewState('')
  resetThreadViewState(draftState)
  switchCurrentThreadState('')
  resetAssistantPreview()
  currentThreadAppIds.value = normalizeIdList(appIds)
  ensureDraftModelSelection(draftState)
  applyFirstExplicitModelSelection(draftState)
  resetSidebarComposer()
  resetScrollBottomState()
  emit('thread-change', '')
}

const selectThread = async (threadOrId: string | AiThreadSummary) => {
  const threadId = String(typeof threadOrId === 'string' ? threadOrId : threadOrId.id || '').trim()
  if (!threadId || currentThreadId.value === threadId) return

  const selectionTicket = ++threadSelectionTicket.value
  const nextState = ensureThreadViewState(threadId)
  const shouldPreloadMessages = !nextState.messages.length && !nextState.isAssistantResponding

  if (shouldPreloadMessages) {
    resetMessageHistoryState(nextState)
    await loadThreadMessages(undefined, {
      state: nextState,
      scrollToLatest: false,
    })
  }

  if (selectionTicket !== threadSelectionTicket.value) return

  switchCurrentThreadState(threadId)
  resetAssistantPreview()
  if (typeof threadOrId === 'string') {
    currentThreadId.value = threadId
  } else {
    syncCurrentThread(threadOrId)
  }
  resetSidebarComposer()
  resetScrollBottomState()
  if (!curAiMessageList.value.length && !isAssistantResponding.value) return
  await nextTick()
  await scrollToBottom()
}

const bootstrapShareThread = async () => {
  if (!props.isSharePage || !props.shareToken || !props.visitorKey) {
    return
  }
  try {
    const { data } = await axios.post<AiShareBootstrapResult>('/ai/share/bootstrap', {
      shareToken: props.shareToken,
      visitorKey: props.visitorKey,
      metadata: resolveShareVisitorMetadata(),
    })
    syncCurrentThread({
      ...data.thread,
      sharing: true,
      shareToken: data.share.shareToken,
    })
    applyThreadMessages(data.messages || [])
    await nextTick(scrollToBottom)
  } catch (error) {
    console.error('Bootstrap share chat failed:', error)
  }
}

const handleSend = async () => {
  if (isAttachmentSubmitting.value) return
  if (isAssistantResponding.value) {
    stopAssistantReply()
    return
  }

  const content = sidebarTextareaValue.value
  if (!content.trim() && !sidebarAttachments.value.length) return
  if (!canSubmitAiMessage()) return

  const draftAttachments = [...sidebarAttachments.value]
  if (!draftAttachments.length) {
    const result = await openWithMessage(content)
    if (result === 'submitted') {
      resetInlineEditUserMessage()
      resetSidebarComposer()
    }
    return
  }

  isAttachmentSubmitting.value = true
  const uploadedAttachmentIds: string[] = []
  let createdThreadId = ''
  try {
    if (!currentThreadId.value) {
      const requestModelSelection = buildEffectiveThreadModelSelectionRequest(currentViewState.value)
      const { data } = await axios.post<AiThreadSummary>('/ai/threads', {
        appScope: { appIds: resolveRequestNocodeIds() || [] },
        ...requestModelSelection,
      })
      createdThreadId = String(data.id || '').trim()
      syncCurrentThread(data)
    }

    const threadId = String(currentThreadId.value || '').trim()
    if (!threadId) throw new Error(i18next.t('WorkbenchAiChatInput.uploadFailedRetry'))

    const uploadedAttachments: AiComposerAttachment[] = []
    for (const attachment of draftAttachments) {
      if (!attachment.file) {
        uploadedAttachments.push(attachment)
        continue
      }
      const formData = new FormData()
      formData.append('file', attachment.file, attachment.name)
      const { data } = await axios.post<AiAttachmentReference>(
        `/ai/threads/${threadId}/attachments`,
        formData,
      )
      const normalized = normalizeSidebarAttachment({
        ...attachment,
        ...data,
        source: 'uploaded',
        status: 'ready',
        file: undefined,
      })
      if (!normalized) throw new Error('AI_ATTACHMENT_UPLOAD_FAILED')
      uploadedAttachmentIds.push(normalized.id)
      uploadedAttachments.push(normalized)
    }

    const attachmentReferences = uploadedAttachments
      .map(item => normalizeAiAttachmentReference(item))
      .filter(Boolean) as AiAttachmentReference[]
    await axios.post(`/ai/threads/${threadId}/attachments/preflight`, {
      attachments: attachmentReferences,
      ...buildEffectiveThreadModelSelectionRequest(currentViewState.value),
    })

    const result = await openWithMessage(content, undefined, {
      attachments: uploadedAttachments,
    })
    if (result === 'submitted') {
      resetInlineEditUserMessage()
      resetSidebarComposer()
    }
  } catch (error) {
    const threadId = String(currentThreadId.value || createdThreadId || '').trim()
    await Promise.all(uploadedAttachmentIds.map(attachmentId => (
      axios.delete(`/ai/threads/${threadId}/attachments/${attachmentId}`).catch(() => undefined)
    )))
    if (createdThreadId) {
      await axios.post(`/ai/threads/${createdThreadId}/delete`).catch(() => undefined)
      startNewChat(currentThreadAppIds.value)
      sidebarTextareaValue.value = content
      sidebarAttachments.value = draftAttachments
    }
    ElMessage.error(resolveErrorMessage(error, i18next.t('WorkbenchAiChatInput.uploadFailedRetry')))
  } finally {
    isAttachmentSubmitting.value = false
  }
}

const submitWithAttachments = async (message: string, attachments: AiAttachment[]) => {
  sidebarTextareaValue.value = message
  sidebarAttachments.value = attachments
    .map(item => normalizeSidebarAttachment(item))
    .filter(Boolean) as AiComposerAttachment[]
  await handleSend()
}

const submitEditedUserMessage = async () => {
  if (isAssistantResponding.value) {
    return
  }

  const editedFromMessageId = editingUserMessageId.value
  const content = editingUserMessageDraft.value
  if (!editedFromMessageId || (!content.trim() && !editingUserMessageAttachments.value.length)) {
    return
  }

  const result = await openWithMessage(content, undefined, {
    attachments: editingUserMessageAttachments.value,
    editedFromMessageId,
  })
  if (result === 'submitted') {
    resetInlineEditUserMessage()
  }
}

const resolveErrorMessage = (error: unknown, fallback: string) => {
  const attachmentMessages: Record<string, string> = {
    AI_ATTACHMENT_TYPE_UNSUPPORTED: String(i18next.t('workbenchAiChat.attachmentErrors.typeUnsupported')),
    AI_ATTACHMENT_LIMIT_EXCEEDED: String(i18next.t('workbenchAiChat.attachmentErrors.limitExceeded')),
    AI_ATTACHMENT_UPLOAD_FAILED: String(i18next.t('workbenchAiChat.attachmentErrors.uploadFailed')),
    AI_ATTACHMENT_ACCESS_DENIED: String(i18next.t('workbenchAiChat.attachmentErrors.accessDenied')),
    AI_ATTACHMENT_NOT_FOUND: String(i18next.t('workbenchAiChat.attachmentErrors.notFound')),
    AI_ATTACHMENT_PARSE_FAILED: String(i18next.t('workbenchAiChat.attachmentErrors.parseFailed')),
    AI_ATTACHMENT_ARCHIVE_UNSAFE: String(i18next.t('workbenchAiChat.attachmentErrors.archiveUnsafe')),
    AI_ATTACHMENT_CONTEXT_LIMIT_EXCEEDED: String(i18next.t('workbenchAiChat.attachmentErrors.contextLimitExceeded')),
    AI_ATTACHMENT_MODEL_UNSUPPORTED: String(i18next.t('workbenchAiChat.attachmentErrors.modelUnsupported')),
    AI_ATTACHMENT_OCR_UNAVAILABLE: String(i18next.t('workbenchAiChat.attachmentErrors.ocrUnavailable')),
  }
  if (isUnknownRecord(error)) {
    const response = isUnknownRecord(error.response) ? error.response : null
    const responseData = isUnknownRecord(response?.data) ? response.data : null
    const responseMessage = String(responseData?.message || '').trim()
    if (responseMessage) {
      return attachmentMessages[responseMessage] || responseMessage
    }
    const message = String(error.message || '').trim()
    if (message) {
      return attachmentMessages[message] || message
    }
  }
  return fallback
}

const resolveHandoffNotReadyWarning = (
  status?: WorkbenchAiAppBuilderHandoffPreview['status'] | null,
) => {
  if (status === 'continuing') {
    return i18next.t('workbenchAiChat.handoffCardProcessingUpdated')
  }
  if (status === 'consumed') {
    return i18next.t('workbenchAiChat.handoffCardCompletedUpdated')
  }
  if (status === 'abandoned') {
    return i18next.t('workbenchAiChat.handoffCardExpiredUpdated')
  }
  return i18next.t('workbenchAiChat.handoffCardStatusUpdated')
}

const fetchLatestHandoffPreview = async (handoffId: string) => {
  if (!currentThreadId.value) {
    return null
  }

  const { data } = await axios.get(
    `/ai/threads/${currentThreadId.value}/app-builder-handoff/${handoffId}`,
  )
  replaceMessageHandoffPreview(data)
  return normalizeWorkbenchAppBuilderHandoffPreview(normalizeHandoffResponsePayload(data))
}

type HandoffPreflightResult = {
  ok: boolean
  latestPreview: WorkbenchAiAppBuilderHandoffPreview | null
}

const ensureReadyHandoffBeforeMutation = async (
  handoffId: string,
): Promise<HandoffPreflightResult> => {
  if (!currentThreadId.value || props.isSharePage || props.readonly) {
    return {
      ok: false,
      latestPreview: null,
    }
  }

  try {
    const latestPreview = await fetchLatestHandoffPreview(handoffId)
    if (latestPreview?.status && latestPreview.status !== 'ready') {
      if (pendingHandoffClarificationId.value === handoffId) {
        pendingHandoffClarificationId.value = ''
      }
      ElMessage.warning(resolveHandoffNotReadyWarning(latestPreview.status))
      return {
        ok: false,
        latestPreview,
      }
    }
    return {
      ok: true,
      latestPreview,
    }
  } catch (error) {
    console.error('Load latest app builder handoff failed:', error)
    ElMessage.error(resolveErrorMessage(error, i18next.t('workbenchAiChat.loadLatestHandoffCardFailed')))
    return {
      ok: false,
      latestPreview: null,
    }
  }
}

type AppBuilderHandoffContinuePayload =
  | {
      mode: 'create_new_app'
      nocodeId: string
      createdApp?: {
        appId: string
        appName?: string
      }
      handoffId: string
      sourceThreadId: string
    }
  | {
      mode: 'extend_existing_app'
      nocodeId: string
      handoffId: string
      sourceThreadId: string
    }

const continueCreateWithResolvedHandoff = async (
  handoffId: string,
  options: {
    allowSameSubmittingId?: boolean
    latestPreview?: WorkbenchAiAppBuilderHandoffPreview | null
  } = {},
): Promise<boolean> => {
  const sameSubmittingHandoff = handoffSubmittingId.value === handoffId
  if (
    !currentThreadId.value
    || props.isSharePage
    || props.readonly
    || (handoffSubmittingId.value && !(options.allowSameSubmittingId && sameSubmittingHandoff))
  ) {
    return false
  }

  let latestPreview = options.latestPreview || null
  if (latestPreview?.status && latestPreview.status !== 'ready') {
    return false
  }
  if (!latestPreview) {
    const preflight = await ensureReadyHandoffBeforeMutation(handoffId)
    if (!preflight.ok) {
      return false
    }
    latestPreview = preflight.latestPreview
  }

  if (!sameSubmittingHandoff) {
    handoffSubmittingId.value = handoffId
  }
  const threadId = currentThreadId.value
  let claimed = false
  try {
    const { data } = await axios.post<AppBuilderHandoffContinuePayload>(
      `/ai/threads/${threadId}/app-builder-handoff/${handoffId}/continue`,
    )
    claimed = true
    const nocodeId = String(data.nocodeId || '').trim()

    if (!nocodeId) {
      throw new Error(i18next.t('workbenchAiChat.missingTargetAppForEditorAi'))
    }

    if (data.mode === 'create_new_app' && selectedModelOption.value) {
      stageNocodeEditorBuilderModelSelection(nocodeId, {
        modelSelectionSource: 'explicit',
        providerId: selectedModelOption.value.providerId,
        modelId: selectedModelOption.value.modelId,
        model: selectedModelOption.value.model,
      })
    }

    const navigationResult = await router.push(`/app/${encodeURIComponent(nocodeId)}/edit/?aiEntry=builder-home&handoffId=${encodeURIComponent(handoffId)}&handoffSourceThreadId=${encodeURIComponent(String(data.sourceThreadId || threadId))}`)
    if (isNavigationFailure(navigationResult)) {
      throw navigationResult
    }
    return true
  } catch (error) {
    console.error('Continue app builder handoff failed:', error)
    if (claimed) {
      await axios.post(
        `/ai/threads/${threadId}/app-builder-handoff/${handoffId}/release`,
      ).catch((releaseError) => {
        console.warn('Release app builder handoff failed:', releaseError)
      })
    }
    ElMessage.error(resolveErrorMessage(error, i18next.t('workbenchAiChat.continueCreateFailed')))
    return false
  } finally {
    if (handoffSubmittingId.value === handoffId) {
      handoffSubmittingId.value = ''
    }
  }
}

const handleContinueCreate = async (handoff: WorkbenchAiAppBuilderHandoffPreview) => {
  if (props.isSharePage || props.readonly) {
    return
  }

  const preflight = await ensureReadyHandoffBeforeMutation(handoff.handoffId)
  if (!preflight.ok) {
    return
  }

  const latestPreview = preflight.latestPreview || handoff
  if (resolveWorkbenchAppBuilderHandoffContinueIntent(latestPreview) === 'clarify') {
    pendingHandoffClarificationId.value = handoff.handoffId
    return
  }

  await continueCreateWithResolvedHandoff(handoff.handoffId, {
    latestPreview,
  })
}

const handleResolveCreationMode = async (payload: WorkbenchAiAppBuilderHandoffResolvePayload): Promise<boolean> => {
  if (!currentThreadId.value || props.isSharePage || props.readonly) {
    return false
  }
  if (handoffSubmittingId.value && handoffSubmittingId.value !== payload.handoffId) {
    return false
  }

  const preflight = await ensureReadyHandoffBeforeMutation(payload.handoffId)
  if (!preflight.ok) {
    return false
  }

  handoffSubmittingId.value = payload.handoffId
  try {
    const { data } = await axios.post(
      `/ai/threads/${currentThreadId.value}/app-builder-handoff/${payload.handoffId}/resolve`,
      payload,
    )
    replaceMessageHandoffPreview(data)
    if (pendingHandoffClarificationId.value === payload.handoffId) {
      pendingHandoffClarificationId.value = ''
    }
    if (shouldContinueWorkbenchAppBuilderHandoffAfterResolve(payload)) {
      return await continueCreateWithResolvedHandoff(payload.handoffId, {
        allowSameSubmittingId: true,
        latestPreview: normalizeWorkbenchAppBuilderHandoffPreview(normalizeHandoffResponsePayload(data)),
      })
    }
    return true
  } catch (error) {
    console.error('Resolve app builder handoff failed:', error)
    ElMessage.error(resolveErrorMessage(error, i18next.t('workbenchAiChat.confirmCreateModeFailed')))
    return false
  } finally {
    if (handoffSubmittingId.value === payload.handoffId) {
      handoffSubmittingId.value = ''
    }
  }
}

const resetTargetAppSelection = () => {
  if (targetAppSelectionSubmitting.value) {
    return
  }

  targetAppSelectionSearchValue.value = ''
  selectedTargetAppId.value = ''
  pendingTargetAppSelectionHandoff.value = null
}

const retryLoadHandoffTargetApps = async () => {
  try {
    await loadHandoffTargetAppOptions({ force: true })
  } catch (error) {
    console.error('Load handoff target apps failed:', error)
    ElMessage.error(resolveErrorMessage(error, i18next.t('workbenchAiChat.appListLoadFailed')))
  }
}

const handleRequestTargetAppSelection = async (payload: {
  handoff: WorkbenchAiAppBuilderHandoffPreview
  targetAppId?: string
  targetAppName?: string
}) => {
  if (props.isSharePage || props.readonly) {
    return
  }

  pendingTargetAppSelectionHandoff.value = payload.handoff
  selectedTargetAppId.value = String(payload.targetAppId || payload.handoff.targetApp?.appId || '').trim()
  targetAppSelectionSearchValue.value = ''
  targetAppSelectionDialogVisible.value = true
  await retryLoadHandoffTargetApps()
  if (!selectedTargetAppId.value) {
    selectedTargetAppId.value = filteredHandoffTargetAppSections.value.autoSelectedAppId
  }
  if (
    selectedTargetAppId.value
    && !handoffTargetAppOptions.value.some(app => app.id === selectedTargetAppId.value)
  ) {
    selectedTargetAppId.value = ''
  }
}

const confirmHandoffTargetAppSelection = async () => {
  const handoff = pendingTargetAppSelectionHandoff.value
  const app = selectedTargetApp.value
  if (!handoff || !app || targetAppSelectionSubmitting.value) {
    return
  }

  targetAppSelectionSubmitting.value = true
  try {
    const resolved = await handleResolveCreationMode({
      handoffId: handoff.handoffId,
      creationMode: 'extend_existing_app',
      targetAppId: app.id,
      targetAppName: app.name,
    })
    if (resolved) {
      targetAppSelectionDialogVisible.value = false
    }
  } finally {
    targetAppSelectionSubmitting.value = false
  }
}

const handleFeedback = (messageId: string, value: 'like' | 'dislike') => {
  feedbackState.value[messageId] = feedbackState.value[messageId] === value ? '' : value
}

const handleSharingChange = (payload: { enabled: boolean; shareToken: string }) => {
  currentThreadSharing.value = payload.enabled
  currentThreadShareToken.value = payload.shareToken
  emit('thread-list-change')
}

const handleAppSelectorClose = async (appIds: string[]) => {
  const newAppIds = normalizeIdList(appIds)
  const oldAppIds = normalizeIdList(currentThreadAppIds.value)
  const same = newAppIds.length === oldAppIds.length && newAppIds.every((item, index) => item === oldAppIds[index])
  if (same) return

  currentThreadAppIds.value = newAppIds
  if (!currentThreadId.value) return

  try {
    const { data } = await axios.post<AiThreadSummary>(`/ai/threads/${currentThreadId.value}/update`, {
      appScope: {
        appIds: newAppIds,
      },
    })
    syncCurrentThread(data)
    emit('thread-list-change')
  } catch (error) {
    console.error('Update AI thread app scope failed:', error)
  }
}

const handleModelChange = async (value: string) => {
  const option = modelSelectorOptions.value.find(item => item.value === value)
  if (!option) {
    return
  }

  const sameSelection = currentThreadModelSelectionSource.value === 'explicit'
    && currentThreadProviderId.value === option.providerId
    && currentThreadModelId.value === option.modelId
    && currentThreadModel.value === option.model
  if (sameSelection) {
    return
  }

  const previousSelection: AiThreadModelSelection = {
    modelSelectionSource: currentThreadModelSelectionSource.value,
    providerId: currentThreadProviderId.value,
    modelId: currentThreadModelId.value,
    model: currentThreadModel.value,
  }
  const targetState = currentViewState.value
  const threadId = String(currentThreadId.value || '').trim()
  const nextChangeToken = (modelSelectionChangeTokens.get(threadId) || 0) + 1
  modelSelectionChangeTokens.set(threadId, nextChangeToken)
  applyModelSelectionToState(option, currentViewState.value, 'explicit')
  if (!threadId) {
    return
  }

  const previousSaveRequest = modelSelectionSaveRequests.get(threadId)
  const saveRequest = (previousSaveRequest || Promise.resolve(previousSelection)).then(async (persistedSelection) => {
    try {
      const { data } = await axios.post<AiThreadSummary>(`/ai/threads/${threadId}/update`, {
        providerId: option.providerId,
        modelId: option.modelId,
        model: option.model,
      })
      if (
        modelSelectionChangeTokens.get(threadId) !== nextChangeToken
      ) {
        return data
      }
      applyModelSelectionToState(data, targetState, data.modelSelectionSource || 'explicit')
      emit('thread-list-change')
      return data
    } catch (error) {
      if (
        modelSelectionChangeTokens.get(threadId) === nextChangeToken
      ) {
        applyModelSelectionToState(persistedSelection, targetState, persistedSelection.modelSelectionSource || undefined)
      }
      console.error('Update AI thread model selection failed:', error)
      return persistedSelection
    }
  })
  let queuedSaveRequest: Promise<AiThreadModelSelection>
  queuedSaveRequest = saveRequest.finally(() => {
    if (modelSelectionSaveRequests.get(threadId) === queuedSaveRequest) {
      modelSelectionSaveRequests.delete(threadId)
    }
  })
  modelSelectionSaveRequests.set(threadId, queuedSaveRequest)
  await queuedSaveRequest
}

const focusTextarea = async () => {
  await nextTick()
  await sidebarChatInputRef.value?.focusTextarea()
}

watch(isAssistantResponding, (val) => {
  if (val) {
    scrollToBottom();
  } else if (isAtBottom.value) {
    scrollToBottom();
  }
})

watch(() => props.aiChatVisible, (visible) => {
  if (!visible) {
    threadSelectionTicket.value += 1
    resetAssistantPreview()
  }
})

watch(assistantPreviewVisible, (visible) => {
  if (!visible) {
    clearAssistantPreviewChartRepaintFrames()
  }
})

defineExpose({
  openWithMessage,
  submitWithAttachments,
  startNewChat,
  selectThread: selectThread as (threadOrId: string | AiThreadSummary) => Promise<void>,
  focusTextarea,
  get threadId() {
    return currentThreadId.value
  },
})

onMounted(() => {
  if (!props.isSharePage) {
    void aiConfigStore.loadCatalog().then(() => {
      ensureDraftModelSelection()
      applyFirstExplicitModelSelection()
    }).catch(() => null)
  }
  void scrollToBottom()
  if (props.isSharePage) {
    void bootstrapShareThread()
  }
})
</script>

<style scoped lang='scss'>
.workbench-ai-chat {
  // width: 400px;
  height: 100%;
  flex: 1;
  // background-color: var(--bg-color-page);
  border-right: 1px solid #e5e6eb;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.2s ease;

  &.hidden {
    width: 0;
    border-right: 0;
  }

  &.is-share-page {
    width: 100%;
    border-right: 0;
  }

  .ai-sidebar__header {
    height: 60px;
    padding: 12px 8px 12px 16px;
    display: flex;
    align-items: center;
    justify-content: end;
    gap: 8px;
    border-bottom: 1px solid #e5e6eb;
    .ai-sidebar__close {
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
  }


  .ai-sidebar__content {
    width: 100%;
    flex: 1;
    min-width: 400px;
    min-height: 0;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    max-width: var(--workbench-ai-chat-content-max-width);
    margin: 0 auto;
  }

  .ai-sidebar__scroll-bottom {
    position: absolute;
    width: 36px;
    height: 36px;
    left: calc(50% - 18px);
    top: -48px;
    border: 1px solid #e5e6eb;
    border-radius: 50%;
    background-color: #ffffff;
    color: #4e5969;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: var(--cursor-pointer);
    z-index: 10;
    transition: all 0.2s ease;

    &:hover {
      box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.08), 0 8px 24px 0 rgba(0, 0, 0, 0.04);
    }
  }

  .ai-sidebar__messages {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
    &::-webkit-scrollbar {
      display: none;
    }

    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .ai-sidebar__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4e5969;
    font-weight: 500;
    font-size: 20px;
    line-height: 28px;
  }

  .ai-sidebar__message-markdown {
    width: 100%;
  }

  .ai-sidebar__message-chart {
    width: 100%;
  }

  .ai-sidebar__message-table {
    width: 100%;
  }

  .ai-sidebar__assistant-body {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .ai-sidebar__form-fill-undo {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    border: 1px solid #c9cdd4;
    border-radius: 6px;
    background: #fff;
    color: #4e5969;
    font-size: 13px;
    cursor: var(--cursor-pointer);

    &:hover {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }
  }

  .ai-sidebar__process {
    width: 100%;
    border: 1px solid #e5e6eb;
    border-radius: 10px;
    background: #f7f8fa;
    overflow: hidden;
  }

  .ai-sidebar__process-summary {
    list-style: none;
    cursor: var(--cursor-pointer);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    user-select: none;

    &::-webkit-details-marker {
      display: none;
    }
  }

  .ai-sidebar__process-summary-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ai-sidebar__process-label {
    color: #1d2129;
    font-size: 13px;
    font-weight: 600;
    line-height: 20px;
  }

  .ai-sidebar__process-primary {
    color: #4e5969;
    font-size: 13px;
    line-height: 20px;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .ai-sidebar__process-secondary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  .ai-sidebar__process-secondary-item {
    color: #86909c;
    font-size: 12px;
    line-height: 18px;
  }

  .ai-sidebar__process-arrow {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-top: 1.5px solid #86909c;
    border-right: 1.5px solid #86909c;
    transform: rotate(135deg);
    transform-origin: center;
    transition: transform 0.2s ease;
  }

  .ai-sidebar__process:not([open]) .ai-sidebar__process-arrow {
    transform: rotate(45deg);
  }

  .ai-sidebar__process-body {
    padding: 0 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ai-sidebar__process.is-initializing {
    min-height: 112px;
  }

  .ai-sidebar__process.is-initializing .ai-sidebar__process-summary {
    min-height: 56px;
  }

  .ai-sidebar__process.is-initializing .ai-sidebar__process-body {
    min-height: 44px;
    justify-content: center;
  }

  .ai-sidebar__thinking {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: #4e5969;
    font-size: 14px;
    line-height: 22px;
  }

  .ai-sidebar__thinking--process {
    padding: 2px 0 0;
  }

  .ai-sidebar__context-compaction-completed {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin: 4px 0 8px;
  }

  .ai-sidebar__thinking-dots {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    min-width: 18px;
  }

  .ai-sidebar__thinking-dot {
    display: inline-block;
    opacity: 0.35;
    animation: thinking-dot 1.2s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }

    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }

  .ai-sidebar__message-row {
    width: 100%;
    display: flex;
    margin-bottom: 8px;

    .ai-sidebar__message-content {
      width: 100%;
      max-width: 100%;
      display: flex;
      flex-direction: column;
    }

    .ai-sidebar__user-message-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .ai-sidebar__user-message-attachments {
      width: min(360px, 100%);
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-self: flex-end;
      margin-bottom: 8px;
    }

    .ai-sidebar__message-bubble-wrap {
      width: 100%;
      display: flex;
      justify-content: flex-end;
    }

    .ai-sidebar__message-bubble {
      max-width: min(228px, 100%);
      min-height: 36px;
      padding: 7px 10px;
      border-radius: 8px;
      background-color: #f2f3f5;
      color: #1d2129;
      font-size: 14px;
      line-height: 22px;
      word-break: break-word;

      &.is-inline-editing {
        width: 100%;
        max-width: 100%;
        padding: 8px;
        background-color: #fff;
        border: 1px solid #dcdfe6;
        white-space: normal;
      }
    }

    &.is-user {
      justify-content: flex-end;

      .ai-sidebar__message-content {
        align-items: flex-end;
      }

      &.is-inline-editing {
        .ai-sidebar__message-content {
          width: 100%;
        }
      }

      .ai-sidebar__message-bubble {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    }

    &.is-assistant {
      width: 100%;
      justify-content: flex-start;

      .ai-sidebar__message-content {
        width: 100%;
        min-width: 0;
      }

      .ai-sidebar__message-bubble {
        width: 100%;
        max-width: 100%;
        padding: 7px 0;
        background-color: transparent;
      }
    }

    &:last-child {
      margin-bottom: 26px;
    }
  }

  .ai-sidebar__composer {
    width: 100%;
    flex-shrink: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;

    &.has-login-prompt {
      gap: 0;
      border-radius: 16px;
      background: #f7f8fa;
    }
  }



  .ai-sidebar__inline-edit {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ai-sidebar__inline-edit-textarea {
    width: 100%;
    min-height: 88px;
    max-height: 220px;
    resize: vertical;
    box-sizing: border-box;
    border: 0;
    outline: none;
    padding: 2px;
    background: transparent;
    color: #1d2129;
    font: inherit;
    line-height: 22px;
  }

  .ai-sidebar__inline-edit-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .ai-sidebar__inline-edit-cancel,
  .ai-sidebar__inline-edit-submit {
    height: 28px;
    padding: 0 12px;
    border-radius: 6px;
    border: 1px solid #dcdfe6;
    background: #fff;
    color: #1d2129;
    font-size: 13px;
    line-height: 26px;
    cursor: var(--cursor-pointer);

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  .ai-sidebar__inline-edit-submit {
    border-color: #0873ff;
    background: #0873ff;
    color: #fff;
  }
}

.ai-preview-drawer {
  :deep(.el-drawer) {
    background-color: #fff;

    .el-drawer__header {
      margin-bottom: 0;
      padding: 0 16px;
      height: 48px;
      border-bottom: 1px solid #e5e6eb;
    }

    .el-drawer__body {
      padding: 0;
      overflow: hidden;
    }
  }
}

.ai-preview-drawer__header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #1d2129;
  font-size: 16px;
  line-height: 24px;
}

.ai-preview-drawer__body {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: auto;
  background: #fff;
}

.ai-preview-drawer__markdown {
  display: block;
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
}

.ai-preview-drawer__chart {
  width: 100%;
  min-width: 0;
  display: block;
  flex: 0 0 auto;
  min-height: 0;
}

.ai-preview-drawer__chart.ai-chart-block.is-preview {
  height: auto;
  min-height: 0;
}

.ai-preview-drawer__chart :deep(.ai-structured-result-card.is-preview) {
  height: auto;
  min-height: 0;
  flex: 0 0 auto;
}

.ai-preview-drawer__chart :deep(.ai-structured-result-card.is-preview .ai-structured-result-card__main) {
  flex: 0 0 auto;
  min-height: 0;
}

.ai-preview-drawer__table {
  width: 100%;
  min-width: 0;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.workbench-ai-target-app-dialog {
  :deep(.el-dialog__body) {
    padding: 8px 20px 12px;
  }

  :deep(.el-dialog__footer) {
    padding: 12px 20px 18px;
  }
}

.workbench-ai-target-app-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 260px;
}

.workbench-ai-target-app-dialog__search {
  width: 100%;
}

.workbench-ai-target-app-dialog__options {
  max-height: min(360px, 48vh);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px;
}

.workbench-ai-target-app-dialog__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workbench-ai-target-app-dialog__group-label {
  padding: 6px 2px 2px;
  color: #86909c;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.workbench-ai-target-app-dialog__option {
  width: 100%;
  min-height: 40px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #ffffff;
  color: #1d2129;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  cursor: var(--cursor-pointer);
  text-align: left;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.workbench-ai-target-app-dialog__option:hover:not(:disabled) {
  background: #f7f8fa;
}

.workbench-ai-target-app-dialog__option.is-selected {
  border-color: #bfd4f8;
  background: #eef6ff;
}

.workbench-ai-target-app-dialog__option:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.workbench-ai-target-app-dialog__option.is-unavailable {
  border-color: rgba(134, 144, 156, 0.16);
  background: #fbfcfd;
}

.workbench-ai-target-app-dialog__option-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #f2f3f5;
  color: #4e5969;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.workbench-ai-target-app-dialog__option-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.workbench-ai-target-app-dialog__option-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 22px;
}

.workbench-ai-target-app-dialog__option-note {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.workbench-ai-target-app-dialog__option-check {
  color: #0873ff;
  opacity: 0;
}

.workbench-ai-target-app-dialog__option-check.is-visible {
  opacity: 1;
}

.workbench-ai-target-app-dialog__state {
  min-height: 120px;
  color: #86909c;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  line-height: 20px;
}

.workbench-ai-target-app-dialog__state.is-error {
  color: #c45656;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

@keyframes thinking-dot {
  0%, 100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  50% {
    opacity: 1;
    transform: translateY(-1px);
  }
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
