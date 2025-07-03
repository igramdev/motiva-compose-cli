import { Semaphore } from './semaphore.js';
import { BaseAgent } from './agent-orchestrator.js';
import { CacheManager } from './cache-manager.js';
import { withProgress } from './progress-manager.js';
import chalk from 'chalk';

/**
 * 並列処理オーケストレーター
 * 複数のエージェントを並列実行し、パフォーマンスを向上させます
 */
export class ParallelOrchestrator {
  private semaphore: Semaphore;
  private cacheManager: CacheManager;

  constructor(maxConcurrency: number = 3) {
    this.semaphore = new Semaphore(maxConcurrency);
    this.cacheManager = new CacheManager();
  }

  /**
   * 複数のエージェントを並列実行
   */
  async executeParallel<T>(
    agents: BaseAgent[],
    input: any,
    options: {
      showProgress?: boolean;
      timeoutMs?: number;
    } = {}
  ): Promise<T[]> {
    const { showProgress = true, timeoutMs = 120000 } = options;
    
    if (showProgress) {
      console.log(chalk.blue(`🚀 並列処理開始: ${agents.length}個のエージェント (最大同時実行: ${this.semaphore.availablePermits})`));
    }

    const startTime = Date.now();
    const results: T[] = [];
    const errors: Error[] = [];

    // 各エージェントのタスクを作成
    const tasks = agents.map(async (agent, index) => {
      try {
        // セマフォを取得
        await this.semaphore.acquire();
        
        if (showProgress) {
          console.log(chalk.gray(`  📋 ${agent.name} 開始 (${index + 1}/${agents.length})`));
        }

        const taskStartTime = Date.now();
        
        // タイムアウト付きでエージェントを実行
        const result = await Promise.race([
          agent.run(input),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout: ${agent.name}`)), timeoutMs)
          )
        ]);

        const taskDuration = Date.now() - taskStartTime;
        
        if (showProgress) {
          console.log(chalk.green(`  ✅ ${agent.name} 完了 (${taskDuration}ms)`));
        }

        return result as T;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        if (showProgress) {
          console.log(chalk.red(`  ❌ ${agent.name} 失敗: ${errorMsg}`));
        }
        errors.push(error as Error);
        throw error;
      } finally {
        // セマフォを解放
        this.semaphore.release();
      }
    });

    try {
      // すべてのタスクを並列実行
      const taskResults = await Promise.allSettled(tasks);
      
      // 結果を収集
      taskResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push(result.reason);
        }
      });

      const totalDuration = Date.now() - startTime;
      
      if (showProgress) {
        console.log(chalk.blue(`🎯 並列処理完了: ${results.length}/${agents.length} 成功 (${totalDuration}ms)`));
        
        if (errors.length > 0) {
          console.log(chalk.yellow(`⚠️  失敗: ${errors.length}個のエージェント`));
        }
      }

      return results;
    } catch (error) {
      if (showProgress) {
        console.log(chalk.red(`💥 並列処理で致命的エラー: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
      throw error;
    }
  }

  /**
   * パイプライン形式での並列実行（キャッシュ対応）
   * 前のエージェントの結果を次のエージェントに渡す
   */
  async executePipeline<T>(
    agents: BaseAgent[],
    initialInput: any,
    options: {
      showProgress?: boolean;
      timeoutMs?: number;
      useCache?: boolean;
    } = {}
  ): Promise<T> {
    const { showProgress = true, timeoutMs = 120000, useCache = true } = options;
    
    if (showProgress) {
      console.log(chalk.blue(`🔄 パイプライン処理開始: ${agents.length}段階`));
    }

    let currentInput = initialInput;
    
    // プログレスバーを使用したパイプライン実行
    return withProgress(
      'パイプライン処理',
      async (updateProgress) => {
        for (let i = 0; i < agents.length; i++) {
          const agent = agents[i];
          if (!agent) continue;
          
          const progress = ((i + 1) / agents.length) * 100;
          updateProgress(progress, `段階 ${i + 1}/${agents.length}: ${agent.name}`);
          
          if (showProgress) {
            console.log(chalk.cyan(`  📊 段階 ${i + 1}/${agents.length}: ${agent.name}`));
          }

          try {
            const startTime = Date.now();
            
            // キャッシュキーを生成
            const cacheKey = `${agent.name}_${JSON.stringify(currentInput).slice(0, 100)}`;
            
            let result;
            if (useCache) {
              // キャッシュから結果を取得を試行
              const cachedResult = await this.cacheManager.get(cacheKey);
              if (cachedResult) {
                if (showProgress) {
                  console.log(chalk.yellow(`  💾 ${agent.name} キャッシュヒット`));
                }
                result = cachedResult;
              } else {
                // キャッシュにない場合は実行
                result = await Promise.race([
                  agent.run(currentInput),
                  new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error(`Timeout: ${agent.name}`)), timeoutMs)
                  )
                ]);
                
                // 結果をキャッシュに保存
                await this.cacheManager.set(cacheKey, result, 24 * 60 * 60 * 1000); // 24時間
              }
            } else {
              // キャッシュを使用しない場合
              result = await Promise.race([
                agent.run(currentInput),
                new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error(`Timeout: ${agent.name}`)), timeoutMs)
                )
              ]);
            }

            const duration = Date.now() - startTime;
            currentInput = result;
            
            if (showProgress) {
              console.log(chalk.green(`  ✅ ${agent.name} 完了 (${duration}ms)`));
            }
          } catch (error) {
            if (showProgress) {
              console.log(chalk.red(`  ❌ ${agent.name} 失敗: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
            throw error;
          }
        }

        if (showProgress) {
          console.log(chalk.blue(`🎯 パイプライン処理完了`));
        }

        return currentInput as T;
      },
      100,
      'パイプライン処理の進行状況'
    );
  }

  /**
   * 独立したエージェントを真に並列実行
   * 各エージェントが独立して動作する場合に使用
   */
  async executeIndependentParallel<T>(
    agents: Array<{ agent: BaseAgent; input: any }>,
    options: {
      showProgress?: boolean;
      timeoutMs?: number;
    } = {}
  ): Promise<T[]> {
    const { showProgress = true, timeoutMs = 120000 } = options;
    
    if (showProgress) {
      console.log(chalk.blue(`🚀 真の並列処理開始: ${agents.length}個のエージェント (最大同時実行: ${this.semaphore.availablePermits})`));
    }

    const startTime = Date.now();

    // 各エージェントのタスクを作成（独立実行）
    const tasks = agents.map(async ({ agent, input }, index) => {
      try {
        // セマフォを取得
        await this.semaphore.acquire();
        
        if (showProgress) {
          console.log(chalk.gray(`  📋 ${agent.name} 開始 (${index + 1}/${agents.length})`));
        }

        const taskStartTime = Date.now();
        
        // タイムアウト付きでエージェントを実行
        const result = await Promise.race([
          agent.run(input),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout: ${agent.name}`)), timeoutMs)
          )
        ]);

