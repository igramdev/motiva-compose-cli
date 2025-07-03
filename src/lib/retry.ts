import { ConfigurationManager } from './config-manager.js';
import { classifyError, MotivaError } from './error-classifier.js';
import chalk from 'chalk';

export interface RetryOptions {
  maxAttempts?: number;
  backoffMs?: number;
  onRetry?: (attempt: number, error: MotivaError, delayMs: number) => void;
}

/**
 * 汎用リトライ関数
 * 設定ファイルのretry項目を参照し、指数バックオフでリトライ
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const configManager = ConfigurationManager.getInstance();
  const retryConfig = await configManager.getRetryConfig();
  
  const maxAttempts = options.maxAttempts ?? retryConfig.maxAttempts;
  const backoffMs = options.backoffMs ?? retryConfig.backoffMs;
  
  let lastError: MotivaError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const motivaError = classifyError(error);
      lastError = motivaError;
      
      // リトライ不可能なエラーの場合は即座にスロー
      if (!motivaError.retriable) {
        console.log(chalk.red(`❌ 致命的エラー (${motivaError.type}): ${motivaError.message}`));
        throw error;
      }
      
      // 最後の試行の場合はエラーをスロー
      if (attempt === maxAttempts) {
        console.log(chalk.red(`❌ 最大リトライ回数 (${maxAttempts}) に達しました`));
        console.log(chalk.red(`最終エラー (${motivaError.type}): ${motivaError.message}`));
        throw error;
      }
      
      // 指数バックオフで待機
      const delayMs = backoffMs * Math.pow(2, attempt - 1);
      
      console.log(chalk.yellow(`⚠️  リトライ ${attempt}/${maxAttempts} (${motivaError.type}): ${motivaError.message}`));
      console.log(chalk.gray(`⏳ ${delayMs}ms 待機中...`));
      
      // カスタムリトライコールバック
      if (options.onRetry) {
        options.onRetry(attempt, motivaError, delayMs);
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // この行には到達しないはずだが、TypeScriptの型チェックのため
  throw lastError!;
}

/**
 * 特定のエラータイプのみリトライする関数
 */
export async function withRetryForErrorTypes<T>(
  operation: () => Promise<T>,
  retriableTypes: string[],
  options: RetryOptions = {}
): Promise<T> {
  const configManager = ConfigurationManager.getInstance();
  const retryConfig = await configManager.getRetryConfig();
  
  const maxAttempts = options.maxAttempts ?? retryConfig.maxAttempts;
  const backoffMs = options.backoffMs ?? retryConfig.backoffMs;
  
  let lastError: MotivaError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const motivaError = classifyError(error);
      lastError = motivaError;
      
      // 指定されたエラータイプでない場合は即座にスロー
      if (!retriableTypes.includes(motivaError.type)) {
        console.log(chalk.red(`❌ リトライ対象外エラー (${motivaError.type}): ${motivaError.message}`));
        throw error;
      }
      
      // 最後の試行の場合はエラーをスロー
      if (attempt === maxAttempts) {
        console.log(chalk.red(`❌ 最大リトライ回数 (${maxAttempts}) に達しました`));
        console.log(chalk.red(`最終エラー (${motivaError.type}): ${motivaError.message}`));
        throw error;
      }
      
      // 指数バックオフで待機
      const delayMs = backoffMs * Math.pow(2, attempt - 1);
      
      console.log(chalk.yellow(`⚠️  リトライ ${attempt}/${maxAttempts} (${motivaError.type}): ${motivaError.message}`));
      console.log(chalk.gray(`⏳ ${delayMs}ms 待機中...`));
      
      // カスタムリトライコールバック
      if (options.onRetry) {
        options.onRetry(attempt, motivaError, delayMs);
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // この行には到達しないはずだが、TypeScriptの型チェックのため
  throw lastError!;
} 