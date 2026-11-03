import assert from 'node:assert/strict'

import {
  buildBlueprintPersistedFieldExpectations,
  collectBlueprintPersistedFieldIssues,
  readBlueprintPersistedFieldReport,
  resolveBlueprintPersistedContainer,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintPersistenceReadback'

const main = async () => {
  const expectations = buildBlueprintPersistedFieldExpectations([
    {
      tableId: 't_leave',
      tableName: '学生请假申请表',
      persistedFieldEntries: [
        { parentFieldNames: [], fieldName: '请假类型' },
        { parentFieldNames: [], fieldName: '申请日期' },
        { parentFieldNames: ['学生信息'], fieldName: '姓名' },
        { parentFieldNames: ['学生信息'], fieldName: '学号' },
      ],
    },
  ])
  assert.equal(expectations.length, 1)
  assert.deepEqual(expectations[0].entries, [
    { parentFieldNames: [], fieldName: '请假类型' },
    { parentFieldNames: [], fieldName: '申请日期' },
    { parentFieldNames: ['学生信息'], fieldName: '姓名' },
    { parentFieldNames: ['学生信息'], fieldName: '学号' },
  ])

  const tables = [
    {
      uid: 't_leave',
      alias: '学生请假申请表',
      fields: [
        { alias: '学生信息', meta: { extra: { subTableUID: ['d_leave', 't_info'] } } },
        { alias: '请假类型' },
        { meta: { name: '申请日期' } },
      ],
    },
    {
      uid: 't_info',
      alias: '学生信息明细',
      fields: [{ alias: '姓名' }, { meta: { name: '学号' } }],
    },
  ]

  // 1) 主表 + 一层子表全部落盘
  assert.deepEqual(
    collectBlueprintPersistedFieldIssues({ tables, expectations }),
    { issues: [], warnings: [], unverifiedFieldCount: 0 },
  )

  // 2) 子表缺一个子字段：只报子表，主表不报
  const missingSubField = collectBlueprintPersistedFieldIssues({
    tables: [
      tables[0],
      { uid: 't_info', alias: '学生信息明细', fields: [{ alias: '姓名' }] },
    ],
    expectations,
  })
  assert.deepEqual(missingSubField.issues, [
    '表单「学生请假申请表」的子表「学生信息明细」有 1 个字段未写入应用数据：学号',
  ])
  assert.deepEqual(missingSubField.warnings, [])

  // 3) 两层嵌套子表：按父字段路径解析到最内层
  const nestedTables = [
    {
      uid: 't_a',
      alias: 'A',
      fields: [{ alias: '明细', meta: { extra: { subTableUID: ['d', 't_b'] } } }],
    },
    {
      uid: 't_b',
      alias: 'B',
      fields: [{ alias: '子明细', meta: { extra: { subTableUID: ['d', 't_c'] } } }],
    },
    { uid: 't_c', alias: 'C', fields: [{ alias: '深层字段' }] },
  ]
  const resolved = resolveBlueprintPersistedContainer(nestedTables, nestedTables[0], ['明细', '子明细'])
  if (!('tableId' in resolved)) {
    throw new Error('两层子表应解析到最内层容器')
  }
  assert.equal(resolved.tableId, 't_c')
  assert.equal(resolved.tableName, 'C')
  assert.deepEqual(
    collectBlueprintPersistedFieldIssues({
      tables: nestedTables,
      expectations: [{
        tableId: 't_a',
        tableName: 'A',
        entries: [{ parentFieldNames: ['明细', '子明细'], fieldName: '深层字段' }],
      }],
    }).issues,
    [],
  )

  // 4) 父字段存在但缺少 subTableUID：不判失败，但必须留下 warning 与计数
  const withoutSubTableUid = collectBlueprintPersistedFieldIssues({
    tables: [
      {
        uid: 't_leave',
        alias: '学生请假申请表',
        fields: [{ alias: '学生信息' }, { alias: '请假类型' }, { alias: '申请日期' }],
      },
    ],
    expectations,
  })
  assert.deepEqual(withoutSubTableUid.issues, [])
  assert.deepEqual(withoutSubTableUid.warnings, [
    '字段「学生信息」位于子表，但无法从应用数据定位子表，已跳过持久化校验',
  ])
  assert.equal(withoutSubTableUid.unverifiedFieldCount, 2)

  // 5) 子表整体未落盘
  const missingSubTable = collectBlueprintPersistedFieldIssues({
    tables: [tables[0]],
    expectations,
  })
  assert.deepEqual(missingSubTable.issues, [
    '表单「学生请假申请表」的子表「学生信息」未写入应用数据',
  ])

  // 6) 字段更新（主表 + 子表）都不误报
  const updatedExpectations = buildBlueprintPersistedFieldExpectations([
    {
      tableId: 't_leave',
      tableName: '学生请假申请表',
      fieldsCreated: ['请假类型'],
      fieldsUpdated: ['申请日期'],
      persistedFieldEntries: [
        { parentFieldNames: [], fieldName: '请假类型' },
        { parentFieldNames: [], fieldName: '申请日期' },
        { parentFieldNames: ['学生信息'], fieldName: '姓名' },
      ],
    },
  ])
  assert.deepEqual(
    collectBlueprintPersistedFieldIssues({ tables, expectations: updatedExpectations }),
    { issues: [], warnings: [], unverifiedFieldCount: 0 },
  )

  // 兼容旧调用方：没有 persistedFieldEntries 时按主表字段处理并去重
  const legacy = buildBlueprintPersistedFieldExpectations([
    {
      tableId: 't_leave',
      tableName: '学生请假申请表',
      fieldsCreated: ['学生信息', '请假类型'],
      fieldsUpdated: ['申请日期', '请假类型'],
    },
    { tableId: '', tableName: '忽略', fieldsCreated: ['x'] },
  ])
  assert.deepEqual(legacy, [{
    tableId: 't_leave',
    tableName: '学生请假申请表',
    entries: [
      { parentFieldNames: [], fieldName: '学生信息' },
      { parentFieldNames: [], fieldName: '请假类型' },
      { parentFieldNames: [], fieldName: '申请日期' },
    ],
  }])

  const missingTable = collectBlueprintPersistedFieldIssues({
    tables: [],
    expectations,
  })
  assert.deepEqual(missingTable.issues, ['表单「学生请假申请表」未写入应用数据'])

  const empty = collectBlueprintPersistedFieldIssues({
    tables: null,
    expectations: [],
  })
  assert.deepEqual(empty, { issues: [], warnings: [], unverifiedFieldCount: 0 })

  // 7) 回读请求失败一次后重试成功：视为已验证，默认重试间隔 500ms
  let readAttempts = 0
  const retriedWaits: number[] = []
  const retried = await readBlueprintPersistedFieldReport({
    read: async () => {
      readAttempts += 1
      if (readAttempts === 1) throw new Error('ECONNRESET')
      return { tables }
    },
    expectations,
    wait: async (delayMs) => { retriedWaits.push(delayMs) },
  })
  assert.equal(readAttempts, 2)
  assert.deepEqual(retriedWaits, [500])
  assert.deepEqual(retried, {
    verified: true,
    readError: '',
    issues: [],
    warnings: [],
    unverifiedFieldCount: 0,
  })

  // 8) 连续两次失败：未验证，且不产生字段缺失问题
  let failedReadAttempts = 0
  const unverified = await readBlueprintPersistedFieldReport({
    read: async () => {
      failedReadAttempts += 1
      throw new Error('get-nocode-body 502')
    },
    expectations,
    retryDelayMs: 0,
    wait: async () => {},
  })
  assert.equal(failedReadAttempts, 2)
  assert.deepEqual(unverified, {
    verified: false,
    readError: 'get-nocode-body 502',
    issues: [],
    warnings: [],
    unverifiedFieldCount: 0,
  })

  // 9) 重试成功后仍按真实落盘报缺失
  let missingReadAttempts = 0
  const retriedMissing = await readBlueprintPersistedFieldReport({
    read: async () => {
      missingReadAttempts += 1
      if (missingReadAttempts === 1) throw new Error('temporary')
      return {
        tables: [
          tables[0],
          { uid: 't_info', alias: '学生信息明细', fields: [{ alias: '姓名' }] },
        ],
      }
    },
    expectations,
    wait: async () => {},
  })
  assert.equal(retriedMissing.verified, true)
  assert.deepEqual(retriedMissing.issues, [
    '表单「学生请假申请表」的子表「学生信息明细」有 1 个字段未写入应用数据：学号',
  ])

  console.log('blueprint-persistence-readback: ok')
}

void main()
