export type CopyTextMethod = 'clipboard' | 'execCommand'

type NavigatorClipboardLike = {
  clipboard?: {
    writeText?: (value: string) => Promise<void>
  }
}

type ActiveElementLike = {
  focus?: () => void
} | null

type TextAreaLike = {
  value: string
  style: Record<string, string>
  select?: () => void
  focus?: () => void
  setSelectionRange?: (start: number, end: number) => void
  remove: () => void
}

type DocumentLike = {
  activeElement?: ActiveElementLike
  body?: {
    appendChild: (node: TextAreaLike) => void
  }
  createElement?: (tag: string) => TextAreaLike
  execCommand?: (command: string) => boolean
}

export type CopyTextOptions = {
  navigator?: NavigatorClipboardLike
  document?: DocumentLike
}

const getDefaultNavigator = (): NavigatorClipboardLike | undefined => {
  return typeof navigator === 'undefined' ? undefined : navigator
}

const getDefaultDocument = (): DocumentLike | undefined => {
  return typeof document === 'undefined' ? undefined : document as unknown as DocumentLike
}

const tryNavigatorClipboardCopy = async (value: string, runtimeNavigator?: NavigatorClipboardLike) => {
  const writeText = runtimeNavigator?.clipboard?.writeText
  if (typeof writeText !== 'function') {
    return false
  }

  await writeText(value)
  return true
}

const execCommandCopy = (value: string, runtimeDocument?: DocumentLike) => {
  if (!runtimeDocument?.body || typeof runtimeDocument.createElement !== 'function' || typeof runtimeDocument.execCommand !== 'function') {
    throw new Error('execCommand copy is unavailable')
  }

  const textarea = runtimeDocument.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.opacity = '0'

  const activeElement = runtimeDocument.activeElement
  runtimeDocument.body.appendChild(textarea)
  textarea.focus?.()
  textarea.select?.()
  textarea.setSelectionRange?.(0, value.length)

  const copied = runtimeDocument.execCommand('copy')
  textarea.remove()
  activeElement?.focus?.()

  if (!copied) {
    throw new Error('execCommand copy failed')
  }

  return true
}

export const copyText = async (value: string, options: CopyTextOptions = {}): Promise<CopyTextMethod> => {
  const runtimeNavigator = options.navigator ?? getDefaultNavigator()
  const runtimeDocument = options.document ?? getDefaultDocument()
  try {
    if (await tryNavigatorClipboardCopy(value, runtimeNavigator)) {
      return 'clipboard'
    }
  } catch (error) {
    console.warn('Navigator clipboard copy failed, falling back to execCommand.', error)
  }

  execCommandCopy(value, runtimeDocument)
  return 'execCommand'
}
