import { BadRequestException } from '@nestjs/common'
import { isAbsolute, relative, resolve } from 'path'

const SAFE_NOCODE_EDITOR_APP_ID_REGEXP = /^[A-Za-z0-9_-]+$/

export function assertSafeNocodeEditorAppId(raw: string) {
  const original = String(raw ?? '')
  const normalized = original.trim()

  if (
    !normalized
    || normalized !== original
    || !SAFE_NOCODE_EDITOR_APP_ID_REGEXP.test(normalized)
  ) {
    throw new BadRequestException(global.i18next.t('nocodeEditorAppId.invalidAppId'))
  }

  return normalized
}

export function resolveNocodeEditorAppPath(
  rootDir: string,
  nocodeId: string,
  ...segments: string[]
) {
  const safeNocodeId = assertSafeNocodeEditorAppId(nocodeId)
  const resolvedAppRootDir = resolve(rootDir, safeNocodeId)
  const targetPath = resolve(resolvedAppRootDir, ...segments)
  const relativePath = relative(resolvedAppRootDir, targetPath)

  if (
    isAbsolute(relativePath)
    || /^\.\.(?:[\\/]|$)/.test(relativePath)
  ) {
    throw new BadRequestException(global.i18next.t('nocodeEditorAppId.invalidAppId'))
  }

  return targetPath
}
