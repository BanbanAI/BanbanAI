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

export const isManagerFlowPersonnelSourceType = (
  value: NocodeEditorFlowPersonnelSourceType,
) => value === 'submitter_manager' || value === 'department_manager'

// 运行时的部门负责人节点同时覆盖「提交人主管」与「部门负责人」两种语义，
// 蓝图侧只能用 department-manager 表达，因此两者在来源比较时视为同一类。
export const isSameFlowPersonnelSourceType = (
  left: NocodeEditorFlowPersonnelSourceType,
  right: NocodeEditorFlowPersonnelSourceType,
) => (
  left === right
  || (isManagerFlowPersonnelSourceType(left) && isManagerFlowPersonnelSourceType(right))
)

export type FlowRawPersonnelRequirementDiagnostic = {
  code:
    | 'personnel_department_manager_shape_invalid'
    | 'personnel_department_manager_source_mismatch'
    | 'personnel_field_ref_shape_invalid'
  message: string
  path: string
  stepKey?: string
}

const collectRawSchemeSteps = (value: UnknownRecord) => [
  ...(Array.isArray(value.mainPath)
    ? value.mainPath.map((step, index) => ({ step, path: `mainPath[${index}]` }))
    : []),
  ...(Array.isArray(value.branches)
    ? value.branches.flatMap((branch, branchIndex) => (
      isRecord(branch) && Array.isArray(branch.steps)
        ? branch.steps.map((step, stepIndex) => ({
          step,
          path: `branches[${branchIndex}].steps[${stepIndex}]`,
        }))
        : []
    ))
    : []),
]

// 人员配置的结构错误必须在归一化前拦截：顶层 mode/level 会被静默丢弃，
// 进而把“层级已给”误判成“层级缺失”，下游再生成一张重复的层级确认卡。
export const validateRawFlowPersonnelRequirementShapes = (
  value: unknown,
): FlowRawPersonnelRequirementDiagnostic[] => {
  if (!isRecord(value)) {
    return []
  }

  return collectRawSchemeSteps(value).flatMap(({ step, path }) => {
    if (!isRecord(step) || !isRecord(step.personnelRequirement)) {
      return []
    }
    const requirement = step.personnelRequirement
    const stepKey = normalizeText(step.key || step.nodeKey) || undefined
    const sourceType = normalizeText(requirement.sourceType)
    const stepPath = `${path}.personnelRequirement`
    const diagnostics: FlowRawPersonnelRequirementDiagnostic[] = []
    const hasNestedDepartmentManager = isRecord(requirement.departmentManager)
    const hasTopLevelDivision = requirement.mode !== undefined || requirement.level !== undefined

    if (hasTopLevelDivision && !hasNestedDepartmentManager) {
      diagnostics.push({
        code: 'personnel_department_manager_shape_invalid',
        message: '部门主管的方向和层级必须嵌套在 departmentManager: { mode, level } 中，不能在 personnelRequirement 顶层写 mode/level。',
        path: `${stepPath}.departmentManager`,
        stepKey,
      })
    } else if (hasTopLevelDivision && hasNestedDepartmentManager) {
      diagnostics.push({
        code: 'personnel_department_manager_shape_invalid',
        message: '人员配置同时出现了顶层 mode/level 与 departmentManager，存在两份冲突的部门主管层级，请只保留 departmentManager。',
        path: stepPath,
        stepKey,
      })
    }

    if (hasNestedDepartmentManager) {
      const manager = requirement.departmentManager as UnknownRecord
      const mode = normalizeText(manager.mode)
      const level = Number(manager.level)
      if ((mode !== 'up' && mode !== 'down') || !Number.isInteger(level) || level < 1) {
        diagnostics.push({
          code: 'personnel_department_manager_shape_invalid',
          message: 'departmentManager 必须提供 mode（up/down）与从 1 开始的整数 level。',
          path: `${stepPath}.departmentManager`,
          stepKey,
        })
      }
      if (sourceType !== 'department_manager') {
        diagnostics.push({
          code: 'personnel_department_manager_source_mismatch',
          message: '只有 sourceType=department_manager 时才能配置 departmentManager，否则该配置会被丢弃。',
          path: `${stepPath}.departmentManager`,
          stepKey,
        })
      }
    }

    if (sourceType === 'form_member' || sourceType === 'form_department') {
      const hasTopLevelField = requirement.fieldId !== undefined
        || requirement.fieldName !== undefined
        || requirement.expectedType !== undefined
      if (hasTopLevelField && !isRecord(requirement.fieldRef)) {
        diagnostics.push({
          code: 'personnel_field_ref_shape_invalid',
          message: '表单人员字段必须嵌套在 fieldRef: { fieldId, fieldName, expectedType } 中，不能在 personnelRequirement 顶层写字段信息。',
          path: `${stepPath}.fieldRef`,
          stepKey,
        })
      }
    }

    return diagnostics
  })
}

export type FlowRawPersonnelRequirementNotice = {
  code: 'personnel_field_ref_ignored_for_department_manager'
  message: string
  path: string
  stepKey?: string
}

export const collectRawFlowPersonnelRequirementNotices = (
  value: unknown,
): FlowRawPersonnelRequirementNotice[] => {
  if (!isRecord(value)) {
    return []
  }
  return collectRawSchemeSteps(value).flatMap(({ step, path }) => {
    if (!isRecord(step) || !isRecord(step.personnelRequirement)) {
      return []
    }
    const requirement = step.personnelRequirement
    if (normalizeText(requirement.sourceType) !== 'department_manager') {
      return []
    }
    const fieldRef = isRecord(requirement.fieldRef) ? requirement.fieldRef : null
    const hasFieldSignal = Boolean(
      fieldRef && (normalizeText(fieldRef.fieldId) || normalizeText(fieldRef.fieldName)),
    ) || requirement.fieldId !== undefined || requirement.fieldName !== undefined
    if (!hasFieldSignal) {
      return []
    }
    return [{
      code: 'personnel_field_ref_ignored_for_department_manager' as const,
      message: '部门主管来源不支持按表单字段锚定（运行时按提交人所在部门取主管），本次已忽略 fieldRef 并保留部门主管层级；如需按某个部门字段取主管，请向用户确认或在方案说明中注明。',
      path: `${path}.personnelRequirement.fieldRef`,
      stepKey: normalizeText(step.key || step.nodeKey) || undefined,
    }]
  })
}

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

  const fieldSignalBelongsToSource = sourceType === 'form_member' || sourceType === 'form_department'
  // 部门负责人在运行时按提交人所在部门锚定，不接受 fieldRef。
  // 这里忽略字段锚点，但不能把 sourceType/departmentManager 一起降级，
  // 否则“层级已给”会被误判成“层级缺失”，下游再生成一张重复层级卡。
  const fieldSignalIgnoredForDepartmentManager = sourceType === 'department_manager'

  if (
    (userRefs.length > 0 && sourceType !== 'fixed_users')
    || (roleRefs.length > 0 && sourceType !== 'fixed_roles')
    || (hasFieldSignal && !fieldSignalBelongsToSource && !fieldSignalIgnoredForDepartmentManager)
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
