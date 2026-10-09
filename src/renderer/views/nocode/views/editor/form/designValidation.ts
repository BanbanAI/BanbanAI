import { FormWidgetType } from '@common/types/nocode'
import i18next from 'i18next'

export type FormDesignValidationIssueCode =
  | 'amount_uppercase_missing_lower_amount'
  | 'amount_uppercase_invalid_lower_amount'
  | 'select_data_missing_source'
  | 'select_data_invalid_source'
  | 'related_data_missing_source'
  | 'related_data_invalid_source'
  | 'search_form_missing_source'
  | 'search_form_invalid_source'
  | 'enum_options_missing'
  | 'enum_source_field_missing'
  | 'enum_source_field_invalid'
  | 'auto_compute_missing_field'
  | 'auto_compute_invalid_field'
  | 'auto_compute_missing_formula'

export type FormDesignValidationWidgetSnapshot = {
  uid: string
  type: string
  fieldName?: string
  options?: Record<string, unknown>
  widgets?: FormDesignValidationWidgetSnapshot[]
  children?: FormDesignValidationWidgetSnapshot[]
}

export type FormDesignValidationIssue = {
  widgetId: string
  widgetType: string
  fieldName: string
  code: FormDesignValidationIssueCode
  message: string
  /** 配置不完整只提示、不阻断保存与切换，所以恒为 false；保留字段便于将来标记真正的阻断项 */
  blockingSave: boolean
}

export type FormDesignValidationInput = {
  widgets: FormDesignValidationWidgetSnapshot[]
  selectedTables: Set<string>
  selectedFields: Set<string>
}

export type FormDesignValidationSummary = {
  count: number
  summary: string
}

export type FormDesignValidationIssueHighlightTarget = {
  optionPath?: string[]
}

type DraftPersistenceActionIssueLike = {
  targetKind?: string
  targetId?: string
  targetLabel?: string
  code?: string
  message?: string
}

type DraftPersistenceStateLike = {
  issues?: FormDesignValidationIssue[]
  actionIssues?: DraftPersistenceActionIssueLike[]
}

type DesignOptionGroup = {
  options?: Array<{ value?: unknown; label?: unknown }>
}

type ConnectionLike = {
  uid?: string
  tables?: Array<{
    uid?: string
    fields?: ConnectionFieldLike[]
  }>
}

type ConnectionFieldLike = {
  uid?: string
  subTableFields?: ConnectionFieldLike[]
}

const issueMessages: Record<FormDesignValidationIssueCode, string> = {
  get amount_uppercase_missing_lower_amount() { return i18next.t('designValidation.amountUppercaseMissingLowerAmount') },
  get amount_uppercase_invalid_lower_amount() { return i18next.t('designValidation.amountUppercaseInvalidLowerAmount') },
  get select_data_missing_source() { return i18next.t('designValidation.selectDataMissingSource') },
  get select_data_invalid_source() { return i18next.t('designValidation.selectDataInvalidSource') },
  get related_data_missing_source() { return i18next.t('designValidation.relatedDataMissingSource') },
  get related_data_invalid_source() { return i18next.t('designValidation.relatedDataInvalidSource') },
  get search_form_missing_source() { return i18next.t('designValidation.searchFormMissingSource') },
  get search_form_invalid_source() { return i18next.t('designValidation.searchFormInvalidSource') },
  get enum_options_missing() { return i18next.t('designValidation.enumOptionsMissing') },
  get enum_source_field_missing() { return i18next.t('designValidation.enumSourceFieldMissing') },
  get enum_source_field_invalid() { return i18next.t('designValidation.enumSourceFieldInvalid') },
  get auto_compute_missing_field() { return i18next.t('designValidation.autoComputeMissingField') },
  get auto_compute_invalid_field() { return i18next.t('designValidation.autoComputeInvalidField') },
  get auto_compute_missing_formula() { return i18next.t('designValidation.autoComputeMissingFormula') },
}

const getWidgetChildren = (
  widget: FormDesignValidationWidgetSnapshot,
): FormDesignValidationWidgetSnapshot[] => (
  widget.widgets || widget.children || []
)

const walkWidgets = (
  widgets: FormDesignValidationWidgetSnapshot[] = [],
  visitor: (widget: FormDesignValidationWidgetSnapshot) => void,
) => {
  widgets.forEach((widget) => {
    visitor(widget)
    const children = getWidgetChildren(widget)
    if (children.length > 0) {
      walkWidgets(children, visitor)
    }
  })
}

const getOption = <T = unknown>(
  widget: FormDesignValidationWidgetSnapshot,
  key: string,
): T | undefined => widget.options?.[key] as T | undefined

const hasOptionItems = (items: Array<{ value?: unknown; label?: unknown }> = []) => (
  items.some(item => String(item?.value ?? item?.label ?? '').trim())
)

const pushIssue = (
  issues: FormDesignValidationIssue[],
  widget: FormDesignValidationWidgetSnapshot,
  code: FormDesignValidationIssueCode,
) => {
  issues.push({
    widgetId: widget.uid,
    widgetType: widget.type,
    fieldName: String(widget.fieldName || widget.uid || '').trim(),
    code,
    message: issueMessages[code],
    blockingSave: false,
  })
}

