export interface AgentMeta {
  id: string;
  consumes: string[];
  produces: string;
  type: 'llm' | 'js' | 'core-transform' | string;
  module?: string;
  provider?: {
    id: string;
    model: string;
    [k: string]: unknown;
  };
  prompt?: {
    system: string;
    user?: string;
  };
  schema?: {
    input?: string;
    output?: string;
  };
  config?: Record<string, unknown>;
  cache?: boolean;
  budget?: {
    maxTokens?: number;
    wallTimeSec?: number;
  };
  transform?: unknown; // core-transform 用
}

export interface AgentPlugin {
  meta: AgentMeta;
  run(input: unknown, ctx: AgentContext): Promise<unknown>;
}

export interface AgentContext {
  emit: (type: string, payload: unknown) => Promise<void>;
  bus: import('./event-bus.js').EventBus;
}

export interface ProviderPlugin {
  id: string;
  models: string[];
  generateJSON?(request: unknown, outputSchemaPath?: string): Promise<unknown>;
} 