        const taskDuration = Date.now() - taskStartTime;
        
        if (showProgress) {
          console.log(chalk.green(`  ✅ ${agent.name} 完了 (${taskDuration}ms)`));
        }

        return result as T;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        if (showProgress) {
          console.log(chalk.red(`  ❌ ${agent.name} 失敗: ${errorMsg}`));
        }
        throw error;
      } finally {
        // セマフォを解放
        this.semaphore.release();
      }
    });

    try {
      // すべてのタスクを並列実行
      const results = await Promise.all(tasks);
      const totalDuration = Date.now() - startTime;
      
      if (showProgress) {
        console.log(chalk.blue(`🎯 並列処理完了: ${results.length}/${agents.length} 成功 (${totalDuration}ms)`));
        console.log(chalk.gray(`📈 並列処理による時間短縮: ${this.calculateTimeSavings(agents.length, totalDuration)}`));
      }

      return results;
    } catch (error) {
      if (showProgress) {
        console.log(chalk.red(`💥 並列処理で致命的エラー: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
      throw error;
    }
  }

  /**
   * 時間短縮効果を計算
   */
  private calculateTimeSavings(agentCount: number, actualTime: number): string {
    // 逐次実行の場合の推定時間（各エージェントが平均15秒と仮定）
    const estimatedSequentialTime = agentCount * 15000;
    const timeSaved = estimatedSequentialTime - actualTime;
    const percentageSaved = (timeSaved / estimatedSequentialTime) * 100;
    
    return `${timeSaved}ms (${percentageSaved.toFixed(1)}%短縮)`;
  }

  /**
   * 現在の並列処理状況を取得
   */
  getStatus() {
    return {
      availablePermits: this.semaphore.availablePermits,
      waitingCount: this.semaphore.waitingCount,
      isBusy: this.semaphore.waitingCount > 0
    };
  }
} 