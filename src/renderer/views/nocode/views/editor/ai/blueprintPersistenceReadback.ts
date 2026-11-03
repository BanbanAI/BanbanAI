import type { BlueprintPersistedFieldEntry } from './types'

export type BlueprintPersistedFormExpectation = {
  tableId: string
  tableName: string
  entries: BlueprintPersistedFieldEntry[]
}

export type BlueprintPersistedFieldLike = {
  alias?: string
  meta?: {
    name?: string
    extra?: { subTableUID?: unknown }
  }
}

export type BlueprintPersistedTableLike = {
  uid?: string
  alias?: string
  fields?: Array<BlueprintPersistedFieldLike | null> | null
}

export type BlueprintPersistedFieldIssueReport = {
  issues: string[]
  warnings: string[]
  // 父字段在应用数据里存在、但拿不到子表定位信息的字段数量；用于断言没有静默跳过的字段
  unverifiedFieldCount: number
}

export type BlueprintPersistedContainerResolution =
  | { table: BlueprintPersistedTableLike; tableId: string; tableName: string }
  | { missingParentField: string }
  | { unresolvedPath: string }
  | { missingSubTable: string }

const normalizeFieldName = (value: unknown) => String(value || '').trim()

const normalizeParentFieldNames = (value: unknown) =>
  Array.isArray(value) ? value.map(normalizeFieldName).filter(Boolean) : []

const readPersistedFieldName = (field: BlueprintPersistedFieldLike | null | undefined) =>
  normalizeFieldName(field?.alias) || normalizeFieldName(field?.meta?.name)

const readPersistedFieldSubTableId = (field: BlueprintPersistedFieldLike | null | undefined) => {
  const raw = field?.meta?.extra?.subTableUID
  return normalizeFieldName(Array.isArray(raw) ? raw[1] : '')
}

const getPersistedTableFields = (table: BlueprintPersistedTableLike | null | undefined) =>
  Array.isArray(table?.fields) ? table.fields : []

const readPersistedTableName = (table: BlueprintPersistedTableLike | null | undefined, tableId: string) =>
  normalizeFieldName(table?.alias) || tableId

export const buildBlueprintPersistedFieldExpectations = (
  results: Array<{
    tableId?: string
    tableName?: string
    persistedFieldEntries?: BlueprintPersistedFieldEntry[]
    fieldsCreated?: string[]
    fieldsUpdated?: string[]
  }>,
): BlueprintPersistedFormExpectation[] => {
  const expectationByTable = new Map<string, BlueprintPersistedFormExpectation>()
  const seenEntryKeys = new Map<string, Set<string>>()

  for (const result of results) {
    const tableId = normalizeFieldName(result?.tableId)
    if (!tableId) continue
    if (!expectationByTable.has(tableId)) {
      expectationByTable.set(tableId, {
        tableId,
        tableName: normalizeFieldName(result?.tableName) || tableId,
        entries: [],
      })
      seenEntryKeys.set(tableId, new Set())
    }
    const expectation = expectationByTable.get(tableId)
    const seenEntryKeysForTable = seenEntryKeys.get(tableId)
    if (!expectation || !seenEntryKeysForTable) continue

    const pushEntry = (parentFieldNames: unknown, fieldName: unknown) => {
      const name = normalizeFieldName(fieldName)
      if (!name) return
      const parents = normalizeParentFieldNames(parentFieldNames)
      const key = `${parents.join('\u0000')}\u0001${name}`
      if (seenEntryKeysForTable.has(key)) return
      seenEntryKeysForTable.add(key)
      expectation.entries.push({ parentFieldNames: parents, fieldName: name })
    }

    const entries = Array.isArray(result?.persistedFieldEntries)
      ? result.persistedFieldEntries
      : []
    if (entries.length) {
      for (const entry of entries) {
        pushEntry(entry?.parentFieldNames, entry?.fieldName)
      }
      continue
    }

    // 兼容尚未接入 persistedFieldEntries 的调用方：旧的字段集合只代表主表字段
    for (const name of Array.isArray(result?.fieldsCreated) ? result.fieldsCreated : []) {
      pushEntry([], name)
    }
    for (const name of Array.isArray(result?.fieldsUpdated) ? result.fieldsUpdated : []) {
      pushEntry([], name)
    }
  }

  return Array.from(expectationByTable.values()).filter(item => item.entries.length > 0)
}

export const resolveBlueprintPersistedContainer = (
  tables: BlueprintPersistedTableLike[],
  mainTable: BlueprintPersistedTableLike,
  parentFieldNames: string[],
): BlueprintPersistedContainerResolution => {
  let table: BlueprintPersistedTableLike = mainTable
  for (let index = 0; index < parentFieldNames.length; index += 1) {
    const fieldName = parentFieldNames[index]
    const pathLabel = parentFieldNames.slice(0, index + 1).join('.')
    const field = getPersistedTableFields(table).find(item => readPersistedFieldName(item) === fieldName)
    if (!field) {
      // 父字段缺失已经由主表字段校验覆盖，这里不再重复报错
      return { missingParentField: pathLabel }
    }
    const subTableId = readPersistedFieldSubTableId(field)
    if (!subTableId) {
      return { unresolvedPath: pathLabel }
    }
    const subTable = tables.find(item => normalizeFieldName(item?.uid) === subTableId)
    if (!subTable) {
      return { missingSubTable: pathLabel }
    }
    table = subTable
  }
  const tableId = normalizeFieldName(table?.uid)
  return {
    table,
    tableId,
    tableName: tableId ? readPersistedTableName(table, tableId) : '',
  }
}

