import { MotivaConfig, MotivaConfigSchema } from './config-manager.js';

/**
 * 設定を定義するためのヘルパー関数
 * motiva.config.tsで使用される
 */
export function defineConfig(config: Partial<MotivaConfig>): MotivaConfig {
  return MotivaConfigSchema.parse(config);
}

/**
 * 設定の型定義をエクスポート
 */
export type { MotivaConfig, AgentConfig } from './config-manager.js'; 