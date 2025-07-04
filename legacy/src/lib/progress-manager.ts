import chalk from 'chalk';
import { EventEmitter } from 'events';

/**
 * プログレスイベントの型定義
 */
export interface ProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  task: string;
  current?: number;
  total?: number;
  message?: string;
  duration?: number;
}

/**
 * プログレスマネージャー
 * 長時間処理の進捗を表示し、ユーザー体験を向上させます
 */
export class ProgressManager extends EventEmitter {
  private tasks: Map<string, {
    startTime: number;
    current: number;
    total: number;
    message: string;
  }> = new Map();

  private isVerbose: boolean;
  private showProgress: boolean;

  constructor(options: { verbose?: boolean; showProgress?: boolean } = {}) {
    super();
    this.isVerbose = options.verbose ?? false;
    this.showProgress = options.showProgress ?? true;
  }

  /**
   * タスクを開始
   */
  startTask(task: string, total: number = 100, message: string = ''): void {
    const taskInfo = {
      startTime: Date.now(),
      current: 0,
      total,
      message
    };

    this.tasks.set(task, taskInfo);

    if (this.showProgress) {
      console.log(chalk.blue(`🚀 ${task} 開始${message ? `: ${message}` : ''}`));
    }

    this.emit('progress', {
      type: 'start',
      task,
      current: 0,
      total,
      message
    });
  }

  /**
   * タスクの進捗を更新
   */
  updateProgress(task: string, current: number, message?: string): void {
    const taskInfo = this.tasks.get(task);
    if (!taskInfo) return;

    taskInfo.current = current;
    if (message) {
      taskInfo.message = message;
    }

    const percentage = Math.round((current / taskInfo.total) * 100);
    const duration = Date.now() - taskInfo.startTime;

    if (this.showProgress) {
      const progressBar = this.createProgressBar(percentage);
      const timeInfo = this.formatDuration(duration);
      
      console.log(`\r${chalk.cyan(task)} ${progressBar} ${percentage}% ${timeInfo}${message ? ` - ${message}` : ''}`);
    }

    this.emit('progress', {
      type: 'progress',
      task,
      current,
      total: taskInfo.total,
      message,
      duration
    });
  }

  /**
   * タスクを完了
   */
  completeTask(task: string, message?: string): void {
    const taskInfo = this.tasks.get(task);
    if (!taskInfo) return;

    const duration = Date.now() - taskInfo.startTime;

    if (this.showProgress) {
      const timeInfo = this.formatDuration(duration);
      console.log(chalk.green(`✅ ${task} 完了 (${timeInfo})${message ? ` - ${message}` : ''}`));
    }

    this.tasks.delete(task);

    this.emit('progress', {
      type: 'complete',
      task,
      current: taskInfo.total,
      total: taskInfo.total,
      message,
      duration
    });
  }

  /**
   * タスクでエラーが発生
   */
  errorTask(task: string, error: string): void {
    const taskInfo = this.tasks.get(task);
    const duration = taskInfo ? Date.now() - taskInfo.startTime : 0;

    if (this.showProgress) {
      const timeInfo = this.formatDuration(duration);
      console.log(chalk.red(`❌ ${task} エラー (${timeInfo}) - ${error}`));
    }

    this.tasks.delete(task);

    this.emit('progress', {
      type: 'error',
      task,
      message: error,
      duration
    });
  }

  /**
   * プログレスバーを作成
   */
  private createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const filledBar = chalk.green('█'.repeat(filled));
    const emptyBar = chalk.gray('░'.repeat(empty));
    
    return `[${filledBar}${emptyBar}]`;
  }

  /**
   * 時間をフォーマット
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * 現在のタスク状況を取得
   */
  getTaskStatus(): Array<{
    task: string;
    current: number;
    total: number;
    percentage: number;
    duration: number;
    message: string;
  }> {
    const status = [];
    
    for (const [task, info] of this.tasks.entries()) {
      status.push({
        task,
        current: info.current,
        total: info.total,
        percentage: Math.round((info.current / info.total) * 100),
        duration: Date.now() - info.startTime,
        message: info.message
      });
    }

    return status;
  }

  /**
   * すべてのタスクをクリア
   */
  clear(): void {
    this.tasks.clear();
  }

  /**
   * 詳細モードを設定
   */
  setVerbose(verbose: boolean): void {
    this.isVerbose = verbose;
  }

  /**
   * プログレス表示を設定
   */
  setShowProgress(show: boolean): void {
    this.showProgress = show;
  }
}

/**
 * プログレスラッパー
 * 関数をプログレス表示付きで実行
 */
export async function withProgress<T>(
  task: string,
  operation: (updateProgress: (current: number, message?: string) => void) => Promise<T>,
  total: number = 100,
  initialMessage?: string
): Promise<T> {
  const progress = new ProgressManager();
  
  return new Promise<T>((resolve, reject) => {
    progress.startTask(task, total, initialMessage);
    
    let lastUpdate = 0;
    const updateProgress = (current: number, message?: string) => {
      const now = Date.now();
      if (now - lastUpdate > 100) { // 100ms間隔で更新
        progress.updateProgress(task, current, message);
        lastUpdate = now;
      }
    };

    operation(updateProgress)
      .then(result => {
        progress.completeTask(task);
        resolve(result);
      })
      .catch(error => {
        progress.errorTask(task, error instanceof Error ? error.message : 'Unknown error');
        reject(error);
      });
  });
} 