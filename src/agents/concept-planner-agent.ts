import { z } from 'zod';
import { BaseAgent } from '../lib/agent-orchestrator.js';
import { ConceptPlanner } from './concept-planner.js';
import { BudgetManager } from '../lib/budget.js';
import { ShotPlan, ShotPlanSchema } from '../schemas/index.js';
import { ConfigurationManager, AgentConfig } from '../lib/config-manager.js';

/**
 * ConceptPlannerをBaseAgentとしてラップ
 */
export class ConceptPlannerAgent extends BaseAgent<string, ShotPlan> {
  name = 'concept-planner';
  inputSchema = z.string().min(1);
  outputSchema = ShotPlanSchema;

  private planner: ConceptPlanner;
  private configManager: ConfigurationManager;

  constructor(budgetManager: BudgetManager, apiKey?: string) {
    super();
    this.planner = new ConceptPlanner(budgetManager, apiKey);
    this.configManager = ConfigurationManager.getInstance();
  }

  async run(theme: string): Promise<ShotPlan> {
    // 設定を取得
    const config = await this.configManager.getAgentConfig('conceptPlanner');
    
    return await this.planner.generatePlan(theme, {
      model: config.provider.replace('openai:', ''),
      temperature: config.temperature,
      maxTokens: config.maxTokens
    });
  }
} 