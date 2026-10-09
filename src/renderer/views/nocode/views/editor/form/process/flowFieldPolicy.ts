import type { Field } from '@common/types/project'
import { FormWidgetType } from '@common/types/nocode'

export type FlowFieldWritePolicy =
  | 'writable'
  | 'readonly'
  | 'system-generated'
  | 'relation-derived'
  | 'not-rendered'
  | 'unsupported-widget'

export type FlowFieldConditionPolicy =
  | 'usable'
  | 'not-rendered'
  | 'unsupported-widget'

export type FlowFieldOwnerPolicy =
  | 'member'
  | 'department'
  | 'none'

export type FlowFieldPolicyContext = {
  isRenderedField?: (field: Field) => boolean
  isEditableSystemField?: (field: Field) => boolean
  isRelatedCurrentTableField?: (field: Field) => boolean
}

const MEMBER_WIDGET_TYPES = new Set([
  'widget.form.memberSelect',
])

const DEPARTMENT_WIDGET_TYPES = new Set([
  'widget.form.departmentSelect',
])

const DATE_RANGE_WIDGET_TYPE = 'widget.form.dateRangePicker'

const getWidgetType = (field?: Field | null) => String(field?.meta?.extra?.widgetType || '').trim()
const getSubType = (field?: Field | null) => String(field?.meta?.subType || '').trim().toLowerCase()

const hasRelatedTable = (field?: Field | null) => Boolean(field?.meta?.extra?.relatedTableUID)

const isAutoComputeField = (field?: Field | null) => getWidgetType(field) === FormWidgetType.AUTO_COMPUTE

const isDateRangeField = (field?: Field | null) => getWidgetType(field) === DATE_RANGE_WIDGET_TYPE

const hasFormula = (field?: Field | null) => Boolean(field?.meta?.extra?.formula)

const isEditableSystemField = (
  field: Field,
  context?: FlowFieldPolicyContext,
) => Boolean(context?.isEditableSystemField?.(field))

const isRenderedField = (
  field: Field,
  context?: FlowFieldPolicyContext,
) => context?.isRenderedField?.(field) ?? true

export const getFlowFieldWritePolicy = (
  field?: Field | null,
  context?: FlowFieldPolicyContext,
): FlowFieldWritePolicy => {
  if (!field) {
    return 'unsupported-widget'
  }

  if (field.meta?.isSystem && !isEditableSystemField(field, context)) {
    return 'system-generated'
  }

  if (!isRenderedField(field, context)) {
    return 'not-rendered'
  }

  if (isDateRangeField(field)) {
    return 'unsupported-widget'
  }

  if (isAutoComputeField(field)) {
    return 'readonly'
  }

  if (hasRelatedTable(field) && context?.isRelatedCurrentTableField && !context.isRelatedCurrentTableField(field)) {
    return 'relation-derived'
  }

  return 'writable'
}

export const getFlowFieldConditionPolicy = (
  field?: Field | null,
  context?: FlowFieldPolicyContext,
): FlowFieldConditionPolicy => {
  if (!field) {
    return 'unsupported-widget'
  }

  if (!isRenderedField(field, context)) {
    return 'not-rendered'
  }

  if (isDateRangeField(field)) {
    return 'unsupported-widget'
  }

  return 'usable'
}

export const getFlowFieldOwnerPolicy = (
  field?: Field | null,
): FlowFieldOwnerPolicy => {
  const widgetType = getWidgetType(field)
  const subType = getSubType(field)
  if (
    MEMBER_WIDGET_TYPES.has(widgetType)
    || /member|account/i.test(widgetType)
    || subType === 'account'
  ) {
    return 'member'
  }
  if (
    DEPARTMENT_WIDGET_TYPES.has(widgetType)
    || /department|dept/i.test(widgetType)
    || subType === 'department'
  ) {
    return 'department'
  }
  return 'none'
}
