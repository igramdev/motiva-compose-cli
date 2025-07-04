import { AgentMeta, AgentPlugin, AgentContext } from '../types.js';

export function createLLMWrapper(meta: AgentMeta): AgentPlugin {
  return {
    meta,
    async run(input: unknown, ctx: AgentContext): Promise<unknown> {
      // TODO: 実際には provider プラグインを検索して generateJSON を呼び出す
      console.warn('[LLMWrapper] 未実装: provider 呼び出しを省略し echo 返却します');
      await ctx.emit(meta.produces, input);
      return input;
    }
  };
} 