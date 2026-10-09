import type {
  NocodeEditorAiBlueprintDefaultValue,
  NocodeEditorAiBlueprintOption,
} from './types'

const normalizeText = (value: unknown) => String(value || '').trim()

export const normalizeBlueprintDefaultValue = (
  value: unknown,
): NocodeEditorAiBlueprintDefaultValue | undefined => {
  if (typeof value === 'string') {
    return value.trim() || undefined
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    if (!value.every(item => typeof item === 'string')) {
      return undefined
    }
    return value.map(item => item.trim()).filter(Boolean)
  }
  return undefined
}

const normalizeEnumOptions = (
  value: unknown,
): NocodeEditorAiBlueprintOption[] => (
  (Array.isArray(value) ? value : []).flatMap((item) => {
    if (typeof item === 'string') {
      const text = item.trim()
      return text ? [{ label: text, value: text }] : []
    }
    if (!item || typeof item !== 'object') {
      return []
    }
    const label = normalizeText((item as Record<string, unknown>).label)
    const optionValue = normalizeText((item as Record<string, unknown>).value)
    return label || optionValue
      ? [{ label: label || optionValue, value: optionValue || label }]
      : []
  })
)

export const resolveLegacyEnumBlueprintDefaultValue = (input: {
  widgetType?: string
  enumOptions?: unknown
  formulaSettings?: Array<{ formulaPath?: string; formula?: string }>
  defaultValue?: unknown
}): NocodeEditorAiBlueprintDefaultValue | undefined => {
  if (normalizeBlueprintDefaultValue(input.defaultValue) !== undefined) {
    return undefined
  }

  const widgetType = normalizeText(input.widgetType).toLowerCase()
  const isRadio = widgetType.includes('radiogroup')
  const isCheckbox = widgetType.includes('checkboxgroup')
  const settings = Array.isArray(input.formulaSettings) ? input.formulaSettings : []
  if ((!isRadio && !isCheckbox) || settings.length !== 1) {
    return undefined
  }

  const setting = settings[0]
  const formula = normalizeText(setting?.formula)
  if (normalizeText(setting?.formulaPath) !== 'default-formula' || !formula) {
    return undefined
  }

  const matches = normalizeEnumOptions(input.enumOptions).filter(option => (
    option.value === formula || option.label === formula
  ))
  if (matches.length !== 1) {
    return undefined
  }

  return isCheckbox ? [matches[0].value] : matches[0].value
}

export type BlueprintDefaultValueChange = {
  path: string[]
  value: unknown
}

export type BlueprintDefaultValueResolution = {
  changes: BlueprintDefaultValueChange[]
  warning?: string
}

type BlueprintOptionSchemaItem = {
  key?: string
  path?: string[]
  currentValue?: unknown
}

const collectSchemaOptions = (schema: unknown): BlueprintOptionSchemaItem[] => {
  if (!schema || typeof schema !== 'object') {
    return []
  }
  const rawGroups = (schema as Record<string, unknown>).groups
  const groups = Array.isArray(rawGroups) ? rawGroups : []
  return groups.flatMap((group) => {
    if (!group || typeof group !== 'object') {
      return []
    }
    const options = (group as Record<string, unknown>).options
    return Array.isArray(options)
      ? options.filter((option): option is BlueprintOptionSchemaItem => (
        Boolean(option) && typeof option === 'object'
      ))
      : []
  })
}

const findSchemaOption = (
  schema: unknown,
  keys: string[],
): BlueprintOptionSchemaItem | undefined => (
  collectSchemaOptions(schema).find((option) => {
    const key = normalizeText(option?.key)
    const path = Array.isArray(option?.path) ? option.path.map(normalizeText).filter(Boolean) : []
    return keys.includes(key) || keys.includes(path.join('.')) || keys.includes(path[path.length - 1])
  })
)

const valuesEqual = (left: unknown, right: unknown) => (
  JSON.stringify(left) === JSON.stringify(right)
)

const createUnsupportedWarning = (fieldName: unknown) => (
  `字段「${normalizeText(fieldName) || '未命名字段'}」不支持自动写入静态默认值。`
)

