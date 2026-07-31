import { LLMRequest, LLMResponse } from '../../types'

export interface MLInteractionLog {
  tenantId: string;
  leadId: string;
  threadHistory: Array<{ role: string, content: string }>;
  outcome: 'BOOKED' | 'LOST' | 'PENDING';
  confidenceScore: number;
  vectorsGenerated: boolean;
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const DEEPSEEK_URL = 'https://api.deepseek.com'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''
const GLM_URL = 'https://open.bigmodel.cn/api/paas/v4'
const GLM_KEY = process.env.ZHIPU_API_KEY || ''
const OPENROUTER_URL = 'https://openrouter.ai/api/v1'
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || ''
const GROQ_URL = 'https://api.groq.com/openai/v1'
const GROQ_KEY = process.env.GROQ_API_KEY || ''
const OPENAI_URL = 'https://api.openai.com/v1'
const OPENAI_KEY = process.env.OPENAI_API_KEY || ''
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
const GEMINI_KEY = process.env.GEMINI_API_KEY || ''

type CloudProvider = 'groq' | 'gemini' | 'openai' | 'deepseek' | 'zhipu' | 'openrouter'

const LOCAL_MODELS = {
  general: 'qwen2.5-coder:14b',
  reasoning: 'deepseek-r1:14b',
  fast: 'llama3.1:8b',
  classification: 'mistral:7b',
  fallback: 'glm-4.7-flash:9b'
}

const CLOUD_MODELS: Record<CloudProvider, { model: string; url: string; key: string; costPer1kInput: number; costPer1kOutput: number }> = {
  groq: {
    model: 'llama-3.3-70b-versatile',
    url: GROQ_URL,
    key: GROQ_KEY,
    costPer1kInput: 0.00059,
    costPer1kOutput: 0.00079,
  },
  gemini: {
    model: 'gemini-2.0-flash',
    url: GEMINI_URL,
    key: GEMINI_KEY,
    costPer1kInput: 0.00010,
    costPer1kOutput: 0.00040,
  },
  openai: {
    model: 'gpt-4o-mini',
    url: OPENAI_URL,
    key: OPENAI_KEY,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.00060,
  },
  deepseek: {
    model: 'deepseek-v4-flash',
    url: DEEPSEEK_URL,
    key: DEEPSEEK_KEY,
    costPer1kInput: 0.00014,
    costPer1kOutput: 0.00028,
  },
  zhipu: {
    model: 'glm-5.2',
    url: GLM_URL,
    key: GLM_KEY,
    costPer1kInput: 0.00140,
    costPer1kOutput: 0.00440,
  },
  openrouter: {
    model: 'moonshotai/kimi-k2-6',
    url: OPENROUTER_URL,
    key: OPENROUTER_KEY,
    costPer1kInput: 0.00095,
    costPer1kOutput: 0.00400,
  },
}

const CLOUD_ORDER: CloudProvider[] = ['groq', 'gemini', 'openai', 'deepseek', 'openrouter', 'zhipu']

export class LLMRouter {
  private useLocal: boolean = true
  private localFailureCount: number = 0
  private cloudFailureCount: Map<CloudProvider, number> = new Map()
  private cloudIndex: number = 0
  private readonly MAX_LOCAL_FAILURES = 3
  private readonly MAX_CLOUD_FAILURES = 2

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now()

    if (this.useLocal || request.forceLocal) {
      try {
        const response = await this.callOllama(request)
        this.localFailureCount = 0
        return { ...response, duration: Date.now() - startTime }
      } catch {
        if (request.forceLocal) {
          console.error('[FINOPS BLOCK] Modelo local falhou e forceLocal está ativo. Abortando para evitar custos.')
          throw new Error('LLM_LOCAL_UNAVAILABLE: O motor local falhou e o custo zero é obrigatório.')
        }
        this.localFailureCount++
        console.warn(`Ollama falhou (${this.localFailureCount}/${this.MAX_LOCAL_FAILURES})`)
        if (this.localFailureCount >= this.MAX_LOCAL_FAILURES) {
          this.useLocal = false
          console.log('Switching to cloud models')
        }
      }
    }

