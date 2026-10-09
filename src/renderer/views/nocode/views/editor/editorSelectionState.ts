import i18next from 'i18next'
export type EditorSelectionType = 'app' | 'form' | 'board'

export type EditorHeaderTabKey =
  | 'blueprint'
  | 'board-design'
  | 'setting'
  | 'form-design'
  | 'process-setting'
  | 'data-management'

export type EditorWorkspaceShellMode = 'app-artifact' | 'form-editor' | 'board-editor'
export type EditorPreviewDrawerMode = 'none' | 'form' | 'board'

export interface EditorSelectionStateInput {
  isShowFormCreate: boolean
  activeProjectId?: string | null
}

export interface EditorHeaderTab {
  key: EditorHeaderTabKey
  label: string
}

const getAppHeaderTabs = (): EditorHeaderTab[] => [
  { key: 'blueprint', label: i18next.t('editorSelectionState.blueprint') },
  { key: 'setting', label: i18next.t('editorSelectionState.settings') },
]

const getFormHeaderTabs = (): EditorHeaderTab[] => [
  { key: 'form-design', label: i18next.t('editorSelectionState.form') },
  { key: 'process-setting', label: i18next.t('editorSelectionState.workflow') },
  { key: 'data-management', label: i18next.t('editorSelectionState.data') },
  { key: 'setting', label: i18next.t('editorSelectionState.settings') },
]

const getBoardHeaderTabs = (): EditorHeaderTab[] => [
  { key: 'board-design', label: i18next.t('editorSelectionState.board') },
  { key: 'setting', label: i18next.t('editorSelectionState.settings') },
]

export function resolveEditorSelectionType(input: EditorSelectionStateInput): EditorSelectionType {
  if (input.isShowFormCreate) {
    return 'form'
  }

  if (input.activeProjectId) {
    return 'board'
  }

  return 'app'
}

export function getHeaderModeTabs(type: EditorSelectionType): EditorHeaderTab[] {
  if (type === 'form') {
    return getFormHeaderTabs()
  }

  if (type === 'board') {
    return getBoardHeaderTabs()
  }

  return getAppHeaderTabs()
}

export function getWorkspaceShellMode(type: EditorSelectionType): EditorWorkspaceShellMode {
  if (type === 'form') {
    return 'form-editor'
  }

  if (type === 'board') {
    return 'board-editor'
  }

  return 'app-artifact'
}

export function shouldShowPreviewButton(type: EditorSelectionType): boolean {
  return type === 'form' || type === 'board'
}

export function shouldShowSaveButton(type: EditorSelectionType): boolean {
  return type === 'form' || type === 'board'
}

export function getPreviewDrawerMode(type: EditorSelectionType): EditorPreviewDrawerMode {
  if (type === 'form') {
    return 'form'
  }

  if (type === 'board') {
    return 'board'
  }

  return 'none'
}
