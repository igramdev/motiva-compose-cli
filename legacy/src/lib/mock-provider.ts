import { z } from 'zod';
import { LLMProvider, LLMRequest, LLMResponse } from './llm-provider.js';

/**
 * テスト用モックLLMプロバイダー
 */
export class MockLLMProvider implements LLMProvider {
  name = 'mock';

  async generateJSON<T>(
    request: LLMRequest,
    schema: z.ZodSchema<T>
  ): Promise<LLMResponse<T>> {
    const startTime = Date.now();
    
    // モックデータを生成
    const mockData = this.generateMockData(request, schema);
    
    // スキーマで検証
    const validatedData = schema.parse(mockData);
    
    const duration = Date.now() - startTime;
    
    return {
      data: validatedData,
      tokensUsed: Math.ceil((request.systemPrompt.length + request.userInput.length) / 3),
      costUSD: 0.001,
      provider: this.name,
      model: request.model,
      duration
    };
  }

  async generateText(request: LLMRequest): Promise<LLMResponse<string>> {
    const startTime = Date.now();
    
    // モックテキストを生成
    const mockText = this.generateMockText(request);
    
    const duration = Date.now() - startTime;
    
    return {
      data: mockText,
      tokensUsed: Math.ceil((request.systemPrompt.length + request.userInput.length) / 3),
      costUSD: 0.001,
      provider: this.name,
      model: request.model,
      duration
    };
  }

  isAvailable(): boolean {
    return true; // 常に利用可能
  }

  getSupportedModels(): string[] {
    return ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
  }

  private generateMockData<T>(request: LLMRequest, schema: z.ZodSchema<T>): any {
    // リクエスト内容に基づいてモックデータを生成
    const userInput = request.userInput.toLowerCase();
    
    if (userInput.includes('映画') || userInput.includes('movie') || userInput.includes('タイトル')) {
      // 映画タイトルスキーマ
      return {
        title: "モック映画タイトル",
        genre: "サイエンスフィクション",
        description: "これはテスト用のモック映画です。"
      };
    }
    
    if (userInput.includes('ショット') || userInput.includes('shot') || userInput.includes('プラン')) {
      // ショットプランスキーマ
      return {
        sceneId: "mock-scene-001",
        duration: 900,
        theme: "宇宙探検",
        shots: [
          {
            id: "shot-001",
            start: 0,
            len: 300,
            desc: "宇宙船の外観シーン"
          },
          {
            id: "shot-002", 
            start: 300,
            len: 300,
            desc: "惑星の表面シーン"
          },
          {
            id: "shot-003",
            start: 600,
            len: 300,
            desc: "宇宙船の内部シーン"
          }
        ],
        bgm: {
          style: "エレクトロニック",
          bpm: 120
        }
      };
    }
    
    if (userInput.includes('asset') || userInput.includes('素材') || userInput.includes('manifest')) {
      // Asset Manifestスキーマ
      return {
        sceneId: "mock-scene-001",
        version: "1.0",
        assets: [
          {
            id: "asset-001",
            type: "video",
            uri: null,
            generator: "mock-generator",
            spec: {
              description: "宇宙船の外観映像",
              duration: 10,
              dimensions: { width: 1920, height: 1080 },
              format: "mp4",
              style: "サイエンスフィクション",
              quality: "standard"
            },
            status: "pending",
            metadata: {
              shotId: "shot-001",
              tags: ["宇宙", "船", "外観"]
            }
          }
        ]
      };
    }
    
    // デフォルトのモックデータ
    return {
      message: "これはモックレスポンスです",
      timestamp: new Date().toISOString(),
      request: {
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens
      }
    };
  }

  private generateMockText(request: LLMRequest): string {
    const userInput = request.userInput.toLowerCase();
    
    if (userInput.includes('こんにちは') || userInput.includes('hello')) {
      return "こんにちは！モックアシスタントです。テスト環境で動作しています。";
    }
    
    if (userInput.includes('映画') || userInput.includes('movie')) {
      return "モック映画のタイトル: 「宇宙探検記 - 未知の惑星への旅」\nジャンル: サイエンスフィクション\n説明: 勇敢な宇宙飛行士たちが未知の惑星を探索する冒険物語です。";
    }
    
    return `モックレスポンス: ${request.userInput} に対するテスト用の回答です。実際のAPIキーが設定されていないため、モックモードで動作しています。`;
  }
} 