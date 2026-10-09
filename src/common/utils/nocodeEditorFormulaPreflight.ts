import type {
  NocodeEditorFormulaPath,
  NocodeEditorFormulaPlan,
  NocodeEditorFormulaPlanItem,
  NocodeEditorFormulaPreflightIssue,
  NocodeEditorFormulaSpec,
  NocodeEditorResolvedFormulaWrite,
} from '@common/types/nocodeEditorFormula'
import {
  collectNocodeEditorFormulaReferenceWidgetIds,
  resolveNocodeEditorFormulaReferences,
  type NocodeEditorFormulaFieldBinding,
} from './nocodeEditorFormulaReference'

export type NocodeEditorFormulaPreflightForm = {
  formKey?: string
  formName?: string
  tableId: string
  fields: NocodeEditorFormulaFieldBinding[]
}

type ResolvedTarget = {
  form: NocodeEditorFormulaPreflightForm
  field: NocodeEditorFormulaFieldBinding
}

type CandidateWrite = {
  item: NocodeEditorFormulaPlanItem
  setting: NocodeEditorFormulaSpec
  target: ResolvedTarget
  formulaPath: NocodeEditorFormulaPath
  formula: string
  referencedWidgetIds: string[]
  blocked: boolean
}

const SUPPORTED_FORMULA_PATHS = new Set<NocodeEditorFormulaPath>([
  'default-formula',
  'compute-formula',
])

const normalizeText = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
)

const createIssue = (input: {
  code: string
  item: NocodeEditorFormulaPlanItem
  message: string
  userActionRequired?: boolean
}): NocodeEditorFormulaPreflightIssue => ({
  code: input.code,
  severity: 'blocking',
  itemKey: input.item.itemKey,
  target: input.item.target,
  message: input.message,
  userActionRequired: input.userActionRequired === true,
})

const resolveTarget = (input: {
  item: NocodeEditorFormulaPlanItem
  forms: NocodeEditorFormulaPreflightForm[]
}): ResolvedTarget[] => {
  const formKey = normalizeText(input.item.target.formKey)
  const formName = normalizeText(input.item.target.formName)
  const fieldKey = normalizeText(input.item.target.fieldKey)
  const fieldName = normalizeText(input.item.target.fieldName)

  return input.forms.flatMap(form => {
    if (formKey && normalizeText(form.formKey) !== formKey) return []
    if (formName && normalizeText(form.formName) !== formName) return []

    return (Array.isArray(form.fields) ? form.fields : [])
      .filter(field => (
        fieldKey
          ? normalizeText(field.fieldKey) === fieldKey
          : normalizeText(field.fieldName) === fieldName
      ))
      .map(field => ({ form, field }))
  })
}

const buildTargetNodeKey = (target: ResolvedTarget) => (
  `${target.form.tableId}:${target.field.widgetId}`
)

const buildTargetWriteKey = (write: CandidateWrite) => JSON.stringify([
  write.target.form.tableId,
  write.target.field.widgetId,
  write.formulaPath,
])

const findCycleNodes = (writes: CandidateWrite[]): Set<string> => {
  const activeWrites = writes.filter(write => !write.blocked)
  const nodes = Array.from(new Set(activeWrites.map(write => buildTargetNodeKey(write.target)))).sort()
  const nodeSet = new Set(nodes)
  const adjacency = new Map(nodes.map(node => [node, new Set<string>()]))

  for (const write of activeWrites) {
    const source = buildTargetNodeKey(write.target)
    for (const widgetId of write.referencedWidgetIds) {
      const target = `${write.target.form.tableId}:${widgetId}`
      if (nodeSet.has(target) && target !== source) {
        adjacency.get(source)?.add(target)
      }
    }
  }

  let index = 0
  const indexes = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const stack: string[] = []
  const stackNodes = new Set<string>()
  const cycleNodes = new Set<string>()

  const visit = (node: string) => {
    indexes.set(node, index)
    lowLinks.set(node, index)
    index += 1
    stack.push(node)
    stackNodes.add(node)

    for (const next of Array.from(adjacency.get(node) || []).sort()) {
      if (!indexes.has(next)) {
        visit(next)
        lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(next)!))
      } else if (stackNodes.has(next)) {
        lowLinks.set(node, Math.min(lowLinks.get(node)!, indexes.get(next)!))
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) return

    const component: string[] = []
    let componentNode = ''
    do {
      componentNode = stack.pop()!
      stackNodes.delete(componentNode)
      component.push(componentNode)
    } while (componentNode !== node)

    if (component.length > 1) {
      component.forEach(componentItem => cycleNodes.add(componentItem))
    }
  }

  nodes.forEach(node => {
    if (!indexes.has(node)) visit(node)
  })
  return cycleNodes
}

