import { Injectable } from '@nestjs/common'
import {
  AiAppMemoryManifest,
  AiMemoryChangeSeverity,
  AiMemoryDiffPlan,
  AiSourceEnumSketch,
  AiSourceMemory,
} from '../ai.types'
import { AiAppMemoryScanStage, AiScannedAppSnapshot, AiScannedSourceSnapshot } from './ai-app-memory.scanner'

export const AI_APP_MEMORY_VERSION = 'thread-memory-v9'

@Injectable()
export class AiAppMemoryDiffService {
  plan(
    snapshot: AiScannedAppSnapshot,
    manifest: AiAppMemoryManifest | null,
    stage: AiAppMemoryScanStage,
    options: {
      existingSources?: Map<string, AiSourceMemory | null>
    } = {},
  ): AiMemoryDiffPlan {
    if (!manifest) {
      return {
        appId: snapshot.appId,
        mode: 'rebuild',
        reasons: ['manifest_missing'],
        changedSources: snapshot.sources.map(item => item.sourceId),
        removedSources: [],
        sourceDiffs: snapshot.sources.map(item => ({
          sourceId: item.sourceId,
          severity: 'additive' as const,
          reasons: ['source_new'],
        })),
      }
    }

    if (manifest.version !== AI_APP_MEMORY_VERSION) {
      return {
        appId: snapshot.appId,
        mode: 'rebuild',
        reasons: ['manifest_version_mismatch'],
        changedSources: snapshot.sources.map(item => item.sourceId),
        removedSources: manifest.sourceIndex.map(item => item.sourceId),
        sourceDiffs: snapshot.sources.map(item => ({
          sourceId: item.sourceId,
          severity: 'breaking' as const,
          reasons: ['manifest_version_mismatch'],
        })),
      }
    }

    const sourceDiffs = snapshot.sources.map(source => this.diffSource(
      source,
      manifest,
      stage,
      options.existingSources?.get(source.sourceId) || null,
    ))
    const nextSourceIds = new Set(snapshot.sources.map(item => item.sourceId))
    const removedSources = manifest.sourceIndex
      .filter(item => !nextSourceIds.has(item.sourceId))
      .map(item => item.sourceId)
    const changedSources = sourceDiffs
      .filter(item => item.severity !== 'none')
      .map(item => item.sourceId)
    const fingerprintChanged = (
      manifest.fingerprint.metaHash !== snapshot.fingerprint.metaHash
      || manifest.fingerprint.bodyHash !== snapshot.fingerprint.bodyHash
      || manifest.fingerprint.schemaHash !== snapshot.fingerprint.schemaHash
    )
    const reasons = [
      fingerprintChanged ? 'app_fingerprint_changed' : '',
      changedSources.length ? `${stage}_source_changed` : '',
      removedSources.length ? 'source_removed' : '',
    ].filter(Boolean)

    return {
      appId: snapshot.appId,
      mode: reasons.length ? 'patch' : 'noop',
      reasons,
      changedSources,
      removedSources,
      sourceDiffs,
    }
  }

  private diffSource(
    nextSource: AiScannedSourceSnapshot,
    manifest: AiAppMemoryManifest,
    stage: AiAppMemoryScanStage,
    previousMemory: AiSourceMemory | null,
  ) {
    const previousIndex = manifest.sourceIndex.find(item => item.sourceId === nextSource.sourceId)
    if (!previousIndex || !previousMemory) {
      return {
        sourceId: nextSource.sourceId,
        severity: 'additive' as const,
        reasons: ['source_new'],
      }
    }

    const fieldDiff = this.diffFields(previousMemory, nextSource)
    const reasons: string[] = []
    let severity: AiMemoryChangeSeverity = 'none'

    if (fieldDiff.removedFieldIds.length) {
      severity = 'breaking'
      reasons.push(`field_removed:${fieldDiff.removedFieldIds.join(',')}`)
    }
    if (fieldDiff.changedFieldTypeIds.length) {
      severity = 'breaking'
      reasons.push(`field_type_changed:${fieldDiff.changedFieldTypeIds.join(',')}`)
    }
    if (!reasons.length && fieldDiff.addedFieldIds.length) {
      severity = 'additive'
      reasons.push(`field_added:${fieldDiff.addedFieldIds.join(',')}`)
    }
    if (!reasons.length && fieldDiff.renamedFieldIds.length) {
      severity = 'meta'
      reasons.push(`field_renamed:${fieldDiff.renamedFieldIds.join(',')}`)
    }
    if (!reasons.length && fieldDiff.changedFieldDisplayMetaIds.length) {
      severity = 'meta'
      reasons.push(`field_display_meta_changed:${fieldDiff.changedFieldDisplayMetaIds.join(',')}`)
    }
    if (!reasons.length && previousMemory.sourceName !== nextSource.sourceName) {
      severity = 'meta'
      reasons.push('source_name_changed')
    }

    if (stage === 'structure') {
      const previousRelationSignature = this.buildRelationSignature(previousMemory.relations)
      const nextRelationSignature = this.buildRelationSignature(nextSource.relations)
      if (previousMemory.kind !== nextSource.kind) {
        severity = 'breaking'
        reasons.push('source_kind_changed')
      }
      if (previousMemory.role !== nextSource.role) {
        severity = 'breaking'
        reasons.push('source_role_changed')
      }
      const previousViewTypes = JSON.stringify(previousMemory.viewTypes || [])
      const nextViewTypes = JSON.stringify(nextSource.viewTypes || [])
      if (!reasons.length && previousViewTypes !== nextViewTypes) {
        severity = 'meta'
        reasons.push('source_view_profile_changed')
      }
      if (!reasons.length && Boolean(previousMemory.hasWorkflow) !== Boolean(nextSource.hasWorkflow)) {
        severity = 'breaking'
        reasons.push('source_workflow_profile_changed')
      }
      if (!reasons.length && String(previousMemory.dataProfile?.rowCountBucket || 'unknown') !== String(nextSource.dataProfile?.rowCountBucket || 'unknown')) {
        severity = 'additive'
        reasons.push('source_row_count_bucket_changed')
      }
      const previousEnumSketchSignature = this.buildEnumSketchSignature(previousMemory.dataProfile?.enumSketches)
      const nextEnumSketchSignature = this.buildEnumSketchSignature(nextSource.dataProfile?.enumSketches)
      if (!reasons.length && previousEnumSketchSignature !== nextEnumSketchSignature) {
        severity = 'additive'
        reasons.push('source_enum_sketch_changed')
      }
      if (previousRelationSignature !== nextRelationSignature) {
        severity = 'breaking'
        reasons.push('source_relations_changed')
      }

      const hintDiff = this.diffHints(previousMemory, nextSource)
      if (!reasons.length && hintDiff.lostCriticalHints.length) {
        severity = 'breaking'
        reasons.push(`source_hints_lost:${hintDiff.lostCriticalHints.join(',')}`)
      }
      if (!reasons.length && hintDiff.gainedHints.length) {
        severity = severity === 'none' ? 'additive' : severity
        reasons.push(`source_hints_gained:${hintDiff.gainedHints.join(',')}`)
      }
      if (!reasons.length && previousMemory.levels.structure !== 'ready') {
        severity = 'additive'
        reasons.push('structure_not_ready')
      }
    }

    return {
      sourceId: nextSource.sourceId,
      severity,
      reasons,
    }
  }

