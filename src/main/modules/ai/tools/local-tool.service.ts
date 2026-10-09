import { getAllPages, isSystemField, SystemField } from '@common/utils'
import { Injectable } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { AiPermissionConfig, Field, SortType, Table } from '@common/types/project'
import { FormDataStage } from '@common/utils'
import { WORKBENCH_AI_FILL_CURRENT_FORM_TOOL } from '@common/utils/workbenchAiFormFill'
import dayjs, { Dayjs } from 'dayjs'
import md5 from 'md5'
import { RequestStorage } from '@main/middleware'
import { FormDataService } from '../../formData/form-data.service'
import { ProjectService } from '../../project/project.services'
import { WorkbenchService } from '../../workbench/workbench.service'
import { AiConfigService } from '../config/ai-config.service'
import { AiAgentLogService } from '../logging/agent-log.service'
import { AiAppMemoryStore } from '../memory/ai-app-memory.store'
import {
  AiReadAppDataAnalysis,
  AiReadAppDataAnalysisCompareOp,
  AiReadAppDataAnalysisMetric,
  AiReadAppDataAnalysisMetricOp,
  AiReadAppDataAnalysisResult,
  AiAppViewType,
  AiAppMemoryManifest,
  AiAppMemoryEvidenceProfile,
  AiAppMemoryWarmupState,
  AiAppMemoryWarmupTrace,
  AiEvidenceStrength,
  AiGetAppMemoryOutput,
  AiMemoryLevelStatus,
  AiMcpServerDefinition,
  AiNumericDisplayMeta,
  AiReadAppDataExecutionPreference,
  AiReadAppDataMode,
  AiReadAppDataOutput,
  AiReadAppDataPartialPolicy,
  AiReadAppDataReturnMode,
  AiReadAppDataTargetRef,
  AiReadAppDataTimeGranularity,
  AiRowCountBucket,
  AiSearchConvergence,
  AiSearchAppsOutput,
  AiSearchAppEvidenceBreakdown,
  AiSourceDataProfile,
  AiRuntimeExecutionStrategy,
  AiSourceEnumSketch,
  AiToolDefinition,
  AiToolExecutionContext,
} from '../ai.types'
import {
  buildAiFieldLookupNames,
  describeAiFieldPrompt,
  formatAiNumericValue,
  pickAiNumericDisplayMeta,
} from '../utils/ai-numeric-display'
import {
  isAiMetricField,
  normalizeAiComparableText,
} from '../utils/ai-metric-field.util'
import { buildPermissionSafeDerivedSummary } from '../utils/ai-semantic-derived-summary.util'
import { resolveAiAppKind } from '../utils/ai-app-kind.util'

type BuiltinToolServerConfig = Omit<AiMcpServerDefinition, 'tools'> & {
  toolNames: string[]
}

type AiWarmupTraceDraft = Omit<AiAppMemoryWarmupTrace, 'semanticRequestedSourceIds'> & {
  semanticRequestedSourceIds?: string[]
}

type TimeGranularity = AiReadAppDataTimeGranularity

const AI_MEMORY_STATUS_LABELS = {
  summary_ready: '\u8bed\u4e49\u6458\u8981\u5df2\u5c31\u7eea',
  structure_ready: '\u7ed3\u6784\u8bb0\u5fc6\u5df2\u5c31\u7eea',
  catalog_only: '\u4ec5\u76ee\u5f55\u8bb0\u5fc6\u5df2\u5c31\u7eea',
  missing: '\u8bb0\u5fc6\u7f3a\u5931',
} as const

const AI_TIME_GRANULARITY_LABELS = {
  minute: '\u6309\u5206\u949f',
  hour: '\u6309\u5c0f\u65f6',
  day: '\u6309\u5929',
  week: '\u6309\u5468',
  month: '\u6309\u6708',
  year: '\u6309\u5e74',
  fallback: '\u6309\u65f6\u95f4',
} as const

const AI_LOCAL_TOOL_COPY = {
  builtinServerDescription: '\u5e94\u7528\u53d1\u73b0\u3001\u5e94\u7528\u8bb0\u5fc6\u4e0e\u5e94\u7528\u6570\u636e\u8bfb\u53d6\u5de5\u5177\u3002',
  searchAppsDescription: '\u9ad8\u53ec\u56de\u641c\u7d22\u5f53\u524d\u53ef\u8bbf\u95ee\u7684\u5e94\u7528\uff0c\u5e76\u8fd4\u56de\u5019\u9009\u5e94\u7528\u3001\u5019\u9009\u8bc1\u636e\u4e0e\u4e0d\u786e\u5b9a\u6027\u4fe1\u53f7\u3002',
  searchAppsCandidateNote: '\u8fd9\u4e2a\u5de5\u5177\u63d0\u4f9b\u7684\u662f\u5019\u9009\uff0c\u4e0d\u66ff\u6a21\u578b\u6700\u7ec8\u9009\u5b9a app\u3002',
  searchAppsKeywordsNote: '\u201ckeywords\u201d \u7531\u6a21\u578b\u6839\u636e\u5f53\u524d\u95ee\u9898\u81ea\u4e3b\u63d0\u70bc\uff0c\u7528\u4e8e\u8868\u8fbe\u6700\u6709\u533a\u5206\u5ea6\u7684\u68c0\u7d22\u7ebf\u7d22\uff1b\u4e0d\u8981\u6c42\u56fa\u5b9a\u7c7b\u522b\u6216\u56fa\u5b9a\u6570\u91cf\u3002',
  searchAppsMemoryNote: '\u5982\u679c\u591a\u4e2a\u5019\u9009\u4ecd\u53ef\u884c\uff0c\u53ef\u7ee7\u7eed\u67e5\u770b\u5019\u9009\u7684 get_app_memory\uff0c\u518d\u57fa\u4e8e\u8fd4\u56de\u8bc1\u636e\u81ea\u4e3b\u5224\u65ad\u3002',
  searchAppsPaginationNote: '\u8fd9\u4e2a\u5de5\u5177\u4e0d\u5411\u6a21\u578b\u66b4\u9732\u5206\u9875\u5fc3\u667a\uff1b\u5982\u679c\u7ed3\u679c\u88ab\u622a\u65ad\uff0c\u5e94\u7ec6\u5316\u5173\u952e\u8bcd\u540e\u518d\u6b21\u641c\u7d22\u3002',
  searchAppsKeywordsDescription: '\u641c\u7d22\u5173\u952e\u8bcd\uff0c\u7531\u6a21\u578b\u6839\u636e\u5f53\u524d\u95ee\u9898\u81ea\u4e3b\u63d0\u70bc\uff0c\u7528\u4e8e\u8868\u8fbe\u6700\u6709\u533a\u5206\u5ea6\u7684\u68c0\u7d22\u7ebf\u7d22\u3002',
  searchAppsIntentDescription: '\u53ef\u9009\u610f\u56fe\u63d0\u793a\uff0c\u53ea\u4f5c\u4e3a\u5f31\u80fd\u529b\u4fe1\u53f7\uff0c\u4e0d\u66ff\u6a21\u578b\u88c1\u51b3\u7ed3\u679c\u3002',
  getAppMemoryDescription: '\u8bfb\u53d6\u5e94\u7528\u8bb0\u5fc6\u5feb\u7167\uff0c\u8fd4\u56de\u53ef\u6bd4\u8f83\u7684\u4e1a\u52a1\u8bc1\u636e\uff0c\u5e2e\u52a9\u6a21\u578b\u5224\u65ad\u5e94\u7528\u4e0e\u6570\u636e\u6e90\u662f\u5426\u5339\u914d\u5f53\u524d\u95ee\u9898\u3002',
  getAppMemoryCandidateNote: '\u53ef\u5728 search_apps \u4e4b\u540e\u67e5\u770b\u4e00\u4e2a\u6216\u591a\u4e2a\u5019\u9009\u5e94\u7528\u3002',
  getAppMemoryLevelNote: '\u9ed8\u8ba4\u4f1a\u628a\u76ee\u6807\u5e94\u7528\u7684\u8bb0\u5fc6\u63d0\u5347\u5230 structure \u7ea7\u522b\u3002',
  getAppMemoryAppIdDescription: '\u76ee\u6807\u5e94\u7528 ID\u3002',
  readAppDataDescription: '\u57fa\u4e8e\u5e94\u7528\u8bb0\u5fc6\u8bfb\u53d6\u8868\u5355\u8bb0\u5f55\u6216\u805a\u5408\u7edf\u8ba1\u7ed3\u679c\u3002',
  readAppDataExplicitParametersNote: '\u5de5\u5177\u53ea\u6267\u884c\u663e\u5f0f\u53c2\u6570\uff1b\u8bf7\u81ea\u5df1\u4f20 filters\u3001analysis\uff0c\u4e0d\u8981\u4f9d\u8d56\u5de5\u5177\u89e3\u91ca\u81ea\u7136\u8bed\u8a00\u95ee\u9898\u3002',
  readAppDataModeDescription: '\u8bfb\u53d6\u6a21\u5f0f\u3002',
  readAppDataOrderByDescription: '\u6392\u5e8f\u9879\u5217\u8868\u3002\u6bcf\u4e00\u9879\u53ea\u80fd\u4e8c\u9009\u4e00\uff1a\u8981\u4e48\u6309 metric \u6392\u5e8f\uff0c\u8981\u4e48\u6309 group \u6392\u5e8f\uff0c\u4e0d\u80fd\u540c\u65f6\u4f20\u4e8c\u8005\u3002\u65f6\u95f4\u8d8b\u52bf\u901a\u5e38\u53ea\u6309\u65f6\u95f4 group \u5347\u5e8f\u3002',
  fillCurrentFormDescription: '把用户明确提供的内容填入当前打开的表单，保留页面供用户核对并手动提交。',
  orderDirectionDescription: '\u6392\u5e8f\u65b9\u5411\u3002',
  batchRequireAllFailure: '\u6279\u91cf read_app_data \u6267\u884c\u5931\u8d25\uff0cpartialPolicy=require_all \u65f6\u4e0d\u5141\u8bb8\u8fd4\u56de\u90e8\u5206\u7ed3\u679c\u3002',
  timeGranularityAggregateOnly: 'timeGranularity \u53ea\u5141\u8bb8\u5728 aggregate \u6a21\u5f0f\u4e2d\u4f7f\u7528\u3002',
  analysisAggregateOnly: 'analysis \u53ea\u5141\u8bb8\u5728 aggregate \u6a21\u5f0f\u4e2d\u4f7f\u7528\u3002',
  analysisMustBeObject: 'analysis \u5fc5\u987b\u662f\u5bf9\u8c61\u3002',
  analysisMetricsRequired: 'analysis.metrics \u4e0d\u80fd\u4e3a\u7a7a\u3002',
  analysisTopNGroupRequired: 'analysis.topN \u53ea\u5141\u8bb8\u5728\u663e\u5f0f groupBy \u65f6\u4f7f\u7528\u3002',
  analysisLegacyGroupConflict: 'analysis \u4e0e\u65e7 groupBy/timeGranularity \u53c2\u6570\u8bed\u4e49\u51b2\u7a81\uff0c\u8bf7\u53ea\u4fdd\u7559\u4e00\u79cd\u8868\u8fbe\u65b9\u5f0f\u3002',
  analysisLegacyMinCountConflict: 'analysis \u4e0e\u65e7 minCount \u53c2\u6570\u8bed\u4e49\u51b2\u7a81\uff0c\u8bf7\u53ea\u4fdd\u7559\u4e00\u79cd\u8868\u8fbe\u65b9\u5f0f\u3002',
  analysisLegacyOrderConflict: 'analysis \u4e0e\u65e7 sortBy/sortOrder \u53c2\u6570\u8bed\u4e49\u51b2\u7a81\uff0c\u8bf7\u53ea\u4fdd\u7559\u4e00\u79cd\u8868\u8fbe\u65b9\u5f0f\u3002',
  analysisLegacyTopNConflict: 'analysis \u4e0e\u65e7 topN \u53c2\u6570\u8bed\u4e49\u51b2\u7a81\uff0c\u8bf7\u53ea\u4fdd\u7559\u4e00\u79cd\u8868\u8fbe\u65b9\u5f0f\u3002',
  batchCircuitBroken: '\u6279\u91cf\u6267\u884c\u5df2\u7194\u65ad\uff0c\u5269\u4f59 target \u672a\u7ee7\u7eed\u8c03\u5ea6\u3002',
  batchNoResult: '\u6279\u91cf\u6267\u884c\u672a\u4ea7\u51fa\u7ed3\u679c\u3002',
  aggregateAnalysisMissing: 'aggregate.analysis \u4e0d\u5b58\u5728\uff0c\u65e0\u6cd5\u6267\u884c analysis \u7edf\u8ba1\u3002',
  analysisNoMetricResults: '\u5f53\u524d\u6761\u4ef6\u4e0b\u6ca1\u6709\u5f97\u5230\u53ef\u7edf\u8ba1\u7684\u6307\u6807\u7ed3\u679c\u3002',
  analysisNoGroupedResults: '\u5f53\u524d\u6761\u4ef6\u4e0b\u6ca1\u6709\u5f97\u5230\u6ee1\u8db3\u6761\u4ef6\u7684\u5206\u7ec4\u7ed3\u679c\u3002',
  aiPermissionMissing: '\u5f53\u524d\u5e94\u7528\u672a\u5728 AI \u6743\u9650\u9875\u6388\u6743\uff0c\u65e0\u6cd5\u8bbf\u95ee\u3002',
  sourcePermissionMissing: '\u6570\u636e\u6e90%s\u672a\u5728 AI \u6743\u9650\u9875\u6388\u6743\uff0c\u65e0\u6cd5\u8bbf\u95ee\u3002',
  timeGranularityBucketOnly: 'timeGranularity \u53ea\u80fd\u5728\u65f6\u95f4\u5206\u6876\u805a\u5408\u8def\u5f84\u4e2d\u4f7f\u7528\u3002',
  fallbackSourceName: '\u6570\u636e\u6e90',
  statusPendingReview: '\u5f85\u5ba1',
  statusCompleted: '\u5df2\u5b8c',
  statusPublished: '\u5df2\u53d1',
} as const

type RecordAggregationResult =
  | {
      kind: 'summary_only'
      itemsText: ''
    }
  | {
      kind: 'time_buckets'
      fieldId: string
      fieldName: string
      timeGranularity: TimeGranularity
      totalBucketCount: number
      returnedBucketCount: number
      buckets: Array<{ value: string; count: number }>
      itemsText: string
    }
  | {
      kind: 'grouped'
      fieldId: string
      fieldName: string
      minCount: number
      totalGroupCount: number
      filteredGroupCount: number
      returnedGroupCount: number
      groups: Array<{ value: string; count: number }>
      allGroups?: Array<{ value: string; count: number }>
      itemsText: string
    }

type ReadAppDataTargetInput = {
  type?: string
  id?: string
  appId?: string | null
  name?: string
}

type NormalizedReadAppDataRequest = {
  app: { id: string; name?: string }
  mode: AiReadAppDataMode
  targets: AiReadAppDataTargetRef[]
  executionPreference: AiReadAppDataExecutionPreference
  returnMode: AiReadAppDataReturnMode
  partialPolicy: AiReadAppDataPartialPolicy
  filters?: Record<string, any> | any[]
  groupBy?: string
  timeGranularity?: TimeGranularity | null
  minCount?: number
  topN?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  analysis?: AiReadAppDataAnalysis
  usedLegacyTarget: boolean
}

type ReadAppDataSingleResult =
  | {
      kind: 'record_analysis'
      answerText: string
      itemsText: string
      total: number
      matchedCount: number
      returnedRows: number
      resultCount: number
      fields: string[]
      records: Array<Record<string, any>>
      aggregation: RecordAggregationResult | null
      analysisResult: AiReadAppDataAnalysisResult
    }
  | {
      kind: 'record_total'
      answerText: string
      itemsText: string
      total: number
      matchedCount: number
      returnedRows?: undefined
      resultCount?: undefined
      fields: string[]
      records: Array<Record<string, any>>
      aggregation: RecordAggregationResult | null
      analysisResult?: undefined
    }
  | {
      kind: 'record_aggregate'
      answerText: string
      itemsText: string
      total: number
      matchedCount: number
      returnedRows: number
      resultCount: number
      fields: string[]
      records: Array<Record<string, any>>
      aggregation: RecordAggregationResult | null
      analysisResult?: undefined
    }
  | {
      kind: 'record_rows'
      answerText: string
      itemsText: string
      total: number
      matchedCount: number
      returnedRows: number
      resultCount: number
      fields: string[]
      records: Array<Record<string, any>>
      aggregation: RecordAggregationResult | null
      analysisResult?: undefined
    }

type BatchReadTargetResult = {
  target: AiReadAppDataTargetRef
  ok: boolean
  kind?: ReadAppDataSingleResult['kind']
  answerText?: string
  itemsText?: string
  total?: number
  matchedCount?: number
  returnedRows?: number
  resultCount?: number
  fields?: string[]
  records?: Array<Record<string, any>>
  aggregation?: RecordAggregationResult | null
  analysisResult?: AiReadAppDataAnalysisResult | null
  error?: string
  durationMs: number
  timedOut?: boolean
  queued?: boolean
}

type ResolvedAnalysisMetric = {
  key: string
  op: AiReadAppDataAnalysisMetricOp
  field?: Field | null
  fieldName?: string
  displayMeta?: AiNumericDisplayMeta
}

type ResolvedAnalysisGroup = {
  key: string
  field: Field
  fieldName: string
  timeGranularity?: TimeGranularity | null
  displayMeta?: AiNumericDisplayMeta
}

type AnalysisMetricAccumulator =
  | { op: 'count'; count: number }
  | { op: 'count_distinct'; values: Set<string> }
  | { op: 'sum'; sum: number }
  | { op: 'avg'; sum: number; count: number }
  | { op: 'min'; value: number | null }
  | { op: 'max'; value: number | null }

type BatchExecutionOutcome = {
  perTargetResults: BatchReadTargetResult[]
  succeededTargets: Array<{ id: string; name?: string }>
  failedTargets: Array<{ id: string; name?: string; error: string; timedOut?: boolean; queued?: boolean }>
  partial: boolean
  timedOutCount: number
  queuedCount: number
  achievedConcurrency: number
  durationMs: number
  circuitBroken: boolean
}

type SearchFormWherePlan = {
  databaseFilters: Record<string, any> | any[] | null
  postFilters: Record<string, any> | any[] | null
}

type SearchFormFilterPlan = SearchFormWherePlan

type AiMemoryStatus = 'missing' | 'catalog_only' | 'structure_ready' | 'summary_ready'

type SearchAppCandidate = {
  app: { id: string; name?: string }
  score: number
  recordsScore: number
  summary: string
  matchReasons: string[]
  memoryStatus: AiMemoryStatus
  levels: any
  capabilities: {
    sourceCount: number
    supportsRecords: boolean
  }
  exactNameMatched: boolean
  evidenceStrength: AiEvidenceStrength
  evidenceBreakdown: AiSearchAppEvidenceBreakdown
}

type SearchQueryStructureSignals = {
  queryShape: 'aggregation_like' | 'general_records' | 'unknown'
  hasTimeSignal: boolean
  hasMetricSignal: boolean
  hasDimensionSignal: boolean
  timeKeywords: string[]
  metricKeywords: string[]
  dimensionKeywords: string[]
}

type SearchRouteStructureCoverage = {
  hasTime: boolean
  hasMetric: boolean
  hasDimension: boolean
  timeSemanticMatch: boolean
  metricSemanticMatch: boolean
  dimensionSemanticMatch: boolean
  satisfiesAll: boolean
  satisfiesAllSemantic: boolean
}

