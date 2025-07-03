import { z } from 'zod';
import chalk from 'chalk';

// 通知設定スキーマ
const NotificationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  channels: z.object({
    console: z.boolean().default(true),
    slack: z.object({
      enabled: z.boolean().default(false),
      webhookUrl: z.string().url().optional(),
      channel: z.string().optional()
    }).optional(),
    discord: z.object({
      enabled: z.boolean().default(false),
      webhookUrl: z.string().url().optional(),
      channel: z.string().optional()
    }).optional(),
    email: z.object({
      enabled: z.boolean().default(false),
      smtp: z.object({
        host: z.string().optional(),
        port: z.number().optional(),
        secure: z.boolean().optional(),
        auth: z.object({
          user: z.string().optional(),
          pass: z.string().optional()
        }).optional()
      }).optional(),
      recipients: z.array(z.string().email()).optional()
    }).optional()
  }),
  events: z.object({
    pipelineStart: z.boolean().default(true),
    pipelineComplete: z.boolean().default(true),
    pipelineError: z.boolean().default(true),
    agentStart: z.boolean().default(false),
    agentComplete: z.boolean().default(false),
    agentError: z.boolean().default(true),
    budgetWarning: z.boolean().default(true),
    budgetExceeded: z.boolean().default(true)
  })
});

// 通知メッセージスキーマ
const NotificationMessageSchema = z.object({
  type: z.enum(['info', 'success', 'warning', 'error']),
  title: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional(),
  timestamp: z.string().datetime(),
  source: z.string()
});

export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;
export type NotificationMessage = z.infer<typeof NotificationMessageSchema>;

/**
 * 通知システムを管理するクラス
 */
export class NotificationManager {
  private static instance: NotificationManager;
  private config: NotificationConfig;
  private messageQueue: NotificationMessage[] = [];

  private constructor() {
    this.config = {
      enabled: true,
      channels: {
        console: true,
        slack: { enabled: false },
        discord: { enabled: false },
        email: { enabled: false }
      },
      events: {
        pipelineStart: true,
        pipelineComplete: true,
        pipelineError: true,
        agentStart: false,
        agentComplete: false,
        agentError: true,
        budgetWarning: true,
        budgetExceeded: true
      }
    };
  }

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 通知を送信
   */
  async notify(
    type: NotificationMessage['type'],
    title: string,
    message: string,
    details?: Record<string, any>,
    source: string = 'system'
  ): Promise<void> {
    if (!this.config.enabled) return;

    const notification: NotificationMessage = {
      type,
      title,
      message,
      details,
      timestamp: new Date().toISOString(),
      source
    };

    this.messageQueue.push(notification);

    // 各チャンネルに通知を送信
    await Promise.all([
      this.sendToConsole(notification),
      this.sendToSlack(notification),
      this.sendToDiscord(notification),
      this.sendToEmail(notification)
    ]);
  }

  /**
   * コンソール通知
   */
  private async sendToConsole(notification: NotificationMessage): Promise<void> {
    if (!this.config.channels.console) return;

    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };

    const color = colors[notification.type];
    const icon = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[notification.type];

    console.log(
      `${color(`${icon} [${notification.source}] ${notification.title}`)}\n` +
      `${notification.message}\n` +
      `${notification.details ? chalk.gray(JSON.stringify(notification.details, null, 2)) + '\n' : ''}` +
      `${chalk.gray(`[${new Date(notification.timestamp).toLocaleString()}]`)}\n`
    );
  }

  /**
   * Slack通知
   */
  private async sendToSlack(notification: NotificationMessage): Promise<void> {
    if (!this.config.channels.slack?.enabled || !this.config.channels.slack?.webhookUrl) return;

    try {
      const payload = {
        text: `*[${notification.source}] ${notification.title}*\n${notification.message}`,
        attachments: notification.details ? [{
          fields: Object.entries(notification.details).map(([key, value]) => ({
            title: key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
            short: true
          }))
        }] : []
      };

      await fetch(this.config.channels.slack.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error(chalk.red('Slack通知送信に失敗:'), error);
    }
  }

  /**
   * Discord通知
   */
  private async sendToDiscord(notification: NotificationMessage): Promise<void> {
    if (!this.config.channels.discord?.enabled || !this.config.channels.discord?.webhookUrl) return;

    try {
      const colors = {
        info: 0x3498db,
        success: 0x2ecc71,
        warning: 0xf39c12,
        error: 0xe74c3c
      };

      const payload = {
        embeds: [{
          title: `[${notification.source}] ${notification.title}`,
          description: notification.message,
          color: colors[notification.type],
          timestamp: notification.timestamp,
          fields: notification.details ? Object.entries(notification.details).map(([key, value]) => ({
            name: key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
            inline: true
          })) : []
        }]
      };

      await fetch(this.config.channels.discord.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error(chalk.red('Discord通知送信に失敗:'), error);
    }
  }

  /**
   * メール通知
   */
  private async sendToEmail(notification: NotificationMessage): Promise<void> {
    if (!this.config.channels.email?.enabled) return;

    // メール送信の実装は後で追加
    console.log(chalk.yellow('📧 メール通知機能は未実装です'));
  }

  /**
   * 通知履歴を取得
   */
  getMessageHistory(): NotificationMessage[] {
    return [...this.messageQueue];
  }

  /**
   * 通知履歴をクリア
   */
  clearHistory(): void {
    this.messageQueue = [];
  }
} 