    return this.tryCloudProviders(request, startTime)
  }

  private async tryCloudProviders(request: LLMRequest, startTime: number): Promise<LLMResponse> {
    const ordered = [...CLOUD_ORDER]
    const startIdx = this.cloudIndex % ordered.length
    const rotated = [...ordered.slice(startIdx), ...ordered.slice(0, startIdx)]

    for (const provider of rotated) {
      const failures = this.cloudFailureCount.get(provider) ?? 0
      if (failures >= this.MAX_CLOUD_FAILURES) {
        continue
      }
      try {
        const response = await this.callCloudProvider(request, provider)
        this.cloudIndex = ordered.indexOf(provider)
        return { ...response, duration: Date.now() - startTime }
      } catch {
        const count = (this.cloudFailureCount.get(provider) ?? 0) + 1
        this.cloudFailureCount.set(provider, count)
        console.warn(`Cloud provider ${provider} falhou (${count}/${this.MAX_CLOUD_FAILURES})`)
      }
    }

    console.error('Todos os modelos cloud falharam')
    throw new Error('LLM_UNAVAILABLE: Nenhum modelo disponível no momento')
  }

  private async callOllama(request: LLMRequest): Promise<Omit<LLMResponse, 'duration'>> {
    const model = LOCAL_MODELS[request.model as keyof typeof LOCAL_MODELS] || LOCAL_MODELS.general
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature || 0.7,
          num_predict: request.maxTokens || 2048
        }
      })
    })
    if (!response.ok) throw new Error(`Ollama error: ${response.status}`)
    const data = await response.json()
    return {
      content: data.message?.content || '',
      model: data.model || model,
      tokensUsed: data.eval_count || 0,
      cost: 0
    }
  }

  private async callCloudProvider(request: LLMRequest, provider: CloudProvider): Promise<Omit<LLMResponse, 'duration'>> {
    const config = CLOUD_MODELS[provider]
    const isOpenRouter = provider === 'openrouter'

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.key}`,
    }
    if (isOpenRouter) {
      headers['HTTP-Referer'] = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      headers['X-Title'] = 'Secretaria.ai'
    }

    const body: Record<string, unknown> = {
      model: config.model,
      messages: request.messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 2048,
    }
    if (!isOpenRouter) {
      body.stream = false
    }

    const response = await fetch(`${config.url}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`${provider} error: ${response.status}`)
    const data = await response.json()
    const usage = data.usage || {}
    const inputTokens = usage.prompt_tokens || 0
    const outputTokens = usage.completion_tokens || 0
    const cost = (inputTokens / 1000) * config.costPer1kInput + (outputTokens / 1000) * config.costPer1kOutput

    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || config.model,
      tokensUsed: usage.total_tokens || 0,
      cost,
    }
  }

  async forceLocal(request: LLMRequest): Promise<LLMResponse> {
    this.useLocal = true
    this.localFailureCount = 0
    return this.generate(request)
  }

  async forceCloud(request: LLMRequest): Promise<LLMResponse> {
    this.useLocal = false
    const startTime = Date.now()
    return this.tryCloudProviders(request, startTime)
  }

  async recordMLInteraction(log: MLInteractionLog): Promise<void> {
    try {
      console.log(`[ML Brain] Interação registrada para Tenant: ${log.tenantId} | Resultado: ${log.outcome}`)
      if (log.outcome === 'BOOKED') {
        console.log(`[ML Brain] Reforço Positivo: Preparando threadHistory para vetorização (RAG).`)
      }
    } catch (error) {
      console.error(`[ML Brain] Erro ao registrar interação ML:`, error)
    }
  }
}

export const llmRouter = new LLMRouter()
