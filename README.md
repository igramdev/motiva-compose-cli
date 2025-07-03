# Motiva Compose CLI

TypeScript-based CLI tool for orchestrating multi-agent LLM workflows for video scene generation.

## 🚩 実装状況まとめ（2025-07-03時点）

### ✅ 実装済み・利用可能
- 5段階パイプライン（ConceptPlanner→AssetSynthesizer→Director→Editor→Critic）
- 並列処理・キャッシュ・プログレス表示のCLIコマンド
- パイプライン定義ファイルによる柔軟なパイプライン設計
- キャッシュ統計・キャッシュ管理コマンドの改善
- 予算制限のリセット・調査方法
- OpenAI APIリクエストのデバッグログ追加
- 真の並列パイプライン（ParallelPipelineOrchestrator）の実装
- CLIの`pipeline-parallel`コマンド追加
- リトライ・エラーリカバリ強化（ErrorClassifierによる詳細分類・自動リトライ）
- Editor/Critic/通知/レポート各エージェントの追加とテスト
- Critic AgentのISO 8601日時バリデーション対応

### 🟡 ドキュメントに追記推奨（現状反映が薄い）
- 高度なエラーハンドリング・リトライ戦略の詳細
- キャッシュ・並列処理の効果検証やベンチマーク例
- CLI新コマンド（`advanced`, `notify`, `report`, `pipeline-parallel` など）の説明
- motiva.config.tsの詳細例（エージェント/キャッシュ/並列/通知/レポート設定）

### 🟥 未実装・今後の優先課題
- Remotion等の動画生成エンジン統合（Phase 7/8で延期中）
- APIサーバー/HTTPエンドポイント（Phase 8計画のみ）
- プラグインシステム・カスタムエージェント（Phase 8計画のみ）
- テンプレート/バッチ/自動バックアップ機能（Phase 8計画のみ）
- 詳細なメトリクス・構造化ログ・ヘルスチェック（Phase 8計画のみ）
- CI/CD自動デプロイ・APIドキュメント自動生成（Phase 8計画のみ）
- Remotion Player/Rendererとの完全統合（`render`コマンドの本格実装）

## Phase 1-8 実装状況

✅ **実装完了機能**
- Core CLI フレームワーク (Commander.js)
- Zod スキーマ検証 (ShotPlan, Budget, Config, SceneGraph, JsonPatch)
- 予算管理システム
- Concept Planner エージェント
- Asset Synthesizer エージェント
- Director エージェント
- Editor エージェント（新規追加）
- Critic/QA エージェント（新規追加）
- OpenAI API ラッパー (Chat Completions + Structured Outputs)
- 基本的なバリデーション
- マルチエージェントパイプライン
- 並列処理システム
- キャッシュシステム
- プログレス表示システム
- パイプライン定義ファイル対応
- 真の並列パイプライン実行
- リトライ・エラーリカバリ機能
- 通知システム（新規追加）
- レポート生成システム（新規追加）
- ErrorClassifierによる詳細エラー分類
- パイプライン定義ファイルによる柔軟なパイプライン設計

## 必要環境

- Node.js >= 22.0.0
- OpenAI API キー (環境変数 `OPENAI_API_KEY`)

## セットアップ

```bash
# 依存関係をインストール
npm install

# TypeScriptをビルド
npm run build

# CLIをグローバルにリンク（開発用）
npm link
```

## 使用方法

### 1. プロジェクト初期化

```bash
motiva-compose init my-project
cd my-project
npm install
```

### 2. ショットプラン生成

```bash
# 標準入力からテーマを指定
echo "恋愛ドラマのオープニングを作って" | motiva-compose plan --output plan.json

# ファイルからテーマを指定
cat theme.txt | motiva-compose plan --model gpt-4o-mini --temperature 0.8
```

### 3. プラン検証

```bash
motiva-compose validate plan.json --schema shot-plan
```

### 4. 予算状況確認

```bash
motiva-compose status
```

### 5. パイプライン実行（新機能）

```bash
# パイプライン定義ファイルを使用した実行
echo "桜舞う春の恋愛ストーリー" | motiva-compose pipeline --pipeline-file my-pipeline.json

# 真の並列パイプライン実行
echo "宇宙を舞台にした冒険ファンタジー" | motiva-compose pipeline-parallel --pipeline-file parallel-pipeline.json

# 独立したエージェントを並列実行
motiva-compose parallel-indep --agents "concept-planner,asset-synthesizer" --max-concurrency 2
```

### 6. 発展例機能（新規）

