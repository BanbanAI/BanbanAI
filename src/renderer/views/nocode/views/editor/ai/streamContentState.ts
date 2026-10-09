import {
  resolveNocodeEditorAppBuilderPlanningFenceState,
  stripNocodeEditorAppBuilderPlanningFence,
} from '@common/utils/nocodeEditorAppBuilderPlanningFence'
import {
  getNocodeEditorUnsupportedBlueprintProtocolMessage,
  resolveNocodeEditorUnsupportedBlueprintProtocolState,
} from '@common/utils/nocodeEditorUnsupportedBlueprintProtocol'
import {
  extractNocodeEditorAppBuilderPlanningNarrationLead,
  getNocodeEditorAppBuilderPlanningStreamPlaceholder,
  isLikelyNocodeEditorAppBuilderPlanningStream,
  isPotentialNocodeEditorAppBuilderPlanningStream,
} from '@common/utils/nocodeEditorAppBuilderPlanningStreamGuard'
import {
  shouldHideNocodeEditorIntermediateAssistantNarration,
} from '@common/utils/nocodeEditorAiToolVisibility'

type ReduceAssistantContentInput = {
  currentContent: string
  thinkingText: string
  event: 'delta' | 'tool-call' | 'done'
  streamKey?: string
  text?: string
  finalContent?: string
  doneFallbackText?: string
  toolName?: string
}

const pendingPlanningFenceByContent = new Map<string, string>()
const pendingPlanningStreamByContent = new Map<string, string>()
const pendingPotentialPlanningStreamByContent = new Map<string, string>()
const pendingUnsupportedBlueprintProtocolByStream = new Map<string, string>()
const LEGACY_NOCODE_EDITOR_ACTIVE_STREAM_KEY = '__legacy_nocode_editor_active_stream__'

const resolvePendingPlanningStreamKey = (input: ReduceAssistantContentInput) => (
  String(input.streamKey || LEGACY_NOCODE_EDITOR_ACTIVE_STREAM_KEY).trim()
)

