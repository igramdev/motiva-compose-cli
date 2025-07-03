import { z } from 'zod';
import { SchemaRegistry } from './schema-registry.js';
import { withRetry } from './retry.js';
import chalk from 'chalk';

/**
 * 各エージェントの共通インターフェース
 */
export abstract class BaseAgent<I = any, O = any> {
  abstract name: string;
  abstract inputSchema: z.ZodSchema<I>;
  abstract outputSchema: z.ZodSchema<O>;
  abstract run(input: I): Promise<O>;
}

/**
 * Orchestrator: 複数エージェントをパイプラインで連携実行
 */
export class AgentOrchestrator {
  private steps: BaseAgent[] = [];
  private dataTransformers: ((data: any) => any)[] = [];

  addStep(agent: BaseAgent, transformer?: (data: any) => any): this {
    this.steps.push(agent);
    this.dataTransformers.push(transformer || ((data: any) => data));
    return this;
  }

  /**
   * パイプラインを順次実行
   */
  async execute(initialInput: any): Promise<any> {
    let data = initialInput;
    for (let i = 0; i < this.steps.length; i++) {
      const agent = this.steps[i]!;
      const transformer = this.dataTransformers[i]!;
      
      // 入力バリデーション
      data = agent.inputSchema.parse(data);
      // リトライ機能付きで実行
      data = await withRetry(
        async () => {
          const result = await agent.run(data);
          return result;
        },
        {
          onRetry: (attempt, error, delayMs) => {
            console.log(chalk.yellow(`🔄 エージェント ${agent.name} リトライ ${attempt}: ${error.type}`));
          }
        }
      );
      // 出力バリデーション
      data = agent.outputSchema.parse(data);
      
      // データ変換（エージェント実行後）
      data = transformer(data);
    }
    return data;
  }

  /**
   * パイプラインのエージェント名リスト
   */
  getPipeline(): string[] {
    return this.steps.map(agent => agent.name);
  }

  clear(): void {
    this.steps = [];
  }
} 