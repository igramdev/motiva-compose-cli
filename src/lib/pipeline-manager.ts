import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { 
  PipelineConfig, 
  PipelineConfigSchema, 
  PipelineResult, 
  PipelineResultSchema,
  AgentConfig 
} from '../schemas/index.js';
import { ParallelOrchestrator } from './parallel-orchestrator.js';
import { BudgetManager } from './budget.js';
import { ConceptPlannerAgent } from '../agents/concept-planner-agent.js';
import { AssetSynthesizerAgent } from '../agents/asset-synthesizer-agent.js';
import { DirectorAgent } from '../agents/director-agent.js';
import { EditorAgent } from '../agents/editor-agent.js';
import { CriticAgent } from '../agents/critic-agent.js';

/**
 * パイプライン管理クラス
 * パイプライン定義ファイルの読み込みと実行を管理
 */
export class PipelineManager {
  private budgetManager: BudgetManager;
  private orchestrator: ParallelOrchestrator;

  constructor(budgetManager: BudgetManager, maxConcurrency: number = 3) {
    this.budgetManager = budgetManager;
    this.orchestrator = new ParallelOrchestrator(maxConcurrency);
  }

  /**
   * パイプライン定義ファイルを読み込み
   */
  async loadPipelineConfig(filePath: string): Promise<PipelineConfig> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const config = JSON.parse(content);
      
      // スキーマ検証
      const validatedConfig = PipelineConfigSchema.parse(config);
      
      console.log(chalk.blue(`📋 パイプライン設定を読み込み: ${validatedConfig.name}`));
      console.log(chalk.gray(`   エージェント数: ${validatedConfig.agents.length}`));
      console.log(chalk.gray(`   バージョン: ${validatedConfig.version}`));
      
      return validatedConfig;
    } catch (error) {
      throw new Error(`パイプライン設定ファイルの読み込みに失敗: ${error}`);
    }
  }

  /**
   * エージェントインスタンスを作成
   */
  private createAgent(agentConfig: AgentConfig, apiKey?: string) {
    const { type, config: agentConfigData } = agentConfig;
    
    switch (type) {
      case 'concept-planner':
        return new ConceptPlannerAgent(this.budgetManager, apiKey);
      case 'asset-synthesizer':
        return new AssetSynthesizerAgent(this.budgetManager, apiKey);
      case 'director':
        return new DirectorAgent();
      case 'editor':
        return new EditorAgent(this.budgetManager, apiKey);
      case 'critic':
        return new CriticAgent(this.budgetManager, apiKey);
      default:
        throw new Error(`未対応のエージェントタイプ: ${type}`);
    }
  }

  /**
   * 依存関係をチェック
   */
  private validateDependencies(agents: AgentConfig[]): void {
    const agentNames = new Set(agents.map(agent => agent.name));
    
    for (const agent of agents) {
      if (agent.dependencies) {
        for (const dep of agent.dependencies) {
          if (!agentNames.has(dep)) {
            throw new Error(`エージェント "${agent.name}" の依存関係 "${dep}" が見つかりません`);
          }
        }
      }
    }
  }

  /**
   * パイプラインを実行
   */
  async executePipeline(
    config: PipelineConfig, 
    userInput: string,
    apiKey?: string
  ): Promise<PipelineResult> {
    const executionId = uuidv4();
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();
    
    console.log(chalk.blue(`🚀 パイプライン実行開始: ${config.name}`));
    console.log(chalk.gray(`   実行ID: ${executionId}`));
    
    // 依存関係をチェック
    this.validateDependencies(config.agents);
    
    // エージェントインスタンスを作成
    const agents = config.agents.map(agentConfig => 
      this.createAgent(agentConfig, apiKey)
    );
    
    const results = [];
    let currentInput = userInput;
    let totalTokens = 0;
    let totalCost = 0;
    let status: 'success' | 'failed' | 'partial' = 'success';
    
    try {
      // パイプライン形式で実行
      const pipelineResult = await this.orchestrator.executePipeline(
        agents,
        currentInput,
        {
          showProgress: config.options?.showProgress ?? true,
          timeoutMs: config.options?.timeout ?? 30000,
          useCache: config.options?.useCache ?? true
        }
      );
      
      // 結果を記録
      results.push({
        agentName: 'pipeline',
        status: 'success' as const,
        duration: Date.now() - startTimestamp,
        output: pipelineResult
      });
      
    } catch (error) {
      status = 'failed';
      results.push({
        agentName: 'pipeline',
        status: 'failed' as const,
        duration: Date.now() - startTimestamp,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    const endTime = new Date().toISOString();
    const duration = Date.now() - startTimestamp;
    
    const result: PipelineResult = {
      pipelineName: config.name,
      executionId,
      startTime,
      endTime,
      duration,
      status,
      results,
      totalTokens,
      totalCost
    };
    
    // 結果を検証
    PipelineResultSchema.parse(result);
    
    console.log(chalk.green(`✅ パイプライン実行完了: ${config.name}`));
    console.log(chalk.gray(`   実行時間: ${duration}ms`));
    console.log(chalk.gray(`   ステータス: ${status}`));
    
    return result;
  }

  /**
   * パイプライン結果を保存
   */
  async savePipelineResult(result: PipelineResult, outputPath: string): Promise<void> {
    try {
      await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
      console.log(chalk.blue(`📄 パイプライン結果を保存: ${outputPath}`));
    } catch (error) {
      throw new Error(`パイプライン結果の保存に失敗: ${error}`);
    }
  }

  /**
   * デフォルトパイプライン設定を生成
   */
  static generateDefaultPipeline(): PipelineConfig {
    return {
      name: 'default-pipeline',
      description: 'デフォルトの3段階パイプライン',
      version: '1.0',
      agents: [
        {
          name: 'concept-planner',
          type: 'concept-planner',
          parallel: false,
          config: {
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 4096
          }
        },
        {
          name: 'asset-synthesizer',
          type: 'asset-synthesizer',
          parallel: false,
          config: {
            model: 'gpt-4o-mini',
            temperature: 0.5,
            maxTokens: 6144,
            quality: 'standard'
          },
          dependencies: ['concept-planner']
        },
        {
          name: 'director',
          type: 'director',
          parallel: false,
          dependencies: ['asset-synthesizer']
        }
      ],
      options: {
        maxConcurrency: 3,
        timeout: 120000,
        useCache: true,
        showProgress: true,
        enableParallel: true
      },
      metadata: {
        createdAt: new Date().toISOString(),
        author: 'system',
        tags: ['default', '3-stage']
      }
    };
  }

  /**
   * パイプライン設定テンプレートを保存
   */
  async savePipelineTemplate(config: PipelineConfig, filePath: string): Promise<void> {
    try {
      await fs.writeFile(filePath, JSON.stringify(config, null, 2));
      console.log(chalk.blue(`📄 パイプライン設定テンプレートを保存: ${filePath}`));
    } catch (error) {
      throw new Error(`パイプライン設定テンプレートの保存に失敗: ${error}`);
    }
  }
} 