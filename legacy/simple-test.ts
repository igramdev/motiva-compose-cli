import { ConceptPlanner } from './src/agents/concept-planner.js';
import { DualBudgetManager } from './src/lib/dual-budget-manager.js';
import chalk from 'chalk';

async function simpleTest() {
  console.log(chalk.blue('🚀 シンプルテスト開始'));
  
  try {
    // 予算管理を初期化
    const budgetManager = new DualBudgetManager();
    await budgetManager.ensureBudgetExists();
    
    // Concept Plannerをテスト
    const conceptPlanner = new ConceptPlanner(budgetManager);
    const theme = "春の桜の下で出会う二人の恋物語";
    
    console.log(chalk.yellow(`📝 テーマ: ${theme}`));
    
    const shotPlan = await conceptPlanner.generatePlan(theme);
    console.log(chalk.green('✅ ショットプラン生成完了'));
    console.log(chalk.gray(`シーン数: ${shotPlan.shots.length}`));
    console.log(chalk.gray(`総尺: ${shotPlan.duration}フレーム`));
    
    // 使用状況を表示
    const status = await budgetManager.getUsageStatus();
    console.log(chalk.cyan('\n📊 使用状況:'));
    console.log(status);
    
  } catch (error) {
    console.error(chalk.red('❌ テストに失敗:'), error);
    process.exit(1);
  }
}

// テスト実行
simpleTest(); 