export const resolveFormDesignValidationIssueHighlightTarget = (
  issue: Pick<FormDesignValidationIssue, 'code' | 'widgetType'>,
): FormDesignValidationIssueHighlightTarget => {
  switch (issue.code) {
    case 'amount_uppercase_missing_lower_amount':
    case 'amount_uppercase_invalid_lower_amount':
      return { optionPath: ['related-lower-amount'] }
    case 'select_data_missing_source':
    case 'select_data_invalid_source':
    case 'related_data_missing_source':
    case 'related_data_invalid_source':
      return { optionPath: ['connectionTable'] }
    case 'search_form_missing_source':
    case 'search_form_invalid_source':
      return { optionPath: ['select-search-form'] }
    case 'enum_source_field_missing':
    case 'enum_source_field_invalid':
    case 'auto_compute_missing_field':
    case 'auto_compute_invalid_field':
      return { optionPath: ['other-table-field'] }
    case 'auto_compute_missing_formula':
      return { optionPath: ['compute-formula'] }
    case 'enum_options_missing':
      if (
        issue.widgetType === FormWidgetType.TREE_SELECT
        || issue.widgetType === FormWidgetType.TREE_MULTIPLE_SELECT
      ) {
        return { optionPath: ['treeselect-value-text-option'] }
      }
      if (issue.widgetType === FormWidgetType.RADIO_GROUP) {
        return { optionPath: ['radiogroup-value-text-color-option'] }
      }
      if (issue.widgetType === FormWidgetType.CHECKBOX_GROUP) {
        return { optionPath: ['checkbox-option'] }
      }
      return {}
    default:
      return {}
  }
}

export const buildSelectedTableSet = (connections: ConnectionLike[] = []) => {
  const selectedTables = new Set<string>()
  connections.forEach((connection) => {
    const connectionUID = String(connection?.uid || '').trim()
    if (!connectionUID) return
    connection.tables?.forEach((table) => {
      const tableUID = String(table?.uid || '').trim()
      if (tableUID) {
        selectedTables.add(`${connectionUID},${tableUID}`)
      }
    })
  })
  return selectedTables
}

export const buildSelectedFieldSet = (connections: ConnectionLike[] = []) => {
  const selectedFields = new Set<string>()
  const collectFieldPaths = (
    fields: ConnectionFieldLike[] = [],
    connectionUID = '',
    tableUID = '',
    parentFieldPath = '',
  ) => {
    fields.forEach((field) => {
      const fieldUID = String(field?.uid || '').trim()
      if (!fieldUID) return

      const fieldPath = parentFieldPath ? `${parentFieldPath}.${fieldUID}` : fieldUID
      selectedFields.add(fieldUID)
      selectedFields.add(fieldPath)
      if (connectionUID && tableUID) {
        selectedFields.add(`${connectionUID}.${tableUID}.${fieldPath}`)
      }

      if (Array.isArray(field?.subTableFields) && field.subTableFields.length > 0) {
        collectFieldPaths(field.subTableFields, connectionUID, tableUID, fieldPath)
      }
    })
  }

  connections.forEach((connection) => {
    const connectionUID = String(connection?.uid || '').trim()
    connection.tables?.forEach((table) => {
      const tableUID = String(table?.uid || '').trim()
      collectFieldPaths(table.fields || [], connectionUID, tableUID)
    })
  })
  return selectedFields
}