@Injectable()
export class AiLocalToolService {

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly projectService: ProjectService,
    private readonly workbenchService: WorkbenchService,
    private readonly formDataService: FormDataService,
    private readonly memoryStore: AiAppMemoryStore,
    private readonly aiConfigService: AiConfigService,
    private readonly agentLogService: AiAgentLogService,
  ) {
  }

  private readonly builtinServerConfigs: BuiltinToolServerConfig[] = [
    {
      id: 'builtin-app',
      name: 'app',
      transport: 'builtin',
      source: 'builtin',
      description: AI_LOCAL_TOOL_COPY.builtinServerDescription,
      enabled: true,
      toolNames: ['search_apps', 'get_app_memory', 'read_app_data', WORKBENCH_AI_FILL_CURRENT_FORM_TOOL],
    },
  ]

  listServers(): AiMcpServerDefinition[] {
    return this.builtinServerConfigs.map(server => ({
      ...server,
      tools: this.listTools(server.id),
    }))
  }

  getServer(serverId: string) {
    return this.builtinServerConfigs.find(item => item.id === serverId) || null
  }

  listTools(serverId?: string): AiToolDefinition[] {
    const nextTools = [
      this.withToolMeta({
        name: 'search_apps',
        description: AI_LOCAL_TOOL_COPY.searchAppsDescription,
        notes: [
          AI_LOCAL_TOOL_COPY.searchAppsCandidateNote,
          AI_LOCAL_TOOL_COPY.searchAppsKeywordsNote,
          AI_LOCAL_TOOL_COPY.searchAppsMemoryNote,
          AI_LOCAL_TOOL_COPY.searchAppsPaginationNote,
        ],
        inputSchema: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array',
              items: { type: 'string' },
              description: AI_LOCAL_TOOL_COPY.searchAppsKeywordsDescription,
            },
            intent: {
              type: 'string',
              enum: ['records', 'unknown'],
              description: AI_LOCAL_TOOL_COPY.searchAppsIntentDescription,
            },
            limit: {
              type: 'number',
              description: '最多返回多少个候选应用，默认 12，最大 20。',
            },
          },
        },
      }, 'ai', 'AI 工具', 'builtin-app', 'app'),
      this.withToolMeta({
        name: 'get_app_memory',
        description: AI_LOCAL_TOOL_COPY.getAppMemoryDescription,
        notes: [
          AI_LOCAL_TOOL_COPY.getAppMemoryCandidateNote,
          AI_LOCAL_TOOL_COPY.getAppMemoryLevelNote,
          '返回结果会同时包含简洁摘要、source 结构信息，以及可比较的 evidenceProfile。',
          '工具不会替模型自动选择 source 或下一次调用；下一步请显式复制返回的 id。',
        ],
        inputSchema: {
          type: 'object',
          properties: {
            appId: { type: 'string', description: AI_LOCAL_TOOL_COPY.getAppMemoryAppIdDescription },
            level: {
              type: 'string',
              enum: ['catalog', 'structure'],
              description: '需要确保达到的记忆级别，默认为 structure。',
            },
            focus: {
              type: 'object',
              properties: {
                sourceIds: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              additionalProperties: false,
            },
          },
          required: ['appId'],
        },
      }, 'ai', 'AI 工具', 'builtin-app', 'app'),
      this.withToolMeta({
        name: 'read_app_data',
        description: AI_LOCAL_TOOL_COPY.readAppDataDescription,
        notes: [
          'read_app_data 可使用 target 或 targets[] 显式传入目标，但不能同时传二者。',
          '当前只支持 target.type=source 或 targets[].type=source。',
          'records / aggregate 模式都应显式传入目标 id，且不能依赖 Runtime 猜测合批。',
          'records/aggregate 支持同 app source batch。',
          AI_LOCAL_TOOL_COPY.readAppDataExplicitParametersNote,
          'aggregate 模式可使用 analysis 或 legacy 顶层聚合参数；两种表达方式互斥，一次调用只能选择一种。analysis 仅支持单 source target。',
          'aggregate 模式支持对时间字段做显式 timeGranularity 分桶；若选择 analysis，请在 analysis.groupBy 中显式指定。',
          'analysis.orderBy[] 的单项只能传 metric 或 group 其中一个；时间趋势通常只按时间 group 升序，不要在同一项里同时传 metric 和 group。',
          'executionPreference 用于表达倾向的执行方式，returnMode 用于表达需要 perTarget、merged 还是两者都要，partialPolicy 用于表达是否允许部分失败继续返回结构化结果。',
        ],
        inputSchema: {
          type: 'object',
          description: 'aggregate 模式支持 analysis 或 legacy 顶层聚合参数两种表达方式；一次调用只能选择其中一种，不要混合传参。analysis 仅支持单 source target。',
          required: ['appId', 'mode'],
          properties: {
            appId: { type: 'string', description: AI_LOCAL_TOOL_COPY.getAppMemoryAppIdDescription },
            mode: {
              type: 'string',
              enum: ['records', 'aggregate'],
              description: AI_LOCAL_TOOL_COPY.readAppDataModeDescription,
            },
            target: {
              type: 'object',
              required: ['type', 'id'],
              properties: {
                type: { type: 'string', enum: ['source'] },
                id: { type: 'string' },
                appId: { type: 'string' },
              },
              additionalProperties: false,
            },
            targets: {
              type: 'array',
              items: {
                type: 'object',
                required: ['type', 'id'],
                properties: {
                  type: { type: 'string', enum: ['source'] },
                  id: { type: 'string' },
                  appId: { type: 'string' },
                },
                additionalProperties: false,
              },
              description: '正式主协议。records/aggregate 可传同 app 多个 source target。',
            },
            executionPreference: {
              type: 'string',
              enum: ['auto', 'batch', 'serial', 'parallel'],
              description: '执行倾向。默认为 auto；同 app source 统计通常优先 batch。',
            },
            returnMode: {
              type: 'string',
              enum: ['per_target', 'merged', 'both'],
              description: '返回结构偏好。默认为 both。',
            },
            partialPolicy: {
              type: 'string',
              enum: ['allow_partial', 'require_all'],
              description: '批量执行时的部分失败策略。默认为 allow_partial。',
            },
            filters: {
              type: 'object',
              additionalProperties: true,
            },
            groupBy: { type: 'string', description: '仅用于 legacy 顶层聚合表达；若使用 analysis，请不要传此字段。' },
            timeGranularity: {
              type: 'string',
              enum: ['minute', 'hour', 'day', 'week', 'month', 'year'],
              description: '仅用于 legacy 顶层聚合表达；若使用 analysis，请在 analysis.groupBy 中指定。',
            },
            minCount: { type: 'number', description: '仅用于 legacy 顶层聚合表达；若使用 analysis，请改用 analysis.having。' },
            topN: { type: 'number', description: '仅用于 legacy 顶层聚合表达；若使用 analysis，请改用 analysis.topN。' },
            limit: { type: 'number' },
            sortBy: { type: 'string', description: '仅用于 legacy 顶层聚合表达；若使用 analysis，请改用 analysis.orderBy。' },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], description: '仅用于 legacy 顶层聚合表达；不要单独传，需 sortBy 配套使用；若使用 analysis，请改用 analysis.orderBy.direction。' },
            analysis: {
              type: 'object',
              description: '仅用于 aggregate 模式，且仅支持单 source target；若使用 analysis，则不要再传 legacy 顶层聚合参数。',
              additionalProperties: false,
              properties: {
                metrics: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['op', 'as'],
                    properties: {
                      op: {
                        type: 'string',
                        enum: ['count', 'count_distinct', 'sum', 'avg', 'min', 'max'],
                      },
                      field: { type: 'string' },
                      as: { type: 'string' },
                    },
                  },
                },
                groupBy: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['field'],
                    properties: {
                      field: { type: 'string' },
                      as: { type: 'string' },
                      timeGranularity: {
                        type: 'string',
                        enum: ['minute', 'hour', 'day', 'week', 'month', 'year'],
                      },
                    },
                  },
                },
                having: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['metric', 'op', 'value'],
                    properties: {
                      metric: { type: 'string' },
                      op: { type: 'string', enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'ne'] },
                      value: {
                        anyOf: [
                          { type: 'number' },
                          { type: 'string' },
                          { type: 'boolean' },
                          { type: 'null' },
                        ],
                      },
                    },
                  },
                },
                orderBy: {
                  type: 'array',
                  description: AI_LOCAL_TOOL_COPY.readAppDataOrderByDescription,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      metric: { type: 'string', description: '按某个 metrics[].as 排序；与 group 互斥。' },
                      group: { type: 'string', description: '按某个 groupBy[].as 或 groupBy[].field 排序；与 metric 互斥。时间趋势通常用这个字段按 asc 排序。' },
                      direction: { type: 'string', enum: ['asc', 'desc'], description: AI_LOCAL_TOOL_COPY.orderDirectionDescription },
                    },
                  },
                },
                topN: { type: 'number' },
              },
            },
          },
        },
      }, 'ai', 'AI 工具', 'builtin-app', 'app'),
      this.withToolMeta({
        name: WORKBENCH_AI_FILL_CURRENT_FORM_TOOL,
        description: AI_LOCAL_TOOL_COPY.fillCurrentFormDescription,
        notes: [
          '只填写当前表单上下文中给出的字段 ID。',
          '能填写的内容先填写；缺失、歧义和不支持的字段在工具结果返回后集中追问。',
          '同一轮所有已明确字段应在一次调用中提交，不要把普通字段或子表单字段拆成多次调用。',
          '默认 writeMode=fill_empty，不覆盖已有值；用户明确要求修改时才使用 replace。',
          '人员和部门字段传名称；同名或无法匹配时由客户端返回候选。',
          '工具不会提交表单或保存草稿。',
        ],
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            contextId: { type: 'string' },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['fieldId', 'value'],
                properties: {
                  fieldId: { type: 'string' },
                  value: {},
                  writeMode: { type: 'string', enum: ['fill_empty', 'replace'] },
                },
              },
            },
            subforms: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['fieldId', 'rows'],
                properties: {
                  fieldId: { type: 'string' },
                  operation: { type: 'string', enum: ['append_rows', 'update_rows'] },
                  rows: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['fields'],
                      properties: {
                        rowToken: { type: 'string' },
                        fields: {
                          type: 'array',
                          items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['fieldId', 'value'],
                            properties: {
                              fieldId: { type: 'string' },
                              value: {},
                              writeMode: { type: 'string', enum: ['fill_empty', 'replace'] },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }, 'ai', 'AI 工具', 'builtin-app', 'app'),
    ]

    const searchAppsTool = nextTools.find(item => item.name === 'search_apps')
    const searchAppsIntentEnum = searchAppsTool?.inputSchema?.properties?.intent?.enum
    if (Array.isArray(searchAppsIntentEnum)) {
      searchAppsTool.inputSchema.properties.intent.enum = ['records', 'unknown']
    }

    const readAppDataTool = nextTools.find(item => item.name === 'read_app_data')
    const readAppDataProperties = readAppDataTool?.inputSchema?.properties
    if (readAppDataProperties && typeof readAppDataProperties === 'object') {
      if (Array.isArray(readAppDataProperties.mode?.enum)) {
        readAppDataProperties.mode.enum = ['records', 'aggregate']
      }
      if (Array.isArray(readAppDataProperties.target?.properties?.type?.enum)) {
        readAppDataProperties.target.properties.type.enum = ['source']
      }
      if (Array.isArray(readAppDataProperties.targets?.items?.properties?.type?.enum)) {
        readAppDataProperties.targets.items.properties.type.enum = ['source']
      }
      delete readAppDataProperties.matchKeywords
      delete readAppDataProperties.window
      delete readAppDataProperties.directoryPath
      delete readAppDataProperties.itemPath
      delete readAppDataProperties.documentPath
    }

    if (!serverId) {
      return nextTools
    }

    const nextServer = this.getServer(serverId)
    if (!nextServer) {
      return []
    }

    return nextTools.filter(item => nextServer.toolNames.includes(item.name))
  }

  async executeInServer(serverId: string, toolName: string, input: Record<string, any> = {}, context: AiToolExecutionContext) {
    const server = this.getServer(serverId)
    if (!server) {
      throw new Error(`未注册的内置工具服务: ${serverId}`)
    }
    if (!server.toolNames.includes(toolName)) {
      throw new Error(`工具“${toolName}”不属于内置工具服务“${server.name}”`)
    }
    return await this.execute(toolName, input, context)
  }

  private withToolMeta(tool: AiToolDefinition, groupKey: string, groupTitle: string, mcpServerId: string, mcpServerName: string): AiToolDefinition {
    return {
      ...tool,
      groupKey,
      groupTitle,
      mcpServerId,
      mcpServerName,
      source: 'builtin',
    }
  }

  async execute(toolName: string, input: Record<string, any> = {}, context: AiToolExecutionContext) {
    return await this.getWarmupService().runWithForegroundActivity(async () => {
      switch (toolName) {
        case 'search_apps':
          return await this.searchAppsWithContext(context, input)
        case 'get_app_memory':
          return await this.getAppMemoryWithContext(context, input)
        case 'read_app_data':
          return await this.readAppDataWithContext(context, input)
        case WORKBENCH_AI_FILL_CURRENT_FORM_TOOL:
          throw new Error(global.i18next.t('aiLocalToolService.formFillMustRunOnWorkbenchPage'))
        default:
          throw new Error(`未注册的 AI 工具: ${toolName}`)
      }
    })
  }

  async searchAppsWithContext(context: AiToolExecutionContext, input: Record<string, any> = {}): Promise<AiSearchAppsOutput> {
    const startedAt = Date.now()
    const featureFlags = await this.aiConfigService.getFeatureFlags(context.conversationProfile)
    const accessibleAppsSignature = featureFlags.searchAppsCatalogInvalidateEnabled
      ? await this.getAccessibleAppsSignatureForContext(context)
      : undefined
    const apps = await this.listAccessibleApps(context)
    const keywords = this.normalizeSearchKeywords(input.keywords)
    const intent = this.normalizeReadIntent(input.intent)
    const limit = this.normalizePageSize(input.limit, 12, 20)
    const manifests = await Promise.all(
      apps.map(async app => [app.id, this.filterManifestByAiPermission(app.id, await this.memoryStore.readManifest(app.id))] as const),
    )
    const manifestMap = new Map<string, AiAppMemoryManifest | null>(manifests)
    const coldApps = apps.filter(app => !manifestMap.get(app.id))
    const coldPrimeAppIds: string[] = []
    const neutralStructurePrimeAppIds: string[] = []
    const topCandidateStructurePrimeAppIds: string[] = []

    const coldTableNameMap = new Map<string, string[]>()
    if (coldApps.length) {
      const coldTableNameEntries = await Promise.all(
        coldApps.map(async app => [app.id, await this.readAppTableNamesForSearch(app.id)] as const),
      )
      coldTableNameEntries.forEach(([appId, tableNames]) => {
        coldTableNameMap.set(appId, tableNames)
      })
      const coldPrimeCandidates = this.sortSearchAppCandidates(
        coldApps.map(app => this.buildColdSearchAppPrimeCandidate(
          app,
          coldTableNameMap.get(app.id) || [],
          keywords,
        )),
        intent,
      )
      const pickedColdPrimeAppIds = this.pickColdSearchPrimeAppIds(
        coldPrimeCandidates,
        this.resolveColdSearchPrimeWindow(limit, keywords, featureFlags),
        keywords,
      )
      coldPrimeAppIds.push(...pickedColdPrimeAppIds)

      if (pickedColdPrimeAppIds.length) {
        await this.primeSearchAppMemories(
          pickedColdPrimeAppIds,
          context,
          'catalog',
          featureFlags.warmupSearchSyncPrimeJoinTimeoutMs,
        )
        await this.refreshSearchAppManifests(pickedColdPrimeAppIds, manifestMap)
      }
    }

    if (this.shouldPrimeNeutralSearchStructure({
      featureFlags,
      conversationProfile: context.conversationProfile,
      intent,
    })) {
      const structurePrimeCandidates = this.sortSearchAppCandidates(
        apps
          .filter(app => Boolean(manifestMap.get(app.id)))
          .map(app => this.buildSearchAppCandidate(app, manifestMap.get(app.id) || null, keywords, intent)),
        intent,
      )
      const pickedNeutralStructurePrimeAppIds = this.pickNeutralSearchStructurePrimeAppIds(
        structurePrimeCandidates,
        manifestMap,
        keywords,
      )
      neutralStructurePrimeAppIds.push(...pickedNeutralStructurePrimeAppIds)
      if (pickedNeutralStructurePrimeAppIds.length) {
        await this.primeSearchAppMemories(pickedNeutralStructurePrimeAppIds, context, 'structure')
        await this.refreshSearchAppManifests(pickedNeutralStructurePrimeAppIds, manifestMap)
      }
    }

    const readyCandidates = this.sortSearchAppCandidates(
      apps
        .filter(app => Boolean(manifestMap.get(app.id)))
        .map(app => this.buildSearchAppCandidate(app, manifestMap.get(app.id) || null, keywords, intent)),
      intent,
    )
    const coldFallbackCandidates = coldApps
      .filter(app => !manifestMap.get(app.id))
      .map(app => this.buildColdSearchAppFallbackCandidate(
        app,
        coldTableNameMap.get(app.id) || [],
        keywords,
      ))
    const ranked = this.sortSearchAppCandidates([
      ...readyCandidates,
      ...coldFallbackCandidates,
    ], intent)

    const items = ranked.slice(0, limit)
    const truncated = ranked.length > limit
    const matchedCount = ranked.filter(item => item.score > 0).length
    const searchConvergence = this.buildSearchConvergenceState(ranked, matchedCount, intent, {
      dominantConvergenceEnabled: featureFlags.searchAppsDominantConvergenceEnabled,
    })
    const topCandidateManifest = searchConvergence.convergence === 'clear'
      ? (manifestMap.get(searchConvergence.topCandidateAppId) || null)
      : null
    const visibleTopCandidateManifest = this.applyDerivedSummaryVisibilityToManifest(
      topCandidateManifest,
      featureFlags,
    )
    const topCandidateSemanticLevel = String(topCandidateManifest?.levels?.semantic || 'missing').trim()
    const semanticWarmupHit = topCandidateSemanticLevel === 'ready' || topCandidateSemanticLevel === 'partial'
    const derivedSummaryAvailable = Boolean(String(visibleTopCandidateManifest?.semanticProfile?.derivedSummary || '').trim())
    const semanticSummaryAvailable = Boolean(String(
      visibleTopCandidateManifest?.semanticProfile?.derivedSummary
      || visibleTopCandidateManifest?.semanticProfile?.summary
      || '',
    ).trim())
    const semanticScheduled = Boolean(
      searchConvergence.topCandidateAppId
      && this.shouldScheduleSemanticWarmupForManifest(topCandidateManifest),
    )
    const semanticRequestedSourceIds = this.collectVisibleSemanticWarmupSourceIds(topCandidateManifest)
    if (semanticScheduled) {
      this.tryScheduleSemanticWarmup(searchConvergence.topCandidateAppId, 'search_top1', {
        requestedSourceIds: semanticRequestedSourceIds,
        traceId: context.traceId,
        toolCallId: context.toolCallId,
      })
    }
    if (featureFlags.searchAppsTopCandidateStructurePrimeEnabled) {
      const pickedTopCandidateStructurePrimeAppIds = this.pickTopCandidateStructurePrimeAppIds(items, {
        intent,
        convergence: searchConvergence.convergence,
        dominantTopCandidate: searchConvergence.dominantTopCandidate,
        limit: featureFlags.searchAppsTopCandidateStructurePrimeLimit,
      })
      topCandidateStructurePrimeAppIds.push(...pickedTopCandidateStructurePrimeAppIds)
      if (pickedTopCandidateStructurePrimeAppIds.length) {
        await this.primeSearchAppMemories(
          pickedTopCandidateStructurePrimeAppIds,
          context,
          'structure',
          featureFlags.searchAppsTopCandidateStructurePrimeJoinTimeoutMs,
        )
      }
    }
    this.getWarmupService().recordSearchExposure(items.map(item => item.app.id))
    await this.recordWarmupToolTrace({
      kind: 'search_apps',
      traceId: context.traceId,
      toolCallId: context.toolCallId,
      round: context.toolRound,
      updatedAt: Date.now(),
      durationMs: Math.max(0, Date.now() - startedAt),
      intent,
      keywords,
      accessibleAppCount: apps.length,
      manifestReadyCount: apps.length - coldApps.length,
      coldAppCount: coldApps.length,
      coldPrimeAppIds,
      neutralStructurePrimeAppIds,
      topCandidateStructurePrimeAppIds,
      returnedAppIds: items.map(item => item.app.id),
      topCandidateAppId: searchConvergence.topCandidateAppId,
      convergence: searchConvergence.convergence,
      requiresDisambiguation: searchConvergence.requiresDisambiguation,
      semanticScheduled,
      semanticScheduleReason: semanticScheduled ? 'search_top1' : undefined,
      semanticRequestedSourceIds: semanticScheduled ? semanticRequestedSourceIds : undefined,
      semanticWarmupHit,
      semanticSummaryAvailable,
      derivedSummaryAvailable,
    })

    return {
      tool: 'search_apps',
      accessibleAppsSignature,
      keywords,
      intent,
      totalAccessible: apps.length,
      totalMatched: matchedCount,
      totalReturned: items.length,
      truncated,
      convergence: searchConvergence.convergence,
      topScore: searchConvergence.topScore,
      topScoreGap: searchConvergence.topScoreGap,
      topScoreRatio: searchConvergence.topScoreRatio,
      topCandidateAppId: searchConvergence.topCandidateAppId,
      dominantTopCandidate: searchConvergence.dominantTopCandidate,
      resultSignature: searchConvergence.resultSignature,
      candidateWeakSignature: searchConvergence.candidateWeakSignature,
      requiresDisambiguation: searchConvergence.requiresDisambiguation,
      ambiguitySignals: searchConvergence.ambiguitySignals,
      evidenceStrength: searchConvergence.evidenceStrength,
      evidenceBreakdown: searchConvergence.evidenceBreakdown,
      summary: this.buildSearchAppsResponseSummary({
        keywordCount: keywords.length,
        matchedCount,
        returnedCount: items.length,
        requiresDisambiguation: searchConvergence.requiresDisambiguation,
      }),
      apps: items.map(item => {
        const visibleManifest = this.applyDerivedSummaryVisibilityToManifest(
          manifestMap.get(item.app.id) || null,
          featureFlags,
        )
        return {
          appId: item.app.id,
          appName: item.app.name || item.app.id,
          score: item.score,
          summary: this.buildSearchAppSummary(item.app.name || item.app.id, visibleManifest),
          matchReasons: item.matchReasons,
          memoryStatus: item.memoryStatus,
          levels: item.levels,
          capabilities: item.capabilities,
          evidenceStrength: item.evidenceStrength,
          evidenceBreakdown: item.evidenceBreakdown,
        }
      }),
    }
  }

  private buildSearchAppsResponseSummary(options: {
    keywordCount: number
    matchedCount: number
    returnedCount: number
    requiresDisambiguation: boolean
  }) {
    if (!options.keywordCount) {
      return `当前没有显式 keywords，已返回 ${options.returnedCount} 个可访问应用供初筛。`
    }

    if (options.requiresDisambiguation) {
      const fallbackNotice = options.returnedCount > options.matchedCount && options.matchedCount > 0
        ? `其中 ${Math.min(options.matchedCount, options.returnedCount)} 个是当前命中候选，其余结果只是可访问应用兜底。`
        : ''
      return `当前关键词共匹配 ${options.matchedCount} 个应用候选，已返回前 ${options.returnedCount} 个结果；候选之间仍存在重叠，需要继续比较证据${fallbackNotice}`
    }

    if (options.returnedCount > options.matchedCount && options.matchedCount > 0) {
      return `当前关键词共匹配 ${options.matchedCount} 个应用候选，已返 ${options.matchedCount} 个命中候选，并额外保 ${options.returnedCount - options.matchedCount} 个可访问应用作为兜底参考。`
    }

    return `当前关键词共匹配 ${options.matchedCount} 个应用候选，已返回前 ${options.returnedCount} 个结果。`
  }

  private async readAppTableNamesForSearch(appId: string) {
    try {
      const body = await this.projectService.getNocodeBody(appId)
      const tables = this.filterTablesByAiPermission(
        appId,
        (Array.isArray(body?.formData?.tables) ? body.formData.tables : [])
          .filter((table: any) => !table?.meta?.extra?.primaryTable),
      )
      return [...new Set(
        tables
          .map((table: any) => String(table?.alias || table?.uid || '').trim())
          .filter(Boolean),
      )]
    } catch {
      return []
    }
  }

  private buildColdSearchAppPrimeCandidate(
    app: { id: string; name?: string },
    tableNames: string[],
    keywords: string[],
  ) {
    const appName = String(app.name || app.id || '').trim() || String(app.id || '').trim()
    let score = 0

    const nameScore = this.scoreSearchValues([appName, app.id], keywords)
    if (nameScore > 0) {
      score += nameScore * 4
    }

    const tableScore = this.scoreSearchValues(tableNames, keywords)
    if (tableScore > 0) {
      score += tableScore * 2
    }

    if (!keywords.length) {
      score = Math.max(score, 1)
    }

    return {
      app,
      score,
      recordsScore: 0,
    }
  }

  private buildColdSearchAppFallbackCandidate(
    app: { id: string; name?: string },
    tableNames: string[],
    keywords: string[],
  ): SearchAppCandidate {
    const appName = String(app.name || app.id || '').trim() || String(app.id || '').trim()
    const levels = this.buildEmptyMemoryLevels()
    const matchReasons: string[] = []
    const exactNameMatched = this.hasExactSearchKeywordMatch([appName, app.id], keywords)
    const evidenceBreakdown: AiSearchAppEvidenceBreakdown = {
      exactAppNameMatch: exactNameMatched,
      appNameScore: 0,
      tableNameScore: 0,
      recordsScore: 0,
      weakCapabilityScore: 0,
    }
    let score = 0

    const nameScore = this.scoreSearchValues([appName, app.id], keywords)
    if (nameScore > 0) {
      evidenceBreakdown.appNameScore = nameScore * 4
      score += evidenceBreakdown.appNameScore
      if (exactNameMatched) {
        matchReasons.push('exact_app_name_match')
      }
      matchReasons.push('app_name_match')
    }

    const tableScore = this.scoreSearchValues(tableNames, keywords)
    if (tableScore > 0) {
      evidenceBreakdown.tableNameScore = tableScore * 2
      evidenceBreakdown.recordsScore = evidenceBreakdown.tableNameScore
      score += evidenceBreakdown.tableNameScore
      matchReasons.push('table_name_match')
    }

    if (!keywords.length) {
      score = Math.max(score, 1)
    }

    const previewTables = [...new Set(tableNames)]
      .filter(Boolean)

    return {
      app,
      score,
      recordsScore: Number(evidenceBreakdown.recordsScore || 0),
      summary: previewTables.length
        ? `${appName} 的记忆尚未初始化，当前先按应用名和表名参与召回。可见表名示例：${previewTables.join('、')}。`
        : `${appName} 的记忆尚未初始化，当前先按应用名参与召回。`,
      matchReasons: this.uniqueStrings(matchReasons).length
        ? this.uniqueStrings(matchReasons).slice(0, 6)
        : ['accessible_app'],
      memoryStatus: this.buildMemoryStatus(levels),
      levels,
      exactNameMatched,
      evidenceStrength: this.resolveSearchCandidateEvidenceStrength(score, evidenceBreakdown),
      evidenceBreakdown,
      capabilities: {
        sourceCount: tableNames.length,
        supportsRecords: tableNames.length > 0,
      },
    }
  }

  private pickColdSearchPrimeAppIds(
    candidates: Array<{ app: { id: string; name?: string }; score: number }>,
    limit: number,
    keywords: string[],
  ) {
    const nextCandidates = keywords.length
      ? candidates.filter(item => item.score > 0)
      : candidates

    return nextCandidates
      .slice(0, limit)
      .map(item => String(item.app.id || '').trim())
      .filter(Boolean)
  }

  private resolveColdSearchPrimeWindow(
    limit: number,
    keywords: string[],
    featureFlags?: { warmupSearchSyncPrimeLimit?: number } | null,
  ) {
    const configuredLimit = Math.max(1, Math.round(Number(featureFlags?.warmupSearchSyncPrimeLimit || 5)) || 5)
    if (!keywords.length) {
      return Math.min(limit, configuredLimit)
    }
    return Math.min(configuredLimit, Math.max(1, limit))
  }

  private async refreshSearchAppManifests(
    appIds: string[],
    manifestMap: Map<string, AiAppMemoryManifest | null>,
  ) {
    const normalizedIds = [...new Set(
      (Array.isArray(appIds) ? appIds : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )]
    if (!normalizedIds.length) {
      return
    }

    const manifests = await Promise.all(
      normalizedIds.map(async appId => [appId, this.filterManifestByAiPermission(appId, await this.memoryStore.readManifest(appId))] as const),
    )
    manifests.forEach(([appId, manifest]) => {
      manifestMap.set(appId, manifest || null)
    })
  }

  private shouldPrimeNeutralSearchStructure(options: {
    featureFlags?: { neutralColdStartProfileEnabled?: boolean } | null
    conversationProfile?: AiToolExecutionContext['conversationProfile']
    intent: 'records' | 'unknown'
  }) {
    return options.featureFlags?.neutralColdStartProfileEnabled === true
      && !String(options.conversationProfile || '').trim()
      && options.intent === 'unknown'
  }

  private pickNeutralSearchStructurePrimeAppIds(
    candidates: SearchAppCandidate[],
    manifestMap: Map<string, AiAppMemoryManifest | null>,
    keywords: string[],
  ) {
    const nextCandidates = keywords.length
      ? candidates.filter(item => item.score > 0)
      : candidates

    return nextCandidates
      .filter(item => this.needsNeutralSearchStructurePrime(manifestMap.get(item.app.id)))
      .slice(0, this.resolveNeutralSearchStructurePrimeWindow(keywords))
      .map(item => String(item.app.id || '').trim())
      .filter(Boolean)
  }

  private pickTopCandidateStructurePrimeAppIds(
    candidates: SearchAppCandidate[],
    options: {
      intent: 'records' | 'unknown'
      convergence: AiSearchConvergence
      dominantTopCandidate?: boolean
      limit: number
    },
  ) {
    const normalizedLimit = Math.max(1, Math.min(3, Math.round(Number(options.limit || 0)) || 3))
    if (options.intent === 'records') {
      if (options.convergence !== 'clear' || !options.dominantTopCandidate) {
        return []
      }
      const topCandidate = candidates[0]
      if (!topCandidate || !this.needsStructurePrimeFromLevels(topCandidate.levels)) {
        return []
      }
      const appId = String(topCandidate.app.id || '').trim()
      return appId ? [appId] : []
    }

    const desiredCount = options.convergence === 'weak'
      ? 3
      : 0
    if (desiredCount <= 0) {
      return []
    }

    return candidates
      .filter(item => this.needsStructurePrimeFromLevels(item?.levels))
      .slice(0, Math.min(desiredCount, normalizedLimit))
      .map(item => String(item.app.id || '').trim())
      .filter(Boolean)
  }

  private resolveNeutralSearchStructurePrimeWindow(keywords: string[]) {
    return keywords.length ? 2 : 1
  }

  private needsNeutralSearchStructurePrime(manifest?: AiAppMemoryManifest | null) {
    if (!manifest) {
      return false
    }

    return this.needsStructurePrimeFromLevels(manifest.levels)
  }

  private needsStructurePrimeFromLevels(levels?: { structure?: string } | null) {
    const structureStatus = String(levels?.structure || 'missing').trim()
    return structureStatus === 'missing' || structureStatus === 'failed' || structureStatus === 'stale'
  }

  private async primeSearchAppMemories(
    appIds: string[],
    context: AiToolExecutionContext,
    level: 'catalog' | 'structure',
    joinTimeoutMs?: number,
  ) {
    const normalizedIds = [...new Set(
      (Array.isArray(appIds) ? appIds : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )]
    const effectiveJoinTimeoutMs = Number.isFinite(Number(joinTimeoutMs))
      ? Math.max(0, Math.round(Number(joinTimeoutMs)))
      : (level === 'structure' ? 2800 : 1400)
    const summary = await this.getWarmupService().primeAppMemories(
      normalizedIds,
      context,
      level,
      effectiveJoinTimeoutMs,
    )
    await this.recordWarmupToolTrace({
      kind: 'prime_search_app_memories',
      traceId: context.traceId,
      toolCallId: context.toolCallId,
      round: context.toolRound,
      updatedAt: Date.now(),
      durationMs: summary?.durationMs,
      targetLevel: level,
      appIds: normalizedIds,
      joinTimeoutMs: effectiveJoinTimeoutMs,
      scheduledCount: summary?.scheduledCount,
      settledCount: summary?.settledCount,
      timeoutCount: summary?.timeoutCount,
      failedCount: summary?.failedCount,
    })
  }

  private sortSearchAppCandidates<T extends {
    app: { id: string; name?: string }
    score: number
    evidenceBreakdown?: AiSearchAppEvidenceBreakdown
  }>(
    items: T[],
    intent: 'records' | 'unknown' = 'unknown',
  ) {
    const getRecordsScore = (item: T) => Number(item?.evidenceBreakdown?.recordsScore || 0)
    const isAggregationLike = (item: T) => item?.evidenceBreakdown?.queryShape === 'aggregation_like'
    const getStructuralTieBreak = (left: T, right: T) =>
      (isAggregationLike(left) || isAggregationLike(right))
        ? Number(right?.evidenceBreakdown?.structuralFitScore || 0) - Number(left?.evidenceBreakdown?.structuralFitScore || 0)
          || Number(right?.evidenceBreakdown?.distinctivenessScore || 0) - Number(left?.evidenceBreakdown?.distinctivenessScore || 0)
          || Number(left?.evidenceBreakdown?.mismatchPenalty || 0) - Number(right?.evidenceBreakdown?.mismatchPenalty || 0)
        : 0

    return items.sort((left, right) =>
      Number(Boolean(right?.evidenceBreakdown?.exactAppNameMatch)) - Number(Boolean(left?.evidenceBreakdown?.exactAppNameMatch))
      || (intent === 'records'
          ? right.score - left.score
            || getRecordsScore(right) - getRecordsScore(left)
            || Number(right?.evidenceBreakdown?.appNameScore || 0) - Number(left?.evidenceBreakdown?.appNameScore || 0)
            || getStructuralTieBreak(left, right)
          : right.score - left.score
            || Number(right?.evidenceBreakdown?.appNameScore || 0) - Number(left?.evidenceBreakdown?.appNameScore || 0)
            || getRecordsScore(right) - getRecordsScore(left))
      || String(left.app.name || left.app.id || '').localeCompare(String(right.app.name || right.app.id || ''), 'zh-CN'),
    )
  }

  private buildSearchConvergenceState<T extends { app: { id: string; name?: string }; score: number; exactNameMatched?: boolean; evidenceStrength?: AiEvidenceStrength }>(
    ranked: T[],
    matchedCount: number,
    intent: 'records' | 'unknown',
    options?: {
      dominantConvergenceEnabled?: boolean
    },
  ) {
    const topCandidate = ranked[0] || null
    const topScore = Number(topCandidate?.score || 0)
    const secondScore = Number(ranked[1]?.score || 0)
    const topScoreGap = Math.max(0, topScore - secondScore)
    const topScoreRatio = secondScore > 0
      ? Number((topScore / secondScore).toFixed(4))
      : (topScore > 0 ? Number(topScore.toFixed(4)) : undefined)
    const normalizedMatchedCount = Math.max(0, Number(matchedCount || 0))
    const exactNameMatchCount = ranked
      .filter(item => Number(item.score || 0) > 0 && Boolean(item.exactNameMatched))
      .length
    const topCandidateExactNameMatch = Boolean(topCandidate?.exactNameMatched)
    const dominantTopCandidate = this.isDominantTopSearchCandidate({
      matchedCount: normalizedMatchedCount,
      topScore,
      secondScore,
      topScoreGap,
      topCandidateEvidenceStrength: topCandidate?.evidenceStrength,
    })
    const convergence = this.analyzeSearchConvergence(
      normalizedMatchedCount,
      exactNameMatchCount,
      topCandidateExactNameMatch,
      dominantTopCandidate,
      options?.dominantConvergenceEnabled === true,
    )
    const signatureSeed = ranked
      .slice(0, 5)
      .map(item => `${String(item.app.id || '').trim()}:${Number(item.score || 0)}`)
      .join('|')
    const candidateWeakSignature = this.buildSearchCandidateWeakSignature(ranked, normalizedMatchedCount, intent)
    const ambiguitySignals = this.buildSearchAmbiguitySignals({
      matchedCount: normalizedMatchedCount,
      topScore,
      topScoreGap,
      exactNameMatchCount,
      topCandidateExactNameMatch,
      convergence,
    })
    const requiresDisambiguation = normalizedMatchedCount > 0 && convergence !== 'clear'

    return {
      convergence,
      topScore,
      topScoreGap,
      topScoreRatio,
      topCandidateAppId: convergence === 'none'
        ? ''
        : String(topCandidate?.app?.id || '').trim(),
      dominantTopCandidate,
      resultSignature: signatureSeed
        ? `${convergence}:${normalizedMatchedCount}:${signatureSeed}`
        : `${convergence}:${normalizedMatchedCount}`,
      candidateWeakSignature,
      requiresDisambiguation,
      ambiguitySignals,
      evidenceStrength: this.resolveSearchEvidenceStrength(
        convergence,
        normalizedMatchedCount,
        topCandidate?.evidenceStrength,
        exactNameMatchCount,
      ),
      evidenceBreakdown: {
        matchedCount: normalizedMatchedCount,
        exactNameMatchCount,
        topScore,
        topScoreGap,
        topScoreRatio,
        topCandidateExactNameMatch,
        dominantTopCandidate,
      },
    }
  }

  private isDominantTopSearchCandidate(options: {
    matchedCount: number
    topScore: number
    secondScore: number
    topScoreGap: number
    topCandidateEvidenceStrength?: AiEvidenceStrength
  }) {
    if (options.matchedCount <= 1 || options.topScore <= 0) {
      return false
    }

    const ratio = options.secondScore > 0
      ? options.topScore / options.secondScore
      : (options.topScore > 0 ? options.topScore : 0)
    const minimumScore = options.topCandidateEvidenceStrength === 'strong' ? 18 : 24
    const minimumGap = Math.max(8, Math.ceil(options.topScore * 0.35))

    return options.topScore >= minimumScore
      && options.topScoreGap >= minimumGap
      && ratio >= 3
  }

  private buildSearchCandidateWeakSignature<T extends { app: { id: string; name?: string }; score: number }>(
    ranked: T[],
    matchedCount: number,
    intent: 'records' | 'unknown',
  ) {
    const matchedRanked = ranked.filter(item => Number(item?.score || 0) > 0)
    const topCandidateAppId = String(matchedRanked[0]?.app?.id || '').trim() || 'none'
    const candidateIds = matchedRanked
      .slice(0, 5)
      .map(item => String(item?.app?.id || '').trim())
      .filter(Boolean)
      .join('|') || 'none'

    return `${intent}:${Math.max(0, Number(matchedCount || 0))}:top1=${topCandidateAppId}:candidates=${candidateIds}`
  }

  private analyzeSearchConvergence(
    matchedCount: number,
    exactNameMatchCount: number,
    topCandidateExactNameMatch: boolean,
    dominantTopCandidate: boolean,
    dominantConvergenceEnabled: boolean,
  ): AiSearchConvergence {
    if (matchedCount <= 0) {
      return 'none'
    }

    if (matchedCount === 1) {
      return 'clear'
    }

    if (exactNameMatchCount === 1 && topCandidateExactNameMatch) {
      return 'clear'
    }

    if (dominantConvergenceEnabled && dominantTopCandidate) {
      return 'clear'
    }

    return 'weak'
  }

  async getAppMemoryWithContext(context: AiToolExecutionContext, input: Record<string, any> = {}): Promise<AiGetAppMemoryOutput> {
    const app = await this.resolveApp(context, input, true)
    const featureFlags = await this.aiConfigService.getFeatureFlags(context.conversationProfile)
    const accessibleAppsSignature = featureFlags.searchAppsCatalogInvalidateEnabled
      ? await this.getAccessibleAppsSignatureForContext(context).catch(() => undefined)
      : undefined
    this.getWarmupService().recordConfirmedAppAccess(app.id, 'memory')
    const level = input.level === 'catalog' ? 'catalog' : 'structure'
    const startedAt = Date.now()
    const manifestBefore = this.filterManifestByAiPermission(app.id, await this.memoryStore.readManifest(app.id))
    const manifest = await this.ensureAccessibleAppManifest(app.id, context, level)
    const visibleManifest = this.filterManifestByAiPermission(app.id, manifest)
    const visibleSemanticProfile = this.applyDerivedSummaryVisibility(
      visibleManifest?.semanticProfile,
      featureFlags,
    )
    const semanticLevel = String(visibleManifest?.levels?.semantic || 'missing').trim()
    const semanticWarmupHit = semanticLevel === 'ready' || semanticLevel === 'partial'
    const derivedSummaryAvailable = Boolean(String(visibleSemanticProfile?.derivedSummary || '').trim())
    const semanticSummaryAvailable = Boolean(String(
      visibleSemanticProfile?.derivedSummary
      || visibleSemanticProfile?.summary
      || '',
    ).trim())
    const semanticScheduled = this.shouldScheduleSemanticWarmupForManifest(visibleManifest)
    const semanticRequestedSourceIds = this.collectVisibleSemanticWarmupSourceIds(visibleManifest)
    if (semanticScheduled) {
      this.tryScheduleSemanticWarmup(app.id, 'get_app_memory', {
        requestedSourceIds: semanticRequestedSourceIds,
        traceId: context.traceId,
        toolCallId: context.toolCallId,
      })
    }
    await this.recordWarmupToolTrace({
      kind: 'get_app_memory',
      traceId: context.traceId,
      toolCallId: context.toolCallId,
      round: context.toolRound,
      appId: app.id,
      updatedAt: Date.now(),
      durationMs: Math.max(0, Date.now() - startedAt),
      requestedLevel: level,
      beforeCatalogLevel: String(manifestBefore?.levels?.catalog || 'missing'),
      beforeStructureLevel: String(manifestBefore?.levels?.structure || 'missing'),
      afterCatalogLevel: String(manifest?.levels?.catalog || 'missing'),
      afterStructureLevel: String(manifest?.levels?.structure || 'missing'),
      onsiteBuildMs: Math.max(0, Date.now() - startedAt),
      warmupStateBefore: manifestBefore?.warmupState ? this.buildDefaultWarmupState(manifestBefore.warmupState) : undefined,
      warmupStateAfter: this.buildDefaultWarmupState(manifest.warmupState),
      semanticScheduled,
      semanticScheduleReason: semanticScheduled ? 'get_app_memory' : undefined,
      semanticRequestedSourceIds: semanticScheduled ? semanticRequestedSourceIds : undefined,
      semanticWarmupHit,
      semanticSummaryAvailable,
      derivedSummaryAvailable,
    })

    const focusedSourceIds = new Set(this.normalizeStringArray(input.focus?.sourceIds))
    const requestedSourceIds = Array.from(focusedSourceIds)
    const sourceIndex = manifest.sourceIndex.filter(item => !focusedSourceIds.size || focusedSourceIds.has(item.sourceId))
    const sourceMemories = await Promise.all(
      sourceIndex.map(async item => [item.sourceId, await this.memoryStore.readSourceMemory(app.id, item.sourceId)] as const),
    )
    const sourceMemoryMap = new Map(sourceMemories)
    const readableFieldIdsMap = await this.getAiReadableFieldIdsMap(
      app.id,
      sourceIndex.map(item => item.sourceId),
    )
    const sourceNameMap = new Map(sourceIndex.map(item => [String(item.sourceId || '').trim(), String(item.sourceName || item.sourceId || '').trim()]))
    const sourceRouteHintsMap = new Map(
      (Array.isArray(manifest.routeIndex?.recordRoutes) ? manifest.routeIndex.recordRoutes : [])
        .map(route => [
          String(route?.sourceId || '').trim(),
          this.uniqueStrings(this.normalizeStringArray(route?.keywords)).slice(0, 8),
        ] as const)
        .filter(item => item[0]),
    )
    const hydratedSources = await Promise.all(sourceIndex.map(async item => {
      const memory = sourceMemoryMap.get(item.sourceId) || null
      const readableFieldIds = readableFieldIdsMap.get(String(item.sourceId || '').trim()) || []
      const visibleMemory = this.filterAiSourceMemoryFields(memory, readableFieldIds)
      const fields = visibleMemory.fields
      const visibleQueryHints = this.mapVisibleSourceHintFieldNames({
        ...memory,
        fields,
      }, visibleMemory.queryHints)
      const rawRecordRouteHints = sourceRouteHintsMap.get(item.sourceId) || []
      const rawTypicalQuestions = this.uniqueStrings(
        this.normalizeStringArray(memory?.semanticSummary?.typicalQuestions),
      ).slice(0, 6)
      const safeSemanticHints = this.buildPermissionSafeSourceSemanticHints({
        sourceName: item.sourceName,
        memory,
        visibleFields: fields,
        visibleQueryHints,
        recordRouteHints: rawRecordRouteHints,
        typicalQuestions: rawTypicalQuestions,
      })
      return {
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        tableId: item.sourceId,
        tableName: item.sourceName,
        kind: item.kind,
        role: item.role,
        memoryStatus: this.buildMemoryStatus(memory?.levels || item.levels),
        levels: memory?.levels || item.levels,
        summary: String(memory?.semanticSummary?.observedSummary || '').trim()
          || String(memory?.description || '').trim()
          || this.buildSourceFallbackSummary(item, memory),
        whenToUse: this.buildSourceWhenToUse(item, memory),
        viewTypes: Array.isArray(memory?.viewTypes) ? memory.viewTypes : (Array.isArray(item.viewTypes) ? item.viewTypes : []),
        hasWorkflow: Boolean(memory?.hasWorkflow ?? item.hasWorkflow),
        rowCountBucket: String(memory?.dataProfile?.rowCountBucket || item.rowCountBucket || 'unknown') as AiRowCountBucket,
        dataProfile: memory?.dataProfile || {
          rowCountBucket: String(item.rowCountBucket || 'unknown') as AiRowCountBucket,
          viewTypes: Array.isArray(item.viewTypes) ? item.viewTypes : [],
          hasWorkflow: Boolean(item.hasWorkflow),
          enumSketches: [],
        },
        keyFields: this.buildSourceKeyFields({
          ...memory,
          fields,
          queryHints: visibleQueryHints,
        }),
        recordRouteHints: safeSemanticHints.recordRouteHints,
        typicalQuestions: safeSemanticHints.typicalQuestions,
        fields,
        relations: memory?.relations || [],
        queryHints: visibleQueryHints,
        doNotUseFor: memory?.semanticSummary?.doNotUseFor || [],
      }
    }))
    const evidenceProfile = this.buildAppMemoryEvidenceProfile({
      manifest,
      sources: hydratedSources,
      sourceMemoryMap,
      sourceNameMap,
    })
    const responseAppSummary = String(visibleSemanticProfile?.derivedSummary || visibleSemanticProfile?.summary || '').trim()
      || manifest.appSummary.purpose
      || `${manifest.appName} 褰撳墠鍖呭惈 ${manifest.sourceIndex.length} 涓暟鎹簮銆俙`
    return {
      tool: 'get_app_memory',
      accessibleAppsSignature,
      request: {
        level,
        focus: {
          sourceIds: requestedSourceIds,
        },
      },
      app: {
        appId: manifest.appId,
        appName: manifest.appName,
        appKind: resolveAiAppKind({
          appKind: manifest.appKind,
          sourceIndex: manifest.sourceIndex,
          viewProfile: manifest.viewProfile,
        }),
        summary: responseAppSummary || `${manifest.appName} 当前包含 ${manifest.sourceIndex.length} 个数据源。`,
        domainKeywords: manifest.appSummary.domainKeywords,
        answerBoundaries: manifest.appSummary.answerBoundaries,
        memoryStatus: this.buildMemoryStatus(manifest.levels),
        levels: manifest.levels,
        viewProfile: this.buildDefaultViewProfile(manifest.viewProfile),
        workflowProfile: this.buildDefaultWorkflowProfile(manifest.workflowProfile),
        entryPoints: Array.isArray(manifest.entryPoints) ? manifest.entryPoints : [],
        warmupState: this.buildDefaultWarmupState(manifest.warmupState),
        semanticProfile: visibleSemanticProfile,
        counts: {
          sourceCount: manifest.sourceIndex.length,
        },
      },
      evidenceProfile,
      sources: hydratedSources,
    }
  }

  async readAppDataWithContext(context: AiToolExecutionContext, input: Record<string, any> = {}): Promise<AiReadAppDataOutput> {
    const app = await this.resolveApp(context, input, true)
    const featureFlags = await this.aiConfigService.getFeatureFlags(context.conversationProfile)
    const accessibleAppsSignature = featureFlags.searchAppsCatalogInvalidateEnabled
      ? await this.getAccessibleAppsSignatureForContext(context).catch(() => undefined)
      : undefined
    const request = this.normalizeReadAppDataRequest(app, input)
    const startedAt = Date.now()
    this.getWarmupService().recordConfirmedAppAccess(
      app.id,
      'read',
    )

    const output = request.targets.length === 1
      ? await this.readRecordAppDataWithContext(request, context, request.targets[0])
      : await this.readBatchRecordAppDataWithContext(request, context)
    if (featureFlags.semanticWarmupObservationWritebackEnabled) {
      const writeback = this.buildSemanticObservationWriteback(request, output)
      const writebackSourceIds = writeback
        ? this.resolveSemanticObservationWritebackSourceIds(request, output)
        : []
      if (writeback && writebackSourceIds.length) {
        await Promise.all(
          writebackSourceIds.map(sourceId => this.getMemoryManager().recordSourceObservation({
            appId: app.id,
            sourceId,
            query: String(context.query || '').trim() || undefined,
            capabilitySummary: writeback.capabilitySummary,
            note: writeback.note,
          }).catch(() => null)),
        )
      }
    }
    const failedTargets = output?.result
      && 'failedTargets' in output.result
      && Array.isArray(output.result.failedTargets)
      ? output.result.failedTargets
      : []
    await this.recordWarmupToolTrace({
      kind: 'read_app_data',
      traceId: context.traceId,
      toolCallId: context.toolCallId,
      round: context.toolRound,
      appId: app.id,
      updatedAt: Date.now(),
      durationMs: Math.max(0, Date.now() - startedAt),
      mode: request.mode,
      targetIds: request.targets.map(item => String(item?.id || '').trim()).filter(Boolean),
      sourceIds: request.targets.filter(item => item?.type === 'source').map(item => String(item.id || '').trim()).filter(Boolean),
      resultKind: String(output?.result?.kind || '').trim() || undefined,
      partial: output?.status === 'partial',
      failedTargetCount: failedTargets.length,
    })
    if (accessibleAppsSignature && output && typeof output === 'object' && !Array.isArray(output)) {
      output.accessibleAppsSignature = accessibleAppsSignature
    }
    return output
  }

  async inspectSourceDataProfile(
    appId: string,
    sourceId: string,
    options: {
      viewTypes?: AiAppViewType[]
      hasWorkflow?: boolean
      fields?: Field[]
      sampleSize?: number
      includeEnumSketches?: boolean
    } = {},
    context?: Pick<AiToolExecutionContext, 'accountId' | 'accountName' | 'signal'>,
  ): Promise<AiSourceDataProfile> {
    this.throwIfAborted(context?.signal)
    const sampleSize = Math.max(20, Math.min(200, Number(options.sampleSize || 80)))
    const includeEnumSketches = Boolean(options.includeEnumSketches)
    try {
      const bucket = await this.loadTableRowBucket(appId, sourceId, 1, sampleSize, context)
      this.throwIfAborted(context?.signal)
      const count = Number(bucket?.count)
      const rows = Array.isArray(bucket?.rows) ? bucket.rows : []
      return {
        rowCountBucket: this.resolveRowCountBucket(count),
        rowCountApprox: Number.isFinite(count) && count >= 0 ? count : undefined,
        lastCountedAt: Date.now(),
        viewTypes: Array.isArray(options.viewTypes) ? options.viewTypes : [],
        hasWorkflow: Boolean(options.hasWorkflow),
        enumSketches: includeEnumSketches ? this.buildSourceEnumSketches(options.fields || [], rows) : [],
      }
    } catch {
      this.throwIfAborted(context?.signal)
      return {
        rowCountBucket: 'unknown',
        lastCountedAt: Date.now(),
        viewTypes: Array.isArray(options.viewTypes) ? options.viewTypes : [],
        hasWorkflow: Boolean(options.hasWorkflow),
        enumSketches: [],
      }
    }
  }

  private async loadTableRowBucket(
    appId: string,
    tableId: string,
    pageNumber: number,
    pageSize: number,
    context?: Pick<AiToolExecutionContext, 'accountId' | 'accountName' | 'signal'>,
  ) {
    this.throwIfAborted(context?.signal)
    const buckets = await this.readTableBucketsWithRetry(() => {
      this.throwIfAborted(context?.signal)
      return this.runWithExecutionAccount(context, async () => {
        this.throwIfAborted(context?.signal)
        return await this.formDataService.getData(appId, [tableId], {
          pageNumber,
          pageSize,
          stage: { $nin: [FormDataStage.DRAFT] },
          formatData: false,
          transformFormData: false,
          fillSubTable: false,
          transformRelated: false,
          transformRelatedResultObject: false,
        } as any, {
          enforceFieldReadAuth: true,
        })
      })
    })
    this.throwIfAborted(context?.signal)
    return Array.isArray(buckets) ? buckets[0] : null
  }

  private async runWithExecutionAccount<T>(
    context: Pick<AiToolExecutionContext, 'accountId' | 'accountName' | 'signal'> | undefined,
    factory: () => Promise<T>,
  ) {
    this.throwIfAborted(context?.signal)
    if (RequestStorage.current?.req?.account) {
      const result = await factory()
      this.throwIfAborted(context?.signal)
      return result
    }

    const account = await this.resolveExecutionAccount(context)
    this.throwIfAborted(context?.signal)
    if (!account) {
      const result = await factory()
      this.throwIfAborted(context?.signal)
      return result
    }

    return await new Promise<T>((resolve, reject) => {
      RequestStorage.runWithRequest({
        account,
      } as any, () => {
        void factory().then(result => {
          this.throwIfAborted(context?.signal)
          resolve(result)
        }).catch(reject)
      })
    })
  }

  private throwIfAborted(signal?: AbortSignal) {
    if (!signal?.aborted) {
      return
    }
    const error = new Error('This operation was aborted')
    error.name = 'AbortError'
    throw error
  }

  private async resolveExecutionAccount(context?: Pick<AiToolExecutionContext, 'accountId' | 'accountName'>) {
    const accountId = String(context?.accountId || '').trim()
    if (!accountId || accountId === '0' || accountId === 'system:warmup') {
      return await this.workbenchService.getAnonymousUser().catch(() => null)
    }

    return await this.workbenchService.getUserById(accountId).catch(async () => {
      return await this.workbenchService.getAnonymousUser().catch(() => null)
    })
  }

  private isRetryableTableReadError(error: unknown) {
    if (!error) {
      return false
    }
    if (typeof error === 'object' && 'isLost' in error) {
      return Boolean((error as Record<string, any>).isLost)
    }

    const text = error instanceof Error
      ? `${error.message}\n${error.stack || ''}`
      : JSON.stringify(error)
    return text.includes('linvodbBusy') || text.includes('"isLost":true')
  }

  private async readTableBucketsWithRetry<T>(factory: () => Promise<T>) {
    let lastError: unknown = null

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await factory()
      } catch (error) {
        lastError = error
        if (!this.isRetryableTableReadError(error) || attempt >= 2) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)))
      }
    }

    throw lastError
  }

  private getRowValue(row: Record<string, any>, field: Field | null | undefined) {
    if (!row || !field) {
      return undefined
    }
    const candidates = [
      field.uid,
      field.alias,
      field.meta?.name,
    ].filter(Boolean)
    for (const candidate of candidates) {
      if (Object.prototype.hasOwnProperty.call(row, candidate)) {
        return row[candidate]
      }
    }
    return undefined
  }

  private buildSourceEnumSketches(fields: Field[], rows: Array<Record<string, any>>): AiSourceEnumSketch[] {
    if (!Array.isArray(fields) || !fields.length || !Array.isArray(rows) || rows.length < 3) {
      return []
    }

    return fields
      .filter(field => this.shouldSketchSourceField(field))
      .map(field => this.buildSourceEnumSketch(field, rows))
      .filter((item): item is AiSourceEnumSketch => Boolean(item))
      .slice(0, 6)
  }

  private buildSourceEnumSketch(field: Field, rows: Array<Record<string, any>>): AiSourceEnumSketch | null {
    const perValueCount = new Map<string, number>()
    let nonEmptyRows = 0

    rows.forEach(row => {
      const rowValues = this.normalizeEnumSketchValues(this.getRowValue(row, field))
      if (!rowValues.length) {
        return
      }
      nonEmptyRows += 1
      const rowUniqueValues = [...new Set(rowValues)]
      rowUniqueValues.forEach(value => {
        perValueCount.set(value, (perValueCount.get(value) || 0) + 1)
      })
    })

    if (nonEmptyRows < 3 || !perValueCount.size) {
      return null
    }

    const sortedValues = [...perValueCount.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
    const distinctCount = sortedValues.length
    const topValues = sortedValues.slice(0, 8)
    const coveredCount = topValues.reduce((sum, [, count]) => sum + count, 0)
    const topCoverage = coveredCount / nonEmptyRows

    if (
      distinctCount > Math.max(12, Math.floor(nonEmptyRows * 0.6))
      || (distinctCount > 8 && topCoverage < 0.6)
    ) {
      return null
    }

    return {
      fieldId: String(field.uid || '').trim(),
      fieldName: String(field.alias || field.meta?.name || field.uid || '').trim() || String(field.uid || ''),
      values: topValues.map(([value, count]) => ({
        value,
        count,
      })),
      sampleSize: nonEmptyRows,
      truncated: distinctCount > topValues.length,
    }
  }

  private shouldSketchSourceField(field: Field) {
    const fieldType = String(field?.type || '').trim().toLowerCase()
    const subType = String(field?.meta?.subType || '').trim().toLowerCase()
    const widgetType = String(field?.meta?.extra?.widgetType || '').trim().toLowerCase()
    const label = this.normalizeComparableText(`${field?.alias || ''} ${field?.meta?.name || ''}`)

    if (!field?.uid || this.getRelatedTableId(field)) {
      return false
    }
    if (!['string', 'number', 'array'].includes(fieldType)) {
      return false
    }
    if (
      subType === 'html'
      || widgetType.includes('richtext')
      || widgetType.includes('uploader')
      || widgetType.includes('signature')
      || widgetType.includes('image')
      || widgetType.includes('relateddata')
    ) {
      return false
    }
    if (/(标题|内容|描述|备注|地址|链接|网址|邮箱|电话|姓名|标题|正文|附件|title|content|description|remark|address|url|email|phone|name)/i.test(label)) {
      return false
    }

    const explicitEnumField = [
      'radio',
      'select',
      'checkbox',
      'switch',
      'tag',
      'status',
      'department',
      'member',
    ].some(token => subType.includes(token) || widgetType.includes(token))
    const stableNamedField = /(状态|类型|分类|类目|部门|优先级|阶段|标签|渠道|等级|status|type|category|department|priority|stage|tag|channel|level)/i.test(label)

    return explicitEnumField || stableNamedField
  }

  private normalizeEnumSketchValues(value: any): string[] {
    const values: string[] = []
    const visit = (current: any) => {
      if (current === null || current === undefined) {
        return
      }
      if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') {
        const text = String(current).trim()
        if (text && text.length <= 40 && !/^https?:\/\//i.test(text)) {
          values.push(text)
        }
        return
      }
      if (Array.isArray(current)) {
        current.forEach(item => visit(item))
        return
      }
      if (typeof current === 'object') {
        const preferred = [
          current.label,
          current.name,
          current.title,
          current.value,
          current.text,
          current.alias,
          current.id,
        ].find(item => item !== undefined && item !== null && String(item).trim())
        if (preferred !== undefined) {
          visit(preferred)
        }
      }
    }

    visit(value)
    return [...new Set(values)]
  }

  private async readRecordAppDataWithContext(
    request: NormalizedReadAppDataRequest,
    context: AiToolExecutionContext,
    target: AiReadAppDataTargetRef,
  ): Promise<AiReadAppDataOutput> {
    const singleResult = await this.readSingleRecordTargetWithContext(request, context, target)
    const relativeTimeRisk = this.buildRelativeTimeFilterRisk(context, request)
    return {
      tool: 'read_app_data',
      status: 'ok',
      summary: '',
      relativeTimeFilterMissing: relativeTimeRisk.relativeTimeFilterMissing || undefined,
      decision: relativeTimeRisk.relativeTimeFilterMissing
        ? {
          relativeTimeFilterMissing: true,
          relativeTimeRiskHint: relativeTimeRisk.relativeTimeRiskHint,
        }
        : undefined,
      resolved: {
        appId: request.app.id,
        appName: request.app.name || request.app.id,
        mode: request.mode,
        target: singleResult.target,
        targets: [singleResult.target],
        request: this.buildReadAppDataResolvedRequest(request),
      },
      result: {
        ...singleResult.result,
        summary: '',
        executionSummary: this.buildReadAppDataExecutionSummary({
          strategy: 'hard_serial',
          request,
          partial: false,
          batchSize: 1,
          succeededCount: 1,
          failedCount: 0,
          queuedCount: 0,
          timedOutCount: 0,
          achievedConcurrency: 1,
        }),
      },
      evidence: request.mode === 'records'
        ? this.buildRecordReadEvidence({
          items: singleResult.result.records,
        })
        : [],
    }
  }

  private async readBatchRecordAppDataWithContext(
    request: NormalizedReadAppDataRequest,
    context: AiToolExecutionContext,
  ): Promise<AiReadAppDataOutput> {
    const outcome = await this.executeRecordBatchReadTargets(request, context)
    if (!outcome.succeededTargets.length) {
      this.throwReadAppDataInputError(
        '批量 read_app_data 执行失败，没有任何 target 成功返回可用结果。',
        'BATCH_EXECUTION_ALL_TARGETS_FAILED',
        {
          appId: request.app.id,
          mode: request.mode,
          targetIds: request.targets.map(item => item.id),
          failedTargets: outcome.failedTargets,
        },
      )
    }
    if (outcome.failedTargets.length && request.partialPolicy === 'require_all') {
      this.throwReadAppDataInputError(
        AI_LOCAL_TOOL_COPY.batchRequireAllFailure,
        'BATCH_EXECUTION_REQUIRE_ALL_FAILED',
        {
          appId: request.app.id,
          mode: request.mode,
          targetIds: request.targets.map(item => item.id),
          failedTargets: outcome.failedTargets,
        },
      )
    }

    const merged = this.buildBatchRecordMergedResult(request, outcome.perTargetResults)
    const batchKind = request.mode === 'records'
      ? 'batch_record_rows'
      : (String(merged.mergedAggregation?.kind || '').trim() === 'summary_only' ? 'batch_record_total' : 'batch_record_aggregate')
    const relativeTimeRisk = this.buildRelativeTimeFilterRisk(context, request)

    return {
      tool: 'read_app_data',
      status: outcome.partial ? 'partial' : 'ok',
      summary: outcome.partial
        ? `批量读取完成，但 ${outcome.failedTargets.length} target 执行失败。`
        : '',
      relativeTimeFilterMissing: relativeTimeRisk.relativeTimeFilterMissing || undefined,
      decision: relativeTimeRisk.relativeTimeFilterMissing
        ? {
          relativeTimeFilterMissing: true,
          relativeTimeRiskHint: relativeTimeRisk.relativeTimeRiskHint,
        }
        : undefined,
      resolved: {
        appId: request.app.id,
        appName: request.app.name || request.app.id,
        mode: request.mode,
        targets: request.targets,
        request: this.buildReadAppDataResolvedRequest(request),
      },
      result: {
        kind: batchKind,
        summary: '',
        answerText: merged.answerText,
        itemsText: merged.itemsText,
        mergedTotal: merged.mergedTotal,
        mergedResultCount: merged.mergedResultCount,
        mergedReturnedRows: merged.mergedReturnedRows,
        mergedFields: merged.mergedFields,
        mergedRecords: merged.mergedRecords,
        mergedAggregation: merged.mergedAggregation,
        perTargetResults: outcome.perTargetResults,
        partial: outcome.partial,
        failedTargets: outcome.failedTargets,
        succeededTargets: outcome.succeededTargets,
        executionSummary: this.buildReadAppDataExecutionSummary({
          strategy: 'batch',
          request,
          partial: outcome.partial,
          batchSize: request.targets.length,
          succeededCount: outcome.succeededTargets.length,
          failedCount: outcome.failedTargets.length,
          queuedCount: outcome.queuedCount,
          timedOutCount: outcome.timedOutCount,
          achievedConcurrency: outcome.achievedConcurrency,
          durationMs: outcome.durationMs,
          circuitBroken: outcome.circuitBroken,
        }),
      },
      evidence: request.mode === 'records'
        ? this.buildRecordReadEvidence({
          items: merged.mergedRecords,
        })
        : [],
    }
  }

  private normalizeReadAppDataRequest(
    app: { id: string; name?: string },
    input: Record<string, any>,
  ): NormalizedReadAppDataRequest {
    const mode = this.normalizeReadMode(input.mode)
    const { targets, usedLegacyTarget } = this.normalizeReadAppDataTargets(app.id, input.target, input.targets)
    const groupBy = String(input.groupBy || '').trim()
    const executionPreference = this.normalizeReadAppDataExecutionPreference(input.executionPreference)
    const returnMode = this.normalizeReadAppDataReturnMode(input.returnMode)
    const partialPolicy = this.normalizeReadAppDataPartialPolicy(input.partialPolicy)
    const timeGranularity = this.normalizeTimeGranularity(input.timeGranularity)
    this.assertAggregateProtocolNotMixed(app.id, mode, input)
    const analysis = this.resolveNormalizedReadAppDataAnalysis(app.id, mode, targets, input, {
      groupBy,
      timeGranularity,
    })
    const hasLegacyPathInput = Boolean(
      String(input.directoryPath || '').trim()
      || String(input.itemPath || '').trim()
      || String(input.documentPath || '').trim(),
    )

    if (groupBy && mode !== 'aggregate') {
      this.throwReadAppDataInputError(
        'groupBy 只允许在 aggregate 模式中使用，records 模式不能显式传 groupBy。',
        'READ_APP_DATA_GROUP_BY_MODE_MISMATCH',
        {
          appId: app.id,
          mode,
          groupBy,
        },
      )
    }
    if (timeGranularity && mode !== 'aggregate') {
      this.throwReadAppDataInputError(
        AI_LOCAL_TOOL_COPY.timeGranularityAggregateOnly,
        'READ_APP_DATA_TIME_GRANULARITY_MODE_MISMATCH',
        {
          appId: app.id,
          mode,
          timeGranularity,
        },
      )
    }

    if (Array.isArray(input.matchKeywords) || input.window) {
      this.throwReadAppDataInputError(
        'records / aggregate modes do not accept matchKeywords or window.',
        'READ_APP_DATA_RECORD_WINDOW_ARGUMENTS_INVALID',
        {
          appId: app.id,
          mode,
        },
      )
    }
    if (targets.some(item => item.type !== 'source')) {
      this.throwReadAppDataInputError(
        'records / aggregate 模式下 target.type 必须是 source。',
        'READ_APP_DATA_RECORD_TARGET_TYPE_INVALID',
        {
          appId: app.id,
          mode,
          targets,
        },
      )
    }
    if (hasLegacyPathInput) {
      this.throwReadAppDataInputError(
        'records / aggregate 模式不能传 directoryPath、itemPath 或 documentPath。',
        'READ_APP_DATA_RECORD_PATH_ARGUMENTS_INVALID',
        {
          appId: app.id,
          mode,
        },
      )
    }
    if (analysis && targets.length > 1) {
      this.throwReadAppDataInputError(
        'aggregate.analysis 一期只支持单 source target，暂不支持多 source batch。',
        'READ_APP_DATA_ANALYSIS_MULTI_TARGET_FORBIDDEN',
        {
          appId: app.id,
          mode,
          targetIds: targets.map(item => item.id),
        },
      )
    }

    return {
      app,
      mode,
      targets,
      executionPreference,
      returnMode,
      partialPolicy,
      filters: input.filters && typeof input.filters === 'object'
        ? this.normalizeReadAppDataFiltersInput(input.filters)
        : undefined,
      groupBy: groupBy || undefined,
      timeGranularity,
      minCount: this.normalizeOptionalLimit(input.minCount, 1000) || undefined,
      topN: this.normalizeOptionalLimit(input.topN, 1000) || undefined,
      limit: this.normalizeOptionalLimit(input.limit, 50) || undefined,
      sortBy: String(input.sortBy || '').trim() || undefined,
      sortOrder: String(input.sortOrder || '').trim() === 'asc' ? 'asc' : (String(input.sortOrder || '').trim() === 'desc' ? 'desc' : undefined),
      analysis,
      usedLegacyTarget,
    }
  }

  private normalizeReadAppDataFiltersInput(filters: any): Record<string, any> | any[] | undefined {
    if (!filters || typeof filters !== 'object') {
      return undefined
    }

    const normalizeCondition = (value: any): any => {
      if (Array.isArray(value)) {
        return value
          .map(item => normalizeCondition(item))
          .filter(item => item !== undefined)
      }
      if (!value || typeof value !== 'object') {
        return this.normalizeFieldFilterValue(value)
      }

      const result: Record<string, any> = {}
      for (const [key, item] of Object.entries(value)) {
        if (key === '$and' || key === '$or') {
          const normalizedItems = Array.isArray(item)
            ? item.map(entry => normalizeCondition(entry)).filter(entry => entry !== undefined)
            : []
          if (normalizedItems.length) {
            result[key] = normalizedItems
          }
          continue
        }
        if (key === '$not') {
          const normalizedItem = normalizeCondition(item)
          if (normalizedItem !== undefined) {
            result[key] = normalizedItem
          }
          continue
        }

        const normalizedValue = this.normalizeFieldFilterValue(item)
        if (normalizedValue !== undefined) {
          result[key] = normalizedValue
        }
      }

      return Object.keys(result).length ? result : undefined
    }

    const normalized = normalizeCondition(filters)
    return normalized && typeof normalized === 'object'
      ? normalized
      : undefined
  }

  private hasExplicitReadAppDataAnalysisInput(input: Record<string, any>) {
    return Object.prototype.hasOwnProperty.call(input, 'analysis')
      && input.analysis !== undefined
      && input.analysis !== null
  }

  private collectExplicitLegacyAggregateFields(input: Record<string, any>) {
    const legacyKeys = ['groupBy', 'timeGranularity', 'minCount', 'topN', 'sortBy', 'sortOrder'] as const
    return legacyKeys.filter((key) => {
      if (!Object.prototype.hasOwnProperty.call(input, key)) {
        return false
      }

      const value = input[key]
      if (value === undefined || value === null) {
        return false
      }
      if (typeof value === 'string') {
        return value.trim().length > 0
      }
      return true
    })
  }

  private assertAggregateProtocolNotMixed(
    appId: string,
    mode: AiReadAppDataMode,
    input: Record<string, any>,
  ) {
    if (mode !== 'aggregate') {
      return
    }

    const hasAnalysis = this.hasExplicitReadAppDataAnalysisInput(input)
    const legacyFields = this.collectExplicitLegacyAggregateFields(input)
    if (!hasAnalysis || !legacyFields.length) {
      return
    }

    this.throwReadAppDataInputError(
      `aggregate 参数协议冲突：analysis legacy 顶层聚合参数不能混用。冲突字段：${legacyFields.join('、')}。`,
      'READ_APP_DATA_AGGREGATE_PROTOCOL_MIXED',
      {
        appId,
        mode,
        legacyFields,
        hasAnalysis: true,
      },
    )
  }

  private resolveNormalizedReadAppDataAnalysis(
    appId: string,
    mode: AiReadAppDataMode,
    targets: AiReadAppDataTargetRef[],
    input: Record<string, any>,
    legacyFields: {
      groupBy?: string
      timeGranularity?: TimeGranularity | null
    },
  ) {
    const explicitAnalysis = this.normalizeReadAppDataAnalysisInput(appId, mode, input.analysis)
    const legacyAnalysis = this.normalizeLegacyAggregateAnalysisInput(appId, mode, input, legacyFields)

    if (!explicitAnalysis) {
      return legacyAnalysis
    }
    if (!legacyAnalysis) {
      return explicitAnalysis
    }

    this.assertExplicitAnalysisCompatibleWithLegacy(appId, explicitAnalysis, legacyAnalysis)
    return explicitAnalysis
  }

  private normalizeReadAppDataAnalysisInput(
    appId: string,
    mode: AiReadAppDataMode,
    analysisInput: any,
  ): AiReadAppDataAnalysis | undefined {
    if (analysisInput === undefined || analysisInput === null) {
      return undefined
    }
    if (mode !== 'aggregate') {
      this.throwReadAppDataInputError(
        AI_LOCAL_TOOL_COPY.analysisAggregateOnly,
        'READ_APP_DATA_ANALYSIS_MODE_MISMATCH',
        {
          appId,
          mode,
        },
      )
    }
    if (!analysisInput || typeof analysisInput !== 'object' || Array.isArray(analysisInput)) {
      this.throwReadAppDataInputError(
        AI_LOCAL_TOOL_COPY.analysisMustBeObject,
        'READ_APP_DATA_ANALYSIS_INVALID',
        {
          appId,
          mode,
        },
      )
    }

    const hasExplicitMetrics = Object.prototype.hasOwnProperty.call(analysisInput, 'metrics')
    const rawMetrics = Array.isArray(analysisInput.metrics) ? analysisInput.metrics : []
    if (hasExplicitMetrics && !rawMetrics.length) {
      this.throwReadAppDataInputError(
        AI_LOCAL_TOOL_COPY.analysisMetricsRequired,
        'READ_APP_DATA_ANALYSIS_METRICS_REQUIRED',
        {
          appId,
          mode,
        },
      )
    }

    const metrics = (hasExplicitMetrics
      ? rawMetrics
      : [{ op: 'count', as: '__count' }]
    ).map((item, index) => this.normalizeReadAppDataAnalysisMetric(appId, item, index))
    const metricAliasSet = new Set<string>()
    metrics.forEach(metric => {
      const comparableKey = this.normalizeComparableText(metric.as)
      if (metricAliasSet.has(comparableKey)) {
        this.throwReadAppDataInputError(
          `analysis.metrics 中存在重复别名“${metric.as}”。`,
          'READ_APP_DATA_ANALYSIS_METRIC_ALIAS_DUPLICATED',
          {
            appId,
            metric: metric.as,
          },
        )
      }
      metricAliasSet.add(comparableKey)
    })

    const groups = Array.isArray(analysisInput.groupBy)
      ? analysisInput.groupBy.map((item: any, index: number) => this.normalizeReadAppDataAnalysisGroup(appId, item, index))
      : []
    const groupKeySet = new Set<string>()
    groups.forEach(group => {
      const comparableKey = this.normalizeComparableText(group.as || group.field)
      if (groupKeySet.has(comparableKey)) {
        this.throwReadAppDataInputError(
          `analysis.groupBy 中存在重复分组键“${group.as || group.field}”。`,
          'READ_APP_DATA_ANALYSIS_GROUP_KEY_DUPLICATED',
          {
            appId,
            group: group.as || group.field,
          },
        )
      }
      groupKeySet.add(comparableKey)
    })

    const having = Array.isArray(analysisInput.having)
      ? analysisInput.having.map((item: any, index: number) =>
        this.normalizeReadAppDataAnalysisHaving(appId, item, index, metrics),
      )
      : []
    const orderBy = Array.isArray(analysisInput.orderBy)
      ? analysisInput.orderBy.map((item: any, index: number) =>
        this.normalizeReadAppDataAnalysisOrderBy(appId, item, index, metrics, groups),
      )
      : []
    const topN = this.normalizeOptionalLimit(analysisInput.topN, 1000) || undefined

    if (topN && !groups.length) {
      this.throwReadAppDataInputError(
        AI_LOCAL_TOOL_COPY.analysisTopNGroupRequired,
        'READ_APP_DATA_ANALYSIS_TOPN_GROUP_REQUIRED',
        {
          appId,
          topN,
        },
      )
    }
    if (topN && !orderBy.length) {
      this.throwReadAppDataInputError(
        'analysis.topN 必须与 analysis.orderBy 一起使用。',
        'READ_APP_DATA_ANALYSIS_TOPN_ORDER_REQUIRED',
        {
          appId,
          topN,
        },
      )
    }

    return {
      metrics,
      groupBy: groups.length ? groups : undefined,
      having: having.length ? having : undefined,
      orderBy: orderBy.length ? orderBy : undefined,
      topN,
    }
  }

  private normalizeReadAppDataAnalysisMetric(appId: string, item: any, index: number): AiReadAppDataAnalysisMetric {
    const op = this.normalizeReadAppDataAnalysisMetricOp(item?.op)
    const alias = String(item?.as || '').trim()
    const rawField = String(item?.field || '').trim()
    const field = op === 'count' && rawField === '*'
      ? ''
      : rawField

    if (!op) {
      this.throwReadAppDataInputError(
        `analysis.metrics[${index}].op 无效，只支持 count、count_distinct、sum、avg、min、max。`,
        'READ_APP_DATA_ANALYSIS_METRIC_OP_INVALID',
        {
          appId,
          index,
        },
      )
    }
    if (!alias) {
      this.throwReadAppDataInputError(
        `analysis.metrics[${index}].as 不能为空。`,
        'READ_APP_DATA_ANALYSIS_METRIC_ALIAS_REQUIRED',
        {
          appId,
          index,
        },
      )
    }
    if (op !== 'count' && !field) {
      this.throwReadAppDataInputError(
        `analysis.metrics[${index}] op=${op} 时必须显式传 field。`,
        'READ_APP_DATA_ANALYSIS_METRIC_FIELD_REQUIRED',
        {
          appId,
          index,
          op,
        },
      )
    }

    return {
      op,
      field: field || undefined,
      as: alias,
    }
  }

  private normalizeReadAppDataAnalysisGroup(appId: string, item: any, index: number) {
    const field = String(item?.field || '').trim()
    const alias = String(item?.as || '').trim()
    const timeGranularity = this.normalizeTimeGranularity(item?.timeGranularity)
    if (!field) {
      this.throwReadAppDataInputError(
        `analysis.groupBy[${index}].field 不能为空。`,
        'READ_APP_DATA_ANALYSIS_GROUP_FIELD_REQUIRED',
        {
          appId,
          index,
        },
      )
    }
    return {
      field,
      as: alias || undefined,
      timeGranularity,
    }
  }

  private normalizeReadAppDataAnalysisHaving(
    appId: string,
    item: any,
    index: number,
    metrics: AiReadAppDataAnalysisMetric[],
  ) {
    const metric = String(item?.metric || '').trim()
    const op = this.normalizeReadAppDataAnalysisCompareOp(item?.op)
    if (!metric) {
      this.throwReadAppDataInputError(
        `analysis.having[${index}].metric 不能为空。`,
        'READ_APP_DATA_ANALYSIS_HAVING_METRIC_REQUIRED',
        {
          appId,
          index,
        },
      )
    }
    if (!op) {
      this.throwReadAppDataInputError(
        `analysis.having[${index}].op 无效，只支持 gt、gte、lt、lte、eq、ne。`,
        'READ_APP_DATA_ANALYSIS_HAVING_OP_INVALID',
        {
          appId,
          index,
        },
      )
    }
    if (!metrics.some(metricItem => this.normalizeComparableText(metricItem.as) === this.normalizeComparableText(metric))) {
      this.throwReadAppDataInputError(
        `analysis.having[${index}] 引用了未定义的 metric“${metric}”。`,
        'READ_APP_DATA_ANALYSIS_HAVING_METRIC_UNKNOWN',
        {
          appId,
          index,
          metric,
        },
      )
    }
    return {
      metric,
      op,
      value: item?.value ?? null,
    }
  }

  private normalizeReadAppDataAnalysisOrderBy(
    appId: string,
    item: any,
    index: number,
    metrics: AiReadAppDataAnalysisMetric[],
    groups: Array<{ field: string; as?: string; timeGranularity?: TimeGranularity | null }>,
  ) {
    const metric = String(item?.metric || '').trim()
    const group = String(item?.group || '').trim()
    const direction = String(item?.direction || '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc'
    if (!metric && !group) {
      this.throwReadAppDataInputError(
        `analysis.orderBy[${index}] 必须显式指定 metric group。`,
        'READ_APP_DATA_ANALYSIS_ORDER_BY_REQUIRED',
        {
          appId,
          index,
        },
      )
    }
    if (metric && group) {
      this.throwReadAppDataInputError(
        `analysis.orderBy[${index}] 不能同时指定 metric group。`,
        'READ_APP_DATA_ANALYSIS_ORDER_BY_CONFLICT',
        {
          appId,
          index,
        },
      )
    }
    if (metric && !metrics.some(metricItem => this.normalizeComparableText(metricItem.as) === this.normalizeComparableText(metric))) {
      this.throwReadAppDataInputError(
        `analysis.orderBy[${index}] 引用了未定义的 metric“${metric}”。`,
        'READ_APP_DATA_ANALYSIS_ORDER_BY_METRIC_UNKNOWN',
        {
          appId,
          index,
          metric,
        },
      )
    }
    if (group && !groups.some(groupItem => this.normalizeComparableText(groupItem.as || groupItem.field) === this.normalizeComparableText(group))) {
      this.throwReadAppDataInputError(
        `analysis.orderBy[${index}] 引用了未定义的 group“${group}”。`,
        'READ_APP_DATA_ANALYSIS_ORDER_BY_GROUP_UNKNOWN',
        {
          appId,
          index,
          group,
        },
      )
    }
    return {
      metric: metric || undefined,
      group: group || undefined,
      direction,
    }
  }

  private normalizeLegacyAggregateAnalysisInput(
    appId: string,
    mode: AiReadAppDataMode,
    input: Record<string, any>,
    legacyFields: {
      groupBy?: string
      timeGranularity?: TimeGranularity | null
    },
  ): AiReadAppDataAnalysis | undefined {
    if (mode !== 'aggregate') {
      return undefined
    }

    const groupBy = String(legacyFields.groupBy || '').trim()
    const timeGranularity = legacyFields.timeGranularity
    const minCount = this.normalizeOptionalLimit(input.minCount, 1000) || undefined
    const topN = this.normalizeOptionalLimit(input.topN, 1000) || undefined
    const sortBy = String(input.sortBy || '').trim()
    const sortOrder = String(input.sortOrder || '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc'
    const hasLegacyFields = Boolean(groupBy || timeGranularity || minCount || topN || sortBy)

    if (!hasLegacyFields) {
      return undefined
    }
    if (timeGranularity && !groupBy) {
      this.throwReadAppDataInputError(
        'aggregate 兼容参数中，timeGranularity 必须与 groupBy 一起使用。',
        'READ_APP_DATA_LEGACY_TIME_GRANULARITY_GROUP_REQUIRED',
        {
          appId,
        },
      )
    }
    if (!groupBy && (minCount || topN || sortBy)) {
      this.throwReadAppDataInputError(
        'aggregate 兼容参数中，minCount、sortBy、topN 只能在显式 groupBy 时使用。',
        'READ_APP_DATA_LEGACY_GROUP_REQUIRED',
        {
          appId,
        },
      )
    }

    const analysis: AiReadAppDataAnalysis = {
      metrics: [
        { op: 'count', as: '__count' },
      ],
    }

    if (groupBy) {
      analysis.groupBy = [{ field: groupBy, timeGranularity }]
    }
    if (minCount) {
      analysis.having = [{ metric: '__count', op: 'gte', value: minCount }]
    }
    if (sortBy) {
      if (this.isLegacyAggregateCountSort(sortBy)) {
        analysis.orderBy = [{ metric: '__count', direction: sortOrder }]
      } else if (analysis.groupBy && this.normalizeComparableText(sortBy) === this.normalizeComparableText(groupBy)) {
        analysis.orderBy = [{ group: groupBy, direction: sortOrder }]
      } else {
        this.throwReadAppDataInputError(
          `aggregate 兼容参数中的 sortBy=${sortBy} 当前无法安全映射analysis，请改为显式 analysis.orderBy。`,
          'READ_APP_DATA_LEGACY_SORT_BY_UNSUPPORTED',
          {
            appId,
            sortBy,
          },
        )
      }
    }
    if (groupBy && !analysis.orderBy?.length) {
      analysis.orderBy = [{ metric: '__count', direction: 'desc' }]
    }
    if (topN) {
      if (!analysis.orderBy?.length) {
        this.throwReadAppDataInputError(
          'aggregate 兼容参数中的 topN 必须与 sortBy/sortOrder 一起使用。',
          'READ_APP_DATA_LEGACY_TOPN_ORDER_REQUIRED',
          {
            appId,
            topN,
          },
        )
      }
      analysis.topN = topN
    }

    return analysis
  }

  private assertExplicitAnalysisCompatibleWithLegacy(
    appId: string,
    explicitAnalysis: AiReadAppDataAnalysis,
    legacyAnalysis: AiReadAppDataAnalysis,
  ) {
    const legacyGroup = legacyAnalysis.groupBy?.[0]
    if (legacyGroup) {
      const explicitGroup = explicitAnalysis.groupBy?.[0]
      if (
        !explicitGroup
        || this.normalizeComparableText(explicitGroup.field) !== this.normalizeComparableText(legacyGroup.field)
        || (explicitGroup.timeGranularity || null) !== (legacyGroup.timeGranularity || null)
      ) {
        this.throwReadAppDataInputError(
          AI_LOCAL_TOOL_COPY.analysisLegacyGroupConflict,
          'READ_APP_DATA_ANALYSIS_LEGACY_GROUP_CONFLICT',
          {
            appId,
          },
        )
      }
    }

    const legacyHaving = legacyAnalysis.having?.[0]
    if (legacyHaving) {
      const countMetric = explicitAnalysis.metrics.find(metric =>
        metric.op === 'count' && !String(metric.field || '').trim())
      const matchedHaving = explicitAnalysis.having?.find(item =>
        countMetric
        && this.normalizeComparableText(item.metric) === this.normalizeComparableText(countMetric.as)
        && item.op === legacyHaving.op
        && item.value === legacyHaving.value)
      if (!matchedHaving) {
        this.throwReadAppDataInputError(
          AI_LOCAL_TOOL_COPY.analysisLegacyMinCountConflict,
          'READ_APP_DATA_ANALYSIS_LEGACY_HAVING_CONFLICT',
          {
            appId,
          },
        )
      }
    }

    const legacyOrder = legacyAnalysis.orderBy?.[0]
    if (legacyOrder) {
      let compatible = false
      if (legacyOrder.metric) {
        const countMetric = explicitAnalysis.metrics.find(metric =>
          metric.op === 'count' && !String(metric.field || '').trim())
        compatible = Boolean(
          countMetric
          && explicitAnalysis.orderBy?.some(item =>
            this.normalizeComparableText(item.metric) === this.normalizeComparableText(countMetric.as)
            && (item.direction || 'desc') === (legacyOrder.direction || 'desc')),
        )
      } else if (legacyOrder.group) {
        const explicitGroup = explicitAnalysis.groupBy?.[0]
        const explicitGroupKey = explicitGroup ? (explicitGroup.as || explicitGroup.field) : ''
        compatible = Boolean(
          explicitGroupKey
          && explicitAnalysis.orderBy?.some(item =>
            this.normalizeComparableText(item.group) === this.normalizeComparableText(explicitGroupKey)
            && (item.direction || 'desc') === (legacyOrder.direction || 'desc')),
        )
      }
      if (!compatible) {
        this.throwReadAppDataInputError(
          AI_LOCAL_TOOL_COPY.analysisLegacyOrderConflict,
          'READ_APP_DATA_ANALYSIS_LEGACY_ORDER_CONFLICT',
          {
            appId,
          },
        )
      }
    }

    if ((legacyAnalysis.topN || undefined) !== (explicitAnalysis.topN || undefined)) {
      this.throwReadAppDataInputError(
        AI_LOCAL_TOOL_COPY.analysisLegacyTopNConflict,
        'READ_APP_DATA_ANALYSIS_LEGACY_TOPN_CONFLICT',
        {
          appId,
        },
      )
    }
  }

  private normalizeReadAppDataAnalysisMetricOp(value: any): AiReadAppDataAnalysisMetricOp | null {
    const normalized = String(value || '').trim().toLowerCase()
    return ['count', 'count_distinct', 'sum', 'avg', 'min', 'max'].includes(normalized)
      ? normalized as AiReadAppDataAnalysisMetricOp
      : null
  }

  private normalizeReadAppDataAnalysisCompareOp(value: any): AiReadAppDataAnalysisCompareOp | null {
    const normalized = String(value || '').trim().toLowerCase()
    return ['gt', 'gte', 'lt', 'lte', 'eq', 'ne'].includes(normalized)
      ? normalized as AiReadAppDataAnalysisCompareOp
      : null
  }

  private isLegacyAggregateCountSort(value: string) {
    return new Set(['count', '__count', '计数']).has(this.normalizeComparableText(value))
  }

  private normalizeReadAppDataTargets(appId: string, targetInput: any, targetsInput: any) {
    const hasLegacyTarget = this.isReadAppDataTargetInputProvided(targetInput)
    const hasBatchTargets = Array.isArray(targetsInput) && targetsInput.length > 0

    if (hasLegacyTarget && hasBatchTargets) {
      this.throwReadAppDataInputError(
        'read_app_data 不能同时传 target 和 targets，请二选一。',
        'READ_APP_DATA_TARGET_CONFLICT',
        {
          appId,
        },
      )
    }

    const normalizedTargets = hasBatchTargets
      ? targetsInput.map((item: any, index: number) => this.normalizeReadAppDataTargetInput(item, appId, index))
      : hasLegacyTarget
        ? [this.normalizeReadAppDataTargetInput(targetInput, appId, 0)]
        : []

    if (!normalizedTargets.length) {
      this.throwReadAppDataInputError(
        'read_app_data 必须显式传入 target 或 targets，且 target.id / targets[].id 不能为空。',
        'READ_APP_DATA_TARGET_REQUIRED',
        {
          appId,
        },
      )
    }
    const duplicateTargetIds = normalizedTargets.reduce((accumulator, item) => {
      const key = `${item.type}:${item.id}`
      if (accumulator.seen.has(key)) {
        accumulator.duplicates.push(key)
      } else {
        accumulator.seen.add(key)
      }
      return accumulator
    }, {
      seen: new Set<string>(),
      duplicates: [] as string[],
    }).duplicates
    if (duplicateTargetIds.length) {
      this.throwReadAppDataInputError(
        'read_app_data 的 targets[] 中存在重复 target，不能对同一 target 重复批量读取。',
        'READ_APP_DATA_DUPLICATE_TARGETS',
        {
          appId,
          duplicateTargetIds,
        },
      )
    }

    return {
      targets: normalizedTargets,
      usedLegacyTarget: hasLegacyTarget,
    }
  }

  private isReadAppDataTargetInputProvided(value: any) {
    return Boolean(
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && Object.keys(value).length,
    )
  }

  private normalizeReadAppDataTargetInput(value: any, appId: string, index: number): AiReadAppDataTargetRef {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      this.throwReadAppDataInputError(
        'read_app_data 的 target / targets[] 必须是对象。',
        'READ_APP_DATA_TARGET_OBJECT_REQUIRED',
        {
          appId,
          index,
        },
      )
    }

    const target = value as ReadAppDataTargetInput
    const normalizedType = String(target.type || '').trim().toLowerCase()
    const normalizedId = String(target.id || '').trim()
    const targetAppId = target.appId === undefined || target.appId === null
      ? null
      : String(target.appId || '').trim() || null
    const targetName = String(target.name || '').trim()

    if (!normalizedType || normalizedType !== 'source') {
      this.throwReadAppDataInputError(
        'read_app_data 的 target.type / targets[].type 只支持 source。',
        'READ_APP_DATA_TARGET_TYPE_REQUIRED',
        {
          appId,
          index,
          type: normalizedType,
        },
      )
    }
    if (targetName) {
      this.throwReadAppDataInputError(
        'read_app_data 只接受 target.id / targets[].id，不接受 target.name。',
        'READ_APP_DATA_TARGET_NAME_FORBIDDEN',
        {
          appId,
          index,
          targetName,
        },
      )
    }
    if (!normalizedId) {
      this.throwReadAppDataInputError(
        'read_app_data 的 target.id / targets[].id 不能为空。',
        'READ_APP_DATA_TARGET_ID_REQUIRED',
        {
          appId,
          index,
        },
      )
    }
    if (targetAppId && targetAppId !== appId) {
      this.throwReadAppDataInputError(
        'read_app_data 的 batch 只允许同 app source，禁止跨 app 混批。',
        'READ_APP_DATA_CROSS_APP_BATCH_FORBIDDEN',
        {
          appId,
          index,
          targetAppId,
        },
      )
    }

    return {
      type: normalizedType as AiReadAppDataTargetRef['type'],
      id: normalizedId,
      appId: targetAppId || appId,
    }
  }

  private normalizeReadAppDataExecutionPreference(value: any): AiReadAppDataExecutionPreference {
    const normalized = String(value || '').trim().toLowerCase()
    switch (normalized) {
      case 'batch':
      case 'serial':
      case 'parallel':
        return normalized
      default:
        return 'auto'
    }
  }

  private normalizeReadAppDataReturnMode(value: any): AiReadAppDataReturnMode {
    const normalized = String(value || '').trim().toLowerCase()
    switch (normalized) {
      case 'per_target':
      case 'merged':
        return normalized
      default:
        return 'both'
    }
  }

  private normalizeReadAppDataPartialPolicy(value: any): AiReadAppDataPartialPolicy {
    return String(value || '').trim().toLowerCase() === 'require_all'
      ? 'require_all'
      : 'allow_partial'
  }

  private buildReadAppDataResolvedRequest(request: NormalizedReadAppDataRequest) {
    return {
      executionPreference: request.executionPreference,
      returnMode: request.returnMode,
      partialPolicy: request.partialPolicy,
      usedLegacyTarget: request.usedLegacyTarget,
      filters: request.filters,
      groupBy: request.groupBy,
      timeGranularity: request.timeGranularity,
      minCount: request.minCount,
      topN: request.topN,
      limit: request.limit,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder,
      analysis: request.analysis,
    }
  }

  private async readSingleRecordTargetWithContext(
    request: NormalizedReadAppDataRequest,
    context: AiToolExecutionContext,
    target: AiReadAppDataTargetRef,
  ) {
    this.assertAiPermissionAllowsSource(request.app.id, target.id)
    if (request.mode === 'aggregate' && request.analysis) {
      const analysisResult = await this.readAnalysisSourceRecordsWithContext(request, context, target)
      const singleResult: ReadAppDataSingleResult = {
        kind: 'record_analysis',
        answerText: analysisResult.answerText,
        itemsText: analysisResult.itemsText,
        total: analysisResult.total,
        matchedCount: analysisResult.total,
        returnedRows: analysisResult.analysisResult.meta.rowCount,
        resultCount: analysisResult.analysisResult.meta.rowCount,
        fields: [],
        records: [],
        aggregation: null,
        analysisResult: analysisResult.analysisResult,
      }
      return {
        target: analysisResult.target,
        result: singleResult,
      }
    }

    const result = await this.readSourceRecordsWithContext({
      ...context,
      query: '',
    }, {
      appId: request.app.id,
      mode: request.mode,
      tableId: target.id,
      filters: request.filters,
      groupBy: request.groupBy,
      timeGranularity: request.timeGranularity,
      minCount: request.minCount,
      topN: request.topN,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder,
      pageSize: this.normalizePageSize(
        request.limit,
        request.mode === 'aggregate' && (!request.groupBy || request.timeGranularity) ? 1 : 10,
        50,
      ),
      page: 1,
    }) as any

    const resolvedTarget = {
      type: 'source' as const,
      id: String(result?.tableId || target.id || '').trim(),
      appId: request.app.id,
      name: String(result?.tableName || '').trim() || String(target.id || '').trim(),
    }
    const summaryOnlyAggregate = result?.aggregation?.kind === 'summary_only'
    const timeBucketAggregate = result?.aggregation?.kind === 'time_buckets'
    const aggregateMode = request.mode === 'aggregate'
    const aggregateResultCount = timeBucketAggregate
      ? Number(result?.aggregation?.returnedBucketCount || 0)
      : Number(result?.resultCount || 0)

    const singleResult: ReadAppDataSingleResult = {
      kind: summaryOnlyAggregate ? 'record_total' : (result?.aggregation ? 'record_aggregate' : 'record_rows'),
      answerText: String(result?.answerText || '').trim(),
      itemsText: String(result?.itemsText || '').trim(),
      total: Number(result?.total || 0),
      resultCount: summaryOnlyAggregate ? undefined : aggregateResultCount,
      matchedCount: Number(result?.total || 0),
      returnedRows: summaryOnlyAggregate ? undefined : aggregateResultCount,
      fields: aggregateMode || summaryOnlyAggregate || timeBucketAggregate ? [] : (Array.isArray(result?.fieldNames) ? result.fieldNames : []),
      records: aggregateMode || summaryOnlyAggregate || timeBucketAggregate ? [] : (Array.isArray(result?.items) ? result.items : []),
      aggregation: result?.aggregation || null,
    } as ReadAppDataSingleResult

    return {
      target: resolvedTarget,
      result: singleResult,
    }
  }

  private async executeRecordBatchReadTargets(
    request: NormalizedReadAppDataRequest,
    context: AiToolExecutionContext,
  ): Promise<BatchExecutionOutcome> {
    const featureFlags = await this.aiConfigService.getFeatureFlags(context.conversationProfile)
    const globalConcurrencyLimit = 4
    const singleAppConcurrencyLimit = 2
    const timeoutMs = 20000
    const circuitBreakerFailureThreshold = 3
    const desiredConcurrency = request.executionPreference === 'serial'
      ? 1
      : request.executionPreference === 'parallel'
        ? globalConcurrencyLimit
        : 2
    const concurrency = featureFlags.batchReadAppDataEnabled
      ? Math.max(1, Math.min(request.targets.length, desiredConcurrency, globalConcurrencyLimit, singleAppConcurrencyLimit))
      : 1
    const results: Array<BatchReadTargetResult | null> = new Array(request.targets.length).fill(null)
    const startedAt = Date.now()
    let cursor = 0
    let runningCount = 0
    let achievedConcurrency = 0
    let totalFailures = 0
    let circuitBroken = false

    const worker = async () => {
      while (true) {
        if (circuitBroken) {
          return
        }

        const currentIndex = cursor
        cursor += 1
        if (currentIndex >= request.targets.length) {
          return
        }

        const target = request.targets[currentIndex]
        runningCount += 1
        achievedConcurrency = Math.max(achievedConcurrency, runningCount)
        const targetStartedAt = Date.now()

        try {
          const singleResult = await this.runWithReadAppDataTimeout(
            () => this.readSingleRecordTargetWithContext(request, context, target),
            timeoutMs,
          )
          results[currentIndex] = {
            target: singleResult.target,
            ok: true,
            kind: singleResult.result.kind,
            answerText: singleResult.result.answerText,
            itemsText: singleResult.result.itemsText,
            total: singleResult.result.total,
            matchedCount: singleResult.result.matchedCount,
            returnedRows: singleResult.result.returnedRows,
            resultCount: singleResult.result.resultCount,
            fields: singleResult.result.fields,
            records: singleResult.result.records,
            aggregation: singleResult.result.aggregation,
            durationMs: Math.max(0, Date.now() - targetStartedAt),
          }
        } catch (error) {
          totalFailures += 1
          const timedOut = this.isReadAppDataTimeoutError(error)
          results[currentIndex] = {
            target,
            ok: false,
            error: this.serializeReadAppDataBatchError(error),
            durationMs: Math.max(0, Date.now() - targetStartedAt),
            timedOut,
          }
          if (totalFailures >= circuitBreakerFailureThreshold) {
            circuitBroken = true
          }
        } finally {
          runningCount = Math.max(0, runningCount - 1)
        }
      }
    }

    await Promise.all(
      Array.from({ length: concurrency }, () => worker()),
    )

    if (circuitBroken && cursor < request.targets.length) {
      for (let index = cursor; index < request.targets.length; index += 1) {
        const target = request.targets[index]
        if (results[index]) {
          continue
        }
        results[index] = {
          target,
          ok: false,
          error: AI_LOCAL_TOOL_COPY.batchCircuitBroken,
          durationMs: 0,
          queued: true,
        }
      }
    }

    const perTargetResults = results
      .map((item, index) => item || ({
        target: request.targets[index],
        ok: false,
        error: AI_LOCAL_TOOL_COPY.batchNoResult,
        durationMs: 0,
      }))
    const succeededTargets = perTargetResults
      .filter(item => item.ok)
      .map(item => ({
        id: item.target.id,
        name: item.target.name,
      }))
    const failedTargets = perTargetResults
      .filter(item => !item.ok)
      .map(item => ({
        id: item.target.id,
        name: item.target.name,
        error: String(item.error || '批量执行失败'),
        timedOut: item.timedOut,
        queued: item.queued,
      }))

    return {
      perTargetResults,
      succeededTargets,
      failedTargets,
      partial: failedTargets.length > 0 && succeededTargets.length > 0,
      timedOutCount: failedTargets.filter(item => item.timedOut).length,
      queuedCount: failedTargets.filter(item => item.queued).length,
      achievedConcurrency,
      durationMs: Math.max(0, Date.now() - startedAt),
      circuitBroken,
    }
  }

  private async runWithReadAppDataTimeout<T>(factory: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null

    try {
      return await Promise.race([
        factory(),
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            const error = new Error(`批量读取单个 target 超时 ${timeoutMs}ms）。`)
            ;(error as Error & { code?: string }).code = 'READ_APP_DATA_TARGET_TIMEOUT'
            reject(error)
          }, timeoutMs)
        }),
      ])
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
    }
  }

  private isReadAppDataTimeoutError(error: unknown) {
    const message = String((error as any)?.message || error || '').trim()
    const code = String((error as any)?.code || '').trim()
    return code === 'READ_APP_DATA_TARGET_TIMEOUT' || /超时/.test(message)
  }

  private serializeReadAppDataBatchError(error: unknown) {
    if (error instanceof Error) {
      return error.message || '批量执行失败'
    }
    return String(error || '批量执行失败')
  }

  private buildBatchRecordMergedResult(
    request: NormalizedReadAppDataRequest,
    perTargetResults: BatchReadTargetResult[],
  ) {
    const successResults = perTargetResults.filter(item => item.ok)
    const mergedTotal = successResults.reduce((sum, item) => sum + Number(item.total || 0), 0)
    const mergedResultCount = successResults.reduce((sum, item) => sum + Number(item.resultCount || 0), 0)
    const mergedReturnedRows = successResults.reduce((sum, item) => sum + Number(item.returnedRows || 0), 0)
    const mergedFields = Array.from(new Set(
      successResults.flatMap(item => Array.isArray(item.fields) ? item.fields : []),
    ))
    const mergedRecords = request.returnMode === 'per_target'
      ? []
      : successResults.flatMap(item =>
        (Array.isArray(item.records) ? item.records : []).map(record => ({
          __batchTargetId: item.target.id,
          __batchTargetName: item.target.name || item.target.id,
          ...record,
        })),
      )
    const mergedAggregation = request.mode === 'aggregate'
      ? this.mergeBatchRecordAggregationResults(successResults, request)
      : null
    const answerText = mergedAggregation?.kind === 'summary_only'
      ? `当前批量统计共匹配 ${mergedTotal} 条。`
      : ''
    const itemsText = request.mode === 'aggregate'
      ? this.buildAggregationItemsText(mergedAggregation)
      : ''

    return {
      answerText,
      itemsText,
      mergedTotal,
      mergedResultCount,
      mergedReturnedRows,
      mergedFields,
      mergedRecords,
      mergedAggregation,
    }
  }

  private mergeBatchRecordAggregationResults(
    perTargetResults: BatchReadTargetResult[],
    request: NormalizedReadAppDataRequest,
  ): RecordAggregationResult | null {
    const successResults = perTargetResults.filter(item => item.ok)
    if (!successResults.length) {
      return null
    }

    const firstAggregation = successResults.find(item => item.aggregation)?.aggregation || null
    if (!firstAggregation) {
      return this.buildSummaryOnlyAggregation()
    }

    if (firstAggregation.kind === 'summary_only') {
      return this.buildSummaryOnlyAggregation()
    }

    if (firstAggregation.kind === 'time_buckets') {
      const mergedCounts = new Map<string, number>()
      successResults.forEach(item => {
        const buckets = item.aggregation?.kind === 'time_buckets'
          ? item.aggregation.buckets
          : []
        buckets.forEach(bucket => {
          mergedCounts.set(bucket.value, (mergedCounts.get(bucket.value) || 0) + Number(bucket.count || 0))
        })
      })
      const buckets = Array.from(mergedCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((left, right) => String(left.value).localeCompare(String(right.value), 'zh-CN'))
      return {
        kind: 'time_buckets',
        fieldId: firstAggregation.fieldId,
        fieldName: firstAggregation.fieldName,
        timeGranularity: firstAggregation.timeGranularity,
        totalBucketCount: buckets.length,
        returnedBucketCount: buckets.length,
        buckets,
        itemsText: this.buildValueCountTableText(
          buckets,
          `${firstAggregation.fieldName}${this.describeTimeGranularity(firstAggregation.timeGranularity)}）`,
        ),
      }
    }

    const mergedCounts = new Map<string, number>()
    successResults.forEach(item => {
      const groups = item.aggregation?.kind === 'grouped'
        ? (Array.isArray(item.aggregation.allGroups) && item.aggregation.allGroups.length
          ? item.aggregation.allGroups
          : item.aggregation.groups)
        : []
      groups.forEach(group => {
        mergedCounts.set(group.value, (mergedCounts.get(group.value) || 0) + Number(group.count || 0))
      })
    })
    const allGroups = Array.from(mergedCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) =>
        right.count - left.count
        || String(left.value).localeCompare(String(right.value), 'zh-CN'),
      )
    const minCount = this.resolveRecordAggregationMinCount(request.minCount)
    const groups = allGroups.filter(item => item.count >= minCount)
    return {
      kind: 'grouped',
      fieldId: firstAggregation.fieldId,
      fieldName: firstAggregation.fieldName,
      minCount,
      totalGroupCount: allGroups.length,
      filteredGroupCount: groups.length,
      returnedGroupCount: groups.length,
      groups,
      allGroups,
      itemsText: groups.length
        ? this.buildValueCountTableText(groups, firstAggregation.fieldName)
        : `按“${firstAggregation.fieldName}”合并分组后，没有分组达到最小出现次数 ${minCount} 次。`,
    }
  }

  private buildReadAppDataExecutionSummary(options: {
    strategy: AiRuntimeExecutionStrategy
    request: NormalizedReadAppDataRequest
    partial: boolean
    batchSize: number
    succeededCount: number
    failedCount: number
    queuedCount: number
    timedOutCount: number
    achievedConcurrency: number
    durationMs?: number
    circuitBroken?: boolean
  }) {
    return {
      strategy: options.strategy,
      executionPreference: options.request.executionPreference,
      returnMode: options.request.returnMode,
      partialPolicy: options.request.partialPolicy,
      batchSize: options.batchSize,
      partial: options.partial,
      succeededCount: options.succeededCount,
      failedCount: options.failedCount,
      queuedCount: options.queuedCount,
      timedOutCount: options.timedOutCount,
      achievedConcurrency: options.achievedConcurrency,
      durationMs: Number.isFinite(Number(options.durationMs)) ? Number(options.durationMs) : undefined,
      circuitBroken: Boolean(options.circuitBroken),
    }
  }

  private throwReadAppDataInputError(message: string, code: string, details: Record<string, any>) {
    const error = new Error(message) as Error & { code?: string; details?: Record<string, any> }
    error.name = 'AiToolInputValidationError'
    error.code = code
    error.details = {
      tool: 'read_app_data',
      ...details,
    }
    throw error
  }

  private async readSourceRecordsWithContext(context: AiToolExecutionContext, input: Record<string, any>) {
    const { app, table } = await this.resolveForm(context, input, true)
    const readableTable = await this.buildAiReadableTable(app.id, table)
    const resolvedInput = { ...input }
    const filterPlan = this.buildSearchFormFilterPlan(readableTable, resolvedInput)
    const timeBucketRequest = this.resolveTimeBucketAggregationRequest(readableTable, resolvedInput)
    const timeBucketScanLimit = timeBucketRequest ? 10000 : undefined
    const page = this.normalizePageSize(resolvedInput.page, 1, 100000)
    const pageSize = this.normalizePageSize(resolvedInput.pageSize, 10, 50)
    const orderBy = this.buildSearchFormOrderBy(table, resolvedInput.sortBy, resolvedInput.sortOrder)
    const hasFilters = Boolean(filterPlan.databaseFilters || filterPlan.postFilters)
    let bucketCount: number | undefined
    let filteredRows: Array<Record<string, any>> = []
    let pageRows: Array<Record<string, any>> = []
    let fieldNames: string[] = []
    let aggregation: RecordAggregationResult | null = null

    if (filterPlan.postFilters || timeBucketRequest) {
      const allRowsResult = await this.loadRowsForSearchFormPostFilter(app.id, table.uid, {
        filters: filterPlan.databaseFilters ? { [table.uid]: [filterPlan.databaseFilters] } : undefined,
        orderBy,
        maxRows: timeBucketScanLimit,
        formatData: !timeBucketRequest,
      })
      if (timeBucketRequest && allRowsResult.truncated) {
        throw new Error(`当前时间趋势统计需要扫 ${allRowsResult.total} 条记录，已超过单次上 ${timeBucketScanLimit} 条。请先缩小时间范围或补充更精确的筛选条件。`)
      }
      bucketCount = allRowsResult.total
      filteredRows = filterPlan.postFilters
        ? allRowsResult.rows.filter(row =>
          this.matchesSearchFormPostFilters(readableTable, row, filterPlan.postFilters),
        )
        : allRowsResult.rows
      pageRows = timeBucketRequest ? [] : this.paginateItems(filteredRows, page, pageSize)
      aggregation = this.buildRecordAggregationFromRows(readableTable, filteredRows, context, resolvedInput)
      fieldNames = timeBucketRequest ? [] : this.getNonSystemFields(readableTable).map(item => item.alias || item.uid)
    } else {
      const buckets = await this.formDataService.getData(app.id, [readableTable.uid], {
        filters: filterPlan.databaseFilters ? { [readableTable.uid]: [filterPlan.databaseFilters] } : undefined,
        orderBy,
        pageNumber: page,
        pageSize,
        stage: { $nin: [FormDataStage.DRAFT] },
        formatData: true,
        transformFormData: true,
        fillSubTable: true,
        transformRelated: true,
        transformRelatedResultObject: true,
      } as any, {
        enforceFieldReadAuth: true,
      })
      const bucket = Array.isArray(buckets) ? buckets[0] : null
      bucketCount = Number(bucket?.count)
      pageRows = Array.isArray(bucket?.rows) ? bucket.rows : []
      fieldNames = Array.isArray(bucket?.fields)
        ? bucket.fields
          .filter((item): item is Field => Boolean(item) && !this.isSystemFieldSafe(item))
          .map(item => item.alias || item.uid)
        : []
      aggregation = await this.buildRecordAggregation(app.id, readableTable, filterPlan.databaseFilters, context, resolvedInput)
      filteredRows = pageRows
    }

    const summaryOnlyAggregate = aggregation?.kind === 'summary_only'
    const timeBucketAggregate = aggregation?.kind === 'time_buckets'
    const timeBucketCount = aggregation && aggregation.kind === 'time_buckets'
      ? aggregation.returnedBucketCount
      : 0
    const items = summaryOnlyAggregate || timeBucketAggregate ? [] : this.normalizeRecordItems(pageRows)
    const totalCount = filterPlan.postFilters
      ? filteredRows.length
      : (Number.isFinite(bucketCount) && Number(bucketCount) >= 0 ? Number(bucketCount) : items.length)
    if (summaryOnlyAggregate || timeBucketAggregate) {
      fieldNames = []
    }
    if (!fieldNames.length) {
      fieldNames = this.extractRecordFieldNames(readableTable, items)
    }
    return {
      appId: app.id,
      appName: app.name,
      tableId: readableTable.uid,
      tableName: readableTable.alias,
      filters: resolvedInput.filters || null,
      page,
      pageSize,
      total: totalCount,
      resultCount: timeBucketAggregate ? timeBucketCount : items.length,
      summary: '',
      answerText: summaryOnlyAggregate ? `当前条件下总数 ${totalCount}。` : '',
      fieldNames,
      itemsText: this.buildSearchRecordItemsText(
        readableTable,
        items,
        aggregation,
        String(resolvedInput.mode || '').trim() === 'aggregate' ? 'aggregate' : 'records',
      ),
      items,
      aggregation,
      meta: {
        bucketCount,
        filters: filterPlan.databaseFilters || null,
        postFilters: filterPlan.postFilters || null,
        pagination: { page, pageSize, total: totalCount },
        aggregation: aggregation
          ? (
            aggregation.kind === 'grouped'
              ? {
                kind: aggregation.kind,
                fieldId: aggregation.fieldId,
                fieldName: aggregation.fieldName,
                minCount: aggregation.minCount,
                totalGroupCount: aggregation.totalGroupCount,
                filteredGroupCount: aggregation.filteredGroupCount,
                returnedGroupCount: aggregation.returnedGroupCount,
              }
              : aggregation.kind === 'time_buckets'
                ? {
                  kind: aggregation.kind,
                  fieldId: aggregation.fieldId,
                  fieldName: aggregation.fieldName,
                  timeGranularity: aggregation.timeGranularity,
                  totalBucketCount: aggregation.totalBucketCount,
                  returnedBucketCount: aggregation.returnedBucketCount,
                }
                : {
                  kind: aggregation.kind,
                }
          )
          : null,
      },
    }
  }

  private async readAnalysisSourceRecordsWithContext(
    request: NormalizedReadAppDataRequest,
    context: AiToolExecutionContext,
    target: AiReadAppDataTargetRef,
  ) {
    const analysis = request.analysis
    if (!analysis) {
      throw new Error(AI_LOCAL_TOOL_COPY.aggregateAnalysisMissing)
    }

    const { app, table } = await this.resolveForm({
      ...context,
      query: '',
    }, {
      appId: request.app.id,
      tableId: target.id,
    }, true)
    const readableTable = await this.buildAiReadableTable(app.id, table)
    const resolvedTarget = {
      type: 'source' as const,
      id: String(readableTable?.uid || target.id || '').trim(),
      appId: request.app.id,
      name: String(readableTable?.alias || target.id || '').trim(),
    }
    const filterPlan = this.buildSearchFormFilterPlan(readableTable, {
      filters: request.filters,
    })
    const scanLimit = 10000
    const allRowsResult = await this.loadRowsForSearchFormPostFilter(app.id, table.uid, {
      filters: filterPlan.databaseFilters ? { [table.uid]: [filterPlan.databaseFilters] } : undefined,
      maxRows: scanLimit,
      formatData: false,
    })
    if (allRowsResult.truncated) {
      throw new Error(`当前 analysis 需要扫 ${allRowsResult.total} 条记录，已超过单次上 ${scanLimit} 条。请先缩小时间范围或补充更精确的筛选条件。`)
    }

    const filteredRows = filterPlan.postFilters
      ? allRowsResult.rows.filter(row => this.matchesSearchFormPostFilters(readableTable, row, filterPlan.postFilters))
      : allRowsResult.rows
    const analysisResult = this.buildReadAppDataAnalysisResult(readableTable, filteredRows, analysis, scanLimit)

    return {
      target: resolvedTarget,
      total: filteredRows.length,
      answerText: this.buildReadAppDataAnalysisAnswerText(analysisResult),
      itemsText: this.buildReadAppDataAnalysisItemsText(analysisResult),
      analysisResult,
    }
  }

  private buildReadAppDataAnalysisResult(
    table: Table,
    rows: Array<Record<string, any>>,
    analysis: AiReadAppDataAnalysis,
    scanLimit: number,
  ): AiReadAppDataAnalysisResult {
    const resolvedMetrics = analysis.metrics.map(metric => this.resolveReadAppDataAnalysisMetric(table, metric))
    const resolvedGroups = (Array.isArray(analysis.groupBy) ? analysis.groupBy : [])
      .map(group => this.resolveReadAppDataAnalysisGroup(table, group))

    resolvedMetrics.forEach(metric => {
      if (!metric.field || !['sum', 'avg', 'min', 'max'].includes(metric.op)) {
        return
      }
      if (this.isLikelyNumericAnalysisField(metric.field)) {
        return
      }
      const hasNumericSample = rows.some(row => this.extractNumericValuesForAnalysis(this.getRowValue(row, metric.field)).length > 0)
      if (!hasNumericSample) {
        throw new Error(`字段“${metric.fieldName || metric.field.alias || metric.field.uid}”不是可用于 ${metric.op} 的数值字段。请改为显式选择数值字段。`)
      }
    })

    const totals = this.createAnalysisAccumulatorMap(resolvedMetrics)
    const groupedRows = new Map<string, {
      dimensions: Record<string, string>
      displayDimensions: Record<string, string>
      accumulators: Record<string, AnalysisMetricAccumulator>
    }>()

    rows.forEach(row => {
      const dimensionCombinations = this.buildAnalysisDimensionCombinations(row, resolvedGroups)
      dimensionCombinations.forEach(item => {
        const existing = groupedRows.get(item.key)
        if (existing) {
          resolvedMetrics.forEach(metric => this.updateAnalysisAccumulator(existing.accumulators[metric.key], metric, row))
          return
        }
        const accumulators = this.createAnalysisAccumulatorMap(resolvedMetrics)
        resolvedMetrics.forEach(metric => this.updateAnalysisAccumulator(accumulators[metric.key], metric, row))
        groupedRows.set(item.key, {
          dimensions: item.dimensions,
          displayDimensions: item.displayDimensions,
          accumulators,
        })
      })
      resolvedMetrics.forEach(metric => this.updateAnalysisAccumulator(totals[metric.key], metric, row))
    })

    const finalizedRows = Array.from(groupedRows.values()).map(item => {
      const metrics = this.finalizeAnalysisAccumulatorMap(item.accumulators, resolvedMetrics)
      return {
        dimensions: item.dimensions,
        metrics,
        display: {
          dimensions: item.displayDimensions,
          metrics: this.buildAnalysisMetricDisplayMap(metrics, resolvedMetrics),
        },
      }
    })
    const rowsAfterHaving = finalizedRows.filter(item => this.matchesAnalysisHaving(item.metrics, analysis.having))
    const rowsAfterOrder = this.sortAnalysisRows(rowsAfterHaving, analysis.orderBy)
    const returnedRows = Number.isFinite(Number(analysis.topN)) && Number(analysis.topN) > 0
      ? rowsAfterOrder.slice(0, Number(analysis.topN))
      : rowsAfterOrder
    const finalizedTotals = this.finalizeAnalysisAccumulatorMap(totals, resolvedMetrics)

    return {
      metricDefs: resolvedMetrics.map(metric => ({
        key: metric.key,
        op: metric.op,
        field: metric.fieldName,
        displayMeta: metric.displayMeta,
      })),
      groupDefs: resolvedGroups.map(group => ({
        key: group.key,
        field: group.fieldName,
        timeGranularity: group.timeGranularity || undefined,
        displayMeta: group.displayMeta,
      })),
      rows: returnedRows,
      totals: finalizedTotals,
      totalsDisplay: this.buildAnalysisMetricDisplayMap(finalizedTotals, resolvedMetrics),
      meta: {
        sourceCount: 1,
        matchedCount: rows.length,
        groupCount: rowsAfterHaving.length,
        rowCount: returnedRows.length,
        topNApplied: Boolean(analysis.topN && returnedRows.length < rowsAfterOrder.length),
        truncated: false,
        scanLimit,
        mergeStrategy: 'single',
      },
    }
  }

  private resolveReadAppDataAnalysisMetric(table: Table, metric: AiReadAppDataAnalysisMetric): ResolvedAnalysisMetric {
    const rawField = String(metric.field || '').trim()
    const normalizedField = metric.op === 'count' && rawField === '*'
      ? ''
      : rawField
    const field = normalizedField
      ? this.assertAiFieldReadable(table, this.resolveField(table, normalizedField), normalizedField)
      : null

    return {
      key: metric.as,
      op: metric.op,
      field,
      fieldName: field ? (field.alias || field.uid) : undefined,
      displayMeta: field && ['sum', 'avg', 'min', 'max'].includes(metric.op)
        ? pickAiNumericDisplayMeta(field)
        : undefined,
    }
  }

  private resolveReadAppDataAnalysisGroup(
    table: Table,
    group: NonNullable<AiReadAppDataAnalysis['groupBy']>[number],
  ): ResolvedAnalysisGroup {
    const field = this.assertAiFieldReadable(table, this.resolveField(table, String(group.field || '').trim()), String(group.field || '').trim())
    if (group.timeGranularity && !this.isTimeAggregationField(field)) {
      throw new Error(`字段“${field.alias || field.uid}”不是时间字段，不能与 timeGranularity 一起使用。`)
    }

    return {
      key: String(group.as || group.field || '').trim(),
      field,
      fieldName: field.alias || field.uid,
      timeGranularity: group.timeGranularity || undefined,
      displayMeta: group.timeGranularity ? undefined : pickAiNumericDisplayMeta(field),
    }
  }

  private buildAnalysisDimensionCombinations(
    row: Record<string, any>,
    groups: ResolvedAnalysisGroup[],
  ): Array<{ key: string; dimensions: Record<string, string>; displayDimensions: Record<string, string> }> {
    if (!groups.length) {
      return [{
        key: '__all__',
        dimensions: {},
        displayDimensions: {},
      }]
    }

    const combinations: Array<{ key: string; dimensions: Record<string, string>; displayDimensions: Record<string, string> }> = []
    const walk = (
      index: number,
      current: Record<string, string>,
      displayCurrent: Record<string, string>,
    ) => {
      if (index >= groups.length) {
        combinations.push({
          key: JSON.stringify(groups.map(group => [group.key, current[group.key] || ''])),
          dimensions: { ...current },
          displayDimensions: { ...displayCurrent },
        })
        return
      }

      const group = groups[index]
      const values = this.extractReadAppDataAnalysisGroupValues(row, group)
      values.forEach(value => {
        current[group.key] = value.raw
        displayCurrent[group.key] = value.display
        walk(index + 1, current, displayCurrent)
      })
    }

    walk(0, {}, {})
    return combinations
  }

  private extractReadAppDataAnalysisGroupValues(row: Record<string, any>, group: ResolvedAnalysisGroup) {
    if (group.timeGranularity) {
      const buckets = this.extractTimeBucketEntriesFromRow(row, group.field, group.timeGranularity)
        .map(item => ({
          raw: String(item.label || '').trim(),
          display: String(item.label || '').trim(),
        }))
        .filter(item => item.raw)
      return buckets.length ? Array.from(new Map(buckets.map(item => [item.raw, item])).values()) : [{ raw: '', display: '' }]
    }

    const rawValue = this.getRowValue(row, group.field)
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    const normalizedValues = values
      .map(value => this.buildAnalysisGroupDisplayValue(value, group))
      .filter((item): item is { raw: string; display: string } => Boolean(item))
    return normalizedValues.length
      ? Array.from(new Map(normalizedValues.map(item => [item.raw, item])).values())
      : [{ raw: '', display: '' }]
  }

  private buildAnalysisGroupDisplayValue(value: any, group: ResolvedAnalysisGroup) {
    if (value === null || value === undefined || value === '') {
      return null
    }

    if (String(group.field?.type || '').trim().toLowerCase() === 'number') {
      const numericValue = Number(value)
      if (Number.isFinite(numericValue)) {
        const raw = String(numericValue)
        return {
          raw,
          display: formatAiNumericValue(numericValue, group.displayMeta),
        }
      }
    }

    const raw = this.normalizeRecordAggregationValue(value)
    const normalized = raw === 'undefined' || raw === 'null' ? '' : String(raw || '').trim()
    if (!normalized) {
      return null
    }

    return {
      raw: normalized,
      display: normalized,
    }
  }

  private createAnalysisAccumulatorMap(metrics: ResolvedAnalysisMetric[]) {
    return metrics.reduce<Record<string, AnalysisMetricAccumulator>>((result, metric) => {
      result[metric.key] = this.createAnalysisAccumulator(metric.op)
      return result
    }, {})
  }

  private createAnalysisAccumulator(op: AiReadAppDataAnalysisMetricOp): AnalysisMetricAccumulator {
    switch (op) {
      case 'count':
        return { op, count: 0 }
      case 'count_distinct':
        return { op, values: new Set<string>() }
      case 'sum':
        return { op, sum: 0 }
      case 'avg':
        return { op, sum: 0, count: 0 }
      case 'min':
        return { op, value: null }
      case 'max':
        return { op, value: null }
      default:
        return { op: 'count', count: 0 }
    }
  }

  private updateAnalysisAccumulator(
    accumulator: AnalysisMetricAccumulator,
    metric: ResolvedAnalysisMetric,
    row: Record<string, any>,
  ) {
    switch (accumulator.op) {
      case 'count':
        accumulator.count += 1
        return
      case 'count_distinct': {
        const values = metric.field
          ? this.extractAggregationValuesFromRow(row, metric.field)
          : []
        values.forEach(value => {
          const normalized = String(value || '').trim()
          if (normalized) {
            accumulator.values.add(normalized)
          }
        })
        return
      }
      case 'sum': {
        const numbers = this.extractNumericValuesForAnalysis(metric.field ? this.getRowValue(row, metric.field) : undefined)
        numbers.forEach(value => {
          accumulator.sum += value
        })
        return
      }
      case 'avg': {
        const numbers = this.extractNumericValuesForAnalysis(metric.field ? this.getRowValue(row, metric.field) : undefined)
        numbers.forEach(value => {
          accumulator.sum += value
          accumulator.count += 1
        })
        return
      }
      case 'min': {
        const numbers = this.extractNumericValuesForAnalysis(metric.field ? this.getRowValue(row, metric.field) : undefined)
        numbers.forEach(value => {
          accumulator.value = accumulator.value === null ? value : Math.min(accumulator.value, value)
        })
        return
      }
      case 'max': {
        const numbers = this.extractNumericValuesForAnalysis(metric.field ? this.getRowValue(row, metric.field) : undefined)
        numbers.forEach(value => {
          accumulator.value = accumulator.value === null ? value : Math.max(accumulator.value, value)
        })
      }
    }
  }

  private finalizeAnalysisAccumulatorMap(
    accumulators: Record<string, AnalysisMetricAccumulator>,
    metrics: ResolvedAnalysisMetric[],
  ) {
    return metrics.reduce<Record<string, number | null>>((result, metric) => {
      const accumulator = accumulators[metric.key]
      result[metric.key] = this.finalizeAnalysisAccumulator(accumulator)
      return result
    }, {})
  }

  private buildAnalysisMetricDisplayMap(
    metrics: Record<string, number | null>,
    definitions: ResolvedAnalysisMetric[],
  ) {
    return definitions.reduce<Record<string, string>>((result, definition) => {
      result[definition.key] = formatAiNumericValue(metrics[definition.key], definition.displayMeta)
      return result
    }, {})
  }

  private finalizeAnalysisAccumulator(accumulator: AnalysisMetricAccumulator | undefined): number | null {
    if (!accumulator) {
      return null
    }
    switch (accumulator.op) {
      case 'count':
        return accumulator.count
      case 'count_distinct':
        return accumulator.values.size
      case 'sum':
        return accumulator.sum
      case 'avg':
        return accumulator.count > 0 ? accumulator.sum / accumulator.count : null
      case 'min':
      case 'max':
        return accumulator.value
      default:
        return null
    }
  }

  private matchesAnalysisHaving(
    metrics: Record<string, number | null>,
    having?: AiReadAppDataAnalysis['having'],
  ) {
    const conditions = Array.isArray(having) ? having : []
    if (!conditions.length) {
      return true
    }

    return conditions.every(condition => {
      const actual = metrics[String(condition.metric || '').trim()]
      return this.compareAnalysisValue(actual, condition.op, condition.value)
    })
  }

  private compareAnalysisValue(actual: number | null | undefined, op: AiReadAppDataAnalysisCompareOp, expected: any) {
    if (actual === null || actual === undefined) {
      return false
    }
    const expectedNumber = Number(expected)
    if (!Number.isFinite(expectedNumber)) {
      return false
    }
    switch (op) {
      case 'gt':
        return actual > expectedNumber
      case 'gte':
        return actual >= expectedNumber
      case 'lt':
        return actual < expectedNumber
      case 'lte':
        return actual <= expectedNumber
      case 'eq':
        return actual === expectedNumber
      case 'ne':
        return actual !== expectedNumber
      default:
        return false
    }
  }

  private sortAnalysisRows(
    rows: Array<{
      dimensions: Record<string, string>
      metrics: Record<string, number | null>
      display: {
        dimensions: Record<string, string>
        metrics: Record<string, string>
      }
    }>,
    orderBy?: AiReadAppDataAnalysis['orderBy'],
  ) {
    const items = [...rows]
    const orders = Array.isArray(orderBy) ? orderBy : []
    if (!orders.length) {
      return items
    }

    items.sort((left, right) => {
      for (const order of orders) {
        const direction = order?.direction === 'asc' ? 1 : -1
        const leftValue = order?.metric
          ? left.metrics[String(order.metric || '').trim()]
          : left.dimensions[String(order?.group || '').trim()]
        const rightValue = order?.metric
          ? right.metrics[String(order.metric || '').trim()]
          : right.dimensions[String(order?.group || '').trim()]
        const compared = this.compareAnalysisOrderValue(leftValue, rightValue)
        if (compared !== 0) {
          return compared * direction
        }
      }
      return 0
    })

    return items
  }

  private compareAnalysisOrderValue(left: any, right: any) {
    const leftMissing = left === null || left === undefined || String(left).trim() === ''
    const rightMissing = right === null || right === undefined || String(right).trim() === ''
    if (leftMissing && rightMissing) {
      return 0
    }
    if (leftMissing) {
      return -1
    }
    if (rightMissing) {
      return 1
    }

    const leftNumber = Number(left)
    const rightNumber = Number(right)
    const leftIsNumber = Number.isFinite(leftNumber)
    const rightIsNumber = Number.isFinite(rightNumber)

    if (leftIsNumber && rightIsNumber) {
      return leftNumber - rightNumber
    }

    const leftText = String(left ?? '').trim()
    const rightText = String(right ?? '').trim()
    return leftText.localeCompare(rightText, 'zh-CN')
  }

  private extractNumericValuesForAnalysis(value: any): number[] {
    if (value === null || value === undefined || value === '') {
      return []
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? [value] : []
    }
    if (typeof value === 'string') {
      const normalized = value.trim().replace(/,/g, '')
      if (!normalized) {
        return []
      }
      const numericValue = Number(normalized)
      return Number.isFinite(numericValue) ? [numericValue] : []
    }
    if (Array.isArray(value)) {
      return value.flatMap(item => this.extractNumericValuesForAnalysis(item))
    }
    if (typeof value === 'object') {
      const preferredKeys = ['value', 'amount', 'price', 'number', 'count', 'qty']
      const preferredValues = preferredKeys.flatMap(key =>
        Object.prototype.hasOwnProperty.call(value, key)
          ? this.extractNumericValuesForAnalysis(value[key])
          : [],
      )
      if (preferredValues.length) {
        return preferredValues
      }
    }
    return []
  }

  private isLikelyNumericAnalysisField(field: Field | null | undefined) {
    return isAiMetricField(field)
  }

  private buildReadAppDataAnalysisAnswerText(result: AiReadAppDataAnalysisResult) {
    if (!result.groupDefs.length) {
      if (!Object.keys(result.totals).length) {
        return AI_LOCAL_TOOL_COPY.analysisNoMetricResults
      }
      return `当前条件下已完成 ${result.metricDefs.length} 个指标统计。`
    }
    if (!result.rows.length) {
      return AI_LOCAL_TOOL_COPY.analysisNoGroupedResults
    }
    if (result.meta.topNApplied) {
      return `当前条件下共得到 ${result.meta.groupCount} 个分组结果，已按排序返回 ${result.meta.rowCount} 项。`
    }
    return `当前条件下共得到 ${result.meta.rowCount} 个分组结果。`
  }

  private buildReadAppDataAnalysisItemsText(result: AiReadAppDataAnalysisResult) {
    const groupHeaders = result.groupDefs.map(item => item.key)
    const metricHeaders = result.metricDefs.map(item => item.key)
    const headers = [...groupHeaders, ...metricHeaders]

    if (!headers.length) {
      return ''
    }

    const lines = [
      `| ${headers.map(item => this.escapeMarkdownTableCell(item)).join(' | ')} |`,
      `| ${headers.map((_, index) => index < groupHeaders.length ? '---' : '---:').join(' | ')} |`,
      ...result.rows.slice(0, 20).map(row => {
        const cells = [
          ...groupHeaders.map(header => this.formatAggregateDisplayValue(row.display.dimensions[header] || row.dimensions[header] || '')),
          ...metricHeaders.map(header => row.display.metrics[header] || ''),
        ]
        return `| ${cells.map(item => this.escapeMarkdownTableCell(item)).join(' | ')} |`
      }),
    ]

    if (Object.keys(result.totals).length) {
      lines.push('')
      lines.push(`总计: ${result.metricDefs.map(item => `${item.key}=${result.totalsDisplay[item.key] ?? ''}`).join('、')}`)
    }
    if (result.rows.length > 20) {
      lines.push(`已省略其 ${result.rows.length - 20} 行结果。`)
    }

    return lines.join('\n')
  }

  async listAccessibleAppsForContext(context: AiToolExecutionContext) {
    return await this.listAccessibleApps(context)
  }

  async getAccessibleAppsSignatureForContext(context: AiToolExecutionContext) {
    const apps = await this.listAccessibleApps(context)
    return this.buildAccessibleAppsSignature(apps)
  }

  async canReuseCachedToolOutput(
    toolName: string,
    output: Record<string, any> | null | undefined,
    context: AiToolExecutionContext,
  ) {
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      return true
    }

    try {
      if (toolName === 'get_app_memory') {
        const appId = String(output?.app?.appId || '').trim()
        if (!appId) {
          return false
        }
        const level = String(output?.request?.level || '').trim().toLowerCase() === 'catalog'
          ? 'catalog'
          : 'structure'
        const app = await this.resolveApp(context, { appId }, true)
        const manifest = await this.ensureAccessibleAppManifest(app.id, context, level)
        const allowedSourceIds = new Set(
          (Array.isArray(manifest?.sourceIndex) ? manifest.sourceIndex : [])
            .map(item => String(item?.sourceId || '').trim())
            .filter(Boolean),
        )
        const outputSourceIds = (Array.isArray(output?.sources) ? output.sources : [])
          .map((item: any) => String(item?.sourceId || '').trim())
          .filter(Boolean)
        return outputSourceIds.every(sourceId => allowedSourceIds.has(sourceId))
      }

      if (toolName === 'read_app_data') {
        const appId = String(output?.resolved?.appId || '').trim()
        if (!appId) {
          return false
        }
        await this.resolveApp(context, { appId }, true)
        const targets = Array.isArray(output?.resolved?.targets) && output.resolved.targets.length
          ? output.resolved.targets
          : (output?.resolved?.target ? [output.resolved.target] : [])
        if (!targets.length) {
          return false
        }
        for (const target of targets) {
          const targetId = String(target?.id || '').trim()
          if (!targetId) {
            return false
          }
          this.assertAiPermissionAllowsSource(appId, targetId)
        }
      }
      return true
    } catch {
      return false
    }
  }

  private async listAccessibleApps(context: AiToolExecutionContext) {
    const apps = await this.listAccessibleAppsFromServices(context)
    const aiScopedApps = this.applyAiPermissionToApps(apps, this.workbenchService.getAiPermissionConfig())
    const scopedApps = this.applyAppScopeToApps(aiScopedApps, context.appScope)
    return await this.filterAppsWithReadableBody(scopedApps)
  }

  private buildAccessibleAppsSignature(
    apps: Array<{ id: string; name?: string; groupId?: string; createTime?: any; sort?: any }>,
  ) {
    const normalized = apps
      .map(item => ({
        id: String(item?.id || '').trim(),
        name: String(item?.name || '').trim(),
      }))
      .filter(item => item.id)
      .sort((left, right) =>
        left.id.localeCompare(right.id, 'zh-CN')
        || left.name.localeCompare(right.name, 'zh-CN'),
      )

    return normalized.length ? md5(JSON.stringify(normalized)) : 'none'
  }

  private async listAccessibleAppsFromServices(context: AiToolExecutionContext) {
    const accountId = String(context.accountId || '').trim()
    if (!accountId || accountId === '0') {
      return []
    }

    const isAdmin = Boolean(context.accountIsAdmin || context.accountUser === 'admin')
    const apps = isAdmin
      ? await this.projectService.getAllNocodeMetas()
      : await this.projectService.getSharePermissionsByAccountId(accountId)
    return this.normalizeAccessibleAppItems(apps)
  }

  private applyAppScopeToApps(
    apps: Array<{ id: string; name?: string; groupId?: string; createTime?: any; sort?: any }>,
    appScope?: AiToolExecutionContext['appScope'],
  ) {
    const scopedIds = new Set(
      (Array.isArray(appScope?.appIds) ? appScope?.appIds : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )
    const scopedNames = (Array.isArray(appScope?.appNames) ? appScope?.appNames : [])
      .map(item => String(item || '').trim())
      .filter(Boolean)

    if (!scopedIds.size && !scopedNames.length) {
      return apps
    }

    const matchedById = scopedIds.size
      ? apps.filter(item => scopedIds.has(String(item.id || '').trim()))
      : []
    const matchedByName = scopedNames.flatMap(name => this.filterAppsByKeyword(apps, name))
    const matchedIds = new Set([
      ...matchedById.map(item => String(item.id || '').trim()),
      ...matchedByName.map(item => String(item.id || '').trim()),
    ])

    return apps.filter(item => matchedIds.has(String(item.id || '').trim()))
  }

  private async filterAppsWithReadableBody(
    apps: Array<{ id: string; name?: string; groupId?: string; createTime?: any; sort?: any }>,
  ) {
    const readableApps = await Promise.all(
      apps.map(async app => {
        try {
          const body = await this.projectService.getNocodeBody(app.id)
          return body ? app : null
        } catch {
          return null
        }
      }),
    )

    return readableApps.filter(Boolean) as Array<{ id: string; name?: string; groupId?: string; createTime?: any; sort?: any }>
  }

  private applyAiPermissionToApps(
    apps: Array<{ id: string; name?: string; groupId?: string; createTime?: any; sort?: any }>,
    config?: AiPermissionConfig | null,
  ) {
    if (!this.isAiPermissionConfigured(config)) {
      return apps
    }

    const allowedAppIds = new Set(
      Object.keys(config?.apps || {})
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )

    if (!allowedAppIds.size) {
      return []
    }

    return apps.filter(item => allowedAppIds.has(String(item.id || '').trim()))
  }

  private isAiPermissionConfigured(config?: AiPermissionConfig | null) {
    const updateTime = Number(config?.updateTime || 0)
    const hasExplicitApps = Object.keys(config?.apps || {})
      .map(item => String(item || '').trim())
      .filter(Boolean)
      .length > 0

    return hasExplicitApps || (Number.isFinite(updateTime) && updateTime > 0)
  }

  private getAiPermissionAppScope(appId: string, config = this.workbenchService.getAiPermissionConfig()) {
    const normalizedAppId = String(appId || '').trim()
    if (!normalizedAppId) {
      return null
    }

    if (!this.isAiPermissionConfigured(config)) {
      return {
        allForms: true,
        formIds: new Set<string>(),
      }
    }

    const permission = config?.apps?.[normalizedAppId]
    if (!permission) {
      return null
    }

    return {
      allForms: permission.allForms === true,
      formIds: new Set(
        (Array.isArray(permission.formIds) ? permission.formIds : [])
          .map(item => String(item || '').trim())
          .filter(Boolean),
      ),
    }
  }

  private filterTablesByAiPermission<T extends { uid: string }>(
    appId: string,
    tables: T[],
    config = this.workbenchService.getAiPermissionConfig(),
  ) {
    const appScope = this.getAiPermissionAppScope(appId, config)
    if (!appScope) {
      return []
    }

    if (appScope.allForms) {
      return tables
    }

    return tables.filter(item => appScope.formIds.has(String(item?.uid || '').trim()))
  }

  private filterManifestByAiPermission(
    appId: string,
    manifest?: AiAppMemoryManifest | null,
    config = this.workbenchService.getAiPermissionConfig(),
  ): AiAppMemoryManifest | null {
    if (!manifest) {
      return null
    }

    if (!this.isAiPermissionConfigured(config)) {
      return manifest
    }

    const appScope = this.getAiPermissionAppScope(appId, config)
    if (!appScope) {
      return {
        ...manifest,
        levels: {
          ...manifest.levels,
          semantic: 'missing' as AiMemoryLevelStatus,
        },
        semanticProfile: this.buildEmptySemanticProfile(),
        semanticProfileSourceFacts: [],
        sourceIndex: [],
        viewProfile: this.buildDefaultViewProfile(),
        workflowProfile: this.buildDefaultWorkflowProfile(),
        routeIndex: {
          recordRoutes: [],
        },
        entryPoints: [],
        appSummary: {
          ...manifest.appSummary,
          purpose: `应用“${manifest.appName}”当前未开放任何 AI 可访问数据源。`,
        },
      }
    }

    const allowedSourceIds = appScope.allForms
      ? new Set(manifest.sourceIndex.map(item => String(item?.sourceId || '').trim()).filter(Boolean))
      : appScope.formIds
    const sourceIndex = manifest.sourceIndex.filter(item => allowedSourceIds.has(String(item?.sourceId || '').trim()))
    const semanticProfileSourceFacts = this.filterSemanticProfileSourceFactsByAiPermission(
      manifest.semanticProfileSourceFacts,
      allowedSourceIds,
    )
    const semanticProfile = this.filterSemanticProfileByAiPermission(
      manifest,
      sourceIndex.length === manifest.sourceIndex.length,
      semanticProfileSourceFacts,
    )
    const requiresSemanticRebuild = sourceIndex.length > 0
      && sourceIndex.length < manifest.sourceIndex.length
      && !semanticProfileSourceFacts.length
      && String(manifest.levels?.structure || '').trim() === 'ready'
    const purpose = String(manifest.appSummary?.purpose || '').trim()

    return {
      ...manifest,
      levels: requiresSemanticRebuild
        ? {
            ...manifest.levels,
            semantic: 'stale' as AiMemoryLevelStatus,
          }
        : manifest.levels,
      semanticProfile,
      semanticProfileSourceFacts,
      sourceIndex,
      viewProfile: {
        ...this.buildDefaultViewProfile(manifest.viewProfile),
        documentViews: this.buildDefaultViewProfile(manifest.viewProfile).documentViews.filter(item =>
          allowedSourceIds.has(String(item?.sourceId || '').trim())
          && allowedSourceIds.has(String(item?.contract?.directorySourceId || '').trim()),
        ),
        formViewSourceIds: this.buildDefaultViewProfile(manifest.viewProfile).formViewSourceIds
          .filter(item => allowedSourceIds.has(String(item || '').trim())),
        tableViewSourceIds: this.buildDefaultViewProfile(manifest.viewProfile).tableViewSourceIds
          .filter(item => allowedSourceIds.has(String(item || '').trim())),
      },
      workflowProfile: {
        ...this.buildDefaultWorkflowProfile(manifest.workflowProfile),
        sourceIds: this.buildDefaultWorkflowProfile(manifest.workflowProfile).sourceIds
          .filter(item => allowedSourceIds.has(String(item || '').trim())),
      },
      routeIndex: {
        recordRoutes: (Array.isArray(manifest.routeIndex?.recordRoutes) ? manifest.routeIndex.recordRoutes : [])
          .filter(item => allowedSourceIds.has(String(item?.sourceId || '').trim())),
      },
      entryPoints: (Array.isArray(manifest.entryPoints) ? manifest.entryPoints : [])
        .filter(item => allowedSourceIds.has(String(item?.targetId || '').trim())),
      appSummary: {
        ...manifest.appSummary,
        purpose: [`应用“${manifest.appName}”当前对 AI 开放 ${sourceIndex.length} 个数据源。`, purpose]
          .filter(Boolean)
          .join(' '),
      },
    }
  }

  private buildEmptySemanticProfile() {
    return {
      summary: '',
      derivedSummary: '',
      primaryUseCases: [],
      keyEntities: [],
      keyActions: [],
      featureTags: [],
      relationOverview: [],
      sourceRoleHints: [],
      doNotUseFor: [],
      confidence: 0,
      evidenceCount: 0,
      generatedBy: 'heuristic' as const,
    }
  }

  private buildRelativeTimeFilterRisk(
    context: AiToolExecutionContext,
    request: Pick<NormalizedReadAppDataRequest, 'mode' | 'filters' | 'analysis'>,
  ) {
    const query = String(context?.query || '').trim()
    const hasRelativeTime = this.containsRelativeTimeExpression(query)
    const hasFilters = !!(request.filters && typeof request.filters === 'object' && !Array.isArray(request.filters) && Object.keys(request.filters).length)
    const usesTimeAnalysis = Array.isArray(request.analysis?.groupBy)
      && request.analysis.groupBy.some(item => !!String(item?.timeGranularity || '').trim())
    const relativeTimeFilterMissing = hasRelativeTime && !hasFilters && (request.mode === 'aggregate' || usesTimeAnalysis)

    return {
      relativeTimeFilterMissing,
      relativeTimeRiskHint: relativeTimeFilterMissing
        ? `用户问题包含“${this.extractFirstRelativeTimeExpression(query)}”，但本次 read_app_data 未显式传 filters，请不要把当前结果视为完整验证。`
        : '',
    }
  }

  private containsRelativeTimeExpression(value: string) {
    return /(近两个月|近两月|近一个月|最近两个月|最近两月|最近一个月|今天|昨天|前天|本周|本月|上周|上个月|上月|本季度|上季度|今年|去年)/.test(String(value || '').trim())
  }

  private extractFirstRelativeTimeExpression(value: string) {
    const match = String(value || '').match(/近两个月|近两月|近一个月|最近两个月|最近两月|最近一个月|今天|昨天|前天|本周|本月|上周|上个月|上月|本季度|上季度|今年|去年/)
    return match?.[0] || '相对时间'
  }

  private applyDerivedSummaryVisibility(
    semanticProfile: AiAppMemoryManifest['semanticProfile'] | null | undefined,
    featureFlags: Record<string, any> | null | undefined,
  ) {
    const visibleSemanticProfile = {
      ...this.buildEmptySemanticProfile(),
      ...(semanticProfile || {}),
    }
    if (featureFlags?.semanticDerivedSummaryEnabled !== false) {
      return visibleSemanticProfile
    }
    return {
      ...visibleSemanticProfile,
      derivedSummary: '',
    }
  }

  private applyDerivedSummaryVisibilityToManifest(
    manifest: AiAppMemoryManifest | null,
    featureFlags: Record<string, any> | null | undefined,
  ) {
    if (!manifest) {
      return null
    }
    return {
      ...manifest,
      semanticProfile: this.applyDerivedSummaryVisibility(manifest.semanticProfile, featureFlags),
    }
  }

  private shouldScheduleSemanticWarmupForManifest(manifest: AiAppMemoryManifest | null | undefined) {
    if (!manifest || String(manifest?.levels?.structure || '').trim() !== 'ready') {
      return false
    }

    const semanticLevel = String(manifest?.levels?.semantic || 'missing').trim()
    if (semanticLevel === 'missing' || semanticLevel === 'failed' || semanticLevel === 'stale') {
      return true
    }
    if (semanticLevel !== 'partial') {
      return false
    }

    return !this.hasMeaningfulAppSemanticProfile(manifest.semanticProfile)
  }

  private hasMeaningfulAppSemanticProfile(
    semanticProfile: AiAppMemoryManifest['semanticProfile'] | null | undefined,
  ) {
    const profile = {
      ...this.buildEmptySemanticProfile(),
      ...(semanticProfile || {}),
    }
    return Boolean(
      String(profile.summary || '').trim()
      || String(profile.derivedSummary || '').trim()
      || (profile.primaryUseCases || []).length
      || (profile.keyEntities || []).length
      || (profile.keyActions || []).length
      || (profile.featureTags || []).length
      || (profile.relationOverview || []).length
      || (profile.sourceRoleHints || []).length
      || (profile.doNotUseFor || []).length,
    )
  }

  private filterSemanticProfileSourceFactsByAiPermission(
    sourceFacts: AiAppMemoryManifest['semanticProfileSourceFacts'],
    allowedSourceIds: Set<string>,
  ) {
    return (Array.isArray(sourceFacts) ? sourceFacts : [])
      .map(item => ({
        sourceId: String(item?.sourceId || '').trim(),
        relationFacts: this.uniqueStrings(item?.relationFacts || []),
        roleFacts: this.uniqueStrings(item?.roleFacts || []),
      }))
      .filter(item => item.sourceId && allowedSourceIds.has(item.sourceId))
  }

  private filterSemanticProfileByAiPermission(
    manifest: AiAppMemoryManifest,
    preserveFullProfile: boolean,
    sourceFacts: AiAppMemoryManifest['semanticProfileSourceFacts'],
  ) {
    const relationOverview = this.uniqueStrings((Array.isArray(sourceFacts) ? sourceFacts : []).flatMap(item => item.relationFacts || []))
    const sourceRoleHints = this.uniqueStrings((Array.isArray(sourceFacts) ? sourceFacts : []).flatMap(item => item.roleFacts || []))
    const derivedSummary = buildPermissionSafeDerivedSummary({
      relationOverview,
      sourceRoleHints,
      sourceCount: Array.isArray(sourceFacts) ? sourceFacts.length : 0,
    })

    if (preserveFullProfile) {
      return {
        ...(manifest.semanticProfile || this.buildEmptySemanticProfile()),
        derivedSummary,
      }
    }

    return {
      ...this.buildEmptySemanticProfile(),
      derivedSummary,
      relationOverview,
      sourceRoleHints,
      confidence: relationOverview.length || sourceRoleHints.length
        ? Math.max(0, Number(manifest.semanticProfile?.confidence || 0))
        : 0,
      evidenceCount: Array.isArray(sourceFacts) ? sourceFacts.length : 0,
      lastVerifiedAt: relationOverview.length || sourceRoleHints.length
        ? manifest.semanticProfile?.lastVerifiedAt
        : undefined,
      generatedBy: relationOverview.length || sourceRoleHints.length
        ? (manifest.semanticProfile?.generatedBy || 'heuristic')
        : 'heuristic',
    }
  }

  private async ensureAccessibleAppManifest(
    appId: string,
    context: AiToolExecutionContext,
    level: 'catalog' | 'structure',
  ) {
    const { manifest } = await this.getWarmupService().ensureAppMemory(appId, {
      ...context,
      query: '',
    }, level)
    const filteredManifest = this.filterManifestByAiPermission(appId, manifest)
    if (!filteredManifest) {
      throw new Error(`应用“${appId}”的 AI 记忆不存在。`)
    }
    return filteredManifest
  }

  private assertAiPermissionAllowsSource(appId: string, sourceId: string) {
    const appScope = this.getAiPermissionAppScope(appId)
    if (!appScope) {
      throw new Error(AI_LOCAL_TOOL_COPY.aiPermissionMissing)
    }

    if (appScope.allForms || appScope.formIds.has(String(sourceId || '').trim())) {
      return
    }

    throw new Error(AI_LOCAL_TOOL_COPY.sourcePermissionMissing.replace('%s', `“${sourceId}”`))
  }

  private normalizeAccessibleAppItems(
    value: Array<{ id?: string; name?: string; groupId?: string; createTime?: any; sort?: any; deleted?: boolean }> | null | undefined,
  ) {
    const seen = new Set<string>()
    return (Array.isArray(value) ? value : [])
      .filter(item => !item?.deleted)
      .map(item => {
        const id = String(item?.id || '').trim()
        if (!id || seen.has(id)) {
          return null
        }
        seen.add(id)
        return {
          id,
          name: String(item?.name || item?.id || '').trim() || id,
          groupId: item?.groupId ? String(item.groupId).trim() : undefined,
          createTime: item?.createTime,
          sort: item?.sort,
        }
      })
      .filter(Boolean)
      .sort((left, right) => {
        const leftSort = Number(left?.sort ?? 0)
        const rightSort = Number(right?.sort ?? 0)
        if (leftSort !== rightSort) {
          return leftSort - rightSort
        }
        const leftCreateTime = Number(left?.createTime ?? 0)
        const rightCreateTime = Number(right?.createTime ?? 0)
        return rightCreateTime - leftCreateTime
      })
  }

  private async resolveApp(context: AiToolExecutionContext, input: Record<string, any>, required = false) {
    const apps = await this.listAccessibleApps(context)
    const explicitAppId = String(input.appId || '').trim()
    if (explicitAppId) {
      const matched = apps.find(item => item.id === explicitAppId)
      if (matched) return matched
      throw new Error(`应用 ID“${explicitAppId}”不存在，或不在当前可访问范围内。`)
    }
    if (required) {
      throw new Error('当前还无法确定应用。请先调用 search_apps，拿到明确的应用ID，再调用后续工具。')
    }
    return null
  }

  private async resolveForm(context: AiToolExecutionContext, input: Record<string, any>, required = false) {
    const app = await this.resolveApp(context, input, required)
    if (!app) return { app: null, table: null }
    const body = await this.projectService.getNocodeBody(app.id)
    const tables = (body?.formData?.tables || []).filter(item => !item.meta?.extra?.primaryTable)
    const explicitTableId = String(input.tableId || '').trim()
    const explicitTableName = String(input.tableName || '').trim()
    if (explicitTableName) {
      throw new Error(`read_app_data 只接受 target.id。请先调 get_app_memory，使用返回的 sources[].sourceId。`)
    }
    if (explicitTableId) {
      const matched = tables.find(item => item.uid === explicitTableId)
      if (matched) return { app, table: matched }
      throw new Error(`应用“${app.name}”中不存在 sourceId/tableId="${explicitTableId}" 对应的数据源。请先调 get_app_memory，使用返回的 sources[].sourceId。`)
    }
    if (required) {
      throw new Error(`当前还无法确定数据源。请先调 get_app_memory 查看应用“${app.name}”的 sources，再在 read_app_data 中显式传 target.id。`)
    }
    return { app, table: null }
  }

  private normalizeRecordItems(value: any) {
    if (!Array.isArray(value)) return []
    return value.map(item => this.normalizeRecordItem(item))
  }

  private normalizeRecordItem(record: any) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return record
    return Object.entries(record).reduce((result, [key, value]) => {
      result[key] = this.normalizeRecordValue(value)
      return result
    }, {} as Record<string, any>)
  }

  private normalizeRecordValue(value: any): any {
    if (value === null || value === undefined) return value
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (Array.isArray(value)) return value.map(item => this.normalizeRecordValue(item))
    if (typeof value === 'object') {
      const importantObject = { id: value.id, name: value.name, uid: value.uid, alias: value.alias }
      const hasImportantKeys = Object.values(importantObject).some(item => item !== undefined && item !== null && item !== '')
      if (hasImportantKeys) {
        return Object.entries(importantObject).reduce((result, [key, item]) => {
          if (item !== undefined && item !== null && item !== '') result[key] = item
          return result
        }, {} as Record<string, any>)
      }
      return JSON.stringify(value)
    }
    return String(value)
  }

  private buildSearchFormFilterPlan(table: Table, input: Record<string, any>): SearchFormFilterPlan {
    const normalizedFilters = this.planSearchFormWhereCondition(table, input.filters)
    return {
      databaseFilters: normalizedFilters.databaseFilters,
      postFilters: normalizedFilters.postFilters,
    }
  }

  private planSearchFormWhereCondition(table: Table, condition: any): SearchFormWherePlan {
    if (!condition) {
      return { databaseFilters: null, postFilters: null }
    }

    if (Array.isArray(condition)) {
      if (this.searchFormWhereConditionNeedsPostFilter(table, condition)) {
        return {
          databaseFilters: null,
          postFilters: this.normalizeWhereCondition(table, condition),
        }
      }
      return {
        databaseFilters: this.normalizeWhereCondition(table, condition),
        postFilters: null,
      }
    }

    if (typeof condition !== 'object') {
      return { databaseFilters: null, postFilters: null }
    }

    const databaseResult: Record<string, any> = {}
    const postResult: Record<string, any> = {}

    for (const [key, value] of Object.entries(condition)) {
      if (key === '$and') {
        const items = Array.isArray(value) ? value : []
        const databaseItems = items
          .map(item => this.planSearchFormWhereCondition(table, item).databaseFilters)
          .filter(Boolean)
        const postItems = items
          .map(item => this.planSearchFormWhereCondition(table, item).postFilters)
          .filter(Boolean)
        if (databaseItems.length) {
          databaseResult.$and = databaseItems
        }
        if (postItems.length) {
          postResult.$and = postItems
        }
        continue
      }

      if (key === '$or' || key === '$not') {
        if (this.searchFormWhereConditionNeedsPostFilter(table, value)) {
          const normalized = this.normalizeWhereCondition(table, { [key]: value })
          if (normalized) {
            Object.assign(postResult, normalized)
          }
        } else {
          const normalized = this.normalizeWhereCondition(table, { [key]: value })
          if (normalized) {
            Object.assign(databaseResult, normalized)
          }
        }
        continue
      }

      const field = this.resolveField(table, key)
      const fieldKey = field?.uid || this.resolveFieldKey(table, key)
      if (!fieldKey) {
        continue
      }
      const normalizedValue = this.normalizeFieldFilterValue(value)
      if (normalizedValue === undefined) {
        continue
      }
      if (this.shouldPostFilterRelatedField(field, normalizedValue)) {
        postResult[fieldKey] = normalizedValue
        continue
      }
      databaseResult[fieldKey] = normalizedValue
    }

    return {
      databaseFilters: Object.keys(databaseResult).length ? databaseResult : null,
      postFilters: Object.keys(postResult).length ? postResult : null,
    }
  }

  private searchFormWhereConditionNeedsPostFilter(table: Table, condition: any): boolean {
    if (!condition) {
      return false
    }

    if (Array.isArray(condition)) {
      return condition.some(item => this.searchFormWhereConditionNeedsPostFilter(table, item))
    }

    if (typeof condition !== 'object') {
      return false
    }

    return Object.entries(condition).some(([key, value]) => {
      if (key === '$and' || key === '$or') {
        return Array.isArray(value) && value.some(item => this.searchFormWhereConditionNeedsPostFilter(table, item))
      }
      if (key === '$not') {
        return this.searchFormWhereConditionNeedsPostFilter(table, value)
      }

      const field = this.resolveField(table, key)
      if (!field) {
        return false
      }
      const normalizedValue = this.normalizeFieldFilterValue(value)
      return normalizedValue !== undefined && this.shouldPostFilterRelatedField(field, normalizedValue)
    })
  }

  private shouldPostFilterRelatedField(field: Field | null | undefined, normalizedValue: any) {
    if (!this.isRelatedField(field)) {
      return false
    }
    return this.hasTextLikeFilterValue(normalizedValue)
  }

  private hasTextLikeFilterValue(value: any): boolean {
    if (typeof value === 'string') {
      return Boolean(value.trim())
    }
    if (Array.isArray(value)) {
      return value.some(item => typeof item === 'string' && Boolean(String(item).trim()))
    }
    if (!value || typeof value !== 'object') {
      return false
    }

    if (typeof value.$regex === 'string' && value.$regex.trim()) {
      return true
    }
    if (typeof value.$ne === 'string' && value.$ne.trim()) {
      return true
    }

    return ['$in', '$nin'].some(operator =>
      Array.isArray(value[operator]) && value[operator].some((item: any) => typeof item === 'string' && Boolean(String(item).trim())),
    )
  }

  private normalizeWhereCondition(table: any, condition: any): any {
    if (!condition) return null
    if (Array.isArray(condition)) {
      const items = condition.map(item => this.normalizeWhereCondition(table, item)).filter(Boolean)
      return items.length ? items : null
    }
    if (typeof condition !== 'object') return null
    const result = Object.entries(condition).reduce((accumulator, [key, value]) => {
      if (key === '$and' || key === '$or') {
        const items = Array.isArray(value) ? value.map(item => this.normalizeWhereCondition(table, item)).filter(Boolean) : []
        if (items.length) accumulator[key] = items
        return accumulator
      }
      if (key === '$not') {
        const normalized = this.normalizeWhereCondition(table, value)
        if (normalized) accumulator[key] = normalized
        return accumulator
      }
      const field = this.resolveField(table, key)
      const fieldKey = field?.uid || this.resolveFieldKey(table, key)
      if (!fieldKey) return accumulator
      const normalizedValue = this.normalizeFieldFilterValue(value)
      if (normalizedValue === undefined) return accumulator
      accumulator[fieldKey] = normalizedValue
      return accumulator
    }, {} as Record<string, any>)
    return Object.keys(result).length ? result : null
  }

  private normalizeFieldFilterValue(value: any): any {
    if (value === undefined) return undefined
    if (value === null) return null
    if (Array.isArray(value)) return value.map(item => this.normalizeFieldFilterPrimitive(item))
    if (typeof value !== 'object') return this.normalizeFieldFilterPrimitive(value)

    const normalized: Record<string, any> = {}
    let equalityValue: any = undefined
    const unknownOperatorKeys = new Set<string>()

    for (const [rawKey, rawValue] of Object.entries(value)) {
      const normalizedKey = String(rawKey || '').trim().toLowerCase()
      const operator = this.normalizeFilterOperator(rawKey)
      if (!operator) {
        if (this.isFilterOperatorLikeKey(rawKey)) {
          unknownOperatorKeys.add(String(rawKey || '').trim())
        }
        continue
      }

      if (operator === '$eq') {
        equalityValue = this.normalizeFieldFilterPrimitive(rawValue, operator)
        continue
      }

      if (operator === '$regex') {
        let pattern = String(rawValue ?? '').trim()
        if (normalizedKey === 'startswith' || normalizedKey === '$startswith') {
          pattern = `^${this.escapeRegex(pattern)}`
        } else if (normalizedKey === 'endswith' || normalizedKey === '$endswith') {
          pattern = `${this.escapeRegex(pattern)}$`
        } else if (
          normalizedKey === '$like'
          || normalizedKey === 'like'
          || normalizedKey === 'contains'
          || normalizedKey === '$contains'
        ) {
          pattern = this.escapeRegex(pattern)
        }
        if (pattern) {
          normalized.$regex = pattern
        }
        continue
      }

      if (operator === '$in' || operator === '$nin') {
        const items = Array.isArray(rawValue) ? rawValue : [rawValue]
        normalized[operator] = items
          .map(item => this.normalizeFieldFilterPrimitive(item, operator))
          .filter(item => item !== undefined)
        continue
      }

      normalized[operator] = this.normalizeFieldFilterPrimitive(rawValue, operator)
    }

    if (!Object.keys(normalized).length) {
      if (equalityValue !== undefined) {
        return equalityValue
      }
      if (unknownOperatorKeys.size && Object.keys(value).every(key => this.isFilterOperatorLikeKey(key))) {
        throw new Error(`Unsupported filter operator: ${Array.from(unknownOperatorKeys).join(', ')}`)
      }
      return value
    }

    if (equalityValue !== undefined) {
      return equalityValue
    }

    return normalized
  }

  private escapeRegex(value: string) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private normalizeFieldFilterPrimitive(value: any, operator?: string) {
    if (value === undefined) return undefined
    if (value === null) return null
    if (typeof value === 'string') {
      const structuredFilterValue = this.tryParseStructuredFilterPrimitive(value)
      if (structuredFilterValue !== undefined) {
        return structuredFilterValue
      }
      const normalizedAbsoluteDateValue = this.normalizeAbsoluteDateFilterValue(value)
      if (normalizedAbsoluteDateValue) {
        return normalizedAbsoluteDateValue
      }
      return value.trim()
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value
    return value
  }

  private tryParseStructuredFilterPrimitive(value: string) {
    const text = String(value || '').trim()
    if (!text || (text[0] !== '{' && text[0] !== '[')) {
      return undefined
    }

    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      return undefined
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }

    const keys = Object.keys(parsed)
    if (!keys.length) {
      return undefined
    }

    const isStructuredFilterObject = keys.every(key =>
      key === '$and'
      || key === '$or'
      || key === '$not'
      || this.isFilterOperatorLikeKey(key),
    )
    if (!isStructuredFilterObject) {
      return undefined
    }

    return this.normalizeFieldFilterValue(parsed)
  }

  private normalizeAbsoluteDateFilterValue(value: string) {
    const text = String(value || '').trim()
    if (!text || !/[tz]|[+-]\d{2}:?\d{2}$/i.test(text)) {
      return ''
    }

    const timestamp = new Date(text).getTime()
    if (!Number.isFinite(timestamp)) {
      return ''
    }

    return this.formatFilterDateTime(new Date(timestamp))
  }

  private formatFilterDateTime(value: Date) {
    return [
      value.getFullYear(),
      this.padFilterNumber(value.getMonth() + 1),
      this.padFilterNumber(value.getDate()),
    ].join('-') + ` ${
      this.padFilterNumber(value.getHours())
    }:${
      this.padFilterNumber(value.getMinutes())
    }:${
      this.padFilterNumber(value.getSeconds())
    }`
  }

  private formatFilterDate(value: Date) {
    return [
      value.getFullYear(),
      this.padFilterNumber(value.getMonth() + 1),
      this.padFilterNumber(value.getDate()),
    ].join('-')
  }

  private padFilterNumber(value: number) {
    return String(Math.max(0, Math.trunc(value))).padStart(2, '0')
  }

  private normalizeFilterOperator(value: string) {
    const normalized = String(value || '').trim().toLowerCase()
    switch (normalized) {
      case '$eq':
      case 'eq':
      case 'equals':
      case 'is':
        return '$eq'
      case '$ne':
      case 'ne':
      case 'notequals':
      case 'not':
        return '$ne'
      case '$gt':
      case 'gt':
        return '$gt'
      case '$gte':
      case 'gte':
        return '$gte'
      case '$lt':
      case 'lt':
        return '$lt'
      case '$lte':
      case 'lte':
        return '$lte'
      case '$in':
      case 'in':
      case 'oneof':
      case 'anyof':
        return '$in'
      case '$nin':
      case 'nin':
      case 'notin':
        return '$nin'
      case '$like':
      case 'like':
      case '$contains':
      case 'contains':
        return '$regex'
      case '$startswith':
      case 'startswith':
        return '$regex'
      case '$endswith':
      case 'endswith':
        return '$regex'
      case '$regex':
      case 'regex':
        return '$regex'
      default:
        return ''
    }
  }

  private isFilterOperatorLikeKey(value: string) {
    const normalized = String(value || '').trim().toLowerCase()
    return new Set([
      '$eq', 'eq', 'equals', 'is',
      '$ne', 'ne', 'notequals', 'not',
      '$gt', 'gt',
      '$gte', 'gte',
      '$lt', 'lt',
      '$lte', 'lte',
      '$in', 'in', 'oneof', 'anyof',
      '$nin', 'nin', 'notin',
      '$like', 'like',
      '$contains', 'contains',
      '$startswith', 'startswith',
      '$endswith', 'endswith',
      '$regex', 'regex',
    ]).has(normalized)
  }

  private resolveField(table: any, key: string) {
    const normalizedKey = String(key || '').trim()
    if (!normalizedKey) return null
    const comparableKey = this.normalizeComparableText(normalizedKey)
    const fields = Array.isArray(table?.fields) ? table.fields : []
    const directMatch = fields.find(field =>
      field.uid === normalizedKey || this.normalizeComparableText(field.alias) === comparableKey,
    )
    if (directMatch) {
      return directMatch
    }

    const displayMatches = fields.filter((field: any) =>
      buildAiFieldLookupNames(String(field?.alias || field?.uid || '').trim(), pickAiNumericDisplayMeta(field))
        .some(item => this.normalizeComparableText(item) === comparableKey),
    )

    return displayMatches.length === 1
      ? displayMatches[0]
      : null
  }

  private resolveFieldKey(table: any, key: string) {
    const normalizedKey = String(key || '').trim()
    if (!normalizedKey) return ''
    return this.resolveField(table, normalizedKey)?.uid || normalizedKey
  }

  private buildSearchFormOrderBy(table: any, sortBy: any, sortOrder: any) {
    const fieldKey = this.resolveFieldKey(table, String(sortBy || '').trim())
    if (!fieldKey) return undefined
    return { [fieldKey]: sortOrder === 'asc' ? SortType.ASC : SortType.DESC }
  }

  private async loadRowsForSearchFormPostFilter(
    appId: string,
    tableId: string,
    options: {
      filters?: Record<string, any>
      orderBy?: Record<string, any>
      maxRows?: number
      formatData?: boolean
    },
  ) {
    const rows: Array<Record<string, any>> = []
    const pageSize = 100
    const maxRows = this.normalizeOptionalLimit(options.maxRows, 10000) || 5000
    const formatData = options.formatData !== false
    let page = 1
    let total = Number.POSITIVE_INFINITY

    while (rows.length < maxRows && rows.length < total) {
      const currentPageSize = Math.min(pageSize, maxRows - rows.length)
      const buckets = await this.readTableBucketsWithRetry(() => {
        return this.formDataService.getData(appId, [tableId], {
          filters: options.filters,
          orderBy: options.orderBy,
          pageNumber: page,
          pageSize: currentPageSize,
          stage: { $nin: [FormDataStage.DRAFT] },
          formatData,
          transformFormData: true,
          fillSubTable: true,
          transformRelated: true,
          transformRelatedResultObject: true,
        } as any, {
          enforceFieldReadAuth: true,
        })
      })

      const bucket = Array.isArray(buckets) ? buckets[0] : null
      const batch = Array.isArray(bucket?.rows) ? bucket.rows : []
      rows.push(...batch)

      const count = Number(bucket?.count)
      total = Number.isFinite(count) && count >= 0 ? count : rows.length

      if (!batch.length || batch.length < currentPageSize) {
        break
      }
      page += 1
    }

    return {
      rows: rows.slice(0, maxRows),
      total,
      truncated: total > maxRows,
    }
  }

  private paginateItems<T>(items: T[], page: number, pageSize: number) {
    const start = Math.max(page - 1, 0) * pageSize
    return items.slice(start, start + pageSize)
  }

  private matchesSearchFormPostFilters(table: Table, row: Record<string, any>, condition: any): boolean {
    if (!condition) {
      return true
    }

    if (Array.isArray(condition)) {
      return condition.every(item => this.matchesSearchFormPostFilters(table, row, item))
    }

    if (typeof condition !== 'object') {
      return true
    }

    for (const [key, value] of Object.entries(condition)) {
      if (key === '$and') {
        const items = Array.isArray(value) ? value : []
        if (!items.every(item => this.matchesSearchFormPostFilters(table, row, item))) {
          return false
        }
        continue
      }

      if (key === '$or') {
        const items = Array.isArray(value) ? value : []
        if (!items.some(item => this.matchesSearchFormPostFilters(table, row, item))) {
          return false
        }
        continue
      }

      if (key === '$not') {
        if (this.matchesSearchFormPostFilters(table, row, value)) {
          return false
        }
        continue
      }

      const field = this.resolveField(table, key)
      const rowValue = field ? this.getRowValue(row, field) : row?.[key]
      if (!this.matchesSearchFormFieldValue(rowValue, value)) {
        return false
      }
    }

    return true
  }

  private matchesSearchFormFieldValue(rowValue: any, expected: any): boolean {
    if (expected === undefined) {
      return true
    }
    if (expected === null) {
      return rowValue === null || rowValue === undefined
    }
    if (Array.isArray(expected)) {
      return expected.some(item => this.matchesSearchFormPrimitiveValue(rowValue, item))
    }
    if (typeof expected !== 'object') {
      return this.matchesSearchFormPrimitiveValue(rowValue, expected)
    }

    return Object.entries(expected).every(([operator, value]) => this.matchesSearchFormOperator(rowValue, operator, value))
  }

  private matchesSearchFormOperator(rowValue: any, operator: string, expected: any): boolean {
    switch (operator) {
      case '$regex':
        return this.matchesSearchFormRegex(rowValue, expected)
      case '$in':
        return Array.isArray(expected) && expected.some(item => this.matchesSearchFormPrimitiveValue(rowValue, item))
      case '$nin':
        return Array.isArray(expected) && !expected.some(item => this.matchesSearchFormPrimitiveValue(rowValue, item))
      case '$ne':
        return !this.matchesSearchFormPrimitiveValue(rowValue, expected)
      case '$gt':
      case '$gte':
      case '$lt':
      case '$lte':
        return this.matchesSearchFormComparableValue(rowValue, operator, expected)
      default:
        return this.matchesSearchFormPrimitiveValue(rowValue, expected)
    }
  }

  private matchesSearchFormPrimitiveValue(rowValue: any, expected: any): boolean {
    if (expected === null) {
      return rowValue === null || rowValue === undefined
    }

    const comparableValues = this.collectSearchFormComparableValues(rowValue)
    if (typeof expected === 'string') {
      const target = expected.trim()
      return comparableValues.some(item => String(item).trim() === target)
    }
    return comparableValues.some(item => item === expected)
  }

  private matchesSearchFormRegex(rowValue: any, expected: any) {
    const pattern = typeof expected === 'string' ? expected : ''
    if (!pattern) {
      return false
    }

    try {
      const regex = new RegExp(pattern)
      return this.collectSearchFormTexts(rowValue).some(item => regex.test(item))
    } catch (error) {
      return this.collectSearchFormTexts(rowValue).some(item => item.includes(pattern))
    }
  }

  private matchesSearchFormComparableValue(rowValue: any, operator: '$gt' | '$gte' | '$lt' | '$lte', expected: any) {
    const right = this.normalizeSearchFormComparableScalar(expected)
    if (right === null) {
      return false
    }

    return this.collectSearchFormComparableValues(rowValue).some(item => {
      const left = this.normalizeSearchFormComparableScalar(item)
      if (left === null) {
        return false
      }
      if (typeof left === 'number' && typeof right === 'number') {
        if (operator === '$gt') return left > right
        if (operator === '$gte') return left >= right
        if (operator === '$lt') return left < right
        return left <= right
      }
      const leftText = String(left)
      const rightText = String(right)
      if (operator === '$gt') return leftText > rightText
      if (operator === '$gte') return leftText >= rightText
      if (operator === '$lt') return leftText < rightText
      return leftText <= rightText
    })
  }

  private normalizeSearchFormComparableScalar(value: any) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'boolean') {
      return Number(value)
    }
    if (typeof value !== 'string') {
      return null
    }

    const text = value.trim()
    if (!text) {
      return null
    }

    if (/^-?\d+(\.\d+)?$/.test(text)) {
      const numeric = Number(text)
      if (Number.isFinite(numeric)) {
        return numeric
      }
    }

    const timestamp = new Date(text).getTime()
    if (Number.isFinite(timestamp) && /[-/:T]/.test(text)) {
      return timestamp
    }

    return text
  }

  private collectSearchFormComparableValues(value: any, depth = 0, results: any[] = [], seen = new Set<any>()) {
    if (results.length >= 80 || value === undefined || value === null) {
      return results
    }

    if (typeof value === 'string') {
      const text = value.trim()
      if (text) {
        results.push(text)
      }
      return results
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      results.push(value)
      return results
    }

    if (Array.isArray(value)) {
      value.slice(0, 30).forEach(item => this.collectSearchFormComparableValues(item, depth + 1, results, seen))
      return results
    }

    if (typeof value !== 'object' || depth >= 3 || seen.has(value)) {
      return results
    }

    seen.add(value)
    const preferredKeys = ['title', 'name', 'alias', 'label', 'id', 'uid', 'uuid']
    preferredKeys.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        this.collectSearchFormComparableValues(value[key], depth + 1, results, seen)
      }
    })
    Object.values(value).slice(0, 30).forEach(item => this.collectSearchFormComparableValues(item, depth + 1, results, seen))
    return results
  }

  private collectSearchFormTexts(value: any) {
    return Array.from(new Set(
      this.collectSearchFormComparableValues(value)
        .map(item => String(item).trim())
        .filter(Boolean),
    ))
  }

  private buildSearchFormSummary(options: {
    appName: string
    tableName: string
    hasFilters?: boolean
    itemCount: number
    total: number
    aggregation?: RecordAggregationResult | null
  }) {
    const prefix = `在应用“${options.appName}”的数据源“${options.tableName}”中`
    if (options.aggregation?.kind === 'summary_only') {
      return options.hasFilters
        ? `${prefix}，当前筛选条件下共匹配 ${options.total} 条。`
        : `${prefix}，当前共匹配 ${options.total} 条记录。`
    }
    const aggregationSummary = this.buildSearchFormAggregationSummary(options.aggregation)
    if (options.aggregation?.kind === 'time_buckets') {
      const summary = options.hasFilters
        ? `${prefix}，当前筛选条件下共匹配 ${options.total} 条记录。`
        : `${prefix}，当前共匹配 ${options.total} 条记录。`
      return [summary, aggregationSummary].filter(Boolean).join(' ')
    }
    if (options.itemCount <= 0) {
      const summary = options.hasFilters ? `${prefix}，当前筛选条件下没有找到记录。` : `${prefix}，当前没有查到记录。`
      return [summary, aggregationSummary].filter(Boolean).join(' ')
    }
    const summary = options.hasFilters
      ? `${prefix}，当前筛选条件下返回 ${options.itemCount} 条记录，共匹配 ${options.total} 条。`
      : `${prefix}，当前返回 ${options.itemCount} 条记录，共匹配 ${options.total} 条。`
    return [summary, aggregationSummary].filter(Boolean).join(' ')
  }

  private buildSearchFormAggregationSummary(aggregation?: RecordAggregationResult | null) {
    if (!aggregation) {
      return ''
    }

    if (aggregation.kind === 'time_buckets') {
      const fieldName = aggregation.fieldName || '目标时间字段'
      const granularityLabel = this.describeTimeGranularity(aggregation.timeGranularity)
      if (!aggregation.totalBucketCount) {
        return `对“${fieldName}”做${granularityLabel}分桶后，没有可用的时间桶。`
      }

      const preview = aggregation.buckets
        .map(item => `${item.value}(${item.count})`)
        .join('、')

      return [
        `对“${fieldName}”做${granularityLabel}分桶后，共得 ${aggregation.totalBucketCount} 个时间桶。`,
        preview ? `前几项包括：${preview}。` : '',
      ].filter(Boolean).join('')
    }

    if (aggregation.kind !== 'grouped') {
      return ''
    }

    const fieldName = aggregation.fieldName || '目标字段'
    if (!aggregation.totalGroupCount) {
      return `按“${fieldName}”分组后，没有读到非空分组值。`
    }

    if (!aggregation.filteredGroupCount) {
      return `按“${fieldName}”分组后，共得到 ${aggregation.totalGroupCount} 个分组，但没有分组达到最小出现次数 ${aggregation.minCount} 次。`
    }

    const topPreview = aggregation.groups
      .map(item => `${item.value}(${item.count})`)
      .join('、')

    if (aggregation.minCount <= 1) {
      const suffix = topPreview ? `前几项包括：${topPreview}。` : ''
      return `按“${fieldName}”分组后，共得到 ${aggregation.totalGroupCount} 个分组。${suffix}`
    }

    const suffix = topPreview ? `前几项包括：${topPreview}。` : ''
    return `按“${fieldName}”分组后，共得到 ${aggregation.totalGroupCount} 个分组，其中 ${aggregation.filteredGroupCount} 个分组的出现次数达到 ${aggregation.minCount} 次及以上。${suffix}`
  }

  private buildSearchRecordItemsText(
    table: Table,
    items: Array<Record<string, any>>,
    aggregation?: RecordAggregationResult | null,
    mode: 'records' | 'aggregate' = 'records',
  ) {
    if (mode === 'aggregate') {
      return this.buildAggregationItemsText(aggregation)
    }

    const sections = [
      this.buildAggregationItemsText(aggregation),
      items.length ? `记录样本:\n${this.buildRecordTableText(table, items)}` : '',
    ].filter(Boolean)

    return sections.join('\n\n')
  }

  private async buildRecordAggregation(
    appId: string,
    table: Table,
    filters: Record<string, any> | null,
    context: AiToolExecutionContext,
    input: Record<string, any>,
  ): Promise<RecordAggregationResult | null> {
    if (this.resolveTimeBucketAggregationRequest(table, input)) {
      throw new Error(AI_LOCAL_TOOL_COPY.timeGranularityBucketOnly)
    }
    const groupField = this.resolveAggregationGroupField(table, input.groupBy)
    if (!groupField) {
      if (this.shouldUseTotalOnlyAggregation(input)) {
        return this.buildSummaryOnlyAggregation()
      }
      return null
    }

    const minCount = this.resolveRecordAggregationMinCount(input.minCount)
    const scopedFilters = this.mergeWhereConditions(
      filters,
      this.buildNonDraftWhereCondition(table),
    )
    const results = await this.readTableBucketsWithRetry(() => {
      return this.formDataService.autoComputeDistinct(
        appId,
        table.uid,
        groupField.uid,
        {
          filters: scopedFilters ? { [table.uid]: [scopedFilters] } : undefined,
        } as any,
      )
    })

    const aggregationItems = this.mergeAggregationCountItems(
      (Array.isArray(results) ? results : [])
        .map(item => ({
          value: this.normalizeRecordAggregationValue(item?.value),
          count: Number(item?.count || 0),
        }))
        .filter(item => item.count > 0),
    )

    const groupedItems = (await this.hydrateRecordAggregationItems(
      appId,
      table,
      groupField,
      aggregationItems,
    ))
      .filter(item => item.count > 0)
      .sort((left, right) =>
        right.count - left.count
        || String(left.value).localeCompare(String(right.value), 'zh-CN'),
      )

    const filteredItems = groupedItems
      .filter(item => item.count >= minCount)
    const returnedGroups = filteredItems

    if (!groupedItems.length) {
      return {
        kind: 'grouped',
        fieldId: groupField.uid,
        fieldName: groupField.alias || groupField.uid,
        minCount,
        totalGroupCount: 0,
        filteredGroupCount: 0,
        returnedGroupCount: 0,
        groups: [],
        allGroups: [],
        itemsText: `按“${groupField.alias || groupField.uid}”分组后，没有得到可统计的值。`,
      }
    }

    if (!returnedGroups.length) {
      return {
        kind: 'grouped',
        fieldId: groupField.uid,
        fieldName: groupField.alias || groupField.uid,
        minCount,
        totalGroupCount: groupedItems.length,
        filteredGroupCount: filteredItems.length,
        returnedGroupCount: 0,
        groups: [],
        allGroups: groupedItems,
        itemsText: `按“${groupField.alias || groupField.uid}”分组后，共得到 ${groupedItems.length} 个分组，但没有分组达到最小出现次数 ${minCount} 次。`,
      }
    }

    return {
      kind: 'grouped',
      fieldId: groupField.uid,
      fieldName: groupField.alias || groupField.uid,
      minCount,
      totalGroupCount: groupedItems.length,
      filteredGroupCount: filteredItems.length,
      returnedGroupCount: returnedGroups.length,
      groups: returnedGroups,
      allGroups: groupedItems,
      itemsText: this.buildValueCountTableText(returnedGroups, groupField.alias || groupField.uid),
    }
  }

  private async hydrateRecordAggregationItems(
    appId: string,
    table: Table,
    field: Field,
    items: Array<{ value: string; count: number }>,
  ) {
    if (!items.length || !this.isRelatedField(field)) {
      return items
    }

    const displayMap = await this.loadRelatedAggregationDisplayMap(appId, table, field, items.map(item => item.value))
    if (!displayMap.size) {
      return items
    }

    const merged = new Map<string, number>()
    items.forEach(item => {
      const displayValue = displayMap.get(item.value) || item.value
      if (!displayValue) {
        return
      }
      merged.set(displayValue, (merged.get(displayValue) || 0) + item.count)
    })

    return Array.from(merged.entries()).map(([value, count]) => ({ value, count }))
  }

  private async loadRelatedAggregationDisplayMap(
    appId: string,
    table: Table,
    field: Field,
    values: string[],
  ) {
    const relatedTableId = this.getRelatedTableId(field)
    if (!relatedTableId) {
      return new Map<string, string>()
    }

    const relatedValues = Array.from(new Set(
      (Array.isArray(values) ? values : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    ))
    if (!relatedValues.length) {
      return new Map<string, string>()
    }

    const body = await this.projectService.getNocodeBody(appId)
    const relatedTable = body?.formData?.tables?.find(item => item.uid === relatedTableId)
    if (!relatedTable) {
      return new Map<string, string>()
    }

    const uuidField = relatedTable.fields.find(item => item?.meta?.name === SystemField.UUID)
    if (!uuidField?.uid) {
      return new Map<string, string>()
    }

    const displayField = this.resolveAggregationDisplayField(relatedTable)
    const buckets = await this.formDataService.getData(appId, [relatedTableId], {
      filters: {
        [relatedTableId]: [
          {
            [uuidField.uid]: {
              $in: relatedValues,
            },
          },
        ],
      },
      pageNumber: 1,
      pageSize: Math.min(Math.max(relatedValues.length, 1), 5000),
      stage: { $nin: [FormDataStage.DRAFT] },
      formatData: true,
      transformFormData: true,
      fillSubTable: true,
      transformRelated: true,
      transformRelatedResultObject: true,
    } as any, {
      enforceFieldReadAuth: true,
    })

    const bucket = Array.isArray(buckets) ? buckets[0] : null
    const rows = Array.isArray(bucket?.rows) ? bucket.rows : []
    return rows.reduce((result, row) => {
      const key = this.normalizeRecordAggregationValue(this.getRowValue(row, uuidField))
      const displayValue = this.normalizeRecordAggregationValue(
        displayField ? this.getRowValue(row, displayField) : this.getRowValue(row, uuidField),
      )
      if (key && displayValue) {
        result.set(key, displayValue)
      }
      return result
    }, new Map<string, string>())
  }

  private resolveAggregationDisplayField(table: Table) {
    const titleField = table.fields.find(item => item?.meta?.name === SystemField.DATA_TITLE)
    if (titleField) {
      return titleField
    }

    return this.getNonSystemFields(table).find(item => this.isTextLikeField(item) && !this.isRelatedField(item))
      || this.getNonSystemFields(table)[0]
      || null
  }

  private buildRecordAggregationFromRows(
    table: Table,
    rows: Array<Record<string, any>>,
    context: AiToolExecutionContext,
    input: Record<string, any>,
  ): RecordAggregationResult | null {
    const timeBucketRequest = this.resolveTimeBucketAggregationRequest(table, input)
    if (timeBucketRequest) {
      return this.buildTimeBucketAggregationFromRows(rows, timeBucketRequest.field, timeBucketRequest.timeGranularity)
    }

    const groupField = this.resolveAggregationGroupField(table, input.groupBy)
    if (!groupField) {
      if (this.shouldUseTotalOnlyAggregation(input)) {
        return this.buildSummaryOnlyAggregation()
      }
      return null
    }

    const minCount = this.resolveRecordAggregationMinCount(input.minCount)
    const counts = new Map<string, number>()

    rows.forEach(row => {
      this.extractAggregationValuesFromRow(row, groupField).forEach(value => {
        counts.set(value, (counts.get(value) || 0) + 1)
      })
    })

    const groupedItems = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .filter(item => item.count > 0)
      .sort((left, right) =>
        right.count - left.count
        || String(left.value).localeCompare(String(right.value), 'zh-CN'),
      )

    const filteredItems = groupedItems
      .filter(item => item.count >= minCount)
    const returnedGroups = filteredItems

    if (!groupedItems.length) {
      return {
        kind: 'grouped',
        fieldId: groupField.uid,
        fieldName: groupField.alias || groupField.uid,
        minCount,
        totalGroupCount: 0,
        filteredGroupCount: 0,
        returnedGroupCount: 0,
        groups: [],
        allGroups: [],
        itemsText: `按“${groupField.alias || groupField.uid}”分组后，没有得到可统计的值。`,
      }
    }

    if (!returnedGroups.length) {
      return {
        kind: 'grouped',
        fieldId: groupField.uid,
        fieldName: groupField.alias || groupField.uid,
        minCount,
        totalGroupCount: groupedItems.length,
        filteredGroupCount: filteredItems.length,
        returnedGroupCount: 0,
        groups: [],
        allGroups: groupedItems,
        itemsText: `按“${groupField.alias || groupField.uid}”分组后，共得到 ${groupedItems.length} 个分组，但没有分组达到最小出现次数 ${minCount} 次。`,
      }
    }

    return {
      kind: 'grouped',
      fieldId: groupField.uid,
      fieldName: groupField.alias || groupField.uid,
      minCount,
      totalGroupCount: groupedItems.length,
      filteredGroupCount: filteredItems.length,
      returnedGroupCount: returnedGroups.length,
      groups: returnedGroups,
      allGroups: groupedItems,
      itemsText: this.buildValueCountTableText(returnedGroups, groupField.alias || groupField.uid),
    }
  }

  private shouldUseTotalOnlyAggregation(input: Record<string, any>) {
    return String(input.mode || '').trim() === 'aggregate'
      && !String(input.groupBy || '').trim()
  }

  private buildSummaryOnlyAggregation(): RecordAggregationResult {
    return {
      kind: 'summary_only',
      itemsText: '',
    }
  }

  private buildTimeBucketAggregationFromRows(
    rows: Array<Record<string, any>>,
    field: Field,
    timeGranularity: TimeGranularity,
  ): RecordAggregationResult {
    const bucketCounts = new Map<string, { label: string; count: number; startedAt: number }>()

    rows.forEach(row => {
      this.extractTimeBucketEntriesFromRow(row, field, timeGranularity).forEach(bucket => {
        const current = bucketCounts.get(bucket.key)
        if (current) {
          current.count += 1
          return
        }
        bucketCounts.set(bucket.key, {
          label: bucket.label,
          count: 1,
          startedAt: bucket.startedAt,
        })
      })
    })

    const buckets = Array.from(bucketCounts.values())
      .sort((left, right) => left.startedAt - right.startedAt)
      .map(item => ({
        value: item.label,
        count: item.count,
      }))

    const fieldName = field.alias || field.uid
    if (!buckets.length) {
      return {
        kind: 'time_buckets',
        fieldId: field.uid,
        fieldName,
        timeGranularity,
        totalBucketCount: 0,
        returnedBucketCount: 0,
        buckets: [],
        itemsText: rows.length
          ? `字段“${fieldName}”没有可用于${this.describeTimeGranularity(timeGranularity)}分桶的时间值。`
          : '',
      }
    }

    return {
      kind: 'time_buckets',
      fieldId: field.uid,
      fieldName,
      timeGranularity,
      totalBucketCount: buckets.length,
      returnedBucketCount: buckets.length,
      buckets,
      itemsText: this.buildValueCountTableText(
        buckets,
        `${fieldName}${this.describeTimeGranularity(timeGranularity)}）`,
      ),
    }
  }

  private extractTimeBucketEntriesFromRow(
    row: Record<string, any>,
    field: Field,
    timeGranularity: TimeGranularity,
  ) {
    const rawValue = this.getRowValue(row, field)
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    const buckets = new Map<string, { key: string; label: string; startedAt: number }>()

    values.forEach(value => {
      const parsed = this.parseRecordDateValue(value)
      if (!parsed) {
        return
      }
      const bucketStart = this.startOfTimeBucket(parsed, timeGranularity)
      const startedAt = bucketStart.valueOf()
      const key = String(startedAt)
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          label: this.formatTimeBucketLabel(bucketStart, timeGranularity),
          startedAt,
        })
      }
    })

    return Array.from(buckets.values())
  }

  private extractAggregationValuesFromRow(row: Record<string, any>, field: Field) {
    const rawValue = this.getRowValue(row, field)
    if (Array.isArray(rawValue)) {
      return Array.from(new Set(
        rawValue.map(item => this.normalizeRecordAggregationValue(item)),
      ))
    }

    const value = this.normalizeRecordAggregationValue(rawValue)
    return [value]
  }

  private resolveAggregationGroupField(table: Table, explicitGroupBy: any) {
    const groupBy = String(explicitGroupBy || '').trim()
    if (!groupBy) {
      return null
    }

    return this.assertAiFieldReadable(table, this.resolveField(table, groupBy), groupBy)
  }

  private resolveTimeBucketAggregationRequest(table: Table, input: Record<string, any>) {
    const timeGranularity = this.normalizeTimeGranularity(input.timeGranularity)
    if (!timeGranularity) {
      return null
    }

    const mode = String(input.mode || '').trim().toLowerCase()
    if (mode && mode !== 'aggregate') {
      throw new Error(AI_LOCAL_TOOL_COPY.timeGranularityAggregateOnly)
    }

    const groupBy = String(input.groupBy || '').trim()
    if (!groupBy) {
      throw new Error('使用 timeGranularity 时必须显式传入 groupBy，且 groupBy 必须是时间字段。')
    }

    const groupField = this.resolveAggregationGroupField(table, groupBy)
    if (!this.isTimeAggregationField(groupField)) {
      throw new Error(`字段“${groupField.alias || groupField.uid}”不是时间字段，不能与 timeGranularity 一起使用。`)
    }

    return {
      field: groupField,
      timeGranularity,
    }
  }

  private resolveRecordAggregationMinCount(value: any) {
    const explicitValue = this.normalizeOptionalLimit(value, 1000)
    if (explicitValue) {
      return explicitValue
    }

    return 1
  }

  private buildNonDraftWhereCondition(table: Table) {
    const dataStageField = Array.isArray(table?.fields)
      ? table.fields.find(field => field?.meta?.name === SystemField.DATA_STAGE)
      : null

    if (!dataStageField?.uid) {
      return null
    }

    return {
      [dataStageField.uid]: {
        $ne: FormDataStage.DRAFT,
      },
    }
  }

  private mergeWhereConditions(...conditions: Array<Record<string, any> | null | undefined>) {
    const items = conditions.filter(Boolean)
    if (!items.length) {
      return null
    }
    if (items.length === 1) {
      return items[0]
    }
    return {
      $and: items,
    }
  }

  private normalizeRecordAggregationValue(value: any) {
    if (value === null) {
      return 'null'
    }
    if (value === undefined) {
      return 'undefined'
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim()
    }
    if (Array.isArray(value)) {
      return value
        .map(item => this.normalizeRecordAggregationValue(item))
        .filter(Boolean)
        .join('、')
    }
    if (typeof value === 'object') {
      const preferred = String(value.name || value.alias || value.title || value.label || value.id || value.uid || value.uuid || '').trim()
      if (preferred) {
        return preferred
      }
      return this.collectSearchFormTexts(value)[0] || ''
    }
    return String(value).trim()
  }

  private mergeAggregationCountItems(items: Array<{ value: string; count: number }>) {
    const merged = new Map<string, number>()
    ;(Array.isArray(items) ? items : []).forEach(item => {
      const value = String(item?.value ?? '')
      const count = Number(item?.count || 0)
      if (!count) {
        return
      }
      merged.set(value, (merged.get(value) || 0) + count)
    })

    return Array.from(merged.entries()).map(([value, count]) => ({ value, count }))
  }

  private tokenizeSearchKeywords(value: string) {
    return Array.from(new Set(
      String(value || '')
        .split(/[\s,，。；;、|/]+/)
        .map(item => item.trim())
        .filter(Boolean),
    )).slice(0, 8)
  }

  private normalizePageSize(value: number, fallback: number, max: number) {
    const normalized = Number(value || fallback)
    if (!Number.isFinite(normalized) || normalized <= 0) return fallback
    return Math.min(Math.round(normalized), max)
  }

  private normalizeOptionalLimit(value: any, max: number) {
    if (value === undefined || value === null || value === '') return null
    const normalized = Number(value)
    if (!Number.isFinite(normalized) || normalized <= 0) return null
    return Math.min(Math.round(normalized), max)
  }

  private normalizeListAppsSortBy(value: any): 'createTime' | 'name' | 'sort' {
    if (value === 'name' || value === 'sort') return value
    return 'createTime'
  }

  private normalizeSortOrder(value: any): 'asc' | 'desc' {
    return value === 'asc' ? 'asc' : 'desc'
  }

  private compareApps(left: { name?: string; createTime?: any; sort?: any }, right: { name?: string; createTime?: any; sort?: any }, sortBy: 'createTime' | 'name' | 'sort', sortOrder: 'asc' | 'desc') {
    const direction = sortOrder === 'asc' ? 1 : -1
    if (sortBy === 'name') {
      const compared = String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN')
      if (compared !== 0) return compared * direction
    } else if (sortBy === 'sort') {
      const compared = this.compareNumbers(left.sort, right.sort)
      if (compared !== 0) return compared * direction
    } else {
      const compared = this.compareDates(left.createTime, right.createTime)
      if (compared !== 0) return compared * direction
    }
    return String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN')
  }

  private compareNumbers(left: any, right: any) {
    const leftValue = Number(left)
    const rightValue = Number(right)
    const safeLeft = Number.isFinite(leftValue) ? leftValue : 0
    const safeRight = Number.isFinite(rightValue) ? rightValue : 0
    return safeLeft - safeRight
  }

  private compareDates(left: any, right: any) {
    return this.normalizeTimestamp(left) - this.normalizeTimestamp(right)
  }

  private normalizeTimestamp(value: any) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? timestamp : 0
  }

  private getNonSystemFields(table: Table | null | undefined) {
    return Array.isArray(table?.fields)
      ? table.fields.filter((field): field is Field => Boolean(field) && !this.isSystemFieldSafe(field))
      : []
  }

  private getRelatedTableId(field: Field | null | undefined) {
    const relatedTableUID = field?.meta?.extra?.relatedTableUID
    return Array.isArray(relatedTableUID) ? String(relatedTableUID[1] || '').trim() : ''
  }

  private isRelatedField(field: Field | null | undefined, relatedTableId?: string) {
    const targetTableId = this.getRelatedTableId(field)
    if (!targetTableId) {
      return false
    }
    if (!relatedTableId) {
      return true
    }
    return targetTableId === relatedTableId
  }

  private isTextLikeField(field: Field | null | undefined) {
    const type = String(field?.type || '').trim().toLowerCase()
    return type === 'string' || type === 'text'
  }

  private scoreKeywords(value: any, keywords: string[]) {
    const normalizedValue = this.normalizeComparableText(value)
    if (!normalizedValue) {
      return 0
    }
    return keywords.reduce((score, keyword) => {
      const normalizedKeyword = this.normalizeComparableText(keyword)
      if (!normalizedKeyword) {
        return score
      }
      if (normalizedValue === normalizedKeyword) {
        return score + 3
      }
      if (normalizedValue.includes(normalizedKeyword)) {
        return score + 2
      }
      return score
    }, 0)
  }

  private buildAggregationItemsText(aggregation?: RecordAggregationResult | null) {
    if (!aggregation || aggregation.kind === 'summary_only') {
      return ''
    }

    if (aggregation.kind === 'time_buckets') {
      const headerLine = `分组字段 = ${aggregation.fieldName}`
      if (!aggregation.buckets.length) {
        return aggregation.itemsText ? `时间趋势统计:\n${headerLine}\n${aggregation.itemsText}` : ''
      }
      return `时间趋势统计:\n${headerLine}\n${aggregation.itemsText}`
    }

    const headerLine = `分组字段 = ${aggregation.fieldName}`
    if (!aggregation.groups.length) {
      return aggregation.itemsText ? `分组统计:\n${headerLine}\n${aggregation.itemsText}` : ''
    }

    return `分组统计:\n${headerLine}\n${aggregation.itemsText}`
  }

  private buildValueCountTableText(items: Array<{ value: string; count: number }>, valueLabel = '值') {
    if (!items.length) {
      return ''
    }

    const lines = [
      `| ${this.escapeMarkdownTableCell(valueLabel)} | 计数 |`,
      '| --- | ---: |',
      ...items.map(item =>
        `| ${this.escapeMarkdownTableCell(this.formatAggregateDisplayValue(item.value))} | ${item.count} |`,
      ),
    ]

    return lines.join('\n')
  }

  private buildRecordTableText(table: Table, items: Array<Record<string, any>>) {
    const columns = this.resolveRecordPreviewColumns(table, items)
    if (!columns.length) {
      return ''
    }

    const lines = [
      `| # | ${columns.map(item => this.escapeMarkdownTableCell(item.label)).join(' | ')} |`,
      `| ---: | ${columns.map(() => '---').join(' | ')} |`,
      ...items.map((item, index) =>
        `| ${index + 1} | ${columns.map(column =>
          this.escapeMarkdownTableCell(this.stringifyRecordPreviewValue(item?.[column.key]))
        ).join(' | ')} |`,
      ),
    ]

    return lines.join('\n')
  }

  private extractRecordFieldNames(table: Table, items: Array<Record<string, any>>) {
    const fieldNames = new Set<string>()
    for (const item of this.resolveRecordPreviewColumns(table, items)) {
      fieldNames.add(item.label)
    }
    return Array.from(fieldNames)
  }

  private resolveRecordPreviewColumns(table: Table, items: Array<Record<string, any>>) {
    const rows = Array.isArray(items) ? items : []
    if (!rows.length) {
      return [] as Array<{ key: string; label: string }>
    }

    const columns: Array<{ key: string; label: string }> = []
    const seen = new Set<string>()
    this.getNonSystemFields(table).forEach(field => {
      if (!rows.some(item => Object.prototype.hasOwnProperty.call(item || {}, field.uid))) {
        return
      }
      columns.push({
        key: field.uid,
        label: field.alias || field.uid,
      })
      seen.add(field.uid)
    })

    const extraKeys = Array.from(new Set(
      rows.flatMap(item => Object.keys(item || {})),
    )).filter(key =>
      !seen.has(key)
      && !/_entity$/i.test(key)
      && !this.isSystemFieldKey(key),
    )

    extraKeys.forEach(key => {
      columns.push({
        key,
        label: key,
      })
    })

    return columns
  }

  private formatAggregateDisplayValue(value: string) {
    return value === '' ? '""' : value
  }

  private isSystemFieldSafe(field: Field | null | undefined) {
    return Boolean(field?.meta?.name) && isSystemField(field as Field)
  }

  private isSystemFieldKey(value: string) {
    const normalized = String(value || '').trim()
    if (!normalized) {
      return false
    }
    return Object.values(SystemField).includes(normalized as SystemField)
  }

  private escapeMarkdownTableCell(value: string) {
    // AI markdown rendering disables raw HTML, so multiline cell values
    // must be flattened instead of emitting literal <br/> text.
    const normalized = String(value || '')
      .replace(/\s*(?:\r?\n)+\s*/g, ' / ')
      .replace(/\|/g, '\\|')
      .trim()

    return normalized || ' '
  }

  private normalizeStringArray(value: any) {
    return Array.isArray(value)
      ? value.map(item => String(item || '').trim()).filter(Boolean)
      : []
  }

  private normalizeSearchKeywords(value: any) {
    const rawKeywords = this.normalizeStringArray(value)
    const splitKeywords = rawKeywords.flatMap(item => this.tokenizeSearchKeywords(item))
    return this.uniqueStrings([
      ...rawKeywords,
      ...splitKeywords,
    ]).slice(0, 24)
  }

  private uniqueStrings(values: string[]) {
    return [...new Set(
      (Array.isArray(values) ? values : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )]
  }

  private normalizeReadIntent(value: any): 'records' | 'unknown' {
    const normalized = String(value || '').trim().toLowerCase()
    if (normalized === 'records') {
      return 'records'
    }
    return 'unknown'
  }

  private normalizeReadMode(value: any): 'records' | 'aggregate' {
    const normalized = String(value || '').trim().toLowerCase()
    if (normalized === 'aggregate') {
      return 'aggregate'
    }
    if (normalized === 'records') {
      return 'records'
    }
    throw new Error('read_app_data 必须显式传入合法的 mode。可选值为 records、aggregate。')
  }

  private scoreSearchTextMatch(value: any, keywords: string[]) {
    const normalizedValue = this.normalizeComparableText(value)
    if (!normalizedValue || !keywords.length) {
      return 0
    }

    return keywords.reduce((score, keyword) => {
      const normalizedKeyword = this.normalizeComparableText(keyword)
      if (!normalizedKeyword || normalizedKeyword.length < 2) {
        return score
      }

      const lengthBonus = Math.min(6, normalizedKeyword.length)
      if (normalizedValue === normalizedKeyword) {
        return score + 18 + lengthBonus * 2
      }
      if (normalizedValue.startsWith(normalizedKeyword) || normalizedValue.endsWith(normalizedKeyword)) {
        return score + 12 + lengthBonus
      }
      if (normalizedValue.includes(normalizedKeyword)) {
        return score + 8 + lengthBonus
      }
      return score
    }, 0)
  }

  private scoreSearchValues(values: any[], keywords: string[]) {
    const normalizedValues = this.filterLowSignalSearchValues(values)
    const normalizedKeywords = this.uniqueStrings(
      (Array.isArray(keywords) ? keywords : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )

    if (!normalizedValues.length || !normalizedKeywords.length) {
      return 0
    }

    return normalizedKeywords.reduce((score, keyword) => {
      const normalizedKeyword = this.normalizeComparableText(keyword)
      if (!normalizedKeyword || normalizedKeyword.length < 2) {
        return score
      }

      const bestSignal = normalizedValues.reduce((maxScore, value) => {
        const nextScore = this.scoreSearchTextMatch(value, [keyword])
        return nextScore > maxScore ? nextScore : maxScore
      }, 0)

      return score + bestSignal
    }, 0)
  }

  private scoreSearchBestRouteCoverage(recordRoutes: any[], keywords: string[]) {
    if (!Array.isArray(recordRoutes) || !recordRoutes.length || !Array.isArray(keywords) || !keywords.length) {
      return 0
    }

    const normalizedKeywords = this.uniqueStrings(keywords)

    return recordRoutes.reduce((bestScore, route) => {
      const facetMatchSets = [
        this.collectSearchMatchedKeywords(
          [
            route?.sourceName,
            ...(Array.isArray(route?.keywords) ? route.keywords : []),
          ],
          normalizedKeywords,
        ),
        this.collectSearchMatchedKeywords(route?.entityFields, normalizedKeywords),
        this.collectSearchMatchedKeywords(route?.timeFields, normalizedKeywords),
        this.collectSearchMatchedKeywords(route?.metricFields, normalizedKeywords),
      ]

      const matchedFacetCount = facetMatchSets.filter(item => item.size > 0).length
      const matchedKeywordCount = new Set(
        facetMatchSets.flatMap(item => [...item]),
      ).size
      const routeScore = matchedKeywordCount * 6 + matchedFacetCount * 4

      return routeScore > bestScore ? routeScore : bestScore
    }, 0)
  }

  private resolveSearchQueryStructureSignals(
    keywords: string[],
    intent: 'records' | 'unknown',
  ): SearchQueryStructureSignals {
    if (intent !== 'records') {
      return {
        queryShape: 'unknown',
        hasTimeSignal: false,
        hasMetricSignal: false,
        hasDimensionSignal: false,
        timeKeywords: [],
        metricKeywords: [],
        dimensionKeywords: [],
      }
    }

    const normalizedKeywords = this.uniqueStrings(
      (Array.isArray(keywords) ? keywords : [])
        .map(item => this.normalizeComparableText(item))
        .filter(Boolean),
    )
    const collectPatternMatches = (patterns: string[]) => this.uniqueStrings(
      normalizedKeywords.filter(keyword =>
        patterns.some(pattern => keyword.includes(pattern)),
      ),
    )
    const timeKeywords = collectPatternMatches([
      '日期', '时间', '本月', '上月', '近两月', '近两个月', '月', '周', '年', '季度',
      'date', 'time', 'day', 'week', 'month', 'year', 'quarter', 'trend',
    ])
    const metricKeywords = collectPatternMatches([
      '销售额', '销售', '金额', '收入', '业绩', '数量', '总数', '订单量', '订单金额',
      'amount', 'revenue', 'sales', 'count', 'total', 'sum', 'metric',
    ])
    const dimensionKeywords = collectPatternMatches([
      '部门', '客户', '渠道', '区域', '类别', '分类', '团队', '人员', '产品',
      'department', 'customer', 'channel', 'region', 'category', 'team', 'owner', 'product',
    ])
    const hasTimeSignal = timeKeywords.length > 0
    const hasMetricSignal = metricKeywords.length > 0
    const hasDimensionSignal = dimensionKeywords.length > 0

    return {
      queryShape: hasMetricSignal && (hasTimeSignal || hasDimensionSignal)
        ? 'aggregation_like'
        : 'general_records',
      hasTimeSignal,
      hasMetricSignal,
      hasDimensionSignal,
      timeKeywords,
      metricKeywords,
      dimensionKeywords,
    }
  }

  private hasSearchFacetSemanticMatch(values: any[], keywords: string[]) {
    const normalizedKeywords = this.uniqueStrings(
      (Array.isArray(keywords) ? keywords : [])
        .map(item => this.normalizeComparableText(item))
        .filter(Boolean),
    )
    if (!normalizedKeywords.length) {
      return false
    }
    return this.scoreSearchValues(values, normalizedKeywords) > 0
  }

  private resolveSearchRouteStructureCoverage(
    route: any,
    signals: SearchQueryStructureSignals,
  ): SearchRouteStructureCoverage {
    const timeFields = Array.isArray(route?.timeFields) ? route.timeFields : []
    const metricFields = Array.isArray(route?.metricFields) ? route.metricFields : []
    const dimensionFields = Array.isArray(route?.entityFields) ? route.entityFields : []
    const hasTime = timeFields.length > 0
    const hasMetric = metricFields.length > 0
    const hasDimension = dimensionFields.length > 0
    const timeSemanticMatch = !signals.hasTimeSignal
      || this.hasSearchFacetSemanticMatch(timeFields, signals.timeKeywords)
    const metricSemanticMatch = !signals.hasMetricSignal
      || this.hasSearchFacetSemanticMatch(metricFields, signals.metricKeywords)
    const dimensionSemanticMatch = !signals.hasDimensionSignal
      || this.hasSearchFacetSemanticMatch(dimensionFields, signals.dimensionKeywords)
    const satisfiesTime = !signals.hasTimeSignal || hasTime
    const satisfiesMetric = !signals.hasMetricSignal || hasMetric
    const satisfiesDimension = !signals.hasDimensionSignal || hasDimension
    const satisfiesSemanticTime = !signals.hasTimeSignal || (hasTime && timeSemanticMatch)
    const satisfiesSemanticMetric = !signals.hasMetricSignal || (hasMetric && metricSemanticMatch)
    const satisfiesSemanticDimension = !signals.hasDimensionSignal || (hasDimension && dimensionSemanticMatch)

    return {
      hasTime,
      hasMetric,
      hasDimension,
      timeSemanticMatch: signals.hasTimeSignal ? timeSemanticMatch : false,
      metricSemanticMatch: signals.hasMetricSignal ? metricSemanticMatch : false,
      dimensionSemanticMatch: signals.hasDimensionSignal ? dimensionSemanticMatch : false,
      satisfiesAll: satisfiesTime && satisfiesMetric && satisfiesDimension,
      satisfiesAllSemantic: satisfiesSemanticTime && satisfiesSemanticMetric && satisfiesSemanticDimension,
    }
  }

  private scoreSearchStructuralFit(
    manifest: AiAppMemoryManifest | null,
    signals: SearchQueryStructureSignals,
  ) {
    if (!manifest || signals.queryShape !== 'aggregation_like') {
      return 0
    }

    const recordRoutes = Array.isArray(manifest?.routeIndex?.recordRoutes) ? manifest.routeIndex.recordRoutes : []
    return recordRoutes.reduce((bestScore, route) => {
      const coverage = this.resolveSearchRouteStructureCoverage(route, signals)
      let score = 0

      if (signals.hasTimeSignal && coverage.hasTime) {
        score += coverage.timeSemanticMatch ? 4 : 1
      }
      if (signals.hasMetricSignal && coverage.hasMetric) {
        score += coverage.metricSemanticMatch ? 6 : 1
      }
      if (signals.hasDimensionSignal && coverage.hasDimension) {
        score += coverage.dimensionSemanticMatch ? 4 : 1
      }
      if (
        signals.hasMetricSignal
        && coverage.metricSemanticMatch
        && (
          (signals.hasTimeSignal && coverage.timeSemanticMatch)
          || (signals.hasDimensionSignal && coverage.dimensionSemanticMatch)
        )
      ) {
        score += 4
      }
      if (coverage.satisfiesAllSemantic && (signals.hasTimeSignal || signals.hasDimensionSignal)) {
        score += 6
      }

      const cappedScore = signals.hasMetricSignal && !coverage.metricSemanticMatch
        ? Math.min(score, 3)
        : Math.min(score, 12)
      return cappedScore > bestScore ? cappedScore : bestScore
    }, 0)
  }

  private scoreSearchDistinctiveness(
    manifest: AiAppMemoryManifest | null,
    signals: SearchQueryStructureSignals,
  ) {
    if (!manifest || signals.queryShape !== 'aggregation_like') {
      return 0
    }

    const recordRoutes = Array.isArray(manifest?.routeIndex?.recordRoutes) ? manifest.routeIndex.recordRoutes : []
    const closedRouteCount = recordRoutes
      .filter(route => this.resolveSearchRouteStructureCoverage(route, signals).satisfiesAllSemantic)
      .length

    if (!closedRouteCount) {
      return 0
    }

    return Math.max(1, 6 - Math.min(5, closedRouteCount - 1))
  }

  private scoreSearchMismatchPenalty(
    manifest: AiAppMemoryManifest | null,
    signals: SearchQueryStructureSignals,
  ) {
    if (!manifest || signals.queryShape !== 'aggregation_like') {
      return 0
    }

    const recordRoutes = Array.isArray(manifest?.routeIndex?.recordRoutes) ? manifest.routeIndex.recordRoutes : []
    const routeCoverages = recordRoutes.map(route => this.resolveSearchRouteStructureCoverage(route, signals))
    const hasAnyTimeField = routeCoverages.some(item => item.hasTime)
    const hasAnyMetricField = routeCoverages.some(item => item.hasMetric)
    const hasAnyDimensionField = routeCoverages.some(item => item.hasDimension)
    const hasAnyTimeSemanticMatch = routeCoverages.some(item => item.timeSemanticMatch)
    const hasAnyMetricSemanticMatch = routeCoverages.some(item => item.metricSemanticMatch)
    const hasAnyDimensionSemanticMatch = routeCoverages.some(item => item.dimensionSemanticMatch)

    let penalty = 0
    if (signals.hasTimeSignal && !hasAnyTimeField) penalty += 4
    if (signals.hasMetricSignal && !hasAnyMetricField) penalty += 6
    if (signals.hasDimensionSignal && !hasAnyDimensionField) penalty += 4
    if (signals.hasTimeSignal && hasAnyTimeField && !hasAnyTimeSemanticMatch) penalty += 2
    if (signals.hasMetricSignal && hasAnyMetricField && !hasAnyMetricSemanticMatch) penalty += 6
    if (signals.hasDimensionSignal && hasAnyDimensionField && !hasAnyDimensionSemanticMatch) penalty += 2

    return penalty
  }

  private resolveSearchStructuralRecordsContribution(value: any) {
    const score = Number(value || 0)
    if (!Number.isFinite(score) || score <= 0) {
      return 0
    }
    return Math.min(score, 8)
  }

  private collectSearchMatchedKeywords(values: any[], keywords: string[]) {
    const normalizedValues = this.filterLowSignalSearchValues(values)
    const matched = new Set<string>()
    if (!normalizedValues.length || !Array.isArray(keywords) || !keywords.length) {
      return matched
    }

    keywords.forEach(keyword => {
      if (normalizedValues.some(value => this.scoreSearchTextMatch(value, [keyword]) > 0)) {
        matched.add(String(keyword || '').trim())
      }
    })
    return matched
  }

  private scoreSearchIntentCapabilityFit(
    manifest: AiAppMemoryManifest | null,
    intent: 'records' | 'unknown',
  ) {
    if (!manifest || intent === 'unknown') {
      return 0
    }

    return Array.isArray(manifest.sourceIndex) && manifest.sourceIndex.length ? 1 : 0
  }

  private hasExactSearchKeywordMatch(values: any[], keywords: string[]) {
    const normalizedKeywords = new Set(
      (Array.isArray(keywords) ? keywords : [])
        .map(item => this.normalizeComparableText(item))
        .filter(Boolean),
    )
    if (!normalizedKeywords.size) {
      return false
    }

    return values.some(value => {
      const normalizedValue = this.normalizeComparableText(value)
      return !!normalizedValue && normalizedKeywords.has(normalizedValue)
    })
  }

  private buildSearchAppCandidate(
    app: { id: string; name?: string },
    manifest: any,
    keywords: string[],
    intent: 'records' | 'unknown',
  ): SearchAppCandidate {
    const appName = String(app.name || app.id || '').trim() || String(app.id || '').trim()
    const levels = manifest?.levels || this.buildEmptyMemoryLevels()
    const matchReasons: string[] = []
    const exactNameMatched = this.hasExactSearchKeywordMatch([appName, app.id], keywords)
    const queryStructureSignals = this.resolveSearchQueryStructureSignals(keywords, intent)
    const evidenceBreakdown: AiSearchAppEvidenceBreakdown = {
      exactAppNameMatch: exactNameMatched,
      appNameScore: 0,
      appSummaryScore: 0,
      sourceScore: 0,
      recordRouteScore: 0,
      recordsScore: 0,
      weakCapabilityScore: 0,
      queryShape: queryStructureSignals.queryShape,
    }
    let commonScore = 0

    const nameScore = this.scoreSearchValues([appName, app.id], keywords)
    if (nameScore > 0) {
      evidenceBreakdown.appNameScore = nameScore * 4
      commonScore += evidenceBreakdown.appNameScore
      if (exactNameMatched) {
        matchReasons.push('exact_app_name_match')
      }
      matchReasons.push('app_name_match')
    }

    if (manifest) {
      const recordRoutes = Array.isArray(manifest?.routeIndex?.recordRoutes) ? manifest.routeIndex.recordRoutes : []
      const recordRouteValues = (Array.isArray(manifest?.routeIndex?.recordRoutes) ? manifest.routeIndex.recordRoutes : [])
        .flatMap((item: any) => [
          item?.sourceName,
          ...(Array.isArray(item?.keywords) ? item.keywords : []),
          ...(Array.isArray(item?.entityFields) ? item.entityFields : []),
          ...(Array.isArray(item?.timeFields) ? item.timeFields : []),
          ...(Array.isArray(item?.metricFields) ? item.metricFields : []),
        ])
      const appSummaryValues = [
        manifest?.appSummary?.purpose,
        ...(Array.isArray(manifest?.appSummary?.domainKeywords) ? manifest.appSummary.domainKeywords : []),
      ]
      const semanticValues = [
        manifest?.semanticProfile?.derivedSummary || manifest?.semanticProfile?.summary,
        ...(Array.isArray(manifest?.semanticProfile?.primaryUseCases) ? manifest.semanticProfile.primaryUseCases : []),
        ...(Array.isArray(manifest?.semanticProfile?.keyEntities) ? manifest.semanticProfile.keyEntities : []),
        ...(Array.isArray(manifest?.semanticProfile?.featureTags) ? manifest.semanticProfile.featureTags : []),
        ...(Array.isArray(manifest?.semanticProfile?.sourceRoleHints) ? manifest.semanticProfile.sourceRoleHints : []),
      ]
      const sourceValues = (Array.isArray(manifest?.sourceIndex) ? manifest.sourceIndex : [])
        .flatMap((item: any) => [item?.sourceName])

      const appSummaryScore = this.scoreSearchValues(appSummaryValues, keywords)
      if (appSummaryScore > 0) {
        evidenceBreakdown.appSummaryScore = appSummaryScore * 2
        commonScore += evidenceBreakdown.appSummaryScore
        matchReasons.push('app_memory_summary')
      }

      const semanticScore = this.scoreSearchValues(semanticValues, keywords)
      if (semanticScore > 0) {
        evidenceBreakdown.semanticScore = semanticScore * 2
        commonScore += evidenceBreakdown.semanticScore
        matchReasons.push('semantic_match')
      }

      const sourceScore = this.scoreSearchValues(sourceValues, keywords)
      if (sourceScore > 0) {
        evidenceBreakdown.sourceScore = sourceScore * 2
        evidenceBreakdown.recordsScore = Number(evidenceBreakdown.recordsScore || 0) + evidenceBreakdown.sourceScore
        matchReasons.push('source_match')
      }

      const recordRouteScore = this.scoreSearchValues(recordRouteValues, keywords)
      if (recordRouteScore > 0) {
        const bestRouteCoverageScore = this.scoreSearchBestRouteCoverage(recordRoutes, keywords)
        evidenceBreakdown.recordRouteScore = recordRouteScore * 2 + bestRouteCoverageScore
        evidenceBreakdown.recordsScore = Number(evidenceBreakdown.recordsScore || 0) + evidenceBreakdown.recordRouteScore
        matchReasons.push('record_route_match')
      }

      evidenceBreakdown.recordsScore = Number(evidenceBreakdown.recordsScore || 0) + this.resolveSearchFacetSupportScore(manifest)
      evidenceBreakdown.weakCapabilityScore = this.scoreSearchIntentCapabilityFit(manifest, intent)
      if (evidenceBreakdown.weakCapabilityScore > 0) {
        matchReasons.push('weak_capability_match')
      }

      if (queryStructureSignals.queryShape === 'aggregation_like' && !exactNameMatched) {
        evidenceBreakdown.structuralFitScore = this.scoreSearchStructuralFit(manifest, queryStructureSignals)
        evidenceBreakdown.distinctivenessScore = this.scoreSearchDistinctiveness(manifest, queryStructureSignals)
        evidenceBreakdown.mismatchPenalty = this.scoreSearchMismatchPenalty(manifest, queryStructureSignals)
        const structuralRecordsContribution = this.resolveSearchStructuralRecordsContribution(
          evidenceBreakdown.structuralFitScore,
        )
        evidenceBreakdown.recordsScore = Number(evidenceBreakdown.recordsScore || 0)
          + structuralRecordsContribution
          + Number(evidenceBreakdown.distinctivenessScore || 0)
          - Math.abs(Number(evidenceBreakdown.mismatchPenalty || 0))
      }
    }

    if (exactNameMatched) {
      evidenceBreakdown.leadEvidenceKind = 'exact_name'
    } else if (Number(evidenceBreakdown.semanticScore || 0) > 0) {
      evidenceBreakdown.leadEvidenceKind = 'semantic'
    } else if (Number(evidenceBreakdown.structuralFitScore || 0) >= 8) {
      evidenceBreakdown.leadEvidenceKind = 'structural_fit'
    } else if (Number(evidenceBreakdown.appNameScore || 0) > 0 && Number(evidenceBreakdown.recordRouteScore || 0) > 0) {
      evidenceBreakdown.leadEvidenceKind = 'mixed'
    }

    const recordsScore = Number(evidenceBreakdown.recordsScore || 0)
    const score = this.resolveSearchFacetRankScore({
      commonScore,
      recordsScore,
      weakCapabilityScore: Number(evidenceBreakdown.weakCapabilityScore || 0),
      intent,
      hasKeywords: keywords.length > 0,
    })

    return {
      app,
      score,
      recordsScore,
      summary: this.buildSearchAppSummary(appName, manifest),
      matchReasons: this.uniqueStrings(matchReasons).slice(0, 6).length
        ? this.uniqueStrings(matchReasons).slice(0, 6)
        : ['accessible_app'],
      memoryStatus: this.buildMemoryStatus(levels),
      levels,
      exactNameMatched,
      evidenceStrength: this.resolveSearchCandidateEvidenceStrength(score, evidenceBreakdown),
      evidenceBreakdown,
      capabilities: {
        sourceCount: Number(manifest?.sourceIndex?.length || 0),
        supportsRecords: Number(manifest?.sourceIndex?.length || 0) > 0,
      },
    }
  }

  private buildSearchAppSummary(appName: string, manifest: AiAppMemoryManifest | null) {
    if (!manifest) {
      return `${appName} 的记忆尚未初始化。`
    }

    const sourceCount = Number(manifest?.sourceIndex?.length || 0)
    const purpose = String(manifest?.semanticProfile?.derivedSummary || manifest?.semanticProfile?.summary || '').trim()
      || String(manifest?.appSummary?.purpose || '').trim()
    const routingHint = this.buildSearchAppRoutingHint(manifest)
    return [
      purpose || `${appName} 当前包含 ${sourceCount} 个数据源。`,
      `记忆状态：${this.describeMemoryStatus(this.buildMemoryStatus(manifest.levels))}。`,
      routingHint,
    ].filter(Boolean).join(' ')
  }

  private buildSearchAppRoutingHint(manifest: AiAppMemoryManifest) {
    const recordHints = this.buildSearchRecordHintLabels(manifest)
      const segments = [recordHints.length ? `记录=${recordHints.join('、')}` : ''].filter(Boolean)

    return segments.length
      ? `候选线索：${segments.join('；')}。`
      : ''
  }

  private buildSearchRecordHintLabels(manifest: AiAppMemoryManifest) {
    const recordRoutes = Array.isArray(manifest.routeIndex?.recordRoutes)
      ? manifest.routeIndex.recordRoutes
      : []
    const entryPoints = Array.isArray(manifest.entryPoints)
      ? manifest.entryPoints
      : []
    const sources = Array.isArray(manifest.sourceIndex)
      ? manifest.sourceIndex
      : []

    return this.collectSearchAppHintLabels([
      ...recordRoutes.flatMap(item => [...this.normalizeStringArray(item?.keywords), item?.sourceName]),
      ...entryPoints
        .filter(item => item?.mode === 'records')
        .slice()
        .sort((left, right) => Number(right?.priority || 0) - Number(left?.priority || 0))
        .map(item => item?.label),
      ...sources.map(item => item?.sourceName),
    ], 'records')
  }

  private collectSearchAppHintLabels(values: any[], mode: 'records') {
    return this.uniqueStrings(
      (Array.isArray(values) ? values : [])
        .map(item => this.summarizeSearchAppHintLabel(this.normalizeSearchAppHintText(item)))
        .filter(item => this.isUsefulSearchAppHint(item, mode)),
    ).slice(0, 3)
  }

  private filterLowSignalSearchValues(values: any[]) {
    return this.uniqueStrings(
      (Array.isArray(values) ? values : [])
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .filter(item => !/^\d+$/.test(item))
        .filter(item => !/^字段\d+$/i.test(item))
        .filter(item => !/^数字\d+$/i.test(item))
        .filter(item => !/^单行文本\d+$/i.test(item))
        .filter(item => {
          const compact = item.replace(/\s+/g, '')
          if (compact.length < 2) {
            return false
          }
          if (/^[a-z0-9_-]+$/i.test(compact) && /\d/.test(compact)) {
            return false
          }
          return true
        }),
    )
  }

  private normalizeSearchAppHintText(value: any) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .split(/[。；;]+/)[0]
      .replace(/^[、，,]+/, '')
      .replace(/[、，,]+$/g, '')
      .trim()
  }

  private summarizeSearchAppHintLabel(value: string, maxLength = 18) {
    if (value.length <= maxLength) {
      return value
    }
    return `${value.slice(0, maxLength).trim()}...`
  }

  private isUsefulSearchAppHint(value: string, mode: 'records') {
    const normalized = this.normalizeComparableText(value)
    if (!normalized || normalized.length <= 1) {
      return false
    }

    const exactGeneric = new Set(['记录', '数据', '表单', '表格', '列表', '查询', '检索', '统计', '管理', 'record', 'records', 'data', 'table', 'query', 'search'])
    if (exactGeneric.has(normalized)) {
      return false
    }

    const genericPatterns = [/记录查询/i, /数据查询/i, /记录检索/i, /筛选统计/i, /查询统计/i, /记录管理/i, /表单填报/i, /明细查询/i]
    return !genericPatterns.some(pattern => pattern.test(value))
  }

  private buildMemoryStatus(levels: any): AiMemoryStatus {
    const catalog = String(levels?.catalog || '').trim()
    const structure = String(levels?.structure || '').trim()
    const semantic = String(levels?.semantic || '').trim()
    if (semantic === 'ready' || semantic === 'partial') {
      return 'summary_ready'
    }
    if (structure === 'ready' || structure === 'partial' || structure === 'stale') {
      return 'structure_ready'
    }
    if (catalog === 'ready' || catalog === 'partial' || catalog === 'stale') {
      return 'catalog_only'
    }
    return 'missing'
  }

  private buildEmptyMemoryLevels() {
    return {
      catalog: 'missing',
      structure: 'missing',
      semantic: 'missing',
    }
  }

  private buildSourceFallbackSummary(source: any, memory: any) {
    const sourceName = String(source?.sourceName || source?.tableName || source?.name || source?.sourceId || '').trim() || AI_LOCAL_TOOL_COPY.fallbackSourceName
    if (this.isDocumentLikeSource(source, memory)) {
      return `${sourceName}对应文档视图底层记录，可用于读取记录、状态和结构化字段。`
    }
    return `${sourceName}可用于记录查询、筛选、计数和聚合统计。`
  }

  private buildSourceWhenToUse(source: any, memory: any) {
    const sourceName = typeof source === 'string'
      ? source
      : String(source?.sourceName || source?.tableName || source?.name || source?.sourceId || '').trim()
    const entityFields = this.mapSourceHintFieldNames(memory, this.normalizeStringArray(memory?.queryHints?.entityFields))
    const timeFields = this.mapSourceHintFieldNames(memory, this.normalizeStringArray(memory?.queryHints?.timeFields))
    const metricFields = this.mapSourceHintFieldNames(memory, this.normalizeStringArray(memory?.queryHints?.metricFields))

    if (this.isDocumentLikeSource(source, memory)) {
      return [
        ` ${sourceName} 读取文档视图对应的表单记录、状态和结构化字段。`,
        '文档视图按底层 source 处理，不读取正文，不作为正文阅读入口。',
      ].join(' ')
    }

    const parts = [
      ` ${sourceName} 做记录查询、筛选、计数和聚合统计。`,
      entityFields.length ? `实体字段${entityFields.join(', ')}。` : '',
      timeFields.length ? `时间字段${timeFields.join(', ')}。` : '',
      metricFields.length ? `指标字段${metricFields.join(', ')}。` : '',
    ].filter(Boolean)
    return parts.join(' ')
  }

  private describeSourceFieldDisplay(field: any) {
    const name = String(field?.name || field?.id || '').trim()
    return describeAiFieldPrompt(name, field?.displayMeta)
  }

  private isDocumentLikeSource(source: any, memory?: any) {
    const kind = String(source?.kind || '').trim().toLowerCase()
    const viewTypes = Array.isArray(memory?.viewTypes)
      ? memory.viewTypes.map((item: any) => String(item || '').trim().toLowerCase())
      : []
    return (
      kind === 'document-table'
      || kind.includes('document')
      || viewTypes.includes('document')
    )
  }

  private buildSourceKeyFields(memory: any) {
    const fields = Array.isArray(memory?.fields) ? memory.fields : []
    const hinted = new Set([
      ...this.normalizeStringArray(memory?.queryHints?.entityFields),
      ...this.normalizeStringArray(memory?.queryHints?.timeFields),
      ...this.normalizeStringArray(memory?.queryHints?.metricFields),
      ...this.normalizeStringArray(memory?.queryHints?.filterFields),
    ])

    const prioritized = [
      ...fields.filter((field: any) => this.isHintedSourceField(field, hinted)),
      ...fields.filter((field: any) => !this.isHintedSourceField(field, hinted)),
    ]

    return prioritized.map((field: any) => ({
      id: String(field?.id || '').trim(),
      name: String(field?.name || field?.id || '').trim(),
      type: String(field?.type || '').trim() || 'unknown',
      semanticType: String(field?.semanticType || '').trim() || undefined,
      displayMeta: field?.displayMeta || undefined,
    }))
  }

  private async getAiReadableFieldIds(appId: string, tableId: string) {
    const ids = await (this.formDataService as any)?.getAiReadableFieldIds?.(appId, tableId)
    return Array.isArray(ids)
      ? ids.map((item: any) => String(item || '').trim()).filter(Boolean)
      : []
  }

  private async getAiReadableFieldIdsMap(appId: string, tableIds: string[]) {
    const normalizedTableIds = [...new Set(
      (Array.isArray(tableIds) ? tableIds : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )]

    if (!normalizedTableIds.length) {
      return new Map<string, string[]>()
    }

    const directMap = await (this.formDataService as any)?.getAiReadableFieldIdsMap?.(appId, normalizedTableIds)
    if (directMap instanceof Map) {
      return new Map(
        [...directMap.entries()]
          .map(([tableId, ids]) => [
            String(tableId || '').trim(),
            Array.isArray(ids) ? ids.map((item: any) => String(item || '').trim()).filter(Boolean) : [],
          ] as const)
          .filter(item => item[0]),
      )
    }

    const entries = await Promise.all(
      normalizedTableIds.map(async tableId => [tableId, await this.getAiReadableFieldIds(appId, tableId)] as const),
    )
    return new Map(entries)
  }

  private filterAiSourceMemoryFields(memory: any, readableFieldIds: string[]) {
    const allowedIds = new Set((Array.isArray(readableFieldIds) ? readableFieldIds : []).map(item => String(item || '').trim()).filter(Boolean))
    if (!allowedIds.size) {
      return {
        fields: [],
        queryHints: {
          keywordFields: [],
          filterFields: [],
          timeFields: [],
          metricFields: [],
          entityFields: [],
        },
      }
    }

    const fields = (Array.isArray(memory?.fields) ? memory.fields : [])
      .filter((field: any) => allowedIds.has(String(field?.id || '').trim()))
    const normalizeHintIds = (value: any) => this.normalizeStringArray(value)
      .filter(item => allowedIds.has(String(item || '').trim()))

    return {
      fields,
      queryHints: {
        keywordFields: normalizeHintIds(memory?.queryHints?.keywordFields),
        filterFields: normalizeHintIds(memory?.queryHints?.filterFields),
        timeFields: normalizeHintIds(memory?.queryHints?.timeFields),
        metricFields: normalizeHintIds(memory?.queryHints?.metricFields),
        entityFields: normalizeHintIds(memory?.queryHints?.entityFields),
      },
    }
  }

  private mapVisibleSourceHintFieldNames(memory: any, queryHints: Record<string, any>) {
    return {
      keywordFields: this.mapSourceHintFieldNames({ ...memory, queryHints }, this.normalizeStringArray(queryHints?.keywordFields)),
      filterFields: this.mapSourceHintFieldNames({ ...memory, queryHints }, this.normalizeStringArray(queryHints?.filterFields)),
      timeFields: this.mapSourceHintFieldNames({ ...memory, queryHints }, this.normalizeStringArray(queryHints?.timeFields)),
      metricFields: this.mapSourceHintFieldNames({ ...memory, queryHints }, this.normalizeStringArray(queryHints?.metricFields)),
      entityFields: this.mapSourceHintFieldNames({ ...memory, queryHints }, this.normalizeStringArray(queryHints?.entityFields)),
    }
  }

  private buildPermissionSafeSourceSemanticHints(options: {
    sourceName: string
    memory: any
    visibleFields: any[]
    visibleQueryHints: Record<string, any>
    recordRouteHints: string[]
    typicalQuestions: string[]
  }) {
    const hiddenReferenceTokens = this.buildSourceSemanticReferenceTokens(options.memory)
    const visibleReferenceTokens = this.buildSourceSemanticReferenceTokens({
      sourceName: options.sourceName,
      fields: options.visibleFields,
      queryHints: options.visibleQueryHints,
    })
    const visibleComparableTokens = this.uniqueStrings(visibleReferenceTokens)
      .map(item => this.normalizeComparableText(item))
      .filter(Boolean)
    const visibleComparableSet = new Set(visibleComparableTokens)
    const hiddenComparableTokens = this.uniqueStrings(hiddenReferenceTokens)
      .map(item => this.normalizeComparableText(item))
      .filter(item => item && !visibleComparableSet.has(item))

    const isSupportedText = (value: any) => {
      const normalizedText = this.normalizeComparableText(value)
      if (!normalizedText || !visibleComparableTokens.length) {
        return false
      }
      if (hiddenComparableTokens.some(token => normalizedText.includes(token))) {
        return false
      }
      return visibleComparableTokens.some(token => normalizedText.includes(token))
    }

    return {
      recordRouteHints: this.uniqueStrings(this.normalizeStringArray(options.recordRouteHints).filter(isSupportedText)).slice(0, 8),
      typicalQuestions: this.uniqueStrings(this.normalizeStringArray(options.typicalQuestions).filter(isSupportedText)).slice(0, 6),
    }
  }

  private buildSourceSemanticReferenceTokens(source: {
    sourceName?: string
    fields?: any[]
    queryHints?: Record<string, any>
  } | null | undefined) {
    const fields = Array.isArray(source?.fields) ? source.fields : []
    const queryHints = source?.queryHints && typeof source.queryHints === 'object'
      ? source.queryHints
      : {}
    return this.uniqueStrings([
      String(source?.sourceName || '').trim(),
      ...fields.flatMap((field: any) => [
        String(field?.id || '').trim(),
        String(field?.name || field?.id || '').trim(),
        this.describeSourceFieldDisplay(field),
      ]),
      ...this.normalizeStringArray(queryHints?.keywordFields),
      ...this.normalizeStringArray(queryHints?.filterFields),
      ...this.normalizeStringArray(queryHints?.timeFields),
      ...this.normalizeStringArray(queryHints?.metricFields),
      ...this.normalizeStringArray(queryHints?.entityFields),
    ].filter(Boolean))
  }

  private assertAiFieldReadable(table: Table, field: Field | null | undefined, rawField: string) {
    if (field) {
      return field
    }

    this.throwReadAppDataInputError(
      `字段“${rawField}”不存在于数据源“${table.alias || table.uid}”中，或当前无读取权限。请先调 get_app_memory 查看当前可读字段后再重试。`,
      'READ_APP_DATA_FIELD_NOT_FOUND',
      {
        tableId: String(table?.uid || '').trim() || undefined,
        sourceId: String(table?.uid || '').trim() || undefined,
        field: String(rawField || '').trim() || undefined,
      },
    )
  }

  private async buildAiReadableTable(appId: string, table: Table) {
    const readableFieldIds = new Set(await this.getAiReadableFieldIds(appId, table.uid))
    if (!readableFieldIds.size) {
      return {
        ...table,
        fields: [],
      }
    }

    return {
      ...table,
      fields: (Array.isArray(table?.fields) ? table.fields : [])
        .filter(field => readableFieldIds.has(String(field?.uid || '').trim())),
    }
  }

  private mapSourceHintFieldNames(memory: any, hintedIds: string[]) {
    const fields = Array.isArray(memory?.fields) ? memory.fields : []
    const fieldMap = new Map(
      fields.map((field: any) => [
        String(field?.id || '').trim(),
        this.describeSourceFieldDisplay(field),
      ] as const),
    )

    return this.uniqueStrings(
      (Array.isArray(hintedIds) ? hintedIds : [])
        .map(item => String(fieldMap.get(String(item || '').trim()) || String(item || '').trim()))
        .filter(Boolean),
    )
  }

  private isHintedSourceField(field: any, hinted: Set<string>) {
    const fieldId = String(field?.id || '').trim()
    const fieldName = String(field?.name || '').trim()
    return hinted.has(fieldId) || (!!fieldName && hinted.has(fieldName))
  }

  private resolveSearchCandidateEvidenceStrength(score: number, evidenceBreakdown: AiSearchAppEvidenceBreakdown): AiEvidenceStrength {
    if (score <= 0) {
      return 'none'
    }

    if (evidenceBreakdown.exactAppNameMatch) {
      return 'strong'
    }

    const activeSignals = [
      evidenceBreakdown.appNameScore,
      evidenceBreakdown.appSummaryScore,
      evidenceBreakdown.semanticScore,
      evidenceBreakdown.sourceScore,
      evidenceBreakdown.recordRouteScore,
      evidenceBreakdown.tableNameScore,
    ].filter(value => Number(value || 0) > 0).length

    if (score >= 36 || (score >= 24 && activeSignals >= 3)) {
      return 'strong'
    }
    if (score >= 16 || activeSignals >= 2) {
      return 'moderate'
    }
    return 'weak'
  }

  private resolveSearchEvidenceStrength(
    convergence: AiSearchConvergence,
    matchedCount: number,
    topCandidateEvidenceStrength?: AiEvidenceStrength,
    exactNameMatchCount = 0,
  ): AiEvidenceStrength {
    if (matchedCount <= 0) {
      return 'none'
    }
    if (convergence === 'clear') {
      return 'strong'
    }
    if (exactNameMatchCount > 0 || topCandidateEvidenceStrength === 'strong') {
      return 'moderate'
    }
    return topCandidateEvidenceStrength === 'moderate'
      ? 'moderate'
      : 'weak'
  }

  private buildSearchAmbiguitySignals(options: {
    matchedCount: number
    topScore: number
    topScoreGap: number
    exactNameMatchCount: number
    topCandidateExactNameMatch: boolean
    convergence: AiSearchConvergence
  }) {
    if (options.matchedCount <= 0) {
      return ['insufficient_match_evidence']
    }
    if (options.convergence === 'clear') {
      return []
    }

    const signals: string[] = []
    if (options.matchedCount > 1) {
      signals.push('multiple_viable_candidates')
    }
    if (options.exactNameMatchCount === 0) {
      signals.push('no_exact_app_name_match')
    } else if (options.exactNameMatchCount > 1) {
      signals.push('multiple_exact_app_name_matches')
    }
    if (
      options.matchedCount > 1
      && options.topScore > 0
      && options.topScoreGap <= Math.max(4, Math.ceil(options.topScore * 0.15))
    ) {
      signals.push('top_candidates_overlap')
    }
    if (options.convergence === 'weak' && !options.topCandidateExactNameMatch) {
      signals.push('needs_more_comparable_evidence')
    }
    return this.uniqueStrings(signals)
  }

  private buildAppMemoryEvidenceProfile(options: {
    manifest: AiAppMemoryManifest
    sources: any[]
    sourceMemoryMap: Map<string, any>
    sourceNameMap: Map<string, string>
  }): AiAppMemoryEvidenceProfile {
    const sourceMemories = Array.from(options.sourceMemoryMap.values())
    const entityFieldHints = this.uniqueStrings(sourceMemories.flatMap(memory =>
      this.mapSourceHintFieldNames(memory, this.normalizeStringArray(memory?.queryHints?.entityFields)),
    ))
    const timeFieldHints = this.uniqueStrings(sourceMemories.flatMap(memory =>
      this.mapSourceHintFieldNames(memory, this.normalizeStringArray(memory?.queryHints?.timeFields)),
    ))
    const metricFieldHints = this.uniqueStrings(sourceMemories.flatMap(memory =>
      this.mapSourceHintFieldNames(memory, this.normalizeStringArray(memory?.queryHints?.metricFields)),
    ))
    const filterFieldHints = this.uniqueStrings(sourceMemories.flatMap(memory =>
      this.mapSourceHintFieldNames(memory, this.normalizeStringArray(memory?.queryHints?.filterFields)),
    ))
    const businessObjects = this.buildBusinessObjectHints(options.sources, entityFieldHints)
    const recordRouteHints = this.uniqueStrings(
      options.sources.flatMap(item =>
        this.normalizeStringArray(item?.recordRouteHints).map(text => this.summarizeEvidenceText(text)),
      ),
    ).slice(0, 12)
    const attributeHints = this.uniqueStrings(
      filterFieldHints.filter(item =>
        !timeFieldHints.includes(item)
        && !metricFieldHints.includes(item)
        && !entityFieldHints.includes(item),
      ),
    ).slice(0, 12)
    const relationHints = this.uniqueStrings(options.sources.flatMap(source =>
      this.buildRelationHints(
        source.sourceName,
        options.sourceMemoryMap.get(source.sourceId)?.relations || [],
        options.sourceNameMap,
      ),
    )).slice(0, 12)
    const semanticFitHints = this.uniqueStrings([
      ...this.normalizeStringArray(options.manifest.semanticProfile?.primaryUseCases)
        .map(text => this.summarizeEvidenceText(text)),
      ...this.normalizeStringArray(options.manifest.semanticProfile?.sourceRoleHints)
        .map(text => this.summarizeEvidenceText(text)),
      ...options.sources.map(item => this.summarizeEvidenceText(item.whenToUse)),
      ...options.sources.flatMap(item =>
        this.normalizeStringArray(item?.typicalQuestions)
          .map(text => this.summarizeEvidenceText(text)),
      ),
    ].filter(Boolean)).slice(0, 12)
    const doNotUseFor = this.uniqueStrings(options.sources.flatMap(item => this.normalizeStringArray(item.doNotUseFor))).slice(0, 8)
    const searchableTexts = [
      options.manifest.appSummary?.purpose,
      ...(options.manifest.appSummary?.domainKeywords || []),
      ...options.sources.flatMap(item => [item.sourceName, item.summary, item.whenToUse]),
      ...semanticFitHints,
    ]
    const actionHints = this.extractEvidenceHints(searchableTexts, [
      { label: '提交', pattern: /提交|上报|提报|填报|录入|登记|填写|发起|申请|submit|apply|create/i },
      { label: '审批', pattern: /审批|审核|approve|review/i },
      { label: '查询', pattern: /查询|检索|查找|lookup|query|search/i },
      { label: '维护', pattern: /维护|管理|编辑|更新|修改|maintain|manage|edit|update/i },
      { label: '跟踪', pattern: /跟踪|追踪|trace|track/i },
    ]).slice(0, 8)
    const statusHints = this.extractEvidenceHints(searchableTexts, [
      { label: '草稿', pattern: /草稿|draft/i },
      { label: AI_LOCAL_TOOL_COPY.statusPendingReview, pattern: /待审批|待审核|pending/i },
      { label: AI_LOCAL_TOOL_COPY.statusCompleted, pattern: /已完成|完成|completed|done/i },
      { label: AI_LOCAL_TOOL_COPY.statusPublished, pattern: /已发布|发布|published/i },
    ]).slice(0, 8)
    const contentHints = this.uniqueStrings([
      options.sources.length ? '记录查询' : '',
      options.sources.some(item => String(item?.kind || '').trim().toLowerCase() === 'document-table') ? '文档视图记录' : '',
      statusHints.some(item => item !== AI_LOCAL_TOOL_COPY.statusPublished) ? '流程跟踪' : '',
      actionHints.includes('提交') ? '表单填报' : '',
    ].filter(Boolean)).slice(0, 8)

    const profile: AiAppMemoryEvidenceProfile = {}
    const dataShape = this.resolveAppMemoryDataShape({
      sources: options.sources,
      actionHints,
      statusHints,
    })
    if (dataShape) {
      profile.dataShape = dataShape
    }
    if (businessObjects.length) {
      profile.businessObjects = businessObjects.slice(0, 12)
    }
    if (recordRouteHints.length) {
      profile.recordRouteHints = recordRouteHints
    }
    if (actionHints.length) {
      profile.actionHints = actionHints
    }
    if (statusHints.length) {
      profile.statusHints = statusHints
    }
    if (attributeHints.length) {
      profile.attributeHints = attributeHints
    }
    if (timeFieldHints.length) {
      profile.timeFieldHints = timeFieldHints.slice(0, 12)
    }
    if (metricFieldHints.length) {
      profile.metricHints = metricFieldHints.slice(0, 12)
    }
    if (relationHints.length) {
      profile.relationHints = relationHints
    }
    if (contentHints.length) {
      profile.contentHints = contentHints
    }
    if (semanticFitHints.length) {
      profile.semanticFitHints = semanticFitHints
    }
    if (doNotUseFor.length) {
      profile.doNotUseFor = doNotUseFor
    }
    return profile
  }

  private buildBusinessObjectHints(sources: any[], entityFieldHints: string[]) {
    return this.uniqueStrings([
      ...entityFieldHints,
      ...sources.map(item => this.normalizeBusinessObjectLabel(item.sourceName)),
    ].filter(Boolean)).slice(0, 12)
  }

  private buildRelationHints(sourceName: string, relations: any[], sourceNameMap: Map<string, string>) {
    return (Array.isArray(relations) ? relations : [])
      .map((relation: any) => {
        const targetName = sourceNameMap.get(String(relation?.targetSourceId || '').trim())
        const fromLabel = this.normalizeBusinessObjectLabel(sourceName) || String(sourceName || '').trim()
        const toLabel = this.normalizeBusinessObjectLabel(targetName) || String(targetName || '').trim()
        if (!fromLabel || !toLabel) {
          return ''
        }
        return `${fromLabel} -> ${toLabel}`
      })
      .filter(Boolean)
  }

  private resolveAppMemoryDataShape(options: {
    sources: any[]
    actionHints: string[]
    statusHints: string[]
  }): AiAppMemoryEvidenceProfile['dataShape'] {
    const workflowStatusHints = options.statusHints.filter(item => item !== AI_LOCAL_TOOL_COPY.statusPublished)
    if (workflowStatusHints.length || options.actionHints.includes('审批') || options.actionHints.includes('跟踪')) {
      return 'workflow'
    }
    if (options.actionHints.includes('提交')) {
      return 'form'
    }
    if (options.sources.some(item => item.role === 'directory') && !options.sources.some(item => item.role !== 'directory')) {
      return 'document'
    }
    if (options.sources.some(item => item.role === 'master') && !options.sources.some(item => item.role === 'transaction')) {
      return 'master'
    }
    if (options.sources.some(item => item.role === 'transaction')) {
      return 'transaction'
    }
    if (options.sources.length > 1) {
      return 'mixed'
    }
    return undefined
  }

  private extractEvidenceHints(
    values: any[],
    patterns: Array<{ label: string; pattern: RegExp }>,
  ) {
    const text = this.normalizeComparableText(
      (Array.isArray(values) ? values : [])
        .filter(Boolean)
        .join(' '),
    )
    if (!text) {
      return []
    }

    return patterns
      .filter(item => item.pattern.test(text))
      .map(item => item.label)
  }

  private normalizeBusinessObjectLabel(value: any) {
    const normalized = String(value || '').trim()
      .replace(/(数据源|数据表|表单|表格|列表|记录|明细|台账|档案|目录)$/u, '')
      .trim()
    if (!normalized || ['目录', '文档', '系统'].includes(normalized)) {
      return ''
    }
    return normalized.length >= 2 ? normalized : ''
  }

  private summarizeEvidenceText(value: any) {
    const text = String(value || '').trim().replace(/\s+/g, ' ')
    if (!text) {
      return ''
    }
    return text.length > 72
      ? `${text.slice(0, 72)}...`
      : text
  }

  private describeMemoryStatus(status: AiMemoryStatus) {
    const label = AI_MEMORY_STATUS_LABELS[status as keyof typeof AI_MEMORY_STATUS_LABELS]
    return label || AI_MEMORY_STATUS_LABELS.missing
  }

  private buildRecordReadEvidence(result: any) {
    return (Array.isArray(result?.items) ? result.items : [])
      .map((item: Record<string, any>, index: number) => ({
        kind: 'record',
        index: index + 1,
        preview: Object.entries(item || {})
          .map(([key, value]) => `${key}=${this.stringifyRecordPreviewValue(value)}`)
          .join(' | '),
        record: item,
      }))
  }

  private resolveSemanticObservationWritebackSourceIds(
    request: { targets: Array<{ type?: string; id?: string }> },
    output: AiReadAppDataOutput,
  ) {
    const requestedSourceIds = (Array.isArray(request?.targets) ? request.targets : [])
      .filter(target => String(target?.type || 'source') === 'source')
      .map(target => String(target?.id || '').trim())
      .filter(Boolean)

    const result = output?.result as any
    const perTargetResults = Array.isArray(result?.perTargetResults) ? result.perTargetResults : []
    const succeededTargetIds = Array.isArray(result?.succeededTargets)
      ? result.succeededTargets.map((item: any) => String(item?.id || '').trim()).filter(Boolean)
      : []
    if (!perTargetResults.length) {
      if (succeededTargetIds.length) {
        return requestedSourceIds.filter(sourceId => succeededTargetIds.includes(sourceId))
      }
      return requestedSourceIds.length <= 1 ? requestedSourceIds : []
    }

    return perTargetResults
      .filter(item =>
        item?.ok === true
        && String(item?.target?.type || 'source') === 'source'
        && requestedSourceIds.includes(String(item?.target?.id || '').trim())
        && (
          Number(item?.matchedCount || 0) > 0
          || Number(item?.returnedRows || 0) > 0
          || Number(item?.resultCount || 0) > 0
        ),
      )
      .map(item => String(item?.target?.id || '').trim())
  }

  private buildSemanticObservationWriteback(
    request: { mode: 'records' | 'aggregate' },
    output: AiReadAppDataOutput,
  ) {
    if (!output || !['ok', 'partial'].includes(String(output.status || ''))) {
      return null
    }

    const resultKind = String(output?.result?.kind || 'unknown')
    const matchedCount = Math.max(0, Number((output?.result as any)?.matchedCount || 0))
    const returnedRows = Math.max(
      0,
      Number((output?.result as any)?.returnedRows || (output?.result as any)?.mergedReturnedRows || 0),
    )

    if (request.mode === 'aggregate') {
      if (!['record_analysis', 'record_aggregate', 'batch_record_aggregate'].includes(resultKind)) {
        return null
      }
      if (matchedCount <= 0 && returnedRows <= 0) {
        return null
      }
      return {
        capabilitySummary: '该数据源已被验证可用于聚合统计。',
        note: `mode=aggregate; result=${resultKind}`,
      }
    }

    if (!['record_rows', 'record_total', 'record_analysis', 'batch_record_rows', 'batch_record_total'].includes(resultKind)) {
      return null
    }
    if (matchedCount <= 0 && returnedRows <= 0) {
      return null
    }
    return {
      capabilitySummary: '该数据源已被验证可用于记录查询与筛选。',
      note: `mode=records; result=${resultKind}`,
    }
  }

  private getMemoryManager() {
    const managerModule = require('../memory/ai-app-memory.manager') as typeof import('../memory/ai-app-memory.manager')
    return this.moduleRef.get(managerModule.AiAppMemoryManager, { strict: false })
  }

  private getWarmupService() {
    const warmupModule = require('../memory/ai-app-memory-warmup.service') as typeof import('../memory/ai-app-memory-warmup.service')
    return this.moduleRef.get(warmupModule.AiAppMemoryWarmupService, { strict: false })
  }

  private tryScheduleSemanticWarmup(
    appId: string,
    reason: 'search_top1' | 'get_app_memory',
    options?: {
      requestedSourceIds?: string[]
      traceId?: string
      toolCallId?: string
    },
  ) {
    const warmupService = this.getWarmupService()
    if (!warmupService?.scheduleSemanticWarmup) {
      return
    }
    void warmupService.scheduleSemanticWarmup(appId, reason, options).catch(() => undefined)
  }

  private async recordWarmupToolTrace(trace: Omit<AiWarmupTraceDraft, 'id'>) {
    const warmupService = this.getWarmupService()
    if (!warmupService?.recordToolTrace) {
      return
    }
    await warmupService.recordToolTrace({
      ...trace,
      id: [
        trace.kind,
        trace.traceId || 'no-trace',
        trace.toolCallId || 'no-tool-call',
        trace.appId || 'no-app',
        trace.updatedAt || Date.now(),
      ].join(':'),
    })
  }

  private buildDefaultViewProfile(profile?: AiGetAppMemoryOutput['app']['viewProfile']) {
    return profile || {
      summary: '',
      documentViews: [],
      formViewSourceIds: [],
      tableViewSourceIds: [],
    }
  }

  private buildDefaultWorkflowProfile(profile?: AiGetAppMemoryOutput['app']['workflowProfile']) {
    return profile || {
      hasWorkflow: false,
      sourceIds: [],
      summary: '',
    }
  }

  private buildDefaultWarmupState(state: AiAppMemoryWarmupState | undefined): AiAppMemoryWarmupState {
    return state || {
      phases: {
        catalog: { status: 'missing' },
        profile: { status: 'missing' },
        deep: { status: 'missing' },
      },
    }
  }

  private collectVisibleSemanticWarmupSourceIds(manifest: AiAppMemoryManifest | null | undefined) {
    if (!manifest || !Array.isArray(manifest.sourceIndex)) {
      return []
    }
    return this.uniqueStrings(
      manifest.sourceIndex
        .filter(item =>
          (item?.kind === 'table' || item?.kind === 'document-table')
          && String(item?.levels?.structure || '').trim() === 'ready',
        )
        .map(item => String(item?.sourceId || '').trim()),
    ).sort((left, right) => left.localeCompare(right))
  }

  private resolveSearchFacetSupportScore(manifest: AiAppMemoryManifest | null) {
    if (!manifest) {
      return 0
    }
    return Array.isArray(manifest.sourceIndex) && manifest.sourceIndex.length ? 1 : 0
  }

  private resolveSearchFacetRankScore(options: {
    commonScore: number
    recordsScore: number
    weakCapabilityScore: number
    intent: 'records' | 'unknown'
    hasKeywords: boolean
  }) {
    let score = options.commonScore + options.weakCapabilityScore
    if (options.intent === 'records') {
      score += options.recordsScore * 2
    } else {
      score += options.recordsScore * 1.4
    }

    if (!options.hasKeywords) {
      score = Math.max(score, 1)
    }

    return Number(score.toFixed(4))
  }

  private resolveRowCountBucket(count: number): AiRowCountBucket {
    if (!Number.isFinite(count) || count < 0) {
      return 'unknown'
    }
    if (count === 0) {
      return 'empty'
    }
    if (count <= 50) {
      return 'small'
    }
    if (count <= 500) {
      return 'medium'
    }
    if (count <= 5000) {
      return 'large'
    }
    return 'huge'
  }

  private stringifyRecordPreviewValue(value: any) {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) return value.map(item => this.stringifyRecordPreviewValue(item)).join('、')
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  }

  private normalizeTimeGranularity(value: any): TimeGranularity | null {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) {
      return null
    }

    const granularityAliasMap: Record<string, TimeGranularity> = {
      minute: 'minute',
      minutes: 'minute',
      min: 'minute',
      分钟: 'minute',
      hour: 'hour',
      hours: 'hour',
      小时: 'hour',
      day: 'day',
      days: 'day',
      天: 'day',
      日: 'day',
      week: 'week',
      weeks: 'week',
      周: 'week',
      month: 'month',
      months: 'month',
      月: 'month',
      year: 'year',
      years: 'year',
      年: 'year',
    }
    const resolved = granularityAliasMap[normalized]
    if (resolved) {
      return resolved
    }
    throw new Error('timeGranularity 只支持 minute、hour、day、week、month、year。')
  }

  private describeTimeGranularity(timeGranularity: TimeGranularity) {
    const label = AI_TIME_GRANULARITY_LABELS[timeGranularity as keyof typeof AI_TIME_GRANULARITY_LABELS]
    return label || AI_TIME_GRANULARITY_LABELS.fallback
  }

  private isTimeAggregationField(field: Field | null | undefined) {
    const fieldType = String(field?.type || '').trim().toLowerCase()
    const comparable = this.normalizeComparableText([
      field?.alias,
      field?.uid,
      field?.meta?.name,
    ].filter(Boolean).join(' '))

    return (
      fieldType === 'date'
      || fieldType === 'datetime'
      || comparable.includes('time')
      || comparable.includes('date')
      || comparable.includes('create')
      || comparable.includes('update')
      || comparable.includes('timestamp')
      || comparable.includes('时间')
      || comparable.includes('日期')
      || comparable.includes('创建')
      || comparable.includes('更新')
    )
  }

  private parseRecordDateValue(value: any): Dayjs | null {
    if (value === null || value === undefined || value === '') {
      return null
    }

    if (dayjs.isDayjs(value)) {
      return value.isValid() ? value : null
    }

    if (value instanceof Date) {
      const parsed = dayjs(value)
      return parsed.isValid() ? parsed : null
    }

    if (typeof value === 'number') {
      const parsed = dayjs(value)
      return parsed.isValid() ? parsed : null
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) {
        return null
      }
      if (/^\d{10}$/.test(trimmed)) {
        const parsed = dayjs(Number(trimmed) * 1000)
        return parsed.isValid() ? parsed : null
      }
      if (/^\d{13}$/.test(trimmed)) {
        const parsed = dayjs(Number(trimmed))
        return parsed.isValid() ? parsed : null
      }
      const parsed = dayjs(trimmed)
      return parsed.isValid() ? parsed : null
    }

    if (typeof value === 'object') {
      const candidateKeys = ['value', 'time', 'date', 'datetime', 'timestamp', 'createdAt', 'updatedAt']
      for (const key of candidateKeys) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          continue
        }
        const parsed = this.parseRecordDateValue(value[key])
        if (parsed) {
          return parsed
        }
      }
    }

    return null
  }

  private startOfTimeBucket(value: Dayjs, timeGranularity: TimeGranularity) {
    switch (timeGranularity) {
      case 'minute':
        return value.startOf('minute')
      case 'hour':
        return value.startOf('hour')
      case 'day':
        return value.startOf('day')
      case 'week': {
        const dayOfWeek = value.day()
        const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        return value.startOf('day').subtract(offset, 'day')
      }
      case 'month':
        return value.startOf('month')
      case 'year':
        return value.startOf('year')
      default:
        return value
    }
  }

  private formatTimeBucketLabel(start: Dayjs, timeGranularity: TimeGranularity) {
    switch (timeGranularity) {
      case 'minute':
        return start.format('YYYY-MM-DD HH:mm')
      case 'hour':
        return start.format('YYYY-MM-DD HH:00')
      case 'day':
        return start.format('YYYY-MM-DD')
      case 'week':
        return `${start.format('YYYY-MM-DD')} ~ ${start.add(6, 'day').format('YYYY-MM-DD')}`
      case 'month':
        return start.format('YYYY-MM')
      case 'year':
        return start.format('YYYY')
      default:
        return start.format()
    }
  }

  private normalizeComparableText(value: any) {
    return normalizeAiComparableText(value)
  }

  private filterAppsByKeyword(apps: Array<{ id: string; name?: string; groupId?: string; createTime?: any; sort?: any }>, keyword: string) {
    const normalizedKeyword = this.normalizeComparableText(keyword)
    if (!normalizedKeyword) return apps
    const exactMatched = apps.filter(item => {
      const normalizedName = this.normalizeComparableText(item.name)
      const normalizedId = this.normalizeComparableText(item.id)
      return normalizedName === normalizedKeyword || normalizedId === normalizedKeyword
    })
    if (exactMatched.length) return exactMatched
    return apps.filter(item => {
      const normalizedName = this.normalizeComparableText(item.name)
      const normalizedId = this.normalizeComparableText(item.id)
      return normalizedName.includes(normalizedKeyword) || normalizedId.includes(normalizedKeyword)
    })
  }

  private filterTablesByKeyword<T extends { uid: string; alias?: string }>(tables: T[], keyword: string): T[] {
    const normalizedKeyword = this.normalizeComparableText(keyword)
    if (!normalizedKeyword) return tables
    return tables.filter(item => {
      const normalizedName = this.normalizeComparableText(item.alias)
      const normalizedId = this.normalizeComparableText(item.uid)
      return normalizedName === normalizedKeyword || normalizedId === normalizedKeyword
    })
  }
}