```bash
# 発展例パイプライン実行（Editor + Critic Agent含む）
motiva-compose advanced --theme "桜舞う春の恋愛ストーリー" --notify --report

# 通知システム管理
motiva-compose notify --test          # テスト通知送信
motiva-compose notify --config        # 通知設定表示
motiva-compose notify --history       # 通知履歴表示

# レポート管理
motiva-compose report --list          # レポート一覧表示
motiva-compose report --stats         # 統計レポート生成
```

### 7. キャッシュ・並列処理管理（新機能）

```bash
# キャッシュ管理
motiva-compose cache --stats          # キャッシュ統計表示
motiva-compose cache --clear          # キャッシュクリア
motiva-compose cache --cleanup        # 期限切れキャッシュ削除

# プログレス表示デモ
motiva-compose progress --demo        # プログレス表示のデモ実行

# 並列処理実行
motiva-compose parallel --agents "concept-planner,asset-synthesizer,director" --max-concurrency 3
```

## 例: 完全なワークフロー

```bash
# 1. プロジェクト作成
motiva-compose init romance-opening
cd romance-opening

# 2. テーマからプラン生成
echo "桜舞う春の恋愛ストーリー" | motiva-compose plan

# 3. 生成されたプランを検証
motiva-compose validate plan.json

# 4. 発展例パイプライン実行（5段階）
motiva-compose advanced --theme "桜舞う春の恋愛ストーリー" --notify --report

# 5. レポート確認
motiva-compose report --list

# 6. 予算使用状況を確認
motiva-compose status

# 7. キャッシュ統計確認
motiva-compose cache --stats
```

## パイプライン定義ファイル例

### 基本パイプライン (basic-pipeline.json)
```json
{
  "name": "basic-3-stage-pipeline",
  "version": "1.0.0",
  "description": "3段階パイプライン（ConceptPlanner→AssetSynthesizer→Director）",
  "agents": [
    {
      "name": "concept-planner",
      "type": "concept-planner",
      "config": {
        "timeout": 30000,
        "retries": 3
      }
    },
    {
      "name": "asset-synthesizer",
      "type": "asset-synthesizer",
      "config": {
        "timeout": 60000,
        "retries": 3
      }
    },
    {
      "name": "director",
      "type": "director",
      "config": {
        "timeout": 45000,
        "retries": 3
      }
    }
  ]
}
```

### 高度パイプライン (advanced-pipeline.json)
```json
{
  "name": "advanced-5-stage-pipeline",
  "version": "1.0.0",
  "description": "5段階パイプライン（全エージェント使用）",
  "agents": [
    {
      "name": "concept-planner",
      "type": "concept-planner"
    },
    {
      "name": "asset-synthesizer",
      "type": "asset-synthesizer"
    },
    {
      "name": "director",
      "type": "director"
    },
    {
      "name": "editor",
      "type": "editor"
    },
    {
      "name": "critic",
      "type": "critic"
    }
  ]
}
```

## 新しいエージェント

### Editor Agent
- **役割**: 映像編集・品質向上
- **入力**: SceneGraph
- **出力**: JsonPatch（編集提案）
- **機能**: 映像の流れ改善、タイミング調整、エフェクト最適化
- **特徴**: 空オブジェクトを空配列に自動変換するリカバリ機能

### Critic/QA Agent
- **役割**: 品質評価・フィードバック
- **入力**: SceneGraph
- **出力**: 品質評価レポート
- **機能**: 視覚的品質、ナラティブフロー、技術的実行、感情的インパクトの評価
- **特徴**: ISO 8601日時形式での正確なレポート生成

## 発展例機能

### 通知システム
- **コンソール通知**: リアルタイムでの進捗・エラー表示
- **Slack通知**: Webhook経由での通知（設定可能）
- **Discord通知**: Webhook経由での通知（設定可能）
- **メール通知**: SMTP経由での通知（設定可能）

### レポート生成システム
- **実行レポート**: 各パイプライン実行の詳細レポート
- **統計レポート**: 複数実行の統計分析
- **Markdown形式**: 人間が読みやすい形式での出力
- **JSON形式**: 機械処理可能な形式での出力

### エラーハンドリング・リトライ機能
- **ErrorClassifier**: エラーの詳細分類（ネットワーク、API制限、予算、バリデーション等）
- **自動リトライ**: リトライ可能なエラーに対する指数バックオフ
- **リカバリ機能**: バリデーションエラー時の自動修正（例：空オブジェクト→空配列）

## 出力例

