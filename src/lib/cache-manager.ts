import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import chalk from 'chalk';

/**
 * キャッシュエントリの型定義
 */
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  metadata?: Record<string, any>;
}

/**
 * キャッシュマネージャー
 * 中間結果を永続化し、パフォーマンスを向上させます
 */
export class CacheManager {
  private cacheDir: string;
  private maxSize: number; // 最大キャッシュサイズ（MB）
  private cleanupInterval: number; // クリーンアップ間隔（ms）
  private cleanupStarted: boolean = false;

  constructor(cacheDir: string = '.motiva/cache', maxSize: number = 100) {
    this.cacheDir = cacheDir;
    this.maxSize = maxSize * 1024 * 1024; // MB to bytes
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24時間
  }

  /**
   * キャッシュキーを生成
   */
  private generateKey(data: any, prefix: string = ''): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return `${prefix}${hash.digest('hex')}`;
  }

  /**
   * キャッシュファイルのパスを取得
   */
  private getCacheFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  /**
   * キャッシュディレクトリを初期化
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * データをキャッシュに保存
   */
  async set<T>(
    key: string,
    data: T,
    ttl: number = 24 * 60 * 60 * 1000, // デフォルト24時間
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.ensureCacheDir();
    
    // 初回使用時にクリーンアップを開始
    this.startCleanup();

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl,
      metadata
    };

    const filePath = this.getCacheFilePath(key);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
  }

  /**
   * キャッシュからデータを取得
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const filePath = this.getCacheFilePath(key);
      const content = await fs.readFile(filePath, 'utf8');
      const entry: CacheEntry<T> = JSON.parse(content);

      // TTLチェック
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * キャッシュからデータを削除
   */
  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getCacheFilePath(key);
      await fs.unlink(filePath);
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  /**
   * キャッシュをクリア
   */
  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
      console.log(chalk.blue('🗑️  キャッシュをクリアしました'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  キャッシュクリアに失敗しました'));
    }
  }

  /**
   * キャッシュの統計情報を取得
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestEntry: number;
    newestEntry: number;
  }> {
    try {
      // キャッシュディレクトリが存在するかチェック
      await this.ensureCacheDir();
      
      // 初回使用時にクリーンアップを開始
      this.startCleanup();
      
      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        // キャッシュファイルが存在しない場合
        return {
          totalFiles: 0,
          totalSize: 0,
          oldestEntry: Date.now(),
          newestEntry: Date.now() // 現在時刻を設定
        };
      }

      let totalSize = 0;
      let oldestEntry = Date.now();
      let newestEntry = 0;
      let validEntries = 0;

      for (const file of jsonFiles) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        try {
          const content = await fs.readFile(filePath, 'utf8');
          const entry: CacheEntry = JSON.parse(content);
          
          // TTLチェック
          const now = Date.now();
          if (now - entry.timestamp <= entry.ttl) {
            oldestEntry = Math.min(oldestEntry, entry.timestamp);
            newestEntry = Math.max(newestEntry, entry.timestamp);
            validEntries++;
          } else {
            // 期限切れのファイルを削除
            await fs.unlink(filePath);
          }
        } catch {
          // 破損したファイルを削除
          await fs.unlink(filePath);
        }
      }

      // 有効なエントリがない場合
      if (validEntries === 0) {
        return {
          totalFiles: 0,
          totalSize: 0,
          oldestEntry: Date.now(),
          newestEntry: Date.now()
        };
      }

      return {
        totalFiles: validEntries,
        totalSize,
        oldestEntry,
        newestEntry
      };
    } catch (error) {
      // エラーが発生した場合
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestEntry: Date.now(),
        newestEntry: Date.now()
      };
    }
  }

  /**
   * 期限切れのキャッシュを削除
   */
  private async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const entry: CacheEntry = JSON.parse(content);

            if (now - entry.timestamp > entry.ttl) {
              await fs.unlink(filePath);
              deletedCount++;
            }
          } catch {
            // 破損したファイルは削除
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        console.log(chalk.gray(`🧹 キャッシュクリーンアップ: ${deletedCount}個のファイルを削除`));
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  キャッシュクリーンアップに失敗しました'));
    }
  }

  /**
   * 定期的なクリーンアップを開始
   */
  private startCleanup(): void {
    if (this.cleanupStarted) {
      return; // 既に開始済み
    }
    
    this.cleanupStarted = true;
    
    // 一度だけクリーンアップを実行
    setTimeout(() => {
      this.cleanup();
    }, 5000); // 5秒後に初回クリーンアップ
    
    // その後、定期的にクリーンアップを実行
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * キャッシュサイズを制限内に保つ
   */
  async enforceSizeLimit(): Promise<void> {
    const stats = await this.getStats();
    
    if (stats.totalSize > this.maxSize) {
      console.log(chalk.yellow(`⚠️  キャッシュサイズが上限を超過: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`));
      
      // 古いファイルから削除
      const files = await fs.readdir(this.cacheDir);
      const fileInfos = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          fileInfos.push({ file, path: filePath, mtime: stats.mtime });
        }
      }

      // 古い順にソート
      fileInfos.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      // 古いファイルから削除
      for (const fileInfo of fileInfos) {
        await fs.unlink(fileInfo.path);
        const newStats = await this.getStats();
        
        if (newStats.totalSize <= this.maxSize) {
          break;
        }
      }

      console.log(chalk.blue('✅ キャッシュサイズを制限内に調整しました'));
    }
  }
} 