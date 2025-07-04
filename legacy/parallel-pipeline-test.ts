import { ConceptPlanner } from './src/agents/concept-planner.js';
import { AssetSynthesizer } from './src/agents/asset-synthesizer.js';
import { DirectorAgent } from './src/agents/director-agent.js';
import { EditorAgent } from './src/agents/editor-agent.js';
import { CriticAgent } from './src/agents/critic-agent.js';
import { DualBudgetManager } from './src/lib/dual-budget-manager.js';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ParallelPipelineConfig {
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
    input?: any;
  }>;
  parallelGroups?: Array<{
    name: string;
    description: string;
    maxConcurrency: number;
    timeout: number;
    retryCount: number;
    retryDelay: number;
  }>;
  options?: {
    maxConcurrency?: number;
    timeout?: number;
    useCache?: boolean;
    showProgress?: boolean;
    enableParallel?: boolean;
  };
}

interface PipelineResult {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  parallelGroup?: string;
}

interface AgentRegistry {
  [key: string]: any;
}

async function loadParallelPipelineConfig(pipelineFile: string): Promise<ParallelPipelineConfig> {
  try {
    const configPath = path.resolve(pipelineFile);
    const configContent = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    console.log(chalk.yellow(`⚠️  並列パイプライン設定ファイル ${pipelineFile} が見つかりません。デフォルト設定を使用します。`));
    return {
      name: "parallel-asset-pipeline",
      description: "Asset Synthesizerを並列実行するパイプライン",
      version: "1.0",
      agents: [
        {
          name: "concept-planner",
          type: "concept-planner",
          parallel: false,
          config: {
            model: "gpt-4o-mini",
            temperature: 0.7,
            maxTokens: 4096
          }
        },
        {
          name: "asset-synthesizer-video",
          type: "asset-synthesizer",
          parallel: true,
          parallelGroup: "asset-generation",
          dependencies: ["concept-planner"],
          config: {
            model: "gpt-4o-mini",
            temperature: 0.5,
            maxTokens: 6144,
            quality: "standard"
          },
          input: {
            focus: "video-assets",
            priority: "high"
          }
        },
        {
          name: "asset-synthesizer-audio",
          type: "asset-synthesizer",
          parallel: true,
          parallelGroup: "asset-generation",
          dependencies: ["concept-planner"],
          config: {
            model: "gpt-4o-mini",
            temperature: 0.5,
            maxTokens: 6144,
            quality: "standard"
          },
          input: {
            focus: "audio-assets",
            priority: "medium"
          }
        },
        {
          name: "director",
          type: "director",
          parallel: false,
          dependencies: ["asset-synthesizer-video", "asset-synthesizer-audio"]
        }
      ],
      parallelGroups: [
        {
          name: "asset-generation",
          description: "Asset Synthesizerの並列実行グループ",
          maxConcurrency: 3,
          timeout: 60000,
          retryCount: 2,
          retryDelay: 2000
        }
      ],
      options: {
        maxConcurrency: 5,
        timeout: 120000,
        useCache: true,
        showProgress: true,
        enableParallel: true
      }
    };
  }
}

