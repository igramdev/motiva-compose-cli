import { SchemaRegistry } from './schema-registry.js';
import {
  ShotPlanSchema,
  AssetManifestSchema,
  BudgetSchema,
  MotivaConfigSchema
} from '../schemas/index.js';
import { DirectorInputSchema, DirectorOutputSchema } from '../agents/director-agent.js';

/**
 * 既存のスキーマをSchema Registryに登録する
 */
export function initializeSchemas(): SchemaRegistry {
  const registry = SchemaRegistry.getInstance();

  // ShotPlanスキーマの登録
  registry.register({
    name: 'shot_plan_schema',
    zodSchema: ShotPlanSchema,
    jsonSchema: registry.generateJSONSchema(ShotPlanSchema, {
      name: 'ShotPlan',
      description: 'Shot plan for video composition'
    }),
    description: 'Shot plan for video composition',
    version: '1.0'
  });

  // AssetManifestスキーマの登録
  registry.register({
    name: 'asset_manifest_schema',
    zodSchema: AssetManifestSchema,
    jsonSchema: registry.generateJSONSchema(AssetManifestSchema, {
      name: 'AssetManifest',
      description: 'Asset manifest for video assets'
    }),
    description: 'Asset manifest for video assets',
    version: '1.0'
  });

  // Budgetスキーマの登録
  registry.register({
    name: 'budget_schema',
    zodSchema: BudgetSchema,
    jsonSchema: registry.generateJSONSchema(BudgetSchema, {
      name: 'Budget',
      description: 'Budget configuration and usage tracking'
    }),
    description: 'Budget configuration and usage tracking',
    version: '1.0'
  });

  // MotivaConfigスキーマの登録
  registry.register({
    name: 'motiva_config_schema',
    zodSchema: MotivaConfigSchema,
    jsonSchema: registry.generateJSONSchema(MotivaConfigSchema, {
      name: 'MotivaConfig',
      description: 'Motiva Compose CLI configuration'
    }),
    description: 'Motiva Compose CLI configuration',
    version: '1.0'
  });

  // Director Inputスキーマの登録
  registry.register({
    name: 'director_input_schema',
    zodSchema: DirectorInputSchema,
    jsonSchema: registry.generateJSONSchema(DirectorInputSchema, {
      name: 'DirectorInput',
      description: 'Director Agent input schema'
    }),
    description: 'Director Agent input schema',
    version: '1.0'
  });

  // Director Outputスキーマの登録
  registry.register({
    name: 'director_output_schema',
    zodSchema: DirectorOutputSchema,
    jsonSchema: registry.generateJSONSchema(DirectorOutputSchema, {
      name: 'DirectorOutput',
      description: 'Director Agent output schema'
    }),
    description: 'Director Agent output schema',
    version: '1.0'
  });

  return registry;
}

/**
 * 新しいスキーマを動的に登録するヘルパー関数
 */
export function registerNewSchema<T>(
  name: string,
  zodSchema: any,
  description?: string,
  version: string = '1.0'
): void {
  const registry = SchemaRegistry.getInstance();
  
  registry.register({
    name,
    zodSchema,
    jsonSchema: registry.generateJSONSchema(zodSchema, {
      name,
      description
    }),
    description,
    version
  });
}

/**
 * スキーマの統計情報を表示する（デバッグ用）
 */
export function printSchemaStats(): void {
  const registry = SchemaRegistry.getInstance();
  const stats = registry.getStats();
  
  console.log('📊 Schema Registry Statistics:');
  console.log(`Total schemas: ${stats.total}`);
  console.log('Registered schemas:');
  stats.schemas.forEach(schema => {
    console.log(`  - ${schema.name} (v${schema.version || '1.0'})${schema.description ? `: ${schema.description}` : ''}`);
  });
} 