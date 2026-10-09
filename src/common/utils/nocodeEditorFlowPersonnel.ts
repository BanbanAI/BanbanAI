export type NocodeEditorFlowPersonnelRef = {
  id?: string
  name?: string
}

export type NocodeEditorFlowPersonnelSourceType =
  | 'submitter'
  | 'submitter_manager'
  | 'fixed_users'
  | 'fixed_roles'
  | 'department_manager'
  | 'form_member'
  | 'form_department'
  | 'unresolved'

export type NocodeEditorFlowPersonnelRequirement = {
  sourceType: NocodeEditorFlowPersonnelSourceType
  userRefs?: NocodeEditorFlowPersonnelRef[]
  roleRefs?: NocodeEditorFlowPersonnelRef[]
  fieldRef?: {
    fieldId?: string
    fieldName?: string
    expectedType?: 'memberSelect' | 'departmentSelect'
  }
  departmentManager?: {
    mode: 'up' | 'down'
    level: number
  }
  emptyHandler?: {
    mode: 'auto_approve' | 'admin' | 'fixed_users' | 'none' | 'unresolved'
    userRefs?: NocodeEditorFlowPersonnelRef[]
  }
}

type UnknownRecord = Record<string, unknown>

const SOURCE_TYPES = new Set<string>([
  'submitter',
  'submitter_manager',
  'fixed_users',
  'fixed_roles',
  'department_manager',
  'form_member',
  'form_department',
  'unresolved',
])

const EMPTY_HANDLER_MODES = new Set<string>([
  'auto_approve',
  'admin',
  'fixed_users',
  'none',
  'unresolved',
])

const normalizeText = (value: unknown) => String(value ?? '').trim()

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeRef = (value: unknown): NocodeEditorFlowPersonnelRef | null => {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeText(value.id)
  const name = normalizeText(value.name)
  if (!id && !name) {
    return null
  }

  return {
    ...(id ? { id } : {}),
    ...(name ? { name } : {}),
  }
}

const normalizeRefs = (value: unknown) => (
  Array.isArray(value)
    ? value.flatMap((item): NocodeEditorFlowPersonnelRef[] => {
      const normalized = normalizeRef(item)
      return normalized ? [normalized] : []
    })
    : []
)

const normalizeDepartmentManager = (
  value: unknown,
): NocodeEditorFlowPersonnelRequirement['departmentManager'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const mode = normalizeText(value.mode)
  const level = Number(value.level)
  if ((mode !== 'up' && mode !== 'down') || !Number.isInteger(level) || level < 1) {
    return undefined
  }

  return {
    mode,
    level,
  }
}

const normalizeEmptyHandler = (
  value: unknown,
): NocodeEditorFlowPersonnelRequirement['emptyHandler'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const rawMode = normalizeText(value.mode)
  const mode = EMPTY_HANDLER_MODES.has(rawMode)
    ? rawMode as NonNullable<NocodeEditorFlowPersonnelRequirement['emptyHandler']>['mode']
    : 'unresolved'
  if (mode !== 'fixed_users') {
    return { mode }
  }

  const userRefs = normalizeRefs(value.userRefs)
  return {
    mode,
    ...(userRefs.length > 0 ? { userRefs } : {}),
  }
}

const unresolvedRequirement = (): NocodeEditorFlowPersonnelRequirement => ({
  sourceType: 'unresolved',
})

export const normalizeNocodeEditorFlowPersonnelRequirement = (
  value: unknown,
): NocodeEditorFlowPersonnelRequirement | null => {
  if (!isRecord(value)) {
    return null
  }

  const rawSourceType = normalizeText(value.sourceType)
  if (!SOURCE_TYPES.has(rawSourceType) || rawSourceType === 'unresolved') {
    return unresolvedRequirement()
  }

  const sourceType = rawSourceType as NocodeEditorFlowPersonnelSourceType
  const userRefs = normalizeRefs(value.userRefs)
  const roleRefs = normalizeRefs(value.roleRefs)
  const fieldRefValue = isRecord(value.fieldRef) ? value.fieldRef : null
  const rawExpectedType = normalizeText(fieldRefValue?.expectedType)
  const hasFieldSignal = Boolean(
    fieldRefValue
    && (
      normalizeText(fieldRefValue.fieldId)
      || normalizeText(fieldRefValue.fieldName)
      || rawExpectedType
    )
  )
  const departmentManager = normalizeDepartmentManager(value.departmentManager)
  const emptyHandler = normalizeEmptyHandler(value.emptyHandler)
  const hasDepartmentManagerSignal = Boolean(
    isRecord(value.departmentManager)
    && (
      normalizeText(value.departmentManager.mode)
      || value.departmentManager.level !== undefined
    )
  )

  if (
    (userRefs.length > 0 && sourceType !== 'fixed_users')
    || (roleRefs.length > 0 && sourceType !== 'fixed_roles')
    || (hasFieldSignal && sourceType !== 'form_member' && sourceType !== 'form_department')
    || (hasDepartmentManagerSignal && sourceType !== 'department_manager')
  ) {
    return unresolvedRequirement()
  }

  if (sourceType === 'form_member' || sourceType === 'form_department') {
    const expectedType = sourceType === 'form_member'
      ? 'memberSelect'
      : 'departmentSelect'
    if (rawExpectedType && rawExpectedType !== expectedType) {
      return unresolvedRequirement()
    }

    const fieldId = normalizeText(fieldRefValue?.fieldId)
    const fieldName = normalizeText(fieldRefValue?.fieldName)
    return {
      sourceType,
      fieldRef: {
        ...(fieldId ? { fieldId } : {}),
        ...(fieldName ? { fieldName } : {}),
        expectedType,
      },
      ...(emptyHandler ? { emptyHandler } : {}),
    }
  }

  return {
    sourceType,
    ...(sourceType === 'fixed_users' && userRefs.length > 0 ? { userRefs } : {}),
    ...(sourceType === 'fixed_roles' && roleRefs.length > 0 ? { roleRefs } : {}),
    ...(sourceType === 'department_manager' && departmentManager ? { departmentManager } : {}),
    ...(emptyHandler ? { emptyHandler } : {}),
  }
}
