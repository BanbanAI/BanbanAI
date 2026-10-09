import { Field, Table } from '@common/types/project'
import { getFlows, isSystemField } from '@common/utils'
import { Injectable } from '@nestjs/common'
import md5 from 'md5'
import {
  AiAppKind,
  AiAppViewProfile,
  AiAppViewType,
  AiDocumentContract,
  AiSourceDataProfile,
  AiSourceMemory,
  AiSourceMemoryRole,
  AiToolExecutionContext,
  AiWorkflowProfile,
} from '../ai.types'
import {
  AI_RECORDS_ONLY_DOCUMENT_VIEW_BOUNDARY,
  AI_RECORDS_ONLY_NON_RECORD_REDIRECT,
} from '../runtime/ai-records-only-policy'
import { AiLocalToolService } from '../tools/local-tool.service'
import { ProjectService } from '../../project/project.services'
import { resolveAiAppKind } from '../utils/ai-app-kind.util'
import { buildAiMetricFieldComparable, isAiMetricFieldByParts } from '../utils/ai-metric-field.util'
import { pickAiNumericDisplayMeta } from '../utils/ai-numeric-display'

type AiManifestSourceKind = 'table' | 'document-table'
export type AiAppMemoryScanStage = 'catalog' | 'structure'
type AiAppMemoryScanOptions = {
  enumSketchSourceIds?: string[]
  targetSourceIds?: string[]
}

export type AiScannedSourceSnapshot = AiSourceMemory & {
  manifestKind: AiManifestSourceKind
  catalogFingerprint: string
  structureFingerprint: string
}

export type AiScannedAppSnapshot = {
  appId: string
  appName: string
  appKind: AiAppKind
  fingerprint: {
    metaHash: string
    bodyHash: string
    schemaHash: string
  }
  appSummary: {
    purpose: string
    domainKeywords: string[]
    answerBoundaries: string[]
  }
  viewProfile: AiAppViewProfile
  workflowProfile: AiWorkflowProfile
  sources: AiScannedSourceSnapshot[]
}

@Injectable()
export class AiAppMemoryScanner {
  constructor(
    private readonly projectService: ProjectService,
    private readonly localToolService: AiLocalToolService,
  ) {}

  async scanApp(
    appId: string,
    context: AiToolExecutionContext,
    stage: AiAppMemoryScanStage = 'catalog',
    options: AiAppMemoryScanOptions = {},
  ): Promise<AiScannedAppSnapshot> {
    this.throwIfAborted(context.signal)
    const [meta, body] = await Promise.all([
      this.projectService.getNocodeMeta(appId),
      this.projectService.getNocodeBody(appId),
    ])
    this.throwIfAborted(context.signal)

    const appName = String(meta?.name || appId).trim() || appId
    const tables = this.getTables(body)
    const tableMap = new Map(tables.map(table => [table.uid, table] as const))
    const viewProfile = this.scanViewProfile(body?.views, tableMap)
    const workflowProfile = this.scanWorkflowProfile(body, tables)
    const enumSketchSourceIds = this.normalizeIdSet(options.enumSketchSourceIds)
    const targetSourceIds = this.normalizeIdSet(options.targetSourceIds)
    const useTargetScope = targetSourceIds.size > 0
    const sourceDataProfiles = await this.scanSourceDataProfiles(
      appId,
      tables,
      viewProfile,
      workflowProfile,
      context,
      stage,
      enumSketchSourceIds,
      useTargetScope ? targetSourceIds : null,
    )
    this.throwIfAborted(context.signal)
    const sources = tables.map(table => this.buildSourceSnapshot(
      table,
      viewProfile,
      workflowProfile,
      stage,
      sourceDataProfiles.get(table.uid) || {
        rowCountBucket: 'unknown',
        viewTypes: this.getSourceViewTypes(table.uid, viewProfile),
        hasWorkflow: workflowProfile.sourceIds.includes(table.uid),
        enumSketches: [],
      },
    ))
    const scopedSources = useTargetScope
      ? sources.filter(source => targetSourceIds.has(source.sourceId))
      : sources
    const schemaPayload = tables.map(table => ({
      id: table.uid,
      name: table.alias,
      fields: this.getNonSystemFields(table).map(field => ({
        id: field.uid,
        name: field.alias,
        type: field.type,
        subType: field.meta?.subType,
        relatedTableId: this.getRelatedTableId(field),
      })),
    }))
    const fingerprint = {
      metaHash: md5(JSON.stringify({
        name: meta?.name || '',
        description: meta?.description || '',
      })),
      bodyHash: md5(JSON.stringify({
        structure: body?.structure || [],
        snapshot: body?.snapshot || null,
        metas: body?.formData?.metas || null,
        views: viewProfile,
        workflow: workflowProfile,
      })),
      schemaHash: md5(JSON.stringify(schemaPayload)),
    }

    return {
      appId,
      appName,
      appKind: resolveAiAppKind({
        sourceIndex: sources.map(source => ({
          sourceId: source.sourceId,
          kind: source.kind,
        })),
        viewProfile,
      }),
      fingerprint,
      appSummary: this.buildAppSummary(appName, scopedSources, viewProfile, workflowProfile),
      viewProfile,
      workflowProfile,
      sources: scopedSources,
    }
  }

