import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { z } from 'zod';

// 二軸予算スキーマ
const DualBudgetSchema = z.object({
  tiers: z.record(z.object({
    monthly: z.number(),
    tokens: z.number(),
    wallTimeSec: z.number() // 壁時計秒制限を追加
  })),
  current: z.string(),
  usage: z.object({
    tokens: z.number(),
    costUSD: z.number(),
    wallTimeSec: z.number(), // 実際の壁時計秒
    startTime: z.number().optional() // セッション開始時刻
  }),
  alerts: z.object({
    warningAt: z.number(),
    stopAt: z.number()
  }),
  limits: z.object({
    maxConcurrency: z.number().default(3), // 並列処理制限
    maxWallTimePerRequest: z.number().default(300) // リクエストあたり最大秒数
  })
});

export type DualBudget = z.infer<typeof DualBudgetSchema>;

export interface CostEstimate {
  tokens: number;
  estimatedCost: number;
  estimatedWallTime: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  usageRates: {
    tokens: number;
    cost: number;
    wallTime: number;
    maxRate: number;
  };
}

/**
 * 二軸コスト管理システム
 * トークン数と壁時計秒の両方を管理し、並列処理時の課金爆発を防止
 */
export class DualBudgetManager {
  private budgetPath: string;
  private budget: DualBudget | null = null;
  private sessionStartTime: number = Date.now();
  private activeRequests: Set<string> = new Set();

  constructor(workspacePath: string = process.cwd()) {
    this.budgetPath = path.join(workspacePath, '.motiva', 'dual-budget.json');
  }

  async ensureBudgetExists(): Promise<void> {
    if (await this.pathExists(this.budgetPath)) {
      await this.loadBudget();
      return;
    }

    console.log(chalk.blue('🔧 初回セットアップ: 二軸予算設定を行います'));
    await this.initializeBudget();
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async writeJson(filePath: string, data: any): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  private async readJson(filePath: string): Promise<any> {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  private async initializeBudget(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'tier',
        message: '月間予算層を選択してください:',
        choices: [
          { name: 'Minimal ($3/月, 100K tokens, 2時間)', value: 'minimal' },
          { name: 'Standard ($10/月, 350K tokens, 8時間)', value: 'standard' },
          { name: 'Pro ($30/月, 1M tokens, 24時間)', value: 'pro' }
        ],
        default: 'minimal'
      },
      {
        type: 'input',
        name: 'maxConcurrency',
        message: '最大同時実行数:',
        default: '3',
        validate: (value: string) => {
          const num = parseInt(value);
          return num > 0 && num <= 10 ? true : '1-10の間で入力してください';
        },
        filter: (value: string) => parseInt(value)
      }
    ]);

    const defaultBudget: DualBudget = {
      tiers: {
        minimal: { monthly: 3, tokens: 100000, wallTimeSec: 7200 }, // 2時間
        standard: { monthly: 10, tokens: 350000, wallTimeSec: 28800 }, // 8時間
        pro: { monthly: 30, tokens: 1000000, wallTimeSec: 86400 } // 24時間
      },
      current: answers.tier,
      usage: { 
        tokens: 0, 
        costUSD: 0.0, 
        wallTimeSec: 0,
        startTime: this.sessionStartTime
      },
      alerts: { warningAt: 0.8, stopAt: 0.95 },
      limits: { 
        maxConcurrency: answers.maxConcurrency,
        maxWallTimePerRequest: 300 // 5分
      }
    };

    await this.ensureDir(path.dirname(this.budgetPath));
    await this.writeJson(this.budgetPath, defaultBudget);
    this.budget = defaultBudget;

