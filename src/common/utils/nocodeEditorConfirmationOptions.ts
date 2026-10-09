import type {
  NocodeEditorAiConfirmQuestionKind,
  NocodeEditorAiConfirmQuestionOption,
} from '@common/types/nocodeEditorConfirmation'
import i18next from 'i18next'

type ConfirmationQuestionLike = {
  title?: string
  questionKind?: NocodeEditorAiConfirmQuestionKind
  options?: NocodeEditorAiConfirmQuestionOption[]
}

export type NocodeEditorConfirmationQuestionDisplayOption = {
  option: NocodeEditorAiConfirmQuestionOption
  displayLabel: string
  title: string
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeOptionLabel = (value: unknown) => (
  normalizeText(value)
    .replace(/\s+/g, ' ')
    .replace(/[。；;，,]+$/g, '')
)

export const isBinaryNocodeEditorConfirmationQuestionTitle = (title: string) => (
  /是否|需不需要|要不要|能否|可否|应不应该|有没有必要/.test(title)
)

const stripOptionSuffixHint = (value: string) => (
  value
    .replace(/（[^）]+）/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
)

const normalizeNeedSpecificLabel = (value: string) => {
  const suffix = stripOptionSuffixHint(value)
  if (!suffix) {
    return ''
  }

  if (/^(图片|照片)$/.test(suffix) || /现场照片/.test(suffix)) {
    return suffix === '图片' || suffix === '照片'
      ? i18next.t('nocodeEditorConfirmationOptions.imageAttachment')
      : suffix
  }

  if (/^(通用文件|通用附件)$/.test(suffix)) {
    return suffix === '通用文件'
      ? i18next.t('nocodeEditorConfirmationOptions.fileAttachment')
      : suffix
  }

  return suffix
}

const resolveNeedSpecificDisplayLabel = (
  label: string,
) => {
  const commaNeedMatch = label.match(/^需要[，,、:：]\s*(.+)$/)
  if (commaNeedMatch?.[1]) {
    return normalizeNeedSpecificLabel(commaNeedMatch[1])
  }

  const directNeedMatch = label.match(/^需要(?![，,、:：])(.{2,})$/)
  if (directNeedMatch?.[1]) {
    return normalizeNeedSpecificLabel(directNeedMatch[1])
  }

  return normalizeNeedSpecificLabel(label)
}

export const inferNocodeEditorConfirmationQuestionOptions = (
  question?: ConfirmationQuestionLike | null,
): NocodeEditorAiConfirmQuestionOption[] | undefined => {
  if (question?.questionKind === 'note_only') {
    return undefined
  }

  const options = Array.isArray(question?.options) ? question.options : []
  if (options.length) {
    return options
  }

  if (question?.questionKind === 'single_select') {
    return undefined
  }

  const title = normalizeText(question?.title)
  if (!title) {
    return undefined
  }

  if (question?.questionKind !== 'binary' && !isBinaryNocodeEditorConfirmationQuestionTitle(title)) {
    return undefined
  }

  return [
    {
      value: 'yes',
      label: i18next.t('nocodeEditorConfirmationOptions.yes'),
    },
    {
      value: 'no',
      label: i18next.t('nocodeEditorConfirmationOptions.no'),
    },
  ]
}

export const resolveNocodeEditorConfirmationOptionDisplayLabel = (
  question: ConfirmationQuestionLike | null | undefined,
  option: NocodeEditorAiConfirmQuestionOption | null | undefined,
) => {
  const title = normalizeText(question?.title)
  const label = normalizeOptionLabel(option?.label || option?.value)
  if (!label) {
    return ''
  }

  const relationMatch = label.match(/^从已有(.+?)表单选择(?:（[^）]+）)?$/)
  if (relationMatch?.[1]) {
    return i18next.t('nocodeEditorConfirmationOptions.linkExistingForm', { form: relationMatch[1] })
  }

  const commaNeedMatch = label.match(/^需要[，,、:：]\s*(.+)$/)
  if (commaNeedMatch && isBinaryNocodeEditorConfirmationQuestionTitle(title)) {
    if (/补充.+配置/.test(title)) {
      return normalizeNeedSpecificLabel(commaNeedMatch[1]) || i18next.t('nocodeEditorConfirmationOptions.required')
    }
    return i18next.t('nocodeEditorConfirmationOptions.required')
  }

  const directNeedMatch = label.match(/^需要(?![，,、:：])(.{2,})$/)
  if (directNeedMatch?.[1]) {
    return normalizeNeedSpecificLabel(directNeedMatch[1]) || directNeedMatch[1].trim()
  }

  return label.replace(/（[^）]+）$/g, '').trim() || label
}

export const resolveNocodeEditorConfirmationQuestionDisplayOptions = (
  question?: ConfirmationQuestionLike | null,
) => {
  const options = inferNocodeEditorConfirmationQuestionOptions(question) || []
  const baseDisplayLabels = options.map(option => (
    resolveNocodeEditorConfirmationOptionDisplayLabel(question, option) || option.label
  ))
  const labelCountMap = baseDisplayLabels.reduce<Record<string, number>>((map, label) => {
    map[label] = (map[label] || 0) + 1
    return map
  }, {})

  return options.map((option, index): NocodeEditorConfirmationQuestionDisplayOption => {
    const baseDisplayLabel = baseDisplayLabels[index]
    const collisionCount = labelCountMap[baseDisplayLabel] || 0
    const specificDisplayLabel = resolveNeedSpecificDisplayLabel(normalizeOptionLabel(option.label || option.value))
    const displayLabel = collisionCount > 1 && specificDisplayLabel
      ? specificDisplayLabel
      : baseDisplayLabel

    return {
      option,
      displayLabel: displayLabel || option.label,
      title: option.description || option.label,
    }
  })
}
