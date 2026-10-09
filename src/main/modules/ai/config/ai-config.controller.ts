import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import type { AiProviderConfig, AiProviderModel, AiSettings } from '@common/types/ai-provider'
import { AdminPermissionsGuard } from '../../workbench/guards'
import { AiConfigService } from './ai-config.service'

@Controller('ai')
export class AiConfigController {
  constructor(
    private readonly aiConfigService: AiConfigService,
  ) {}

  @UseGuards(AdminPermissionsGuard)
  @Get('config')
  async getConfig() {
    return await this.aiConfigService.getConfig()
  }

  @UseGuards(AdminPermissionsGuard)
  @Patch('config')
  async saveConfig(@Body() body: Partial<AiSettings>) {
    return await this.aiConfigService.saveConfig(body)
  }

  @UseGuards(AdminPermissionsGuard)
  @Get('providers')
  async getProviders() {
    return await this.aiConfigService.getConfig()
  }

  @UseGuards(AdminPermissionsGuard)
  @Post('providers')
  async createProvider(@Body() body: AiProviderConfig) {
    return await this.aiConfigService.createProvider(body)
  }

  @UseGuards(AdminPermissionsGuard)
  @Patch('providers/:id')
  async updateProvider(@Param('id') id: string, @Body() body: Partial<AiProviderConfig>) {
    return await this.aiConfigService.updateProvider(id, body)
  }

  @UseGuards(AdminPermissionsGuard)
  @Delete('providers/:id')
  async deleteProvider(@Param('id') id: string) {
    return await this.aiConfigService.deleteProvider(id)
  }

  @UseGuards(AdminPermissionsGuard)
  @Get('providers/:id/models')
  async getProviderModels(@Param('id') id: string) {
    const config = await this.aiConfigService.getConfig()
    return config.providers.find(provider => provider.id === id)?.models || []
  }

  @UseGuards(AdminPermissionsGuard)
  @Post('providers/:id/models')
  async createProviderModel(@Param('id') id: string, @Body() body: AiProviderModel) {
    return await this.aiConfigService.createProviderModel(id, body)
  }

  @UseGuards(AdminPermissionsGuard)
  @Patch('providers/:id/models/:modelId')
  async updateProviderModel(
    @Param('id') id: string,
    @Param('modelId') modelId: string,
    @Body() body: Partial<AiProviderModel>,
  ) {
    return await this.aiConfigService.updateProviderModel(id, modelId, body)
  }

  @UseGuards(AdminPermissionsGuard)
  @Delete('providers/:id/models/:modelId')
  async deleteProviderModel(@Param('id') id: string, @Param('modelId') modelId: string) {
    return await this.aiConfigService.deleteProviderModel(id, modelId)
  }

  @UseGuards(AdminPermissionsGuard)
  @Post('providers/:id/sync-models')
  async syncModels(@Param('id') id: string) {
    return await this.aiConfigService.syncProviderModels(id)
  }

  @UseGuards(AdminPermissionsGuard)
  @Post('providers/:id/validate-model-health')
  async validateModelHealth(
    @Param('id') id: string,
    @Body() body: { modelId?: string; timeoutMs?: number },
  ) {
    return await this.aiConfigService.validateProviderModelHealth(
      id,
      body?.modelId || '',
      body?.timeoutMs,
    )
  }

  @Get('models/catalog')
  async getCatalog() {
    return await this.aiConfigService.getCatalog()
  }
}