    console.log(chalk.green(`✅ 二軸予算設定完了: ${answers.tier} tier (最大並列数: ${answers.maxConcurrency})`));
  }

  private async loadBudget(): Promise<void> {
    try {
      const budgetData = await this.readJson(this.budgetPath);
      this.budget = DualBudgetSchema.parse(budgetData);
      
      // セッション開始時刻を更新
      if (!this.budget.usage.startTime) {
        this.budget.usage.startTime = this.sessionStartTime;
        await this.saveBudget();
      }
    } catch (error) {
      throw new Error(`予算ファイルの読み込みに失敗: ${error}`);
    }
  }

  private async saveBudget(): Promise<void> {
    if (this.budget) {
      await this.writeJson(this.budgetPath, this.budget);
    }
  }

  /**
   * 二軸予算制限をチェック
   */
  async checkBudgetLimit(estimate: CostEstimate, requestId?: string): Promise<BudgetCheckResult> {
    await this.ensureBudgetExists();
    if (!this.budget) {
      return { 
        allowed: false, 
        reason: '予算情報が利用できません',
        usageRates: { tokens: 0, cost: 0, wallTime: 0, maxRate: 0 }
      };
    }

    const currentTier = this.budget.tiers[this.budget.current];
    if (!currentTier) {
      throw new Error(`不明な予算層: ${this.budget.current}`);
    }

    // 現在の使用量を計算
    const currentWallTime = this.calculateCurrentWallTime();
    const newTokenUsage = this.budget.usage.tokens + estimate.tokens;
    const newCostUsage = this.budget.usage.costUSD + estimate.estimatedCost;
    const newWallTimeUsage = currentWallTime + estimate.estimatedWallTime;

    // 使用率を計算
    const tokenUsageRate = newTokenUsage / currentTier.tokens;
    const costUsageRate = newCostUsage / currentTier.monthly;
    const wallTimeUsageRate = newWallTimeUsage / currentTier.wallTimeSec;
    const maxUsageRate = Math.max(tokenUsageRate, costUsageRate, wallTimeUsageRate);

    // 並列処理制限チェック
    if (this.activeRequests.size >= this.budget.limits.maxConcurrency) {
      return {
        allowed: false,
        reason: `並列処理制限に達しました (${this.activeRequests.size}/${this.budget.limits.maxConcurrency})`,
        usageRates: { tokens: tokenUsageRate, cost: costUsageRate, wallTime: wallTimeUsageRate, maxRate: maxUsageRate }
      };
    }

    // リクエストあたりの壁時計制限チェック
    if (estimate.estimatedWallTime > this.budget.limits.maxWallTimePerRequest) {
      return {
        allowed: false,
        reason: `リクエストあたりの壁時計制限を超過: ${estimate.estimatedWallTime}s > ${this.budget.limits.maxWallTimePerRequest}s`,
        usageRates: { tokens: tokenUsageRate, cost: costUsageRate, wallTime: wallTimeUsageRate, maxRate: maxUsageRate }
      };
    }

    // 使用制限チェック
    if (maxUsageRate >= this.budget.alerts.stopAt) {
      return {
        allowed: false,
        reason: `予算制限に達しました (${(maxUsageRate * 100).toFixed(1)}%)`,
        usageRates: { tokens: tokenUsageRate, cost: costUsageRate, wallTime: wallTimeUsageRate, maxRate: maxUsageRate }
      };
    }

    // 警告チェック
    if (maxUsageRate >= this.budget.alerts.warningAt) {
      console.log(chalk.yellow('⚠️  予算制限に近づいています'));
      console.log(chalk.yellow(`現在の使用率: ${(maxUsageRate * 100).toFixed(1)}%`));
    }

    // リクエストを記録
    if (requestId) {
      this.activeRequests.add(requestId);
    }

    return {
      allowed: true,
      usageRates: { tokens: tokenUsageRate, cost: costUsageRate, wallTime: wallTimeUsageRate, maxRate: maxUsageRate }
    };
  }

  /**
   * 使用量を追加
   */
  async addUsage(usage: { tokens: number; cost: number; wallTime: number }, requestId?: string): Promise<void> {
    if (!this.budget) return;

    this.budget.usage.tokens += usage.tokens;
    this.budget.usage.costUSD += usage.cost;
    this.budget.usage.wallTimeSec += usage.wallTime;

    // リクエストを完了として記録
    if (requestId) {
      this.activeRequests.delete(requestId);
    }

    await this.saveBudget();
  }

  /**
   * 現在の壁時計時間を計算
   */
  private calculateCurrentWallTime(): number {
    if (!this.budget?.usage.startTime) {
      return this.budget?.usage.wallTimeSec || 0;
    }
    
    const sessionTime = (Date.now() - this.budget.usage.startTime) / 1000;
    return this.budget.usage.wallTimeSec + sessionTime;
  }

  /**
   * 使用状況を取得
   */
  async getUsageStatus(): Promise<string> {
    await this.ensureBudgetExists();
    if (!this.budget) return '予算情報が利用できません';

    const currentTier = this.budget.tiers[this.budget.current];
    if (!currentTier) {
      throw new Error(`不明な予算層: ${this.budget.current}`);
    }

    const currentWallTime = this.calculateCurrentWallTime();
    const tokenUsageRate = this.budget.usage.tokens / currentTier.tokens;
    const costUsageRate = this.budget.usage.costUSD / currentTier.monthly;
    const wallTimeUsageRate = currentWallTime / currentTier.wallTimeSec;

    return `
${chalk.blue('📊 二軸予算使用状況')}
Tier: ${chalk.cyan(this.budget.current)}
Tokens: ${chalk.yellow(this.budget.usage.tokens.toLocaleString())} / ${chalk.green(currentTier.tokens.toLocaleString())} (${(tokenUsageRate * 100).toFixed(1)}%)
Cost: ${chalk.yellow(`$${this.budget.usage.costUSD.toFixed(3)}`)} / ${chalk.green(`$${currentTier.monthly}`)} (${(costUsageRate * 100).toFixed(1)}%)
Wall Time: ${chalk.yellow(`${(currentWallTime / 60).toFixed(1)}分`)} / ${chalk.green(`${(currentTier.wallTimeSec / 60).toFixed(1)}分`)} (${(wallTimeUsageRate * 100).toFixed(1)}%)
Active Requests: ${chalk.cyan(this.activeRequests.size)} / ${chalk.green(this.budget.limits.maxConcurrency)}
    `.trim();
  }

  /**
   * 予算をリセット
   */
  async resetBudget(): Promise<void> {
    if (!this.budget) return;

    this.budget.usage.tokens = 0;
    this.budget.usage.costUSD = 0.0;
    this.budget.usage.wallTimeSec = 0;
    this.budget.usage.startTime = Date.now();
    this.activeRequests.clear();

    await this.saveBudget();
    console.log(chalk.green('✅ 予算使用量をリセットしました'));
  }

  /**
   * 予算層を変更
   */
  async changeTier(newTier: string): Promise<void> {
    if (!this.budget) return;

    if (!this.budget.tiers[newTier]) {
      throw new Error(`不明な予算層: ${newTier}`);
    }

    this.budget.current = newTier;
    await this.saveBudget();
    console.log(chalk.green(`✅ 予算層を ${newTier} に変更しました`));
  }

  getBudget(): DualBudget | null {
    return this.budget;
  }

  getActiveRequestsCount(): number {
    return this.activeRequests.size;
  }
} 