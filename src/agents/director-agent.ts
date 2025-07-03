import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigurationManager } from '../lib/config-manager.js';
import { llmProviderManager, LLMRequest, LLMResponse } from '../lib/llm-provider.js';
import { DualBudgetManager, CostEstimate } from '../lib/dual-budget-manager.js';
import chalk from 'chalk';

// Director Agentの入力スキーマ
export const DirectorInputSchema = z.object({
  sceneId: z.string(),
  version: z.string(),
  assets: z.array(z.object({
    id: z.string(),
    type: z.enum(['video', 'audio', 'image', 'effect']),
    uri: z.string().nullable(),
    generator: z.string(),
    spec: z.object({
      description: z.string(),
      duration: z.number().nullable(),
      dimensions: z.object({
        width: z.number(),
        height: z.number()
      }).nullable(),
      format: z.string().nullable(),
      style: z.string().nullable(),
      quality: z.enum(['draft', 'standard', 'high']).nullable()
    }),
    status: z.enum(['pending', 'generated', 'failed']),
    metadata: z.object({
      shotId: z.string().nullable(),
      createdAt: z.string().nullable(),
      estimatedCost: z.number().nullable(),
      actualCost: z.number().nullable()
    }).nullable()
  })),
  generators: z.record(z.object({
    name: z.string(),
    type: z.enum(['local', 'api', 'mock']),
    config: z.record(z.any()).nullable()
  })).nullable(),
  totalEstimatedCost: z.number().nullable()
});

// Director Agentの出力スキーマ
export const DirectorOutputSchema = z.object({
  sceneId: z.string(),
  version: z.string(),
  composition: z.object({
    title: z.string(),
    description: z.string(),
    duration: z.number(),
    fps: z.number(),
    resolution: z.object({
      width: z.number(),
      height: z.number()
    }),
    timeline: z.array(z.object({
      id: z.string(),
      start: z.number(),
      end: z.number(),
      assetId: z.string(),
      assetType: z.enum(['video', 'audio', 'image', 'effect']),
      transform: z.object({
        x: z.number(),
        y: z.number(),
        scale: z.number(),
        rotation: z.number(),
        opacity: z.number()
      }).nullable(),
      effects: z.array(z.object({
        type: z.string(),
        params: z.object({}).passthrough()
      }).required()).nullable()
    })),
    audio: z.object({
      bgm: z.object({
        assetId: z.string().nullable(),
        volume: z.number(),
        fadeIn: z.number(),
        fadeOut: z.number()
      }).nullable(),
      sfx: z.array(z.object({
        assetId: z.string(),
        start: z.number(),
        volume: z.number()
      })).nullable()
    }).nullable(),
    transitions: z.array(z.object({
      id: z.string(),
      type: z.string(),
      duration: z.number(),
      fromShot: z.string(),
      toShot: z.string(),
      params: z.object({}).passthrough().nullable()
    })).nullable()
  }),
  metadata: z.object({
    createdAt: z.string(),
    totalCost: z.number(),
    estimatedRenderTime: z.number(),
    quality: z.enum(['draft', 'standard', 'high']),
    tags: z.array(z.string()).nullable()
  })
});

export type DirectorInput = z.infer<typeof DirectorInputSchema>;
export type DirectorOutput = z.infer<typeof DirectorOutputSchema>;

/**
 * Director Agent: ショットプランとAsset Manifestを統合し、最終的な動画構成を決定
 */
export class DirectorAgent {
  name = 'director';
  inputSchema = DirectorInputSchema;
  outputSchema = DirectorOutputSchema;
  
  private configManager: ConfigurationManager;
  private systemPrompt: string | null = null;

  constructor() {
    this.configManager = ConfigurationManager.getInstance();
  }

  private async loadSystemPrompt(): Promise<string> {
    if (this.systemPrompt) return this.systemPrompt;

    try {
      const promptPath = path.join(process.cwd(), 'prompts', 'director', 'v1_system.txt');
      this.systemPrompt = await fs.readFile(promptPath, 'utf8');
      return this.systemPrompt;
    } catch (error) {
      // フォールバック用の最小限のプロンプト
      this.systemPrompt = `
あなたは経験豊富な動画ディレクターです。
Asset Manifestを分析し、最終的な動画構成を決定してください。

## 役割
- Asset Manifestを分析
- 各アセットに適切なタイムラインを割り当て
- トランジション、オーディオ構成を決定
- 技術的な制約を考慮した実現可能な構成を作成

## 出力形式
以下のJSON形式で出力してください：
- sceneId: シーンID
- version: バージョン
- composition: 動画構成
  - title: タイトル
  - description: 説明
  - duration: 総時間（秒）
  - fps: フレームレート
  - resolution: 解像度
  - timeline: タイムライン（各アセットの詳細）
  - audio: オーディオ構成
  - transitions: トランジション
- metadata: メタデータ

## 注意事項
- 各アセットの開始・終了時間を正確に計算
- 実現可能なトランジション効果を選択
- オーディオの同期とボリューム調整
      `.trim();
      return this.systemPrompt;
    }
  }

  async run(input: DirectorInput): Promise<DirectorOutput> {
    console.log(chalk.blue('🎬 Director Agent: 動画構成決定中...'));

    const config = await this.configManager.getAgentConfig('director');
    
    const systemPrompt = await this.loadSystemPrompt();

    const userInput = `## Asset Manifest
${JSON.stringify(input, null, 2)}

上記の情報を基に、最終的な動画構成を決定してください。`;

    const provider = llmProviderManager.getProviderForModel(config.provider || 'gpt-4o-mini');
    const response = await provider.generateJSON(
      {
        model: config.provider || 'gpt-4o-mini',
        systemPrompt,
        userInput,
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 4096
      },
      this.outputSchema
    );

    console.log(chalk.green('✅ 動画構成決定完了'));
    console.log(chalk.gray(`📊 タイムライン: ${response.data.composition.timeline.length}ショット`));
    console.log(chalk.gray(`💰 総コスト: $${response.data.metadata.totalCost.toFixed(4)}`));
    console.log(chalk.gray(`Token使用量: ${response.tokensUsed}, コスト: $${response.costUSD.toFixed(4)}`));

    return response.data;
  }
} 