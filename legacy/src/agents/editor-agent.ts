import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SceneGraph, SceneGraphSchema, JsonPatch, JsonPatchSchema } from '../schemas/index.js';
import { ConfigurationManager } from '../lib/config-manager.js';
import { llmProviderManager, LLMRequest, LLMResponse } from '../lib/llm-provider.js';
import { DualBudgetManager, CostEstimate } from '../lib/dual-budget-manager.js';
import chalk from 'chalk';

/**
 * Editor Agent: 映像編集・品質向上を担当
 */
export class EditorAgent {
  name = 'editor';
  inputSchema = SceneGraphSchema;
  outputSchema = JsonPatchSchema;

  private budgetManager: DualBudgetManager;
  private configManager: ConfigurationManager;
  private systemPrompt: string | null = null;

  constructor(budgetManager?: DualBudgetManager) {
    this.budgetManager = budgetManager || new DualBudgetManager();
    this.configManager = ConfigurationManager.getInstance();
  }

  private async loadSystemPrompt(): Promise<string> {
    if (this.systemPrompt) return this.systemPrompt;

    try {
      const promptPath = path.join(process.cwd(), 'prompts', 'editor', 'v1_system.txt');
      this.systemPrompt = await fs.readFile(promptPath, 'utf8');
      return this.systemPrompt;
    } catch (error) {
      // フォールバック用の最小限のプロンプト
      this.systemPrompt = `
あなたは経験豊富な映像エディタです。
SceneGraphを分析し、品質向上のための編集提案をJSON Patch形式で出力してください。

編集の重点項目：
1. 映像の流れの改善
2. タイミングの調整
3. エフェクトの最適化
4. レイヤー構成の改善
5. パフォーマンスの向上

出力は必ずJSON Patch形式（RFC 6902）の**配列**として返してください。
**空の場合は必ず空配列（[]）を返してください。**

【出力例】
[
  {
    "op": "replace",
    "path": "/layers/0/effect",
    "value": "fade-in"
  },
  {
    "op": "add",
    "path": "/layers/2",
    "value": { "type": "effect", "name": "blur" }
  }
]
      `.trim();
      return this.systemPrompt;
    }
  }

  async run(sceneGraph: SceneGraph): Promise<JsonPatch> {
    console.log(chalk.blue('🎬 Editor Agent: 映像編集・品質向上中...'));

    const config = await this.configManager.getAgentConfig('editor');
    
    const systemPrompt = await this.loadSystemPrompt();

    const userInput = `以下のSceneGraphを分析し、品質向上のための編集提案をJSON Patch形式の**配列**で出力してください：

${JSON.stringify(sceneGraph, null, 2)}

- 必ず配列形式で出力してください。
- 編集提案がない場合は必ず空配列（[]）を返してください。
- 各編集操作は個別のオブジェクトとして含めてください。
- 例: [{ "op": "replace", "path": "/layers/0/effect", "value": "fade-in" }]
`;

    const request: LLMRequest = {
      model: config.provider?.replace('openai:', '') || 'gpt-4o-mini',
      systemPrompt,
      userInput,
      temperature: config.temperature || 0.3,
      maxTokens: config.maxTokens || 4096
    };

    // 予算チェック
    const estimatedTokens = Math.ceil((systemPrompt.length + userInput.length) / 3);
    const estimatedCost = estimatedTokens * 0.00015 / 1000;
    
    const costEstimate: CostEstimate = {
      tokens: estimatedTokens,
      estimatedCost: estimatedCost,
      estimatedWallTime: 30 // 推定30秒
    };
    
    const canProceed = await this.budgetManager.checkBudgetLimit(costEstimate);
    if (!canProceed) {
      throw new Error('予算制限により編集処理を中断しました');
    }

    try {
      const provider = llmProviderManager.getProviderForModel(request.model);
      const response = await provider.generateJSON(request, JsonPatchSchema);

      await this.budgetManager.addUsage({
        tokens: response.tokensUsed,
        cost: response.costUSD,
        wallTime: response.duration / 1000
      });
      return response.data;
    } catch (error: any) {
      // Zodバリデーションエラーで空オブジェクトの場合のみ空配列でリトライ
      if (
        error.message?.includes('Expected array, received object') &&
        error.data &&
        typeof error.data === 'object' &&
        !Array.isArray(error.data) &&
        Object.keys(error.data).length === 0
      ) {
        console.log(chalk.yellow('⚠️ OpenAIレスポンスが空オブジェクトだったため空配列[]で処理を継続します'));
        return [];
      }
      console.error(chalk.red('❌ 編集提案生成に失敗:'), error);
      throw error;
    }
  }
} 