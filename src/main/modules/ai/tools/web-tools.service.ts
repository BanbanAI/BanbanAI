import axios, { AxiosRequestConfig } from 'axios'
import { isIP } from 'net'

type SearchProvider = 'baidu' | 'sogou' | 'duckduckgo'

type SearchRuntimeSettings = {
  provider: SearchProvider
  timeout: number
}

type SearchInput = {
  query?: string
  topK?: number
  provider?: string
  domains?: string[]
  recencyDays?: number
}

type FetchInput = {
  url?: string
  extractMode?: 'text' | 'html' | 'meta'
  maxChars?: number
}

export class AiWebToolsService {
  async searchWeb(input: SearchInput = {}) {
    const query = String(input.query || '').trim()
    if (!query) {
      throw new Error('missing query')
    }

    const topK = this.normalizeNumber(input.topK, 5, 1, 10)
    const domains = this.normalizeDomains(input.domains)
    const settings = this.getSearchRuntimeSettings()
    const providerPlan = this.buildSearchProviderPlan(settings.provider)
    const triedProviders: SearchProvider[] = []
    let lastError = ''
    let results: Array<Record<string, any>> = []
    let resolvedProvider = settings.provider

    for (const provider of providerPlan) {
      triedProviders.push(provider)
      try {
        results = await this.searchWithProvider(provider, query, topK, domains, settings.timeout)
        if (results.length > 0) {
          resolvedProvider = provider
          break
        }
        lastError = `${provider} returned no results`
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }

    return {
      query,
      provider: resolvedProvider,
      requestedProvider: settings.provider,
      triedProviders,
      resultCount: results.length,
      results,
      warning: !results.length && lastError ? lastError : undefined,
    }
  }

  async fetchWebpage(input: FetchInput = {}) {
    const url = String(input.url || '').trim()
    if (!url) {
      throw new Error('missing url')
    }

    const parsedUrl = this.assertSafePublicUrl(url)
    const extractMode = this.normalizeExtractMode(input.extractMode)
    const maxChars = this.normalizeNumber(input.maxChars, 8000, 500, 30000)
    const response = await axios.get(parsedUrl.toString(), {
      ...this.buildAxiosConfig(),
      responseType: 'arraybuffer',
      maxRedirects: 5,
      headers: this.buildBrowserLikeHeaders(),
      validateStatus: status => status >= 200 && status < 400,
    })

    const finalUrl = response.request?.res?.responseUrl || parsedUrl.toString()
    const contentType = String(response.headers?.['content-type'] || '')
    const rawHtml = this.decodeHttpBody(response.data, contentType)

    const rawContent = this.truncateText(rawHtml, maxChars)
    if (!/^text\/|application\/xhtml\+xml|application\/xml/i.test(contentType) && !this.looksLikeHtml(rawHtml)) {
      return {
        url: finalUrl,
        title: '',
        description: '',
        contentType,
        status: response.status,
        content: rawContent.text,
        truncated: rawContent.truncated,
        extractMode,
        fetchedAt: new Date().toISOString(),
      }
    }

    const title = this.extractHtmlTitle(rawHtml)
    const description = this.extractMetaDescription(rawHtml)
    const mainText = this.extractReadableText(rawHtml)
    const contentSource = extractMode === 'html'
      ? rawHtml
      : extractMode === 'meta'
        ? JSON.stringify({
            title,
            description,
            canonicalUrl: this.extractCanonicalUrl(rawHtml),
            contentType,
          }, null, 2)
        : mainText

    const truncatedContent = this.truncateText(contentSource, maxChars)

    return {
      url: finalUrl,
      title,
      description,
      contentType,
      status: response.status,
      content: truncatedContent.text,
      truncated: truncatedContent.truncated,
      extractMode,
      fetchedAt: new Date().toISOString(),
    }
  }

  private async searchWithProvider(
    provider: SearchProvider,
    query: string,
    topK: number,
    domains: string[],
    timeout: number,
  ) {
    switch (provider) {
      case 'baidu':
        return await this.searchWithBaidu(query, topK, domains, timeout)
      case 'sogou':
        return await this.searchWithSogou(query, topK, domains, timeout)
      default:
        return await this.searchWithDuckDuckGo(query, topK, domains, timeout)
    }
  }

  private async searchWithBaidu(query: string, topK: number, domains: string[], timeout: number) {
    const scopedQuery = this.buildScopedQuery(query, domains)
    const response = await axios.get('http://www.baidu.com/s', {
      ...this.buildAxiosConfig(timeout),
      responseType: 'arraybuffer',
      maxRedirects: 5,
      params: {
        wd: scopedQuery,
        rn: Math.max(topK, 10),
        ie: 'utf-8',
      },
      headers: {
        ...this.buildBrowserLikeHeaders(),
        Referer: 'https://www.baidu.com/',
      },
    })

    const finalUrl = String(response.request?.res?.responseUrl || '')
    const html = this.decodeHttpBody(response.data, String(response.headers?.['content-type'] || ''))

    if (this.isBaiduBlocked(html, finalUrl)) {
      throw new Error('baidu blocked the request')
    }

    const blocks = html.match(/<div[^>]+class="[^"]*(?:result-op|result|c-container)[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>?/ig) || []
    const results = this.parseHtmlSearchBlocks(blocks, 'https://www.baidu.com')
    return results.slice(0, topK)
  }

  private async searchWithSogou(query: string, topK: number, domains: string[], timeout: number) {
    const scopedQuery = this.buildScopedQuery(query, domains)
    const response = await axios.get('https://www.sogou.com/web', {
      ...this.buildAxiosConfig(timeout),
      responseType: 'arraybuffer',
      maxRedirects: 5,
      params: {
        query: scopedQuery,
        num: Math.max(topK, 10),
      },
      headers: {
        ...this.buildBrowserLikeHeaders(),
        Referer: 'https://www.sogou.com/',
      },
    })

    const html = this.decodeHttpBody(response.data, String(response.headers?.['content-type'] || ''))
    const blocks = html.match(/<div[^>]+class="[^"]*(?:vrwrap|rb|results|res-item|vrResult|result)[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>?/ig) || []
    const results = this.parseHtmlSearchBlocks(blocks, 'https://www.sogou.com')
    return results.slice(0, topK)
  }

  private async searchWithDuckDuckGo(query: string, topK: number, domains: string[], timeout: number) {
    const scopedQuery = this.buildScopedQuery(query, domains)
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      ...this.buildAxiosConfig(timeout),
      responseType: 'text',
      params: {
        q: scopedQuery,
      },
      headers: this.buildBrowserLikeHeaders(),
    })

