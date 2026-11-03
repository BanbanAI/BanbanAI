import {
  inferBlueprintFieldIntent,
  isGenericBlueprintWidgetType,
  resolveBlueprintExplicitWidgetType,
} from './blueprintFieldIntent'
import type { NocodeEditorBlueprintPlanningCarryover } from './nocodeEditorBlueprintPlanningCarryover'

export type BlueprintFieldInterpretationInput = {
  formName?: string
  name: string
  explicitWidgetType?: string
  description?: string
  notes?: string[]
  hasSource: boolean
  canResolveRelationSource: boolean
  hasChildren: boolean
  enumOptionsCount: number
  hasBlueprint: boolean
  textFirstConfirmed: boolean
  planningCarryover?: NocodeEditorBlueprintPlanningCarryover | null
  isReferencedSourceField?: boolean
  relationConfirmed?: boolean
}

// 字段的组件类型与“是否还需要追问”必须来自同一次判定：
// 蓝图已给出具体声明（组件类型/来源/已确认答复）就是定稿，不再用名称启发式重开追问。
export type BlueprintFieldInterpretation = {
  widgetType?: string
  requiresClarification: boolean
  clarificationQuestion?: string
  // 只有“主数据字段缺来源”的追问能安全地提供“先不关联”的答案空间。
  clarificationKind?: 'relation-source'
}

const resolvedInterpretation = (widgetType: string): BlueprintFieldInterpretation => ({
  widgetType,
  requiresClarification: false,
})

