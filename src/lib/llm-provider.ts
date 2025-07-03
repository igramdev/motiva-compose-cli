import { z } from 'zod';
import { OpenAIWrapper } from './openai.js';
import chalk from 'chalk';
import dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config();

export interface LLMRequest {
  model: string;
  systemPrompt: string;
  userInput: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json_object' | 'text';
}

export interface LLMResponse<T> {
  data: T;
  tokensUsed: number;
  costUSD: number;
  provider: string;
  model: string;
  duration: number;
}

export interface LLMProvider {
  name: string;
  generateJSON<T>(
    request: LLMRequest,
    schema: z.ZodSchema<T>
  ): Promise<LLMResponse<T>>;
  
  generateText(request: LLMRequest): Promise<LLMResponse<string>>;
  
  isAvailable(): boolean;
  
  getSupportedModels(): string[];
}

/**
 * OpenAIプロバイダー実装
 */
export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private wrapper: OpenAIWrapper;

  constructor(apiKey?: string) {
    // .envファイルからAPIキーを読み込み、なければ引数またはモックを使用
    const envApiKey = process.env.OPENAI_API_KEY;
    const finalApiKey = apiKey || envApiKey || 'mock';
    this.wrapper = new OpenAIWrapper(finalApiKey);
  }

  async generateJSON<T>(
    request: LLMRequest,
    schema: z.ZodSchema<T>
  ): Promise<LLMResponse<T>> {
    const startTime = Date.now();
    const response = await this.wrapper.generateJSON(request, schema);
    const duration = Date.now() - startTime;

    return {
      ...response,
      provider: this.name,
      model: request.model,
      duration
    };
  }

  async generateText(request: LLMRequest): Promise<LLMResponse<string>> {
    const startTime = Date.now();
    // 一時的にgenerateJSONを使用してテキスト生成をシミュレート
    // TODO: OpenAIWrapperにgenerateTextメソッドを追加
    const response = await this.wrapper.generateJSON(request, z.string());
    const duration = Date.now() - startTime;

    return {
      data: response.data,
      tokensUsed: response.tokensUsed,
      costUSD: response.costUSD,
      provider: this.name,
      model: request.model,
      duration
    };
  }

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY || process.env.NODE_ENV === 'test' || !process.env.OPENAI_API_KEY;
  }

  getSupportedModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'gpt-4',
      'gpt-3.5-turbo-16k'
    ];
  }
}

/**
 * Anthropicプロバイダー実装（将来実装）
 */
export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';

  async generateJSON<T>(
    request: LLMRequest,
    schema: z.ZodSchema<T>
  ): Promise<LLMResponse<T>> {
    throw new Error('Anthropic provider not yet implemented');
  }

  async generateText(request: LLMRequest): Promise<LLMResponse<string>> {
    throw new Error('Anthropic provider not yet implemented');
  }

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  getSupportedModels(): string[] {
    return ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
  }
}

/**
 * Groqプロバイダー実装（将来実装）
 */
export class GroqProvider implements LLMProvider {
  name = 'groq';

  async generateJSON<T>(
    request: LLMRequest,
    schema: z.ZodSchema<T>
  ): Promise<LLMResponse<T>> {
    throw new Error('Groq provider not yet implemented');
  }

  async generateText(request: LLMRequest): Promise<LLMResponse<string>> {
    throw new Error('Groq provider not yet implemented');
  }

  isAvailable(): boolean {
    return !!process.env.GROQ_API_KEY;
  }

  getSupportedModels(): string[] {
    return ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'];
  }
}

/**
 * Self-hosted Mistralプロバイダー実装（将来実装）
 */
export class SelfHostedMistralProvider implements LLMProvider {
  name = 'self-hosted-mistral';
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async generateJSON<T>(
    request: LLMRequest,
    schema: z.ZodSchema<T>
  ): Promise<LLMResponse<T>> {
    throw new Error('Self-hosted Mistral provider not yet implemented');
  }

