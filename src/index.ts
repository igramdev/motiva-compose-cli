import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config();

// Schema Registryを初期化
import { initializeSchemas } from './lib/schema-initializer.js';
import { ConceptPlanner } from './agents/concept-planner.js';
import { AssetSynthesizer } from './agents/asset-synthesizer.js';
import { BudgetManager } from './lib/budget.js';
import { ShotPlanSchema, AssetManifestSchema } from './schemas/index.js';
import { AgentOrchestrator } from './lib/agent-orchestrator.js';
import { ConceptPlannerAgent } from './agents/concept-planner-agent.js';
import { AssetSynthesizerAgent } from './agents/asset-synthesizer-agent.js';
import { DirectorAgent } from './agents/director-agent.js';
import { ConfigurationManager } from './lib/config-manager.js';

// アプリケーション起動時にスキーマを初期化
initializeSchemas();

const program = new Command();

program
  .name('motiva-compose')
  .description('TypeScript-based CLI tool for orchestrating multi-agent LLM workflows for video scene generation')
  .version('0.1.0');

// motiva-compose init コマンド
program
  .command('init')
  .description('新しいMotivaプロジェクトを初期化します')
  .argument('<directory>', 'プロジェクトディレクトリ名')
  .option('--preset <preset>', 'プリセット設定', 'remotion')
  .action(async (directory: string, options: { preset: string }) => {
    try {
      await initializeProject(directory, options.preset);
    } catch (error) {
      console.error(chalk.red('❌ プロジェクト初期化に失敗:'), error);
      process.exit(1);
    }
  });

// motiva-compose plan コマンド
program
  .command('plan')
  .description('Concept Plannerを使用してショットプランを生成します')
  .option('--model <model>', 'LLMモデル名', 'gpt-4o-mini')
  .option('--temperature <temp>', '生成温度', '0.7')
  .option('--output <file>', '出力ファイル', 'plan.json')
  .action(async (options: { model: string; temperature: string; output: string }) => {
    try {
      await generatePlan(options);
    } catch (error) {
      console.error(chalk.red('❌ プラン生成に失敗:'), error);
      process.exit(1);
    }
  });

// motiva-compose validate コマンド
program
  .command('validate')
  .description('ショットプランまたはその他のJSONファイルを検証します')
  .argument('<file>', '検証するJSONファイル')
  .option('--schema <schema>', 'スキーマタイプ', 'shot-plan')
  .action(async (file: string, options: { schema: string }) => {
    try {
      await validateFile(file, options.schema);
    } catch (error) {
      console.error(chalk.red('❌ 検証に失敗:'), error);
      process.exit(1);
    }
  });

// motiva-compose synth コマンド
program
  .command('synth')
  .description('Asset Synthesizerを使用してAsset Manifestを生成し、素材を合成します')
  .argument('<shot-plan>', 'ショットプランJSONファイル')
  .option('--model <model>', 'LLMモデル名', 'gpt-4o-mini')
  .option('--temperature <temp>', '生成温度', '0.5')
  .option('--quality <quality>', '素材品質', 'standard')
  .option('--output <file>', 'Asset Manifest出力ファイル', 'manifest.json')
  .option('--assets-dir <dir>', '素材出力ディレクトリ', './assets')
  .option('--generate', '実際に素材を生成する', false)
  .action(async (shotPlanFile: string, options: { 
    model: string; 
    temperature: string; 
    quality: string; 
    output: string; 
    assetsDir: string;
    generate: boolean;
  }) => {
    try {
      await synthesizeAssets(shotPlanFile, options);
    } catch (error) {
      console.error(chalk.red('❌ Asset 生成に失敗:'), error);
      process.exit(1);
    }
  });

// motiva-compose status コマンド
program
  .command('status')
  .description('予算使用状況を表示します')
  .action(async () => {
    try {
      await showStatus();
    } catch (error) {
      console.error(chalk.red('❌ ステータス取得に失敗:'), error);
      process.exit(1);
    }
  });

// motiva-compose orchestrate コマンド
program
  .command('orchestrate')
  .description('複数エージェントをパイプラインで実行します')
  .option('--pipeline <agents>', '実行するエージェント（カンマ区切り）', 'concept-planner,asset-synthesizer')
  .option('--model <model>', 'LLMモデル名', 'gpt-4o-mini')
  .option('--output <file>', '出力ファイル', 'pipeline-result.json')
  .action(async (options: { pipeline: string; model: string; output: string }) => {
    try {
      await executePipeline(options);
    } catch (error) {
      console.error(chalk.red('❌ パイプライン実行に失敗:'), error);
      process.exit(1);
    }
  });

// motiva-compose config コマンド
program
  .command('config')
  .description('設定ファイルを管理します')
  .option('--init', '設定ファイルを初期化', false)
  .option('--show', '現在の設定を表示', false)
  .option('--validate', '設定ファイルを検証', false)
  .action(async (options: { init: boolean; show: boolean; validate: boolean }) => {
    try {
      await manageConfig(options);
    } catch (error) {
      console.error(chalk.red('❌ 設定管理に失敗:'), error);
      process.exit(1);
    }
  });

