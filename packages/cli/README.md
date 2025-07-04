# @motiva/cli

Motiva Compose の公式 CLI ツールです。

## 目的
- `EventBus` / `Scheduler` を利用してパイプラインを実行
- プラグインディレクトリをロードし、エージェントを動的に解決
- JSON で定義されたパイプラインを `run` コマンドで実行

## MVP スコープ
1. `motiva-compose run --pipeline <file> --plugins <dir>`
2. `motiva-compose list agents` で登録済みエージェント一覧を表示

CLI はまだ空のスケルトンです。今後 `packages/cli/src/index.ts` に実装を追加します。 