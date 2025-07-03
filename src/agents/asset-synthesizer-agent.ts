import { z } from 'zod';
import { BaseAgent } from '../lib/agent-orchestrator.js';
import { AssetSynthesizer } from './asset-synthesizer.js';
import { BudgetManager } from '../lib/budget.js';
import { ShotPlan, ShotPlanSchema, AssetManifest, AssetManifestSchema } from '../schemas/index.js';
import { ConfigurationManager, AgentConfig } from '../lib/config-manager.js';

/**
 * AssetSynthesizerをBaseAgentとしてラップ
 */
export class AssetSynthesizerAgent extends BaseAgent<ShotPlan, AssetManifest> {
  name = 'asset-synthesizer';
  inputSchema = ShotPlanSchema;
  outputSchema = AssetManifestSchema;

  private synthesizer: AssetSynthesizer;
  private configManager: ConfigurationManager;

  constructor(budgetManager: BudgetManager, apiKey?: string) {
    super();
    this.synthesizer = new AssetSynthesizer(budgetManager, apiKey);
    this.configManager = ConfigurationManager.getInstance();
  }

  async run(shotPlan: ShotPlan): Promise<AssetManifest> {
    // 設定を取得（キャッシュを活用）
    const config = await this.configManager.getAgentConfig('assetSynthesizer');
    
    return await this.synthesizer.generateManifest(shotPlan, {
      model: config.provider?.replace('openai:', '') || 'gpt-4o-mini',
      temperature: config.temperature || 0.5,
      maxTokens: config.maxTokens || 6144
    });
  }
} 