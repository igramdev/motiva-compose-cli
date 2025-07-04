/**
 * Semaphore: 並列処理の制御を行うクラス
 * 同時実行数を制限し、リソースの競合を防ぎます
 */
export class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * セマフォを取得（許可を待機）
   */
  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  /**
   * セマフォを解放（許可を返却）
   */
  release(): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) next();
    } else {
      this.permits++;
    }
  }

  /**
   * 現在の利用可能な許可数を取得
   */
  get availablePermits(): number {
    return this.permits;
  }

  /**
   * 待機中のタスク数を取得
   */
  get waitingCount(): number {
    return this.waitQueue.length;
  }
} 