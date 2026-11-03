import fs from 'node:fs'
import { execSync } from 'node:child_process'

// 三语 key 集合一致性 + 本次改动文件里字面量 i18next.t() 的 key 是否存在。
// 缺失 key 报错；en / zh-TW 多出的历史 key 只告警，避免存量脏数据挡住门禁。

const LANGUAGES = ['zh-CN', 'en', 'zh-TW'] as const
const BASE_LANGUAGE = 'zh-CN'
const LOCALE_FILE = (language: string) => `src/locales/${language}/lang.json`

type LocaleLeaves = Set<string>

const flattenKeys = (value: unknown, prefix = '', output: LocaleLeaves = new Set()) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      flattenKeys((value as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key, output)
    }
  } else if (prefix) {
    output.add(prefix)
  }
  return output
}

const readLocaleLeaves = (language: string) => {
  const content = fs.readFileSync(LOCALE_FILE(language), 'utf8')
  return flattenKeys(JSON.parse(content))
}

const tryExec = (command: string) => {
  try {
    return execSync(command, { encoding: 'utf8' })
  } catch {
    return ''
  }
}

const collectChangedSourceFiles = () => {
  const diffOutput = tryExec('git diff --name-only HEAD')
  const untrackedOutput = tryExec('git ls-files --others --exclude-standard')
  return [...diffOutput.split(/\r?\n/), ...untrackedOutput.split(/\r?\n/)]
    .map(file => file.trim())
    .filter(file => /\.(ts|vue)$/u.test(file) && fs.existsSync(file))
}

const collectReferencedKeys = (files: string[]) => {
  const keys = new Set<string>()
  const pattern = /i18next\.t\(\s*['"]([^'"]+)['"]/gu
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content))) {
      keys.add(match[1])
    }
  }
  return keys
}

const resolveKey = (dictionary: Record<string, unknown>, key: string) => key
  .split('.')
  .reduce<unknown>((current, part) => (
    current && typeof current === 'object'
      ? (current as Record<string, unknown>)[part]
      : undefined
  ), dictionary)

const main = () => {
  const leaves = new Map<string, LocaleLeaves>(
    LANGUAGES.map(language => [language, readLocaleLeaves(language)]),
  )
  const baseLeaves = leaves.get(BASE_LANGUAGE) as LocaleLeaves
  const warnings: string[] = []
  const errors: string[] = []

  for (const language of LANGUAGES) {
    if (language === BASE_LANGUAGE) {
      continue
    }
    const languageLeaves = leaves.get(language) as LocaleLeaves
    const missing = [...baseLeaves].filter(key => !languageLeaves.has(key))
    const extra = [...languageLeaves].filter(key => !baseLeaves.has(key))
    if (missing.length) {
      errors.push(`${language} 缺少 ${missing.length} 个 key：${missing.slice(0, 10).join(', ')}`)
    }
    if (extra.length) {
      warnings.push(`${language} 多出 ${extra.length} 个历史 key（不阻断）：${extra.slice(0, 10).join(', ')}`)
    }
  }

  const dictionaries = Object.fromEntries(LANGUAGES.map(language => [
    language,
    JSON.parse(fs.readFileSync(LOCALE_FILE(language), 'utf8')) as Record<string, unknown>,
  ]))
  const changedSourceFiles = collectChangedSourceFiles()
  const referencedKeys = collectReferencedKeys(changedSourceFiles)
  for (const key of referencedKeys) {
    const missing = LANGUAGES.filter(language => resolveKey(dictionaries[language], key) === undefined)
    if (missing.length) {
      errors.push(`引用 key 缺失：${key}（${missing.join(', ')}）`)
    }
  }

  for (const warning of warnings) {
    console.log(`WARN ${warning}`)
  }
  for (const error of errors) {
    console.error(`ERROR ${error}`)
  }
  console.log(`i18n parity: 检查改动文件 ${changedSourceFiles.length} 个，引用 key ${referencedKeys.size} 个`)
  if (errors.length) {
    process.exitCode = 1
    return
  }
  console.log('i18n parity: passed')
}

main()
