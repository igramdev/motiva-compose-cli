import { ZodError } from 'zod';

export type MotivaErrorType =
  | 'network'
  | 'rate_limit'
  | 'timeout'
  | 'validation'
  | 'openai_api'
  | 'filesystem'
  | 'fatal'
  | 'unknown';

export interface MotivaError {
  type: MotivaErrorType;
  message: string;
  originalError?: any;
  retriable: boolean;
}

/**
 * エラーをMotivaError型に分類
 */
export function classifyError(error: any): MotivaError {
  // Zodバリデーションエラー
  if (error instanceof ZodError) {
    return {
      type: 'validation',
      message: error.message,
      originalError: error,
      retriable: false
    };
  }

  // OpenAI APIエラー
  if (error?.status && error?.error?.type) {
    if (error.error.type === 'rate_limit_exceeded' || error.status === 429) {
      return {
        type: 'rate_limit',
        message: error.error.message || 'Rate limit exceeded',
        originalError: error,
        retriable: true
      };
    }
    if (error.status === 408 || error.error.type === 'timeout') {
      return {
        type: 'timeout',
        message: error.error.message || 'Request timeout',
        originalError: error,
        retriable: true
      };
    }
    if (error.status >= 500) {
      return {
        type: 'openai_api',
        message: error.error.message || 'OpenAI API server error',
        originalError: error,
        retriable: true
      };
    }
    return {
      type: 'openai_api',
      message: error.error.message || 'OpenAI API error',
      originalError: error,
      retriable: false
    };
  }

  // ネットワークエラー
  if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNRESET' || error?.code === 'ECONNREFUSED') {
    return {
      type: 'network',
      message: error.message || 'Network error',
      originalError: error,
      retriable: true
    };
  }

  // ファイルシステムエラー
  if (error?.code && error?.code.startsWith('E')) {
    return {
      type: 'filesystem',
      message: error.message || 'Filesystem error',
      originalError: error,
      retriable: false
    };
  }

  // タイムアウト
  if (error?.name === 'TimeoutError') {
    return {
      type: 'timeout',
      message: error.message || 'Timeout',
      originalError: error,
      retriable: true
    };
  }

  // 致命的エラー
  if (error?.fatal === true) {
    return {
      type: 'fatal',
      message: error.message || 'Fatal error',
      originalError: error,
      retriable: false
    };
  }

  // 不明なエラー
  return {
    type: 'unknown',
    message: error?.message || 'Unknown error',
    originalError: error,
    retriable: false
  };
} 