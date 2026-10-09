import { Injectable } from '@nestjs/common'
import { AiThreadShare } from '../ai.types'
import { AiAgentEntity } from '../entities'
import { AiThreadService } from '../thread/ai-thread.service'

@Injectable()
export class AiShareService {
  constructor(
    private readonly threadService: AiThreadService,
  ) {}

  async getOwnerShare(ownerAccountId: string, threadId: string) {
    const thread = await this.threadService.assertOwnerThread(ownerAccountId, threadId)
    return await this.getOwnerShareByAgent(ownerAccountId, thread.agentId)
  }

  async setShareEnabled(ownerAccountId: string, threadId: string, enabled: boolean) {
    const thread = await this.threadService.assertOwnerThread(ownerAccountId, threadId)
    return await this.setShareEnabledByAgent(ownerAccountId, thread.agentId, enabled)
  }

  async resolveEnabledShare(shareToken: string) {
    const agent = await this.resolveEnabledAgent(shareToken)
    return agent ? this.toShareInfo(agent) : null
  }

  async getOwnerShareByAgent(ownerAccountId: string, agentId: string) {
    const agent = await this.threadService.assertOwnerAgent(ownerAccountId, agentId)
    return this.toShareInfo(agent)
  }

  async setShareEnabledByAgent(ownerAccountId: string, agentId: string, enabled: boolean) {
    await this.threadService.assertOwnerAgent(ownerAccountId, agentId)
    const agent = await this.threadService.updateAgentSharing(agentId, enabled)
    return this.toShareInfo(agent)
  }

  async resolveEnabledAgent(shareToken: string) {
    return await this.threadService.resolveSharedAgent(shareToken)
  }

  toShareInfo(agent: AiAgentEntity): AiThreadShare {
    return {
      id: agent.id,
      agentId: agent.id,
      shareToken: String(agent.shareToken || '').trim(),
      enabled: Boolean(agent.sharing),
      createTime: agent.shareTime || agent.createTime,
      updateTime: agent.updateTime,
    }
  }
}
