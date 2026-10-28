import assert from 'node:assert/strict'

import { nocodeEditorToolDefinitions } from '../../src/main/modules/ai/nocode-editor/nocode-editor-tool-definitions'
import { normalizeNocodeEditorFlowPersonnelRequirement } from '../../src/common/utils/nocodeEditorFlowPersonnel'

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value))

const planTool = nocodeEditorToolDefinitions.find(action => action.name === 'editor_plan_flow_scheme')
assert.ok(planTool, 'editor_plan_flow_scheme 必须存在')

const payload = {
  name: planTool.name,
  description: planTool.description,
  notes: (planTool as { notes?: string[] }).notes,
  inputSchema: planTool.inputSchema,
}
const raw = JSON.stringify(planTool.inputSchema)

// oneOf/anyOf 的每个分支都会在工具调用链路里完整序列化一次，不再用变体表达 sourceType 配对。
assert.equal((raw.match(/"oneOf"/g) || []).length, 0)
assert.equal((raw.match(/"anyOf"/g) || []).length, 0)

// 该工具曾经是 47KB 级别；去掉变体后应稳定在 32KB 以内。
assert.ok(bytes(payload) <= 32_000, `flow-scheme 工具仍过大: ${bytes(payload)}B`)

type SchemaNode = {
  type?: unknown
  properties?: Record<string, SchemaNode>
  items?: SchemaNode
  required?: string[]
  additionalProperties?: unknown
  enum?: unknown[]
  anyOf?: unknown
  [key: string]: unknown
}

const schemaRoot = planTool.inputSchema as unknown as SchemaNode
const scheme = schemaRoot.properties!.scheme
const requirement = scheme.properties!.mainPath.items!.properties!.personnelRequirement
assert.deepEqual(requirement.required, ['sourceType'])
assert.equal(requirement.additionalProperties, false)
assert.deepEqual(
  [...requirement.properties.sourceType.enum],
  [
    'submitter',
    'submitter_manager',
    'fixed_users',
    'fixed_roles',
    'department_manager',
    'form_member',
    'form_department',
    'unresolved',
  ],
)
for (const field of ['userRefs', 'roleRefs', 'fieldRef', 'departmentManager', 'emptyHandler']) {
  assert.ok(requirement.properties[field], `personnelRequirement 缺少 ${field}`)
}

// 人员引用不再用 anyOf 复制两份 properties。
const userRefsItem = requirement.properties.userRefs.items
assert.equal(userRefsItem.anyOf, undefined)
assert.ok(userRefsItem.properties.id && userRefsItem.properties.name)

// 变体约束删除后，运行时归一化必须继续按 sourceType 丢弃不匹配字段。
const mismatch = normalizeNocodeEditorFlowPersonnelRequirement({
  sourceType: 'fixed_users',
  roleRefs: [{ id: 'role-1' }],
})
assert.equal(mismatch?.sourceType, 'unresolved')

const matched = normalizeNocodeEditorFlowPersonnelRequirement({
  sourceType: 'fixed_roles',
  roleRefs: [{ name: '财务角色' }],
})
assert.equal(matched?.sourceType, 'fixed_roles')
assert.deepEqual(matched?.roleRefs, [{ name: '财务角色' }])

console.log('flow-scheme-schema-size: ok')
