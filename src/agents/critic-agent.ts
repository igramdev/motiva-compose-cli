import { z } from 'zod';
import { BaseAgent } from '../lib/agent-orchestrator.js';
import { BudgetManager } from '../lib/budget.js';
import { SceneGraph, SceneGraphSchema } from '../schemas/index.js';
import { ConfigurationManager, AgentConfig } from '../lib/config-manager.js';
import { OpenAIWrapper, LLMRequest } from '../lib/openai.js';
import chalk from 'chalk';

// Critic Report Schema
const CriticReportSchema = z.object({
  overallScore: z.number().min(0).max(100),
  qualityAssessment: z.object({
    visualQuality: z.number().min(0).max(100),
    narrativeFlow: z.number().min(0).max(100),
    technicalExecution: z.number().min(0).max(100),
    emotionalImpact: z.number().min(0).max(100)
  }),
  issues: z.array(z.object({
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    category: z.enum(['visual', 'narrative', 'technical', 'performance']),
    description: z.string(),
    suggestion: z.string().optional()
  })),
  strengths: z.array(z.string()),
  recommendations: z.array(z.string()),
  metadata: z.object({
    reviewDate: z.string().datetime(),
    reviewer: z.string(),
    version: z.string()
  })
});

/**
 * Critic/QA Agent: 品質評価・フィードバックを担当
 */
export class CriticAgent extends BaseAgent<SceneGraph, z.infer<typeof CriticReportSchema>> {
  name = 'critic';
  inputSchema = SceneGraphSchema;
  outputSchema = CriticReportSchema;

  private openai: OpenAIWrapper;
  private budgetManager: BudgetManager;
  private configManager: ConfigurationManager;

  constructor(budgetManager: BudgetManager, apiKey?: string) {
    super();
    this.openai = new OpenAIWrapper(apiKey);
    this.budgetManager = budgetManager;
    this.configManager = ConfigurationManager.getInstance();
  }

  async run(sceneGraph: SceneGraph): Promise<z.infer<typeof CriticReportSchema>> {
    console.log(chalk.blue('🎬 Critic Agent: 品質評価・フィードバック生成中...'));

    const config = await this.configManager.getAgentConfig('critic');
    
    const systemPrompt = `あなたは経験豊富な映像品質管理担当者です。
SceneGraphを詳細に分析し、包括的な品質評価レポートを生成してください。

評価基準：
1. 視覚的品質 (Visual Quality): 映像の美しさ、構図、色彩
2. ナラティブフロー (Narrative Flow): ストーリーの流れ、感情の起伏
3. 技術的実行 (Technical Execution): 技術的な完成度、エフェクトの適切性
4. 感情的インパクト (Emotional Impact): 視聴者への感情的な影響力

各項目を0-100のスコアで評価し、具体的な改善提案を含めてください。

**重要**: reviewDateは必ずISO 8601の完全な日時形式で出力してください。
例: "2023-10-01T12:34:56.789Z" または "2023-10-01T12:34:56+09:00"`;

    const userInput = `以下のSceneGraphを詳細に分析し、品質評価レポートを生成してください：

${JSON.stringify(sceneGraph, null, 2)}

以下の形式でJSONレポートを出力してください：
- 総合スコア (0-100)
- 各評価項目のスコア (0-100)
- 発見された問題点（重要度別）
- 強み
- 改善提案

**重要**: reviewDateは必ずISO 8601の完全な日時形式（例: "2023-10-01T12:34:56.789Z"）で出力してください。`;

    const request: LLMRequest = {
      model: config.provider?.replace('openai:', '') || 'gpt-4o-mini',
      systemPrompt,
      userInput,
      temperature: config.temperature || 0.2,
      maxTokens: config.maxTokens || 6144
    };

    // 予算チェック
    const estimatedTokens = Math.ceil((systemPrompt.length + userInput.length) / 3);
    const estimatedCost = estimatedTokens * 0.00015 / 1000;
    
    const canProceed = await this.budgetManager.checkBudgetLimit(estimatedTokens, estimatedCost);
    if (!canProceed) {
      throw new Error('予算制限により品質評価を中断しました');
    }

    try {
      const response = await this.openai.generateJSON(
        request,
        CriticReportSchema,
        'critic_report_schema'
      );

      await this.budgetManager.addUsage(response.tokensUsed, response.costUSD);

      console.log(chalk.green('✅ 品質評価レポート生成完了'));
      console.log(chalk.gray(`Token使用量: ${response.tokensUsed}, コスト: $${response.costUSD.toFixed(4)}`));
      console.log(chalk.yellow(`📊 総合スコア: ${response.data.overallScore}/100`));

      return response.data;
    } catch (error) {
      console.error(chalk.red('❌ 品質評価レポート生成に失敗:'), error);
      throw error;
    }
  }
} 