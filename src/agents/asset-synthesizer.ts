import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { OpenAIWrapper, LLMRequest } from '../lib/openai.js';
import { BudgetManager } from '../lib/budget.js';
import { ShotPlan, AssetManifest, AssetManifestSchema, AssetItem } from '../schemas/index.js';

export interface AssetSynthesizerConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  quality?: 'draft' | 'standard' | 'high';
  outputDir?: string;
}

export class AssetSynthesizer {
  private openai: OpenAIWrapper;
  private budgetManager: BudgetManager;
  private systemPrompt: string | null = null;

  constructor(
    budgetManager: BudgetManager,
    apiKey?: string
  ) {
    this.openai = new OpenAIWrapper(apiKey);
    this.budgetManager = budgetManager;
  }

  private async loadSystemPrompt(): Promise<string> {
    if (this.systemPrompt) return this.systemPrompt;

    try {
      const promptPath = path.join(process.cwd(), 'prompts', 'asset-synthesizer', 'v1_system.txt');
      this.systemPrompt = await fs.readFile(promptPath, 'utf8');
      return this.systemPrompt;
    } catch (error) {
      // フォールバック用の最小限のプロンプト
      this.systemPrompt = `
あなたは映像制作の Asset Synthesizer です。
ショットプランから必要な映像・音声素材の仕様を定義することが専門です。

与えられたショットプランから、各ショットに必要な素材を分析し、
具体的な生成指示を含むAsset Manifestを作成してください。

出力はJSON形式で、以下の構造に従ってください：
{
  "sceneId": "string",
  "version": "1.0",
  "assets": [
    {
      "id": "string",
      "type": "video|audio|image|effect",
      "generator": "string",
      "spec": {
        "description": "string",
        "duration": number,
        "dimensions": {"width": number, "height": number},
        "format": "string",
        "style": "string",
        "quality": "draft|standard|high"
      },
      "status": "pending",
      "metadata": {
        "shotId": "string",
        "estimatedCost": number
      }
    }
  ],
  "generators": {
    "generator_name": {
      "name": "string", 
      "type": "mock|api|local",
      "config": {}
    }
  },
  "totalEstimatedCost": number
}
      `.trim();
      return this.systemPrompt;
    }
  }

  async generateManifest(
    shotPlan: ShotPlan,
    config: AssetSynthesizerConfig = {}
  ): Promise<AssetManifest> {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.5,
      maxTokens = 6144,
      quality = 'standard'
    } = config;

    console.log(chalk.blue('🎨 Asset Synthesizer: Asset Manifest 生成中...'));

    const systemPrompt = await this.loadSystemPrompt();
    const userInput = `ショットプラン:
${JSON.stringify(shotPlan, null, 2)}

品質レベル: ${quality}
このショットプランに基づいて、必要な映像・音声素材の詳細仕様を定義してください。

各ショットについて：
- 映像素材 (type: "video" または "image")
- 必要に応じて効果音やエフェクト
- BGMが指定されている場合は音楽素材

現在はプロトタイプ段階のため、実際の生成は行わず、仕様の定義のみを行ってください。
generatorは "mock" を使用し、実用的な見積もりコストを含めてください。`;

    const request: LLMRequest = {
      model,
      systemPrompt,
      userInput,
      temperature,
      maxTokens
    };

    // 予算チェック（概算）
    const estimatedTokens = Math.ceil(
      (systemPrompt.length + userInput.length + JSON.stringify(shotPlan).length) / 3
    );
    const estimatedCost = estimatedTokens * 0.00015 / 1000; // gpt-4o-mini基準

    const canProceed = await this.budgetManager.checkBudgetLimit(estimatedTokens, estimatedCost);
    if (!canProceed) {
      throw new Error('予算制限により処理を中断しました');
    }

