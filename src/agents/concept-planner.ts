import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { llmProviderManager, LLMRequest, LLMResponse } from '../lib/llm-provider.js';
import { DualBudgetManager, CostEstimate } from '../lib/dual-budget-manager.js';
import { ShotPlan, ShotPlanSchema } from '../schemas/index.js';

export interface ConceptPlannerConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class ConceptPlanner {
  private budgetManager: DualBudgetManager;
  private systemPrompt: string | null = null;

  constructor(
    budgetManager?: DualBudgetManager,
    apiKey?: string
  ) {
    this.budgetManager = budgetManager || new DualBudgetManager();
  }

  private async loadSystemPrompt(): Promise<string> {
    if (this.systemPrompt) return this.systemPrompt;

    try {
      const promptPath = path.join(process.cwd(), 'prompts', 'concept-planner', 'v1_system.txt');
      this.systemPrompt = await fs.readFile(promptPath, 'utf8');
      return this.systemPrompt;
    } catch (error) {
      // フォールバック用の最小限のプロンプト
      this.systemPrompt = `
あなたは映像作品のショットプランを作成する放送作家です。
与えられたテーマからJSON形式のショットプランを生成してください。

出力はこの形式に従ってください：
{
  "sceneId": "string",
  "duration": number,
  "theme": "string", 
  "shots": [{"id": "string", "start": number, "len": number, "desc": "string"}],
  "bgm": {"style": "string", "bpm": number}
}
      `.trim();
      return this.systemPrompt;
    }
  }

  async generatePlan(
    theme: string,
    config: ConceptPlannerConfig = {}
  ): Promise<ShotPlan> {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 4096
    } = config;

    console.log(chalk.blue('🎬 Concept Planner: ショットプラン生成中...'));

    const systemPrompt = await this.loadSystemPrompt();
    const userInput = `テーマ: ${theme}

このテーマに基づいて、魅力的な映像作品のショットプランを作成してください。
30秒程度（約900フレーム）の作品を想定しています。`;

    const request: LLMRequest = {
      model,
      systemPrompt,
      userInput,
      temperature,
      maxTokens
    };

    // 予算チェック（概算）
    const estimatedTokens = Math.ceil(
      (systemPrompt.length + userInput.length) / 3 // 大まかな見積もり
    );
    const estimatedCost = estimatedTokens * 0.00015 / 1000; // gpt-4o-mini基準

    const costEstimate: CostEstimate = {
      tokens: estimatedTokens,
      estimatedCost: estimatedCost,
      estimatedWallTime: 30 // 推定30秒
    };
    
    const canProceed = await this.budgetManager.checkBudgetLimit(costEstimate);
    if (!canProceed) {
      throw new Error('予算制限により処理を中断しました');
    }

    try {
      const provider = llmProviderManager.getProviderForModel(request.model);
      const response = await provider.generateJSON(request, ShotPlanSchema);
      
      // 実際の使用量を記録
      await this.budgetManager.addUsage({
        tokens: response.tokensUsed,
        cost: response.costUSD,
        wallTime: response.duration / 1000
      });

      console.log(chalk.green('✅ ショットプラン生成完了'));
      console.log(chalk.gray(`Token使用量: ${response.tokensUsed}, コスト: $${response.costUSD.toFixed(4)}`));

      return response.data;
    } catch (error) {
      console.error(chalk.red('❌ ショットプラン生成に失敗:'), error);
      throw error;
    }
  }

  async validatePlan(plan: ShotPlan): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 基本的な検証
    if (plan.duration <= 0) {
      errors.push('総尺は0より大きい必要があります');
    }

    if (!plan.shots || plan.shots.length === 0) {
      errors.push('少なくとも1つのショットが必要です');
    }

    // ショット別検証
    const shotIds = new Set<string>();
    let totalShotDuration = 0;

    for (const shot of plan.shots) {
      // ID重複チェック
      if (shotIds.has(shot.id)) {
        errors.push(`ショットID "${shot.id}" が重複しています`);
      }
      shotIds.add(shot.id);

      // 長さチェック
      if (shot.len <= 0) {
        errors.push(`ショット "${shot.id}" の長さは0より大きい必要があります`);
      }

      // 開始位置チェック
      if (shot.start < 0) {
        errors.push(`ショット "${shot.id}" の開始位置は0以上である必要があります`);
      }

      totalShotDuration += shot.len;
    }

    // 総尺警告（厳密ではなく警告レベル）
    if (totalShotDuration > plan.duration * 1.1) {
      warnings.push('ショットの合計時間が総尺を大幅に超過しています');
    }

    // 時間軸重複チェック（警告レベル）
    const timeline = plan.shots.map(shot => ({
      id: shot.id,
      start: shot.start,
      end: shot.start + shot.len
    })).sort((a, b) => a.start - b.start);

    for (let i = 0; i < timeline.length - 1; i++) {
      if (timeline[i]!.end > timeline[i + 1]!.start) {
        warnings.push(`ショット "${timeline[i]!.id}" と "${timeline[i + 1]!.id}" が時間軸で重複しています`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
} 