export const resolveBlueprintFieldInterpretation = (
  input: BlueprintFieldInterpretationInput,
): BlueprintFieldInterpretation => {
  const explicitWidgetType = resolveBlueprintExplicitWidgetType(input.explicitWidgetType)
  const name = String(input.name || '').trim()
  if (!name) {
    return resolvedInterpretation('widget.form.textInput')
  }

  const description = String(input.description || '').trim()
  const notes = Array.isArray(input.notes)
    ? input.notes.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const fieldText = [name, description, ...notes].join(' ')

  if (input.hasChildren || /(明细|子项|条目|清单)(表|列表)?$/i.test(name)) {
    return resolvedInterpretation('widget.form.subform')
  }

  if (/(签名|手写签名|签字|signature|handwritten)/i.test(fieldText)) {
    return resolvedInterpretation('widget.form.handwrittenSignature')
  }

  if (input.hasSource && (isGenericBlueprintWidgetType(explicitWidgetType) || !explicitWidgetType)) {
    return resolvedInterpretation('widget.form.treeSelect')
  }

  if (
    !input.hasSource
    && input.hasBlueprint
    && input.textFirstConfirmed
  ) {
    return resolvedInterpretation('widget.form.textInput')
  }

  const shouldDeferExplicitTreeSelectToIntent = (
    explicitWidgetType === 'widget.form.treeSelect'
    && !input.hasSource
  )

  // 显式声明的具体组件即为定稿，不再追问来源。
  if (
    explicitWidgetType
    && !isGenericBlueprintWidgetType(explicitWidgetType)
    && !shouldDeferExplicitTreeSelectToIntent
  ) {
    return resolvedInterpretation(explicitWidgetType)
  }

  const intentDecision = inferBlueprintFieldIntent({
    formName: String(input.formName || '').trim(),
    fieldName: name,
    explicitWidgetType,
    description,
    notes,
    hasSource: input.hasSource,
    canResolveRelationSource: input.canResolveRelationSource,
    hasChildren: input.hasChildren,
    enumOptionsCount: input.enumOptionsCount,
    planningCarryover: input.planningCarryover,
    isReferencedSourceField: input.isReferencedSourceField,
    relationConfirmed: input.relationConfirmed,
  })

  if (
    intentDecision.trustedExplicitWidgetType
    && intentDecision.trustedExplicitWidgetType === explicitWidgetType
  ) {
    return resolvedInterpretation(explicitWidgetType)
  }
  if (intentDecision.requiresClarification) {
    return {
      requiresClarification: true,
      clarificationQuestion: intentDecision.clarificationQuestion,
      ...(intentDecision.intent === 'ambiguous-relation'
        && intentDecision.capabilityFamily === 'master-data-relation'
        ? { clarificationKind: 'relation-source' as const }
        : {}),
    }
  }
  if (intentDecision.widgetType) {
    return resolvedInterpretation(intentDecision.widgetType)
  }
  if (intentDecision.intent === 'free-text-name') {
    return resolvedInterpretation('widget.form.textInput')
  }

  if (/(地址|住址|所在地|收货地址|发货地址|联系地址|配送地址)/.test(fieldText)) {
    return resolvedInterpretation('widget.form.address')
  }

  if (/(金额|单价|总价|售价|进价|成本价|成本金额|合计金额|应收|应付|实收|实付|优惠金额|税额|余额)/.test(fieldText)) {
    return resolvedInterpretation('widget.form.amountInput')
  }

  if (/(编号|编码|单号|单据号|流水号|序号)$/.test(name) && !/(身份证|手机号|电话|邮编|工号|学号|卡号|证号)/.test(name)) {
    return resolvedInterpretation('widget.form.serialNumber')
  }

  if (/(是否启用|是否加急|是否通过|是否公开|是否默认|是否可见|是否允许)/.test(fieldText)) {
    return resolvedInterpretation(
      /(是否通过|是\/否|通过\/不通过)/.test(fieldText)
        ? 'widget.form.radioGroup'
        : 'widget.form.switch',
    )
  }

  if (input.hasSource && /(标签|技能|角色|适用范围|参与角色|覆盖区域|适用品类)/.test(fieldText)) {
    return resolvedInterpretation('widget.form.treeMultipleSelect')
  }

  if (/(时间范围|日期范围|起止时间|起止日期|开始至结束|开始时间到结束时间|开始日期到结束日期)/.test(fieldText)) {
    return resolvedInterpretation('widget.form.dateRangePicker')
  }

  if (/(上课时间|营业时间|时间段|时分秒|钟点|几点|上班时间|下班时间|班次时间)/.test(fieldText)) {
    return resolvedInterpretation('widget.form.timePicker')
  }

  if (/(现场照片|图片|截图|头像|封面|证件照|照片)/.test(fieldText)) {
    return resolvedInterpretation('widget.form.image-uploader')
  }

  if (/(合同附件|报销凭证|证明材料|上传文件|文件附件|资料附件|证件材料|审批附件|附件材料)/.test(fieldText)) {
    return resolvedInterpretation('widget.form.file-uploader')
  }

  if (/^.+附件$/.test(name)) {
    return resolvedInterpretation('widget.form.file-uploader')
  }

  if (input.enumOptionsCount > 0) {
    if (/(标签|技能|角色|适用范围|参与角色|覆盖区域|适用品类)/.test(fieldText)) {
      return resolvedInterpretation('widget.form.checkboxGroup')
    }
    return resolvedInterpretation(
      input.enumOptionsCount <= 4 ? 'widget.form.radioGroup' : 'widget.form.treeSelect',
    )
  }

  if (/(手机|电话|联系方式|联系电话)/.test(name)) {
    return resolvedInterpretation('widget.form.phoneInput')
  }
  if (/(日期|时间|生日|入职日期|下单日期|采购日期|出库日期|入库日期|交货日期)/.test(fieldText)) {
    return resolvedInterpretation('widget.form.datePicker')
  }
  if (/(备注|说明|描述|详情|原因|摘要)/.test(fieldText)) {
    return resolvedInterpretation('widget.form.textarea')
  }
  if (/(学分|学时|数量|库存|件数|箱数|分数|总分|次数|天数|重量|率)/.test(fieldText)) {
    return resolvedInterpretation('widget.form.numberInput')
  }
  if (/(性别|状态|类型|性质|类别)/.test(name)) {
    return resolvedInterpretation('widget.form.radioGroup')
  }
  if (/^(所属|关联|选择)?(院系|店铺|门店|负责人)$/.test(name) || /(所属院系)/.test(name)) {
    return resolvedInterpretation('widget.form.treeSelect')
  }
  return resolvedInterpretation(explicitWidgetType || 'widget.form.textInput')
}
