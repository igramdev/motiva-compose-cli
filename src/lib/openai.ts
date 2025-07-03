import OpenAI from 'openai';
import { z } from 'zod';
import chalk from 'chalk';

export interface LLMRequest {
  model: string;
  systemPrompt: string;
  userInput: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse<T> {
  data: T;
  tokensUsed: number;
  costUSD: number;
}

// JSON Schema for ShotPlan - manually defined for Structured Outputs
const SHOT_PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    sceneId: {
      type: "string",
      description: "Unique identifier for the scene"
    },
    duration: {
      type: "number",
      description: "Total duration in frames"
    },
    theme: {
      type: "string", 
      description: "Theme of the video"
    },
    shots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique identifier for the shot"
          },
          start: {
            type: "number", 
            description: "Start frame number"
          },
          len: {
            type: "number",
            description: "Length in frames"
          },
          desc: {
            type: "string",
            description: "Description of the shot"
          }
        },
        required: ["id", "start", "len", "desc"],
        additionalProperties: false
      }
    },
    bgm: {
      anyOf: [
        {
          type: "object",
          properties: {
            style: {
              type: "string",
              description: "Music style"
            },
            bpm: {
              type: "number",
              description: "Beats per minute"
            }
          },
          required: ["style", "bpm"],
          additionalProperties: false
        },
        {
          type: "null"
        }
      ],
      description: "Background music settings (optional)"
    }
  },
  required: ["sceneId", "duration", "theme", "shots", "bgm"],
  additionalProperties: false
};

export class OpenAIWrapper {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    });
  }

  async generateJSON<T>(
    request: LLMRequest,
    schema: z.ZodSchema<T>,
    schemaName: string = 'response_schema'
  ): Promise<LLMResponse<T>> {
    const { model, systemPrompt, userInput, temperature = 0.7, maxTokens = 4096 } = request;

    try {
      // Check if model supports Structured Outputs
      if (this.supportsStructuredOutputs(model)) {
        return this.useStructuredOutputs(request, schema, schemaName);
      } else {
        console.log(chalk.yellow(`⚠️  モデル ${model} はStructured Outputsをサポートしていません。JSON modeにフォールバック`));
        return this.useFallbackJSONMode(request, schema);
      }
    } catch (error: any) {
      // Simplify error messages for users
      const friendlyMessage = this.formatErrorMessage(error);
      throw new Error(friendlyMessage);
    }
  }

  private supportsStructuredOutputs(model: string): boolean {
    const supportedModels = [
      'gpt-4o-2024-08-06',
      'gpt-4o-2024-11-20', 
      'gpt-4o-mini-2024-07-18',
      'gpt-4o-mini',
      'gpt-4o',
      'o1-2024-12-17',
      'o1'
    ];
    return supportedModels.some(supported => model.includes(supported));
  }

  private async useStructuredOutputs<T>(
    request: LLMRequest,
    schema: z.ZodSchema<T>,
    schemaName: string
  ): Promise<LLMResponse<T>> {
    const { model, systemPrompt, userInput, temperature = 0.7, maxTokens = 4096 } = request;

    // Use predefined JSON schema for known schemas
    let jsonSchema;
    if (schemaName === 'shot_plan_schema') {
      jsonSchema = SHOT_PLAN_JSON_SCHEMA;
    } else {
      throw new Error(`未対応のスキーマ: ${schemaName}. 手動でJSON Schemaを定義してください。`);
    }

    console.log(chalk.green('✅ Structured Outputsを使用'));
    console.log(chalk.gray(`📋 スキーマ: ${schemaName}`));

    const response = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          strict: true,
          schema: jsonSchema
        }
      }
    });

    return this.parseAndValidate(response, schema);
  }

  private async useFallbackJSONMode<T>(
    request: LLMRequest,
    schema: z.ZodSchema<T>
  ): Promise<LLMResponse<T>> {
    const { model, systemPrompt, userInput, temperature = 0.7, maxTokens = 4096 } = request;

    console.log(chalk.yellow('⚠️  JSON mode（非strict）を使用'));

    const response = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' }
    });

    return this.parseAndValidate(response, schema);
  }

  private parseAndValidate<T>(
    response: any,
    schema: z.ZodSchema<T>
  ): LLMResponse<T> {
    const content = response.choices[0]?.message?.content;
    const tokensUsed = response.usage?.total_tokens || 0;
    
    if (!content) {
      throw new Error('OpenAI APIから有効な応答が得られませんでした');
    }

    try {
      const parsed = JSON.parse(content);
      const validated = schema.parse(parsed);
      
      return {
        data: validated,
        tokensUsed,
        costUSD: this.calculateCost(tokensUsed, response.model || 'gpt-4o-mini')
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(chalk.red('Zod検証エラー:'), error.errors);
        console.error(chalk.gray('受信データ:'), content);
        throw new Error(`スキーマ検証エラー: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      throw new Error(`JSON解析エラー: ${error}`);
    }
  }

  private calculateCost(tokens: number, model: string): number {
    // Updated cost calculation for newer models
    const costPer1K: Record<string, number> = {
      'gpt-4o-mini': 0.00015,
      'gpt-4o-2024-08-06': 0.0025,
      'gpt-4o-2024-11-20': 0.0025,
      'gpt-4o': 0.0025,
      'o1-2024-12-17': 0.015,
      'o1': 0.015,
      'gpt-3.5-turbo': 0.0015,
      'gpt-4': 0.03
    };

    const rate = costPer1K[model] ?? 0.00015;
    return (tokens / 1000) * rate;
  }

  private formatErrorMessage(error: any): string {
    if (error?.status) {
      switch (error.status) {
        case 400:
          if (error.message?.includes('json')) {
            return `プロンプトの形式エラー: JSON出力を求める際は、プロンプトに"json"キーワードが必要です`;
          }
          if (error.message?.includes('model')) {
            return `モデルエラー: 指定されたモデルが見つからないか、アクセス権限がありません`;
          }
          return `リクエストエラー: ${error.message}`;
        case 401:
          return 'API認証エラー: OpenAI APIキーを確認してください';
        case 429:
          return 'レート制限エラー: しばらく待ってから再試行してください';
        case 500:
          return 'OpenAI APIサーバーエラー: しばらく待ってから再試行してください';
        default:
          return `APIエラー (${error.status}): ${error.message}`;
      }
    }
    return error.message || '不明なエラーが発生しました';
  }
} 