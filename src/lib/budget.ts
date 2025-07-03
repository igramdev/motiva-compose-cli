import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Budget, BudgetSchema } from '../schemas/index.js';

export class BudgetManager {
  private budgetPath: string;
  private budget: Budget | null = null;

  constructor(workspacePath: string = process.cwd()) {
    this.budgetPath = path.join(workspacePath, '.motiva', 'budget.json');
  }

  async ensureBudgetExists(): Promise<void> {
    if (await this.pathExists(this.budgetPath)) {
      await this.loadBudget();
      return;
    }

    console.log(chalk.blue('🔧 初回セットアップ: 予算設定を行います'));
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
          { name: 'Minimal ($3/月, 100K tokens)', value: 'minimal' },
          { name: 'Standard ($10/月, 350K tokens)', value: 'standard' },
          { name: 'Pro ($30/月, 1M tokens)', value: 'pro' }
        ],
        default: 'minimal'
      }
    ]);

    const defaultBudget: Budget = {
      tiers: {
        minimal: { monthly: 3, tokens: 100000 },
        standard: { monthly: 10, tokens: 350000 },
        pro: { monthly: 30, tokens: 1000000 }
      },
      current: answers.tier,
      usage: { tokens: 0, costUSD: 0.0 },
      alerts: { warningAt: 0.8, stopAt: 0.95 }
    };

    await this.ensureDir(path.dirname(this.budgetPath));
    await this.writeJson(this.budgetPath, defaultBudget);
    this.budget = defaultBudget;

    console.log(chalk.green(`✅ 予算設定完了: ${answers.tier} tier`));
  }

  private async loadBudget(): Promise<void> {
    try {
      const budgetData = await this.readJson(this.budgetPath);
      this.budget = BudgetSchema.parse(budgetData);
    } catch (error) {
      throw new Error(`予算ファイルの読み込みに失敗: ${error}`);
    }
  }

  async checkBudgetLimit(tokensToUse: number, costToAdd: number): Promise<boolean> {
    await this.ensureBudgetExists();
    if (!this.budget) return false;

    const currentTier = this.budget.tiers[this.budget.current];
    if (!currentTier) {
      throw new Error(`不明な予算層: ${this.budget.current}`);
    }

    const newTokenUsage = this.budget.usage.tokens + tokensToUse;
    const newCostUsage = this.budget.usage.costUSD + costToAdd;

    const tokenUsageRate = newTokenUsage / currentTier.tokens;
    const costUsageRate = newCostUsage / currentTier.monthly;
    const maxUsageRate = Math.max(tokenUsageRate, costUsageRate);

    // 使用制限チェック
    if (maxUsageRate >= this.budget.alerts.stopAt) {
      console.log(chalk.red('🚫 予算制限に達しました。API呼び出しを中断します。'));
      console.log(chalk.yellow(`現在の使用率: ${(maxUsageRate * 100).toFixed(1)}%`));
      return false;
    }

    // 警告チェック
    if (maxUsageRate >= this.budget.alerts.warningAt) {
      console.log(chalk.yellow('⚠️  予算制限に近づいています。'));
      console.log(chalk.yellow(`現在の使用率: ${(maxUsageRate * 100).toFixed(1)}%`));
    }

    return true;
  }

  async addUsage(tokens: number, cost: number): Promise<void> {
    if (!this.budget) return;

    this.budget.usage.tokens += tokens;
    this.budget.usage.costUSD += cost;

    await this.writeJson(this.budgetPath, this.budget);
  }

  async getUsageStatus(): Promise<string> {
    await this.ensureBudgetExists();
    if (!this.budget) return '予算情報が利用できません';

    const currentTier = this.budget.tiers[this.budget.current];
    if (!currentTier) {
      throw new Error(`不明な予算層: ${this.budget.current}`);
    }

    const tokenUsageRate = this.budget.usage.tokens / currentTier.tokens;
    const costUsageRate = this.budget.usage.costUSD / currentTier.monthly;

    return `
${chalk.blue('📊 予算使用状況')}
Tier: ${chalk.cyan(this.budget.current)}
Tokens: ${chalk.yellow(this.budget.usage.tokens.toLocaleString())} / ${chalk.green(currentTier.tokens.toLocaleString())} (${(tokenUsageRate * 100).toFixed(1)}%)
Cost: ${chalk.yellow(`$${this.budget.usage.costUSD.toFixed(3)}`)} / ${chalk.green(`$${currentTier.monthly}`)} (${(costUsageRate * 100).toFixed(1)}%)
    `.trim();
  }

  getBudget(): Budget | null {
    return this.budget;
  }
} 