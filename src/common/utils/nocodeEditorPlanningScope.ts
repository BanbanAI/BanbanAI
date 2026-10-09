export type NocodeEditorPlanningScope = 'app' | 'form' | 'board' | 'local' | 'unknown'

export type NocodeEditorPlanningScopeResult = {
  scope: NocodeEditorPlanningScope
  reason: string
}

export const resolveNocodeEditorBlueprintFormulaPlanningScope = (input: {
  blueprintPlanningScope?: NocodeEditorPlanningScope | null
  formulaOrigin?: 'blueprint' | 'standalone' | null
}): NocodeEditorPlanningScope => {
  if (input.formulaOrigin !== 'blueprint') {
    return 'local'
  }

  return input.blueprintPlanningScope === 'app' || input.blueprintPlanningScope === 'form'
    ? input.blueprintPlanningScope
    : 'unknown'
}

const normalizePlanningScopeText = (value: unknown) => String(value ?? '')
  .trim()
  .replace(/\s+/g, '')
  .toLowerCase()

const includesAny = (text: string, keywords: string[]) => (
  keywords.some(keyword => text.includes(keyword))
)

const APP_KEYWORDS = [
  '完整应用',
  '新应用',
  '创建应用',
  '新建应用',
  '生成应用',
  '搭建应用',
  '系统',
  '平台',
  '重构',
  '重做',
  '整个应用',
  '全应用',
]

const APP_CONTAINER_KEYWORDS = [
  'erp',
  '应用',
  '系统',
  '平台',
]

const APP_CREATION_ACTION_KEYWORDS = [
  '做一个',
  '做个',
  '新建',
  '创建',
  '搭建',
  '生成',
]

const EXISTING_APP_FORM_SIGNALS = [
  '当前应用',
  '已有应用',
  '现有应用',
  '当前系统',
  '已有系统',
  '现有系统',
  '当前平台',
  '已有平台',
  '现有平台',
]

const APP_STRUCTURE_SIGNALS = [
  '多表单',
  '跨表单',
  '多个表单',
  '全局',
  '整体',
  '重新梳理',
  '核心业务流转',
  '业务流转',
  '对象关系',
  '核心对象关系',
  '模块结构',
  '多模块',
]

const BUSINESS_MODULE_KEYWORDS = [
  '业务模块',
  '管理模块',
  '业务域',
  '业务线',
]

const APP_ENUM_INTRO_KEYWORDS = [
  '包含',
  '包括',
  '围绕',
  '覆盖',
]

const BOARD_APP_UPGRADE_SIGNALS = [
  '重新定义多个核心对象',
  '多个核心对象',
  '多表单关系',
  '多个表单关系',
  '全局业务流转',
  '重新梳理对象关系',
  '重新定义对象关系',
]

const FORM_KEYWORDS = [
  '登记表',
  '申请表',
  '问卷',
  '调研表',
  '台账',
  '表单',
  '单据',
]

const BOARD_KEYWORDS = [
  '看板',
  '仪表盘',
  '大屏',
  '页面',
  '视图页',
]

const LOCAL_KEYWORDS = [
  '当前表单',
  '已有表单',
  '当前系统',
  '当前平台',
  '当前模块',
  '表内',
  '订单表',
  '申请表',
  '字段',
  '手机号字段',
  '流程',
  '公式',
  '规则',
  '配置',
  '提醒',
  '调整',
  '修改',
  '新增字段',
  '增加字段',
]

const LOCAL_ACTION_KEYWORDS = [
  '新增',
  '增加',
  '调整',
  '修改',
  '配置',
  '改',
]

const hasMultiObjectEnumeration = (text: string) => {
  const separatorCount = (text.match(/[、，,和及与]/g) || []).length
  return separatorCount >= 2
}

const looksLikeWholeFormCreation = (text: string) => (
  /(新增|新建|创建|增加|做一个|做个).{0,24}(表单|登记表|申请表|问卷|调研表|台账|单据|表|单)(?:$|[，。！？!?])/.test(text)
)