export const collectFormDesignValidationIssues = ({
  widgets,
  selectedTables,
  selectedFields,
}: FormDesignValidationInput): FormDesignValidationIssue[] => {
  const issues: FormDesignValidationIssue[] = []
  const widgetMap = new Map<string, FormDesignValidationWidgetSnapshot>()

  walkWidgets(widgets, (widget) => {
    const widgetId = String(widget.uid || '').trim()
    if (widgetId) {
      widgetMap.set(widgetId, widget)
    }
  })

  walkWidgets(widgets, (widget) => {
    if (widget.type === FormWidgetType.AMOUNT_INPUT) {
      const amountCase = getOption<string>(widget, 'amount-case')
      const relatedLowerAmount = getOption<string>(widget, 'related-lower-amount')
      if (amountCase === 'upperAmount') {
        if (!relatedLowerAmount) {
          pushIssue(issues, widget, 'amount_uppercase_missing_lower_amount')
          return
        }
        const relatedWidgetId = relatedLowerAmount.split('.').at(-1)
        const relatedWidget = relatedWidgetId ? widgetMap.get(relatedWidgetId) : undefined
        const isValidRelatedLowerAmount = relatedWidget
          ? relatedWidget.type === FormWidgetType.AMOUNT_INPUT
            && getOption<string>(relatedWidget, 'amount-case') !== 'upperAmount'
          : selectedFields.has(relatedLowerAmount)
        if (!isValidRelatedLowerAmount) {
          pushIssue(issues, widget, 'amount_uppercase_invalid_lower_amount')
          return
        }
      }
    }

    if (widget.type === FormWidgetType.SELECT_DATA) {
      const connectionTable = getOption<string>(widget, 'connectionTable')
      if (!connectionTable) {
        pushIssue(issues, widget, 'select_data_missing_source')
        return
      }
      if (!selectedTables.has(connectionTable)) {
        pushIssue(issues, widget, 'select_data_invalid_source')
        return
      }
    }

    if (widget.type === FormWidgetType.RELATED_DATA) {
      const connectionTable = getOption<string>(widget, 'connectionTable')
      if (!connectionTable) {
        pushIssue(issues, widget, 'related_data_missing_source')
        return
      }
      if (!selectedTables.has(connectionTable)) {
        pushIssue(issues, widget, 'related_data_invalid_source')
        return
      }
    }

    if (widget.type === FormWidgetType.SEARCH_FORM) {
      const selectSearchForm = getOption<string>(widget, 'select-search-form')
      if (!selectSearchForm) {
        pushIssue(issues, widget, 'search_form_missing_source')
        return
      }
      if (!selectedTables.has(selectSearchForm)) {
        pushIssue(issues, widget, 'search_form_invalid_source')
        return
      }
    }

    if ([FormWidgetType.TREE_SELECT, FormWidgetType.TREE_MULTIPLE_SELECT].includes(widget.type as FormWidgetType)) {
      const choicesType = getOption<string>(widget, 'select-choices-type')
      if (choicesType === 'custom') {
        const optionItems = getOption<DesignOptionGroup>(widget, 'treeselect-value-text-option')?.options || []
        if (!hasOptionItems(optionItems)) {
          pushIssue(issues, widget, 'enum_options_missing')
          return
        }
      }
      if (choicesType === 'from-table') {
        const otherTableField = getOption<string>(widget, 'other-table-field')
        if (!otherTableField) {
          pushIssue(issues, widget, 'enum_source_field_missing')
          return
        }
        if (!selectedFields.has(otherTableField)) {
          pushIssue(issues, widget, 'enum_source_field_invalid')
          return
        }
      }
    }

    if (widget.type === FormWidgetType.RADIO_GROUP) {
      const optionItems = getOption<DesignOptionGroup>(widget, 'radiogroup-value-text-color-option')?.options || []
      if (!hasOptionItems(optionItems)) {
        pushIssue(issues, widget, 'enum_options_missing')
        return
      }
    }

    if (widget.type === FormWidgetType.CHECKBOX_GROUP) {
      const optionItems = getOption<DesignOptionGroup>(widget, 'checkbox-option')?.options || []
      if (!hasOptionItems(optionItems)) {
        pushIssue(issues, widget, 'enum_options_missing')
        return
      }
    }

    if (widget.type === FormWidgetType.AUTO_COMPUTE) {
      const computeType = getOption<string>(widget, 'compute-type')
      if (computeType === 'quickCompute') {
        const otherTableField = getOption<string>(widget, 'other-table-field')
        if (!otherTableField) {
          pushIssue(issues, widget, 'auto_compute_missing_field')
          return
        }
        if (!selectedFields.has(otherTableField)) {
          pushIssue(issues, widget, 'auto_compute_invalid_field')
          return
        }
      }
      if (computeType === 'formula') {
        const formulaValue = getOption<string>(widget, 'compute-formula')
        if (!formulaValue) {
          pushIssue(issues, widget, 'auto_compute_missing_formula')
        }
      }
    }
  })

  return issues
}

export const summarizeFormDesignValidationIssues = (
  issues: FormDesignValidationIssue[] = [],
): FormDesignValidationSummary => ({
  count: issues.length,
  summary: issues.length > 0
    ? i18next.t('draftIssueActionList.formDraftIncompleteFields', { count: issues.length })
    : i18next.t('draftIssueActionList.draftIssuesCompleted'),
})

export const resolvePersistedFormDesignIssues = (
  state?: DraftPersistenceStateLike | null,
): FormDesignValidationIssue[] => {
  const issues = Array.isArray(state?.issues)
    ? state.issues.filter(item => String(item?.widgetId || '').trim())
    : []
  if (issues.length > 0) {
    return issues
  }

  const rebuiltIssues = Array.isArray(state?.actionIssues)
    ? state.actionIssues
      .filter(item => item?.targetKind === 'form_field')
      .map((item) => {
        const widgetId = String(item?.targetId || '').trim()
        const message = String(item?.message || '').trim()
        const code = String(item?.code || '').trim()
        if (!widgetId || !message || !code) {
          return null
        }
        return {
          widgetId,
          widgetType: '',
          fieldName: String(item?.targetLabel || widgetId).trim() || widgetId,
          code: code as FormDesignValidationIssueCode,
          message,
          blockingSave: false,
        }
      })
      .filter(Boolean) as FormDesignValidationIssue[]
    : []

  if (rebuiltIssues.length <= 1) {
    return rebuiltIssues
  }

  const deduped = new Map<string, FormDesignValidationIssue>()
  rebuiltIssues.forEach((issue) => {
    const key = `${issue.widgetId}:${issue.code}`
    if (!deduped.has(key)) {
      deduped.set(key, issue)
    }
  })
  return [...deduped.values()]
}
