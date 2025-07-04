import { z } from 'zod';
import { SchemaRegistry } from './schema-registry.js';
import { registerNewSchema } from './schema-initializer.js';

/**
 * 新しいスキーマを動的に作成するためのビルダークラス
 */
export class SchemaBuilder<T = any> {
  private zodSchema: z.ZodSchema<T>;
  private name: string;
  private description?: string;
  private version: string = '1.0';

  constructor(name: string, zodSchema: z.ZodSchema<T>) {
    this.name = name;
    this.zodSchema = zodSchema;
  }

  /**
   * スキーマの説明を設定
   */
  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * スキーマのバージョンを設定
   */
  withVersion(version: string): this {
    this.version = version;
    return this;
  }

  /**
   * スキーマを登録する
   */
  register(): void {
    registerNewSchema(this.name, this.zodSchema, this.description, this.version);
  }

  /**
   * スキーマを取得する
   */
  getSchema(): z.ZodSchema<T> {
    return this.zodSchema;
  }
}

/**
 * よく使用されるスキーマパターンを提供するファクトリ関数
 */
export class SchemaFactory {
  /**
   * 基本的なオブジェクトスキーマを作成
   */
  static object<T extends Record<string, any>>(
    name: string,
    shape: z.ZodRawShape
  ): SchemaBuilder<z.infer<z.ZodObject<typeof shape>>> {
    const schema = z.object(shape);
    return new SchemaBuilder(name, schema);
  }

  /**
   * 配列スキーマを作成
   */
  static array<T>(
    name: string,
    itemSchema: z.ZodSchema<T>,
    minLength?: number,
    maxLength?: number
  ): SchemaBuilder<T[]> {
    let schema = z.array(itemSchema);
    
    if (minLength !== undefined) {
      schema = schema.min(minLength);
    }
    
    if (maxLength !== undefined) {
      schema = schema.max(maxLength);
    }
    
    return new SchemaBuilder(name, schema);
  }

  /**
   * オプショナルフィールドを持つスキーマを作成
   */
  static optional<T>(
    name: string,
    schema: z.ZodSchema<T>
  ): SchemaBuilder<T | undefined> {
    const optionalSchema = schema.optional();
    return new SchemaBuilder(name, optionalSchema);
  }

  /**
   * Nullableフィールドを持つスキーマを作成
   */
  static nullable<T>(
    name: string,
    schema: z.ZodSchema<T>
  ): SchemaBuilder<T | null> {
    const nullableSchema = schema.nullable();
    return new SchemaBuilder(name, nullableSchema);
  }

  /**
   * Union型のスキーマを作成
   */
  static union(
    name: string,
    schemas: [z.ZodSchema<any>, ...z.ZodSchema<any>[]]
  ): SchemaBuilder<any> {
    const unionSchema = z.union(schemas as any);
    return new SchemaBuilder(name, unionSchema);
  }

  /**
   * Enum型のスキーマを作成
   */
  static enum<T extends [string, ...string[]]>(
    name: string,
    values: T
  ): SchemaBuilder<T[number]> {
    const enumSchema = z.enum(values);
    return new SchemaBuilder(name, enumSchema);
  }
}

/**
 * スキーマの検証とテストを行うユーティリティ
 */
export class SchemaValidator {
  /**
   * スキーマが正しく動作するかテストする
   */
  static testSchema<T>(
    name: string,
    schema: z.ZodSchema<T>,
    testData: any[]
  ): {
    success: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < testData.length; i++) {
      const data = testData[i];
      try {
        schema.parse(data as any);
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(`Test case ${i + 1}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        } else {
          errors.push(`Test case ${i + 1}: ${error}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * スキーマの互換性をチェックする
   */
  static checkCompatibility<T>(
    oldSchema: z.ZodSchema<T>,
    newSchema: z.ZodSchema<T>,
    testData: T[]
  ): {
    isCompatible: boolean;
    breakingChanges: string[];
    improvements: string[];
  } {
    const breakingChanges: string[] = [];
    const improvements: string[] = [];

    for (const data of testData) {
      try {
        // 古いスキーマで検証
        oldSchema.parse(data);
        
        // 新しいスキーマで検証
        newSchema.parse(data);
      } catch (error) {
        if (error instanceof z.ZodError) {
          breakingChanges.push(`Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        }
      }
    }

    return {
      isCompatible: breakingChanges.length === 0,
      breakingChanges,
      improvements
    };
  }
}

/**
 * スキーマの統計情報を取得するユーティリティ
 */
export class SchemaAnalytics {
  /**
   * スキーマの複雑さを分析する
   */
  static analyzeComplexity(schema: z.ZodSchema): {
    depth: number;
    fieldCount: number;
    nestedObjects: number;
    arrays: number;
    unions: number;
    optionals: number;
  } {
    let depth = 0;
    let fieldCount = 0;
    let nestedObjects = 0;
    let arrays = 0;
    let unions = 0;
    let optionals = 0;

    const analyze = (s: z.ZodSchema<any>, currentDepth: number = 0) => {
      depth = Math.max(depth, currentDepth);

      if (s instanceof z.ZodObject) {
        nestedObjects++;
        fieldCount += Object.keys(s.shape).length;
        Object.values(s.shape).forEach(field => analyze(field as z.ZodSchema<any>, currentDepth + 1));
      } else if (s instanceof z.ZodArray) {
        arrays++;
        analyze(s._def.type as z.ZodSchema<any>, currentDepth + 1);
      } else if (s instanceof z.ZodUnion) {
        unions++;
        (s._def.options as z.ZodSchema<any>[]).forEach(option => analyze(option as z.ZodSchema<any>, currentDepth + 1));
      } else if (s instanceof z.ZodOptional) {
        optionals++;
        analyze(s._def.innerType as z.ZodSchema<any>, currentDepth + 1);
      } else if (s instanceof z.ZodNullable) {
        analyze(s._def.innerType as z.ZodSchema<any>, currentDepth + 1);
      }
    };

    analyze(schema);

    return {
      depth,
      fieldCount,
      nestedObjects,
      arrays,
      unions,
      optionals
    };
  }

  /**
   * スキーマの使用統計を取得する
   */
  static getUsageStats(): {
    totalSchemas: number;
    mostUsedSchemas: Array<{ name: string; usageCount: number }>;
    recentlyAdded: Array<{ name: string; version: string; addedAt: string }>;
  } {
    const registry = SchemaRegistry.getInstance();
    const stats = registry.getStats();

    return {
      totalSchemas: stats.total,
      mostUsedSchemas: stats.schemas.map(schema => ({
        name: schema.name,
        usageCount: 0 // TODO: 使用回数の追跡機能を実装
      })),
      recentlyAdded: stats.schemas.map(schema => ({
        name: schema.name,
        version: schema.version || '1.0',
        addedAt: new Date().toISOString() // TODO: 実際の追加日時を追跡
      }))
    };
  }
} 