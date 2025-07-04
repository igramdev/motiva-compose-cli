import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import chalk from 'chalk';

// 設定スキーマ定義
export const AgentConfigSchema = z.object({
  provider: z.string().default('openai:gpt-4o-mini'),
  maxTokens: z.number().int().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  timeout: z.number().int().positive().default(30000)
});

export const PathsConfigSchema = z.object({
  assets: z.string().default('./assets'),
  sceneGraph: z.string().default('./scene-graph.json'),
  prompts: z.string().default('./prompts'),
  logs: z.string().default('./logs')
});

export const RemotionConfigSchema = z.object({
  fps: z.number().int().positive().default(30),
  size: z.object({
    w: z.number().int().positive().default(1920),
    h: z.number().int().positive().default(1080)
  })
});

export const MotivaConfigSchema = z.object({
  models: z.record(z.string(), AgentConfigSchema).default({
    conceptPlanner: { provider: 'openai:gpt-4o-mini', maxTokens: 4096 },
    assetSynthesizer: { provider: 'openai:gpt-4o-mini', maxTokens: 6144 },
    director: { provider: 'openai:gpt-4o-mini', maxTokens: 4096 },
    editor: { provider: 'openai:gpt-4o-mini', maxTokens: 2048 },
    critic: { provider: 'openai:gpt-4o-mini', maxTokens: 1024 }
  }),
  paths: PathsConfigSchema,
  remotion: RemotionConfigSchema,
  telemetry: z.object({
    enabled: z.boolean().default(false),
    endpoint: z.string().url().optional()
  }).default({ enabled: false }),
  retry: z.object({
    maxAttempts: z.number().int().positive().default(3),
    backoffMs: z.number().int().positive().default(1000)
  }).default({ maxAttempts: 3, backoffMs: 1000 })
});

export type MotivaConfig = z.infer<typeof MotivaConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: MotivaConfig | null = null;
  private configPath: string;

  private constructor(workspacePath: string = process.cwd()) {
    this.configPath = path.join(workspacePath, 'motiva.config.ts');
  }

  static getInstance(workspacePath?: string): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager(workspacePath);
    }
    return ConfigurationManager.instance;
  }

  /**
   * 設定ファイルを読み込み
   */
  async loadConfig(): Promise<MotivaConfig> {
    if (this.config) {
      return this.config;
    }

    // 設定ファイルの存在確認
    const exists = await this.configExists();
    if (!exists) {
      console.log(chalk.yellow('⚠️  設定ファイルが見つかりません。デフォルト設定を使用します。'));
      this.config = this.getDefaultConfig();
      return this.config;
    }

    try {
      // TypeScript設定ファイルを動的に読み込み
      const configModule = await this.loadTypeScriptConfig();
      const rawConfig = configModule.default || configModule;

      // スキーマ検証
      this.config = MotivaConfigSchema.parse(rawConfig);
      
      console.log(chalk.green('✅ 設定ファイルを読み込みました'));
      return this.config;

    } catch (error) {
      console.error(chalk.red('❌ 設定ファイルの読み込みに失敗:'), error);
      console.log(chalk.yellow('デフォルト設定を使用します。'));
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  /**
   * 設定ファイルの存在確認
   */
  private async configExists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * TypeScript設定ファイルを動的に読み込み
   */
  private async loadTypeScriptConfig(): Promise<any> {
    try {
      // 設定ファイルの存在を再確認
      const exists = await this.configExists();
      if (!exists) {
        return this.getDefaultConfig();
      }
      
      // ESモジュール環境での動的インポート
      const configModule = await import(this.configPath);
      return configModule.default || configModule;
    } catch (error) {
      // 設定ファイルが存在しない場合はデフォルト設定を返す
      console.log(chalk.yellow('⚠️  設定ファイルの読み込みに失敗。デフォルト設定を使用します。'));
      return this.getDefaultConfig();
    }
  }

  /**
   * デフォルト設定を取得
   */
  private getDefaultConfig(): MotivaConfig {
    return MotivaConfigSchema.parse({
      models: {
        conceptPlanner: {
          provider: 'gpt-4o-mini',
          maxTokens: 4096,
          temperature: 0.7,
          timeout: 30000
        },
        assetSynthesizer: {
          provider: 'gpt-4o-mini',
          maxTokens: 6144,
          temperature: 0.7,
          timeout: 30000
        },
        director: {
          provider: 'gpt-4o-mini',
          maxTokens: 4096,
          temperature: 0.7,
          timeout: 30000
        },
        editor: {
          provider: 'gpt-4o-mini',
          maxTokens: 2048,
          temperature: 0.7,
          timeout: 30000
        },
        critic: {
          provider: 'gpt-4o-mini',
          maxTokens: 1024,
          temperature: 0.7,
          timeout: 30000
        }
      },
      paths: {
        assets: './assets',
        sceneGraph: './scene-graph.json',
        prompts: './prompts',
        logs: './logs'
      },
      remotion: {
        fps: 30,
        size: {
          w: 1920,
          h: 1080
        }
      }
    });
  }

  /**
   * 設定ファイルを初期化
   */
  async initializeConfig(): Promise<void> {
    if (await this.configExists()) {
      console.log(chalk.yellow('設定ファイルは既に存在します。'));
      return;
    }

    const defaultConfig = this.getDefaultConfig();
    const configContent = this.generateConfigFile(defaultConfig);
    
    await fs.writeFile(this.configPath, configContent);
    console.log(chalk.green(`✅ 設定ファイルを作成しました: ${this.configPath}`));
  }

  /**
   * 設定ファイルの内容を生成
   */
  private generateConfigFile(config: MotivaConfig): string {
    return `import { defineConfig } from "motiva-compose";

export default defineConfig(${JSON.stringify(config, null, 2)});
`;
  }

  /**
   * 特定のエージェント設定を取得
   */
  async getAgentConfig(agentName: string): Promise<AgentConfig> {
    const config = await this.loadConfig();
    return config.models[agentName] || AgentConfigSchema.parse({});
  }

  /**
   * パス設定を取得
   */
  async getPathsConfig() {
    const config = await this.loadConfig();
    return config.paths;
  }

  /**
   * Remotion設定を取得
   */
  async getRemotionConfig() {
    const config = await this.loadConfig();
    return config.remotion;
  }

  /**
   * リトライ設定を取得
   */
  async getRetryConfig() {
    const config = await this.loadConfig();
    return config.retry;
  }

  /**
   * テレメトリ設定を取得
   */
  async getTelemetryConfig() {
    const config = await this.loadConfig();
    return config.telemetry;
  }

  /**
   * 設定をリロード
   */
  async reload(): Promise<void> {
    this.config = null;
    await this.loadConfig();
  }
} 