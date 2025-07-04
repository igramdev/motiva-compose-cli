import { z } from 'zod';

// === Core Data Structures ===

export const ShotSchema = z.object({
  id: z.string().min(1),
  start: z.number().int().min(0),
  len: z.number().int().positive(),
  desc: z.string().min(1)
});

export const ShotPlanSchema = z.object({
  sceneId: z.string().min(1),
  duration: z.number().int().positive(),
  theme: z.string().min(1),
  shots: z.array(ShotSchema).min(1),
  bgm: z.object({
    style: z.string(),
    bpm: z.number().int().positive()
  }).optional()
});

// === Asset Management ===

export const AssetItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['video', 'audio', 'image', 'effect']),
  uri: z.string().nullable().optional(), // 生成後のファイルパス/URL
  generator: z.string(), // 生成に使用したジェネレータ名
  spec: z.object({
    description: z.string(),
    duration: z.number().int().positive().nullable().optional(), // 映像・音声の場合
    dimensions: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive()
    }).nullable().optional(), // 画像・映像の場合
    format: z.string().nullable().optional(), // mp4, jpg, wav, etc
    style: z.string().nullable().optional(), // 生成スタイル指定
    quality: z.enum(['draft', 'standard', 'high']).nullable().optional()
  }),
  status: z.enum(['pending', 'generated', 'failed']),
  metadata: z.object({
    shotId: z.string().nullable().optional(), // 関連するショットID
    createdAt: z.string().datetime().nullable().optional(),
    estimatedCost: z.number().min(0).nullable().optional(),
    actualCost: z.number().min(0).nullable().optional()
  }).optional()
});

// ジェネレーター設定のスキーマ
export const GeneratorConfigSchema = z.object({
  name: z.string(),
  type: z.enum(['local', 'api', 'mock']),
  config: z.record(z.string(), z.unknown()).nullable().optional()
});

// ジェネレーター設定のレコードスキーマ
export const GeneratorsRecordSchema = z.record(z.string(), GeneratorConfigSchema);

export const AssetManifestSchema = z.object({
  sceneId: z.string().min(1),
  version: z.string(),
  assets: z.array(AssetItemSchema).min(1),
  generators: GeneratorsRecordSchema.nullable().optional(),
  totalEstimatedCost: z.number().min(0).nullable().optional()
});

// === Budget Management ===

export const BudgetTierSchema = z.object({
  monthly: z.number().positive(),
  tokens: z.number().int().positive()
});

export const BudgetUsageSchema = z.object({
  tokens: z.number().int().min(0),
  costUSD: z.number().min(0)
});

export const BudgetAlertsSchema = z.object({
  warningAt: z.number().min(0).max(1),
  stopAt: z.number().min(0).max(1)
});

export const BudgetSchema = z.object({
  tiers: z.record(z.string(), BudgetTierSchema),
  current: z.string(),
  usage: BudgetUsageSchema,
  alerts: BudgetAlertsSchema
});

// === Configuration ===

export const ModelConfigSchema = z.object({
  provider: z.string(),
  maxTokens: z.number().int().positive()
});

export const PathsConfigSchema = z.object({
  assets: z.string(),
  sceneGraph: z.string()
});

export const RemotionConfigSchema = z.object({
  fps: z.number().int().positive(),
  size: z.object({
    w: z.number().int().positive(),
    h: z.number().int().positive()
  })
});

export const MotivaConfigSchema = z.object({
  models: z.record(z.string(), ModelConfigSchema),
  paths: PathsConfigSchema,
  remotion: RemotionConfigSchema
});

// === Export Types ===

export type Shot = z.infer<typeof ShotSchema>;
export type ShotPlan = z.infer<typeof ShotPlanSchema>;
export type AssetItem = z.infer<typeof AssetItemSchema>;
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
export type BudgetTier = z.infer<typeof BudgetTierSchema>;
export type BudgetUsage = z.infer<typeof BudgetUsageSchema>;
export type BudgetAlerts = z.infer<typeof BudgetAlertsSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type PathsConfig = z.infer<typeof PathsConfigSchema>;
export type RemotionConfig = z.infer<typeof RemotionConfigSchema>;
export type MotivaConfig = z.infer<typeof MotivaConfigSchema>;

// === Pipeline Management ===
export * from './pipeline.js';

// === Scene Graph & Editing ===

export const SceneGraphSchema = z.object({
  "@context": z.string().url(),
  "@id": z.string(),
  type: z.enum(["Scene", "Comp", "Footage", "Effect"]),
  fps: z.number().int().positive(),
  duration: z.number().int().positive(),
  size: z.object({
    w: z.number().int().positive(),
    h: z.number().int().positive()
  }),
  layers: z.array(z.any()),
  effects: z.array(z.any()).optional()
});

export const JsonPatchOperationSchema = z.object({
  op: z.enum(["add", "remove", "replace", "move", "copy", "test"]),
  path: z.string(),
  value: z.any().optional(),
  from: z.string().optional()
});

export const JsonPatchSchema = z.array(JsonPatchOperationSchema);

// === Export Additional Types ===

export type SceneGraph = z.infer<typeof SceneGraphSchema>;
export type JsonPatchOperation = z.infer<typeof JsonPatchOperationSchema>;
export type JsonPatch = z.infer<typeof JsonPatchSchema>; 