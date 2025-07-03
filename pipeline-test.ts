import { ConceptPlanner } from './src/agents/concept-planner.js';
import { AssetSynthesizer } from './src/agents/asset-synthesizer.js';
import { DirectorAgent } from './src/agents/director-agent.js';
import { EditorAgent } from './src/agents/editor-agent.js';
import { CriticAgent } from './src/agents/critic-agent.js';
import { DualBudgetManager } from './src/lib/dual-budget-manager.js';
import { EventDrivenOrchestrator } from './src/lib/event-driven-orchestrator.js';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

interface PipelineConfig {
  name: string;
  description: string;
  version: string;
  agents: Array<{
    name: string;
    type: string;
    config?: any;
    dependencies?: string[];
    parallel?: boolean;
    parallelGroup?: string;
  }>;
  options?: {
    maxConcurrency?: number;
    timeout?: number;
    useCache?: boolean;
    showProgress?: boolean;
  };
}

interface PipelineResult {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

interface AgentRegistry {
  [key: string]: any;
}

async function loadPipelineConfig(pipelineFile: string): Promise<PipelineConfig> {
  try {
    const configPath = path.resolve(pipelineFile);
    const configContent = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    console.log(chalk.yellow(`⚠️  パイプライン設定ファイル ${pipelineFile} が見つかりません。デフォルト設定を使用します。`));
    return {
      name: "default-pipeline",
      description: "デフォルトの5段階パイプライン",
      version: "1.0",
      agents: [
        {
          name: "concept-planner",
          type: "concept-planner",
          config: {
            model: "gpt-4o-mini",
            temperature: 0.7,
            maxTokens: 4096
          }
        },
        {
          name: "asset-synthesizer",
          type: "asset-synthesizer",
          dependencies: ["concept-planner"],
          config: {
            model: "gpt-4o-mini",
            temperature: 0.5,
            maxTokens: 6144,
            quality: "standard"
          }
        },
        {
          name: "director",
          type: "director",
          dependencies: ["asset-synthesizer"]
        },
        {
          name: "editor",
          type: "editor",
          dependencies: ["director"]
        },
        {
          name: "critic",
          type: "critic",
          dependencies: ["editor"]
        }
      ],
      options: {
        maxConcurrency: 3,
        timeout: 30000,
        useCache: true,
        showProgress: true
      }
    };
  }
}

async function runPipelineTest(pipelineFile: string = 'motiva-pipeline.json') {
  console.log(chalk.blue('🚀 JSON DSLパイプラインテスト開始'));
  
  const results: PipelineResult[] = [];
  const startTime = Date.now();
  
  try {
    // パイプライン設定を読み込み
    const pipelineConfig = await loadPipelineConfig(pipelineFile);
    console.log(chalk.green(`📋 パイプライン: ${pipelineConfig.name}`));
    console.log(chalk.gray(`📝 ${pipelineConfig.description}`));
    
    // 予算管理を初期化
    const budgetManager = new DualBudgetManager();
    await budgetManager.ensureBudgetExists();
    
    // エージェントレジストリを作成
    const agentRegistry: AgentRegistry = {
      'concept-planner': new ConceptPlanner(budgetManager),
      'asset-synthesizer': new AssetSynthesizer(budgetManager),
      'director': new DirectorAgent(),
      'editor': new EditorAgent(budgetManager),
      'critic': new CriticAgent(budgetManager)
    };
    
    // テスト用のテーマ
    const theme = "春の桜の下で出会う二人の恋物語";
    console.log(chalk.yellow(`📝 テーマ: ${theme}`));
    
    // 依存関係を解決して実行順序を決定
    const executionOrder = resolveDependencies(pipelineConfig.agents);
    console.log(chalk.blue(`🔄 実行順序: ${executionOrder.map(agent => agent.name).join(' → ')}`));
    
    // 各エージェントを順次実行
    let currentData: any = { theme };
    
    for (const agentConfig of executionOrder) {
      const stepStart = Date.now();
      console.log(chalk.blue(`\n🎬 Step: ${agentConfig.name} (${agentConfig.type})`));
      
      try {
        const agent = agentRegistry[agentConfig.type];
        if (!agent) {
          throw new Error(`エージェントタイプ '${agentConfig.type}' が見つかりません`);
        }
        
        // エージェント固有の実行ロジック
        const result = await executeAgent(agent, agentConfig, currentData);
        const stepDuration = Date.now() - stepStart;
        
        results.push({
          step: agentConfig.name,
          success: true,
          data: result.summary,
          duration: stepDuration
        });
        
        console.log(chalk.green(`✅ ${agentConfig.name} 完了`));
        console.log(chalk.gray(`📊 ${JSON.stringify(result.summary)}`));
        
        // 次のエージェントにデータを渡す
        currentData = { ...currentData, ...result.output };
        
      } catch (error) {
        const stepDuration = Date.now() - stepStart;
        results.push({
          step: agentConfig.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: stepDuration
        });
        console.log(chalk.red(`❌ ${agentConfig.name} に失敗: ${error}`));
        break; // エラーが発生したら停止
      }
    }
    
    // 結果を表示
    displayResults(results, Date.now() - startTime);
    
  } catch (error) {
    console.error(chalk.red('❌ パイプラインテストに失敗:'), error);
  }
}

function resolveDependencies(agents: any[]): any[] {
  const agentMap = new Map(agents.map(agent => [agent.name, agent]));
  const visited = new Set<string>();
  const result: any[] = [];
  
  function visit(agentName: string) {
    if (visited.has(agentName)) return;
    visited.add(agentName);
    
    const agent = agentMap.get(agentName);
    if (!agent) return;
    
    // 依存関係を先に処理
    if (agent.dependencies) {
      for (const dep of agent.dependencies) {
        visit(dep);
      }
    }
    
    result.push(agent);
  }
  
  // すべてのエージェントを訪問
  for (const agent of agents) {
    visit(agent.name);
  }
  
  return result;
}

async function executeAgent(agent: any, config: any, inputData: any): Promise<{ output: any; summary: any }> {
  switch (config.type) {
    case 'concept-planner':
      const shotPlan = await agent.generatePlan(inputData.theme, config.config);
      return {
        output: { shotPlan },
        summary: { sceneCount: shotPlan.shots.length, duration: shotPlan.duration }
      };
      
    case 'asset-synthesizer':
      const assetManifest = await agent.generateManifest(inputData.shotPlan);
      return {
        output: { assetManifest },
        summary: { assetCount: assetManifest.assets.length }
      };
      
    case 'director':
      const directorInput = {
        sceneId: inputData.shotPlan.sceneId,
        version: "1.0",
        assets: inputData.assetManifest.assets.map((asset: any) => ({
          ...asset,
          uri: asset.uri || null,
          metadata: asset.metadata || null
        })),
        generators: null,
        totalEstimatedCost: null
      };
      const directorOutput = await agent.run(directorInput);
      return {
        output: { directorOutput },
        summary: { timelineCount: directorOutput.composition.timeline.length }
      };
      
    case 'editor':
      const mockSceneGraph = {
        "@context": "https://schema.motiva.dev/scene-graph/v2",
        "@id": "test-scene",
        "type": "Comp" as const,
        "fps": 30,
        "duration": 900,
        "size": { "w": 1920, "h": 1080 },
        "layers": [
          { "ref": "footage_1", "start": 0 },
          { "ref": "footage_2", "start": 120 }
        ]
      };
      const editorPatch = await agent.run(mockSceneGraph);
      return {
        output: { editorPatch },
        summary: { patchCount: editorPatch.length }
      };
      
    case 'critic':
      const mockSceneGraphForCritic = {
        "@context": "https://schema.motiva.dev/scene-graph/v2",
        "@id": "test-scene",
        "type": "Comp" as const,
        "fps": 30,
        "duration": 900,
        "size": { "w": 1920, "h": 1080 },
        "layers": [
          { "ref": "footage_1", "start": 0 },
          { "ref": "footage_2", "start": 120 }
        ]
      };
      const criticReport = await agent.run(mockSceneGraphForCritic);
      return {
        output: { criticReport },
        summary: { score: criticReport.overallScore }
      };
      
    default:
      throw new Error(`未対応のエージェントタイプ: ${config.type}`);
  }
}

function displayResults(results: PipelineResult[], totalDuration: number) {
  console.log(chalk.blue('\n📊 JSON DSLパイプラインテスト結果:'));
  console.log(chalk.gray(`総実行時間: ${totalDuration}ms`));
  
  for (const result of results) {
    const status = result.success ? chalk.green('✅') : chalk.red('❌');
    const duration = chalk.gray(`(${result.duration}ms)`);
    const data = result.data ? chalk.gray(`📋 ${JSON.stringify(result.data)}`) : '';
    const error = result.error ? chalk.red(`❌ ${result.error}`) : '';
    
    console.log(`  ${status} ${result.step} ${duration}`);
    if (data) console.log(`    ${data}`);
    if (error) console.log(`    ${error}`);
  }
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
  
  console.log(chalk.blue(`\n📈 成功率: ${successCount}/${totalCount} (${successRate.toFixed(1)}%)`));
  
  if (successRate === 100) {
    console.log(chalk.green('\n🎉 JSON DSLパイプラインテスト完了 - 全ステップ成功！'));
  } else {
    console.log(chalk.yellow('\n⚠️  JSON DSLパイプラインテスト完了 - 一部エラーあり'));
  }
}

// テスト実行
runPipelineTest().catch(console.error); 