import fs from 'node:fs'
import path from 'node:path'

type WidgetManifest = {
  name: string
  path?: string
  [key: string]: unknown
}

const projectRoot = path.resolve(__dirname, '../..')
const widgetsRoot = path.join(projectRoot, 'src/renderer/widgets')
const manifestPath = path.join(projectRoot, 'src/common/widgets/manifests.json')
const isCheckOnly = new Set(process.argv.slice(2)).has('--check')

const readJson = <T>(filePath: string): T => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  } catch (error) {
    throw new Error(`failed to read JSON: ${path.relative(projectRoot, filePath)}`, { cause: error })
  }
}

const findManifestFiles = (directory: string): string[] => {
  const files: string[] = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...findManifestFiles(entryPath))
    } else if (entry.isFile() && entry.name === 'manifest.json') {
      files.push(entryPath)
    }
  }
  return files
}

const sourceEntries = findManifestFiles(widgetsRoot)
  .map((filePath) => {
    const widgetPath = path.relative(widgetsRoot, path.dirname(filePath)).replace(/\\/g, '/')
    const manifest = readJson<WidgetManifest>(filePath)
    if (!manifest || typeof manifest !== 'object' || !manifest.name) {
      throw new Error(`widget manifest has no name: ${path.relative(projectRoot, filePath)}`)
    }
    if ('dependencies' in manifest) {
      throw new Error(`widget manifest no longer supports dependencies: ${path.relative(projectRoot, filePath)}`)
    }
    return { ...manifest, path: widgetPath }
  })
  .sort((left, right) => left.path.localeCompare(right.path))

const paths = new Set<string>()
const names = new Set<string>()
for (const entry of sourceEntries) {
  if (paths.has(entry.path)) throw new Error(`duplicate widget manifest path: ${entry.path}`)
  if (names.has(entry.name)) throw new Error(`duplicate widget manifest name: ${entry.name}`)
  paths.add(entry.path)
  names.add(entry.name)
}

const currentEntries = readJson<WidgetManifest[]>(manifestPath)
const entriesByPath = new Map(sourceEntries.map((entry) => [entry.path, entry]))
const orderedEntries: WidgetManifest[] = []
const addedPaths = new Set(sourceEntries.map((entry) => entry.path))

for (const currentEntry of currentEntries) {
  const entry = entriesByPath.get(currentEntry.path || '')
  if (!entry || !addedPaths.has(entry.path)) continue
  orderedEntries.push(entry)
  addedPaths.delete(entry.path)
}

for (const entry of sourceEntries) {
  if (addedPaths.has(entry.path)) orderedEntries.push(entry)
}

const nextContent = `${JSON.stringify(orderedEntries, null, 2)}\n`
const currentContent = fs.readFileSync(manifestPath, 'utf8')

if (isCheckOnly) {
  if (currentContent !== nextContent) {
    throw new Error('src/common/widgets/manifests.json is out of sync with src/renderer/widgets')
  }
  console.log(`[widget-manifests] up to date (${orderedEntries.length} entries)`)
  process.exit(0)
}

if (currentContent !== nextContent) {
  fs.writeFileSync(manifestPath, nextContent, 'utf8')
  console.log(`[widget-manifests] updated (${currentEntries.length} -> ${orderedEntries.length} entries)`)
} else {
  console.log(`[widget-manifests] already up to date (${orderedEntries.length} entries)`)
}
