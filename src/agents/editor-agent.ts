import { z } from 'zod';
import { BaseAgent } from '../lib/agent-orchestrator.js';
import { BudgetManager } from '../lib/budget.js';
import { SceneGraph, SceneGraphSchema, JsonPatch, JsonPatchSchema } from '../schemas/index.js';
import { ConfigurationManager, AgentConfig } from '../lib/config-manager.js';
import { OpenAIWrapper, LLMRequest } from '../lib/openai.js';
import chalk from 'chalk';

/**
 * Editor Agent: 映像編集・品質向上を担当
 */
export class EditorAgent extends BaseAgent<SceneGraph, JsonPatch> {
  name = 'editor';
  inputSchema = SceneGraphSchema;
  outputSchema = JsonPatchSchema;

  private openai: OpenAIWrapper;
  private budgetManager: BudgetManager;
  private configManager: ConfigurationManager;

  constructor(budgetManager: BudgetManager, apiKey?: string) {
    super();
    this.openai = new OpenAIWrapper(apiKey);
    this.budgetManager = budgetManager;
    this.configManager = ConfigurationManager.getInstance();
  }

  async run(sceneGraph: SceneGraph): Promise<JsonPatch> {
    console.log(chalk.blue('🎬 Editor Agent: 映像編集・品質向上中...'));

    const config = await this.configManager.getAgentConfig('editor');
    
    const systemPrompt = `あなたは経験豊富な映像エディタです。
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
`;

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
    
    const canProceed = await this.budgetManager.checkBudgetLimit(estimatedTokens, estimatedCost);
    if (!canProceed) {
      throw new Error('予算制限により編集処理を中断しました');
    }

    try {
      const response = await this.openai.generateJSON(
        request,
        JsonPatchSchema,
        'json_patch_schema'
      );

      await this.budgetManager.addUsage(response.tokensUsed, response.costUSD);
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