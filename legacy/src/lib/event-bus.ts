import { EventEmitter } from 'events';
import chalk from 'chalk';

export interface PipelineEvent {
  id: string;
  type: 'plan' | 'synth' | 'compose' | 'render' | 'validate';
  data: any;
  timestamp: number;
  metadata?: {
    agent?: string;
    model?: string;
    cost?: number;
    duration?: number;
  };
}

export interface EventHandler<T = any> {
  (event: PipelineEvent): Promise<T>;
}

export interface EventSubscription {
  unsubscribe: () => void;
}

/**
 * イベント駆動Orchestratorの基盤
 * メモリベースから開始し、後でRedis/NATSに拡張可能
 */
export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private eventHistory: PipelineEvent[] = [];
  private maxHistorySize = 1000;

  private constructor() {
    super();
    this.setMaxListeners(100); // 多数のリスナーを許可
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * イベントを発行
   */
  async publish(event: Omit<PipelineEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: PipelineEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now()
    };

    console.log(chalk.blue(`📡 イベント発行: ${event.type} (${fullEvent.id})`));
    
    // イベント履歴に追加
    this.eventHistory.push(fullEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // イベントを発行
    this.emit(event.type, fullEvent);
    this.emit('*', fullEvent); // ワイルドカードリスナー
  }

  /**
   * イベントを購読
   */
  subscribe<T = any>(
    eventType: string | string[],
    handler: EventHandler<T>
  ): EventSubscription {
    const types = Array.isArray(eventType) ? eventType : [eventType];
    
    const wrappedHandler = async (event: PipelineEvent) => {
      try {
        console.log(chalk.gray(`📥 イベント受信: ${event.type} (${event.id})`));
        await handler(event);
      } catch (error) {
        console.error(chalk.red(`❌ イベントハンドラーエラー: ${error}`));
        throw error;
      }
    };

    types.forEach(type => {
      this.on(type, wrappedHandler);
    });

    return {
      unsubscribe: () => {
        types.forEach(type => {
          this.off(type, wrappedHandler);
        });
      }
    };
  }

  /**
   * パイプライン全体を監視
   */
  subscribeToPipeline(handler: EventHandler): EventSubscription {
    return this.subscribe('*', handler);
  }

  /**
   * イベント履歴を取得
   */
  getEventHistory(filter?: { type?: string; limit?: number }): PipelineEvent[] {
    let events = [...this.eventHistory];
    
    if (filter?.type) {
      events = events.filter(e => e.type === filter.type);
    }
    
    if (filter?.limit) {
      events = events.slice(-filter.limit);
    }
    
    return events;
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    averageProcessingTime: number;
  } {
    const eventsByType: Record<string, number> = {};
    let totalProcessingTime = 0;
    let processedEvents = 0;

    this.eventHistory.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      if (event.metadata?.duration) {
        totalProcessingTime += event.metadata.duration;
        processedEvents++;
      }
    });

    return {
      totalEvents: this.eventHistory.length,
      eventsByType,
      averageProcessingTime: processedEvents > 0 ? totalProcessingTime / processedEvents : 0
    };
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * パイプライン実行の状態管理
 */
export class PipelineState {
  private state: Map<string, any> = new Map();
  private listeners: Map<string, Set<(value: any) => void>> = new Map();

  set(key: string, value: any): void {
    this.state.set(key, value);
    this.notifyListeners(key, value);
  }

  get(key: string): any {
    return this.state.get(key);
  }

  subscribe(key: string, listener: (value: any) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    // 現在の値を即座に通知
    const currentValue = this.state.get(key);
    if (currentValue !== undefined) {
      listener(currentValue);
    }

    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  private notifyListeners(key: string, value: any): void {
    this.listeners.get(key)?.forEach(listener => {
      try {
        listener(value);
      } catch (error) {
        console.error(chalk.red(`❌ 状態リスナーエラー: ${error}`));
      }
    });
  }

  clear(): void {
    this.state.clear();
    this.listeners.clear();
  }
} 