const resolveEnumDefaultValueChanges = (input: {
  fieldName?: string
  defaultValue: NocodeEditorAiBlueprintDefaultValue
  schema?: unknown
  optionKey: string
  multiple: boolean
}): BlueprintDefaultValueResolution => {
  const option = findSchemaOption(input.schema, [input.optionKey])
  if (!option || !option.currentValue || typeof option.currentValue !== 'object') {
    return { changes: [], warning: createUnsupportedWarning(input.fieldName) }
  }

  const currentValue = option.currentValue as Record<string, unknown>
  const enumOptions = normalizeEnumOptions(currentValue.options)
  const requestedValues = Array.isArray(input.defaultValue)
    ? input.defaultValue
    : [String(input.defaultValue)]
  if (!input.multiple && requestedValues.length !== 1) {
    return {
      changes: [],
      warning: `字段「${normalizeText(input.fieldName) || '未命名字段'}」的单选默认值只能包含一个选项。`,
    }
  }

  const matchedValues: string[] = []
  for (const requestedValue of requestedValues) {
    const matches = enumOptions.filter(optionItem => (
      optionItem.value === requestedValue || optionItem.label === requestedValue
    ))
    if (matches.length !== 1) {
      return {
        changes: [],
        warning: `字段「${normalizeText(input.fieldName) || '未命名字段'}」的默认值「${requestedValue}」未匹配到唯一枚举选项。`,
      }
    }
    if (!matchedValues.includes(matches[0].value)) {
      matchedValues.push(matches[0].value)
    }
  }

  const checkedValue = input.multiple ? matchedValues : matchedValues[0]
  if (valuesEqual(currentValue.checkedValue, checkedValue)) {
    return { changes: [] }
  }
  return {
    changes: [{
      path: Array.isArray(option.path) && option.path.length ? option.path : [input.optionKey],
      value: {
        ...currentValue,
        checkedValue,
      },
    }],
  }
}

export const resolveBlueprintDefaultValueChanges = (input: {
  fieldName?: string
  widgetType?: string
  defaultValue?: unknown
  schema?: unknown
}): BlueprintDefaultValueResolution => {
  const defaultValue = normalizeBlueprintDefaultValue(input.defaultValue)
  if (defaultValue === undefined) {
    return { changes: [] }
  }

  const widgetType = normalizeText(input.widgetType).toLowerCase()
  if (widgetType.includes('radiogroup')) {
    return resolveEnumDefaultValueChanges({
      fieldName: input.fieldName,
      defaultValue,
      schema: input.schema,
      optionKey: 'radiogroup-value-text-color-option',
      multiple: false,
    })
  }
  if (widgetType.includes('checkboxgroup')) {
    return resolveEnumDefaultValueChanges({
      fieldName: input.fieldName,
      defaultValue,
      schema: input.schema,
      optionKey: 'checkbox-option',
      multiple: true,
    })
  }

  const defaultTypeOption = findSchemaOption(input.schema, ['default-type'])
  if (widgetType.includes('datepicker') && !widgetType.includes('daterange')) {
    if (!defaultTypeOption) {
      return { changes: [], warning: createUnsupportedWarning(input.fieldName) }
    }
    return {
      changes: [
        ...(defaultTypeOption.currentValue === 'customDate'
          ? []
          : [{ path: defaultTypeOption.path || ['default-type'], value: 'customDate' }]),
        { path: ['custom-date'], value: defaultValue },
      ],
    }
  }
  if (widgetType.includes('timepicker')) {
    if (!defaultTypeOption) {
      return { changes: [], warning: createUnsupportedWarning(input.fieldName) }
    }
    return {
      changes: [
        ...(defaultTypeOption.currentValue === 'customTime'
          ? []
          : [{ path: defaultTypeOption.path || ['default-type'], value: 'customTime' }]),
        { path: ['custom-time'], value: defaultValue },
      ],
    }
  }

  const defaultValueOption = findSchemaOption(input.schema, ['default-value'])
  if (!defaultValueOption) {
    return { changes: [], warning: createUnsupportedWarning(input.fieldName) }
  }

  const changes: BlueprintDefaultValueChange[] = []
  if (defaultTypeOption && defaultTypeOption.currentValue !== 'custom') {
    changes.push({
      path: defaultTypeOption.path || ['default-type'],
      value: 'custom',
    })
  }
  if (!valuesEqual(defaultValueOption.currentValue, defaultValue)) {
    changes.push({
      path: defaultValueOption.path || ['default-value'],
      value: defaultValue,
    })
  }
  return { changes }
}
