# Motiva Compose – Monorepo (Reboot)

# 目的とゴール設定
このプロジェクトは Motiva Compose CLIです。


このリポジトリはゼロベースで再設計中です。現状は以下のディレクトリ構成のみ存在します。

```
legacy/          # 旧実装一式（参照用）
packages/
  core/          # EventBus, Scheduler などコアライブラリを実装予定
  cli/           # CLI インターフェースを実装予定
  plugins/       # reference プラグイン群 (agents / providers / buses)
```

開発手順などの詳細は追って追加します。 

# エージェント定義の例
```jsonc
{
  "id": "concept-planner",          // エージェントの一意識別子
  "type": "llm",                    // 実行ランタイム種別 ('llm' | 'js' | 'core-transform' など)
  "consumes": ["start"],            // 受信イベント名（複数可）
  "produces": "plan",               // 発行するイベント名（1つ）
  "provider": {                      // LLM プロバイダー設定
    "id": "openai",
    "model": "gpt-4o-mini"
  },
  "prompt": {                        // プロンプトファイル参照
    "system": "prompts/system.txt"
  },
  "schema": {                        // 入出力スキーマへのパス
    "output": "schemas/plan.json"
  },
  "cache": true                      // 同一入力での呼び出しをキャッシュするか
}
``` 

# イベントシステム概要
```mermaid
graph TD;
  "start" -->|"start"| "concept-planner";
  "concept-planner" -->|"plan"| "asset-synthesizer";
  "asset-synthesizer" -->|"compose"| "director";
  "director" -->|"validate"| "critic";
  "critic" -->|"report"| "end";
``` 