export const isNocodeEditorAppCreationIntent = (input: unknown) => {
  const text = normalizePlanningScopeText(input)
  return (
    !includesAny(text, EXISTING_APP_FORM_SIGNALS)
    && includesAny(text, APP_CONTAINER_KEYWORDS)
    && includesAny(text, APP_CREATION_ACTION_KEYWORDS)
  )
}

export const resolveNocodeEditorPlanningScope = (
  input: unknown,
): NocodeEditorPlanningScopeResult => {
  const text = normalizePlanningScopeText(input)

  if (!text) {
    return {
      scope: 'unknown',
      reason: '输入为空，无法稳定判断规划层级。',
    }
  }

  const hasAppKeyword = includesAny(text, APP_KEYWORDS)
  const hasCompleteAppSignal = text.includes('应用') && includesAny(text, ['完整', '从零', '全套'])
  const hasAppCreationIntent = isNocodeEditorAppCreationIntent(text)
  const hasAppContainerKeyword = includesAny(text, APP_CONTAINER_KEYWORDS)
  const hasStructureSignal = includesAny(text, APP_STRUCTURE_SIGNALS)
  const hasBusinessModuleKeyword = includesAny(text, BUSINESS_MODULE_KEYWORDS)
  const hasEnumerationStructureSignal = includesAny(text, APP_ENUM_INTRO_KEYWORDS) && hasMultiObjectEnumeration(text)
  const hasBoardKeyword = includesAny(text, BOARD_KEYWORDS)
  const hasBoardAppUpgradeSignal = hasBoardKeyword && includesAny(text, BOARD_APP_UPGRADE_SIGNALS)
  const hasLocalKeyword = includesAny(text, LOCAL_KEYWORDS)
  const hasLocalAction = includesAny(text, LOCAL_ACTION_KEYWORDS)
  const hasLocalEditIntent = hasLocalKeyword && hasLocalAction
  const hasFormKeyword = includesAny(text, FORM_KEYWORDS)
  const hasExistingAppSignal = includesAny(text, EXISTING_APP_FORM_SIGNALS)
  const hasFormCreationIntent = hasFormKeyword && includesAny(text, ['新增', '新建', '创建', '增加'])
  const hasWholeFormCreationSignal = looksLikeWholeFormCreation(text)
  const hasAppLevelStructureIntent = (hasStructureSignal || hasEnumerationStructureSignal) && (
    hasBusinessModuleKeyword
    || hasAppKeyword
    || hasCompleteAppSignal
    || hasLocalKeyword
  )
  const hasBusinessModuleAppIntent = hasBusinessModuleKeyword && hasAppContainerKeyword

  if (hasLocalEditIntent && !hasStructureSignal && !hasEnumerationStructureSignal && !hasWholeFormCreationSignal) {
    return {
      scope: 'local',
      reason: '需求集中在当前或已有表单内的字段、流程、公式、规则或配置调整。',
    }
  }

  if ((!hasBoardKeyword || hasBoardAppUpgradeSignal) && (
    hasAppKeyword
    || hasCompleteAppSignal
    || hasAppCreationIntent
    || hasAppLevelStructureIntent
    || hasBusinessModuleAppIntent
  )) {
    return {
      scope: 'app',
      reason: hasAppLevelStructureIntent
        ? '需求包含业务模块或局部编辑词，并伴随多表单、全局或核心对象关系等结构影响信号，升级为应用级规划。'
        : '需求指向从零生成、重构或整体梳理应用结构。',
    }
  }

  if (hasBoardKeyword && !hasBoardAppUpgradeSignal) {
    return {
      scope: 'board',
      reason: '需求是在已有应用内新增单个看板或页面，未出现全局结构重定义信号。',
    }
  }

  if ((hasWholeFormCreationSignal || hasFormKeyword || (hasExistingAppSignal && hasFormCreationIntent)) && !hasStructureSignal && !hasBoardKeyword) {
    return {
      scope: 'form',
      reason: hasExistingAppSignal
        ? '需求是在当前或已有应用里新增单张完整表单，未改变多个表单关系或模块结构。'
        : '需求是在已有应用内新增单张完整表单，未改变多个表单关系或模块结构。',
    }
  }

  return {
    scope: 'unknown',
    reason: '缺少足够的应用、表单、看板或局部编辑信号。',
  }
}
