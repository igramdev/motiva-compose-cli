import { EventEmitter } from 'eventemitter3';

/** 任意のイベント型 */
export interface Event<T = unknown> {
  id: string;      // UUID v4 等
  type: string;    // ルーティングキー（完全自由文字列）
  payload: T;
  ts: number;      // Unix ms
  meta?: Record<string, unknown>;
}

export type Unsubscribe = () => void;

/**
 * EventBusDriver 抽象
 * 実装例: MemoryDriver / RedisDriver / NATSDriver など
 */
export interface EventBusDriver {
  publish: (event: Event) => Promise<void>;
  subscribe: (types: string[] | '*', handler: (e: Event) => Promise<void>) => Promise<Unsubscribe>;
  close?: () => Promise<void>;
}

/**
 * メモリ実装: 開発・テスト用途
 */
export class MemoryDriver implements EventBusDriver {
  private emitter = new EventEmitter();

  async publish(event: Event): Promise<void> {
    // '*' ワイルドカードにも配信
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event);
  }

  async subscribe(types: string[] | '*', handler: (e: Event) => Promise<void>): Promise<Unsubscribe> {
    const keys = types === '*' ? ['*'] : types;
    for (const key of keys) {
      this.emitter.on(key, handler);
    }
    return () => {
      for (const key of keys) {
        this.emitter.off(key, handler);
      }
    };
  }
}

/**
 * EventBus ファサード
 */
export class EventBus {
  private static _instance: EventBus;

  static get instance(): EventBus {
    if (!this._instance) {
      this._instance = new EventBus(new MemoryDriver());
    }
    return this._instance;
  }

  constructor(private driver: EventBusDriver) {}

  publish<T = unknown>(type: string, payload: T, meta?: Record<string, unknown>): Promise<void> {
    const evt: Event<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      ts: Date.now(),
      meta
    };
    return this.driver.publish(evt);
  }

  subscribe(types: string[] | '*', handler: (e: Event) => Promise<void>): Promise<Unsubscribe> {
    return this.driver.subscribe(types, handler);
  }

  /** driver を差し替え */
  setDriver(driver: EventBusDriver) {
    this.driver = driver;
  }
} 