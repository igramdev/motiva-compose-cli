import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config();

// 基本的なインポート
import { EventBus } from './lib/event-bus.js';
import { EventDrivenOrchestrator } from './lib/event-driven-orchestrator.js';
import { DualBudgetManager } from './lib/dual-budget-manager.js';
import { CacheManager } from './lib/cache-manager.js';
import { NotificationManager } from './lib/notification-manager.js';
import { ReportGenerator } from './lib/report-generator.js';
import { ConfigurationManager } from './lib/config-manager.js';

const program = new Command();

program
  .name('motiva-compose')
  .description('TypeScript-based Event-Driven Multi-Agent LLM Pipeline CLI')
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

// motiva-compose run コマンド（新しいイベント駆動システム）
program
  .command('run')
  .description('イベント駆動型パイプラインを実行します')
  .argument('[theme]', 'テーマ（省略時は標準入力から読み込み）')
  .option('--config <file>', '設定ファイル', 'motiva.config.ts')
  .option('--pipeline <file>', 'パイプライン定義ファイル', 'pipeline.json')
  .option('--output <file>', '出力ファイル', 'result.json')
  .option('--show-events', 'イベントの詳細を表示', false)
  .option('--show-config', '設定を表示', false)
  .action(async (theme: string | undefined, options: {
    config: string;
    pipeline: string;
    output: string;
    showEvents: boolean;
    showConfig: boolean;
  }) => {
    try {
      await executeEventDrivenPipeline(theme, options);
    } catch (error) {
      console.error(chalk.red('❌ パイプライン実行に失敗:'), error);
      process.exit(1);
    }
  });

// motiva-compose status コマンド
program
  .command('status')
  .description('システムの状態を表示します')
  .option('--events', 'イベント履歴を表示', false)
  .option('--budget', '予算使用状況を表示', false)
  .option('--cache', 'キャッシュ状態を表示', false)
  .action(async (options: { events: boolean; budget: boolean; cache: boolean }) => {
    try {
      await showSystemStatus(options);
    } catch (error) {
      console.error(chalk.red('❌ ステータス取得に失敗:'), error);
      process.exit(1);
    }
  });

// motiva-compose config コマンド
program
  .command('config')
  .description('設定を管理します')
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

// === 実装関数 ===

async function initializeProject(directory: string, preset: string): Promise<void> {
  console.log(chalk.blue(`🎬 新しいプロジェクトを初期化: ${directory}`));
  
  // プロジェクトディレクトリを作成
  await fs.mkdir(directory, { recursive: true });
  
  // 設定ファイルをコピー
  const configManager = ConfigurationManager.getInstance();
  await configManager.initializeConfig(directory, preset);
  
  console.log(chalk.green('✅ プロジェクト初期化完了'));
}

async function executeEventDrivenPipeline(
  theme: string | undefined,
  options: {
    config: string;
    pipeline: string;
    output: string;
    showEvents: boolean;
    showConfig: boolean;
  }
): Promise<void> {
  // テーマを取得
  let inputTheme = theme;
  if (!inputTheme) {
    console.log(chalk.yellow('テーマを入力してください（Enter で終了）:'));
    inputTheme = await readStdin();
  }

  if (!inputTheme.trim()) {
    console.error(chalk.red('❌ テーマが必要です'));
    process.exit(1);
  }

  // Orchestratorを初期化
  const orchestrator = new EventDrivenOrchestrator();
  const eventBus = EventBus.getInstance();

  // イベントログ用のサブスクリプション
  if (options.showEvents) {
    eventBus.subscribeToPipeline(async (event) => {
      console.log(chalk.gray(`📡 イベント: ${event.type} (${event.id})`));
      if (event.metadata) {
        console.log(chalk.gray(`   ${JSON.stringify(event.metadata)}`));
      }
    });
  }

  // 設定を表示
  if (options.showConfig) {
    const config = await ConfigurationManager.getInstance().loadConfig();
    console.log(chalk.blue('📋 現在の設定:'));
    console.log(config);
    console.log(chalk.gray('─'.repeat(50)));
  }

  // パイプラインを実行
  console.log(chalk.blue(`\n🎯 テーマ: ${inputTheme}`));
  const startTime = Date.now();

  try {
    const result = await orchestrator.executePipeline({
      theme: inputTheme,
      configFile: options.config,
      pipelineFile: options.pipeline
    });

    const duration = Date.now() - startTime;

    // 結果を保存
    await fs.writeFile(options.output, JSON.stringify({
      success: true,
      theme: inputTheme,
      result: result.data,
      events: result.events,
      metadata: {
        duration,
        tokenUsage: result.tokenUsage,
        costUSD: result.costUSD,
        timestamp: new Date().toISOString()
      }
    }, null, 2));

    console.log(chalk.green('\n🎉 パイプライン実行完了'));
    console.log(chalk.cyan(`⏱️  実行時間: ${duration}ms`));
    console.log(chalk.cyan(`💰 総コスト: $${result.costUSD.toFixed(6)}`));
    console.log(chalk.cyan(`🪙 トークン使用量: ${result.tokenUsage.toLocaleString()}`));
    console.log(chalk.green(`💾 結果を保存しました: ${options.output}`));

  } catch (error) {
    console.error(chalk.red('\n❌ パイプライン実行に失敗'));
    console.error(chalk.red(`エラー: ${error}`));
    process.exit(1);
  }
}

async function showSystemStatus(options: { events: boolean; budget: boolean; cache: boolean }): Promise<void> {
  if (options.events) {
    const eventBus = EventBus.getInstance();
    const stats = eventBus.getStats();
    console.log(chalk.blue('📊 イベント統計:'));
    console.log(stats);
  }

  if (options.budget) {
    const budgetManager = new DualBudgetManager();
    const status = await budgetManager.getStatus();
    console.log(chalk.blue('💰 予算状況:'));
    console.log(status);
  }

  if (options.cache) {
    const cacheManager = new CacheManager();
    const stats = await cacheManager.getStats();
    console.log(chalk.blue('📦 キャッシュ状況:'));
    console.log(stats);
  }
}

async function manageConfig(options: { init: boolean; show: boolean; validate: boolean }): Promise<void> {
  const configManager = ConfigurationManager.getInstance();

  if (options.init) {
    await configManager.initializeConfig();
    console.log(chalk.green('✅ 設定ファイルを初期化しました'));
    return;
  }

  if (options.show) {
    const config = await configManager.loadConfig();
    console.log(chalk.blue('📋 現在の設定:'));
    console.log(config);
    return;
  }

  if (options.validate) {
    try {
      await configManager.validateConfig();
      console.log(chalk.green('✅ 設定ファイルは有効です'));
    } catch (error) {
      console.error(chalk.red('❌ 設定ファイルにエラーがあります:'), error);
      process.exit(1);
    }
    return;
  }
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