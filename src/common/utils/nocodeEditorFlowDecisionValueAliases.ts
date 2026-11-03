import type { NocodeEditorAiConfirmQuestion } from '@common/types/nocodeEditorConfirmation'

/**
 * 决策键 → 方案字段的规范取值词表。
 *
 * 确认题的 `option.value` 由模型自由生成，方案字段却是固定枚举（见
 * nocode-editor-tool-definitions.ts 的 trigger.type enum，
 * 以及 nocodeEditorFlowScheme.ts 的 normalizeFlowSchemeTriggerType）。
 * 同一个语义在两处写成不同字面量时（如 submit_auto 与 submit），
 * 把已确认答案回填到新题目上会因字面量不等被判成 `confirmed_decision_option_unavailable`，
 * 已确认结论被打回待答并触发一轮多余的重新规划。
 */
export const FLOW_DECISION_CANONICAL_VALUES: Record<string, readonly string[]> = {
  'flow.trigger.type': ['submit', 'update', 'manual', 'schedule', 'unknown'],
}

const FLOW_DECISION_VALUE_ALIASES: Record<string, Record<string, string>> = {
  'flow.trigger.type': {
    submit_auto: 'submit',
    auto_submit: 'submit',
    submit_automatically: 'submit',
    automatically_on_submit: 'submit',
    on_submit: 'submit',
    after_submit: 'submit',
    button_manual: 'manual',
    manual_trigger: 'manual',
    manual_click: 'manual',
    click_button: 'manual',
    on_click: 'manual',
    scheduled: 'schedule',
    timer: 'schedule',
    cron: 'schedule',
    on_schedule: 'schedule',
    on_update: 'update',
    after_update: 'update',
    on_edit: 'update',
  },
}

const comparableValue = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase()

/**
 * 把某个决策键的取值归一到规范词汇；该键没有词表、或取值本来就规范时原样返回。
 */
export const canonicalizeFlowDecisionValue = (
  decisionKey: unknown,
  value: unknown,
): string => {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return ''
  }
  const key = String(decisionKey ?? '').trim()
  const vocabulary = FLOW_DECISION_CANONICAL_VALUES[key]
  if (!vocabulary) {
    return raw
  }
  const canonical = vocabulary.find(item => comparableValue(item) === comparableValue(raw))
  return canonical || FLOW_DECISION_VALUE_ALIASES[key]?.[comparableValue(raw)] || raw
}

/**
 * 归一题目自身的取值：选项值与已选值统一到规范词汇，并让 `selected` 与已选值保持一致。
 * 只对词表内的决策键生效，其他题目原样返回。
 */
export const canonicalizeFlowDecisionQuestionValues = (
  question: NocodeEditorAiConfirmQuestion,
): NocodeEditorAiConfirmQuestion => {
  const decisionKey = String(question.decisionKey || '').trim()
  if (!decisionKey || !FLOW_DECISION_CANONICAL_VALUES[decisionKey]) {
    return question
  }
  const rawSelectedValue = String(question.selectedOptionValue ?? '').trim()
  const selectedValue = canonicalizeFlowDecisionValue(decisionKey, rawSelectedValue)
  const options = (question.options || []).reduce<NonNullable<NocodeEditorAiConfirmQuestion['options']>>(
    (collected, option) => {
      const value = canonicalizeFlowDecisionValue(decisionKey, option.value)
      if (!value) {
        return collected
      }
      const selected = selectedValue ? value === selectedValue : option.selected === true
      const existing = collected.find(item => item.value === value)
      if (existing) {
        existing.selected = existing.selected === true || selected
        return collected
      }
      collected.push({ ...option, value, selected })
      return collected
    },
    [],
  )
  const canonicalQuestion: NocodeEditorAiConfirmQuestion = { ...question }
  if (question.options) {
    canonicalQuestion.options = options
  }
  if (rawSelectedValue) {
    canonicalQuestion.selectedOptionValue = selectedValue
  }
  return canonicalQuestion
}
