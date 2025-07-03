import { z } from 'zod';

export interface SchemaDefinition<T = any> {
  name: string;
  zodSchema: z.ZodSchema<T>;
  jsonSchema: object;
  description?: string;
  version?: string;
}

export interface SchemaRegistryOptions {
  strict?: boolean;
  additionalProperties?: boolean;
  autoGenerateRequired?: boolean;
}

export class SchemaRegistry {
  private static instance: SchemaRegistry;
  private schemas = new Map<string, SchemaDefinition>();
  private options: SchemaRegistryOptions;

  private constructor(options: SchemaRegistryOptions = {}) {
    this.options = {
      strict: true,
      additionalProperties: false,
      autoGenerateRequired: true,
      ...options
    };
  }

  static getInstance(options?: SchemaRegistryOptions): SchemaRegistry {
    if (!SchemaRegistry.instance) {
      SchemaRegistry.instance = new SchemaRegistry(options);
    }
    return SchemaRegistry.instance;
  }

  /**
   * スキーマを登録する
   */
  register<T>(definition: SchemaDefinition<T>): void {
    this.schemas.set(definition.name, definition);
  }

  /**
   * スキーマを取得する
   */
  get(name: string): SchemaDefinition {
    const schema = this.schemas.get(name);
    if (!schema) {
      throw new Error(`Schema not found: ${name}`);
    }
    return schema;
  }

  /**
   * スキーマが存在するかチェック
   */
  has(name: string): boolean {
    return this.schemas.has(name);
  }

  /**
   * 登録済みスキーマの一覧を取得
   */
  list(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * ZodスキーマからJSON Schemaを自動生成
   */
  generateJSONSchema<T>(zodSchema: z.ZodSchema<T>, options?: {
    name?: string;
    description?: string;
    strict?: boolean;
  }): object {
    const schema = this.zodToJsonSchema(zodSchema, {
      name: options?.name || 'schema',
      description: options?.description,
      strict: options?.strict ?? this.options.strict!,
      additionalProperties: this.options.additionalProperties!
    });

    return schema;
  }

  /**
   * ZodスキーマをJSON Schemaに変換する内部メソッド
   */
  private zodToJsonSchema<T>(
    zodSchema: z.ZodSchema<T>,
    options: {
      name: string;
      description?: string;
      strict: boolean;
      additionalProperties: boolean;
    }
  ): object {
    const schema: any = {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: options.additionalProperties
    };

    if (options.description) {
      schema.description = options.description;
    }

    // Zodスキーマの形状を解析
    const shape = this.extractZodShape(zodSchema);
    
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fieldDefinition = this.convertZodFieldToJsonSchema(fieldSchema, key);
      
      if (fieldDefinition) {
        schema.properties[key] = fieldDefinition.jsonSchema;
        // OpenAI Strict Structured Outputs仕様: 全てのキーをrequiredに含める
        schema.required.push(key);
      }
    }

    return schema;
  }

  /**
   * Zodスキーマの形状を抽出
   */
  private extractZodShape(zodSchema: z.ZodSchema): Record<string, z.ZodSchema> {
    // ZodObjectの場合
    if (zodSchema instanceof z.ZodObject) {
      return zodSchema.shape;
    }
    
    // その他の場合は空のオブジェクトを返す
    return {};
  }

