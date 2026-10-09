import { Injectable, Logger } from '@nestjs/common'
import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getRuntime } from '@main/runtime'

@Injectable()
export class AiAgentLogService {
  private readonly logger = new Logger(AiAgentLogService.name)
  private logDirPromise?: Promise<string>

  async log(conversationId: string, title: string, ...args: any[]) {
    await this.writeBlock(conversationId, title, args)
  }

  async logError(conversationId: string, payload: {
    round?: number
    stage?: string
    provider?: string
    model?: string
    timeoutPhase?: string
    timeoutMs?: number
    firstEventRetryCount?: number
    retrying?: boolean
    error: string
  }) {
    await this.writeBlock(conversationId, payload.round ? `第 ${payload.round} 轮 异常` : '异常', [
      payload.stage ? `阶段: ${payload.stage}` : '',
      payload.provider ? `Provider: ${payload.provider}` : '',
      payload.model ? `Model: ${payload.model}` : '',
      payload.timeoutPhase ? `超时阶段: ${payload.timeoutPhase}` : '',
      Number.isFinite(payload.timeoutMs) ? `超时阈值: ${payload.timeoutMs}ms` : '',
      Number.isFinite(payload.firstEventRetryCount) ? `首事件重试次数: ${payload.firstEventRetryCount}` : '',
      typeof payload.retrying === 'boolean' ? `即将重试: ${payload.retrying ? '是' : '否'}` : '',
      `错误信息: ${payload.error}`,
    ])
  }

  private async writeBlock(conversationId: string, title: string, lines: Array<string | undefined>) {
    if (!conversationId) {
      return
    }

    try {
      const logFilePath = await this.getConversationLogPath(conversationId)
      const timestamp = this.formatTimestamp(new Date())
      const content = [
        `\n\n[${timestamp}] ${title}`,
        ...lines.filter(Boolean).map(line => String(line)),
        '',
      ].join('\n')
      await appendFile(logFilePath, content, 'utf8')
    } catch (error) {
      this.logger.warn(`写入 AI Agent 日志失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private getSummaryText(value: any) {
    if (!value) {
      return '无'
    }

    if (typeof value?.summary === 'string') {
      return this.formatText(value.summary, 500)
    }

    if (typeof value?.summary?.text === 'string') {
      return this.formatText(value.summary.text, 500)
    }

    if (typeof value?.message === 'string') {
      return this.formatText(value.message, 500)
    }

    if (typeof value?.text === 'string') {
      return this.formatText(value.text, 500)
    }

    if (typeof value?.appName === 'string' && typeof value?.tableName === 'string' && value?.total !== undefined) {
      return `应用“${value.appName}”表单“${value.tableName}”，共 ${value.total} 条，本次返回 ${value.resultCount || value.items?.length || 0} 条`
    }

    if (typeof value?.appName === 'string' && value?.total !== undefined) {
      return `应用“${value.appName}”，共 ${value.total} 项`
    }

    return this.formatText(this.formatJson(value), 500)
  }

  private formatJson(value: any, maxLength = 24000) {
    try {
      const text = JSON.stringify(value, null, 2)
      return this.formatText(text, maxLength)
    } catch {
      return this.formatText(String(value), maxLength)
    }
  }

  private formatText(value: string, maxLength = 12000) {
    const text = String(value || '').trim()
    if (!text) {
      return '无'
    }
    if (text.length <= maxLength) {
      return text
    }
    return `${text.slice(0, maxLength)}...(已截断)`
  }

  private formatTimestamp(date: Date) {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    const hour = `${date.getHours()}`.padStart(2, '0')
    const minute = `${date.getMinutes()}`.padStart(2, '0')
    const second = `${date.getSeconds()}`.padStart(2, '0')
    const ms = `${date.getMilliseconds()}`.padStart(3, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}.${ms}`
  }

  async getConversationLogPath(conversationId: string) {
    const logDir = await this.getLogDir()
    const safeConversationId = this.sanitizeConversationLogFileName(conversationId)
    return join(logDir, `${safeConversationId}.log`)
  }

  private sanitizeConversationLogFileName(conversationId: string) {
    const trimmed = String(conversationId || '').trim()
    if (!trimmed) {
      return 'conversation'
    }

    const replaced = trimmed.replace(/[\\/:*?"<>|]+/g, '_')
    const collapsed = replaced.replace(/_+/g, '_').trim()
    const normalized = collapsed.slice(0, 200).replace(/[. ]+$/g, '')
    return normalized || 'conversation'
  }

  private async getLogDir() {
    if (!this.logDirPromise) {
      this.logDirPromise = this.createLogDir()
    }
    return await this.logDirPromise
  }

  private async createLogDir() {
    const userDataPath = await getRuntime().getUserDataPath()
    const logDir = join(userDataPath, 'logs', 'agent')
    await mkdir(logDir, { recursive: true })
    return logDir
  }
}