export const preflightNocodeEditorFormulaPlan = (input: {
  plan: NocodeEditorFormulaPlan
  forms: NocodeEditorFormulaPreflightForm[]
}): {
  resolvedWrites: NocodeEditorResolvedFormulaWrite[]
  issues: NocodeEditorFormulaPreflightIssue[]
} => {
  const issues: NocodeEditorFormulaPreflightIssue[] = []
  const writes: CandidateWrite[] = []
  const forms = Array.isArray(input.forms) ? input.forms : []

  for (const item of input.plan?.items || []) {
    const targets = resolveTarget({ item, forms })
    if (targets.length !== 1) {
      issues.push(createIssue({
        code: targets.length ? 'target_ambiguous' : 'target_not_found',
        item,
        message: targets.length
          ? '公式目标匹配到多个字段，需要用户选择具体目标。'
          : '未找到公式目标字段。',
        userActionRequired: targets.length > 1,
      }))
      continue
    }

    const target = targets[0]
    const settings = Array.isArray(item.formulaSettings) ? item.formulaSettings : []
    const duplicatePaths = new Set<string>()
    const seenPaths = new Set<string>()
    for (const setting of settings) {
      const formulaPath = normalizeText(setting?.formulaPath)
      if (seenPaths.has(formulaPath)) {
        duplicatePaths.add(formulaPath)
      }
      seenPaths.add(formulaPath)
    }

    const reportedDuplicatePaths = new Set<string>()
    for (const setting of settings) {
      const formulaPath = normalizeText(setting?.formulaPath)
      if (duplicatePaths.has(formulaPath)) {
        if (!reportedDuplicatePaths.has(formulaPath)) {
          issues.push(createIssue({
            code: 'formula_path_unsupported',
            item,
            message: `公式路径 ${formulaPath || '未知路径'} 在同一目标中重复。`,
          }))
          reportedDuplicatePaths.add(formulaPath)
        }
        continue
      }

      if (typeof setting?.formula !== 'string' || !setting.formula.trim()) {
        issues.push(createIssue({
          code: 'formula_invalid',
          item,
          message: '公式必须是非空字符串。',
        }))
        continue
      }

      if (
        !SUPPORTED_FORMULA_PATHS.has(formulaPath as NocodeEditorFormulaPath)
        || !target.field.formulaPaths.includes(formulaPath as NocodeEditorFormulaPath)
      ) {
        issues.push(createIssue({
          code: 'formula_path_unsupported',
          item,
          message: `目标字段不支持公式路径 ${formulaPath || '未知路径'}。`,
        }))
        continue
      }

      const referenceResult = resolveNocodeEditorFormulaReferences({
        item,
        setting,
        bindings: target.form.fields,
      })
      if (!referenceResult.formula) {
        issues.push(...referenceResult.issues)
        continue
      }

      const referencedWidgetIds = collectNocodeEditorFormulaReferenceWidgetIds({
        item,
        setting,
        bindings: target.form.fields,
      })
      if (referencedWidgetIds.includes(target.field.widgetId)) {
        issues.push(createIssue({
          code: 'self_reference',
          item,
          message: '公式不能直接引用自身字段。',
        }))
        continue
      }

      writes.push({
        item,
        setting,
        target,
        formulaPath: formulaPath as NocodeEditorFormulaPath,
        formula: referenceResult.formula,
        referencedWidgetIds,
        blocked: false,
      })
    }
  }

  const writesByTarget = new Map<string, CandidateWrite[]>()
  for (const write of writes) {
    const writeKey = buildTargetWriteKey(write)
    const candidates = writesByTarget.get(writeKey) || []
    candidates.push(write)
    writesByTarget.set(writeKey, candidates)
  }
  for (const candidates of writesByTarget.values()) {
    if (candidates.length < 2) continue

    for (const write of candidates) {
      write.blocked = true
      issues.push(createIssue({
        code: 'target_write_conflict',
        item: write.item,
        message: '多个公式方案会写入同一目标字段和公式路径。',
      }))
    }
  }

  const cycleNodes = findCycleNodes(writes)
  const reportedCycleItems = new Set<string>()
  for (const write of writes) {
    if (!cycleNodes.has(buildTargetNodeKey(write.target))) continue
    write.blocked = true
    if (reportedCycleItems.has(write.item.itemKey)) continue

    issues.push(createIssue({
      code: 'cyclic_dependency',
      item: write.item,
      message: '公式字段之间存在循环依赖。',
    }))
    reportedCycleItems.add(write.item.itemKey)
  }

  return {
    resolvedWrites: writes
      .filter(write => !write.blocked)
      .map(write => ({
        itemKey: write.item.itemKey,
        tableId: write.target.form.tableId,
        ...(normalizeText(write.target.form.formName) ? { tableName: write.target.form.formName } : {}),
        widgetId: write.target.field.widgetId,
        fieldName: write.target.field.fieldName,
        formulaPath: write.formulaPath,
        formula: write.formula,
        ...(normalizeText(write.setting.explanation) ? { explanation: write.setting.explanation } : {}),
      })),
    issues,
  }
}