### ショットプラン (plan.json)
```json
{
  "sceneId": "romance-spring",
  "duration": 900,
  "theme": "桜舞う春の恋愛ストーリー",
  "shots": [
    {
      "id": "s1",
      "start": 0,
      "len": 180,
      "desc": "桜並木を歩く二人のシルエット"
    },
    {
      "id": "s2", 
      "start": 180,
      "len": 240,
      "desc": "風に舞う桜の花びらクローズアップ"
    }
  ],
  "bgm": {
    "style": "acoustic_pop",
    "bpm": 85
  }
}
```

### 品質評価レポート (critic-report.json)
```json
{
  "overallScore": 85,
  "qualityAssessment": {
    "visualQuality": 90,
    "narrativeFlow": 85,
    "technicalExecution": 80,
    "emotionalImpact": 88
  },
  "issues": [
    {
      "severity": "medium",
      "category": "technical",
      "description": "レイヤー構成の最適化が必要",
      "suggestion": "レイヤー数を削減してパフォーマンスを向上"
    }
  ],
  "strengths": ["美しい色彩設計", "感情的なストーリーテリング"],
  "recommendations": ["エフェクトの軽量化", "タイミングの微調整"],
  "metadata": {
    "reviewDate": "2023-10-01T12:34:56.789Z",
    "reviewer": "映像品質管理担当者",
    "version": "1.0"
  }
}
```

### パイプライン実行結果 (pipeline-result.json)
```json
{
  "pipelineName": "advanced-5-stage-pipeline",
  "executionId": "5cc91920-dc99-4880-b96e-bfc8a4281c5c",
  "startTime": "2025-07-03T07:00:43.560Z",
  "endTime": "2025-07-03T07:00:48.164Z",
  "duration": 4604,
  "status": "success",
  "results": [
    {
      "agentName": "pipeline",
      "status": "success",
      "duration": 4604,
      "output": {
        "overallScore": 85,
        "qualityAssessment": {
          "visualQuality": 88,
          "narrativeFlow": 80,
          "technicalExecution": 90,
          "emotionalImpact": 82
        }
      }
    }
  ],
  "totalTokens": 793,
  "totalCost": 0.0001
}
```

## 開発

### テスト実行
```bash
npm test
```

### 開発モード
```bash
npm run dev  # TypeScript watch mode
```

### Lint
```bash
npm run lint
```

## アーキテクチャ

```
src/
├── index.ts                    # CLI エントリーポイント
├── schemas/                    # Zod スキーマ定義
├── lib/
│   ├── openai.ts              # OpenAI API ラッパー
│   ├── budget.ts              # 予算管理
│   ├── agent-orchestrator.ts  # エージェントオーケストレーター
│   ├── parallel-orchestrator.ts # 並列処理
│   ├── parallel-pipeline-orchestrator.ts # 真の並列パイプライン
│   ├── cache-manager.ts       # キャッシュ管理
│   ├── progress-manager.ts    # プログレス表示
│   ├── pipeline-manager.ts    # パイプライン管理
│   ├── notification-manager.ts # 通知システム（新規）
│   ├── report-generator.ts    # レポート生成（新規）
│   ├── error-classifier.ts    # エラー分類（新規）
│   ├── retry.ts               # リトライ機能（新規）
│   ├── config-manager.ts      # 設定管理（新規）
│   └── define-config.ts       # 設定定義（新規）
├── agents/
│   ├── concept-planner.ts     # Concept Planner エージェント
│   ├── asset-synthesizer.ts   # Asset Synthesizer エージェント
│   ├── director-agent.ts      # Director エージェント
│   ├── editor-agent.ts        # Editor エージェント（新規）
│   └── critic-agent.ts        # Critic/QA エージェント（新規）
└── __tests__/                 # テストファイル
```

## 今後の予定 (Phase 9+)

### 🟥 未実装・今後の優先課題
- [ ] 動画生成エンジン統合 (`render` コマンド)
- [ ] Remotion 統合
- [ ] HLS プレビュー機能
- [ ] APIサーバー/HTTPエンドポイント
- [ ] プラグインシステム・カスタムエージェント
- [ ] テンプレート/バッチ/自動バックアップ機能
- [ ] 詳細なメトリクス・構造化ログ・ヘルスチェック
- [ ] CI/CD自動デプロイ・APIドキュメント自動生成
- [ ] リアルタイム監視ダッシュボード
- [ ] 分散処理対応

### 🟡 改善予定
- [ ] 高度なエラーリカバリの拡張
- [ ] キャッシュ・並列処理の最適化
- [ ] パフォーマンスベンチマークの追加
- [ ] より詳細なドキュメント・チュートリアル

## ライセンス

MIT (tentative)

---

*このプロジェクトは Motiva プロジェクトの一部として、Cursor IDE と連携して開発されています。* 