import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AdminPermissionsGuard, NoAdminPermissionGuard } from '../../workbench/guards'
import { AiAppMemoryWarmupTraceKind } from '../ai.types'
import { AiAppMemoryStore } from '../memory/ai-app-memory.store'
import { AiAppMemoryWarmupService } from '../memory/ai-app-memory-warmup.service'

@Controller('ai/debug')
@UseGuards(AdminPermissionsGuard)
@NoAdminPermissionGuard()
export class AiDebugController {
  constructor(
    private readonly memoryStore: AiAppMemoryStore,
    private readonly warmupService: AiAppMemoryWarmupService,
  ) {}

  @Get('warmup')
  async getWarmupLedger() {
    const live = await this.warmupService.getWarmupLedgerSnapshot()
    const disk = await this.memoryStore.readWarmupLedger()
    const manifestIds = new Set(await this.memoryStore.listManifestAppIds())
    const ledgerIds = new Set(Object.keys(live?.apps || {}))
    return {
      filePath: this.memoryStore.getWarmupLedgerFilePath(),
      live,
      disk,
      summary: {
        diskOnlyManifestIds: [...manifestIds].filter(appId => !ledgerIds.has(appId)),
        problematicAppIds: Object.values(live?.apps || {})
          .filter((item: any) =>
            item?.levels?.semantic === 'stale'
            && item?.warmupState?.phases?.deep?.status === 'succeeded'
            && String(item?.warmupState?.phases?.deep?.lastError || '').trim(),
          )
          .map((item: any) => item.appId),
      },
    }
  }

  @Get('warmup/traces')
  async getWarmupTraces(
    @Query('traceId') traceId?: string,
    @Query('appId') appId?: string,
    @Query('kind') kind?: AiAppMemoryWarmupTraceKind,
    @Query('limit') limit?: string,
  ) {
    return {
      filePath: this.memoryStore.getWarmupTraceFilePath(),
      live: await this.warmupService.getWarmupTraceSnapshot({
        traceId,
        appId,
        kind,
        limit: Number(limit || 100),
      }),
      disk: await this.memoryStore.readWarmupTraces(),
    }
  }

}
