import { AgentConfig, PipelineConfig, ParallelGroup } from '../schemas/pipeline.js';
import { BaseAgent } from './agent-orchestrator.js';
import { Semaphore } from './semaphore.js';
import chalk from 'chalk';

export class ParallelPipelineOrchestrator {
  private maxConcurrency: number;

  constructor(maxConcurrency: number = 3) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * パイプライン定義に従い、依存解決しながらグループ単位で真の並列実行
   */
  async execute(
    pipelineConfig: PipelineConfig,
    agentFactory: (agentConfig: AgentConfig) => BaseAgent,
    userInput: any,
    options: {
      showProgress?: boolean;
      useCache?: boolean;
    } = {}
  ): Promise<Record<string, any>> {
    const { showProgress = true } = options;
    const agentMap = new Map<string, AgentConfig>(pipelineConfig.agents.map(a => [a.name, a]));
    const agentResults: Record<string, any> = {};
    const completed = new Set<string>();
    let readyAgents: AgentConfig[] = [];
    let step = 0;

    // 依存解決しながら実行
    while (completed.size < pipelineConfig.agents.length) {
      // 実行可能なエージェントを抽出
      readyAgents = pipelineConfig.agents.filter(agent => {
        if (completed.has(agent.name)) return false;
        if (!agent.dependencies || agent.dependencies.length === 0) return true;
        return agent.dependencies.every(dep => completed.has(dep));
      });

      if (readyAgents.length === 0) {
        throw new Error('依存関係の解決に失敗しました。循環参照または未解決の依存があります。');
      }

      // 並列グループと直列グループに分ける
      const parallelAgents = readyAgents.filter(a => a.parallel);
      const serialAgents = readyAgents.filter(a => !a.parallel);

      // 直列エージェントを順次実行
      for (const agentConfig of serialAgents) {
        step++;
        if (showProgress) {
          console.log(chalk.cyan(`🔸 [${step}] ${agentConfig.name} (直列)`));
        }
        const agent = agentFactory(agentConfig);
        const input = this.resolveInput(agentConfig, agentResults, userInput);
        const result = await agent.run(input);
        agentResults[agentConfig.name] = result;
        completed.add(agentConfig.name);
      }

      // 並列エージェントをグループごとにまとめて実行
      const groupMap: Record<string, AgentConfig[]> = {};
      for (const agentConfig of parallelAgents) {
        const group = agentConfig.parallelGroup || '__default__';
        if (!groupMap[group]) groupMap[group] = [];
        groupMap[group].push(agentConfig);
      }
      for (const groupName of Object.keys(groupMap)) {
        const groupAgents = groupMap[groupName];
        if (!groupAgents || groupAgents.length === 0) continue;
        const groupDef = (pipelineConfig.parallelGroups || []).find(g => g.name === groupName);
        const groupConcurrency = groupDef?.maxConcurrency || this.maxConcurrency;
        const semaphore = new Semaphore(groupConcurrency);
        step++;
        if (showProgress) {
          console.log(chalk.cyan(`🔹 [${step}] 並列グループ: ${groupName} (${groupAgents.length}エージェント, 最大${groupConcurrency}同時)`));
        }
        await Promise.all(groupAgents.map(async agentConfig => {
          await semaphore.acquire();
          try {
            let attempt = 0;
            const maxRetry = groupDef?.retryCount ?? 0;
            const retryDelay = groupDef?.retryDelay ?? 1000;
            let lastError: any = null;
            while (attempt <= maxRetry) {
              try {
                if (showProgress) {
                  console.log(chalk.gray(`  ▶️ 並列: ${agentConfig.name} (試行${attempt + 1}/${maxRetry + 1})`));
                }
                const agent = agentFactory(agentConfig);
                const input = this.resolveInput(agentConfig, agentResults, userInput);
                const result = await agent.run(input);
                agentResults[agentConfig.name] = result;
                completed.add(agentConfig.name);
                if (showProgress) {
                  console.log(chalk.green(`  ✅ 並列: ${agentConfig.name} 完了 (試行${attempt + 1})`));
                }
                return;
              } catch (err) {
                lastError = err;
                attempt++;
                if (attempt <= maxRetry) {
                  if (showProgress) {
                    console.log(chalk.yellow(`  🔄 リトライ: ${agentConfig.name} (${attempt}/${maxRetry})`));
                  }
                  await new Promise(res => setTimeout(res, retryDelay));
                } else {
                  if (showProgress) {
                    console.log(chalk.red(`  ❌ 並列: ${agentConfig.name} 失敗 (最大リトライ到達)`));
                  }
                  throw lastError;
                }
              }
            }
          } finally {
            semaphore.release();
          }
        }));
      }
    }
    if (showProgress) {
      console.log(chalk.blue('🎯 パイプライン全体完了'));
    }
    return agentResults;
  }

  /**
   * エージェントの入力を依存関係から解決
   */
  private resolveInput(agentConfig: AgentConfig, agentResults: Record<string, any>, userInput: any) {
    if (!agentConfig.dependencies || agentConfig.dependencies.length === 0) {
      return agentConfig.input || userInput;
    }
    // 依存エージェントの出力を配列で渡す
    return agentConfig.dependencies.map(dep => agentResults[dep]);
  }
} 