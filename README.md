# Motiva Compose CLI

TypeScript-based CLI tool for orchestrating multi-agent LLM workflows for video scene generation.

## Phase 1 (MVP) 実装状況

✅ **実装完了機能**
- Core CLI フレームワーク (Commander.js)
- Zod スキーマ検証 (ShotPlan, Budget, Config)
- 予算管理システム
- Concept Planner エージェント
- OpenAI API ラッパー (Chat Completions)
- 基本的なバリデーション

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

## 例: 完全なワークフロー

```bash
# 1. プロジェクト作成
motiva-compose init romance-opening
cd romance-opening

# 2. テーマからプラン生成
echo "桜舞う春の恋愛ストーリー" | motiva-compose plan

# 3. 生成されたプランを検証
motiva-compose validate plan.json

# 4. 予算使用状況を確認
motiva-compose status
```

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
├── index.ts              # CLI エントリーポイント
├── schemas/              # Zod スキーマ定義
├── lib/
│   ├── openai.ts        # OpenAI API ラッパー
│   └── budget.ts        # 予算管理
├── agents/
│   └── concept-planner.ts # Concept Planner エージェント
└── __tests__/           # テストファイル
```

## 今後の予定 (Phase 2+)

- [ ] Asset Synthesizer (`synth` コマンド)
- [ ] Multi-Agent Orchestration (`compose` コマンド)
- [ ] Remotion 統合 (`render` コマンド)
- [ ] JSON Patch システム
- [ ] HLS プレビュー機能

## ライセンス

MIT (tentative)

---

*このプロジェクトは Motiva プロジェクトの一部として、Cursor IDE と連携して開発されています。* 