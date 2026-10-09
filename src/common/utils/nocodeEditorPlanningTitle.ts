import i18next from 'i18next'

const BUSINESS_DOMAIN_CANDIDATES = [
  '进销存',
  '客户管理',
  '设备巡检',
]

const normalizeText = (value: unknown) => String(value ?? '').trim()

export const appendPlanningSuffix = (value: unknown) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return ''
  }
  const suffix = i18next.t('nocodeEditorPlanningTitle.planningSuffix')
  return normalized.endsWith(suffix)
    ? normalized
    : i18next.t('nocodeEditorPlanningTitle.namedPlan', { name: normalized })
}

type SingleFormPlanningInput = {
  formName?: unknown
  outline?: {
    forms?: Array<{ tableName?: unknown }> | null
  } | null
}

const pickSingleFormName = (input: SingleFormPlanningInput) => {
  const explicitFormName = normalizeText(input.formName)
  if (explicitFormName) {
    return explicitFormName
  }

  const forms = Array.isArray(input.outline?.forms) ? input.outline.forms : []
  return normalizeText(forms[0]?.tableName)
}

export const resolveSingleFormPlanningDisplayTitle = (input: SingleFormPlanningInput) => {
  const baseName = pickSingleFormName(input)
  return appendPlanningSuffix(baseName) || i18next.t('nocodeEditorPlanningTitle.formPlan')
}

const pickBusinessDomainName = (title: unknown) => {
  const normalizedTitle = normalizeText(title)
  if (!normalizedTitle) {
    return ''
  }

  const matchedCandidate = BUSINESS_DOMAIN_CANDIDATES.find(candidate => normalizedTitle.includes(candidate))
  if (matchedCandidate) {
    return matchedCandidate
  }

  const compactTitle = normalizedTitle.replace(/\s+/g, '')
  const genericPrefix = compactTitle.match(/^(.{2,12}?)(系统|应用|管理|流程|方案)/)
  return normalizeText(genericPrefix?.[1])
}

const pickFirstModuleName = (modules: unknown) => {
  if (!Array.isArray(modules)) {
    return ''
  }

  for (const item of modules) {
    const moduleName = normalizeText((item as { name?: unknown })?.name)
    if (moduleName) {
      return moduleName
    }
  }

  return ''
}

export const resolveSolutionPlanningDisplayTitle = (input: {
  title?: unknown
  modules?: unknown
}) => {
  const domainName = pickBusinessDomainName(input.title)
  if (domainName) {
    return appendPlanningSuffix(domainName)
  }

  const moduleName = pickFirstModuleName(input.modules)
  if (moduleName) {
    return appendPlanningSuffix(moduleName)
  }

  return i18next.t('nocodeEditorPlanningTitle.appPlan')
}
