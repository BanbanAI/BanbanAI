/* eslint-disable @typescript-eslint/no-require-imports */
import assert from 'node:assert/strict'

import type { NocodeEditorAiAppBlueprint } from '../../src/renderer/views/nocode/views/editor/ai/types'

const createStorage = () => {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
  }
}
Object.assign(globalThis, {
  localStorage: createStorage(),
  sessionStorage: createStorage(),
})

// 宿主运行时还引用了依赖 UI/路由的流程运行时；本回归只验证蓝图澄清推导，
// 用空实现替换掉这条浏览器侧依赖链。
const Module = require('node:module') as {
  _load: (request: string, ...args: unknown[]) => unknown
}
const originalLoad = Module._load
Module._load = function (this: unknown, request: string, ...args: unknown[]) {
  if (request === '../form/ai-form-process-runtime') {
    return {
      asArray: (value: unknown) => Array.isArray(value) ? value : [],
      asRecord: (value: unknown) => (
        value && typeof value === 'object' && !Array.isArray(value) ? value : {}
      ),
    }
  }
  return originalLoad.call(this, request, ...args)
}

const {
  deriveBlueprintClarificationQuestions,
} = require('../../src/renderer/views/nocode/views/editor/ai/useNocodeEditorAiHostRuntime') as typeof import('../../src/renderer/views/nocode/views/editor/ai/useNocodeEditorAiHostRuntime')

const masterForm = {
  formKey: 'form-student',
  tableName: '学生信息管理',
  fields: [
    { fieldKey: 'f-class', name: '班级' },
  ],
}

const requestForm = {
  formKey: 'form-leave',
  tableName: '学生请假申请表',
  fields: [
    { fieldKey: 'f-student', name: '学生' },
    { fieldKey: 'f-days', name: '请假天数' },
  ],
}

const createBlueprint = (forms: Array<typeof masterForm | typeof requestForm>) => ({
  forms,
} as unknown as NocodeEditorAiAppBlueprint)

const assertClassDefinitionFieldNotQuestioned = (
  blueprint: NocodeEditorAiAppBlueprint,
  label: string,
) => {
  const questions = deriveBlueprintClarificationQuestions(blueprint)
  assert.ok(
    !questions.some(question => question.includes('班级')),
    `${label} 不应追问主数据定义字段：${questions.join(' | ')}`,
  )
}

// 请假表的“学生”字段会推导出 source=学生信息管理.班级；无论表单顺序如何，
// 学生信息管理.班级 都应被识别为主数据定义字段。
assertClassDefinitionFieldNotQuestioned(createBlueprint([masterForm, requestForm]), '主表在前')
assertClassDefinitionFieldNotQuestioned(createBlueprint([requestForm, masterForm]), '主表在后')

console.log('blueprint-source-reference-order: ok')
