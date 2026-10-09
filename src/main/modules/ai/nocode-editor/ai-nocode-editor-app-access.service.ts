import { ForbiddenException, Injectable } from '@nestjs/common'
import { Request } from 'express'
import { ProjectService } from '../../project/project.services'
import { assertSafeNocodeEditorAppId } from './nocode-editor-app-id.util'

@Injectable()
export class AiNocodeEditorAppAccessService {
  constructor(
    private readonly projectService: ProjectService,
  ) {}

  async assertReadableNocode(req: Request, nocodeId: string) {
    return await this.assertNocodeAccess('read', req, nocodeId)
  }

  async assertWritableNocode(req: Request, nocodeId: string) {
    return await this.assertNocodeAccess('write', req, nocodeId)
  }

  private async assertNocodeAccess(mode: 'read' | 'write', req: Request, nocodeId: string) {
    const safeNocodeId = assertSafeNocodeEditorAppId(nocodeId)
    const hasAccess = mode === 'read'
      ? await this.projectService.canReadNocodeByAccount(safeNocodeId, req.account)
      : await this.projectService.canWriteNocodeByAccount(safeNocodeId, req.account)

    if (!hasAccess) {
      throw new ForbiddenException('Forbidden')
    }

    return safeNocodeId
  }
}