// === Command Implementations ===

async function initializeProject(directory: string, preset: string): Promise<void> {
  const projectPath = path.resolve(directory);
  
  console.log(chalk.blue(`🚀 Motivaプロジェクトを初期化中: ${directory}`));

  // ディレクトリ構造を作成
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  await fs.mkdir(path.join(projectPath, 'assets'), { recursive: true });
  await fs.mkdir(path.join(projectPath, '.motiva'), { recursive: true });

  // package.json を作成
  const packageJson = {
    name: directory,
    version: '1.0.0',
    description: 'Motiva composition project',
    main: 'src/RemotionRoot.tsx',
    scripts: {
      dev: 'remotion preview src/RemotionRoot.tsx',
      build: 'remotion render src/RemotionRoot.tsx main out/video.mp4'
    },
    dependencies: {
      remotion: '^4.0.0',
      react: '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      typescript: '^5.0.0'
    }
  };

  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // motiva.config.ts を作成
  const configContent = `import { defineConfig } from "motiva-compose";

export default defineConfig({
  models: {
    director: { provider: "openai:gpt-4o-mini", maxTokens: 4096 },
    editor: { provider: "openai:gpt-4o-mini", maxTokens: 2048 },
    critic: { provider: "openai:gpt-3.5-turbo", maxTokens: 1024 }
  },
  paths: {
    assets: "./assets",
    sceneGraph: "./src/graph.json"
  },
  remotion: {
    fps: 30,
    size: { w: 1920, h: 1080 }
  }
});`;

  await fs.writeFile(path.join(projectPath, 'motiva.config.ts'), configContent);

  // 基本的なRemotionファイルを作成
  const remotionRoot = `import { Composition } from "remotion";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="main"
        component={() => <div>Motiva Composition</div>}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};`;

  await fs.writeFile(path.join(projectPath, 'src', 'RemotionRoot.tsx'), remotionRoot);

  console.log(chalk.green('✅ プロジェクト初期化完了'));
  console.log(chalk.cyan(`次のステップ:
  cd ${directory}
  npm install
  echo "テーマ" | motiva-compose plan`));
}

async function generatePlan(options: any): Promise<void> {
  // 標準入力からテーマを読み込み
  const input = await readStdin();
  if (!input.trim()) {
    throw new Error('テーマが指定されていません。標準入力からテーマを入力してください。');
  }

  const budgetManager = new BudgetManager();
  const planner = new ConceptPlanner(budgetManager);

  const config = {
    model: options.model,
    temperature: parseFloat(options.temperature),
    maxTokens: 4096
  };

  const plan = await planner.generatePlan(input.trim(), config);

  // 検証実行
  const validation = await planner.validatePlan(plan);
  
  if (validation.warnings.length > 0) {
    console.log(chalk.yellow('⚠️  警告:'));
    validation.warnings.forEach(warning => console.log(chalk.yellow(`  - ${warning}`)));
  }

  if (!validation.isValid) {
    console.log(chalk.red('❌ エラー:'));
    validation.errors.forEach(error => console.log(chalk.red(`  - ${error}`)));
    throw new Error('生成されたプランに致命的なエラーがあります');
  }

  // ファイルに出力
  await fs.writeFile(options.output, JSON.stringify(plan, null, 2));
  console.log(chalk.green(`✅ プランを ${options.output} に保存しました`));
}

async function validateFile(filePath: string, schemaType: string): Promise<void> {
  const content = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(content);

  console.log(chalk.blue(`📋 ${filePath} を検証中...`));

  switch (schemaType) {
    case 'shot-plan':
      const validatedPlan = ShotPlanSchema.parse(data);
      
      // 追加的な業務ロジック検証
      const budgetManager = new BudgetManager();
      const planner = new ConceptPlanner(budgetManager);
      const validation = await planner.validatePlan(validatedPlan);

      if (validation.warnings.length > 0) {
        console.log(chalk.yellow('⚠️  警告:'));
        validation.warnings.forEach(warning => console.log(chalk.yellow(`  - ${warning}`)));
      }

      if (!validation.isValid) {
        console.log(chalk.red('❌ エラー:'));
        validation.errors.forEach(error => console.log(chalk.red(`  - ${error}`)));
        process.exit(1);
      }

      console.log(chalk.green('✅ 検証成功'));
      break;

    case 'asset-manifest':
      const validatedManifest = AssetManifestSchema.parse(data);
      
      // 追加的な業務ロジック検証
      const budgetManagerAsset = new BudgetManager();
      const synthesizer = new AssetSynthesizer(budgetManagerAsset);
      const manifestValidation = await synthesizer.validateManifest(validatedManifest);

      if (manifestValidation.warnings.length > 0) {
        console.log(chalk.yellow('⚠️  警告:'));
        manifestValidation.warnings.forEach(warning => console.log(chalk.yellow(`  - ${warning}`)));
      }

      if (!manifestValidation.isValid) {
        console.log(chalk.red('❌ エラー:'));
        manifestValidation.errors.forEach(error => console.log(chalk.red(`  - ${error}`)));
        process.exit(1);
      }

      console.log(chalk.green('✅ 検証成功'));
      break;
    
    default:
      throw new Error(`未対応のスキーマタイプ: ${schemaType}`);
  }
}

