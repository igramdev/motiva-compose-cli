import { EventDrivenOrchestrator } from './event-driven-orchestrator.js';
import { AgentConfig, PipelineConfig } from './event-driven-orchestrator.js';
import { ShotPlanSchema, AssetManifestSchema } from '../schemas/index.js';
import { z } from 'zod';
import chalk from 'chalk';

/**
 * 既存CLIコマンドを新しいOrchestratorと統合するアダプター
 */
export class CLIAdapter {
  private orchestrator: EventDrivenOrchestrator;

  constructor() {
    this.orchestrator = new EventDrivenOrchestrator();
  }

  /**
   * planコマンドの新しい実装
   */
  async executePlan(
    prompt: string,
    options: { model: string; temperature: number }
  ): Promise<any> {
    const config: PipelineConfig = {
      agents: [{
        name: 'concept-planner',
        model: options.model,
        temperature: options.temperature,
        systemPrompt: this.getConceptPlannerPrompt(),
        inputSchema: z.string(),
        outputSchema: ShotPlanSchema
      }],
      useCache: true
    };

    const result = await this.orchestrator.executePipeline(config, prompt);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  /**
   * synthコマンドの新しい実装
   */
  async executeSynth(
    shotPlan: any,
    options: { model: string; temperature: number; quality: string }
  ): Promise<any> {
    const config: PipelineConfig = {
      agents: [{
        name: 'asset-synthesizer',
        model: options.model,
        temperature: options.temperature,
        systemPrompt: this.getAssetSynthesizerPrompt(options.quality),
        inputSchema: ShotPlanSchema,
        outputSchema: AssetManifestSchema
      }],
      useCache: true
    };

    const result = await this.orchestrator.executePipeline(config, shotPlan);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  /**
   * 完全パイプライン（plan → synth → compose）の新しい実装
   */
  async executeFullPipeline(
    prompt: string,
    options: { model: string; temperature: number; quality: string }
  ): Promise<any> {
    const config: PipelineConfig = {
      agents: [
        {
          name: 'concept-planner',
          model: options.model,
          temperature: options.temperature,
          systemPrompt: this.getConceptPlannerPrompt(),
          inputSchema: z.string(),
          outputSchema: ShotPlanSchema
        },
        {
          name: 'asset-synthesizer',
          model: options.model,
          temperature: options.temperature,
          systemPrompt: this.getAssetSynthesizerPrompt(options.quality),
          inputSchema: ShotPlanSchema,
          outputSchema: AssetManifestSchema
        },
        {
          name: 'director',
          model: options.model,
          temperature: options.temperature,
          systemPrompt: this.getDirectorPrompt(),
          inputSchema: z.object({
            shotPlan: ShotPlanSchema,
            assetManifest: AssetManifestSchema
          }),
          outputSchema: z.any() // SceneGraphスキーマ
        }
      ],
      useCache: true
    };

    const result = await this.orchestrator.executePipeline(config, prompt);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  /**
   * 並列パイプラインの新しい実装
   */
  async executeParallelPipelines(
    prompts: string[],
    options: { model: string; temperature: number; quality: string }
  ): Promise<any[]> {
    const configs: PipelineConfig[] = prompts.map(prompt => ({
      agents: [
        {
          name: 'concept-planner',
          model: options.model,
          temperature: options.temperature,
          systemPrompt: this.getConceptPlannerPrompt(),
          inputSchema: z.string(),
          outputSchema: ShotPlanSchema
        },
        {
          name: 'asset-synthesizer',
          model: options.model,
          temperature: options.temperature,
          systemPrompt: this.getAssetSynthesizerPrompt(options.quality),
          inputSchema: ShotPlanSchema,
          outputSchema: AssetManifestSchema
        }
      ],
      useCache: true,
      maxConcurrency: 3
    }));

    // 一時的に順次実行（並列実装は後で追加）
    const results = [];
    for (const config of configs) {
      const result = await this.orchestrator.executePipeline(config, prompts[0]);
      results.push(result);
    }
    return results.map((r: any) => r.success ? r.data : null).filter(Boolean);
  }

  /**
   * プロバイダー情報を表示
   */
  showProviderInfo(): void {
    // 一時的に空実装
    console.log(chalk.blue('🤖 プロバイダー情報: 実装中'));
  }

  /**
   * 統計情報を取得
   */
  getStats(): any {
    // 一時的に空実装
    return { status: '実装中' };
  }

  // プロンプトテンプレート
  private getConceptPlannerPrompt(): string {
    return `あなたは放送作家です。テーマを"ショットリストJSON"に変換してください。
必ずJSON形式で出力してください。`;
  }

  private getAssetSynthesizerPrompt(quality: string): string {
    return `あなたは映像デザイナーです。Shot Plan を読み、素材仕様を生成してください。
品質: ${quality}
必ずJSON形式で出力してください。`;
  }

  private getDirectorPrompt(): string {
    return `映画監督として、shot_plan と asset_manifest を組み合わせてScene Graphを作成してください。
必ずJSON形式で出力してください。`;
  }
} 