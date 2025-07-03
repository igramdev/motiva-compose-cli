import { ConfigurationManager } from './config-manager.js';
import { ErrorClassifier, ErrorType } from './error-classifier.js';
import chalk from 'chalk';

export interface RetryOptions {
  maxAttempts?: number;
  backoffMs?: number;
  onRetry?: (attempt: number, error: any, delayMs: number) => void;
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
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const errorInfo = ErrorClassifier.classify(error);
      lastError = error;
      
      // リトライ不可能なエラーの場合は即座にスロー
      if (!errorInfo.retryable) {
        console.log(chalk.red(`❌ 致命的エラー (${errorInfo.type}): ${errorInfo.message}`));
        throw error;
      }
      
      // 最後の試行の場合はエラーをスロー
      if (attempt === maxAttempts) {
        console.log(chalk.red(`❌ 最大リトライ回数 (${maxAttempts}) に達しました`));
        console.log(chalk.red(`最終エラー (${errorInfo.type}): ${errorInfo.message}`));
        throw error;
      }
      
      // 指数バックオフで待機
      const delayMs = backoffMs * Math.pow(2, attempt - 1);
      
      console.log(chalk.yellow(`⚠️  リトライ ${attempt}/${maxAttempts} (${errorInfo.type}): ${errorInfo.message}`));
      console.log(chalk.gray(`⏳ ${delayMs}ms 待機中...`));
      
      // カスタムリトライコールバック
      if (options.onRetry) {
        options.onRetry(attempt, error, delayMs);
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
  retriableTypes: ErrorType[],
  options: RetryOptions = {}
): Promise<T> {
  const configManager = ConfigurationManager.getInstance();
  const retryConfig = await configManager.getRetryConfig();
  
  const maxAttempts = options.maxAttempts ?? retryConfig.maxAttempts;
  const backoffMs = options.backoffMs ?? retryConfig.backoffMs;
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const errorInfo = ErrorClassifier.classify(error);
      lastError = error;
      
      // 指定されたエラータイプでない場合は即座にスロー
      if (!retriableTypes.includes(errorInfo.type)) {
        console.log(chalk.red(`❌ リトライ対象外エラー (${errorInfo.type}): ${errorInfo.message}`));
        throw error;
      }
      
      // 最後の試行の場合はエラーをスロー
      if (attempt === maxAttempts) {
        console.log(chalk.red(`❌ 最大リトライ回数 (${maxAttempts}) に達しました`));
        console.log(chalk.red(`最終エラー (${errorInfo.type}): ${errorInfo.message}`));
        throw error;
      }
      
      // 指数バックオフで待機
      const delayMs = backoffMs * Math.pow(2, attempt - 1);
      
      console.log(chalk.yellow(`⚠️  リトライ ${attempt}/${maxAttempts} (${errorInfo.type}): ${errorInfo.message}`));
      console.log(chalk.gray(`⏳ ${delayMs}ms 待機中...`));
      
      // カスタムリトライコールバック
      if (options.onRetry) {
        options.onRetry(attempt, error, delayMs);
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // この行には到達しないはずだが、TypeScriptの型チェックのため
  throw lastError!;
} 