export const collectBlueprintPersistedFieldIssues = (input: {
  tables?: BlueprintPersistedTableLike[] | null
  expectations: BlueprintPersistedFormExpectation[]
}): BlueprintPersistedFieldIssueReport => {
  const tables = Array.isArray(input?.tables) ? input.tables : []
  const issues: string[] = []
  const warnings: string[] = []
  let unverifiedFieldCount = 0

  for (const expectation of input?.expectations || []) {
    const tableId = normalizeFieldName(expectation?.tableId)
    const entries = Array.isArray(expectation?.entries) ? expectation.entries : []
    if (!tableId || !entries.length) continue
    const tableName = normalizeFieldName(expectation?.tableName) || tableId
    const table = tables.find(item => normalizeFieldName(item?.uid) === tableId)
    if (!table) {
      issues.push(`表单「${tableName}」未写入应用数据`)
      continue
    }

    const mainFieldNames = entries
      .filter(entry => !normalizeParentFieldNames(entry?.parentFieldNames).length)
      .map(entry => normalizeFieldName(entry?.fieldName))
      .filter(Boolean)
    if (mainFieldNames.length) {
      const persistedNames = new Set(
        getPersistedTableFields(table).map(readPersistedFieldName).filter(Boolean),
      )
      const missing = Array.from(new Set(mainFieldNames)).filter(name => !persistedNames.has(name))
      if (missing.length) {
        const head = missing.slice(0, 3).join('、')
        issues.push(`表单「${tableName}」有 ${missing.length} 个字段未写入应用数据：${head}${missing.length > 3 ? ' 等' : ''}`)
      }
    }

    const groups = new Map<string, { parentFieldNames: string[]; fieldNames: string[] }>()
    for (const entry of entries) {
      const parentFieldNames = normalizeParentFieldNames(entry?.parentFieldNames)
      if (!parentFieldNames.length) continue
      const groupKey = parentFieldNames.join('\u0000')
      const group = groups.get(groupKey) || { parentFieldNames, fieldNames: [] }
      const fieldName = normalizeFieldName(entry?.fieldName)
      if (fieldName) group.fieldNames.push(fieldName)
      groups.set(groupKey, group)
    }

    for (const group of groups.values()) {
      const pathLabel = group.parentFieldNames.join('.')
      const resolved = resolveBlueprintPersistedContainer(tables, table, group.parentFieldNames)
      if ('missingParentField' in resolved) {
        continue
      }
      if ('unresolvedPath' in resolved) {
        warnings.push(`字段「${pathLabel}」位于子表，但无法从应用数据定位子表，已跳过持久化校验`)
        unverifiedFieldCount += group.fieldNames.length
        continue
      }
      if ('missingSubTable' in resolved) {
        issues.push(`表单「${tableName}」的子表「${pathLabel}」未写入应用数据`)
        continue
      }
      const persistedNames = new Set(
        getPersistedTableFields(resolved.table).map(readPersistedFieldName).filter(Boolean),
      )
      const missing = Array.from(new Set(group.fieldNames)).filter(name => !persistedNames.has(name))
      if (!missing.length) continue
      const head = missing.slice(0, 3).join('、')
      issues.push(`表单「${tableName}」的子表「${resolved.tableName}」有 ${missing.length} 个字段未写入应用数据：${head}${missing.length > 3 ? ' 等' : ''}`)
    }
  }

  return { issues, warnings, unverifiedFieldCount }
}

export type BlueprintPersistedReadbackOutcome = BlueprintPersistedFieldIssueReport & {
  verified: boolean
  readError: string
}

const READBACK_RETRY_DELAY_MS = 500

export const readBlueprintPersistedFieldReport = async (input: {
  read: () => Promise<{ tables?: BlueprintPersistedTableLike[] | null } | null | undefined>
  expectations: BlueprintPersistedFormExpectation[]
  retryDelayMs?: number
  wait?: (delayMs: number) => Promise<void>
}): Promise<BlueprintPersistedReadbackOutcome> => {
  const retryDelayMs = Number.isFinite(input.retryDelayMs)
    ? Math.max(0, Number(input.retryDelayMs))
    : READBACK_RETRY_DELAY_MS
  const wait = input.wait || ((delayMs: number) => new Promise<void>(resolve => setTimeout(resolve, delayMs)))
  let readError = ''

  // 回读是最终事实校验，读取失败不等于写入失败；重试一次覆盖临时 IO/网络抖动
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const persisted = await input.read()
      return {
        verified: true,
        readError: '',
        ...collectBlueprintPersistedFieldIssues({
          tables: persisted?.tables,
          expectations: input.expectations,
        }),
      }
    } catch (error) {
      readError = error instanceof Error ? error.message : String(error)
      if (attempt === 0) {
        await wait(retryDelayMs)
      }
    }
  }

  return { verified: false, readError, issues: [], warnings: [], unverifiedFieldCount: 0 }
}

