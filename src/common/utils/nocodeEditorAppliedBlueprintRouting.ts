import { isBlueprintAppliedPhase } from './nocodeEditorBlueprintLifecycle'

type AppliedBlueprintRoutingFormLike = {
  tableId?: unknown
  tableName?: unknown
  formKey?: unknown
}

type AppliedBlueprintRoutingBlockLike = {
  kind?: unknown
  status?: unknown
  phase?: unknown
  blueprint?: {
    forms?: AppliedBlueprintRoutingFormLike[] | null
  } | null
  applyResult?: {
    forms?: AppliedBlueprintRoutingFormLike[] | null
  } | null
}

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeComparableText = (value: unknown) => normalizeText(value)
  .toLocaleLowerCase()
  .replace(/\s+/g, '')
  .replace(/[，。！？、；：,.!?;:'"“”‘’（）()\[\]{}]/g, '')

const isSameText = (left: unknown, right: unknown) => {
  const normalizedLeft = normalizeComparableText(left)
  const normalizedRight = normalizeComparableText(right)
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}

const toFormArray = (value: unknown): AppliedBlueprintRoutingFormLike[] => (
  Array.isArray(value) ? value : []
)

const hasExplicitPendingBlueprintEditIntent = (value: unknown) => {
  const text = normalizeText(value)
  if (!text) {
    return false
  }

  return [
    '继续修改这份蓝图',
    '继续改这份蓝图',
    '继续调整这份蓝图',
    '继续修改当前蓝图',
    '继续改当前蓝图',
    '继续调整当前蓝图',
    '修改这份蓝图',
    '改这份蓝图',
    '调整这份蓝图',
    '修改当前蓝图',
    '改当前蓝图',
    '调整当前蓝图',
    '这份蓝图',
    '当前蓝图',
    '蓝图草案',
    '继续改蓝图',
    '继续修改蓝图',
    '改蓝图',
    '修改蓝图',
    '调整蓝图',
    '重做蓝图',
    '重新整理蓝图',
    '刷新蓝图',
  ].some(keyword => text.includes(keyword))
}

const hasAnyKeyword = (text: string, keywords: string[]) => (
  keywords.some(keyword => text.includes(keyword))
)

const LOCAL_FIELD_DELETE_ACTION_KEYWORDS = [
  '删除',
  '删掉',
  '删了',
  '删去',
  '删字段',
  '去掉',
  '移除',
  '拿掉',
  '不要',
]

const LOCAL_FIELD_DELETE_EXCLUDED_OBJECT_KEYWORDS = [
  '流程',
  '应用',
  '蓝图',
  '方案',
  '页面',
  '模块',
]

const LOCAL_FIELD_DELETE_OBJECT_KEYWORDS = [
  '字段',
  '控件',
  '列',
  '栏目',
  '表单项',
  '输入项',
  '附件',
  '备注',
  '说明',
  '图片',
  '照片',
  '文件',
]

const hasLocalFieldDeleteIntent = (value: unknown) => {
  const text = normalizeText(value)
  if (!text) {
    return false
  }

  if (!hasAnyKeyword(text, LOCAL_FIELD_DELETE_ACTION_KEYWORDS)) {
    return false
  }

  const hasFieldObject = hasAnyKeyword(text, LOCAL_FIELD_DELETE_OBJECT_KEYWORDS)
  if (!hasFieldObject) {
    return false
  }

  if (hasAnyKeyword(text, LOCAL_FIELD_DELETE_EXCLUDED_OBJECT_KEYWORDS)) {
    return false
  }

  return true
}

const hasLocalFieldEditIntent = (value: unknown) => {
  const text = normalizeText(value)
  if (!text) {
    return false
  }

  if (hasAnyKeyword(text, LOCAL_FIELD_DELETE_ACTION_KEYWORDS)) {
    return hasLocalFieldDeleteIntent(text)
  }

  return [
    '当前表单',
    '这个表单',
    '这张表单',
    '继续加字段',
    '新增字段',
    '增加字段',
    '添加字段',
    '加字段',
    '加一个字段',
    '添加一个字段',
    '新增一个字段',
    '增加一个字段',
    '再加一个字段',
    '改字段',
    '修改字段',
    '替换字段',
    '字段类型',
    '字段设置',
    '上传附件字段',
    '附件字段',
  ].some(keyword => text.includes(keyword))
}

export const hasAppliedBlueprintForActiveForm = (options: {
  activeFormId?: unknown
  activeFormName?: unknown
  blueprintBlocks?: unknown[] | null
}) => {
  const activeFormId = normalizeText(options.activeFormId)
  const activeFormName = normalizeText(options.activeFormName)
  if (!activeFormId && !activeFormName) {
    return false
  }

  const blocks = Array.isArray(options.blueprintBlocks) ? options.blueprintBlocks : []
  return blocks.some((rawBlock) => {
    const block = rawBlock as AppliedBlueprintRoutingBlockLike
    if (normalizeText(block?.kind) !== 'blueprint') {
      return false
    }
    if (normalizeText(block?.status) && normalizeText(block.status) !== 'ready') {
      return false
    }
    if (!isBlueprintAppliedPhase(block.phase)) {
      return false
    }

    const appliedForms = toFormArray(block.applyResult?.forms)
    if (activeFormId && appliedForms.some(form => normalizeText(form.tableId) === activeFormId)) {
      return true
    }
    if (activeFormName && appliedForms.some(form => isSameText(form.tableName, activeFormName))) {
      return true
    }

    const blueprintForms = toFormArray(block.blueprint?.forms)
    return Boolean(activeFormName && blueprintForms.some(form => isSameText(form.tableName, activeFormName)))
  })
}

export const shouldPreferAppliedFormEditingOverPendingBlueprint = (options: {
  userMessage?: unknown
  hasPendingBlueprint?: unknown
  activeFormId?: unknown
  activeFormName?: unknown
  blueprintBlocks?: unknown[] | null
}) => {
  if (!Boolean(options.hasPendingBlueprint)) {
    return false
  }
  if (hasExplicitPendingBlueprintEditIntent(options.userMessage)) {
    return false
  }
  if (!hasAppliedBlueprintForActiveForm({
    activeFormId: options.activeFormId,
    activeFormName: options.activeFormName,
    blueprintBlocks: options.blueprintBlocks,
  })) {
    return false
  }
  return hasLocalFieldEditIntent(options.userMessage)
}