async function runParallelPipelineTest(pipelineFile: string = 'parallel-pipeline.json') {
  console.log(chalk.blue('🚀 並列JSON DSLパイプラインテスト開始'));
  
  const results: PipelineResult[] = [];
  const startTime = Date.now();
  
  try {
    // パイプライン設定を読み込み
    const pipelineConfig = await loadParallelPipelineConfig(pipelineFile);
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
    
    // 並列グループを特定
    const parallelGroups = new Map<string, any[]>();
    for (const agent of executionOrder) {
      if (agent.parallel && agent.parallelGroup) {
        if (!parallelGroups.has(agent.parallelGroup)) {
          parallelGroups.set(agent.parallelGroup, []);
        }
        parallelGroups.get(agent.parallelGroup)!.push(agent);
      }
    }
    
    console.log(chalk.blue(`🔄 並列グループ: ${Array.from(parallelGroups.keys()).join(', ')}`));
    
    // 各エージェントを順次実行（並列処理対応）
    let currentData: any = { theme };
    
    for (const agentConfig of executionOrder) {
      const stepStart = Date.now();
      console.log(chalk.blue(`\n🎬 Step: ${agentConfig.name} (${agentConfig.type})`));
      
      if (agentConfig.parallel && agentConfig.parallelGroup) {
        console.log(chalk.yellow(`⚡ 並列実行: ${agentConfig.parallelGroup}`));
      }
      
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
          duration: stepDuration,
          parallelGroup: agentConfig.parallelGroup
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
          duration: stepDuration,
          parallelGroup: agentConfig.parallelGroup
        });
        console.log(chalk.red(`❌ ${agentConfig.name} に失敗: ${error}`));
        break; // エラーが発生したら停止
      }
    }
    
    // 結果を表示
    displayParallelResults(results, Date.now() - startTime, parallelGroups);
    
  } catch (error) {
    console.error(chalk.red('❌ 並列パイプラインテストに失敗:'), error);
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
      // 並列実行用の入力データを調整
      const assetInput = config.input?.focus === 'video-assets' 
        ? { ...inputData.shotPlan, focus: 'video' }
        : config.input?.focus === 'audio-assets'
        ? { ...inputData.shotPlan, focus: 'audio' }
        : inputData.shotPlan;
        
      const assetManifest = await agent.generateManifest(assetInput);
      return {
        output: { assetManifest },
        summary: { 
          assetCount: assetManifest.assets.length,
          focus: config.input?.focus || 'all',
          priority: config.input?.priority || 'normal'
        }
      };
      
    case 'director':
      // 並列実行されたアセットを統合
      const allAssets = [];
      for (const key of Object.keys(inputData)) {
        if (key.includes('assetManifest')) {
          allAssets.push(...inputData[key].assets);
        }
      }
      
      const directorInput = {
        sceneId: inputData.shotPlan.sceneId,
        version: "1.0",
        assets: allAssets.map((asset: any) => ({
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
        summary: { 
          timelineCount: directorOutput.composition.timeline.length,
          totalAssets: allAssets.length
        }
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

function displayParallelResults(results: PipelineResult[], totalDuration: number, parallelGroups: Map<string, any[]>) {
  console.log(chalk.blue('\n📊 並列JSON DSLパイプラインテスト結果:'));
  console.log(chalk.gray(`総実行時間: ${totalDuration}ms`));
  
  // 並列グループ別に結果を表示
  const groupResults = new Map<string, PipelineResult[]>();
  
  for (const result of results) {
    if (result.parallelGroup) {
      if (!groupResults.has(result.parallelGroup)) {
        groupResults.set(result.parallelGroup, []);
      }
      groupResults.get(result.parallelGroup)!.push(result);
    }
  }
  
  // 通常のステップを表示
  console.log(chalk.cyan('\n📋 順次実行ステップ:'));
  for (const result of results.filter(r => !r.parallelGroup)) {
    const status = result.success ? chalk.green('✅') : chalk.red('❌');
    const duration = chalk.gray(`(${result.duration}ms)`);
    const data = result.data ? chalk.gray(`📋 ${JSON.stringify(result.data)}`) : '';
    const error = result.error ? chalk.red(`❌ ${result.error}`) : '';
    
    console.log(`  ${status} ${result.step} ${duration}`);
    if (data) console.log(`    ${data}`);
    if (error) console.log(`    ${error}`);
  }
  
  // 並列グループの結果を表示
  for (const [groupName, groupResultList] of groupResults) {
    console.log(chalk.cyan(`\n⚡ 並列実行グループ: ${groupName}`));
    for (const result of groupResultList) {
      const status = result.success ? chalk.green('✅') : chalk.red('❌');
      const duration = chalk.gray(`(${result.duration}ms)`);
      const data = result.data ? chalk.gray(`📋 ${JSON.stringify(result.data)}`) : '';
      const error = result.error ? chalk.red(`❌ ${result.error}`) : '';
      
      console.log(`  ${status} ${result.step} ${duration}`);
      if (data) console.log(`    ${data}`);
      if (error) console.log(`    ${error}`);
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
  
  console.log(chalk.blue(`\n📈 成功率: ${successCount}/${totalCount} (${successRate.toFixed(1)}%)`));
  console.log(chalk.blue(`🔄 並列グループ数: ${parallelGroups.size}`));
  
  if (successRate === 100) {
    console.log(chalk.green('\n🎉 並列JSON DSLパイプラインテスト完了 - 全ステップ成功！'));
  } else {
    console.log(chalk.yellow('\n⚠️  並列JSON DSLパイプラインテスト完了 - 一部エラーあり'));
  }
}

// テスト実行
runParallelPipelineTest().catch(console.error); 