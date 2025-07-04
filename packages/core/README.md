# @motiva/core

このパッケージは Motiva Compose の **コアライブラリ** です。

## 現状
- EventBus 抽象 (`EventBusDriver`) とメモリ実装 (`MemoryDriver`)
- PluginRegistry : プラグイン(agents/providers) の動的ロード
- DAGScheduler   : consumes/produces で DAG を構築して並列実行
- Transform utils: map / filter / reduce / switchCase / pipe
- ファサード `EventBus.instance` でシングルトン利用

## 今後実装予定
- `JobQueueDriver`  : in-memory / Redis / NATS などのジョブキュー抽象

## ビルド
```
pnpm --filter @motiva/core build
``` 