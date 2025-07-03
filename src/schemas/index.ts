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
export type BudgetTier = z.infer<typeof BudgetTierSchema>;
export type BudgetUsage = z.infer<typeof BudgetUsageSchema>;
export type BudgetAlerts = z.infer<typeof BudgetAlertsSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type PathsConfig = z.infer<typeof PathsConfigSchema>;
export type RemotionConfig = z.infer<typeof RemotionConfigSchema>;
export type MotivaConfig = z.infer<typeof MotivaConfigSchema>; 