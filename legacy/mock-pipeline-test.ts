import { ConceptPlanner } from './src/agents/concept-planner.js';
import { AssetSynthesizer } from './src/agents/asset-synthesizer.js';
import { DirectorAgent } from './src/agents/director-agent.js';
import { EditorAgent } from './src/agents/editor-agent.js';
import { CriticAgent } from './src/agents/critic-agent.js';
import { DualBudgetManager } from './src/lib/dual-budget-manager.js';
import chalk from 'chalk';

interface PipelineResult {
  step: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

async function runMockPipelineTest() {
  console.log(chalk.blue('🚀 モックパイプラインテスト開始'));
  
  const results: PipelineResult[] = [];
  const startTime = Date.now();
  
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
    
    // Step 1: Concept Planner (モックデータ)
    console.log(chalk.blue('\n🎬 Step 1: Concept Planner'));
    const step1Start = Date.now();
    try {
      const mockShotPlan = {
        sceneId: "spring_love",
        duration: 900,
        theme: theme,
        shots: [
          { id: "s1", start: 0, len: 120, desc: "桜の木の下で歩く二人" },
          { id: "s2", start: 120, len: 150, desc: "花びらが舞い散る様子" },
          { id: "s3", start: 270, len: 180, desc: "二人が手を繋ぐ瞬間" },
          { id: "s4", start: 450, len: 120, desc: "夕日を背景にした二人" },
          { id: "s5", start: 570, len: 180, desc: "桜の花びらが舞い散る中でのキスシーン" },
          { id: "s6", start: 750, len: 150, desc: "エンディング - 二人が手を繋いで歩く" }
        ],
        bgm: { style: "gentle_pop", bpm: 90 }
      };
      
      const step1Duration = Date.now() - step1Start;
      
      results.push({
        step: 'Concept Planner',
        success: true,
        data: { sceneCount: mockShotPlan.shots.length, duration: mockShotPlan.duration },
        duration: step1Duration
      });
      
      console.log(chalk.green('✅ ショットプラン生成完了'));
      console.log(chalk.gray(`シーン数: ${mockShotPlan.shots.length}, 総尺: ${mockShotPlan.duration}フレーム`));
      
      // Step 2: Asset Synthesizer (モックデータ)
      console.log(chalk.blue('\n🎬 Step 2: Asset Synthesizer'));
      const step2Start = Date.now();
      try {
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
              id: "footage_s2",
              type: "video" as const,
              generator: "mock",
              spec: {
                description: "花びらが舞い散る様子の映像",
                duration: 5,
                style: "dreamy",
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
        
        const step2Duration = Date.now() - step2Start;
        
        results.push({
          step: 'Asset Synthesizer',
          success: true,
          data: { assetCount: mockAssetManifest.assets.length },
          duration: step2Duration
        });
        
        console.log(chalk.green('✅ Asset Manifest生成完了'));
        console.log(chalk.gray(`アセット数: ${mockAssetManifest.assets.length}`));
        
        // Step 3: Director Agent (モックデータ)
        console.log(chalk.blue('\n🎬 Step 3: Director Agent'));
        const step3Start = Date.now();
        try {
          const mockDirectorOutput = {
            sceneId: "spring_love",
            version: "1.0",
            composition: {
              title: "春の恋物語",
              description: "桜の下で出会う二人の美しい恋物語",
              duration: 30,
              fps: 30,
              resolution: { width: 1920, height: 1080 },
              timeline: [
                { id: "t1", start: 0, end: 4, assetId: "footage_s1", assetType: "video" as const, transform: null, effects: null },
                { id: "t2", start: 4, end: 9, assetId: "footage_s2", assetType: "video" as const, transform: null, effects: null },
                { id: "t3", start: 0, end: 30, assetId: "bgm_main", assetType: "audio" as const, transform: null, effects: null }
              ],
              audio: {
                bgm: { assetId: "bgm_main", volume: 0.8, fadeIn: 2, fadeOut: 3 },
                sfx: null
              },
              transitions: [
                { id: "tr1", type: "fade", duration: 1, fromShot: "t1", toShot: "t2", params: null }
              ]
            },
            metadata: {
              createdAt: new Date().toISOString(),
              totalCost: 0.05,
              estimatedRenderTime: 120,
              quality: "standard" as const,
              tags: ["romance", "spring", "sakura"]
            }
          };
          
          const step3Duration = Date.now() - step3Start;
          
          results.push({
            step: 'Director Agent',
            success: true,
            data: { timelineCount: mockDirectorOutput.composition.timeline.length },
            duration: step3Duration
          });
          
          console.log(chalk.green('✅ 動画構成決定完了'));
          console.log(chalk.gray(`タイムライン: ${mockDirectorOutput.composition.timeline.length}ショット`));
          
          // Step 4: Editor Agent (モックデータ)
          console.log(chalk.blue('\n🎬 Step 4: Editor Agent'));
          const step4Start = Date.now();
          try {
            const mockEditorPatch = [
              { op: "add", path: "/layers/0/effect", value: "fade-in" },
              { op: "replace", path: "/layers/1/start", value: 4.5 }
            ];
            
            const step4Duration = Date.now() - step4Start;
            
            results.push({
              step: 'Editor Agent',
              success: true,
              data: { patchCount: mockEditorPatch.length },
              duration: step4Duration
            });
            
            console.log(chalk.green('✅ 編集提案生成完了'));
            console.log(chalk.gray(`編集提案数: ${mockEditorPatch.length}`));
            
            // Step 5: Critic Agent (モックデータ)
            console.log(chalk.blue('\n🎬 Step 5: Critic Agent'));
            const step5Start = Date.now();
            try {
              const mockCriticReport = {
                overallScore: 85,
                qualityAssessment: {
                  visualQuality: 88,
                  narrativeFlow: 82,
                  technicalExecution: 85,
                  emotionalImpact: 90
                },
                issues: [
                  {
                    severity: "low" as const,
                    category: "technical" as const,
                    description: "トランジションのタイミングを微調整することを推奨",
                    suggestion: "fade-inの時間を0.5秒短縮"
                  }
                ],
                strengths: [
                  "美しい桜の映像",
                  "感情的なストーリー展開",
                  "適切な音楽選択"
                ],
                recommendations: [
                  "カラーマッチングの調整",
                  "音響効果の追加"
                ],
                metadata: {
                  reviewDate: new Date().toISOString(),
                  reviewer: "AI Critic",
                  version: "1.0"
                }
              };
              
              const step5Duration = Date.now() - step5Start;
              
              results.push({
                step: 'Critic Agent',
                success: true,
                data: { score: mockCriticReport.overallScore },
                duration: step5Duration
              });
              
              console.log(chalk.green('✅ 品質評価完了'));
              console.log(chalk.yellow(`📊 総合スコア: ${mockCriticReport.overallScore}/100`));
              
            } catch (error) {
              const step5Duration = Date.now() - step5Start;
              results.push({
                step: 'Critic Agent',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: step5Duration
              });
              console.log(chalk.red('❌ 品質評価に失敗'));
            }
            
          } catch (error) {
            const step4Duration = Date.now() - step4Start;
            results.push({
              step: 'Editor Agent',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              duration: step4Duration
            });
            console.log(chalk.red('❌ 編集提案生成に失敗'));
          }
          
        } catch (error) {
          const step3Duration = Date.now() - step3Start;
          results.push({
            step: 'Director Agent',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: step3Duration
          });
          console.log(chalk.red('❌ 動画構成決定に失敗'));
        }
        
      } catch (error) {
        const step2Duration = Date.now() - step2Start;
        results.push({
          step: 'Asset Synthesizer',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: step2Duration
        });
        console.log(chalk.red('❌ Asset Manifest生成に失敗'));
      }
      
    } catch (error) {
      const step1Duration = Date.now() - step1Start;
      results.push({
        step: 'Concept Planner',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: step1Duration
      });
      console.log(chalk.red('❌ ショットプラン生成に失敗'));
    }
    
    // 結果サマリー
    const totalDuration = Date.now() - startTime;
    console.log(chalk.cyan('\n📊 モックパイプラインテスト結果:'));
    console.log(chalk.gray(`総実行時間: ${totalDuration}ms`));
    
    let successCount = 0;
    results.forEach(result => {
      const status = result.success ? chalk.green('✅') : chalk.red('❌');
      const duration = `${result.duration}ms`;
      console.log(`  ${status} ${result.step} (${duration})`);
      if (result.success && result.data) {
        console.log(chalk.gray(`    📋 ${JSON.stringify(result.data)}`));
      }
      if (!result.success && result.error) {
        console.log(chalk.red(`    💥 ${result.error}`));
      }
      if (result.success) successCount++;
    });
    
    console.log(chalk.cyan(`\n📈 成功率: ${successCount}/${results.length} (${Math.round(successCount/results.length*100)}%)`));
    
    // 使用状況を表示
    const status = await budgetManager.getUsageStatus();
    console.log(chalk.cyan('\n📊 使用状況:'));
    console.log(status);
    
    if (successCount === results.length) {
      console.log(chalk.green('\n🎉 モックパイプラインテスト完了 - 全ステップ成功！'));
    } else {
      console.log(chalk.yellow('\n⚠️ モックパイプラインテスト完了 - 一部のステップでエラーが発生しました'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ モックパイプラインテストに失敗:'), error);
    process.exit(1);
  }
}

// テスト実行
runMockPipelineTest(); 