    try {
      const response = await this.openai.generateJSON(
        request,
        AssetManifestSchema,
        'asset_manifest_schema'
      );

      // 実際の使用量を記録
      await this.budgetManager.addUsage(response.tokensUsed, response.costUSD);

      console.log(chalk.green('✅ Asset Manifest 生成完了'));
      console.log(chalk.gray(`Token使用量: ${response.tokensUsed}, コスト: $${response.costUSD.toFixed(4)}`));
      console.log(chalk.cyan(`生成された素材数: ${response.data.assets.length}件`));

      return response.data;
    } catch (error) {
      console.error(chalk.red('❌ Asset Manifest 生成に失敗:'), error);
      throw error;
    }
  }

  async validateManifest(manifest: AssetManifest): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 基本的な検証
    if (!manifest.assets || manifest.assets.length === 0) {
      errors.push('少なくとも1つのアセットが必要です');
    }

    // アセット別検証
    const assetIds = new Set<string>();
    let totalCost = 0;

    for (const asset of manifest.assets) {
      // ID重複チェック
      if (assetIds.has(asset.id)) {
        errors.push(`アセットID "${asset.id}" が重複しています`);
      }
      assetIds.add(asset.id);

      // 必須フィールドチェック
      if (!asset.spec.description || asset.spec.description.trim().length === 0) {
        errors.push(`アセット "${asset.id}" の説明が空です`);
      }

      // タイプ別検証
      if (asset.type === 'video' || asset.type === 'audio') {
        if (!asset.spec.duration || asset.spec.duration <= 0) {
          warnings.push(`${asset.type} アセット "${asset.id}" の再生時間が指定されていません`);
        }
      }

      if (asset.type === 'video' || asset.type === 'image') {
        if (!asset.spec.dimensions) {
          warnings.push(`${asset.type} アセット "${asset.id}" の解像度が指定されていません`);
        }
      }

      // コスト集計
      if (asset.metadata?.estimatedCost) {
        totalCost += asset.metadata.estimatedCost;
      }
    }

    // コスト警告
    if (totalCost > 10) {
      warnings.push(`総推定コストが $${totalCost.toFixed(2)} と高額です`);
    }

    // 品質チェック
    const lowQualityAssets = manifest.assets.filter(asset => asset.spec.quality === 'draft');
    if (lowQualityAssets.length > 0) {
      warnings.push(`${lowQualityAssets.length}件のアセットが draft 品質です`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async synthesizeAssets(
    manifest: AssetManifest,
    outputDir: string = './assets'
  ): Promise<AssetManifest> {
    console.log(chalk.blue('🔧 Asset Synthesizer: 素材生成開始...'));

    // 出力ディレクトリの作成
    await fs.mkdir(outputDir, { recursive: true });

    const updatedAssets: AssetItem[] = [];

    for (const asset of manifest.assets) {
      console.log(chalk.yellow(`📦 処理中: ${asset.id} (${asset.type})`));

      try {
        let updatedAsset: AssetItem;

        switch (asset.generator) {
          case 'mock':
            updatedAsset = await this.generateMockAsset(asset, outputDir);
            break;
          default:
            console.log(chalk.yellow(`⚠️  未対応のジェネレータ: ${asset.generator}, mockに切り替えます`));
            updatedAsset = await this.generateMockAsset(asset, outputDir);
        }

        updatedAssets.push(updatedAsset);
        console.log(chalk.green(`✅ 完了: ${asset.id}`));
      } catch (error) {
        console.error(chalk.red(`❌ 生成失敗: ${asset.id}`), error);
        updatedAssets.push({
          ...asset,
          status: 'failed'
        });
      }
    }

    const updatedManifest: AssetManifest = {
      ...manifest,
      version: manifest.version || '1.0',
      assets: updatedAssets
    };

    console.log(chalk.green('🎉 Asset 生成完了'));
    return updatedManifest;
  }

  private async generateMockAsset(asset: AssetItem, outputDir: string): Promise<AssetItem> {
    const fileName = `${asset.id}.${asset.spec.format || this.getDefaultFormat(asset.type)}`;
    const filePath = path.join(outputDir, fileName);

    // モック用のプレースホルダーファイルを生成
    const mockContent = this.generateMockContent(asset);
    await fs.writeFile(filePath, mockContent);

    return {
      ...asset,
      uri: filePath,
      status: 'generated',
      metadata: {
        ...asset.metadata,
        createdAt: new Date().toISOString(),
        actualCost: 0.001 // モックなので最小コスト
      }
    };
  }

  private generateMockContent(asset: AssetItem): string {
    const spec = asset.spec;
    
    switch (asset.type) {
      case 'video':
        return `# Mock Video File
Asset ID: ${asset.id}
Description: ${spec.description}
Duration: ${spec.duration}s
Dimensions: ${spec.dimensions?.width}x${spec.dimensions?.height}
Style: ${spec.style}
Generated: ${new Date().toISOString()}
`;

      case 'audio':
        return `# Mock Audio File
Asset ID: ${asset.id}
Description: ${spec.description}
Duration: ${spec.duration}s
Style: ${spec.style}
Generated: ${new Date().toISOString()}
`;

      case 'image':
        return `# Mock Image File
Asset ID: ${asset.id}
Description: ${spec.description}
Dimensions: ${spec.dimensions?.width}x${spec.dimensions?.height}
Style: ${spec.style}
Generated: ${new Date().toISOString()}
`;

      default:
        return `# Mock ${asset.type} File
Asset ID: ${asset.id}
Description: ${spec.description}
Generated: ${new Date().toISOString()}
`;
    }
  }

  private getDefaultFormat(type: string): string {
    switch (type) {
      case 'video': return 'mp4';
      case 'audio': return 'wav';
      case 'image': return 'jpg';
      default: return 'txt';
    }
  }
} 