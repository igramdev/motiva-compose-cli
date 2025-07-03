import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

// レポートデータスキーマ
const ReportDataSchema = z.object({
  executionId: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  duration: z.number(),
  status: z.enum(['success', 'partial_success', 'failed']),
  agents: z.array(z.object({
    name: z.string(),
    status: z.enum(['success', 'failed', 'skipped']),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    duration: z.number(),
    tokensUsed: z.number().optional(),
    costUSD: z.number().optional(),
    error: z.string().optional(),
    retryCount: z.number().default(0)
  })),
  budget: z.object({
    totalTokens: z.number(),
    totalCost: z.number(),
    remainingBudget: z.number(),
    budgetLimit: z.number()
  }),
  results: z.record(z.string(), z.any()),
  metadata: z.object({
    pipelineName: z.string().optional(),
    theme: z.string().optional(),
    model: z.string().optional(),
    version: z.string()
  })
});

export type ReportData = z.infer<typeof ReportDataSchema>;

/**
 * レポート生成システム
 */
export class ReportGenerator {
  private static instance: ReportGenerator;
  private reportsDir: string;

  private constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports');
  }

  static getInstance(): ReportGenerator {
    if (!ReportGenerator.instance) {
      ReportGenerator.instance = new ReportGenerator();
    }
    return ReportGenerator.instance;
  }

  /**
   * レポートディレクトリを初期化
   */
  private async ensureReportsDir(): Promise<void> {
    try {
      await fs.access(this.reportsDir);
    } catch {
      await fs.mkdir(this.reportsDir, { recursive: true });
    }
  }

  /**
   * 実行レポートを生成
   */
  async generateExecutionReport(data: ReportData): Promise<string> {
    await this.ensureReportsDir();

    const reportPath = path.join(this.reportsDir, `execution-${data.executionId}-${new Date().toISOString().split('T')[0]}.json`);
    
    // JSONレポートを保存
    await fs.writeFile(reportPath, JSON.stringify(data, null, 2));

    // 人間が読みやすいレポートも生成
    const humanReadablePath = reportPath.replace('.json', '.md');
    const markdownReport = this.generateMarkdownReport(data);
    await fs.writeFile(humanReadablePath, markdownReport);

    console.log(chalk.green(`📊 レポート生成完了:`));
    console.log(chalk.gray(`  JSON: ${reportPath}`));
    console.log(chalk.gray(`  Markdown: ${humanReadablePath}`));

    return reportPath;
  }

  /**
   * Markdownレポートを生成
   */
  private generateMarkdownReport(data: ReportData): string {
    const duration = Math.round(data.duration / 1000);
    const successCount = data.agents.filter(a => a.status === 'success').length;
    const totalCount = data.agents.length;
    const successRate = Math.round((successCount / totalCount) * 100);

    const statusIcon = {
      success: '✅',
      partial_success: '⚠️',
      failed: '❌'
    }[data.status];

    const statusColor = {
      success: 'green',
      partial_success: 'yellow',
      failed: 'red'
    }[data.status];

    let markdown = `# Motiva Compose 実行レポート

## 概要

- **実行ID**: \`${data.executionId}\`
- **ステータス**: ${statusIcon} **${data.status.toUpperCase()}**
- **開始時刻**: ${new Date(data.startTime).toLocaleString()}
- **終了時刻**: ${new Date(data.endTime).toLocaleString()}
- **実行時間**: ${duration}秒
- **成功率**: ${successCount}/${totalCount} (${successRate}%)

## エージェント実行状況

| エージェント | ステータス | 実行時間 | トークン使用量 | コスト |
|-------------|-----------|----------|---------------|--------|
`;

    for (const agent of data.agents) {
      const agentIcon = {
        success: '✅',
        failed: '❌',
        skipped: '⏭️'
      }[agent.status];

      const agentDuration = Math.round(agent.duration / 1000);
      const tokens = agent.tokensUsed || 0;
      const cost = agent.costUSD || 0;

      markdown += `| ${agent.name} | ${agentIcon} ${agent.status} | ${agentDuration}s | ${tokens.toLocaleString()} | $${cost.toFixed(4)} |\n`;
    }

    markdown += `
## 予算使用状況

- **総トークン使用量**: ${data.budget.totalTokens.toLocaleString()}
- **総コスト**: $${data.budget.totalCost.toFixed(4)}
- **残り予算**: $${data.budget.remainingBudget.toFixed(4)}
- **予算制限**: $${data.budget.budgetLimit.toFixed(4)}

## メタデータ

- **パイプライン名**: ${data.metadata.pipelineName || 'N/A'}
- **テーマ**: ${data.metadata.theme || 'N/A'}
- **モデル**: ${data.metadata.model || 'N/A'}
- **バージョン**: ${data.metadata.version}

## エラー詳細

`;

    const failedAgents = data.agents.filter(a => a.status === 'failed');
    if (failedAgents.length > 0) {
      for (const agent of failedAgents) {
        markdown += `### ${agent.name}\n\n`;
        markdown += `**エラー**: ${agent.error}\n\n`;
        if (agent.retryCount > 0) {
          markdown += `**リトライ回数**: ${agent.retryCount}\n\n`;
        }
      }
    } else {
      markdown += `エラーは発生しませんでした。\n\n`;
    }

    markdown += `---
*このレポートは ${new Date().toISOString()} に自動生成されました。*`;

    return markdown;
  }

  /**
   * 統計レポートを生成
   */
  async generateStatisticsReport(executionIds: string[]): Promise<string> {
    await this.ensureReportsDir();

    const stats = {
      totalExecutions: executionIds.length,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalCost: 0,
      totalTokens: 0,
      averageDuration: 0,
      agentSuccessRates: {} as Record<string, { success: number; total: number; rate: number }>,
      commonErrors: {} as Record<string, number>
    };

    let totalDuration = 0;

    for (const executionId of executionIds) {
      try {
        const reportPath = path.join(this.reportsDir, `execution-${executionId}-*.json`);
        const files = await fs.readdir(this.reportsDir);
        const matchingFile = files.find(f => f.startsWith(`execution-${executionId}-`));
        
        if (matchingFile) {
          const reportData = JSON.parse(
            await fs.readFile(path.join(this.reportsDir, matchingFile), 'utf8')
          ) as ReportData;

          if (reportData.status === 'success') {
            stats.successfulExecutions++;
          } else {
            stats.failedExecutions++;
          }

          stats.totalCost += reportData.budget.totalCost;
          stats.totalTokens += reportData.budget.totalTokens;
          totalDuration += reportData.duration;

                     // エージェント統計
           for (const agent of reportData.agents) {
             if (!stats.agentSuccessRates[agent.name]) {
               stats.agentSuccessRates[agent.name] = { success: 0, total: 0, rate: 0 };
             }
             const agentStats = stats.agentSuccessRates[agent.name];
             if (agentStats) {
               agentStats.total++;
               if (agent.status === 'success') {
                 agentStats.success++;
               }
             }
             if (agent.error) {
               stats.commonErrors[agent.error] = (stats.commonErrors[agent.error] || 0) + 1;
             }
           }
        }
      } catch (error) {
        console.warn(chalk.yellow(`警告: 実行ID ${executionId} のレポートを読み込めませんでした`));
      }
    }

    // 成功率を計算
    for (const agentName in stats.agentSuccessRates) {
      const agent = stats.agentSuccessRates[agentName];
      if (agent) {
        agent.rate = Math.round((agent.success / agent.total) * 100);
      }
    }

    stats.averageDuration = Math.round(totalDuration / stats.totalExecutions / 1000);

    const statsPath = path.join(this.reportsDir, `statistics-${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));

    console.log(chalk.green(`📈 統計レポート生成完了: ${statsPath}`));

    return statsPath;
  }

  /**
   * レポート一覧を取得
   */
  async listReports(): Promise<string[]> {
    await this.ensureReportsDir();
    
    const files = await fs.readdir(this.reportsDir);
    return files.filter(f => f.endsWith('.json')).map(f => path.join(this.reportsDir, f));
  }
} 