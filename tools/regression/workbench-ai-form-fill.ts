import assert from 'node:assert/strict'

import { installRegressionHooks } from './bootstrap'

installRegressionHooks()

const {
  normalizeWorkbenchAiFormFillToolInput,
} = require('../../src/common/utils/workbenchAiFormFill')
const {
  createWorkbenchAiFormFillRuntime,
} = require('../../src/renderer/views/nocode/utils/workbenchAiFormFillRuntime')
const { AiPromptTemplateService } = require('../../src/main/modules/ai/llm/ai-prompt-template.service')

const createClassList = () => {
  const values = new Set<string>()
  return {
    add: (value: string) => values.add(value),
    remove: (value: string) => values.delete(value),
    contains: (value: string) => values.has(value),
  }
}

const createWidget = (options: {
  fieldId: string
  title: string
  type: string
  value?: unknown
  board?: unknown
}) => {
  let value = options.value
  return {
    fieldId: options.fieldId,
    title: options.title,
    type: options.type,
    isHidden: false,
    isReadonly: false,
    isRequired: false,
    dom: { classList: createClassList() },
    getSoul: () => ({ type: options.type }),
    getOption: () => undefined,
    getBoard: () => options.board,
    isEmpty: () => value === undefined || value === null || value === ''
      || (Array.isArray(value) && value.length === 0),
    get currentValue() {
      return value
    },
    trySetInputValue(nextValue: unknown) {
      value = nextValue
    },
  }
}

const createField = (uid: string, name: string, widgetType: string, extra: Record<string, unknown> = {}) => ({
  uid,
  meta: {
    uid,
    name,
    extra: {
      widgetType,
      ...extra,
    },
  },
})