export const reduceNocodeEditorAssistantContent = (input: ReduceAssistantContentInput) => {
  const pendingPlanningStreamKey = resolvePendingPlanningStreamKey(input)

  if (input.event === 'delta') {
    const isPlanningStreamPlaceholder = input.currentContent === getNocodeEditorAppBuilderPlanningStreamPlaceholder()
    const isUnsupportedBlueprintPlaceholder = input.currentContent === getNocodeEditorUnsupportedBlueprintProtocolMessage()
    const baseContent = input.currentContent === input.thinkingText || isPlanningStreamPlaceholder || isUnsupportedBlueprintPlaceholder
      ? ''
      : input.currentContent
    const pendingUnsupportedBlueprintProtocol = pendingUnsupportedBlueprintProtocolByStream.get(pendingPlanningStreamKey) || ''
    const unsupportedBlueprintProtocolState = resolveNocodeEditorUnsupportedBlueprintProtocolState(
      `${baseContent}${pendingUnsupportedBlueprintProtocol}${input.text || ''}`,
    )
    const pendingPlanningContent = pendingPlanningStreamByContent.get(pendingPlanningStreamKey) || ''
    const pendingPotentialPlanningContent = pendingPotentialPlanningStreamByContent.get(pendingPlanningStreamKey) || ''
    const pendingHiddenContent = pendingPlanningFenceByContent.get(baseContent) || ''
    const nextRawContent = `${baseContent}${pendingPlanningContent}${pendingPotentialPlanningContent}${pendingHiddenContent}${input.text || ''}`
    const nextFenceState = resolveNocodeEditorAppBuilderPlanningFenceState(
      nextRawContent,
    )
    const isPlanningStream = isLikelyNocodeEditorAppBuilderPlanningStream(nextRawContent)
    const isPotentialPlanningStream = isPotentialNocodeEditorAppBuilderPlanningStream(nextRawContent)

    pendingPlanningFenceByContent.delete(baseContent)
    pendingPlanningFenceByContent.delete(input.currentContent)
    pendingPlanningStreamByContent.delete(pendingPlanningStreamKey)
    pendingPotentialPlanningStreamByContent.delete(pendingPlanningStreamKey)
    pendingUnsupportedBlueprintProtocolByStream.delete(pendingPlanningStreamKey)

    if (isPlanningStream) {
      pendingPlanningStreamByContent.set(
        pendingPlanningStreamKey,
        nextFenceState.pendingHiddenContent,
      )
      return extractNocodeEditorAppBuilderPlanningNarrationLead(nextFenceState.visibleContent)
    }

    if (isPotentialPlanningStream) {
      pendingPotentialPlanningStreamByContent.set(
        pendingPlanningStreamKey,
        nextFenceState.pendingHiddenContent,
      )
      return extractNocodeEditorAppBuilderPlanningNarrationLead(nextFenceState.visibleContent)
    }

    if (unsupportedBlueprintProtocolState.containsUnsupportedProtocol) {
      if (unsupportedBlueprintProtocolState.pendingHiddenContent) {
        pendingUnsupportedBlueprintProtocolByStream.set(
          pendingPlanningStreamKey,
          unsupportedBlueprintProtocolState.pendingHiddenContent,
        )
      }
      return getNocodeEditorUnsupportedBlueprintProtocolMessage()
    }

    if (nextFenceState.pendingHiddenContent) {
      pendingPlanningFenceByContent.set(nextFenceState.visibleContent, nextFenceState.pendingHiddenContent)
    }

    // Keep banban-app-builder-plan protocol text hidden even when the fence header arrives across deltas.
    return nextFenceState.visibleContent
  }

  if (input.event === 'tool-call') {
    const hasPendingUnsupportedBlueprintProtocol = pendingUnsupportedBlueprintProtocolByStream.has(
      pendingPlanningStreamKey,
    )
    if (
      hasPendingUnsupportedBlueprintProtocol
      || input.currentContent === getNocodeEditorUnsupportedBlueprintProtocolMessage()
    ) {
      return getNocodeEditorUnsupportedBlueprintProtocolMessage()
    }
    if (shouldHideNocodeEditorIntermediateAssistantNarration(input.toolName)) {
      const hasPendingPlanningStream = pendingPlanningStreamByContent.has(pendingPlanningStreamKey)
        || pendingPotentialPlanningStreamByContent.has(pendingPlanningStreamKey)
      if (
        !hasPendingPlanningStream
        || !String(input.currentContent || '').trim()
        || input.currentContent === input.thinkingText
        || input.currentContent === getNocodeEditorAppBuilderPlanningStreamPlaceholder()
      ) {
        return input.thinkingText
      }
      return input.currentContent
    }
    return input.currentContent === input.thinkingText ? input.thinkingText : input.currentContent
  }

  if (input.event === 'done') {
    const isPlanningStreamPlaceholder = input.currentContent === getNocodeEditorAppBuilderPlanningStreamPlaceholder()
    const hadPendingUnsupportedBlueprintProtocol = pendingUnsupportedBlueprintProtocolByStream.has(
      pendingPlanningStreamKey,
    )
    const hadPendingPlanningStream = pendingPlanningStreamByContent.has(pendingPlanningStreamKey)
    const baseContent = input.currentContent === input.thinkingText || isPlanningStreamPlaceholder
      ? ''
      : input.currentContent
    pendingPlanningFenceByContent.delete(baseContent)
    pendingPlanningFenceByContent.delete(input.currentContent)
    pendingPlanningStreamByContent.delete(pendingPlanningStreamKey)
    pendingUnsupportedBlueprintProtocolByStream.delete(pendingPlanningStreamKey)
    const pendingPotentialPlanningContent = pendingPotentialPlanningStreamByContent.get(pendingPlanningStreamKey) || ''
    const hadPendingPotentialPlanningStream = pendingPotentialPlanningStreamByContent.has(pendingPlanningStreamKey)
    pendingPotentialPlanningStreamByContent.delete(pendingPlanningStreamKey)
    const finalUnsupportedBlueprintProtocolState = resolveNocodeEditorUnsupportedBlueprintProtocolState(
      String(input.finalContent || '').trim(),
    )
    if (
      hadPendingUnsupportedBlueprintProtocol
      || finalUnsupportedBlueprintProtocolState.containsUnsupportedProtocol
      || input.currentContent === getNocodeEditorUnsupportedBlueprintProtocolMessage()
    ) {
      return getNocodeEditorUnsupportedBlueprintProtocolMessage()
    }
    const finalContent = stripNocodeEditorAppBuilderPlanningFence(String(input.finalContent || '').trim())
    if (finalContent) {
      if (hadPendingPlanningStream || isPlanningStreamPlaceholder || !baseContent) {
        return finalContent
      }
      const currentContent = input.currentContent === input.thinkingText
        ? ''
        : stripNocodeEditorAppBuilderPlanningFence(String(input.currentContent || '').trim())
      if (!currentContent) {
        return finalContent
      }
      if (
        currentContent === finalContent
        || currentContent.endsWith(finalContent)
        || currentContent.includes(finalContent)
      ) {
        return currentContent
      }
      return `${currentContent}\n\n${finalContent}`
    }
    if (pendingPotentialPlanningContent || hadPendingPotentialPlanningStream) {
      return input.doneFallbackText || input.currentContent
    }
    if (input.currentContent === input.thinkingText || isPlanningStreamPlaceholder) {
      return input.doneFallbackText || input.currentContent
    }
  }

  return input.currentContent
}
