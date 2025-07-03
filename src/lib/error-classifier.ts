import { ZodError } from 'zod';
import chalk from 'chalk';

export enum ErrorType {
  NETWORK = 'network',
  API_LIMIT = 'api_limit',
  BUDGET = 'budget',
  VALIDATION = 'validation',
  TIMEOUT = 'timeout',
  SCHEMA = 'schema',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  retryable: boolean;
  retryDelay?: number;
  recoveryStrategy?: string;
}

export class ErrorClassifier {
  static classify(error: any): ErrorInfo {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code || '';
    const statusCode = error.status || error.statusCode;

    // ネットワークエラー
    if (this.isNetworkError(errorMessage, errorCode, statusCode)) {
      return {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        message: 'ネットワーク接続エラー',
        retryable: true,
        retryDelay: 5000,
        recoveryStrategy: '指数バックオフでリトライ'
      };
    }

    // API制限エラー
    if (this.isApiLimitError(errorMessage, statusCode)) {
      return {
        type: ErrorType.API_LIMIT,
        severity: ErrorSeverity.HIGH,
        message: 'API制限に達しました',
        retryable: true,
        retryDelay: 60000,
        recoveryStrategy: '1分後にリトライ'
      };
    }

    // 予算制限エラー
    if (this.isBudgetError(errorMessage)) {
      return {
        type: ErrorType.BUDGET,
        severity: ErrorSeverity.CRITICAL,
        message: '予算制限に達しました',
        retryable: false,
        recoveryStrategy: '予算設定の見直しが必要'
      };
    }

    // バリデーションエラー
    if (this.isValidationError(errorMessage)) {
      return {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        message: 'データバリデーションエラー',
        retryable: false,
        recoveryStrategy: '入力データの修正が必要'
      };
    }

    // タイムアウトエラー
    if (this.isTimeoutError(errorMessage, errorCode)) {
      return {
        type: ErrorType.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        message: '処理がタイムアウトしました',
        retryable: true,
        retryDelay: 10000,
        recoveryStrategy: 'タイムアウト時間を延長してリトライ'
      };
    }

    // スキーマエラー
    if (this.isSchemaError(errorMessage)) {
      return {
        type: ErrorType.SCHEMA,
        severity: ErrorSeverity.HIGH,
        message: 'スキーマバリデーションエラー',
        retryable: false,
        recoveryStrategy: 'スキーマ定義の確認が必要'
      };
    }

    // 未知のエラー
    return {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.HIGH,
      message: '予期しないエラーが発生しました',
      retryable: false,
      recoveryStrategy: 'ログを確認して手動対応'
    };
  }

  private static isNetworkError(message: string, code: string, statusCode?: number): boolean {
    return message.includes('network') ||
           message.includes('connection') ||
           message.includes('fetch') ||
           code === 'ENOTFOUND' ||
           code === 'ECONNREFUSED' ||
           code === 'ETIMEDOUT' ||
           statusCode === 502 ||
           statusCode === 503 ||
           statusCode === 504;
  }

  private static isApiLimitError(message: string, statusCode?: number): boolean {
    return message.includes('rate limit') ||
           message.includes('quota') ||
           message.includes('limit') ||
           statusCode === 429;
  }

  private static isBudgetError(message: string): boolean {
    return message.includes('予算制限') ||
           message.includes('budget') ||
           message.includes('cost');
  }

  private static isValidationError(message: string): boolean {
    return message.includes('validation') ||
           message.includes('invalid') ||
           message.includes('required') ||
           message.includes('format');
  }

  private static isTimeoutError(message: string, code: string): boolean {
    return message.includes('timeout') ||
           message.includes('timed out') ||
           code === 'ETIMEDOUT';
  }

  private static isSchemaError(message: string): boolean {
    return message.includes('schema') ||
           message.includes('json') ||
           message.includes('parse');
  }

  static logError(error: any, context?: string): void {
    const errorInfo = this.classify(error);
    const contextPrefix = context ? `[${context}] ` : '';

    console.error(chalk.red(`❌ ${contextPrefix}${errorInfo.message}`));
    console.error(chalk.gray(`   種類: ${errorInfo.type}`));
    console.error(chalk.gray(`   重要度: ${errorInfo.severity}`));
    console.error(chalk.gray(`   リトライ可能: ${errorInfo.retryable ? 'はい' : 'いいえ'}`));
    
    if (errorInfo.recoveryStrategy) {
      console.error(chalk.yellow(`   対処法: ${errorInfo.recoveryStrategy}`));
    }

    if (errorInfo.retryDelay) {
      console.error(chalk.blue(`   リトライ待機時間: ${errorInfo.retryDelay}ms`));
    }
  }

  static shouldRetry(error: any): boolean {
    return this.classify(error).retryable;
  }

  static getRetryDelay(error: any): number {
    return this.classify(error).retryDelay || 1000;
  }
} 