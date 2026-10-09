<template>
  <div class="nocode-editor-ai-panel">
    <div class="panel-header">
      <div class="title">
        <div class="title-main">{{ $t('nocodeEditorAiPanel.aiAssistant') }}</div>
        <div class="title-sub">{{ $t('nocodeEditorAiPanel.aiAssistantIntro') }}</div>
      </div>
      <div class="panel-header__actions">
        <el-dropdown
          trigger="click"
          @command="handleConversationCommand"
          :disabled="isConversationActionDisabled"
        >
          <el-button
            class="conversation-actions-trigger"
            text
            :title="$t('nocodeEditorAiPanel.conversationActions')"
          >
            <el-icon :size="16"><i-ep-more-filled /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="export">{{ $t('nocodeEditorAiPanel.exportConversation') }}</el-dropdown-item>
              <el-dropdown-item v-if="isDev" command="import">{{ $t('nocodeEditorAiPanel.importConversation') }}</el-dropdown-item>
              <el-dropdown-item command="clear" divided>{{ $t('nocodeEditorAiPanel.clearConversation') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <input ref="conversationImportInputRef" type="file" accept=".zip" hidden @change="handleConversationImportFile" />
        <el-button
          v-if="props.closable"
          class="panel-header__close"
          text
          @click="emit('update:visible', false)"
        >
          <el-icon :size="16"><i-ep-close /></el-icon>
        </el-button>
      </div>
    </div>

    <div
      ref="messagesContainerRef"
      class="messages"
      :class="{ 'is-empty': showEmptyState }"
      @scroll="handleMessagesScroll"
    >
      <nocode-editor-ai-empty-state
        v-if="showEmptyState"
        :disabled="isPreparingSubmit || isResponding || isApplyingBlueprint || isRefreshingBlueprint"
      />
      <nocode-editor-ai-continuity-notice
        v-if="!showEmptyState && topLevelContinuityHints.length"
        class="messages-continuity-notice"
        :hints="topLevelContinuityHints"
      />
      <ai-message-item
        v-for="message in renderableMessages"
        :key="message.id"
        class="message-row"
        :role="message.role"
        variant="editor"
        content-class="message-stack"
        :bubble-class="getMessageBubbleClass(message)"
        @mouseenter="hoveredMessageId = message.id"
        @mouseleave="hoveredMessageId = ''"
      >
        <template
          #before
          v-if="message.role === NocodeEditorAiMessageRole.USER && editingUserMessageId !== message.id && getUserAttachments(message).length"
        >
          <div v-if="getUserExcelAttachments(message).length" class="user-message-attachment-list">
            <nocode-editor-ai-excel-attachment-card
              v-for="attachment in getUserExcelAttachments(message)"
              :key="`${message.id}-${attachment.id}`"
              :attachment="attachment"
              :is-expired="isExcelAttachmentExpired(attachment)"
              :create-disabled="isHistoryAttachmentCreateDisabled(attachment)"
              @create-form-from-attachment="handleCreateFormFromHistoryAttachment"
              @add-attachment-to-composer="handleAddHistoryAttachmentToComposer"
            />
          </div>
          <ai-message-attachment-list
            v-if="getUserGeneralAttachments(message).length"
            :attachments="getUserGeneralAttachments(message)"
            :content-url-resolver="getEditorAttachmentContentUrl"
          />
        </template>
        <template #bubble v-if="shouldShowMessageBubble(message)">
          <template v-if="message.role === NocodeEditorAiMessageRole.ASSISTANT">
            <div class="assistant-body">
              <nocode-editor-ai-continuity-notice
                v-if="getMessageContinuityHints(message).length"
                :hints="getMessageContinuityHints(message)"
                compact
              />
              <template v-if="hasRenderableAssistantMarkdown(message)">
                <div
                  v-for="(block, index) in getRenderableAssistantMarkdownBlocks(message)"
                  :key="`${message.id}-markdown-${index}`"
                  class="message-markdown"
                  v-shadow-markdown="renderAssistantMessage(block.text)"
                ></div>
              </template>
              <template
                v-for="summary in getRenderableFormulaActionSummaries(message)"
                :key="`${message.id}-formula-actions-${summary.title}`"
              >
                <div class="formula-result-card">
                  <div class="formula-result-card__header">
                    <div class="formula-result-card__heading">
                      <span class="formula-result-card__icon">fx</span>
                      <div class="formula-result-card__heading-main">
                        <div class="formula-result-card__title">{{ summary.title }}</div>
                        <div class="formula-result-card__summary">{{ resolveFormulaResultSummaryText(summary) }}</div>
                      </div>
                    </div>
                    <span class="formula-result-card__count">{{ summary.items.length }}{{ $t('nocodeEditorAiPanel.itemCountSuffix') }}</span>
                  </div>
                  <div
                    v-for="item in summary.items"
                    :key="resolveFormulaTargetResultKey(message, item)"
                    class="formula-result-card__item"
                    :class="{
                      'is-skipped': item.status === 'skipped',
                      'is-draft': item.status === 'draft',
                      'is-failed': item.status === 'failed',
                    }"
                  >
                    <template v-if="item.status === 'updated' || item.status === 'draft'">
                      <div class="formula-result-card__item-main">
                        <div class="formula-result-card__item-title">{{ resolveFormulaActionFieldName(item) }}</div>
                        <code class="formula-result-card__formula">{{ resolveFormulaActionDisplayFormula(item) }}</code>
                        <div v-if="resolveFormulaActionDescription(item)" class="formula-result-card__note">
                          {{ resolveFormulaActionDescription(item) }}
                        </div>
                      </div>
                      <el-button
                        v-if="item.status === 'updated'"
                        class="formula-result-card__action"
                        text
                        type="primary"
                        @click="handleOpenFormulaResultTarget(item)"
                      >{{ $t('nocodeEditorAiPanel.view') }}</el-button>
                      <span v-else class="formula-result-card__status">{{ $t('nocodeEditorAiPanel.written') }}</span>
                    </template>
                    <template v-else>
                      <div class="formula-result-card__item-main">
                        <div class="formula-result-card__item-title">{{ resolveFormulaActionFieldName(item) }}</div>
                        <div class="formula-result-card__note">{{ $t('nocodeEditorAiPanel.unchangedLabel') }}{{ item.reason }}</div>
                      </div>
                    </template>
                  </div>
                </div>
              </template>
              <div v-if="shouldShowAssistantThinking(message)" class="assistant-thinking">
                <span class="assistant-thinking__text">{{ $t('nocodeEditorAiPanel.thinking') }}</span>
                <span class="assistant-thinking__dots" aria-hidden="true">
                  <span class="assistant-thinking__dot">.</span>
                  <span class="assistant-thinking__dot">.</span>
                  <span class="assistant-thinking__dot">.</span>
                </span>
              </div>
              <div v-if="shouldShowContinueGenerationAction(message)" class="assistant-error-action">
                <el-button
                  size="small"
                  text
                  type="primary"
                  :loading="isContinuingGenerationFromError(message)"
                  :disabled="isContinueGenerationActionDisabled(message)"
                  @click="handleContinueGenerationFromError(message)"
                >
                  继续生成
                </el-button>
              </div>
            </div>
          </template>
          <template v-else-if="isImportedHandoffVisibleUserMessage(message)">
            <div class="imported-handoff-card">
              <div class="imported-handoff-card__header">
                <span class="imported-handoff-card__dot" aria-hidden="true"></span>
                <span class="imported-handoff-card__title">{{ $t('nocodeEditorAiPanel.workbenchHandoffRequest') }}</span>
              </div>
              <dl class="imported-handoff-card__fields">
                <template v-for="field in getImportedHandoffVisibleFields(message)" :key="field.label">
                  <dt>{{ field.label }}</dt>
                  <dd>{{ field.value }}</dd>
                </template>
              </dl>
              <div class="imported-handoff-card__footer">{{ $t('nocodeEditorAiPanel.handoffRequestTip') }}</div>
            </div>
          </template>
          <template v-else>
            <div
              v-if="editingUserMessageId === message.id"
              class="inline-edit"
            >
              <textarea
                ref="inlineEditTextareaRef"
                v-model="editingUserMessageDraft"
                class="inline-edit__textarea"
                rows="3"
                :disabled="isPreparingSubmit || isResponding || isApplyingFlow || isApplyingBlueprint || isRefreshingBlueprint"
              ></textarea>
              <div class="inline-edit__actions">
                <button type="button" class="inline-edit__cancel" @click="cancelEditUserMessage">{{ $t('nocodeEditorAiPanel.cancel') }}</button>
                <button
                  type="button"
                  class="inline-edit__submit"
                  :disabled="isPreparingSubmit || isResponding || isApplyingFlow || isApplyingBlueprint || isRefreshingBlueprint || (!editingUserMessageDraft.trim() && !editingUserMessageAttachments.length)"
                  @click="submitEditedUserMessage"
                >{{ $t('nocodeEditorAiPanel.send') }}</button>
              </div>
            </div>
            <div v-else class="user-message-content">
              <div v-if="message.content">{{ message.content }}</div>
            </div>
          </template>
        </template>

        <template #extra v-if="hasRenderableMessageExtra(message)">
          <template
            v-for="block in getRenderableLeadingArtifactBlocks(message)"
            :key="`${message.id}-${block.kind}-${block.version || block.revision || block.status || 'artifact-leading'}`"
          >
            <div class="artifact-message">
              <ai-artifact-card
                :block="block"
                :applying="isApplyingArtifactBlock(block)"
                @view="handleArtifactView"
              />
            </div>
          </template>
          <template
            v-for="(block, index) in getRenderableConfirmationBlocks(message)"
            :key="`${message.id}-${block.kind}-${block.version || block.revision || block.status || 'confirmation'}`"
          >
            <div class="artifact-message">
              <nocode-editor-ai-confirmation-card
                :block="block"
                :phase="getConfirmationCardPhase(message, block)"
                :state-message="getConfirmationCardStateMessage(block)"
                :presentation="index === 0 ? getConfirmationCardPresentation(message, block) : null"
                :response-drafts="getConfirmationResponseDrafts(block)"
                :active-input-question-ids="getActiveConfirmationInputQuestionIds(block)"
                :status-tag-text="getConfirmationStatusTagText(block)"
                :readonly-version="isReadonlyPlanningConfirmationBlock(block)"
                :version-tag-text="resolveDisplayVersionLabel(block)"
                :action-disabled="hasNewerUserMessageAfterMessage(messages, message.id)"
                @open="handleOpenConfirmationDrawer"
                @preview="handlePreviewConfirmationArtifact"
                @continue-defaults="handleContinueWithConfirmationDefaults"
                @submit-staged-responses="handleSubmitCardConfirmationResponses"
                @focus-input="handleFocusConfirmationQuestion"
                @select-option="handleSelectConfirmationOption"
              />
            </div>
          </template>
          <template
            v-for="block in getRenderableTrailingArtifactBlocks(message)"
            :key="`${message.id}-${block.kind}-${block.version || block.revision || block.status || 'artifact-trailing'}`"
          >
            <div class="artifact-message">
              <ai-artifact-card
                :block="block"
                :applying="isApplyingArtifactBlock(block)"
                @view="handleArtifactView"
              />
            </div>
          </template>
          <template
            v-for="draftIssueList in getRenderableDraftIssueActionLists(message)"
            :key="`${message.id}-draft-issue-action-list-${draftIssueList.updatedAt || 0}`"
          >
            <div class="artifact-message">
              <nocode-editor-ai-draft-issue-action-list
                :issues="draftIssueList.actionIssues"
                :summary="draftIssueList.summary"
                :resolved="draftIssueList.resolved"
                @locate="handleLocateDraftIssue"
              />
            </div>
          </template>
          <template
            v-for="flowIssueList in getRenderableFlowIssueActionLists(message)"
            :key="`${message.id}-flow-issue-action-list-${flowIssueList.updatedAt || 0}`"
          >
            <div class="artifact-message">
              <nocode-editor-ai-flow-issue-action-list
                :issues="flowIssueList.actionIssues"
                :summary="flowIssueList.summary"
                @locate="handleLocateFlowIssue"
              />
            </div>
          </template>
          <template
            v-for="(block, index) in getRenderableFlowPatchResultBlocks(message)"
            :key="`${message.id}-flow-patch-result-layout-v2-${block.formId}-${block.draftVersion}-${index}`"
          >
            <nocode-editor-ai-flow-patch-result-card
              :block="block"
              :loading="viewingFlowPatchResultKey === getFlowPatchResultKey(block)"
              :disabled="Boolean(viewingFlowPatchResultKey)"
              @view="handleViewFlowPatchResult"
            />
          </template>
        </template>
        <template #toolbar v-if="editingUserMessageId !== message.id && shouldShowMessageToolbar(message)">
          <workbench-ai-message-toolbar
            :content="message.content"
            :copy-content="getCopyableEditorMessageContent(message)"
            :loading="isResponding && message.content === getThinkingText()"
            :role="getMessageToolbarRole(message)"
            :create-time="message.createTime"
            :hovered="hoveredMessageId === message.id"
            show-on-hover-only
            :can-edit="canEditUserMessage(message)"
            @edit="handleEditUserMessage(message)"
          />
        </template>
      </ai-message-item>

      <div
        v-if="tailPostFormFlowFollowUpCard"
        ref="tailPostFormFlowTailCardRef"
        :key="`post-form-flow-tail-card-${tailPostFormFlowFollowUpCard.message.id}`"
        class="post-form-flow-tail-card"
      >
        <div class="post-form-flow-tail-card__header">
          <div class="post-form-flow-tail-card__heading">
            <div class="post-form-flow-tail-card__title">下一步建议</div>
          </div>
          <div class="post-form-flow-tail-card__badges">
            <span class="post-form-flow-tail-card__badge">
              {{ tailPostFormFlowFollowUpCard.stateTagText }}
            </span>
            <span
              v-if="tailPostFormFlowFollowUpCard.readinessTagText"
              class="post-form-flow-tail-card__badge post-form-flow-tail-card__badge--readiness"
              :class="`is-${tailPostFormFlowFollowUpCard.release?.status || 'ready'}`"
            >
              {{ tailPostFormFlowFollowUpCard.readinessTagText }}
            </span>
          </div>
        </div>
        <div class="post-form-flow-tail-card__body">
          <div class="post-form-flow-tail-card__description">
            {{ tailPostFormFlowFollowUpCard.descriptionText }}
          </div>
          <div
            v-if="tailPostFormFlowFollowUpCard.contextText"
            class="post-form-flow-tail-card__context"
          >
            {{ tailPostFormFlowFollowUpCard.contextText }}
          </div>
        </div>
        <div class="post-form-flow-tail-card__actions">
          <button
            type="button"
            class="post-form-flow-tail-card__action post-form-flow-tail-card__action--secondary"
            :disabled="isPostFormFlowTailCardActionDisabled"
            @click="handleIgnorePostFormFlowTailCard"
          >
            <span>{{ resolvePostFormFlowTailCardIgnoreLabel() }}</span>
          </button>
          <button
            type="button"
            class="post-form-flow-tail-card__action post-form-flow-tail-card__action--primary"
            :disabled="isPostFormFlowTailCardActionDisabled"
            @click="handleCreateFlowFromTailCard"
          >
            <span>{{ resolvePostFormFlowTailCardActionLabel(tailPostFormFlowFollowUpCard.followUp, tailPostFormFlowFollowUpCard.message) }}</span>
            <el-icon :size="16"><i-ep-arrow-right /></el-icon>
          </button>
        </div>
      </div>
    </div>

    <div
      class="panel-footer"
      ref="panelFooterRef"
      :key="tailPostFormFlowFollowUpCard
        ? `nocode-editor-ai-footer-with-tail-card-${tailPostFormFlowFollowUpCard.message.id}`
        : 'nocode-editor-ai-footer-base'"
    >
      <transition name="status-fade">
        <div v-if="liveStatus" class="live-status">
          <div class="live-status__icon">
            <el-icon class="is-loading" :size="16"><i-ep-loading /></el-icon>
          </div>
          <div class="live-status__content">
            <div class="live-status__title">{{ liveStatus.title }}</div>
            <div v-if="liveStatus.description" class="live-status__description">
              {{ liveStatus.description }}
            </div>
          </div>
        </div>
      </transition>
      <div
        key="nocode-editor-ai-composer"
        class="composer"
        :class="{ 'is-preparing': isPreparingSubmit }"
      >
        <transition name="fade">
          <button
            v-if="!isAtBottom"
            type="button"
            class="composer__scroll-bottom"
            @click="scrollToBottom(true)"
          >
            <el-icon :size="16"><i-ep-arrow-down /></el-icon>
          </button>
        </transition>
        <div class="composer__body" :class="{ 'has-login-prompt': showLoginPrompt }">
          <workbench-ai-login-prompt
            v-if="showLoginPrompt"
            :admin-only="showAdminLoginPrompt"
            @login="handleLoginClick"
            @other-options="handleOtherOptionsClick"
          />
          <workbench-ai-chat-input
            ref="chatInputRef"
            :model-value="draft"
            :emit-model-value-on-input="false"
            :attachments="composerAttachments"
            :attachment-upload-nocode-id="props.nocodeId"
            :attachment-accept="WORKBENCH_AI_ATTACHMENT_ACCEPT"
            :loading="isPreparingSubmit || isResponding || isApplyingFlow || isApplyingBlueprint || isRefreshingBlueprint"
            :placeholder="$t('nocodeEditorAiPanel.chatInputPlaceholder')"
            :show-app-selector="false"
            :show-model-selector="showModelSelector"
            :model-options="modelSelectorOptions"
            :selected-model-value="selectedModelValue"
            :model-label="currentModelLabel"
            :allow-model-selection="allowModelSelection && !isPreparingSubmit && !isResponding"
            :model-selection-loading="aiConfigStore.catalogLoading"
            :floating="false"
            @submit="handleSend"
            @model-change="handleModelChange"
            @select-attachment="handleComposerAttachmentSelect"
            @remove-attachment="handleComposerAttachmentRemove"
          />
        </div>
      </div>
    </div>

    <ai-artifact-preview-dialog
      v-model="previewDialogVisible"
      :block="previewArtifact"
      :app-name="props.appName"
      :blueprint-workbench-items="previewBlueprintWorkbenchItems"
      :blueprint-workbench-history-items="previewBlueprintWorkbenchHistoryItems"
      :blueprint-preview-focus-card-key="previewBlueprintSharedFocusCardKey"
      :flow-artifact-blocks="sessionFlowArtifactBlocks"
      :get-flow-confirmation-response-drafts="getConfirmationResponseDrafts"
      :get-flow-active-confirmation-input-question-ids="getActiveConfirmationInputQuestionIds"
      :get-flow-inline-confirmation-note-question-ids="getInlineConfirmationNoteQuestionIds"
      :can-apply-flow-artifact="canApplyFlowFromPreview"
      :is-applying-flow-artifact="isApplyingFlowArtifact"
      :can-apply-flow="previewCanApplyFlow"
      :applying-flow="previewFlowApplying"
      :can-apply-blueprint="previewCanApplyBlueprint"
      :can-continue-blueprint="previewCanContinueBlueprint"
      :applying-blueprint="previewBlueprintApplying"
      :confirmation-response-drafts="previewConfirmationResponseDrafts"
      :active-confirmation-input-question-ids="previewActiveConfirmationInputQuestionIds"
      :inline-confirmation-note-question-ids="previewInlineConfirmationNoteQuestionIds"
      :submitting-confirmation="isResponding || isPreparingSubmit"
      @apply-flow="handleApplyFlowFromPreview"
      @apply-blueprint="handleApplyBlueprintFromPreview"
      @continue-blueprint-adjustment="handleContinueBlueprintAdjustment"
      @continue-flow-defaults="handleContinueFlowWithDefaults"
      @select-confirmation-option="handleSelectBlueprintPreviewConfirmationOption"
      @toggle-note-input="handleToggleBlueprintPreviewInlineConfirmationInput"
      @toggle-flow-note-input="handleToggleFlowInlineConfirmationInput"
      @update-note="handleUpdateBlueprintPreviewInlineConfirmationNote"
      @update-flow-note="handleUpdateFlowInlineConfirmationNote"
      @submit-confirmation-responses="handleSubmitBlueprintConfirmationResponses"
      @submit-flow-confirmation-responses="handleSubmitFlowConfirmationResponses"
      @open-generated-page="openGeneratedBlueprintPage"
    />

    <nocode-editor-ai-blueprint-apply-confirm-dialog
      v-model="blueprintApplyConfirmDialogVisible"
      :title="blueprintApplyConfirmDialogTitle"
      :summary-text="blueprintApplyConfirmDialogSummary"
      :risk-text="blueprintApplyConfirmDialogRiskText"
      :recommendation-text="blueprintApplyConfirmDialogRecommendationText"
      :pending-question-count="blueprintApplyConfirmDialogPendingCount"
      :confirm-text="blueprintApplyConfirmDialogConfirmText"
      :cancel-text="blueprintApplyConfirmDialogCancelText"
      @confirm="handleBlueprintApplyConfirm"
      @cancel="handleBlueprintApplyCancel"
    />

    <nocode-editor-ai-confirmation-drawer
      v-model="confirmationDrawerVisible"
      :block="confirmationDrawerBlock"
      :readonly="isReadonlyPlanningConfirmationBlock(confirmationDrawerBlock)"
      :focus-question-id="confirmationDrawerFocusQuestionId"
      :response-drafts="confirmationDrawerDrafts"
      :status-tag-text="confirmationDrawerStatusTagText"
      :submitting="isPreparingSubmit || isResponding || isApplyingFlow || isApplyingBlueprint || isRefreshingBlueprint"
      @resume-chat="handleResumeConfirmationChat"
      @select-option="handleSelectConfirmationOptionFromDrawer"
      @update-note="handleUpdateConfirmationNote"
      @update-note-active="handleUpdateConfirmationNoteActive"
      @submit-responses="handleSubmitConfirmationResponses"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  AiAssistantFormulaResultItem,
  AiAssistantFormulaTargetResultItem,
  AiAssistantFlowPatchResultBlock,
  AiAssistantMarkdownBlock,
  AiAssistantMessageBlock,
} from '@common/types/ai'
import type {
  AiAttachment,
  AiAttachmentIntentHint,
  AiAttachmentReference,
  AiAttachmentSelectionEventPayload,
  AiAttachmentUploadHandle,
} from '@common/types/aiAttachment'
import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiPlanningContinuation,
  NocodeEditorAiConfirmQuestionOption,
} from '@common/types/nocodeEditorConfirmation'
import {
  parseAiAssistantMessageContent,
  resolveAiAssistantMessageBlocks,
  serializeAiAssistantMessageBlocks,
} from '@common/utils/aiMessageBlocks'
import {
  buildAiAttachmentFallbackRequestText,
  buildAiAttachmentIntentSummary,
  buildAiAttachmentMessageMetadata,
  buildAiAttachmentPromptLines,
  hasExcelLikeAttachment,
  hasAiAttachmentUploadHandle,
  normalizeAiAttachmentMessageMetadata,
  normalizeAiAttachmentReference,
  replaceCurrentExcelAttachment,
  resolveAiAttachmentIntent,
  resolveAiAttachmentImportSourcePath,
  resolveLatestExcelAttachment,
  resolveUniqueReadyExcelAttachment,
  stripAiAttachmentFileExtension,
} from '@common/utils/aiAttachmentIntent'
import { WORKBENCH_AI_ATTACHMENT_ACCEPT } from '@common/utils/aiAttachmentFormats'
import {
  buildAiExcelCreateCompletionMetadata,
  cloneAiExcelAttachmentForComposer,
  collectAiExcelCreateCompletionAttachmentIds,
} from '@common/utils/aiExcelCreateFormState'
import type { AiExcelAnalysisConfirmPayload } from '@common/types/aiExcelAnalysis'
import { buildAiExcelAnalysisRequestPayload } from '@common/utils/aiExcelAnalysis'
import {
  resolveAiExcelAnalysisFollowupBehavior,
  resolveLatestAiExcelAnalysisContext,
} from '@common/utils/aiExcelAnalysis'
import { normalizeNocodeEditorContentPlan } from '@common/utils/nocodeEditorContentPlan'
import {
  hasPendingNocodeEditorFlowPlanQuestions,
  normalizeNocodeEditorFlowPlan,
} from '@common/utils/nocodeEditorFlowPlan'
import {
  normalizeNocodeEditorFlowScheme,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  normalizeFlowIssueRoutingResult,
} from '@common/utils/nocodeEditorFlowIssueRouter'
import {
  resolveFlowGroundingReturnFlowSchemeTitle,
} from '@common/utils/nocodeEditorFlowGroundingReturnToPlan'
import {
  containsTechnicalFlowText,
  normalizeVisibleFlowGroundingQuestions,
} from '@common/utils/nocodeEditorFlowGroundingPresentation'
import {
  buildFlowSchemeConvergenceResultSummary,
  decorateFlowSchemeWithConvergence,
  type FlowSchemeConvergenceGroundingDiagnostic,
} from './flowSchemeConvergence'
import {
  findFlowSchemeArtifactIndexForPlanningContext,
  isFlowPlanApplyContextReady,
  isLegacyFlowSchemeGuardPlaceholderArtifact,
  resolveFlowSchemeArtifactSyncDecision,
} from './flowSchemeArtifactState'
import {
  markFlowSchemeReplannedInCurrentTurn,
  shouldBlockFlowBlueprintUntilSchemeReplanned,
} from './flowBlueprintReplanGate'
import {
  buildContinueGenerationRequest,
  isUserMessageCommitAck,
  resolveNocodeEditorStreamErrorRecovery,
  resolveMessageTraceId,
  resolveSubmitFailureResult,
  shouldKeepCommittedConfirmation,
} from './streamErrorRecovery'
import {
  normalizeNocodeEditorAiMessageHistory,
  sortNocodeEditorAiMessageHistory,
} from '@common/utils/nocodeEditorAiMessageHistory'
import {
  findNocodeEditorArtifactBlockMergeIndex,
  getNocodeEditorArtifactBlockMergeKey,
  mergeNocodeEditorArtifactBlocks,
  normalizeNocodeEditorArtifactBlocks,
} from '@common/utils/nocodeEditorArtifactBlocks'
import {
  mergeNocodeEditorFormulaActions,
  mergeNocodeEditorFormulaTargetResults,
  normalizeNocodeEditorFormulaActions,
  normalizeNocodeEditorFormulaTargetResults,
} from '@common/utils/nocodeEditorFormulaActions'
import {
  buildNocodeEditorSingleFormPlanPromptSummary,
  isNocodeEditorCompleteNewFormIntent,
} from '@common/utils/nocodeEditorSingleFormPlan'
import {
  isNocodeEditorAppCreationIntent,
} from '@common/utils/nocodeEditorPlanningScope'
import {
  shouldResolveNocodeEditorTaskContextForMessage,
} from '@common/utils/nocodeEditorTaskContextRequest'
import {
  buildNocodeEditorPostFormFlowFollowUpMessageLines,
  decideNocodeEditorPostFormFlowOpportunity,
  decideNocodeEditorPostFormFlowFollowUp,
  buildNocodeEditorPendingFlowIntentFromEntryFlowIntent,
  buildNocodeEditorPostFormFlowInlineMessageLines,
  NOCODE_EDITOR_POST_FORM_FLOW_FOLLOW_UP_AUTO_CONTINUE_MESSAGE,
  matchNocodeEditorPendingFlowIntentTarget,
  normalizeNocodeEditorPendingFlowIntent,
  normalizeNocodeEditorPostFormFlowFollowUp,
  normalizeNocodeEditorFlowIntentSignal,
  isNocodeEditorPostFormFlowEnabledForScope,
  normalizeNocodeEditorPlanningScopeValue,
  resolveNocodeEditorPlanningScope,
  resolveNocodeEditorRepeatBlueprintClarification,
  resolveNocodeEditorFlowEntryIntent,
  resolveNocodeEditorFlowEntryIntentWithSignal,
  shouldAutoContinueNocodeEditorPlanningWithoutConfirmation,
  shouldContinueCurrentPlanningChain,
} from '@common/utils'
import {
  shouldPreferAppliedFormEditingOverPendingBlueprint,
} from '@common/utils/nocodeEditorAppliedBlueprintRouting'
import {
  normalizeNocodeEditorPostFormFlowRelease,
  resolveNocodeEditorPostFormFlowRelease,
  type NocodeEditorPostFormFlowRelease,
} from '@common/utils/nocodeEditorPostFormFlowRelease'
import {
  buildNocodeEditorPostFormFlowReleaseContext,
  normalizeLatestFormulaTargetResults,
  type FormulaTargetResultLike,
} from './postFormFlowReleaseContext'
import {
  collectPendingBlueprintApplyBatches,
  collectPendingBlueprintIdentityKeysByTargetFormKeys,
  collectPendingBlueprintWorkspace,
} from './pendingBlueprintWorkspace'
import {
  collectSyncedAppliedFlowArtifactDraftIdentityKeys,
  shouldHideAppliedFlowArtifactInActionMessage,
  syncActionAppliedFlowHistory,
} from './flowAppliedArtifactHistory'
import { shouldUseSharedBlueprintPreviewWorkbench } from './blueprintPreviewWorkbenchMatch'
import { resolveBlueprintPreviewInitialFocusCardKey } from './blueprintPreviewArtifactAdapter'
import {
  buildLogicalPlanningConfirmationContextKey,
  buildPlanningConfirmationContextKey,
  canFallbackToTraceScopedPlanningConfirmation,
  isSamePlanningConfirmationContext,
} from '@common/utils/nocodeEditorPlanningConfirmationIdentity'
import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'
import {
  resolveNocodeEditorPlanningQuestionProjection,
} from '@common/utils/nocodeEditorPlanningQuestionProjection'
import {
  normalizeNocodeEditorFormulaPlan,
} from '@common/utils/nocodeEditorFormulaDomain'
import {
  resolveSingleFormPlanningDisplayTitle,
} from '@common/utils/nocodeEditorPlanningTitle'
import {
  buildLegacyNocodeEditorAiConversationId,
  buildNocodeEditorAiConversationId,
  shouldResumeNocodeEditorAiConversation,
} from '@common/utils/nocodeEditorAiConversation'
import {
  createNextNocodeEditorTaskSeed,
  pickNocodeEditorAiTaskRestoreCandidate,
  resolveNocodeEditorAiBoundConversationId,
  resolveNocodeEditorAiSubmitTaskSource,
  resolveNocodeEditorTaskScopeKeyFromContext,
  shouldStartNewNocodeEditorConversationForImportedHandoff,
  shouldReuseNocodeEditorAiCurrentConversationForTask,
  shouldSkipNocodeEditorAiConversationReset,
} from '@common/utils/nocodeEditorAiTaskSession'
import {
  resolveNocodeEditorBlueprintDisplayTitle,
} from '@common/utils/nocodeEditorBlueprintTitle'
import {
  getNocodeEditorPendingContinueLabel,
} from '@common/utils/nocodeEditorConfirmationCopy'
import {
  normalizeNocodeEditorConfirmationPayload,
} from '@common/utils/nocodeEditorConfirmationNormalization'
import {
  projectBlueprintConfirmation,
} from '@common/utils/nocodeEditorBlueprintConfirmationProjection'
import {
  buildSharedAppPlanConfirmationCardPresentation,
  buildSharedFormPlanConfirmationCardPresentation,
} from '@common/utils/nocodeEditorConfirmationCardPresentation'
import {
  isBlueprintAppliedDraftPhase,
  isBlueprintAppliedPhase,
  isBlueprintStagedPhase,
} from '@common/utils/nocodeEditorBlueprintLifecycle'
import {
  createAppliedDraftBlueprintState,
  createAppliedSavedBlueprintState,
  createStagedBlueprintState,
} from './blueprintLifecycle'
import axios from 'axios'
import i18next from 'i18next'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { ElMessage, ElMessageBox } from 'element-plus'
import MarkdownIt from 'markdown-it'
import { computed, inject, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAiConfigStore, useDialogStore, usePassportStore } from '@renderer/stores'
import { createNocodeEditorAiTaskStore } from '@renderer/utils/storage'
import {
  clearNocodeEditorBuilderAttachments,
  takeNocodeEditorBuilderAttachments,
} from '@renderer/utils/nocodeEditorBuilderAttachmentTransfer'
import {
  clearNocodeEditorBuilderModelSelection,
  peekNocodeEditorBuilderModelSelection,
} from '@renderer/utils/nocodeEditorBuilderModelSelectionTransfer'
import AiArtifactCard from '@renderer/views/nocode/components/ai/AiArtifactCard.vue'
import AiMessageItem from '@renderer/views/nocode/components/ai/AiMessageItem.vue'
import AiMessageAttachmentList from '@renderer/views/nocode/components/ai/AiMessageAttachmentList.vue'
import AiArtifactPreviewDialog from '@renderer/views/nocode/components/ai/AiArtifactPreviewDialog.vue'
import NocodeEditorAiBlueprintApplyConfirmDialog from './components/NocodeEditorAiBlueprintApplyConfirmDialog.vue'
import NocodeEditorAiEmptyState from './NocodeEditorAiEmptyState.vue'
import NocodeEditorAiContinuityNotice from './components/NocodeEditorAiContinuityNotice.vue'
import NocodeEditorAiConfirmationCard from './components/NocodeEditorAiConfirmationCard.vue'
import NocodeEditorAiConfirmationDrawer from './components/NocodeEditorAiConfirmationDrawer.vue'
import NocodeEditorAiDraftIssueActionList from './components/NocodeEditorAiDraftIssueActionList.vue'
import NocodeEditorAiFlowIssueActionList from './components/NocodeEditorAiFlowIssueActionList.vue'
import NocodeEditorAiFlowPatchResultCard from './components/NocodeEditorAiFlowPatchResultCard.vue'
import NocodeEditorAiExcelAttachmentCard from './components/NocodeEditorAiExcelAttachmentCard.vue'
import {
  resolveConfirmationStatusTagText,
} from './components/confirmationStatusTag'
import {
  extractConfirmationCompanionPresentation,
  isConfirmationCompanionResidualText,
  mergeConfirmationPresentation,
  stripConfirmationCompanionSections,
  deriveConfirmationPresentationFromArtifactBlock,
  type NocodeEditorAiConfirmationPresentation,
} from './components/confirmationPresentation'
import {
  buildConfirmationBatchReplyMessage,
  buildConfirmationResponseAnswerDetail,
  buildConfirmationResponseAnswerSummary,
  buildConfirmationResponseDrafts,
  buildFlowSchemeConfirmationContinuationRequestMetadata,
  buildStagedConfirmationResponses,
  countUnansweredConfirmationQuestions,
  deriveDefaultCompletedConfirmationFromReplyMessage,
  deriveCompletedConfirmationFromReplyMessage,
  hasMeaningfulConfirmationResponse,
  isStructuredConfirmationReplyMessage,
  toggleConfirmationResponseDraftOption,
  type NocodeEditorAiConfirmationResponseDraftMap,
  type NocodeEditorAiConfirmationResponse,
} from './components/confirmationInteraction'
import { isAiTimelineHiddenMessage } from '@renderer/views/nocode/components/ai/messageVisibility'
import {
  type AiArtifactConfirmationQuestion,
  canPreviewAiArtifact,
  doesBlueprintArtifactShareDraftIdentity,
  doesBlueprintArtifactMatchStagedState,
  isAiArtifactBlock,
  resolveAiArtifactContinueLabel,
  resolveAiArtifactConfirmation,
  resolveAiArtifactConfirmationStatus,
  resolveAiArtifactNocodeId,
  resolveAiArtifactPendingQuestions,
  resolveAiArtifactPendingQuestionCount,
  resolveAiArtifactQuestions,
  resolveAiArtifactTitle,
  resolveAiArtifactVersionLabel,
  shouldRenderAiArtifactInlineConfirmation,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import {
  buildBlueprintDisplayVersionIndex,
  buildBlueprintSourcePlanningContextKeyIndex,
  buildPlanningDisplayVersionIndex,
  resolveBlueprintDisplayRevision,
  resolveBlueprintDisplayVersionLabel,
  resolveFormulaPlanDisplayVersionLabel,
  resolvePlanningArtifactDisplayRevision,
  resolvePlanningArtifactDisplayVersionLabel,
  rewriteArtifactSummaryDisplayVersionText,
  withBlueprintSourcePlanningContext,
} from './planningDisplayVersion'
import {
  buildPlanningContinuationContext,
  resolvePlanningRestoreAnchorContextKey,
} from './planningContinuationContext'
import {
  reconcilePlanningArtifactConfirmation,
} from './planningArtifactConfirmationSync'
import {
  buildNocodeEditorFormulaPlanLoadingPresentation,
  buildNocodeEditorFormulaPlanPresentation,
} from './formulaPlanPresentation'
import {
  buildNocodeEditorAiSolutionPresentation,
  extractNocodeEditorPlanningArtifactsFromContent,
  normalizeNocodeEditorAiPlanningArtifacts,
  type NocodeEditorAiPlanningArtifact,
} from '@renderer/views/nocode/components/ai/solutionArtifactPresentation'
import { vShadowMarkdown } from '../../workbench/AI/shadowMarkdownDirective'
import WorkbenchAiChatInput from '../../workbench/AI/components/WorkbenchAiChatInput.vue'
import WorkbenchAiLoginPrompt from '../../workbench/AI/components/WorkbenchAiLoginPrompt.vue'
import WorkbenchAiMessageToolbar from '../../workbench/AI/components/WorkbenchAiMessageToolbar.vue'
import { AiMessageRole as WorkbenchAiMessageRole } from '../../workbench/AI/types'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
  NocodeEditorAiAppliedBlueprintSnapshot,
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiArtifactBlockStatus,
  NocodeEditorAiBlueprintApplyResult,
  NocodeEditorAiChatRequest,
  NocodeEditorAiChatStreamPayload,
  NocodeEditorAiClientToolResultRequest,
  NocodeEditorAiContinuityHint,
  NocodeEditorAiConversationMessagesPayload,
  NocodeEditorAiDraftActionIssue,
  NocodeEditorAiDraftPersistenceState,
  NocodeEditorAiBlueprintApplyScope,
  NocodeEditorAiFlowActionIssue,
  NocodeEditorAiGeneratedBlueprintPageTarget,
  NocodeEditorAiImportedHandoffContext,
  NocodeEditorAiFlowApplyResult,
  NocodeEditorAiFlowIssueState,
  NocodeEditorAiFlowRuntimeIssueVerdict,
  NocodeEditorAiLatestConversationPayload,
  NocodeEditorAiMessage,
  NocodeEditorPendingFlowIntent,
  NocodeEditorAiRuntime,
  NocodeEditorAiStageBlueprintDisplayItem,
  NocodeEditorAiStagedAppPlan,
  NocodeEditorAiStagedAppBlueprint,
  NocodeEditorAiStagedFlowScheme,
  NocodeEditorAiStagedFlowPlan,
  NocodeEditorAiStagedFormPlan,
  NocodeEditorAiStagedFormulaPlan,
  NocodeEditorAiTaskContext,
  NocodeEditorAiTaskSeed,
  NocodeEditorAiThreadMessage,
  NocodeEditorAiTimelineMeta,
  NocodeEditorAiSettingContextHost,
} from './types'
import type { AiThreadModelSelection } from '@common/types/ai-provider'
import { BUILTIN_AI_PROVIDER_ID, resolveThreadModelSelectorValue } from '@common/utils/aiProvider'
import {
  NocodeEditorAiMessageRole,
  NocodeEditorAiStreamEventType,
} from './types'
import { resolveNocodeEditorStageLoadingState } from './stageLoadingState'
import { reduceNocodeEditorAssistantContent } from './streamContentState'
import { resolveNocodeEditorDonePresentation } from './streamDoneState'
import { resolveFlowBlueprintPreflightToolResultLoadingBlock } from './flowBlueprintPreflightLoading'
import { computePostFormFlowTailCardViewportAdjustment } from './postFormFlowTailCardViewport'
import {
  applyNocodeEditorToolResultSummaryToAssistantContent,
  shouldMergeNocodeEditorToolResultBlocks,
} from './streamToolResultState'
import {
  buildBlueprintApplyNarrationContent,
  formatBlueprintApplyDetectedFormsMessage,
  formatBlueprintApplyFormProgressMessage,
  formatBlueprintApplyProgressMessage,
  formatBlueprintApplyResultMessage as formatBlueprintApplyResultMessageFromHelper,
} from './blueprintApplyResultMessage'
import { buildBlueprintAdjustmentPrompt } from './blueprintAdjustmentPrompt'
import { buildBlueprintArtifactVersionFromParts } from './blueprintArtifactIdentity'
import { resolveReadyFlowArtifactBlocks } from './blueprintFlowArtifactMatcher'
import {
  doesAppPlanArtifactMatchStagedState,
  resolveAppPlanArtifactSyncDecision,
} from './appPlanArtifactState'
import {
  resolvePlanningCardPhase,
  type MatchedPlanningBlueprintSignal,
  type PlanningCardPhase,
} from './planningCardPhase'
import { resolvePlanningArtifactDisplayState } from './planningArtifactDisplay'
import { shouldPlanningSupersedeBlueprint } from './planningBlueprintSupersession'
import {
  FLOW_BLUEPRINT_AUTO_CONTINUE_MESSAGE,
  shouldAutoContinueFlowBlueprintFromScheme,
} from './flowSchemeAutoContinue'
import { buildFlowBlueprintInternalContinuationKey } from '@common/utils/nocodeEditorFlowInternalContinuation'
import { buildArtifactBlocksFromPersistedToolMessage } from './toolMessageArtifactRestore'
import { pickPreferredPlanningRestoreCandidate } from './planningArtifactRestoreSelection'
import {
  pruneStaleSummaryStageBlocks,
  resolveIncomingSummaryStage,
} from './summaryStageBlockPrune'
import { resolveActiveFlowIssueState as resolveRenderableActiveFlowIssueState } from './flowIssueStateSelection'
import {
  resolveFlowActionIssueFormId,
  resolveFlowActionIssueListByResolvedFormIds,
  resolveResolvedFlowActionFormIds,
} from './flowIssueActionList'
import {
  resolveGeneratedBlueprintOpenTarget,
  shouldStopPendingBlueprintBatch,
} from './blueprintWorkbenchActions'
import { applyBlueprintWithUnsavedFormRecovery } from './blueprintUnsavedFormRecovery'
import {
  buildScopedBlueprintByApplyResult,
  buildScopedBlueprintByTargetFormKeys,
  isSameBlueprintApplyScope,
} from './blueprintApplyScope'
import {
  resolveActiveNocodeEditorIndustrySkeletonContext,
} from './nocodeEditorIndustrySkeletonCarryover'
import type { AppBuilderHandoff } from '@common/types/appBuilderHandoff'
import {
  buildResolvedDraftPersistenceState,
  isDraftPersistenceStateResolved,
  normalizeDraftPersistenceState,
  normalizeFormDesignValidationIssuesToActionIssues,
} from './draftIssueActionList'
import {
  getNocodeEditorAiBlueprintArtifactPlanningContextKey as getBlueprintArtifactPlanningContextKey,
  getNocodeEditorAiBlueprintIdentityKey as getBlueprintIdentityKey,
  getNocodeEditorAiBlueprintLineageKey as getBlueprintLineageKey,
} from './blueprintArtifactIdentity'
import {
  isImportedHandoffConversationSnapshotCurrent,
  type ImportedHandoffImportState,
  resolveFetchedAppBuilderHandoffResponse,
  resolveImportedHandoffImportState,
  suppressImportedHandoffArtifactBlocks,
  shouldSuppressImportedHandoffArtifacts,
} from './appBuilderHandoffImport'
import {
  buildImportedHandoffComposerAttachments,
  buildImportedHandoffRequestMetadata,
  buildImportedHandoffVisibleUserMetadata,
  buildImportedHandoffVisibleUserMessage,
  IMPORTED_HANDOFF_AUTO_REPLAY_FLAG,
  isImportedHandoffVisibleUserMessage,
  shouldAutoReplayImportedHandoff,
} from './appBuilderHandoffAutoReplay'
import {
  buildWorkbenchHandoffContinuityHint,
  type WorkbenchHandoffBootstrapPhase,
} from './appBuilderHandoffOpenExperience'
import {
  getNocodeEditorBlueprintFormApplyTargetIdentity,
} from '@common/utils/nocodeEditorBlueprintFormNormalization'
import {
  discardNocodeEditorInternalContinuationDeduplicatedAssistant,
  reconcileDoneAssistantAuthoritativeMessages,
} from './doneAssistantAuthoritativeReconcile'
import { shouldForceFlowPlanAuthoritativeReloadAfterDone } from './doneAssistantReloadPolicy'
type ChatInputHandle = {
  focusTextarea?: () => Promise<void>
  setValue?: (value: string) => void
  updateTextareaHeight?: () => void
}

type StartExcelFormCreatePayload = Pick<AiAttachmentUploadHandle, 'fullPath' | 'sessionId' | 'originFilePath'> & {
  name?: string
  formName?: string
  attachmentId?: string
}

type StartExcelFileAnalysisPayload = Partial<StartExcelFormCreatePayload> & {
  visibleUserContent: string
  requestMetadata?: Record<string, unknown>
}

type ExcelCreateCompletionPayload = {
  formName: string
  importFieldCount: number
  successCount: number
  totalCount: number
  failedCount: number
  attachmentId?: string
}

type ComposerAttachmentRouteDecision =
  | {
      mode: 'submit'
      requestContent: string
      visibleUserContent: string
      visibleUserMetadata?: Record<string, unknown>
      requestMetadata?: Record<string, unknown>
    }
  | {
      mode: 'start-excel-create'
      userFacingContent: string
      userMetadata?: Record<string, unknown>
      assistantReply: string
      excelAttachment?: StartExcelFormCreatePayload
    }
  | {
      mode: 'start-excel-analysis'
      userFacingContent: string
      userMetadata?: Record<string, unknown>
      excelAttachment?: StartExcelFormCreatePayload
    }
  | {
      mode: 'local-reply'
      userFacingContent: string
      userMetadata?: Record<string, unknown>
      assistantReply: string
    }

type SubmitMessageResult = 'not_started' | 'completed' | 'aborted' | 'aborted_after_user_message_persisted' | 'failed' | 'failed_after_user_message_persisted'
type SubmitStagedConfirmationResponsesResult = 'completed' | 'committed' | 'skipped' | 'failed'
type SubmitEditorTurnFromTextAndAttachmentsMode = ComposerAttachmentRouteDecision['mode'] | 'direct-submit' | 'none'
type SubmitEditorTurnFromTextAndAttachmentsResult = {
  result: SubmitMessageResult
  mode: SubmitEditorTurnFromTextAndAttachmentsMode
}
type NocodeEditorAiSolutionOutlineWithConfirmation = NonNullable<NocodeEditorAiArtifactBlock['outline']> & {
  confirmation?: NocodeEditorAiConfirmPayload | null
}
type ConfirmationLocalStateSnapshot = {
  responseDrafts: NocodeEditorAiConfirmationResponseDraftMap
  inlineNoteQuestionIds: string[]
  inlineNoteDrafts: Record<string, string>
}
type NocodeEditorAiFormulaActionItem = AiAssistantFormulaResultItem
type NocodeEditorAiFormulaTargetResultItem = AiAssistantFormulaTargetResultItem
type NocodeEditorAiFormulaActionSummary = {
  title: string
  items: NocodeEditorAiFormulaTargetResultItem[]
}
type NormalizedPostFormFlowFollowUp = NonNullable<ReturnType<typeof normalizeNocodeEditorPostFormFlowFollowUp>>
type NocodeEditorPostFormFlowTailCard = {
  message: NocodeEditorAiMessage
  followUp: NormalizedPostFormFlowFollowUp
  release: NocodeEditorPostFormFlowRelease | null
  statusSummary: string
  stateTagText: string
  readinessTagText: string
  descriptionText: string
  contextText: string
}


const getThinkingText = () => i18next.t('nocodeEditorAiPanel.thinkingWithEllipsis')
const getThinkingDescription = () => i18next.t('nocodeEditorAiPanel.thinkingDescription')
const BLUEPRINT_APPLY_UI_FEEDBACK_DELAY_MS = 320
const FLOW_BLUEPRINT_AUTO_CONTINUE_DELAY_MS = 240
const getFlowBlueprintExpansionLoadingMessage = () => i18next.t('nocodeEditorAiPanel.expandingFlowBlueprint')
const LEGACY_NOT_SUGGESTED_POST_FORM_FLOW_MESSAGE_LINES = [
  '暂不建议现在继续创建流程，先把表单结构和使用方式再确认会更稳妥。',
]

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  visible: boolean
  nocodeId: string
  runtime: NocodeEditorAiRuntime
  appName?: string
  blueprintWorkbenchItems?: NocodeEditorAiStageBlueprintDisplayItem[]
  blueprintWorkbenchHistoryItems?: NocodeEditorAiStageBlueprintDisplayItem[]
  closable?: boolean
  autofocus?: boolean
  draftPersistenceState?: NocodeEditorAiDraftPersistenceState | null
  flowIssueRuntimeVerdict?: NocodeEditorAiFlowRuntimeIssueVerdict | null
}>(), {
  appName: '',
  blueprintWorkbenchItems: () => [],
  blueprintWorkbenchHistoryItems: () => [],
  closable: true,
  autofocus: true,
  draftPersistenceState: null,
  flowIssueRuntimeVerdict: null,
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'start-excel-form-create', payload?: StartExcelFormCreatePayload): void
  (event: 'start-excel-file-analysis', payload?: StartExcelFileAnalysisPayload): void
  (event: 'thread-change', threadId: string): void
  (event: 'thread-list-change'): void
  (event: 'flow-issue-state-change', state: NocodeEditorAiFlowIssueState | null): void
  (event: 'app-renamed', name: string): void
  (event: 'blueprint-applied', payload: NocodeEditorAiAppliedBlueprintSnapshot): void
  (event: 'applied-blueprints-imported'): void
  (event: 'staged-state-change', payload: {
    formPlanOutline: NocodeEditorAiStagedFormPlan['outline']
    appPlanOutline: NocodeEditorAiStagedAppPlan['plan'] extends infer T
      ? T extends { outline?: infer TOutline | null }
        ? TOutline | null
        : null
      : null
    blueprint: NocodeEditorAiStagedAppBlueprint['blueprint']
    pendingBlueprints?: NocodeEditorAiStageBlueprintDisplayItem[]
    pendingBlueprintHistory?: NocodeEditorAiStageBlueprintDisplayItem[]
    planningDisplayVersionByContextKey?: Record<string, number>
    flowArtifactBlocks?: NocodeEditorAiArtifactBlock[]
    blueprintDraftPersistenceState?: NocodeEditorAiDraftPersistenceState | null
    formPlanRevision: number
    appPlanRevision: number
    blueprintRevision: number
    blueprintApplying?: boolean
    blueprintLoading?: boolean
    blueprintLoadingMessage?: string
  }): void
}>()

const route = useRoute()
const router = useRouter()
const aiConfigStore = useAiConfigStore()
const passportState = usePassportStore()
const dialogState = useDialogStore()
const showAdminLoginPrompt = computed(() => (
  passportState.isLoginAccount && !passportState.isMainAccount
))
const showLoginPrompt = computed(() => (
  !aiConfigStore.catalogLoading
  && (!passportState.isLoginUser || showAdminLoginPrompt.value)
  && !aiConfigStore.modelOptions.some(item => item.modelSelectionSource === 'explicit')
))
const handleLoginClick = () => dialogState.show('loginDialogVisible')
const handleOtherOptionsClick = () => {
  router.push({
    name: 'Organize',
    query: { tab: 'aiModelManage' },
  })
}
const modelSelectionSource = ref<'default' | 'explicit'>('explicit')
const selectedProviderId = ref('')
const selectedModelId = ref('')
const selectedModel = ref('')
const persistedConversationModelSelectionSource = ref<'default' | 'explicit' | null>(null)
let modelSelectionChangeToken = 0
let modelSelectionSaveRequest: Promise<AiThreadModelSelection> | null = null
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
const resolveSavedModelOption = () => {
  if (modelSelectionSource.value !== 'explicit' && modelSelectionSource.value !== 'default') {
    return null
  }
  const providerId = selectedProviderId.value || (
    modelSelectionSource.value === 'default' ? aiConfigStore.catalog.defaultProviderId : ''
  )
  const modelId = selectedModelId.value || (
    modelSelectionSource.value === 'default' ? aiConfigStore.catalog.defaultModelId : ''
  )
  const model = selectedModel.value || ''
  if (!providerId && !modelId && !model) {
    return null
  }
  return modelSelectorOptions.value.find(option => (
    (!providerId || option.providerId === providerId)
    && (modelId ? option.modelId === modelId : (!model || option.model === model))
  )) || null
}
const savedModelOption = computed(() => resolveSavedModelOption())
const temporaryFallbackModelOption = computed(() => (
  savedModelOption.value ? null : firstExplicitModelOption.value
))
const effectiveModelOption = computed(() => (
  savedModelOption.value || temporaryFallbackModelOption.value
))
const selectedModelValue = computed(() => resolveThreadModelSelectorValue(
  effectiveModelOption.value?.modelSelectionSource,
  effectiveModelOption.value,
))
const currentModelLabel = computed(() => (
  effectiveModelOption.value?.label || ''
))
const hasSendableModel = computed(() => Boolean(effectiveModelOption.value))
const showNoAvailableModelMessage = () => {
  ElMessage.warning(i18next.t('nocodeEditorAiPanel.noAvailableModel'))
}
const canSubmitAiMessage = (showMessage = true) => {
  if (aiConfigStore.catalogLoading) return false
  if (hasSendableModel.value) return true
  if (showMessage) {
    showNoAvailableModelMessage()
  }
  return false
}
const allowModelSelection = computed(() => (
  aiConfigStore.catalog.enabled && aiConfigStore.catalog.allowModelSelection
))
const showModelSelector = computed(() => allowModelSelection.value)
const handleModelChange = async (value: string) => {
  const option = modelSelectorOptions.value.find(item => item.value === value)
  if (!option) return
  const sameSelection = modelSelectionSource.value === 'explicit'
    && selectedProviderId.value === option.providerId
    && selectedModelId.value === option.modelId
    && selectedModel.value === option.model
  if (sameSelection) return

  const previousSelection: AiThreadModelSelection = {
    modelSelectionSource: modelSelectionSource.value,
    providerId: selectedProviderId.value,
    modelId: selectedModelId.value,
    model: selectedModel.value,
  }
  const changeToken = ++modelSelectionChangeToken
  applyModelSelectionState(option)

  const currentConversationId = normalizeConversationId(conversationId.value)
  if (!currentConversationId) return
  const currentTaskId = String(taskSeed.value?.taskId || '').trim() || undefined

  const previousSaveRequest = modelSelectionSaveRequest
  const saveRequest = (previousSaveRequest || Promise.resolve(previousSelection)).then(async (persistedSelection) => {
    try {
      const { data } = await axios.patch<AiThreadModelSelection>(
        `/ai/nocode-editor/conversations/${encodeURIComponent(currentConversationId)}/model-selection`,
        {
          nocodeId: props.nocodeId,
          taskId: currentTaskId,
          modelSelectionSource: 'explicit',
          providerId: option.providerId,
          modelId: option.modelId,
          model: option.model,
        },
      )
      if (changeToken !== modelSelectionChangeToken) return data
      applyModelSelectionState(data)
      persistedConversationModelSelectionSource.value = 'explicit'
      emit('thread-list-change')
      return data
    } catch (error) {
      if (changeToken === modelSelectionChangeToken) {
        applyModelSelectionState(persistedSelection)
      }
      console.error('Update nocode editor AI conversation model selection failed:', error)
      return persistedSelection
    }
  })
  let queuedSaveRequest: Promise<AiThreadModelSelection>
  queuedSaveRequest = saveRequest.finally(() => {
    if (modelSelectionSaveRequest === queuedSaveRequest) {
      modelSelectionSaveRequest = null
    }
  })
  modelSelectionSaveRequest = queuedSaveRequest
  await queuedSaveRequest
}
const applyModelSelectionState = (selection?: AiThreadModelSelection | null) => {
  const isExplicit = selection?.modelSelectionSource === 'explicit'
    || Boolean(selection?.providerId || selection?.modelId || selection?.model)
  modelSelectionSource.value = isExplicit ? 'explicit' : 'default'
  selectedProviderId.value = isExplicit ? String(selection?.providerId || '') : ''
  selectedModelId.value = isExplicit ? String(selection?.modelId || '') : ''
  selectedModel.value = isExplicit ? String(selection?.model || '') : ''
}
const applyFirstExplicitModelSelection = () => {
  if (persistedConversationModelSelectionSource.value) {
    return
  }
  if (selectedProviderId.value || selectedModelId.value || selectedModel.value) {
    return
  }

  const option = firstExplicitModelOption.value
  if (!option) return
  applyModelSelectionState(option)
}
const draft = ref('')
const settingContextHost = inject<NocodeEditorAiSettingContextHost | null>('nocode-editor-ai-setting-context-host', null)
const composerAttachments = ref<AiAttachment[]>([])
const editingUserMessageId = ref('')
const editingUserMessageDraft = ref('')
const editingUserMessageAttachments = ref<AiAttachment[]>([])
const inlineEditTextareaRef = ref<HTMLTextAreaElement | HTMLTextAreaElement[] | null>(null)
const messagesContainerRef = ref<HTMLElement | null>(null)
const panelFooterRef = ref<HTMLElement | null>(null)
const tailPostFormFlowTailCardRef = ref<HTMLElement | null>(null)
const hoveredMessageId = ref('')
const isAtBottom = ref(true)
const messages = ref<NocodeEditorAiMessage[]>([])
const activeExcelAnalysisContext = ref<import('@common/types/aiExcelAnalysis').AiExcelAnalysisContext | null>(null)
const timelineMeta = ref<NocodeEditorAiTimelineMeta | null>(null)
const conversationId = ref('')
const conversationImportInputRef = ref<HTMLInputElement | null>(null)
const isImportingConversation = ref(false)
const isDev = import.meta.env.DEV;
const taskSeed = ref<NocodeEditorAiTaskSeed | null>(null)
const authoritativeTaskSummary = ref<Record<string, unknown> | null>(null)
const normalizeAuthoritativeTaskSummary = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
)
const pendingConversationBootstrapReason = ref<'submit-bootstrap' | null>(null)
const pendingBuilderHomeInitialPromptThreadId = ref('')
const handoffBootstrapPhase = ref<WorkbenchHandoffBootstrapPhase>('idle')
const activeHandoffForContinuityHint = ref<AppBuilderHandoff | null>(null)
const currentScopeKey = ref('')
const currentHostContext = ref<Awaited<ReturnType<NocodeEditorAiRuntime['getHostContext']>> | null>(null)
const isPreparingSubmit = ref(false)
const submitPreparationGeneration = ref(0)
const isResponding = ref(false)
const isApplyingFlow = ref(false)
const isApplyingBlueprint = ref(false)
const isRefreshingBlueprint = ref(false)
const isConversationActionDisabled = computed(() => (
  isPreparingSubmit.value || isResponding.value || isImportingConversation.value || isApplyingBlueprint.value || isApplyingFlow.value || isRefreshingBlueprint.value
))
const isInitializingConversation = ref(Boolean(props.visible))
const currentController = ref<AbortController | null>(null)
const completedExcelCreateAttachmentIds = computed(() => (
  collectAiExcelCreateCompletionAttachmentIds(messages.value)
))
const stagedFormPlan = ref<NocodeEditorAiStagedFormPlan>({
  revision: 0,
  outline: null,
  applicationStructurePreview: null,
})
const stagedAppPlan = ref<NocodeEditorAiStagedAppPlan>({
  revision: 0,
  plan: null,
})
const stagedFormulaPlan = ref<NocodeEditorAiStagedFormulaPlan | null>(null)
const stagedFlowScheme = ref<NocodeEditorAiStagedFlowScheme>({
  revision: 0,
  scheme: null,
  planningStatus: 'needs_confirmation',
  reviewResult: null,
  flowUnifiedIssues: null,
  flowIssueRouting: null,
})
const stagedFlowPlan = ref<NocodeEditorAiStagedFlowPlan>({
  revision: 0,
  sourceSchemeRevision: undefined,
  flowPlan: null,
  applyResult: null,
})
const stagedBlueprint = shallowRef<NocodeEditorAiStagedAppBlueprint>({
  phase: 'staged',
  planningScope: 'unknown',
  revision: 0,
  blueprint: null,
  applyResult: null,
  draftPersistenceState: null,
  sourcePlanningContextKey: null,
})
const localPendingFlowIntent = ref<NocodeEditorPendingFlowIntent | null>(null)
const explicitFlowAutoContinueTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const explicitFlowAutoContinueInterval = ref<ReturnType<typeof setInterval> | null>(null)
const explicitFlowAutoContinueTraceId = ref('')
const explicitFlowAutoContinueDeadlineAt = ref(0)
const explicitFlowAutoContinueRemainingSeconds = ref(0)
const flowBlueprintAutoContinueTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const flowBlueprintAutoContinueCandidateKey = ref('')
const currentRespondingAssistantId = ref('')
const continuingGenerationFromErrorTraceId = ref('')

const isStagedBlueprintItem = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
): item is Extract<NocodeEditorAiStageBlueprintDisplayItem, { itemKind: 'ai_blueprint' }> => (
  item?.itemKind === 'ai_blueprint'
  && isBlueprintStagedPhase(item.phase)
)

const isGeneratedBlueprintItem = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
) => (
  item?.itemKind === 'current_form_snapshot'
  || (item?.itemKind === 'ai_blueprint' && isBlueprintAppliedPhase(item.phase))
)
const chatInputRef = ref<ChatInputHandle | null>(null)
const setComposerDraft = (value: string) => {
  draft.value = value
  chatInputRef.value?.setValue?.(value)
}
const previewDialogVisible = ref(false)
const previewArtifact = ref<NocodeEditorAiArtifactBlock | null>(null)
const previewSessionId = ref(0)
const confirmationDrawerVisible = ref(false)
const confirmationDrawerBlock = ref<NocodeEditorAiArtifactBlock | null>(null)
const confirmationDrawerFocusQuestionId = ref<string | null>(null)
const confirmationDrawerPendingBlueprintItem = shallowRef<NocodeEditorAiStageBlueprintDisplayItem | null>(null)
const confirmationResponseDrafts = ref<Record<string, NocodeEditorAiConfirmationResponseDraftMap>>({})
const confirmationInlineNoteQuestionIds = ref<Record<string, string[]>>({})
const confirmationInlineNoteDrafts = ref<Record<string, Record<string, string>>>({})
const previewCanApplyBlueprint = computed(() => (
  previewArtifact.value
    ? canApplyBlueprintFromPreview(previewArtifact.value)
    : false
))
const previewCanApplyFlow = computed(() => Boolean(
  previewArtifact.value
  && canApplyFlowFromPreview(previewArtifact.value),
))
const canContinueBlueprintAdjustment = (block?: NocodeEditorAiArtifactBlock | null) => Boolean(
  block
  && block.kind === 'blueprint'
  && isCurrentBlueprintBlock(block)
  && !isPreparingSubmit.value
  && !isResponding.value
  && !isApplyingBlueprint.value
  && !isRefreshingBlueprint.value,
)
const previewCanContinueBlueprint = computed(() => (
  canContinueBlueprintAdjustment(previewArtifact.value)
))
const previewShouldUseSharedBlueprintWorkbench = computed(() => (
  shouldUseSharedBlueprintPreviewWorkbench({
    block: previewArtifact.value,
    currentBlueprint: stagedBlueprint.value,
    workbenchItems: props.blueprintWorkbenchItems,
    workbenchHistoryItems: props.blueprintWorkbenchHistoryItems,
  })
))
const previewBlueprintSharedFocusCardKey = computed(() => (
  previewShouldUseSharedBlueprintWorkbench.value
    ? resolveBlueprintPreviewInitialFocusCardKey({
      block: previewArtifact.value,
      appName: props.appName,
      workbenchItems: props.blueprintWorkbenchItems,
    })
    : ''
))
const previewBlueprintWorkbenchItems = computed(() => (
  previewBlueprintSharedFocusCardKey.value
    ? props.blueprintWorkbenchItems
    : []
))
const previewBlueprintWorkbenchHistoryItems = computed(() => (
  previewBlueprintSharedFocusCardKey.value
    ? props.blueprintWorkbenchHistoryItems
    : []
))
const previewBlueprintApplying = computed(() => Boolean(
  isApplyingBlueprint.value
  && previewArtifact.value
  && previewArtifact.value.kind === 'blueprint'
  && isCurrentBlueprintBlock(previewArtifact.value),
))
const previewFlowApplying = computed(() => Boolean(
  isApplyingFlow.value
  && previewArtifact.value
  && previewArtifact.value.kind === 'flow-plan'
  && isCurrentFlowPlanBlock(previewArtifact.value),
))
const isApplyingFlowArtifact = (
  block?: NocodeEditorAiArtifactBlock | null,
) => Boolean(
  isApplyingFlow.value
  && block
  && block.kind === 'flow-plan'
  && isCurrentFlowPlanBlock(block),
)
const isApplyingArtifactBlock = (
  block?: NocodeEditorAiArtifactBlock | null,
) => Boolean(
  (isApplyingBlueprint.value
    && block
    && block.kind === 'blueprint'
    && isCurrentBlueprintBlock(block))
  || (isApplyingFlow.value
    && block
    && block.kind === 'flow-plan'
    && isCurrentFlowPlanBlock(block))
)
const blueprintApplyConfirmDialogVisible = ref(false)
const blueprintApplyConfirmDialogTitle = ref('')
const blueprintApplyConfirmDialogSummary = ref('')
const blueprintApplyConfirmDialogRecommendationText = ref('')
const blueprintApplyConfirmDialogRiskText = ref('')
const blueprintApplyConfirmDialogConfirmText = ref('')
const blueprintApplyConfirmDialogPendingCount = ref(0)
const blueprintApplyConfirmDialogCancelText = ref('')
let resolveBlueprintApplyConfirmDialog: (() => void) | null = null
let rejectBlueprintApplyConfirmDialog: ((reason?: unknown) => void) | null = null
const previewConfirmationResponseDrafts = computed(() => (
  previewArtifact.value
    ? getConfirmationResponseDrafts(previewArtifact.value)
    : {}
))
const previewActiveConfirmationInputQuestionIds = computed(() => (
  previewArtifact.value
    ? getActiveConfirmationInputQuestionIds(previewArtifact.value)
    : []
))
const previewInlineConfirmationNoteQuestionIds = computed(() => (
  previewArtifact.value
    ? getInlineConfirmationNoteQuestionIds(previewArtifact.value)
    : []
))
const isConfirmationSubmitting = computed(() => isResponding.value || isPreparingSubmit.value)
const builderHomeInitialPromptThreadIds = new Set<string>()
const draftIssueCompletionSyncPersistenceKeys = new Set<string>()
const pendingDraftIssueCompletionSyncSignatures = new Set<string>()
const resolvedDraftIssueTraceIds = ref<Record<string, boolean>>({})
const flowIssueCompletionSyncPersistenceKeys = new Set<string>()
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})
const stageLoadingState = computed(() => resolveNocodeEditorStageLoadingState(messages.value))
const showEmptyState = computed(() => (
  !isInitializingConversation.value
  && !isPreparingSubmit.value
  && !isResponding.value
  && !stagedFormPlan.value.outline
  && !stagedAppPlan.value.plan
  && !stagedBlueprint.value.blueprint
  && messages.value.length === 0
))

const cloneBlueprintValue = <T,>(value: T): T => (
  value == null ? value : JSON.parse(JSON.stringify(value))
)

const getPendingBlueprintDisplayIdentityKey = (input: {
  blueprint?: NocodeEditorAiArtifactBlock['blueprint'] | NocodeEditorAiStagedAppBlueprint['blueprint'] | null
  revision?: number
  stagedAt?: number
  version?: string
  traceId?: string | null
  createTime?: number
}) => {
  const version = String(input?.version || '').trim()
  if (version) {
    return version
  }

  const revision = Number(input?.revision || 0)
  const stagedAt = Number(input?.stagedAt || 0)
  if (revision > 0 || stagedAt > 0) {
    return `${revision}:${stagedAt}`
  }

  const blueprintId = String(input?.blueprint?.id || '').trim()
  if (blueprintId) {
    return blueprintId
  }

  return String(input?.traceId || input?.createTime || '').trim()
}

const normalizeBlueprintDisplayToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')
  .replace(/[^\p{Letter}\p{Number}]/gu, '')

const getBlueprintFormDisplayKey = (form: NocodeEditorAiAppBlueprintForm | null | undefined, index = 0) => {
  const formKey = String(form?.formKey || '').trim()
  if (formKey) {
    return formKey
  }

  const groupName = normalizeBlueprintDisplayToken(form?.groupName)
  const tableName = normalizeBlueprintDisplayToken(form?.tableName)
  if (groupName || tableName) {
    return [groupName || 'nogroup', tableName || 'noname'].join('::')
  }

  return `form-${index + 1}`
}

const countBlueprintFields = (fields: NocodeEditorAiAppBlueprintField[] = []) => fields.reduce((total, field) => {
  const children = Array.isArray(field?.children) ? field.children : []
  return total + 1 + countBlueprintFields(children)
}, 0)

const shouldPreferPendingBlueprintItem = (
  nextItem: NocodeEditorAiStageBlueprintDisplayItem,
  currentItem?: NocodeEditorAiStageBlueprintDisplayItem,
) => {
  if (!currentItem) {
    return true
  }

  const nextUpdatedAt = Number(nextItem.updatedAt || nextItem.stagedAt || nextItem.createdAt || 0)
  const currentUpdatedAt = Number(currentItem.updatedAt || currentItem.stagedAt || currentItem.createdAt || 0)
  if (nextUpdatedAt !== currentUpdatedAt) {
    return nextUpdatedAt > currentUpdatedAt
  }

  const nextRevision = Number(nextItem.revision || 0)
  const currentRevision = Number(currentItem.revision || 0)
  if (nextRevision !== currentRevision) {
    return nextRevision > currentRevision
  }

  const nextFieldCount = countBlueprintFields(nextItem.blueprint?.forms?.flatMap(form => form.fields || []) || [])
  const currentFieldCount = countBlueprintFields(currentItem.blueprint?.forms?.flatMap(form => form.fields || []) || [])
  if (nextFieldCount !== currentFieldCount) {
    return nextFieldCount > currentFieldCount
  }

  return String(nextItem.identityKey || '').trim().length >= String(currentItem.identityKey || '').trim().length
}

const buildPendingBlueprintDisplayItems = (
  block: NocodeEditorAiArtifactBlock,
  createTime?: number,
  traceId?: string | null,
): NocodeEditorAiStageBlueprintDisplayItem[] => {
  if (block.kind !== 'blueprint' || block.status !== 'ready' || !block.blueprint) {
    return []
  }

  const baseIdentityKey = getPendingBlueprintDisplayIdentityKey({
    blueprint: block.blueprint,
    revision: Number(block.revision || 0),
    stagedAt: Number(block.stagedAt || 0),
    version: String(block.version || '').trim(),
    traceId,
    createTime,
  })

  if (!baseIdentityKey) {
    return []
  }

  const forms = Array.isArray(block.blueprint.forms) ? block.blueprint.forms : []
  if (!forms.length) {
    return []
  }

  return forms.map((form, index) => {
    const formDisplayKey = getBlueprintFormDisplayKey(form, index)
    const identityKey = `${baseIdentityKey}::${formDisplayKey}`
    return {
      itemKind: 'ai_blueprint',
      id: `pending:${identityKey}`,
      identityKey,
      planningScope: normalizeNocodeEditorPlanningScopeValue(block.planningScope),
      phase: 'staged',
      status: 'staged',
      source: 'ai-staged',
      title: String(form.tableName || block.title || block.blueprint?.title || i18next.t('nocodeEditorAiPanel.blueprintDraft')).trim() || i18next.t('nocodeEditorAiPanel.blueprintDraft'),
      summary: String(form.description || block.summary || block.blueprint?.summary || '').trim() || undefined,
      createdAt: Number(createTime || block.stagedAt || 0) || undefined,
      updatedAt: Number(block.stagedAt || createTime || Date.now()),
      revision: Number(block.revision || 0) || undefined,
      stagedAt: Number(block.stagedAt || 0) || undefined,
      traceId: traceId || null,
      sourcePlanningContextKey: getBlueprintArtifactPlanningContextKey(block),
      applyResult: null,
      draftPersistenceState: null,
      blueprint: {
        ...cloneBlueprintValue(block.blueprint),
        forms: [cloneBlueprintValue(form)],
      },
    }
  })
}

const collectPendingBlueprintDisplayItems = (
  messageList: NocodeEditorAiMessage[],
  currentBlueprint: NocodeEditorAiStagedAppBlueprint,
) => {
  const pendingBlueprintMap = new Map<string, NocodeEditorAiStageBlueprintDisplayItem>()
  const lineageKeyToIdentityKey = new Map<string, string>()

  const removePendingBlueprintItemsForAppliedBlueprint = (
    appliedBlock: NocodeEditorAiArtifactBlock,
  ) => {
    const blueprint = appliedBlock.blueprint
    const appliedForms = Array.isArray(blueprint?.forms) ? blueprint.forms : []
    if (!appliedForms.length) {
      return
    }

    const appliedPlanningContextKey = getBlueprintArtifactPlanningContextKey(appliedBlock)
    const appliedLineageKeySet = new Set(
      appliedForms
        .map(form => getBlueprintLineageKey({
          ...cloneBlueprintValue(blueprint),
          forms: [cloneBlueprintValue(form)],
        }))
        .filter(Boolean),
    )
    for (const [identityKey, item] of pendingBlueprintMap.entries()) {
      const itemLineageKey = getBlueprintLineageKey(item.blueprint)
      const sameLineage = itemLineageKey && appliedLineageKeySet.has(itemLineageKey)
      const itemPlanningContextKey = String(item.sourcePlanningContextKey || '').trim() || null
      const samePlanningContext = !appliedPlanningContextKey
        || !itemPlanningContextKey
        || appliedPlanningContextKey === itemPlanningContextKey
      if (!sameLineage || !samePlanningContext) {
        continue
      }
      pendingBlueprintMap.delete(identityKey)
    }
  }

  const upsertPendingBlueprintItem = (item: NocodeEditorAiStageBlueprintDisplayItem) => {
    const lineageKey = getBlueprintLineageKey(item.blueprint)
    if (lineageKey) {
      const previousIdentityKey = lineageKeyToIdentityKey.get(lineageKey)
      if (previousIdentityKey) {
        const previousItem = pendingBlueprintMap.get(previousIdentityKey)
        if (shouldPreferPendingBlueprintItem(item, previousItem)) {
          pendingBlueprintMap.delete(previousIdentityKey)
        } else {
          return
        }
      }
      lineageKeyToIdentityKey.set(lineageKey, item.identityKey)
    }

    pendingBlueprintMap.set(item.identityKey, item)
  }

  for (const message of messageList) {
    const traceId = normalizeTraceId(message.traceId || message.metadata?.traceId) || null
    for (const block of getAllArtifactBlocks(message)) {
      if (block.kind !== 'blueprint' || block.status !== 'ready' || !block.blueprint) {
        continue
      }
      const identityKey = getBlueprintIdentityKey({
        blueprint: block.blueprint,
        revision: Number(block.revision || 0),
        stagedAt: Number(block.stagedAt || 0),
        sourcePlanningContextKey: getBlueprintArtifactPlanningContextKey(block),
      })
      if (!identityKey) {
        continue
      }
      if (isBlueprintAppliedPhase(block.phase)) {
        removePendingBlueprintItemsForAppliedBlueprint(block)
        continue
      }

      if (!isBlueprintStagedPhase(block.phase)) {
        continue
      }

      const items = buildPendingBlueprintDisplayItems(block, message.createTime, traceId)
      for (const item of items) {
        upsertPendingBlueprintItem(item)
      }
    }
  }

  const currentIdentityKey = getBlueprintIdentityKey({
    blueprint: currentBlueprint.blueprint,
    revision: Number(currentBlueprint.revision || 0),
    stagedAt: Number(currentBlueprint.stagedAt || 0),
    sourcePlanningContextKey: currentBlueprint.sourcePlanningContextKey || null,
  })

  if (isBlueprintAppliedPhase(currentBlueprint.phase) && currentIdentityKey) {
    const currentBlock = buildBlueprintArtifactBlock(currentBlueprint)
    if (currentBlock) {
      removePendingBlueprintItemsForAppliedBlueprint(currentBlock)
    }
  }

  if (currentBlueprint.blueprint && isBlueprintStagedPhase(currentBlueprint.phase)) {
    const currentBlock = buildBlueprintArtifactBlock(currentBlueprint)
    const items = currentBlock
      ? buildPendingBlueprintDisplayItems(currentBlock, currentBlueprint.stagedAt, null)
      : []
    for (const item of items) {
      upsertPendingBlueprintItem(item)
    }
  }

  return Array.from(pendingBlueprintMap.values())
    .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))
}

const pendingBlueprintWorkspace = computed(() => collectPendingBlueprintWorkspace(
  messages.value,
  stagedBlueprint.value,
  {
    getAllArtifactBlocks,
  },
))
const pendingBlueprintsForStage = computed(() => pendingBlueprintWorkspace.value.currentItems.map((item) => (
  withPendingBlueprintDisplayVersion(item) || item
)))
const pendingBlueprintHistory = computed(() => pendingBlueprintWorkspace.value.historyItems.map((item) => (
  withPendingBlueprintDisplayVersion(item) || item
)))
const currentDraftPersistenceState = computed<NocodeEditorAiDraftPersistenceState | null>(() => {
  const stagedDraft = normalizeDraftPersistenceState(stagedBlueprint.value.draftPersistenceState)
  if (stagedDraft) {
    return stagedDraft
  }

  const generatedDraft = pendingBlueprintWorkspace.value.currentItems.find(item => (
    item.itemKind === 'ai_blueprint'
    && isBlueprintAppliedDraftPhase(item.phase)
    && item.draftPersistenceState?.mode === 'draft_only'
  ))?.draftPersistenceState
  return generatedDraft?.mode === 'draft_only' ? generatedDraft : null
})
const stageSyncedDraftPersistenceState = computed<NocodeEditorAiDraftPersistenceState | null>(() => {
  return (
    normalizeDraftPersistenceState(stagedBlueprint.value.draftPersistenceState)
    || normalizeDraftPersistenceState(props.draftPersistenceState)
  )
})

const buildDraftPersistenceStateSignature = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => JSON.stringify(normalizeDraftPersistenceState(state) || null)

const getDraftPersistenceStateBlueprintVersionKey = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => String(state?.sourceBlueprintVersionKey || '').trim()

const getDraftPersistenceStateBlueprintIdentityKey = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => String(state?.sourceBlueprintIdentityKey || '').trim()

const isDraftPersistenceStateForBlueprint = (
  state: NocodeEditorAiDraftPersistenceState | null | undefined,
  blueprintVersionKey: string,
  blueprintIdentityKey: string,
) => {
  const sourceBlueprintVersionKey = String(state?.sourceBlueprintVersionKey || '').trim()
  const stateVersionKey = sourceBlueprintVersionKey
  if (stateVersionKey && blueprintVersionKey) {
    return stateVersionKey === blueprintVersionKey
  }
  const sourceBlueprintIdentityKey = String(state?.sourceBlueprintIdentityKey || '').trim()
  const stateIdentityKey = sourceBlueprintIdentityKey
  return Boolean(
    stateIdentityKey
    && blueprintIdentityKey
    && stateIdentityKey === blueprintIdentityKey
  )
}

const isDraftPersistenceStateForCurrentBlueprint = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => isDraftPersistenceStateForBlueprint(
  state,
  getCurrentBlueprintVersionKey(),
  getCurrentBlueprintIdentityKey(),
)

const resolveNearestBlueprintIdentityKeyForDraftIssueMessage = (
  message: NocodeEditorAiMessage,
) => {
  const messageIndex = messages.value.findIndex(item => item === message || item.id === message.id)
  if (messageIndex < 0) {
    return ''
  }
  for (let index = messageIndex; index >= 0; index -= 1) {
    const sourceMessage = messages.value[index]
    const blocks = getAllArtifactBlocks(sourceMessage)
    for (let blockIndex = blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = blocks[blockIndex]
      if (block.kind !== 'blueprint' || block.status !== 'ready' || !block.blueprint) {
        continue
      }
      const identityKey = getBlueprintIdentityKey({
        blueprint: block.blueprint,
        revision: Number(block.revision || 0),
        stagedAt: Number(block.stagedAt || 0),
        sourcePlanningContextKey: getBlueprintArtifactPlanningContextKey(block),
      })
      if (identityKey) {
        return identityKey
      }
    }
  }
  return ''
}

const resolveNearestBlueprintLineageKeyForDraftIssueMessage = (
  message: NocodeEditorAiMessage,
) => {
  const messageIndex = messages.value.findIndex(item => item === message || item.id === message.id)
  if (messageIndex < 0) {
    return ''
  }
  for (let index = messageIndex; index >= 0; index -= 1) {
    const sourceMessage = messages.value[index]
    const blocks = getAllArtifactBlocks(sourceMessage)
    for (let blockIndex = blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = blocks[blockIndex]
      if (block.kind !== 'blueprint' || block.status !== 'ready' || !block.blueprint) {
        continue
      }
      const lineageKey = getBlueprintLineageKey(block.blueprint)
      if (lineageKey) {
        return lineageKey
      }
    }
  }
  return ''
}

const isLegacyDraftIssueListForCurrentBlueprint = (
  message: NocodeEditorAiMessage,
  state?: NocodeEditorAiDraftPersistenceState | null,
) => {
  if (getDraftPersistenceStateBlueprintIdentityKey(state)) {
    return false
  }
  const nearestBlueprintIdentityKey = resolveNearestBlueprintIdentityKeyForDraftIssueMessage(message)
  if (nearestBlueprintIdentityKey && nearestBlueprintIdentityKey === getCurrentBlueprintIdentityKey()) {
    return true
  }
  const nearestBlueprintLineageKey = resolveNearestBlueprintLineageKeyForDraftIssueMessage(message)
  return Boolean(
    nearestBlueprintLineageKey
    && nearestBlueprintLineageKey === getBlueprintLineageKey(stagedBlueprint.value.blueprint)
  )
}
const isDraftIssueListForCurrentBlueprint = (
  message: NocodeEditorAiMessage,
  state?: NocodeEditorAiDraftPersistenceState | null,
) => (
  isDraftPersistenceStateForCurrentBlueprint(state)
  || isLegacyDraftIssueListForCurrentBlueprint(message, state)
)
const hasHistoricalDraftIssueListCompletionState = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => {
  if (!state || state.mode !== 'draft_only') {
    return false
  }
  return (
    (Array.isArray(state.actionIssues) && state.actionIssues.length > 0)
    || (Array.isArray(state.resolvedIssues) && state.resolvedIssues.length > 0)
    || (Array.isArray(state.issues) && state.issues.length > 0)
  )
}
const isCurrentDraftIssueListCompleteForAutoResolve = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => {
  const normalizedState = normalizeDraftPersistenceState(state)
  if (!normalizedState) {
    return false
  }
  return (
    isDraftPersistenceStateResolved(normalizedState)
    || !Array.isArray(normalizedState.actionIssues)
    || normalizedState.actionIssues.length === 0
  )
}

const sessionFlowArtifactBlocks = computed<NocodeEditorAiArtifactBlock[]>(() => {
  const nextBlocks: NocodeEditorAiArtifactBlock[] = []
  const currentBlock = buildFlowPlanArtifactBlock(stagedFlowPlan.value)
  if (currentBlock) {
    nextBlocks.push(currentBlock)
  }

  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    for (const block of getAllArtifactBlocks(messages.value[index])) {
      if (block.kind === 'flow-plan' && block.status === 'ready' && block.flowPlan) {
        nextBlocks.push(block)
      }
    }
  }

  return resolveReadyFlowArtifactBlocks(nextBlocks)
})

const emitStagedStateChange = () => {
  emit('staged-state-change', {
    formPlanOutline: stagedFormPlan.value.outline,
    appPlanOutline: stagedAppPlan.value.plan?.outline || null,
    blueprint: stagedBlueprint.value.blueprint,
    pendingBlueprints: pendingBlueprintsForStage.value,
    pendingBlueprintHistory: pendingBlueprintHistory.value,
    planningDisplayVersionByContextKey: planningDisplayVersionByContextKey.value,
    flowArtifactBlocks: sessionFlowArtifactBlocks.value,
    blueprintDraftPersistenceState: stageSyncedDraftPersistenceState.value,
    formPlanRevision: Number(stagedFormPlan.value.revision || 0),
    appPlanRevision: Number(stagedAppPlan.value.revision || 0),
    blueprintRevision: Number(stagedBlueprint.value.revision || 0),
    blueprintApplying: isApplyingBlueprint.value,
    blueprintLoading: stageLoadingState.value.blueprintLoading,
    blueprintLoadingMessage: stageLoadingState.value.blueprintMessage,
  })
}

const createMessageId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const createTurnTraceId = () => createMessageId('ai-turn')
const normalizeMessageId = (value: unknown) => String(value || '').trim()
const normalizeTraceId = (value: unknown) => String(value || '').trim()
const normalizeConversationId = (value: unknown) => String(value || '').trim()
const normalizeServerMessageSequence = (value: unknown) => {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }
  const normalized = Number(value)
  return Number.isInteger(normalized) && normalized > 0 ? normalized : undefined
}
const normalizeMessageSequence = (value: unknown) => {
  if (value === 0 || value === '0') {
    return 0
  }
  return normalizeServerMessageSequence(value)
}

const protectAuthoritativeAssistantBeforeHistoryNormalize = (
  sortedMessages: NocodeEditorAiThreadMessage[],
  options?: {
    mergeExisting?: boolean
    authoritativeAssistantMessageId?: string
  },
) => {
  if (!options?.mergeExisting) {
    return sortedMessages
  }

  const authoritativeAssistantMessageId = normalizeMessageId(options.authoritativeAssistantMessageId)
  if (!authoritativeAssistantMessageId) {
    return sortedMessages
  }

  const authoritativeIndex = sortedMessages.findIndex(message => (
    message.role === NocodeEditorAiMessageRole.ASSISTANT
    && normalizeMessageId(message.id) === authoritativeAssistantMessageId
  ))
  if (authoritativeIndex < 0) {
    return sortedMessages
  }

  const authoritativeMessage = sortedMessages[authoritativeIndex]
  const authoritativeTraceId = normalizeTraceId(
    authoritativeMessage.traceId || authoritativeMessage.metadata?.traceId,
  )
  if (!authoritativeTraceId) {
    return sortedMessages
  }

  const protectedMessages = [...sortedMessages]
  const authoritativeStage = normalizeMessageId(authoritativeMessage.metadata?.summaryStage)
  protectedMessages.forEach((message, index) => {
    if (message.role !== NocodeEditorAiMessageRole.ASSISTANT) {
      return
    }

    const messageTraceId = normalizeTraceId(message.traceId || message.metadata?.traceId)
    if (messageTraceId !== authoritativeTraceId) {
      return
    }

    const messageStage = normalizeMessageId(message.metadata?.summaryStage)
    if (
      index !== authoritativeIndex
      && messageStage
      && messageStage !== authoritativeStage
    ) {
      return
    }

    protectedMessages[index] = {
      ...message,
      metadata: {
        ...(message.metadata || {}),
        summaryStage: `authoritative-assistant-${index}`,
      },
    }
  })
  return protectedMessages
}
const normalizeTaskSource = (value: unknown): NocodeEditorAiTaskSeed['source'] => {
  const normalized = String(value || '').trim()
  if (
    normalized === 'builder-home'
    || normalized === 'builder-editor'
    || normalized === 'manual-reset'
    || normalized === 'resume'
  ) {
    return normalized
  }
  return 'resume'
}

const legacyConversationId = computed(() => buildLegacyNocodeEditorAiConversationId({
  accountId: passportState.account?.id,
  nocodeId: props.nocodeId,
}))
const resolveAiEntrySource = () => String(route.query.aiEntry || '').trim()
const BUILDER_HOME_INITIAL_PROMPT_STORAGE_PREFIX = 'NOCODE_CREATION_BUILDER_PROMPT'
const BUILDER_HOME_INITIAL_ATTACHMENTS_STORAGE_PREFIX = 'NOCODE_CREATION_BUILDER_ATTACHMENTS'
const builderHomeInitialPrompt = ref('')
const builderHomeInitialAttachments = ref<AiAttachment[]>([])
const builderHomeInitialModelSelection = ref<AiThreadModelSelection | null>(null)
const clearAiEntrySourceQueryIfNeeded = async () => {
  if (!resolveAiEntrySource()) {
    return
  }

  const nextQuery = {
    ...route.query,
  }
  if (!('aiEntry' in nextQuery)) {
    return
  }

  delete nextQuery.aiEntry
  try {
    await router.replace({
      path: route.path,
      query: nextQuery,
    })
  } catch (error) {
    console.error('Clear AI entry source query failed:', error)
  }
}
const taskConversationId = computed(() => taskSeed.value?.taskId
  ? buildNocodeEditorAiConversationId({
    accountId: passportState.account?.id,
    nocodeId: props.nocodeId,
    taskId: taskSeed.value.taskId,
  })
  : '')
const boundConversationId = computed(() => resolveNocodeEditorAiBoundConversationId({
  currentConversationId: normalizeConversationId(conversationId.value),
  taskConversationId: normalizeConversationId(taskConversationId.value),
}))

const refreshCurrentScopeKey = async () => {
  const hostContext: any = await props.runtime.getHostContext()
  currentHostContext.value = hostContext || null
  const scopeKey = resolveNocodeEditorTaskScopeKeyFromContext({
    nocodeId: props.nocodeId,
    mode: hostContext?.mode,
    activeFormId: hostContext?.activeFormId,
    currentActiveId: hostContext?.currentActiveId,
    routeActiveId: route.query.id,
    availableFormIds: Array.isArray(hostContext?.availableForms)
      ? hostContext.availableForms.map(item => item?.tableId)
      : [],
  })
  currentScopeKey.value = scopeKey
  return {
    hostContext,
    scopeKey,
  }
}

const getCurrentTaskStore = () => createNocodeEditorAiTaskStore({
  accountId: passportState.account?.id,
  nocodeId: props.nocodeId,
})

const persistCurrentTaskSeed = () => {
  const accountId = String(passportState.account?.id || '').trim()
  const nocodeId = String(props.nocodeId || '').trim()
  const seed = taskSeed.value
  const scopeKey = String(currentScopeKey.value || '').trim()
  const nextConversationId = normalizeConversationId(boundConversationId.value)
  if (!accountId || !nocodeId || !seed?.taskId || !scopeKey || !nextConversationId) {
    return
  }

  getCurrentTaskStore()?.set({
    accountId,
    nocodeId,
    conversationId: nextConversationId,
    taskId: seed.taskId,
    source: seed.source,
    createdAt: seed.createdAt,
    scopeKey,
    updatedAt: Date.now(),
  })
}

const applyTaskSeed = (value: {
  conversationId?: unknown
  taskId?: unknown
  scopeKey?: unknown
  source?: unknown
  createdAt?: unknown
}) => {
  const nextConversationId = normalizeConversationId(value.conversationId)
  const nextTaskId = String(value.taskId || '').trim()
  const nextScopeKey = String(value.scopeKey || '').trim()
  if (!nextConversationId || !nextTaskId || !nextScopeKey) {
    return false
  }

  taskSeed.value = {
    taskId: nextTaskId,
    source: normalizeTaskSource(value.source),
    createdAt: Number(value.createdAt || Date.now()) || Date.now(),
  }
  currentScopeKey.value = nextScopeKey
  conversationId.value = nextConversationId
  persistCurrentTaskSeed()
  return true
}

const ensureCurrentTaskSeed = async (
  source: NocodeEditorAiTaskSeed['source'] = 'resume',
) => {
  const { hostContext, scopeKey } = await refreshCurrentScopeKey()
  const hadTaskSeed = Boolean(taskSeed.value?.taskId)
  if (!hadTaskSeed) {
    taskSeed.value = createNextNocodeEditorTaskSeed(Date.now(), source)
  }
  const nextTaskConversationId = normalizeConversationId(taskConversationId.value)
  const nextConversationId = shouldReuseNocodeEditorAiCurrentConversationForTask({
    currentConversationId: normalizeConversationId(conversationId.value),
    legacyConversationId: normalizeConversationId(legacyConversationId.value),
    hasTaskSeed: hadTaskSeed,
  })
    ? normalizeConversationId(conversationId.value)
    : resolveNocodeEditorAiBoundConversationId({
      currentConversationId: normalizeConversationId(conversationId.value),
      taskConversationId: nextTaskConversationId,
    })
  conversationId.value = nextConversationId
  persistCurrentTaskSeed()
  return {
    hostContext,
    scopeKey,
    conversationId: nextConversationId,
    taskSeed: taskSeed.value,
  }
}

const prepareConversationForSubmit = async () => {
  const seedSource = resolveNocodeEditorAiSubmitTaskSource({
    taskSeed: taskSeed.value,
    aiEntrySource: resolveAiEntrySource(),
  })
  const shouldEnterSubmitBootstrapProtection = Boolean(
    !taskSeed.value?.taskId
    && !normalizeConversationId(conversationId.value)
  )

  if (shouldEnterSubmitBootstrapProtection) {
    pendingConversationBootstrapReason.value = 'submit-bootstrap'
  }

  try {
    return await ensureCurrentTaskSeed(seedSource)
  } catch (error) {
    pendingConversationBootstrapReason.value = null
    throw error
  }
}

const invalidatePendingSubmitPreparation = () => {
  submitPreparationGeneration.value += 1
  isPreparingSubmit.value = false
}

const isActiveSubmitPreparation = (generation: number) => (
  submitPreparationGeneration.value === generation
  && props.visible
)

const isArtifactBlock = (value: unknown): value is NocodeEditorAiArtifactBlock => isAiArtifactBlock(value)

const ensureMessageMetadata = (message: NocodeEditorAiMessage) => {
  if (!message.metadata || typeof message.metadata !== 'object' || Array.isArray(message.metadata)) {
    message.metadata = {}
  }
  return message.metadata
}

const normalizePendingFlowIntent = normalizeNocodeEditorPendingFlowIntent

const resolveSingleAppliedTableId = (result?: NocodeEditorAiBlueprintApplyResult | null) => {
  const tableIds = Array.from(new Set(
    (result?.forms || [])
      .map(item => String(item?.tableId || '').trim())
      .filter(Boolean),
  ))
  return tableIds.length === 1 ? tableIds[0] : ''
}

const resolveSingleAppliedTableName = (result?: NocodeEditorAiBlueprintApplyResult | null) => {
  const tableNames = Array.from(new Set(
    (result?.forms || [])
      .map(item => String(item?.tableName || '').trim())
      .filter(Boolean),
  ))
  return tableNames.length === 1 ? tableNames[0] : ''
}

const buildPendingFlowIntentForCommittedTarget = (input: {
  entryFlowIntent?: ReturnType<typeof resolveNocodeEditorFlowEntryIntent> | null
  targetFormId?: string
  targetFormName?: string
}) => buildNocodeEditorPendingFlowIntentFromEntryFlowIntent({
  entryFlowIntent: input.entryFlowIntent,
  targetFormId: input.targetFormId,
  targetFormName: input.targetFormName,
  now: Date.now(),
})

const buildPendingFlowIntentAfterBlueprintApply = (input: {
  entryFlowIntent?: ReturnType<typeof resolveNocodeEditorFlowEntryIntent> | null
  result?: NocodeEditorAiBlueprintApplyResult | null
}) => {
  const result = input.result || null
  if (!result) {
    return null
  }

  return buildPendingFlowIntentForCommittedTarget({
    entryFlowIntent: input.entryFlowIntent,
    targetFormId: resolveSingleAppliedTableId(result) || undefined,
    targetFormName: resolveSingleAppliedTableName(result) || input.entryFlowIntent?.targetFormName,
  })
}

const resolveBlueprintApplyPostFormFlowMetadata = (input: {
  entryFlowIntent?: ReturnType<typeof resolveNocodeEditorFlowEntryIntent> | null
  result?: NocodeEditorAiBlueprintApplyResult | null
}) => {
  const result = input.result || null
  const planningScope = normalizeNocodeEditorPlanningScopeValue(result?.planningScope)
  if (!result || !isNocodeEditorPostFormFlowEnabledForScope(planningScope)) {
    return {
      planningScope,
      pendingFlowIntent: null,
      postFormFlowSignals: null,
      postFormFlowOpportunity: null,
      postFormFlowFollowUp: null,
      postFormFlowRelease: null,
    }
  }

  const pendingFlowIntent = buildPendingFlowIntentAfterBlueprintApply(input)

  const postFormFlowSignals = result.postFormFlowSignals || null
  const postFormFlowReleaseContext = buildNocodeEditorPostFormFlowReleaseContext({
    planningScope,
    persistenceMode: result.persistenceMode,
    draftPersistenceState: result.draftPersistenceState,
    formulaSummary: result.formulaSummary,
    formulaApplyResults: (result.forms || [])
      .map(item => item.formulaApply)
      .filter(Boolean) as NonNullable<NocodeEditorAiBlueprintApplyResult['forms'][number]['formulaApply']>[],
    fieldBindings: (result.forms || []).flatMap(item => item.fieldBindings || []),
  })
  const postFormFlowRelease = resolveNocodeEditorPostFormFlowRelease({
    ...postFormFlowReleaseContext,
    pendingFlowIntent,
  })
  if (!postFormFlowRelease.shouldRender) {
    return {
      planningScope,
      pendingFlowIntent,
      postFormFlowSignals,
      postFormFlowOpportunity: null,
      postFormFlowFollowUp: null,
      postFormFlowRelease,
    }
  }
  const postFormFlowOpportunity = pendingFlowIntent
    ? null
    : (
      result.postFormFlowOpportunity
      || decideNocodeEditorPostFormFlowOpportunity({
        planningScope,
        entryFlowIntent: input.entryFlowIntent,
        postFormFlowSignals,
        targetFormId: resolveSingleAppliedTableId(result) || undefined,
        targetFormName: resolveSingleAppliedTableName(result) || input.entryFlowIntent?.targetFormName,
        now: Date.now(),
      })
    );
  const postFormFlowFollowUp = normalizeNocodeEditorPostFormFlowFollowUp(
    result.postFormFlowFollowUp,
  ) || decideNocodeEditorPostFormFlowFollowUp({
    planningScope,
    entryFlowIntent: input.entryFlowIntent,
    pendingFlowIntent,
    postFormFlowOpportunity,
    postFormFlowSignals,
    targetFormId: resolveSingleAppliedTableId(result) || undefined,
    targetFormName: resolveSingleAppliedTableName(result) || input.entryFlowIntent?.targetFormName,
    now: Date.now(),
  });

  return {
    planningScope,
    pendingFlowIntent,
    postFormFlowSignals,
    postFormFlowOpportunity,
    postFormFlowFollowUp,
    postFormFlowRelease,
  }
}

const resolvePendingFlowIntentToolTargetIdentity = (input: {
  toolName?: string
  toolInput?: Record<string, unknown> | null
  toolOutput?: unknown
}) => {
  const toolName = String(input.toolName || '').trim()
  const toolInput = input.toolInput || {}
  const toolOutput = (
    input.toolOutput
    && typeof input.toolOutput === 'object'
    && !Array.isArray(input.toolOutput)
  )
    ? input.toolOutput as Record<string, unknown>
    : {}

  if (toolName === 'editor_open_form') {
    return {
      targetFormId: String(toolOutput.tableId || toolInput.tableId || '').trim() || undefined,
      targetFormName: String(toolOutput.tableName || toolInput.tableName || '').trim() || undefined,
    }
  }

  return {
    targetFormId: String(currentHostContext.value?.activeFormId || '').trim() || undefined,
    targetFormName: String(currentHostContext.value?.activeFormName || '').trim() || undefined,
  }
}

const completePendingFlowIntentForTarget = (input: {
  pendingFlowIntent?: NocodeEditorPendingFlowIntent | null
  targetFormId?: string
  targetFormName?: string
}) => {
  if (!matchNocodeEditorPendingFlowIntentTarget({
    pendingFlowIntent: input.pendingFlowIntent,
    targetFormId: input.targetFormId,
    targetFormName: input.targetFormName,
  })) {
    return null
  }
  return {
    ...(input.pendingFlowIntent as NocodeEditorPendingFlowIntent),
    targetFormId: String(input.targetFormId || '').trim() || input.pendingFlowIntent?.targetFormId,
    targetFormName: String(input.targetFormName || '').trim() || input.pendingFlowIntent?.targetFormName,
    status: 'completed' as const,
    completedByTool: 'editor_apply_staged_flow' as const,
    updatedAt: Date.now(),
  }
}

const findLatestPendingFlowIntentFromMessages = (sourceMessages: NocodeEditorAiMessage[]) => {
  for (let index = sourceMessages.length - 1; index >= 0; index -= 1) {
    const metadata = sourceMessages[index]?.metadata
    const taskSummary = (
      metadata?.taskSummary
      && typeof metadata.taskSummary === 'object'
      && !Array.isArray(metadata.taskSummary)
    )
      ? metadata.taskSummary as Record<string, unknown>
      : null
    if (taskSummary && Object.prototype.hasOwnProperty.call(taskSummary, 'pendingFlowIntent') && taskSummary.pendingFlowIntent === null) {
      return null
    }
    const pendingFlowIntent = normalizePendingFlowIntent(taskSummary?.pendingFlowIntent)
    if (pendingFlowIntent) {
      return pendingFlowIntent
    }
  }
  return null
}

const resolveCurrentFormulaTaskSummary = () => {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const taskSummary = messages.value[index]?.metadata?.taskSummary
    if (taskSummary && typeof taskSummary === 'object' && !Array.isArray(taskSummary)) {
      return taskSummary as Record<string, unknown>
    }
  }
  return null
}

const resolveActiveFormulaTaskContext = () => {
  const taskId = String(taskSeed.value?.taskId || '').trim()
  const taskScopeKey = String(currentScopeKey.value || '').trim()
  const activeFormId = String(currentHostContext.value?.activeFormId || '').trim()
  if (!taskId || !taskScopeKey || !activeFormId) {
    return null
  }

  const taskSummary = resolveCurrentFormulaTaskSummary()
  const planningScope = normalizeNocodeEditorPlanningScopeValue(stagedBlueprint.value.planningScope)
  const pendingFlowIntent = normalizePendingFlowIntent(taskSummary?.pendingFlowIntent)
  const carriedTaskScopeKey = String(taskSummary?.taskScopeKey || '').trim()
  const carriedTargetFormId = String(taskSummary?.targetFormId || '').trim()
  const hasFormContinuation = planningScope === 'form'
    && normalizeNocodeEditorPlanningScopeValue(taskSummary?.planningScope) === 'form'
    && pendingFlowIntent?.status === 'pending_after_form_apply'
    && Boolean(carriedTaskScopeKey)
    && Boolean(carriedTargetFormId)
    && carriedTaskScopeKey === taskScopeKey
    && carriedTargetFormId === activeFormId
    && String(pendingFlowIntent.targetFormId || '').trim() === carriedTargetFormId

  return {
    taskId,
    taskScopeKey,
    planningScope,
    activeFormId,
    ...(hasFormContinuation ? { carriedTaskScopeKey } : {}),
    ...(hasFormContinuation ? { carriedTargetFormId } : {}),
    taskSummary,
  }
}

const registerActiveFormulaTaskContext = () => {
  props.runtime.setActiveFormulaTaskContext(
    () => resolveActiveFormulaTaskContext(),
    async () => {
      await refreshCurrentScopeKey()
    },
  )
}

const resolveFlowIntentSignalFromRecord = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  return normalizeNocodeEditorFlowIntentSignal(record.flowIntent)
    || normalizeNocodeEditorFlowIntentSignal((record.outline as Record<string, unknown> | undefined)?.flowIntent)
    || normalizeNocodeEditorFlowIntentSignal((record.appPlan as Record<string, unknown> | undefined)?.flowIntent)
    || normalizeNocodeEditorFlowIntentSignal((
      (record.appPlan as Record<string, unknown> | undefined)?.outline as Record<string, unknown> | undefined
    )?.flowIntent)
}

const resolveMetadataArtifactFlowIntentSignal = (metadata?: Record<string, unknown> | null) => {
  const blockSources = [metadata?.blocks, metadata?.artifactBlocks]
  for (const source of blockSources) {
    if (!Array.isArray(source)) {
      continue
    }
    for (let index = source.length - 1; index >= 0; index -= 1) {
      const blockSignal = resolveFlowIntentSignalFromRecord(source[index])
      if (blockSignal) {
        return blockSignal
      }
    }
  }
  return null
}

const resolveMetadataFlowIntentSignal = (metadata?: Record<string, unknown> | null) => {
  const directSignal = resolveFlowIntentSignalFromRecord(metadata)
  if (directSignal) {
    return directSignal
  }

  const blockSignal = resolveMetadataArtifactFlowIntentSignal(metadata)
  if (blockSignal) {
    return blockSignal
  }

  const fallbackSources = [
    metadata?.taskSummary,
    metadata?.requestScenePayload,
    metadata?.scenePayload,
  ]
  for (const source of fallbackSources) {
    const fallbackSignal = resolveFlowIntentSignalFromRecord(source)
    if (fallbackSignal) {
      return fallbackSignal
    }
  }

  return null
}

const resolveCurrentAssistantPlanningFlowIntentSignal = (
  metadata?: Record<string, unknown> | null,
) => (
  resolveMetadataArtifactFlowIntentSignal(metadata)
  || resolveFlowIntentSignalFromRecord(metadata)
)

const resolveLatestPlanningFlowIntentSignal = () => {
  for (let messageIndex = messages.value.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages.value[messageIndex]
    if (!message) {
      continue
    }
    const metadataSignal = resolveMetadataFlowIntentSignal(message?.metadata || null)
    if (metadataSignal) {
      return metadataSignal
    }

    const blocks = getAllArtifactBlocks(message)
    for (let blockIndex = blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = blocks[blockIndex]
      if (block.kind !== 'app-plan' && block.kind !== 'form-plan') {
        continue
      }
      const blockSignal = resolveFlowIntentSignalFromRecord(block)
      if (blockSignal) {
        return blockSignal
      }
    }
  }
  return null
}

const resolveMessageRowEntryFlowIntent = (
  message?: NocodeEditorAiMessage | null,
) => {
  const metadataIntent = resolveMessageMetadataEntryFlowIntent(message?.metadata || null)
  if (metadataIntent?.state === 'explicit_positive' || metadataIntent?.state === 'explicit_negative') {
    return metadataIntent
  }

  if (message?.role === NocodeEditorAiMessageRole.USER) {
    const contentIntent = resolveNocodeEditorFlowEntryIntentWithSignal({
      userMessage: String(message.content || '').trim(),
      activeFormName: currentHostContext.value?.activeFormName,
      modelSignal: resolveMetadataFlowIntentSignal(message.metadata || null),
    })
    if (contentIntent.state === 'explicit_positive' || contentIntent.state === 'explicit_negative') {
      return contentIntent
    }
  }

  return metadataIntent?.state === 'none' ? metadataIntent : null
}

const findLatestEntryFlowIntentFromMessages = (sourceMessages: NocodeEditorAiMessage[]) => {
  for (let index = sourceMessages.length - 1; index >= 0; index -= 1) {
    const message = sourceMessages[index] || null
    if (message?.metadata?.supersededAt) {
      continue
    }
    const entryFlowIntent = resolveMessageRowEntryFlowIntent(message)
    if (entryFlowIntent) {
      return entryFlowIntent
    }
  }
  return null
}

const resolveActivePendingFlowIntent = () => {
  const localIntent = normalizePendingFlowIntent(localPendingFlowIntent.value)
  const messageIntent = findLatestPendingFlowIntentFromMessages(messages.value)
  if (!localIntent) {
    return messageIntent
  }
  if (!messageIntent) {
    return localIntent
  }
  return Number(localIntent.updatedAt || 0) >= Number(messageIntent.updatedAt || 0)
    ? localIntent
    : messageIntent
}

const resolveMessagePostFormFlowFollowUp = (
  message?: NocodeEditorAiMessage | null,
) => {
  if (message?.role !== NocodeEditorAiMessageRole.ASSISTANT) {
    return null
  }

  const metadata = message.metadata || null
  const taskSummary = (
    metadata?.taskSummary
    && typeof metadata.taskSummary === 'object'
    && !Array.isArray(metadata.taskSummary)
  )
    ? metadata.taskSummary as Record<string, unknown>
    : null
  const planningScope = normalizeNocodeEditorPlanningScopeValue(
    taskSummary?.planningScope || metadata?.planningScope,
  )
  if (!isNocodeEditorPostFormFlowEnabledForScope(planningScope)) {
    return null
  }

  const taskSummaryFollowUp = normalizeNocodeEditorPostFormFlowFollowUp(
    taskSummary?.postFormFlowFollowUp,
  )
  if (taskSummaryFollowUp) {
    return taskSummaryFollowUp
  }

  return normalizeNocodeEditorPostFormFlowFollowUp(
    metadata?.postFormFlowFollowUp,
  )
}

const resolveMessagePostFormFlowRelease = (
  message?: NocodeEditorAiMessage | null,
) => {
  if (message?.role !== NocodeEditorAiMessageRole.ASSISTANT) {
    return null
  }

  const metadata = message.metadata || null
  const taskSummary = (
    metadata?.taskSummary
    && typeof metadata.taskSummary === 'object'
    && !Array.isArray(metadata.taskSummary)
  )
    ? metadata.taskSummary as Record<string, unknown>
    : null
  const planningScope = normalizeNocodeEditorPlanningScopeValue(
    taskSummary?.planningScope || metadata?.planningScope,
  )
  if (!isNocodeEditorPostFormFlowEnabledForScope(planningScope)) {
    return null
  }

  return normalizeNocodeEditorPostFormFlowRelease(
    taskSummary?.postFormFlowRelease,
  ) || normalizeNocodeEditorPostFormFlowRelease(
    metadata?.postFormFlowRelease,
  )
}

const findLatestPostFormFlowFollowUpFromMessages = (sourceMessages: NocodeEditorAiMessage[]) => {
  for (let index = sourceMessages.length - 1; index >= 0; index -= 1) {
    const followUp = resolveMessagePostFormFlowFollowUp(sourceMessages[index] || null)
    if (followUp) {
      return {
        followUp,
        message: sourceMessages[index],
      }
    }
  }
  return null
}

const hasNewerUserMessageAfterMessage = (
  sourceMessages: NocodeEditorAiMessage[],
  messageId?: string,
) => {
  const normalizedMessageId = String(messageId || '').trim()
  if (!normalizedMessageId) {
    return false
  }
  const messageIndex = sourceMessages.findIndex(item => item.id === normalizedMessageId)
  if (messageIndex < 0) {
    return false
  }
  for (let index = messageIndex + 1; index < sourceMessages.length; index += 1) {
    if (sourceMessages[index]?.role === NocodeEditorAiMessageRole.USER) {
      return true
    }
  }
  return false
}

const clearFlowBlueprintAutoContinueTimer = () => {
  if (flowBlueprintAutoContinueTimer.value) {
    clearTimeout(flowBlueprintAutoContinueTimer.value)
    flowBlueprintAutoContinueTimer.value = null
  }
  flowBlueprintAutoContinueCandidateKey.value = ''
}

const findLatestActivePostFormFlowFollowUpFromMessages = (sourceMessages: NocodeEditorAiMessage[]) => {
  const latestFollowUpMessage = findLatestPostFormFlowFollowUpFromMessages(sourceMessages)
  if (!latestFollowUpMessage) {
    return null
  }
  if (hasNewerUserMessageAfterMessage(sourceMessages, latestFollowUpMessage.message.id)) {
    return null
  }
  return latestFollowUpMessage
}

const resolvePostFormFlowTailCardVisibleUserMessage = (
  followUp: NormalizedPostFormFlowFollowUp,
) => {
  const targetFormName = String(followUp.targetFormName || '').trim()
  return targetFormName
    ? i18next.t('nocodeEditorAiPanel.continueCreateFlowForForm', { formName: targetFormName })
    : i18next.t('nocodeEditorAiPanel.continueCreateFlowForCurrentForm')
}

const resolvePostFormFlowTailCardActionMessage = (
  followUp: NormalizedPostFormFlowFollowUp,
) => {
  if (followUp.kind === 'explicit_flow_clarification') {
    return String(
      followUp.autoContinueMessage
      || NOCODE_EDITOR_POST_FORM_FLOW_FOLLOW_UP_AUTO_CONTINUE_MESSAGE,
    ).trim() || NOCODE_EDITOR_POST_FORM_FLOW_FOLLOW_UP_AUTO_CONTINUE_MESSAGE
  }
  return resolvePostFormFlowTailCardVisibleUserMessage(followUp)
}

const resolvePostFormFlowTailCardActionLabel = (
  followUp: NormalizedPostFormFlowFollowUp,
  message: NocodeEditorAiMessage,
) => {
  if (followUp.kind === 'explicit_flow_clarification') {
    const countdown = getExplicitFlowAutoContinueCountdown(message)
    if (countdown > 0) {
      return i18next.t('nocodeEditorAiPanel.createFlowWithCountdown', { countdown })
    }
  }
  return i18next.t('nocodeEditorAiPanel.createFlow')
}

const resolvePostFormFlowTailCardIgnoreLabel = () => i18next.t('nocodeEditorAiPanel.defer')
const resolvePostFormFlowTailCardIgnoreMessage = () => i18next.t('nocodeEditorAiPanel.deferFlow')

const updateExplicitFlowAutoContinueRemainingSeconds = () => {
  const deadlineAt = Number(explicitFlowAutoContinueDeadlineAt.value || 0)
  if (deadlineAt <= 0) {
    explicitFlowAutoContinueRemainingSeconds.value = 0
    return
  }
  explicitFlowAutoContinueRemainingSeconds.value = Math.max(
    0,
    Math.ceil((explicitFlowAutoContinueDeadlineAt.value - Date.now()) / 1000),
  )
}

const clearExplicitFlowAutoContinueTimer = () => {
  if (explicitFlowAutoContinueTimer.value) {
    clearTimeout(explicitFlowAutoContinueTimer.value)
    explicitFlowAutoContinueTimer.value = null
  }
  if (explicitFlowAutoContinueInterval.value) {
    clearInterval(explicitFlowAutoContinueInterval.value)
    explicitFlowAutoContinueInterval.value = null
  }
  explicitFlowAutoContinueTraceId.value = ''
  explicitFlowAutoContinueDeadlineAt.value = 0
  explicitFlowAutoContinueRemainingSeconds.value = 0
}

const getExplicitFlowAutoContinueCountdown = (message: NocodeEditorAiMessage) => {
  const traceId = normalizeTraceId(message.traceId || message.metadata?.traceId)
  if (!traceId || traceId !== explicitFlowAutoContinueTraceId.value) {
    return 0
  }
  const followUp = resolveMessagePostFormFlowFollowUp(message)
  const postFormFlowRelease = resolveMessagePostFormFlowRelease(message)
  if (
    !followUp
    || followUp.kind !== 'explicit_flow_clarification'
    || followUp.status !== 'available'
    || postFormFlowRelease?.status !== 'ready'
    || !postFormFlowRelease.shouldAutoContinue
  ) {
    return 0
  }
  return Math.max(0, Number(explicitFlowAutoContinueRemainingSeconds.value || 0))
}

const scheduleExplicitFlowAutoContinue = async (message: NocodeEditorAiMessage) => {
  const latestFollowUp = resolveMessagePostFormFlowFollowUp(message)
  const postFormFlowRelease = resolveMessagePostFormFlowRelease(message)
  if (
    !latestFollowUp
    || latestFollowUp.kind !== 'explicit_flow_clarification'
    || latestFollowUp.status !== 'available'
    || postFormFlowRelease?.status !== 'ready'
    || !postFormFlowRelease.shouldAutoContinue
  ) {
    clearExplicitFlowAutoContinueTimer()
    return
  }
  const delaySeconds = Math.max(0, Number(latestFollowUp.autoContinueDelaySeconds || 0))
  if (delaySeconds <= 0) {
    clearExplicitFlowAutoContinueTimer()
    return
  }
  const scheduledTraceId = normalizeTraceId(message.traceId || message.metadata?.traceId)
  if (!scheduledTraceId) {
    clearExplicitFlowAutoContinueTimer()
    return
  }
  if (
    explicitFlowAutoContinueTimer.value
    && explicitFlowAutoContinueTraceId.value === scheduledTraceId
  ) {
    return
  }

  clearExplicitFlowAutoContinueTimer()
  explicitFlowAutoContinueTraceId.value = scheduledTraceId
  explicitFlowAutoContinueDeadlineAt.value = Date.now() + delaySeconds * 1000
  updateExplicitFlowAutoContinueRemainingSeconds()
  explicitFlowAutoContinueInterval.value = setInterval(() => {
    if (explicitFlowAutoContinueTraceId.value !== scheduledTraceId) {
      return
    }
    updateExplicitFlowAutoContinueRemainingSeconds()
  }, 1000)
  explicitFlowAutoContinueTimer.value = setTimeout(async () => {
    clearExplicitFlowAutoContinueTimer()
    const candidateMessage = [...messages.value].reverse().find(item => (
      normalizeTraceId(item.traceId || item.metadata?.traceId) === scheduledTraceId
    ))
    const latestFollowUp = resolveMessagePostFormFlowFollowUp(candidateMessage || null)
    const latestPostFormFlowRelease = resolveMessagePostFormFlowRelease(candidateMessage || null)
    const candidateTraceId = normalizeTraceId(candidateMessage?.traceId || candidateMessage?.metadata?.traceId)
    if (candidateTraceId !== scheduledTraceId) {
      return
    }
    if (hasNewerUserMessageAfterMessage(messages.value, candidateMessage?.id)) {
      return
    }
    if (
      !latestFollowUp
      || latestFollowUp.kind !== 'explicit_flow_clarification'
      || latestFollowUp.status !== 'available'
      || latestPostFormFlowRelease?.status !== 'ready'
      || !latestPostFormFlowRelease.shouldAutoContinue
    ) {
      return
    }

    await submitMessage(String(latestFollowUp.autoContinueMessage || i18next.t('nocodeEditorAiPanel.defaultFlowContinueMessage')), {
      traceId: createTurnTraceId(),
      visibleUserContent: resolvePostFormFlowTailCardVisibleUserMessage(latestFollowUp),
    })
  }, delaySeconds * 1000)
}

const scheduleFlowBlueprintAutoContinue = async (
  candidate: FlowBlueprintAutoContinueCandidate,
) => {
  if (
    isPreparingSubmit.value
    || isResponding.value
    || isApplyingFlow.value
    || isApplyingBlueprint.value
    || isRefreshingBlueprint.value
  ) {
    clearFlowBlueprintAutoContinueTimer()
    return
  }

  if (
    flowBlueprintAutoContinueTimer.value
    && flowBlueprintAutoContinueCandidateKey.value === candidate.candidateKey
  ) {
    return
  }

  clearFlowBlueprintAutoContinueTimer()
  flowBlueprintAutoContinueCandidateKey.value = candidate.candidateKey
  flowBlueprintAutoContinueTimer.value = setTimeout(async () => {
    clearFlowBlueprintAutoContinueTimer()
    const latestCandidate = findLatestFlowBlueprintAutoContinueCandidateFromMessages(messages.value)
    if (
      !latestCandidate
      || latestCandidate.candidateKey !== candidate.candidateKey
      || hasNewerUserMessageAfterMessage(messages.value, latestCandidate.message.id)
    ) {
      return
    }

    await submitMessage(FLOW_BLUEPRINT_AUTO_CONTINUE_MESSAGE, {
      traceId: createTurnTraceId(),
      hiddenUserMessage: true,
      requestMetadata: {
        nocodeEditorInternalContinuation: {
          kind: 'flow_blueprint',
          key: candidate.candidateKey,
          planningContextKey: candidate.planningContextKey,
          schemeRevision: candidate.schemeRevision,
        },
        hideInternalContinuationUserMessage: true,
      },
    })
  }, FLOW_BLUEPRINT_AUTO_CONTINUE_DELAY_MS)
}

const tailPostFormFlowFollowUpCard = computed<NocodeEditorPostFormFlowTailCard | null>(() => {
  const latestFollowUpMessage = findLatestActivePostFormFlowFollowUpFromMessages(messages.value)
  if (!latestFollowUpMessage) {
    return null
  }

  const { followUp, message } = latestFollowUpMessage
  const postFormFlowRelease = resolveMessagePostFormFlowRelease(message)
  let readinessTagText = ''
  let contextText = ''
  if (postFormFlowRelease && postFormFlowRelease.status === 'needs_fix') {
    readinessTagText = i18next.t('nocodeEditorAiPanel.postFormFlowNeedsFixTag')
    contextText = i18next.t('nocodeEditorAiPanel.postFormFlowNeedsFix', {
      count: postFormFlowRelease.issueCount,
    })
  } else if (postFormFlowRelease && postFormFlowRelease.status === 'blocked_related') {
    readinessTagText = i18next.t('nocodeEditorAiPanel.postFormFlowBlockedRelatedTag')
    contextText = i18next.t('nocodeEditorAiPanel.postFormFlowBlockedRelated', {
      count: postFormFlowRelease.relatedIssueCount,
    })
  }
  return {
    message,
    followUp,
    release: postFormFlowRelease,
    statusSummary: followUp.reasonSummary,
    stateTagText: followUp.kind === 'explicit_flow_clarification'
      ? i18next.t('nocodeEditorAiPanel.recommendCreate')
      : followUp.recommendation === 'suggested'
        ? i18next.t('nocodeEditorAiPanel.recommendCreate')
        : followUp.recommendation === 'consider'
          ? i18next.t('nocodeEditorAiPanel.considerCreate')
          : i18next.t('nocodeEditorAiPanel.notRecommended'),
    readinessTagText,
    descriptionText: followUp.reasonSummary,
    contextText,
  }
})

const isPostFormFlowTailCardActionDisabled = computed(() => (
  isPreparingSubmit.value
  || isResponding.value
  || isApplyingFlow.value
  || isApplyingBlueprint.value
  || isRefreshingBlueprint.value
))

const handleCreateFlowFromTailCard = async () => {
  const card = tailPostFormFlowFollowUpCard.value
  if (!card || isPostFormFlowTailCardActionDisabled.value) {
    return
  }

  if (card.followUp.kind === 'explicit_flow_clarification') {
    clearExplicitFlowAutoContinueTimer()
  }

  await submitMessage(resolvePostFormFlowTailCardActionMessage(card.followUp), {
    traceId: createTurnTraceId(),
    visibleUserContent: resolvePostFormFlowTailCardVisibleUserMessage(card.followUp),
  })
}

const handleIgnorePostFormFlowTailCard = async () => {
  const card = tailPostFormFlowFollowUpCard.value
  if (!card || isPostFormFlowTailCardActionDisabled.value) {
    return
  }

  clearExplicitFlowAutoContinueTimer()

  await submitMessage(resolvePostFormFlowTailCardIgnoreMessage(), {
    traceId: createTurnTraceId(),
    visibleUserContent: resolvePostFormFlowTailCardIgnoreMessage(),
  })
}

const isFreshNewFormRequest = (currentUserMessage?: string) => {
  const userMessage = String(currentUserMessage || '').trim()
  const planningScope = resolveNocodeEditorPlanningScope(userMessage).scope
  return (
    (planningScope === 'app' && isNocodeEditorAppCreationIntent(userMessage))
    || (
      planningScope === 'form'
      && isNocodeEditorCompleteNewFormIntent({
        userMessage,
        editorMode: currentHostContext.value?.mode,
        activeFormId: currentHostContext.value?.activeFormId,
      })
    )
  )
}

const resolveActiveEntryFlowIntent = (currentUserMessage?: string) => {
  const freshNewFormRequest = isFreshNewFormRequest(currentUserMessage)
  const currentIntent = resolveNocodeEditorFlowEntryIntentWithSignal({
    userMessage: String(currentUserMessage || '').trim(),
    activeFormName: currentHostContext.value?.activeFormName,
    modelSignal: freshNewFormRequest
      ? null
      : resolveAuthoritativeFlowIntentSignal() || resolveLatestPlanningFlowIntentSignal(),
  })
  if (
    currentIntent.state === 'explicit_positive'
    || currentIntent.state === 'explicit_negative'
    || freshNewFormRequest
  ) {
    return currentIntent
  }
  return resolveAuthoritativeEntryFlowIntent()
    || findLatestEntryFlowIntentFromMessages(messages.value)
    || currentIntent
}

const normalizeStoredEntryFlowIntent = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as ReturnType<typeof resolveNocodeEditorFlowEntryIntent>
  if (
    candidate.state === 'explicit_positive'
    || candidate.state === 'explicit_negative'
    || candidate.state === 'none'
  ) {
    return candidate
  }
  return null
}

const resolveMessageMetadataEntryFlowIntent = (
  metadata?: Record<string, unknown> | null,
) => {
  const candidates = [metadata?.requestScenePayload, metadata?.scenePayload]
  for (const candidate of candidates) {
    const scenePayload = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
      ? candidate as Record<string, unknown>
      : null
    const entryFlowIntent = normalizeStoredEntryFlowIntent(scenePayload?.entryFlowIntent)
    if (entryFlowIntent) {
      return entryFlowIntent
    }
  }

  const taskSummary = metadata?.taskSummary && typeof metadata.taskSummary === 'object' && !Array.isArray(metadata.taskSummary)
    ? metadata.taskSummary as Record<string, unknown>
    : null
  const taskBoundaryIntent = normalizeStoredEntryFlowIntent(taskSummary?.entryFlowIntent)
  if (taskBoundaryIntent?.state === 'none') {
    return taskBoundaryIntent
  }

  return null
}

const resolveAuthoritativeEntryFlowIntent = () => (
  normalizeStoredEntryFlowIntent(authoritativeTaskSummary.value?.entryFlowIntent)
)

const resolveAuthoritativeFlowIntentSignal = () => (
  resolveFlowIntentSignalFromRecord(authoritativeTaskSummary.value)
)

const resolveAuthoritativePlanningScope = () => (
  normalizeNocodeEditorPlanningScopeValue(authoritativeTaskSummary.value?.planningScope)
)

const resolveRequestScopedEntryFlowIntent = (input: {
  requestScenePayload?: Record<string, unknown> | null
  requestUserMessage?: string
  requestFlowIntentSignal?: unknown
}) => {
  const requestUserMessage = String(input.requestUserMessage || '').trim()
  const requestFlowIntentSignal = normalizeNocodeEditorFlowIntentSignal(input.requestFlowIntentSignal)
  const requestIntent = resolveNocodeEditorFlowEntryIntentWithSignal({
    userMessage: requestUserMessage,
    activeFormName: currentHostContext.value?.activeFormName,
    modelSignal: requestFlowIntentSignal,
  })
  const normalizedRequestIntent = {
    ...requestIntent,
    sourceUserMessage: requestUserMessage,
  }
  if (
    normalizedRequestIntent.state === 'explicit_positive'
    || normalizedRequestIntent.state === 'explicit_negative'
  ) {
    return normalizedRequestIntent
  }
  const storedIntent = normalizeStoredEntryFlowIntent(input.requestScenePayload?.entryFlowIntent)
  if (storedIntent) {
    return storedIntent
  }
  return resolveAuthoritativeEntryFlowIntent() || normalizedRequestIntent
}

const normalizeComposerAttachment = (value: unknown): AiAttachment | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const raw = value as Record<string, unknown>
  const reference = normalizeAiAttachmentReference(raw)
  if (!reference) {
    return null
  }

  const status = ['ready', 'uploading', 'error'].includes(String(raw.status || '').trim())
    ? String(raw.status || '').trim() as AiAttachment['status']
    : 'ready'
  const source = ['local', 'uploaded'].includes(String(raw.source || '').trim())
    ? String(raw.source || '').trim() as AiAttachment['source']
    : undefined
  const uploadHandle = raw.uploadHandle && typeof raw.uploadHandle === 'object' && !Array.isArray(raw.uploadHandle)
    ? {
      id: String((raw.uploadHandle as Record<string, unknown>).id || reference.id).trim() || reference.id,
      fullPath: String((raw.uploadHandle as Record<string, unknown>).fullPath || '').trim(),
      sessionId: String((raw.uploadHandle as Record<string, unknown>).sessionId || '').trim() || undefined,
      originFilePath: String((raw.uploadHandle as Record<string, unknown>).originFilePath || '').trim() || undefined,
    }
    : undefined

  return {
    ...reference,
    status,
    source,
    url: String(raw.url || '').trim() || undefined,
    previewUrl: String(raw.previewUrl || '').trim() || undefined,
    file: raw.file instanceof File ? raw.file : undefined,
    uploadHandle: uploadHandle?.fullPath ? uploadHandle : undefined,
  }
}

const normalizeComposerAttachments = (value: unknown): AiAttachment[] => (
  Array.isArray(value)
    ? value.map(item => normalizeComposerAttachment(item)).filter(Boolean) as AiAttachment[]
    : []
)

const resolveExcelCreateAttachmentPayload = (
  attachments: AiAttachment[],
): StartExcelFormCreatePayload | undefined => {
  const targetAttachment = resolveUniqueReadyExcelAttachment(attachments)
  if (!targetAttachment?.uploadHandle?.fullPath) {
    return undefined
  }

  return {
    name: String(targetAttachment.name || '').trim() || undefined,
    formName: stripAiAttachmentFileExtension(targetAttachment.name) || undefined,
    attachmentId: String(targetAttachment.id || '').trim() || undefined,
    fullPath: targetAttachment.uploadHandle.fullPath,
    sessionId: targetAttachment.uploadHandle.sessionId,
    originFilePath: targetAttachment.uploadHandle.originFilePath,
  }
}

const getUserAttachments = (message: NocodeEditorAiMessage): AiAttachmentReference[] => {
  if (message.role !== NocodeEditorAiMessageRole.USER) {
    return []
  }
  return normalizeAiAttachmentMessageMetadata(message.metadata).attachments
}

const getUserExcelAttachments = (message: NocodeEditorAiMessage) => (
  getUserAttachments(message).filter(item => item.kind === 'excel')
)

const getUserGeneralAttachments = (message: NocodeEditorAiMessage) => (
  getUserAttachments(message).filter(item => item.kind !== 'excel')
)

const getEditorAttachmentContentUrl = (attachment: AiAttachmentReference) => {
  const attachmentId = String(attachment.remoteHandle?.attachmentId || '').trim()
  const currentConversationId = normalizeConversationId(conversationId.value || boundConversationId.value)
  return currentConversationId && attachmentId
    ? `/ai/nocode-editor/conversations/${currentConversationId}/attachments/${attachmentId}/content?nocodeId=${encodeURIComponent(props.nocodeId)}`
    : ''
}

const hasExcelAttachmentHandle = (attachment: AiAttachmentReference) => hasAiAttachmentUploadHandle(attachment)

const isExcelAttachmentExpired = (attachment: AiAttachmentReference) => !hasExcelAttachmentHandle(attachment)

const isHistoryAttachmentCreateDisabled = (attachment: AiAttachmentReference) => (
  completedExcelCreateAttachmentIds.value.has(String(attachment.id || '').trim())
)

const handleCreateFormFromHistoryAttachment = (attachment: AiAttachmentReference) => {
  if (!hasExcelAttachmentHandle(attachment)) {
    ElMessage.warning(i18next.t('nocodeEditorAiPanel.fileExpiredUploadAgain'))
    return
  }
  const fullPath = String(attachment.uploadHandle?.fullPath || '').trim()
  if (!fullPath) {
    ElMessage.warning(i18next.t('nocodeEditorAiPanel.fileExpiredUploadAgain'))
    return
  }

  emit('start-excel-form-create', {
    name: String(attachment.name || '').trim() || undefined,
    formName: stripAiAttachmentFileExtension(attachment.name) || undefined,
    attachmentId: String(attachment.id || '').trim() || undefined,
    fullPath,
    sessionId: attachment.uploadHandle?.sessionId,
    originFilePath: resolveAiAttachmentImportSourcePath(attachment),
  })
}

const handleAddHistoryAttachmentToComposer = (attachment: AiAttachmentReference) => {
  if (!hasExcelAttachmentHandle(attachment)) {
    ElMessage.warning(i18next.t('nocodeEditorAiPanel.fileExpiredUploadAgain'))
    return
  }
  const clonedAttachment = cloneAiExcelAttachmentForComposer(attachment)
  if (!clonedAttachment) {
    ElMessage.warning(i18next.t('nocodeEditorAiPanel.fileExpiredUploadAgain'))
    return
  }
  const normalizedAttachment = normalizeComposerAttachment(clonedAttachment)
  if (!normalizedAttachment) {
    return
  }

  composerAttachments.value = replaceCurrentExcelAttachment([
    ...composerAttachments.value.filter(item => item.id !== normalizedAttachment.id),
    normalizedAttachment,
  ], normalizedAttachment)
}

const buildExcelAnalysisStartPayload = (
  decision: Extract<ComposerAttachmentRouteDecision, { mode: 'start-excel-analysis' }>,
): StartExcelFileAnalysisPayload => ({
  ...(decision.excelAttachment || {}),
  visibleUserContent: decision.userFacingContent,
  requestMetadata: decision.userMetadata,
})

const formatEditorAttachmentSummaryLines = (
  attachments: AiAttachmentReference[],
  attachmentIntent?: AiAttachmentIntentHint,
) => {
  if (!attachments.length) {
    return []
  }

  const lines = attachments.map((attachment) => {
    if (!Number.isFinite(Number(attachment.size)) || Number(attachment.size) <= 0) {
      return attachment.name
    }
    const normalizedSize = Number(attachment.size)
    if (normalizedSize < 1024) {
      return `${attachment.name} (${normalizedSize} B)`
    }
    if (normalizedSize < 1024 * 1024) {
      return `${attachment.name} (${(normalizedSize / 1024).toFixed(1)} KB)`
    }
    return `${attachment.name} (${(normalizedSize / (1024 * 1024)).toFixed(1)} MB)`
  })

  if (attachmentIntent) {
    lines.push(attachmentIntent.summary || buildAiAttachmentIntentSummary(attachmentIntent))
  }

  return lines
}

const buildEditorAttachmentRequestMetadata = (
  text: string,
  attachments: AiAttachment[],
) => {
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
  const summaryLines = formatEditorAttachmentSummaryLines(attachmentReferences, attachmentIntent)
  const summaryText = summaryLines.join('\n')
  const userFacingContent = text.trim()
  const providerRequestContent = userFacingContent || buildAiAttachmentFallbackRequestText(attachmentIntent)
  const providerPromptContent = [
    providerRequestContent,
    ...buildAiAttachmentPromptLines(baseMetadata),
  ].filter(Boolean).join('\n\n')

  return {
    attachmentIntent,
    attachmentReferences,
    requestMetadata: {
      ...baseMetadata,
      attachmentSummary: summaryText,
      attachmentSummaryLines: summaryLines,
      userFacingContent,
      providerPromptContent,
    } as Record<string, unknown>,
    userFacingContent,
    providerPromptContent,
  }
}

const resolveEditorAttachmentErrorMessage = (error: unknown) => {
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
  if (axios.isAxiosError(error)) {
    const responseMessage = String(error.response?.data?.message || '').trim()
    return attachmentMessages[responseMessage] || responseMessage || error.message
  }
  const message = error instanceof Error ? error.message : String(error || '')
  return attachmentMessages[message] || message
}

const prepareEditorAttachmentsForSend = async (
  currentConversationId: string,
  currentTaskId: string | undefined,
  attachments: AiAttachment[],
  modelSelection?: AiThreadModelSelection | null,
) => {
  const uploadedAttachments: AiAttachment[] = []
  const uploadedAttachmentIds: string[] = []
  try {
    for (const attachment of attachments) {
      if (attachment.remoteHandle?.attachmentId) {
        uploadedAttachments.push(attachment)
        continue
      }
      if (!attachment.file) {
        throw new Error('AI_ATTACHMENT_NOT_FOUND')
      }
      const formData = new FormData()
      formData.append('file', attachment.file, attachment.name)
      formData.append('nocodeId', props.nocodeId)
      if (currentTaskId) {
        formData.append('taskId', currentTaskId)
      }
      const { data } = await axios.post<AiAttachmentReference>(
        `/ai/nocode-editor/conversations/${currentConversationId}/attachments`,
        formData,
      )
      uploadedAttachments.push({
        ...attachment,
        ...data,
        source: 'uploaded',
        file: undefined,
      })
      uploadedAttachmentIds.push(String(data.remoteHandle?.attachmentId || data.id || '').trim())
    }

    const attachmentReferences = uploadedAttachments
      .map(item => normalizeAiAttachmentReference(item))
      .filter(Boolean) as AiAttachmentReference[]
    await axios.post(`/ai/nocode-editor/conversations/${currentConversationId}/attachments/preflight`, {
      nocodeId: props.nocodeId,
      taskId: currentTaskId,
      attachments: attachmentReferences,
      ...(modelSelection?.modelSelectionSource !== 'default' && modelSelection
        ? {
          providerId: modelSelection.providerId || undefined,
          modelId: modelSelection.modelId || undefined,
          model: modelSelection.model || undefined,
        }
        : {}),
    })
    return uploadedAttachments
  } catch (error) {
    await Promise.all(uploadedAttachmentIds.filter(Boolean).map(attachmentId => (
      axios.delete(`/ai/nocode-editor/conversations/${currentConversationId}/attachments/${attachmentId}`, {
        params: {
          nocodeId: props.nocodeId,
          taskId: currentTaskId,
        },
      })
        .catch(() => undefined)
    )))
    throw error
  }
}

const syncMessageTraceId = (message: NocodeEditorAiMessage, value: unknown) => {
  const traceId = normalizeTraceId(value)
  if (!traceId) {
    return ''
  }
  message.traceId = traceId
  ensureMessageMetadata(message).traceId = traceId
  return traceId
}

const syncAuthoritativeUserMessageId = (traceId: string, messageId: string) => {
  const normalizedTraceId = normalizeTraceId(traceId)
  const normalizedMessageId = String(messageId || '').trim()
  if (!normalizedTraceId || !normalizedMessageId || messages.value.some(message => message.id === normalizedMessageId)) {
    return
  }
  const message = messages.value.find(item => (
    item.role === NocodeEditorAiMessageRole.USER
    && normalizeTraceId(item.traceId || item.metadata?.traceId) === normalizedTraceId
  ))
  if (message) {
    message.id = normalizedMessageId
  }
}

const buildEditorExcelAnalysisFollowupMetadata = (
  text: string,
  options?: {
    baseMetadata?: Record<string, unknown> | null
  },
) => {
  const context = activeExcelAnalysisContext.value
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
    disableToolFlag: 'disableNocodeEditorTools',
    userFacingContent: trimmedText,
  })
  if (!followupBehavior || followupBehavior.mode !== 'continue-analysis') {
    return options?.baseMetadata || null
  }

  return followupBehavior.requestPayload.requestMetadata as Record<string, unknown>
}

const getMessageBlocks = (message: NocodeEditorAiMessage) => (
  resolveAiAssistantMessageBlocks(message.metadata?.blocks)
)

const getRenderableFlowPatchResultBlocks = (message: NocodeEditorAiMessage) => (
  message.role === NocodeEditorAiMessageRole.ASSISTANT
    ? getMessageBlocks(message).filter(
      (block): block is AiAssistantFlowPatchResultBlock => block.type === 'flow-patch-result',
    )
    : []
)

const buildPlanningArtifactContextKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const flowScheme = block?.kind === 'flow-scheme'
    ? normalizeNocodeEditorFlowScheme(block.scheme)
    : null
  const flowPlan = block?.kind === 'flow-plan'
    ? normalizeNocodeEditorFlowPlan(block.flowPlan)
    : null
  const outline = block?.kind === 'app-plan'
    ? (block.appPlan?.outline || block.outline)
    : block?.outline

  return buildPlanningConfirmationContextKey({
    stage: block?.kind,
    outlineId: flowPlan?.id
      || flowScheme?.id
      || flowPlan?.title
      || flowScheme?.title
      || outline?.id
      || block?.appPlan?.id,
    primaryFormKey: flowPlan?.target?.formId
      || flowScheme?.target?.formId
      || flowPlan?.target?.formName
      || flowScheme?.target?.formName
      || outline?.forms?.[0]?.formKey
      || outline?.forms?.[0]?.tableName
      || block?.appPlan?.goal,
    revision: Number(block?.revision || 0),
    stagedAt: Number(block?.stagedAt || 0),
  })
}

const buildLogicalPlanningArtifactContextKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const flowScheme = block?.kind === 'flow-scheme'
    ? normalizeNocodeEditorFlowScheme(block.scheme)
    : null
  const flowPlan = block?.kind === 'flow-plan'
    ? normalizeNocodeEditorFlowPlan(block.flowPlan)
    : null
  const outline = block?.kind === 'app-plan'
    ? (block.appPlan?.outline || block.outline)
    : block?.outline

  return buildLogicalPlanningConfirmationContextKey({
    stage: block?.kind,
    outlineId: flowPlan?.id
      || flowScheme?.id
      || flowPlan?.title
      || flowScheme?.title
      || outline?.id
      || block?.appPlan?.id,
    primaryFormKey: flowPlan?.target?.formId
      || flowScheme?.target?.formId
      || flowPlan?.target?.formName
      || flowScheme?.target?.formName
      || outline?.forms?.[0]?.formKey
      || outline?.forms?.[0]?.tableName
      || block?.appPlan?.goal,
  })
}

const buildArtifactPlanningContextKeys = (
  block?: NocodeEditorAiArtifactBlock | null,
) => Array.from(new Set([
  buildPlanningArtifactContextKey(block),
  buildLogicalPlanningArtifactContextKey(block),
].filter(Boolean)))

const withPlanningArtifactConfirmationContext = (
  block: NocodeEditorAiArtifactBlock,
) => {
  if (
    block.kind !== 'app-plan'
    && block.kind !== 'form-plan'
    && block.kind !== 'content-plan'
    && block.kind !== 'flow-scheme'
    && block.kind !== 'flow-plan'
  ) {
    return block
  }

  const confirmation = resolveAiArtifactConfirmation(block)
  const planningContextKey = buildPlanningArtifactContextKey(block)
  if (!confirmation || !planningContextKey) {
    return block
  }

  const nextBlock = {
    ...block,
    confirmation: {
      ...confirmation,
      planningContextKey,
    },
  }
  return reconcilePlanningArtifactConfirmation(
    nextBlock,
    nextBlock.confirmation,
  )
}

const resolveLatestCompletedPlanningConfirmation = (
  options: {
    preferredMessage?: NocodeEditorAiMessage | null
    planningContextKey?: string | null
    planningContextKeys?: Array<string | null | undefined>
    traceId?: string | null
  } = {},
): NocodeEditorAiConfirmPayload | null => {
  const candidates = [
    ...(options.preferredMessage ? [options.preferredMessage] : []),
    ...[...messages.value].reverse(),
  ]
  const visitedMessageIds = new Set<string>()
  const planningContextKeys = [
    ...(Array.isArray(options.planningContextKeys) ? options.planningContextKeys : []),
    options.planningContextKey,
  ].map(item => String(item || '').trim()).filter(Boolean)

  for (const message of candidates) {
    if (!message) {
      continue
    }

    const messageId = String(message.id || '').trim()
    if (messageId) {
      if (visitedMessageIds.has(messageId)) {
        continue
      }
      visitedMessageIds.add(messageId)
    }

    const blocks = getMessageBlocks(message)
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      const block = blocks[index]
      if (!isAiArtifactBlock(block) || !['app-plan', 'form-plan', 'content-plan', 'flow-scheme', 'flow-plan'].includes(block.kind)) {
        continue
      }

      const confirmation = resolveAiArtifactConfirmation(block)
      if (
        confirmation?.status === 'completed'
        && Array.isArray(confirmation.questions)
        && confirmation.questions.length > 0
      ) {
        const matchedContextKey = planningContextKeys.find(item => (
          isSamePlanningConfirmationContext(confirmation.planningContextKey, item)
        ))
        if (matchedContextKey) {
          return confirmation
        }
        if (canFallbackToTraceScopedPlanningConfirmation({
          candidateContextKey: confirmation.planningContextKey,
          preferredTraceId: options.traceId,
          candidateTraceId: normalizeTraceId(message.traceId || message.metadata?.traceId),
        })) {
          return {
            ...confirmation,
            planningContextKey: planningContextKeys[0] || confirmation.planningContextKey,
          }
        }
      }
    }
  }

  return null
}

const resolveCompletedPlanningConfirmationFromBlock = (
  block?: NocodeEditorAiArtifactBlock | null,
): NocodeEditorAiConfirmPayload | null => {
  const confirmation = block ? resolveAiArtifactConfirmation(block) : null
  if (
    confirmation?.status === 'completed'
    && Array.isArray(confirmation.questions)
    && confirmation.questions.length > 0
  ) {
    return cloneBlueprintValue(confirmation)
  }
  return null
}

const resolveCompletedArtifactConfirmationFromReply = (
  block?: NocodeEditorAiArtifactBlock | null,
  replyContent?: string | null,
): NocodeEditorAiConfirmPayload | null => {
  const confirmation = block ? resolveAiArtifactConfirmation(block) : null
  if (!confirmation?.questions?.length) {
    return null
  }

  return deriveCompletedConfirmationFromReplyMessage(
    confirmation,
    replyContent,
  ) || deriveDefaultCompletedConfirmationFromReplyMessage(
    confirmation,
    replyContent,
  )
}

const replayCompletedArtifactConfirmationsFromMessages = (
  messageList: NocodeEditorAiMessage[],
) => {
  const pendingBlocksByDraftKey = new Map<string, NocodeEditorAiArtifactBlock>()

  for (const message of messageList) {
    if (message.role === NocodeEditorAiMessageRole.ASSISTANT) {
      for (const block of getAllArtifactBlocks(message)) {
        const draftKey = buildConfirmationDraftKey(block)
        if (!draftKey) {
          continue
        }

        const completedConfirmation = resolveCompletedPlanningConfirmationFromBlock(block)
        if (completedConfirmation) {
          applyOptimisticConfirmationToMatchingBlocks(block, completedConfirmation, draftKey)
          pendingBlocksByDraftKey.delete(draftKey)
          continue
        }

        const confirmation = resolveAiArtifactConfirmation(block)
        if (confirmation?.questions?.length) {
          pendingBlocksByDraftKey.set(draftKey, block)
        }
      }
      continue
    }

    if (message.role !== NocodeEditorAiMessageRole.USER) {
      continue
    }

    const replyContent = String(message.content || '').trim()
    if (!replyContent) {
      continue
    }

    const pendingEntries = [...pendingBlocksByDraftKey.entries()]
    for (let index = pendingEntries.length - 1; index >= 0; index -= 1) {
      const [draftKey, block] = pendingEntries[index]
      const completedConfirmation = resolveCompletedArtifactConfirmationFromReply(
        block,
        replyContent,
      )
      if (!completedConfirmation) {
        continue
      }

      applyOptimisticConfirmationToMatchingBlocks(block, completedConfirmation, draftKey)
      pendingBlocksByDraftKey.delete(draftKey)
      break
    }
  }
}

const resolveAppBuilderPlanningOutline = (
  message: NocodeEditorAiMessage,
): NonNullable<NocodeEditorAiArtifactBlock['outline']> | null => {
  const outline = normalizeNocodeEditorPlanningOutline(
    message.metadata?.appBuilderPlanningOutline,
    {
      titleFallback: i18next.t('nocodeEditorAiPanel.appStructure'),
      confirmationStage: 'app-plan',
    },
  )
  return outline as NonNullable<NocodeEditorAiArtifactBlock['outline']> | null
}

const buildAppBuilderPlanningAppPlanArtifact = (
  message: NocodeEditorAiMessage,
): NocodeEditorAiArtifactBlock | null => {
  const outline = resolveAppBuilderPlanningOutline(message)
  if (!outline) {
    return null
  }

  const planningArtifacts = normalizeNocodeEditorAiPlanningArtifacts(
    message.metadata?.appBuilderPlanningArtifacts,
  )
  const goal = String(outline.title || message.metadata?.appBuilderPlanningSummary || '').trim() || i18next.t('nocodeEditorAiPanel.appPlan')

  return withResolvedArtifactConfirmation({
    type: 'artifact',
    kind: 'app-plan',
    status: 'ready',
    revision: 1,
    stagedAt: Number(message.createTime || 0) || undefined,
    title: goal,
    summary: outline.summary,
    flowIntent: outline.flowIntent || undefined,
    confirmation: (outline as NocodeEditorAiSolutionOutlineWithConfirmation).confirmation || undefined,
    applicationStructurePreview: {
      enabled: true,
      previewMode: 'app-plan',
      focusFormKey: String(outline.forms?.[0]?.formKey || '').trim() || undefined,
      focusFormName: String(outline.forms?.[0]?.tableName || '').trim() || undefined,
      highlightModuleKeys: Array.isArray(outline.modules)
        ? outline.modules.map(item => String(item?.moduleKey || item?.name || '').trim()).filter(Boolean)
        : [],
    },
    appPlan: {
      mode: 'greenfield',
      goal,
      objects: Array.isArray(outline.forms)
        ? outline.forms.map(item => String(item?.tableName || '').trim()).filter(Boolean)
        : [],
      artifacts: planningArtifacts.map(item => ({
        type: String(item?.type || 'artifact').trim() || 'artifact',
        name: String(item?.name || '').trim(),
        executionLevel: String(item?.executionLevel || '').trim() || undefined,
        purpose: String(item?.purpose || '').trim() || undefined,
      })).filter(item => item.name),
      openQuestions: Array.isArray(outline.openQuestions) ? outline.openQuestions : [],
      outline,
      flowIntent: outline.flowIntent || undefined,
    },
    confirmationCardPresentation: buildSharedAppPlanConfirmationCardPresentation({
      summary: goal,
      goal,
      mode: 'greenfield',
      objects: Array.isArray(outline.forms)
        ? outline.forms.map(item => String(item?.tableName || '').trim()).filter(Boolean)
        : [],
      artifacts: planningArtifacts,
      openQuestions: Array.isArray(outline.openQuestions) ? outline.openQuestions : [],
      confirmation: (outline as NocodeEditorAiSolutionOutlineWithConfirmation).confirmation || undefined,
    }) || undefined,
  } as NocodeEditorAiArtifactBlock)
}

const normalizeEditorArtifactBlocks = (
  blocks: unknown,
): NocodeEditorAiArtifactBlock[] => (
  normalizeNocodeEditorArtifactBlocks(
    Array.isArray(blocks) ? blocks as NocodeEditorAiArtifactBlock[] : [],
  )
)

const getExplicitArtifactBlocks = (message: NocodeEditorAiMessage): NocodeEditorAiArtifactBlock[] => (
  normalizeEditorArtifactBlocks(getMessageBlocks(message).filter(isArtifactBlock))
    .map(block => withResolvedArtifactConfirmation(block))
)

const artifactBlocksByMessage = new WeakMap<NocodeEditorAiMessage, {
  metadata: NocodeEditorAiMessage['metadata']
  blocks: unknown
  content: string
  createTime: NocodeEditorAiMessage['createTime']
  value: NocodeEditorAiArtifactBlock[]
}>()

const getAllArtifactBlocks = (message: NocodeEditorAiMessage): NocodeEditorAiArtifactBlock[] => {
  const cached = artifactBlocksByMessage.get(message)
  if (
    cached
    && cached.metadata === message.metadata
    && cached.blocks === message.metadata?.blocks
    && cached.content === message.content
    && cached.createTime === message.createTime
  ) {
    return cached.value
  }

  const baseBlocks = getExplicitArtifactBlocks(message)
  const toolMessageBlocks = normalizeEditorArtifactBlocks(
    buildArtifactBlocksFromPersistedToolMessage(message),
  )
  const combinedBlocks = normalizeEditorArtifactBlocks([
    ...baseBlocks,
    ...toolMessageBlocks,
  ])
  const importedBlocks = suppressImportedHandoffArtifactBlocks({
    metadata: message.metadata || null,
    blocks: combinedBlocks,
  })
  let resolvedBlocks: NocodeEditorAiArtifactBlock[]
  if (importedBlocks !== combinedBlocks) {
    resolvedBlocks = importedBlocks
  } else if (importedBlocks.some(block => block.kind === 'app-plan' || block.kind === 'form-plan')) {
    resolvedBlocks = importedBlocks
  } else {
    const appBuilderPlanningAppPlan = buildAppBuilderPlanningAppPlanArtifact(message)
    resolvedBlocks = appBuilderPlanningAppPlan
      ? normalizeEditorArtifactBlocks([
        ...importedBlocks,
        appBuilderPlanningAppPlan,
      ])
      : importedBlocks
  }

  if (!resolvedBlocks.some(block => block.kind === 'flow-plan')) {
    artifactBlocksByMessage.set(message, {
      metadata: message.metadata,
      blocks: message.metadata?.blocks,
      content: message.content,
      createTime: message.createTime,
      value: resolvedBlocks,
    })
  }
  return resolvedBlocks
}

const resolveLatestFlowSchemePlanningContextKey = () => {
  for (let messageIndex = messages.value.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages.value[messageIndex]
    const artifactBlocks = getAllArtifactBlocks(message)
    for (let blockIndex = artifactBlocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = artifactBlocks[blockIndex]
      if (block.kind !== 'flow-scheme') {
        continue
      }

      const planningContextKey = String(
        block.confirmation?.planningContextKey
        || buildPlanningArtifactContextKey(block)
        || '',
      ).trim()
      if (planningContextKey) {
        return planningContextKey
      }
    }
  }

  return ''
}

const resolveLatestFlowSchemeTitleForPlanningContext = (
  planningContextKey?: string | null,
) => {
  const normalizedPlanningContextKey = String(planningContextKey || '').trim()
  let fallbackTitle = ''

  for (let messageIndex = messages.value.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const artifactBlocks = [...getAllArtifactBlocks(messages.value[messageIndex])].reverse()
    for (const block of artifactBlocks) {
      if (block.kind !== 'flow-scheme') {
        continue
      }

      const blockPlanningContextKey = String(
        block.confirmation?.planningContextKey
        || buildPlanningArtifactContextKey(block)
        || '',
      ).trim()
      if (
        normalizedPlanningContextKey
        && !isSamePlanningConfirmationContext(blockPlanningContextKey, normalizedPlanningContextKey)
      ) {
        continue
      }

      const title = String(resolveAiArtifactTitle(block) || '').trim()
      if (!title) {
        continue
      }
      if (title !== '流程方案') {
        return title
      }
      if (!fallbackTitle) {
        fallbackTitle = title
      }
    }
  }

  return fallbackTitle
}

const planningDisplayVersionIndex = computed(() => buildPlanningDisplayVersionIndex({
  messages: messages.value,
  artifactBlocks: messages.value.flatMap(message => getAllArtifactBlocks(message)),
  stagedFormPlan: stagedFormPlan.value,
  stagedAppPlan: stagedAppPlan.value,
  stagedBlueprint: stagedBlueprint.value,
}))

const planningDisplayVersionByContextKey = computed<Record<string, number>>(() => {
  const entries: Record<string, number> = {}
  planningDisplayVersionIndex.value.versionByContextKey.forEach((value, key) => {
    if (!key || value <= 0) {
      return
    }
    entries[key] = value
  })
  return entries
})

const blueprintDisplayVersionIndex = computed(() => buildBlueprintDisplayVersionIndex({
  messages: messages.value,
  artifactBlocks: messages.value.flatMap(message => getAllArtifactBlocks(message)),
  stagedBlueprint: stagedBlueprint.value,
}))

const blueprintSourcePlanningContextKeyIndex = computed(() => buildBlueprintSourcePlanningContextKeyIndex([
  ...messages.value.flatMap(message => getAllArtifactBlocks(message)),
  ...(stagedBlueprint.value.blueprint
    ? [{
      type: 'artifact' as const,
      kind: 'blueprint' as const,
      status: 'ready' as const,
      revision: stagedBlueprint.value.revision,
      stagedAt: stagedBlueprint.value.stagedAt,
      sourcePlanningContextKey: stagedBlueprint.value.sourcePlanningContextKey || null,
      blueprint: stagedBlueprint.value.blueprint,
      phase: stagedBlueprint.value.phase,
    } as NocodeEditorAiArtifactBlock]
    : []),
]))

const resolveDisplayVersionLabel = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (!block) {
    return ''
  }

  if (block.kind === 'app-plan' || block.kind === 'form-plan') {
    return resolvePlanningArtifactDisplayVersionLabel(block, planningDisplayVersionIndex.value)
      || resolveAiArtifactVersionLabel(block)
  }

  if (block.kind === 'blueprint') {
    const displayBlock = withBlueprintSourcePlanningContext(block, blueprintSourcePlanningContextKeyIndex.value) || block
    return resolveBlueprintDisplayVersionLabel(displayBlock, blueprintDisplayVersionIndex.value)
      || resolveAiArtifactVersionLabel(displayBlock)
  }

  if (block.kind === 'formula-plan') {
    return resolveFormulaPlanDisplayVersionLabel(block)
      || resolveAiArtifactVersionLabel(block)
  }

  return resolveAiArtifactVersionLabel(block)
}

const withDisplayVersionLabel = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (!block) {
    return block
  }

  const displayBlock = block.kind === 'blueprint'
    ? withBlueprintSourcePlanningContext(block, blueprintSourcePlanningContextKeyIndex.value) || block
    : block
  const displayRevision = displayBlock.kind === 'app-plan' || displayBlock.kind === 'form-plan'
    ? resolvePlanningArtifactDisplayRevision(displayBlock, planningDisplayVersionIndex.value)
    : displayBlock.kind === 'blueprint'
      ? resolveBlueprintDisplayRevision(displayBlock, blueprintDisplayVersionIndex.value)
      : displayBlock.kind === 'formula-plan'
        ? Number(displayBlock.revision || 0) || undefined
        : undefined
  const displayVersionLabel = resolveDisplayVersionLabel(displayBlock)

  if (!displayRevision && !displayVersionLabel) {
    return block
  }

  return {
    ...block,
    sourcePlanningContextKey: displayBlock.sourcePlanningContextKey || block.sourcePlanningContextKey,
    displayRevision: displayRevision || block.displayRevision,
    displayVersionLabel: displayVersionLabel || block.displayVersionLabel,
  }
}

const normalizePendingBlueprintDisplayValue = (value: unknown) => String(value || '').trim()

const collectPendingBlueprintDisplaySourceBlocks = () => {
  const blocks = messages.value
    .flatMap(message => getAllArtifactBlocks(message))
    .filter(block => block.kind === 'blueprint' && block.status === 'ready' && block.blueprint)
  const stagedBlock = buildBlueprintArtifactBlock(stagedBlueprint.value)
  return stagedBlock ? [...blocks, stagedBlock] : blocks
}

const resolvePendingBlueprintDisplaySourceBlock = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
) => {
  const itemRevision = Number(item.revision || 0)
  const itemStagedAt = Number(item.stagedAt || 0)
  const itemSourcePlanningContextKey = normalizePendingBlueprintDisplayValue(item.sourcePlanningContextKey)
  const itemBlueprintId = normalizePendingBlueprintDisplayValue(item.blueprint?.id)

  return collectPendingBlueprintDisplaySourceBlocks().find((block) => {
    if (Number(block.revision || 0) !== itemRevision) {
      return false
    }
    if (Number(block.stagedAt || 0) !== itemStagedAt) {
      return false
    }
    if (
      itemSourcePlanningContextKey
      && normalizePendingBlueprintDisplayValue(
        getBlueprintArtifactPlanningContextKey(block),
      ) !== itemSourcePlanningContextKey
    ) {
      return false
    }
    if (
      itemBlueprintId
      && normalizePendingBlueprintDisplayValue(block.blueprint?.id) !== itemBlueprintId
    ) {
      return false
    }
    return true
  }) || null
}

const withPendingBlueprintDisplayVersion = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
) => {
  if (!item || item.itemKind !== 'ai_blueprint') {
    return item
  }

  const pendingItemDisplayBlock = {
    type: 'artifact',
    kind: 'blueprint',
    status: 'ready',
    revision: item.revision,
    stagedAt: item.stagedAt,
    sourcePlanningContextKey: item.sourcePlanningContextKey || null,
    blueprint: item.blueprint,
    phase: item.phase,
    applyResult: item.applyResult,
    draftPersistenceState: item.draftPersistenceState,
  } as NocodeEditorAiArtifactBlock
  const displaySourceBlock = resolvePendingBlueprintDisplaySourceBlock(item) || pendingItemDisplayBlock
  const displayBlock = withBlueprintSourcePlanningContext(
    displaySourceBlock,
    blueprintSourcePlanningContextKeyIndex.value,
  ) as NocodeEditorAiArtifactBlock
  const displayRevision = resolveBlueprintDisplayRevision(displayBlock, blueprintDisplayVersionIndex.value)
  if (!displayRevision) {
    return item
  }

  return {
    ...item,
    sourcePlanningContextKey: displayBlock.sourcePlanningContextKey || item.sourcePlanningContextKey,
    displayRevision,
    displayVersionLabel: resolveBlueprintDisplayVersionLabel(displayBlock, blueprintDisplayVersionIndex.value),
  }
}

const appliedBlueprintArtifactKeys = computed(() => {
  const keys = new Set<string>()
  messages.value.forEach((message) => {
    getAllArtifactBlocks(message).forEach((block) => {
      if (
        block.kind === 'blueprint'
        && isBlueprintAppliedPhase(block.phase)
      ) {
        const key = getNocodeEditorArtifactBlockMergeKey(block)
        if (key) {
          keys.add(key)
        }
      }
    })
  })
  return keys
})

const syncedAppliedFlowArtifactDraftIdentityKeys = computed(() => (
  new Set(collectSyncedAppliedFlowArtifactDraftIdentityKeys(messages.value, {
    getAllArtifactBlocks,
  }))
))

const sessionFlowStageArtifactBlocks = computed<NocodeEditorAiArtifactBlock[]>(() => {
  const blocks: NocodeEditorAiArtifactBlock[] = []
  for (const message of messages.value) {
    for (const block of getAllArtifactBlocks(message)) {
      if (block.kind === 'flow-scheme' || block.kind === 'flow-plan') {
        blocks.push(block)
      }
    }
  }
  return blocks
})

const hasFormulaExecutionResultAfterMessage = (message: NocodeEditorAiMessage) => {
  const messageIndex = messages.value.findIndex(candidate => candidate.id === message.id)
  const candidates = messageIndex >= 0
    ? messages.value.slice(messageIndex)
    : []
  return candidates.some((candidate) => {
    if (candidate.role !== NocodeEditorAiMessageRole.ASSISTANT) {
      return false
    }
    if (normalizeFormulaTargetResultItems(candidate.metadata?.formulaTargetResults).length > 0) {
      return true
    }
    if (normalizeFormulaActionItems(candidate.metadata?.formulaActions).length > 0) {
      return true
    }
    return getMessageBlocks(candidate).some(block => block.type === 'formula-result')
  })
}

const shouldHideMessageArtifactBlock = (
  message: NocodeEditorAiMessage,
  block: NocodeEditorAiArtifactBlock,
) => {
  const flowSchemeSyncDecision = resolveFlowSchemeArtifactSyncDecision({
    block,
    blocks: sessionFlowStageArtifactBlocks.value,
  })

  return Boolean(
    block.status === 'loading'
    || (
      message.metadata?.blueprintAppliedFromAction
      && message.metadata?.blueprintApplyStartedFromAction
      && block.kind === 'blueprint'
      && isBlueprintAppliedPhase(block.phase)
    )
    || (
      isFlowBlueprintExpansionStateBlock(block)
    )
    || (
      isFlowSchemePlanningStateBlock(block)
    )
    || isLegacyFlowSchemeGuardPlaceholderArtifact(block)
    || (
      block.kind === 'flow-scheme'
      && block.status === 'ready'
      && flowSchemeSyncDecision.reason === 'stale_flow_scheme_artifact'
    )
    || shouldHideAppliedFlowArtifactInActionMessage({
      message,
      block,
      syncedDraftIdentityKeys: syncedAppliedFlowArtifactDraftIdentityKeys.value,
    })
    || (
      block.kind === 'blueprint'
      && !isBlueprintAppliedPhase(block.phase)
      && appliedBlueprintArtifactKeys.value.has(getNocodeEditorArtifactBlockMergeKey(block))
    )
    || (
      block.kind === 'formula-plan'
      && hasFormulaExecutionResultAfterMessage(message)
    ),
  )
}

const getRenderableArtifactBlocks = (message: NocodeEditorAiMessage) => {
  return getAllArtifactBlocks(message)
    .filter(block => !shouldHideMessageArtifactBlock(message, block))
    .filter((block) => {
      if (
        block.kind === 'app-plan'
        || block.kind === 'form-plan'
        || block.kind === 'content-plan'
        || block.kind === 'formula-plan'
        || block.kind === 'flow-scheme'
        || block.kind === 'flow-plan'
      ) {
        const state = getPlanningArtifactDisplayStateForMessage(message, block)
        return state.renderAsGenericArtifact
      }
      if (shouldRenderAiArtifactInlineConfirmation(block)) {
        return false
      }
      return true
    })
    .map(block => withDisplayVersionLabel(block) || block)
}

const getRenderableLeadingArtifactBlocks = (message: NocodeEditorAiMessage) => (
  getRenderableArtifactBlocks(message)
    .filter(block => block.kind === 'flow-plan')
)

const getRenderableTrailingArtifactBlocks = (message: NocodeEditorAiMessage) => (
  getRenderableArtifactBlocks(message)
    .filter(block => block.kind !== 'flow-plan')
)

const getRenderableConfirmationBlocks = (message: NocodeEditorAiMessage) => {
  return getAllArtifactBlocks(message)
    .filter(block => !shouldHideMessageArtifactBlock(message, block))
    .filter((block) => {
      const state = getPlanningArtifactDisplayStateForMessage(message, block)
      return state.renderAsConfirmation
    })
    .map(block => withDisplayVersionLabel(block) || block)
}

const getRenderableDraftIssueActionLists = (message: NocodeEditorAiMessage) => {
  const presentationState = resolveDraftIssueListPresentationState(message)
  const state = presentationState.state
  if (!state || state.mode !== 'draft_only') {
    return []
  }
  const actionIssues = Array.isArray(state.actionIssues)
    ? state.actionIssues
    : normalizeFormDesignValidationIssuesToActionIssues(state.issues || [])
  return (actionIssues.length || presentationState.resolved)
    ? [{ ...state, actionIssues, resolved: presentationState.resolved }]
    : []
}

const resolveMessageFlowPlanTargetFormId = (message: NocodeEditorAiMessage) => {
  const block = getAllArtifactBlocks(message).find(item => item.kind === 'flow-plan' && item.flowPlan)
  return String(block?.flowPlan?.target?.formId || '').trim()
}

// AI 生成的问题大多只带节点信息，缺 formId 时按消息所属流程方案的目标表单归属
const resolveMessageFlowIssueFormId = (
  message: NocodeEditorAiMessage,
  issue: NocodeEditorAiFlowActionIssue,
) => (
  resolveFlowActionIssueFormId(issue) || resolveMessageFlowPlanTargetFormId(message)
)

const buildFlowIssueStateWithMessageFormIds = (
  message: NocodeEditorAiMessage,
  state: NocodeEditorAiFlowIssueState,
) => {
  const targetFormId = resolveMessageFlowPlanTargetFormId(message)
  if (!targetFormId) {
    return state
  }
  let changed = false
  const actionIssues = state.actionIssues.map((issue) => {
    if (resolveFlowActionIssueFormId(issue)) {
      return issue
    }
    changed = true
    return {
      ...issue,
      locator: {
        ...(issue.locator || {}),
        formId: targetFormId,
      },
    }
  })
  return changed ? { ...state, actionIssues } : state
}

const resolveMessageFlowIssuePayloadState = (message: NocodeEditorAiMessage) => {
  const metadataState = message.metadata?.flowIssueActionList as NocodeEditorAiFlowIssueState | null | undefined
  const allowBlockStateRender = Boolean(message.metadata?.flowAppliedFromAction)
  const blockState = allowBlockStateRender
    ? getAllArtifactBlocks(message).find(block => (
      block.kind === 'flow-plan' && block.status === 'ready' && block.flowIssueState?.mode === 'flow_issue'
    ))?.flowIssueState as NocodeEditorAiFlowIssueState | null | undefined
    : null
  return metadataState || blockState || null
}

// 实时校验已结算且该表单再无流程问题时，才认为这个表单的待补配置已经补齐
const resolveCompletedFlowIssueFormId = (issueFormIds: string[]) => {
  const verdict = props.flowIssueRuntimeVerdict
  if (!verdict?.settled) {
    return ''
  }
  const formId = String(verdict.formId || '').trim()
  if (!formId || !issueFormIds.includes(formId)) {
    return ''
  }
  const hasLiveIssues = (verdict.state?.actionIssues || []).some(
    issue => resolveFlowActionIssueFormId(issue) === formId,
  )
  return hasLiveIssues ? '' : formId
}

const syncFlowIssueListResolutionState = (message: NocodeEditorAiMessage) => {
  const state = resolveMessageFlowIssuePayloadState(message)
  if (!state || state.mode !== 'flow_issue' || !Array.isArray(state.actionIssues) || !state.actionIssues.length) {
    return false
  }

  const issueFormIds = Array.from(new Set(
    state.actionIssues.map(issue => resolveMessageFlowIssueFormId(message, issue)).filter(Boolean),
  ))
  const completedFormId = resolveCompletedFlowIssueFormId(issueFormIds)
  if (!completedFormId) {
    return false
  }

  const stampedState = buildFlowIssueStateWithMessageFormIds(message, state)
  const nextState = resolveFlowActionIssueListByResolvedFormIds(stampedState, [completedFormId])
  if (nextState === stampedState && stampedState === state) {
    return false
  }
  ensureMessageMetadata(message).flowIssueActionList = nextState
  void persistFlowIssueCompletionSyncState(message, nextState)
  return true
}

const resolveMessageFlowIssueState = (message: NocodeEditorAiMessage) => {
  const state = resolveMessageFlowIssuePayloadState(message)
  if (!state || state.mode !== 'flow_issue') {
    return null
  }
  return Array.isArray(state.actionIssues) && state.actionIssues.length > 0
    ? state
    : null
}

const getRenderableFlowIssueActionLists = (message: NocodeEditorAiMessage) => {
  const state = resolveMessageFlowIssueState(message)
  return state ? [state] : []
}

const activeFlowIssueState = computed<NocodeEditorAiFlowIssueState | null>(() => {
  return resolveRenderableActiveFlowIssueState(
    renderableMessages.value,
    resolveMessageFlowIssueState,
  )
})

const resolveDraftIssueActionListKey = (message: NocodeEditorAiMessage) => {
  const traceId = String(message.traceId || message.metadata?.traceId || '').trim()
  if (traceId) {
    return traceId
  }
  return String(message.id || '').trim()
}

const resolveDraftIssueListPresentationState = (message: NocodeEditorAiMessage) => {
  const rawState = message.metadata?.draftIssueActionList as NocodeEditorAiDraftPersistenceState | null | undefined
  const state = normalizeDraftPersistenceState(rawState)
  if (!state) {
    return {
      state: null,
      resolved: false,
    }
  }

  const draftIssueKey = resolveDraftIssueActionListKey(message)
  if (isDraftPersistenceStateResolved(state)) {
    return {
      state,
      resolved: true,
    }
  }

  const resolved = Boolean(
    hasHistoricalDraftIssueListCompletionState(rawState)
    && isDraftIssueListForCurrentBlueprint(message, state)
    && (
      (draftIssueKey && resolvedDraftIssueTraceIds.value[draftIssueKey])
      || isCurrentDraftIssueListCompleteForAutoResolve(currentDraftPersistenceState.value)
    )
  )
  if (!resolved) {
    return {
      state,
      resolved: false,
    }
  }

  return {
    state,
    resolved: true,
  }
}

const syncDraftIssueListPresentationState = (message: NocodeEditorAiMessage) => {
  const metadata = message.metadata
  const rawState = metadata?.draftIssueActionList as NocodeEditorAiDraftPersistenceState | null | undefined
  const state = normalizeDraftPersistenceState(rawState)
  const draftIssueKey = resolveDraftIssueActionListKey(message)
  if (!state) {
    if (draftIssueKey && resolvedDraftIssueTraceIds.value[draftIssueKey]) {
      delete resolvedDraftIssueTraceIds.value[draftIssueKey]
    }
    return false
  }

  const persistDraftIssueState = (nextState: NocodeEditorAiDraftPersistenceState) => {
    const currentState = metadata?.draftIssueActionList as NocodeEditorAiDraftPersistenceState | null | undefined
    if (
      buildDraftPersistenceStateSignature(currentState)
      === buildDraftPersistenceStateSignature(nextState)
    ) {
      return false
    }
    ensureMessageMetadata(message).draftIssueActionList = nextState
    return true
  }

  const persistPendingDraftIssueCompletionSyncState = (nextState: NocodeEditorAiDraftPersistenceState) => {
    const stateSignature = buildDraftPersistenceStateSignature(nextState)
    if (!pendingDraftIssueCompletionSyncSignatures.has(stateSignature)) {
      return
    }
    void persistDraftIssueCompletionSyncState(nextState)
  }

  if (isDraftPersistenceStateResolved(state)) {
    if (draftIssueKey) {
      resolvedDraftIssueTraceIds.value[draftIssueKey] = true
    }
    persistPendingDraftIssueCompletionSyncState(state)
    return persistDraftIssueState(state)
  }

  const shouldAutoResolve = Boolean(
    hasHistoricalDraftIssueListCompletionState(rawState)
    && isDraftIssueListForCurrentBlueprint(message, state)
    && (
      (draftIssueKey && resolvedDraftIssueTraceIds.value[draftIssueKey])
      || isCurrentDraftIssueListCompleteForAutoResolve(currentDraftPersistenceState.value)
    )
  )
  if (!shouldAutoResolve) {
    if (draftIssueKey && resolvedDraftIssueTraceIds.value[draftIssueKey]) {
      delete resolvedDraftIssueTraceIds.value[draftIssueKey]
    }
    return false
  }

  const resolvedState = buildResolvedDraftPersistenceState(state, {
    resolvedAt: Date.now(),
    sourceTraceId: normalizeTraceId(message.traceId || message.metadata?.traceId),
    sourceBlueprintVersionKey: getCurrentBlueprintVersionKey(),
    sourceBlueprintIdentityKey: getCurrentBlueprintIdentityKey(),
  })
  if (draftIssueKey) {
    resolvedDraftIssueTraceIds.value[draftIssueKey] = true
  }
  pendingDraftIssueCompletionSyncSignatures.add(buildDraftPersistenceStateSignature(resolvedState))
  const persisted = persistDraftIssueState(resolvedState)
  void persistDraftIssueCompletionSyncState(resolvedState)
  return persisted
}

const normalizeFormulaActionItems = (value: unknown): NocodeEditorAiFormulaActionItem[] => {
  return normalizeNocodeEditorFormulaActions(value)
}

const normalizeFormulaTargetResultItems = (value: unknown): NocodeEditorAiFormulaTargetResultItem[] => {
  return normalizeNocodeEditorFormulaTargetResults(value)
}

const getRenderableFormulaActionSummaries = (message: NocodeEditorAiMessage): NocodeEditorAiFormulaActionSummary[] => {
  const targetResults = normalizeFormulaTargetResultItems(message.metadata?.formulaTargetResults)
  if (targetResults.length) {
    return [{
      title: i18next.t('nocodeEditorAiPanel.formulaConfigResult'),
      items: targetResults,
    }]
  }

  const items = normalizeFormulaActionItems(message.metadata?.formulaActions)
  if (!items.length) {
    return []
  }
  const updatedItems = items.map(item => ({
    ...item,
    status: 'updated' as const,
  }))
  return [{
    title: i18next.t('nocodeEditorAiPanel.formulaConfigResult'),
    items: updatedItems,
  }]
}

const resolveFormulaResultSummaryText = (summary: NocodeEditorAiFormulaActionSummary) => {
  const updatedCount = summary.items.filter(item => item.status === 'updated').length
  const draftCount = summary.items.filter(item => item.status === 'draft').length
  const skippedCount = summary.items.filter(item => item.status === 'skipped').length
  const failedCount = summary.items.filter(item => item.status === 'failed').length
  return [
    updatedCount ? i18next.t('nocodeEditorAiPanel.formulaUpdatedFields', { count: updatedCount }) : '',
    draftCount ? i18next.t('nocodeEditorAiPanel.formulaDraftFields', { count: draftCount }) : '',
    skippedCount || failedCount
      ? i18next.t('nocodeEditorAiPanel.formulaSkippedFields', { count: skippedCount + failedCount })
      : '',
  ].filter(Boolean).join(i18next.t('nocodeEditorAiPanel.listSeparator')) || i18next.t('nocodeEditorAiPanel.formulaNoChanges')
}

const resolveFormulaActionFieldName = (item: NocodeEditorAiFormulaTargetResultItem) => {
  const fieldName = String(item.fieldName || '').trim()
  const tableName = String(item.tableName || '').trim()
  if (!fieldName) {
    return tableName
  }
  if (!tableName || fieldName.includes('.')) {
    return fieldName
  }
  return `${tableName}.${fieldName}`
}

const resolveFormulaActionDisplayFormula = (item: NocodeEditorAiFormulaActionItem) => (
  String(item.displayFormula || item.formula || '').trim().replace(/\s*\*\s*/g, ' × ')
)

const resolveFormulaActionDescription = (item: NocodeEditorAiFormulaActionItem) => (
  String((item as Record<string, unknown>).explanation || (item as Record<string, unknown>).description || (item as Record<string, unknown>).summary || '').trim()
)

const resolveFormulaTargetResultKey = (
  message: NocodeEditorAiMessage,
  item: NocodeEditorAiFormulaTargetResultItem,
) => [
  message.id,
  item.status,
  String(item.tableId || '').trim(),
  String(item.widgetId || '').trim(),
  String(item.fieldName || '').trim(),
  String(item.status !== 'skipped' ? item.formulaPath || '' : '').trim(),
].join('-')

const getRawAssistantMarkdownBlocks = (message: NocodeEditorAiMessage) => {
  if (message.role !== NocodeEditorAiMessageRole.ASSISTANT) {
    return [] as AiAssistantMarkdownBlock[]
  }

  const text = String(message.content || '').trim()
  const contentBlocks = (!text || text === getThinkingText())
    ? [] as AiAssistantMarkdownBlock[]
    : parseAiAssistantMessageContent(message.content).blocks
      .filter((block): block is AiAssistantMarkdownBlock => block.type === 'markdown')
  const metadataBlocks = getMessageBlocks(message)
    .filter((block): block is AiAssistantMarkdownBlock => block.type === 'markdown')

  if (!contentBlocks.length && !metadataBlocks.length) {
    return [] as AiAssistantMarkdownBlock[]
  }

  const seenTexts = new Set<string>()
  const artifactBlocks = getAllArtifactBlocks(message)
    .map(block => withDisplayVersionLabel(block) || block)
  const postFormFlowFollowUp = resolveMessagePostFormFlowFollowUp(message)
  return [...contentBlocks, ...metadataBlocks].filter((block) => {
    const signature = String(block.text || '').trim()
    if (!signature || seenTexts.has(signature)) {
      return false
    }
    seenTexts.add(signature)
    return true
  }).map((block) => {
    const hasCurrentMessageReferencedArtifact = artifactBlocks.some(artifactBlock => (
      getSummaryArtifactTitleCandidates(artifactBlock).some(title => block.text.includes(title))
    ))
    const rewrittenText = rewriteArtifactSummaryDisplayVersionText(
      block.text,
      artifactBlocks,
      planningDisplayVersionIndex.value,
      blueprintDisplayVersionIndex.value,
    )
    if (rewrittenText !== block.text) {
      return {
        ...block,
        text: rewrittenText,
      }
    }
    if (hasCurrentMessageReferencedArtifact) {
      return {
        ...block,
        text: rewrittenText,
      }
    }

    const fallbackArtifactBlocks = collectSummaryReferencedArtifactBlocks(block.text)
    const blockText = fallbackArtifactBlocks.length
      ? rewriteArtifactSummaryDisplayVersionText(
        block.text,
        fallbackArtifactBlocks,
        planningDisplayVersionIndex.value,
        blueprintDisplayVersionIndex.value,
      )
      : rewrittenText
    return {
      ...block,
      text: stripPostFormFlowFollowUpLinesFromMarkdownText(blockText, postFormFlowFollowUp),
    }
  }).filter(block => (
    Boolean(String(block.text || '').trim())
    && hasRenderableAssistantMarkdownHtml(String(block.text || ''))
  ))
}

const stripPostFormFlowFollowUpLinesFromMarkdownText = (
  text: string,
  followUp?: NormalizedPostFormFlowFollowUp | null,
) => {
  const normalizedText = String(text || '').trim()
  if (!normalizedText || !followUp || followUp.kind !== 'flow_recommendation') {
    return normalizedText
  }

  const linesToStrip = new Set([
    ...buildNocodeEditorPostFormFlowFollowUpMessageLines(followUp),
    ...(followUp.recommendation === 'not_suggested'
      ? LEGACY_NOT_SUGGESTED_POST_FORM_FLOW_MESSAGE_LINES
      : []),
  ].map(item => String(item || '').trim()).filter(Boolean))

  if (!linesToStrip.size) {
    return normalizedText
  }

  return normalizedText
    .split(/\r?\n/)
    .filter((line) => {
      const trimmedLine = String(line || '').trim()
      return !trimmedLine || !linesToStrip.has(trimmedLine)
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const getSummaryArtifactTitleCandidates = (
  block?: NocodeEditorAiArtifactBlock | null,
) => [
  block?.title,
  block?.blueprint?.title,
  block?.outline?.title,
  block?.appPlan?.goal,
].map(value => String(value || '').trim()).filter(Boolean)

const getSummaryCurrentVersionNumber = (content: string) => {
  const match = String(content || '').match(/当前为第\s*(\d+)\s*版/)
  return match ? Number(match[1] || 0) : 0
}

const collectSummaryReferencedArtifactBlocks = (content: string) => {
  const normalizedContent = String(content || '').trim()
  if (!normalizedContent) {
    return [] as NocodeEditorAiArtifactBlock[]
  }

  const rawVersion = getSummaryCurrentVersionNumber(normalizedContent)
  return messages.value
    .flatMap(message => getAllArtifactBlocks(message))
    .map(block => withDisplayVersionLabel(block) || block)
    .filter(block => getSummaryArtifactTitleCandidates(block).some(title => normalizedContent.includes(title)))
    .sort((left, right) => {
      const leftExact = rawVersion > 0 && Number(left.revision || 0) === rawVersion ? 1 : 0
      const rightExact = rawVersion > 0 && Number(right.revision || 0) === rawVersion ? 1 : 0
      if (leftExact !== rightExact) {
        return rightExact - leftExact
      }
      return Number(left.stagedAt || 0) - Number(right.stagedAt || 0)
    })
}

const getConfirmationCardPresentation = (
  message: NocodeEditorAiMessage,
  block?: NocodeEditorAiArtifactBlock | null,
): NocodeEditorAiConfirmationPresentation | null => {
  const targetBlock = block || getRenderableConfirmationBlocks(message)[0]
  if (!targetBlock) {
    return null
  }

  const blockPresentation = deriveConfirmationPresentationFromArtifactBlock(targetBlock)
  if (blockPresentation) {
    return blockPresentation
  }

  return getRawAssistantMarkdownBlocks(message).reduce<NocodeEditorAiConfirmationPresentation | null>((presentation, markdownBlock) => {
    return mergeConfirmationPresentation(
      presentation,
      extractConfirmationCompanionPresentation(markdownBlock.text).presentation,
    )
  }, null)
}

const getRenderableAssistantMarkdownBlocks = (message: NocodeEditorAiMessage) => {
  if (getRenderableFormulaActionSummaries(message).length) {
    return [] as AiAssistantMarkdownBlock[]
  }

  const markdownBlocks = getRawAssistantMarkdownBlocks(message)
  if (!markdownBlocks.length) {
    return [] as AiAssistantMarkdownBlock[]
  }

  const confirmationBlocks = getRenderableConfirmationBlocks(message)
  if (!confirmationBlocks.length) {
    return markdownBlocks
  }

  if (!confirmationBlocks.some(block => Boolean(deriveConfirmationPresentationFromArtifactBlock(block)))) {
    return markdownBlocks
  }

  return markdownBlocks.flatMap((block) => {
    const strippedText = stripConfirmationCompanionSections(block.text)
    if (!strippedText || isConfirmationCompanionResidualText(strippedText)) {
      return []
    }
    return [{
      ...block,
      text: strippedText,
    }]
  })
}

const hasRenderableAssistantMarkdown = (message: NocodeEditorAiMessage) => (
  getRenderableAssistantMarkdownBlocks(message).length > 0
)

const getCopyableVisibleFormulaPlanBlocks = (message: NocodeEditorAiMessage) => {
  const seenBlockKeys = new Set<string>()
  return [
    ...getRenderableArtifactBlocks(message),
    ...getRenderableConfirmationBlocks(message),
  ].filter((block) => {
    if (block.kind !== 'formula-plan') {
      return false
    }

    const blockKey = JSON.stringify(block)
    if (seenBlockKeys.has(blockKey)) {
      return false
    }
    seenBlockKeys.add(blockKey)
    return true
  })
}

const mergeCopyableEditorMessageText = (segments: string[]) => {
  const seenTexts = new Set<string>()
  return segments
    .map(segment => String(segment || '').trim())
    .filter((segment) => {
      if (!segment || seenTexts.has(segment)) {
        return false
      }
      seenTexts.add(segment)
      return true
    })
    .join('\n\n')
}

const getSingleCopyableEditorMessageContent = (message: NocodeEditorAiMessage) => {
  if (message.role === NocodeEditorAiMessageRole.ASSISTANT) {
    const visibleMarkdown = getRenderableAssistantMarkdownBlocks(message)
      .map(block => String(block.text || '').trim())
      .filter(Boolean)
      .join('\n\n')
    const visibleFormulaPlan = serializeAiAssistantMessageBlocks(getCopyableVisibleFormulaPlanBlocks(message))
    const visibleContent = mergeCopyableEditorMessageText([
      visibleMarkdown,
      visibleFormulaPlan,
    ])
    if (visibleContent) {
      return visibleContent
    }

    const hasFormulaPlanArtifact = getAllArtifactBlocks(message)
      .some(block => block.kind === 'formula-plan')
    if (hasFormulaPlanArtifact) {
      return ''
    }
  }

  const content = String(message.content || '').trim()
  return content === getThinkingText() ? '' : content
}

const getRenderableMessageIndex = (message: NocodeEditorAiMessage) => (
  renderableMessages.value.findIndex(item => item === message || item.id === message.id)
)

const isLastAssistantInVisibleRun = (message: NocodeEditorAiMessage) => {
  const messageIndex = getRenderableMessageIndex(message)
  if (messageIndex < 0) {
    return true
  }

  for (let index = messageIndex + 1; index < renderableMessages.value.length; index += 1) {
    const candidate = renderableMessages.value[index]
    if (candidate.role === NocodeEditorAiMessageRole.USER) {
      return true
    }
    if (candidate.role === NocodeEditorAiMessageRole.ASSISTANT) {
      return false
    }
  }

  return true
}

const shouldShowMessageToolbar = (message: NocodeEditorAiMessage) => (
  message.role === NocodeEditorAiMessageRole.USER
  || isLastAssistantInVisibleRun(message)
)

const getAssistantVisibleRunMessages = (message: NocodeEditorAiMessage) => {
  const messageIndex = getRenderableMessageIndex(message)
  if (messageIndex < 0) {
    return [message]
  }

  const runMessages: NocodeEditorAiMessage[] = []
  for (let index = messageIndex; index >= 0; index -= 1) {
    const candidate = renderableMessages.value[index]
    if (candidate.role !== NocodeEditorAiMessageRole.ASSISTANT) {
      break
    }
    runMessages.unshift(candidate)
  }
  return runMessages
}

const getCopyableEditorMessageContent = (message: NocodeEditorAiMessage) => {
  if (message.role !== NocodeEditorAiMessageRole.ASSISTANT) {
    return getSingleCopyableEditorMessageContent(message)
  }

  return getAssistantVisibleRunMessages(message)
    .map(getSingleCopyableEditorMessageContent)
    .filter(Boolean)
    .join('\n\n')
}

const getMessageToolbarRole = (message: NocodeEditorAiMessage) => (
  message.role === NocodeEditorAiMessageRole.ASSISTANT
    ? WorkbenchAiMessageRole.ASSISTANT
    : WorkbenchAiMessageRole.USER
)

const getMessageContinuityHints = (message: NocodeEditorAiMessage): NocodeEditorAiContinuityHint[] => (
  Array.isArray(message.metadata?.continuityHints)
    ? message.metadata.continuityHints
      .filter((item): item is NocodeEditorAiContinuityHint => Boolean(item && typeof item === 'object'))
    : []
)

const topLevelContinuityHints = computed<NocodeEditorAiContinuityHint[]>(() => {
  const handoffHint = buildWorkbenchHandoffContinuityHint({
    phase: handoffBootstrapPhase.value,
    handoff: activeHandoffForContinuityHint.value,
  })
  if (handoffHint) {
    return [handoffHint]
  }
  if (!timelineMeta.value?.hasMoreBefore) {
    return []
  }
  return [{
    kind: 'history-windowed',
    text: i18next.t('nocodeEditorAiPanel.olderMessagesCollapsed'),
  }]
})

const renderAssistantMessage = (content: string) => markdown.render(content)

const hasRenderableAssistantMarkdownHtml = (content: string) => {
  const html = String(renderAssistantMessage(content || '') || '')
  const normalizedText = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim()
  return Boolean(
    normalizedText
    || /<(img|svg|video|audio|iframe|table|hr|pre|code|blockquote|ul|ol)\b/i.test(html),
  )
}

const normalizeMessageBlocks = (blocks: AiAssistantMessageBlock[]) => (
  resolveAiAssistantMessageBlocks(
    blocks.map((block) => {
      if (block.type !== 'artifact') {
        return block
      }

      return {
        ...block,
        status: block.status || 'ready',
      }
    }),
  )
)

const setMessageBlocks = (message: NocodeEditorAiMessage, blocks: AiAssistantMessageBlock[]) => {
  const metadata = ensureMessageMetadata(message)
  const normalizedBlocks = normalizeMessageBlocks(blocks)
  const nextMetadata = {
    ...metadata,
  }
  if (normalizedBlocks.length) {
    nextMetadata.blocks = normalizedBlocks
  } else {
    delete nextMetadata.blocks
  }
  message.metadata = markRaw(nextMetadata)
}

const pruneMessageBlocksForIncomingSummaryStage = (
  message: NocodeEditorAiMessage,
  nextSummaryStage: unknown,
) => {
  const nextBlocks = pruneStaleSummaryStageBlocks(getMessageBlocks(message), {
    currentSummaryStage: message.metadata?.summaryStage,
    nextSummaryStage,
  })
  setMessageBlocks(message, nextBlocks)
}

const setMessageArtifactBlocks = (message: NocodeEditorAiMessage, blocks: NocodeEditorAiArtifactBlock[]) => {
  const preservedBlocks = getMessageBlocks(message)
    .filter((block): block is Exclude<AiAssistantMessageBlock, NocodeEditorAiArtifactBlock> => block.type !== 'artifact')
  setMessageBlocks(message, [
    ...preservedBlocks,
    ...normalizeEditorArtifactBlocks(blocks),
  ])
}

const buildMessageBlockDedupKey = (block: AiAssistantMessageBlock) => JSON.stringify(block)

const mergeMessageBlocks = (message: NocodeEditorAiMessage, blocks: AiAssistantMessageBlock[]) => {
  const currentBlocks = getMessageBlocks(message)
  const nextArtifactBlocks = [...getAllArtifactBlocks(message)]
  const nextNonArtifactBlocks = currentBlocks.filter(block => block.type !== 'artifact')
  const appendedNonArtifactKeys = new Set(
    nextNonArtifactBlocks.map(block => buildMessageBlockDedupKey(block)),
  )

  for (const block of normalizeMessageBlocks(blocks)) {
    if (block.type !== 'artifact') {
      const dedupKey = buildMessageBlockDedupKey(block)
      if (appendedNonArtifactKeys.has(dedupKey)) {
        continue
      }
      appendedNonArtifactKeys.add(dedupKey)
      nextNonArtifactBlocks.push(block)
      continue
    }

    const artifactBlock = block as NocodeEditorAiArtifactBlock
    const index = findNocodeEditorArtifactBlockMergeIndex(nextArtifactBlocks, artifactBlock)
    if (index === -1) {
      nextArtifactBlocks.push(artifactBlock)
      continue
    }

    nextArtifactBlocks[index] = mergeNocodeEditorArtifactBlocks(
      nextArtifactBlocks[index],
      artifactBlock,
    ) || artifactBlock
  }

  setMessageBlocks(message, [
    ...nextNonArtifactBlocks,
    ...nextArtifactBlocks,
  ])
}

const resolveStreamMessageBlocks = (metadata?: Record<string, unknown> | null) => {
  // if (Boolean(metadata?.suppressedIntermediateSummary)) {
  //   return []
  // }

  const normalizedMetadataBlocks = Array.isArray(metadata?.blocks)
    ? normalizeMessageBlocks(metadata.blocks as AiAssistantMessageBlock[])
    : []
  if (normalizedMetadataBlocks.length) {
    return normalizedMetadataBlocks
  }

  return Array.isArray(metadata?.artifactBlocks)
    ? normalizeMessageBlocks(metadata.artifactBlocks as AiAssistantMessageBlock[])
    : []
}

const upsertMessageArtifactBlock = (message: NocodeEditorAiMessage, block: NocodeEditorAiArtifactBlock) => {
  const nextBlocks = [...getAllArtifactBlocks(message)]
  const index = findNocodeEditorArtifactBlockMergeIndex(nextBlocks, block)
  if (index === -1) {
    nextBlocks.push(block)
  } else {
    nextBlocks[index] = mergeNocodeEditorArtifactBlocks(
      nextBlocks[index],
      block,
    ) || block
  }
  setMessageArtifactBlocks(message, nextBlocks)
}

const buildPlanningArtifactVersion = (value: {
  revision?: number
  stagedAt?: number
  outline?: unknown | null
  plan?: { outline?: unknown | null } | null
}) => {
  const outline = value.outline ?? value.plan?.outline
  if (!outline) {
    return ''
  }
  return `${value.revision}:${value.stagedAt || 0}`
}

const resolvePlanningArtifactsFromMessage = (message?: NocodeEditorAiMessage | null) => {
  const metadataArtifacts = normalizeNocodeEditorAiPlanningArtifacts(
    message?.metadata?.appBuilderPlanningArtifacts,
  )
  if (metadataArtifacts.length) {
    return metadataArtifacts
  }

  return extractNocodeEditorPlanningArtifactsFromContent(String(message?.content || ''))
}

const getLatestPlanningArtifacts = (
  preferredMessage?: NocodeEditorAiMessage | null,
): NocodeEditorAiPlanningArtifact[] => {
  const preferredArtifacts = resolvePlanningArtifactsFromMessage(preferredMessage)
  if (preferredArtifacts.length) {
    return preferredArtifacts
  }

  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const artifacts = resolvePlanningArtifactsFromMessage(messages.value[index])
    if (artifacts.length) {
      return artifacts
    }
  }

  return []
}

const buildBlueprintArtifactVersion = (value: NocodeEditorAiStagedAppBlueprint) => {
  if (!value.blueprint) {
    return ''
  }
  return buildBlueprintArtifactVersionFromParts(value)
}

const getCurrentBlueprintVersionKey = () => buildBlueprintArtifactVersion(stagedBlueprint.value)

const withResolvedArtifactConfirmation = (
  block: NocodeEditorAiArtifactBlock,
) => {
  const confirmation = resolveAiArtifactConfirmation(block)
  const resolvedBlock = confirmation
    ? {
      ...block,
      confirmation,
    }
    : block
  const blockWithContext = withPlanningArtifactConfirmationContext(resolvedBlock)
  if (blockWithContext.kind !== 'flow-plan') {
    return blockWithContext
  }

  const latestCompletedFlowConfirmation = resolveLatestCompletedPlanningConfirmation({
    planningContextKeys: buildArtifactPlanningContextKeys(blockWithContext),
  })

  return reconcilePlanningArtifactConfirmation(
    blockWithContext,
    latestCompletedFlowConfirmation,
  )
}

const buildAppPlanArtifactBlock = (
  value: NocodeEditorAiStagedAppPlan,
  overrides: Partial<NocodeEditorAiArtifactBlock> = {},
) => {
  if (!value.plan) {
    return null
  }

  const outline = value.plan.outline
  const legacyPlan = value.plan as typeof value.plan & {
    confirmation?: unknown
    open_questions?: unknown
  }
  const projection = resolveNocodeEditorPlanningQuestionProjection({
    stage: 'app-plan',
    structuredConfirmation: (outline as NocodeEditorAiSolutionOutlineWithConfirmation | null)?.confirmation,
    legacyConfirmation: legacyPlan.confirmation,
    summary: String(value.plan.goal || outline?.summary || '').trim() || undefined,
    legacyOpenQuestions: [
      ...(Array.isArray(value.plan.openQuestions)
        ? value.plan.openQuestions
        : Array.isArray(legacyPlan.open_questions)
          ? legacyPlan.open_questions
          : []),
      ...(Array.isArray(outline?.openQuestions) ? outline.openQuestions : []),
    ],
    legacyOpenQuestionsMode: 'fallback-only',
  })
  const canonicalOutline = outline
    ? {
      ...outline,
      openQuestions: projection.openQuestions,
      confirmation: projection.confirmation,
    }
    : outline
  const canonicalPlan = {
    ...value.plan,
    openQuestions: projection.openQuestions,
    outline: canonicalOutline,
  }
  delete (canonicalPlan as typeof canonicalPlan & { confirmation?: unknown }).confirmation
  return withDisplayVersionLabel(withResolvedArtifactConfirmation({
    type: 'artifact' as const,
    kind: 'app-plan' as const,
    status: 'ready' as const,
    version: buildPlanningArtifactVersion(value),
    revision: value.revision,
    stagedAt: value.stagedAt,
    title: String(value.plan.goal || outline?.title || i18next.t('nocodeEditorAiPanel.appPlan')).trim() || i18next.t('nocodeEditorAiPanel.appPlan'),
    summary: String(value.plan.goal || outline?.summary || '').trim() || undefined,
    flowIntent: value.plan.flowIntent || outline?.flowIntent || undefined,
    confirmation: projection.confirmation || undefined,
    confirmationCardPresentation: buildSharedAppPlanConfirmationCardPresentation({
      summary: String(value.plan.goal || outline?.summary || '').trim(),
      goal: String(value.plan.goal || '').trim(),
      mode: value.plan.mode,
      objects: value.plan.objects,
      artifacts: value.plan.artifacts,
      openQuestions: projection.openQuestions,
      confirmation: projection.confirmation,
    }) || undefined,
    applicationStructurePreview: canonicalOutline
      ? {
        enabled: true,
        previewMode: 'app-plan',
        focusFormKey: String(outline.forms?.[0]?.formKey || '').trim() || undefined,
        focusFormName: String(outline.forms?.[0]?.tableName || '').trim() || undefined,
        highlightModuleKeys: Array.isArray(outline.modules)
          ? outline.modules.map(item => String(item?.moduleKey || item?.name || '').trim()).filter(Boolean)
          : [],
      }
      : null,
    appPlan: canonicalPlan,
    ...overrides,
  }))
}

const buildFormPlanArtifactBlock = (
  value: NocodeEditorAiStagedFormPlan,
  overrides: Partial<NocodeEditorAiArtifactBlock> = {},
) => {
  if (!value.outline) {
    return null
  }

  const formPlanPresentation = buildNocodeEditorAiSolutionPresentation(
    value.outline,
    [],
  )
  const projection = resolveNocodeEditorPlanningQuestionProjection({
    stage: 'form-plan',
    structuredConfirmation: value.outline.confirmation,
    legacyOpenQuestions: value.outline.openQuestions,
    legacyOpenQuestionsMode: 'fallback-only',
    summary: value.outline.summary,
  })
  const canonicalOutline = {
    ...value.outline,
    openQuestions: projection.openQuestions,
    confirmation: projection.confirmation,
  }

  return withDisplayVersionLabel(withResolvedArtifactConfirmation({
    type: 'artifact' as const,
    kind: 'form-plan' as const,
    status: 'ready' as const,
    version: buildPlanningArtifactVersion(value),
    revision: value.revision,
    stagedAt: value.stagedAt,
    title: resolveSingleFormPlanningDisplayTitle({
      outline: value.outline,
    }),
    summary: value.outline.summary,
    confirmation: projection.confirmation || undefined,
    flowIntent: value.outline.flowIntent || undefined,
    confirmationCardPresentation: buildSharedFormPlanConfirmationCardPresentation({
      outline: canonicalOutline,
      solutionPresentation: formPlanPresentation,
    }) || undefined,
    outline: canonicalOutline,
    formPlanPresentation,
    applicationStructurePreview: value.applicationStructurePreview || null,
    ...overrides,
  }))
}

const buildContentPlanArtifactBlock = (
  output: unknown,
  overrides: Partial<NocodeEditorAiArtifactBlock> = {},
) => {
  const payload = output && typeof output === 'object' && !Array.isArray(output)
    ? output as Record<string, any>
    : {}
  const plan = normalizeNocodeEditorContentPlan(payload.plan)

  if (!plan) {
    return null
  }

  return withDisplayVersionLabel(withResolvedArtifactConfirmation({
    type: 'artifact' as const,
    kind: 'content-plan' as const,
    status: 'ready' as const,
    version: `${Number(payload.revision || 0)}:${Number(payload.stagedAt || 0)}`,
    revision: Number(payload.revision || 0) || undefined,
    stagedAt: Number(payload.stagedAt || 0) || undefined,
    title: String(plan.title || '').trim() || i18next.t('nocodeEditorAiPanel.contentPlan'),
    summary: String(plan.summary || '').trim() || undefined,
    confirmation: payload.confirmation || (plan as any).confirmation || undefined,
    plan,
    ...overrides,
  }))
}

const normalizeFormulaPlanSourceContext = (value: unknown) => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const taskScopeKey = String(source.taskScopeKey || '').trim()
  const taskId = String(source.taskId || '').trim()
  const nocodeId = String(source.nocodeId || '').trim()
  const formId = String(source.formId || '').trim()
  const evidenceFingerprint = String(source.evidenceFingerprint || '').trim()
  const capturedAt = Number(source.capturedAt || 0)
  if (!taskScopeKey || !nocodeId || !formId || !evidenceFingerprint || !Number.isFinite(capturedAt) || capturedAt <= 0) {
    return null
  }
  const draftRevision = Number(source.draftRevision)
  return {
    ...(taskId ? { taskId } : {}),
    taskScopeKey,
    nocodeId,
    formId,
    ...(Number.isFinite(draftRevision) && draftRevision >= 0 ? { draftRevision } : {}),
    evidenceFingerprint,
    capturedAt,
  }
}

const buildFormulaPlanArtifactBlock = (
  output: unknown,
  overrides: Partial<NocodeEditorAiArtifactBlock> = {},
) => {
  const payload = output && typeof output === 'object' && !Array.isArray(output)
    ? output as Record<string, any>
    : {}
  const plan = normalizeNocodeEditorFormulaPlan(payload.plan)
  const sourceContext = normalizeFormulaPlanSourceContext(payload.sourceContext)
  if (!plan || !sourceContext) {
    return null
  }
  const confirmation = normalizeNocodeEditorConfirmationPayload({
    stage: 'form-plan',
    confirmation: payload.confirmation || plan.confirmation,
    openQuestions: plan.openQuestions,
    summary: plan.summary,
  })
  const formulaPlan = {
    ...plan,
    ...(confirmation ? { confirmation } : {}),
  }
  const revision = Number(payload.revision || 0) || undefined
  const stagedAt = Number(payload.stagedAt || 0) || undefined
  const formulaPresentation = buildNocodeEditorFormulaPlanPresentation({ formulaPlan } as NocodeEditorAiArtifactBlock)
  return withResolvedArtifactConfirmation({
    type: 'artifact' as const,
    kind: 'formula-plan' as const,
    status: 'ready' as const,
    version: `${Number(revision || 0)}:${Number(stagedAt || 0)}`,
    revision,
    stagedAt,
    title: formulaPlan.title,
    summary: formulaPlan.summary,
    planningScope: normalizeNocodeEditorPlanningScopeValue(payload.planningScope),
    sourceContext,
    confirmation: confirmation || undefined,
    confirmationCardPresentation: formulaPresentation || undefined,
    formulaPlan,
    formulaPresentation,
    ...overrides,
  })
}

const buildFlowPlanArtifactBlock = (
  value: NocodeEditorAiStagedFlowPlan,
  overrides: Partial<NocodeEditorAiArtifactBlock> = {},
) => {
  const flowPlan = normalizeNocodeEditorFlowPlan(value.flowPlan)
  if (!flowPlan) {
    return null
  }

  const finishedAt = Number(value.applyResult?.finishedAt || 0) || 0
  return withResolvedArtifactConfirmation({
    type: 'artifact' as const,
    kind: 'flow-plan' as const,
    status: 'ready' as const,
    version: `${Number(value.revision || 0)}:${Number(value.stagedAt || 0)}:${finishedAt}`,
    revision: value.revision,
    stagedAt: value.stagedAt,
    sourceSchemeRevision: value.sourceSchemeRevision,
    title: String(flowPlan.title || '').trim() || i18next.t('nocodeEditorAiPanel.flowBlueprint'),
    summary: String(flowPlan.summary || '').trim() || undefined,
    confirmation: (flowPlan as any).confirmation || undefined,
    flowPlan,
    flowApplyResult: value.applyResult || null,
    flowIssueState: value.applyResult?.flowIssueState || null,
    ...overrides,
  })
}

const buildBlueprintArtifactBlock = (
  value: NocodeEditorAiStagedAppBlueprint,
  overrides: Partial<NocodeEditorAiArtifactBlock> = {},
) => {
  if (!value.blueprint) {
    return null
  }
  const sourcePlanningContextKey = String(value.sourcePlanningContextKey || '').trim()
  const blueprintProjection = projectBlueprintConfirmation({
    confirmation: (value.blueprint as any)?.confirmation,
    openQuestions: value.blueprint.openQuestions,
    summary: value.blueprint.summary,
  })
  const projectedBlueprint = {
    ...value.blueprint,
    openQuestions: blueprintProjection.openQuestions,
    confirmation: blueprintProjection.confirmation || undefined,
  }
  const blueprintConfirmation = blueprintProjection.confirmation || undefined
  return withDisplayVersionLabel(withResolvedArtifactConfirmation({
    type: 'artifact' as const,
    kind: 'blueprint' as const,
    status: 'ready' as const,
    version: buildBlueprintArtifactVersion(value),
    revision: value.revision,
    stagedAt: value.stagedAt,
    title: resolveNocodeEditorBlueprintDisplayTitle({
      title: projectedBlueprint.title,
      forms: projectedBlueprint.forms,
      fallback: i18next.t('nocodeEditorAiPanel.blueprintDraft'),
    }) || i18next.t('nocodeEditorAiPanel.blueprintDraft'),
    summary: projectedBlueprint.summary,
    sourcePlanningContextKey: sourcePlanningContextKey || null,
    planningScope: normalizeNocodeEditorPlanningScopeValue(value.planningScope),
    confirmation: blueprintConfirmation,
    blueprint: projectedBlueprint,
    phase: value.phase,
    applyResult: value.applyResult || null,
    draftPersistenceState: value.draftPersistenceState || null,
    ...overrides,
  }))
}

const applyBlueprintLateQuestionProjectionToStagedState = (
  lateQuestions: unknown,
) => {
  const currentBlueprint = stagedBlueprint.value.blueprint
  if (!currentBlueprint) {
    return
  }

  const projection = projectBlueprintConfirmation({
    confirmation: (currentBlueprint as any)?.confirmation,
    openQuestions: currentBlueprint.openQuestions,
    lateQuestions,
    summary: currentBlueprint.summary,
  })

  if (!projection.pendingQuestions.length) {
    return
  }

  stagedBlueprint.value = {
    ...stagedBlueprint.value,
    blueprint: {
      ...currentBlueprint,
      openQuestions: projection.openQuestions,
      confirmation: projection.confirmation || undefined,
    },
  }
}

const getCurrentBlueprintIdentityKey = () => getBlueprintIdentityKey({
  blueprint: stagedBlueprint.value.blueprint,
  revision: Number(stagedBlueprint.value.revision || 0),
  stagedAt: Number(stagedBlueprint.value.stagedAt || 0),
  sourcePlanningContextKey: stagedBlueprint.value.sourcePlanningContextKey || null,
})

const resolveReconciledFormulaApplyStatus = (
  targetResults: FormulaTargetResultLike[],
  fallbackStatus?: NonNullable<NocodeEditorAiBlueprintApplyResult['formulaSummary']>['status'],
) => {
  if (!targetResults.length) {
    return fallbackStatus || 'not_applicable'
  }
  const updated = targetResults.some(result => result.status === 'updated' || result.status === 'draft')
  const failed = targetResults.some(result => result.status === 'failed' || result.status === 'skipped')
  return failed ? (updated ? 'partial' : 'failed') : 'completed'
}

const reconcileBlueprintApplyFormulaState = (input: {
  applyResult: NocodeEditorAiBlueprintApplyResult
  formulaTargetResults?: FormulaTargetResultLike[]
}) => {
  const latestFormulaTargetResults = normalizeLatestFormulaTargetResults([
    ...(input.applyResult.forms || []).flatMap(form => form.formulaApply?.targetResults || []),
    ...(input.formulaTargetResults || []),
  ])
  const forms = (input.applyResult.forms || []).map((form) => {
    const widgetIds = new Set((form.fieldBindings || []).map(binding => String(binding.widgetId || '').trim()))
    const targetResults = latestFormulaTargetResults.filter((result) => {
      const tableId = String(result.tableId || '').trim()
      const widgetId = String(result.widgetId || '').trim()
      return tableId
        ? tableId === String(form.tableId || '').trim()
        : Boolean(widgetId && widgetIds.has(widgetId))
    })
    if (!form.formulaApply && !targetResults.length) {
      return form
    }
    return {
      ...form,
      formulaApply: {
        status: resolveReconciledFormulaApplyStatus(
          targetResults,
          form.formulaApply?.status,
        ),
        ...(form.formulaApply?.persistenceMode
          ? { persistenceMode: form.formulaApply.persistenceMode }
          : {}),
        targetResults: targetResults as NonNullable<typeof form.formulaApply>['targetResults'],
        issues: form.formulaApply?.issues || [],
        checkpoint: form.formulaApply?.checkpoint || null,
      },
    }
  })
  const releaseContext = buildNocodeEditorPostFormFlowReleaseContext({
    planningScope: normalizeNocodeEditorPlanningScopeValue(input.applyResult.planningScope),
    persistenceMode: input.applyResult.persistenceMode,
    draftPersistenceState: input.applyResult.draftPersistenceState,
    formulaSummary: input.applyResult.formulaSummary,
    formulaApplyResults: forms
      .map(form => form.formulaApply)
      .filter(Boolean) as NonNullable<NocodeEditorAiBlueprintApplyResult['forms'][number]['formulaApply']>[],
    fieldBindings: forms.flatMap(form => form.fieldBindings || []),
  })
  return {
    ...input.applyResult,
    forms,
    ...(releaseContext.formulaSummary
      ? { formulaSummary: releaseContext.formulaSummary }
      : {}),
  }
}

const resolveDeferredPostFormFlowMetadataAfterDraftRefresh = (input: {
  draftPersistenceState: NocodeEditorAiDraftPersistenceState | null
  formulaTargetResults?: FormulaTargetResultLike[]
}) => {
  const applyResult = stagedBlueprint.value.applyResult
  if (!applyResult || !isNocodeEditorPostFormFlowEnabledForScope(applyResult.planningScope)) {
    return null
  }
  const entryFlowIntent = resolveActiveEntryFlowIntent('')
  const reconciledApplyResult = reconcileBlueprintApplyFormulaState({
    applyResult,
    formulaTargetResults: input.formulaTargetResults,
  })
  const hasActiveDraftIssues = Boolean(
    input.draftPersistenceState
    && !isDraftPersistenceStateResolved(input.draftPersistenceState)
  )
  stagedBlueprint.value.applyResult = {
    ...reconciledApplyResult,
    persistenceMode: hasActiveDraftIssues ? 'draft_only' : 'saved',
    draftPersistenceState: hasActiveDraftIssues ? input.draftPersistenceState : null,
  }
  return resolveBlueprintApplyPostFormFlowMetadata({
    entryFlowIntent,
    result: stagedBlueprint.value.applyResult,
  })
}

const buildDraftCompletionSyncMetadata = (
  draftPersistenceState: NocodeEditorAiDraftPersistenceState,
  formulaTargetResults?: FormulaTargetResultLike[],
) => {
  const postFormFlowMetadata = resolveDeferredPostFormFlowMetadataAfterDraftRefresh({
    draftPersistenceState,
    formulaTargetResults,
  })
  const block = buildBlueprintArtifactBlock(stagedBlueprint.value as any, {
    draftPersistenceState,
  })

  return {
    hiddenFromTimeline: true,
    draftIssueCompletionSync: true,
    summaryStage: 'blueprint' as const,
    draftIssueActionList: draftPersistenceState,
    ...(postFormFlowMetadata
      ? {
        planningScope: postFormFlowMetadata.planningScope,
        pendingFlowIntent: postFormFlowMetadata.pendingFlowIntent,
        postFormFlowSignals: postFormFlowMetadata.postFormFlowSignals,
        postFormFlowRelease: postFormFlowMetadata.postFormFlowRelease,
        postFormFlowOpportunity: postFormFlowMetadata.postFormFlowOpportunity,
        postFormFlowFollowUp: postFormFlowMetadata.postFormFlowFollowUp,
      }
      : {}),
    ...(block
      ? {
        blocks: [block],
        artifactBlocks: [block],
      }
      : {}),
  }
}

const syncActionAppliedBlueprintHistory = () => {
  const appliedBlueprintBlocksByIdentity = new Map<string, NocodeEditorAiArtifactBlock>()

  for (const message of messages.value) {
    if (!message.metadata?.blueprintAppliedFromAction) {
      continue
    }

    for (const block of getAllArtifactBlocks(message)) {
      if (block.kind !== 'blueprint' || block.status !== 'ready' || !block.blueprint || !isBlueprintAppliedPhase(block.phase)) {
        continue
      }

      const identityKey = getBlueprintIdentityKey({
        blueprint: block.blueprint,
        revision: Number(block.revision || 0),
        stagedAt: Number(block.stagedAt || 0),
        sourcePlanningContextKey: getBlueprintArtifactPlanningContextKey(block),
      })
      if (!identityKey) {
        continue
      }

      const previousBlock = appliedBlueprintBlocksByIdentity.get(identityKey)
      const previousFinishedAt = Number(previousBlock?.applyResult?.finishedAt || 0)
      const currentFinishedAt = Number(block.applyResult?.finishedAt || 0)
      if (!previousBlock || currentFinishedAt >= previousFinishedAt) {
        appliedBlueprintBlocksByIdentity.set(identityKey, block)
      }
    }
  }

  if (!appliedBlueprintBlocksByIdentity.size) {
    return
  }

  for (const message of messages.value) {
    const blocks = getAllArtifactBlocks(message)
    if (!blocks.length) {
      continue
    }

    let changed = false
    const nextBlocks = blocks.map((block) => {
      if (block.kind !== 'blueprint' || block.status !== 'ready' || !block.blueprint || isBlueprintAppliedPhase(block.phase)) {
        return block
      }

      const identityKey = getBlueprintIdentityKey({
        blueprint: block.blueprint,
        revision: Number(block.revision || 0),
        stagedAt: Number(block.stagedAt || 0),
        sourcePlanningContextKey: getBlueprintArtifactPlanningContextKey(block),
      })
      const appliedBlock = identityKey ? appliedBlueprintBlocksByIdentity.get(identityKey) : undefined
      if (
        !appliedBlock
        || !doesBlueprintArtifactShareDraftIdentity(block, {
          revision: Number(appliedBlock.revision || 0),
          stagedAt: Number(appliedBlock.stagedAt || 0),
          blueprint: appliedBlock.blueprint,
          phase: appliedBlock.phase,
          applyResult: appliedBlock.applyResult || null,
          sourcePlanningContextKey: getBlueprintArtifactPlanningContextKey(appliedBlock),
        })
      ) {
        return block
      }

      changed = true
      return {
        ...appliedBlock,
      }
    })

    if (changed) {
      setMessageArtifactBlocks(message, nextBlocks)
    }
  }
}

const syncHistoricalAppliedFlowArtifacts = () => {
  syncActionAppliedFlowHistory(messages.value, {
    getAllArtifactBlocks,
    setMessageArtifactBlocks,
  })
}

const buildLoadingArtifactBlock = (
  kind: 'app-plan' | 'form-plan' | 'content-plan' | 'formula-plan' | 'flow-scheme' | 'flow-plan' | 'blueprint',
  message: string,
  options: {
    planningContextKey?: string
    preflightPhase?: 'summary' | 'examples' | 'waiting_blueprint'
    formulaPresentation?: NocodeEditorAiArtifactBlock['formulaPresentation']
  } = {},
): NocodeEditorAiArtifactBlock => {
  const planningContextKey = String(options.planningContextKey || '').trim()
  const preflightPhase = String(options.preflightPhase || '').trim()
  return {
    type: 'artifact',
    kind,
    status: 'loading',
    title: kind === 'app-plan'
      ? i18next.t('nocodeEditorAiPanel.appPlan')
      : (
        kind === 'form-plan'
          ? i18next.t('nocodeEditorAiPanel.formPlan')
          : (
            kind === 'content-plan'
              ? i18next.t('nocodeEditorAiPanel.contentPlan')
              : kind === 'formula-plan'
                ? i18next.t('formulaPlanPresentation.title')
                : kind === 'flow-scheme'
                  ? i18next.t('nocodeEditorAiPanel.flowScheme')
                  : kind === 'flow-plan'
                    ? i18next.t('nocodeEditorAiPanel.flowBlueprint')
                    : i18next.t('nocodeEditorAiPanel.blueprintDraft')
          )
      ),
    message,
    formulaPresentation: options.formulaPresentation,
    sourcePlanningContextKey: kind === 'blueprint'
      ? planningContextKey || null
      : undefined,
    confirmation: kind === 'flow-plan' && planningContextKey
      ? {
        stage: 'flow-plan',
        planningContextKey,
        questions: [],
      } as NocodeEditorAiConfirmPayload
      : undefined,
    flowBlueprintPreflightPhase: kind === 'flow-plan' && preflightPhase
      ? preflightPhase
      : undefined,
  }
}

const buildErrorArtifactBlock = (
  kind: 'app-plan' | 'form-plan' | 'content-plan' | 'formula-plan' | 'flow-scheme' | 'flow-plan' | 'blueprint',
  error: string,
  options: {
    planningContextKey?: string
    formulaPresentation?: NocodeEditorAiArtifactBlock['formulaPresentation']
  } = {},
): NocodeEditorAiArtifactBlock => {
  const planningContextKey = String(options.planningContextKey || '').trim()
  return {
    type: 'artifact',
    kind,
    status: 'error',
    title: kind === 'app-plan'
      ? i18next.t('nocodeEditorAiPanel.appPlan')
      : (
        kind === 'form-plan'
          ? i18next.t('nocodeEditorAiPanel.formPlan')
          : (
            kind === 'content-plan'
              ? i18next.t('nocodeEditorAiPanel.contentPlan')
              : kind === 'formula-plan'
                ? i18next.t('formulaPlanPresentation.title')
                : kind === 'flow-scheme'
                  ? i18next.t('nocodeEditorAiPanel.flowScheme')
                  : kind === 'flow-plan'
                    ? i18next.t('nocodeEditorAiPanel.flowBlueprint')
                    : i18next.t('nocodeEditorAiPanel.blueprintDraft')
          )
      ),
    error,
    formulaPresentation: options.formulaPresentation,
    sourcePlanningContextKey: kind === 'blueprint'
      ? planningContextKey || null
      : undefined,
    confirmation: kind === 'flow-plan' && planningContextKey
      ? {
        stage: 'flow-plan',
        planningContextKey,
        questions: [],
      } as NocodeEditorAiConfirmPayload
      : undefined,
  }
}

const normalizeFlowPlanArtifactErrorMessage = (value: unknown) => {
  const message = String(value || '').trim()
  if (
    !message
    || containsTechnicalFlowText(message)
    || /流程蓝图暂存失败|流程蓝图处理失败/.test(message)
  ) {
    return i18next.t('nocodeEditorAiPanel.flowCannotContinue')
  }
  return message
}

const normalizeFlowGroundingUserMessage = (value: unknown) => {
  const message = String(value || '').trim()
  return !message || containsTechnicalFlowText(message)
    ? i18next.t('nocodeEditorAiPanel.flowNeedsConfirmation')
    : message
}

const buildFlowSchemeGroundingConfirmationBlock = (
  sourceBlock: NocodeEditorAiArtifactBlock | undefined,
  questions: NocodeEditorAiConfirmQuestion[],
  options: {
    planningContextKey?: string
    error?: string
    title?: string
    groundingDiagnostics?: FlowSchemeConvergenceGroundingDiagnostic[]
  } = {},
): NocodeEditorAiArtifactBlock => {
  const planningContextKey = String(
    options.planningContextKey
      || sourceBlock?.confirmation?.planningContextKey
      || '',
  ).trim()
  const groundingMessage = options.error || i18next.t('nocodeEditorAiPanel.flowNeedsConfirmation')
  const openQuestions = questions.map(question => ({
    key: question.id,
    title: question.title,
    reason: question.title,
    scopeKind: question.scopeKind === 'trigger-branch' ? 'branch' as const : 'global' as const,
    scopeKey: question.branchKey,
  }))
  const sourceScheme = normalizeNocodeEditorFlowScheme(sourceBlock?.scheme)
  const flowSchemeTitle = String(
    options.title
    || sourceBlock?.title
    || sourceScheme?.title
    || i18next.t('nocodeEditorAiPanel.flowScheme'),
  ).trim() || i18next.t('nocodeEditorAiPanel.flowScheme')
  const scheme = decorateFlowSchemeWithConvergence({
    scheme: {
      ...(sourceScheme || {
        title: flowSchemeTitle,
        summary: groundingMessage,
        trigger: {
          type: 'unknown' as const,
          description: i18next.t('nocodeEditorAiPanel.flowConfirmationRequiredDescription'),
        },
        mainPath: [],
        branches: [],
        confirmedFacts: [],
        assumptions: [],
      }),
      openQuestions,
      convergence: null,
    },
    groundingDiagnostics: Array.isArray(options.groundingDiagnostics)
      ? options.groundingDiagnostics
      : undefined,
    deriveDeferredConfigItems: false,
  })
  const resultSummary = buildFlowSchemeConvergenceResultSummary(scheme)

  return {
    ...(sourceBlock || {}),
    type: 'artifact',
    kind: 'flow-scheme',
    status: 'ready',
    title: flowSchemeTitle,
    summary: groundingMessage,
    message: groundingMessage,
    error: groundingMessage,
    scheme,
    planningStatus: 'needs_confirmation',
    confirmation: {
      ...(sourceBlock?.confirmation || {}),
      stage: 'flow-scheme',
      status: 'pending',
      planningContextKey,
      questions,
      resultSummary: resultSummary.length ? resultSummary : undefined,
      requiredNextAction: 'editor_plan_flow_scheme',
      blockedNextAction: 'editor_stage_flow_blueprint',
    } as NocodeEditorAiConfirmPayload,
  }
}

const upsertFlowSchemeGroundingQuestions = (
  message: NocodeEditorAiMessage,
  questions: NocodeEditorAiConfirmQuestion[],
  options: {
    planningContextKey?: string
    error?: string
    title?: string
    groundingDiagnostics?: FlowSchemeConvergenceGroundingDiagnostic[]
  } = {},
) => {
  if (!questions.length) {
    return false
  }

  const blocks = [...getAllArtifactBlocks(message)]
  const planningContextKey = String(options.planningContextKey || '').trim()
  const existingFlowSchemeIndex = findFlowSchemeArtifactIndexForPlanningContext({
    blocks,
    planningContextKey,
  })

  const existingFlowScheme = existingFlowSchemeIndex >= 0
    ? blocks[existingFlowSchemeIndex]
    : undefined
  const nextBlock = buildFlowSchemeGroundingConfirmationBlock(existingFlowScheme, questions, options)
  if (existingFlowSchemeIndex >= 0) {
    blocks[existingFlowSchemeIndex] = nextBlock
  } else {
    blocks.push(nextBlock)
  }
  setMessageArtifactBlocks(message, blocks)

  return true
}

const isFlowBlueprintExpansionStateBlock = (
  block?: NocodeEditorAiArtifactBlock | null,
  status?: NocodeEditorAiArtifactBlockStatus,
) => {
  if (!block) {
    return false
  }

  if (status && block.status !== status) {
    return false
  }

  if (block.status === 'loading' && block.kind === 'flow-plan') {
    return (
      resolveFlowBlueprintPreflightPhase(block) === 'waiting_blueprint'
      || block.message === getFlowBlueprintExpansionLoadingMessage()
    )
  }

  if (block.status === 'error' && block.kind === 'flow-plan') {
    return Boolean(
      block.confirmation?.planningContextKey
      && !block.flowPlan
      && !block.flowApplyResult
    )
  }

  return false
}

const isFlowSchemePlanningStateBlock = (
  block?: NocodeEditorAiArtifactBlock | null,
  status?: NocodeEditorAiArtifactBlockStatus,
) => {
  if (!block) {
    return false
  }

  if (status && block.status !== status) {
    return false
  }

  return block.status === 'loading' && block.kind === 'flow-scheme'
}

const shouldShowMessageBubble = (message: NocodeEditorAiMessage) => {
  if (message.role === NocodeEditorAiMessageRole.ASSISTANT) {
    if (isImportedHandoffAssistantSummaryMessage(message)) {
      return false
    }
    return Boolean(
      getMessageContinuityHints(message).length
      || hasRenderableAssistantMarkdown(message)
      || getRenderableFormulaActionSummaries(message).length > 0
      || shouldShowAssistantThinking(message),
    )
  }

  const text = String(message.content || '').trim()
  if (editingUserMessageId.value === message.id) {
    return true
  }
  if (!text) {
    return false
  }
  return true
}

const isImportedHandoffAssistantSummaryMessage = (message: NocodeEditorAiMessage) => (
  message.role === NocodeEditorAiMessageRole.ASSISTANT
  && Boolean(message.metadata?.handoffImported)
  && Boolean(message.metadata?.suppressImportedHandoffArtifacts)
)

const resolveImportedHandoffContentField = (
  content: string,
  label: string,
) => {
  const prefix = `${label}：`
  return content
    .split('\n')
    .map(line => line.trim())
    .find(line => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim() || ''
}

const getImportedHandoffVisibleFields = (message: NocodeEditorAiMessage) => {
  const content = String(message.content || '')
  const metadata = message.metadata || {}
  const fields = [
    {
      label: i18next.t('nocodeEditorAiPanel.handoffTitle'),
      value: String(
        metadata.importedHandoffTitle
        || resolveImportedHandoffContentField(content, '标题'),
      ).trim(),
    },
    {
      label: i18next.t('nocodeEditorAiPanel.handoffTargetApp'),
      value: String(
        metadata.importedHandoffTargetAppName
        || resolveImportedHandoffContentField(content, '目标应用'),
      ).trim(),
    },
    {
      label: i18next.t('nocodeEditorAiPanel.handoffCreateMode'),
      value: String(
        metadata.importedHandoffCreationModeText
        || resolveImportedHandoffContentField(content, '创建方式'),
      ).trim(),
    },
    {
      label: i18next.t('nocodeEditorAiPanel.handoffRequirement'),
      value: String(
        metadata.importedHandoffGoal
        || resolveImportedHandoffContentField(content, '需求'),
      ).trim(),
    },
  ]

  return fields.filter(field => field.value)
}

const hasRenderableMessageExtra = (message: NocodeEditorAiMessage) => (
  getRenderableDraftIssueActionLists(message).length > 0
  || getRenderableFlowIssueActionLists(message).length > 0
  || getRenderableConfirmationBlocks(message).length > 0
  || getRenderableArtifactBlocks(message).length > 0
)

const isSupersededMessage = (message?: NocodeEditorAiMessage | null) => Boolean(message?.metadata?.supersededAt)

const shouldRenderMessageRow = (message: NocodeEditorAiMessage) => (
  !isSupersededMessage(message)
  &&
  !isAiTimelineHiddenMessage(message.metadata || null)
  && (shouldShowMessageBubble(message) || getUserAttachments(message).length > 0 || hasRenderableMessageExtra(message))
)

const clearCurrentRespondingAssistantId = (assistantId?: string) => {
  const normalizedAssistantId = String(assistantId || '').trim()
  if (!normalizedAssistantId || currentRespondingAssistantId.value === normalizedAssistantId) {
    currentRespondingAssistantId.value = ''
  }
}

const renderableMessages = computed(() => (
  messages.value.filter(shouldRenderMessageRow)
))

const isEditableUserMessageCandidate = (message: NocodeEditorAiMessage) => (
  message.role === NocodeEditorAiMessageRole.USER
  && !isSupersededMessage(message)
  && !isImportedHandoffVisibleUserMessage(message)
)

const getLastEditableUserMessage = () => {
  for (let index = renderableMessages.value.length - 1; index >= 0; index -= 1) {
    const message = renderableMessages.value[index]
    if (isEditableUserMessageCandidate(message)) {
      return message
    }
  }
  return null
}

const canEditUserMessage = (message: NocodeEditorAiMessage) => (
  isEditableUserMessageCandidate(message)
  && !isPreparingSubmit.value
  && !isResponding.value
  && getLastEditableUserMessage()?.id === message.id
)

const rewindEditedMessageTail = async (sourceMessageId?: string | null) => {
  const sourceMessageIndex = messages.value.findIndex(message => message.id === sourceMessageId)
  if (sourceMessageIndex < 0) {
    return
  }
  const retainedMessages = messages.value.slice(0, sourceMessageIndex)
  messages.value = retainedMessages
  await restoreStagedStateFromMessages(retainedMessages)
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

const handleEditUserMessage = async (message: NocodeEditorAiMessage) => {
  if (!canEditUserMessage(message)) {
    return
  }
  const messageAttachments = getUserAttachments(message)
  const attachments = messageAttachments
    .map(attachment => (
      attachment.kind === 'excel'
        ? cloneAiExcelAttachmentForComposer(attachment)
        : normalizeComposerAttachment({ ...attachment, source: 'uploaded', status: 'ready' })
    ))
    .filter(Boolean) as AiAttachment[]
  if (attachments.length < messageAttachments.length) {
    ElMessage.warning(i18next.t('nocodeEditorAiPanel.someAttachmentsExpiredUploadAgain'))
  }
  editingUserMessageId.value = message.id
  editingUserMessageDraft.value = message.content || ''
  editingUserMessageAttachments.value = replaceCurrentExcelAttachment(attachments, resolveLatestExcelAttachment(attachments))
  await focusInlineEditTextarea()
}

const getMessageBubbleClass = (message: NocodeEditorAiMessage) => {
  if (message.role !== NocodeEditorAiMessageRole.USER) {
    return 'message-bubble'
  }

  return {
    'message-bubble': true,
    'message-bubble--imported-handoff': isImportedHandoffVisibleUserMessage(message),
    'message-bubble--structured-confirmation': isStructuredConfirmationReplyMessage(message.content),
    'message-bubble--inline-editing': editingUserMessageId.value === message.id,
  }
}

const isCurrentRespondingAssistantMessage = (message: NocodeEditorAiMessage) => (
  message.role === NocodeEditorAiMessageRole.ASSISTANT
  && currentRespondingAssistantId.value === message.id
)

const shouldKeepThinkingWithArtifact = (message: NocodeEditorAiMessage) => {
  if (!isCurrentRespondingAssistantMessage(message)) {
    return false
  }

  return getAllArtifactBlocks(message).some(block => block.status === 'loading')
}

const shouldShowAssistantThinking = (message: NocodeEditorAiMessage) => {
  if (message.role !== NocodeEditorAiMessageRole.ASSISTANT) {
    return false
  }

  if (String(message.content || '').trim() === getThinkingText()) {
    return true
  }

  return Boolean(
    currentRespondingAssistantId.value === message.id
    && (
      (isResponding.value && !getAllArtifactBlocks(message).length)
      || shouldKeepThinkingWithArtifact(message)
    ),
  )
}

const resolveContinueGenerationErrorState = (message: NocodeEditorAiMessage) => {
  if (message.role !== NocodeEditorAiMessageRole.ASSISTANT) {
    return null
  }
  const resolved = resolveNocodeEditorStreamErrorRecovery({
    error: message.content,
    metadata: message.metadata || null,
  })
  return resolved.canContinueGeneration ? resolved : null
}

const shouldShowContinueGenerationAction = (message: NocodeEditorAiMessage) => (
  Boolean(resolveContinueGenerationErrorState(message))
)

const isContinuingGenerationFromError = (message: NocodeEditorAiMessage) => {
  const traceId = resolveMessageTraceId(message)
  return Boolean(traceId && continuingGenerationFromErrorTraceId.value === traceId)
}

const isContinueGenerationActionDisabled = (message: NocodeEditorAiMessage) => {
  if (isPreparingSubmit.value || isResponding.value) {
    return true
  }
  const traceId = resolveMessageTraceId(message)
  if (!traceId) {
    return true
  }
  return Boolean(
    continuingGenerationFromErrorTraceId.value
    && continuingGenerationFromErrorTraceId.value !== traceId,
  )
}

const handleContinueGenerationFromError = async (message: NocodeEditorAiMessage) => {
  const resolvedError = resolveContinueGenerationErrorState(message)
  const retryOfTraceId = resolvedError?.metadata.traceId
  if (!resolvedError || !retryOfTraceId || isContinueGenerationActionDisabled(message)) {
    return
  }

  const recoveryRequest = buildContinueGenerationRequest({
    retryOfTraceId,
    errorKind: resolvedError.metadata.errorKind,
  })
  continuingGenerationFromErrorTraceId.value = retryOfTraceId
  try {
    await submitMessage(recoveryRequest.providerPromptContent, {
      visibleUserContent: recoveryRequest.userFacingContent,
      visibleUserMetadata: recoveryRequest.requestMetadata,
      requestMetadata: recoveryRequest.requestMetadata,
    })
  } finally {
    if (continuingGenerationFromErrorTraceId.value === retryOfTraceId) {
      continuingGenerationFromErrorTraceId.value = ''
    }
  }
}

const resolveFlowBlueprintPreflightPhase = (
  block?: NocodeEditorAiArtifactBlock | null,
) => String(block?.flowBlueprintPreflightPhase || '').trim()

const liveStatus = computed(() => {
  if (isApplyingBlueprint.value) {
    return {
      title: i18next.t('nocodeEditorAiPanel.applyingBlueprintTitle'),
      description: i18next.t('nocodeEditorAiPanel.applyingBlueprintDescription'),
    }
  }

  if (isApplyingFlow.value) {
    return {
      title: i18next.t('nocodeEditorAiPanel.applyingFlowTitle'),
      description: i18next.t('nocodeEditorAiPanel.applyingFlowDescription'),
    }
  }

  if (isRefreshingBlueprint.value) {
    return {
      title: i18next.t('nocodeEditorAiPanel.preparingSessionTitle'),
      description: i18next.t('nocodeEditorAiPanel.preparingSessionDescription'),
    }
  }

  if (isPreparingSubmit.value) {
    return {
      title: i18next.t('nocodeEditorAiPanel.preparingSessionTitle'),
      description: i18next.t('nocodeEditorAiPanel.preparingSessionDescription'),
    }
  }

  const latestAssistant = [...messages.value]
    .reverse()
    .find(message => message.role === NocodeEditorAiMessageRole.ASSISTANT)
  const loadingBlock = latestAssistant && (
    isResponding.value
    || isApplyingBlueprint.value
    || isApplyingFlow.value
    || isPreparingSubmit.value
  )
    ? [...getAllArtifactBlocks(latestAssistant)]
      .reverse()
      .find(block => block.status === 'loading')
    : null

  if (loadingBlock?.kind === 'app-plan') {
    return {
      title: i18next.t('nocodeEditorAiPanel.organizingAppPlan'),
      description: loadingBlock.message || getThinkingDescription(),
    }
  }

  if (loadingBlock?.kind === 'form-plan') {
    return {
      title: i18next.t('nocodeEditorAiPanel.organizingFormPlan'),
      description: loadingBlock.message || getThinkingDescription(),
    }
  }

  if (loadingBlock?.kind === 'flow-scheme') {
    return {
      title: i18next.t('nocodeEditorAiPanel.organizingFlowScheme'),
      description: loadingBlock.message || getThinkingDescription(),
    }
  }

  const preflightPhase = resolveFlowBlueprintPreflightPhase(loadingBlock)
  if (preflightPhase === 'summary') {
    return {
      title: i18next.t('nocodeEditorAiPanel.validatingFlowScheme'),
      description: loadingBlock?.message || i18next.t('nocodeEditorAiPanel.validatingFlowSchemeDescription'),
    }
  }

  if (preflightPhase === 'examples') {
    return {
      title: i18next.t('nocodeEditorAiPanel.preparingFlowBlueprint'),
      description: loadingBlock?.message || i18next.t('nocodeEditorAiPanel.preparingFlowBlueprintDescription'),
    }
  }

  if (isFlowBlueprintExpansionStateBlock(loadingBlock, 'loading')) {
    return {
      title: i18next.t('nocodeEditorAiPanel.generatingFlowBlueprint'),
      description: loadingBlock?.message || getThinkingDescription(),
    }
  }

  if (loadingBlock?.kind === 'blueprint') {
    return {
      title: i18next.t('nocodeEditorAiPanel.generatingDetailedBlueprint'),
      description: loadingBlock.message || getThinkingDescription(),
    }
  }

  if (isResponding.value) {
    return {
      title: i18next.t('nocodeEditorAiPanel.aiAnalyzingRequirement'),
      description: getThinkingDescription(),
    }
  }

  return null
})

const canOpenPreview = (block: NocodeEditorAiArtifactBlock) => canPreviewAiArtifact(block)

const isCurrentFormPlanBlock = (block: NocodeEditorAiArtifactBlock) => {
  return Boolean(
    block.kind === 'form-plan'
    && block.status === 'ready'
    && stagedFormPlan.value.outline
    && Number(block.revision || 0) === Number(stagedFormPlan.value.revision || 0)
    && Number(block.stagedAt || 0) === Number(stagedFormPlan.value.stagedAt || 0),
  )
}

const isCurrentFlowPlanBlock = (block: NocodeEditorAiArtifactBlock) => {
  return Boolean(
    block.kind === 'flow-plan'
    && block.status === 'ready'
    && stagedFlowPlan.value.flowPlan
    && Number(block.revision || 0) === Number(stagedFlowPlan.value.revision || 0)
    && Number(block.stagedAt || 0) === Number(stagedFlowPlan.value.stagedAt || 0),
  )
}

const isCurrentAppPlanBlock = (block: NocodeEditorAiArtifactBlock) => (
  doesAppPlanArtifactMatchStagedState(block, stagedAppPlan.value)
)

const isCurrentBlueprintBlock = (block: NocodeEditorAiArtifactBlock) => {
  return doesBlueprintArtifactMatchStagedState(block, stagedBlueprint.value)
}

const findLatestCurrentAppPlanArtifactBlock = () => {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const block = getAllArtifactBlocks(messages.value[index])
      .find(item => isCurrentAppPlanBlock(item))
    if (block) {
      return block
    }
  }
  return null
}

const findLatestCurrentFormPlanArtifactBlock = () => {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const block = getAllArtifactBlocks(messages.value[index])
      .find(item => isCurrentFormPlanBlock(item))
    if (block) {
      return block
    }
  }
  return null
}

const findLatestCurrentFlowArtifactBlock = () => {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const block = getAllArtifactBlocks(messages.value[index])
      .find(item => isCurrentFlowPlanBlock(item))
    if (block) {
      return block
    }
  }
  return null
}

const findLatestReadyFlowSchemeArtifactBlock = () => {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const block = [...getAllArtifactBlocks(messages.value[index])]
      .reverse()
      .find(item => (
        item.kind === 'flow-scheme'
        && item.status === 'ready'
        && Boolean(normalizeNocodeEditorFlowScheme(item.scheme))
      ))
    if (block) {
      return block
    }
  }
  return null
}

const findLatestCurrentBlueprintArtifactBlock = () => {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const block = getAllArtifactBlocks(messages.value[index])
      .find(item => isCurrentBlueprintBlock(item))
    if (block) {
      return block
    }
  }
  return null
}

const canApplyFlowFromPreview = (block?: NocodeEditorAiArtifactBlock | null) => {
  const applyContextReady = isFlowPlanApplyContextReady({
    flowPlan: stagedFlowPlan.value.flowPlan,
    sourceSchemeRevision: stagedFlowPlan.value.sourceSchemeRevision,
    flowScheme: stagedFlowScheme.value.scheme,
    flowSchemeRevision: stagedFlowScheme.value.revision,
  })
  const flowSchemeReady = !stagedFlowScheme.value.scheme
    || stagedFlowScheme.value.planningStatus === 'ready_for_review'

  return Boolean(
    block
    && block.kind === 'flow-plan'
    && isCurrentFlowPlanBlock(block)
    && !block.flowApplyResult
    && !resolveAiArtifactPendingQuestionCount(block)
    && !hasPendingNocodeEditorFlowPlanQuestions(stagedFlowPlan.value.flowPlan)
    && applyContextReady
    && flowSchemeReady
    && !isPreparingSubmit.value
    && !isResponding.value
    && !isApplyingFlow.value
    && !isRefreshingBlueprint.value,
  )
}

const canApplyBlueprintFromPreview = (block?: NocodeEditorAiArtifactBlock | null) => Boolean(
  block
  && block.kind === 'blueprint'
  && isCurrentBlueprintBlock(block)
  && isBlueprintStagedPhase(block.phase)
  && !isPreparingSubmit.value
  && !isResponding.value
  && !isApplyingBlueprint.value
  && !isRefreshingBlueprint.value,
)

const openPreviewArtifact = (block: NocodeEditorAiArtifactBlock) => {
  previewSessionId.value += 1
  previewArtifact.value = withDisplayVersionLabel(block) || block
  previewDialogVisible.value = true
}

const closePreviewArtifact = () => {
  previewSessionId.value += 1
  previewArtifact.value = null
  previewDialogVisible.value = false
}

const handleArtifactView = (block: NocodeEditorAiArtifactBlock) => {
  const nocodeId = resolveAiArtifactNocodeId(block)
  if (nocodeId) {
    router.push({
      path: `/app/${nocodeId}/edit/`,
      query: {
        aiEntry: 'builder-editor',
      },
    })
    return
  }

  if (!canOpenPreview(block)) {
    return
  }
  openPreviewArtifact(block)
}

const handleOpenFormulaResultTarget = async (item: NocodeEditorAiFormulaActionItem) => {
  const result = await props.runtime.openFormulaResultTarget({
    tableId: item.tableId,
    tableName: item.tableName,
    widgetId: item.widgetId,
  })
  if (!result?.ok) {
    if (result?.reason === 'widget_not_found') {
      ElMessage.error(i18next.t('nocodeEditorAiPanel.fieldNotFound'))
      return
    }
    ElMessage.error(i18next.t('nocodeEditorAiPanel.openFormulaPanelFailed'))
  }
}

const handlePreviewConfirmationArtifact = (block: NocodeEditorAiArtifactBlock) => {
  if (!canPreviewAiArtifact(block)) {
    return
  }
  openPreviewArtifact(block)
}

const restorePendingBlueprintItemForAction = async (item: NocodeEditorAiStageBlueprintDisplayItem) => {
  if (!isStagedBlueprintItem(item)) {
    throw new Error(i18next.t('nocodeEditorAiPanel.onlyPendingBlueprintCanContinue'))
  }
  if (isPreparingSubmit.value || isResponding.value || isApplyingBlueprint.value || isRefreshingBlueprint.value) {
    throw new Error(i18next.t('nocodeEditorAiPanel.aiBusyTryLater'))
  }

  const itemRevision = Number(item.revision || 0)
  const itemStagedAt = Number(item.stagedAt || 0)
  const currentMatches = Boolean(
    stagedBlueprint.value.blueprint
    && Number(stagedBlueprint.value.revision || 0) === itemRevision
    && Number(stagedBlueprint.value.stagedAt || 0) === itemStagedAt
    && isSameBlueprintApplyScope(stagedBlueprint.value.blueprint, item.blueprint)
    && normalizeNocodeEditorPlanningScopeValue(stagedBlueprint.value.planningScope)
      === normalizeNocodeEditorPlanningScopeValue(item.planningScope)
  )

  if (currentMatches) {
    return buildBlueprintArtifactBlock(stagedBlueprint.value)
  }

  await props.runtime.restoreStagedAppBlueprint({
    phase: 'staged',
    planningScope: normalizeNocodeEditorPlanningScopeValue(item.planningScope),
    revision: Number(item.revision || stagedBlueprint.value.revision + 1),
    stagedAt: Number(item.stagedAt || Date.now()) || Date.now(),
    blueprint: item.blueprint,
    applyResult: null,
    draftPersistenceState: null,
    sourcePlanningContextKey: String(item.sourcePlanningContextKey || '').trim() || null,
  })
  await refreshStagedState()
  return buildBlueprintArtifactBlock(stagedBlueprint.value)
}

const getActivePlanningSummaryBlock = () => (
  findLatestCurrentFormPlanArtifactBlock()
  || findLatestCurrentAppPlanArtifactBlock()
  || buildFormPlanArtifactBlock(stagedFormPlan.value)
  || buildAppPlanArtifactBlock(stagedAppPlan.value)
)

const buildSolutionOutlinePromptSummary = () => {
  const activePlanningBlock = getActivePlanningSummaryBlock()
  const outline = activePlanningBlock?.outline || stagedFormPlan.value.outline || stagedAppPlan.value.plan?.outline
  if (!outline) return ''

  const formPlanPresentation = activePlanningBlock?.formPlanPresentation
    || buildFormPlanArtifactBlock(stagedFormPlan.value)?.formPlanPresentation
    || null
  const formPlanningSummary = buildNocodeEditorSingleFormPlanPromptSummary({
    outline,
    solutionPresentation: formPlanPresentation,
  })
  if (formPlanningSummary) {
    return formPlanningSummary
  }
  const confirmation = resolveAiArtifactConfirmation(activePlanningBlock)
  const completionSummary = String(confirmation?.completionSummary || '').trim()
  const resultSummary = Array.isArray(confirmation?.resultSummary)
    ? confirmation.resultSummary.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const questionLines = buildConfirmationQuestionSummaryLines(activePlanningBlock)

  return [
    outline.title ? `方案标题：${outline.title}` : '',
    confirmation?.status === 'completed' ? '确认状态：已完成，可继续进入蓝图细化。' : '',
    completionSummary ? `确认结论：${completionSummary}` : '',
    resultSummary.length ? `确认结果：${resultSummary.join('；')}` : '',
    `模块数：${outline.modules?.length || 0}`,
    `表单数：${outline.forms?.length || 0}`,
    `流程节点数：${outline.flows?.length || 0}`,
    currentHostContext.value?.activeFormName ? `当前焦点表单：${currentHostContext.value.activeFormName}` : '',
    questionLines.length ? `待确认：\n${questionLines.join('\n')}` : '',
  ].filter(Boolean).join('\n')
}

const buildConfirmationQuestionSummaryLines = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  return resolveAiArtifactQuestions(block).flatMap((question, index) => {
    const lines = [`${index + 1}. ${question.title}`]
    const description = String(question.description || '').trim()
    if (description) {
      lines.push(`   说明：${description}`)
    }
    return lines
  })
}

const buildPlanningPromptSummary = () => {
  const activeSolutionSummary = buildSolutionOutlinePromptSummary()
  if (activeSolutionSummary && hasCompletedSolutionConfirmationBeforeBlueprint()) {
    return activeSolutionSummary
  }
  const latestPlanningMessage = [...messages.value]
    .reverse()
    .find(message => String(message.metadata?.appBuilderPlanningSummary || '').trim())
  return String(latestPlanningMessage?.metadata?.appBuilderPlanningSummary || activeSolutionSummary || '').trim()
}

const buildFlowPromptSummary = () => {
  const flowSchemeBlock = findLatestReadyFlowSchemeArtifactBlock()
  const flowScheme = normalizeNocodeEditorFlowScheme(flowSchemeBlock?.scheme)
  if (!flowScheme) {
    return ''
  }

  const convergence = flowScheme.convergence || null
  const confirmation = flowSchemeBlock?.confirmation || flowScheme.confirmation || null
  const mainPathTitles = flowScheme.mainPath
    .map(step => String(step.title || '').trim())
    .filter(Boolean)
  const branchTitles = flowScheme.branches
    .map(branch => String(branch.title || '').trim())
    .filter(Boolean)
  const resultSummary = Array.isArray(confirmation?.resultSummary) && confirmation.resultSummary.length
    ? confirmation.resultSummary
    : buildFlowSchemeConvergenceResultSummary(flowScheme)
  const pendingQuestions = buildConfirmationQuestionSummaryLines(flowSchemeBlock)

  return [
    `流程方案：${flowScheme.title}`,
    flowScheme.target?.formName ? `所属表单：${flowScheme.target.formName}` : '',
    `摘要：${String(flowSchemeBlock?.summary || flowScheme.summary || '').trim()}`,
    flowScheme.trigger?.description ? `触发：${flowScheme.trigger.description}` : '',
    mainPathTitles.length ? `主链：${mainPathTitles.join(' -> ')}` : '',
    branchTitles.length ? `分支：${branchTitles.join('；')}` : '',
    convergence
      ? `收敛状态：业务${convergence.businessStatus === 'pending' ? `待确认 ${convergence.unresolvedQuestionCount} 项` : '已收敛'}；依赖${convergence.dependencyStatus === 'pending' ? `待处理 ${convergence.unresolvedDependencyCount} 项` : '已收敛'}`
      : '',
    convergence?.deferredConfigItemCount
      ? `生成后待补配置：${convergence.deferredConfigItemCount} 项`
      : '',
    resultSummary.length ? `当前收敛结论：${resultSummary.join('；')}` : '',
    pendingQuestions.length ? `待确认：\n${pendingQuestions.join('\n')}` : '',
  ].filter(Boolean).join('\n')
}

const viewingFlowPatchResultKey = ref('')
const getFlowPatchResultKey = (block: Pick<AiAssistantFlowPatchResultBlock, 'formId' | 'draftVersion'>) => (
  `${block.formId}:${block.draftVersion}`
)

const handleViewFlowPatchResult = async (target: {
  formId: string
  formName?: string
  draftVersion: number
}) => {
  if (viewingFlowPatchResultKey.value) {
    return
  }
  viewingFlowPatchResultKey.value = `${target.formId}:${target.draftVersion}`
  try {
    const result = await props.runtime.viewFlowPatchResult(target)
    if (!result.ok) {
      ElMessage.error(result.reason || '查看流程修改失败')
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '查看流程修改失败')
  } finally {
    viewingFlowPatchResultKey.value = ''
  }
}

const hasPendingSolutionConfirmation = () => {
  const planningBlock = getActivePlanningSummaryBlock()
  if (!planningBlock) {
    return false
  }
  if (stagedBlueprint.value.blueprint) {
    return false
  }
  return resolveAiArtifactPendingQuestionCount(planningBlock) > 0
}

const hasCompletedSolutionConfirmationBeforeBlueprint = () => {
  const planningBlock = getActivePlanningSummaryBlock()
  if (!planningBlock || stagedBlueprint.value.blueprint) {
    return false
  }

  const confirmation = resolveAiArtifactConfirmation(planningBlock)
  return confirmation?.status === 'completed'
}

const buildBlueprintPromptSummary = () => {
  const blueprint = stagedBlueprint.value.blueprint
  if (!blueprint) return ''

  const blueprintBlock = buildBlueprintArtifactBlock(stagedBlueprint.value)
  const blueprintId = String(blueprint.id || '').trim()
  const fieldCount = blueprint.forms.reduce((sum, form) => sum + form.fields.length, 0)
  const focusForm = blueprint.forms.find((form) => {
    const activeFormName = String(currentHostContext.value?.activeFormName || '').trim()
    return activeFormName && activeFormName === String(form.tableName || '').trim()
  })
  const questionLines = buildConfirmationQuestionSummaryLines(blueprintBlock)

  return [
    blueprintId ? `蓝图 ID：${blueprintId}（后续增量修改默认沿用这个 ID，不要另起一份同级蓝图）` : '',
    blueprint.title ? `蓝图标题：${blueprint.title}` : '',
    `表单数：${blueprint.forms.length}`,
    `字段总数：${fieldCount}`,
    focusForm ? `当前焦点表单：${focusForm.tableName}` : '',
    questionLines.length ? `待确认：\n${questionLines.join('\n')}` : '',
  ].filter(Boolean).join('\n')
}

const hasPendingBlueprintConfirmation = () => {
  const blueprint = stagedBlueprint.value.blueprint
  if (!blueprint) {
    return false
  }
  return isBlueprintStagedPhase(stagedBlueprint.value.phase)
}

const collectAppliedBlueprintBlocks = () => {
  const blocks: NocodeEditorAiArtifactBlock[] = []
  for (const message of messages.value) {
    for (const block of getAllArtifactBlocks(message)) {
      if (
        block.kind === 'blueprint'
        && block.status === 'ready'
        && isBlueprintAppliedPhase(block.phase)
      ) {
        blocks.push(block)
      }
    }
  }
  const stagedBlock = buildBlueprintArtifactBlock(stagedBlueprint.value)
  if (
    stagedBlock?.kind === 'blueprint'
    && stagedBlock.status === 'ready'
    && isBlueprintAppliedPhase(stagedBlock.phase)
  ) {
    blocks.push(stagedBlock)
  }
  return blocks
}

const buildPendingBlueprintClarificationSummary = (
  decision: ReturnType<typeof resolveNocodeEditorRepeatBlueprintClarification>,
) => {
  if (decision.clarificationSummary) {
    return decision.clarificationSummary
  }

  const blueprintBlock = buildBlueprintArtifactBlock(stagedBlueprint.value)
  const questionLines = buildConfirmationQuestionSummaryLines(blueprintBlock)
  if (decision.clarificationKind === 'planning-question') {
    return [
      '当前蓝图还有待确认问题，需要先澄清，不继续刷新蓝图版本。',
      ...(questionLines.length ? questionLines : []),
    ].join('\n')
  }

  return '当前蓝图已经整理完成，只差你明确确认是否按这版蓝图生成。'
}

const buildCurrentBlueprintConfirmationBlock = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (block?.kind === 'blueprint') {
    return withDisplayVersionLabel(block) || block
  }
  return withDisplayVersionLabel(buildBlueprintArtifactBlock(stagedBlueprint.value))
}

const buildCurrentPlanningArtifactContextKey = () => {
  const appPlanBlock = findLatestCurrentAppPlanArtifactBlock()
    || buildAppPlanArtifactBlock(stagedAppPlan.value)
  const formPlanBlock = findLatestCurrentFormPlanArtifactBlock()
    || buildFormPlanArtifactBlock(stagedFormPlan.value)
  return buildPlanningArtifactContextKey(appPlanBlock || formPlanBlock)
}

const buildCurrentPlanningArtifactContextKeys = () => {
  const appPlanBlock = findLatestCurrentAppPlanArtifactBlock()
    || buildAppPlanArtifactBlock(stagedAppPlan.value)
  const formPlanBlock = findLatestCurrentFormPlanArtifactBlock()
    || buildFormPlanArtifactBlock(stagedFormPlan.value)
  return Array.from(new Set([
    buildPlanningArtifactContextKey(appPlanBlock),
    buildLogicalPlanningArtifactContextKey(appPlanBlock),
    buildPlanningArtifactContextKey(formPlanBlock),
    buildLogicalPlanningArtifactContextKey(formPlanBlock),
  ].filter(Boolean)))
}

const resolvePlanningArtifactContextKeys = (
  block?: NocodeEditorAiArtifactBlock | null,
) => Array.from(new Set([
  String(block?.confirmation?.planningContextKey || '').trim(),
  buildPlanningArtifactContextKey(block),
  buildLogicalPlanningArtifactContextKey(block),
].filter(Boolean)))

const resolveBlueprintSourcePlanningContextKeys = () => {
  const keys = new Set<string>()
  const stagedSourceKey = String(stagedBlueprint.value.sourcePlanningContextKey || '').trim()
  if (stagedSourceKey) {
    keys.add(stagedSourceKey)
  }
  const stagedBlock = buildBlueprintArtifactBlock(stagedBlueprint.value)
  const blockSourceKey = stagedBlock ? getBlueprintArtifactPlanningContextKey(stagedBlock) : ''
  if (blockSourceKey) {
    keys.add(blockSourceKey)
  }
  return Array.from(keys)
}

const resolveBlueprintArtifactContextKeys = (
  block?: NocodeEditorAiArtifactBlock | null,
) => Array.from(new Set([
  getBlueprintArtifactPlanningContextKey(block as NocodeEditorAiArtifactBlock),
].filter(Boolean)))

const buildBlueprintContinuationContext = () => buildPlanningContinuationContext({
  currentPlanningContextKey: buildCurrentPlanningArtifactContextKey(),
  currentPlanningContextKeys: buildCurrentPlanningArtifactContextKeys(),
  blueprintSourcePlanningContextKeys: resolveBlueprintSourcePlanningContextKeys(),
})

const doesArtifactContextKeyListMatch = (
  sourceKeys: string[],
  targetKeys: string[],
) => {
  if (!sourceKeys.length || !targetKeys.length) {
    return false
  }

  return sourceKeys.some(sourceKey => (
    targetKeys.some(targetKey => (
      isSamePlanningConfirmationContext(sourceKey, targetKey)
    ))
  ))
}

const doesPlanningArtifactBelongToGeneratedBlueprintChain = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (
    !block
    || (
      block.kind !== 'app-plan'
      && block.kind !== 'form-plan'
      && block.kind !== 'content-plan'
    )
    || !stagedBlueprint.value.blueprint
  ) {
    return false
  }

  const blockPlanningContextKeys = resolvePlanningArtifactContextKeys(block)
  const blueprintSourcePlanningContextKeys = resolveBlueprintSourcePlanningContextKeys()
  return doesArtifactContextKeyListMatch(blockPlanningContextKeys, blueprintSourcePlanningContextKeys)
}

const doesCurrentPlanningChainOwnGeneratedBlueprint = () => {
  const currentPlanningBlock = findLatestCurrentAppPlanArtifactBlock()
    || buildAppPlanArtifactBlock(stagedAppPlan.value)
    || findLatestCurrentFormPlanArtifactBlock()
    || buildFormPlanArtifactBlock(stagedFormPlan.value)

  return doesPlanningArtifactBelongToGeneratedBlueprintChain(currentPlanningBlock)
}

const resolveMatchedBlueprintSignalForPlanningCard = (
  block?: NocodeEditorAiArtifactBlock | null,
): MatchedPlanningBlueprintSignal => {
  if (
    !block
    || (
      block.kind !== 'app-plan'
      && block.kind !== 'form-plan'
      && block.kind !== 'content-plan'
      && block.kind !== 'flow-scheme'
    )
  ) {
    return {
      state: '',
      message: '',
    }
  }

  const blockPlanningContextKeys = resolvePlanningArtifactContextKeys(block)
  if (!blockPlanningContextKeys.length) {
    return {
      state: '',
      message: '',
    }
  }

  for (let messageIndex = messages.value.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages.value[messageIndex]
    if (message.role !== NocodeEditorAiMessageRole.ASSISTANT) {
      continue
    }

    const artifactBlocks = getAllArtifactBlocks(message)
    for (let blockIndex = artifactBlocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const artifactBlock = artifactBlocks[blockIndex]
      const matchedLoadingBlock = block.kind === 'flow-scheme'
        ? artifactBlock.kind === 'flow-plan'
        : artifactBlock.kind === 'blueprint'
      if (
        !matchedLoadingBlock
        || (artifactBlock.status !== 'loading' && artifactBlock.status !== 'error')
      ) {
        continue
      }

      const matchedContextKeys = block.kind === 'flow-scheme'
        ? resolvePlanningArtifactContextKeys(artifactBlock)
        : resolveBlueprintArtifactContextKeys(artifactBlock)
      if (!doesArtifactContextKeyListMatch(blockPlanningContextKeys, matchedContextKeys)) {
        continue
      }

      if (artifactBlock.status === 'loading') {
        return {
          state: 'loading',
          message: String(artifactBlock.message || '').trim(),
        }
      }

      return {
        state: 'error',
        message: String(artifactBlock.error || artifactBlock.message || '').trim(),
      }
    }
  }

  return {
    state: '',
    message: '',
  }
}

type FlowBlueprintAutoContinueCandidate = {
  message: NocodeEditorAiMessage
  block: NocodeEditorAiArtifactBlock
  planningContextKey: string
  schemeRevision: number
  candidateKey: string
}

const findLatestFlowBlueprintAutoContinueCandidateFromMessages = (
  sourceMessages: NocodeEditorAiMessage[],
): FlowBlueprintAutoContinueCandidate | null => {
  const latestAssistantMessage = [...sourceMessages]
    .reverse()
    .find(message => message.role === NocodeEditorAiMessageRole.ASSISTANT)
  if (!latestAssistantMessage) {
    return null
  }

  const currentFlowPlanBlock = findLatestCurrentFlowArtifactBlock()
  const currentFlowPlanContextKeys = resolvePlanningArtifactContextKeys(currentFlowPlanBlock)
  const artifactBlocks = [...getAllArtifactBlocks(latestAssistantMessage)].reverse()

  for (const block of artifactBlocks) {
    if (!shouldAutoContinueFlowBlueprintFromScheme(block)) {
      continue
    }

    const flowSchemeSyncDecision = resolveFlowSchemeArtifactSyncDecision({
      block,
      blocks: sessionFlowStageArtifactBlocks.value,
    })
    if (flowSchemeSyncDecision.reason === 'stale_flow_scheme_artifact') {
      continue
    }

    if (resolveMatchedBlueprintSignalForPlanningCard(block).state) {
      continue
    }

    const blockPlanningContextKeys = resolvePlanningArtifactContextKeys(block)
    if (
      currentFlowPlanContextKeys.length
      && doesArtifactContextKeyListMatch(blockPlanningContextKeys, currentFlowPlanContextKeys)
    ) {
      continue
    }

    const planningContextKey = blockPlanningContextKeys[0] || ''
    const schemeRevision = Number(block.revision || 0)
    if (
      !planningContextKey
      || !Number.isInteger(schemeRevision)
      || schemeRevision <= 0
    ) {
      continue
    }

    return {
      message: latestAssistantMessage,
      block,
      planningContextKey,
      schemeRevision,
      candidateKey: buildFlowBlueprintInternalContinuationKey({
        planningContextKey,
        schemeRevision,
      }),
    }
  }

  return null
}

const getConfirmationCardPhase = (
  message: NocodeEditorAiMessage,
  block: NocodeEditorAiArtifactBlock,
): PlanningCardPhase | '' => {
  const displayState = getPlanningArtifactDisplayStateForMessage(message, block)
  if (!displayState.renderAsConfirmation) {
    return ''
  }

  return resolvePlanningCardPhase({
    block,
    matchedBlueprintSignal: resolveMatchedBlueprintSignalForPlanningCard(block),
  })
}

const getConfirmationCardStateMessage = (
  block: NocodeEditorAiArtifactBlock,
) => {
  return resolveMatchedBlueprintSignalForPlanningCard(block).message || ''
}

const getPlanningArtifactDisplayState = (
  block: NocodeEditorAiArtifactBlock,
) => resolvePlanningArtifactDisplayState({
  block,
  stagedAppPlan: stagedAppPlan.value,
  stagedFormPlan: stagedFormPlan.value,
  stagedFormulaPlan: stagedFormulaPlan.value,
})

const findLatestAssistantMessage = () => (
  [...messages.value]
    .reverse()
    .find(message => message.role === NocodeEditorAiMessageRole.ASSISTANT)
    || null
)

const shouldAllowHistoricalCompletedFlowSchemeCard = (
  message: NocodeEditorAiMessage,
  block: NocodeEditorAiArtifactBlock,
) => {
  if (
    block.kind !== 'flow-scheme'
    || resolveAiArtifactConfirmationStatus(block) !== 'completed'
  ) {
    return false
  }

  const latestAssistantMessage = findLatestAssistantMessage()
  if (!latestAssistantMessage) {
    return false
  }

  return (
    latestAssistantMessage.id !== message.id
    || hasNewerUserMessageAfterMessage(messages.value, message.id)
  )
}

const getPlanningArtifactDisplayStateForMessage = (
  message: NocodeEditorAiMessage,
  block: NocodeEditorAiArtifactBlock,
) => resolvePlanningArtifactDisplayState({
  block,
  stagedAppPlan: stagedAppPlan.value,
  stagedFormPlan: stagedFormPlan.value,
  stagedFormulaPlan: stagedFormulaPlan.value,
  allowHistoricalCompletedFlowSchemeCard: shouldAllowHistoricalCompletedFlowSchemeCard(message, block),
})

const isReadonlyPlanningConfirmationBlock = (
  block?: NocodeEditorAiArtifactBlock | null,
) => Boolean(
  block
  && getPlanningArtifactDisplayState(block).renderAsConfirmation
  && getPlanningArtifactDisplayState(block).readonly
)

const buildConfirmationDraftKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (!block) {
    return ''
  }

  const confirmation = resolveAiArtifactConfirmation(block)
  const version = String(block.version || '').trim()
  if (version) {
    return `${block.kind}:${confirmation?.stage || ''}:${version}`
  }

  const revision = Number(block.revision || 0)
  const stagedAt = Number(block.stagedAt || 0)
  if (revision > 0 || stagedAt > 0) {
    return `${block.kind}:${confirmation?.stage || ''}:${revision}:${stagedAt}`
  }

  const questionIds = resolveAiArtifactQuestions(block)
    .map(question => String(question.id || '').trim())
    .filter(Boolean)
    .join('|')

  return `${block.kind}:${confirmation?.stage || ''}:${String(block.title || block.summary || '').trim()}:${questionIds}`
}

const getConfirmationResponseDrafts = (
  block?: NocodeEditorAiArtifactBlock | null,
): NocodeEditorAiConfirmationResponseDraftMap => {
  const questions = resolveAiArtifactQuestions(block)
  const baseDrafts = buildConfirmationResponseDrafts(questions)
  const draftKey = buildConfirmationDraftKey(block)
  if (!draftKey) {
    return baseDrafts
  }

  return {
    ...baseDrafts,
    ...(confirmationResponseDrafts.value[draftKey] || {}),
  }
}

const ensureConfirmationResponseDrafts = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const draftKey = buildConfirmationDraftKey(block)
  const drafts = getConfirmationResponseDrafts(block)
  if (!draftKey) {
    return drafts
  }

  confirmationResponseDrafts.value = {
    ...confirmationResponseDrafts.value,
    [draftKey]: drafts,
  }
  return drafts
}

const setConfirmationResponseDrafts = (
  block: NocodeEditorAiArtifactBlock,
  drafts: NocodeEditorAiConfirmationResponseDraftMap,
) => {
  const draftKey = buildConfirmationDraftKey(block)
  if (!draftKey) {
    return
  }

  confirmationResponseDrafts.value = {
    ...confirmationResponseDrafts.value,
    [draftKey]: drafts,
  }
}

const clearConfirmationResponseDrafts = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const draftKey = buildConfirmationDraftKey(block)
  if (!draftKey || !confirmationResponseDrafts.value[draftKey]) {
    return
  }

  const nextDrafts = {
    ...confirmationResponseDrafts.value,
  }
  delete nextDrafts[draftKey]
  confirmationResponseDrafts.value = nextDrafts
}

const getInlineConfirmationNoteQuestionIds = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const draftKey = buildConfirmationDraftKey(block)
  if (!draftKey) {
    return []
  }

  return confirmationInlineNoteQuestionIds.value[draftKey] || []
}

const setInlineConfirmationNoteQuestionIds = (
  block: NocodeEditorAiArtifactBlock,
  questionIds: string[],
) => {
  const draftKey = buildConfirmationDraftKey(block)
  if (!draftKey) {
    return
  }

  confirmationInlineNoteQuestionIds.value = {
    ...confirmationInlineNoteQuestionIds.value,
    [draftKey]: questionIds,
  }
}

const clearInlineConfirmationNoteQuestionIds = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const draftKey = buildConfirmationDraftKey(block)
  if (!draftKey || !confirmationInlineNoteQuestionIds.value[draftKey]) {
    return
  }

  const nextValue = { ...confirmationInlineNoteQuestionIds.value }
  delete nextValue[draftKey]
  confirmationInlineNoteQuestionIds.value = nextValue
}

const getCachedInlineConfirmationNoteDraft = (
  block: NocodeEditorAiArtifactBlock,
  questionId: string,
) => {
  const draftKey = buildConfirmationDraftKey(block)
  if (!draftKey) {
    return ''
  }

  return confirmationInlineNoteDrafts.value[draftKey]?.[questionId] || ''
}

const setCachedInlineConfirmationNoteDraft = (
  block: NocodeEditorAiArtifactBlock,
  questionId: string,
  note: string,
) => {
  const draftKey = buildConfirmationDraftKey(block)
  if (!draftKey || !questionId) {
    return
  }

  const currentQuestionDrafts = confirmationInlineNoteDrafts.value[draftKey] || {}
  const nextNote = String(note ?? '')
  if (nextNote.length > 0) {
    confirmationInlineNoteDrafts.value = {
      ...confirmationInlineNoteDrafts.value,
      [draftKey]: {
        ...currentQuestionDrafts,
        [questionId]: nextNote,
      },
    }
    return
  }

  if (!Object.prototype.hasOwnProperty.call(currentQuestionDrafts, questionId)) {
    return
  }

  const nextQuestionDrafts = {
    ...currentQuestionDrafts,
  }
  delete nextQuestionDrafts[questionId]

  if (Object.keys(nextQuestionDrafts).length) {
    confirmationInlineNoteDrafts.value = {
      ...confirmationInlineNoteDrafts.value,
      [draftKey]: nextQuestionDrafts,
    }
    return
  }

  const nextDrafts = {
    ...confirmationInlineNoteDrafts.value,
  }
  delete nextDrafts[draftKey]
  confirmationInlineNoteDrafts.value = nextDrafts
}

const clearCachedInlineConfirmationNoteDrafts = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const draftKey = buildConfirmationDraftKey(block)
  if (!draftKey || !confirmationInlineNoteDrafts.value[draftKey]) {
    return
  }

  const nextDrafts = {
    ...confirmationInlineNoteDrafts.value,
  }
  delete nextDrafts[draftKey]
  confirmationInlineNoteDrafts.value = nextDrafts
}

const restoreCachedInlineConfirmationNoteDrafts = (
  block: NocodeEditorAiArtifactBlock,
  inlineNoteDrafts: Record<string, string>,
) => {
  const draftKey = buildConfirmationDraftKey(block)
  if (!draftKey) {
    return
  }

  const nextDrafts = Object.entries(inlineNoteDrafts || {}).reduce<Record<string, string>>((acc, [questionId, note]) => {
    if (!questionId) {
      return acc
    }

    const normalizedNote = String(note ?? '')
    if (!normalizedNote) {
      return acc
    }

    acc[questionId] = normalizedNote
    return acc
  }, {})

  if (Object.keys(nextDrafts).length > 0) {
    confirmationInlineNoteDrafts.value = {
      ...confirmationInlineNoteDrafts.value,
      [draftKey]: nextDrafts,
    }
    return
  }

  const nextValue = {
    ...confirmationInlineNoteDrafts.value,
  }
  delete nextValue[draftKey]
  confirmationInlineNoteDrafts.value = nextValue
}

const snapshotConfirmationLocalState = (
  block?: NocodeEditorAiArtifactBlock | null,
): ConfirmationLocalStateSnapshot => {
  const draftKey = buildConfirmationDraftKey(block)
  return {
    responseDrafts: cloneBlueprintValue(getConfirmationResponseDrafts(block)),
    inlineNoteQuestionIds: cloneBlueprintValue(getInlineConfirmationNoteQuestionIds(block)),
    inlineNoteDrafts: draftKey
      ? cloneBlueprintValue(confirmationInlineNoteDrafts.value[draftKey] || {})
      : {},
  }
}

const clearConfirmationLocalState = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  clearConfirmationResponseDrafts(block)
  clearInlineConfirmationNoteQuestionIds(block)
  clearCachedInlineConfirmationNoteDrafts(block)
}

const restoreConfirmationLocalState = (
  block: NocodeEditorAiArtifactBlock,
  snapshot: ConfirmationLocalStateSnapshot,
) => {
  setConfirmationResponseDrafts(block, snapshot.responseDrafts)
  setInlineConfirmationNoteQuestionIds(block, snapshot.inlineNoteQuestionIds)
  restoreCachedInlineConfirmationNoteDrafts(block, snapshot.inlineNoteDrafts)
}

const updateConfirmationResponseDraft = (
  block: NocodeEditorAiArtifactBlock,
  questionId: string,
  nextDraft: {
    option?: NocodeEditorAiConfirmQuestionOption | null
    note?: string
  },
) => {
  const currentDrafts = ensureConfirmationResponseDrafts(block)
  const currentQuestionDraft = currentDrafts[questionId]
  setConfirmationResponseDrafts(block, {
    ...currentDrafts,
    [questionId]: {
      option: Object.prototype.hasOwnProperty.call(nextDraft, 'option')
        ? (nextDraft.option ?? null)
        : (currentQuestionDraft?.option ?? null),
      note: Object.prototype.hasOwnProperty.call(nextDraft, 'note')
        ? (nextDraft.note ?? '')
        : (currentQuestionDraft?.note ?? ''),
    },
  })
}

const confirmationDrawerDrafts = computed(() => (
  confirmationDrawerBlock.value
    ? getConfirmationResponseDrafts(confirmationDrawerBlock.value)
    : {}
))

const hasGeneratedBlueprintFromCurrentPlanningChain = computed(() => (
  doesCurrentPlanningChainOwnGeneratedBlueprint()
))

const currentPlanningArtifactContextKeys = computed(() => (
  resolveBlueprintSourcePlanningContextKeys()
))

const getConfirmationStatusTagText = (
  block?: NocodeEditorAiArtifactBlock | null,
) => resolveConfirmationStatusTagText(block, {
  hasGeneratedBlueprint: hasGeneratedBlueprintFromCurrentPlanningChain.value,
  planningContextKeys: currentPlanningArtifactContextKeys.value,
})

const confirmationDrawerStatusTagText = computed(() => (
  getConfirmationStatusTagText(confirmationDrawerBlock.value)
))

const closeConfirmationDrawer = () => {
  confirmationDrawerVisible.value = false
  confirmationDrawerBlock.value = null
  confirmationDrawerFocusQuestionId.value = null
  confirmationDrawerPendingBlueprintItem.value = null
}

const handleOpenConfirmationDrawer = (block: NocodeEditorAiArtifactBlock) => {
  if (!isReadonlyPlanningConfirmationBlock(block)) {
    ensureConfirmationResponseDrafts(block)
  }

  confirmationDrawerBlock.value = block
  confirmationDrawerFocusQuestionId.value = null
  confirmationDrawerPendingBlueprintItem.value = null
  confirmationDrawerVisible.value = true
}

const getActiveConfirmationInputQuestionIds = (
  block: NocodeEditorAiArtifactBlock,
) => {
  const blockDraftKey = buildConfirmationDraftKey(block)
  const drawerDraftKey = buildConfirmationDraftKey(confirmationDrawerBlock.value)
  if (
    !confirmationDrawerVisible.value
    || !blockDraftKey
    || blockDraftKey !== drawerDraftKey
    || !confirmationDrawerFocusQuestionId.value
  ) {
    return []
  }

  return [confirmationDrawerFocusQuestionId.value]
}

const isResolvedConfirmationQuestion = (
  question?: Partial<AiArtifactConfirmationQuestion> | null,
) => (
  Boolean(
    question?.confirmed
    || String(question?.selectedOptionValue || '').trim()
    || String(question?.answerSummary || '').trim(),
  )
)

const buildCompletedConfirmationContinueLabel = (
  block: NocodeEditorAiArtifactBlock,
) => (
  block.kind === 'blueprint' ? i18next.t('nocodeEditorAiPanel.generateFromBlueprint') : i18next.t('nocodeEditorAiPanel.confirmedContinue')
)

const buildCompletedConfirmationSummary = (
  block: NocodeEditorAiArtifactBlock,
) => {
  if (block.kind === 'app-plan') {
    return i18next.t('nocodeEditorAiPanel.appPlanConfirmationCompleted')
  }

  if (block.kind === 'form-plan' || block.kind === 'content-plan') {
    return i18next.t('nocodeEditorAiPanel.planConfirmationCompleted')
  }

  if (block.kind === 'flow-plan') {
    return i18next.t('nocodeEditorAiPanel.flowPlanConfirmationCompleted')
  }

  return i18next.t('nocodeEditorAiPanel.confirmationCompleted')
}

const buildCompletedConfirmationResultSummary = (
  questions: AiArtifactConfirmationQuestion[],
) => (
  questions
    .map((item) => {
      const options = Array.isArray(item.options) ? item.options : []
      const selectedOption = options.find(option => (
        Boolean(option?.selected)
        || String(option?.value || '').trim() === String(item.selectedOptionValue || '').trim()
      ))
      return String(item.answerSummary || selectedOption?.label || '').trim()
    })
    .filter(Boolean)
)

const asMutableConfirmationBlock = (
  block: NocodeEditorAiArtifactBlock,
) => (
  block as NocodeEditorAiArtifactBlock & {
    confirmation?: NocodeEditorAiConfirmPayload | null
    flowPlan?: Record<string, unknown> | null
    outline?: Record<string, unknown> | null
    appPlan?: Record<string, unknown> | null
    plan?: Record<string, unknown> | null
    scheme?: Record<string, unknown> | null
  }
)

const applyReconciledConfirmationBlockState = (
  targetBlock: ReturnType<typeof asMutableConfirmationBlock>,
  reconciledBlock: NocodeEditorAiArtifactBlock,
) => {
  targetBlock.confirmation = cloneBlueprintValue(reconciledBlock.confirmation || null)

  if (targetBlock.kind === 'flow-plan') {
    targetBlock.flowPlan = cloneBlueprintValue(reconciledBlock.flowPlan || null)
  }

  if (targetBlock.kind === 'form-plan') {
    targetBlock.outline = cloneBlueprintValue(reconciledBlock.outline || null)
  }

  if (targetBlock.kind === 'app-plan') {
    targetBlock.appPlan = cloneBlueprintValue(reconciledBlock.appPlan || null)
    if (targetBlock.outline !== undefined || reconciledBlock.outline !== undefined) {
      targetBlock.outline = cloneBlueprintValue(reconciledBlock.outline || null)
    }
  }

  if (targetBlock.kind === 'content-plan') {
    targetBlock.plan = cloneBlueprintValue(reconciledBlock.plan || null)
  }

  if (targetBlock.kind === 'flow-scheme') {
    targetBlock.scheme = cloneBlueprintValue(reconciledBlock.scheme || null)
  }
}

const buildOptimisticConfirmationFromResponses = (
  block: NocodeEditorAiArtifactBlock,
  responses: NocodeEditorAiConfirmationResponse[],
): NocodeEditorAiConfirmPayload | null => {
  const confirmation = resolveAiArtifactConfirmation(block)
  if (!confirmation || !confirmation.questions.length) {
    return null
  }

  const responseMap = new Map(
    responses
      .filter(hasMeaningfulConfirmationResponse)
      .map(response => [response.question.id, response] as const),
  )
  if (!responseMap.size) {
    return null
  }

  const nextQuestions = confirmation.questions.map((item) => {
    const response = responseMap.get(item.id)
    if (!response) {
      return cloneBlueprintValue(item)
    }

    const answerSummary = buildConfirmationResponseAnswerSummary(response)
    const answerDetail = buildConfirmationResponseAnswerDetail(response)

    return {
      ...cloneBlueprintValue(item),
      confirmed: true,
      selectedOptionValue: response.option?.value || item.selectedOptionValue,
      answerSummary: answerSummary || item.answerSummary,
      answerDetail: answerDetail || item.answerDetail,
      options: Array.isArray(item.options)
        ? item.options.map(candidate => ({
          ...candidate,
          selected: response.option
            ? candidate.value === response.option.value
            : candidate.selected,
        }))
        : item.options,
    }
  })

  const allConfirmed = nextQuestions.length > 0 && nextQuestions.every(item => isResolvedConfirmationQuestion(item))

  return {
    ...confirmation,
    status: allConfirmed ? 'completed' : 'pending',
    completionSummary: allConfirmed
      ? (confirmation.completionSummary || buildCompletedConfirmationSummary(block))
      : confirmation.completionSummary,
    resultSummary: allConfirmed
      ? buildCompletedConfirmationResultSummary(nextQuestions)
      : confirmation.resultSummary,
    continueLabel: allConfirmed
      ? buildCompletedConfirmationContinueLabel(block)
      : confirmation.continueLabel,
    secondaryActionLabel: allConfirmed
      ? getNocodeEditorPendingContinueLabel()
      : confirmation.secondaryActionLabel,
    reviewLabel: allConfirmed
      ? (confirmation.reviewLabel || i18next.t('nocodeEditorAiPanel.viewFullConfirmationRecord'))
      : confirmation.reviewLabel,
    questions: nextQuestions,
  }
}

const buildOptimisticDefaultCompletedConfirmation = (
  block: NocodeEditorAiArtifactBlock,
): NocodeEditorAiConfirmPayload | null => {
  const confirmation = resolveAiArtifactConfirmation(block)
  if (!confirmation || !confirmation.questions.length) {
    return null
  }

  return deriveDefaultCompletedConfirmationFromReplyMessage(
    confirmation,
    getNocodeEditorPendingContinueLabel(),
  )
}

const applyOptimisticConfirmationToMatchingBlocks = (
  block: NocodeEditorAiArtifactBlock,
  nextConfirmation: NocodeEditorAiConfirmPayload,
  draftKey: string,
) => {
  const rollbacks: Array<() => void> = []

  if (draftKey) {
    for (const message of messages.value) {
      const blocks = getAllArtifactBlocks(message)
      if (!blocks.length) {
        continue
      }

      let changed = false
      const nextBlocks = blocks.map((candidate) => {
        if (buildConfirmationDraftKey(candidate) !== draftKey) {
          return candidate
        }
        changed = true
        return reconcilePlanningArtifactConfirmation(candidate, nextConfirmation)
      })

      if (!changed) {
        continue
      }

      const originalBlocks = cloneBlueprintValue(getMessageBlocks(message))
      setMessageArtifactBlocks(message, nextBlocks)
      rollbacks.push(() => {
        setMessageBlocks(message, originalBlocks)
      })
    }
  }

  const mutableBlock = asMutableConfirmationBlock(block)
  const originalMutableBlock = cloneBlueprintValue(mutableBlock)
  const reconciledBlock = reconcilePlanningArtifactConfirmation(mutableBlock, nextConfirmation)
  applyReconciledConfirmationBlockState(mutableBlock, reconciledBlock)
  rollbacks.push(() => {
    applyReconciledConfirmationBlockState(mutableBlock, originalMutableBlock)
  })

  const drawerBlock = confirmationDrawerBlock.value
  if (
    drawerBlock
    && drawerBlock !== block
    && draftKey
    && buildConfirmationDraftKey(drawerBlock) === draftKey
  ) {
    const mutableDrawerBlock = asMutableConfirmationBlock(drawerBlock)
    const originalMutableDrawerBlock = cloneBlueprintValue(mutableDrawerBlock)
    const reconciledDrawerBlock = reconcilePlanningArtifactConfirmation(
      mutableDrawerBlock,
      nextConfirmation,
    )
    applyReconciledConfirmationBlockState(mutableDrawerBlock, reconciledDrawerBlock)
    rollbacks.push(() => {
      applyReconciledConfirmationBlockState(mutableDrawerBlock, originalMutableDrawerBlock)
    })
  }

  return () => {
    for (let index = rollbacks.length - 1; index >= 0; index -= 1) {
      rollbacks[index]()
    }
  }
}

const applyOptimisticConfirmationResponses = (
  block: NocodeEditorAiArtifactBlock,
  responses: NocodeEditorAiConfirmationResponse[],
) => {
  const nextConfirmation = buildOptimisticConfirmationFromResponses(block, responses)
  if (!nextConfirmation) {
    return () => {}
  }

  return applyOptimisticConfirmationToMatchingBlocks(
    block,
    nextConfirmation,
    buildConfirmationDraftKey(block),
  )
}

const applyOptimisticDefaultCompletedConfirmation = (
  block: NocodeEditorAiArtifactBlock,
) => {
  const nextConfirmation = buildOptimisticDefaultCompletedConfirmation(block)
  if (!nextConfirmation) {
    return () => {}
  }

  return applyOptimisticConfirmationToMatchingBlocks(
    block,
    nextConfirmation,
    buildConfirmationDraftKey(block),
  )
}

const handleContinueWithConfirmationDefaults = async (
  block: NocodeEditorAiArtifactBlock,
) => {
  if (isReadonlyPlanningConfirmationBlock(block)) {
    return
  }

  if (isPreparingSubmit.value || isResponding.value || isApplyingBlueprint.value || isRefreshingBlueprint.value) {
    return
  }

  const message = resolveAiArtifactContinueLabel(block)
  if (!message) {
    return
  }

  const localStateSnapshot = snapshotConfirmationLocalState(block)
  closeConfirmationDrawer()
  clearConfirmationLocalState(block)
  const rollback = applyOptimisticDefaultCompletedConfirmation(block)
  const requestMetadata = buildFlowSchemeConfirmationContinuationRequestMetadata(
    resolveAiArtifactConfirmation(block),
  )
  const submitResult = await submitMessage(
    message,
    requestMetadata ? { requestMetadata } : undefined,
  )
  if (submitResult === 'completed') {
    clearConfirmationLocalState(block)
    return
  }

  rollback()
  restoreConfirmationLocalState(block, localStateSnapshot)
}

const handleSelectConfirmationOption = (payload: {
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
  option: NocodeEditorAiConfirmQuestionOption
}) => {
  if (isReadonlyPlanningConfirmationBlock(payload.block)) {
    return
  }

  if (isPreparingSubmit.value || isResponding.value || isApplyingBlueprint.value || isRefreshingBlueprint.value) {
    return
  }

  const drafts = ensureConfirmationResponseDrafts(payload.block)
  const nextOption = toggleConfirmationResponseDraftOption(
    drafts[payload.question.id],
    payload.option,
  )

  updateConfirmationResponseDraft(payload.block, payload.question.id, {
    option: nextOption,
  })
}

const handleSelectConfirmationOptionFromDrawer = (payload: {
  question: AiArtifactConfirmationQuestion
  option: NocodeEditorAiConfirmQuestionOption
}) => {
  if (!confirmationDrawerBlock.value) {
    return
  }

  handleSelectConfirmationOption({
    block: confirmationDrawerBlock.value,
    question: payload.question,
    option: payload.option,
  })
}

const handleUpdateConfirmationNote = (payload: {
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  if (
    !confirmationDrawerBlock.value
    || isReadonlyPlanningConfirmationBlock(confirmationDrawerBlock.value)
    || isPreparingSubmit.value
    || isResponding.value
    || isApplyingBlueprint.value
    || isRefreshingBlueprint.value
  ) {
    return
  }

  updateConfirmationResponseDraft(confirmationDrawerBlock.value, payload.question.id, {
    note: payload.note,
  })
}

const handleUpdateConfirmationNoteActive = (payload: {
  questionId: string
  active: boolean
}) => {
  if (
    !confirmationDrawerBlock.value
    || isReadonlyPlanningConfirmationBlock(confirmationDrawerBlock.value)
  ) {
    return
  }

  if (payload.active) {
    confirmationDrawerFocusQuestionId.value = payload.questionId
    return
  }

  if (confirmationDrawerFocusQuestionId.value === payload.questionId) {
    confirmationDrawerFocusQuestionId.value = null
  }
}

const handleFocusConfirmationQuestion = async (payload: {
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
}) => {
  if (isReadonlyPlanningConfirmationBlock(payload.block)) {
    return
  }

  if (isPreparingSubmit.value || isResponding.value || isApplyingBlueprint.value || isRefreshingBlueprint.value) {
    return
  }

  ensureConfirmationResponseDrafts(payload.block)
  confirmationDrawerBlock.value = payload.block
  confirmationDrawerFocusQuestionId.value = payload.question.id
  confirmationDrawerPendingBlueprintItem.value = null
  confirmationDrawerVisible.value = true
}

const handleSelectBlueprintPreviewConfirmationOption = (payload: {
  question: AiArtifactConfirmationQuestion
  option: NocodeEditorAiConfirmQuestionOption
}) => {
  if (!previewArtifact.value) {
    return
  }

  handleSelectConfirmationOption({
    block: previewArtifact.value,
    question: payload.question,
    option: payload.option,
  })
}

const handleToggleBlueprintInlineConfirmationInput = (payload: {
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
}) => {
  if (isPreparingSubmit.value || isResponding.value || isApplyingBlueprint.value || isRefreshingBlueprint.value) {
    return
  }

  const currentDrafts = ensureConfirmationResponseDrafts(payload.block)
  const currentDraft = currentDrafts[payload.question.id]
  const currentIds = getInlineConfirmationNoteQuestionIds(payload.block)
  const nextIds = currentIds.includes(payload.question.id)
    ? currentIds.filter(id => id !== payload.question.id)
    : [...currentIds, payload.question.id]

  if (nextIds.includes(payload.question.id)) {
    const cachedNoteDraft = getCachedInlineConfirmationNoteDraft(payload.block, payload.question.id)
    if (!currentDraft?.note && cachedNoteDraft) {
      updateConfirmationResponseDraft(payload.block, payload.question.id, {
        note: cachedNoteDraft,
      })
    }
  }

  setInlineConfirmationNoteQuestionIds(payload.block, nextIds)

  if (!nextIds.includes(payload.question.id)) {
    setCachedInlineConfirmationNoteDraft(payload.block, payload.question.id, currentDraft?.note || '')
    updateConfirmationResponseDraft(payload.block, payload.question.id, {
      note: '',
    })
  }
}

const handleUpdateBlueprintInlineConfirmationNote = (payload: {
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  if (isPreparingSubmit.value || isResponding.value || isApplyingBlueprint.value || isRefreshingBlueprint.value) {
    return
  }

  updateConfirmationResponseDraft(payload.block, payload.question.id, {
    note: payload.note,
  })
}

const handleToggleBlueprintPreviewInlineConfirmationInput = (
  question: AiArtifactConfirmationQuestion,
) => {
  if (!previewArtifact.value) {
    return
  }

  handleToggleBlueprintInlineConfirmationInput({
    block: previewArtifact.value,
    question,
  })
}

const handleUpdateBlueprintPreviewInlineConfirmationNote = (payload: {
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  if (!previewArtifact.value) {
    return
  }

  handleUpdateBlueprintInlineConfirmationNote({
    block: previewArtifact.value,
    question: payload.question,
    note: payload.note,
  })
}

const handleToggleFlowInlineConfirmationInput = (payload: {
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
}) => {
  handleToggleBlueprintInlineConfirmationInput(payload)
}

const handleUpdateFlowInlineConfirmationNote = (payload: {
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  handleUpdateBlueprintInlineConfirmationNote(payload)
}

const handleContinueFlowWithDefaults = async (
  block: NocodeEditorAiArtifactBlock,
) => {
  await handleContinueWithConfirmationDefaults(block)
}

const submitStagedConfirmationResponses = async (
  block: NocodeEditorAiArtifactBlock,
  options: {
    closeDrawerOnSuccess?: boolean
  } = {},
): Promise<SubmitStagedConfirmationResponsesResult> => {
  if (isReadonlyPlanningConfirmationBlock(block)) {
    return 'skipped'
  }

  const drafts = ensureConfirmationResponseDrafts(block)
  const questions = resolveAiArtifactPendingQuestions(block)
  if (countUnansweredConfirmationQuestions(questions, drafts) > 0) {
    return 'skipped'
  }

  const responses = buildStagedConfirmationResponses(questions, drafts)
    .filter(hasMeaningfulConfirmationResponse)
  if (!responses.length) {
    return 'skipped'
  }

  const message = buildConfirmationBatchReplyMessage(responses)
  if (!message) {
    return 'skipped'
  }

  const confirmation = resolveAiArtifactConfirmation(block)
  const shouldReplanFlowSchemeFirst = confirmation?.requiredNextAction === 'editor_plan_flow_scheme'
  const submitContent = shouldReplanFlowSchemeFirst
    ? `${message}\n\n请先根据以上确认更新流程方案，再继续生成流程。`
    : message
  const requestMetadata = buildFlowSchemeConfirmationContinuationRequestMetadata(confirmation)
  const rollback = applyOptimisticConfirmationResponses(block, responses)
  const shouldCloseDrawerBeforeSubmit = Boolean(options.closeDrawerOnSuccess && confirmationDrawerVisible.value)
  if (shouldCloseDrawerBeforeSubmit) {
    closeConfirmationDrawer()
  }
  const submitResult = await submitMessage(
    submitContent,
    requestMetadata
      ? { requestMetadata }
      : undefined,
  )
  if (submitResult === 'completed' || shouldKeepCommittedConfirmation(submitResult)) {
    clearConfirmationResponseDrafts(block)
    clearInlineConfirmationNoteQuestionIds(block)
    clearCachedInlineConfirmationNoteDrafts(block)
    return submitResult === 'completed' ? 'completed' : 'committed'
  }
  rollback()
  if (shouldCloseDrawerBeforeSubmit) {
    handleOpenConfirmationDrawer(block)
  }
  return 'failed'
}

const handleSubmitBlueprintConfirmationResponses = async () => {
  if (!previewArtifact.value) {
    return
  }

  const submitPreviewSessionId = previewSessionId.value
  const submitResult = await submitStagedConfirmationResponses(previewArtifact.value, {
    closeDrawerOnSuccess: true,
  })
  if (submitResult !== 'completed' || submitPreviewSessionId !== previewSessionId.value) {
    return
  }

  closePreviewArtifact()
}

const handleSubmitCardConfirmationResponses = async (
  block: NocodeEditorAiArtifactBlock,
) => {
  if (isPreparingSubmit.value || isResponding.value || isApplyingBlueprint.value || isRefreshingBlueprint.value) {
    return
  }

  await submitStagedConfirmationResponses(block)
}

const handleSubmitFlowConfirmationResponses = async (
  block: NocodeEditorAiArtifactBlock,
) => {
  if (isPreparingSubmit.value || isResponding.value || isApplyingBlueprint.value || isRefreshingBlueprint.value) {
    return
  }

  await submitStagedConfirmationResponses(block)
}

const handleSubmitConfirmationResponses = async (payload: {
  block: NocodeEditorAiArtifactBlock
  responses: NocodeEditorAiConfirmationResponse[]
}) => {
  if (isPreparingSubmit.value || isResponding.value || isApplyingBlueprint.value || isRefreshingBlueprint.value) {
    return
  }

  const submitBlock = await restorePendingBlueprintConfirmationBlock({
    item: confirmationDrawerPendingBlueprintItem.value,
    block: payload.block,
  })
  await submitStagedConfirmationResponses(submitBlock, {
    closeDrawerOnSuccess: true,
  })
}

const handleResumeConfirmationChat = async () => {
  closeConfirmationDrawer()
  await nextTick()
  chatInputRef.value?.updateTextareaHeight?.()
  await focusTextarea()
}

const confirmBlueprintApplyWithPendingQuestionCount = async (
  pendingQuestionCount: number,
) => {
  if (!pendingQuestionCount) {
    return
  }

  await openBlueprintApplyConfirmDialog({
    title: i18next.t('nocodeEditorAiPanel.pendingConfirmationTitle'),
    summaryText: i18next.t('nocodeEditorAiPanel.pendingQuestionsSummary', { count: pendingQuestionCount }),
    riskText: i18next.t('nocodeEditorAiPanel.blueprintApplyRisk'),
    recommendationText: i18next.t('nocodeEditorAiPanel.completeConfirmationsRecommendation'),
    pendingQuestionCount,
    confirmText: i18next.t('nocodeEditorAiPanel.generateAnyway'),
    cancelText: i18next.t('nocodeEditorAiPanel.backToEdit'),
  })
}

const ensureBlueprintApplyConfirmed = async (
  options: {
    confirmationBlock?: NocodeEditorAiArtifactBlock | null
  } = {},
) => {
  const confirmationBlock = buildCurrentBlueprintConfirmationBlock(options.confirmationBlock)
  const pendingQuestionCount = resolveAiArtifactPendingQuestionCount(confirmationBlock)
  if (!pendingQuestionCount) {
    return
  }

  await openBlueprintApplyConfirmDialog({
    title: i18next.t('nocodeEditorAiPanel.pendingConfirmationTitle'),
    summaryText: i18next.t('nocodeEditorAiPanel.pendingQuestionsSummary', { count: pendingQuestionCount }),
    riskText: i18next.t('nocodeEditorAiPanel.blueprintApplyRisk'),
    recommendationText: i18next.t('nocodeEditorAiPanel.completeConfirmationsRecommendation'),
    pendingQuestionCount,
    confirmText: i18next.t('nocodeEditorAiPanel.generateAnyway'),
    cancelText: i18next.t('nocodeEditorAiPanel.backToEdit'),
  })
}

const ensurePendingBlueprintBatchApplyConfirmed = async (
  items: NocodeEditorAiStageBlueprintDisplayItem[],
) => {
  const confirmedDraftKeys = new Set<string>()
  const pendingQuestionCount = items.reduce((total, item) => {
    if (!isStagedBlueprintItem(item)) {
      return total
    }

    const block = buildPendingBlueprintConfirmationBlock(item)
    const count = resolveAiArtifactPendingQuestionCount(block)
    if (!count) {
      return total
    }

    const draftKey = buildConfirmationDraftKey(block) || item.identityKey || item.id
    if (confirmedDraftKeys.has(draftKey)) {
      return total
    }

    confirmedDraftKeys.add(draftKey)
    return total + count
  }, 0)

  await confirmBlueprintApplyWithPendingQuestionCount(pendingQuestionCount)
}

const isBlueprintApplyConfirmDismissed = (error: unknown) => {
  const message = String(error || '').trim().toLowerCase()
  return message === 'cancel' || message === 'close'
}

const openBlueprintApplyConfirmDialog = (options: {
  title: string
  summaryText: string
  riskText: string
  recommendationText: string
  pendingQuestionCount: number
  confirmText: string
  cancelText: string
}) => {
  blueprintApplyConfirmDialogTitle.value = options.title
  blueprintApplyConfirmDialogSummary.value = options.summaryText
  blueprintApplyConfirmDialogRiskText.value = options.riskText
  blueprintApplyConfirmDialogRecommendationText.value = options.recommendationText
  blueprintApplyConfirmDialogPendingCount.value = options.pendingQuestionCount
  blueprintApplyConfirmDialogConfirmText.value = options.confirmText
  blueprintApplyConfirmDialogCancelText.value = options.cancelText
  blueprintApplyConfirmDialogVisible.value = true

  return new Promise<void>((resolve, reject) => {
    resolveBlueprintApplyConfirmDialog = resolve
    rejectBlueprintApplyConfirmDialog = reject
  })
}

const clearBlueprintApplyConfirmDialog = () => {
  blueprintApplyConfirmDialogVisible.value = false
  blueprintApplyConfirmDialogPendingCount.value = 0
  blueprintApplyConfirmDialogSummary.value = ''
  blueprintApplyConfirmDialogTitle.value = i18next.t('nocodeEditorAiPanel.pendingConfirmationTitle')
  blueprintApplyConfirmDialogRiskText.value = i18next.t('nocodeEditorAiPanel.blueprintApplyRisk')
  blueprintApplyConfirmDialogRecommendationText.value = ''
  blueprintApplyConfirmDialogConfirmText.value = i18next.t('nocodeEditorAiPanel.generateAnyway')
  blueprintApplyConfirmDialogCancelText.value = i18next.t('nocodeEditorAiPanel.backToEdit')
  resolveBlueprintApplyConfirmDialog = null
  rejectBlueprintApplyConfirmDialog = null
}

const handleBlueprintApplyConfirm = () => {
  resolveBlueprintApplyConfirmDialog?.()
  clearBlueprintApplyConfirmDialog()
}

const handleBlueprintApplyCancel = () => {
  rejectBlueprintApplyConfirmDialog?.('cancel')
  clearBlueprintApplyConfirmDialog()
}

const waitForBlueprintApplyUiFeedback = async () => {
  await nextTick()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, BLUEPRINT_APPLY_UI_FEEDBACK_DELAY_MS)
    })
  })
}

const hasAssistantArtifactMessage = (
  kind: 'app-plan' | 'form-plan' | 'blueprint',
  version: string,
) => {
  if (!version) {
    return false
  }

  return messages.value.some(message => (
    message.role === NocodeEditorAiMessageRole.ASSISTANT
    && getAllArtifactBlocks(message).some(block => (
      block.kind === kind
      && String(block.version || '').trim() === version
    ))
  ))
}

const resolveActivePlanningArtifactVersion = () => {
  const formPlanBlock = buildFormPlanArtifactBlock(stagedFormPlan.value)
  if (formPlanBlock) {
    return {
      kind: 'form-plan' as const,
      version: String(formPlanBlock.version || '').trim(),
    }
  }

  const appPlanBlock = buildAppPlanArtifactBlock(stagedAppPlan.value)
  if (appPlanBlock) {
    return {
      kind: 'app-plan' as const,
      version: String(appPlanBlock.version || '').trim(),
    }
  }

  return null
}

const shouldInjectActiveSolutionSummary = () => {
  if (!(hasPendingSolutionConfirmation() || hasCompletedSolutionConfirmationBeforeBlueprint())) {
    return false
  }
  const activePlanningArtifactVersion = resolveActivePlanningArtifactVersion()
  if (!activePlanningArtifactVersion?.version) {
    return true
  }
  return !hasAssistantArtifactMessage(
    activePlanningArtifactVersion.kind,
    activePlanningArtifactVersion.version,
  )
}

const buildRequestMessage = (content: string) => {
  const text = String(content || '').trim()
  return text
}

const isMessagesContainerNearBottom = (container: HTMLElement) => {
  const { scrollTop, scrollHeight, clientHeight } = container
  return scrollHeight - scrollTop - clientHeight < 50
}

const handleMessagesScroll = () => {
  const container = messagesContainerRef.value
  if (!container) {
    return
  }

  isAtBottom.value = isMessagesContainerNearBottom(container)
}

const shouldAutoScrollToBottom = () => {
  const container = messagesContainerRef.value
  if (!container) {
    return true
  }

  return isMessagesContainerNearBottom(container)
}

let panelFooterResizeObserver: ResizeObserver | null = null

const disconnectPanelFooterResizeObserver = () => {
  panelFooterResizeObserver?.disconnect()
  panelFooterResizeObserver = null
}

const waitForNextAnimationFrame = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => {
    resolve()
  })
})

const resolveTailCardViewportAdjustment = () => {
  const container = messagesContainerRef.value
  const tailCard = tailPostFormFlowTailCardRef.value
  if (!container || !tailCard) {
    return null
  }

  const containerRect = container.getBoundingClientRect()
  const tailCardRect = tailCard.getBoundingClientRect()

  return computePostFormFlowTailCardViewportAdjustment({
    scrollTop: container.scrollTop,
    scrollHeight: container.scrollHeight,
    clientHeight: container.clientHeight,
    containerBottom: containerRect.bottom,
    tailCardBottom: tailCardRect.bottom,
  })
}

const alignTailCardViewportIfNeeded = () => {
  const container = messagesContainerRef.value
  const adjustment = resolveTailCardViewportAdjustment()
  if (!container || !adjustment) {
    return false
  }

  if (!adjustment.shouldScroll) {
    isAtBottom.value = isMessagesContainerNearBottom(container)
    return false
  }

  container.scrollTo({
    top: adjustment.nextScrollTop,
    behavior: 'auto',
  })
  isAtBottom.value = adjustment.maxScrollTop - adjustment.nextScrollTop < 50
  return true
}

const syncTailCardViewportAfterLayout = async () => {
  if (!tailPostFormFlowFollowUpCard.value) {
    return
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await nextTick()
    const didAlign = alignTailCardViewportIfNeeded()
    await waitForNextAnimationFrame()

    const pendingAdjustment = resolveTailCardViewportAdjustment()
    if (!pendingAdjustment?.shouldScroll) {
      if (messagesContainerRef.value) {
        isAtBottom.value = isMessagesContainerNearBottom(messagesContainerRef.value)
      }
      if (!didAlign) {
        return
      }
    }
  }
}

const connectPanelFooterResizeObserver = () => {
  disconnectPanelFooterResizeObserver()
  if (typeof ResizeObserver === 'undefined' || !panelFooterRef.value) {
    return
  }

  panelFooterResizeObserver = new ResizeObserver(() => {
    if (!tailPostFormFlowFollowUpCard.value || !isAtBottom.value) {
      return
    }
    void syncTailCardViewportAfterLayout()
  })
  panelFooterResizeObserver.observe(panelFooterRef.value)
}

const scrollToBottom = async (smooth = false) => {
  await nextTick()
  const container = messagesContainerRef.value
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
    isAtBottom.value = isMessagesContainerNearBottom(container)
  }
}

let messagesContainerResizeObserver: ResizeObserver | null = null
let lastMessagesContainerHeight = 0

const disconnectMessagesContainerResizeObserver = () => {
  messagesContainerResizeObserver?.disconnect()
  messagesContainerResizeObserver = null
}

// 面板在父级尚未完成布局时（编辑器初次 display:none）加载历史，滚动会落空且不会自愈；
// 等消息容器真正有高度后，若用户仍在底部则补一次对齐
const connectMessagesContainerResizeObserver = () => {
  disconnectMessagesContainerResizeObserver()
  const container = messagesContainerRef.value
  if (typeof ResizeObserver === 'undefined' || !container) {
    return
  }

  lastMessagesContainerHeight = container.clientHeight
  messagesContainerResizeObserver = new ResizeObserver(() => {
    const nextContainer = messagesContainerRef.value
    if (!nextContainer) {
      return
    }

    const nextHeight = nextContainer.clientHeight
    const becameVisible = lastMessagesContainerHeight === 0 && nextHeight > 0
    lastMessagesContainerHeight = nextHeight
    if (becameVisible && isAtBottom.value) {
      void scrollToBottom()
    }
  })
  messagesContainerResizeObserver.observe(container)
}

const findLatestAssistantMessageByTraceId = (traceId?: string) => {
  const normalizedTraceId = normalizeTraceId(traceId)
  if (!normalizedTraceId) {
    return null
  }

  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const message = messages.value[index]
    if (message.role !== NocodeEditorAiMessageRole.ASSISTANT) {
      continue
    }
    const messageTraceId = normalizeTraceId(message.traceId || message.metadata?.traceId)
    if (messageTraceId === normalizedTraceId) {
      return {
        index,
        message,
      }
    }
  }

  return null
}

const pushAssistantMessage = async (
  content: string,
  traceId?: string,
  metadata?: Record<string, unknown> | null,
) => {
  const message: NocodeEditorAiMessage = {
    id: createMessageId('assistant'),
    role: NocodeEditorAiMessageRole.ASSISTANT,
    content,
    createTime: Date.now(),
    metadata: metadata ? { ...metadata } : null,
  }
  syncMessageTraceId(message, traceId)
  messages.value.push(message)
  await scrollToBottom()
}

const startBlueprintApplyProgressMessage = async () => {
  const traceId = createTurnTraceId()
  await pushAssistantMessage(getThinkingText(), traceId, {
    scene: 'nocode-editor',
    traceId,
    blueprintApplyStartedFromAction: true,
    blocks: [
      buildLoadingArtifactBlock(
        'blueprint',
        formatBlueprintApplyProgressMessage({
          blueprint: stagedBlueprint.value.blueprint,
          persistenceMode: stagedBlueprint.value.draftPersistenceState ? 'draft_only' : 'saved',
        }),
      ),
    ],
  })
  return traceId
}

const updateBlueprintApplyProgressMessage = async (input: {
  traceId?: string
  content?: string
  metadata?: Record<string, unknown> | null
}) => {
  const matchedMessage = findLatestAssistantMessageByTraceId(input.traceId)
  if (!matchedMessage) {
    return
  }

  const { message } = matchedMessage
  if (typeof input.content === 'string') {
    message.content = input.content
  }
  if (input.metadata) {
    message.metadata = {
      ...(message.metadata || {}),
      ...input.metadata,
    }
  }

  if (shouldAutoScrollToBottom()) {
    await scrollToBottom()
  }
}

const finishBlueprintApplyProgressMessage = async (input: {
  traceId?: string
  content: string
  metadata?: Record<string, any> | null
}) => {
  const matchedMessage = findLatestAssistantMessageByTraceId(input.traceId)
  if (!matchedMessage) {
    return
  }

  const { message } = matchedMessage
  message.content = input.content
  const nextBlocks = getAllArtifactBlocks(message).filter(block => !(
    block.kind === 'blueprint' && block.status === 'loading'
  ))
  if (input.metadata?.blocks) {
    setMessageArtifactBlocks(message, Array.isArray(input.metadata.blocks) ? input.metadata.blocks as NocodeEditorAiArtifactBlock[] : nextBlocks)
  } else {
    setMessageArtifactBlocks(message, nextBlocks)
  }
  message.metadata = {
    ...(message.metadata || {}),
    ...(input.metadata || {}),
  }

  if (shouldAutoScrollToBottom()) {
    await scrollToBottom()
  }
}

const persistConversationMessage = async (
  role: NocodeEditorAiMessageRole,
  content: string,
  traceId?: string,
  metadata?: Record<string, unknown> | null,
  options?: {
    seedSource?: NocodeEditorAiTaskSeed['source']
  },
) => {
  let currentConversationId = normalizeConversationId(conversationId.value || boundConversationId.value)
  let currentTaskSeed = taskSeed.value
  let scopeKey = String(currentScopeKey.value || '').trim()

  if (!currentConversationId) {
    const taskContext = await ensureCurrentTaskSeed(
      options?.seedSource
      || resolveNocodeEditorAiSubmitTaskSource({
        taskSeed: taskSeed.value,
        aiEntrySource: resolveAiEntrySource(),
      }),
    )
    if (!taskContext.conversationId) {
      return null
    }
    currentConversationId = taskContext.conversationId
    currentTaskSeed = taskContext.taskSeed
    scopeKey = String(taskContext.scopeKey || '').trim()
  }

  return await axios.post(`/ai/nocode-editor/conversations/${currentConversationId}/messages`, {
    role,
    content,
    traceId,
    nocodeId: props.nocodeId,
    taskId: currentTaskSeed?.taskId,
    scopeKey: scopeKey || undefined,
    source: currentTaskSeed?.source,
    metadata,
  })
}

const persistAssistantMessage = async (
  content: string,
  traceId?: string,
  metadata?: Record<string, unknown> | null,
) => (
  await persistConversationMessage(
    NocodeEditorAiMessageRole.ASSISTANT,
    content,
    traceId,
    metadata,
  )
)

const persistDraftIssueCompletionSyncState = async (
  resolvedState: NocodeEditorAiDraftPersistenceState,
) => {
  const currentConversationId = normalizeConversationId(conversationId.value || boundConversationId.value)
  if (!currentConversationId) {
    return
  }

  const resolvedStateSignature = buildDraftPersistenceStateSignature(resolvedState)
  const metadata = {
    ...buildDraftCompletionSyncMetadata(resolvedState),
    hiddenFromTimeline: true,
    draftIssueCompletionSync: true,
  }
  const postFormFlowRelease = normalizeNocodeEditorPostFormFlowRelease(
    metadata.postFormFlowRelease,
  )
  const releaseSignature = [
    getCurrentBlueprintIdentityKey(),
    postFormFlowRelease?.status || 'none',
    ...(postFormFlowRelease?.issues || []).map(issue => issue.key).sort(),
  ].join(':')
  const persistenceKey = `${currentConversationId}:${resolvedStateSignature}:${releaseSignature}`
  if (draftIssueCompletionSyncPersistenceKeys.has(persistenceKey)) {
    return
  }
  draftIssueCompletionSyncPersistenceKeys.add(persistenceKey)

  try {
    await persistAssistantMessage('', normalizeTraceId(resolvedState.sourceTraceId), metadata)
    pendingDraftIssueCompletionSyncSignatures.delete(resolvedStateSignature)
  } catch (error) {
    draftIssueCompletionSyncPersistenceKeys.delete(persistenceKey)
    console.warn('Failed to persist draft issue completion sync message:', error)
  }
}

const persistFlowIssueCompletionSyncState = async (
  message: NocodeEditorAiMessage,
  nextState: NocodeEditorAiFlowIssueState,
) => {
  const currentConversationId = normalizeConversationId(conversationId.value || boundConversationId.value)
  if (!currentConversationId) {
    return
  }
  const traceId = normalizeTraceId(message.traceId || message.metadata?.traceId)
  if (!traceId) {
    return
  }

  const persistenceKey = [
    currentConversationId,
    traceId,
    resolveResolvedFlowActionFormIds(nextState).sort().join(','),
  ].join(':')
  if (flowIssueCompletionSyncPersistenceKeys.has(persistenceKey)) {
    return
  }
  flowIssueCompletionSyncPersistenceKeys.add(persistenceKey)

  try {
    await persistAssistantMessage('', traceId, {
      hiddenFromTimeline: true,
      flowIssueCompletionSync: true,
      summaryStage: 'flow-plan',
      flowIssueActionList: nextState,
    })
  } catch (error) {
    flowIssueCompletionSyncPersistenceKeys.delete(persistenceKey)
    console.warn('Failed to persist flow issue completion sync message:', error)
  }
}

const emitBlueprintApplied = (
  result: NocodeEditorAiBlueprintApplyResult,
  options: {
    targetFormKeys?: string[]
    pendingIdentityKeys?: string[]
  } = {},
) => {
  if (!stagedBlueprint.value.blueprint) {
    return
  }

  const pendingBlueprint = stagedBlueprint.value.blueprint
  const appliedBlueprint = buildScopedBlueprintByApplyResult(pendingBlueprint, result)
    || buildScopedBlueprintByTargetFormKeys(pendingBlueprint, options.targetFormKeys)
    || pendingBlueprint
  const pendingIdentityKeys = (
    Array.isArray(options.pendingIdentityKeys) && options.pendingIdentityKeys.length
      ? options.pendingIdentityKeys
      : collectPendingBlueprintIdentityKeysByTargetFormKeys(
        pendingBlueprintWorkspace.value.currentItems,
        {
          blueprint: pendingBlueprint,
          revision: Number(stagedBlueprint.value.revision || 0),
          stagedAt: Number(stagedBlueprint.value.stagedAt || 0),
          sourcePlanningContextKey: stagedBlueprint.value.sourcePlanningContextKey || null,
          targetFormKeys: options.targetFormKeys,
        },
      )
  )
    .map(value => String(value || '').trim())
    .filter((value): value is string => Boolean(value))

  emit('blueprint-applied', {
    pendingIdentityKey: pendingIdentityKeys.length === 1 ? pendingIdentityKeys[0] : undefined,
    pendingIdentityKeys: pendingIdentityKeys.length > 1 ? pendingIdentityKeys : undefined,
    title: String(pendingBlueprint.title || '').trim() || undefined,
    summary: String(pendingBlueprint.summary || '').trim() || undefined,
    createdAt: Number(stagedBlueprint.value.stagedAt || 0) || undefined,
    updatedAt: Number(result.finishedAt || Date.now()) || Date.now(),
    revision: Number(stagedBlueprint.value.revision || 0) || undefined,
    stagedAt: Number(stagedBlueprint.value.stagedAt || 0) || undefined,
    result,
    blueprint: appliedBlueprint,
  })
}

const buildPendingBlueprintApplyState = (item: NocodeEditorAiStageBlueprintDisplayItem) => {
  const currentRevision = Number(stagedBlueprint.value.revision || 0)
  return {
    revision: Math.max(Number(currentRevision || 0), Number(item.revision || 0)) + 1,
    stagedAt: Date.now(),
    blueprint: cloneBlueprintValue(item.applyBlueprint || item.blueprint),
    applyResult: null,
  }
}

const buildApplyResultMessageMetadata = (
  result: NocodeEditorAiBlueprintApplyResult,
  traceId: string,
  blueprintBlock: NocodeEditorAiArtifactBlock | null,
  pendingFlowIntent?: NocodeEditorPendingFlowIntent | null,
  postFormFlowOpportunity?: NocodeEditorAiBlueprintApplyResult['postFormFlowOpportunity'],
  postFormFlowFollowUp?: NocodeEditorAiBlueprintApplyResult['postFormFlowFollowUp'],
  postFormFlowRelease?: NocodeEditorAiBlueprintApplyResult['postFormFlowRelease'],
) => ({
  scene: 'nocode-editor',
  traceId,
  summaryStage: 'blueprint' as const,
  blueprintAppliedFromAction: true,
  planningScope: normalizeNocodeEditorPlanningScopeValue(result.planningScope),
  blocks: blueprintBlock ? [blueprintBlock] : [],
  draftIssueActionList: result.persistenceMode === 'draft_only'
    ? result.draftPersistenceState
    : null,
  pendingFlowIntent: pendingFlowIntent ?? null,
  postFormFlowSignals: result.postFormFlowSignals ?? null,
  postFormFlowOpportunity: postFormFlowOpportunity ?? null,
  postFormFlowFollowUp: postFormFlowFollowUp ?? null,
  postFormFlowRelease: postFormFlowRelease ?? null,
})

const buildApplyProgressMessageLead = () => (
  formatBlueprintApplyProgressMessage({
    blueprint: stagedBlueprint.value.blueprint,
    persistenceMode: stagedBlueprint.value.draftPersistenceState ? 'draft_only' : 'saved',
  })
)

const formatBlueprintApplyCompletedFormsLine = (completedCount: number, totalCount: number) => {
  const normalizedTotal = Math.max(0, Number(totalCount || 0))
  if (!normalizedTotal) {
    return ''
  }

  const normalizedCompleted = Math.max(0, Number(completedCount || 0))
  return i18next.t('nocodeEditorAiPanel.completedFormProgress', { completed: Math.min(normalizedCompleted, normalizedTotal), total: normalizedTotal })
}

const buildApplyProgressStatusLines = (input: {
  savingPreviousBlueprint?: boolean
  totalFormCount?: number
  completedFormCount?: number
}) => {
  const normalizedTotal = Math.max(0, Number(input.totalFormCount || 0))
  const lines: string[] = []

  if (input.savingPreviousBlueprint) {
    lines.push('正在保存上一份蓝图…')
  }

  if (normalizedTotal > 0) {
    lines.push(formatBlueprintApplyDetectedFormsMessage(normalizedTotal))
  }

  const completedLine = formatBlueprintApplyCompletedFormsLine(
    Number(input.completedFormCount || 0),
    normalizedTotal,
  )
  if (completedLine) {
    lines.push(completedLine)
  }

  return lines
}

const formatApplyResultMessage = (result: NocodeEditorAiBlueprintApplyResult) => {
  return formatBlueprintApplyResultMessageFromHelper({
    blueprint: stagedBlueprint.value.blueprint,
    persistenceMode: result.persistenceMode === 'draft_only' ? 'draft_only' : 'saved',
    draftIssueCount: result.draftPersistenceState?.actionIssues?.length
      || result.draftPersistenceState?.issueCount
      || 0,
    summary: result.summary,
  })
}

const buildApplyInlineFollowUpLines = (
  postFormFlowFollowUp?: NocodeEditorAiBlueprintApplyResult['postFormFlowFollowUp'],
) => buildNocodeEditorPostFormFlowInlineMessageLines(postFormFlowFollowUp)

const buildApplyProgressNarrationContent = (input: {
  progressLines: string[]
  resultMessage?: string | null
  followUpLines?: string[]
}) => (
  buildBlueprintApplyNarrationContent({
    leadMessage: buildApplyProgressMessageLead(),
    progressLines: input.progressLines,
    resultMessage: input.resultMessage,
    followUpLines: input.followUpLines,
  })
)

const syncMessagesWithStagedState = () => {
  for (const message of messages.value) {
    const blocks = getAllArtifactBlocks(message)
    if (
      !blocks.length
      && !message.metadata?.draftIssueActionList
      && !message.metadata?.flowIssueActionList
      && !message.metadata?.flowAppliedFromAction
    ) {
      continue
    }

    let changed = false
    const nextBlocks = blocks.map((block) => {
      if (block.kind === 'app-plan') {
        const decision = resolveAppPlanArtifactSyncDecision(block, stagedAppPlan.value)
        if (!decision.shouldSync) {
          return block
        }

        const nextBlock = buildAppPlanArtifactBlock(stagedAppPlan.value, {
          industrySkeletonContext: block.industrySkeletonContext ?? undefined,
        })
        if (nextBlock) {
          changed = true
          return nextBlock
        }
      }

      if (block.kind === 'form-plan' && isCurrentFormPlanBlock(block)) {
        const nextBlock = buildFormPlanArtifactBlock(stagedFormPlan.value, {
          industrySkeletonContext: block.industrySkeletonContext ?? undefined,
        })
        if (nextBlock) {
          changed = true
          return nextBlock
        }
      }

      if (block.kind === 'flow-plan' && isCurrentFlowPlanBlock(block)) {
        const nextBlock = buildFlowPlanArtifactBlock(stagedFlowPlan.value)
        if (nextBlock) {
          changed = true
          return nextBlock
        }
      }

      if (block.kind === 'blueprint' && isCurrentBlueprintBlock(block)) {
        const nextBlock = buildBlueprintArtifactBlock(stagedBlueprint.value, {
          industrySkeletonContext: block.industrySkeletonContext ?? undefined,
        })
        if (nextBlock) {
          changed = true
          return nextBlock
        }
      }

      return block
    })

    if (changed) {
      setMessageArtifactBlocks(message, nextBlocks)
    }

    syncDraftIssueListPresentationState(message)
    syncFlowIssueListResolutionState(message)
  }

  syncActionAppliedBlueprintHistory()
  syncHistoricalAppliedFlowArtifacts()
}

const finalizeStoppedAssistantMessage = (
  targetAssistantId?: string,
  options?: {
    fallbackText?: string
  },
) => {
  const normalizedTargetAssistantId = String(targetAssistantId || '').trim()
  const fallbackText = String(options?.fallbackText || '').trim()
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const message = messages.value[index]
    if (message.role !== NocodeEditorAiMessageRole.ASSISTANT) {
      continue
    }
    if (normalizedTargetAssistantId && message.id !== normalizedTargetAssistantId) {
      continue
    }

    if (String(message.content || '').trim() === getThinkingText()) {
      message.content = ''
    }

    const blocks = getAllArtifactBlocks(message)
    if (blocks.length) {
      const settledBlocks = blocks.filter(block => block.status !== 'loading')
      setMessageArtifactBlocks(message, settledBlocks)
    }

    const stillRenderable = Boolean(
      getMessageContinuityHints(message).length
      || hasRenderableAssistantMarkdown(message)
      || getRenderableFormulaActionSummaries(message).length > 0
      || hasRenderableMessageExtra(message)
    )

    if (!stillRenderable) {
      if (fallbackText) {
        message.content = fallbackText
        return
      }
      messages.value.splice(index, 1)
    }
    return
  }
}

const refreshStagedState = async () => {
  isRefreshingBlueprint.value = true
  try {
    const [formPlan, appPlan, flowScheme, flowPlan, blueprint] = await Promise.all([
      props.runtime.getStagedFormPlan(),
      props.runtime.getStagedAppPlan(),
      props.runtime.getStagedFlowScheme(),
      props.runtime.getStagedFlowPlan(),
      props.runtime.getStagedAppBlueprint(),
    ])
    stagedFormPlan.value = formPlan
    stagedAppPlan.value = appPlan
    stagedFlowScheme.value = flowScheme
    stagedFlowPlan.value = flowPlan
    stagedBlueprint.value = blueprint
    syncMessagesWithStagedState()
    emitStagedStateChange()
  } catch (error) {
    console.error('Failed to refresh staged planning state:', error)
  } finally {
    isRefreshingBlueprint.value = false
  }
}

const restoreStagedStateFromMessages = async (messageList: NocodeEditorAiMessage[]) => {
  replayCompletedArtifactConfirmationsFromMessages(messageList)

  let latestExplicitPlanningBlock: NocodeEditorAiArtifactBlock | null = null
  let latestExplicitPlanningBlockIndex = -1
  let latestPlanningBlock: NocodeEditorAiArtifactBlock | null = null
  let latestPlanningBlockIndex = -1
  let latestFlowBlock: NocodeEditorAiArtifactBlock | null = null
  const latestFlowSchemeBlocks: NocodeEditorAiArtifactBlock[] = []
  let latestBlueprintBlock: NocodeEditorAiArtifactBlock | null = null
  let latestBlueprintBlockIndex = -1

  for (let index = messageList.length - 1; index >= 0; index -= 1) {
    const message = messageList[index]
    const explicitBlocks = getExplicitArtifactBlocks(message)
    if (!latestExplicitPlanningBlock) {
      latestExplicitPlanningBlock = explicitBlocks.find(block => (
        (block.kind === 'app-plan' || block.kind === 'form-plan')
        && block.status === 'ready'
        && (block.outline || block.appPlan)
      )) || null
      if (latestExplicitPlanningBlock) {
        latestExplicitPlanningBlockIndex = index
      }
    }

    const blocks = getAllArtifactBlocks(message)
    for (const block of blocks) {
      if (
        block.kind === 'flow-scheme'
        && block.status === 'ready'
        && normalizeNocodeEditorFlowScheme(block.scheme)
      ) {
        latestFlowSchemeBlocks.push(block)
      }
      if (!latestFlowBlock && block.kind === 'flow-plan' && block.status === 'ready' && block.flowPlan) {
        latestFlowBlock = block
      }
      if (!latestBlueprintBlock && block.kind === 'blueprint' && block.status === 'ready' && block.blueprint) {
        latestBlueprintBlock = block
        latestBlueprintBlockIndex = index
      }
      if (
        !latestPlanningBlock
        && (block.kind === 'app-plan' || block.kind === 'form-plan')
        && block.status === 'ready'
        && (block.outline || block.appPlan)
      ) {
        latestPlanningBlock = block
        latestPlanningBlockIndex = index
      }
    }
  }

  const planningAnchorCandidate = pickPreferredPlanningRestoreCandidate({
    explicit: latestExplicitPlanningBlock
      ? {
        block: latestExplicitPlanningBlock,
        index: latestExplicitPlanningBlockIndex,
      }
      : null,
    merged: latestPlanningBlock
      ? {
        block: latestPlanningBlock,
        index: latestPlanningBlockIndex,
      }
      : null,
  })
  const planningAnchorBlock = planningAnchorCandidate?.block as NocodeEditorAiArtifactBlock | null
  const planningAnchorIndex = planningAnchorCandidate?.index ?? -1
  const planningAnchorContextKey = resolvePlanningRestoreAnchorContextKey({
    blockPlanningContextKey: String(planningAnchorBlock?.confirmation?.planningContextKey || '').trim(),
    fallbackPlanningContextKey: buildPlanningArtifactContextKey(planningAnchorBlock),
  })
  const planningAnchorTraceId = planningAnchorIndex >= 0
    ? normalizeTraceId(messageList[planningAnchorIndex]?.traceId || messageList[planningAnchorIndex]?.metadata?.traceId)
    : ''
  let latestCompletedPlanningConfirmation: NocodeEditorAiConfirmPayload | null = null

  if (planningAnchorBlock && planningAnchorIndex >= 0) {
    for (const message of messageList.slice(planningAnchorIndex)) {
      const blocks = getAllArtifactBlocks(message)
      for (const block of blocks) {
        const confirmation = resolveCompletedPlanningConfirmationFromBlock(block)
        if (!confirmation) {
          continue
        }
        if (isSamePlanningConfirmationContext(confirmation.planningContextKey, planningAnchorContextKey)) {
          latestCompletedPlanningConfirmation = confirmation
        } else if (canFallbackToTraceScopedPlanningConfirmation({
          candidateContextKey: confirmation.planningContextKey,
          preferredTraceId: planningAnchorTraceId,
          candidateTraceId: normalizeTraceId(message.traceId || message.metadata?.traceId),
        })) {
          latestCompletedPlanningConfirmation = {
            ...confirmation,
            planningContextKey: planningAnchorContextKey || confirmation.planningContextKey,
          }
        }
      }
    }
  }

  if (!latestCompletedPlanningConfirmation && planningAnchorBlock && planningAnchorIndex >= 0) {
    const planningConfirmation = resolveAiArtifactConfirmation(planningAnchorBlock)
    if (planningConfirmation?.questions?.length) {
      for (const message of messageList.slice(planningAnchorIndex + 1)) {
        if (message.role !== NocodeEditorAiMessageRole.USER) {
          continue
        }

        const derivedConfirmation = deriveCompletedConfirmationFromReplyMessage(
          planningConfirmation,
          message.content,
        )
        if (derivedConfirmation) {
          latestCompletedPlanningConfirmation = {
            ...derivedConfirmation,
            planningContextKey: planningAnchorContextKey || derivedConfirmation.planningContextKey,
          }
          break
        }

        const defaultCompletedConfirmation = deriveDefaultCompletedConfirmationFromReplyMessage(
          planningConfirmation,
          message.content,
        )
        if (defaultCompletedConfirmation) {
          latestCompletedPlanningConfirmation = {
            ...defaultCompletedConfirmation,
            planningContextKey: planningAnchorContextKey || defaultCompletedConfirmation.planningContextKey,
          }
          break
        }
      }
    }
  }

  if (planningAnchorBlock && latestCompletedPlanningConfirmation) {
    applyOptimisticConfirmationToMatchingBlocks(
      planningAnchorBlock,
      latestCompletedPlanningConfirmation,
      buildConfirmationDraftKey(planningAnchorBlock),
    )
  }

  if (planningAnchorBlock) {
    const nextOutlineSource = planningAnchorBlock.kind === 'app-plan'
      ? (planningAnchorBlock.appPlan?.outline || planningAnchorBlock.outline)
      : planningAnchorBlock.outline
    const nextOutline = nextOutlineSource
      ? cloneBlueprintValue(nextOutlineSource) as NocodeEditorAiSolutionOutlineWithConfirmation
      : null
    if (nextOutline && latestCompletedPlanningConfirmation) {
      nextOutline.confirmation = cloneBlueprintValue({
        ...latestCompletedPlanningConfirmation,
        planningContextKey: latestCompletedPlanningConfirmation.planningContextKey || planningAnchorContextKey,
      })
    }
    if (planningAnchorBlock.kind === 'app-plan') {
      await props.runtime.restoreStagedAppPlan({
        revision: Number(planningAnchorBlock.revision || 0),
        stagedAt: planningAnchorBlock.stagedAt,
        plan: planningAnchorBlock.appPlan
          ? {
            ...cloneBlueprintValue(planningAnchorBlock.appPlan),
            outline: nextOutline,
          }
          : null,
      })
    } else if (planningAnchorBlock.kind === 'form-plan') {
      await props.runtime.restoreStagedFormPlan({
        revision: Number(planningAnchorBlock.revision || 0),
        stagedAt: planningAnchorBlock.stagedAt,
        outline: nextOutline,
        applicationStructurePreview: planningAnchorBlock.applicationStructurePreview || null,
      })
    }
  }

  const shouldRestoreLatestBlueprintBlock = Boolean(
    latestBlueprintBlock
    && !shouldPlanningSupersedeBlueprint({
      planningRevision: planningAnchorBlock?.revision,
      planningStagedAt: planningAnchorBlock?.stagedAt,
      planningMessageIndex: planningAnchorIndex,
      blueprintRevision: latestBlueprintBlock.revision,
      blueprintStagedAt: latestBlueprintBlock.stagedAt,
      blueprintMessageIndex: latestBlueprintBlockIndex,
    }),
  )

  if (shouldRestoreLatestBlueprintBlock && latestBlueprintBlock) {
    const latestBlueprintConfirmation = resolveAiArtifactConfirmation(latestBlueprintBlock)
    const restoredBlueprintBase = {
      planningScope: normalizeNocodeEditorPlanningScopeValue(latestBlueprintBlock.planningScope),
      revision: Number(latestBlueprintBlock.revision || 0),
      stagedAt: latestBlueprintBlock.stagedAt,
      blueprint: latestBlueprintBlock.blueprint
        ? {
          ...cloneBlueprintValue(latestBlueprintBlock.blueprint),
          ...(latestBlueprintConfirmation
            ? { confirmation: cloneBlueprintValue(latestBlueprintConfirmation) }
            : {}),
        }
        : null,
      sourcePlanningContextKey: String(
        latestBlueprintBlock.confirmation?.planningContextKey
        || (latestBlueprintBlock.blueprint as any)?.confirmation?.planningContextKey
        || '',
      ).trim() || null,
    }
    const restoredBlueprint = latestBlueprintBlock.phase === 'applied_draft'
      && latestBlueprintBlock.applyResult
      && latestBlueprintBlock.draftPersistenceState
      ? createAppliedDraftBlueprintState({
        ...restoredBlueprintBase,
        applyResult: latestBlueprintBlock.applyResult,
        draftPersistenceState: latestBlueprintBlock.draftPersistenceState,
      })
      : latestBlueprintBlock.phase === 'applied_saved' && latestBlueprintBlock.applyResult
        ? createAppliedSavedBlueprintState({
          ...restoredBlueprintBase,
          applyResult: latestBlueprintBlock.applyResult,
        })
        : createStagedBlueprintState(restoredBlueprintBase)
    await props.runtime.restoreStagedAppBlueprint(restoredBlueprint)
  } else {
    await props.runtime.restoreStagedAppBlueprint(null)
  }

  const latestFlowConfirmation = latestFlowBlock
    ? resolveAiArtifactConfirmation(latestFlowBlock)
    : null
  const latestFlowPlan = latestFlowBlock?.flowPlan
    ? normalizeNocodeEditorFlowPlan({
      ...cloneBlueprintValue(latestFlowBlock.flowPlan),
      ...(latestFlowConfirmation
        ? { confirmation: cloneBlueprintValue(latestFlowConfirmation) }
        : {}),
    })
    : null
  const latestFlowSchemeBlock = latestFlowSchemeBlocks.find((block) => {
    const flowSchemeConfirmation = resolveAiArtifactConfirmation(block)
    const flowScheme = normalizeNocodeEditorFlowScheme({
      ...cloneBlueprintValue(block.scheme),
      ...(flowSchemeConfirmation
        ? { confirmation: cloneBlueprintValue(flowSchemeConfirmation) }
        : {}),
    })
    if (!flowScheme) {
      return false
    }
    if (!latestFlowPlan) {
      return true
    }
    return isFlowPlanApplyContextReady({
      flowPlan: latestFlowPlan,
      flowPlanPlanningContextKey: latestFlowConfirmation?.planningContextKey,
      sourceSchemeRevision: latestFlowBlock?.sourceSchemeRevision,
      flowScheme,
      flowSchemePlanningContextKey: flowSchemeConfirmation?.planningContextKey,
      flowSchemeRevision: block.revision,
    })
  }) || null

  if (latestFlowSchemeBlock) {
    const latestFlowSchemeConfirmation = resolveAiArtifactConfirmation(latestFlowSchemeBlock)
    await props.runtime.restoreStagedFlowScheme({
      revision: Number(latestFlowSchemeBlock.revision || 0),
      stagedAt: latestFlowSchemeBlock.stagedAt,
      scheme: normalizeNocodeEditorFlowScheme({
        ...cloneBlueprintValue(latestFlowSchemeBlock.scheme),
        ...(latestFlowSchemeConfirmation
          ? { confirmation: cloneBlueprintValue(latestFlowSchemeConfirmation) }
          : {}),
      }),
      planningStatus: latestFlowSchemeBlock.planningStatus,
      flowUnifiedIssues: latestFlowSchemeBlock.flowUnifiedIssues || null,
      flowIssueRouting: latestFlowSchemeBlock.flowIssueRouting || null,
    })
  } else {
    await props.runtime.restoreStagedFlowScheme(null)
  }

  if (latestFlowBlock) {
    await props.runtime.restoreStagedFlowPlan({
      revision: Number(latestFlowBlock.revision || 0),
      stagedAt: latestFlowBlock.stagedAt,
      sourceSchemeRevision: Number(latestFlowBlock.sourceSchemeRevision || 0) || undefined,
      flowPlan: latestFlowPlan,
      applyResult: latestFlowBlock.flowApplyResult || null,
    })
  }

  await refreshStagedState()
}

const loadConversationMessages = async (
  explicitConversationId?: string,
  options?: {
    syncConversationId?: boolean
    mergeExisting?: boolean
    optimisticAssistantId?: string
    authoritativeAssistantMessageId?: string
  },
) => {
  const currentConversationId = normalizeConversationId(
    explicitConversationId
    || conversationId.value
    || boundConversationId.value,
  )
  if (options?.syncConversationId !== false) {
    conversationId.value = currentConversationId
  }

  if (!currentConversationId) {
    persistedConversationModelSelectionSource.value = null
    authoritativeTaskSummary.value = null
    if (!options?.mergeExisting) {
      messages.value = []
    }
    return false
  }

  try {
    const { data } = await axios.get<NocodeEditorAiConversationMessagesPayload>(`/ai/nocode-editor/conversations/${currentConversationId}/messages`, {
      params: {
        limit: 80,
        offset: 0,
        includeMeta: 1,
        includeTool: 1,
      },
    })
    const hasPersistedModelSelection = data?.modelSelectionSource === 'default'
      || data?.modelSelectionSource === 'explicit'
      || Boolean(data?.providerId || data?.modelId || data?.model)
    persistedConversationModelSelectionSource.value = hasPersistedModelSelection
      ? data?.modelSelectionSource === 'default' ? 'default' : 'explicit'
      : null
    applyModelSelectionState({
      providerId: data?.providerId,
      modelId: data?.modelId,
      model: data?.model,
      modelSelectionSource: data?.modelSelectionSource,
    })
    applyFirstExplicitModelSelection()
    authoritativeTaskSummary.value = normalizeAuthoritativeTaskSummary(data?.taskSummary)
    timelineMeta.value = data?.timeline || null
    const sortedMessages = sortNocodeEditorAiMessageHistory(data?.messages || [])
    const protectedSortedMessages = protectAuthoritativeAssistantBeforeHistoryNormalize(
      sortedMessages,
      options,
    )
    const rawMessages = normalizeNocodeEditorAiMessageHistory(protectedSortedMessages)
    if (!shouldResumeNocodeEditorAiConversation(rawMessages)) {
      if (!options?.mergeExisting) {
        authoritativeTaskSummary.value = null
        messages.value = []
      }
      return false
    }
    // 打开面板时补一次收敛：补齐过但还没落库的流程待补配置在这里补上记录
    rawMessages.forEach(syncFlowIssueListResolutionState)
    const nextMessages = rawMessages
      .filter(item => (
        (item.role === NocodeEditorAiMessageRole.USER || item.role === NocodeEditorAiMessageRole.ASSISTANT)
        && !isAiTimelineHiddenMessage(item.metadata || null)
      ))
      .map((item) => {
        const traceId = normalizeTraceId(item.traceId || item.metadata?.traceId)
        const metadata = item.metadata
          ? markRaw({
            ...item.metadata,
            traceId: traceId || undefined,
          })
          : (traceId ? { traceId } : null)

        return {
          id: item.id,
          role: item.role,
          content: item.role === NocodeEditorAiMessageRole.USER
            ? String(item.metadata?.userFacingContent || item.content || '')
            : item.content,
          sequence: normalizeMessageSequence(item.sequence),
          createTime: item.createTime,
          traceId: traceId || null,
          metadata,
        }
      })
    const mergedMessages = options?.mergeExisting
      ? reconcileDoneAssistantAuthoritativeMessages({
        current: messages.value,
        loaded: nextMessages,
        optimisticAssistantId: options.optimisticAssistantId,
        authoritativeAssistantMessageId: options.authoritativeAssistantMessageId,
      })
      : nextMessages
    messages.value = mergedMessages
    localPendingFlowIntent.value = findLatestPendingFlowIntentFromMessages(mergedMessages)
    activeExcelAnalysisContext.value = resolveLatestAiExcelAnalysisContext(
      mergedMessages.map(item => item.metadata || null),
    )
    await restoreStagedStateFromMessages(sortedMessages)
    await scrollToBottom()
    void maybeAutoStartBuilderHomeInitialPrompt(rawMessages, currentConversationId)
    return true
  } catch (error) {
    console.error('Load nocode editor AI messages failed:', error)
    return false
  }
}

const initializeConversation = async () => {
  isInitializingConversation.value = true
  try {
    taskSeed.value = null
    conversationId.value = ''
    authoritativeTaskSummary.value = null
    clearCurrentRespondingAssistantId()
    localPendingFlowIntent.value = null
    pendingBuilderHomeInitialPromptThreadId.value = ''
    await refreshCurrentScopeKey()
    const normalizedScopeKey = String(currentScopeKey.value || '').trim()

    const storedTask = getCurrentTaskStore()?.get()
    const { data: latestConversation } = await axios.get<NocodeEditorAiLatestConversationPayload | null>(
      `/ai/nocode-editor/apps/${props.nocodeId}/latest-conversation`,
    )
    const restoreCandidate = pickNocodeEditorAiTaskRestoreCandidate({
      currentScopeKey: normalizedScopeKey,
      storedTask,
      latestConversation,
    })
    if (restoreCandidate) {
      const candidateState = 'lastActiveTime' in restoreCandidate
        ? {
          ...restoreCandidate,
          createdAt: restoreCandidate.lastActiveTime,
        }
        : restoreCandidate
      const candidateConversationId = normalizeConversationId(candidateState.conversationId)

      if (candidateConversationId) {
        const loaded = await loadConversationMessages(candidateConversationId, {
          syncConversationId: false,
        })
        if (loaded) {
          if (applyTaskSeed(candidateState)) {
            await ensureConversationForPendingHandoff()
            void startPendingHandoffBootstrapIfNeeded()
            if (!hasPendingHandoffImportQuery()) {
              await flushPendingBuilderHomeInitialPromptIfNeeded(conversationId.value)
            }
            return
          }
          authoritativeTaskSummary.value = null
          messages.value = []
        }
      }
    }

    const currentLegacyConversationId = normalizeConversationId(legacyConversationId.value)
    if (currentLegacyConversationId) {
      const loaded = await loadConversationMessages(currentLegacyConversationId, {
        syncConversationId: false,
      })
      if (loaded) {
        conversationId.value = currentLegacyConversationId
        await ensureConversationForPendingHandoff()
        void startPendingHandoffBootstrapIfNeeded()
        if (!hasPendingHandoffImportQuery()) {
          await flushPendingBuilderHomeInitialPromptIfNeeded(currentLegacyConversationId)
        }
        return
      }
    }

    await refreshStagedState()
    await ensureConversationForPendingHandoff()
    void startPendingHandoffBootstrapIfNeeded()
    if (shouldRunBuilderHomeInitialPromptBootstrap()) {
      const currentTask = await ensureCurrentTaskSeed('builder-home')
      if (currentTask.conversationId) {
        await submitBuilderHomeInitialPrompt(currentTask.conversationId)
      }
    }
  } finally {
    isInitializingConversation.value = false
  }
}

const stop = () => {
  clearExplicitFlowAutoContinueTimer()
  clearCurrentRespondingAssistantId()
  currentController.value?.abort()
  currentController.value = null
  invalidatePendingSubmitPreparation()
  isResponding.value = false
  finalizeStoppedAssistantMessage()
}

const appendLocalConversationReply = async (options: {
  userFacingContent: string
  assistantReply: string
  userMetadata?: Record<string, unknown>
}) => {
  const traceId = createTurnTraceId()
  const userMetadata = options.userMetadata ? { ...options.userMetadata } : null
  const userMessage: NocodeEditorAiMessage = {
    id: createMessageId('user'),
    role: NocodeEditorAiMessageRole.USER,
    content: options.userFacingContent,
    sequence: 0,
    createTime: Date.now(),
    metadata: userMetadata,
  }
  syncMessageTraceId(userMessage, traceId)
  messages.value.push(userMessage)

  const assistantMetadata = {
    traceId,
    blocks: [],
  }
  const assistantMessage: NocodeEditorAiMessage = {
    id: createMessageId('assistant'),
    role: NocodeEditorAiMessageRole.ASSISTANT,
    content: options.assistantReply,
    sequence: 0,
    createTime: Date.now(),
    metadata: assistantMetadata,
  }
  syncMessageTraceId(assistantMessage, traceId)
  messages.value.push(assistantMessage)
  setComposerDraft('')
  composerAttachments.value = []
  chatInputRef.value?.updateTextareaHeight?.()
  await scrollToBottom()

  try {
    const seedSource = resolveNocodeEditorAiSubmitTaskSource({
      taskSeed: taskSeed.value,
      aiEntrySource: resolveAiEntrySource(),
    })
    await persistConversationMessage(
      NocodeEditorAiMessageRole.USER,
      options.userFacingContent,
      traceId,
      userMetadata,
      {
        seedSource,
      },
    )
    await persistConversationMessage(
      NocodeEditorAiMessageRole.ASSISTANT,
      options.assistantReply,
      traceId,
      assistantMetadata,
      {
        seedSource,
      },
    )
    const currentConversationId = normalizeConversationId(conversationId.value || boundConversationId.value)
    if (currentConversationId) {
      await loadConversationMessages(currentConversationId)
    }
  } catch (error) {
    console.error('Persist local nocode editor conversation reply failed:', error)
    ElMessage.warning(i18next.t('nocodeEditorAiPanel.attachmentGuideSyncFailed'))
  }
}

const appendLocalConversationUserMessageOnly = async (options: {
  userFacingContent: string
  userMetadata?: Record<string, unknown>
}) => {
  const traceId = createTurnTraceId()
  const userMetadata = options.userMetadata ? { ...options.userMetadata } : null
  const userMessage: NocodeEditorAiMessage = {
    id: createMessageId('user'),
    role: NocodeEditorAiMessageRole.USER,
    content: options.userFacingContent,
    sequence: 0,
    createTime: Date.now(),
    metadata: userMetadata,
  }
  syncMessageTraceId(userMessage, traceId)
  messages.value.push(userMessage)
  setComposerDraft('')
  composerAttachments.value = []
  chatInputRef.value?.updateTextareaHeight?.()
  await scrollToBottom()

  try {
    const seedSource = resolveNocodeEditorAiSubmitTaskSource({
      taskSeed: taskSeed.value,
      aiEntrySource: resolveAiEntrySource(),
    })
    await persistConversationMessage(
      NocodeEditorAiMessageRole.USER,
      options.userFacingContent,
      traceId,
      userMetadata,
      {
        seedSource,
      },
    )
    const currentConversationId = normalizeConversationId(conversationId.value || boundConversationId.value)
    if (currentConversationId) {
      await loadConversationMessages(currentConversationId)
    }
  } catch (error) {
    console.error('Persist local nocode editor conversation user message failed:', error)
    ElMessage.warning(i18next.t('nocodeEditorAiPanel.attachmentGuideSyncFailed'))
  }
}

const appendLocalAssistantNotice = async (
  assistantReply: string,
  extraMetadata?: Record<string, unknown>,
) => {
  const normalizedReply = String(assistantReply || '').trim()
  if (!normalizedReply) {
    return
  }

  const traceId = createTurnTraceId()
  const assistantMetadata = {
    traceId,
    blocks: [],
    ...(extraMetadata || {}),
  }
  const assistantMessage: NocodeEditorAiMessage = {
    id: createMessageId('assistant'),
    role: NocodeEditorAiMessageRole.ASSISTANT,
    content: normalizedReply,
    sequence: 0,
    createTime: Date.now(),
    metadata: assistantMetadata,
  }
  syncMessageTraceId(assistantMessage, traceId)
  messages.value.push(assistantMessage)
  await scrollToBottom()

  try {
    const seedSource = resolveNocodeEditorAiSubmitTaskSource({
      taskSeed: taskSeed.value,
      aiEntrySource: resolveAiEntrySource(),
    })
    await persistConversationMessage(
      NocodeEditorAiMessageRole.ASSISTANT,
      normalizedReply,
      traceId,
      assistantMetadata,
      {
        seedSource,
      },
    )
    const currentConversationId = normalizeConversationId(conversationId.value || boundConversationId.value)
    if (currentConversationId) {
      await loadConversationMessages(currentConversationId)
    }
  } catch (error) {
    console.error('Persist local nocode editor assistant notice failed:', error)
    ElMessage.warning(i18next.t('nocodeEditorAiPanel.createResultSyncFailed'))
  }
}

const buildExcelCreateCompletionAssistantReply = (payload: ExcelCreateCompletionPayload) => {
  const formName = String(payload.formName || '').trim()
  const importFieldCount = Math.max(0, Number(payload.importFieldCount || 0))
  const successCount = Math.max(0, Number(payload.successCount || 0))
  const totalCount = Math.max(0, Number(payload.totalCount || 0))
  const failedCount = Math.max(0, Number(payload.failedCount || 0))
  const formPrefix = formName ? i18next.t('nocodeEditorAiPanel.createdFormWithName', { formName }) : i18next.t('nocodeEditorAiPanel.createdForm')
  const fieldSegment = importFieldCount > 0 ? i18next.t('nocodeEditorAiPanel.importedFieldsSegment', { count: importFieldCount }) : ''

  if (totalCount <= 0) {
    return i18next.t('nocodeEditorAiPanel.excelImportedNoRows', { formPrefix, fieldSegment })
  }
  if (failedCount > 0) {
    return i18next.t('nocodeEditorAiPanel.excelImportedWithFailures', { formPrefix, fieldSegment, successCount, failedCount })
  }
  return i18next.t('nocodeEditorAiPanel.excelImportedSuccess', { formPrefix, fieldSegment, successCount })
}

const appendExcelCreateCompletionReply = async (payload: ExcelCreateCompletionPayload) => {
  await appendLocalAssistantNotice(buildExcelCreateCompletionAssistantReply(payload), buildAiExcelCreateCompletionMetadata(payload.attachmentId))
}

const resolveComposerAttachmentRouteDecision = (
  text: string,
  attachments: AiAttachment[],
): ComposerAttachmentRouteDecision | null => {
  const attachmentPayload = buildEditorAttachmentRequestMetadata(text, attachments)
  if (!attachmentPayload) {
    return null
  }

  const {
    attachmentIntent,
    attachmentReferences,
    requestMetadata,
    userFacingContent,
    providerPromptContent,
  } = attachmentPayload
  const onlyExcelLikeAttachments = attachmentReferences.every(item => item.kind === 'excel')

  if (attachmentIntent.route === 'create' && onlyExcelLikeAttachments && hasExcelLikeAttachment(attachmentReferences)) {
    const excelAttachment = resolveExcelCreateAttachmentPayload(attachments)
    if (!excelAttachment) {
      return {
        mode: 'local-reply',
        userFacingContent,
        userMetadata: requestMetadata,
        assistantReply: i18next.t('nocodeEditorAiPanel.noUniqueExcelFileReply'),
      }
    }
    return {
      mode: 'start-excel-create',
      userFacingContent,
      userMetadata: requestMetadata,
      excelAttachment,
      assistantReply: i18next.t('nocodeEditorAiPanel.startExcelCreateReply'),
    }
  }

  if (attachmentIntent.route === 'analyze' && onlyExcelLikeAttachments && hasExcelLikeAttachment(attachmentReferences)) {
    return {
      mode: 'start-excel-analysis',
      userFacingContent,
      userMetadata: requestMetadata,
      excelAttachment: resolveExcelCreateAttachmentPayload(attachments),
    }
  }

  if (attachmentIntent.route === 'clarify' && onlyExcelLikeAttachments) {
    return {
      mode: 'local-reply',
      userFacingContent,
      userMetadata: requestMetadata,
      assistantReply: i18next.t('nocodeEditorAiPanel.excelAttachmentRouteReply'),
    }
  }

  return {
    mode: 'submit',
    requestContent: providerPromptContent,
    visibleUserContent: userFacingContent,
    visibleUserMetadata: requestMetadata,
    requestMetadata,
  }
}

const resetConversationView = (options?: { clearStoredConversation?: boolean }) => {
  stop()
  modelSelectionChangeToken += 1
  modelSelectionSaveRequest = null
  persistedConversationModelSelectionSource.value = null
  if (options?.clearStoredConversation === true) {
    conversationId.value = ''
    getCurrentTaskStore()?.remove()
  }
  authoritativeTaskSummary.value = null
  messages.value = []
  setComposerDraft('')
  composerAttachments.value = []
  editingUserMessageId.value = ''
  editingUserMessageDraft.value = ''
  editingUserMessageAttachments.value = []
  closePreviewArtifact()
  chatInputRef.value?.updateTextareaHeight?.()
}

const focusTextarea = async (force = false) => {
  if (!force && !props.autofocus) {
    return
  }
  await nextTick()
  await chatInputRef.value?.focusTextarea?.()
}

const handleComposerAttachmentSelect = (payload: AiAttachmentSelectionEventPayload) => {
  const attachments = normalizeComposerAttachments(payload?.attachments)
  if (attachments.length) {
    composerAttachments.value = replaceCurrentExcelAttachment(attachments, resolveLatestExcelAttachment(attachments))
    return
  }

  const attachment = normalizeComposerAttachment(payload?.attachment)
  if (!attachment) {
    return
  }
  const nextAttachments = composerAttachments.value.filter(item => item.id !== attachment.id)
  nextAttachments.push(attachment)
  composerAttachments.value = replaceCurrentExcelAttachment(
    nextAttachments,
    attachment.kind === 'excel' ? attachment : resolveLatestExcelAttachment(nextAttachments),
  )
}

const handleComposerAttachmentRemove = (payload: AiAttachmentSelectionEventPayload) => {
  const attachments = normalizeComposerAttachments(payload?.attachments)
  if (attachments.length || Array.isArray(payload?.attachments)) {
    composerAttachments.value = attachments
    return
  }

  const attachmentId = String(payload?.attachment?.id || '').trim()
  if (!attachmentId) {
    return
  }
  composerAttachments.value = composerAttachments.value.filter(item => item.id !== attachmentId)
}

const startNewConversation = async () => {
  const nextModelSelection = effectiveModelOption.value
  resetConversationView({ clearStoredConversation: true })
  if (nextModelSelection) {
    applyModelSelectionState(nextModelSelection)
  }
  await refreshCurrentScopeKey()
  taskSeed.value = createNextNocodeEditorTaskSeed(Date.now())
  conversationId.value = ''
  persistCurrentTaskSeed()
  await refreshStagedState()
  await focusTextarea()
}

const handleConversationCommand = (command: string) => {
  if (command === 'export') return void exportConversation()
  if (command === 'import') return void conversationImportInputRef.value?.click()
  if (command === 'clear') return void clearConversation()
}

const exportConversation = async () => {
  const currentId = normalizeConversationId(conversationId.value)
  if (!currentId) {
    ElMessage.warning(i18next.t('nocodeEditorAiPanel.noConversationToExport'))
    return
  }
  try {
    const { data } = await axios.get(`/ai/nocode-editor/conversations/${encodeURIComponent(currentId)}/export`, {
      params: { nocodeId: props.nocodeId },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `nocode-editor-ai-conversation-${currentId}.zip`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : i18next.t('nocodeEditorAiPanel.conversationExportFailed'))
  }
}

const handleConversationImportFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  isImportingConversation.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('nocodeId', props.nocodeId)
    const { data } = await axios.post('/ai/nocode-editor/conversations/import', formData)
    resetConversationView({ clearStoredConversation: true })
    await refreshCurrentScopeKey()
    const importedState = {
      ...data,
      scopeKey: data.scopeKey || currentScopeKey.value,
    }
    if (!applyTaskSeed(importedState)) throw new Error(i18next.t('nocodeEditorAiPanel.conversationImportFailed'))
    emit('applied-blueprints-imported')
    await loadConversationMessages(data.conversationId)
    ElMessage.success(i18next.t('nocodeEditorAiPanel.conversationImported'))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : i18next.t('nocodeEditorAiPanel.conversationImportFailed'))
  } finally {
    isImportingConversation.value = false
  }
}

const clearConversation = async () => {
  const currentId = normalizeConversationId(conversationId.value)
  if (!currentId) return
  try {
    await ElMessageBox.confirm(
      i18next.t('nocodeEditorAiPanel.clearConversationConfirm'),
      i18next.t('nocodeEditorAiPanel.clearConversation'),
      { type: 'warning' },
    )
    const pendingModelSelectionSave = modelSelectionSaveRequest
    if (pendingModelSelectionSave) {
      await pendingModelSelectionSave
    }
    await axios.delete(`/ai/nocode-editor/conversations/${encodeURIComponent(currentId)}`, {
      params: { nocodeId: props.nocodeId },
    })
    resetConversationView({ clearStoredConversation: true })
    taskSeed.value = null
    await refreshStagedState()
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : i18next.t('nocodeEditorAiPanel.clearConversationFailed'))
  }
}

const hasVisibleAssistantReplyAfterBuilderHomeEntry = (messageList: NocodeEditorAiThreadMessage[]) => {
  return messageList.some(message => (
    message.role === NocodeEditorAiMessageRole.ASSISTANT
    && !isAiTimelineHiddenMessage(message.metadata || null)
  ))
}

const hasVisibleUserMessageAfterBuilderHomeEntry = (messageList: NocodeEditorAiThreadMessage[]) => {
  return messageList.some(message => (
    message.role === NocodeEditorAiMessageRole.USER
    && !isAiTimelineHiddenMessage(message.metadata || null)
  ))
}

const resolvePendingHandoffId = () => String(route.query.handoffId || '').trim()
const resolvePendingHandoffSourceThreadId = () => String(route.query.handoffSourceThreadId || '').trim()
const clearPendingHandoffRouteQuery = async () => {
  const nextQuery = {
    ...route.query,
  }
  delete nextQuery.handoffId
  delete nextQuery.handoffSourceThreadId
  if (String(nextQuery.aiEntry || '').trim() === 'builder-home') {
    delete nextQuery.aiEntry
  }
  try {
    await router.replace({
      path: route.path,
      query: nextQuery,
    })
  } catch (error) {
    console.error('Clear imported handoff route query failed:', error)
  }
}
const hasPendingHandoffImportQuery = () => Boolean(
  resolvePendingHandoffId()
  && resolvePendingHandoffSourceThreadId()
)

const ensureConversationForPendingHandoff = async (options?: {
  forceNewConversation?: boolean
}) => {
  const handoffId = resolvePendingHandoffId()
  const handoffSourceThreadId = resolvePendingHandoffSourceThreadId()
  if (!handoffId || !handoffSourceThreadId) {
    return false
  }

  if (shouldStartNewNocodeEditorConversationForImportedHandoff({
    currentConversationId: conversationId.value,
    currentNocodeId: props.nocodeId,
    targetNocodeId: props.nocodeId,
    forceNewConversation: options?.forceNewConversation,
  })) {
    await ensureCurrentTaskSeed(resolveAiEntrySource() === 'builder-home' ? 'builder-home' : 'resume')
    return true
  }

  return true
}

const shouldRunBuilderHomeInitialPromptBootstrap = () => (
  resolveAiEntrySource() === 'builder-home'
  && !hasPendingHandoffImportQuery()
)

const startPendingHandoffBootstrapIfNeeded = async () => {
  if (!hasPendingHandoffImportQuery()) {
    return
  }

  handoffBootstrapPhase.value = 'importing'
  try {
    const handoffImportState = await submitPendingHandoffMessageIfNeeded()
    if (handoffImportState === 'imported') {
      if (handoffBootstrapPhase.value === 'importing') {
        handoffBootstrapPhase.value = 'idle'
      }
      return
    }
    if (handoffImportState === 'failed') {
      handoffBootstrapPhase.value = 'failed'
    } else if (handoffBootstrapPhase.value === 'importing') {
      handoffBootstrapPhase.value = 'idle'
    }
  } catch (error) {
    console.error('Pending app builder handoff bootstrap failed:', error)
    handoffBootstrapPhase.value = 'failed'
  }
}

type PendingHandoffImportSubmitState = ImportedHandoffImportState | 'failed'
type PendingHandoffImportSnapshot = {
  conversationId: string
  taskId?: string
  scopeKey: string
  nocodeId: string
}

const importingHandoffIds = new Set<string>()
const pendingHandoffImportPromises = new Map<string, Promise<PendingHandoffImportSubmitState>>()
const retryingInProgressHandoffIds = new Set<string>()

const resolveHandoffImportState = (handoffId: string): ImportedHandoffImportState => {
  const importState = resolveImportedHandoffImportState({
    handoffId,
    importingHandoffIds,
    messages: messages.value,
  })
  if (importState !== 'none') {
    return importState
  }
  return pendingHandoffImportPromises.has(handoffId) ? 'in_progress' : 'none'
}

const hasSamePendingHandoffImportQuery = (input: {
  handoffId: string
  handoffSourceThreadId: string
}) => (
  resolvePendingHandoffId() === input.handoffId
  && resolvePendingHandoffSourceThreadId() === input.handoffSourceThreadId
)

const buildPendingHandoffImportSnapshot = (): PendingHandoffImportSnapshot | null => {
  const currentConversationId = normalizeConversationId(conversationId.value)
  if (!currentConversationId) {
    return null
  }

  return {
    conversationId: currentConversationId,
    taskId: taskSeed.value?.taskId,
    scopeKey: currentScopeKey.value,
    nocodeId: props.nocodeId,
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const mergeEditorTurnMetadata = (
  ...records: Array<Record<string, unknown> | null | undefined>
) => {
  const merged = records.reduce<Record<string, unknown>>((result, record) => {
    if (!isRecord(record)) {
      return result
    }
    return {
      ...result,
      ...record,
    }
  }, {})
  return Object.keys(merged).length ? merged : undefined
}

const resolveEditorTurnVisibleUserContent = (fallbackContent: string, overrideContent?: string) => (
  String(overrideContent !== undefined ? overrideContent : fallbackContent).trim()
)

const submitEditorTurnFromTextAndAttachments = async (input: {
  text: string
  attachments?: AiAttachment[]
  modelSelection?: AiThreadModelSelection | null
  silentFailure?: boolean
  visibleUserContentOverride?: string
  visibleUserMetadataOverride?: Record<string, unknown>
  requestMetadataOverride?: Record<string, unknown>
  importedHandoffContext?: NocodeEditorAiImportedHandoffContext
  editedFromMessageId?: string
  onUserMessageAccepted?: () => void
}): Promise<SubmitEditorTurnFromTextAndAttachmentsResult> => {
  const text = String(input.text || '').trim()
  const attachments = normalizeComposerAttachments(input.attachments)
  if (!text && !attachments.length) {
    return {
      result: 'not_started',
      mode: 'none',
    }
  }

  const routeDecision = resolveComposerAttachmentRouteDecision(text, attachments)
  const editMetadata = input.editedFromMessageId
    ? { editedFromMessageId: input.editedFromMessageId }
    : undefined
  if (editMetadata && routeDecision?.mode && routeDecision.mode !== 'submit') {
    await rewindEditedMessageTail(editMetadata.editedFromMessageId)
  }
  if (routeDecision?.mode === 'start-excel-create') {
    await appendLocalConversationReply({
      userFacingContent: resolveEditorTurnVisibleUserContent(
        routeDecision.userFacingContent,
        input.visibleUserContentOverride,
      ),
      assistantReply: routeDecision.assistantReply,
      userMetadata: mergeEditorTurnMetadata(
        routeDecision.userMetadata,
        input.requestMetadataOverride,
        editMetadata,
        input.visibleUserMetadataOverride,
      ),
    })
    emit('start-excel-form-create', routeDecision.excelAttachment)
    return {
      result: 'completed',
      mode: routeDecision.mode,
    }
  }

  if (routeDecision?.mode === 'start-excel-analysis') {
    if (input.importedHandoffContext) {
      await appendLocalConversationUserMessageOnly({
        userFacingContent: resolveEditorTurnVisibleUserContent(
          routeDecision.userFacingContent,
          input.visibleUserContentOverride,
        ),
        userMetadata: mergeEditorTurnMetadata(
          routeDecision.userMetadata,
          input.requestMetadataOverride,
          editMetadata,
          input.visibleUserMetadataOverride,
        ),
      })
      emit('start-excel-file-analysis', {
        ...buildExcelAnalysisStartPayload(routeDecision),
        visibleUserContent: resolveEditorTurnVisibleUserContent(
          routeDecision.userFacingContent,
          input.visibleUserContentOverride,
        ),
        requestMetadata: mergeEditorTurnMetadata(
          routeDecision.userMetadata,
          input.requestMetadataOverride,
          editMetadata,
        ),
      })
      return {
        result: 'completed',
        mode: routeDecision.mode,
      }
    }

    emit('start-excel-file-analysis', {
      ...buildExcelAnalysisStartPayload(routeDecision),
      visibleUserContent: resolveEditorTurnVisibleUserContent(
        routeDecision.userFacingContent,
        input.visibleUserContentOverride,
      ),
      requestMetadata: mergeEditorTurnMetadata(
        routeDecision.userMetadata,
        input.requestMetadataOverride,
        editMetadata,
      ),
    })
    return {
      result: 'completed',
      mode: routeDecision.mode,
    }
  }

  if (routeDecision?.mode === 'local-reply') {
    await appendLocalConversationReply({
      userFacingContent: resolveEditorTurnVisibleUserContent(
        routeDecision.userFacingContent,
        input.visibleUserContentOverride,
      ),
      assistantReply: routeDecision.assistantReply,
      userMetadata: mergeEditorTurnMetadata(
        routeDecision.userMetadata,
        input.requestMetadataOverride,
        editMetadata,
        input.visibleUserMetadataOverride,
      ),
    })
    return {
      result: 'completed',
      mode: routeDecision.mode,
    }
  }

  if (routeDecision?.mode === 'submit') {
    return {
      result: await submitMessage(routeDecision.requestContent, {
        attachments,
        modelSelection: input.modelSelection,
        silentFailure: input.silentFailure,
        visibleUserContent: resolveEditorTurnVisibleUserContent(
          routeDecision.visibleUserContent,
          input.visibleUserContentOverride,
        ),
        visibleUserMetadata: mergeEditorTurnMetadata(
          routeDecision.visibleUserMetadata,
          input.visibleUserMetadataOverride,
        ),
        requestMetadata: mergeEditorTurnMetadata(
          routeDecision.requestMetadata,
          input.requestMetadataOverride,
        ),
        importedHandoffContext: input.importedHandoffContext,
        editedFromMessageId: input.editedFromMessageId,
        onUserMessageAccepted: input.onUserMessageAccepted,
      }),
      mode: routeDecision.mode,
    }
  }

  return {
    result: await submitMessage(text, {
      modelSelection: input.modelSelection,
      silentFailure: input.silentFailure,
      visibleUserContent: resolveEditorTurnVisibleUserContent(
        text,
        input.visibleUserContentOverride,
      ),
      visibleUserMetadata: mergeEditorTurnMetadata(input.visibleUserMetadataOverride),
      requestMetadata: mergeEditorTurnMetadata(input.requestMetadataOverride),
      importedHandoffContext: input.importedHandoffContext,
      editedFromMessageId: input.editedFromMessageId,
      onUserMessageAccepted: input.onUserMessageAccepted,
    }),
    mode: 'direct-submit',
  }
}

const submitBuilderHomeInitialPrompt = async (threadId: string) => {
  const normalizedThreadId = normalizeConversationId(threadId)
  if (!normalizedThreadId || builderHomeInitialPromptThreadIds.has(normalizedThreadId)) {
    return
  }
  if (!builderHomeInitialPrompt.value) {
    builderHomeInitialPrompt.value = peekBuilderHomeInitialPrompt()
  }
  if (!builderHomeInitialAttachments.value.length) {
    builderHomeInitialAttachments.value = peekBuilderHomeInitialAttachments()
  }
  if (!builderHomeInitialModelSelection.value) {
    builderHomeInitialModelSelection.value = peekNocodeEditorBuilderModelSelection(props.nocodeId)
    applyModelSelectionState(builderHomeInitialModelSelection.value)
  }
  const prompt = String(builderHomeInitialPrompt.value || '').trim()
  const attachments = normalizeComposerAttachments(builderHomeInitialAttachments.value)
  if (!prompt && !attachments.length) {
    pendingBuilderHomeInitialPromptThreadId.value = ''
    return
  }
  if (isPreparingSubmit.value || isResponding.value) {
    pendingBuilderHomeInitialPromptThreadId.value = normalizedThreadId
    return
  }

  pendingBuilderHomeInitialPromptThreadId.value = ''
  const { result } = await submitEditorTurnFromTextAndAttachments({
    text: prompt,
    attachments,
    modelSelection: builderHomeInitialModelSelection.value,
    silentFailure: true,
  })
  if (result === 'completed') {
    await clearBuilderHomeEntryState()
    builderHomeInitialPromptThreadIds.add(normalizedThreadId)
    return
  }
  if (result === 'failed' && attachments.length) {
    setComposerDraft(prompt)
    composerAttachments.value = attachments
    await clearBuilderHomeEntryState()
    await nextTick()
    chatInputRef.value?.updateTextareaHeight?.()
    return
  }
  if (result === 'not_started' || result === 'aborted' || result === 'failed') {
    pendingBuilderHomeInitialPromptThreadId.value = normalizedThreadId
  }
}

const getBuilderHomeInitialPromptStorageKey = () => {
  const nocodeId = String(props.nocodeId || '').trim()
  return nocodeId ? `${BUILDER_HOME_INITIAL_PROMPT_STORAGE_PREFIX}:${nocodeId}` : ''
}

const getBuilderHomeInitialAttachmentsStorageKey = () => {
  const nocodeId = String(props.nocodeId || '').trim()
  return nocodeId ? `${BUILDER_HOME_INITIAL_ATTACHMENTS_STORAGE_PREFIX}:${nocodeId}` : ''
}

const peekBuilderHomeInitialPrompt = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return ''
  }

  const storageKey = getBuilderHomeInitialPromptStorageKey()
  if (!storageKey) {
    return ''
  }

  try {
    return String(window.sessionStorage.getItem(storageKey) || '').trim()
  } catch (error) {
    console.error('Read builder home initial prompt failed:', error)
    return ''
  }
}

const peekBuilderHomeInitialAttachments = () => {
  return normalizeComposerAttachments(
    takeNocodeEditorBuilderAttachments(props.nocodeId),
  )
}

const clearBuilderHomeInitialPrompt = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return
  }

  const storageKey = getBuilderHomeInitialPromptStorageKey()
  if (!storageKey) {
    return
  }

  try {
    window.sessionStorage.removeItem(storageKey)
  } catch (error) {
    console.error('Clear builder home initial prompt failed:', error)
  }
}

const clearBuilderHomeInitialAttachments = () => {
  clearNocodeEditorBuilderAttachments(props.nocodeId)
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return
  }

  const storageKey = getBuilderHomeInitialAttachmentsStorageKey()
  if (!storageKey) {
    return
  }

  try {
    window.sessionStorage.removeItem(storageKey)
  } catch (error) {
    console.error('Clear builder home initial attachments failed:', error)
  }
}

const hasPendingBuilderHomeInitialPrompt = () => {
  if (!builderHomeInitialPrompt.value) {
    builderHomeInitialPrompt.value = peekBuilderHomeInitialPrompt()
  }
  if (!builderHomeInitialAttachments.value.length) {
    builderHomeInitialAttachments.value = peekBuilderHomeInitialAttachments()
  }
  return Boolean(
    String(builderHomeInitialPrompt.value || '').trim()
    || builderHomeInitialAttachments.value.length,
  )
}

const clearBuilderHomeEntryModelSelection = () => {
  builderHomeInitialModelSelection.value = null
  clearNocodeEditorBuilderModelSelection(props.nocodeId)
}

const clearBuilderHomeEntryState = async () => {
  clearBuilderHomeInitialPrompt()
  clearBuilderHomeInitialAttachments()
  builderHomeInitialPrompt.value = ''
  builderHomeInitialAttachments.value = []
  clearBuilderHomeEntryModelSelection()
  pendingBuilderHomeInitialPromptThreadId.value = ''
  await clearAiEntrySourceQueryIfNeeded()
}

const normalizeBuilderHomeSuggestedAppName = (value: unknown) => {
  const trimEdgeMarkers = (input: string, markers: string[]) => {
    let current = input
    while (markers.some(marker => current.startsWith(marker))) {
      const matchedMarker = markers.find(marker => current.startsWith(marker))
      current = matchedMarker ? current.slice(matchedMarker.length).trimStart() : current
    }
    while (markers.some(marker => current.endsWith(marker))) {
      const matchedMarker = markers.find(marker => current.endsWith(marker))
      current = matchedMarker ? current.slice(0, current.length - matchedMarker.length).trimEnd() : current
    }
    return current
  }

  const normalized = trimEdgeMarkers(String(value || ''), ['「', '『', '“', '"', "'", '`', '【', '[', '」', '』', '”', '】', ']'])
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(?:应用规划|应用分析|需求分析|规划方案)[：:\s-]*/, '')
    .replace(/[：:\s-]*(?:应用规划|整体规划|需求分析|蓝图|方案草案)$/, '')
    .trim()

  if (!normalized || normalized === '应用结构预览' || normalized === '应用规划') {
    return ''
  }

  return normalized.slice(0, 30)
}

const resolveLatestBuilderHomeSuggestedAppName = () => {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const message = messages.value[index]
    if (message.role !== NocodeEditorAiMessageRole.ASSISTANT) {
      continue
    }

    const metadata = ensureMessageMetadata(message)
    const rawOutline = metadata.appBuilderPlanningOutline
    const outline = normalizeNocodeEditorPlanningOutline(rawOutline)
    const artifactBlocks = normalizeEditorArtifactBlocks(metadata.blocks)

    const candidates = [
      rawOutline && typeof rawOutline === 'object' && !Array.isArray(rawOutline)
        ? String((rawOutline as Record<string, unknown>).title || '').trim()
        : '',
      String(outline?.title || '').trim(),
      ...artifactBlocks
        .filter(block => String(block.kind || '').trim() === 'app-plan')
        .map((block) => (
          String(
            block.outline?.title
            || block.app?.name
            || '',
          ).trim()
        )),
    ]

    for (const candidate of candidates) {
      const normalizedCandidate = normalizeBuilderHomeSuggestedAppName(candidate)
      if (normalizedCandidate) {
        return normalizedCandidate
      }
    }
  }

  return ''
}

const renameAppFromBuilderHomePlanningIfNeeded = async () => {
  const nextAppName = resolveLatestBuilderHomeSuggestedAppName()
  const currentAppName = String(props.appName || '').trim()
  if (!nextAppName || nextAppName === currentAppName) {
    return false
  }

  try {
    await axios.get('/project/rename-nocode', {
      params: {
        id: props.nocodeId,
        name: nextAppName,
      },
    })
    emit('app-renamed', nextAppName)
    return true
  } catch (error) {
    console.error('Rename app from builder home planning failed:', error)
    return false
  }
}

const flushPendingBuilderHomeInitialPromptIfNeeded = async (threadId?: string) => {
  const normalizedThreadId = normalizeConversationId(
    threadId
    || conversationId.value
    || boundConversationId.value,
  )
  if (!normalizedThreadId || pendingBuilderHomeInitialPromptThreadId.value !== normalizedThreadId) {
    return
  }

  await submitBuilderHomeInitialPrompt(normalizedThreadId)
}

const maybeAutoStartBuilderHomeInitialPrompt = async (
  rawMessages: NocodeEditorAiThreadMessage[],
  explicitThreadId?: string,
) => {
  const threadId = normalizeConversationId(
    explicitThreadId
    || conversationId.value
    || boundConversationId.value,
  )
  if (!threadId) {
    return
  }
  if (!shouldRunBuilderHomeInitialPromptBootstrap()) {
    return
  }
  if (!hasPendingBuilderHomeInitialPrompt()) {
    pendingBuilderHomeInitialPromptThreadId.value = ''
    return
  }
  if (builderHomeInitialPromptThreadIds.has(threadId)) {
    return
  }
  if (hasVisibleAssistantReplyAfterBuilderHomeEntry(rawMessages)) {
    await clearBuilderHomeEntryState()
    builderHomeInitialPromptThreadIds.add(threadId)
    return
  }
  if (hasVisibleUserMessageAfterBuilderHomeEntry(rawMessages)) {
    await clearBuilderHomeEntryState()
    builderHomeInitialPromptThreadIds.add(threadId)
    return
  }

  const activeThreadId = normalizeConversationId(
    conversationId.value
    || boundConversationId.value,
  )
  if (activeThreadId !== threadId) {
    pendingBuilderHomeInitialPromptThreadId.value = threadId
    return
  }

  await submitBuilderHomeInitialPrompt(threadId)
}

const runImportedHandoffAutoReplayIfNeeded = async (input: {
  handoff: AppBuilderHandoff
  handoffId: string
  handoffSourceThreadId: string
  modelSelection?: AiThreadModelSelection | null
}): Promise<SubmitMessageResult | 'skipped'> => {
  if (!shouldAutoReplayImportedHandoff({
    handoff: input.handoff,
    handoffId: input.handoffId,
    messages: messages.value,
  })) {
    return 'skipped'
  }

  const handoffPrompt = String(input.handoff.draft?.goal || '').trim()
  const handoffAttachments = buildImportedHandoffComposerAttachments(input.handoff)
  const visibleUserMessage = buildImportedHandoffVisibleUserMessage(input.handoff)
  const visibleUserMetadata = buildImportedHandoffVisibleUserMetadata({
    handoff: input.handoff,
    handoffId: input.handoffId,
    handoffSourceThreadId: input.handoffSourceThreadId,
  })

  const importedHandoffContext: NocodeEditorAiImportedHandoffContext = {
    handoffId: input.handoffId || input.handoff?.handoffId,
    creationMode: input.handoff?.scope?.creationMode,
    intentKind: input.handoff?.intent?.kind,
    entryTitle: input.handoff?.intent?.entryTitle,
    targetAppName: input.handoff?.scope?.targetApp?.appName,
    originalGoal: input.handoff?.draft?.goal,
    materialSummary: (input.handoff?.materials?.attachments || [])
      .map(item => String(item?.name || '').trim())
      .filter(Boolean)
      .join('、'),
  }

  const requestMetadata = buildImportedHandoffRequestMetadata({
    handoff: input.handoff,
    handoffId: input.handoffId,
    handoffSourceThreadId: input.handoffSourceThreadId,
  })

  const { result } = await submitEditorTurnFromTextAndAttachments({
    text: handoffPrompt,
    attachments: handoffAttachments,
    modelSelection: input.modelSelection,
    silentFailure: true,
    visibleUserContentOverride: visibleUserMessage,
    visibleUserMetadataOverride: visibleUserMetadata,
    requestMetadataOverride: requestMetadata,
    importedHandoffContext,
  })
  return result
}

const consumeImportedHandoffAfterReplay = async (input: {
  handoffId: string
  handoffSourceThreadId: string
}) => {
  const { data } = await axios.post(
    `/ai/threads/${input.handoffSourceThreadId}/app-builder-handoff/${input.handoffId}/consume`,
  )
  const consumedHandoff = resolveFetchedAppBuilderHandoffResponse(data)
  if (consumedHandoff) {
    activeHandoffForContinuityHint.value = consumedHandoff
  }
  clearBuilderHomeEntryModelSelection()
  await clearPendingHandoffRouteQuery()
}

const runPendingHandoffImport = async (input: {
  handoffId: string
  handoffSourceThreadId: string
  importSnapshot: PendingHandoffImportSnapshot
}): Promise<PendingHandoffImportSubmitState> => {
  const {
    handoffId,
    handoffSourceThreadId,
    importSnapshot,
  } = input

  const importPromise = Promise.resolve().then(async (): Promise<PendingHandoffImportSubmitState> => {
    importingHandoffIds.add(handoffId)
    try {
      const { data } = await axios.get(
        `/ai/threads/${handoffSourceThreadId}/app-builder-handoff/${handoffId}`,
      )
      const handoff = resolveFetchedAppBuilderHandoffResponse(data)
      if (!handoff) {
        return 'failed'
      }
      activeHandoffForContinuityHint.value = handoff
      if (handoff.status === 'consumed' || handoff.status === 'abandoned') {
        await clearPendingHandoffRouteQuery()
        handoffBootstrapPhase.value = 'idle'
        return 'imported'
      }
      if (!isImportedHandoffConversationSnapshotCurrent({
        snapshotConversationId: importSnapshot.conversationId,
        currentConversationId: conversationId.value,
      })) {
        return 'failed'
      }
      try {
        handoffBootstrapPhase.value = 'replaying'
        const entryModelSelection = builderHomeInitialModelSelection.value
          || peekNocodeEditorBuilderModelSelection(props.nocodeId)
        if (entryModelSelection) {
          builderHomeInitialModelSelection.value = entryModelSelection
          applyModelSelectionState(entryModelSelection)
        }
        const autoReplayResult = await runImportedHandoffAutoReplayIfNeeded({
          handoff,
          handoffId,
          handoffSourceThreadId,
          modelSelection: entryModelSelection,
        })
        if (autoReplayResult === 'failed' || autoReplayResult === 'aborted' || autoReplayResult === 'not_started') {
          handoffBootstrapPhase.value = 'failed'
          return 'failed'
        }
        const importState = resolveHandoffImportState(handoffId)
        if (autoReplayResult === 'skipped') {
          if (importState !== 'imported') {
            handoffBootstrapPhase.value = 'failed'
            return 'failed'
          }
          await consumeImportedHandoffAfterReplay({
            handoffId,
            handoffSourceThreadId,
          })
          handoffBootstrapPhase.value = 'idle'
          return 'imported'
        }
        if (importState !== 'imported') {
          handoffBootstrapPhase.value = 'failed'
          return 'failed'
        }
        await consumeImportedHandoffAfterReplay({
          handoffId,
          handoffSourceThreadId,
        })
        handoffBootstrapPhase.value = 'idle'
        return 'imported'
      } catch (autoReplayError) {
        console.error('Imported app builder handoff auto replay failed:', autoReplayError)
        handoffBootstrapPhase.value = 'failed'
        return 'failed'
      }
    } catch (error) {
      throw error
    } finally {
      importingHandoffIds.delete(handoffId)
      pendingHandoffImportPromises.delete(handoffId)
    }
  })

  pendingHandoffImportPromises.set(handoffId, importPromise)
  return await importPromise
}

const waitForInProgressHandoffImportThenRetry = async (input: {
  handoffId: string
  handoffSourceThreadId: string
}): Promise<PendingHandoffImportSubmitState> => {
  const {
    handoffId,
    handoffSourceThreadId,
  } = input
  const inProgressImport = pendingHandoffImportPromises.get(handoffId)
  if (inProgressImport) {
    await inProgressImport.catch(() => 'failed')
  }

  const stateAfterWait = resolveHandoffImportState(handoffId)
  if (stateAfterWait === 'imported') {
    return 'imported'
  }
  if (retryingInProgressHandoffIds.has(handoffId)) {
    return stateAfterWait === 'none' ? 'failed' : stateAfterWait
  }
  if (!hasSamePendingHandoffImportQuery({ handoffId, handoffSourceThreadId })) {
    return stateAfterWait === 'none' ? 'failed' : stateAfterWait
  }

  const importSnapshot = buildPendingHandoffImportSnapshot()
  if (!importSnapshot) {
    return stateAfterWait === 'none' ? 'failed' : stateAfterWait
  }

  retryingInProgressHandoffIds.add(handoffId)
  try {
    const latestState = resolveHandoffImportState(handoffId)
    if (latestState === 'imported') {
      return 'imported'
    }
    if (latestState === 'in_progress') {
      return await waitForInProgressHandoffImportThenRetry({
        handoffId,
        handoffSourceThreadId,
      })
    }
    return await runPendingHandoffImport({
      handoffId,
      handoffSourceThreadId,
      importSnapshot,
    })
  } finally {
    retryingInProgressHandoffIds.delete(handoffId)
  }
}

const submitPendingHandoffMessageIfNeeded = async (): Promise<PendingHandoffImportSubmitState> => {
  const handoffId = resolvePendingHandoffId()
  const handoffSourceThreadId = resolvePendingHandoffSourceThreadId()
  if (handoffId && handoffSourceThreadId) {
    await ensureConversationForPendingHandoff()
  }
  if (!handoffId || !handoffSourceThreadId || !conversationId.value) {
    return 'none'
  }

  const existingImportState = resolveHandoffImportState(handoffId)
  if (existingImportState === 'imported') {
    return 'imported'
  }
  if (existingImportState === 'in_progress') {
    return await waitForInProgressHandoffImportThenRetry({
      handoffId,
      handoffSourceThreadId,
    })
  }

  const importSnapshot = buildPendingHandoffImportSnapshot()
  if (!importSnapshot) {
    return 'none'
  }

  return await runPendingHandoffImport({
    handoffId,
    handoffSourceThreadId,
    importSnapshot,
  })
}

watch(conversationId, (value, previousValue) => {
  if (value === previousValue) {
    return
  }
  if (value && taskSeed.value?.taskId) {
    persistCurrentTaskSeed()
  }
  emit('thread-change', value)
})

watch(() => props.visible, async (value) => {
  if (!value) {
    stop()
    return
  }
  await initializeConversation()
  await focusTextarea()
})

watch([
  stagedFormPlan,
  stagedAppPlan,
  stagedFlowPlan,
  stagedBlueprint,
  stageLoadingState,
  isApplyingFlow,
  isApplyingBlueprint,
  pendingBlueprintsForStage,
  pendingBlueprintHistory,
  planningDisplayVersionByContextKey,
  sessionFlowArtifactBlocks,
  stageSyncedDraftPersistenceState,
], () => {
  emitStagedStateChange()
})

const latestActivePostFormFlowFollowUp = computed(() => (
  findLatestActivePostFormFlowFollowUpFromMessages(messages.value)
))

watch(latestActivePostFormFlowFollowUp, (latestFollowUpMessage) => {
  if (!latestFollowUpMessage) {
    clearExplicitFlowAutoContinueTimer()
    return
  }
  const latestFollowUp = latestFollowUpMessage.followUp
  if (!(latestFollowUp.kind === 'explicit_flow_clarification' && latestFollowUp.status === 'available')) {
    clearExplicitFlowAutoContinueTimer()
    return
  }
  void scheduleExplicitFlowAutoContinue(latestFollowUpMessage.message)
})

const latestFlowBlueprintAutoContinueCandidate = computed(() => (
  findLatestFlowBlueprintAutoContinueCandidateFromMessages(messages.value)
))

watch([latestFlowBlueprintAutoContinueCandidate, isResponding, isPreparingSubmit, isApplyingFlow, isApplyingBlueprint, isRefreshingBlueprint, stagedFlowPlan], () => {
  if (
    isResponding.value
    || isPreparingSubmit.value
    || isApplyingFlow.value
    || isApplyingBlueprint.value
    || isRefreshingBlueprint.value
  ) {
    clearFlowBlueprintAutoContinueTimer()
    return
  }

  const candidate = latestFlowBlueprintAutoContinueCandidate.value
  if (!candidate) {
    clearFlowBlueprintAutoContinueTimer()
    return
  }

  void scheduleFlowBlueprintAutoContinue(candidate)
})

watch(activeFlowIssueState, (state) => {
  emit('flow-issue-state-change', state)
}, {
  immediate: true,
})

watch(() => tailPostFormFlowFollowUpCard.value, async (card, previousCard) => {
  if (!card) {
    return
  }
  const shouldScroll = !previousCard
    || previousCard.message.id !== card.message.id
    || previousCard.followUp.updatedAt !== card.followUp.updatedAt
  if (!shouldScroll) {
    return
  }
  await syncTailCardViewportAfterLayout()
})

watch(panelFooterRef, () => {
  connectPanelFooterResizeObserver()
  if (tailPostFormFlowFollowUpCard.value && isAtBottom.value) {
    void syncTailCardViewportAfterLayout()
  }
})

onBeforeUnmount(() => {
  props.runtime.setActiveFormulaTaskContext()
  clearExplicitFlowAutoContinueTimer()
  clearFlowBlueprintAutoContinueTimer()
  disconnectPanelFooterResizeObserver()
  disconnectMessagesContainerResizeObserver()
})

watch(() => props.draftPersistenceState, (state) => {
  const nextState = normalizeDraftPersistenceState(state)
  const previousDraftPersistenceStateForPropSync = (
    normalizeDraftPersistenceState(stagedBlueprint.value.draftPersistenceState)
    || normalizeDraftPersistenceState(currentDraftPersistenceState.value)
  )
  const resolvedDraftPersistenceState = (
    nextState === null
    && previousDraftPersistenceStateForPropSync
    && hasHistoricalDraftIssueListCompletionState(previousDraftPersistenceStateForPropSync)
    && !isDraftPersistenceStateResolved(previousDraftPersistenceStateForPropSync)
  )
    ? buildResolvedDraftPersistenceState(previousDraftPersistenceStateForPropSync, {
      resolvedAt: Date.now(),
      sourceTraceId: previousDraftPersistenceStateForPropSync.sourceTraceId,
      sourceBlueprintVersionKey: getCurrentBlueprintVersionKey(),
      sourceBlueprintIdentityKey: getCurrentBlueprintIdentityKey(),
    })
    : null
  const nextDraftPersistenceState = resolvedDraftPersistenceState || nextState
  if (
    buildDraftPersistenceStateSignature(stagedBlueprint.value.draftPersistenceState)
    === buildDraftPersistenceStateSignature(nextDraftPersistenceState)
  ) {
    return
  }

  stagedBlueprint.value = {
    ...stagedBlueprint.value,
    draftPersistenceState: nextDraftPersistenceState,
  }
  if (resolvedDraftPersistenceState) {
    pendingDraftIssueCompletionSyncSignatures.add(buildDraftPersistenceStateSignature(resolvedDraftPersistenceState))
  }
  syncMessagesWithStagedState()
}, {
  deep: true,
})

watch(() => props.flowIssueRuntimeVerdict, () => {
  syncMessagesWithStagedState()
})

watch(boundConversationId, async (value, previousValue) => {
  const normalized = normalizeConversationId(value)
  if (shouldSkipNocodeEditorAiConversationReset({
    previousConversationId: normalizeConversationId(previousValue),
    nextConversationId: normalized,
    isInitializingConversation: isInitializingConversation.value,
    pendingBootstrapReason: pendingConversationBootstrapReason.value,
  })) {
    if (pendingConversationBootstrapReason.value === 'submit-bootstrap') {
      pendingConversationBootstrapReason.value = null
    }
    return
  }

  resetConversationView({ clearStoredConversation: false })
  conversationId.value = normalized

  if (props.visible) {
    if (conversationId.value) {
      const loaded = await loadConversationMessages()
      if (!loaded) {
        await refreshStagedState()
      }
      await submitPendingHandoffMessageIfNeeded()
    } else {
      await refreshStagedState()
    }
    await focusTextarea()
  }
})

onMounted(async () => {
  void aiConfigStore.loadCatalog().then(() => {
    applyFirstExplicitModelSelection()
  }).catch(() => null)
  registerActiveFormulaTaskContext()
  connectMessagesContainerResizeObserver()
  if (!props.visible) {
    return
  }
  await initializeConversation()
  await focusTextarea()
})

const isDraftOnlyBlueprintApplyResult = (
  output?: unknown,
): output is NocodeEditorAiBlueprintApplyResult => Boolean(
  output
  && typeof output === 'object'
  && (output as NocodeEditorAiBlueprintApplyResult).persistenceMode === 'draft_only',
)

const resolveStreamedDraftOnlyBlueprintActionList = (
  metadata?: Record<string, unknown> | null,
) => {
  const state = metadata?.draftIssueActionList as NocodeEditorAiDraftPersistenceState | null | undefined
  return state?.mode === 'draft_only' ? state : null
}

const removeBlueprintLoadingArtifactBlock = (message: NocodeEditorAiMessage) => {
  setMessageArtifactBlocks(
    message,
    getAllArtifactBlocks(message).filter(block => !(
      block.kind === 'blueprint'
      && block.status === 'loading'
    )),
  )
}

const buildToolResultArtifactBlocks = (
  toolName: string,
  preferredMessage?: NocodeEditorAiMessage,
  output?: unknown,
) => {
  const blocks: NocodeEditorAiArtifactBlock[] = []

  if (toolName === 'editor_stage_app_plan') {
    const planOutput = output as { revision?: number; stagedAt?: number; plan?: NocodeEditorAiArtifactBlock['appPlan'] } | undefined
    const block = buildAppPlanArtifactBlock({
      revision: Number(planOutput?.revision || 0),
      stagedAt: Number(planOutput?.stagedAt || 0) || undefined,
      plan: (planOutput?.plan || null) as NocodeEditorAiStagedAppPlan['plan'],
    })
    if (block) {
      blocks.push(block)
    }
  }

  if (toolName === 'editor_stage_single_form_plan') {
    const block = buildFormPlanArtifactBlock(stagedFormPlan.value)
    if (block) {
      blocks.push(block)
    }
  }

  if (toolName === 'editor_stage_content_plan') {
    const block = buildContentPlanArtifactBlock(output)
    if (block) {
      blocks.push(block)
    }
  }

  if (toolName === 'editor_stage_formula_plan') {
    const block = buildFormulaPlanArtifactBlock(output)
    if (block) {
      blocks.push(block)
    }
  }

  if (toolName === 'editor_apply_staged_flow') {
    const block = buildFlowPlanArtifactBlock(stagedFlowPlan.value)
    if (block) {
      blocks.push(block)
    }
  }

  if (toolName === 'editor_stage_app_blueprint') {
    const block = buildBlueprintArtifactBlock(stagedBlueprint.value)
    if (block) {
      blocks.push(block)
    }
  }

  if (toolName === 'editor_apply_staged_app_blueprint') {
    const applyResult = (output as NocodeEditorAiBlueprintApplyResult | undefined) || stagedBlueprint.value.applyResult || null
    const block = buildBlueprintArtifactBlock(stagedBlueprint.value, {
      phase: isDraftOnlyBlueprintApplyResult(output) ? 'applied_draft' : 'applied_saved',
      applyResult,
      draftPersistenceState: applyResult?.draftPersistenceState || stagedBlueprint.value.draftPersistenceState || null,
    })
    if (block) {
      blocks.push(block)
    }
  }

  return blocks
}

const resolveUserMessageHistoryForCurrentTurn = (traceId?: string) => {
  let cutoffIndex = messages.value.length - 1
  const normalizedTraceId = normalizeTraceId(traceId)
  if (normalizedTraceId) {
    for (let index = messages.value.length - 1; index >= 0; index -= 1) {
      const message = messages.value[index]
      if (
        message.role === NocodeEditorAiMessageRole.USER
        && normalizeTraceId(message.traceId) === normalizedTraceId
      ) {
        cutoffIndex = index
        break
      }
    }
  }

  const history: string[] = []
  for (let index = 0; index <= cutoffIndex; index += 1) {
    const message = messages.value[index]
    if (message.role !== NocodeEditorAiMessageRole.USER) {
      continue
    }
    const content = String(message.content || '').trim()
    if (content) {
      history.push(content)
    }
  }
  return history
}

const buildPlanningToolContinuationInput = (options: {
  preferredMessage?: NocodeEditorAiMessage
  traceId?: string
  requestMetadata?: Record<string, unknown>
}) => {
  const userMessages = resolveUserMessageHistoryForCurrentTurn(options.traceId)
  const currentUserMessage = userMessages[userMessages.length - 1] || ''
  if (!shouldContinueCurrentPlanningChain({
    userMessage: currentUserMessage,
    editorMode: currentHostContext.value?.mode,
    activeFormId: currentHostContext.value?.activeFormId,
  })) {
    return null
  }

  const continuationContext = buildBlueprintContinuationContext()
  const latestCompletedPlanningConfirmation = resolveLatestCompletedPlanningConfirmation({
    preferredMessage: options.preferredMessage,
    planningContextKey: continuationContext.planningContextKey,
    planningContextKeys: continuationContext.planningContextKeys,
    traceId: options.traceId,
  })
  const planningContextKey = String(continuationContext.planningContextKey || '').trim()
  if (!latestCompletedPlanningConfirmation && !planningContextKey) {
    return null
  }

  const activePlanningBlock = getActivePlanningSummaryBlock()
  const planningContinuation: NocodeEditorAiPlanningContinuation | null = (
    !latestCompletedPlanningConfirmation
    && planningContextKey
  )
    ? {
      stage: stagedFormPlan.value.outline ? 'form-plan' : 'app-plan',
      planningContextKey,
      autoContinueWithoutConfirmation: Boolean(
        activePlanningBlock
        && resolveAiArtifactPendingQuestionCount(activePlanningBlock) <= 0
        && shouldAutoContinueNocodeEditorPlanningWithoutConfirmation({
          explicitPlanningConfirmation: false,
        }),
      ),
    }
    : null

  return {
    latestCompletedPlanningConfirmation,
    planningContinuation,
  }
}

const resolveFlowBlueprintPlanningContextKeyForCallback = (
  assistantMessage?: NocodeEditorAiMessage,
) => {
  const loadingBlock = assistantMessage
    ? getAllArtifactBlocks(assistantMessage).find(block => isFlowBlueprintExpansionStateBlock(block, 'loading'))
    : undefined

  return String(
    loadingBlock?.confirmation?.planningContextKey
    || buildPlanningArtifactContextKey(loadingBlock)
    || resolveLatestFlowSchemePlanningContextKey()
    || '',
  ).trim()
}

const FLOW_BLUEPRINT_REPLAN_REQUIRED_MESSAGE = '请先根据已确认的信息更新流程方案，再继续生成流程。'

const handleToolCall = async (
  payload: NocodeEditorAiChatStreamPayload,
  controller: AbortController,
  assistantMessage?: NocodeEditorAiMessage,
) => {
  const metadata = payload.metadata || {}
  const toolName = String(metadata.toolName || '').trim()
  const callId = String(metadata.callId || metadata.actionId || '').trim()
  if (!toolName || !callId) {
    return
  }
  const traceId = normalizeTraceId(
    payload.metadata?.traceId || assistantMessage?.traceId || assistantMessage?.metadata?.traceId,
  )

  const callbackPayload: NocodeEditorAiClientToolResultRequest = {
    conversationId: String(payload.conversationId || conversationId.value || '').trim(),
    callId,
    toolName,
    ok: false,
  }
  const shouldPostClientToolResultBeforeUiHydration = false
  let hasPostedClientToolResult = false

  if (toolName === 'editor_apply_staged_app_blueprint') {
    isApplyingBlueprint.value = true
  }
  const isFieldConfigurationTool = (
    toolName === 'editor_set_field_formulas'
    || toolName === 'editor_set_field_options'
    || toolName === 'editor_bind_field_source'
  )
  const currentBlueprintIdentityKey = isFieldConfigurationTool ? getCurrentBlueprintIdentityKey() : ''
  const rawStagedDraftPersistenceStateForFieldTool = isFieldConfigurationTool
    ? stagedBlueprint.value.draftPersistenceState
    : null
  const stagedDraftStateForFieldTool = isFieldConfigurationTool
    ? normalizeDraftPersistenceState(rawStagedDraftPersistenceStateForFieldTool)
    : null
  const stagedDraftPersistenceState = (
    stagedDraftStateForFieldTool
    && isDraftPersistenceStateForBlueprint(
      stagedDraftStateForFieldTool,
      getCurrentBlueprintVersionKey(),
      currentBlueprintIdentityKey,
    )
  )
    ? stagedDraftStateForFieldTool
    : null
  const rawCurrentDraftPersistenceStateForFieldTool = isFieldConfigurationTool
    ? currentDraftPersistenceState.value
    : null
  const currentDraftStateForFieldTool = isFieldConfigurationTool
    ? normalizeDraftPersistenceState(rawCurrentDraftPersistenceStateForFieldTool)
    : null
  const fallbackDraftPersistenceState = (
    currentDraftStateForFieldTool
    && isDraftPersistenceStateForBlueprint(
      currentDraftStateForFieldTool,
      getCurrentBlueprintVersionKey(),
      currentBlueprintIdentityKey,
    )
  )
    ? currentDraftStateForFieldTool
    : null
  const previousDraftPersistenceState = isFieldConfigurationTool
    ? (
      normalizeDraftPersistenceState(stagedBlueprint.value.draftPersistenceState)
      || normalizeDraftPersistenceState(currentDraftPersistenceState.value)
    )
    : null
  const previousDraftPersistenceStateForCompletion = stagedDraftPersistenceState || (
    previousDraftPersistenceState && fallbackDraftPersistenceState
      ? fallbackDraftPersistenceState
      : null
  )
  const previousRawDraftPersistenceStateForCompletion = stagedDraftPersistenceState
    ? rawStagedDraftPersistenceStateForFieldTool
    : (
      fallbackDraftPersistenceState
        ? rawCurrentDraftPersistenceStateForFieldTool
        : null
    )
  const toolInput: Record<string, unknown> = {
    ...((metadata.input && typeof metadata.input === 'object')
      ? metadata.input as Record<string, unknown>
      : {}),
  }
  if (
    toolName === 'editor_plan_flow_scheme'
    && metadata.flowSchemeConfirmationContext
    && typeof metadata.flowSchemeConfirmationContext === 'object'
    && !Array.isArray(metadata.flowSchemeConfirmationContext)
  ) {
    toolInput.__flowSchemeConfirmationContext = metadata.flowSchemeConfirmationContext
  }
  if (toolName === 'editor_stage_flow_blueprint') {
    toolInput.__aiFlowPlanOptimizerStrictValidation = true
  }
  const flowBlueprintPlanningContextKey = toolName === 'editor_stage_flow_blueprint'
    ? resolveFlowBlueprintPlanningContextKeyForCallback(assistantMessage)
    : ''

  try {
    if (shouldBlockFlowBlueprintUntilSchemeReplanned({
      toolName,
      requestMetadata: (
        assistantMessage?.metadata?.requestMetadata
        && typeof assistantMessage.metadata.requestMetadata === 'object'
        && !Array.isArray(assistantMessage.metadata.requestMetadata)
      )
        ? assistantMessage.metadata.requestMetadata as Record<string, unknown>
        : null,
    })) {
      callbackPayload.ok = false
      callbackPayload.error = FLOW_BLUEPRINT_REPLAN_REQUIRED_MESSAGE
      callbackPayload.metadata = {
        ...(callbackPayload.metadata || {}),
        flowGroundingUserMessage: FLOW_BLUEPRINT_REPLAN_REQUIRED_MESSAGE,
        flowGroundingReturnToStage: 'flow-scheme',
        requiredNextAction: 'editor_plan_flow_scheme',
        blockedNextAction: 'editor_stage_flow_blueprint',
        planningContextKey: flowBlueprintPlanningContextKey || undefined,
        flowSchemeTitle: resolveLatestFlowSchemeTitleForPlanningContext(flowBlueprintPlanningContextKey) || undefined,
        flowSchemePlanningStatus: 'needs_confirmation',
        blueprintClarificationRequired: true,
        blueprintClarificationKind: 'planning-question',
      }
    } else if (
      toolName === 'editor_stage_app_blueprint'
      || toolName === 'editor_stage_app_plan'
      || toolName === 'editor_stage_single_form_plan'
    ) {
      const requestMetadata = (
        assistantMessage?.metadata?.requestMetadata
        && typeof assistantMessage.metadata.requestMetadata === 'object'
        && !Array.isArray(assistantMessage.metadata.requestMetadata)
      )
        ? assistantMessage.metadata.requestMetadata as Record<string, unknown>
        : {}
      const traceId = normalizeTraceId(payload.metadata?.traceId || assistantMessage?.traceId || assistantMessage?.metadata?.traceId)
      const continuationInput = buildPlanningToolContinuationInput({
        preferredMessage: assistantMessage,
        traceId,
        requestMetadata,
      })
      if (continuationInput?.latestCompletedPlanningConfirmation) {
        toolInput.latestCompletedPlanningConfirmation = continuationInput.latestCompletedPlanningConfirmation
      }
      if (continuationInput?.planningContinuation) {
        toolInput.planningContinuation = continuationInput.planningContinuation
      }
      if (toolName === 'editor_stage_app_blueprint') {
        const currentTurnUserMessages = resolveUserMessageHistoryForCurrentTurn(traceId)
        toolInput.__currentUserMessage = currentTurnUserMessages[currentTurnUserMessages.length - 1] || ''
      }
      callbackPayload.output = await props.runtime.executeTool(toolName, toolInput)
      callbackPayload.ok = true
    } else {
      callbackPayload.output = await props.runtime.executeTool(toolName, toolInput)
      callbackPayload.ok = true
    }
  } catch (error) {
    callbackPayload.ok = false
    callbackPayload.error = error instanceof Error ? error.message : String(error)
    const errorRecord = error && typeof error === 'object' && !Array.isArray(error)
      ? error as Record<string, unknown>
      : null
    const flowGroundingDiagnostics = Array.isArray(errorRecord?.flowGroundingDiagnostics)
      ? errorRecord.flowGroundingDiagnostics as FlowSchemeConvergenceGroundingDiagnostic[]
      : []
    const flowGroundingQuestions = normalizeVisibleFlowGroundingQuestions({
      questions: errorRecord?.flowGroundingQuestions,
      diagnostics: flowGroundingDiagnostics,
      preferDiagnostics: true,
    })
    const flowGroundingUserMessage = normalizeFlowGroundingUserMessage(
      errorRecord?.flowGroundingUserMessage,
    )
    const flowUnifiedIssues = Array.isArray(errorRecord?.flowUnifiedIssues)
      ? errorRecord.flowUnifiedIssues
      : undefined
    const flowIssueRouting = normalizeFlowIssueRoutingResult(errorRecord?.flowIssueRouting)
    const flowPatchErrorCode = typeof errorRecord?.flowPatchErrorCode === 'string'
      ? errorRecord.flowPatchErrorCode
      : undefined
    const requiresFullRebuild = typeof errorRecord?.requiresFullRebuild === 'boolean'
      ? errorRecord.requiresFullRebuild
      : undefined
    const blueprintInputErrorCode = typeof errorRecord?.blueprintInputErrorCode === 'string'
      ? errorRecord.blueprintInputErrorCode
      : undefined
    const blueprintScopeErrorCode = typeof errorRecord?.blueprintScopeErrorCode === 'string'
      ? errorRecord.blueprintScopeErrorCode
      : undefined
    const blueprintScopeMissingForms = Array.isArray(errorRecord?.blueprintScopeMissingForms)
      ? errorRecord.blueprintScopeMissingForms
      : undefined
    const flowPatchPersisted = typeof errorRecord?.flowPatchPersisted === 'boolean'
      ? errorRecord.flowPatchPersisted
      : undefined
    const flowPatchFinalizeFailed = typeof errorRecord?.flowPatchFinalizeFailed === 'boolean'
      ? errorRecord.flowPatchFinalizeFailed
      : undefined
    const flowPatchFinalizeError = (
      typeof errorRecord?.flowPatchFinalizeError === 'string'
      && errorRecord.flowPatchFinalizeError.trim()
    )
      ? errorRecord.flowPatchFinalizeError.trim()
      : undefined
    const flowPatchRollbackFailed = typeof errorRecord?.flowPatchRollbackFailed === 'boolean'
      ? errorRecord.flowPatchRollbackFailed
      : undefined
    const flowPatchRollbackResult = typeof errorRecord?.flowPatchRollbackResult === 'boolean'
      ? errorRecord.flowPatchRollbackResult
      : undefined
    const flowPatchRollbackError = (
      typeof errorRecord?.flowPatchRollbackError === 'string'
      && errorRecord.flowPatchRollbackError.trim()
    )
      ? errorRecord.flowPatchRollbackError.trim()
      : undefined
    if (
      flowUnifiedIssues
      || flowIssueRouting
      || flowPatchErrorCode
      || requiresFullRebuild !== undefined
      || flowPatchPersisted !== undefined
      || flowPatchFinalizeFailed !== undefined
      || flowPatchFinalizeError
      || flowPatchRollbackFailed !== undefined
      || flowPatchRollbackResult !== undefined
      || flowPatchRollbackError
      || blueprintInputErrorCode
      || blueprintScopeErrorCode
    ) {
      callbackPayload.metadata = {
        ...(callbackPayload.metadata || {}),
        blueprintInputErrorCode,
        blueprintScopeErrorCode,
        blueprintScopeMissingForms,
        flowPatchErrorCode: flowPatchErrorCode,
        requiresFullRebuild: requiresFullRebuild,
        flowPatchPersisted: flowPatchPersisted,
        flowPatchFinalizeFailed: flowPatchFinalizeFailed,
        flowPatchFinalizeError: flowPatchFinalizeError,
        flowPatchRollbackFailed: flowPatchRollbackFailed,
        flowPatchRollbackResult: flowPatchRollbackResult,
        flowPatchRollbackError: flowPatchRollbackError,
        flowUnifiedIssues,
        flowIssueRouting,
        blockedNextAction: typeof errorRecord?.blockedNextAction === 'string'
          ? errorRecord.blockedNextAction
          : undefined,
      }
    }
    const shouldUseGroundingRecovery = (
      flowIssueRouting?.outcome === 'return_to_flow_scheme'
      && Boolean(flowGroundingQuestions.length)
    )
    if (flowGroundingDiagnostics.length || flowGroundingQuestions.length) {
      callbackPayload.error = flowGroundingUserMessage
      callbackPayload.metadata = {
        ...(callbackPayload.metadata || {}),
        flowGroundingDiagnostics: flowGroundingDiagnostics.length ? flowGroundingDiagnostics : undefined,
        flowGroundingQuestions,
        flowGroundingUserMessage,
        flowUnifiedIssues,
        flowIssueRouting,
        flowGroundingReturnToStage: shouldUseGroundingRecovery ? 'flow-scheme' : undefined,
        blockedNextAction: shouldUseGroundingRecovery
          ? 'editor_stage_flow_blueprint'
          : flowIssueRouting?.blockedNextAction,
        requiredNextAction: shouldUseGroundingRecovery ? 'editor_plan_flow_scheme' : undefined,
        planningContextKey: flowBlueprintPlanningContextKey || undefined,
        flowSchemeTitle: resolveLatestFlowSchemeTitleForPlanningContext(flowBlueprintPlanningContextKey) || undefined,
        flowSchemePlanningStatus: shouldUseGroundingRecovery ? 'needs_confirmation' : flowIssueRouting?.planningStatus,
        planningConvergenceLateQuestions: shouldUseGroundingRecovery
          ? flowGroundingQuestions.map(question => question.title)
          : undefined,
        blueprintClarificationRequired: shouldUseGroundingRecovery ? true : undefined,
        blueprintClarificationKind: shouldUseGroundingRecovery ? 'planning-question' : undefined,
      }
    }
  }
  finally {
    if (toolName === 'editor_apply_staged_app_blueprint') {
      isApplyingBlueprint.value = false
    }
    if (toolName === 'editor_apply_staged_flow') {
      isApplyingFlow.value = false
    }
  }

  if (callbackPayload.ok && toolName === 'editor_plan_flow_scheme' && assistantMessage) {
    const assistantMetadata = ensureMessageMetadata(assistantMessage)
    const currentRequestMetadata = (
      assistantMetadata.requestMetadata
      && typeof assistantMetadata.requestMetadata === 'object'
      && !Array.isArray(assistantMetadata.requestMetadata)
    )
      ? assistantMetadata.requestMetadata as Record<string, unknown>
      : null
    assistantMetadata.requestMetadata = markFlowSchemeReplannedInCurrentTurn(currentRequestMetadata)
  }

  const toolOutput = callbackPayload.output
  const requestMetadata = (
    assistantMessage?.metadata?.requestMetadata
    && typeof assistantMessage.metadata.requestMetadata === 'object'
    && !Array.isArray(assistantMessage.metadata.requestMetadata)
  )
    ? assistantMessage.metadata.requestMetadata as Record<string, unknown>
    : {}
  const requestScenePayload = (
    assistantMessage?.metadata?.requestScenePayload
    && typeof assistantMessage.metadata.requestScenePayload === 'object'
    && !Array.isArray(assistantMessage.metadata.requestScenePayload)
  )
    ? assistantMessage.metadata.requestScenePayload as Record<string, unknown>
    : {}
  const currentRequestEntryFlowIntent = resolveRequestScopedEntryFlowIntent({
    requestScenePayload,
    requestUserMessage: String(requestMetadata.userFacingContent || '').trim(),
    requestFlowIntentSignal: resolveCurrentAssistantPlanningFlowIntentSignal(assistantMessage?.metadata || null),
  })
  const currentPendingFlowIntent = resolveActivePendingFlowIntent()
  const toolTargetIdentity = resolvePendingFlowIntentToolTargetIdentity({
    toolName,
    toolInput,
    toolOutput,
  })
  let nextPendingFlowIntent: NocodeEditorPendingFlowIntent | null | undefined
  let blueprintApplyPostFormFlowMetadata:
    | ReturnType<typeof resolveBlueprintApplyPostFormFlowMetadata>
    | null = null
  if (callbackPayload.ok && toolName === 'editor_apply_staged_app_blueprint') {
    blueprintApplyPostFormFlowMetadata = resolveBlueprintApplyPostFormFlowMetadata({
      entryFlowIntent: currentRequestEntryFlowIntent,
      result: (toolOutput as NocodeEditorAiBlueprintApplyResult | null | undefined) || null,
    })
    nextPendingFlowIntent = blueprintApplyPostFormFlowMetadata.pendingFlowIntent
  } else if (
    callbackPayload.ok
    && toolName === 'editor_open_form'
    && currentPendingFlowIntent?.status === 'pending_after_form_apply'
    && String(toolInput.tab || '').trim() === 'process-setting'
    && matchNocodeEditorPendingFlowIntentTarget({
      pendingFlowIntent: currentPendingFlowIntent,
      targetFormId: toolTargetIdentity.targetFormId,
      targetFormName: toolTargetIdentity.targetFormName,
    })
  ) {
    nextPendingFlowIntent = {
      ...currentPendingFlowIntent,
      targetFormId: toolTargetIdentity.targetFormId || currentPendingFlowIntent.targetFormId,
      targetFormName: toolTargetIdentity.targetFormName || currentPendingFlowIntent.targetFormName,
      status: 'in_progress',
      updatedAt: Date.now(),
    }
  } else if (
    callbackPayload.ok
    && toolName === 'editor_apply_staged_flow'
    && currentPendingFlowIntent
  ) {
    nextPendingFlowIntent = completePendingFlowIntentForTarget({
      pendingFlowIntent: currentPendingFlowIntent,
      targetFormId: toolTargetIdentity.targetFormId,
      targetFormName: toolTargetIdentity.targetFormName,
    }) || undefined
  }
  if (nextPendingFlowIntent !== undefined) {
    localPendingFlowIntent.value = nextPendingFlowIntent
  }
  if (nextPendingFlowIntent !== undefined || blueprintApplyPostFormFlowMetadata) {
    callbackPayload.metadata = {
      ...(callbackPayload.metadata || {}),
      pendingFlowIntent: nextPendingFlowIntent,
      ...(blueprintApplyPostFormFlowMetadata
        ? {
          postFormFlowSignals: blueprintApplyPostFormFlowMetadata.postFormFlowSignals,
          postFormFlowOpportunity: blueprintApplyPostFormFlowMetadata.postFormFlowOpportunity,
          postFormFlowFollowUp: blueprintApplyPostFormFlowMetadata.postFormFlowFollowUp,
          postFormFlowRelease: blueprintApplyPostFormFlowMetadata.postFormFlowRelease,
          planningScope: blueprintApplyPostFormFlowMetadata.planningScope,
        }
        : {}),
    }
  }
  const toolDraftPersistenceState = (
    toolOutput
    && typeof toolOutput === 'object'
    && Object.prototype.hasOwnProperty.call(toolOutput, 'draftPersistenceState')
  )
    ? (toolOutput as { draftPersistenceState: NocodeEditorAiDraftPersistenceState | null }).draftPersistenceState
    : undefined

  if (
    callbackPayload.ok
    && (
      toolName === 'editor_set_field_formulas'
      || toolName === 'editor_set_field_options'
      || toolName === 'editor_bind_field_source'
    )
    && toolDraftPersistenceState !== undefined
  ) {
    const formulaTargetResults = Array.isArray((toolOutput as Record<string, unknown> | null)?.formulaTargetResults)
      ? (toolOutput as Record<string, unknown>).formulaTargetResults as FormulaTargetResultLike[]
      : []
    if (
      toolDraftPersistenceState === null
      && previousDraftPersistenceStateForCompletion
      && hasHistoricalDraftIssueListCompletionState(previousRawDraftPersistenceStateForCompletion)
    ) {
      const resolvedDraftPersistenceState = buildResolvedDraftPersistenceState(previousDraftPersistenceStateForCompletion, {
        resolvedAt: Date.now(),
        sourceTraceId: normalizeTraceId(payload.metadata?.traceId || assistantMessage?.traceId || assistantMessage?.metadata?.traceId),
        sourceBlueprintVersionKey: getCurrentBlueprintVersionKey(),
        sourceBlueprintIdentityKey: getCurrentBlueprintIdentityKey(),
      })
      stagedBlueprint.value.draftPersistenceState = resolvedDraftPersistenceState
      if (assistantMessage) {
        ensureMessageMetadata(assistantMessage).draftIssueActionList = resolvedDraftPersistenceState
      }
      callbackPayload.metadata = {
        ...(callbackPayload.metadata || {}),
        ...buildDraftCompletionSyncMetadata(
          resolvedDraftPersistenceState,
          formulaTargetResults,
        ),
      }
    } else {
      stagedBlueprint.value.draftPersistenceState = toolDraftPersistenceState
      const postFormFlowMetadata = resolveDeferredPostFormFlowMetadataAfterDraftRefresh({
        draftPersistenceState: toolDraftPersistenceState,
        formulaTargetResults,
      })
      if (postFormFlowMetadata) {
        callbackPayload.metadata = {
          ...(callbackPayload.metadata || {}),
          planningScope: postFormFlowMetadata.planningScope,
          pendingFlowIntent: postFormFlowMetadata.pendingFlowIntent,
          postFormFlowSignals: postFormFlowMetadata.postFormFlowSignals,
          postFormFlowRelease: postFormFlowMetadata.postFormFlowRelease,
          postFormFlowOpportunity: postFormFlowMetadata.postFormFlowOpportunity,
          postFormFlowFollowUp: postFormFlowMetadata.postFormFlowFollowUp,
        }
      }
    }
    syncMessagesWithStagedState()
    emitStagedStateChange()
  }

  if (shouldPostClientToolResultBeforeUiHydration && !hasPostedClientToolResult) {
    await axios.post('/ai/chat/client-tool-result', callbackPayload)
    hasPostedClientToolResult = true
  }

  if (
    callbackPayload.ok
    && toolName.startsWith('editor_')
    && (
      toolName.includes('outline')
      || toolName === 'editor_stage_app_plan'
      || toolName === 'editor_stage_single_form_plan'
      || toolName === 'editor_apply_staged_flow'
      || toolName.includes('blueprint')
      || toolName === 'editor_stage_content_plan'
      || toolName === 'editor_stage_formula_plan'
    )
  ) {
    if (toolName === 'editor_stage_formula_plan') {
      const block = buildFormulaPlanArtifactBlock(callbackPayload.output)
      if (block?.formulaPlan && block.sourceContext) {
        stagedFormulaPlan.value = {
          origin: (callbackPayload.output as Record<string, unknown> | undefined)?.origin === 'blueprint'
            ? 'blueprint'
            : 'standalone',
          planningScope: block.planningScope || 'local',
          revision: Number(block.revision || 0),
          stagedAt: Number(block.stagedAt || 0),
          sourceContext: block.sourceContext,
          plan: block.formulaPlan,
          formulaPlanFingerprint: String((callbackPayload.output as Record<string, unknown> | undefined)?.formulaPlanFingerprint || '').trim(),
        }
      }
    }
    await refreshStagedState()
    if (toolName === 'editor_stage_app_blueprint') {
      applyBlueprintLateQuestionProjectionToStagedState(
        callbackPayload.metadata?.planningConvergenceLateQuestions,
      )
    }
    if (toolName === 'editor_apply_staged_app_blueprint' && callbackPayload.output) {
      const result = callbackPayload.output as NocodeEditorAiBlueprintApplyResult
      if (result.persistenceMode !== 'draft_only') {
        emitBlueprintApplied(result)
      } else if (assistantMessage && result.draftPersistenceState) {
        ensureMessageMetadata(assistantMessage).draftIssueActionList = result.draftPersistenceState
      }
    }
    const artifactBlocks = buildToolResultArtifactBlocks(toolName, assistantMessage, callbackPayload.output)
    const draftIssueActionList = toolName === 'editor_apply_staged_app_blueprint'
      ? (callbackPayload.output as NocodeEditorAiBlueprintApplyResult | undefined)?.draftPersistenceState || null
      : undefined
    const flowIssueActionList = toolName === 'editor_apply_staged_flow'
      ? (callbackPayload.output as NocodeEditorAiFlowApplyResult | undefined)?.flowIssueState || null
      : undefined
    if (toolName === 'editor_apply_staged_flow' && assistantMessage) {
      const flowResult = (callbackPayload.output as NocodeEditorAiFlowApplyResult | undefined) || null
      const flowBlock = artifactBlocks.find(block => block.kind === 'flow-plan') || null
      const clientRenderedMetadata = buildClientRenderedFlowApplyMetadata({
        traceId,
        block: flowBlock,
        result: flowResult,
      })
      if (flowResult) {
        assistantMessage.content = formatFlowApplyResultMessage(flowResult)
      }
      const assistantMetadata = ensureMessageMetadata(assistantMessage)
      Object.assign(assistantMetadata, clientRenderedMetadata, {
        clientRenderedToolResult: true,
      })
      if (flowBlock) {
        upsertMessageArtifactBlock(assistantMessage, {
          ...flowBlock,
          status: flowBlock.status || 'ready',
        })
      }
      callbackPayload.metadata = {
        ...(callbackPayload.metadata || {}),
        ...clientRenderedMetadata,
        clientRenderedAssistantContent: assistantMessage.content,
        clientRenderedAssistantMetadata: {
          ...assistantMetadata,
        },
        suppressPersistedSummary: true,
        suppressSummaryContent: true,
        suppressStreamBlocks: true,
      }
      if (shouldAutoScrollToBottom()) {
        await scrollToBottom()
      }
    }
    if (!artifactBlocks.length && draftIssueActionList && assistantMessage) {
      removeBlueprintLoadingArtifactBlock(assistantMessage)
      if (shouldAutoScrollToBottom()) {
        await scrollToBottom()
      }
    }
    if (artifactBlocks.length) {
      if (assistantMessage) {
        artifactBlocks.forEach((block) => {
          upsertMessageArtifactBlock(assistantMessage, {
            ...block,
            status: block.status || 'ready',
          })
        })
        if (toolName === 'editor_apply_staged_flow') {
          syncHistoricalAppliedFlowArtifacts()
        }
        if (shouldAutoScrollToBottom()) {
          await scrollToBottom()
        }
      }
    }
    if (artifactBlocks.length || draftIssueActionList || flowIssueActionList) {
      callbackPayload.metadata = {
        ...(callbackPayload.metadata || {}),
        ...(toolName === 'editor_apply_staged_app_blueprint'
          ? { blueprintAppliedFromAction: true }
          : {}),
        blocks: artifactBlocks,
        artifactBlocks,
        draftIssueActionList,
        flowIssueActionList,
        formPlanPresentation: toolName === 'editor_stage_single_form_plan'
          ? artifactBlocks.find(block => block.kind === 'form-plan')?.formPlanPresentation
          : undefined,
      }
    }
  }

  if (hasPostedClientToolResult) {
    return
  }

  if (controller.signal.aborted) {
    return
  }

  await axios.post('/ai/chat/client-tool-result', callbackPayload)
}

const handleLocateDraftIssue = async (issue: NocodeEditorAiDraftActionIssue) => {
  try {
    const result = await props.runtime.locateDraftIssue(issue)
    if (!result.ok) {
      ElMessage.warning(result.message || i18next.t('nocodeEditorAiPanel.configItemLocateFailed'))
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

const handleLocateFlowIssue = async (issue: NocodeEditorAiFlowActionIssue) => {
  try {
    const result = await props.runtime.locateFlowIssue(issue)
    if (!result.ok) {
      ElMessage.warning(result.message || i18next.t('nocodeEditorAiPanel.flowNodeLocateFailed'))
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

const handleApplyBlueprint = async (
  options: {
    onConfirmed?: () => void
    confirmationBlock?: NocodeEditorAiArtifactBlock | null
    skipConfirmation?: boolean
    applyScope?: NocodeEditorAiBlueprintApplyScope
    targetFormKeys?: string[]
  } = {},
) => {
  if (isPreparingSubmit.value || isResponding.value || isApplyingBlueprint.value) {
    return
  }
  let blueprintApplyProgressTraceId = ''
  let totalFormCount = 0
  let completedFormCount = 0
  let isSavingPreviousBlueprint = false
  let hasWarnedPerFormProgressPersistFailure = false
  try {
    if (!options.skipConfirmation) {
      await ensureBlueprintApplyConfirmed({
        confirmationBlock: options.confirmationBlock,
      })
    }
    options.onConfirmed?.()
    isApplyingBlueprint.value = true
    blueprintApplyProgressTraceId = await startBlueprintApplyProgressMessage()
    await updateBlueprintApplyProgressMessage({
      traceId: blueprintApplyProgressTraceId,
      content: buildApplyProgressNarrationContent({
        progressLines: [],
      }),
    })
    await waitForBlueprintApplyUiFeedback()
    const targetFormKeys = Array.isArray(options.targetFormKeys)
      ? options.targetFormKeys.map(value => String(value || '').trim()).filter(Boolean)
      : undefined
    const pendingIdentityKeysForAppliedScope = stagedBlueprint.value.blueprint
      ? collectPendingBlueprintIdentityKeysByTargetFormKeys(
        pendingBlueprintWorkspace.value.currentItems,
        {
          blueprint: stagedBlueprint.value.blueprint,
          revision: Number(stagedBlueprint.value.revision || 0),
          stagedAt: Number(stagedBlueprint.value.stagedAt || 0),
          sourcePlanningContextKey: stagedBlueprint.value.sourcePlanningContextKey || null,
          targetFormKeys,
        },
      )
      : []
    const applyOptions = {
      scope: options.applyScope,
      targetFormKeys: Array.isArray(targetFormKeys) ? targetFormKeys : undefined,
      onProgress: async (payload) => {
        if (payload.stage === 'saving-previous-blueprint') {
          isSavingPreviousBlueprint = true
          await updateBlueprintApplyProgressMessage({
            traceId: blueprintApplyProgressTraceId,
            content: buildApplyProgressNarrationContent({
              progressLines: buildApplyProgressStatusLines({
                savingPreviousBlueprint: true,
                totalFormCount,
                completedFormCount,
              }),
            }),
          })
          return
        }
        if (payload.stage === 'detected') {
          isSavingPreviousBlueprint = false
          totalFormCount = Math.max(0, Number(payload.totalFormCount || 0))
        }
        if (payload.stage === 'form-completed' && payload.formResult) {
          isSavingPreviousBlueprint = false
          totalFormCount = Math.max(totalFormCount, Number(payload.totalFormCount || 0))
          completedFormCount += 1
          const content = formatBlueprintApplyFormProgressMessage(payload.formResult)
          const traceId = createTurnTraceId()
          const metadata = {
            scene: 'nocode-editor',
            traceId,
            blueprintApplyStartedFromAction: true,
            blueprintApplyProgressItem: true,
            blueprintApplyParentTraceId: blueprintApplyProgressTraceId,
          }
          await pushAssistantMessage(content, traceId, metadata)
          try {
            await persistAssistantMessage(content, traceId, metadata)
          } catch (syncError) {
            console.error('Persist per-form blueprint progress message failed:', syncError)
            if (!hasWarnedPerFormProgressPersistFailure) {
              hasWarnedPerFormProgressPersistFailure = true
              ElMessage.warning(i18next.t('nocodeEditorAiPanel.formProgressSyncFailed'))
            }
          }
        }
        await updateBlueprintApplyProgressMessage({
          traceId: blueprintApplyProgressTraceId,
          content: buildApplyProgressNarrationContent({
            progressLines: buildApplyProgressStatusLines({
              savingPreviousBlueprint: isSavingPreviousBlueprint,
              totalFormCount,
              completedFormCount,
            }),
          }),
        })
      },
    }
    const recovery = await applyBlueprintWithUnsavedFormRecovery({
      apply: async () => await props.runtime.applyStagedAppBlueprint(applyOptions),
      confirmSaveAndContinue: async () => {
        try {
          await openBlueprintApplyConfirmDialog({
            title: i18next.t('nocodeEditorAiPanel.saveCurrentFormContinueTitle'),
            summaryText: i18next.t('nocodeEditorAiPanel.unsavedFormChanges'),
            riskText: i18next.t('nocodeEditorAiPanel.unsavedFormChangesRisk'),
            recommendationText: i18next.t('nocodeEditorAiPanel.saveFormContinueRecommendation'),
            pendingQuestionCount: 0,
            confirmText: i18next.t('nocodeEditorAiPanel.saveAndContinue'),
            cancelText: i18next.t('nocodeEditorAiPanel.deferGenerate'),
          })
          return true
        } catch (confirmError) {
          if (isBlueprintApplyConfirmDismissed(confirmError)) {
            return false
          }
          throw confirmError
        }
      },
      saveCurrentForm: async () => {
        if (!props.runtime.saveCurrentFormBeforeBlueprintApply) {
          return { ok: false, message: i18next.t('nocodeEditorAiPanel.formSaveUnavailable') }
        }
        return await props.runtime.saveCurrentFormBeforeBlueprintApply()
      },
    })
    if (recovery.status === 'cancelled') {
      await finishBlueprintApplyProgressMessage({
        traceId: blueprintApplyProgressTraceId,
        content: buildApplyProgressNarrationContent({
          progressLines: buildApplyProgressStatusLines({
            totalFormCount,
            completedFormCount,
          }),
          resultMessage: i18next.t('nocodeEditorAiPanel.blueprintGenerationCancelled'),
        }),
      })
      return
    }
    const result = recovery.result
    await refreshStagedState()
    if (result.persistenceMode !== 'draft_only') {
      emitBlueprintApplied(result, {
        targetFormKeys: options.targetFormKeys,
        pendingIdentityKeys: pendingIdentityKeysForAppliedScope,
      })
    }
    const blueprintApplyPostFormFlowMetadata = resolveBlueprintApplyPostFormFlowMetadata({
      entryFlowIntent: resolveActiveEntryFlowIntent(),
      result,
    })
    const pendingFlowIntent = blueprintApplyPostFormFlowMetadata.pendingFlowIntent
    localPendingFlowIntent.value = pendingFlowIntent
    const appliedBlueprint = buildScopedBlueprintByApplyResult(stagedBlueprint.value.blueprint, result)
      || buildScopedBlueprintByTargetFormKeys(stagedBlueprint.value.blueprint, options.targetFormKeys)
    const blueprintBlock = appliedBlueprint
      ? buildBlueprintArtifactBlock(stagedBlueprint.value, {
        blueprint: appliedBlueprint,
        applyResult: result,
      })
      : buildBlueprintArtifactBlock(stagedBlueprint.value)
    const metadata = buildApplyResultMessageMetadata(
      result,
      blueprintApplyProgressTraceId,
      blueprintBlock,
      pendingFlowIntent || null,
      blueprintApplyPostFormFlowMetadata.postFormFlowOpportunity,
      blueprintApplyPostFormFlowMetadata.postFormFlowFollowUp,
      blueprintApplyPostFormFlowMetadata.postFormFlowRelease,
    )
    const content = buildApplyProgressNarrationContent({
      progressLines: buildApplyProgressStatusLines({
        totalFormCount: totalFormCount || result.forms.length,
        completedFormCount: completedFormCount || result.forms.length,
      }),
      resultMessage: formatApplyResultMessage(result),
      followUpLines: buildApplyInlineFollowUpLines(blueprintApplyPostFormFlowMetadata.postFormFlowFollowUp),
    })
    await finishBlueprintApplyProgressMessage({
      traceId: blueprintApplyProgressTraceId,
      content,
      metadata,
    })
    syncActionAppliedBlueprintHistory()
    try {
      await persistAssistantMessage(content, blueprintApplyProgressTraceId, metadata)
    } catch (syncError) {
      console.error('Persist applied blueprint message failed:', syncError)
      ElMessage.warning(i18next.t('nocodeEditorAiPanel.blueprintAppliedStateSyncFailed'))
    }
    return result
  } catch (error) {
    if (isBlueprintApplyConfirmDismissed(error)) {
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(message)
    if (blueprintApplyProgressTraceId) {
      await finishBlueprintApplyProgressMessage({
        traceId: blueprintApplyProgressTraceId,
        content: buildApplyProgressNarrationContent({
          progressLines: buildApplyProgressStatusLines({
            totalFormCount,
            completedFormCount,
          }),
          resultMessage: i18next.t('nocodeEditorAiPanel.blueprintApplyFailed', { message }),
        }),
      })
    } else {
      await pushAssistantMessage(i18next.t('nocodeEditorAiPanel.blueprintApplyFailed', { message }))
    }
    throw error
  } finally {
    isApplyingBlueprint.value = false
  }
}

const handleApplyBlueprintFromPreview = async () => {
  const result = await handleApplyBlueprint({
    onConfirmed: closePreviewArtifact,
    confirmationBlock: previewArtifact.value,
  })
  if (!result) {
    return result
  }

  return result
}

const formatFlowApplyResultMessage = (result: NocodeEditorAiFlowApplyResult) => {
  const summary = result.summary
  const warnings = Array.isArray(result.warnings)
    ? result.warnings.map(item => String(item || '').trim()).filter(Boolean)
    : []
  return [
    i18next.t('nocodeEditorAiPanel.flowAppliedTitle'),
    i18next.t('nocodeEditorAiPanel.flowAppliedSummary', { triggerBranchCount: Number(summary.triggerBranchCount || 0), totalNodeCount: Number(summary.totalNodeCount || 0), branchCount: Number(summary.branchCount || 0) }),
    warnings.length ? i18next.t('nocodeEditorAiPanel.flowAppliedWarnings', { warnings: warnings.join(i18next.t('nocodeEditorAiPanel.semicolonSeparator')) }) : '',
  ].filter(Boolean).join('\n')
}

function buildClientRenderedFlowApplyMetadata(input: {
  traceId?: string
  block?: NocodeEditorAiArtifactBlock | null
  result?: NocodeEditorAiFlowApplyResult | null
}) {
  const flowUnifiedIssues = Array.isArray(input.result?.flowUnifiedIssues)
    ? input.result.flowUnifiedIssues
    : undefined
  const flowIssueRouting = (
    input.result?.flowIssueRouting
    && typeof input.result.flowIssueRouting === 'object'
    && !Array.isArray(input.result.flowIssueRouting)
  )
    ? input.result.flowIssueRouting
    : undefined
  return {
    scene: 'nocode-editor' as const,
    traceId: String(input.traceId || '').trim() || undefined,
    flowAppliedFromAction: true,
    clientRenderedToolResult: true,
    blocks: input.block ? [input.block] : [],
    artifactBlocks: input.block ? [input.block] : [],
    flowIssueActionList: input.result?.flowIssueState || null,
    flowUnifiedIssues,
    flowIssueRouting,
  }
}

const applyFlowArtifactBlock = async (
  block: NocodeEditorAiArtifactBlock,
  options: {
    closePreviewOnSuccess?: boolean
  } = {},
) => {
  if (!canApplyFlowFromPreview(block)) {
    return
  }

  isApplyingFlow.value = true
  try {
    const result = await props.runtime.applyStagedFlow()
    await refreshStagedState()
    if (options.closePreviewOnSuccess) {
      closePreviewArtifact()
    }

    const traceId = createTurnTraceId()
    const flowBlock = buildFlowPlanArtifactBlock(stagedFlowPlan.value)
    const content = formatFlowApplyResultMessage(result)
    const latestPendingFlowIntent = resolveActivePendingFlowIntent()
    const completedPendingFlowIntent = completePendingFlowIntentForTarget({
      pendingFlowIntent: latestPendingFlowIntent,
      targetFormId: String(currentHostContext.value?.activeFormId || '').trim() || undefined,
      targetFormName: String(currentHostContext.value?.activeFormName || '').trim() || undefined,
    })
    if (completedPendingFlowIntent) {
      localPendingFlowIntent.value = completedPendingFlowIntent
    }
    const metadata = {
      scene: 'nocode-editor',
      traceId,
      flowAppliedFromAction: true,
      blocks: flowBlock ? [flowBlock] : [],
      pendingFlowIntent: completedPendingFlowIntent || undefined,
    }

    await pushAssistantMessage(content, traceId, metadata)
    syncHistoricalAppliedFlowArtifacts()
    try {
      await persistAssistantMessage(content, traceId, metadata)
    } catch (syncError) {
      console.error('Persist applied flow message failed:', syncError)
      ElMessage.warning(i18next.t('nocodeEditorAiPanel.flowAppliedStateSyncFailed'))
    }
    return result
  } catch (error) {
    try {
      await refreshStagedState()
    } catch (refreshError) {
      console.error('Refresh staged flow state after apply failure failed:', refreshError)
    }
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(message)
    await pushAssistantMessage(i18next.t('nocodeEditorAiPanel.flowApplyFailed', { message }))
    throw error
  } finally {
    isApplyingFlow.value = false
  }
}

const handleApplyFlowFromPreview = async (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const targetBlock = block || previewArtifact.value
  if (!targetBlock) {
    return
  }

  closePreviewArtifact()
  return await applyFlowArtifactBlock(targetBlock, {
    closePreviewOnSuccess: false,
  })
}

const applyPendingBlueprint = async (
  item: NocodeEditorAiStageBlueprintDisplayItem,
  options: {
    skipConfirmation?: boolean
    applyScope?: NocodeEditorAiBlueprintApplyScope
    targetFormKeys?: string[]
  } = {},
) => {
  const targetFormKeys = options.targetFormKeys || resolvePendingBlueprintTargetFormKeys([item])
  await restorePendingBlueprintItemForAction(item)
  return await handleApplyBlueprint({
    skipConfirmation: options.skipConfirmation,
    applyScope: options.applyScope || 'single',
    targetFormKeys,
  })
}

const applyPendingBlueprintBatch = async (payload: {
  items: NocodeEditorAiStageBlueprintDisplayItem[]
  scope: Exclude<NocodeEditorAiBlueprintApplyScope, 'single'>
}) => {
  const pendingItems = payload.items.filter(item => isStagedBlueprintItem(item))
  const pendingBatches = collectPendingBlueprintApplyBatches(pendingItems)
  try {
    await ensurePendingBlueprintBatchApplyConfirmed(pendingItems)
  } catch (error) {
    if (isBlueprintApplyConfirmDismissed(error)) {
      return
    }
    throw error
  }

  for (const batch of pendingBatches) {
    const targetFormKeys = resolvePendingBlueprintTargetFormKeys(batch.items)
    const result = await applyPendingBlueprint(batch.item, {
      skipConfirmation: true,
      applyScope: payload.scope,
      targetFormKeys,
    })
    if (shouldStopPendingBlueprintBatch(result)) {
      break
    }
  }
}

const buildPendingBlueprintConfirmationBlock = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
) => {
  if (!item?.blueprint || !isStagedBlueprintItem(item)) {
    return null
  }

  return buildBlueprintArtifactBlock(createStagedBlueprintState({
    planningScope: normalizeNocodeEditorPlanningScopeValue(item.planningScope),
    revision: Number(item.revision || 0),
    stagedAt: item.stagedAt,
    blueprint: item.blueprint,
    sourcePlanningContextKey: String(item.sourcePlanningContextKey || '').trim() || null,
  }), {
    displayRevision: item.displayRevision,
    displayVersionLabel: item.displayVersionLabel,
  })
}

const resolvePendingBlueprintTargetFormKeys = (
  items: NocodeEditorAiStageBlueprintDisplayItem[],
) => {
  const keys = new Set<string>()

  for (const item of Array.isArray(items) ? items : []) {
    const forms = Array.isArray(item.blueprint?.forms) ? item.blueprint.forms : []
    for (const form of forms) {
      const formKey = getNocodeEditorBlueprintFormApplyTargetIdentity(form)
      if (formKey) {
        keys.add(formKey)
      }
    }
  }

  return Array.from(keys)
}

const getPendingBlueprintConfirmationResponseDrafts = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
) => {
  const block = buildPendingBlueprintConfirmationBlock(item)
  return block ? getConfirmationResponseDrafts(block) : {}
}

const getPendingBlueprintActiveInputQuestionIds = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
) => {
  const block = buildPendingBlueprintConfirmationBlock(item)
  return block ? getActiveConfirmationInputQuestionIds(block) : []
}

const getPendingBlueprintInlineConfirmationNoteQuestionIds = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
) => {
  const block = buildPendingBlueprintConfirmationBlock(item)
  return block ? getInlineConfirmationNoteQuestionIds(block) : []
}

const findPendingBlueprintItemForConfirmationBlock = (
  block: NocodeEditorAiArtifactBlock,
) => {
  if (block.kind !== 'blueprint') {
    return null
  }

  const blockDraftKey = buildConfirmationDraftKey(block)
  if (!blockDraftKey) {
    return null
  }

  const pendingItems = [
    ...pendingBlueprintsForStage.value,
    ...pendingBlueprintHistory.value,
  ]

  return pendingItems.find((item) => {
    const itemBlock = buildPendingBlueprintConfirmationBlock(item)
    return itemBlock && buildConfirmationDraftKey(itemBlock) === blockDraftKey
  }) || null
}

const restorePendingBlueprintConfirmationBlock = async (payload: {
  item?: NocodeEditorAiStageBlueprintDisplayItem | null
  block: NocodeEditorAiArtifactBlock
}) => {
  const item = payload.item || findPendingBlueprintItemForConfirmationBlock(payload.block)
  if (!item) {
    return payload.block
  }

  return await restorePendingBlueprintItemForAction(item) || payload.block
}

const handleSelectPendingBlueprintConfirmationOption = (payload: {
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
  option: NocodeEditorAiConfirmQuestionOption
}) => {
  handleSelectConfirmationOption(payload)
}

const handleTogglePendingBlueprintInlineConfirmationInput = (payload: {
  item: NocodeEditorAiStageBlueprintDisplayItem
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
}) => {
  handleToggleBlueprintInlineConfirmationInput({
    block: payload.block,
    question: payload.question,
  })
}

const handleUpdatePendingBlueprintInlineConfirmationNote = (payload: {
  item: NocodeEditorAiStageBlueprintDisplayItem
  block: NocodeEditorAiArtifactBlock
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  handleUpdateBlueprintInlineConfirmationNote({
    block: payload.block,
    question: payload.question,
    note: payload.note,
  })
}

const handleSubmitPendingBlueprintConfirmationResponses = async (payload: {
  item: NocodeEditorAiStageBlueprintDisplayItem
  block: NocodeEditorAiArtifactBlock
}) => {
  const submitBlock = await restorePendingBlueprintConfirmationBlock(payload)
  await submitStagedConfirmationResponses(submitBlock, {
    closeDrawerOnSuccess: true,
  })
}

const continuePendingBlueprintAdjustment = async (item: NocodeEditorAiStageBlueprintDisplayItem) => {
  const block = await restorePendingBlueprintItemForAction(item)
  setComposerDraft(buildBlueprintAdjustmentPrompt(block))
  closePreviewArtifact()
  await nextTick()
  chatInputRef.value?.updateTextareaHeight?.()
  await focusTextarea()
}

const openGeneratedBlueprintPage = async (payload: NocodeEditorAiGeneratedBlueprintPageTarget) => {
  const openTarget = resolveGeneratedBlueprintOpenTarget(payload)

  if (!openTarget?.tableId && !openTarget?.tableName) {
    throw new Error(i18next.t('nocodeEditorAiPanel.noGeneratedPageToOpen'))
  }

  await props.runtime.openForm({
    tableId: openTarget.tableId,
    tableName: openTarget.tableName,
    tab: payload.tab,
  })
}

const resolveToolCallFlowBlueprintPreflightPhase = (
  metadata?: Record<string, unknown> | null,
) => {
  const phase = String(metadata?.flowBlueprintPreflightPhase || '').trim()
  return phase === 'summary' || phase === 'examples' || phase === 'waiting_blueprint'
    ? phase
    : ''
}

const addLoadingArtifactForTool = (
  message: NocodeEditorAiMessage,
  toolName: string,
  metadata?: Record<string, unknown> | null,
) => {
  if (toolName === 'editor_stage_app_plan') {
    upsertMessageArtifactBlock(message, buildLoadingArtifactBlock('app-plan', i18next.t('nocodeEditorAiPanel.organizingAppPlanWithEllipsis')))
  }
  if (toolName === 'editor_stage_single_form_plan') {
    upsertMessageArtifactBlock(message, buildLoadingArtifactBlock('form-plan', i18next.t('nocodeEditorAiPanel.organizingFormPlanWithEllipsis')))
  }
  if (toolName === 'editor_stage_content_plan') {
    upsertMessageArtifactBlock(message, buildLoadingArtifactBlock('content-plan', i18next.t('nocodeEditorAiPanel.organizingContentPlanWithEllipsis')))
  }
  if (toolName === 'editor_stage_formula_plan') {
    upsertMessageArtifactBlock(message, buildLoadingArtifactBlock(
      'formula-plan',
      i18next.t('formulaPlanPresentation.loading'),
      { formulaPresentation: buildNocodeEditorFormulaPlanLoadingPresentation() },
    ))
  }
  if (toolName === 'editor_plan_flow_scheme') {
    upsertMessageArtifactBlock(message, buildLoadingArtifactBlock('flow-scheme', i18next.t('nocodeEditorAiPanel.organizingFlowSchemeWithEllipsis')))
  }
  if (toolName === 'editor_get_flow_summary') {
    const planningContextKey = resolveLatestFlowSchemePlanningContextKey()
    if (resolveToolCallFlowBlueprintPreflightPhase(metadata) === 'summary' && planningContextKey) {
      upsertMessageArtifactBlock(message, buildLoadingArtifactBlock(
        'flow-plan',
        '正在结合当前表单字段、组织信息和流程摘要做生成前校验...',
        {
          planningContextKey,
          preflightPhase: 'summary',
        },
      ))
    }
  }
  if (toolName === 'editor_get_flow_node_examples') {
    const planningContextKey = resolveLatestFlowSchemePlanningContextKey()
    if (resolveToolCallFlowBlueprintPreflightPhase(metadata) === 'examples' && planningContextKey) {
      upsertMessageArtifactBlock(message, buildLoadingArtifactBlock(
        'flow-plan',
        '正在补齐本次流程节点所需的结构示例...',
        {
          planningContextKey,
          preflightPhase: 'examples',
        },
      ))
    }
  }
  if (toolName === 'editor_stage_flow_blueprint') {
    const planningContextKey = resolveLatestFlowSchemePlanningContextKey()
    upsertMessageArtifactBlock(message, buildLoadingArtifactBlock(
      'flow-plan',
      getFlowBlueprintExpansionLoadingMessage(),
      {
        planningContextKey,
        preflightPhase: 'waiting_blueprint',
      },
    ))
  }
  if (toolName === 'editor_apply_staged_flow') {
    upsertMessageArtifactBlock(message, buildLoadingArtifactBlock('flow-plan', i18next.t('nocodeEditorAiPanel.applyingFlowWithEllipsis')))
  }
  if (toolName === 'editor_stage_app_blueprint') {
    const continuationContext = buildBlueprintContinuationContext()
    const planningContextKey = (
      resolveLatestCompletedPlanningConfirmation({
        planningContextKey: continuationContext.planningContextKey,
        planningContextKeys: continuationContext.planningContextKeys,
        traceId: normalizeTraceId(message.traceId || message.metadata?.traceId),
      })?.planningContextKey
      || continuationContext.planningContextKey
    )
    upsertMessageArtifactBlock(message, buildLoadingArtifactBlock(
      'blueprint',
      i18next.t('nocodeEditorAiPanel.expandingDetailedBlueprint'),
      {
        planningContextKey,
      },
    ))
  }
  if (toolName === 'editor_apply_staged_app_blueprint') {
    const planningContextKey = String(stagedBlueprint.value.sourcePlanningContextKey || '').trim()
    upsertMessageArtifactBlock(
      message,
      buildLoadingArtifactBlock(
        'blueprint',
        formatBlueprintApplyProgressMessage({
          blueprint: stagedBlueprint.value.blueprint,
          persistenceMode: stagedBlueprint.value?.draftPersistenceState ? 'draft_only' : 'saved',
        }),
        {
          planningContextKey,
        },
      ),
    )
  }
}

const applyToolResultArtifactsToMessage = async (
  message: NocodeEditorAiMessage,
  payload: NocodeEditorAiChatStreamPayload,
) => {
  const metadata = payload.metadata || {}
  const toolName = String(metadata.toolName || '').trim()
  const ok = metadata.ok === undefined ? true : Boolean(metadata.ok)
  const streamedDraftIssueActionList = toolName === 'editor_apply_staged_app_blueprint'
    ? resolveStreamedDraftOnlyBlueprintActionList(metadata)
    : null
  const clientRenderedToolResult = metadata.clientRenderedToolResult === true
  const streamedFlowIssueActionList = toolName === 'editor_apply_staged_flow'
    ? ((metadata.flowIssueActionList as NocodeEditorAiFlowIssueState | null | undefined)?.mode === 'flow_issue'
      ? metadata.flowIssueActionList as NocodeEditorAiFlowIssueState
      : null)
    : null
  const ignoredGuardFailure = Boolean(
    metadata.duplicateBlocked
    || metadata.toolPolicyViolation
    || metadata.blockedByPlanningScope
    || (metadata.blockedByFlowApplyAuthorization && metadata.suppressedIntermediateSummary),
  )
  const summaryContent = typeof metadata.summaryContent === 'string'
    ? metadata.summaryContent.trim()
    : ''
  const messageBlocks = resolveStreamMessageBlocks(metadata)
  const incomingSummaryStage = resolveIncomingSummaryStage(metadata)
  let shouldScroll = false

  if (clientRenderedToolResult && toolName === 'editor_apply_staged_flow') {
    return
  }

  if (incomingSummaryStage) {
    pruneMessageBlocksForIncomingSummaryStage(message, incomingSummaryStage)
  }

  const hasPostFormFlowSignals = Object.prototype.hasOwnProperty.call(metadata, 'postFormFlowSignals')
  const hasPostFormFlowOpportunity = Object.prototype.hasOwnProperty.call(metadata, 'postFormFlowOpportunity')
  const hasPostFormFlowFollowUp = Object.prototype.hasOwnProperty.call(metadata, 'postFormFlowFollowUp')
  const hasPostFormFlowRelease = Object.prototype.hasOwnProperty.call(metadata, 'postFormFlowRelease')
  const hasPlanningScope = Object.prototype.hasOwnProperty.call(metadata, 'planningScope')

  if (
    summaryContent
    || hasPostFormFlowSignals
    || hasPostFormFlowOpportunity
    || hasPostFormFlowFollowUp
    || hasPostFormFlowRelease
    || hasPlanningScope
  ) {
    message.metadata = {
      ...(message.metadata || {}),
      ...(incomingSummaryStage
        ? { summaryStage: incomingSummaryStage }
        : {}),
      continuityHints: Array.isArray(metadata.continuityHints)
        ? metadata.continuityHints
        : message.metadata?.continuityHints,
      formulaActions: Array.isArray(metadata.formulaActions)
        ? mergeNocodeEditorFormulaActions(message.metadata?.formulaActions, metadata.formulaActions)
        : message.metadata?.formulaActions,
      formulaTargetResults: Array.isArray(metadata.formulaTargetResults)
        ? mergeNocodeEditorFormulaTargetResults(message.metadata?.formulaTargetResults, metadata.formulaTargetResults)
        : message.metadata?.formulaTargetResults,
      persistenceMode: metadata.persistenceMode === 'draft_only'
        ? 'draft_only'
        : message.metadata?.persistenceMode,
      ...(hasPostFormFlowSignals
        ? { postFormFlowSignals: metadata.postFormFlowSignals ?? null }
        : {}),
      ...(hasPostFormFlowOpportunity
        ? { postFormFlowOpportunity: metadata.postFormFlowOpportunity ?? null }
        : {}),
      ...(hasPostFormFlowFollowUp
        ? { postFormFlowFollowUp: metadata.postFormFlowFollowUp ?? null }
        : {}),
      ...(hasPostFormFlowRelease
        ? { postFormFlowRelease: metadata.postFormFlowRelease ?? null }
        : {}),
      ...(hasPlanningScope
        ? { planningScope: normalizeNocodeEditorPlanningScopeValue(metadata.planningScope) }
        : {}),
    }
  }

  if (summaryContent) {
    message.content = applyNocodeEditorToolResultSummaryToAssistantContent({
      currentContent: message.content,
      thinkingText: getThinkingText(),
      streamKey: message.id,
      summaryContent,
      metadata,
    })
    shouldScroll = true
  }

  if (shouldMergeNocodeEditorToolResultBlocks(metadata, messageBlocks)) {
    mergeMessageBlocks(message, messageBlocks)
    shouldScroll = true
  }

  if (!ok) {
    if (ignoredGuardFailure) {
      if (metadata.blockedByPlanningScope && toolName === 'editor_stage_app_plan') {
        setMessageArtifactBlocks(
          message,
          getAllArtifactBlocks(message).filter(block => !(block.kind === 'app-plan' && block.status === 'loading')),
        )
      }
      return
    }

    if (toolName === 'editor_stage_app_plan') {
      upsertMessageArtifactBlock(message, buildErrorArtifactBlock('app-plan', String(metadata.error || payload.error || i18next.t('nocodeEditorAiPanel.appPlanGenerationFailed'))))
    }
    if (toolName === 'editor_stage_single_form_plan') {
      upsertMessageArtifactBlock(message, buildErrorArtifactBlock('form-plan', String(metadata.error || payload.error || i18next.t('nocodeEditorAiPanel.formPlanGenerationFailed'))))
    }
    if (toolName === 'editor_stage_content_plan') {
      upsertMessageArtifactBlock(message, buildErrorArtifactBlock('content-plan', String(metadata.error || payload.error || i18next.t('nocodeEditorAiPanel.contentPlanGenerationFailed'))))
    }
    if (toolName === 'editor_stage_formula_plan') {
      upsertMessageArtifactBlock(message, buildErrorArtifactBlock(
        'formula-plan',
        String(metadata.error || payload.error || i18next.t('formulaPlanPresentation.failed')),
        { formulaPresentation: { goal: i18next.t('formulaPlanPresentation.failed') } },
      ))
    }
    if (toolName === 'editor_plan_flow_scheme') {
      upsertMessageArtifactBlock(message, buildErrorArtifactBlock('flow-scheme', String(metadata.error || payload.error || i18next.t('nocodeEditorAiPanel.flowSchemeProcessFailed'))))
    }
    if (toolName === 'editor_stage_flow_blueprint') {
      const planningContextKey = resolveFlowBlueprintPlanningContextKeyForCallback(message)
      const flowIssueRouting = normalizeFlowIssueRoutingResult(metadata.flowIssueRouting)
      const groundingDiagnostics = Array.isArray(metadata.flowGroundingDiagnostics)
        ? metadata.flowGroundingDiagnostics as FlowSchemeConvergenceGroundingDiagnostic[]
        : []
      const flowGroundingQuestions = normalizeVisibleFlowGroundingQuestions({
        questions: metadata.flowGroundingQuestions,
        diagnostics: groundingDiagnostics,
        preferDiagnostics: true,
      })
      const groundingUserMessage = normalizeFlowGroundingUserMessage(metadata.flowGroundingUserMessage)
      const shouldUseGroundingRecovery = flowIssueRouting?.outcome === 'return_to_flow_scheme' && flowGroundingQuestions.length > 0
      if (shouldUseGroundingRecovery) {
        upsertFlowSchemeGroundingQuestions(message, flowGroundingQuestions, {
          planningContextKey,
          error: groundingUserMessage,
          title: resolveFlowGroundingReturnFlowSchemeTitle(metadata)
            || resolveLatestFlowSchemeTitleForPlanningContext(planningContextKey)
            || undefined,
          groundingDiagnostics: groundingDiagnostics.length ? groundingDiagnostics : undefined,
        })
      }
      upsertMessageArtifactBlock(message, buildErrorArtifactBlock(
        'flow-plan',
        shouldUseGroundingRecovery
          ? groundingUserMessage
          : normalizeFlowPlanArtifactErrorMessage(
            flowIssueRouting?.userMessage
              || metadata.error
              || payload.error
              || i18next.t('nocodeEditorAiPanel.flowBlueprintProcessFailed'),
          ),
        {
          planningContextKey,
        },
      ))
    }
    if (toolName === 'editor_apply_staged_flow') {
      const flowApplyErrorMessage = normalizeFlowPlanArtifactErrorMessage(
        metadata.error
          || payload.error
          || i18next.t('nocodeEditorAiPanel.flowBlueprintProcessFailed'),
      )
      upsertMessageArtifactBlock(message, buildErrorArtifactBlock('flow-plan', flowApplyErrorMessage))
    }
    if (toolName === 'editor_stage_app_blueprint' || toolName === 'editor_apply_staged_app_blueprint') {
      const planningContextKey = String(
        getBlueprintArtifactPlanningContextKey(getAllArtifactBlocks(message).find(block => (
          block.kind === 'blueprint' && block.status === 'loading'
        )) as NocodeEditorAiArtifactBlock)
        || stagedBlueprint.value.sourcePlanningContextKey
        || '',
      ).trim()
      upsertMessageArtifactBlock(message, buildErrorArtifactBlock(
        'blueprint',
        String(metadata.error || payload.error || i18next.t('nocodeEditorAiPanel.blueprintGenerationFailed')),
        {
          planningContextKey,
        },
      ))
    }
    if (shouldAutoScrollToBottom()) {
      await scrollToBottom()
    }
    return
  }

  if (toolName === 'editor_get_flow_node_examples') {
    const examplesLoadingBlock = [...getAllArtifactBlocks(message)]
      .reverse()
      .find(block => (
        block.kind === 'flow-plan'
        && block.status === 'loading'
        && resolveFlowBlueprintPreflightPhase(block) === 'examples'
      ))
    const waitingBlueprintBlock = resolveFlowBlueprintPreflightToolResultLoadingBlock({
      toolName,
      ok,
      block: examplesLoadingBlock,
    })
    if (waitingBlueprintBlock) {
      upsertMessageArtifactBlock(message, waitingBlueprintBlock)
      shouldScroll = true
    }
  }

  if (streamedDraftIssueActionList) {
    ensureMessageMetadata(message).draftIssueActionList = streamedDraftIssueActionList
    removeBlueprintLoadingArtifactBlock(message)
    shouldScroll = true
  }
  if (streamedFlowIssueActionList) {
    ensureMessageMetadata(message).flowIssueActionList = streamedFlowIssueActionList
    shouldScroll = true
  } else if (toolName === 'editor_apply_staged_flow') {
    const block = buildFlowPlanArtifactBlock(stagedFlowPlan.value)
    if (block) {
      upsertMessageArtifactBlock(message, block)
      syncHistoricalAppliedFlowArtifacts()
    }
    shouldScroll = true
  } else if (toolName === 'editor_apply_staged_app_blueprint') {
    const block = buildBlueprintArtifactBlock(stagedBlueprint.value)
    if (block) {
      upsertMessageArtifactBlock(message, block)
    }
    shouldScroll = true
  }

  if (shouldScroll) {
    await scrollToBottom()
  }
}

const submitMessage = async (
  rawContent: string,
  options?: {
    traceId?: string
    hiddenUserMessage?: boolean
    visibleUserContent?: string
    visibleUserMetadata?: Record<string, unknown>
    silentFailure?: boolean
    requestMetadata?: Record<string, unknown>
    attachments?: AiAttachment[]
    modelSelection?: AiThreadModelSelection | null
    importedHandoffContext?: NocodeEditorAiImportedHandoffContext
    editedFromMessageId?: string
    onUserMessageAccepted?: () => void
    onAssistantCompleted?: (assistantMessage: NocodeEditorAiMessage) => void | Promise<void>
  },
) => {
  const content = String(rawContent || '').trim()
  const visibleUserContent = String(
    options?.visibleUserContent !== undefined ? options.visibleUserContent : content,
  ).trim()
  const isHiddenTimelineRequest = isAiTimelineHiddenMessage(options?.requestMetadata || null)
  if (!content) {
    return 'not_started' as SubmitMessageResult
  }
  if (!canSubmitAiMessage(options?.silentFailure !== true)) {
    return 'not_started' as SubmitMessageResult
  }
  if (isPreparingSubmit.value || isResponding.value) {
    return 'not_started' as SubmitMessageResult
  }

  const preparationGeneration = submitPreparationGeneration.value + 1
  submitPreparationGeneration.value = preparationGeneration
  isPreparingSubmit.value = true
  const pendingModelSelectionSave = modelSelectionSaveRequest
  if (pendingModelSelectionSave) {
    await pendingModelSelectionSave
    if (!isActiveSubmitPreparation(preparationGeneration)) {
      if (submitPreparationGeneration.value === preparationGeneration) {
        invalidatePendingSubmitPreparation()
      }
      return 'not_started' as SubmitMessageResult
    }
  }

  const isImportedHandoffAutoReplay = options?.requestMetadata?.[IMPORTED_HANDOFF_AUTO_REPLAY_FLAG] === true
  let hasSwitchedToResponding = false
  let hasTerminalStreamEvent = false
  let didStartRequest = false
  let submitResult: SubmitMessageResult = 'not_started'
  let userMessagePersisted = false
  let preparedConversation: Awaited<ReturnType<typeof prepareConversationForSubmit>>
  try {
    preparedConversation = await prepareConversationForSubmit()
  } catch (error) {
    if (!isActiveSubmitPreparation(preparationGeneration)) {
      if (submitPreparationGeneration.value === preparationGeneration) {
        invalidatePendingSubmitPreparation()
      }
      return 'not_started'
    }
    isPreparingSubmit.value = false
    console.error('Prepare nocode editor AI submit failed:', error)
    return 'failed'
  }
  if (!isActiveSubmitPreparation(preparationGeneration)) {
    if (submitPreparationGeneration.value === preparationGeneration) {
      invalidatePendingSubmitPreparation()
    }
    return 'not_started'
  }
  const {
    hostContext,
    scopeKey,
    conversationId: currentConversationId,
    taskSeed: currentTaskSeed,
  } = preparedConversation
  let effectiveVisibleUserMetadata = options?.visibleUserMetadata
  let effectiveRequestMetadata = options?.requestMetadata
  if (options?.attachments?.length) {
    try {
      const uploadedAttachments = await prepareEditorAttachmentsForSend(
        currentConversationId,
        currentTaskSeed?.taskId,
        options.attachments,
        options.modelSelection || (
          modelSelectionSource.value === 'explicit'
            ? {
              modelSelectionSource: 'explicit',
              providerId: selectedProviderId.value,
              modelId: selectedModelId.value,
              model: selectedModel.value,
            }
            : { modelSelectionSource: 'default' }
        ),
      )
      const attachmentPayload = buildEditorAttachmentRequestMetadata(visibleUserContent, uploadedAttachments)
      effectiveVisibleUserMetadata = mergeEditorTurnMetadata(
        effectiveVisibleUserMetadata,
        attachmentPayload?.requestMetadata,
      )
      effectiveRequestMetadata = mergeEditorTurnMetadata(
        effectiveRequestMetadata,
        attachmentPayload?.requestMetadata,
      )
    } catch (error) {
      isPreparingSubmit.value = false
      ElMessage.error(
        resolveEditorAttachmentErrorMessage(error)
        || String(i18next.t('workbenchAiChat.attachmentErrors.uploadFailed')),
      )
      return 'failed' as SubmitMessageResult
    }
  }
  const settingTargetContext = settingContextHost?.getCurrentSettingTargetContext?.() || null
  const settingContext = settingContextHost?.getCurrentSettingContext?.() || null
  const shouldResolveTaskContext = shouldResolveNocodeEditorTaskContextForMessage({
    userMessage: visibleUserContent,
    editorMode: hostContext?.mode,
    activeFormId: hostContext?.activeFormId,
    hasSettingContext: Boolean(settingContext),
    hasSettingTargetContext: Boolean(settingTargetContext),
  })
  let taskContext: NocodeEditorAiTaskContext = null
  try {
    if (shouldResolveTaskContext) {
      props.runtime.resetTaskContextGuard()
      taskContext = await Promise.resolve(settingContextHost?.getCurrentTaskContext?.() || null)
    }
  } catch (error) {
    if (!isActiveSubmitPreparation(preparationGeneration)) {
      if (submitPreparationGeneration.value === preparationGeneration) {
        invalidatePendingSubmitPreparation()
      }
      return 'not_started'
    }
    isPreparingSubmit.value = false
    ElMessage.error(error instanceof Error ? error.message : 'AI 请求失败')
    console.error('Prepare nocode editor AI task context failed:', error)
    return 'failed'
  }
  if (!isActiveSubmitPreparation(preparationGeneration)) {
    if (submitPreparationGeneration.value === preparationGeneration) {
      invalidatePendingSubmitPreparation()
    }
    return 'not_started'
  }
  const editMetadata = options?.editedFromMessageId
    ? { editedFromMessageId: options.editedFromMessageId }
    : null
  if (editMetadata) {
    await rewindEditedMessageTail(editMetadata.editedFromMessageId)
  }
  const controller = new AbortController()
  const assistantId = createMessageId('assistant')
  const traceId = normalizeTraceId(options?.traceId) || createTurnTraceId()
  finalizeStoppedAssistantMessage()
  currentRespondingAssistantId.value = assistantId
  currentController.value = controller
  isResponding.value = true
  hasSwitchedToResponding = true
  isPreparingSubmit.value = false
  didStartRequest = true

  const userMessage: NocodeEditorAiMessage = {
    id: createMessageId('user'),
    role: NocodeEditorAiMessageRole.USER,
    content: visibleUserContent,
    sequence: 0,
    createTime: Date.now(),
    metadata: {
      ...(effectiveVisibleUserMetadata || {}),
      ...(editMetadata || {}),
    },
  }
  syncMessageTraceId(userMessage, traceId)
  if (!options?.hiddenUserMessage) {
    messages.value.push(userMessage)
  }
  const assistantMessage: NocodeEditorAiMessage = {
    id: assistantId,
    role: NocodeEditorAiMessageRole.ASSISTANT,
    content: getThinkingText(),
    sequence: 0,
    createTime: Date.now(),
    metadata: {
      blocks: [],
      ...(isHiddenTimelineRequest ? { hiddenFromTimeline: true } : {}),
    },
  }
  syncMessageTraceId(assistantMessage, traceId)
  messages.value.push(assistantMessage)
  setComposerDraft('')
  chatInputRef.value?.updateTextareaHeight?.()
  if (!isHiddenTimelineRequest) {
    await scrollToBottom()
  }
  const requestMessage = buildRequestMessage(content)
  const activePlanningSummary = buildPlanningPromptSummary()
  const activeSolutionSummary = shouldInjectActiveSolutionSummary()
    ? buildSolutionOutlinePromptSummary()
    : undefined
  const pendingBlueprintDecision = resolveNocodeEditorRepeatBlueprintClarification({
    userMessage: visibleUserContent,
    recentUserMessages: messages.value
      .filter(item => item.role === NocodeEditorAiMessageRole.USER)
      .map(item => item.content),
    hasPendingBlueprint: hasPendingBlueprintConfirmation(),
    pendingBlueprintId: stagedBlueprint.value.blueprint?.id,
    pendingQuestionCount: resolveAiArtifactPendingQuestionCount(buildBlueprintArtifactBlock(stagedBlueprint.value)),
    clarificationSummary: '',
  })
  const preferLocalFormEditingOverPendingBlueprint = shouldPreferAppliedFormEditingOverPendingBlueprint({
    userMessage: visibleUserContent,
    hasPendingBlueprint: hasPendingBlueprintConfirmation(),
    activeFormId: hostContext?.activeFormId,
    activeFormName: hostContext?.activeFormName,
    blueprintBlocks: collectAppliedBlueprintBlocks(),
  })
  const activeBlueprintSummary = hasPendingBlueprintConfirmation()
    && pendingBlueprintDecision?.mode === 'blueprint-update'
    && !preferLocalFormEditingOverPendingBlueprint
    ? buildBlueprintPromptSummary()
    : undefined
  const activeFlowSummary = buildFlowPromptSummary() || undefined
  const shouldExposePendingBlueprintClarification = (
    pendingBlueprintDecision?.mode === 'clarification'
    && !preferLocalFormEditingOverPendingBlueprint
  )
  const activeBlueprintBlock = findLatestCurrentBlueprintArtifactBlock()
    || buildBlueprintArtifactBlock(stagedBlueprint.value)
  const activeAppPlanBlock = findLatestCurrentAppPlanArtifactBlock()
    || buildAppPlanArtifactBlock(stagedAppPlan.value)
  const activeFormPlanBlock = findLatestCurrentFormPlanArtifactBlock()
    || buildFormPlanArtifactBlock(stagedFormPlan.value)
  const activeIndustrySkeletonContext = resolveActiveNocodeEditorIndustrySkeletonContext({
    appPlanBlock: activeAppPlanBlock,
    blueprintBlock: activeBlueprintBlock,
    formPlanBlock: activeFormPlanBlock,
  })
  const importedHandoffContext = isImportedHandoffAutoReplay
    ? options?.importedHandoffContext
    : undefined
  const requestIntentSource = String(importedHandoffContext?.originalGoal || visibleUserContent).trim()
  const freshNewFormRequest = isFreshNewFormRequest(requestIntentSource)
  if (freshNewFormRequest) {
    localPendingFlowIntent.value = null
    stagedFormulaPlan.value = null
  }
  const entryFlowIntent = resolveActiveEntryFlowIntent(requestIntentSource)
  const flowIntent = freshNewFormRequest
    ? null
    : resolveAuthoritativeFlowIntentSignal() || resolveLatestPlanningFlowIntentSignal()
  const shouldResetPendingFlowIntent = (
    entryFlowIntent.state === 'explicit_negative'
    || freshNewFormRequest
  )
  const pendingFlowIntent = shouldResetPendingFlowIntent
    ? null
    : resolveActivePendingFlowIntent()
  const latestPostFormFlowMessage = findLatestActivePostFormFlowFollowUpFromMessages(messages.value)
  const postFormFlowFollowUp = latestPostFormFlowMessage?.followUp || null
  const postFormFlowRelease = latestPostFormFlowMessage
    ? resolveMessagePostFormFlowRelease(latestPostFormFlowMessage.message)
    : null
  if (shouldResetPendingFlowIntent) {
    localPendingFlowIntent.value = null
  }
  const handoffPlanningScope = importedHandoffContext?.intentKind === 'create_app'
    ? 'app'
    : importedHandoffContext?.intentKind === 'create_form'
      ? 'form'
      : 'unknown'
  const currentRequestPlanningScope = handoffPlanningScope !== 'unknown'
    ? handoffPlanningScope
    : resolveNocodeEditorPlanningScope(requestIntentSource).scope
  const authoritativePlanningScope = resolveAuthoritativePlanningScope()
  const stagedPlanningScope = normalizeNocodeEditorPlanningScopeValue(stagedBlueprint.value.planningScope)
  const planningScope = currentRequestPlanningScope !== 'unknown'
    ? currentRequestPlanningScope
    : authoritativePlanningScope !== 'unknown'
      ? authoritativePlanningScope
      : stagedPlanningScope
  const scenePayload = {
    nocodeId: props.nocodeId,
    activeFormId: hostContext?.activeFormId || '',
    activeFormName: hostContext?.activeFormName || '',
    currentActiveId: hostContext?.currentActiveId || '',
    mode: hostContext?.mode || 'idle',
    taskContextType: taskContext?.type === 'default-formula' ? 'default-formula' : undefined,
    settingTargetContextType: settingTargetContext?.type === 'default-formula-target' ? 'default-formula-target' : undefined,
    settingContextType: settingContext?.type,
    stagedPlanningSummary: activePlanningSummary,
    stagedFlowSummary: activeFlowSummary,
    stagedBlueprintSummary: activeBlueprintSummary,
    pendingBlueprintRepeatIntent: shouldExposePendingBlueprintClarification
      ? pendingBlueprintDecision.repeatIntent || undefined
      : undefined,
    pendingBlueprintClarificationSummary: shouldExposePendingBlueprintClarification
      ? buildPendingBlueprintClarificationSummary(pendingBlueprintDecision)
      : undefined,
    pendingBlueprintClarificationKind: shouldExposePendingBlueprintClarification
      ? pendingBlueprintDecision.clarificationKind
      : undefined,
    pendingBlueprintBlockedBlueprintId: shouldExposePendingBlueprintClarification
      ? pendingBlueprintDecision.blockedBlueprintId
      : undefined,
    entryFlowIntent,
    flowIntent,
    pendingFlowIntent,
    postFormFlowFollowUp,
    postFormFlowRelease,
    planningScope,
    industrySkeletonContext: activeIndustrySkeletonContext,
    importedHandoffContext,
  } as const
  const requestModelSelection = options?.modelSelection || (
    effectiveModelOption.value
      ? {
        modelSelectionSource: 'explicit' as const,
        providerId: effectiveModelOption.value.providerId,
        modelId: effectiveModelOption.value.modelId,
        model: effectiveModelOption.value.model,
      }
      : null
  )
  const request: NocodeEditorAiChatRequest = {
    conversationId: currentConversationId || undefined,
    message: requestMessage,
    modelSelectionSource: requestModelSelection?.modelSelectionSource || modelSelectionSource.value,
    ...(requestModelSelection?.modelSelectionSource !== 'default' && requestModelSelection
      ? {
        providerId: requestModelSelection.providerId || undefined,
        modelId: requestModelSelection.modelId || undefined,
        model: requestModelSelection.model || undefined,
      }
      : {}),
    traceId,
    scene: 'nocode-editor',
    metadata: {
      traceId,
      taskId: currentTaskSeed?.taskId,
      taskSource: currentTaskSeed?.source,
      taskScopeKey: scopeKey,
      editorTaskContext: taskContext,
      editorSettingTargetContext: settingTargetContext,
      editorSettingContext: settingContext,
      ...(effectiveRequestMetadata || {}),
      ...(effectiveVisibleUserMetadata || {}),
      ...(editMetadata || {}),
      userFacingContent: visibleUserContent,
      providerPromptContent: content,
    },
    scenePayload,
  }
  assistantMessage.metadata = {
    ...(assistantMessage.metadata || {}),
    requestMetadata: request.metadata || {},
    requestScenePayload: request.scenePayload || {},
    scenePayload: request.scenePayload || {},
  }

  try {
    await fetchEventSource('/ai/chat/stream', {
      method: 'POST',
      signal: controller.signal,
      openWhenHidden: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      async onmessage(ev) {
        const payload = JSON.parse(ev.data) as NocodeEditorAiChatStreamPayload
        const eventName = (ev.event || payload.event) as NocodeEditorAiStreamEventType
        const nextConversationId = String(payload.conversationId || currentConversationId || conversationId.value || '').trim()
        if (nextConversationId) {
          conversationId.value = nextConversationId
        }
        const streamTraceId = normalizeTraceId(payload.metadata?.traceId || traceId)
        syncAuthoritativeUserMessageId(streamTraceId, String(payload.metadata?.userMessageId || '').trim())

        const assistant = messages.value.find(item => item.id === assistantId)
        if (!assistant) {
          return
        }
        syncMessageTraceId(assistant, payload.metadata?.traceId || traceId)

        if (eventName === NocodeEditorAiStreamEventType.START) {
          if (isUserMessageCommitAck(payload.metadata)) {
            userMessagePersisted = true
            const acceptedModelSelectionSource = payload.metadata?.modelSelectionSource === 'default'
              ? 'default'
              : payload.metadata?.modelSelectionSource === 'explicit'
                ? 'explicit'
                : requestModelSelection?.modelSelectionSource
            applyModelSelectionState({
              providerId: String(payload.metadata?.providerId || requestModelSelection?.providerId || ''),
              modelId: String(payload.metadata?.modelId || requestModelSelection?.modelId || ''),
              model: String(payload.metadata?.model || requestModelSelection?.model || ''),
              modelSelectionSource: acceptedModelSelectionSource,
            })
            persistedConversationModelSelectionSource.value = acceptedModelSelectionSource || null
            options?.onUserMessageAccepted?.()
          }
          return
        }

        if (eventName === NocodeEditorAiStreamEventType.DELTA) {
          assistant.content = reduceNocodeEditorAssistantContent({
            currentContent: assistant.content,
            thinkingText: getThinkingText(),
            streamKey: assistant.id,
            event: NocodeEditorAiStreamEventType.DELTA,
            text: payload.text || '',
          })
          if (!isHiddenTimelineRequest && shouldAutoScrollToBottom()) {
            await scrollToBottom()
          }
          return
        }

        if (eventName === NocodeEditorAiStreamEventType.TOOL_CALL) {
          const toolName = String(payload.metadata?.toolName || '').trim()
          assistant.content = reduceNocodeEditorAssistantContent({
            currentContent: assistant.content,
            thinkingText: getThinkingText(),
            streamKey: assistant.id,
            event: NocodeEditorAiStreamEventType.TOOL_CALL,
            toolName,
          })
          addLoadingArtifactForTool(assistant, toolName, payload.metadata || null)
          if (!isHiddenTimelineRequest && shouldAutoScrollToBottom()) {
            await scrollToBottom()
          }
          await handleToolCall(payload, controller, assistant)
          return
        }

        if (eventName === NocodeEditorAiStreamEventType.TOOL_RESULT) {
          await applyToolResultArtifactsToMessage(assistant, payload)
          return
        }

        if (eventName === NocodeEditorAiStreamEventType.ERROR) {
          hasTerminalStreamEvent = true
          const resolvedError = resolveNocodeEditorStreamErrorRecovery(payload)
          const effectiveUserMessagePersisted = (
            userMessagePersisted
            || resolvedError.metadata.userMessagePersisted === true
          )
          userMessagePersisted = effectiveUserMessagePersisted
          assistant.content = resolvedError.userMessage
          assistant.metadata = {
            ...(assistant.metadata || {}),
            ...resolvedError.metadata,
            userMessagePersisted: effectiveUserMessagePersisted,
          }
          submitResult = resolveSubmitFailureResult({
            userMessagePersisted: effectiveUserMessagePersisted,
            aborted: false,
          })
          return
        }

        if (eventName === NocodeEditorAiStreamEventType.DONE) {
          hasTerminalStreamEvent = true
          submitResult = 'completed'
          if (payload.metadata?.internalContinuationDeduplicated === true) {
            messages.value = discardNocodeEditorInternalContinuationDeduplicatedAssistant({
              messages: messages.value,
              optimisticAssistantId: assistantId,
            })
            if (currentController.value === controller) {
              currentController.value = null
              clearCurrentRespondingAssistantId(assistantId)
              isResponding.value = false
            }
            const loaded = await loadConversationMessages(undefined, {
              mergeExisting: true,
            })
            if (!loaded) {
              void refreshStagedState()
            }
            return
          }
          const donePresentation = resolveNocodeEditorDonePresentation(
            payload.metadata as Record<string, unknown> | null | undefined,
          )
          assistant.content = reduceNocodeEditorAssistantContent({
            currentContent: assistant.content,
            thinkingText: getThinkingText(),
            streamKey: assistant.id,
            event: NocodeEditorAiStreamEventType.DONE,
            finalContent: donePresentation.finalContent,
            doneFallbackText: i18next.t('nocodeEditorAiPanel.turnCompleted'),
          })
          if (currentController.value === controller) {
            currentController.value = null
            clearCurrentRespondingAssistantId(assistantId)
            isResponding.value = false
          }
          if (donePresentation.blocks.length) {
            mergeMessageBlocks(assistant, donePresentation.blocks)
          }
          const assistantMetadata = ensureMessageMetadata(assistant)
          if (donePresentation.continuityHints?.length) {
            assistantMetadata.continuityHints = donePresentation.continuityHints
          }
          if (donePresentation.appBuilderPlanningSummary) {
            assistantMetadata.appBuilderPlanningSummary = donePresentation.appBuilderPlanningSummary
          }
          if (donePresentation.appBuilderPlanningArtifacts) {
            assistantMetadata.appBuilderPlanningArtifacts = donePresentation.appBuilderPlanningArtifacts
          }
          if (donePresentation.appBuilderPlanningOutline) {
            assistantMetadata.appBuilderPlanningOutline = donePresentation.appBuilderPlanningOutline
          }
          if (options?.onAssistantCompleted) {
            await options.onAssistantCompleted({
              ...assistant,
              metadata: assistant.metadata
                ? {
                  ...assistant.metadata,
                }
                : null,
            })
          }
          const loaded = await loadConversationMessages(undefined, {
            mergeExisting: true,
            optimisticAssistantId: assistant.id,
            authoritativeAssistantMessageId: donePresentation.assistantMessageId,
          })
          const shouldForceFlowPlanAuthoritativeReload = loaded
            && shouldForceFlowPlanAuthoritativeReloadAfterDone({
              traceId,
              doneBlocks: donePresentation.blocks,
              messages: messages.value,
            })
          if (shouldForceFlowPlanAuthoritativeReload) {
            const authoritativeLoaded = await loadConversationMessages(undefined, {
              mergeExisting: false,
            })
            if (!authoritativeLoaded) {
              void refreshStagedState()
            }
            return
          }
          if (!loaded) {
            void refreshStagedState()
          }
        }
      },
      async onclose() {
        if (!controller.signal.aborted && !hasTerminalStreamEvent) {
          const loaded = await loadConversationMessages(undefined, {
            mergeExisting: true,
            optimisticAssistantId: assistantId,
          })
          if (!loaded) {
            finalizeStoppedAssistantMessage(assistantId, {
              fallbackText: 'AI 请求中断，请重试',
            })
          }
        }
        if (currentController.value === controller) {
          currentController.value = null
          clearCurrentRespondingAssistantId(assistantId)
          isResponding.value = false
        }
      },
      onerror(error) {
        if (controller.signal.aborted) {
          return
        }
        const assistant = messages.value.find(item => item.id === assistantId)
        if (assistant && options?.silentFailure) {
          const messageIndex = messages.value.findIndex(item => item.id === assistantId)
          if (messageIndex !== -1) {
            messages.value.splice(messageIndex, 1)
          }
        } else if (assistant && assistant.content === getThinkingText()) {
          assistant.content = i18next.t('nocodeEditorAiPanel.aiRequestFailed')
        }
        if (currentController.value === controller) {
          currentController.value = null
          clearCurrentRespondingAssistantId(assistantId)
          isResponding.value = false
        }
        throw error
      },
    })
  } catch (error) {
    if (!hasSwitchedToResponding) {
      isPreparingSubmit.value = false
    }
    if (controller.signal.aborted) {
      submitResult = resolveSubmitFailureResult({
        userMessagePersisted,
        aborted: true,
      })
    } else {
      if (submitResult === 'not_started') {
        submitResult = resolveSubmitFailureResult({
          userMessagePersisted,
          aborted: false,
        })
      }
      const assistant = messages.value.find(item => item.id === assistantId)
      if (assistant && options?.silentFailure) {
        const messageIndex = messages.value.findIndex(item => item.id === assistantId)
        if (messageIndex !== -1) {
          messages.value.splice(messageIndex, 1)
        }
      } else if (assistant && assistant.content === getThinkingText()) {
        assistant.content = i18next.t('nocodeEditorAiPanel.aiRequestFailed')
      }
      clearCurrentRespondingAssistantId(assistantId)
      console.error('Nocode editor AI stream failed:', error)
      await loadConversationMessages(undefined, {
        mergeExisting: true,
        optimisticAssistantId: assistantId,
      })
    }
  } finally {
    if (!hasSwitchedToResponding) {
      isPreparingSubmit.value = false
    }
    if (currentController.value === controller) {
      currentController.value = null
      clearCurrentRespondingAssistantId(assistantId)
      isResponding.value = false
    }
    emit('thread-list-change')
  }
  if (!didStartRequest) {
    return submitResult
  }
  if (
    submitResult === 'completed'
    || submitResult === 'aborted'
    || submitResult === 'aborted_after_user_message_persisted'
    || submitResult === 'failed'
    || submitResult === 'failed_after_user_message_persisted'
  ) {
    return submitResult
  }
  return resolveSubmitFailureResult({
    userMessagePersisted,
    aborted: controller.signal.aborted,
  })
}

const submitExcelFileAnalysis = async (
  payload: AiExcelAnalysisConfirmPayload,
  visibleUserContent: string,
  requestMetadata?: Record<string, unknown>,
) => {
  const analysisRequest = buildAiExcelAnalysisRequestPayload({
    confirmPayload: payload,
    userFacingContent: visibleUserContent,
    baseRequestMetadata: requestMetadata || null,
    disableToolFlag: 'disableNocodeEditorTools',
  })
  const submitResult = await submitMessage(analysisRequest.providerPromptContent, {
    visibleUserContent: analysisRequest.userFacingContent,
    visibleUserMetadata: analysisRequest.requestMetadata,
    requestMetadata: analysisRequest.requestMetadata,
  })
  if (submitResult === 'completed') {
    activeExcelAnalysisContext.value = payload.context
  }
  return submitResult
}

const handleContinueBlueprintAdjustment = async () => {
  if (!canContinueBlueprintAdjustment(previewArtifact.value)) {
    return
  }

  setComposerDraft(buildBlueprintAdjustmentPrompt(previewArtifact.value))
  closePreviewArtifact()
  await nextTick()
  chatInputRef.value?.updateTextareaHeight?.()
  await focusTextarea()
}

const handleSend = async (submittedDraft?: string) => {
  if (isPreparingSubmit.value) {
    return
  }
  if (isResponding.value) {
    stop()
    return
  }
  const rawContent = typeof submittedDraft === 'string'
    ? submittedDraft
    : String(draft.value || '')
  const trimmedContent = rawContent.trim()
  if (!trimmedContent && !composerAttachments.value.length) {
    return
  }
  if (!canSubmitAiMessage()) {
    return
  }

  if (composerAttachments.value.length) {
    const { result } = await submitEditorTurnFromTextAndAttachments({
      text: trimmedContent,
      attachments: composerAttachments.value,
      onUserMessageAccepted: () => {
        composerAttachments.value = []
      },
    })
    if (result === 'completed') {
      resetInlineEditUserMessage()
    }
    return
  }

  const followupMetadata = buildEditorExcelAnalysisFollowupMetadata(trimmedContent)
  const excelAnalysisFollowupBehavior = resolveAiExcelAnalysisFollowupBehavior({
    context: activeExcelAnalysisContext.value,
    disableToolFlag: 'disableNocodeEditorTools',
    userFacingContent: trimmedContent,
  })
  if (excelAnalysisFollowupBehavior?.mode === 'switch-to-create') {
    composerAttachments.value = []
    ElMessage.info(excelAnalysisFollowupBehavior.assistantReply)
    return
  }
  if (excelAnalysisFollowupBehavior?.mode === 'clarify') {
    ElMessage.info(excelAnalysisFollowupBehavior.assistantReply)
    return
  }
  if (followupMetadata) {
    await submitMessage(String(followupMetadata.providerPromptContent || trimmedContent), {
      visibleUserContent: String(followupMetadata.userFacingContent || trimmedContent),
      visibleUserMetadata: followupMetadata,
      requestMetadata: followupMetadata,
    })
    resetInlineEditUserMessage()
    return
  }

  await submitEditorTurnFromTextAndAttachments({
    text: trimmedContent,
  })
  resetInlineEditUserMessage()
}

const submitEditedUserMessage = async () => {
  if (
    isPreparingSubmit.value
    || isResponding.value
    || isApplyingFlow.value
    || isApplyingBlueprint.value
    || isRefreshingBlueprint.value
  ) {
    return
  }

  const editedFromMessageId = editingUserMessageId.value
  const rawContent = String(editingUserMessageDraft.value || '')
  const trimmedContent = rawContent.trim()
  const attachments = editingUserMessageAttachments.value
  if (!editedFromMessageId || (!trimmedContent && !attachments.length)) {
    return
  }

  if (attachments.length) {
    const { result } = await submitEditorTurnFromTextAndAttachments({
      text: trimmedContent,
      attachments,
      editedFromMessageId,
    })
    if (result === 'completed') {
      resetInlineEditUserMessage()
    }
    return
  }

  const followupMetadata = buildEditorExcelAnalysisFollowupMetadata(trimmedContent)
  const excelAnalysisFollowupBehavior = resolveAiExcelAnalysisFollowupBehavior({
    context: activeExcelAnalysisContext.value,
    disableToolFlag: 'disableNocodeEditorTools',
    userFacingContent: trimmedContent,
  })
  if (excelAnalysisFollowupBehavior?.mode === 'switch-to-create') {
    ElMessage.info(excelAnalysisFollowupBehavior.assistantReply)
    return
  }
  if (excelAnalysisFollowupBehavior?.mode === 'clarify') {
    ElMessage.info(excelAnalysisFollowupBehavior.assistantReply)
    return
  }
  if (followupMetadata) {
    const result = await submitMessage(String(followupMetadata.providerPromptContent || trimmedContent), {
      visibleUserContent: String(followupMetadata.userFacingContent || trimmedContent),
      visibleUserMetadata: followupMetadata,
      requestMetadata: followupMetadata,
      editedFromMessageId,
    })
    if (result === 'completed') {
      resetInlineEditUserMessage()
    }
    return
  }

  const { result } = await submitEditorTurnFromTextAndAttachments({
    text: trimmedContent,
    editedFromMessageId,
  })
  if (result === 'completed') {
    resetInlineEditUserMessage()
  }
}

defineExpose({
  focusTextarea,
  refreshStagedState,
  submitExcelFileAnalysis,
  appendExcelCreateCompletionReply,
  startNewConversation,
  applyPendingBlueprint,
  applyPendingBlueprintBatch,
  continuePendingBlueprintAdjustment,
  openGeneratedBlueprintPage,
  getPendingBlueprintConfirmationResponseDrafts,
  getPendingBlueprintActiveInputQuestionIds,
  getPendingBlueprintInlineConfirmationNoteQuestionIds,
  handleSelectPendingBlueprintConfirmationOption,
  handleTogglePendingBlueprintInlineConfirmationInput,
  handleUpdatePendingBlueprintInlineConfirmationNote,
  handleSubmitPendingBlueprintConfirmationResponses,
  getConfirmationResponseDrafts,
  getActiveConfirmationInputQuestionIds,
  getInlineConfirmationNoteQuestionIds,
  canApplyFlowFromPreview,
  isApplyingFlowArtifact,
  handleContinueFlowWithDefaults,
  handleToggleFlowInlineConfirmationInput,
  handleUpdateFlowInlineConfirmationNote,
  handleSubmitFlowConfirmationResponses,
  handleApplyFlowFromPreview,
  handleSelectConfirmationOption,
  isConfirmationSubmitting,
})
</script>

<style lang="scss" scoped>
.nocode-editor-ai-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #ffffff;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--border-color-light);
  background: #ffffff;

  &__actions {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    margin-left: 12px;
  }

  :deep(.conversation-actions-trigger.el-button),
  :deep(.panel-header__close.el-button) {
    width: 32px;
    height: 32px;
    padding: 0;
    margin: 0;
    border-radius: 8px;
    color: var(--text-color-secondary);
    background: transparent;
  }

  :deep(.conversation-actions-trigger.el-button:hover),
  :deep(.conversation-actions-trigger.el-button:focus-visible),
  :deep(.panel-header__close.el-button:hover),
  :deep(.panel-header__close.el-button:focus-visible) {
    color: var(--text-color-primary);
    background: var(--fill-color-light);
  }

  .title-main {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-color-primary);
  }

  .title-sub {
    margin-top: 4px;
    font-size: 12px;
    color: var(--text-color-secondary);
  }
}

.messages {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.messages.is-empty {
  display: flex;
}

.messages-continuity-notice {
  margin-bottom: 8px;
}

.message-row {
  :deep(.ai-message-item.is-editor.is-assistant .message-stack) {
    gap: 14px;
  }

  :deep(.ai-message-item.is-editor.is-assistant .message-bubble) {
    width: 100%;
    padding-top: 7px;
  }

  :deep(.ai-message-item.is-editor.is-user .message-bubble) {
    max-width: min(228px, 100%);
  }

}

:deep(.message-row.ai-message-item.is-editor.is-assistant + .message-row.ai-message-item.is-editor.is-assistant .message-bubble) {
  padding-top: 0;
}

:deep(.message-row.ai-message-item.is-editor.is-user:has(.message-bubble--imported-handoff)) {
  justify-content: flex-start;

  .ai-message-item__content {
    width: 100%;
    align-items: stretch;
  }

  .ai-message-item__bubble-wrap {
    justify-content: flex-start;
  }
}

:deep(.message-row.ai-message-item.is-editor.is-user:has(.message-bubble--structured-confirmation)) {
  .ai-message-item__content {
    width: 100%;
    align-items: stretch;
  }
}

:deep(.message-row.ai-message-item.is-editor.is-user .message-bubble.message-bubble--imported-handoff) {
  width: 100%;
  max-width: 100%;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

:deep(.message-row.ai-message-item.is-editor.is-user .message-bubble.message-bubble--structured-confirmation) {
  max-width: min(320px, 82%);
  width: fit-content;
}

:deep(.message-row.ai-message-item.is-editor.is-user .message-bubble.message-bubble--structured-confirmation .user-message-content) {
  width: fit-content;
  max-width: 100%;
}

:deep(.message-row.ai-message-item.is-editor.is-user:has(.message-bubble--inline-editing)) {
  .ai-message-item__content {
    width: 100%;
  }
}

:deep(.message-row.ai-message-item.is-editor.is-user .message-bubble.message-bubble--inline-editing) {
  width: 100%;
  max-width: 100%;
  padding: 8px;
  background: #fff;
  border: 1px solid #dcdfe6;
  white-space: normal;
}

.imported-handoff-card {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #dce8f6;
  border-radius: 24px;
  box-shadow: 0 6px 14px rgba(36, 77, 134, 0.05);
  background: transparent;
  padding: 16px;
  margin-bottom: 6px;
  color: #1d2129;
  white-space: normal;
}

.imported-handoff-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.imported-handoff-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1677ff;
  box-shadow: 0 0 0 4px rgba(22, 119, 255, 0.12);
}

.imported-handoff-card__title {
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.imported-handoff-card__fields {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 10px;
  row-gap: 6px;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
}

.imported-handoff-card__fields dt {
  color: #4e5969;
  font-weight: 500;
}

.imported-handoff-card__fields dd {
  margin: 0;
  color: #1d2129;
  overflow-wrap: anywhere;
}

.imported-handoff-card__footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eef3f8;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.assistant-body {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-message-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inline-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inline-edit__textarea {
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

.inline-edit__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.inline-edit__cancel,
.inline-edit__submit {
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

.inline-edit__submit {
  border-color: #0873ff;
  background: #0873ff;
  color: #fff;
}

.user-message-attachment-list {
  width: min(360px, 100%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-self: flex-end;
}

.message-markdown {
  width: 100%;
}

.post-form-flow-tail-card {
  width: 100%;
  box-sizing: border-box;
  margin: 0 0 12px;
  padding: 14px 14px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid #d8e4f2;
  border-radius: 18px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(250, 252, 255, 0.98), rgba(245, 249, 255, 0.98)),
    linear-gradient(135deg, rgba(92, 162, 255, 0.08), transparent 58%);
  box-shadow: 0 10px 24px rgba(36, 77, 134, 0.08);
}

.post-form-flow-tail-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.post-form-flow-tail-card__heading {
  min-width: 0;
  display: flex;
  align-items: center;
}

.post-form-flow-tail-card__title {
  color: #24364d;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
}

.post-form-flow-tail-card__badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.post-form-flow-tail-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(240, 245, 252, 0.96);
  color: #5a6f8e;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.post-form-flow-tail-card__badge--readiness.is-needs_fix {
  background: #fff7e6;
  color: #a95f08;
}

.post-form-flow-tail-card__badge--readiness.is-blocked_related {
  background: #fff0f0;
  color: #c43c3c;
}

.post-form-flow-tail-card__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.post-form-flow-tail-card__description {
  color: #24364d;
  font-size: 14px;
  line-height: 1.75;
}

.post-form-flow-tail-card__context {
  color: #7f8ea3;
  font-size: 12px;
  line-height: 1.7;
}

.post-form-flow-tail-card__actions {
  margin-top: 2px;
  padding: 12px 0 14px;
  border-top: 1px solid #dbe7f5;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.post-form-flow-tail-card__action {
  width: 100%;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.post-form-flow-tail-card__action--primary {
  background: rgba(92, 162, 255, 0.08);
  border-color: rgba(92, 162, 255, 0.14);
  color: #2d6fe8;
}

.post-form-flow-tail-card__action--primary:hover:not(:disabled) {
  background: rgba(92, 162, 255, 0.14);
}

.post-form-flow-tail-card__action--secondary {
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  border-color: #dbe7f5;
  color: #5a6f8e;
}

.post-form-flow-tail-card__action--secondary:hover:not(:disabled) {
  background: rgba(240, 245, 252, 0.96);
  border-color: #c8d8ea;
}

.post-form-flow-tail-card__action:disabled {
  border-color: #e3ebf5;
  background: rgba(245, 248, 252, 0.9);
  color: #9aa9bc;
  cursor: not-allowed;
}

.assistant-thinking {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #4e5969;
  font-size: 14px;
  line-height: 22px;
}

.assistant-thinking__dots {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  min-width: 18px;
}

.assistant-thinking__dot {
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

.assistant-error-action {
  margin-top: 10px;
  display: flex;
  justify-content: flex-start;
}

.artifact-message {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.live-status {
  margin: 0 16px 12px;
  padding: 12px 14px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border-radius: 14px;
  border: 1px solid #d9e7f5;
  background:
    linear-gradient(180deg, rgba(246, 251, 255, 0.98), rgba(255, 255, 255, 0.98)),
    linear-gradient(135deg, rgba(92, 162, 255, 0.12), transparent 58%);
}

.live-status__icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 10px;
  background: rgba(92, 162, 255, 0.12);
  color: #2d6fe8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.live-status__content {
  min-width: 0;
}

.live-status__title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  color: #24364d;
}

.live-status__description {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.6;
  color: #65768c;
}

.formula-result-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 14px;
  border: 1px solid #dce8f6;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(248, 252, 255, 0.98), rgba(244, 249, 255, 0.98)),
    linear-gradient(135deg, rgba(92, 162, 255, 0.08), transparent 58%);
  box-shadow: 0 6px 14px rgba(36, 77, 134, 0.05);
  color: #24364d;
  white-space: normal;
}

.formula-result-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.formula-result-card__heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.formula-result-card__icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #e8f3ff;
  color: #2d6fe8;
  font-family: var(--font-family-mono, Consolas, Monaco, monospace);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

.formula-result-card__heading-main {
  min-width: 0;
}

.formula-result-card__title {
  color: #1d2f4a;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.formula-result-card__summary {
  margin-top: 4px;
  color: #526b8a;
  font-size: 12px;
  line-height: 1.5;
}

.formula-result-card__count {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef6ff;
  color: #2d6fe8;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.formula-result-card__group-title {
  color: #2d6fe8;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.formula-result-card__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #d9e7f5;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
}

.formula-result-card__item.is-draft {
  background: rgba(248, 252, 255, 0.92);
}

.formula-result-card__item.is-skipped {
  border-color: #e6e9ef;
  background: rgba(247, 249, 252, 0.92);
}

.formula-result-card__item.is-failed {
  border-color: #f1c5c8;
  background: #fff7f7;
}

.formula-result-card__item-main {
  min-width: 0;
  flex: 1;
}

.formula-result-card__item-title {
  color: #1d2f4a;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.formula-result-card__formula {
  display: block;
  margin-top: 4px;
  padding: 4px 8px;
  border-radius: 8px;
  background: #f4f8fd;
  color: #24364d;
  font-family: var(--font-family-mono, Consolas, Monaco, monospace);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.formula-result-card__note {
  margin-top: 4px;
  color: #526b8a;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.formula-result-card__action {
  flex-shrink: 0;
  height: auto;
  min-height: 0;
  padding: 0;
  font-size: 13px;
  line-height: 1.7;
}

.formula-result-card__status {
  flex-shrink: 0;
  color: #2d6fe8;
  font-size: 12px;
  line-height: 1.7;
}

.composer {
  position: relative;
  border-top: 1px solid var(--border-color-light);
  padding: 12px 16px 16px;

  :deep(.workbench-ai-chat-input) {
    max-width: 100%;
    border-radius: 16px;
    box-shadow: none;
  }
}

.composer__body {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;

  &.has-login-prompt {
    border-radius: 16px;
    background: #f7f8fa;
  }
}

.composer__scroll-bottom {
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

.composer.is-preparing {
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.status-fade-enter-active,
.status-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.status-fade-enter-from,
.status-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
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

</style>
