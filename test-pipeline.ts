import { ConceptPlanner } from './src/agents/concept-planner.js';
import { AssetSynthesizer } from './src/agents/asset-synthesizer.js';
import { DirectorAgent } from './src/agents/director-agent.js';
import { EditorAgent } from './src/agents/editor-agent.js';
import { CriticAgent } from './src/agents/critic-agent.js';
import { DualBudgetManager } from './src/lib/dual-budget-manager.js';
import { EventDrivenOrchestrator } from './src/lib/event-driven-orchestrator.js';
import chalk from 'chalk';

async function testPipeline() {
  console.log(chalk.blue('🚀 パイプラインテスト開始'));
  
  try {
    // 予算管理を初期化
    const budgetManager = new DualBudgetManager();
    await budgetManager.ensureBudgetExists();
    
    // エージェントを初期化
    const conceptPlanner = new ConceptPlanner(budgetManager);
    const assetSynthesizer = new AssetSynthesizer(budgetManager);
    const directorAgent = new DirectorAgent();
    const editorAgent = new EditorAgent(budgetManager);
    const criticAgent = new CriticAgent(budgetManager);
    
    // テスト用のテーマ
    const theme = "春の桜の下で出会う二人の恋物語";
    
    console.log(chalk.yellow(`📝 テーマ: ${theme}`));
    
    // 1. Concept Planner
    console.log(chalk.blue('\n🎬 Step 1: Concept Planner'));
    const shotPlan = await conceptPlanner.generatePlan(theme);
    console.log(chalk.green('✅ ショットプラン生成完了'));
    console.log(chalk.gray(`シーン数: ${shotPlan.shots.length}`));
    
    // 2. Asset Synthesizer
    console.log(chalk.blue('\n🎬 Step 2: Asset Synthesizer'));
    const assetManifest = await assetSynthesizer.generateManifest(shotPlan);
    console.log(chalk.green('✅ Asset Manifest生成完了'));
    console.log(chalk.gray(`アセット数: ${assetManifest.assets.length}`));
    
    // 3. Director Agent
    console.log(chalk.blue('\n🎬 Step 3: Director Agent'));
    const directorInput = {
      sceneId: shotPlan.sceneId,
      version: "1.0",
      assets: assetManifest.assets.map(asset => ({
        ...asset,
        uri: asset.uri || null,
        metadata: asset.metadata || null
      })),
      generators: null,
      totalEstimatedCost: null
    };
    const directorOutput = await directorAgent.run(directorInput);
    console.log(chalk.green('✅ 動画構成決定完了'));
    console.log(chalk.gray(`タイムライン: ${directorOutput.composition.timeline.length}ショット`));
    
    // 4. Editor Agent (SceneGraphが必要なので、簡易版)
    console.log(chalk.blue('\n🎬 Step 4: Editor Agent'));
    const mockSceneGraph = {
      "@context": "https://schema.motiva.dev/scene-graph/v2",
      "@id": "test-scene",
      "type": "Comp",
      "fps": 30,
      "duration": 900,
      "size": { "w": 1920, "h": 1080 },
      "layers": [
        { "ref": "footage_1", "start": 0 },
        { "ref": "footage_2", "start": 120 }
      ]
    };
    const editorPatch = await editorAgent.run(mockSceneGraph);
    console.log(chalk.green('✅ 編集提案生成完了'));
    console.log(chalk.gray(`編集提案数: ${editorPatch.length}`));
    
    // 5. Critic Agent
    console.log(chalk.blue('\n🎬 Step 5: Critic Agent'));
    const criticReport = await criticAgent.run(mockSceneGraph);
    console.log(chalk.green('✅ 品質評価完了'));
    console.log(chalk.yellow(`📊 総合スコア: ${criticReport.overallScore}/100`));
    
    console.log(chalk.green('\n🎉 パイプラインテスト完了'));
    
    // 使用状況を表示
    const status = await budgetManager.getUsageStatus();
    console.log(chalk.cyan('\n📊 使用状況:'));
    console.log(status);
    
  } catch (error) {
    console.error(chalk.red('❌ パイプラインテストに失敗:'), error);
    process.exit(1);
  }
}

// テスト実行
testPipeline(); 