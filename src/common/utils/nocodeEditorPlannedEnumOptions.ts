export type NocodeEditorPlannedEnumOption = {
  label: string
  value: string
}

const CJK_PATTERN = /[\u3400-\u9fff]/
// 纯英文键/拼音编码：字母开头，只含字母、数字、下划线、连字符，无空格。
const ASCII_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/

const normalizeOptionText = (value: unknown) => String(value ?? '').trim()

// 单选/多选/下拉组件直接展示 value，设计器里 label 与 value 始终同步；
// 「中文 label + 英文键 value」必然显示英文，因此有中文 label 时把 value 收敛为 label。
// 没有中文 label 的选项保持原样，不擅自改写用户明确给出的 label/value 分离场景。
export const normalizePlannedEnumOptions = (value: unknown): NocodeEditorPlannedEnumOption[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => {
      if (typeof item === 'string') {
        const text = normalizeOptionText(item)
        return text ? { label: text, value: text } : null
      }
      if (!item || typeof item !== 'object') {
        return null
      }
      const record = item as Record<string, unknown>
      const label = normalizeOptionText(record.label) || normalizeOptionText(record.value)
      const optionValue = normalizeOptionText(record.value) || normalizeOptionText(record.label)
      if (!label || !optionValue) {
        return null
      }
      return {
        label,
        value: CJK_PATTERN.test(label) && ASCII_CODE_PATTERN.test(optionValue) ? label : optionValue,
      }
    })
    .filter(Boolean) as NocodeEditorPlannedEnumOption[]
}

// value 被合并后，原本指向旧 value 的默认值要跟着改，否则默认值会落空。
export const alignPlannedEnumDefaultValue = <T,>(
  defaultValue: T,
  rawOptions: NocodeEditorPlannedEnumOption[],
  options: NocodeEditorPlannedEnumOption[],
): T => {
  if (typeof defaultValue !== 'string' || !defaultValue.trim()) {
    return defaultValue
  }
  const rawOption = rawOptions.find(option => option.value === defaultValue)
  const aligned = rawOption
    ? options.find(option => option.label === rawOption.label)
    : null
  return (aligned ? aligned.value : defaultValue) as T
}