async function synthesizeAssets(shotPlanFile: string, options: any): Promise<void> {
  // ショットプランを読み込み
  const planContent = await fs.readFile(shotPlanFile, 'utf8');
  const shotPlan = ShotPlanSchema.parse(JSON.parse(planContent));

  console.log(chalk.blue(`📋 ショットプランを読み込み: ${shotPlanFile}`));

  const budgetManager = new BudgetManager();
  const synthesizer = new AssetSynthesizer(budgetManager);

  const config = {
    model: options.model,
    temperature: parseFloat(options.temperature),
    maxTokens: 6144,
    quality: options.quality as 'draft' | 'standard' | 'high',
    outputDir: options.assetsDir
  };

  // Asset Manifest を生成
  console.log(chalk.blue('🎨 Asset Manifest 生成中...'));
  let manifest = await synthesizer.generateManifest(shotPlan, config);

  // 検証実行
  const validation = await synthesizer.validateManifest(manifest);
  
  if (validation.warnings.length > 0) {
    console.log(chalk.yellow('⚠️  警告:'));
    validation.warnings.forEach(warning => console.log(chalk.yellow(`  - ${warning}`)));
  }

  if (!validation.isValid) {
    console.log(chalk.red('❌ エラー:'));
    validation.errors.forEach(error => console.log(chalk.red(`  - ${error}`)));
    throw new Error('生成されたAsset Manifestに致命的なエラーがあります');
  }

  // 素材の実際の生成（オプション）
  if (options.generate) {
    console.log(chalk.blue('🔧 素材生成を開始...'));
    manifest = await synthesizer.synthesizeAssets(manifest, options.assetsDir);
  }

  // Asset Manifest をファイルに出力
  await fs.writeFile(options.output, JSON.stringify(manifest, null, 2));
  console.log(chalk.green(`✅ Asset Manifest を ${options.output} に保存しました`));
  
  if (options.generate) {
    console.log(chalk.green(`📁 素材を ${options.assetsDir} に生成しました`));
  } else {
    console.log(chalk.cyan('💡 実際の素材生成を行うには --generate フラグを使用してください'));
  }
}

async function showStatus(): Promise<void> {
  const budgetManager = new BudgetManager();
  const status = await budgetManager.getUsageStatus();
  console.log(status);
}

async function executePipeline(options: { pipeline: string; model: string; output: string }): Promise<void> {
  // 標準入力からテーマを読み込み
  const input = await readStdin();
  if (!input.trim()) {
    throw new Error('テーマが指定されていません。標準入力からテーマを入力してください。');
  }

  console.log(chalk.blue('🎬 Agent Orchestrator: パイプライン実行中...'));
  console.log(chalk.gray(`📋 パイプライン: ${options.pipeline}`));

  // エージェントリストを解析
  const agentNames = options.pipeline.split(',').map(name => name.trim());
  
  // Orchestratorを初期化
  const orchestrator = new AgentOrchestrator();
  const budgetManager = new BudgetManager();
  const apiKey = process.env.OPENAI_API_KEY;

  // パイプライン状態を管理
  let shotPlan: any = null;
  
  // エージェントを追加
  for (const agentName of agentNames) {
    switch (agentName) {
      case 'concept-planner':
        orchestrator.addStep(new ConceptPlannerAgent(budgetManager, apiKey), (data: any) => {
          shotPlan = data;
          return data;
        });
        break;
      case 'asset-synthesizer':
        orchestrator.addStep(new AssetSynthesizerAgent(budgetManager, apiKey));
        break;
      case 'director':
        orchestrator.addStep(new DirectorAgent());
        break;
      default:
        throw new Error(`未対応のエージェント: ${agentName}`);
    }
  }

  // パイプライン実行
  const result = await orchestrator.execute(input);

  // 結果を保存
  await fs.writeFile(options.output, JSON.stringify(result, null, 2));
  
  console.log(chalk.green('✅ パイプライン実行完了'));
  console.log(chalk.cyan(`📄 結果を ${options.output} に保存しました`));
}

async function manageConfig(options: { init: boolean; show: boolean; validate: boolean }): Promise<void> {
  const configManager = ConfigurationManager.getInstance();

  if (options.init) {
    await configManager.initializeConfig();
    return;
  }

  if (options.show) {
    const config = await configManager.loadConfig();
    console.log(chalk.blue('📋 現在の設定:'));
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (options.validate) {
    try {
      await configManager.loadConfig();
      console.log(chalk.green('✅ 設定ファイルは有効です'));
    } catch (error) {
      console.log(chalk.red('❌ 設定ファイルにエラーがあります:'), error);
      process.exit(1);
    }
    return;
  }

  // デフォルト: 設定を表示
  const config = await configManager.loadConfig();
  console.log(chalk.blue('📋 現在の設定:'));
  console.log(JSON.stringify(config, null, 2));
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks).toString('utf8');
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('予期しないエラー:'), error);
  process.exit(1);
});

// CLI実行
program.parse(); 