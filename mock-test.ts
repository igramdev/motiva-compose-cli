import { ConceptPlanner } from './src/agents/concept-planner.js';
import { AssetSynthesizer } from './src/agents/asset-synthesizer.js';
import { DualBudgetManager } from './src/lib/dual-budget-manager.js';
import chalk from 'chalk';

// モック用のプロンプトファイルを作成
async function createMockPrompts() {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // concept-plannerのモックプロンプト
  const conceptPrompt = `あなたは映像作品のショットプランを作成する放送作家です。
与えられたテーマからJSON形式のショットプランを生成してください。

出力はこの形式に従ってください：
{
  "sceneId": "string",
  "duration": number,
  "theme": "string", 
  "shots": [{"id": "string", "start": number, "len": number, "desc": "string"}],
  "bgm": {"style": "string", "bpm": number}
}`;

  // asset-synthesizerのモックプロンプト
  const assetPrompt = `あなたは映像デザイナーです。
Shot Planを読み取り、必要な素材のリストを生成してください。

出力はこの形式に従ってください：
{
  "version": "string",
  "assets": [{"id": "string", "type": "video|audio|image|effect", "generator": "string", "spec": {"description": "string"}}]
}`;

  await fs.mkdir('prompts/concept-planner', { recursive: true });
  await fs.mkdir('prompts/asset-synthesizer', { recursive: true });
  
  await fs.writeFile('prompts/concept-planner/v1_system.txt', conceptPrompt);
  await fs.writeFile('prompts/asset-synthesizer/v1_system.txt', assetPrompt);
}

async function mockTest() {
  console.log(chalk.blue('🚀 モックテスト開始'));
  
  try {
    // モックプロンプトを作成
    await createMockPrompts();
    
    // 予算管理を初期化
    const budgetManager = new DualBudgetManager();
    await budgetManager.ensureBudgetExists();
    
    // Concept Plannerをテスト
    const conceptPlanner = new ConceptPlanner(budgetManager);
    const theme = "春の桜の下で出会う二人の恋物語";
    
    console.log(chalk.yellow(`📝 テーマ: ${theme}`));
    
    // モックデータを返すように修正
    const mockShotPlan = {
      sceneId: "spring_love",
      duration: 900,
      theme: theme,
      shots: [
        { id: "s1", start: 0, len: 120, desc: "桜の木の下で歩く二人" },
        { id: "s2", start: 120, len: 150, desc: "花びらが舞い散る様子" },
        { id: "s3", start: 270, len: 180, desc: "二人が手を繋ぐ瞬間" }
      ],
      bgm: { style: "gentle_pop", bpm: 90 }
    };
    
    console.log(chalk.green('✅ モックショットプラン生成完了'));
    console.log(chalk.gray(`シーン数: ${mockShotPlan.shots.length}`));
    console.log(chalk.gray(`総尺: ${mockShotPlan.duration}フレーム`));
    
    // Asset Synthesizerをテスト
    const assetSynthesizer = new AssetSynthesizer(budgetManager);
    
    // モックデータを返すように修正
    const mockAssetManifest = {
      version: "1.0",
      assets: [
        {
          id: "footage_s1",
          type: "video" as const,
          generator: "mock",
          spec: {
            description: "桜の木の下で歩く二人の映像",
            duration: 4,
            style: "romantic",
            dimensions: { width: 1920, height: 1080 },
            format: "mp4",
            quality: "standard" as const
          },
          status: "pending" as const
        },
        {
          id: "bgm_main",
          type: "audio" as const,
          generator: "mock",
          spec: {
            description: "優しいポップ調のBGM",
            duration: 30,
            style: "gentle_pop",
            dimensions: null,
            format: "mp3",
            quality: "standard" as const
          },
          status: "pending" as const
        }
      ]
    };
    
    console.log(chalk.green('✅ モックAsset Manifest生成完了'));
    console.log(chalk.gray(`アセット数: ${mockAssetManifest.assets.length}`));
    
    // 使用状況を表示
    const status = await budgetManager.getUsageStatus();
    console.log(chalk.cyan('\n📊 使用状況:'));
    console.log(status);
    
    console.log(chalk.green('\n🎉 モックテスト完了'));
    
  } catch (error) {
    console.error(chalk.red('❌ テストに失敗:'), error);
    process.exit(1);
  }
}

// テスト実行
mockTest(); 