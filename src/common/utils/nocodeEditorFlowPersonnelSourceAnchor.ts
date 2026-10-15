import type {
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorFlowScheme,
} from './nocodeEditorFlowScheme'
import {
  collectFlowSchemeSteps,
} from './nocodeEditorFlowApprovalOwnerRules'
import {
  NOCODE_EDITOR_FLOW_PERSONNEL_SOURCE_OPTIONS,
  collectNocodeEditorFlowPersonnelSourceValuesFromText,
  resolveNocodeEditorFlowPersonnelSourceOptionValue,
} from './nocodeEditorFlowPersonnelSourceOptions'
import type {
  NocodeEditorFlowPersonnelSourceOptionValue,
} from './nocodeEditorFlowPersonnelSourceOptions'

export type NocodeEditorFlowPersonnelSourceEvidence = {
  roles: Array<{ id?: string; name: string }>
  users: Array<{ id?: string; name: string }>
  memberFieldNames: string[]
  departmentFieldNames: string[]
}

export type NocodeEditorFlowPersonnelSourceAnchor = {
  optionValue: NocodeEditorFlowPersonnelSourceOptionValue
  optionLabel: string
  matchedText: string
}

export type NocodeEditorFlowPersonnelSourceStepContext = {
  title: string
  intent: string
  actorHint: string
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeName = (value: unknown) => normalizeText(value)
  .normalize('NFKC')
  .replace(/[\s_.\-·、，,]+/g, '')
  .toLocaleLowerCase()

const OPTION_LABEL_BY_VALUE = new Map<NocodeEditorFlowPersonnelSourceOptionValue, string>(
  NOCODE_EDITOR_FLOW_PERSONNEL_SOURCE_OPTIONS.map(spec => [spec.value, spec.label]),
)

const buildAnchor = (
  optionValue: NocodeEditorFlowPersonnelSourceOptionValue,
  matchedText: unknown,
): NocodeEditorFlowPersonnelSourceAnchor | null => {
  const optionLabel = OPTION_LABEL_BY_VALUE.get(optionValue)
  const text = normalizeText(matchedText)
  return optionLabel && text ? { optionValue, optionLabel, matchedText: text } : null
}

// L1：业务上下文直接出现的“人员设置”面板规范短语（部门主管、指定成员/角色等）；
// 命中多个不同来源视为线索歧义，不推荐。
const collectPhraseMatches = (
  contextTexts: string[],
): Map<NocodeEditorFlowPersonnelSourceOptionValue, string> => {
  const matchedByValue = new Map<NocodeEditorFlowPersonnelSourceOptionValue, string>()
  contextTexts.forEach((text) => {
    collectNocodeEditorFlowPersonnelSourceValuesFromText(text).forEach((match) => {
      if (!matchedByValue.has(match.value)) {
        matchedByValue.set(match.value, match.matchedText)
      }
    })
  })
  return matchedByValue
}

// L2：上下文点名了当前项目证据里的真实对象名（角色/成员 → 指定成员/角色，
// 成员字段名 → 表单内成员字段，部门字段名 → 表单内部门字段）；命中多个不同来源视为歧义。
const collectEvidenceMatches = (input: {
  contextTexts: string[]
  evidence?: NocodeEditorFlowPersonnelSourceEvidence | null
}): Map<NocodeEditorFlowPersonnelSourceOptionValue, string> => {
  const normalizedTexts = input.contextTexts.map(normalizeName).filter(Boolean)
  const matchedByValue = new Map<NocodeEditorFlowPersonnelSourceOptionValue, string>()
  const matchCategory = (
    optionValue: NocodeEditorFlowPersonnelSourceOptionValue,
    names: Array<unknown>,
  ) => {
    const candidates = names
      .map(normalizeText)
      .filter(Boolean)
      .sort((a, b) => normalizeName(b).length - normalizeName(a).length)
    const matched = candidates.find((name) => {
      const normalizedName = normalizeName(name)
      return normalizedName.length >= 2
        && normalizedTexts.some(text => text.includes(normalizedName))
    })
    if (matched) {
      matchedByValue.set(optionValue, matched)
    }
  }
  matchCategory('assignee', [
    ...(input.evidence?.roles || []).map(role => role?.name),
    ...(input.evidence?.users || []).map(user => user?.name),
  ])
  matchCategory('form_member_field', input.evidence?.memberFieldNames || [])
  matchCategory('form_department_field', input.evidence?.departmentFieldNames || [])
  return matchedByValue
}

export const resolveNocodeEditorFlowPersonnelSourceAnchor = (input: {
  contextTexts?: Array<unknown>
  evidence?: NocodeEditorFlowPersonnelSourceEvidence | null
}): NocodeEditorFlowPersonnelSourceAnchor | null => {
  const contextTexts = (input.contextTexts || []).map(normalizeText).filter(Boolean)
  if (!contextTexts.length) {
    return null
  }

  const phraseMatches = collectPhraseMatches(contextTexts)
  if (phraseMatches.size > 1) {
    return null
  }
  if (phraseMatches.size === 1) {
    const [value, matchedText] = [...phraseMatches.entries()][0]
    return buildAnchor(value, matchedText)
  }

  const evidenceMatches = collectEvidenceMatches({
    contextTexts,
    evidence: input.evidence,
  })
  if (evidenceMatches.size !== 1) {
    return null
  }
  const [value, matchedText] = [...evidenceMatches.entries()][0]
  return buildAnchor(value, matchedText)
}

export const resolveNocodeEditorFlowPersonnelSourceStepContext = (input: {
  scheme?: NocodeEditorFlowScheme | null
  stepKey?: unknown
}): NocodeEditorFlowPersonnelSourceStepContext | null => {
  const stepKey = normalizeText(input.stepKey)
  if (!stepKey || !input.scheme) {
    return null
  }
  const step = collectFlowSchemeSteps(input.scheme).find(item => (
    normalizeText(item.key) === stepKey
  ))
  if (!step) {
    return null
  }
  return {
    title: normalizeText(step.title),
    intent: normalizeText(step.intent),
    actorHint: normalizeText(step.actorHint),
  }
}

export const resolveNocodeEditorFlowPersonnelSourceQuestionAnchor = (input: {
  scheme?: NocodeEditorFlowScheme | null
  stepKey?: unknown
  evidence?: NocodeEditorFlowPersonnelSourceEvidence | null
}): NocodeEditorFlowPersonnelSourceAnchor | null => {
  const context = resolveNocodeEditorFlowPersonnelSourceStepContext({
    scheme: input.scheme,
    stepKey: input.stepKey,
  })
  if (!context) {
    return null
  }
  return resolveNocodeEditorFlowPersonnelSourceAnchor({
    contextTexts: [context.title, context.intent, context.actorHint],
    evidence: input.evidence,
  })
}

const buildQuestionAnchorNote = (anchor: NocodeEditorFlowPersonnelSourceAnchor) => (
  normalizeName(anchor.matchedText) === normalizeName(anchor.optionLabel)
    ? `业务线索已点名“${anchor.matchedText}”，推荐选择该来源。`
    : `业务线索已点名“${anchor.matchedText}”，推荐选择“${anchor.optionLabel}”来源。`
)

const buildOptionAnchorNote = (anchor: NocodeEditorFlowPersonnelSourceAnchor) => (
  `推荐：业务线索已点名“${anchor.matchedText}”。`
)

const appendNote = (base: string, note: string) => {
  if (!base) {
    return note
  }
  return /[。！？.!?；;]$/u.test(base) ? `${base}${note}` : `${base} ${note}`
}

// 标注只补 description（题面可见推荐 + 推荐选项 tooltip），不改标题、选项标签，
// 也绝不预选任何选项；已标注过的题面按整条推荐语幂等跳过。
export const annotateNocodeEditorFlowPersonnelSourceQuestion = <
  TQuestion extends NocodeEditorAiConfirmQuestion,
>(input: {
  question: TQuestion
  anchor: NocodeEditorFlowPersonnelSourceAnchor
}): TQuestion => {
  const questionNote = buildQuestionAnchorNote(input.anchor)
  const currentDescription = normalizeText(input.question.description)
  const description = currentDescription.includes(questionNote)
    ? currentDescription
    : appendNote(currentDescription, questionNote)
  let changed = description !== currentDescription
  let options = input.question.options
  if (
    input.question.questionKind !== 'note_only'
    && Array.isArray(options)
    && options.length
  ) {
    const optionNote = buildOptionAnchorNote(input.anchor)
    options = options.map((option) => {
      if (resolveNocodeEditorFlowPersonnelSourceOptionValue(option) !== input.anchor.optionValue) {
        return option
      }
      const optionDescription = normalizeText(option.description)
      if (optionDescription.includes(optionNote)) {
        return option
      }
      changed = true
      return {
        ...option,
        description: appendNote(optionDescription, optionNote),
      }
    })
  }
  return changed
    ? {
      ...input.question,
      description,
      ...(options ? { options } : {}),
    }
    : input.question
}
