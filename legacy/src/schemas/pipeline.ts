import { z } from 'zod';

/**
 * エージェント設定のスキーマ
 */
export const AgentConfigSchema = z.object({
  name: z.string(),
  type: z.enum(['concept-planner', 'asset-synthesizer', 'director', 'editor', 'critic']),
  config: z.object({
    model: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    quality: z.enum(['draft', 'standard', 'high']).optional(),
  }).optional(),
  input: z.any().optional(), // エージェント固有の入力
  dependencies: z.array(z.string()).optional(), // 依存するエージェント名
  parallel: z.boolean().default(false), // 並列実行フラグ
  parallelGroup: z.string().optional(), // 並列実行グループ
  maxConcurrency: z.number().optional(), // 並列実行時の最大同時実行数
});

/**
 * 並列実行グループのスキーマ
 */
export const ParallelGroupSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  maxConcurrency: z.number().default(3),
  timeout: z.number().default(30000),
  retryCount: z.number().default(0),
  retryDelay: z.number().default(1000),
});

/**
 * パイプライン設定のスキーマ
 */
export const PipelineConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0'),
  agents: z.array(AgentConfigSchema),
  parallelGroups: z.array(ParallelGroupSchema).optional(), // 並列実行グループ定義
  options: z.object({
    maxConcurrency: z.number().default(3),
    timeout: z.number().default(30000),
    useCache: z.boolean().default(true),
    showProgress: z.boolean().default(true),
    enableParallel: z.boolean().default(true), // 並列実行の有効/無効
  }).optional(),
  metadata: z.object({
    createdAt: z.string().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * パイプライン実行結果のスキーマ
 */
export const PipelineResultSchema = z.object({
  pipelineName: z.string(),
  executionId: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  duration: z.number(),
  status: z.enum(['success', 'failed', 'partial']),
  results: z.array(z.object({
    agentName: z.string(),
    status: z.enum(['success', 'failed', 'skipped']),
    duration: z.number(),
    tokensUsed: z.number().optional(),
    costUSD: z.number().optional(),
    error: z.string().optional(),
    output: z.any().optional(),
  })),
  totalTokens: z.number(),
  totalCost: z.number(),
});

// 型定義のエクスポート
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;
export type PipelineResult = z.infer<typeof PipelineResultSchema>;
export type ParallelGroup = z.infer<typeof ParallelGroupSchema>; 