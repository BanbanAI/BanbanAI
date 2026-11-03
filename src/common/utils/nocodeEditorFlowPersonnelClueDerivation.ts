import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeStep,
} from './nocodeEditorFlowScheme'
import type {
  NocodeEditorFlowPersonnelRef,
  NocodeEditorFlowPersonnelRequirement,
} from './nocodeEditorFlowPersonnel'
import {
  normalizeNocodeEditorFlowPersonnelRequirement,
} from './nocodeEditorFlowPersonnel'
import {
  isFlowPersonnelStepKind,
} from './nocodeEditorFlowDecisionIdentity'
import {
  resolveNocodeEditorFlowPersonnelSourceAnchor,
} from './nocodeEditorFlowPersonnelSourceAnchor'
import type {
  NocodeEditorFlowPersonnelSourceAnchor,
  NocodeEditorFlowPersonnelSourceEvidence,
} from './nocodeEditorFlowPersonnelSourceAnchor'

export type FlowPersonnelClueDerivation = {
  requirement: NocodeEditorFlowPersonnelRequirement
  sourceType: NocodeEditorFlowPersonnelRequirement['sourceType']
  matchedText: string
  /** 来源已定但缺层级：应只问层级 */
  needsLevel: boolean
}

export type FlowPersonnelClueDerivationEntry = {
  stepKey: string
  sourceType: NocodeEditorFlowPersonnelRequirement['sourceType']
  matchedText: string
  needsLevel: boolean
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .normalize('NFKC')
  .replace(/[\s_.\-·、，,]+/g, '')
  .toLocaleLowerCase()

const isSameToken = (left: unknown, right: unknown) => {
  const normalizedLeft = normalizeToken(left)
  const normalizedRight = normalizeToken(right)
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}

// 防回声：节点标题/意图/actorHint 是模型自己起的名字，只有用户原话或已确认结论里
// 真的出现过同一线索，才能把“财务角色”当成对象已定。
const isClueEchoedBySupportTexts = (input: {
  matchedText: string
  supportTexts: string[]
}) => {
  const token = normalizeToken(input.matchedText)
  if (!token) {
    return false
  }
  return input.supportTexts.some(text => normalizeToken(text).includes(token))
}

const toRef = (item: { id?: string; name?: string }): NocodeEditorFlowPersonnelRef => {
  const id = normalizeText(item.id)
  const name = normalizeText(item.name)
  return {
    ...(id ? { id } : {}),
    ...(name ? { name } : {}),
  }
}

// 只按证据里的真实对象落位：同一名字同时对应多个角色/成员视为歧义，
// 只说了“指定成员/角色”却没点名对象时不落位（继续来源题）。
const resolveFixedObjectRequirement = (input: {
  matchedText: string
  evidence?: NocodeEditorFlowPersonnelSourceEvidence | null
}): Pick<NocodeEditorFlowPersonnelRequirement, 'sourceType' | 'roleRefs' | 'userRefs'> | null => {
  const roles = (input.evidence?.roles || []).filter(item => isSameToken(item.name, input.matchedText))
  const users = (input.evidence?.users || []).filter(item => isSameToken(item.name, input.matchedText))
  if (roles.length + users.length !== 1) {
    return null
  }
  return roles.length
    ? { sourceType: 'fixed_roles', roleRefs: [toRef(roles[0])] }
    : { sourceType: 'fixed_users', userRefs: [toRef(users[0])] }
}

const resolveFieldName = (names: string[] | undefined, matchedText: string) => (
  (names || []).find(name => isSameToken(name, matchedText)) || ''
)

const buildClueRequirement = (input: {
  anchor: NocodeEditorFlowPersonnelSourceAnchor
  evidence?: NocodeEditorFlowPersonnelSourceEvidence | null
}): NocodeEditorFlowPersonnelRequirement | null => {
  switch (input.anchor.optionValue) {
    case 'submitter':
      return { sourceType: 'submitter' }
    case 'department_manager':
      // 层级由后续层级题补齐，来源本身已经确定。
      return { sourceType: 'department_manager' }
    case 'assignee':
      return resolveFixedObjectRequirement({
        matchedText: input.anchor.matchedText,
        evidence: input.evidence,
      })
    case 'form_member_field': {
      const fieldName = resolveFieldName(input.evidence?.memberFieldNames, input.anchor.matchedText)
      return fieldName
        ? { sourceType: 'form_member', fieldRef: { fieldName, expectedType: 'memberSelect' } }
        : null
    }
    case 'form_department_field': {
      const fieldName = resolveFieldName(input.evidence?.departmentFieldNames, input.anchor.matchedText)
      return fieldName
        ? { sourceType: 'form_department', fieldRef: { fieldName, expectedType: 'departmentSelect' } }
        : null
    }
    default:
      return null
  }
}

// 对象已由“节点线索 + 组织/表单证据”唯一确定时直接给出人员配置；
// 只有对象多义、证据无唯一对应，或线索仅是模型自己的标题回声时才返回 null。
export const resolveFlowPersonnelRequirementFromClues = (input: {
  step: Pick<NocodeEditorFlowSchemeStep, 'key' | 'kind' | 'title' | 'intent' | 'actorHint'>
  /** 用户本轮原话 + 已确认结论；用于校验锚点不是模型自造的标题回声 */
  supportTexts: string[]
  evidence?: NocodeEditorFlowPersonnelSourceEvidence | null
}): FlowPersonnelClueDerivation | null => {
  if (!isFlowPersonnelStepKind(input.step.kind)) {
    return null
  }
  const anchor = resolveNocodeEditorFlowPersonnelSourceAnchor({
    contextTexts: [input.step.title, input.step.intent, input.step.actorHint],
    evidence: input.evidence || null,
  })
  if (!anchor) {
    return null
  }
  if (!isClueEchoedBySupportTexts({
    matchedText: anchor.matchedText,
    supportTexts: input.supportTexts.map(normalizeText).filter(Boolean),
  })) {
    return null
  }
  const requirement = buildClueRequirement({ anchor, evidence: input.evidence })
  if (!requirement) {
    return null
  }
  const normalized = normalizeNocodeEditorFlowPersonnelRequirement(requirement)
  if (!normalized || normalized.sourceType === 'unresolved') {
    return null
  }
  return {
    requirement: normalized,
    sourceType: normalized.sourceType,
    matchedText: anchor.matchedText,
    needsLevel: normalized.sourceType === 'department_manager' && !normalized.departmentManager,
  }
}

const isRequirementUnsettled = (requirement?: NocodeEditorFlowPersonnelRequirement | null) => (
  !requirement || requirement.sourceType === 'unresolved'
)

// 只补空位：已写好的人员配置（模型结论或用户答复）一律不覆盖。
export const deriveFlowSchemePersonnelRequirementsFromClues = (input: {
  scheme: NocodeEditorFlowScheme
  evidence?: NocodeEditorFlowPersonnelSourceEvidence | null
  userMessage?: string | null
}): {
  scheme: NocodeEditorFlowScheme
  derived: FlowPersonnelClueDerivationEntry[]
} => {
  const supportTexts = [
    normalizeText(input.userMessage),
    ...(input.scheme.confirmedFacts || []).map(normalizeText),
  ].filter(Boolean)
  const derived: FlowPersonnelClueDerivationEntry[] = []

  const mapStep = (step: NocodeEditorFlowSchemeStep): NocodeEditorFlowSchemeStep => {
    if (!isFlowPersonnelStepKind(step.kind) || !isRequirementUnsettled(step.personnelRequirement)) {
      return step
    }
    const derivation = resolveFlowPersonnelRequirementFromClues({
      step,
      supportTexts,
      evidence: input.evidence,
    })
    if (!derivation) {
      return step
    }
    derived.push({
      stepKey: step.key,
      sourceType: derivation.sourceType,
      matchedText: derivation.matchedText,
      needsLevel: derivation.needsLevel,
    })
    return { ...step, personnelRequirement: derivation.requirement }
  }

  const mainPath = (input.scheme.mainPath || []).map(mapStep)
  const branches = (input.scheme.branches || []).map(branch => ({
    ...branch,
    steps: (branch.steps || []).map(mapStep),
  }))
  return {
    scheme: derived.length ? { ...input.scheme, mainPath, branches } : input.scheme,
    derived,
  }
}