  private getTables(body: any) {
    return (Array.isArray(body?.formData?.tables) ? body.formData.tables : [])
      .filter((table: any) => !table?.meta?.extra?.primaryTable) as Table[]
  }

  private getNonSystemFields(table: Table) {
    return (Array.isArray(table.fields) ? table.fields : []).filter(field => !isSystemField(field))
  }

  private buildSourceSnapshot(
    table: Table,
    viewProfile: AiAppViewProfile,
    workflowProfile: AiWorkflowProfile,
    stage: AiAppMemoryScanStage,
    dataProfile: AiSourceDataProfile,
  ): AiScannedSourceSnapshot {
    const fields = this.getNonSystemFields(table)
    const viewTypes = this.getSourceViewTypes(table.uid, viewProfile)
    const hasWorkflow = workflowProfile.sourceIds.includes(table.uid)
    const fieldItems = fields.map(field => ({
      id: String(field.uid || '').trim(),
      name: String(field.alias || field.uid || '').trim() || String(field.uid || ''),
      type: String(field.type || '').trim() || 'unknown',
      semanticType: this.buildFieldSemanticType(field),
      nullable: true,
      displayMeta: pickAiNumericDisplayMeta(field),
    }))
    const relations = stage === 'structure'
      ? fields
        .map(field => {
          const targetSourceId = this.getRelatedTableId(field)
          if (!targetSourceId) {
            return null
          }
          return {
            fieldId: String(field.uid || '').trim(),
            targetSourceId,
            relationType: targetSourceId === table.uid ? 'self' : 'one-to-many',
          } as const
        })
        .filter(Boolean)
      : []
    const queryHints = this.buildQueryHints(fields)
    const role = this.buildSourceRole(queryHints)
    const manifestKind: AiManifestSourceKind = viewTypes.includes('document')
      ? 'document-table'
      : 'table'
    const sourceName = String(table.alias || table.uid || '').trim() || table.uid
    const semanticSummary = {
      typicalQuestions: stage === 'structure'
        ? this.buildTypicalQuestions(sourceName, role, queryHints, viewTypes)
        : [],
      doNotUseFor: this.buildDoNotUseFor(viewTypes),
      observedSummary: '',
      observationNotes: [] as string[],
      evidenceCount: 0,
      confidence: stage === 'structure' ? (queryHints.entityFields.length || queryHints.metricFields.length || viewTypes.includes('document') ? 0.2 : 0.1) : 0,
      lastVerifiedAt: undefined,
    }
    const description = this.buildSourceDescription(
      sourceName,
      manifestKind,
      role,
      fieldItems.length,
      relations.length,
    )
    const catalogFingerprint = md5(JSON.stringify({
      sourceId: table.uid,
      sourceName,
      manifestKind,
      viewTypes,
      hasWorkflow,
      fields: fieldItems.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        semanticType: field.semanticType,
        displayMeta: field.displayMeta,
      })),
      queryHints,
    }))
    const structureFingerprint = md5(JSON.stringify({
      sourceId: table.uid,
      manifestKind,
      relations,
      dataProfile,
      semanticSummary,
    }))

    return {
      sourceId: table.uid,
      sourceName,
      kind: manifestKind,
      role,
      levels: {
        catalog: 'ready',
        structure: stage === 'structure' ? 'ready' : 'missing',
        semantic: stage === 'structure' ? 'partial' : 'missing',
      },
      catalogFingerprint,
      structureFingerprint,
      updatedAt: Date.now(),
      description,
      viewTypes,
      hasWorkflow,
      dataProfile: {
        ...dataProfile,
        viewTypes,
        hasWorkflow,
      },
      fields: fieldItems,
      relations,
      queryHints,
      semanticSummary,
      manifestKind,
    }
  }

  private buildAppSummary(
    appName: string,
    sources: AiScannedSourceSnapshot[],
    viewProfile: AiAppViewProfile,
    workflowProfile: AiWorkflowProfile,
  ) {
    const documentViewCount = viewProfile.documentViews.length
    const purposeParts = [
      `应用“${appName}”当前包含 ${sources.length} 个可读数据源，可用于记录查询、筛选、统计和聚合分析。`,
      documentViewCount ? `其中 ${documentViewCount} 个文档视图按底层表单记录处理。` : '',
      workflowProfile.hasWorkflow ? '流程状态和审批字段也可作为记录过滤条件。' : '',
    ].filter(Boolean)

    return {
      purpose: purposeParts.join(' '),
      domainKeywords: this.uniqueStrings([
        appName,
        ...sources.map(source => source.sourceName),
        ...viewProfile.documentViews.map(view => view.viewName),
        ...viewProfile.documentViews.map(view => view.sourceName),
      ]).slice(0, 24),
      answerBoundaries: this.uniqueStrings([
        '当前应用 AI 只查询表单记录和聚合数据。',
        documentViewCount ? AI_RECORDS_ONLY_DOCUMENT_VIEW_BOUNDARY : '',
        AI_RECORDS_ONLY_NON_RECORD_REDIRECT,
      ]).slice(0, 12),
    }
  }

  private buildQueryHints(fields: Field[]) {
    const keywordFields = new Set<string>()
    const filterFields = new Set<string>()
    const timeFields = new Set<string>()
    const metricFields = new Set<string>()
    const entityFields = new Set<string>()

    for (const field of fields) {
      const fieldId = String(field.uid || '').trim()
      const fieldType = String(field.type || '').trim().toLowerCase()
      const comparable = buildAiMetricFieldComparable(field)

      if (this.isKeywordField(fieldType, comparable)) {
        keywordFields.add(fieldId)
      }
      if (this.isTimeField(fieldType, comparable)) {
        timeFields.add(fieldId)
        filterFields.add(fieldId)
      }
      if (this.isMetricField(fieldType, comparable)) {
        metricFields.add(fieldId)
        filterFields.add(fieldId)
      }
      if (this.isEntityField(comparable)) {
        entityFields.add(fieldId)
        filterFields.add(fieldId)
      }
      if (fieldType === 'boolean' || comparable.includes('status') || comparable.includes('state') || comparable.includes('type')) {
        filterFields.add(fieldId)
      }
    }

    return {
      keywordFields: [...keywordFields],
      filterFields: [...filterFields],
      timeFields: [...timeFields],
      metricFields: [...metricFields],
      entityFields: [...entityFields],
    }
  }

  private buildTypicalQuestions(
    sourceName: string,
    role: AiSourceMemoryRole,
    queryHints: AiSourceMemory['queryHints'],
    viewTypes: AiAppViewType[],
  ) {
    if (viewTypes.includes('document')) {
      return [
        `Use ${sourceName} to read document-style records, statuses, and structured fields`,
        `Use ${sourceName} to filter or count document records instead of treating it as a full-text reading entry point`,
      ]
    }
    if (role === 'transaction') {
      return [
        `Use ${sourceName} for counts, trends, filters, and time-based summaries`,
        queryHints.entityFields.length ? `Use ${sourceName} to find records for a specific entity` : '',
      ].filter(Boolean)
    }
    if (role === 'master') {
      return [
        `Use ${sourceName} to look up core entities and their attributes`,
      ]
    }
    return [
      `Use ${sourceName} for time-oriented record lookup when no stronger source match exists`,
    ]
  }

  private buildDoNotUseFor(viewTypes: AiAppViewType[]) {
    if (viewTypes.includes('document')) {
      return ['Do not treat this source as a full-text reading entry point or long-form content index']
    }
    return ['Do not use this source when another source has clearer business-entity alignment']
  }

  private buildSourceDescription(
    sourceName: string,
    manifestKind: AiManifestSourceKind,
    role: AiSourceMemoryRole,
    fieldCount: number,
    relationCount: number,
  ) {
    const kindLabel = manifestKind === 'document-table'
      ? 'document-view-backed'
      : role
    return `${sourceName} is a ${kindLabel} record source with ${fieldCount} fields and ${relationCount} relation edges.`
  }

  private buildFieldSemanticType(field: Field) {
    const comparable = buildAiMetricFieldComparable(field)
    const fieldType = String(field.type || '').trim().toLowerCase()
    if (this.isTimeField(fieldType, comparable)) {
      return 'time'
    }
    if (this.isMetricField(fieldType, comparable)) {
      return 'metric'
    }
    if (this.isEntityField(comparable)) {
      return 'entity'
    }
    if (this.isKeywordField(fieldType, comparable)) {
      return 'keyword'
    }
    if (this.getRelatedTableId(field)) {
      return 'relation'
    }
    return ''
  }

  private buildSourceRole(
    queryHints: Pick<AiSourceMemory['queryHints'], 'timeFields' | 'metricFields' | 'entityFields'>,
  ): AiSourceMemoryRole {
    if (queryHints.timeFields.length && (queryHints.metricFields.length || queryHints.entityFields.length)) {
      return 'transaction'
    }
    if (queryHints.timeFields.length) {
      return 'log'
    }
    return 'master'
  }

  private async scanSourceDataProfiles(
    appId: string,
    tables: Table[],
    viewProfile: AiAppViewProfile,
    workflowProfile: AiWorkflowProfile,
    context: AiToolExecutionContext,
    stage: AiAppMemoryScanStage,
    enumSketchSourceIds: Set<string>,
    targetSourceIds: Set<string> | null,
  ) {
    const result = new Map<string, AiSourceDataProfile>()
    const workflowSourceIds = new Set(workflowProfile.sourceIds)
    for (const table of tables) {
      this.throwIfAborted(context.signal)
      const fallbackProfile: AiSourceDataProfile = {
        rowCountBucket: 'unknown',
        viewTypes: this.getSourceViewTypes(table.uid, viewProfile),
        hasWorkflow: workflowSourceIds.has(table.uid),
        enumSketches: [],
      }
      if (stage !== 'structure') {
        result.set(table.uid, fallbackProfile)
        continue
      }
      if (targetSourceIds && !targetSourceIds.has(table.uid)) {
        result.set(table.uid, fallbackProfile)
        continue
      }
      try {
        const includeEnumSketches = enumSketchSourceIds.has(table.uid)
        const profile = await this.localToolService.inspectSourceDataProfile(appId, table.uid, {
          viewTypes: fallbackProfile.viewTypes || [],
          hasWorkflow: fallbackProfile.hasWorkflow,
          fields: this.getNonSystemFields(table),
          includeEnumSketches,
        }, context)
        this.throwIfAborted(context.signal)
        result.set(table.uid, {
          ...fallbackProfile,
          ...profile,
          viewTypes: profile?.viewTypes || fallbackProfile.viewTypes,
          hasWorkflow: typeof profile?.hasWorkflow === 'boolean' ? profile.hasWorkflow : fallbackProfile.hasWorkflow,
          enumSketches: includeEnumSketches && Array.isArray(profile?.enumSketches)
            ? profile.enumSketches
            : fallbackProfile.enumSketches,
        })
      } catch {
        this.throwIfAborted(context.signal)
        result.set(table.uid, fallbackProfile)
      }
    }
    return result
  }

  private throwIfAborted(signal?: AbortSignal) {
    if (!signal?.aborted) {
      return
    }
    const error = new Error('This operation was aborted')
    error.name = 'AbortError'
    throw error
  }

  private normalizeIdSet(values?: string[]) {
    return new Set(
      (Array.isArray(values) ? values : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )
  }

  private scanViewProfile(rawViews: Record<string, any>, tableMap: Map<string, Table>): AiAppViewProfile {
    const documentViews: AiAppViewProfile['documentViews'] = []
    const formViewSourceIds = new Set<string>()
    const tableViewSourceIds = new Set<string>()

    Object.entries(rawViews || {}).forEach(([sourceId, views]) => {
      const sourceTable = tableMap.get(sourceId)
      if (!sourceTable || !Array.isArray(views)) {
        return
      }
      views.forEach((view: any) => {
        const viewType = String(view?.type || '').trim() as AiAppViewType
        if (viewType === 'document') {
          const contract = this.buildDocumentContractFromView(sourceTable, view, tableMap)
          if (!contract) {
            return
          }
          documentViews.push({
            viewId: String(view?.uid || '').trim() || `${sourceId}:document`,
            viewName: String(view?.name || sourceTable.alias || sourceTable.uid || '').trim() || 'Document View',
            sourceId,
            sourceName: String(sourceTable.alias || sourceTable.uid || '').trim() || sourceTable.uid,
            contract,
          })
          return
        }
        if (viewType === 'form') {
          formViewSourceIds.add(sourceId)
          return
        }
        if (viewType === 'table') {
          tableViewSourceIds.add(sourceId)
        }
      })
    })

    const summaryParts = [
      documentViews.length ? `${documentViews.length} 个文档视图` : '',
      formViewSourceIds.size ? `${formViewSourceIds.size} 个表单视图` : '',
      tableViewSourceIds.size ? `${tableViewSourceIds.size} 个表格视图` : '',
    ].filter(Boolean)

    return {
      summary: summaryParts.length
        ? `当前应用显式声明了 ${summaryParts.join('、')}。`
        : '当前应用没有显式声明文档/表单视图契约。',
      documentViews,
      formViewSourceIds: [...formViewSourceIds],
      tableViewSourceIds: [...tableViewSourceIds],
    }
  }

  private scanWorkflowProfile(body: any, tables: Table[]): AiWorkflowProfile {
    const workflowSourceIds = tables
      .filter(table => {
        const process = body?.formData?.formOptions?.[table.uid]?.process
        const flows = getFlows(process)
        return Boolean(process?.enabled && Array.isArray(flows?.[0]?.branches) && flows[0].branches.length)
      })
      .map(table => table.uid)
    return {
      hasWorkflow: workflowSourceIds.length > 0,
      sourceIds: workflowSourceIds,
      summary: workflowSourceIds.length
        ? `当前应用中有 ${workflowSourceIds.length} 个数据源启用了显式流程配置。`
        : '当前应用中未检测到启用的显式流程配置。',
    }
  }

  private buildDocumentContractFromView(sourceTable: Table, view: any, tableMap: Map<string, Table>): AiDocumentContract | null {
    const titleField = this.findFieldById(sourceTable, String(view?.titleFieldUID || '').trim())
    const contentField = this.findFieldById(sourceTable, String(view?.contentFieldUID || '').trim())
    const catalogField = this.findFieldById(sourceTable, String(view?.catalogFieldUID || '').trim())
    const directorySourceId = this.getRelatedTableId(catalogField)
    const directoryTable = tableMap.get(directorySourceId)
    if (!titleField || !contentField || !catalogField || !directoryTable) {
      return null
    }
    const catalogTitleFieldId = String(view?.catalogTitleFieldUID || '').trim()
      || String(this.pickBestTitleField(directoryTable)?.uid || '').trim()
    const publishedFieldId = String(this.pickBestPublishedField(sourceTable)?.uid || '').trim() || undefined
    return {
      source: 'explicit-view',
      viewId: String(view?.uid || '').trim() || undefined,
      sourceId: sourceTable.uid,
      sourceName: String(sourceTable.alias || sourceTable.uid || '').trim() || sourceTable.uid,
      directorySourceId,
      directorySourceName: String(directoryTable.alias || directoryTable.uid || '').trim() || directoryTable.uid,
      titleFieldId: String(titleField.uid || '').trim(),
      catalogFieldId: String(catalogField.uid || '').trim(),
      catalogTitleFieldId: catalogTitleFieldId || undefined,
      contentFieldId: String(contentField.uid || '').trim(),
      publishedFieldId,
    }
  }

  private getSourceViewTypes(sourceId: string, viewProfile: AiAppViewProfile) {
    const viewTypes = new Set<AiAppViewType>()
    if (viewProfile.documentViews.some(view => view.sourceId === sourceId)) {
      viewTypes.add('document')
    }
    if (viewProfile.formViewSourceIds.includes(sourceId)) {
      viewTypes.add('form')
    }
    if (viewProfile.tableViewSourceIds.includes(sourceId)) {
      viewTypes.add('table')
    }
    return [...viewTypes]
  }

  private findFieldById(table: Table | undefined, fieldId: string) {
    if (!table || !fieldId) {
      return null
    }
    return this.getNonSystemFields(table).find(field => String(field.uid || '').trim() === fieldId) || null
  }

  private pickBestTitleField(table: Table) {
    const candidates = this.getNonSystemFields(table)
      .map(field => ({
        field,
        score: this.scoreTitleFieldCandidate(field),
      }))
      .filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score)
    return candidates[0]?.field || null
  }

  private pickBestPublishedField(table: Table) {
    const candidates = this.getNonSystemFields(table)
      .map(field => ({
        field,
        score: this.scorePublishedFieldCandidate(field),
      }))
      .filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score)
    return candidates[0]?.field || null
  }

  private scoreTitleFieldCandidate(field: Field) {
    const comparable = `${field.alias || ''} ${field.uid || ''}`.toLowerCase()
    const fieldType = String(field.type || '').trim().toLowerCase()
    if (fieldType !== 'string' && fieldType !== 'text') {
      return 0
    }
    let score = 1
    if (comparable.includes('title') || comparable.includes('name') || comparable.includes('标题') || comparable.includes('名称')) {
      score += 4
    }
    return score
  }

  private scorePublishedFieldCandidate(field: Field) {
    const comparable = `${field.alias || ''} ${field.uid || ''}`.toLowerCase()
    const fieldType = String(field.type || '').trim().toLowerCase()
    let score = 0
    if (fieldType === 'boolean') {
      score += 2
    }
    if (comparable.includes('publish') || comparable.includes('发布') || comparable.includes('上线')) {
      score += 4
    }
    return score
  }

  private uniqueStrings(values: Array<string | null | undefined>) {
    return [...new Set(
      values
        .map(item => String(item || '').trim())
        .filter(Boolean),
    )]
  }

  private getRelatedTableId(field: Field | null | undefined) {
    const relatedTableUID = field?.meta?.extra?.relatedTableUID
    return Array.isArray(relatedTableUID) ? String(relatedTableUID[1] || '').trim() : ''
  }

  private isKeywordField(fieldType: string, comparable: string) {
    return (
      fieldType === 'string'
      || fieldType === 'text'
      || comparable.includes('title')
      || comparable.includes('name')
      || comparable.includes('content')
      || comparable.includes('desc')
      || comparable.includes('备注')
      || comparable.includes('标题')
      || comparable.includes('内容')
      || comparable.includes('名称')
    )
  }

  private isTimeField(fieldType: string, comparable: string) {
    return (
      fieldType === 'date'
      || fieldType === 'datetime'
      || comparable.includes('time')
      || comparable.includes('date')
      || comparable.includes('create')
      || comparable.includes('update')
      || comparable.includes('时间')
      || comparable.includes('日期')
      || comparable.includes('创建')
      || comparable.includes('更新')
    )
  }

  private isMetricField(fieldType: string, comparable: string) {
    return isAiMetricFieldByParts(fieldType, comparable)
  }

  private isEntityField(comparable: string) {
    return (
      comparable.includes('name')
      || comparable.includes('user')
      || comparable.includes('member')
      || comparable.includes('dept')
      || comparable.includes('project')
      || comparable.includes('customer')
      || comparable.includes('vendor')
      || comparable.includes('编号')
      || comparable.includes('名称')
      || comparable.includes('人员')
      || comparable.includes('部门')
      || comparable.includes('项目')
      || comparable.includes('客户')
      || comparable.includes('供应商')
    )
  }
}
