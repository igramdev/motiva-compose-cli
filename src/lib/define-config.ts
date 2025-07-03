import { z } from 'zod';

/**
 * 設定を定義するためのヘルパー関数
 * motiva.config.tsで使用される
 */
export function defineConfig(config: Partial<MotivaConfig>): MotivaConfig {
  return MotivaConfigSchema.parse(config);
}



// 基本設定スキーマ
export const BaseConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  environment: z.enum(['development', 'production', 'test']).default('development'),
  debug: z.boolean().default(false),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info')
});

// OpenAI設定スキーマ
export const OpenAIConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().default('gpt-4o-mini'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().default(4096),
  timeout: z.number().positive().default(30000),
  retries: z.number().min(0).max(5).default(3),
  retryDelay: z.number().positive().default(1000)
});

// キャッシュ設定スキーマ
export const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttl: z.number().positive().default(3600000), // 1時間
  maxSize: z.number().positive().default(100),
  cleanupInterval: z.number().positive().default(300000), // 5分
  compression: z.boolean().default(false)
});

// 並列処理設定スキーマ
export const ParallelConfigSchema = z.object({
  maxConcurrency: z.number().positive().default(3),
  timeout: z.number().positive().default(30000),
  retryOnFailure: z.boolean().default(true),
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    failureThreshold: z.number().positive().default(5),
    recoveryTimeout: z.number().positive().default(60000)
  })
});

// エージェント設定スキーマ
export const AgentConfigSchema = z.object({
  conceptPlanner: z.object({
    enabled: z.boolean().default(true),
    timeout: z.number().positive().default(30000),
    retries: z.number().min(0).max(3).default(2),
    model: z.string().default('gpt-4o-mini'),
    temperature: z.number().min(0).max(2).default(0.7)
  }),
  assetSynthesizer: z.object({
    enabled: z.boolean().default(true),
    timeout: z.number().positive().default(60000),
    retries: z.number().min(0).max(3).default(2),
    model: z.string().default('gpt-4o-mini'),
    temperature: z.number().min(0).max(2).default(0.8),
    maxAssets: z.number().positive().default(10)
  }),
  director: z.object({
    enabled: z.boolean().default(true),
    timeout: z.number().positive().default(45000),
    retries: z.number().min(0).max(3).default(2),
    model: z.string().default('gpt-4o-mini'),
    temperature: z.number().min(0).max(2).default(0.6)
  }),
  editor: z.object({
    enabled: z.boolean().default(true),
    timeout: z.number().positive().default(40000),
    retries: z.number().min(0).max(3).default(2),
    model: z.string().default('gpt-4o-mini'),
    temperature: z.number().min(0).max(2).default(0.5)
  }),
  critic: z.object({
    enabled: z.boolean().default(true),
    timeout: z.number().positive().default(30000),
    retries: z.number().min(0).max(3).default(2),
    model: z.string().default('gpt-4o-mini'),
    temperature: z.number().min(0).max(2).default(0.4)
  })
});

// 通知設定スキーマ
export const NotificationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  providers: z.array(z.enum(['console', 'email', 'slack', 'discord'])).default(['console']),
  email: z.object({
    smtp: z.string().optional(),
    from: z.string().email().optional(),
    to: z.array(z.string().email()).default([])
  }).optional(),
  slack: z.object({
    webhookUrl: z.string().url().optional(),
    channel: z.string().optional()
  }).optional(),
  discord: z.object({
    webhookUrl: z.string().url().optional(),
    username: z.string().optional()
  }).optional()
});

// レポート設定スキーマ
export const ReportConfigSchema = z.object({
  enabled: z.boolean().default(true),
  format: z.enum(['json', 'html', 'markdown', 'pdf']).default('json'),
  outputDir: z.string().default('./reports'),
  includeMetrics: z.boolean().default(true),
  includeCharts: z.boolean().default(true),
  autoGenerate: z.boolean().default(false)
});

// メイン設定スキーマ
export const MotivaConfigSchema = z.object({
  base: BaseConfigSchema,
  openai: OpenAIConfigSchema,
  cache: CacheConfigSchema,
  parallel: ParallelConfigSchema,
  agents: AgentConfigSchema,
  notifications: NotificationConfigSchema,
  reports: ReportConfigSchema
});

// 設定型定義
export type BaseConfig = z.infer<typeof BaseConfigSchema>;
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type ParallelConfig = z.infer<typeof ParallelConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;
export type ReportConfig = z.infer<typeof ReportConfigSchema>;
export type MotivaConfig = z.infer<typeof MotivaConfigSchema>;

// デフォルト設定
export const DEFAULT_CONFIG: MotivaConfig = {
  base: {
    version: '1.0.0',
    environment: 'development',
    debug: false,
    logLevel: 'info'
  },
  openai: {
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 30000,
    retries: 3,
    retryDelay: 1000
  },
  cache: {
    enabled: true,
    ttl: 3600000,
    maxSize: 100,
    cleanupInterval: 300000,
    compression: false
  },
  parallel: {
    maxConcurrency: 3,
    timeout: 30000,
    retryOnFailure: true,
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      recoveryTimeout: 60000
    }
  },
  agents: {
    conceptPlanner: {
      enabled: true,
      timeout: 30000,
      retries: 2,
      model: 'gpt-4o-mini',
      temperature: 0.7
    },
    assetSynthesizer: {
      enabled: true,
      timeout: 60000,
      retries: 2,
      model: 'gpt-4o-mini',
      temperature: 0.8,
      maxAssets: 10
    },
    director: {
      enabled: true,
      timeout: 45000,
      retries: 2,
      model: 'gpt-4o-mini',
      temperature: 0.6
    },
    editor: {
      enabled: true,
      timeout: 40000,
      retries: 2,
      model: 'gpt-4o-mini',
      temperature: 0.5
    },
    critic: {
      enabled: true,
      timeout: 30000,
      retries: 2,
      model: 'gpt-4o-mini',
      temperature: 0.4
    }
  },
  notifications: {
    enabled: false,
    providers: ['console'],
    email: {
      to: []
    },
    slack: {},
    discord: {}
  },
  reports: {
    enabled: true,
    format: 'json',
    outputDir: './reports',
    includeMetrics: true,
    includeCharts: true,
    autoGenerate: false
  }
}; 