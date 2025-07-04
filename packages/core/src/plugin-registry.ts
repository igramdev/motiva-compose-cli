import fs from 'fs/promises';
import path from 'path';
import { AgentMeta, AgentPlugin, ProviderPlugin } from './types.js';

/**
 * 極小実装: JSON 定義を読み込んでメモリ上に保持するだけ。
 * glob ライブラリを用いず、ディレクトリ直下と 1 階層下のみを見る簡易版。
 */
export class PluginRegistry {
  private agents = new Map<string, AgentPlugin>();
  private providers = new Map<string, ProviderPlugin>();

  async load(pluginDir: string): Promise<void> {
    const entries = await fs.readdir(pluginDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subDir = path.join(pluginDir, entry.name);
      const agentJson = path.join(subDir, 'agent.json');
      try {
        const meta: AgentMeta = JSON.parse(await fs.readFile(agentJson, 'utf8'));
        const plugin = await this.instantiateAgent(meta, subDir);
        this.agents.set(meta.id, plugin);
      } catch (_) {
        // no agent.json
      }

      const providerJson = path.join(subDir, 'provider.json');
      try {
        const meta = JSON.parse(await fs.readFile(providerJson, 'utf8')) as ProviderPlugin;
        this.providers.set(meta.id, meta);
      } catch (_) {
        // no provider.json
      }
    }
  }

  getAgent(id: string): AgentPlugin | undefined {
    return this.agents.get(id);
  }
  listAgents(): AgentPlugin[] {
    return [...this.agents.values()];
  }

  getProvider(id: string): ProviderPlugin | undefined {
    return this.providers.get(id);
  }

  private async instantiateAgent(meta: AgentMeta, baseDir: string): Promise<AgentPlugin> {
    if (meta.module) {
      const modPath = path.resolve(baseDir, meta.module);
      const mod = await import(modPath);
      const Cls = mod.default || mod.Agent || mod;
      return new Cls(meta) as AgentPlugin;
    }
    // コードレス LLM or core-transform はランタイムラッパー
    const { createLLMWrapper } = await import('./wrappers/llm-wrapper.js');
    return createLLMWrapper(meta);
  }
} 