  private diffFields(previousMemory: AiSourceMemory, nextSource: AiScannedSourceSnapshot) {
    const previousFields = Array.isArray(previousMemory.fields) ? previousMemory.fields : []
    const nextFields = Array.isArray(nextSource.fields) ? nextSource.fields : []
    const previousById = new Map(previousFields.map(field => [field.id, field] as const))
    const nextById = new Map(nextFields.map(field => [field.id, field] as const))
    const removedFieldIds = previousFields
      .filter(field => !nextById.has(field.id))
      .map(field => field.id)
    const addedFieldIds = nextFields
      .filter(field => !previousById.has(field.id))
      .map(field => field.id)
    const renamedFieldIds = nextFields
      .filter(field => previousById.has(field.id) && previousById.get(field.id)?.name !== field.name)
      .map(field => field.id)
    const changedFieldTypeIds = nextFields
      .filter(field => previousById.has(field.id) && previousById.get(field.id)?.type !== field.type)
      .map(field => field.id)
    const changedFieldDisplayMetaIds = nextFields
      .filter(field =>
        previousById.has(field.id)
        && JSON.stringify(previousById.get(field.id)?.displayMeta || null) !== JSON.stringify(field.displayMeta || null),
      )
      .map(field => field.id)

    return {
      removedFieldIds,
      addedFieldIds,
      renamedFieldIds,
      changedFieldTypeIds,
      changedFieldDisplayMetaIds,
    }
  }

  private diffHints(previousMemory: AiSourceMemory, nextSource: AiScannedSourceSnapshot) {
    const previousHints = previousMemory.queryHints || {
      keywordFields: [],
      filterFields: [],
      timeFields: [],
      metricFields: [],
      entityFields: [],
    }
    const nextHints = nextSource.queryHints || previousHints
    const criticalKeys = ['timeFields', 'metricFields', 'entityFields'] as const
    const lostCriticalHints: string[] = []
    const gainedHints: string[] = []

    criticalKeys.forEach(key => {
      const previousSet = new Set(previousHints[key] || [])
      const nextSet = new Set(nextHints[key] || [])
      previousSet.forEach(value => {
        if (!nextSet.has(value)) {
          lostCriticalHints.push(`${key}:${value}`)
        }
      })
      nextSet.forEach(value => {
        if (!previousSet.has(value)) {
          gainedHints.push(`${key}:${value}`)
        }
      })
    })

    return {
      lostCriticalHints,
      gainedHints,
    }
  }

  private buildRelationSignature(relations: AiSourceMemory['relations']) {
    return JSON.stringify(
      (Array.isArray(relations) ? relations : [])
        .map(item => ({
          fieldId: item.fieldId,
          targetSourceId: item.targetSourceId,
          relationType: item.relationType,
        }))
        .sort((left, right) =>
          left.fieldId.localeCompare(right.fieldId, 'zh-CN')
          || left.targetSourceId.localeCompare(right.targetSourceId, 'zh-CN')
          || left.relationType.localeCompare(right.relationType, 'zh-CN'),
        ),
    )
  }

  private buildEnumSketchSignature(enumSketches?: AiSourceEnumSketch[]) {
    return JSON.stringify(
      (Array.isArray(enumSketches) ? enumSketches : [])
        .map(item => ({
          fieldId: item.fieldId,
          fieldName: item.fieldName,
          values: item.values,
          sampleSize: item.sampleSize,
          truncated: item.truncated,
        }))
        .sort((left, right) => left.fieldId.localeCompare(right.fieldId, 'zh-CN')),
    )
  }
}
