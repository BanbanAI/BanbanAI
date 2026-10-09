import { Module } from '@nestjs/common'
import { ApiModule } from '../api/api.module'
import { AiNocodeEditorController } from './nocode-editor/ai-nocode-editor.controller'
import { AiConfigController } from './config/ai-config.controller'
import { AiConfigService } from './config/ai-config.service'
import { AiDebugController } from './debug/ai-debug.controller'
import { AiAnswerComposerService } from './llm/ai-answer-composer.service'
import { AiLlmClientService } from './llm/ai-llm-client.service'
import { AiPromptTemplateService } from './llm/ai-prompt-template.service'
import { AiAgentLogService } from './logging/agent-log.service'
import { AiAppMemoryBuilder } from './memory/ai-app-memory.builder'
import { AiAppMemoryDiffService } from './memory/ai-app-memory.diff'
import { AiAppMemoryManager } from './memory/ai-app-memory.manager'
import { AiAppMemoryScanner } from './memory/ai-app-memory.scanner'
import { AiAppMemorySemanticService } from './memory/ai-app-memory-semantic.service'
import { AiAppMemoryStore } from './memory/ai-app-memory.store'
import { AiWarmupActivityController } from './memory/ai-warmup-activity.controller'
import { AiWarmupActivityService } from './memory/ai-warmup-activity.service'
import { AiClientToolBridgeService } from './nocode-editor/client-tool-bridge.service'
import { AiNocodeEditorAppAccessService } from './nocode-editor/ai-nocode-editor-app-access.service'
import { NocodeEditorBlueprintStoreService } from './nocode-editor/nocode-editor-blueprint-store.service'
import { NocodeEditorRelationContextStoreService } from './nocode-editor/nocode-editor-relation-context.store.service'
import { AiNocodeEditorChatService } from './nocode-editor/nocode-editor-chat.service'
import { AiNocodeEditorConversationService } from './nocode-editor/nocode-editor-conversation.service'
import { NocodeEditorConversationMigrationService } from './nocode-editor/nocode-editor-conversation-migration.service'
import { AiNocodeEditorPromptService } from './nocode-editor/nocode-editor-prompt.service'
import { AiAppMemoryWarmupService } from './memory/ai-app-memory-warmup.service'
import { AiOpenAiService } from './openai/ai-openai.service'
import { AiReasoningPolicyService } from './runtime/ai-reasoning-policy.service'
import { AiAnalysisChartPolicyService } from './runtime/ai-analysis-chart-policy.service'
import { AiAnalysisChartContextService } from './runtime/ai-analysis-chart-context.service'
import { AiAnalysisChartBuilderService } from './runtime/ai-analysis-chart-builder.service'
import { AiCrossAppAnalysisBundleService } from './runtime/ai-cross-app-analysis-bundle.service'
import { AiAnalysisEvidenceBlockBuilderService } from './runtime/ai-analysis-evidence-block-builder.service'
import { AiAnalysisTableBlockBuilderService } from './runtime/ai-analysis-table-block-builder.service'
import { AiScenarioPolicyService } from './runtime/ai-scenario-policy.service'
import { AiRuntimeOrchestratorService } from './runtime/ai-runtime-orchestrator.service'
import { AiRuntimeStateReducerService } from './runtime/ai-runtime-state-reducer.service'
import { AiContextWindowService } from './runtime/ai-context-window.service'
import { AiShareController } from './share/ai-share.controller'
import { AiShareService } from './share/ai-share.service'
import { AiThreadController } from './thread/ai-thread.controller'
import { AiThreadService } from './thread/ai-thread.service'
import { AiAttachmentService } from './thread/ai-attachment.service'
import { AiLocalToolService } from './tools/local-tool.service'
import { AiUsageService } from './usage/usage.service'
import { AppBuilderHandoffService } from './workbench-ai/app-builder-handoff.service'
import { AppBuilderHandoffStoreService } from './workbench-ai/app-builder-handoff.store.service'
import { AiConfigStore } from './config/ai-config.store'
import { AiProviderCredentialStore } from './config/ai-provider-credential.store'

@Module({
  imports: [ApiModule],
  controllers: [
    AiNocodeEditorController,
    AiConfigController,
    AiDebugController,
    AiThreadController,
    AiShareController,
    AiWarmupActivityController,
  ],
  providers: [
    AiConfigService,
    AiConfigStore,
    AiProviderCredentialStore,
    AiThreadService,
    AiAttachmentService,
    AiShareService,
    AiLocalToolService,
    AiAgentLogService,
    AiUsageService,
    AiClientToolBridgeService,
    AiNocodeEditorAppAccessService,
    NocodeEditorBlueprintStoreService,
    NocodeEditorRelationContextStoreService,
    AiNocodeEditorChatService,
    AiNocodeEditorConversationService,
    NocodeEditorConversationMigrationService,
    AiNocodeEditorPromptService,
    AiOpenAiService,
    AiAppMemoryStore,
    AiAppMemoryScanner,
    AiAppMemoryDiffService,
    AiAppMemoryBuilder,
    AiAppMemorySemanticService,
    AiAppMemoryManager,
    AiAppMemoryWarmupService,
    AiWarmupActivityService,
    AiLlmClientService,
    AiPromptTemplateService,
    AiAnswerComposerService,
    AiAnalysisChartBuilderService,
    AiAnalysisChartContextService,
    AiCrossAppAnalysisBundleService,
    AiAnalysisEvidenceBlockBuilderService,
    AiAnalysisTableBlockBuilderService,
    AiAnalysisChartPolicyService,
    AiReasoningPolicyService,
    AiScenarioPolicyService,
    AiRuntimeStateReducerService,
    AiContextWindowService,
    AppBuilderHandoffStoreService,
    AppBuilderHandoffService,
    AiRuntimeOrchestratorService,
  ],
  exports: [
    AiConfigService,
    AiThreadService,
    AiAttachmentService,
    AiShareService,
    AiLocalToolService,
    AiOpenAiService,
    AiAppMemoryManager,
    AiAppMemoryWarmupService,
    AiWarmupActivityService,
    AiRuntimeOrchestratorService,
    NocodeEditorBlueprintStoreService,
    NocodeEditorRelationContextStoreService,
    AiNocodeEditorChatService,
    AiNocodeEditorConversationService,
    NocodeEditorConversationMigrationService,
  ],
})
export class AiModule {
}