    const html = this.decodeHttpBody(response.data, String(response.headers?.['content-type'] || ''))
    const blocks = html.split(/<div[^>]*class="result[^"]*"[^>]*>/i).slice(1)
    const results = blocks.map(block => {
      const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      if (!titleMatch) {
        return null
      }

      const rawUrl = this.decodeDuckDuckGoRedirect(titleMatch[1])
      if (!this.isSafePublicHttpUrl(rawUrl)) {
        return null
      }

      const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i)
      return {
        title: this.normalizeText(this.stripHtml(titleMatch[2])),
        url: rawUrl,
        snippet: this.normalizeText(this.stripHtml(snippetMatch?.[1] || snippetMatch?.[2] || '')),
        source: this.safeHostname(rawUrl),
      }
    }).filter(Boolean) as Array<Record<string, any>>

    return results.slice(0, topK)
  }

  private getSearchRuntimeSettings(): SearchRuntimeSettings {
    return {
      provider: 'baidu',
      timeout: 12000,
    }
  }

  private buildSearchProviderPlan(provider: SearchProvider): SearchProvider[] {
    const fallbackMap: Record<SearchProvider, SearchProvider[]> = {
      baidu: ['baidu', 'sogou', 'duckduckgo'],
      sogou: ['sogou', 'baidu', 'duckduckgo'],
      duckduckgo: ['duckduckgo', 'sogou', 'baidu'],
    }

    return Array.from(new Set(fallbackMap[provider] || ['baidu', 'sogou', 'duckduckgo']))
  }

  private buildAxiosConfig(timeout?: number): AxiosRequestConfig {
    return {
      timeout: timeout || 12000,
    }
  }

  private buildBrowserLikeHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
    }
  }

  private buildScopedQuery(query: string, domains: string[]) {
    if (!domains.length) {
      return query
    }
    const siteFilter = domains.map(item => `site:${item}`).join(' OR ')
    return `${query} (${siteFilter})`
  }

  private decodeHttpBody(data: any, contentType?: string) {
    if (typeof data === 'string') {
      return data
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data || [])
    const declaredCharset = this.detectCharset(contentType, buffer)
    const candidates = this.buildCharsetCandidates(declaredCharset)

    for (const charset of candidates) {
      try {
        const decoded = new TextDecoder(charset as any).decode(buffer)
        if (decoded) {
          return decoded
        }
      } catch {
        // Try next charset candidate.
      }
    }

    return buffer.toString('utf8')
  }

  private detectCharset(contentType?: string, data?: Buffer) {
    const headerCharset = String(contentType || '').match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase()
    if (headerCharset) {
      return headerCharset
    }

    const preview = Buffer.isBuffer(data)
      ? data.slice(0, 2048).toString('ascii')
      : ''
    const metaCharset = preview.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]?.trim().toLowerCase()
      || preview.match(/<meta[^>]+content=["'][^"']*charset=([\w-]+)/i)?.[1]?.trim().toLowerCase()

    return metaCharset || 'utf-8'
  }

  private buildCharsetCandidates(primary: string) {
    const normalized = this.normalizeCharset(primary)
    const defaults = ['utf-8', 'gb18030']
    return Array.from(new Set([normalized, ...defaults]))
  }

  private normalizeCharset(charset: string) {
    const normalized = String(charset || '').trim().toLowerCase()
    if (!normalized) {
      return 'utf-8'
    }
    if (normalized.includes('utf')) {
      return 'utf-8'
    }
    if (normalized.includes('gbk') || normalized.includes('gb2312') || normalized.includes('gb18030')) {
      return 'gb18030'
    }
    if (normalized.includes('big5')) {
      return 'big5'
    }
    return normalized
  }

  private decodeDuckDuckGoRedirect(rawUrl: string) {
    try {
      const parsed = new URL(rawUrl, 'https://duckduckgo.com')
      const redirected = parsed.searchParams.get('uddg')
      return redirected ? decodeURIComponent(redirected) : parsed.toString()
    } catch {
      return rawUrl
    }
  }

  private parseHtmlSearchBlocks(blocks: string[], baseUrl: string) {
    const seen = new Set<string>()
    const results: Array<Record<string, any>> = []

    for (const block of blocks) {
      const titleMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i)
        || block.match(/<a[^>]*href="([^"]+)"[^>]*(?:id="[^"]*"|target="_blank")[^>]*>([\s\S]*?)<\/a>/i)
      if (!titleMatch) {
        continue
      }

      const directUrl = this.extractResultDirectUrl(block) || this.extractDisplayedResultUrl(block)
      const url = this.normalizeSearchResultUrl(directUrl || titleMatch[1], baseUrl)
      if (!this.isSafePublicHttpUrl(url) || this.isSearchEngineInternalResult(url, baseUrl) || seen.has(url)) {
        continue
      }

      const title = this.normalizeText(this.stripHtml(titleMatch[2]))
      if (!title) {
        continue
      }

      seen.add(url)
      results.push({
        title,
        url,
        snippet: this.extractSnippet(block),
        source: this.safeHostname(directUrl || url),
      })
    }

    return results
  }

  private extractDisplayedResultUrl(block: string) {
    const citeMatch = block.match(/<div[^>]*class="[^"]*citeurl[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      || block.match(/<span[^>]*class="[^"]*citeurl[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
    const text = this.normalizeText(this.stripHtml(citeMatch?.[1] || ''))
    const urlMatch = text.match(/https?:\/\/[^\s]+/i)
      || text.match(/([a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i)
    return urlMatch?.[1] || ''
  }

  private isBaiduBlocked(html: string, finalUrl: string) {
    const normalizedHtml = String(html || '')
    const normalizedUrl = String(finalUrl || '')
    return /鐧惧害瀹夊叏楠岃瘉|wappass\.baidu\.com|static\/captcha|璇疯緭鍏ラ獙璇佺爜/i.test(normalizedHtml)
      || /wappass\.baidu\.com|captcha/i.test(normalizedUrl)
  }

  private isSearchEngineInternalResult(url: string, baseUrl: string) {
    try {
      const parsedUrl = new URL(url)
      const parsedBaseUrl = new URL(baseUrl)
      if (parsedUrl.hostname !== parsedBaseUrl.hostname) {
        return false
      }

      const pathname = parsedUrl.pathname.toLowerCase()
      if (parsedBaseUrl.hostname.includes('sogou.com')) {
        return pathname !== '/link'
      }
      if (parsedBaseUrl.hostname.includes('baidu.com')) {
        return pathname !== '/link'
      }
      return true
    } catch {
      return false
    }
  }

  private extractResultDirectUrl(block: string) {
    const muMatch = block.match(/\smu="([^"]+)"/i)
      || block.match(/\sdata-landurl="([^"]+)"/i)
      || block.match(/\sdata-url="([^"]+)"/i)
    return muMatch?.[1] || ''
  }

  private normalizeSearchResultUrl(url: string, baseUrl: string) {
    try {
      return new URL(url, baseUrl).toString()
    } catch {
      return url
    }
  }

  private extractSnippet(block: string) {
    const snippetMatch = block.match(/<div[^>]*class="[^"]*(?:c-abstract|content-right|text-layout|str_info|fz-mid|vr-desc)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      || block.match(/<p[^>]*class="[^"]*(?:str_info|info-txt|desc|summary)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)

    if (snippetMatch?.[1]) {
      return this.normalizeText(this.stripHtml(snippetMatch[1]))
    }

    const plainText = this.normalizeText(this.stripHtml(block))
    return plainText.length > 180 ? plainText.slice(0, 180) : plainText
  }

  private extractHtmlTitle(html: string) {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    return this.normalizeText(this.stripHtml(match?.[1] || ''))
  }

  private extractMetaDescription(html: string) {
    const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i)
      || html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i)
    return this.normalizeText(this.decodeHtmlEntities(match?.[1] || ''))
  }

  private extractCanonicalUrl(html: string) {
    const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([\s\S]*?)["'][^>]*>/i)
      || html.match(/<link[^>]+href=["']([\s\S]*?)["'][^>]+rel=["']canonical["'][^>]*>/i)
    return match?.[1] || ''
  }

  private extractReadableText(html: string) {
    const withoutNoise = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<form[\s\S]*?<\/form>/gi, ' ')

    const articleMatch = withoutNoise.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)
      || withoutNoise.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)
      || withoutNoise.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)

    return this.normalizeText(this.stripHtml(articleMatch?.[1] || withoutNoise))
  }

  private stripHtml(value: string) {
    return this.decodeHtmlEntities(
      String(value || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    )
  }

  private decodeHtmlEntities(value: string) {
    return String(value || '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, '\'')
      .replace(/&#x27;/gi, '\'')
      .replace(/&#x2F;/gi, '/')
  }

  private normalizeText(value: string) {
    return String(value || '')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .trim()
  }

  private truncateText(text: string, maxChars: number) {
    const normalized = String(text || '')
    if (normalized.length <= maxChars) {
      return {
        text: normalized,
        truncated: false,
      }
    }
    return {
      text: normalized.slice(0, maxChars),
      truncated: true,
    }
  }

  private normalizeDomains(domains?: string[]) {
    if (!Array.isArray(domains)) {
      return []
    }
    return domains
      .map(item => String(item || '').trim().toLowerCase())
      .filter(Boolean)
      .map(item => item.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .filter(item => item && !item.includes(' '))
      .slice(0, 8)
  }

  private normalizeExtractMode(mode?: string): 'text' | 'html' | 'meta' {
    if (mode === 'html' || mode === 'meta') {
      return mode
    }
    return 'text'
  }

  private normalizeNumber(value: any, fallback: number, min: number, max: number) {
    const normalized = Number(value ?? fallback)
    if (!Number.isFinite(normalized)) {
      return fallback
    }
    return Math.max(min, Math.min(max, Math.round(normalized)))
  }

  private assertSafePublicUrl(url: string) {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error('invalid url')
    }

    if (!/^https?:$/i.test(parsed.protocol)) {
      throw new Error('only http/https is allowed')
    }

    const hostname = parsed.hostname.trim().toLowerCase()
    if (!hostname) {
      throw new Error('url hostname is empty')
    }

    if (hostname === 'localhost' || hostname.endsWith('.local')) {
      throw new Error('local address is not allowed')
    }

    if (isIP(hostname)) {
      if (this.isPrivateIp(hostname)) {
        throw new Error('private ip is not allowed')
      }
      return parsed
    }

    if (!hostname.includes('.')) {
      throw new Error('public hostname is required')
    }

    return parsed
  }

  private isSafePublicHttpUrl(url: string) {
    try {
      this.assertSafePublicUrl(url)
      return true
    } catch {
      return false
    }
  }

  private safeHostname(url: string) {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }

  private isPrivateIp(ip: string) {
    if (!isIP(ip)) {
      return false
    }

    if (ip.includes(':')) {
      const normalized = ip.toLowerCase()
      return normalized === '::1'
        || normalized.startsWith('fc')
        || normalized.startsWith('fd')
        || normalized.startsWith('fe80:')
        || normalized.startsWith('::ffff:127.')
        || normalized.startsWith('::ffff:10.')
        || normalized.startsWith('::ffff:192.168.')
        || /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    }

    const parts = ip.split('.').map(item => Number(item))
    if (parts.length !== 4 || parts.some(item => !Number.isInteger(item) || item < 0 || item > 255)) {
      return true
    }

    const [a, b] = parts
    if (a === 10 || a === 127 || a === 0) {
      return true
    }
    if (a === 169 && b === 254) {
      return true
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true
    }
    return a === 192 && b === 168
  }

  private looksLikeHtml(value: string) {
    const normalized = String(value || '')
    return /<html[\s>]|<body[\s>]|<head[\s>]|<title[\s>]/i.test(normalized)
  }
}