async function main() {
  const promptTemplateService = new AiPromptTemplateService()
  const unavailableFormPrompt = promptTemplateService.buildUserPrompt({
    userMessage: '帮我填报销单',
    currentFormFillUnavailable: true,
  })
  assert.match(unavailableFormPrompt, /当前没有打开可填写的表单/, '未打开表单时应该向模型说明填写不可用')
  assert.match(unavailableFormPrompt, /不要声称已经填写、保存或提交表单/, '未打开表单时不应允许模型虚报填写完成')
  assert.match(unavailableFormPrompt, /先打开需要填写的表单/, '未打开表单时应该指引用户先打开表单')
  const unavailableProviderPrompt = promptTemplateService.buildUserPrompt({
    userMessage: '帮我填报销单',
    metadata: { providerPromptContent: '附件摘要' },
    currentFormFillUnavailable: true,
  })
  assert.match(unavailableProviderPrompt, /当前没有打开可填写的表单/, '自定义 provider prompt 也不应绕过无表单提示')
  const availableFormPrompt = promptTemplateService.buildUserPrompt({
    userMessage: '帮我填写',
    currentFormFillContext: {
      contextId: 'context-current',
      appId: 'app-1',
      tableId: 'table-main',
      tableName: '报销单',
      formMode: 'add',
      fields: [{ id: 'field-name', name: '报销人', type: 'widget.form.textInput' }],
      unsupportedFields: [],
    },
  })
  assert.doesNotMatch(availableFormPrompt, /当前没有打开可填写的表单/, '打开表单后不应出现填写不可用提示')

  const board = {
    async getOrganizeUsers() {
      return [
        { id: 'user-1', realname: '张三', user: 'zhangsan-1' },
        { id: 'user-2', realname: '张三', user: 'zhangsan-2' },
        { id: 'user-3', realname: '李四', user: 'lisi' },
      ]
    },
    async getOrganizeDepartments() {
      return [{ id: 'department-1', name: '研发部' }]
    },
  }

  const nameWidget = createWidget({
    fieldId: 'field-name',
    title: '姓名',
    type: 'widget.form.textInput',
    value: '用户原值',
    board,
  })
  const amountWidget = createWidget({
    fieldId: 'field-amount',
    title: '金额',
    type: 'widget.form.amountInput',
    board,
  })
  const memberWidget = createWidget({
    fieldId: 'field-member',
    title: '负责人',
    type: 'widget.form.memberSelect',
    value: [],
    board,
  })
  const imageWidget = createWidget({
    fieldId: 'field-image',
    title: '现场图片',
    type: 'widget.form.image-uploader',
    board,
  })
  const subformWidget = createWidget({
    fieldId: 'field-details',
    title: '费用明细',
    type: 'widget.form.subform',
    value: [{ __uuid__: 'detail-1', 'detail-name': '交通', 'detail-amount': 10 }],
    board,
  })
  const subformRenderedRows = [{
    row: (subformWidget.currentValue as Array<Record<string, unknown>>)[0],
    setRow(row: Record<string, unknown>) {
      this.row = row
    },
  }]
  const renderedHighlightClassList = createClassList()
  const form = {
    formInputs: [nameWidget, amountWidget, memberWidget, imageWidget, subformWidget],
  }
  const subTable = {
    uid: 'table-details',
    fields: [
      createField('detail-name', '项目', 'widget.form.textInput'),
      createField('detail-amount', '金额', 'widget.form.amountInput'),
    ],
  }
  const table = {
    uid: 'table-main',
    alias: '报销单',
    fields: [
      createField('field-name', '姓名', 'widget.form.textInput'),
      createField('field-amount', '金额', 'widget.form.amountInput'),
      createField('field-member', '负责人', 'widget.form.memberSelect'),
      createField('field-image', '现场图片', 'widget.form.image-uploader'),
      createField('field-details', '费用明细', 'widget.form.subform', {
        subTableUID: ['form-data', 'table-details'],
      }),
    ],
  }
  const runtime = createWorkbenchAiFormFillRuntime({
    contextId: 'context-current',
    appId: 'app-1',
    appName: '报销应用',
    formMode: 'edit',
    getForm: () => form,
    getTable: () => table,
    getFormData: () => ({ tables: [subTable] }),
    getWidgetElement: widget => widget === amountWidget
      ? { classList: renderedHighlightClassList } as unknown as HTMLElement
      : widget.dom as unknown as HTMLElement,
    setWidgetValue: (widget, value) => {
      widget.trySetInputValue(value)
      if (widget === subformWidget) {
        const rows = widget.currentValue as Array<Record<string, unknown>>
        subformRenderedRows.forEach((row, index) => row.setRow(rows[index] || {}))
      }
    },
  })

  const snapshot = runtime.getSnapshot()
  assert.ok(snapshot, '当前表单应该生成可填写上下文')
  assert.deepEqual(
    snapshot.unsupportedFields.map((field: any) => field.id),
    ['field-image'],
    '图片字段应该出现在不支持列表，而不是可填写字段中',
  )
  const subformContext = snapshot.fields.find((field: any) => field.id === 'field-details')
  assert.equal(subformContext.rows[0].rowToken, 'detail-1', '子表单应该暴露稳定行标识')
  assert.equal(subformContext.rows[0].fields[0].hasValue, true, '子表单应该描述现有值状态')

  assert.equal(
    normalizeWorkbenchAiFormFillToolInput({
      contextId: 'context-stale',
      fields: [{ fieldId: 'field-name', value: '错误写入' }],
    }, snapshot),
    null,
    '表单上下文切换后必须拒绝旧工具调用',
  )

  const fillEmptyResult = await runtime.applyFill({
    contextId: 'context-current',
    fields: [
      { fieldId: 'field-name', value: 'AI 新值' },
      { fieldId: 'field-amount', value: '88.5' },
    ],
  })
  assert.equal(nameWidget.currentValue, '用户原值', '默认填写不能覆盖已有值')
  assert.equal(amountWidget.currentValue, 88.5, '空数字字段应该写入规范化数值')
  assert.equal(fillEmptyResult.status, 'partial', '保留已有值时应该返回部分完成')
  assert.equal(renderedHighlightClassList.contains('is-ai-form-filled'), true, '高亮应该添加到当前实际渲染节点')

  amountWidget.trySetInputValue(99)
  const guardedUndo = await runtime.undoFill(fillEmptyResult.operationId)
  assert.equal(guardedUndo.status, 'partial', '字段被用户再次修改后撤销应该部分完成')
  assert.equal(amountWidget.currentValue, 99, '撤销不能覆盖 AI 填写后的用户手动修改')

  const replaceResult = await runtime.applyFill({
    contextId: 'context-current',
    fields: [{ fieldId: 'field-name', value: 'AI 新值', writeMode: 'replace' }],
  })
  assert.equal(nameWidget.currentValue, 'AI 新值', '用户明确要求修改时允许覆盖已有值')
  await runtime.undoFill(replaceResult.operationId)
  assert.equal(nameWidget.currentValue, '用户原值', '撤销应该恢复 AI 填写前的值')

  const memberResult = await runtime.applyFill({
    contextId: 'context-current',
    fields: [{ fieldId: 'field-member', value: '李四' }],
  })
  assert.deepEqual(memberWidget.currentValue, ['user-3'], '人员名称唯一匹配后应该写入人员 ID')
  assert.equal(memberResult.status, 'applied')
  await runtime.undoFill(memberResult.operationId)

  const ambiguousMemberResult = await runtime.applyFill({
    contextId: 'context-current',
    fields: [{ fieldId: 'field-member', value: '张三' }],
  })
  assert.equal(ambiguousMemberResult.status, 'not_applied', '人员同名时不能猜测写入')
  assert.equal(ambiguousMemberResult.unresolved[0].candidates.length, 2, '人员同名时应该返回候选项')

  const subformResult = await runtime.applyFill({
    contextId: 'context-current',
    subforms: [
      {
        fieldId: 'field-details',
        operation: 'update_rows',
        rows: [{
          rowToken: 'detail-1',
          fields: [
            { fieldId: 'detail-name', value: '市内交通', writeMode: 'replace' },
            { fieldId: 'detail-amount', value: 20, writeMode: 'replace' },
          ],
        }],
      },
      {
        fieldId: 'field-details',
        operation: 'append_rows',
        rows: [{
          fields: [
            { fieldId: 'detail-name', value: '住宿' },
            { fieldId: 'detail-amount', value: 300 },
          ],
        }],
      },
    ],
  })
  assert.equal(subformResult.status, 'applied')
  assert.deepEqual(subformWidget.currentValue, [
    { __uuid__: 'detail-1', 'detail-name': '市内交通', 'detail-amount': 20 },
    { 'detail-name': '住宿', 'detail-amount': 300 },
  ], '子表单应该支持更新现有行并追加多条明细')
  assert.equal(subformRenderedRows[0].row['detail-amount'], 20, '子表单填写应该同步已挂载的行控制器')
  const appliedSubformRows = subformWidget.currentValue as Array<Record<string, unknown>>
  appliedSubformRows[0].__runtime = 'generated-by-subform'
  appliedSubformRows[0]['detail-name'] = '用户手动修改'
  appliedSubformRows[1]['detail-default-date'] = '2026-07-01'
  await runtime.undoFill(subformResult.operationId)
  const undoneSubformRows = subformWidget.currentValue as Array<Record<string, unknown>>
  assert.equal(undoneSubformRows.length, 1, '未改动的 AI 追加行应该在撤销时删除')
  assert.equal(undoneSubformRows[0]['detail-amount'], 10, '子表单应该撤销未被用户修改的单元格')
  assert.equal(undoneSubformRows[0]['detail-name'], '用户手动修改', '用户修改过的子表单单元格应该保留')
  assert.equal(undoneSubformRows[0].__runtime, undefined, '填充后新增的运行时元数据不应进入还原结果')
  assert.equal(subformRenderedRows[0].row['detail-amount'], 10, '撤销应该同步恢复已挂载的子表单行控制器')

  subformWidget.trySetInputValue([{ __uuid__: 'detail-1', 'detail-name': '交通', 'detail-amount': 10 }])
  const directUndoResult = await runtime.applyFill({
    contextId: 'context-current',
    subforms: [{
      fieldId: 'field-details',
      operation: 'append_rows',
      rows: [{ fields: [{ fieldId: 'detail-name', value: '餐饮' }] }],
    }],
  })
  const directUndoRows = subformWidget.currentValue as Array<Record<string, unknown>>
  directUndoRows[1].__runtime = 'generated-by-subform'
  await runtime.undoFill(directUndoResult.operationId)
  assert.deepEqual(subformWidget.currentValue, [
    { __uuid__: 'detail-1', 'detail-name': '交通', 'detail-amount': 10 },
  ], '没有用户修改时应该直接恢复原始子表单值')

  console.log('workbench AI form fill regression checks passed')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
