import { z } from 'zod';
import chalk from 'chalk';
import { EventBus, PipelineEvent } from './event-bus.js';
import { llmProviderManager, LLMProvider, LLMRequest, LLMResponse } from './llm-provider.js';
import { DualBudgetManager, CostEstimate } from './dual-budget-manager.js';
// BaseAgentは削除されたため、直接エージェントクラスを使用
import { CacheManager } from './cache-manager.js';

export interface AgentConfig {
  name: string;
  model: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
}

export interface PipelineConfig {
  agents: AgentConfig[];
  maxConcurrency?: number;
  useCache?: boolean;
}

export interface PipelineResult {
  success: boolean;
  data?: any;
  error?: string;
  events: PipelineEvent[];
}

/**
 * イベント駆動Orchestrator
 */
export class EventDrivenOrchestrator {
  private eventBus: EventBus;
  private budgetManager: DualBudgetManager;
  private cacheManager: CacheManager;

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.budgetManager = new DualBudgetManager();
    this.cacheManager = new CacheManager();
  }

  /**
   * パイプラインを実行
   */
  async executePipeline(
    config: PipelineConfig,
    initialInput: any
  ): Promise<PipelineResult> {
    const events: PipelineEvent[] = [];
    const subscription = this.eventBus.subscribeToPipeline(async (event) => {
      events.push(event);
    });

    try {
      let currentInput = initialInput;

      for (const agentConfig of config.agents) {
        const result = await this.executeAgent(agentConfig, currentInput);
        currentInput = result.data;

        await this.eventBus.publish({
          type: this.getEventTypeForAgent(agentConfig.name),
          data: result.data,
          metadata: {
            agent: agentConfig.name,
            model: agentConfig.model,
            cost: result.costUSD,
            duration: result.duration
          }
        });
      }

      return { success: true, data: currentInput, events };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        events
      };
    } finally {
      subscription.unsubscribe();
    }
  }

  /**
   * 単一エージェントを実行
   */
  private async executeAgent(
    config: AgentConfig,
    input: any
  ): Promise<LLMResponse<any>> {
    const validatedInput = config.inputSchema.parse(input);
    const provider = llmProviderManager.getProviderForModel(config.model);

    const request: LLMRequest = {
      model: config.model,
      systemPrompt: config.systemPrompt,
      userInput: JSON.stringify(validatedInput),
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096
    };

    const startTime = Date.now();
    const response = await provider.generateJSON(request, config.outputSchema);
    const duration = Date.now() - startTime;

    return { ...response, duration };
  }

  private getEventTypeForAgent(agentName: string): PipelineEvent['type'] {
    const typeMap: Record<string, PipelineEvent['type']> = {
      'concept-planner': 'plan',
      'asset-synthesizer': 'synth',
      'director': 'compose',
      'editor': 'compose',
      'critic': 'validate'
    };
    return typeMap[agentName] || 'compose';
  }
} 