  async generateText(request: LLMRequest): Promise<LLMResponse<string>> {
    throw new Error('Self-hosted Mistral provider not yet implemented');
  }

  isAvailable(): boolean {
    return true; // 常に利用可能（設定依存）
  }

  getSupportedModels(): string[] {
    return ['mistral-7b-instruct', 'mistral-large', 'mixtral-8x7b'];
  }
}

/**
 * LLMプロバイダー管理クラス
 */
export class LLMProviderManager {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProvider: string = 'openai';

  constructor() {
    this.registerDefaultProviders().catch(error => {
      console.error(chalk.red('❌ プロバイダー登録エラー:'), error);
    });
  }

  private async registerDefaultProviders(): Promise<void> {
    // OpenAI（デフォルト）
    const openaiProvider = new OpenAIProvider();
    this.providers.set('openai', openaiProvider);

    // Anthropic
    const anthropicProvider = new AnthropicProvider();
    this.providers.set('anthropic', anthropicProvider);

    // Mock Provider（テスト用）
    if (process.env.NODE_ENV === 'test' || !process.env.OPENAI_API_KEY) {
      try {
        const { MockLLMProvider } = await import('./mock-provider.js');
        const mockProvider = new MockLLMProvider();
        this.providers.set('mock', mockProvider);
        console.log(chalk.green('✅ モックプロバイダーを登録しました'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  モックプロバイダーの読み込みに失敗'));
      }
    }

    // Groq
    const groqProvider = new GroqProvider();
    this.providers.set('groq', groqProvider);

    // Self-hosted Mistral（設定から）
    if (process.env.MISTRAL_BASE_URL) {
      const mistralProvider = new SelfHostedMistralProvider(process.env.MISTRAL_BASE_URL);
      this.providers.set('self-hosted-mistral', mistralProvider);
    }
  }

  /**
   * プロバイダーを登録
   */
  registerProvider(name: string, provider: LLMProvider): void {
    this.providers.set(name, provider);
    console.log(chalk.green(`✅ LLMプロバイダー登録: ${name}`));
  }

  /**
   * 利用可能なプロバイダーを取得
   */
  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isAvailable());
  }

  /**
   * プロバイダーを取得
   */
  getProvider(name?: string): LLMProvider {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`プロバイダーが見つかりません: ${providerName}`);
    }

    if (!provider.isAvailable()) {
      throw new Error(`プロバイダーが利用できません: ${providerName}`);
    }

    return provider;
  }

  /**
   * モデル名からプロバイダーを自動選択
   */
  getProviderForModel(model: string): LLMProvider {
    for (const provider of this.providers.values()) {
      if (provider.isAvailable() && provider.getSupportedModels().includes(model)) {
        return provider;
      }
    }

    // デフォルトプロバイダーを返す
    return this.getProvider();
  }

  /**
   * 利用可能なモデル一覧を取得
   */
  getAvailableModels(): Array<{ provider: string; model: string }> {
    const models: Array<{ provider: string; model: string }> = [];
    
    for (const provider of this.providers.values()) {
      if (provider.isAvailable()) {
        provider.getSupportedModels().forEach(model => {
          models.push({ provider: provider.name, model });
        });
      }
    }

    return models;
  }

  /**
   * プロバイダー情報を表示
   */
  showProviderInfo(): void {
    console.log(chalk.blue('🤖 利用可能なLLMプロバイダー:'));
    
    for (const provider of this.providers.values()) {
      const status = provider.isAvailable() ? chalk.green('✅') : chalk.red('❌');
      console.log(`  ${status} ${provider.name}`);
      
      if (provider.isAvailable()) {
        const models = provider.getSupportedModels().slice(0, 3).join(', ');
        console.log(`    📋 モデル: ${models}${provider.getSupportedModels().length > 3 ? '...' : ''}`);
      }
    }
  }
}

// グローバルインスタンス
export const llmProviderManager = new LLMProviderManager(); 