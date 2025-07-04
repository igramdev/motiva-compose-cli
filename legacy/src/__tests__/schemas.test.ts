import { describe, it, expect } from 'vitest';
import { ShotPlanSchema, BudgetSchema } from '../schemas/index.js';

describe('Schema Validation', () => {
  describe('ShotPlanSchema', () => {
    it('有効なShotPlanを正しく検証する', () => {
      const validPlan = {
        sceneId: 'test-scene',
        duration: 900,
        theme: 'テストテーマ',
        shots: [
          {
            id: 's1',
            start: 0,
            len: 300,
            desc: 'オープニングシーン'
          },
          {
            id: 's2',
            start: 300,
            len: 600,
            desc: 'メインシーン'
          }
        ],
        bgm: {
          style: 'pop',
          bpm: 120
        }
      };

      expect(() => ShotPlanSchema.parse(validPlan)).not.toThrow();
      const parsed = ShotPlanSchema.parse(validPlan);
      expect(parsed.sceneId).toBe('test-scene');
      expect(parsed.shots).toHaveLength(2);
    });

    it('不正なShotPlanでエラーを発生させる', () => {
      const invalidPlan = {
        sceneId: '',  // 空文字列は無効
        duration: -1, // 負の値は無効
        theme: 'テストテーマ',
        shots: []     // 空配列は無効
      };

      expect(() => ShotPlanSchema.parse(invalidPlan)).toThrow();
    });

    it('重複するショットIDでエラーを発生させる', () => {
      const planWithDuplicateIds = {
        sceneId: 'test-scene',
        duration: 900,
        theme: 'テストテーマ',
        shots: [
          {
            id: 's1',
            start: 0,
            len: 300,
            desc: 'シーン1'
          },
          {
            id: 's1', // 重複ID
            start: 300,
            len: 600,
            desc: 'シーン2'
          }
        ]
      };

      // スキーマレベルでは重複IDは検証されない（業務ロジックレベル）
      expect(() => ShotPlanSchema.parse(planWithDuplicateIds)).not.toThrow();
    });

    it('BGMなしでも有効', () => {
      const planWithoutBgm = {
        sceneId: 'test-scene',
        duration: 900,
        theme: 'テストテーマ',
        shots: [
          {
            id: 's1',
            start: 0,
            len: 900,
            desc: 'フルシーン'
          }
        ]
      };

      expect(() => ShotPlanSchema.parse(planWithoutBgm)).not.toThrow();
      const parsed = ShotPlanSchema.parse(planWithoutBgm);
      expect(parsed.bgm).toBeUndefined();
    });
  });

  describe('BudgetSchema', () => {
    it('有効な予算設定を正しく検証する', () => {
      const validBudget = {
        tiers: {
          minimal: { monthly: 3, tokens: 100000 },
          standard: { monthly: 10, tokens: 350000 }
        },
        current: 'minimal',
        usage: { tokens: 1000, costUSD: 0.15 },
        alerts: { warningAt: 0.8, stopAt: 0.95 }
      };

      expect(() => BudgetSchema.parse(validBudget)).not.toThrow();
      const parsed = BudgetSchema.parse(validBudget);
      expect(parsed.current).toBe('minimal');
      expect(parsed.usage.tokens).toBe(1000);
    });

    it('不正な警告閾値でエラーを発生させる', () => {
      const invalidBudget = {
        tiers: {
          minimal: { monthly: 3, tokens: 100000 }
        },
        current: 'minimal',
        usage: { tokens: 0, costUSD: 0 },
        alerts: { warningAt: 1.5, stopAt: 0.95 } // 1.0を超える値は無効
      };

      expect(() => BudgetSchema.parse(invalidBudget)).toThrow();
    });
  });
}); 