  /**
   * ZodフィールドをJSON Schemaに変換
   */
  private convertZodFieldToJsonSchema(
    fieldSchema: z.ZodSchema,
    fieldName: string
  ): { jsonSchema: object; required: boolean } | null {
    let jsonSchema: any = {};
    let required = true;

    // ZodString
    if (fieldSchema instanceof z.ZodString) {
      jsonSchema = {
        type: "string",
        description: `${fieldName} field`
      };
      
      // 安全な方法でminLengthを取得
      try {
        const def = fieldSchema._def as any;
        if (def.minLength?.value !== undefined) {
          jsonSchema.minLength = def.minLength.value;
        }
      } catch (error) {
        // エラーが発生した場合は無視
      }
    }
    
    // ZodNumber
    else if (fieldSchema instanceof z.ZodNumber) {
      jsonSchema = {
        type: "number",
        description: `${fieldName} field`
      };
      
      // 安全な方法でminimum/maximumを取得
      try {
        const def = fieldSchema._def as any;
        if (def.minimum?.value !== undefined) {
          jsonSchema.minimum = def.minimum.value;
        }
        if (def.maximum?.value !== undefined) {
          jsonSchema.maximum = def.maximum.value;
        }
      } catch (error) {
        // エラーが発生した場合は無視
      }
    }
    
    // ZodBoolean
    else if (fieldSchema instanceof z.ZodBoolean) {
      jsonSchema = {
        type: "boolean",
        description: `${fieldName} field`
      };
    }
    
    // ZodArray
    else if (fieldSchema instanceof z.ZodArray) {
      const itemSchema = this.convertZodFieldToJsonSchema(fieldSchema._def.type, 'item');
      jsonSchema = {
        type: "array",
        items: itemSchema?.jsonSchema || { type: "object" },
        description: `${fieldName} array field`
      };
    }
    
    // ZodEnum
    else if (fieldSchema instanceof z.ZodEnum) {
      jsonSchema = {
        type: "string",
        enum: fieldSchema._def.values,
        description: `${fieldName} enum field`
      };
    }
    
    // ZodOptional
    else if (fieldSchema instanceof z.ZodOptional) {
      const innerSchema = this.convertZodFieldToJsonSchema(fieldSchema._def.innerType, fieldName);
      if (innerSchema) {
        // オプショナルフィールドはanyOfでnullを許容
        jsonSchema = {
          anyOf: [
            innerSchema.jsonSchema,
            { type: "null" }
          ],
          description: `${fieldName} optional field`
        };
        required = false; // オプショナルフィールドはrequiredに含めない
      }
    }
    
    // ZodNullable
    else if (fieldSchema instanceof z.ZodNullable) {
      const innerSchema = this.convertZodFieldToJsonSchema(fieldSchema._def.innerType, fieldName);
      if (innerSchema) {
        jsonSchema = {
          anyOf: [
            innerSchema.jsonSchema,
            { type: "null" }
          ],
          description: `${fieldName} nullable field`
        };
      }
    }
    
    // ZodObject (ネストしたオブジェクト)
    else if (fieldSchema instanceof z.ZodObject) {
      jsonSchema = this.zodToJsonSchema(fieldSchema, {
        name: fieldName,
        strict: this.options.strict!,
        additionalProperties: this.options.additionalProperties!
      });
      // additionalPropertiesを明示的に設定
      if (this.options.additionalProperties === false) {
        jsonSchema.additionalProperties = false;
      }
    }
    
    // ZodRecord (レコード型)
    else if (fieldSchema instanceof z.ZodRecord) {
      const keySchema = fieldSchema._def.keyType;
      const valueSchema = fieldSchema._def.valueType;
      
      if (keySchema instanceof z.ZodString) {
        // 値のスキーマを再帰的に処理
        const valueJsonSchema = this.zodToJsonSchema(valueSchema, {
          name: `${fieldName}_value`,
          strict: this.options.strict!,
          additionalProperties: this.options.additionalProperties!
        });
        
        jsonSchema = {
          type: 'object',
          additionalProperties: valueJsonSchema,
          description: `${fieldName} record field`
        };
      }
    }
    
    // ZodUnion
    else if (fieldSchema instanceof z.ZodUnion) {
      const options = fieldSchema._def.options.map((option: z.ZodSchema) => {
        const converted = this.convertZodFieldToJsonSchema(option, fieldName);
        return converted?.jsonSchema || { type: "object" };
      });
      
      jsonSchema = {
        anyOf: options,
        description: `${fieldName} union field`
      };
    }
    
    // その他の場合は汎用的なオブジェクト
    else {
      jsonSchema = {
        type: "object",
        description: `${fieldName} object field`
      };
    }

    return { jsonSchema, required };
  }

  /**
   * スキーマを検証する
   */
  validate<T>(name: string, data: any): T {
    const schema = this.get(name);
    return schema.zodSchema.parse(data);
  }

  /**
   * スキーマを削除する
   */
  unregister(name: string): boolean {
    return this.schemas.delete(name);
  }

  /**
   * 全スキーマをクリアする
   */
  clear(): void {
    this.schemas.clear();
  }

  /**
   * スキーマの統計情報を取得
   */
  getStats(): {
    total: number;
    schemas: Array<{ name: string; version?: string; description?: string }>;
  } {
    return {
      total: this.schemas.size,
      schemas: Array.from(this.schemas.values()).map(schema => ({
        name: schema.name,
        version: schema.version,
        description: schema.description
      }))
    };
  }
} 